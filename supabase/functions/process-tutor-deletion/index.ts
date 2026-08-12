// Supabase Edge Function: process-tutor-deletion
//
// TUT-DEL-01 trusted, resumable tutor-deletion saga. This removes tutor-owned
// Storage objects, application PII, and Auth in separate stages so a retry can
// resume safely after an interrupted external call.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RequestSchema = z.object({ requestId: z.string().uuid() });

type ProcessingState =
  | 'queued'
  | 'locked'
  | 'auth_banned'
  | 'storage_deleted'
  | 'database_erased'
  | 'auth_deleted'
  | 'completed';

interface DeletionContext {
  already_completed?: boolean;
  tutor_id?: string;
  auth_user_id?: string | null;
  processing_state: ProcessingState;
}

function decodeAal(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const claims = JSON.parse(atob(padded)) as Record<string, unknown>;
    return typeof claims.aal === 'string' ? claims.aal : null;
  } catch {
    return null;
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'unknown_error';
}

function safeErrorCode(error: unknown): string {
  if (error && typeof error === 'object') {
    const candidate = error as { code?: unknown; status?: unknown };
    if (typeof candidate.code === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(candidate.code)) {
      return candidate.code;
    }
    if (typeof candidate.status === 'number') return `http_${candidate.status}`;
  }
  const message = messageOf(error);
  return /^[A-Za-z0-9_.:-]{1,120}$/.test(message) ? message : 'worker_failed';
}

function isAuthUserMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { status?: number; code?: string; message?: string };
  return candidate.status === 404
    || candidate.code === 'user_not_found'
    || /user.*not.*found/i.test(candidate.message ?? '');
}

function statusForError(message: string): number {
  if (message === 'supabase_bearer_required' || message === 'supabase_bearer_invalid') return 401;
  if (message === 'admin_required' || message === 'admin_mfa_required') return 403;
  if (message === 'rate_limited') return 429;
  if (message === 'tutor_deletion_request_not_found' || message === 'tutor_not_found') return 404;
  if (message === 'tutor_deletion_busy') return 409;
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
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return json({ error: 'supabase_admin_not_configured' }, 501);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'supabase_bearer_required' }, 401);

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  let requestId: string | null = null;
  let stage = 'authorize';

  try {
    const isTrustedWorker = token === serviceRoleKey;
    let authenticatedUserId: string | null = null;

    if (!isTrustedWorker) {
      const { data: userData, error: userError } = await admin.auth.getUser(token);
      if (userError || !userData.user) throw new Error('supabase_bearer_invalid');
      authenticatedUserId = userData.user.id;

      const { data: callerProfile, error: profileError } = await admin
        .from('profiles')
        .select('role')
        .eq('auth_user_id', authenticatedUserId)
        .maybeSingle();
      if (profileError) throw profileError;
      if ((callerProfile as { role?: string } | null)?.role !== 'admin') throw new Error('admin_required');
      if (decodeAal(token) !== 'aal2') throw new Error('admin_mfa_required');

      const { data: allowed, error: rateLimitError } = await admin.rpc(
        'check_and_record_edge_function_rate_limit',
        {
          p_subject_id: authenticatedUserId,
          p_function_name: 'process-tutor-deletion',
          p_limit: 5,
          p_window_seconds: 10 * 60,
        },
      );
      if (rateLimitError) throw new Error('rate_limiter_unavailable');
      if (allowed !== true) throw new Error('rate_limited');
    }

    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'invalid_request', details: parsed.error.flatten() }, 400);
    requestId = parsed.data.requestId;

    const claimToken = crypto.randomUUID();
    stage = 'locked';
    const { data: claimData, error: claimError } = await admin.rpc('claim_tutor_deletion', {
      p_request_id: requestId,
      p_claim_token: claimToken,
    });
    if (claimError) throw claimError;

    const context = claimData as DeletionContext;
    if (context.already_completed || context.processing_state === 'completed') {
      return json({ completed: true, alreadyCompleted: true });
    }

    const authUserId = context.auth_user_id ?? null;
    let processingState = context.processing_state;

    const renewLease = async () => {
      const { error } = await admin.rpc('renew_tutor_deletion_lease', {
        p_request_id: requestId,
        p_claim_token: claimToken,
      });
      if (error) throw error;
    };

    // Ban before erasing application data: this prevents fresh sign-in while
    // the database identity lock already neutralizes existing application JWTs.
    if (processingState === 'locked') {
      stage = 'auth_banned';
      await renewLease();
      if (authUserId) {
        const { error } = await admin.auth.admin.updateUserById(authUserId, { ban_duration: '876000h' });
        if (error && !isAuthUserMissing(error)) throw error;
      }
      const { error } = await admin.rpc('mark_tutor_deletion_auth_banned', { p_request_id: requestId });
      if (error) throw error;
      processingState = 'auth_banned';
    }

    // Only database-recorded document keys are removed; the worker never
    // broad-lists a folder and accidentally removes unrelated objects.
    if (processingState === 'auth_banned') {
      stage = 'storage_deleted';
      await renewLease();
      const { data: manifestData, error: manifestError } = await admin.rpc(
        'get_tutor_deletion_storage_manifest',
        { p_request_id: requestId },
      );
      if (manifestError) throw manifestError;
      const paths = Array.isArray(manifestData)
        ? manifestData.filter((path): path is string => typeof path === 'string')
        : [];

      const { error: manifestReceiptError } = await admin.rpc(
        'record_tutor_deletion_storage_manifest',
        { p_request_id: requestId, p_files_expected: paths.length },
      );
      if (manifestReceiptError) throw manifestReceiptError;

      for (const batch of chunks(paths, 1000)) {
        const { error } = await admin.storage.from('tutor-documents').remove(batch);
        if (error) throw error;
      }

      const { error: markStorageError } = await admin.rpc('mark_tutor_deletion_storage_deleted', {
        p_request_id: requestId,
        p_files_removed: paths.length,
      });
      if (markStorageError) throw markStorageError;
      processingState = 'storage_deleted';
    }

    if (processingState === 'storage_deleted') {
      stage = 'database_erased';
      await renewLease();
      const { error } = await admin.rpc('erase_tutor_data', { p_request_id: requestId });
      if (error) throw error;
      processingState = 'database_erased';
    }

    // Auth is last: all retained records are already detached from it.
    if (processingState === 'database_erased') {
      stage = 'auth_deleted';
      await renewLease();
      if (authUserId) {
        const { error } = await admin.auth.admin.deleteUser(authUserId, false);
        if (error && !isAuthUserMissing(error)) throw error;
      }
      const { error } = await admin.rpc('mark_tutor_deletion_auth_deleted', { p_request_id: requestId });
      if (error) throw error;
      processingState = 'auth_deleted';
    }

    if (processingState === 'auth_deleted') {
      stage = 'completed';
      await renewLease();
      const { data, error } = await admin.rpc('finalize_tutor_deletion', { p_request_id: requestId });
      if (error) throw error;
      return json(data ?? { completed: true });
    }

    throw new Error(`unexpected_tutor_deletion_state:${processingState}`);
  } catch (error) {
    const code = safeErrorCode(error);
    if (requestId) {
      try {
        await admin.rpc('record_tutor_deletion_error', {
          p_request_id: requestId,
          p_stage: stage,
          p_error: code,
        });
      } catch {
        // The original error is still more useful than a failure-marker error.
      }
    }
    console.error('tutor_deletion_failed', { stage, code });
    return json(
      { error: code === 'worker_failed' ? 'tutor_deletion_failed' : code, stage },
      statusForError(messageOf(error)),
    );
  }
});
