// Supabase Edge Function: process-privacy-deletion
//
// PRIV-01 trusted deletion orchestrator. Postgres, Auth, and Storage are separate
// services, so this is an idempotent fail-closed saga rather than a fake
// cross-service transaction. The privacy request becomes approved only after
// Auth ban, Storage deletion, DB erasure, Auth hard-delete, and receipt creation.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RequestSchema = z.object({
  requestId: z.string().uuid(),
});

type ProcessingState =
  | 'queued'
  | 'locked'
  | 'auth_banned'
  | 'storage_deleted'
  | 'db_erased'
  | 'auth_deleted'
  | 'completed';

interface BeginResult {
  already_completed: boolean;
  request_id?: string;
  student_id?: string;
  profile_id?: string;
  auth_user_id?: string | null;
  financial_hold?: boolean;
  processing_state: ProcessingState;
}

interface StorageManifestRow {
  bucket_id: string;
  object_name: string;
}

function decodeAal(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );

    const decoded = JSON.parse(atob(padded)) as Record<string, unknown>;
    return typeof decoded.aal === 'string' ? decoded.aal : null;
  } catch {
    return null;
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'unknown_error';
}

function safeErrorCode(error: unknown): string {
  if (error && typeof error === 'object') {
    const candidate = error as { code?: unknown; status?: unknown };
    if (typeof candidate.code === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(candidate.code)) {
      return candidate.code;
    }
    if (typeof candidate.status === 'number') {
      return `http_${candidate.status}`;
    }
  }

  const message = messageOf(error);
  if (/^[A-Za-z0-9_.:-]{1,120}$/.test(message)) return message;
  return 'worker_failed';
}

function isAuthUserMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as { status?: number; code?: string; message?: string };
  return (
    candidate.status === 404 ||
    candidate.code === 'user_not_found' ||
    /user.*not.*found/i.test(candidate.message ?? '')
  );
}

