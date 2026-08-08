create table if not exists public.edge_function_rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null,
  function_name text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_edge_function_rate_limit_events_lookup
  on public.edge_function_rate_limit_events(function_name, subject_id, created_at desc);
alter table public.edge_function_rate_limit_events enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;

revoke all on public.profile_identities from anon, authenticated;;
