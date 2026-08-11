import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { isTrustedServiceWorkerToken } from '../_shared/trusted-worker.ts';

const RequestSchema = z.object({
  maxJobs: z.number().int().min(1).max(100).optional(),
}).strict();

type ClaimedEvent = { id: string; claim_token: string; payload_json: Record<string, unknown> };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function safeErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code.slice(0, 120);
  }
  return 'dispatch_failed';
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
  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let dispatched = 0;
  let failed = 0;
  const maxJobs = parsed.data.maxJobs ?? 25;

  for (let index = 0; index < maxJobs; index += 1) {
    const { data, error } = await admin.rpc('claim_next_notification_outbox_event');
    if (error) {
      console.error('notification_outbox_claim_failed', { code: error.code });
      return json({ error: 'outbox_unavailable', dispatched, failed }, 503);
    }
    const claim = (Array.isArray(data) ? data[0] : data) as ClaimedEvent | null;
    if (!claim) break;

    const delivered = await admin.rpc('dispatch_notification_outbox_event', {
      p_event_id: claim.id,
      p_claim_token: claim.claim_token,
    });
    if (!delivered.error) {
      dispatched += 1;
      continue;
    }
    failed += 1;
    console.error('notification_outbox_dispatch_failed', { code: delivered.error.code });
    const failure = await admin.rpc('fail_notification_outbox_event', {
      p_event_id: claim.id,
      p_claim_token: claim.claim_token,
      p_error_code: safeErrorCode(delivered.error),
    });
    if (failure.error) console.error('notification_outbox_failure_record_failed', { code: failure.error.code });
  }

  return json({ dispatched, failed });
});