function statusForError(message: string): number {
  if (message === 'supabase_bearer_required' || message === 'supabase_bearer_invalid') return 401;
  if (message === 'admin_required' || message === 'admin_mfa_required') return 403;
  if (message === 'rate_limited') return 429;
  if (message === 'privacy_request_not_found') return 404;
  if (message === 'privacy_request_is_not_deletion') return 409;
  return 500;
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceRoleKey) {
    return json({ error: 'supabase_admin_not_configured' }, 501);
  }

  const token = (req.headers.get('Authorization') || '')
    .replace(/^Bearer\s+/i, '')
    .trim();

  if (!token) {
    return json({ error: 'supabase_bearer_required' }, 401);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  let requestId: string | null = null;
  let stage = 'authorize';

  try {
    // Validate caller identity with Auth, then require platform admin + AAL2.
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error('supabase_bearer_invalid');
    }

    const { data: callerProfile, error: callerProfileError } = await admin
      .from('profiles')
      .select('role')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle();

    if (callerProfileError) throw callerProfileError;
    if ((callerProfile as { role?: string } | null)?.role !== 'admin') {
      throw new Error('admin_required');
    }
    if (decodeAal(token) !== 'aal2') {
      throw new Error('admin_mfa_required');
    }

    const { data: rateLimitAllowed, error: rateLimitError } = await admin.rpc(
      'check_and_record_edge_function_rate_limit',
      {
        p_subject_id: userData.user.id,
        p_function_name: 'process-privacy-deletion',
        p_limit: 5,
        p_window_seconds: 10 * 60,
      },
    );

    if (rateLimitError) {
      throw new Error('rate_limiter_unavailable');
    }
    if (rateLimitAllowed !== true) {
      throw new Error('rate_limited');
    }

    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: 'invalid_request', details: parsed.error.flatten() }, 400);
    }

    requestId = parsed.data.requestId;

    // Stage 1: DB privacy lock. This immediately removes the Auth -> profile
    // authorization mapping and makes the student operationally inactive.
    stage = 'locked';
    const { data: beginData, error: beginError } = await admin.rpc(
      'begin_student_privacy_deletion',
      { p_request_id: requestId },
    );
    if (beginError) throw beginError;

    const context = beginData as BeginResult;
    if (context.already_completed || context.processing_state === 'completed') {
      return json({ completed: true, alreadyCompleted: true });
    }

    const authUserId = context.auth_user_id ?? null;
    let processingState = context.processing_state;

    // Stage 2: ban the Auth identity before destructive application cleanup.
    // The ban prevents fresh sign-in/refresh while the DB identity lock makes
    // any already-issued JWT useless for application authorization.
    if (processingState === 'locked') {
      stage = 'auth_banned';

      if (authUserId) {
        const { error: banError } = await admin.auth.admin.updateUserById(authUserId, {
          ban_duration: '876000h',
        });

        if (banError && !isAuthUserMissing(banError)) {
          throw banError;
        }
      }

      const { error: markBanError } = await admin.rpc(
        'mark_student_privacy_auth_banned',
        { p_request_id: requestId },
      );
      if (markBanError) throw markBanError;

      processingState = 'auth_banned';
    }

    // Stage 3: delete every known/owned Storage object through the Storage API.
    if (processingState === 'auth_banned') {
      stage = 'storage_deleted';

      const { data: manifestData, error: manifestError } = await admin.rpc(
        'get_student_privacy_storage_manifest',
        { p_request_id: requestId },
      );
      if (manifestError) throw manifestError;

      const manifest = (manifestData ?? []) as StorageManifestRow[];
      const byBucket = new Map<string, string[]>();

      for (const row of manifest) {
        const existing = byBucket.get(row.bucket_id) ?? [];
        existing.push(row.object_name);
        byBucket.set(row.bucket_id, existing);
      }

      let removed = 0;

      for (const [bucket, paths] of byBucket) {
        for (const batch of chunks(paths, 1000)) {
          const { error: removeError } = await admin.storage.from(bucket).remove(batch);
          if (removeError) throw removeError;
          removed += batch.length;
        }
      }

      const { error: markStorageError } = await admin.rpc(
        'mark_student_privacy_storage_deleted',
        {
          p_request_id: requestId,
          p_files_removed: removed,
        },
      );
      if (markStorageError) throw markStorageError;

      processingState = 'storage_deleted';
    }

    // Stage 4: erase/anonymize the explicit application-data manifest.
    if (processingState === 'storage_deleted') {
      stage = 'db_erased';

      const { error: eraseError } = await admin.rpc('erase_student_privacy_data', {
        p_request_id: requestId,
      });
      if (eraseError) throw eraseError;

      processingState = 'db_erased';
    }

    // Stage 5: hard-delete the Auth user. A retry after a successful prior
    // deletion treats user-not-found as success.
    if (processingState === 'db_erased') {
      stage = 'auth_deleted';

      if (authUserId) {
        const { error: deleteError } = await admin.auth.admin.deleteUser(authUserId, false);
        if (deleteError && !isAuthUserMissing(deleteError)) {
          throw deleteError;
        }
      }

      const { error: markAuthDeletedError } = await admin.rpc(
        'mark_student_privacy_auth_deleted',
        { p_request_id: requestId },
      );
      if (markAuthDeletedError) throw markAuthDeletedError;

      processingState = 'auth_deleted';
    }

    // Stage 6: immutable, PII-free receipt + final request completion.
    if (processingState === 'auth_deleted') {
      stage = 'completed';

      const { data: finalData, error: finalError } = await admin.rpc(
        'finalize_student_privacy_deletion',
        { p_request_id: requestId },
      );
      if (finalError) throw finalError;

      return json(finalData ?? { completed: true });
    }

    throw new Error(`unexpected_privacy_processing_state:${processingState}`);
  } catch (error) {
    const message = messageOf(error);
    const errorCode = safeErrorCode(error);

    // Best-effort failure marker. Persist/log only a normalized code, never a
    // vendor error string that could contain the erased subject's PII.
    if (requestId) {
      try {
        await admin.rpc('record_student_privacy_deletion_error', {
          p_request_id: requestId,
          p_stage: stage,
          p_error: errorCode,
        });
      } catch {
        // Do not hide the original error if failure recording also fails.
      }
    }

    console.error('privacy_deletion_failed', { stage, errorCode });
    return json(
      { error: errorCode === 'worker_failed' ? 'privacy_deletion_failed' : errorCode, stage },
      statusForError(message),
    );
  }
});