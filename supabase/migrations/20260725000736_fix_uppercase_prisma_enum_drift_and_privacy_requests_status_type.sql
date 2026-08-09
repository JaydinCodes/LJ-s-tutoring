-- Fix (2026-07-25): schema.sql defines 7 enum types as lowercase (deliberately
-- diverging from Prisma's original uppercase, per its own code comments on
-- session_status/pay_period_status), guarded by
-- `if not exists (select 1 from pg_type where typname = ...)` so re-applying
-- schema.sql is idempotent. That guard means: on production, where these
-- types ALREADY existed with the old uppercase Prisma labels (created before
-- this Supabase-native schema.sql existed), the guard silently no-ops and
-- production was never actually brought in line. Every RPC in schema.sql
-- compares against lowercase literals ('draft', 'submitted', 'approved', ...),
-- so any real call that touched these columns would fail with
-- "invalid input value for enum". All affected tables are confirmed 0 rows in
-- production, so renaming labels is a pure, safe, non-destructive relabel.
do $$
declare
  rename_target record;
begin
  for rename_target in
    select * from (values
      ('adjustment_status', 'DRAFT', 'draft'), ('adjustment_status', 'APPROVED', 'approved'),
      ('adjustment_type', 'BONUS', 'bonus'), ('adjustment_type', 'CORRECTION', 'correction'), ('adjustment_type', 'PENALTY', 'penalty'),
      ('invoice_line_type', 'SESSION', 'session'), ('invoice_line_type', 'ADJUSTMENT', 'adjustment'),
      ('invoice_status', 'DRAFT', 'draft'), ('invoice_status', 'ISSUED', 'issued'), ('invoice_status', 'PAID', 'paid'),
      ('pay_period_status', 'OPEN', 'open'), ('pay_period_status', 'LOCKED', 'locked'),
      ('session_status', 'DRAFT', 'draft'), ('session_status', 'SUBMITTED', 'submitted'), ('session_status', 'APPROVED', 'approved'), ('session_status', 'REJECTED', 'rejected'),
      ('privacy_request_type', 'ACCESS', 'access'), ('privacy_request_type', 'CORRECTION', 'correction'), ('privacy_request_type', 'DELETION', 'deletion')
    ) as targets(type_name, old_label, new_label)
  loop
    if exists (
      select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace join pg_enum e on e.enumtypid = t.oid
      where n.nspname = 'public' and t.typname = rename_target.type_name and e.enumlabel = rename_target.old_label
    ) then
      execute format('alter type public.%I rename value %L to %L', rename_target.type_name, rename_target.old_label, rename_target.new_label);
    end if;
  end loop;
end
$$;

-- Fix (2026-07-25): public.privacy_requests.status is not just mis-cased, it's
-- the WRONG TYPE entirely -- production has it as the dead legacy
-- privacy_request_status (OPEN/CLOSED), but schema.sql's authoritative
-- `create table public.privacy_requests` (line 1646) declares
-- `status public.record_status not null default 'pending'`. process_privacy_request()
-- assigns a public.record_status value ('approved') to this column, which
-- would fail at runtime with a type-mismatch error against the live wrong
-- type. 0 rows in production, so a direct type change with a fresh default
-- is safe.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'privacy_requests' and column_name = 'status' and udt_name <> 'record_status'
  ) then
    alter table public.privacy_requests alter column status drop default;
    alter table public.privacy_requests alter column status type public.record_status using 'pending'::public.record_status;
    alter table public.privacy_requests alter column status set default 'pending'::public.record_status;
  end if;
end
$$;

-- Fix (2026-07-25): subject_id/subject_type are NOT NULL orphaned Prisma-era
-- columns absent from schema.sql's privacy_requests definition entirely
-- (schema.sql uses subject_student_id/subject_profile_id instead) -- the
-- same orphaned-NOT-NULL-column bug as adjustments/weekly_reports/sessions/
-- snapshots fixed earlier today. Nothing in schema.sql ever sets them, so any
-- insert via the admin client (the privacy_requests_admin_all RLS policy is
-- the only write path) would fail.
do $$
declare
  v_column_name text;
begin
  foreach v_column_name in array array['subject_id', 'subject_type'] loop
    if exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = 'privacy_requests' and c.column_name = v_column_name and c.is_nullable = 'NO'
    ) then
      execute format('alter table public.privacy_requests alter column %I drop not null', v_column_name);
    end if;
  end loop;
end
$$;

-- Cleanup: drop now-fully-orphaned dead Prisma enum types, same reasoning as
-- dropping public.users earlier today -- confirmed via information_schema
-- that no column anywhere uses "role", and privacy_request_status is now
-- unused after the status column migration above.
drop type if exists public.role;
drop type if exists public.privacy_request_status;
