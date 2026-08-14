import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PasswordSchema = z.object({ password: z.string().min(10).max(200) });

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

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'supabase_bearer_required' }, 401);
  const parsed = PasswordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'invalid_request', details: parsed.error.flatten() }, 400);

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'supabase_bearer_invalid' }, 401);
  const user = userData.user;
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (profileError || (profile as { role?: string } | null)?.role !== 'student') return json({ error: 'student_required' }, 403);
  if (user.app_metadata?.require_password_change !== true) return json({ error: 'temporary_password_not_required' }, 409);

  const { data: permitted, error: rateLimitError } = await admin.rpc('check_and_record_edge_function_rate_limit', {
    p_subject_id: user.id,
    p_function_name: 'complete-temporary-password',
    p_limit: 5,
    p_window_seconds: 10 * 60,
  });
  if (rateLimitError) return json({ error: 'rate_limiter_unavailable' }, 503);
  if (permitted !== true) return json({ error: 'rate_limited' }, 429);

  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password: parsed.data.password,
    app_metadata: { ...user.app_metadata, require_password_change: false },
  });
  if (updateError) return json({ error: 'password_update_failed' }, 400);
  return json({ ok: true });
});
