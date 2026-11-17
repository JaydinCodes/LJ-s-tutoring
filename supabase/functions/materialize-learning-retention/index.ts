import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  const apiKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  const authorization = request.headers.get('authorization');
  if (!authorization || !/^Bearer \S+$/i.test(authorization)) {
    return json({ error: 'unauthorized' }, 401);
  }
  if (!apiKey || !url) return json({ error: 'worker_not_configured' }, 500);

  const client = createClient(url, apiKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await client.rpc('materialize_learning_retention_checks', { p_as_of: new Date().toISOString() });
  if (error?.code === '42501' || error?.code === 'PGRST301') return json({ error: 'unauthorized' }, 401);
  if (error) return json({ error: error.message }, 500);
  return json({ created: data ?? 0 });
});
