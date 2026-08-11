import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { isTrustedServiceWorkerToken } from '../_shared/trusted-worker.ts';

const RequestSchema = z.object({
  limit: z.number().int().min(1).max(1000).optional(),
}).strict();

type OrphanObject = { bucket_id: string; object_name: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!url || !serviceRoleKey) return json({ error: 'supabase_admin_not_configured' }, 501);
  if (!isTrustedServiceWorkerToken(token, serviceRoleKey)) return json({ error: 'service_role_required' }, 401);

  const parsed = RequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({ error: 'invalid_request' }, 400);

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data, error } = await admin.rpc('get_orphaned_assignment_submission_objects', {
    p_limit: parsed.data.limit ?? 500,
  });
  if (error) {
    console.error('submission_orphan_manifest_failed', { code: error.code });
    return json({ error: 'manifest_unavailable' }, 503);
  }

  const objects = (data ?? []) as OrphanObject[];
  if (!objects.length) return json({ removed: 0, scanned: 0 });

  const paths = objects
    .filter((object) => object.bucket_id === 'assignment-submissions')
    .map((object) => object.object_name);
  for (let index = 0; index < paths.length; index += 100) {
    const { error: removeError } = await admin.storage
      .from('assignment-submissions')
      .remove(paths.slice(index, index + 100));
    if (removeError) {
      console.error('submission_orphan_cleanup_failed', { code: removeError.name });
      return json({ error: 'storage_cleanup_failed', removed: index }, 502);
    }
  }

  const { error: auditError } = await admin.rpc('record_orphaned_assignment_submission_cleanup', {
    p_removed_count: paths.length,
  });
  if (auditError) console.error('submission_orphan_cleanup_audit_failed', { code: auditError.code });

  return json({ removed: paths.length, scanned: objects.length });
});
