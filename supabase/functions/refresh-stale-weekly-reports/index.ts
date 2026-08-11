// Supabase Edge Function: refresh-stale-weekly-reports
// Rebuilds a bounded batch of stale persisted weekly-report snapshots.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { isTrustedServiceWorkerToken } from '../_shared/trusted-worker.ts';

const RequestSchema = z.object({
  maxReports: z.number().int().min(1).max(25).optional(),
}).strict();

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!isTrustedServiceWorkerToken(token, serviceRoleKey)) return json({ error: 'service_role_required' }, 401);

  let payload: z.infer<typeof RequestSchema>;
  try {
    payload = RequestSchema.parse(await request.json().catch(() => ({})));
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'worker_not_configured' }, 500);

  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data, error } = await client.rpc('refresh_stale_weekly_reports', { p_limit: payload.maxReports ?? 10 });
  if (error) return json({ error: 'weekly_report_refresh_failed' }, 500);

  return json({ refreshed: data ?? 0 });
});
