-- students.full_name is not part of this schema's documented model (see
-- docs/supabase/schema.sql's students table -- profiles.full_name is the
-- single source of truth for a person's name) but exists in production as a
-- leftover NOT NULL column from an earlier schema iteration, with no
-- default. This blocked every insert into students until now -- nothing had
-- actually attempted a new students row since this migration began (every
-- other repoint only read/referenced existing rows), so the bug was latent
-- until admin-invite-user's functional verification (creating a real new
-- student) surfaced it. The table has zero rows in production, so this is a
-- pure constraint fix, not a data migration.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'students'
      and column_name = 'full_name'
      and is_nullable = 'NO'
  ) then
    alter table public.students alter column full_name drop not null;
  end if;
end
$$;
