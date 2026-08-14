-- A data-free PostgREST probe for uptime monitoring. Do not repoint this at a
-- product table: RLS correctly denies anonymous reads on those tables.
create or replace function public.monitoring_health_probe()
returns table(status text)
language sql
stable
security invoker
set search_path = ''
as $$
  select 'ok'::text;
$$;

revoke all on function public.monitoring_health_probe() from public;
grant execute on function public.monitoring_health_probe() to anon, authenticated;
