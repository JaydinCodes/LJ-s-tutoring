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
alter type public.adjustment_status rename value 'DRAFT' to 'draft';
alter type public.adjustment_status rename value 'APPROVED' to 'approved';

alter type public.adjustment_type rename value 'BONUS' to 'bonus';
alter type public.adjustment_type rename value 'CORRECTION' to 'correction';
alter type public.adjustment_type rename value 'PENALTY' to 'penalty';

alter type public.invoice_line_type rename value 'SESSION' to 'session';
alter type public.invoice_line_type rename value 'ADJUSTMENT' to 'adjustment';

alter type public.invoice_status rename value 'DRAFT' to 'draft';
alter type public.invoice_status rename value 'ISSUED' to 'issued';
alter type public.invoice_status rename value 'PAID' to 'paid';

alter type public.pay_period_status rename value 'OPEN' to 'open';
alter type public.pay_period_status rename value 'LOCKED' to 'locked';

alter type public.session_status rename value 'DRAFT' to 'draft';
alter type public.session_status rename value 'SUBMITTED' to 'submitted';
alter type public.session_status rename value 'APPROVED' to 'approved';
alter type public.session_status rename value 'REJECTED' to 'rejected';

alter type public.privacy_request_type rename value 'ACCESS' to 'access';
alter type public.privacy_request_type rename value 'CORRECTION' to 'correction';
alter type public.privacy_request_type rename value 'DELETION' to 'deletion';

-- Fix (2026-07-25): public.privacy_requests.status is not just mis-cased, it's
-- the WRONG TYPE entirely -- production has it as the dead legacy
-- privacy_request_status (OPEN/CLOSED), but schema.sql's authoritative
-- `create table public.privacy_requests` (line 1646) declares
-- `status public.record_status not null default 'pending'`. process_privacy_request()
-- assigns a public.record_status value ('approved') to this column, which
-- would fail at runtime with a type-mismatch error against the live wrong
-- type. 0 rows in production, so a direct type change with a fresh default
-- is safe.
alter table public.privacy_requests alter column status drop default;
alter table public.privacy_requests alter column status type public.record_status using 'pending'::public.record_status;
alter table public.privacy_requests alter column status set default 'pending'::public.record_status;

-- Fix (2026-07-25): subject_id/subject_type are NOT NULL orphaned Prisma-era
-- columns absent from schema.sql's privacy_requests definition entirely
-- (schema.sql uses subject_student_id/subject_profile_id instead) -- the
-- same orphaned-NOT-NULL-column bug as adjustments/weekly_reports/sessions/
-- snapshots fixed earlier today. Nothing in schema.sql ever sets them, so any
-- insert via the admin client (the privacy_requests_admin_all RLS policy is
-- the only write path) would fail.
alter table public.privacy_requests alter column subject_id drop not null;
alter table public.privacy_requests alter column subject_type drop not null;

-- Cleanup: drop now-fully-orphaned dead Prisma enum types, same reasoning as
-- dropping public.users earlier today -- confirmed via information_schema
-- that no column anywhere uses "role", and privacy_request_status is now
-- unused after the status column migration above.
drop type if exists public.role;
drop type if exists public.privacy_request_status;;
