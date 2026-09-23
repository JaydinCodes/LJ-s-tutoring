import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  if (!serviceKey || !url || request.headers.get('authorization') !== `Bearer ${serviceKey}`) {
    return json({ error: 'unauthorized' }, 401);
  }

  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.rpc('materialize_learning_retention_checks', { p_as_of: new Date().toISOString() });
  if (error) return json({ error: error.message }, 500);
  return json({ created: data ?? 0 });
});
