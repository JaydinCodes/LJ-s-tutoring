-- Project Odysseus initial Supabase LMS schema plan.
-- This is additive planning SQL for a Supabase project, not yet wired into the existing Prisma migrations.

create extension if not exists "pgcrypto";

-- Postgres has no `create type ... if not exists`; guarded via pg_type check
-- (matches this file's established guarded-enum convention) so this file can
-- be safely re-applied against an already-migrated database, not just a fresh one.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('student', 'tutor', 'admin', 'parent', 'ngo_partner');
  end if;
  if not exists (select 1 from pg_type where typname = 'record_status') then
    create type public.record_status as enum ('active', 'inactive', 'pending', 'approved', 'suspended');
  end if;
  if not exists (select 1 from pg_type where typname = 'assignment_status') then
    create type public.assignment_status as enum ('draft', 'published', 'closed', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'submission_status') then
    create type public.submission_status as enum ('not_submitted', 'submitted', 'marked', 'returned');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum ('pending', 'paid', 'overdue', 'voided');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text,
  role public.user_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ngo_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  contact_email text,
  contact_phone text,
  location text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  grade text,
  school text,
  parent_name text,
  parent_contact text,
  ngo_partner_id uuid references public.ngo_partners(id),
  status public.record_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.student_career_profiles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students(id) on delete cascade,
  interests_json jsonb not null default '[]'::jsonb,
  preferred_subjects_json jsonb not null default '[]'::jsonb,
  target_careers_json jsonb not null default '[]'::jsonb,
  aps_target integer check (aps_target is null or (aps_target >= 0 and aps_target <= 60)),
  saved_careers_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tutors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  subjects text[] not null default '{}',
  grades text[] not null default '{}',
  hourly_rate numeric(12, 2),
  status public.record_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade text,
  curriculum text,
  unique (name, grade, curriculum)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  subject_id uuid references public.subjects(id),
  grade text,
  due_date timestamptz,
  created_by uuid references public.profiles(id),
  status public.assignment_status not null default 'draft',
  attachment_url text,
  rubric_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  communication_preference text not null default 'email',
  notes text,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email)
);

create table if not exists public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  relationship_type text not null default 'guardian',
  is_primary boolean not null default false,
  can_receive_reports boolean not null default true,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, guardian_id)
);

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  storage_key text,
  file_url text,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  text_answer text,
  submitted_at timestamptz not null default now(),
  status public.submission_status not null default 'submitted',
  version_number integer not null default 1,
  is_latest boolean not null default true,
  marks_awarded numeric(8, 2),
  feedback text,
  rubric_scores_json jsonb not null default '{}'::jsonb,
  marks_released boolean not null default false,
  feedback_released boolean not null default false,
  released_at timestamptz,
  unique (assignment_id, student_id, version_number)
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role public.user_role,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Backfill for a database where this table was partially created by an
-- earlier, interrupted migration attempt (same reasoning as the
-- assignment_submissions backfill elsewhere in this file).
alter table public.audit_log add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Guarded ALTER (idempotent, matching the privacy_request_type enum guard
-- pattern): alter table ... add constraint has no native IF NOT EXISTS.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'assignment_submissions_marks_range') then
    alter table public.assignment_submissions
      add constraint assignment_submissions_marks_range
      check (marks_awarded is null or (marks_awarded >= 0 and marks_awarded <= 100));
  end if;
end
$$;

alter table public.assignments add column if not exists rubric_json jsonb not null default '[]'::jsonb;
-- These columns are also in the inline CREATE TABLE above, which is a no-op
-- against a database where assignment_submissions already existed before
-- this column set was designed (confirmed live in production: `create table
-- if not exists` skips the WHOLE statement if the table exists at all, it
-- does not add missing columns to an existing table) -- so every column
-- needs its own ADD COLUMN IF NOT EXISTS backfill, not just the four that
-- already had one.
alter table public.assignment_submissions add column if not exists storage_key text;
alter table public.assignment_submissions add column if not exists file_url text;
alter table public.assignment_submissions add column if not exists original_filename text;
alter table public.assignment_submissions add column if not exists mime_type text;
alter table public.assignment_submissions add column if not exists size_bytes bigint;
alter table public.assignment_submissions add column if not exists text_answer text;
alter table public.assignment_submissions add column if not exists version_number integer not null default 1;
alter table public.assignment_submissions add column if not exists is_latest boolean not null default true;
alter table public.assignment_submissions add column if not exists rubric_scores_json jsonb not null default '{}'::jsonb;
alter table public.assignment_submissions add column if not exists marks_released boolean not null default false;
alter table public.assignment_submissions add column if not exists feedback_released boolean not null default false;
alter table public.assignment_submissions add column if not exists released_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'assignments_rubric_json_array') then
    alter table public.assignments
      add constraint assignments_rubric_json_array
      check (jsonb_typeof(rubric_json) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'assignment_submissions_rubric_scores_object') then
    alter table public.assignment_submissions
      add constraint assignment_submissions_rubric_scores_object
      check (jsonb_typeof(rubric_scores_json) = 'object');
  end if;
  -- Size caps (64KB): nothing previously stopped a client from storing a
  -- multi-megabyte rubric/rubric-scores JSON document.
  if not exists (select 1 from pg_constraint where conname = 'assignments_rubric_json_size') then
    alter table public.assignments
      add constraint assignments_rubric_json_size
      check (octet_length(rubric_json::text) < 65536);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'assignment_submissions_rubric_scores_size') then
    alter table public.assignment_submissions
      add constraint assignment_submissions_rubric_scores_size
      check (octet_length(rubric_scores_json::text) < 65536);
  end if;
end
$$;

create table if not exists public.student_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid references public.subjects(id),
  topic text not null,
  score numeric(5, 2) not null check (score >= 0 and score <= 100),
  cognitive_level text,
  recorded_at timestamptz not null default now(),
  assignment_submission_id uuid references public.assignment_submissions(id) on delete cascade
);

-- Backfill for a pre-existing production table (the inline column above is a
-- no-op there -- see the "Identity lookup shadow table" / assignment_submissions
-- backfill precedent elsewhere in this file for why this second statement is
-- required, not redundant).
alter table public.student_progress add column if not exists assignment_submission_id uuid references public.assignment_submissions(id) on delete cascade;

-- Real bug fix, not a design choice: mark_assignment_submission() used to do
-- a plain INSERT into student_progress every time a submission was (re-)marked,
-- so re-marking the same submission (e.g. 65 -> 70 -> 72) created a new
-- progress row each time instead of updating the one that already represented
-- it, inflating averages/history. This partial unique index lets the RPC
-- upsert on (assignment_submission_id) instead. Partial (not a plain unique
-- constraint) because older progress rows predating this column, or any
-- future non-submission-derived progress entry, legitimately have no
-- assignment_submission_id and must not be forced to collide on NULL.
create unique index if not exists idx_student_progress_submission_unique
  on public.student_progress(assignment_submission_id)
  where assignment_submission_id is not null;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  payment_type text not null,
  status public.payment_status not null default 'pending',
  due_date date,
  paid_at timestamptz,
  notes text
);

create table if not exists public.tutor_payments (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  payment_period text not null,
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  notes text
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Class',
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  subject_id uuid references public.subjects(id),
  grade text,
  location text,
  day_of_week text,
  start_time time,
  end_time time,
  ngo_partner_id uuid references public.ngo_partners(id),
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Guarded ALTER (idempotent, matching the tutors_approval_status_check
-- pattern): nothing previously stopped end_time <= start_time from being saved.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'classes_time_range') then
    alter table public.classes
      add constraint classes_time_range
      check (end_time is null or start_time is null or end_time > start_time);
  end if;
end
$$;

alter table public.classes add column if not exists name text not null default 'Class';
alter table public.classes add column if not exists status public.record_status not null default 'active';
alter table public.classes add column if not exists created_at timestamptz not null default now();
alter table public.classes add column if not exists updated_at timestamptz not null default now();

create table if not exists public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (class_id, student_id)
);

create table if not exists public.tutor_student_allocations (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status public.record_status not null default 'active',
  start_date date,
  end_date date,
  focus_notes text,
  -- Engagement/contract fields folded in from the retired Prisma `Assignment`
  -- model (migration plan §3A). Nullable/additive: no NOT NULL, no backfill.
  -- `rate_override` is the tutor's negotiated pay rate for this engagement and
  -- is tutor/admin-only — student-facing readers must NOT select it.
  subject_id uuid references public.subjects(id),
  rate_override numeric(12, 2),
  allowed_days_json jsonb,
  allowed_time_ranges_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tutor_id, student_id)
);

-- Size caps (64KB): these are admin-set contract fields, but nothing
-- previously stopped an oversized JSON document from being stored regardless.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tutor_student_allocations_allowed_days_size') then
    alter table public.tutor_student_allocations
      add constraint tutor_student_allocations_allowed_days_size
      check (allowed_days_json is null or octet_length(allowed_days_json::text) < 65536);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tutor_student_allocations_allowed_time_ranges_size') then
    alter table public.tutor_student_allocations
      add constraint tutor_student_allocations_allowed_time_ranges_size
      check (allowed_time_ranges_json is null or octet_length(allowed_time_ranges_json::text) < 65536);
  end if;
end
$$;

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_students_ngo_partner on public.students(ngo_partner_id);
create index if not exists idx_guardians_profile on public.guardians(profile_id);
create index if not exists idx_student_guardians_student on public.student_guardians(student_id, status);
create index if not exists idx_student_guardians_guardian on public.student_guardians(guardian_id, status);
create index if not exists idx_student_career_profiles_student_updated on public.student_career_profiles(student_id, updated_at desc);
create index if not exists idx_assignments_due_date on public.assignments(due_date);
create index if not exists idx_assignments_created_by on public.assignments(created_by);
create index if not exists idx_submissions_student on public.assignment_submissions(student_id);
create index if not exists idx_submissions_student_assignment on public.assignment_submissions(student_id, assignment_id);
create index if not exists idx_submissions_assignment_status on public.assignment_submissions(assignment_id, status);
create unique index if not exists idx_submissions_latest_assignment_student
  on public.assignment_submissions(assignment_id, student_id)
  where is_latest;
create index if not exists idx_submissions_assignment_versions
  on public.assignment_submissions(assignment_id, student_id, version_number desc);
create index if not exists idx_audit_log_created_at on public.audit_log(created_at desc);
create index if not exists idx_audit_log_action on public.audit_log(action);
create index if not exists idx_audit_log_entity on public.audit_log(entity_type, entity_id);
create index if not exists idx_audit_log_actor on public.audit_log(actor_user_id);
create index if not exists idx_progress_student_recorded on public.student_progress(student_id, recorded_at desc);
create index if not exists idx_payments_student_status on public.payments(student_id, status);
create index if not exists idx_classes_tutor on public.classes(tutor_id);
create index if not exists idx_classes_status on public.classes(status);
create index if not exists idx_class_enrollments_student on public.class_enrollments(student_id);
create index if not exists idx_class_enrollments_class_status on public.class_enrollments(class_id, status);
create index if not exists idx_tutor_student_allocations_tutor on public.tutor_student_allocations(tutor_id, status);
create index if not exists idx_tutor_student_allocations_student on public.tutor_student_allocations(student_id, status);

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.guardians enable row level security;
alter table public.student_guardians enable row level security;
alter table public.student_career_profiles enable row level security;
alter table public.tutors enable row level security;
alter table public.ngo_partners enable row level security;
alter table public.subjects enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.audit_log enable row level security;
alter table public.student_progress enable row level security;
alter table public.payments enable row level security;
alter table public.tutor_payments enable row level security;
alter table public.classes enable row level security;
alter table public.class_enrollments enable row level security;
alter table public.tutor_student_allocations enable row level security;

-- ============================================================================
-- Identity lookup shadow table -- fixes a real "infinite recursion detected in
-- policy for relation ..." bug, not a design choice. Every current_*() helper
-- below used to join straight into public.profiles (and, for
-- current_tutor_id/current_student_id, into public.tutors/public.students
-- too). Confirmed by direct testing against a real local Postgres: ANY access
-- to public.profiles from within evaluating public.profiles's OWN RLS
-- policies recurses -- REGARDLESS of SECURITY DEFINER, the role's BYPASSRLS
-- attribute, or an explicit `set local row_security = off` inside the
-- function (all three were tried and all three still recursed). This is a
-- hard Postgres limitation: a table's RLS policy (or anything it calls, no
-- matter how it's wrapped) must never scan that same table again while its
-- own policy is being evaluated. The recursion cascades further than
-- profiles alone: public.tutors and public.students each had a raw subquery
-- directly on public.profiles in their own "select self" policies, and
-- profiles' own policies read back into students/tutors
-- (profiles_select_allocated_learning_relationship) -- so evaluating
-- tutors'/students' policies could re-enter profiles' policies, which could
-- re-enter tutors/students, recursing there too (confirmed: querying
-- public.tutors or public.students directly as an authenticated role also
-- raised "infinite recursion detected in policy for relation ...").
--
-- The fix: every current_*() helper below now resolves auth_user_id ->
-- profile_id/role from this tiny denormalized table instead of scanning
-- public.profiles. RLS is NOT enabled here at all (not "using (false)" --
-- literally no RLS), and table privileges are revoked from anon/authenticated
-- below, so it is reachable ONLY through these SECURITY DEFINER functions --
-- never a real client read/write path, so there is nothing to protect with
-- RLS in the first place, and nothing left to recurse.
create table if not exists public.profile_identities (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null
);

create unique index if not exists idx_profile_identities_profile on public.profile_identities(profile_id);

revoke all on public.profile_identities from anon, authenticated;

create or replace function public.sync_profile_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.profile_identities where profile_id = old.id;
    return old;
  end if;

  insert into public.profile_identities (auth_user_id, profile_id, role)
  values (new.auth_user_id, new.id, new.role)
  on conflict (auth_user_id) do update set
    profile_id = excluded.profile_id,
    role = excluded.role;
  return new;
end;
$$;

drop trigger if exists trg_sync_profile_identity on public.profiles;
create trigger trg_sync_profile_identity
  after insert or update of auth_user_id, role or delete on public.profiles
  for each row execute function public.sync_profile_identity();

-- One-time backfill for any profiles rows that existed before this trigger.
insert into public.profile_identities (auth_user_id, profile_id, role)
select auth_user_id, id, role from public.profiles
on conflict (auth_user_id) do update set
  profile_id = excluded.profile_id,
  role = excluded.role;

create or replace function public.current_profile_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profile_identities where auth_user_id = auth.uid()
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profile_id from public.profile_identities where auth_user_id = auth.uid()
$$;

create or replace function public.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from public.students s
  join public.profile_identities pi on pi.profile_id = s.profile_id
  where pi.auth_user_id = auth.uid()
$$;

create or replace function public.current_tutor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id
  from public.tutors t
  join public.profile_identities pi on pi.profile_id = t.profile_id
  where pi.auth_user_id = auth.uid()
$$;

create or replace function public.can_mark_submission(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_profile_role() = 'admin'
    or exists (
      select 1
      from public.assignment_submissions sub
      join public.assignments a on a.id = sub.assignment_id
      where sub.id = p_submission_id
        and a.created_by = public.current_profile_id()
        and public.current_profile_role() = 'tutor'
    ),
    false
  )
$$;

create or replace function public.log_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_audit_id uuid;
  v_actor_role public.user_role := public.current_profile_role();
begin
  if nullif(btrim(coalesce(p_action, '')), '') is null then
    raise exception 'audit_action_required' using errcode = '23514';
  end if;

  if nullif(btrim(coalesce(p_entity_type, '')), '') is null then
    raise exception 'audit_entity_type_required' using errcode = '23514';
  end if;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    auth.uid(),
    v_actor_role,
    btrim(p_action),
    btrim(p_entity_type),
    nullif(btrim(coalesce(p_entity_id, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_audit_id;

  return v_audit_id;
end;
$$;

create or replace function public.record_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role := public.current_profile_role();
begin
  if v_role is null then
    raise exception 'audit_actor_required' using errcode = '42501';
  end if;

  if v_role = 'admin' then
    return public.log_audit_event(p_action, p_entity_type, p_entity_id, p_metadata);
  end if;

  if v_role = 'tutor' and p_action in ('assignment.created', 'assignment.updated', 'assignment.attachment_replaced') then
    return public.log_audit_event(p_action, p_entity_type, p_entity_id, p_metadata);
  end if;

  raise exception 'audit_action_not_allowed' using errcode = '42501';
end;
$$;

create or replace function public.submit_assignment_submission(
  p_assignment_id uuid,
  p_submission_id uuid,
  p_storage_key text,
  p_file_url text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint,
  p_text_answer text
)
returns table (submission_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := public.current_student_id();
  v_assignment public.assignments%rowtype;
  v_submission_id uuid := coalesce(p_submission_id, gen_random_uuid());
  v_next_version integer;
  v_text_answer text := nullif(btrim(coalesce(p_text_answer, '')), '');
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then
    raise exception 'only_students_can_submit' using errcode = '42501';
  end if;

  select * into v_assignment
  from public.assignments
  where id = p_assignment_id;

  if not found then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;

  if v_assignment.status <> 'published' then
    raise exception 'assignment_not_open_for_submission' using errcode = '42501';
  end if;

  if v_text_answer is null and nullif(p_storage_key, '') is null then
    raise exception 'submission_content_required' using errcode = '23514';
  end if;

  if nullif(p_storage_key, '') is not null and p_storage_key !~ ('^' || v_student_id::text || '/' || p_assignment_id::text || '/' || v_submission_id::text || '/submission\.[A-Za-z0-9]+$') then
    raise exception 'invalid_submission_storage_path' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_assignment_id::text || ':' || v_student_id::text));

  select coalesce(max(version_number), 0) + 1
  into v_next_version
  from public.assignment_submissions
  where assignment_id = p_assignment_id
    and student_id = v_student_id;

  update public.assignment_submissions
  set is_latest = false
  where assignment_id = p_assignment_id
    and student_id = v_student_id
    and is_latest = true;

  insert into public.assignment_submissions (
    id,
    assignment_id,
    student_id,
    storage_key,
    file_url,
    original_filename,
    mime_type,
    size_bytes,
    text_answer,
    submitted_at,
    status,
    version_number,
    is_latest,
    marks_awarded,
    feedback
  )
  values (
    v_submission_id,
    p_assignment_id,
    v_student_id,
    nullif(p_storage_key, ''),
    nullif(p_file_url, ''),
    nullif(p_original_filename, ''),
    nullif(p_mime_type, ''),
    p_size_bytes,
    v_text_answer,
    now(),
    'submitted',
    v_next_version,
    true,
    null,
    null
  );

  perform public.log_audit_event(
    'assignment_submission.created',
    'assignment_submission',
    v_submission_id::text,
    jsonb_build_object(
      'assignment_id', p_assignment_id,
      'student_id', v_student_id,
      'version_number', v_next_version,
      'file_uploaded', nullif(p_storage_key, '') is not null,
      'text_answer_provided', v_text_answer is not null
    )
  );

  if v_next_version > 1 and nullif(p_storage_key, '') is not null then
    perform public.log_audit_event(
      'assignment_submission.file_replaced',
      'assignment_submission',
      v_submission_id::text,
      jsonb_build_object(
        'assignment_id', p_assignment_id,
        'student_id', v_student_id,
        'version_number', v_next_version
      )
    );
  end if;

  return query select v_submission_id;
end;
$$;

create or replace function public.mark_assignment_submission(
  p_submission_id uuid,
  p_marks_awarded numeric,
  p_feedback text,
  p_status public.submission_status,
  p_rubric_scores jsonb default '{}'::jsonb,
  p_marks_released boolean default false,
  p_feedback_released boolean default false
)
returns setof public.assignment_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous public.assignment_submissions%rowtype;
  v_submission public.assignment_submissions%rowtype;
  v_assignment public.assignments%rowtype;
begin
  if not public.can_mark_submission(p_submission_id) then
    raise exception 'submission_marking_not_allowed' using errcode = '42501';
  end if;

  if p_status not in ('submitted', 'marked', 'returned') then
    raise exception 'invalid_submission_status' using errcode = '23514';
  end if;

  if p_marks_awarded is not null and (p_marks_awarded < 0 or p_marks_awarded > 100) then
    raise exception 'marks_out_of_range' using errcode = '23514';
  end if;

  if jsonb_typeof(coalesce(p_rubric_scores, '{}'::jsonb)) <> 'object' then
    raise exception 'invalid_rubric_scores' using errcode = '23514';
  end if;

  select * into v_previous
  from public.assignment_submissions
  where id = p_submission_id;

  if not found then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;

  update public.assignment_submissions
  set marks_awarded = p_marks_awarded,
      feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
      status = p_status,
      rubric_scores_json = coalesce(p_rubric_scores, '{}'::jsonb),
      marks_released = coalesce(p_marks_released, false),
      feedback_released = coalesce(p_feedback_released, false),
      released_at = case
        when coalesce(p_marks_released, false) or coalesce(p_feedback_released, false) then coalesce(released_at, now())
        else null
      end
  where id = p_submission_id
  returning * into v_submission;

  if not found then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;

  perform public.log_audit_event(
    'submission.marked',
    'assignment_submission',
    v_submission.id::text,
    jsonb_build_object(
      'assignment_id', v_submission.assignment_id,
      'student_id', v_submission.student_id,
      'previous_status', v_previous.status,
      'new_status', v_submission.status,
      'previous_marks_awarded', v_previous.marks_awarded,
      'new_marks_awarded', v_submission.marks_awarded
    )
  );

  if v_previous.feedback is distinct from v_submission.feedback
    or v_previous.rubric_scores_json is distinct from v_submission.rubric_scores_json then
    perform public.log_audit_event(
      'feedback.updated',
      'assignment_submission',
      v_submission.id::text,
      jsonb_build_object(
        'assignment_id', v_submission.assignment_id,
        'student_id', v_submission.student_id,
        'feedback_present', v_submission.feedback is not null,
        'rubric_scores_present', v_submission.rubric_scores_json <> '{}'::jsonb
      )
    );
  end if;

  if (not coalesce(v_previous.marks_released, false) and coalesce(v_submission.marks_released, false))
    or (not coalesce(v_previous.feedback_released, false) and coalesce(v_submission.feedback_released, false)) then
    perform public.log_audit_event(
      'result.released',
      'assignment_submission',
      v_submission.id::text,
      jsonb_build_object(
        'assignment_id', v_submission.assignment_id,
        'student_id', v_submission.student_id,
        'marks_released', v_submission.marks_released,
        'feedback_released', v_submission.feedback_released,
        'released_at', v_submission.released_at
      )
    );
  end if;

  if (coalesce(v_previous.marks_released, false) and not coalesce(v_submission.marks_released, false))
    or (coalesce(v_previous.feedback_released, false) and not coalesce(v_submission.feedback_released, false)) then
    perform public.log_audit_event(
      'result.unreleased',
      'assignment_submission',
      v_submission.id::text,
      jsonb_build_object(
        'assignment_id', v_submission.assignment_id,
        'student_id', v_submission.student_id,
        'marks_released', v_submission.marks_released,
        'feedback_released', v_submission.feedback_released
      )
    );
  end if;

  if p_status = 'marked' and p_marks_awarded is not null then
    select * into v_assignment
    from public.assignments
    where id = v_submission.assignment_id;

    -- Upsert on assignment_submission_id (real bug fix, not a design choice --
    -- see the idx_student_progress_submission_unique comment): re-marking the
    -- same submission must update its existing progress row, not insert a new
    -- one every time the mark changes.
    insert into public.student_progress (
      student_id,
      subject_id,
      topic,
      score,
      cognitive_level,
      recorded_at,
      assignment_submission_id
    )
    values (
      v_submission.student_id,
      v_assignment.subject_id,
      coalesce(v_assignment.title, 'Marked assignment'),
      p_marks_awarded,
      null,
      now(),
      v_submission.id
    )
    on conflict (assignment_submission_id) where assignment_submission_id is not null
    do update set
      student_id = excluded.student_id,
      subject_id = excluded.subject_id,
      topic = excluded.topic,
      score = excluded.score,
      recorded_at = excluded.recorded_at;
  end if;

  return next v_submission;
end;
$$;

create or replace function public.get_student_assignment_submissions()
returns table (
  id uuid,
  assignment_id uuid,
  student_id uuid,
  storage_key text,
  file_url text,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  text_answer text,
  submitted_at timestamptz,
  status public.submission_status,
  version_number integer,
  is_latest boolean,
  marks_awarded numeric,
  feedback text,
  rubric_scores_json jsonb,
  marks_released boolean,
  feedback_released boolean,
  released_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    sub.id,
    sub.assignment_id,
    sub.student_id,
    sub.storage_key,
    sub.file_url,
    sub.original_filename,
    sub.mime_type,
    sub.size_bytes,
    sub.text_answer,
    sub.submitted_at,
    sub.status,
    sub.version_number,
    sub.is_latest,
    case when sub.marks_released then sub.marks_awarded else null end as marks_awarded,
    case when sub.feedback_released then sub.feedback else null end as feedback,
    case when sub.feedback_released then sub.rubric_scores_json else '{}'::jsonb end as rubric_scores_json,
    sub.marks_released,
    sub.feedback_released,
    sub.released_at
  from public.assignment_submissions sub
  where sub.student_id = public.current_student_id()
    order by sub.submitted_at desc;
$$;

create or replace function public.get_parent_progress_reports()
returns table (
  student_id uuid,
  student_name text,
  grade text,
  school text,
  assignment_title text,
  marks_awarded numeric,
  feedback text,
  released_at timestamptz,
  topic text,
  topic_score numeric
)
language sql
security definer
set search_path = public
as $$
  select
    s.id as student_id,
    p.full_name as student_name,
    s.grade,
    s.school,
    a.title as assignment_title,
    sub.marks_awarded,
    case when sub.feedback_released then sub.feedback else null end as feedback,
    sub.released_at,
    sp.topic,
    sp.score as topic_score
  from public.guardians g
  join public.student_guardians sg on sg.guardian_id = g.id
  join public.students s on s.id = sg.student_id
  join public.profiles p on p.id = s.profile_id
  left join public.assignment_submissions sub
    on sub.student_id = s.id
    and sub.marks_released = true
    and sub.marks_awarded is not null
  left join public.assignments a on a.id = sub.assignment_id
  left join lateral (
    select progress.topic, progress.score
    from public.student_progress progress
    where progress.student_id = s.id
    order by progress.recorded_at desc
    limit 1
  ) sp on true
  where public.current_profile_role() = 'parent'
    and g.profile_id = public.current_profile_id()
    and g.status = 'active'
    and sg.status = 'active'
    and sg.can_receive_reports = true
  order by p.full_name, sub.released_at desc nulls last;
$$;

grant execute on function public.submit_assignment_submission(uuid, uuid, text, text, text, text, bigint, text) to authenticated;
grant execute on function public.mark_assignment_submission(uuid, numeric, text, public.submission_status, jsonb, boolean, boolean) to authenticated;
grant execute on function public.get_student_assignment_submissions() to authenticated;
grant execute on function public.get_parent_progress_reports() to authenticated;
revoke execute on function public.log_audit_event(text, text, text, jsonb) from public;
revoke execute on function public.log_audit_event(text, text, text, jsonb) from anon;
revoke execute on function public.log_audit_event(text, text, text, jsonb) from authenticated;
grant execute on function public.record_audit_event(text, text, text, jsonb) to authenticated;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles for select
using (auth_user_id = auth.uid() or public.current_profile_role() = 'admin');

drop policy if exists "profiles_select_allocated_learning_relationship" on public.profiles;
create policy "profiles_select_allocated_learning_relationship"
on public.profiles for select
using (
  id in (
    select s.profile_id
    from public.students s
    join public.tutor_student_allocations tsa on tsa.student_id = s.id
    where tsa.tutor_id = public.current_tutor_id()
      and tsa.status = 'active'
  )
  or id in (
    select t.profile_id
    from public.tutors t
    join public.tutor_student_allocations tsa on tsa.tutor_id = t.id
    where tsa.student_id = public.current_student_id()
      and tsa.status = 'active'
  )
);

drop policy if exists "profiles_insert_self_student_or_tutor" on public.profiles;
create policy "profiles_insert_self_student_or_tutor"
on public.profiles for insert
with check (
  auth_user_id = auth.uid()
  and role in ('student', 'tutor', 'parent')
);

drop policy if exists "admin_full_access_profiles" on public.profiles;
create policy "admin_full_access_profiles"
on public.profiles for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "admin_select_audit_log" on public.audit_log;
create policy "admin_select_audit_log"
on public.audit_log for select
using (public.current_profile_role() = 'admin');

drop policy if exists "no_direct_audit_log_insert" on public.audit_log;
create policy "no_direct_audit_log_insert"
on public.audit_log for insert
with check (false);

drop policy if exists "no_direct_audit_log_update" on public.audit_log;
create policy "no_direct_audit_log_update"
on public.audit_log for update
using (false)
with check (false);

drop policy if exists "no_direct_audit_log_delete" on public.audit_log;
create policy "no_direct_audit_log_delete"
on public.audit_log for delete
using (false);

drop policy if exists "students_select_self_or_admin" on public.students;
create policy "students_select_self_or_admin"
on public.students for select
using (
  public.current_profile_role() = 'admin'
  or profile_id = public.current_profile_id()
  or id in (
    select tsa.student_id
    from public.tutor_student_allocations tsa
    where tsa.tutor_id = public.current_tutor_id()
      and tsa.status = 'active'
  )
);

-- Raw subqueries on public.profiles here would recurse (see the "Identity
-- lookup shadow table" comment near current_profile_role()); current_profile_id()/
-- current_profile_role() now resolve via public.profile_identities instead.
drop policy if exists "students_insert_self" on public.students;
create policy "students_insert_self"
on public.students for insert
with check (
  profile_id = public.current_profile_id()
  and public.current_profile_role() = 'student'
);

drop policy if exists "admin_full_access_students" on public.students;
create policy "admin_full_access_students"
on public.students for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "guardians_select_scoped" on public.guardians;
create policy "guardians_select_scoped"
on public.guardians for select
using (
  public.current_profile_role() = 'admin'
  or profile_id = public.current_profile_id()
);

drop policy if exists "admin_manage_guardians" on public.guardians;
create policy "admin_manage_guardians"
on public.guardians for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "student_guardians_select_scoped" on public.student_guardians;
create policy "student_guardians_select_scoped"
on public.student_guardians for select
using (
  public.current_profile_role() = 'admin'
  or guardian_id in (
    select g.id
    from public.guardians g
    where g.profile_id = public.current_profile_id()
  )
);

drop policy if exists "admin_manage_student_guardians" on public.student_guardians;
create policy "admin_manage_student_guardians"
on public.student_guardians for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

-- Raw joins into public.profiles here would recurse (see the "Identity
-- lookup shadow table" comment near current_profile_role()); current_student_id()
-- now resolves via public.profile_identities instead of public.profiles directly.
drop policy if exists "students_select_own_career_profile" on public.student_career_profiles;
create policy "students_select_own_career_profile"
on public.student_career_profiles for select
using (
  student_id = public.current_student_id()
);

drop policy if exists "students_upsert_own_career_profile" on public.student_career_profiles;
create policy "students_upsert_own_career_profile"
on public.student_career_profiles for all
using (
  student_id = public.current_student_id()
)
with check (
  student_id = public.current_student_id()
);

drop policy if exists "tutors_select_self_or_admin" on public.tutors;
create policy "tutors_select_self_or_admin"
on public.tutors for select
using (
  public.current_profile_role() = 'admin'
  or profile_id = public.current_profile_id()
  or id in (
    select tsa.tutor_id
    from public.tutor_student_allocations tsa
    where tsa.student_id = public.current_student_id()
      and tsa.status = 'active'
  )
);

-- Raw subqueries on public.profiles here would recurse (see the "Identity
-- lookup shadow table" comment near current_profile_role()); current_profile_id()/
-- current_profile_role() now resolve via public.profile_identities instead.
drop policy if exists "tutors_insert_self_pending" on public.tutors;
create policy "tutors_insert_self_pending"
on public.tutors for insert
with check (
  status = 'pending'
  and profile_id = public.current_profile_id()
  and public.current_profile_role() = 'tutor'
);

drop policy if exists "admin_full_access_tutors" on public.tutors;
create policy "admin_full_access_tutors"
on public.tutors for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "subjects_read_authenticated" on public.subjects;
create policy "subjects_read_authenticated"
on public.subjects for select
using (auth.uid() is not null);

drop policy if exists "admin_manage_subjects" on public.subjects;
create policy "admin_manage_subjects"
on public.subjects for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "tutors_insert_subjects" on public.subjects;
create policy "tutors_insert_subjects"
on public.subjects for insert
with check (public.current_profile_role() = 'tutor');

-- SECURITY (AUDIT.md High, fixed in Phase 2 step 2): the previous
-- "assignments_read_authenticated" policy (using auth.uid() is not null) let
-- ANY authenticated user read ANY assignment — any status, any org. It is
-- removed here (create statement deleted) and explicitly dropped at the end of
-- this file so existing databases lose it on apply too. Its replacement,
-- "assignments_student_read_published_own_org", scopes student reads to
-- published assignments in their own org. See §7.4 at the end of this file.

drop policy if exists "admin_manage_assignments" on public.assignments;
create policy "admin_manage_assignments"
on public.assignments for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "tutors_manage_own_assignments" on public.assignments;
create policy "tutors_manage_own_assignments"
on public.assignments for all
using (
  public.current_profile_role() = 'tutor'
  and created_by = public.current_profile_id()
)
with check (
  public.current_profile_role() = 'tutor'
  and created_by = public.current_profile_id()
);

drop policy if exists "submissions_student_self_or_admin" on public.assignment_submissions;
create policy "submissions_student_self_or_admin"
on public.assignment_submissions for select
using (
  public.current_profile_role() = 'admin'
);

drop policy if exists "submissions_student_insert_self" on public.assignment_submissions;
drop policy if exists "submissions_student_update_self" on public.assignment_submissions;
drop policy if exists "submissions_student_mark_previous_versions" on public.assignment_submissions;
drop policy if exists "tutors_update_own_assignment_submissions" on public.assignment_submissions;
drop policy if exists "tutor_insert_progress" on public.student_progress;
-- AUDIT.md Critical (fixed): explicitly drop the permissive student INSERT policy so
-- existing databases lose it on apply, not just fresh builds. See the note further
-- down where this policy's create statement was removed.
drop policy if exists "submissions_student_rpc_insert_shape" on public.assignment_submissions;

drop policy if exists "submissions_student_insert_via_rpc_guard" on public.assignment_submissions;
create policy "submissions_student_insert_via_rpc_guard"
on public.assignment_submissions for insert
with check (
  false
);

drop policy if exists "submissions_no_direct_student_update" on public.assignment_submissions;
create policy "submissions_no_direct_student_update"
on public.assignment_submissions for update
using (
  false
)
with check (
  false
);

drop policy if exists "submissions_tutor_mark_via_rpc_only" on public.assignment_submissions;
create policy "submissions_tutor_mark_via_rpc_only"
on public.assignment_submissions for update
using (
  false
)
with check (
  false
);

-- SECURITY (AUDIT.md Critical, fixed): the previous permissive policy
-- "submissions_student_rpc_insert_shape" allowed students to INSERT directly via
-- PostgREST, bypassing submit_assignment_submission()'s storage-path validation,
-- advisory-lock version sequencing, and log_audit_event() call. Because Postgres
-- ORs permissive INSERT policies together, that shape policy overrode the
-- "with check (false)" guard above and left the RPC's guarantees unenforced.
-- It is removed. The only remaining INSERT policy is
-- "submissions_student_insert_via_rpc_guard" (with check false), so no client can
-- insert a submission row directly; all submissions must go through the
-- SECURITY DEFINER submit_assignment_submission() RPC, which bypasses RLS by
-- design and is the single audited, validated write path. The frontend already
-- calls only this RPC (src/features/assignments/assignmentMutations.ts).

drop policy if exists "admin_manage_submissions" on public.assignment_submissions;
create policy "admin_manage_submissions"
on public.assignment_submissions for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

-- Raw join into public.profiles here would recurse (see the "Identity lookup
-- shadow table" comment near current_profile_role()); rewritten to use
-- current_profile_id()/current_profile_role() (public.profile_identities)
-- instead. Same semantics: only a tutor viewing submissions for assignments
-- they themselves created.
drop policy if exists "tutors_select_own_assignment_submissions" on public.assignment_submissions;
create policy "tutors_select_own_assignment_submissions"
on public.assignment_submissions for select
using (
  public.current_profile_role() = 'tutor'
  and assignment_id in (
    select a.id from public.assignments a
    where a.created_by = public.current_profile_id()
  )
);

-- Raw join into public.profiles here would recurse (see the "Identity lookup
-- shadow table" comment near current_profile_role()); current_student_id()
-- now resolves via public.profile_identities instead of public.profiles directly.
drop policy if exists "student_progress_self_or_admin" on public.student_progress;
create policy "student_progress_self_or_admin"
on public.student_progress for select
using (
  public.current_profile_role() = 'admin'
  or student_id = public.current_student_id()
);

drop policy if exists "admin_manage_progress" on public.student_progress;
create policy "admin_manage_progress"
on public.student_progress for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "progress_insert_via_marking_rpc_only" on public.student_progress;
create policy "progress_insert_via_marking_rpc_only"
on public.student_progress for insert
with check (false);

drop policy if exists "admin_finance_access" on public.payments;
create policy "admin_finance_access"
on public.payments for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "admin_tutor_payment_access" on public.tutor_payments;
create policy "admin_tutor_payment_access"
on public.tutor_payments for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "classes_read_authenticated" on public.classes;

drop policy if exists "classes_select_scoped" on public.classes;
create policy "classes_select_scoped"
on public.classes for select
using (
  public.current_profile_role() = 'admin'
  or tutor_id = public.current_tutor_id()
  or id in (
    select ce.class_id
    from public.class_enrollments ce
    where ce.student_id = public.current_student_id()
      and ce.status = 'active'
  )
);

drop policy if exists "admin_manage_classes" on public.classes;
create policy "admin_manage_classes"
on public.classes for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "class_enrollments_read_authenticated" on public.class_enrollments;

drop policy if exists "class_enrollments_select_scoped" on public.class_enrollments;
create policy "class_enrollments_select_scoped"
on public.class_enrollments for select
using (
  public.current_profile_role() = 'admin'
  or student_id = public.current_student_id()
  or class_id in (
    select c.id
    from public.classes c
    where c.tutor_id = public.current_tutor_id()
  )
);

drop policy if exists "admin_manage_class_enrollments" on public.class_enrollments;
create policy "admin_manage_class_enrollments"
on public.class_enrollments for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "tutor_student_allocations_select_scoped" on public.tutor_student_allocations;
create policy "tutor_student_allocations_select_scoped"
on public.tutor_student_allocations for select
using (
  public.current_profile_role() = 'admin'
  or (
    status = 'active'
    and (
      tutor_id = public.current_tutor_id()
      or student_id = public.current_student_id()
    )
  )
);

drop policy if exists "admin_manage_tutor_student_allocations" on public.tutor_student_allocations;
create policy "admin_manage_tutor_student_allocations"
on public.tutor_student_allocations for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

insert into storage.buckets (id, name, public)
values
  ('assignment-files', 'assignment-files', false),
  ('assignment-submissions', 'assignment-submissions', false)
on conflict (id) do nothing;

drop policy if exists "admin_tutor_upload_assignment_files" on storage.objects;
create policy "admin_tutor_upload_assignment_files"
on storage.objects for insert
with check (
  bucket_id = 'assignment-files'
  and public.current_profile_role() in ('admin', 'tutor')
);

drop policy if exists "authenticated_read_assignment_files" on storage.objects;
create policy "authenticated_read_assignment_files"
on storage.objects for select
using (
  bucket_id = 'assignment-files'
  and auth.uid() is not null
);

-- Raw joins into public.profiles in these four storage policies would recurse
-- (see the "Identity lookup shadow table" comment near current_profile_role());
-- rewritten to use current_student_id()/current_profile_id() (public.profile_identities)
-- instead of public.profiles directly.
drop policy if exists "students_upload_own_submission_files" on storage.objects;
create policy "students_upload_own_submission_files"
on storage.objects for insert
with check (
  bucket_id = 'assignment-submissions'
  and public.current_profile_role() = 'student'
  and array_length(storage.foldername(name), 1) = 4
  and (storage.foldername(name))[1] = public.current_student_id()::text
  and (storage.foldername(name))[2] in (
    select a.id::text from public.assignments a
    where a.status = 'published'
  )
);

-- Real bug fix, not a design choice: this policy used to validate only the
-- student_id folder segment on UPDATE, unlike the INSERT policy above (which
-- also validates the assignment_id segment is a published assignment). Since
-- storage.objects UPDATE is how a client renames/moves an object, a student
-- could move `<own_id>/assignmentA/file.pdf` to `<own_id>/assignmentB/file.pdf`
-- (or to a non-existent/unpublished assignment id) without this check, because
-- assignment ownership was never re-validated. Both using and with check now
-- mirror the INSERT policy's assignment validation exactly.
drop policy if exists "students_update_own_submission_files" on storage.objects;
create policy "students_update_own_submission_files"
on storage.objects for update
using (
  bucket_id = 'assignment-submissions'
  and public.current_profile_role() = 'student'
  and array_length(storage.foldername(name), 1) = 4
  and (storage.foldername(name))[1] = public.current_student_id()::text
  and (storage.foldername(name))[2] in (
    select a.id::text from public.assignments a
    where a.status = 'published'
  )
)
with check (
  bucket_id = 'assignment-submissions'
  and public.current_profile_role() = 'student'
  and array_length(storage.foldername(name), 1) = 4
  and (storage.foldername(name))[1] = public.current_student_id()::text
  and (storage.foldername(name))[2] in (
    select a.id::text from public.assignments a
    where a.status = 'published'
  )
);

drop policy if exists "students_read_own_submission_files_or_admin" on storage.objects;
create policy "students_read_own_submission_files_or_admin"
on storage.objects for select
using (
  bucket_id = 'assignment-submissions'
  and (
    public.current_profile_role() = 'admin'
    or (
      public.current_profile_role() = 'tutor'
      and (storage.foldername(name))[2] in (
        select a.id::text from public.assignments a
        where a.created_by = public.current_profile_id()
      )
    )
    or (storage.foldername(name))[1] = public.current_student_id()::text
  )
);

-- ============================================================================
-- POPIA data-subject requests: access (export), correction, deletion (erasure).
-- Closes AUDIT.md Critical: Supabase-stored learner PII previously had no export
-- or erasure path (the Prisma retention job only covered the legacy schema).
--
-- Design:
--  * All functions are SECURITY DEFINER and ADMIN-gated internally, so privileged
--    erasure/export cannot be triggered by a student/tutor even if granted EXECUTE.
--  * DELETION anonymises rather than hard-deletes when a statutory retention hold
--    applies (financial records in public.payments), keeping the row but stripping
--    identity; otherwise it removes identifiable academic content.
--  * Every action writes to audit_log via log_audit_event().
--  * CORRECTION requests are applied by admins through normal RLS-scoped UPDATEs,
--    so no dedicated function is needed here.
--  * NOTE: Odie chat history (odie_conversations/odie_messages) lives in the legacy
--    Prisma database, not Supabase, and is handled by the Fastify retention/privacy
--    pipeline — it is out of scope for these Supabase functions.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'privacy_request_type') then
    create type public.privacy_request_type as enum ('access', 'correction', 'deletion');
  end if;
end
$$;

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  subject_student_id uuid references public.students(id) on delete set null,
  subject_profile_id uuid references public.profiles(id) on delete set null,
  request_type public.privacy_request_type not null,
  status public.record_status not null default 'pending',
  requested_by uuid references public.profiles(id),
  notes text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backfill for a database where this table was partially created by an
-- earlier, interrupted migration attempt (same reasoning as the
-- assignment_submissions backfill elsewhere in this file).
alter table public.privacy_requests add column if not exists subject_student_id uuid references public.students(id) on delete set null;
alter table public.privacy_requests add column if not exists subject_profile_id uuid references public.profiles(id) on delete set null;
alter table public.privacy_requests add column if not exists requested_by uuid references public.profiles(id);
alter table public.privacy_requests add column if not exists notes text;
alter table public.privacy_requests add column if not exists result jsonb not null default '{}'::jsonb;
alter table public.privacy_requests add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_privacy_requests_subject_student
  on public.privacy_requests(subject_student_id);
create index if not exists idx_privacy_requests_status
  on public.privacy_requests(status);

alter table public.privacy_requests enable row level security;

drop policy if exists "privacy_requests_admin_all" on public.privacy_requests;
create policy "privacy_requests_admin_all"
on public.privacy_requests for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

-- ACCESS: export everything the platform holds about a learner as one JSON object.
create or replace function public.export_student_data(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_result jsonb;
begin
  if public.current_profile_role() <> 'admin' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select profile_id into v_profile_id from public.students where id = p_student_id;
  if v_profile_id is null then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'student', (select to_jsonb(s) from public.students s where s.id = p_student_id),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = v_profile_id),
    'guardians', (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb)
                  from public.guardians g
                  join public.student_guardians sg on sg.guardian_id = g.id
                  where sg.student_id = p_student_id),
    'career_profile', (select to_jsonb(c) from public.student_career_profiles c
                       where c.student_id = p_student_id),
    'submissions', (select coalesce(jsonb_agg(to_jsonb(sub)), '[]'::jsonb)
                    from public.assignment_submissions sub where sub.student_id = p_student_id),
    'progress', (select coalesce(jsonb_agg(to_jsonb(pr)), '[]'::jsonb)
                 from public.student_progress pr where pr.student_id = p_student_id),
    'enrollments', (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
                    from public.class_enrollments e where e.student_id = p_student_id),
    'allocations', (select coalesce(jsonb_agg(to_jsonb(al)), '[]'::jsonb)
                    from public.tutor_student_allocations al where al.student_id = p_student_id),
    'payments', (select coalesce(jsonb_agg(to_jsonb(pay)), '[]'::jsonb)
                 from public.payments pay where pay.student_id = p_student_id)
  ) into v_result;

  perform public.log_audit_event('privacy.data_exported', 'student', p_student_id::text,
    jsonb_build_object('subject_profile_id', v_profile_id));

  return v_result;
end;
$$;

-- DELETION: anonymise a learner (retain financially-held rows, strip identity) or
-- remove identifiable academic content. Returns a summary of what was done.
create or replace function public.anonymize_student(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_has_financial boolean;
  v_mode text;
  v_submissions_removed integer := 0;
  v_files_removed integer := 0;
begin
  if public.current_profile_role() <> 'admin' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select profile_id into v_profile_id from public.students where id = p_student_id;
  if v_profile_id is null then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;

  -- Financial records carry a statutory retention hold: keep the rows, strip identity.
  select exists(select 1 from public.payments where student_id = p_student_id)
    into v_has_financial;
  v_mode := case when v_has_financial then 'anonymized_financial_hold' else 'anonymized' end;

  -- Remove self-service / free-text personal content.
  delete from public.student_career_profiles where student_id = p_student_id;

  -- Remove uploaded submission files from Storage (scoped to the learner's folder).
  -- Wrapped so a storage-privilege error reports rather than aborting the erasure;
  -- -1 signals "remove via the service-role storage client as a follow-up".
  begin
    delete from storage.objects
     where bucket_id = 'assignment-submissions'
       and (storage.foldername(name))[1] = p_student_id::text;
    get diagnostics v_files_removed = row_count;
  exception
    when insufficient_privilege then v_files_removed := -1;
  end;

  -- Remove identifiable academic records.
  delete from public.assignment_submissions where student_id = p_student_id;
  get diagnostics v_submissions_removed = row_count;
  delete from public.student_progress where student_id = p_student_id;

  -- Detach guardians; delete guardian rows no longer linked to anyone and not
  -- themselves platform users.
  delete from public.student_guardians where student_id = p_student_id;
  delete from public.guardians g
   where g.profile_id is null
     and not exists (select 1 from public.student_guardians sg where sg.guardian_id = g.id);

  -- Strip inline PII on the learner row.
  update public.students
     set parent_name = null,
         parent_contact = null,
         school = null,
         status = 'inactive'
   where id = p_student_id;

  -- Strip identity on the profile (email is unique/not-null → unique placeholder).
  update public.profiles
     set full_name = 'Redacted Learner',
         email = 'redacted+' || v_profile_id::text || '@removed.invalid',
         phone = null
   where id = v_profile_id;

  perform public.log_audit_event('privacy.subject_anonymized', 'student', p_student_id::text,
    jsonb_build_object('mode', v_mode,
                       'submissions_removed', v_submissions_removed,
                       'files_removed', v_files_removed));

  return jsonb_build_object(
    'student_id', p_student_id,
    'mode', v_mode,
    'submissions_removed', v_submissions_removed,
    'files_removed', v_files_removed
  );
end;
$$;

-- Workflow wrapper: process a tracked privacy_requests row by dispatching on type,
-- storing the result, and closing the request. Admin-gated (both the wrapper and
-- the functions it calls).
create or replace function public.process_privacy_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.privacy_requests;
  v_result jsonb;
  v_status public.record_status;
begin
  if public.current_profile_role() <> 'admin' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_req from public.privacy_requests where id = p_request_id;
  if v_req.id is null then
    raise exception 'privacy_request_not_found' using errcode = 'P0002';
  end if;
  if v_req.subject_student_id is null then
    raise exception 'privacy_request_subject_required' using errcode = '23514';
  end if;

  if v_req.request_type = 'access' then
    v_result := public.export_student_data(v_req.subject_student_id);
    v_status := 'approved';
  elsif v_req.request_type = 'deletion' then
    v_result := public.anonymize_student(v_req.subject_student_id);
    v_status := 'approved';
  else
    -- correction is applied via normal admin UPDATEs; just record acknowledgement.
    v_result := jsonb_build_object('note', 'correction applied via admin update');
    v_status := 'approved';
  end if;

  update public.privacy_requests
     set status = v_status, result = v_result, updated_at = now()
   where id = p_request_id;

  perform public.log_audit_event('privacy.request_processed', 'privacy_request', p_request_id::text,
    jsonb_build_object('request_type', v_req.request_type, 'status', v_status));

  return v_result;
end;
$$;

-- Admin-gated internally; EXECUTE granted to authenticated (the internal role check
-- is the real guard, matching the other privileged RPCs above).
grant execute on function public.export_student_data(uuid) to authenticated;
grant execute on function public.anonymize_student(uuid) to authenticated;
grant execute on function public.process_privacy_request(uuid) to authenticated;

-- ============================================================================
-- Retention cleanup for Supabase-owned data (POPIA_DATA_MAP §5).
-- SECURITY DEFINER. **DEFAULTS TO A DRY RUN**: with p_apply => false (the
-- default) it only COUNTS eligible rows and deletes nothing. Pass p_apply => true
-- to actually purge. Retention windows are named constants below; move them to a
-- config table if they ever need runtime tuning.
--
-- Schedule the real run with pg_cron or a scheduled Edge Function:
--     select public.run_retention_cleanup(true);
--
-- Notes:
--  * Only SETTLED payments (paid_at set) past the financial window are purged —
--    pending/unpaid financial records are never touched.
--  * Odie chat history lives in the legacy Prisma DB and is purged by the Fastify
--    retention job, not here.
-- ============================================================================
create or replace function public.run_retention_cleanup(p_apply boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submissions_years int := 3;   -- academic submissions + uploaded files
  v_progress_years    int := 3;   -- per-concept score history
  v_audit_years       int := 5;   -- audit trail (compliance)
  v_financial_years   int := 7;   -- settled payments (tax/financial retention)
  v_now  timestamptz := now();
  v_sub_cut  timestamptz := v_now - make_interval(years => v_submissions_years);
  v_prog_cut timestamptz := v_now - make_interval(years => v_progress_years);
  v_aud_cut  timestamptz := v_now - make_interval(years => v_audit_years);
  v_fin_cut  timestamptz := v_now - make_interval(years => v_financial_years);
  v_submissions int; v_progress int; v_audit int; v_payments int; v_tutor_payments int;
  v_files int := 0;
begin
  -- Allow admins (manual runs) and trusted server contexts with no browser JWT
  -- (pg_cron / service_role / scheduled Edge Function), where auth.uid() is null.
  -- Regular signed-in non-admins are blocked; anon has no EXECUTE grant at all.
  if not (public.current_profile_role() = 'admin' or auth.uid() is null) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select count(*) into v_submissions    from public.assignment_submissions where submitted_at < v_sub_cut;
  select count(*) into v_progress       from public.student_progress       where recorded_at  < v_prog_cut;
  select count(*) into v_audit          from public.audit_log              where created_at   < v_aud_cut;
  select count(*) into v_payments       from public.payments               where paid_at is not null and paid_at < v_fin_cut;
  select count(*) into v_tutor_payments from public.tutor_payments         where paid_at is not null and paid_at < v_fin_cut;

  if p_apply then
    -- Remove submission files from Storage first (path: student/assignment/submission/file).
    begin
      delete from storage.objects o
       where o.bucket_id = 'assignment-submissions'
         and exists (
           select 1 from public.assignment_submissions s
           where s.submitted_at < v_sub_cut
             and (storage.foldername(o.name))[1] = s.student_id::text
             and (storage.foldername(o.name))[3] = s.id::text
         );
      get diagnostics v_files = row_count;
    exception when insufficient_privilege then v_files := -1;
    end;

    delete from public.assignment_submissions where submitted_at < v_sub_cut;
    delete from public.student_progress       where recorded_at  < v_prog_cut;
    delete from public.payments               where paid_at is not null and paid_at < v_fin_cut;
    delete from public.tutor_payments         where paid_at is not null and paid_at < v_fin_cut;
    delete from public.audit_log              where created_at   < v_aud_cut;

    perform public.log_audit_event('retention.cleanup_applied', 'system', null,
      jsonb_build_object('submissions', v_submissions, 'progress', v_progress,
                         'payments', v_payments, 'tutor_payments', v_tutor_payments,
                         'audit', v_audit, 'files', v_files));
  end if;

  return jsonb_build_object(
    'applied', p_apply,
    'as_of', v_now,
    'windows_years', jsonb_build_object('submissions', v_submissions_years, 'progress', v_progress_years,
                                        'audit', v_audit_years, 'financial', v_financial_years),
    'eligible', jsonb_build_object('submissions', v_submissions, 'progress', v_progress,
                                   'payments', v_payments, 'tutor_payments', v_tutor_payments, 'audit', v_audit),
    'files_removed', case when p_apply then v_files else null end
  );
end;
$$;

grant execute on function public.run_retention_cleanup(boolean) to authenticated;

-- ============================================================================
-- Multi-organisation model — Phase 0 (prep) + Phase 1 (additive backfill).
-- ADR-0002: docs/architecture/MULTI_ORG_MODEL_PLAN.md.
--
-- Phase 0: `organization_type` / `org_member_role` enums, the `organizations`
-- table (generalises `ngo_partners`, which stays in place for now — retiring
-- it is Phase 3), and a seeded `direct` org for today's private clients.
--
-- Phase 1: nullable `organization_id` on students/classes/assignments,
-- `organization_members`, and one-off backfill statements that stamp every
-- existing row with its home org. Nothing here is enforced yet — no RLS
-- policy references these columns, and `organization_id` stays nullable
-- until Phase 2 (RLS enforcement + the cross-org isolation test suite), per
-- the plan §7. Every statement below is idempotent so it is safe to re-run
-- against an already-migrated database (matches this file's existing
-- `create ... if not exists` / guarded-enum conventions).
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'organization_type') then
    create type public.organization_type as enum ('direct', 'ngo', 'school', 'community');
  end if;
  if not exists (select 1 from pg_type where typname = 'org_member_role') then
    create type public.org_member_role as enum ('coordinator', 'tutor', 'student', 'parent', 'partner_viewer');
  end if;
end
$$;

create table if not exists public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  type          public.organization_type not null,
  contact_person text,
  contact_email text,
  contact_phone text,
  location      text,
  notes         text,
  status        public.record_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS is deliberately NOT enabled yet: no policies exist for this table
-- until Phase 2, and enabling RLS with zero policies is the exact
-- anti-pattern AUDIT.md flagged for `ngo_partners` (Medium finding). Enable
-- it alongside its real org-scoped policies in the Phase 2 migration.

create table if not exists public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  org_role        public.org_member_role not null,
  status          public.record_status not null default 'active',
  created_at      timestamptz not null default now(),
  unique (organization_id, profile_id, org_role)
);

-- Added nullable, backfilled below. NOT NULL is Phase 2, once RLS and the
-- cross-org test suite are green (plan §7) — do not tighten here.
alter table public.students add column if not exists organization_id uuid references public.organizations(id);
alter table public.classes add column if not exists organization_id uuid references public.organizations(id);
alter table public.assignments add column if not exists organization_id uuid references public.organizations(id);

create index if not exists idx_organization_members_profile on public.organization_members(profile_id, status);
create index if not exists idx_organization_members_org_role on public.organization_members(organization_id, org_role);
create index if not exists idx_students_organization on public.students(organization_id);
create index if not exists idx_classes_organization on public.classes(organization_id);
create index if not exists idx_assignments_organization on public.assignments(organization_id);

-- Seed the `direct` org: home for every existing private client and the
-- default for any row with no other organisational signal.
insert into public.organizations (name, type, status)
select 'Project Odysseus — Direct', 'direct'::public.organization_type, 'active'::public.record_status
where not exists (select 1 from public.organizations where type = 'direct');

-- Backfill: migrate `ngo_partners` rows into `organizations` (type `ngo`),
-- preserving IDs so existing `students.ngo_partner_id` / `classes.ngo_partner_id`
-- values still resolve as `organizations.id` values.
insert into public.organizations (
  id, name, type, contact_person, contact_email, contact_phone, location, notes, status, created_at
)
select
  np.id,
  np.name,
  'ngo'::public.organization_type,
  np.contact_person,
  np.contact_email,
  np.contact_phone,
  np.location,
  np.notes,
  'active'::public.record_status,
  np.created_at
from public.ngo_partners np
where not exists (select 1 from public.organizations o where o.id = np.id);

-- Backfill: NGO-linked students/classes -> their NGO org; everyone else ->
-- the `direct` org.
update public.students s
set organization_id = s.ngo_partner_id
where s.ngo_partner_id is not null
  and s.organization_id is distinct from s.ngo_partner_id;

update public.students s
set organization_id = (select o.id from public.organizations o where o.type = 'direct' limit 1)
where s.ngo_partner_id is null
  and s.organization_id is null;

update public.classes c
set organization_id = c.ngo_partner_id
where c.ngo_partner_id is not null
  and c.organization_id is distinct from c.ngo_partner_id;

update public.classes c
set organization_id = (select o.id from public.organizations o where o.type = 'direct' limit 1)
where c.ngo_partner_id is null
  and c.organization_id is null;

-- Assignments carry no NGO signal today (no `ngo_partner_id` column), so
-- every existing assignment lands in the `direct` org for now. Phase 2 can
-- revisit deriving an assignment's org from its creating tutor's org
-- membership once `organization_members` is populated end to end.
update public.assignments a
set organization_id = (select o.id from public.organizations o where o.type = 'direct' limit 1)
where a.organization_id is null;

-- Backfill: `organization_members` from existing tutors — a tutor becomes a
-- member of every org their classes or active tutor_student_allocations
-- touch. Coordinators are NOT backfilled here: nothing in the current schema
-- marks a profile as a coordinator, so pilot-org coordinators must be
-- assigned manually by a platform admin (plan §7, §11.2 — platform-admin-only
-- provisioning to start).
insert into public.organization_members (organization_id, profile_id, org_role, status)
select distinct c.organization_id, t.profile_id, 'tutor'::public.org_member_role, 'active'::public.record_status
from public.classes c
join public.tutors t on t.id = c.tutor_id
where c.organization_id is not null
on conflict (organization_id, profile_id, org_role) do nothing;

insert into public.organization_members (organization_id, profile_id, org_role, status)
select distinct s.organization_id, t.profile_id, 'tutor'::public.org_member_role, 'active'::public.record_status
from public.tutor_student_allocations tsa
join public.tutors t on t.id = tsa.tutor_id
join public.students s on s.id = tsa.student_id
where tsa.status = 'active'
  and s.organization_id is not null
on conflict (organization_id, profile_id, org_role) do nothing;

-- ============================================================================
-- Multi-organisation model — Phase 2 (Enforce), step 1 of 2: additive only.
-- ADR-0002: docs/architecture/MULTI_ORG_MODEL_PLAN.md §5, §7, §8.
--
-- This step adds the `current_org_*` helpers, the indexes they need, and
-- org-scoped RLS policies ALONGSIDE every existing policy from Phase 0/1 and
-- earlier. Nothing here removes, replaces, or weakens any pre-existing
-- policy, and `organization_id` stays nullable. The full RLS/cross-org test
-- suite (tests/frontend/multi-org-rls-isolation.test.cjs) must be green
-- before step 2 of Phase 2 (fix the submission-insert/draft-assignment
-- bypasses, set `organization_id NOT NULL`, remove superseded permissive
-- policies) is allowed to proceed, per the plan's "additive, verify green,
-- then cut over" discipline.
-- ============================================================================

-- --- 5.1 Helper functions (SECURITY DEFINER, indexed-backed) ---------------

-- Joins public.profile_identities (not public.profiles directly) -- see the
-- "Identity lookup shadow table" comment near current_profile_role() for why:
-- a raw join into profiles here would recurse if this function is ever
-- invoked while profiles' own RLS policy is being evaluated.
create or replace function public.current_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select om.organization_id
  from public.organization_members om
  join public.profile_identities pi on pi.profile_id = om.profile_id
  where pi.auth_user_id = auth.uid()
    and om.status = 'active'
$$;

create or replace function public.current_student_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.organization_id
  from public.students s
  join public.profile_identities pi on pi.profile_id = s.profile_id
  where pi.auth_user_id = auth.uid()
$$;

-- Role check within a specific org. If a profile somehow holds more than one
-- org_role row for the same org (the unique constraint on organization_members
-- is (organization_id, profile_id, org_role), so this is possible), prefer
-- 'coordinator' deterministically so a coexisting lower-privilege row can
-- never mask a real coordinator grant in a security check.
create or replace function public.current_org_role(org uuid)
returns public.org_member_role
language sql
stable
security definer
set search_path = public
as $$
  select om.org_role
  from public.organization_members om
  join public.profile_identities pi on pi.profile_id = om.profile_id
  where pi.auth_user_id = auth.uid()
    and om.organization_id = org
    and om.status = 'active'
  order by case om.org_role when 'coordinator' then 0 else 1 end
  limit 1
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() = 'admin'
$$;

-- --- 8. Indexes --------------------------------------------------------
-- organization_members(profile_id, status), organization_members(organization_id, org_role),
-- students/classes/assignments(organization_id) already exist from Phase 1
-- (idx_organization_members_profile, idx_organization_members_org_role,
-- idx_students_organization, idx_classes_organization,
-- idx_assignments_organization above) and are confirmed still present.
-- current_org_role() additionally filters on (profile_id, organization_id,
-- status) together, which the Phase 1 indexes only partially cover, so add a
-- composite index for that lookup shape.
create index if not exists idx_organization_members_profile_org_status
  on public.organization_members(profile_id, organization_id, status);

-- --- 5.2 Org-scoped policies (additive; existing policies untouched) ------

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

drop policy if exists "organizations_select_member_or_admin" on public.organizations;
create policy "organizations_select_member_or_admin"
on public.organizations for select
using (
  public.is_platform_admin()
  or id in (select public.current_org_ids())
);

drop policy if exists "admin_manage_organizations" on public.organizations;
create policy "admin_manage_organizations"
on public.organizations for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "organization_members_select_scoped" on public.organization_members;
create policy "organization_members_select_scoped"
on public.organization_members for select
using (
  public.is_platform_admin()
  or profile_id = public.current_profile_id()
  or organization_id in (select public.current_org_ids())
);

-- Coordinators may manage membership rows for their own org (e.g. adding a
-- tutor), but NEVER rows with org_role = 'coordinator' — coordinator
-- provisioning stays platform-admin-only (plan §11.2), so a coordinator
-- cannot create, edit, or remove another coordinator (or self-escalate) via
-- this policy. Both using() and with check() carry the guard so it applies
-- to select/update/delete visibility as well as insert/update values.
drop policy if exists "organization_members_coordinator_manage" on public.organization_members;
create policy "organization_members_coordinator_manage"
on public.organization_members for all
using (
  public.is_platform_admin()
  or (
    public.current_org_role(organization_id) = 'coordinator'
    and org_role <> 'coordinator'
  )
)
with check (
  public.is_platform_admin()
  or (
    public.current_org_role(organization_id) = 'coordinator'
    and org_role <> 'coordinator'
  )
);

drop policy if exists "admin_manage_organization_members" on public.organization_members;
create policy "admin_manage_organization_members"
on public.organization_members for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- Students carry direct learner PII, so (unlike classes/assignments below)
-- this pass does NOT add a blanket "any org member can read" policy here —
-- that would hand a partner_viewer (or a same-org tutor with no allocation
-- to this learner) new read access to raw student rows, which §5.3/§11.4
-- forbid. Only the org's coordinator gets new (additive) access, matching
-- the role table in §4 ("Coordinator: manage that org's ... learners").
drop policy if exists "students_coordinator_org_manage" on public.students;
create policy "students_coordinator_org_manage"
on public.students for all
using (
  public.is_platform_admin()
  or public.current_org_role(organization_id) = 'coordinator'
)
with check (
  public.is_platform_admin()
  or public.current_org_role(organization_id) = 'coordinator'
);

-- Classes carry no learner PII by themselves (name/tutor/subject/schedule),
-- so — matching the plan's §5.2 example verbatim — any active org member may
-- read them; only the org's coordinator can manage them.
drop policy if exists "classes_org_scoped_read" on public.classes;
create policy "classes_org_scoped_read"
on public.classes for select
using (
  public.is_platform_admin()
  or organization_id in (select public.current_org_ids())
);

drop policy if exists "classes_coordinator_manage" on public.classes;
create policy "classes_coordinator_manage"
on public.classes for all
using (
  public.is_platform_admin()
  or public.current_org_role(organization_id) = 'coordinator'
)
with check (
  public.is_platform_admin()
  or public.current_org_role(organization_id) = 'coordinator'
);

-- KNOWN GAP (AUDIT.md High / plan §6, deferred to Phase 2 step 2 / "2b"):
-- "assignments_read_authenticated" (below, unchanged in this pass) still
-- reads `using (auth.uid() is not null)`, letting ANY authenticated user
-- (including students, and members of other orgs) read ANY assignment row
-- regardless of draft/published status or org. This additive
-- "assignments_org_scoped_read" policy does not close that gap — permissive
-- policies OR together, so the older, broader policy still wins today. 2b
-- folds `status = 'published'` scoping into a replacement org-scoped read
-- policy and removes "assignments_read_authenticated" in the same migration
-- that sets organization_id NOT NULL. Do not remove it here.
drop policy if exists "assignments_org_scoped_read" on public.assignments;
create policy "assignments_org_scoped_read"
on public.assignments for select
using (
  public.is_platform_admin()
  or organization_id in (select public.current_org_ids())
);

drop policy if exists "assignments_coordinator_manage" on public.assignments;
create policy "assignments_coordinator_manage"
on public.assignments for all
using (
  public.is_platform_admin()
  or public.current_org_role(organization_id) = 'coordinator'
)
with check (
  public.is_platform_admin()
  or public.current_org_role(organization_id) = 'coordinator'
);

-- --- 5.3 Partner-viewer aggregate access (POPIA-critical) ------------------
-- `partner_viewer` gets NO select policy anywhere above on students,
-- assignment_submissions, student_progress, or guardians — their only path
-- to org data is this SECURITY DEFINER RPC, which returns aggregates only
-- (counts/averages/distributions; no names, ids, or guardian contacts) and
-- applies the small-cohort suppression rule from plan §11.6.

create or replace function public.get_org_cohort_report(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Small-cohort suppression threshold (plan §11.6): cohorts below this many
  -- learners return a suppressed report instead of real aggregates, to guard
  -- against re-identification. Named constant, not a magic number, so it is
  -- one obvious edit (or a future config-table read) to retune.
  v_min_cohort_size constant int := 5;
  v_learner_count int;
  v_avg_progress_score numeric;
  v_submission_count int;
  v_marked_submission_count int;
  v_progress_distribution jsonb;
begin
  if not exists (
    select 1
    from public.organization_members om
    join public.profiles p on p.id = om.profile_id
    where p.auth_user_id = auth.uid()
      and om.organization_id = p_org_id
      and om.org_role = 'partner_viewer'
      and om.status = 'active'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select count(*) into v_learner_count
  from public.students s
  where s.organization_id = p_org_id;

  if v_learner_count < v_min_cohort_size then
    return jsonb_build_object(
      'organization_id', p_org_id,
      'learner_count', v_learner_count,
      'suppressed', true,
      'suppression_reason', format('cohort below minimum reporting size (fewer than %s learners)', v_min_cohort_size)
    );
  end if;

  select avg(sp.score) into v_avg_progress_score
  from public.student_progress sp
  join public.students s on s.id = sp.student_id
  where s.organization_id = p_org_id;

  select count(*) into v_submission_count
  from public.assignment_submissions sub
  join public.students s on s.id = sub.student_id
  where s.organization_id = p_org_id;

  select count(*) into v_marked_submission_count
  from public.assignment_submissions sub
  join public.students s on s.id = sub.student_id
  where s.organization_id = p_org_id
    and sub.status = 'marked';

  select coalesce(jsonb_agg(jsonb_build_object('cognitive_level', bucket.cognitive_level, 'count', bucket.learner_count)), '[]'::jsonb)
  into v_progress_distribution
  from (
    select sp.cognitive_level, count(*) as learner_count
    from public.student_progress sp
    join public.students s on s.id = sp.student_id
    where s.organization_id = p_org_id
    group by sp.cognitive_level
  ) bucket;

  return jsonb_build_object(
    'organization_id', p_org_id,
    'learner_count', v_learner_count,
    'suppressed', false,
    'average_progress_score', round(coalesce(v_avg_progress_score, 0), 2),
    'submission_count', v_submission_count,
    'marked_submission_count', v_marked_submission_count,
    'progress_distribution_by_cognitive_level', v_progress_distribution
  );
end;
$$;

grant execute on function public.get_org_cohort_report(uuid) to authenticated;

-- ============================================================================
-- Multi-organisation model — Phase 2 (Enforce), step 2 of 2: the cutover.
-- ADR-0002: docs/architecture/MULTI_ORG_MODEL_PLAN.md §7, §10.
--
-- Step 1 (above) added org-scoped RLS policies alongside the existing ones and
-- the cross-org test suite went green. Per the plan's §7 ("once step 1's tests
-- are green, set organization_id NOT NULL and remove the superseded permissive
-- policies"), this step:
--   1. adds a BEFORE INSERT trigger that auto-fills organization_id, so
--      NOT NULL is safe without any frontend change (no insert path sets the
--      column yet — the org-selection UI is a later milestone);
--   2. defensively backfills any stray null organization_id rows;
--   3. sets organization_id NOT NULL on students, classes, assignments;
--   4. replaces the over-permissive assignments_read_authenticated policy with
--      a correctly-scoped student read policy and drops the old one.
-- ============================================================================

-- --- 7.1 Auto-fill trigger for organization_id -----------------------------
-- One reusable trigger function, attached to all three org-scoped tables, so
-- inserts that don't yet supply organization_id (every current production
-- write path — none has org-selection UI) still land in the right org and the
-- NOT NULL constraint below never fires. Fallback precedence mirrors
-- coalesce(new.organization_id, <ngo-derived org>, <creator's own org>, <direct org>):
--   1. Caller supplied organization_id explicitly (a future coordinator UI) —
--      always respected, this trigger never overrides it.
--   2. students/classes only: new.ngo_partner_id, which IS the org id — Phase 1
--      preserved organizations.id = ngo_partners.id for every NGO, so this is a
--      direct mapping, not a lookup by name. (assignments has no such column.)
--   3. The creator's own org: the active organization_members row for the
--      profile behind auth.uid() (same join shape as current_org_ids()). This
--      keeps the trigger correct once real coordinators/tutors are provisioned
--      into non-direct orgs, not just for today's direct-org-only inserts.
--   4. Final fallback: the seeded `direct` org.
-- SECURITY DEFINER so the auth.uid()->org lookup reads organization_members and
-- profiles regardless of the inserting caller's RLS; it only ever WRITES
-- new.organization_id on the row being inserted.
create or replace function public.fill_organization_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  -- 1. Explicit value wins; never override a caller-supplied org.
  if new.organization_id is not null then
    return new;
  end if;

  -- 2. NGO branch (students/classes carry ngo_partner_id; assignments does not).
  -- Real bug fix, not a design choice: this used to be a single `if A and B`
  -- expression, relying on A (the TG_TABLE_NAME check) short-circuiting
  -- before B (`new.ngo_partner_id`) was evaluated for tables without that
  -- column. Postgres does NOT guarantee left-to-right short-circuit
  -- evaluation of AND/OR -- confirmed live: inserting into public.assignments
  -- (which has no ngo_partner_id column) raised `record "new" has no field
  -- "ngo_partner_id"` on every single insert, because NEW is a generic RECORD
  -- shared across every table this trigger is attached to. Nesting the check
  -- as a real control-flow IF (not a boolean expression) guarantees
  -- new.ngo_partner_id is only ever evaluated for tables where TG_TABLE_NAME
  -- has already been confirmed to be 'students' or 'classes'.
  if tg_table_name in ('students', 'classes') then
    if new.ngo_partner_id is not null then
      new.organization_id := new.ngo_partner_id;
      return new;
    end if;
  end if;

  -- 3. Creator's own org via active membership for the profile behind auth.uid().
  select om.organization_id into v_org
  from public.organization_members om
  join public.profiles p on p.id = om.profile_id
  where p.auth_user_id = auth.uid()
    and om.status = 'active'
  limit 1;

  if v_org is not null then
    new.organization_id := v_org;
    return new;
  end if;

  -- 4. Final fallback: the seeded `direct` org.
  select id into v_org
  from public.organizations
  where type = 'direct'
  limit 1;

  new.organization_id := v_org;
  return new;
end;
$$;

-- drop-then-create keeps this idempotent across re-applies on any supported
-- Postgres version (create trigger has no IF NOT EXISTS).
drop trigger if exists trg_fill_organization_id on public.students;
create trigger trg_fill_organization_id
  before insert on public.students
  for each row execute function public.fill_organization_id();

drop trigger if exists trg_fill_organization_id on public.classes;
create trigger trg_fill_organization_id
  before insert on public.classes
  for each row execute function public.fill_organization_id();

drop trigger if exists trg_fill_organization_id on public.assignments;
create trigger trg_fill_organization_id
  before insert on public.assignments
  for each row execute function public.fill_organization_id();

-- --- 7.2 Defensive backfill (belt-and-suspenders) --------------------------
-- Phase 1 already backfilled organization_id (ngo/direct mapping) above. These
-- statements are idempotent and only touch rows that somehow still hold a null
-- (e.g. slipped in between Phase 1 landing and this cutover), sending them to
-- the direct org so the NOT NULL constraint below can be applied safely.
update public.students
set organization_id = (select id from public.organizations where type = 'direct' limit 1)
where organization_id is null;

update public.classes
set organization_id = (select id from public.organizations where type = 'direct' limit 1)
where organization_id is null;

update public.assignments
set organization_id = (select id from public.organizations where type = 'direct' limit 1)
where organization_id is null;

-- --- 7.3 Enforce organization_id NOT NULL ----------------------------------
-- Safe now: the trigger fills it on every insert and the backfill cleared any
-- residual nulls. Every org-scoped RLS policy from step 1 can now assume a
-- non-null organization_id.
alter table public.students alter column organization_id set not null;
alter table public.classes alter column organization_id set not null;
alter table public.assignments alter column organization_id set not null;

-- --- 7.4 Fix the draft/cross-org assignment over-exposure bug ---------------
-- The old "assignments_read_authenticated" policy (using auth.uid() is not null)
-- let ANY authenticated user read ANY assignment — any status, any org. Simply
-- dropping it and leaning on step 1's "assignments_org_scoped_read"
-- (organization_id in current_org_ids()) would break student assignment
-- visibility: students are never rows in organization_members by design
-- (§3.3), so current_org_ids() is empty for them, and
-- src/features/students/studentDashboardRepository.ts reads the assignments
-- table directly. This replacement policy grants students SELECT on exactly the
-- rows they legitimately need — published assignments in their OWN org (org
-- resolved via students.organization_id through current_student_org_id()) —
-- closing the bug on both axes (no drafts, no cross-org) at once. Parent access
-- is unaffected: parentReportsRepository uses get_parent_progress_reports(),
-- which is SECURITY DEFINER and bypasses RLS.
drop policy if exists "assignments_student_read_published_own_org" on public.assignments;
create policy "assignments_student_read_published_own_org"
on public.assignments for select
using (
  status = 'published'
  and organization_id = public.current_student_org_id()
);

-- Now that a correct, strictly-narrower replacement exists and is verified by
-- the RLS test suite, drop the superseded permissive policy. This is the single
-- "remove the superseded permissive policies" removal called for by the plan's
-- §7 cutover. Students/classes were reviewed for similarly-superseded broad
-- policies: none qualify — students_select_self_or_admin,
-- classes_select_scoped, and class_enrollments_select_scoped are role-based
-- (self / admin / allocated-tutor / enrolled-student), not strictly broader
-- than any org-scoped policy, so they are legitimately still needed and left
-- in place. assignments_read_authenticated is the only genuinely-superseded
-- policy, so it is the only removal.
drop policy if exists "assignments_read_authenticated" on public.assignments;

-- ============================================================================
-- Sessions linchpin migration (PRISMA_TO_SUPABASE_MIGRATION_PLAN.md §2).
--
-- Ports the Prisma `Session` / `SessionHistory` models and the full Fastify
-- session business-logic layer (window/overlap/lock validation, the
-- DRAFT -> SUBMITTED -> APPROVED/REJECTED state machine, append-only audit
-- history) into a Supabase-native schema + RLS + SECURITY DEFINER RPC layer.
-- Source of truth ported from lms-api: prisma/schema.prisma (Session ~L516,
-- SessionHistory ~L554), src/routes/tutor.ts (session routes), src/lib/
-- scheduling.ts (window/duration), src/domains/admin/approvals/service.ts
-- (approve/reject), src/lib/rbac.ts (requireTutorSelfScope), src/lib/schemas.ts
-- (field validation).
--
-- This lands FULLY BUILT BUT UNUSED. Explicitly deferred to later phases:
--   * Real data backfill from the Prisma sessions/session_history tables.
--   * Frontend repoint (tutor/admin/student UIs still call the Fastify
--     lms-api routes; this task does not touch src/ or lms-api/).
--   * Wiring the pay-period-lock stub once `pay_periods` migrates (see
--     session_date_pay_period_locked below).
--   * Wiring student-notification dispatch once `notifications` migrates
--     (see the "notification deferred" comments in the report/submit/approve
--     paths — Fastify calls createStudentNotification there; we do not).
--   * Retirement of the Fastify session routes.
-- ============================================================================

-- Lowercase to match this schema's enum convention (record_status,
-- assignment_status, ...), even though Prisma's SessionStatus was uppercase.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'session_status') then
    create type public.session_status as enum ('draft', 'submitted', 'approved', 'rejected');
  end if;
end
$$;

-- Org-scoped from birth (ADR-0002). organization_id is derived from the
-- session's STUDENT by the dedicated fill_session_organization_id() trigger
-- below (NOT the generic multi-org fill_organization_id fallback chain).
-- tutor_student_allocation_id replaces Prisma's assignment_id: the
-- engagement/contract concept now lives in tutor_student_allocations (plan
-- §3A). tutor_private_notes / report_review_note / payout_override are
-- tutor/admin-only (financial/internal) and must never reach a student read
-- path (see get_student_sessions and RLS below).
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  tutor_id uuid not null references public.tutors(id),
  student_id uuid not null references public.students(id),
  tutor_student_allocation_id uuid not null references public.tutor_student_allocations(id),
  date date not null,
  start_time time not null,
  end_time time not null,
  duration_minutes int not null,
  mode text not null,
  location text,
  notes text,
  attendance_status text,
  topics_covered text,
  learner_struggles text,
  homework_assigned text,
  tutor_private_notes text,
  student_summary text,
  report_review_note text,
  payout_override boolean not null default false,
  sync_key text,
  status public.session_status not null default 'draft',
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  constraint sessions_attendance_status_check check (attendance_status is null or attendance_status in ('present', 'absent', 'late', 'excused')),
  constraint sessions_duration_minutes_positive check (duration_minutes > 0),
  constraint sessions_mode_len check (char_length(mode) between 1 and 40),
  constraint sessions_location_len check (location is null or char_length(location) <= 120),
  constraint sessions_notes_len check (notes is null or char_length(notes) <= 2000),
  constraint sessions_topics_covered_len check (topics_covered is null or char_length(topics_covered) <= 3000),
  constraint sessions_learner_struggles_len check (learner_struggles is null or char_length(learner_struggles) <= 3000),
  constraint sessions_homework_assigned_len check (homework_assigned is null or char_length(homework_assigned) <= 3000),
  constraint sessions_tutor_private_notes_len check (tutor_private_notes is null or char_length(tutor_private_notes) <= 3000),
  constraint sessions_student_summary_len check (student_summary is null or char_length(student_summary) <= 3000),
  constraint sessions_report_review_note_len check (report_review_note is null or char_length(report_review_note) <= 3000)
);

-- Backfill for a database where this table was partially created by an
-- earlier, interrupted migration attempt (same reasoning as the
-- assignment_submissions backfill elsewhere in this file). Safe as NOT NULL
-- with no default: if these columns didn't exist, no insert into sessions
-- (via create_session, which requires organization_id/tutor_student_allocation_id)
-- could ever have succeeded, so there are no real rows to violate the constraint.
alter table public.sessions add column if not exists organization_id uuid not null references public.organizations(id);
alter table public.sessions add column if not exists tutor_student_allocation_id uuid not null references public.tutor_student_allocations(id);

-- Append-only audit trail, mirroring the audit_log immutability pattern:
-- admin-only SELECT, no direct writes for anyone, rows created ONLY via the
-- SECURITY DEFINER insert_session_history() helper (execute revoked below).
create table if not exists public.session_history (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id),
  changed_by_profile_id uuid references public.profiles(id),
  change_type text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now(),
  constraint session_history_change_type_check check (change_type in ('create', 'edit', 'report_update', 'submit', 'approve', 'reject'))
);

-- Backfill for a database where this table was partially created by an
-- earlier, interrupted migration attempt (same reasoning as the
-- assignment_submissions backfill elsewhere in this file).
alter table public.session_history add column if not exists changed_by_profile_id uuid references public.profiles(id);

create index if not exists idx_sessions_tutor_date on public.sessions(tutor_id, date);
create index if not exists idx_sessions_student_date on public.sessions(student_id, date desc, start_time desc);
create index if not exists idx_sessions_organization on public.sessions(organization_id);
-- Idempotency defense-in-depth: Fastify only did a manual check-then-insert on
-- (tutor_id, sync_key); since create_session runs as one atomic transaction a
-- partial unique index is a strict improvement, not a behaviour change.
create unique index if not exists idx_sessions_tutor_sync_key on public.sessions(tutor_id, sync_key) where sync_key is not null;
create index if not exists idx_session_history_session on public.session_history(session_id);

alter table public.sessions enable row level security;
alter table public.session_history enable row level security;

-- Dedicated org-derivation trigger for sessions. IMPORTANT: this is NOT the
-- generic multi-org fill_organization_id() trigger. A session's org must ALWAYS
-- equal its STUDENT's org (students.organization_id), full stop. The generic
-- trigger's fallback chain (ngo_partner_id -> creator's own org membership ->
-- direct org) is wrong here: an admin (not org-scoped) or a multi-org tutor
-- creating the session could silently misfile it into the wrong org. So we look
-- the org up from the student and raise rather than defaulting to `direct` if
-- that lookup comes back null (it never should — students.organization_id is
-- NOT NULL). A caller-supplied organization_id is respected (future coordinator
-- UI), matching the generic trigger's "explicit value wins" rule.
create or replace function public.fill_session_organization_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if new.organization_id is not null then
    return new;
  end if;

  select organization_id into v_org
  from public.students
  where id = new.student_id;

  if v_org is null then
    raise exception 'session_org_unresolved' using errcode = '23502';
  end if;

  new.organization_id := v_org;
  return new;
end;
$$;

drop trigger if exists trg_fill_session_organization_id on public.sessions;
create trigger trg_fill_session_organization_id
  before insert on public.sessions
  for each row execute function public.fill_session_organization_id();

-- WIRED UP by the finance/payroll migration (PRISMA_TO_SUPABASE_MIGRATION_PLAN.md
-- §4/§6) below: `pay_periods` now exists, so this is the real port of Fastify's
-- isDateLocked() (lms-api/src/domains/admin/approvals/internal.ts L182 /
-- lms-api/src/routes/tutor.ts L53) -- this closes the loop the sessions
-- migration deliberately left open as a stub. Given a date, resolve its
-- pay-period week-start (Monday) via date_trunc('week', ...) -- which returns the
-- ISO Monday, exactly equivalent to Fastify's (day + 6) % 7 offset math -- look
-- up pay_periods.status for that period_start_date, and return true iff a row
-- exists AND status = 'locked'. Every session RPC that mutates state already
-- calls this at the same point Fastify checks isDateLocked, so no session call
-- site changes now that it is wired up.
--
-- NOTE: this is `language plpgsql` (was `language sql` while a stub) so the
-- forward reference to public.pay_periods -- created later in this same file, in
-- the finance/payroll section -- resolves at run time, not create time; and
-- `stable` (was `immutable`) because it now reads a table.
create or replace function public.session_date_pay_period_locked(p_date date)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_locked boolean;
begin
  select (p.status = 'locked') into v_locked
  from public.pay_periods p
  where p.period_start_date = date_trunc('week', p_date::timestamp)::date;
  return coalesce(v_locked, false);
end;
$$;

-- Faithful PL/pgSQL port of lms-api/src/lib/scheduling.ts
-- isWithinAssignmentWindow. Day-of-week: JS getUTCDay() returns
-- 0=Sunday..6=Saturday and Postgres extract(dow) matches exactly, so
-- allowed_days integers port 1:1. NOTE: Prisma's Assignment.start_date was NOT
-- NULL, but tutor_student_allocations.start_date is nullable; a null start/end
-- means "no bound on that side" (the Fastify check is simply skipped).
create or replace function public.session_within_allocation_window(
  p_date date,
  p_start_time time,
  p_end_time time,
  p_start_date date,
  p_end_date date,
  p_allowed_days jsonb,
  p_allowed_time_ranges jsonb
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_day int;
  v_in_range boolean;
begin
  if p_end_time <= p_start_time then
    return false;
  end if;

  if p_start_date is not null and p_date < p_start_date then
    return false;
  end if;

  if p_end_date is not null and p_date > p_end_date then
    return false;
  end if;

  v_day := extract(dow from p_date)::int;

  if p_allowed_days is not null
     and jsonb_typeof(p_allowed_days) = 'array'
     and jsonb_array_length(p_allowed_days) > 0 then
    if not exists (
      select 1 from jsonb_array_elements(p_allowed_days) elem
      where (elem#>>'{}')::int = v_day
    ) then
      return false;
    end if;
  end if;

  if p_allowed_time_ranges is not null
     and jsonb_typeof(p_allowed_time_ranges) = 'array'
     and jsonb_array_length(p_allowed_time_ranges) > 0 then
    select exists (
      select 1 from jsonb_array_elements(p_allowed_time_ranges) r
      where p_start_time >= (r->>'start')::time
        and p_end_time <= (r->>'end')::time
    ) into v_in_range;
    if not v_in_range then
      return false;
    end if;
  end if;

  return true;
end;
$$;

-- Internal append-only history writer, mirroring log_audit_event's lockdown:
-- SECURITY DEFINER, and execute revoked from public/anon/authenticated below
-- so the ONLY way a session_history row is created is via the session RPCs.
create or replace function public.insert_session_history(
  p_session_id uuid,
  p_change_type text,
  p_before_json jsonb,
  p_after_json jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.session_history (
    session_id, changed_by_profile_id, change_type, before_json, after_json
  )
  values (
    p_session_id, public.current_profile_id(), p_change_type, p_before_json, p_after_json
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- create_session: mirrors POST /tutor/sessions. Resolves the caller's tutor via
-- current_tutor_id() (never a client-supplied tutor id, replicating rbac.ts
-- requireTutorSelfScope); verifies the allocation belongs to that tutor, matches
-- the student, and is active; checks the pay-period stub; validates the window;
-- checks duration > 0; checks overlap; dedupes on (tutor_id, sync_key); inserts
-- as 'draft'; logs history ('create').
create or replace function public.create_session(
  p_tutor_student_allocation_id uuid,
  p_student_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_mode text,
  p_location text,
  p_notes text,
  p_idempotency_key text
)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := public.current_tutor_id();
  v_alloc public.tutor_student_allocations%rowtype;
  v_minutes int;
  v_mode text := btrim(coalesce(p_mode, ''));
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_existing public.sessions%rowtype;
  v_session public.sessions%rowtype;
begin
  if v_tutor_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- ensureTutorActive equivalent (gap 3): full Fastify parity is
  -- tutor.active && status === 'ACTIVE' && approval_status === 'approved'.
  -- Supabase's status = 'active' already stands in for the first two; the
  -- tutor-onboarding migration (§6 step 6) added approval_status to public.tutors,
  -- so the richer approval_status = 'approved' check is now wired up here.
  if not exists (select 1 from public.tutors t where t.id = v_tutor_id and t.status = 'active' and t.approval_status = 'approved') then
    raise exception 'tutor_not_active' using errcode = '42501';
  end if;

  if char_length(v_mode) < 1 or char_length(v_mode) > 40 then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  select * into v_alloc
  from public.tutor_student_allocations
  where id = p_tutor_student_allocation_id;
  if not found then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;

  if v_alloc.tutor_id <> v_tutor_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_alloc.student_id <> p_student_id then
    raise exception 'student_mismatch' using errcode = '23514';
  end if;

  if v_alloc.status <> 'active' then
    raise exception 'assignment_inactive' using errcode = '42501';
  end if;

  if public.session_date_pay_period_locked(p_date) then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  if not public.session_within_allocation_window(
       p_date, p_start_time, p_end_time,
       v_alloc.start_date, v_alloc.end_date,
       v_alloc.allowed_days_json, v_alloc.allowed_time_ranges_json) then
    raise exception 'outside_assignment_window' using errcode = '23514';
  end if;

  v_minutes := (extract(epoch from (p_end_time - p_start_time)) / 60)::int;
  if v_minutes <= 0 then
    raise exception 'invalid_duration_minutes' using errcode = '23514';
  end if;

  -- Idempotency dedupe (matches Fastify's check-then-return-existing shape).
  if v_key is not null then
    select * into v_existing
    from public.sessions
    where tutor_id = v_tutor_id and sync_key = v_key
    limit 1;
    if found then
      return v_existing;
    end if;
  end if;

  -- Overlap against the tutor's other sessions on that date (same predicate as
  -- Fastify: not (end <= new.start or start >= new.end)).
  if exists (
    select 1 from public.sessions
    where tutor_id = v_tutor_id
      and date = p_date
      and not (end_time <= p_start_time or start_time >= p_end_time)
  ) then
    raise exception 'overlapping_session' using errcode = '23505';
  end if;

  -- organization_id intentionally omitted: fill_session_organization_id()
  -- derives it from the student before the NOT NULL check.
  insert into public.sessions (
    tutor_id, student_id, tutor_student_allocation_id, date, start_time, end_time,
    duration_minutes, mode, location, notes, status, sync_key
  )
  values (
    v_tutor_id, p_student_id, p_tutor_student_allocation_id, p_date, p_start_time, p_end_time,
    v_minutes, v_mode, nullif(btrim(coalesce(p_location, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''), 'draft', v_key
  )
  returning * into v_session;

  perform public.insert_session_history(v_session.id, 'create', null, to_jsonb(v_session));
  return v_session;
end;
$$;

-- update_session: mirrors PATCH /tutor/sessions/:id. Tutor-owned, draft-only,
-- re-validates duration/pay-period-stub/window/overlap, logs history ('edit').
-- Field-merge semantics match Fastify's `parsed.data.x ?? current.x` (a null
-- argument keeps the current value; there is no explicit "clear to null").
create or replace function public.update_session(
  p_session_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_mode text,
  p_location text,
  p_notes text
)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := public.current_tutor_id();
  v_current public.sessions%rowtype;
  v_alloc public.tutor_student_allocations%rowtype;
  v_date date;
  v_start time;
  v_end time;
  v_mode text;
  v_minutes int;
  v_updated public.sessions%rowtype;
begin
  if v_tutor_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.tutors t where t.id = v_tutor_id and t.status = 'active' and t.approval_status = 'approved') then
    raise exception 'tutor_not_active' using errcode = '42501';
  end if;

  select * into v_current
  from public.sessions
  where id = p_session_id and tutor_id = v_tutor_id;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;

  if v_current.status <> 'draft' then
    raise exception 'only_draft_editable';
  end if;

  v_date := coalesce(p_date, v_current.date);
  v_start := coalesce(p_start_time, v_current.start_time);
  v_end := coalesce(p_end_time, v_current.end_time);
  v_mode := coalesce(nullif(btrim(coalesce(p_mode, '')), ''), v_current.mode);

  if char_length(v_mode) < 1 or char_length(v_mode) > 40 then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  v_minutes := (extract(epoch from (v_end - v_start)) / 60)::int;
  if v_minutes <= 0 then
    raise exception 'invalid_duration_minutes' using errcode = '23514';
  end if;

  if public.session_date_pay_period_locked(v_date) then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  select * into v_alloc
  from public.tutor_student_allocations
  where id = v_current.tutor_student_allocation_id;
  if not found then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;

  if v_alloc.status <> 'active' then
    raise exception 'assignment_inactive' using errcode = '42501';
  end if;

  if not public.session_within_allocation_window(
       v_date, v_start, v_end,
       v_alloc.start_date, v_alloc.end_date,
       v_alloc.allowed_days_json, v_alloc.allowed_time_ranges_json) then
    raise exception 'outside_assignment_window' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.sessions
    where tutor_id = v_tutor_id
      and date = v_date
      and id <> p_session_id
      and not (end_time <= v_start or start_time >= v_end)
  ) then
    raise exception 'overlapping_session' using errcode = '23505';
  end if;

  update public.sessions set
    date = v_date,
    start_time = v_start,
    end_time = v_end,
    duration_minutes = v_minutes,
    mode = v_mode,
    location = coalesce(nullif(btrim(coalesce(p_location, '')), ''), v_current.location),
    notes = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), v_current.notes)
  where id = p_session_id
  returning * into v_updated;

  perform public.insert_session_history(p_session_id, 'edit', to_jsonb(v_current), to_jsonb(v_updated));
  return v_updated;
end;
$$;

-- submit_session_report: mirrors PATCH /tutor/sessions/:id/report. Tutor-owned,
-- draft-only, updates report fields only (does NOT change status). Report fields
-- are overwritten wholesale (Fastify sets each to `value ?? null`), and notes is
-- backfilled from student_summary (Fastify's `notes = coalesce(studentSummary,
-- notes)`). Notification dispatch is deferred (gap 2 -- Fastify calls
-- createStudentNotification here; the notifications table does not exist in
-- Supabase yet). Logs history ('report_update') -- an added-for-consistency
-- audit entry the plan calls for (Fastify's report route does not itself log).
create or replace function public.submit_session_report(
  p_session_id uuid,
  p_attendance_status text,
  p_topics_covered text,
  p_learner_struggles text,
  p_homework_assigned text,
  p_tutor_private_notes text,
  p_student_summary text
)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := public.current_tutor_id();
  v_current public.sessions%rowtype;
  v_updated public.sessions%rowtype;
  v_attendance text := nullif(btrim(coalesce(p_attendance_status, '')), '');
  v_summary text := nullif(btrim(coalesce(p_student_summary, '')), '');
begin
  if v_tutor_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.tutors t where t.id = v_tutor_id and t.status = 'active' and t.approval_status = 'approved') then
    raise exception 'tutor_not_active' using errcode = '42501';
  end if;

  select * into v_current
  from public.sessions
  where id = p_session_id and tutor_id = v_tutor_id;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;

  if v_current.status <> 'draft' then
    raise exception 'only_draft_editable';
  end if;

  if v_attendance is not null and v_attendance not in ('present', 'absent', 'late', 'excused') then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  update public.sessions set
    attendance_status = v_attendance,
    topics_covered = nullif(btrim(coalesce(p_topics_covered, '')), ''),
    learner_struggles = nullif(btrim(coalesce(p_learner_struggles, '')), ''),
    homework_assigned = nullif(btrim(coalesce(p_homework_assigned, '')), ''),
    tutor_private_notes = nullif(btrim(coalesce(p_tutor_private_notes, '')), ''),
    student_summary = v_summary,
    notes = coalesce(v_summary, notes)
  where id = p_session_id and tutor_id = v_tutor_id
  returning * into v_updated;

  -- Notification dispatch (wired up by the weekly-reports/notifications
  -- migration -- closes the gap-2 loop the sessions migration left open). Mirrors
  -- Fastify's createStudentNotification on PATCH /tutor/sessions/:id/report.
  perform public.create_student_notification(
    v_current.student_id,
    'session_report_updated',
    'Session summary updated',
    'Your tutor added notes and learning feedback for the latest session.',
    '/dashboard/',
    'session',
    p_session_id,
    '{}'::jsonb
  );
  perform public.insert_session_history(p_session_id, 'report_update', to_jsonb(v_current), to_jsonb(v_updated));
  return v_updated;
end;
$$;

-- submit_session: mirrors POST /tutor/sessions/:id/submit. Tutor-owned,
-- draft-only, pay-period-stub check, transition to 'submitted', logs history
-- ('submit'). Notification deferred (gap 2).
create or replace function public.submit_session(p_session_id uuid)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := public.current_tutor_id();
  v_current public.sessions%rowtype;
  v_updated public.sessions%rowtype;
begin
  if v_tutor_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.tutors t where t.id = v_tutor_id and t.status = 'active' and t.approval_status = 'approved') then
    raise exception 'tutor_not_active' using errcode = '42501';
  end if;

  select * into v_current
  from public.sessions
  where id = p_session_id and tutor_id = v_tutor_id;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;

  if v_current.status <> 'draft' then
    raise exception 'only_draft_submittable';
  end if;

  if public.session_date_pay_period_locked(v_current.date) then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  update public.sessions set
    status = 'submitted',
    submitted_at = now()
  where id = p_session_id
  returning * into v_updated;

  -- Notification dispatch (wired up by the weekly-reports/notifications
  -- migration -- closes the gap-2 loop the sessions migration left open). Mirrors
  -- Fastify's createStudentNotification on POST /tutor/sessions/:id/submit.
  perform public.create_student_notification(
    v_current.student_id,
    'session_report_submitted',
    'Session notes submitted',
    'Your tutor submitted the latest session summary for review.',
    '/dashboard/',
    'session',
    p_session_id,
    '{}'::jsonb
  );
  perform public.insert_session_history(p_session_id, 'submit', to_jsonb(v_current), to_jsonb(v_updated));
  return v_updated;
end;
$$;

-- approve_session: mirrors approvals/service.ts approveSession. Admin-only,
-- only if status = 'submitted', pay-period-stub check, transition to 'approved'
-- (approved_at = now(), approved_by = current_profile_id()), logs history
-- ('approve'). Notification deferred (gap 2).
create or replace function public.approve_session(p_session_id uuid)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.sessions%rowtype;
  v_updated public.sessions%rowtype;
  v_subject text;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_current
  from public.sessions
  where id = p_session_id;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;

  -- Fastify's approveSession re-checks the tutor is still active before
  -- approving (a tutor may have been deactivated between submission and
  -- approval) -- mirrored here with full Fastify parity now that the
  -- tutor-onboarding migration (§6 step 6) added approval_status to
  -- public.tutors: status = 'active' stands in for active && status==='ACTIVE',
  -- plus the now-wired approval_status = 'approved' check (same as create/update/submit).
  if not exists (select 1 from public.tutors t where t.id = v_current.tutor_id and t.status = 'active' and t.approval_status = 'approved') then
    raise exception 'tutor_not_active' using errcode = '42501';
  end if;

  if public.session_date_pay_period_locked(v_current.date) then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  if v_current.status <> 'submitted' then
    raise exception 'only_submitted_approvable';
  end if;

  update public.sessions set
    status = 'approved',
    approved_at = now(),
    approved_by = public.current_profile_id()
  where id = p_session_id
  returning * into v_updated;

  -- Notification dispatch (wired up by the weekly-reports/notifications
  -- migration -- closes the gap-2 loop the sessions migration left open). Mirrors
  -- Fastify's createStudentNotification on POST /admin/sessions/:id/approve.
  -- Fastify read the subject from the old assignments join; in Supabase it is
  -- resolved via the session's allocation -> subject_id -> subjects.name, falling
  -- back to 'Your session' (the exact `row.subject || 'Your session'` behaviour).
  select subj.name into v_subject
  from public.tutor_student_allocations alloc
  left join public.subjects subj on subj.id = alloc.subject_id
  where alloc.id = v_current.tutor_student_allocation_id;
  perform public.create_student_notification(
    v_current.student_id,
    'session_approved',
    'Session approved',
    coalesce(v_subject, 'Your session') || ' on ' || v_current.date::text || ' was approved.',
    '/dashboard/',
    'session',
    p_session_id,
    '{}'::jsonb
  );
  perform public.insert_session_history(p_session_id, 'approve', to_jsonb(v_current), to_jsonb(v_updated));
  return v_updated;
end;
$$;

-- reject_session: mirrors approvals/service.ts rejectSession. Admin-only, only
-- if status = 'submitted', pay-period-stub check, transition to 'rejected'. The
-- reason is folded into after_json (Fastify's `{ ...updated, reject_reason }`).
-- Logs history ('reject'). Notification deferred (gap 2).
create or replace function public.reject_session(p_session_id uuid, p_reason text)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.sessions%rowtype;
  v_updated public.sessions%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_subject text;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  select * into v_current
  from public.sessions
  where id = p_session_id;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;

  if public.session_date_pay_period_locked(v_current.date) then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  if v_current.status <> 'submitted' then
    raise exception 'only_submitted_rejectable';
  end if;

  update public.sessions set
    status = 'rejected'
  where id = p_session_id
  returning * into v_updated;

  -- Notification dispatch (wired up by the weekly-reports/notifications
  -- migration -- closes the gap-2 loop the sessions migration left open). Mirrors
  -- Fastify's createStudentNotification on POST /admin/sessions/:id/reject, with
  -- the same allocation -> subject_id -> subjects.name subject resolution and
  -- 'Your session' fallback as approve_session.
  select subj.name into v_subject
  from public.tutor_student_allocations alloc
  left join public.subjects subj on subj.id = alloc.subject_id
  where alloc.id = v_current.tutor_student_allocation_id;
  perform public.create_student_notification(
    v_current.student_id,
    'session_rejected',
    'Session rejected',
    coalesce(v_subject, 'Your session') || ' on ' || v_current.date::text || ' was rejected.',
    '/dashboard/',
    'session',
    p_session_id,
    '{}'::jsonb
  );
  perform public.insert_session_history(
    p_session_id, 'reject', to_jsonb(v_current),
    to_jsonb(v_updated) || jsonb_build_object('reject_reason', v_reason)
  );
  return v_updated;
end;
$$;

-- get_student_sessions: the student-facing read path (students have ZERO direct
-- SELECT policies on public.sessions). Scoped to current_student_id()'s own
-- sessions. Returns ONLY student-safe columns and EXCLUDES tutor_private_notes,
-- report_review_note, payout_override, notes, approved_by, sync_key -- the same
-- financial/internal-confidentiality reasoning behind the rate_override
-- exclusion in the previous (tutor_student_allocations) migration step.
create or replace function public.get_student_sessions()
returns table (
  id uuid,
  date date,
  start_time time,
  end_time time,
  mode text,
  location text,
  attendance_status text,
  topics_covered text,
  homework_assigned text,
  student_summary text,
  status public.session_status
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.date,
    s.start_time,
    s.end_time,
    s.mode,
    s.location,
    s.attendance_status,
    s.topics_covered,
    s.homework_assigned,
    s.student_summary,
    s.status
  from public.sessions s
  where s.student_id = public.current_student_id()
  order by s.date desc, s.start_time desc;
$$;

-- --- Sessions RLS: no direct writes by anyone; all mutation via the RPCs -----
-- Follows the assignment_submissions precedent: SELECT is scoped (admin all;
-- tutor own, full columns), and INSERT/UPDATE/DELETE are with check (false) /
-- using (false) so the SECURITY DEFINER RPCs are the only write path. Students
-- get NO direct policy at all; their only read path is get_student_sessions().
drop policy if exists "admin_select_all_sessions" on public.sessions;
create policy "admin_select_all_sessions"
on public.sessions for select
using (public.is_platform_admin());

drop policy if exists "tutors_select_own_sessions" on public.sessions;
create policy "tutors_select_own_sessions"
on public.sessions for select
using (tutor_id = public.current_tutor_id());

drop policy if exists "sessions_no_direct_insert" on public.sessions;
create policy "sessions_no_direct_insert"
on public.sessions for insert
with check (false);

drop policy if exists "sessions_no_direct_update" on public.sessions;
create policy "sessions_no_direct_update"
on public.sessions for update
using (false)
with check (false);

drop policy if exists "sessions_no_direct_delete" on public.sessions;
create policy "sessions_no_direct_delete"
on public.sessions for delete
using (false);

-- --- session_history RLS: append-only, mirroring audit_log exactly -----------
drop policy if exists "admin_select_session_history" on public.session_history;
create policy "admin_select_session_history"
on public.session_history for select
using (public.is_platform_admin());

drop policy if exists "no_direct_session_history_insert" on public.session_history;
create policy "no_direct_session_history_insert"
on public.session_history for insert
with check (false);

drop policy if exists "no_direct_session_history_update" on public.session_history;
create policy "no_direct_session_history_update"
on public.session_history for update
using (false)
with check (false);

drop policy if exists "no_direct_session_history_delete" on public.session_history;
create policy "no_direct_session_history_delete"
on public.session_history for delete
using (false);

-- --- Grants: the six mutation RPCs + the student read RPC are callable by
-- authenticated; the internal history writer is locked down like log_audit_event.
grant execute on function public.create_session(uuid, uuid, date, time, time, text, text, text, text) to authenticated;
grant execute on function public.update_session(uuid, date, time, time, text, text, text) to authenticated;
grant execute on function public.submit_session_report(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.submit_session(uuid) to authenticated;
grant execute on function public.approve_session(uuid) to authenticated;
grant execute on function public.reject_session(uuid, text) to authenticated;
grant execute on function public.get_student_sessions() to authenticated;
revoke execute on function public.insert_session_history(uuid, text, jsonb, jsonb) from public;
revoke execute on function public.insert_session_history(uuid, text, jsonb, jsonb) from anon;
revoke execute on function public.insert_session_history(uuid, text, jsonb, jsonb) from authenticated;

-- ============================================================================
-- Finance / payroll migration (PRISMA_TO_SUPABASE_MIGRATION_PLAN.md §4/§6).
--
-- Ports the Prisma `PayPeriod` / `Adjustment` / `Invoice` / `InvoiceLine` models
-- and the full Fastify payroll business-logic layer (get-or-create pay period,
-- the per-week invoice-generation algorithm, the lock precondition state
-- machine, admin adjustment create/void) into a Supabase-native schema + RLS +
-- SECURITY DEFINER RPC layer. Sequenced right after sessions because invoices
-- and adjustments derive from APPROVED sessions.
--
-- Source of truth ported from lms-api: prisma/schema.prisma (PayPeriod ~L130,
-- Adjustment ~L146, Invoice ~L572, InvoiceLine ~L592), src/lib/pay-periods.ts
-- (Monday-Sunday week math), src/domains/admin/payroll/internal.ts
-- (getOrCreatePayPeriod, generateInvoicesForWeek, getSignedAmount),
-- src/domains/admin/payroll/service.ts (generatePayrollWeek, lockPayPeriod,
-- createAdjustment, deleteAdjustment), src/routes/tutor.ts (~L921/L1000-1100:
-- tutors read their OWN invoices/invoice_lines/adjustments unredacted).
--
-- This lands FULLY BUILT BUT UNUSED, same pattern as the sessions migration.
-- Explicitly deferred to later phases:
--   * Real data backfill from the Prisma pay_periods/adjustments/invoices/
--     invoice_lines tables.
--   * Frontend repoint (admin AdminPayrollRoute/AdminPaymentsRoute /
--     adminPayrollRepository and the tutor invoice-viewing routes still call the
--     Fastify lms-api routes; this task does not touch src/ or lms-api/).
--   * Invoice PDF/HTML rendering (lms-api/src/lib/invoices.js buildInvoicePdf /
--     renderInvoiceHtml -- presentation logic for a later frontend-repoint pass,
--     deliberately NOT replicated here).
--   * Retirement of the Fastify payroll routes.
--
-- Also closes the loop opened by the sessions migration: the
-- session_date_pay_period_locked() stub above is now the real pay_periods lock
-- lookup (see its comment).
--
-- NOTE on org-scoping: NO organization_id on any of these four tables. This is
-- deliberate -- MULTI_ORG_MODEL_PLAN.md §9 explicitly defers finance-table
-- org-scoping as backend-only follow-on work, not required now.
-- ============================================================================

-- Lowercase to match this schema's enum convention (record_status,
-- session_status, ...), even though Prisma's were uppercase.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'pay_period_status') then
    create type public.pay_period_status as enum ('open', 'locked');
  end if;
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type public.invoice_status as enum ('draft', 'issued', 'paid');
  end if;
  if not exists (select 1 from pg_type where typname = 'adjustment_type') then
    create type public.adjustment_type as enum ('bonus', 'correction', 'penalty');
  end if;
  if not exists (select 1 from pg_type where typname = 'adjustment_status') then
    create type public.adjustment_status as enum ('draft', 'approved');
  end if;
  if not exists (select 1 from pg_type where typname = 'invoice_line_type') then
    create type public.invoice_line_type as enum ('session', 'adjustment');
  end if;
end
$$;

-- pay_periods: one row per Monday-start payroll week. period_start_date is UNIQUE
-- (mirrors Prisma @@unique([periodStartDate])) and is the get-or-create key.
-- locked_by references profiles(id) (Prisma's locked_by_user_id pointed at the
-- retired users table; the Supabase actor identity is profiles).
create table if not exists public.pay_periods (
  id uuid primary key default gen_random_uuid(),
  period_start_date date not null unique,
  period_end_date date not null,
  status public.pay_period_status not null default 'open',
  locked_at timestamptz,
  locked_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

-- Backfill for a database where this table was partially created by an
-- earlier, interrupted migration attempt (same reasoning as the
-- assignment_submissions backfill elsewhere in this file).
alter table public.pay_periods add column if not exists locked_by uuid references public.profiles(id);
alter table public.pay_periods add column if not exists created_at timestamptz not null default now();

-- adjustments: admin-created-and-approved-in-one-step signed corrections to a
-- tutor's pay for a period. `amount` is always a positive magnitude (check
-- amount > 0, mirroring Fastify's Zod .positive()); the sign is applied at
-- read/invoice-generation time by the bonus/correction/penalty logic (Fastify's
-- getSignedAmount). status defaults 'approved' -- the 'draft' enum value exists
-- for Prisma parity but no current write path uses it (do not invent a
-- draft-approval workflow). created_by/approved_by/voided_by reference profiles.
create table if not exists public.adjustments (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id),
  pay_period_id uuid not null references public.pay_periods(id),
  type public.adjustment_type not null,
  amount numeric(12, 2) not null check (amount > 0),
  reason text not null,
  status public.adjustment_status not null default 'approved',
  created_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  voided_at timestamptz,
  voided_by uuid references public.profiles(id),
  void_reason text,
  related_session_id uuid references public.sessions(id)
);

-- Backfill for a database where this table was partially created by an
-- earlier, interrupted migration attempt (same reasoning as the
-- assignment_submissions backfill elsewhere in this file). created_by is
-- safe as NOT NULL with no default because this table has no frontend yet
-- and no real rows.
alter table public.adjustments add column if not exists approved_by uuid references public.profiles(id);
alter table public.adjustments add column if not exists voided_by uuid references public.profiles(id);
alter table public.adjustments add column if not exists created_by uuid not null references public.profiles(id);

-- invoices: one per tutor per generated payroll week. invoice_number is UNIQUE
-- and follows the exact Fastify format 'INV-' || weekStart-no-dashes || '-' ||
-- first-8-of-tutor-id. Generation writes status = 'issued'.
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id),
  period_start date not null,
  period_end date not null,
  invoice_number text not null unique,
  total_amount numeric(12, 2) not null,
  status public.invoice_status not null default 'draft',
  created_at timestamptz not null default now()
);

-- invoice_lines: SESSION lines (minutes/60 * rate) or ADJUSTMENT lines (signed
-- amount, minutes = rate = 0). A tutor reads these unredacted for their own
-- invoices (description/minutes/rate/amount is exactly what a tutor should see
-- about their own pay).
create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id),
  session_id uuid references public.sessions(id),
  adjustment_id uuid references public.adjustments(id),
  line_type public.invoice_line_type not null default 'session',
  description text not null,
  minutes int not null,
  rate numeric(12, 2) not null,
  amount numeric(12, 2) not null
);

create index if not exists idx_adjustments_tutor_pay_period on public.adjustments(tutor_id, pay_period_id);
create index if not exists idx_adjustments_pay_period on public.adjustments(pay_period_id);
create index if not exists idx_invoices_tutor_period_start on public.invoices(tutor_id, period_start);
create index if not exists idx_invoice_lines_invoice on public.invoice_lines(invoice_id);
create index if not exists idx_invoice_lines_session on public.invoice_lines(session_id);
create index if not exists idx_invoice_lines_adjustment on public.invoice_lines(adjustment_id);

alter table public.pay_periods enable row level security;
alter table public.adjustments enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;

-- --- Finance RLS: all writes via the SECURITY DEFINER RPCs below --------------
-- Design choice: this domain follows the `sessions` precedent (no direct
-- INSERT/UPDATE/DELETE grantable to ANYONE, admin included -- writes go
-- exclusively through the RPCs so the get-or-create / lock / void precondition
-- logic can never be bypassed) rather than the plain "admin manage" precedent.
-- Reason: every write here has real business-rule preconditions worth
-- centralising (period lock checks, invoice-already-generated guards, pending
-- sessions, signed-amount math), exactly like sessions. SELECT is scoped: admin
-- sees all; a tutor sees only their OWN adjustments/invoices/invoice_lines,
-- unredacted (confirmed against src/routes/tutor.ts -- the line fields
-- description/minutes/rate/amount and adjustment type/amount/reason are exactly
-- what a tutor should see about their own pay). No student policy anywhere:
-- students never see tutor pay. pay_periods has NO tutor policy at all -- it is
-- admin-only end to end.

-- pay_periods: admin-only SELECT; no direct writes by anyone.
drop policy if exists "admin_select_pay_periods" on public.pay_periods;
create policy "admin_select_pay_periods"
on public.pay_periods for select
using (public.is_platform_admin());

drop policy if exists "pay_periods_no_direct_insert" on public.pay_periods;
create policy "pay_periods_no_direct_insert"
on public.pay_periods for insert
with check (false);

drop policy if exists "pay_periods_no_direct_update" on public.pay_periods;
create policy "pay_periods_no_direct_update"
on public.pay_periods for update
using (false)
with check (false);

drop policy if exists "pay_periods_no_direct_delete" on public.pay_periods;
create policy "pay_periods_no_direct_delete"
on public.pay_periods for delete
using (false);

-- adjustments: admin SELECT all; tutor SELECT own; no direct writes by anyone.
drop policy if exists "admin_select_all_adjustments" on public.adjustments;
create policy "admin_select_all_adjustments"
on public.adjustments for select
using (public.is_platform_admin());

drop policy if exists "tutors_select_own_adjustments" on public.adjustments;
create policy "tutors_select_own_adjustments"
on public.adjustments for select
using (tutor_id = public.current_tutor_id());

drop policy if exists "adjustments_no_direct_insert" on public.adjustments;
create policy "adjustments_no_direct_insert"
on public.adjustments for insert
with check (false);

drop policy if exists "adjustments_no_direct_update" on public.adjustments;
create policy "adjustments_no_direct_update"
on public.adjustments for update
using (false)
with check (false);

drop policy if exists "adjustments_no_direct_delete" on public.adjustments;
create policy "adjustments_no_direct_delete"
on public.adjustments for delete
using (false);

-- invoices: admin SELECT all; tutor SELECT own; no direct writes by anyone.
drop policy if exists "admin_select_all_invoices" on public.invoices;
create policy "admin_select_all_invoices"
on public.invoices for select
using (public.is_platform_admin());

drop policy if exists "tutors_select_own_invoices" on public.invoices;
create policy "tutors_select_own_invoices"
on public.invoices for select
using (tutor_id = public.current_tutor_id());

drop policy if exists "invoices_no_direct_insert" on public.invoices;
create policy "invoices_no_direct_insert"
on public.invoices for insert
with check (false);

drop policy if exists "invoices_no_direct_update" on public.invoices;
create policy "invoices_no_direct_update"
on public.invoices for update
using (false)
with check (false);

drop policy if exists "invoices_no_direct_delete" on public.invoices;
create policy "invoices_no_direct_delete"
on public.invoices for delete
using (false);

-- invoice_lines: admin SELECT all; tutor SELECT own via the parent invoice's
-- tutor_id; no direct writes by anyone.
drop policy if exists "admin_select_all_invoice_lines" on public.invoice_lines;
create policy "admin_select_all_invoice_lines"
on public.invoice_lines for select
using (public.is_platform_admin());

drop policy if exists "tutors_select_own_invoice_lines" on public.invoice_lines;
create policy "tutors_select_own_invoice_lines"
on public.invoice_lines for select
using (exists (
  select 1 from public.invoices i
  where i.id = invoice_lines.invoice_id
    and i.tutor_id = public.current_tutor_id()
));

drop policy if exists "invoice_lines_no_direct_insert" on public.invoice_lines;
create policy "invoice_lines_no_direct_insert"
on public.invoice_lines for insert
with check (false);

drop policy if exists "invoice_lines_no_direct_update" on public.invoice_lines;
create policy "invoice_lines_no_direct_update"
on public.invoice_lines for update
using (false)
with check (false);

drop policy if exists "invoice_lines_no_direct_delete" on public.invoice_lines;
create policy "invoice_lines_no_direct_delete"
on public.invoice_lines for delete
using (false);

-- --- Payroll business-logic RPCs (all SECURITY DEFINER, admin-gated) ----------

-- get_or_create_pay_period: port of internal.ts getOrCreatePayPeriod. Idempotent
-- get-or-create keyed on period_start_date; period_end_date is week-start + 6
-- (Monday..Sunday). Returns the (possibly pre-existing) row.
create or replace function public.get_or_create_pay_period(p_period_start_date date)
returns public.pay_periods
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.pay_periods;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.pay_periods (period_start_date, period_end_date, status)
  values (p_period_start_date, p_period_start_date + 6, 'open')
  on conflict (period_start_date) do nothing;

  select * into v_period
  from public.pay_periods
  where period_start_date = p_period_start_date;

  return v_period;
end;
$$;

-- generate_payroll_week: port of service.ts generatePayrollWeek +
-- internal.ts generateInvoicesForWeek. Refuses if invoices already exist for the
-- period-start ('invoices_already_generated') or the pay period is locked
-- ('pay_period_locked'). For every tutor with an APPROVED session or an
-- APPROVED/non-voided adjustment in the week, builds session-lines
-- (amount = duration_minutes / 60.0 * coalesce(allocation.rate_override,
-- tutor.hourly_rate)) and adjustment-lines (signed: penalty negative, else
-- positive), sums to total_amount, and inserts one 'issued' invoice + its lines.
-- The whole body is one implicit transaction (no explicit BEGIN/COMMIT needed
-- inside plpgsql, unlike the Fastify version which manages its own transaction).
-- NOTE: the tutor-selection predicate already guarantees each tutor reaching the
-- loop has >= 1 session or adjustment (and every APPROVED session yields exactly
-- one line -- sessions.tutor_student_allocation_id / student_id are NOT NULL, so
-- the joins never drop it), so Fastify's defensive zero-line `continue` cannot
-- fire here and is intentionally not replicated as a dead branch.
create or replace function public.generate_payroll_week(p_week_start date)
returns setof public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_end date := p_week_start + 6;
  v_period public.pay_periods;
  v_tutor record;
  v_line record;
  v_adj record;
  v_invoice public.invoices;
  v_invoice_number text;
  v_total numeric(12, 2);
  v_amount numeric(12, 2);
  v_signed numeric(12, 2);
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if exists (select 1 from public.invoices where period_start = p_week_start) then
    raise exception 'invoices_already_generated' using errcode = '23505';
  end if;

  v_period := public.get_or_create_pay_period(p_week_start);
  if v_period.status = 'locked' then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  for v_tutor in
    select distinct t.id as tutor_id, t.hourly_rate
    from public.tutors t
    where exists (
      select 1 from public.sessions s
      where s.tutor_id = t.id
        and s.status = 'approved'
        and s.date between p_week_start and v_week_end
    )
    or exists (
      select 1 from public.adjustments a
      where a.tutor_id = t.id
        and a.pay_period_id = v_period.id
        and a.status = 'approved'
        and a.voided_at is null
    )
  loop
    v_total := 0;
    -- Exact Fastify invoice-number format:
    -- `INV-${weekStart.replaceAll('-', '')}-${tutorId.slice(0, 8)}`.
    v_invoice_number := 'INV-' || replace(p_week_start::text, '-', '') || '-' || substr(v_tutor.tutor_id::text, 1, 8);

    insert into public.invoices (tutor_id, period_start, period_end, invoice_number, total_amount, status)
    values (v_tutor.tutor_id, p_week_start, v_week_end, v_invoice_number, 0, 'issued')
    returning * into v_invoice;

    for v_line in
      select s.id as session_id,
             s.duration_minutes,
             s.date,
             s.start_time,
             s.end_time,
             coalesce(alloc.rate_override, v_tutor.hourly_rate) as rate,
             pr.full_name as student_name,
             subj.name as subject_name
      from public.sessions s
      join public.tutor_student_allocations alloc on alloc.id = s.tutor_student_allocation_id
      join public.students st on st.id = s.student_id
      join public.profiles pr on pr.id = st.profile_id
      left join public.subjects subj on subj.id = alloc.subject_id
      where s.tutor_id = v_tutor.tutor_id
        and s.status = 'approved'
        and s.date between p_week_start and v_week_end
      order by s.date asc, s.start_time asc
    loop
      v_amount := (v_line.duration_minutes / 60.0) * v_line.rate;
      v_total := v_total + v_amount;
      insert into public.invoice_lines
        (invoice_id, session_id, adjustment_id, line_type, description, minutes, rate, amount)
      values (
        v_invoice.id, v_line.session_id, null, 'session',
        coalesce(v_line.subject_name, 'Session') || ' - ' || coalesce(v_line.student_name, 'Student')
          || ' (' || v_line.date::text || ' ' || v_line.start_time::text || '-' || v_line.end_time::text || ')',
        v_line.duration_minutes, v_line.rate, v_amount
      );
    end loop;

    for v_adj in
      select a.id, a.type, a.amount, a.reason
      from public.adjustments a
      where a.tutor_id = v_tutor.tutor_id
        and a.pay_period_id = v_period.id
        and a.status = 'approved'
        and a.voided_at is null
      order by a.created_at asc
    loop
      -- getSignedAmount: PENALTY -> negative, else positive (stored amount is
      -- always a positive magnitude).
      v_signed := case when v_adj.type = 'penalty' then -abs(v_adj.amount) else abs(v_adj.amount) end;
      v_total := v_total + v_signed;
      insert into public.invoice_lines
        (invoice_id, session_id, adjustment_id, line_type, description, minutes, rate, amount)
      values (
        v_invoice.id, null, v_adj.id, 'adjustment',
        'Adjustment (' || v_adj.type::text || '): ' || v_adj.reason,
        0, 0, v_signed
      );
    end loop;

    update public.invoices set total_amount = v_total where id = v_invoice.id;
    v_invoice.total_amount := v_total;
    return next v_invoice;
  end loop;

  return;
end;
$$;

-- lock_pay_period: port of service.ts lockPayPeriod. Refuses if already locked
-- ('pay_period_locked'); refuses if any session in the week is still 'submitted'
-- ('pending_sessions'); generates invoices first if none exist yet for the
-- period (delegates to generate_payroll_week -- the algorithm is NOT duplicated);
-- then flips status to 'locked' with locked_at/locked_by.
create or replace function public.lock_pay_period(p_week_start date)
returns public.pay_periods
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.pay_periods;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_period := public.get_or_create_pay_period(p_week_start);

  if v_period.status = 'locked' then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.sessions
    where status = 'submitted'
      and date between p_week_start and p_week_start + 6
  ) then
    raise exception 'pending_sessions' using errcode = '42501';
  end if;

  if not exists (select 1 from public.invoices where period_start = p_week_start) then
    perform public.generate_payroll_week(p_week_start);
  end if;

  update public.pay_periods
  set status = 'locked', locked_at = now(), locked_by = public.current_profile_id()
  where period_start_date = p_week_start
  returning * into v_period;

  return v_period;
end;
$$;

-- create_adjustment: port of service.ts createAdjustment. Validates the tutor
-- exists ('tutor_not_found'); if a related session is given, validates it
-- belongs to that tutor AND falls within the week ('related_session_invalid');
-- gets-or-creates the pay period; inserts as 'approved' immediately with
-- created_by = approved_by = current_profile_id(), approved_at = now(). This
-- codebase's adjustments are always admin-created-and-approved-in-one-step; the
-- 'draft' status is never written by any path.
create or replace function public.create_adjustment(
  p_tutor_id uuid,
  p_type public.adjustment_type,
  p_amount numeric,
  p_reason text,
  p_related_session_id uuid,
  p_week_start date
)
returns public.adjustments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.pay_periods;
  v_adj public.adjustments;
  v_profile uuid := public.current_profile_id();
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.tutors where id = p_tutor_id) then
    raise exception 'tutor_not_found' using errcode = 'P0002';
  end if;

  if p_related_session_id is not null then
    if not exists (
      select 1 from public.sessions
      where id = p_related_session_id
        and tutor_id = p_tutor_id
        and date between p_week_start and p_week_start + 6
    ) then
      raise exception 'related_session_invalid' using errcode = '23514';
    end if;
  end if;

  v_period := public.get_or_create_pay_period(p_week_start);

  insert into public.adjustments
    (tutor_id, pay_period_id, type, amount, reason, status, created_by, approved_by, approved_at, related_session_id)
  values
    (p_tutor_id, v_period.id, p_type, p_amount, p_reason, 'approved', v_profile, v_profile, now(), p_related_session_id)
  returning * into v_adj;

  return v_adj;
end;
$$;

-- void_adjustment: port of service.ts deleteAdjustment (it is a SOFT-void, not a
-- hard delete -- hence the name). Raises 'adjustment_not_found' if missing;
-- 'pay_period_locked' if the linked pay period is locked (Fastify checks
-- p.status from the adjustments-join-pay_periods query -- this IS the pay
-- period's lock status, correct despite the confusingly-named destructured
-- field in the source); 'adjustment_already_voided' if voided_at is already set.
-- Otherwise stamps voided_at/voided_by/void_reason (defaulting the reason to
-- 'deleted_by_admin', matching Fastify).
create or replace function public.void_adjustment(p_adjustment_id uuid, p_reason text)
returns public.adjustments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_adj public.adjustments;
  v_period_status public.pay_period_status;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_adj from public.adjustments where id = p_adjustment_id;
  if not found then
    raise exception 'adjustment_not_found' using errcode = 'P0002';
  end if;

  select status into v_period_status from public.pay_periods where id = v_adj.pay_period_id;
  if v_period_status = 'locked' then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  if v_adj.voided_at is not null then
    raise exception 'adjustment_already_voided' using errcode = '42501';
  end if;

  update public.adjustments
  set voided_at = now(),
      voided_by = public.current_profile_id(),
      void_reason = coalesce(p_reason, 'deleted_by_admin')
  where id = p_adjustment_id
  returning * into v_adj;

  return v_adj;
end;
$$;

-- --- Grants: the payroll RPCs are callable by authenticated; each self-gates on
-- is_platform_admin() internally (Fastify's routes are all admin-only). Direct
-- table writes remain closed to everyone (RLS above), so these RPCs are the only
-- payroll write path. session_date_pay_period_locked needs no grant (it is
-- called internally by the session RPCs, never directly by a client).
grant execute on function public.get_or_create_pay_period(date) to authenticated;
grant execute on function public.generate_payroll_week(date) to authenticated;
grant execute on function public.lock_pay_period(date) to authenticated;
grant execute on function public.create_adjustment(uuid, public.adjustment_type, numeric, text, uuid, date) to authenticated;
grant execute on function public.void_adjustment(uuid, text) to authenticated;

-- ============================================================================
-- Weekly reports + student notifications migration
-- (PRISMA_TO_SUPABASE_MIGRATION_PLAN.md §4/§6 step 4).
--
-- Ports the Prisma `WeeklyReport` model and the raw-migration
-- `student_notifications` table into a Supabase-native schema + RLS + SECURITY
-- DEFINER RPC layer, and CLOSES THE NOTIFICATION-DISPATCH LOOP the sessions
-- migration deliberately left open: submit_session_report / submit_session /
-- approve_session / reject_session now fire their student notifications (the
-- gap-2 `-- Notification dispatch deferred` comments above are replaced with real
-- create_student_notification calls). Sequenced after sessions + finance because
-- the report payload derives from APPROVED sessions and the notifications wire
-- into the already-landed session RPCs.
--
-- Source of truth ported from lms-api: prisma/schema.prisma (WeeklyReport ~L465),
-- prisma/migrations/20260524_student_notifications/migration.sql (the ONLY shape
-- source for student_notifications -- it was never in schema.prisma),
-- src/lib/notifications.ts (create/list/count/mark-read/mark-all helpers),
-- src/routes/academic.ts (getWeekRange, buildWeeklyReportPayload,
-- userCanAccessStudent, POST /reports/generate, GET /reports, the student
-- /student/notifications read + mark-read routes), src/routes/tutor.ts &
-- src/routes/admin.ts (the four session-notification call-sites now wired in).
--
-- This lands FULLY BUILT BUT UNUSED, same pattern as the sessions/finance
-- migrations. Explicitly deferred to later phases:
--   * Real data backfill from the Prisma weekly_reports/student_notifications
--     tables (schema-only; no rows moved).
--   * Frontend repoint (student dashboard / reports UI and the tutor/admin report
--     triggers still call the Fastify lms-api routes; this task does not touch
--     src/ or lms-api/).
--   * Retirement of the Fastify report/notification routes (Fastify-stack removal
--     step, §6 step 7).
--
-- DELIBERATE OMISSION -- streak/xp gamification: Fastify's buildWeeklyReportPayload
-- pulls a streakSummary (current/longest streak, xp) from a `study_streaks` table.
-- Gamification (StudyActivityEvent / StudyStreak) was CUT from this migration's
-- scope by the owner-locked plan (§3C's draft "Gamification" migrate-bullet was
-- replaced with "Growth monitoring / risk ... KEEP"; §3D cuts the rest). So the
-- Supabase payload OMITS metrics.streak/longestStreak/xp entirely and NO
-- study_streaks table exists or should be created. This is intentional, not a gap.
--
-- FORWARD-DESIGN ADDITION -- guardian read: the plan §4 calls for weekly_reports
-- "student/guardian read released", but the current Fastify /reports routes have
-- no guardian branch. The guardian SELECT policy below implements that forward
-- target by reusing get_parent_progress_reports()'s exact gating shape -- it is a
-- deliberate forward-design addition, not a literal Fastify port.
--
-- NOTE on org-scoping: NO organization_id on either table, matching the task's
-- explicit schema design and the finance-table precedent (org derives from the
-- student; direct org-scoping of these tables is not required now). Follows the
-- same conscious deferral the finance section documents.
-- ============================================================================

-- weekly_reports: one report per student per Monday-Sunday week. student_id
-- replaces Prisma's polymorphic user_id (a weekly report only ever belongs to a
-- student; Supabase has no User table). created_by is the optional generator,
-- renamed from Prisma's created_by_user_id per this schema's actor-column
-- convention (created_by/approved_by/voided_by, no _user_id suffix). payload_json
-- is the computed report body (see generate_weekly_report). All writes go through
-- that RPC -- there is no direct-write path.
create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  payload_json jsonb not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (student_id, week_start, week_end)
);

-- Backfill for a database where this table was partially created by an
-- earlier, interrupted migration attempt (same reasoning as the
-- assignment_submissions backfill elsewhere in this file). Safe as NOT NULL
-- with no default because this table has no frontend yet and no real rows.
-- The unique constraint is also re-added here since it was only ever defined
-- inline in CREATE TABLE, which is a no-op against a pre-existing table.
alter table public.weekly_reports add column if not exists created_by uuid references public.profiles(id);
alter table public.weekly_reports add column if not exists student_id uuid not null references public.students(id) on delete cascade;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'weekly_reports_student_id_week_start_week_end_key') then
    alter table public.weekly_reports add constraint weekly_reports_student_id_week_start_week_end_key unique (student_id, week_start, week_end);
  end if;
end
$$;

create index if not exists idx_weekly_reports_student_created on public.weekly_reports(student_id, created_at desc);

-- student_notifications: faithful port of the raw Prisma migration
-- 20260524_student_notifications (never in schema.prisma). Only adaptation:
-- created_by_user_id -> created_by uuid references profiles(id) (actor-column
-- convention; the retired users table has no Supabase home). metadata_json keeps
-- its jsonb default '{}'. Same two indexes as the source migration. All writes go
-- through the RPCs below.
create table if not exists public.student_notifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  link text,
  entity_type text,
  entity_id uuid,
  metadata_json jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backfill for a database where this table was partially created by an
-- earlier, interrupted migration attempt (same reasoning as the
-- assignment_submissions backfill elsewhere in this file).
alter table public.student_notifications add column if not exists created_by uuid references public.profiles(id);

create index if not exists idx_student_notifications_student_created on public.student_notifications(student_id, created_at desc);
create index if not exists idx_student_notifications_student_read on public.student_notifications(student_id, is_read, created_at desc);

alter table public.weekly_reports enable row level security;
alter table public.student_notifications enable row level security;

-- --- weekly_reports RLS -------------------------------------------------------
-- SELECT for: admin (all), the owning student, an ACTIVE-allocation tutor, and a
-- report-enabled guardian. NO direct INSERT/UPDATE/DELETE for anyone -- generation
-- (permission check + payload compute + upsert + notification) is real business
-- logic and runs only through generate_weekly_report(), following the
-- sessions/finance no-direct-writes precedent. (The plan's "tutor/admin manage"
-- is realised as manage-via-RPC, not a direct-write policy.)
drop policy if exists "admin_select_all_weekly_reports" on public.weekly_reports;
create policy "admin_select_all_weekly_reports"
on public.weekly_reports for select
using (public.is_platform_admin());

drop policy if exists "student_select_own_weekly_reports" on public.weekly_reports;
create policy "student_select_own_weekly_reports"
on public.weekly_reports for select
using (student_id = public.current_student_id());

drop policy if exists "tutor_select_allocated_weekly_reports" on public.weekly_reports;
create policy "tutor_select_allocated_weekly_reports"
on public.weekly_reports for select
using (exists (
  select 1 from public.tutor_student_allocations tsa
  where tsa.student_id = weekly_reports.student_id
    and tsa.tutor_id = public.current_tutor_id()
    and tsa.status = 'active'
));

-- Guardian read: reuses get_parent_progress_reports()'s exact gating shape
-- (parent role + active guardian link with can_receive_reports). Forward-design
-- implementation of the plan §4 "student/guardian read released" target.
drop policy if exists "guardian_select_reportable_weekly_reports" on public.weekly_reports;
create policy "guardian_select_reportable_weekly_reports"
on public.weekly_reports for select
using (
  public.current_profile_role() = 'parent'
  and exists (
    select 1
    from public.guardians g
    join public.student_guardians sg on sg.guardian_id = g.id
    where sg.student_id = weekly_reports.student_id
      and g.profile_id = public.current_profile_id()
      and g.status = 'active'
      and sg.status = 'active'
      and sg.can_receive_reports = true
  )
);

drop policy if exists "weekly_reports_no_direct_insert" on public.weekly_reports;
create policy "weekly_reports_no_direct_insert"
on public.weekly_reports for insert
with check (false);

drop policy if exists "weekly_reports_no_direct_update" on public.weekly_reports;
create policy "weekly_reports_no_direct_update"
on public.weekly_reports for update
using (false)
with check (false);

drop policy if exists "weekly_reports_no_direct_delete" on public.weekly_reports;
create policy "weekly_reports_no_direct_delete"
on public.weekly_reports for delete
using (false);

-- --- student_notifications RLS ------------------------------------------------
-- A student SELECTs only their own. NO admin/tutor/guardian read policy: Fastify
-- exposes notifications solely via the student /student/notifications routes
-- (there is no admin notifications-viewing route), so broader visibility is
-- deliberately NOT invented. NO direct writes: create is an internal SECURITY
-- DEFINER helper; mark-read / mark-all-read go through their RPCs (this schema
-- routes every state-changing write through an RPC -- even a simple owner-scoped
-- mark-read -- for convention consistency with sessions/finance).
drop policy if exists "student_select_own_notifications" on public.student_notifications;
create policy "student_select_own_notifications"
on public.student_notifications for select
using (student_id = public.current_student_id());

drop policy if exists "student_notifications_no_direct_insert" on public.student_notifications;
create policy "student_notifications_no_direct_insert"
on public.student_notifications for insert
with check (false);

drop policy if exists "student_notifications_no_direct_update" on public.student_notifications;
create policy "student_notifications_no_direct_update"
on public.student_notifications for update
using (false)
with check (false);

drop policy if exists "student_notifications_no_direct_delete" on public.student_notifications;
create policy "student_notifications_no_direct_delete"
on public.student_notifications for delete
using (false);

-- --- Reports/notifications business-logic RPCs (all SECURITY DEFINER) ---------

-- create_student_notification: internal helper mirroring insert_session_history's
-- lockdown (execute revoked from public/anon/authenticated below -- only other
-- SECURITY DEFINER functions call it: generate_weekly_report and the four session
-- RPCs). created_by is always the acting profile (current_profile_id()), never a
-- client-supplied id.
create or replace function public.create_student_notification(
  p_student_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.student_notifications (
    student_id, type, title, body, link, entity_type, entity_id, metadata_json, created_by
  )
  values (
    p_student_id, p_type, p_title, p_body, p_link, p_entity_type, p_entity_id,
    coalesce(p_metadata, '{}'::jsonb), public.current_profile_id()
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- generate_weekly_report: port of buildWeeklyReportPayload + POST /reports/generate.
-- Permission-gates via the ported userCanAccessStudent logic (admin always; the
-- student themself; a tutor iff an ACTIVE tutor_student_allocations link);
-- normalises p_week_start to its Monday (date_trunc('week', ...) -- exactly
-- getWeekRange's ISO-Monday math, the established pattern shared with
-- session_date_pay_period_locked) and week_end = Monday + 6; builds the payload
-- as jsonb; upserts on (student_id, week_start, week_end); fires the
-- weekly_report_ready notification; returns the row. Raises 'forbidden' if the
-- permission check fails, 'student_not_found' if the student is missing.
create or replace function public.generate_weekly_report(p_student_id uuid, p_week_start date)
returns public.weekly_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date := date_trunc('week', p_week_start::timestamp)::date;
  v_week_end date := date_trunc('week', p_week_start::timestamp)::date + 6;
  v_student_name text;
  v_student_grade text;
  v_attended int;
  v_minutes int;
  v_notes_summary jsonb;
  v_topic_progress jsonb;
  v_weak_topic text;
  v_weak_completion int;
  v_goals jsonb;
  v_payload jsonb;
  v_report public.weekly_reports;
begin
  -- Permission gate (ported userCanAccessStudent). Non-tutors get null from
  -- current_tutor_id(), so the tutor branch never matches for them; likewise
  -- current_student_id() is null for non-students. FIX (real bug, found via
  -- direct testing, not a design choice): Postgres's IF treats a NULL
  -- condition as false, so `if not (A or B or C)` where the OR-chain itself
  -- evaluates to NULL (is_platform_admin() false, current_student_id() null
  -- for a non-student, exists(...) false) skips the raise entirely --
  -- silently ALLOWING an unrelated caller instead of denying them. coalesce
  -- forces the whole expression to a real boolean before negating it.
  if not coalesce(
    public.is_platform_admin()
    or public.current_student_id() = p_student_id
    or exists (
      select 1 from public.tutor_student_allocations tsa
      where tsa.tutor_id = public.current_tutor_id()
        and tsa.student_id = p_student_id
        and tsa.status = 'active'
    ),
    false
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Student name lives on profiles (students has no name column); grade on students.
  select pr.full_name, st.grade
    into v_student_name, v_student_grade
  from public.students st
  join public.profiles pr on pr.id = st.profile_id
  where st.id = p_student_id;
  if not found then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;

  -- metrics.sessionsAttended / timeStudiedMinutes: APPROVED sessions in the week.
  select
    coalesce(count(*) filter (where status = 'approved'), 0)::int,
    coalesce(sum(duration_minutes) filter (where status = 'approved'), 0)::int
    into v_attended, v_minutes
  from public.sessions
  where student_id = p_student_id
    and date between v_week_start and v_week_end;

  -- tutorNotesSummary: up to 3 most-recent session notes in the week, each
  -- truncated to 120 chars (Fastify left(notes,120), newest-first, first 3).
  select coalesce(jsonb_agg(sub.line order by sub.rn), '[]'::jsonb)
    into v_notes_summary
  from (
    select left(btrim(s.notes), 120) as line,
           row_number() over (order by s.date desc) as rn
    from public.sessions s
    where s.student_id = p_student_id
      and s.date between v_week_start and v_week_end
      and nullif(btrim(coalesce(s.notes, '')), '') is not null
  ) sub
  where sub.rn <= 3;

  -- topicProgress: rebuilt against student_progress (plan §4 directive: "Rebuild
  -- buildWeeklyReportPayload against Supabase sessions/student_progress/..."),
  -- grouped by subject/topic with a completion-percent heuristic (avg score,
  -- already a 0-100 percent, clamped). Streak/xp are DELIBERATELY absent from the
  -- payload -- see the section header: the streak/xp gamification tables were cut
  -- from scope by the locked plan and must NOT be reintroduced here.
  select coalesce(
    jsonb_agg(
      jsonb_build_object('subject', t.subject, 'topic', t.topic, 'completion', t.completion)
      order by t.completion asc, t.topic asc
    ),
    '[]'::jsonb
  )
    into v_topic_progress
  from (
    select coalesce(subj.name, 'General') as subject,
           sp.topic,
           greatest(0, least(100, round(avg(sp.score))))::int as completion
    from public.student_progress sp
    left join public.subjects subj on subj.id = sp.subject_id
    where sp.student_id = p_student_id
    group by coalesce(subj.name, 'General'), sp.topic
  ) t;

  -- goalsNextWeek: derived from the weakest topic (lowest completion), matching
  -- Fastify's weakest-topic goal string; generic fallback when no progress rows.
  select t.topic, t.completion
    into v_weak_topic, v_weak_completion
  from (
    select sp.topic,
           greatest(0, least(100, round(avg(sp.score))))::int as completion
    from public.student_progress sp
    left join public.subjects subj on subj.id = sp.subject_id
    where sp.student_id = p_student_id
    group by coalesce(subj.name, 'General'), sp.topic
  ) t
  order by t.completion asc, t.topic asc
  limit 1;

  if v_weak_topic is not null then
    v_goals := jsonb_build_array(
      'Lift ' || v_weak_topic || ' to at least ' || least(100, v_weak_completion + 15)::text || '% mastery.'
    );
  else
    v_goals := jsonb_build_array('Complete at least one focused practice session.');
  end if;

  -- Assemble the payload. metrics INTENTIONALLY has only sessionsAttended +
  -- timeStudiedMinutes -- streak/longestStreak/xp are omitted (cut per the locked
  -- plan, see section header). Do not "restore" them.
  v_payload := jsonb_build_object(
    'student', jsonb_build_object('id', p_student_id, 'name', v_student_name, 'grade', v_student_grade),
    'week', jsonb_build_object('start', v_week_start::text, 'end', v_week_end::text),
    'metrics', jsonb_build_object('sessionsAttended', v_attended, 'timeStudiedMinutes', v_minutes),
    'topicProgress', v_topic_progress,
    'tutorNotesSummary', v_notes_summary,
    'goalsNextWeek', v_goals
  );

  insert into public.weekly_reports (student_id, week_start, week_end, payload_json, created_by)
  values (p_student_id, v_week_start, v_week_end, v_payload, public.current_profile_id())
  on conflict (student_id, week_start, week_end)
  do update set payload_json = excluded.payload_json,
                created_by = excluded.created_by,
                created_at = now()
  returning * into v_report;

  -- weekly_report_ready notification (Fastify POST /reports/generate side effect).
  perform public.create_student_notification(
    p_student_id,
    'weekly_report_ready',
    'Weekly report ready',
    'Your report for ' || v_week_start::text || ' to ' || v_week_end::text || ' is now available.',
    '/reports/',
    'weekly_report',
    v_report.id,
    '{}'::jsonb
  );

  return v_report;
end;
$$;

-- mark_notification_read: port of markStudentNotificationRead + the
-- /student/notifications/:id/read route. Owner-scoped (student_id =
-- current_student_id()); sets is_read = true, read_at = coalesce(read_at, now()),
-- updated_at = now(). Raises 'notification_not_found' when no owned row matches
-- (Fastify's rowCount === 0 -> 404 notification_not_found).
create or replace function public.mark_notification_read(p_notification_id uuid)
returns public.student_notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.student_notifications;
begin
  update public.student_notifications
  set is_read = true,
      read_at = coalesce(read_at, now()),
      updated_at = now()
  where id = p_notification_id
    and student_id = public.current_student_id()
  returning * into v_row;
  if not found then
    raise exception 'notification_not_found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- mark_all_notifications_read: port of markAllStudentNotificationsRead + the
-- /student/notifications/read-all route. Owner-scoped bulk update over the
-- caller's unread notifications; returns the count of rows actually changed
-- (Fastify's rowCount).
create or replace function public.mark_all_notifications_read()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with updated as (
    update public.student_notifications
    set is_read = true,
        read_at = coalesce(read_at, now()),
        updated_at = now()
    where student_id = public.current_student_id()
      and is_read = false
    returning 1
  )
  select count(*)::int into v_count from updated;
  return v_count;
end;
$$;

-- --- Grants: the caller-facing RPCs are callable by authenticated (each
-- self-gates internally -- generate_weekly_report on the ported permission model,
-- the mark RPCs on current_student_id() ownership). create_student_notification
-- is locked down exactly like insert_session_history/log_audit_event: only other
-- SECURITY DEFINER functions may call it, never a client.
grant execute on function public.generate_weekly_report(uuid, date) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
revoke execute on function public.create_student_notification(uuid, text, text, text, text, text, uuid, jsonb) from public;
revoke execute on function public.create_student_notification(uuid, text, text, text, text, text, uuid, jsonb) from anon;
revoke execute on function public.create_student_notification(uuid, text, text, text, text, text, uuid, jsonb) from authenticated;

-- ============================================================================
-- TUTOR ONBOARDING / VETTING (PRISMA_TO_SUPABASE_MIGRATION_PLAN.md §4 / §6 step 6)
--
-- Ports Fastify's tutor onboarding + vetting gate -- TutorApplication /
-- TutorDocument / TutorAvailabilitySlot -- plus the richer approval/qualification
-- columns Prisma's TutorProfile carried that Supabase's minimal `tutors` table
-- lacked (plan §3A/§3C: "migrate the richer approval/qualification fields").
-- This is the trust/safety gate needed before hiring beyond family/friends.
--
-- Identity fields are deliberately NOT duplicated: Prisma TutorProfile.fullName/
-- .phone already live on public.profiles (full_name/phone). Only the genuinely
-- new approval/qualification columns are added to public.tutors here. Likewise
-- Prisma TutorProfile.active (a separate boolean) is NOT re-added: Supabase folds
-- active + status into the single record_status enum, so status = 'active' stands
-- in for Fastify's active && status === 'ACTIVE' (the same collapse the sessions
-- migration's ensureTutorActive stand-in already relies on).
--
-- Storage: Fastify wrote document bytes to local disk (uploads/tutor-documents/…);
-- Supabase has no local disk, so documents move to a PRIVATE Storage bucket
-- (`tutor-documents`) following the assignment-files/assignment-submissions
-- precedent. The tutor_documents row carries only METADATA -- the client uploads
-- bytes to Storage directly, then records the row via record_tutor_document()
-- (mirroring how assignment submissions split "upload bytes" from "record row").
--
-- Also closes the THIRD deferred loop from the sessions migration: the
-- ensureTutorActive stand-in in create_session / update_session /
-- submit_session_report / submit_session / approve_session was `status = 'active'`
-- only; it now also requires approval_status = 'approved' (full Fastify parity),
-- exactly as the finance step un-stubbed session_date_pay_period_locked and the
-- notifications step wired the deferred dispatch. See those five amended
-- functions in the sessions section above.
--
-- Deferred (NOT done here, by design): real-data backfill (including the actual
-- document files into Storage), frontend repoint (the UI still calls the Fastify
-- tutor/admin routes; a later phase calls supabase.storage.from('tutor-documents')
-- .upload(...) then record_tutor_document()), and Fastify-route retirement (§6 step 7).
-- ============================================================================

-- --- New approval/qualification columns on public.tutors --------------------
-- Additive/nullable (no backfill: no real tutor rows yet). approval_status
-- defaults to 'approved' to match Prisma (today's family/friends tutors are
-- pre-approved). No `active` column: see the header note on the active/status
-- collapse. qualified_subjects_json / teaching_preferences_json / qualification_band
-- are populated by decide_tutor_application on approval.
alter table public.tutors
  add column if not exists qualification_band text,
  add column if not exists qualified_subjects_json jsonb,
  add column if not exists approval_status text not null default 'approved',
  add column if not exists approval_reviewed_by uuid references public.profiles(id),
  add column if not exists approval_reviewed_at timestamptz,
  add column if not exists approval_note text,
  add column if not exists teaching_preferences_json jsonb;

-- The check covers BOTH vocabularies that write approval_status in Fastify: the
-- profile-level default/registration ('approved'/'pending') and the DECISION
-- values the admin cascade copies down ('under_review'/'approved'/'rejected'/
-- 'changes_requested'). The application-only states 'draft'/'submitted' never
-- reach this column, so they are intentionally excluded. Added via a guarded
-- ALTER (idempotent, matching the privacy_request_type enum guard pattern above).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tutors_approval_status_check'
  ) then
    alter table public.tutors
      add constraint tutors_approval_status_check
      check (approval_status in ('pending', 'under_review', 'approved', 'rejected', 'changes_requested'));
  end if;
end
$$;

-- SECURITY / EXPOSURE NOTE (flagged AND fixed on review -- per the task's explicit
-- instruction to verify the tutors SELECT policies rather than assume admin/self-only):
-- these new columns are governed by the EXISTING tutors row policies.
-- `tutors_select_self_or_admin` grants SELECT to (a) admins, (b) the tutor
-- themselves, AND (c) any student with an ACTIVE tutor_student_allocations link to
-- that tutor. Arm (c) means an allocated student can read their tutor's
-- approval_status / approval_note / qualification_band. approval_note in particular
-- can carry a reviewer's internal commentary about the tutor -- an approval-workflow
-- field that was admin/self-tutor-only in Fastify (ensureTutorActive read it
-- server-side; no student route ever returned it). Postgres RLS is row-level, not
-- column-level, so the existing policy cannot exclude just these columns for arm (c)
-- -- a schema-only fix is not possible here. The actual fix is at the query layer:
-- `src/features/students/studentDashboardRepository.ts` is the ONLY student-facing
-- reader of this table, and it now selects an explicit column list (the exact
-- pre-migration-safe set: id/profile_id/subjects/grades/hourly_rate/status/created_at)
-- instead of `select('*')`, so none of the seven new columns reach a student response.
-- See `tests/frontend/tutor-onboarding-migration.test.cjs` for the assertion covering
-- both halves (the RLS row-level limitation stays documented here for future
-- readers; the query-level exclusion is verified against the actual frontend file).
-- If a *second* student-facing reader of `tutors` is ever added, it must carry the
-- same explicit column list -- this is a per-query discipline, not a table-wide
-- guarantee, precisely because RLS can't enforce it structurally.

-- --- Tables -----------------------------------------------------------------
-- tutor_id -> tutors(id) on delete cascade, matching every other tutor_id FK in
-- this schema (sessions/allocations/etc.); reviewer/verifier actor columns ->
-- profiles(id) with no delete action, matching the created_by/locked_by convention.
create table if not exists public.tutor_applications (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null unique references public.tutors(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'changes_requested')),
  personal_details_json jsonb not null default '{}'::jsonb,
  subjects_json jsonb not null default '[]'::jsonb,
  grades_json jsonb not null default '[]'::jsonb,
  teaching_preferences_json jsonb not null default '[]'::jsonb,
  experience text,
  availability_notes text,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tutor_documents (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  document_type text not null check (document_type in ('identity', 'cv', 'qualification', 'additional')),
  storage_key text not null,
  original_filename text not null,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size_bytes int not null,
  uploaded_at timestamptz not null default now(),
  verification_status text not null default 'pending' check (verification_status in ('pending', 'accepted', 'rejected')),
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  notes text
);

create index if not exists idx_tutor_documents_tutor_uploaded on public.tutor_documents(tutor_id, uploaded_at desc);

create table if not exists public.tutor_availability_slots (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  mode text not null default 'online',
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tutor_availability_tutor_day_start on public.tutor_availability_slots(tutor_id, day_of_week, start_time);

alter table public.tutor_applications enable row level security;
alter table public.tutor_documents enable row level security;
alter table public.tutor_availability_slots enable row level security;

-- --- RLS: tutor_applications (tutor-own + admin SELECT; writes via RPC only) -
-- No student/parent access. Writes carry real business rules (the approved ->
-- changes_requested revert on edit; the submit-only-from-certain-statuses gate;
-- the admin decision cascade), so every write goes through a SECURITY DEFINER
-- RPC, not a direct-write policy -- following the sessions/finance/notifications
-- precedent (with check (false) / using (false)).
drop policy if exists "admin_select_all_tutor_applications" on public.tutor_applications;
create policy "admin_select_all_tutor_applications"
on public.tutor_applications for select
using (public.is_platform_admin());

drop policy if exists "tutors_select_own_application" on public.tutor_applications;
create policy "tutors_select_own_application"
on public.tutor_applications for select
using (tutor_id = public.current_tutor_id());

drop policy if exists "tutor_applications_no_direct_insert" on public.tutor_applications;
create policy "tutor_applications_no_direct_insert"
on public.tutor_applications for insert
with check (false);

drop policy if exists "tutor_applications_no_direct_update" on public.tutor_applications;
create policy "tutor_applications_no_direct_update"
on public.tutor_applications for update
using (false)
with check (false);

drop policy if exists "tutor_applications_no_direct_delete" on public.tutor_applications;
create policy "tutor_applications_no_direct_delete"
on public.tutor_applications for delete
using (false);

-- --- RLS: tutor_documents (tutor-own + admin SELECT; writes via RPC only) ----
-- Insert via record_tutor_document(), verification via verify_tutor_document();
-- no direct writes for anyone. Highly sensitive (identity/qualification files).
drop policy if exists "admin_select_all_tutor_documents" on public.tutor_documents;
create policy "admin_select_all_tutor_documents"
on public.tutor_documents for select
using (public.is_platform_admin());

drop policy if exists "tutors_select_own_documents" on public.tutor_documents;
create policy "tutors_select_own_documents"
on public.tutor_documents for select
using (tutor_id = public.current_tutor_id());

drop policy if exists "tutor_documents_no_direct_insert" on public.tutor_documents;
create policy "tutor_documents_no_direct_insert"
on public.tutor_documents for insert
with check (false);

drop policy if exists "tutor_documents_no_direct_update" on public.tutor_documents;
create policy "tutor_documents_no_direct_update"
on public.tutor_documents for update
using (false)
with check (false);

drop policy if exists "tutor_documents_no_direct_delete" on public.tutor_documents;
create policy "tutor_documents_no_direct_delete"
on public.tutor_documents for delete
using (false);

-- --- RLS: tutor_availability_slots (tutor-own + admin SELECT; writes via RPC) -
-- Replace via replace_tutor_availability() (delete-all-then-insert). No broader
-- read invented: the Fastify routes only expose self (/tutor/availability) and
-- the admin detail-view join, so this stays tutor-own + admin, not coordinator-wide.
drop policy if exists "admin_select_all_tutor_availability_slots" on public.tutor_availability_slots;
create policy "admin_select_all_tutor_availability_slots"
on public.tutor_availability_slots for select
using (public.is_platform_admin());

drop policy if exists "tutors_select_own_availability_slots" on public.tutor_availability_slots;
create policy "tutors_select_own_availability_slots"
on public.tutor_availability_slots for select
using (tutor_id = public.current_tutor_id());

drop policy if exists "tutor_availability_slots_no_direct_insert" on public.tutor_availability_slots;
create policy "tutor_availability_slots_no_direct_insert"
on public.tutor_availability_slots for insert
with check (false);

drop policy if exists "tutor_availability_slots_no_direct_update" on public.tutor_availability_slots;
create policy "tutor_availability_slots_no_direct_update"
on public.tutor_availability_slots for update
using (false)
with check (false);

drop policy if exists "tutor_availability_slots_no_direct_delete" on public.tutor_availability_slots;
create policy "tutor_availability_slots_no_direct_delete"
on public.tutor_availability_slots for delete
using (false);

-- --- Storage: private tutor-documents bucket + policies ----------------------
-- Follows the assignment-submissions template. Path convention {tutor_id}/{id}.{ext}
-- (two segments -> foldername(name) has length 1). A tutor may INSERT/SELECT only
-- under their own folder; an admin may SELECT any path (verification review). No
-- UPDATE/DELETE policy -- documents are never edited, only re-uploaded as new rows.
insert into storage.buckets (id, name, public)
values ('tutor-documents', 'tutor-documents', false)
on conflict (id) do nothing;

drop policy if exists "tutors_upload_own_tutor_documents" on storage.objects;
create policy "tutors_upload_own_tutor_documents"
on storage.objects for insert
with check (
  bucket_id = 'tutor-documents'
  and public.current_profile_role() = 'tutor'
  and array_length(storage.foldername(name), 1) = 1
  and (storage.foldername(name))[1] = public.current_tutor_id()::text
);

drop policy if exists "tutors_read_own_tutor_documents_or_admin" on storage.objects;
create policy "tutors_read_own_tutor_documents_or_admin"
on storage.objects for select
using (
  bucket_id = 'tutor-documents'
  and (
    public.current_profile_role() = 'admin'
    or (storage.foldername(name))[1] = public.current_tutor_id()::text
  )
);

-- --- RPCs (all SECURITY DEFINER, search_path pinned) ------------------------
-- Audit-log side effects (Fastify's logAuditSafe on the decision/verify routes)
-- are intentionally omitted here, matching the sessions/finance/notifications
-- RPC layer, which likewise did not emit audit events internally.

-- upsert_tutor_application: port of PATCH /tutor/application. Tutor-scoped via
-- current_tutor_id(). Upsert on the tutor's single application; crucially, if the
-- current status is 'approved' and the tutor edits again, status auto-reverts to
-- 'changes_requested' (an approved tutor editing forces re-review) -- exact parity
-- with the Fastify `case when ... = 'approved' then 'changes_requested' ...` rule.
create or replace function public.upsert_tutor_application(
  p_personal_details jsonb,
  p_subjects jsonb,
  p_grades jsonb,
  p_teaching_preferences jsonb,
  p_experience text,
  p_availability_notes text
)
returns public.tutor_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := public.current_tutor_id();
  v_row public.tutor_applications;
begin
  if v_tutor_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.tutor_applications
    (tutor_id, personal_details_json, subjects_json, grades_json, teaching_preferences_json, experience, availability_notes)
  values
    (v_tutor_id,
     coalesce(p_personal_details, '{}'::jsonb),
     coalesce(p_subjects, '[]'::jsonb),
     coalesce(p_grades, '[]'::jsonb),
     coalesce(p_teaching_preferences, '[]'::jsonb),
     p_experience,
     p_availability_notes)
  on conflict (tutor_id) do update set
    personal_details_json = excluded.personal_details_json,
    subjects_json = excluded.subjects_json,
    grades_json = excluded.grades_json,
    teaching_preferences_json = excluded.teaching_preferences_json,
    experience = excluded.experience,
    availability_notes = excluded.availability_notes,
    status = case when tutor_applications.status = 'approved' then 'changes_requested' else tutor_applications.status end,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

-- submit_tutor_application: port of POST /tutor/application/submit. Tutor-scoped.
-- Sets status = 'submitted', submitted_at = coalesce(submitted_at, now()); only
-- from status in ('draft','changes_requested','rejected','submitted') -- note
-- 'submitted' is in the allowed-from set, making re-submission idempotent; any
-- other current status (or no application) yields application_not_found.
create or replace function public.submit_tutor_application()
returns public.tutor_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := public.current_tutor_id();
  v_row public.tutor_applications;
begin
  if v_tutor_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.tutor_applications
  set status = 'submitted',
      submitted_at = coalesce(submitted_at, now()),
      updated_at = now()
  where tutor_id = v_tutor_id
    and status in ('draft', 'changes_requested', 'rejected', 'submitted')
  returning * into v_row;

  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

-- decide_tutor_application: port of POST /admin/tutor-applications/:id/decision.
-- Admin-only. Always updates the application (status/reviewed_by/reviewed_at/
-- review_note). If status = 'approved', ALSO cascades to public.tutors: flips the
-- pending tutor operational (status = 'active' -- the record_status collapse of
-- Fastify's status='ACTIVE' + active=true), stamps approval_* fields, copies the
-- application's subjects_json/teaching_preferences_json onto the tutor's
-- qualified_subjects_json/teaching_preferences_json, and fills qualification_band
-- via coalesce(qualification_band, 'BOTH') so an existing band is NEVER overwritten.
-- Any non-approval decision updates ONLY approval_status/approval_reviewed_*/
-- approval_note (qualification/status untouched). p_status validated against the
-- TutorApplicationDecisionSchema enum.
create or replace function public.decide_tutor_application(
  p_application_id uuid,
  p_status text,
  p_note text
)
returns public.tutor_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.current_profile_id();
  v_row public.tutor_applications;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_status not in ('under_review', 'approved', 'rejected', 'changes_requested') then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  update public.tutor_applications
  set status = p_status,
      reviewed_by = v_admin,
      reviewed_at = now(),
      review_note = p_note,
      updated_at = now()
  where id = p_application_id
  returning * into v_row;

  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;

  if p_status = 'approved' then
    update public.tutors
    set approval_status = 'approved',
        approval_reviewed_by = v_admin,
        approval_reviewed_at = now(),
        approval_note = p_note,
        qualification_band = coalesce(qualification_band, 'BOTH'),
        qualified_subjects_json = v_row.subjects_json,
        teaching_preferences_json = v_row.teaching_preferences_json,
        status = 'active'
    where id = v_row.tutor_id;
  else
    update public.tutors
    set approval_status = p_status,
        approval_reviewed_by = v_admin,
        approval_reviewed_at = now(),
        approval_note = p_note
    where id = v_row.tutor_id;
  end if;

  return v_row;
end;
$$;

-- record_tutor_document: records a tutor_documents METADATA row after the client
-- has uploaded the bytes to the tutor-documents Storage bucket. Tutor-scoped.
-- Validates document_type/mime_type against the TutorDocumentUploadSchema enums,
-- and (defense in depth) that p_storage_key starts with current_tutor_id()::text
-- || '/' so a tutor cannot register a row pointing at another tutor's storage
-- path even if the Storage policy were somehow bypassed. Owned by current_tutor_id().
create or replace function public.record_tutor_document(
  p_document_type text,
  p_storage_key text,
  p_original_filename text,
  p_mime_type text,
  p_file_size_bytes int
)
returns public.tutor_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := public.current_tutor_id();
  v_row public.tutor_documents;
begin
  if v_tutor_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_document_type not in ('identity', 'cv', 'qualification', 'additional') then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  if p_mime_type not in ('application/pdf', 'image/jpeg', 'image/png') then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  if not starts_with(coalesce(p_storage_key, ''), v_tutor_id::text || '/') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.tutor_documents
    (tutor_id, document_type, storage_key, original_filename, mime_type, file_size_bytes)
  values
    (v_tutor_id, p_document_type, p_storage_key, p_original_filename, p_mime_type, p_file_size_bytes)
  returning * into v_row;

  return v_row;
end;
$$;

-- verify_tutor_document: port of PATCH /admin/tutor-documents/:id. Admin-only.
-- Sets verification_status/notes/verified_by/verified_at; p_status in
-- ('accepted','rejected') per TutorDocumentVerifySchema; document_not_found on miss.
create or replace function public.verify_tutor_document(
  p_document_id uuid,
  p_status text,
  p_notes text
)
returns public.tutor_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.tutor_documents;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_status not in ('accepted', 'rejected') then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  update public.tutor_documents
  set verification_status = p_status,
      notes = p_notes,
      verified_by = public.current_profile_id(),
      verified_at = now()
  where id = p_document_id
  returning * into v_row;

  if not found then
    raise exception 'document_not_found' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

-- replace_tutor_availability: port of PATCH /tutor/availability. Tutor-scoped
-- full replace -- delete all the caller's slots, then bulk-insert the new set,
-- atomically (the whole RPC is one transaction, mirroring Fastify's begin/delete/
-- insert/commit). Validates each slot against TutorAvailabilitySchema's bounds:
-- array <= 42, day_of_week 0-6, mode length 1..40 (default 'online'), notes <= 500,
-- plus end_time > start_time (the table's check, validated up front for a clean error).
create or replace function public.replace_tutor_availability(p_slots jsonb)
returns setof public.tutor_availability_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := public.current_tutor_id();
  v_slot jsonb;
  v_day int;
  v_start time;
  v_end time;
  v_mode text;
  v_notes text;
begin
  if v_tutor_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_slots is null or jsonb_typeof(p_slots) <> 'array' then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  if jsonb_array_length(p_slots) > 42 then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  delete from public.tutor_availability_slots where tutor_id = v_tutor_id;

  for v_slot in select * from jsonb_array_elements(p_slots)
  loop
    v_day := (v_slot->>'dayOfWeek')::int;
    v_start := (v_slot->>'startTime')::time;
    v_end := (v_slot->>'endTime')::time;
    v_mode := btrim(coalesce(v_slot->>'mode', 'online'));
    if v_mode = '' then
      v_mode := 'online';
    end if;
    v_notes := nullif(btrim(coalesce(v_slot->>'notes', '')), '');

    if v_day < 0 or v_day > 6 then
      raise exception 'invalid_request' using errcode = '23514';
    end if;
    if v_end <= v_start then
      raise exception 'invalid_request' using errcode = '23514';
    end if;
    if char_length(v_mode) < 1 or char_length(v_mode) > 40 then
      raise exception 'invalid_request' using errcode = '23514';
    end if;
    if v_notes is not null and char_length(v_notes) > 500 then
      raise exception 'invalid_request' using errcode = '23514';
    end if;

    insert into public.tutor_availability_slots
      (tutor_id, day_of_week, start_time, end_time, mode, notes)
    values
      (v_tutor_id, v_day, v_start, v_end, v_mode, v_notes);
  end loop;

  return query
    select *
    from public.tutor_availability_slots
    where tutor_id = v_tutor_id
    order by day_of_week asc, start_time asc;
end;
$$;

-- --- Grants: all six are callable by authenticated; each self-gates internally
-- (tutor RPCs on current_tutor_id() null-check + ownership; the two admin RPCs on
-- is_platform_admin()). No client ever writes these tables directly (RLS denies).
grant execute on function public.upsert_tutor_application(jsonb, jsonb, jsonb, jsonb, text, text) to authenticated;
grant execute on function public.submit_tutor_application() to authenticated;
grant execute on function public.decide_tutor_application(uuid, text, text) to authenticated;
grant execute on function public.record_tutor_document(text, text, text, text, int) to authenticated;
grant execute on function public.verify_tutor_document(uuid, text, text) to authenticated;
grant execute on function public.replace_tutor_availability(jsonb) to authenticated;

-- ============================================================================
-- GROWTH MONITORING / RISK (PRISMA_TO_SUPABASE_MIGRATION_PLAN.md §4D / §6 step 5)
--
-- Ports Fastify's predictive-score / career-alignment feature --
-- StudentScoreSnapshot / CareerProgressSnapshot -- but this is a REDESIGN, not
-- a literal port. Fastify's computeStudentMetrics/computeScoreSnapshot
-- (lms-api/src/lib/predictive-scoring.ts + routes/phase3.ts) is built almost
-- entirely from gamification signals -- study_streaks, study_activity_events --
-- which plan §3D explicitly CUT from this migration (the same cut that made
-- the weekly_reports payload drop its streak/xp block). Porting that formula
-- verbatim is therefore impossible, and per the owner's explicit requirement
-- (plan §7 decision 2) also wrong: the migrated score must be traceable to
-- the SPECIFIC assignments/assignment_submissions/student_progress rows that
-- drove it, not a black-box number. So the scoring model here is rebuilt from
-- tables that already exist in this schema:
--   - session attendance (public.sessions, already migrated) -- same 14-day
--     window Fastify used for approved/rejected sessions.
--   - assignment completion (public.assignments + public.assignment_submissions)
--     -- published assignments due for the student's grade in the last 14
--     days vs. whether the student actually submitted; the SPECIFIC
--     assignment_id of the oldest still-missing assignment is carried in
--     reasons_json, not just a count.
--   - marks trend (public.assignment_submissions.marks_awarded) -- RELEASED
--     marks only (marks_released = true). Deliberate exposure guard: these
--     tables are read directly by the owning student (no redacting read-RPC,
--     see RLS below), so any signal built from assignment_submissions must
--     respect the same released-only rule get_student_assignment_submissions()
--     already enforces elsewhere -- otherwise risk/momentum would leak an
--     unreleased mark's existence/size to the student it belongs to.
--   - topic weakness (public.student_progress) -- lowest-scoring topic in a
--     60-day window, the same weakest-topic selection
--     studentDashboardRepository.ts already does client-side (order by score
--     asc), reused here so the signal and the dashboard's own "recommended
--     next" agree.
--
-- Each reason in reasons_json carries source_type + source_id pointing at the
-- driving row (session / assignment / assignment_submission /
-- student_progress) so a tutor/admin can click through to the specific thing
-- that triggered the signal -- the "traceability" requirement, made concrete
-- rather than left as a comment. career_progress_snapshots keeps Fastify's
-- exact 0.35/0.30/0.20/0.15 weight split, with the cut streakScore/
-- practiceScore terms replaced by real session-attendance/assignment-
-- completion signals (same shapes, non-gamification sources).
--
-- Unlike finance/weekly_reports (deliberately NOT org-scoped, see their own
-- sections), plan §4 explicitly calls growth/risk "org-scoped", so both
-- tables get organization_id via a dedicated derive-from-student trigger,
-- mirroring public.sessions rather than the finance/weekly_reports precedent.
--
-- CareerGoalSelection is NOT migrated as its own table (plan §7 decision 4:
-- it folds into public.student_career_profiles.target_careers_json). The
-- goal catalog itself (lms-api/data/career-goals.v1.json today) is static
-- content, not operational data, and stays outside the DB; the recompute RPC
-- below takes the goal's recommended subjects as a parameter rather than
-- looking them up server-side.
--
-- Deferred (NOT done here, by design): real-data backfill, frontend repoint
-- (student /scores /career UI + tutor "students needing attention" view still
-- call the Fastify routes), and Fastify-route retirement (§6 step 7).
-- ============================================================================

create table if not exists public.student_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  student_id uuid not null references public.students(id) on delete cascade,
  score_date date not null,
  risk_score int not null check (risk_score between 0 and 100),
  momentum_score int not null check (momentum_score between 0 and 100),
  reasons_json jsonb not null default '[]'::jsonb,
  metrics_json jsonb not null default '{}'::jsonb,
  recommended_actions_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint student_score_snapshots_reasons_array check (jsonb_typeof(reasons_json) = 'array'),
  constraint student_score_snapshots_metrics_object check (jsonb_typeof(metrics_json) = 'object'),
  constraint student_score_snapshots_actions_array check (jsonb_typeof(recommended_actions_json) = 'array'),
  unique (student_id, score_date)
);

-- Backfill for a database where this table was partially created by an
-- earlier, interrupted migration attempt (same reasoning as the
-- assignment_submissions backfill elsewhere in this file). Safe as NOT NULL
-- with no default because this table has no frontend yet and no real rows.
-- The unique constraint is also re-added here since it was only ever defined
-- inline in CREATE TABLE, which is a no-op against a pre-existing table.
alter table public.student_score_snapshots add column if not exists organization_id uuid not null references public.organizations(id);
alter table public.student_score_snapshots add column if not exists student_id uuid not null references public.students(id) on delete cascade;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'student_score_snapshots_student_id_score_date_key') then
    alter table public.student_score_snapshots add constraint student_score_snapshots_student_id_score_date_key unique (student_id, score_date);
  end if;
end
$$;

create index if not exists idx_student_score_snapshots_student_date on public.student_score_snapshots(student_id, score_date desc);
create index if not exists idx_student_score_snapshots_organization on public.student_score_snapshots(organization_id);

-- goal_id references the static career-goal catalog (a plain string, exactly
-- like Prisma's own goalId), not a DB table -- see the section header.
create table if not exists public.career_progress_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  student_id uuid not null references public.students(id) on delete cascade,
  goal_id text not null,
  alignment_score int not null check (alignment_score between 0 and 100),
  reasons_json jsonb not null default '[]'::jsonb,
  metrics_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint career_progress_snapshots_reasons_array check (jsonb_typeof(reasons_json) = 'array'),
  constraint career_progress_snapshots_metrics_object check (jsonb_typeof(metrics_json) = 'object')
);

-- Backfill for a database where this table was partially created by an
-- earlier, interrupted migration attempt (same reasoning as the
-- assignment_submissions backfill elsewhere in this file). Safe as NOT NULL
-- with no default because this table has no frontend yet and no real rows.
alter table public.career_progress_snapshots add column if not exists organization_id uuid not null references public.organizations(id);
alter table public.career_progress_snapshots add column if not exists student_id uuid not null references public.students(id) on delete cascade;

create index if not exists idx_career_progress_snapshots_student_goal on public.career_progress_snapshots(student_id, goal_id, created_at desc);
create index if not exists idx_career_progress_snapshots_organization on public.career_progress_snapshots(organization_id);

alter table public.student_score_snapshots enable row level security;
alter table public.career_progress_snapshots enable row level security;

-- Shared trigger: both tables carry organization_id derived STRICTLY from the
-- student (never the caller's own org membership) -- same reasoning as
-- fill_session_organization_id(): these rows are written by a SECURITY
-- DEFINER RPC on behalf of the student they're about, not freshly created by
-- a coordinator, so "creator's own org" would be wrong. Shared across both
-- tables since the derivation (a direct student_id column) is identical.
create or replace function public.fill_student_scoped_organization_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if new.organization_id is not null then
    return new;
  end if;

  select organization_id into v_org
  from public.students
  where id = new.student_id;

  if v_org is null then
    raise exception 'student_scoped_org_unresolved' using errcode = '23502';
  end if;

  new.organization_id := v_org;
  return new;
end;
$$;

drop trigger if exists trg_fill_student_score_snapshot_org on public.student_score_snapshots;
create trigger trg_fill_student_score_snapshot_org
  before insert on public.student_score_snapshots
  for each row execute function public.fill_student_scoped_organization_id();

drop trigger if exists trg_fill_career_progress_snapshot_org on public.career_progress_snapshots;
create trigger trg_fill_career_progress_snapshot_org
  before insert on public.career_progress_snapshots
  for each row execute function public.fill_student_scoped_organization_id();

-- RLS: admin all; owning student SELECT own; allocated tutor SELECT their own
-- students' (plan §4: "owning student + tutor(s) + admin"), matching Fastify's
-- GET /tutor/scores and GET /tutor/students/:studentId/career routes. No
-- direct writes for anyone -- every row is written by the recompute RPCs
-- below (sessions/finance/notifications/tutor-onboarding precedent).
drop policy if exists "student_score_snapshots_select" on public.student_score_snapshots;
create policy student_score_snapshots_select on public.student_score_snapshots
for select
using (
  public.is_platform_admin()
  or student_id = public.current_student_id()
  or exists (
    select 1 from public.tutor_student_allocations tsa
    where tsa.student_id = public.student_score_snapshots.student_id
      and tsa.tutor_id = public.current_tutor_id()
      and tsa.status = 'active'
  )
);

drop policy if exists "student_score_snapshots_no_direct_insert" on public.student_score_snapshots;
create policy student_score_snapshots_no_direct_insert on public.student_score_snapshots
for insert
with check (false);

drop policy if exists "student_score_snapshots_no_direct_update" on public.student_score_snapshots;
create policy student_score_snapshots_no_direct_update on public.student_score_snapshots
for update
using (false)
with check (false);

drop policy if exists "student_score_snapshots_no_direct_delete" on public.student_score_snapshots;
create policy student_score_snapshots_no_direct_delete on public.student_score_snapshots
for delete
using (false);

drop policy if exists "career_progress_snapshots_select" on public.career_progress_snapshots;
create policy career_progress_snapshots_select on public.career_progress_snapshots
for select
using (
  public.is_platform_admin()
  or student_id = public.current_student_id()
  or exists (
    select 1 from public.tutor_student_allocations tsa
    where tsa.student_id = public.career_progress_snapshots.student_id
      and tsa.tutor_id = public.current_tutor_id()
      and tsa.status = 'active'
  )
);

drop policy if exists "career_progress_snapshots_no_direct_insert" on public.career_progress_snapshots;
create policy career_progress_snapshots_no_direct_insert on public.career_progress_snapshots
for insert
with check (false);

drop policy if exists "career_progress_snapshots_no_direct_update" on public.career_progress_snapshots;
create policy career_progress_snapshots_no_direct_update on public.career_progress_snapshots
for update
using (false)
with check (false);

drop policy if exists "career_progress_snapshots_no_direct_delete" on public.career_progress_snapshots;
create policy career_progress_snapshots_no_direct_delete on public.career_progress_snapshots
for delete
using (false);

-- recompute_student_risk_snapshot: redesigned port of recomputeUserScore +
-- computeStudentMetrics + computeScoreSnapshot (see section header for why
-- this can't be a literal port). Permission gate gate: admin (bulk/manual
-- recompute, ported from POST /admin/scores/recompute) or the student
-- themself (lazy recompute, ported from GET /scores/me). Fastify never lets a
-- tutor trigger a recompute -- tutors only ever READ the latest snapshot via
-- GET /tutor/scores -- so no tutor path is granted here either (same
-- discipline already applied to student_notifications' RLS).
create or replace function public.recompute_student_risk_snapshot(
  p_student_id uuid,
  p_score_date date default current_date
)
returns public.student_score_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start date := p_score_date - 13;
  v_student_grade text;
  v_approved_sessions int := 0;
  v_rejected_sessions int := 0;
  v_flagged_session_id uuid;
  v_due_count int := 0;
  v_missing_count int := 0;
  v_missing_assignment_id uuid;
  v_missing_assignment_title text;
  v_recent_marks_avg numeric;
  v_prior_marks_avg numeric;
  v_low_submission_id uuid;
  v_weak_progress_id uuid;
  v_weak_topic text;
  v_weak_score numeric;
  v_previous_risk int;
  v_previous_momentum int;
  v_attendance_risk int := 0;
  v_completion_risk int := 0;
  v_marks_risk int := 0;
  v_topic_risk int := 0;
  v_risk_score int;
  v_momentum_score int;
  v_reasons jsonb := '[]'::jsonb;
  v_recommended_actions jsonb := '[]'::jsonb;
  v_metrics jsonb;
  v_snapshot public.student_score_snapshots;
begin
  -- FIX (real bug, found via direct testing, not a design choice): Postgres's
  -- IF treats a NULL condition as false, so `if not (A or B)` where the
  -- OR-chain itself evaluates to NULL (is_platform_admin() false,
  -- current_student_id() null for a non-student caller, e.g. a tutor) skips
  -- the raise entirely -- silently ALLOWING any non-admin, non-student
  -- caller to recompute an arbitrary student's risk snapshot. coalesce
  -- forces the whole expression to a real boolean before negating it.
  if not coalesce(public.is_platform_admin() or public.current_student_id() = p_student_id, false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select grade into v_student_grade from public.students where id = p_student_id;
  if not found then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;

  -- Signal 1: session attendance (already migrated), same 14-day window
  -- Fastify used for approved/rejected sessions.
  select
    count(*) filter (where status = 'approved'),
    count(*) filter (where status = 'rejected')
    into v_approved_sessions, v_rejected_sessions
  from public.sessions
  where student_id = p_student_id
    and date between v_window_start and p_score_date;

  select id into v_flagged_session_id
  from public.sessions
  where student_id = p_student_id
    and status = 'rejected'
    and date between v_window_start and p_score_date
  order by date desc
  limit 1;

  -- Signal 2: assignment completion -- published assignments due for the
  -- student's grade in the window vs. whether they actually submitted.
  -- v_missing_assignment_id/_title carry the traceability requirement: the
  -- SPECIFIC oldest still-missing assignment, not just a count.
  select
    count(*)::int,
    count(*) filter (where sub.id is null)::int
    into v_due_count, v_missing_count
  from public.assignments a
  left join public.assignment_submissions sub
    on sub.assignment_id = a.id and sub.student_id = p_student_id and sub.is_latest
  where a.status = 'published'
    and a.grade = v_student_grade
    and a.due_date is not null
    and a.due_date::date between v_window_start and p_score_date;

  select a.id, a.title
    into v_missing_assignment_id, v_missing_assignment_title
  from public.assignments a
  left join public.assignment_submissions sub
    on sub.assignment_id = a.id and sub.student_id = p_student_id and sub.is_latest
  where a.status = 'published'
    and a.grade = v_student_grade
    and a.due_date is not null
    and a.due_date::date between v_window_start and p_score_date
    and sub.id is null
  order by a.due_date asc
  limit 1;

  -- Signal 3: marks trend -- RELEASED marks only (see section header's
  -- exposure-guard note).
  with recent_marks as (
    select id, marks_awarded,
           row_number() over (order by submitted_at desc) as rn
    from public.assignment_submissions
    where student_id = p_student_id
      and marks_released = true
      and marks_awarded is not null
  )
  select
    avg(marks_awarded) filter (where rn <= 3),
    avg(marks_awarded) filter (where rn between 4 and 6)
    into v_recent_marks_avg, v_prior_marks_avg
  from recent_marks;

  select id into v_low_submission_id
  from (
    select id, marks_awarded,
           row_number() over (order by submitted_at desc) as rn
    from public.assignment_submissions
    where student_id = p_student_id
      and marks_released = true
      and marks_awarded is not null
  ) recent
  where rn <= 6
  order by marks_awarded asc
  limit 1;

  -- Signal 4: topic weakness -- lowest-scoring topic in a 60-day window; the
  -- row id is the traceability anchor.
  select id, topic, score
    into v_weak_progress_id, v_weak_topic, v_weak_score
  from public.student_progress
  where student_id = p_student_id
    and recorded_at >= (p_score_date::timestamptz - interval '60 day')
  order by score asc, topic asc
  limit 1;

  -- Previous day's scores, for EMA smoothing (same alpha as Fastify's
  -- computeScoreSnapshot -- a generically useful smoothing technique, not
  -- gamification-specific, so it survives the redesign).
  select risk_score, momentum_score
    into v_previous_risk, v_previous_momentum
  from public.student_score_snapshots
  where student_id = p_student_id
    and score_date < p_score_date
  order by score_date desc
  limit 1;

  v_attendance_risk := case when (v_approved_sessions + v_rejected_sessions) > 0
    then round(100.0 * v_rejected_sessions / (v_approved_sessions + v_rejected_sessions))
    else 0 end;

  v_completion_risk := case when v_due_count > 0
    then round(100.0 * v_missing_count / v_due_count)
    else 0 end;

  v_marks_risk := case when v_recent_marks_avg is not null
    then greatest(0, least(100, round(100 - v_recent_marks_avg)))
    else 0 end;

  v_topic_risk := case when v_weak_score is not null
    then greatest(0, least(100, round(100 - v_weak_score)))
    else 0 end;

  v_risk_score := greatest(0, least(100, round(
    v_attendance_risk * 0.30
    + v_completion_risk * 0.30
    + v_marks_risk * 0.20
    + v_topic_risk * 0.20
  )))::int;

  v_momentum_score := greatest(0, least(100, round(
    (100 - v_attendance_risk) * 0.30
    + (100 - v_completion_risk) * 0.30
    + coalesce(v_recent_marks_avg, 70) * 0.20
    + coalesce(100 - v_weak_score, 70) * 0.20
  )))::int;

  if v_previous_risk is not null then
    v_risk_score := greatest(0, least(100, round(0.34 * v_risk_score + 0.66 * v_previous_risk)))::int;
  end if;
  if v_previous_momentum is not null then
    v_momentum_score := greatest(0, least(100, round(0.34 * v_momentum_score + 0.66 * v_previous_momentum)))::int;
  end if;

  if v_rejected_sessions > 0 and v_attendance_risk >= 40 then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'key', 'attendance',
      'label', 'Attendance risk elevated',
      'impact', case when v_attendance_risk >= 60 then 'HIGH' else 'MEDIUM' end,
      'value', v_attendance_risk,
      'detail', v_rejected_sessions || ' missed/cancelled session(s) in the last 14 days.',
      'source_type', 'session',
      'source_id', v_flagged_session_id
    ));
  end if;

  if v_missing_count > 0 then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'key', 'assignment_completion',
      'label', 'Assignment(s) not yet submitted',
      'impact', case when v_completion_risk >= 50 then 'HIGH' else 'MEDIUM' end,
      'value', v_completion_risk,
      'detail', v_missing_count || ' of ' || v_due_count || ' published assignment(s) due in the last 14 days have no submission'
        || case when v_missing_assignment_title is not null then ' (earliest: "' || v_missing_assignment_title || '")' else '' end || '.',
      'source_type', 'assignment',
      'source_id', v_missing_assignment_id
    ));
    v_recommended_actions := v_recommended_actions || jsonb_build_array(jsonb_build_object(
      'label', 'Follow up on the missing assignment' || case when v_missing_assignment_title is not null then ' "' || v_missing_assignment_title || '"' else '' end,
      'href', '/dashboard/'
    ));
  end if;

  if v_recent_marks_avg is not null and v_marks_risk >= 40 then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'key', 'marks_trend',
      'label', 'Recent marks are low',
      'impact', case when v_marks_risk >= 60 then 'HIGH' else 'MEDIUM' end,
      'value', round(v_recent_marks_avg),
      'detail', 'Average of the most recent released mark(s) is ' || round(v_recent_marks_avg) || '%.',
      'source_type', 'assignment_submission',
      'source_id', v_low_submission_id
    ));
  end if;

  if v_weak_score is not null and v_topic_risk >= 40 then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'key', 'topic_weakness',
      'label', 'Weak topic identified',
      'impact', case when v_topic_risk >= 60 then 'HIGH' else 'MEDIUM' end,
      'value', v_weak_score,
      'detail', '"' || v_weak_topic || '" scored ' || v_weak_score || '% in the last 60 days.',
      'source_type', 'student_progress',
      'source_id', v_weak_progress_id
    ));
    v_recommended_actions := v_recommended_actions || jsonb_build_array(jsonb_build_object(
      'label', 'Review "' || v_weak_topic || '" with your tutor',
      'href', '/dashboard/'
    ));
  end if;

  if v_attendance_risk >= 40 then
    v_recommended_actions := v_recommended_actions || jsonb_build_array(jsonb_build_object(
      'label', 'Book/confirm the next tutoring session',
      'href', '/dashboard/'
    ));
  end if;

  if v_due_count > 0 and v_missing_count = 0 and v_recent_marks_avg is not null and v_marks_risk < 40
     and (v_weak_score is null or v_topic_risk < 40) then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'key', 'momentum_positive',
      'label', 'Strong momentum signal',
      'impact', 'POSITIVE',
      'value', v_momentum_score,
      'detail', 'All recent assignments submitted and released marks are trending well.',
      'source_type', null,
      'source_id', null
    ));
  end if;

  if jsonb_array_length(v_reasons) = 0 then
    v_reasons := jsonb_build_array(jsonb_build_object(
      'key', 'stable',
      'label', 'Stable learning pattern',
      'impact', 'LOW',
      'value', v_momentum_score,
      'detail', 'No major negative shifts detected in this period.',
      'source_type', null,
      'source_id', null
    ));
  end if;

  if jsonb_array_length(v_recommended_actions) = 0 then
    v_recommended_actions := jsonb_build_array(jsonb_build_object(
      'label', 'Keep up the current routine',
      'href', '/dashboard/'
    ));
  end if;

  v_metrics := jsonb_build_object(
    'approvedSessions14', v_approved_sessions,
    'rejectedSessions14', v_rejected_sessions,
    'assignmentsDue14', v_due_count,
    'assignmentsMissing14', v_missing_count,
    'recentMarksAverage', v_recent_marks_avg,
    'priorMarksAverage', v_prior_marks_avg,
    'weakestTopicScore', v_weak_score
  );

  insert into public.student_score_snapshots
    (student_id, score_date, risk_score, momentum_score, reasons_json, metrics_json, recommended_actions_json)
  values
    (p_student_id, p_score_date, v_risk_score, v_momentum_score, v_reasons, v_metrics, v_recommended_actions)
  on conflict (student_id, score_date)
  do update set
    risk_score = excluded.risk_score,
    momentum_score = excluded.momentum_score,
    reasons_json = excluded.reasons_json,
    metrics_json = excluded.metrics_json,
    recommended_actions_json = excluded.recommended_actions_json,
    created_at = now()
  returning * into v_snapshot;

  return v_snapshot;
end;
$$;

-- recompute_career_progress_snapshot: redesigned port of
-- recomputeCareerSnapshot. Self-service only -- faithful to Fastify, which
-- only ever calls recomputeCareerSnapshot from the student's own
-- POST /career/goals handler; no admin/tutor path exists there, so none is
-- invented here (same discipline as student_notifications' RLS). Keeps
-- Fastify's exact 0.35/0.30/0.20/0.15 weight split; subjectCoverage/
-- averageCompletion are rebuilt from the student's most recent
-- public.weekly_reports row (already migrated, §4B -- same source data
-- Fastify used, now Supabase-native); the cut streakScore/practiceScore
-- terms are replaced by real session-attendance/assignment-completion
-- signals (same shapes, non-gamification sources, and traceable to a
-- specific assignment when incomplete).
create or replace function public.recompute_career_progress_snapshot(
  p_student_id uuid,
  p_goal_id text,
  p_recommended_subjects text[]
)
returns public.career_progress_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start date := current_date - 13;
  v_student_grade text;
  v_report_id uuid;
  v_topics jsonb;
  v_subject_match_count int := 0;
  v_subject_total int := coalesce(array_length(p_recommended_subjects, 1), 0);
  v_subject_coverage int := 0;
  v_average_completion int := 0;
  v_approved_sessions_14 int := 0;
  v_attendance_score int := 0;
  v_due_count int := 0;
  v_missing_count int := 0;
  v_missing_assignment_id uuid;
  v_completion_score int := 0;
  v_alignment_score int;
  v_reasons jsonb;
  v_metrics jsonb;
  v_snapshot public.career_progress_snapshots;
begin
  if public.current_student_id() is null or public.current_student_id() <> p_student_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_goal_id is null or btrim(p_goal_id) = '' then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  select grade into v_student_grade from public.students where id = p_student_id;
  if not found then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;

  select id, payload_json -> 'topicProgress'
    into v_report_id, v_topics
  from public.weekly_reports
  where student_id = p_student_id
  order by week_end desc
  limit 1;

  if v_topics is null then
    v_topics := '[]'::jsonb;
  end if;

  if v_subject_total > 0 then
    select count(*) into v_subject_match_count
    from unnest(p_recommended_subjects) as subject
    where exists (
      select 1
      from jsonb_array_elements(v_topics) as t
      where lower(t ->> 'topic') like '%' || lower(split_part(subject, ' ', 1)) || '%'
    );
    v_subject_coverage := round(100.0 * v_subject_match_count / v_subject_total)::int;
  end if;

  select coalesce(round(avg((t ->> 'completion')::numeric)), 0)::int
    into v_average_completion
  from jsonb_array_elements(v_topics) as t;

  -- attendanceScore: real session attendance substituted for Fastify's
  -- gamification-streak-derived streakScore -- same min(100, n * 10) shape.
  select count(*) filter (where status = 'approved')
    into v_approved_sessions_14
  from public.sessions
  where student_id = p_student_id
    and date between v_window_start and current_date;
  v_attendance_score := least(100, v_approved_sessions_14 * 10);

  -- completionScore: real assignment-submission compliance substituted for
  -- Fastify's gamification-activity-derived practiceScore -- traceable to the
  -- specific missing assignment, unlike the gamification signal it replaces.
  select
    count(*)::int,
    count(*) filter (where sub.id is null)::int
    into v_due_count, v_missing_count
  from public.assignments a
  left join public.assignment_submissions sub
    on sub.assignment_id = a.id and sub.student_id = p_student_id and sub.is_latest
  where a.status = 'published'
    and a.grade = v_student_grade
    and a.due_date is not null
    and a.due_date::date between v_window_start and current_date;

  select a.id into v_missing_assignment_id
  from public.assignments a
  left join public.assignment_submissions sub
    on sub.assignment_id = a.id and sub.student_id = p_student_id and sub.is_latest
  where a.status = 'published'
    and a.grade = v_student_grade
    and a.due_date is not null
    and a.due_date::date between v_window_start and current_date
    and sub.id is null
  order by a.due_date asc
  limit 1;

  v_completion_score := case when v_due_count > 0
    then round(100.0 * (v_due_count - v_missing_count) / v_due_count)::int
    else 100 end;

  v_alignment_score := greatest(0, least(100, round(
    v_subject_coverage * 0.35
    + v_average_completion * 0.30
    + v_attendance_score * 0.20
    + v_completion_score * 0.15
  )))::int;

  v_reasons := jsonb_build_array(
    jsonb_build_object(
      'key', 'subject_coverage',
      'label', 'Subject coverage across goal requirements',
      'value', v_subject_coverage,
      'detail', 'Subject coverage across goal requirements: ' || v_subject_coverage || '%.',
      'source_type', case when v_report_id is not null then 'weekly_report' else null end,
      'source_id', v_report_id
    ),
    jsonb_build_object(
      'key', 'topic_completion',
      'label', 'Average topic completion',
      'value', v_average_completion,
      'detail', 'Average topic completion from weekly report: ' || v_average_completion || '%.',
      'source_type', case when v_report_id is not null then 'weekly_report' else null end,
      'source_id', v_report_id
    ),
    jsonb_build_object(
      'key', 'session_attendance',
      'label', 'Recent session attendance',
      'value', v_attendance_score,
      'detail', v_approved_sessions_14 || ' attended session(s) in the last 14 days.',
      'source_type', null,
      'source_id', null
    ),
    jsonb_build_object(
      'key', 'assignment_completion',
      'label', 'Assignment completion vs goal subjects',
      'value', v_completion_score,
      'detail', case when v_missing_count > 0
        then v_missing_count || ' of ' || v_due_count || ' published assignment(s) due in the last 14 days have no submission.'
        else 'All published assignments due in the last 14 days have a submission.' end,
      'source_type', case when v_missing_assignment_id is not null then 'assignment' else null end,
      'source_id', v_missing_assignment_id
    )
  );

  v_metrics := jsonb_build_object(
    'subjectCoverage', v_subject_coverage,
    'averageCompletion', v_average_completion,
    'attendanceScore', v_attendance_score,
    'completionScore', v_completion_score,
    'assignmentsDue14', v_due_count,
    'assignmentsMissing14', v_missing_count
  );

  insert into public.career_progress_snapshots (student_id, goal_id, alignment_score, reasons_json, metrics_json)
  values (p_student_id, p_goal_id, v_alignment_score, v_reasons, v_metrics)
  returning * into v_snapshot;

  return v_snapshot;
end;
$$;

-- --- Grants: both callable by authenticated; each self-gates internally
-- (admin-or-self / self-only checks above). No client ever writes these
-- tables directly (RLS denies both).
grant execute on function public.recompute_student_risk_snapshot(uuid, date) to authenticated;
grant execute on function public.recompute_career_progress_snapshot(uuid, text, text[]) to authenticated;

-- ============================================================================
-- ACADEMIC EXTRAS + VOLUNTEERING (PRISMA_TO_SUPABASE_MIGRATION_PLAN.md §4E / §6 step 6)
--
-- Ports BaselineAssessment, LearningGoal, StudentExamEvent, VolunteerEvent,
-- VolunteerLog. Prisma's `LearningAssignment` (+ its own raw-SQL
-- `assignment_submissions` table, distinct from and FK'd differently than the
-- Supabase `assignment_submissions` already live here) is DELIBERATELY CUT,
-- not migrated -- a scope decision made during this step, not part of the
-- original locked plan. It is a parallel tutor-assigns-one-student system
-- with zero references anywhere in src/ (grep confirmed), and porting it
-- would require a second, confusingly-named `learning_assignment_submissions`
-- table alongside the already-live `assignments`/`assignment_submissions`
-- broadcast-homework system the current frontend actually uses. See §7
-- decision 6.
--
-- Shared org-derivation: baseline_assessments / learning_goals /
-- student_exam_events all carry a direct student_id, so they reuse the
-- `fill_student_scoped_organization_id()` trigger the growth/risk migration
-- introduced (§4D) rather than duplicating that trigger a third time.
--
-- volunteer_events / volunteer_logs are DELIBERATELY NOT org-scoped, matching
-- the finance-table precedent (MULTI_ORG_MODEL_PLAN.md §9): Prisma's own
-- VolunteerEvent/VolunteerLog carry no ngo_partner_id/organization concept at
-- all -- volunteering is tutor-facing platform content, not per-org client
-- data.
--
-- Deferred (NOT done here, by design): real-data backfill, frontend repoint
-- (none of these five have any src/ usage today -- baseline/goals/exam-events
-- have dashboard-shaped fields already reserved in StudentDashboardView but
-- unpopulated by loadFromSupabase; volunteering has no frontend surface at
-- all), and Fastify-route retirement (§6 step 7).
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'baseline_source_type') then
    create type public.baseline_source_type as enum ('manual', 'uploaded', 'generated', 'diagnostic');
  end if;
  if not exists (select 1 from pg_type where typname = 'learning_goal_category') then
    create type public.learning_goal_category as enum ('academic', 'attendance', 'assignment', 'career', 'intervention');
  end if;
  if not exists (select 1 from pg_type where typname = 'learning_goal_status') then
    create type public.learning_goal_status as enum ('active', 'completed', 'paused', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'volunteer_event_status') then
    create type public.volunteer_event_status as enum ('planned', 'cancelled', 'completed');
  end if;
  if not exists (select 1 from pg_type where typname = 'volunteer_log_status') then
    create type public.volunteer_log_status as enum ('signed_up', 'submitted', 'verified', 'rejected');
  end if;
end
$$;

create table if not exists public.baseline_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  student_id uuid not null references public.students(id) on delete cascade,
  subject text not null,
  grade text,
  score numeric(8, 2) not null,
  total numeric(8, 2) not null,
  percentage numeric(5, 2) not null,
  level_band text,
  cognitive_breakdown_json jsonb not null default '{}'::jsonb,
  topic_breakdown_json jsonb not null default '{}'::jsonb,
  recommended_next_steps_json jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null,
  created_by uuid references public.profiles(id),
  source_type public.baseline_source_type not null default 'manual',
  created_at timestamptz not null default now(),
  constraint baseline_assessments_cognitive_object check (jsonb_typeof(cognitive_breakdown_json) = 'object'),
  constraint baseline_assessments_topic_object check (jsonb_typeof(topic_breakdown_json) = 'object'),
  constraint baseline_assessments_steps_array check (jsonb_typeof(recommended_next_steps_json) = 'array')
);

-- Backfill for a database where this table was partially created by an
-- earlier, interrupted migration attempt (same reasoning as the
-- assignment_submissions backfill elsewhere in this file). Safe as NOT NULL
-- with no default because this table has no frontend yet and no real rows.
alter table public.baseline_assessments add column if not exists created_by uuid references public.profiles(id);
alter table public.baseline_assessments add column if not exists organization_id uuid not null references public.organizations(id);

create index if not exists idx_baseline_assessments_student_completed on public.baseline_assessments(student_id, completed_at desc);
create index if not exists idx_baseline_assessments_subject_grade on public.baseline_assessments(subject, grade, completed_at desc);
create index if not exists idx_baseline_assessments_organization on public.baseline_assessments(organization_id);

create table if not exists public.learning_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null,
  description text,
  category public.learning_goal_category not null default 'academic',
  subject text,
  target_value numeric(10, 2),
  current_value numeric(10, 2),
  due_date date,
  status public.learning_goal_status not null default 'active',
  created_by uuid references public.profiles(id),
  visible_to_student boolean not null default true,
  visible_to_tutor boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backfill for a database where this table was partially created by an
-- earlier, interrupted migration attempt (same reasoning as the
-- assignment_submissions backfill elsewhere in this file). Safe as NOT NULL
-- with no default because this table has no frontend yet and no real rows.
alter table public.learning_goals add column if not exists created_by uuid references public.profiles(id);
alter table public.learning_goals add column if not exists organization_id uuid not null references public.organizations(id);

create index if not exists idx_learning_goals_student_status_due on public.learning_goals(student_id, status, due_date);
create index if not exists idx_learning_goals_category_status on public.learning_goals(category, status);
create index if not exists idx_learning_goals_organization on public.learning_goals(organization_id);

create table if not exists public.student_exam_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  student_id uuid not null references public.students(id) on delete cascade,
  subject text not null,
  title text not null,
  exam_date date not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backfill for a database where this table was partially created by an
-- earlier, interrupted migration attempt (same reasoning as the
-- assignment_submissions backfill elsewhere in this file). Safe as NOT NULL
-- with no default because this table has no frontend yet and no real rows.
alter table public.student_exam_events add column if not exists created_by uuid references public.profiles(id);
alter table public.student_exam_events add column if not exists organization_id uuid not null references public.organizations(id);

create index if not exists idx_student_exam_events_student_date on public.student_exam_events(student_id, exam_date);
create index if not exists idx_student_exam_events_organization on public.student_exam_events(organization_id);

-- No organization_id -- see section header (VolunteerEvent/VolunteerLog carry
-- no org concept in Prisma; matches the finance-table precedent).
create table if not exists public.volunteer_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date,
  start_time time,
  end_time time,
  location text,
  mode text not null default 'in-person',
  status public.volunteer_event_status not null default 'planned',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint volunteer_events_mode_len check (char_length(mode) between 1 and 40)
);

-- Backfill for a database where this table was partially created by an
-- earlier, interrupted migration attempt (same reasoning as the
-- assignment_submissions backfill elsewhere in this file).
alter table public.volunteer_events add column if not exists created_by uuid references public.profiles(id);

create index if not exists idx_volunteer_events_date on public.volunteer_events(event_date desc nulls last, created_at desc);

create table if not exists public.volunteer_logs (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  event_id uuid references public.volunteer_events(id),
  status public.volunteer_log_status not null default 'signed_up',
  hours numeric(8, 2) check (hours is null or hours >= 0),
  volunteered_on date,
  notes text,
  evidence_document_id uuid references public.tutor_documents(id),
  submitted_at timestamptz,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_volunteer_logs_tutor_created on public.volunteer_logs(tutor_id, created_at desc);
create index if not exists idx_volunteer_logs_event on public.volunteer_logs(event_id);

alter table public.baseline_assessments enable row level security;
alter table public.learning_goals enable row level security;
alter table public.student_exam_events enable row level security;
alter table public.volunteer_events enable row level security;
alter table public.volunteer_logs enable row level security;

drop trigger if exists trg_fill_baseline_assessment_org on public.baseline_assessments;
create trigger trg_fill_baseline_assessment_org
  before insert on public.baseline_assessments
  for each row execute function public.fill_student_scoped_organization_id();

drop trigger if exists trg_fill_learning_goal_org on public.learning_goals;
create trigger trg_fill_learning_goal_org
  before insert on public.learning_goals
  for each row execute function public.fill_student_scoped_organization_id();

drop trigger if exists trg_fill_student_exam_event_org on public.student_exam_events;
create trigger trg_fill_student_exam_event_org
  before insert on public.student_exam_events
  for each row execute function public.fill_student_scoped_organization_id();

-- RLS: admin all; owning student + active-allocation tutor SELECT (matching
-- /tutor/students/:id/summary's baseline/goal reads and /dashboard's
-- exam-calendar read). No direct writes for anyone -- RPC-only, following
-- every prior domain's precedent.
drop policy if exists "baseline_assessments_select" on public.baseline_assessments;
create policy baseline_assessments_select on public.baseline_assessments
for select
using (
  public.is_platform_admin()
  or student_id = public.current_student_id()
  or exists (
    select 1 from public.tutor_student_allocations tsa
    where tsa.student_id = public.baseline_assessments.student_id
      and tsa.tutor_id = public.current_tutor_id()
      and tsa.status = 'active'
  )
);

drop policy if exists "baseline_assessments_no_direct_insert" on public.baseline_assessments;
create policy baseline_assessments_no_direct_insert on public.baseline_assessments
for insert
with check (false);

drop policy if exists "baseline_assessments_no_direct_update" on public.baseline_assessments;
create policy baseline_assessments_no_direct_update on public.baseline_assessments
for update
using (false)
with check (false);

drop policy if exists "baseline_assessments_no_direct_delete" on public.baseline_assessments;
create policy baseline_assessments_no_direct_delete on public.baseline_assessments
for delete
using (false);

-- learning_goals additionally gates the student/tutor SELECT arms on
-- visible_to_student/visible_to_tutor -- ported directly from Fastify's own
-- `where ... and visible_to_student = true` / `visible_to_tutor = true`
-- dashboard queries, made into a hard RLS boundary rather than a
-- query-time convenience. Admin sees every goal regardless of the flags
-- (matching GET /admin/learning-goals, which has no visibility filter).
drop policy if exists "learning_goals_select" on public.learning_goals;
create policy learning_goals_select on public.learning_goals
for select
using (
  public.is_platform_admin()
  or (student_id = public.current_student_id() and visible_to_student = true)
  or (
    visible_to_tutor = true
    and exists (
      select 1 from public.tutor_student_allocations tsa
      where tsa.student_id = public.learning_goals.student_id
        and tsa.tutor_id = public.current_tutor_id()
        and tsa.status = 'active'
    )
  )
);

drop policy if exists "learning_goals_no_direct_insert" on public.learning_goals;
create policy learning_goals_no_direct_insert on public.learning_goals
for insert
with check (false);

drop policy if exists "learning_goals_no_direct_update" on public.learning_goals;
create policy learning_goals_no_direct_update on public.learning_goals
for update
using (false)
with check (false);

drop policy if exists "learning_goals_no_direct_delete" on public.learning_goals;
create policy learning_goals_no_direct_delete on public.learning_goals
for delete
using (false);

drop policy if exists "student_exam_events_select" on public.student_exam_events;
create policy student_exam_events_select on public.student_exam_events
for select
using (
  public.is_platform_admin()
  or student_id = public.current_student_id()
  or exists (
    select 1 from public.tutor_student_allocations tsa
    where tsa.student_id = public.student_exam_events.student_id
      and tsa.tutor_id = public.current_tutor_id()
      and tsa.status = 'active'
  )
);

drop policy if exists "student_exam_events_no_direct_insert" on public.student_exam_events;
create policy student_exam_events_no_direct_insert on public.student_exam_events
for insert
with check (false);

drop policy if exists "student_exam_events_no_direct_update" on public.student_exam_events;
create policy student_exam_events_no_direct_update on public.student_exam_events
for update
using (false)
with check (false);

drop policy if exists "student_exam_events_no_direct_delete" on public.student_exam_events;
create policy student_exam_events_no_direct_delete on public.student_exam_events
for delete
using (false);

-- volunteer_events: admin all; ANY tutor may SELECT (platform-wide listing,
-- matching GET /tutor/volunteer/events -- not scoped to that tutor's own
-- allocations, since these are events any tutor can sign up for). No
-- student/parent access anywhere in this domain (Fastify has no such route).
drop policy if exists "volunteer_events_select" on public.volunteer_events;
create policy volunteer_events_select on public.volunteer_events
for select
using (
  public.is_platform_admin()
  or public.current_tutor_id() is not null
);

drop policy if exists "volunteer_events_no_direct_insert" on public.volunteer_events;
create policy volunteer_events_no_direct_insert on public.volunteer_events
for insert
with check (false);

drop policy if exists "volunteer_events_no_direct_update" on public.volunteer_events;
create policy volunteer_events_no_direct_update on public.volunteer_events
for update
using (false)
with check (false);

drop policy if exists "volunteer_events_no_direct_delete" on public.volunteer_events;
create policy volunteer_events_no_direct_delete on public.volunteer_events
for delete
using (false);

-- volunteer_logs: admin all; tutor SELECT own only (matching GET
-- /tutor/volunteer/logs' `where vl.tutor_id = $1` -- no cross-tutor
-- visibility).
drop policy if exists "volunteer_logs_select" on public.volunteer_logs;
create policy volunteer_logs_select on public.volunteer_logs
for select
using (
  public.is_platform_admin()
  or tutor_id = public.current_tutor_id()
);

drop policy if exists "volunteer_logs_no_direct_insert" on public.volunteer_logs;
create policy volunteer_logs_no_direct_insert on public.volunteer_logs
for insert
with check (false);

drop policy if exists "volunteer_logs_no_direct_update" on public.volunteer_logs;
create policy volunteer_logs_no_direct_update on public.volunteer_logs
for update
using (false)
with check (false);

drop policy if exists "volunteer_logs_no_direct_delete" on public.volunteer_logs;
create policy volunteer_logs_no_direct_delete on public.volunteer_logs
for delete
using (false);

-- record_baseline_assessment: admin-only port of POST /admin/baseline-assessments.
-- percentage is computed server-side (Fastify computed it in the route
-- handler; here it's computed once, centrally, in the RPC). Fires the
-- baseline_assessment_created student notification exactly like Fastify's
-- createStudentNotification side effect.
create or replace function public.record_baseline_assessment(
  p_student_id uuid,
  p_subject text,
  p_score numeric,
  p_total numeric,
  p_grade text default null,
  p_level_band text default null,
  p_cognitive_breakdown jsonb default '{}'::jsonb,
  p_topic_breakdown jsonb default '{}'::jsonb,
  p_recommended_next_steps jsonb default '[]'::jsonb,
  p_completed_at timestamptz default now(),
  p_source_type public.baseline_source_type default 'manual'
)
returns public.baseline_assessments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_percentage numeric;
  v_row public.baseline_assessments;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_score < 0 or p_score > 100000 or p_total <= 0 or p_total > 100000 then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  v_percentage := round((p_score / p_total) * 100, 2);

  insert into public.baseline_assessments
    (student_id, subject, grade, score, total, percentage, level_band,
     cognitive_breakdown_json, topic_breakdown_json, recommended_next_steps_json,
     completed_at, created_by, source_type)
  values
    (p_student_id, p_subject, p_grade, p_score, p_total, v_percentage, p_level_band,
     p_cognitive_breakdown, p_topic_breakdown, p_recommended_next_steps,
     p_completed_at, public.current_profile_id(), p_source_type)
  returning * into v_row;

  perform public.create_student_notification(
    p_student_id,
    'baseline_assessment_created',
    'Baseline assessment ready',
    p_subject || ' baseline assessment has been recorded.',
    '/dashboard/',
    'baseline_assessment',
    v_row.id,
    '{}'::jsonb
  );

  return v_row;
end;
$$;

-- create_learning_goal: admin-only port of POST /admin/learning-goals. Fires
-- the learning_goal_created notification ONLY when visible_to_student
-- (Fastify's exact `if (data.visibleToStudent) { ... }` gate).
create or replace function public.create_learning_goal(
  p_student_id uuid,
  p_title text,
  p_description text default null,
  p_category public.learning_goal_category default 'academic',
  p_subject text default null,
  p_target_value numeric default null,
  p_current_value numeric default null,
  p_due_date date default null,
  p_status public.learning_goal_status default 'active',
  p_visible_to_student boolean default true,
  p_visible_to_tutor boolean default true
)
returns public.learning_goals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.learning_goals;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.learning_goals
    (student_id, title, description, category, subject, target_value, current_value,
     due_date, status, created_by, visible_to_student, visible_to_tutor)
  values
    (p_student_id, p_title, p_description, p_category, p_subject, p_target_value, p_current_value,
     p_due_date, p_status, public.current_profile_id(), p_visible_to_student, p_visible_to_tutor)
  returning * into v_row;

  if v_row.visible_to_student then
    perform public.create_student_notification(
      p_student_id,
      'learning_goal_created',
      'New goal added',
      v_row.title || ' has been added to your study plan.',
      '/dashboard/',
      'learning_goal',
      v_row.id,
      '{}'::jsonb
    );
  end if;

  return v_row;
end;
$$;

-- update_learning_goal: admin-only port of PATCH /admin/learning-goals/:id.
-- Every field is optional and coalesces against the current row when omitted
-- -- an exact port of Fastify's `data.field ?? current.field` pattern
-- (including its inability to explicitly clear a nullable field back to
-- null, since omitted-vs-explicit-null are indistinguishable once coalesced;
-- this is a faithful port of an existing Fastify limitation, not a new one).
-- Fires learning_goal_completed / learning_goal_updated exactly like
-- Fastify's status-dependent notification choice, gated on visible_to_student.
create or replace function public.update_learning_goal(
  p_goal_id uuid,
  p_title text default null,
  p_description text default null,
  p_category public.learning_goal_category default null,
  p_subject text default null,
  p_target_value numeric default null,
  p_current_value numeric default null,
  p_due_date date default null,
  p_status public.learning_goal_status default null,
  p_visible_to_student boolean default null,
  p_visible_to_tutor boolean default null
)
returns public.learning_goals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.learning_goals;
  v_row public.learning_goals;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_current from public.learning_goals where id = p_goal_id;
  if not found then
    raise exception 'goal_not_found' using errcode = 'P0002';
  end if;

  update public.learning_goals
  set title = coalesce(p_title, title),
      description = coalesce(p_description, description),
      category = coalesce(p_category, category),
      subject = coalesce(p_subject, subject),
      target_value = coalesce(p_target_value, target_value),
      current_value = coalesce(p_current_value, current_value),
      due_date = coalesce(p_due_date, due_date),
      status = coalesce(p_status, status),
      visible_to_student = coalesce(p_visible_to_student, visible_to_student),
      visible_to_tutor = coalesce(p_visible_to_tutor, visible_to_tutor),
      updated_at = now()
  where id = p_goal_id
  returning * into v_row;

  if v_row.visible_to_student then
    perform public.create_student_notification(
      v_current.student_id,
      case when p_status = 'completed' then 'learning_goal_completed' else 'learning_goal_updated' end,
      case when p_status = 'completed' then 'Goal completed' else 'Goal updated' end,
      case when p_status = 'completed'
        then v_row.title || ' is now marked as completed.'
        else v_row.title || ' has been updated.' end,
      '/dashboard/',
      'learning_goal',
      v_row.id,
      '{}'::jsonb
    );
  end if;

  return v_row;
end;
$$;

-- create_exam_event: admin-only port of POST /admin/exam-events. No
-- notification (Fastify's own route has none).
create or replace function public.create_exam_event(
  p_student_id uuid,
  p_subject text,
  p_title text,
  p_exam_date date
)
returns public.student_exam_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.student_exam_events;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.student_exam_events (student_id, subject, title, exam_date, created_by)
  values (p_student_id, p_subject, p_title, p_exam_date, public.current_profile_id())
  returning * into v_row;

  return v_row;
end;
$$;

-- create_volunteer_event: admin-only port of POST /admin/volunteer/events.
create or replace function public.create_volunteer_event(
  p_title text,
  p_description text default null,
  p_event_date date default null,
  p_start_time time default null,
  p_end_time time default null,
  p_location text default null,
  p_mode text default 'in-person',
  p_status public.volunteer_event_status default 'planned'
)
returns public.volunteer_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.volunteer_events;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_mode, ''))) = 0 or char_length(p_mode) > 40 then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  insert into public.volunteer_events
    (title, description, event_date, start_time, end_time, location, mode, status, created_by)
  values
    (p_title, p_description, p_event_date, p_start_time, p_end_time, p_location, p_mode, p_status, public.current_profile_id())
  returning * into v_row;

  return v_row;
end;
$$;

-- create_volunteer_log: tutor-self-service port of POST /tutor/volunteer/logs.
-- status is derived exactly like Fastify: 'submitted' when hours is provided,
-- else 'signed_up'. Tightened beyond Fastify (defense in depth, matching the
-- tutor-onboarding migration's storage_key ownership precedent): when
-- p_evidence_document_id is provided it must belong to the calling tutor --
-- Fastify's own Zod schema never verified this.
create or replace function public.create_volunteer_log(
  p_event_id uuid default null,
  p_hours numeric default null,
  p_volunteered_on date default null,
  p_notes text default null,
  p_evidence_document_id uuid default null
)
returns public.volunteer_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := public.current_tutor_id();
  v_status public.volunteer_log_status;
  v_row public.volunteer_logs;
begin
  if v_tutor_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_evidence_document_id is not null and not exists (
    select 1 from public.tutor_documents
    where id = p_evidence_document_id and tutor_id = v_tutor_id
  ) then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  v_status := case when p_hours is not null then 'submitted' else 'signed_up' end;

  insert into public.volunteer_logs
    (tutor_id, event_id, status, hours, volunteered_on, notes, evidence_document_id, submitted_at)
  values
    (v_tutor_id, p_event_id, v_status, p_hours, p_volunteered_on, p_notes, p_evidence_document_id,
     case when v_status = 'submitted' then now() else null end)
  returning * into v_row;

  return v_row;
end;
$$;

-- verify_volunteer_log: admin-only port of POST /admin/volunteer/logs/:id/verify.
-- Same allowed-from-status set Fastify's `where status in (...)` enforced.
create or replace function public.verify_volunteer_log(
  p_log_id uuid,
  p_status public.volunteer_log_status,
  p_admin_note text default null
)
returns public.volunteer_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.volunteer_logs;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_status not in ('verified', 'rejected') then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  update public.volunteer_logs
  set status = p_status,
      admin_note = p_admin_note,
      verified_by = public.current_profile_id(),
      verified_at = now(),
      updated_at = now()
  where id = p_log_id
    and status in ('submitted', 'signed_up', 'rejected')
  returning * into v_row;

  if not found then
    raise exception 'volunteer_log_not_found' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

-- --- Grants: all seven callable by authenticated; each self-gates internally
-- (admin-only checks above; create_volunteer_log on current_tutor_id() null-
-- check + ownership). No client ever writes these tables directly (RLS denies).
grant execute on function public.record_baseline_assessment(uuid, text, numeric, numeric, text, text, jsonb, jsonb, jsonb, timestamptz, public.baseline_source_type) to authenticated;
grant execute on function public.create_learning_goal(uuid, text, text, public.learning_goal_category, text, numeric, numeric, date, public.learning_goal_status, boolean, boolean) to authenticated;
grant execute on function public.update_learning_goal(uuid, text, text, public.learning_goal_category, text, numeric, numeric, date, public.learning_goal_status, boolean, boolean) to authenticated;
grant execute on function public.create_exam_event(uuid, text, text, date) to authenticated;
grant execute on function public.create_volunteer_event(text, text, date, time, time, text, text, public.volunteer_event_status) to authenticated;
grant execute on function public.create_volunteer_log(uuid, numeric, date, text, uuid) to authenticated;
grant execute on function public.verify_volunteer_log(uuid, public.volunteer_log_status, text) to authenticated;

-- ============================================================================
-- Base table privileges for anon/authenticated/service_role -- fixes a real
-- gap, not a design choice. This schema was written assuming the standard
-- Supabase project bootstrap (which auto-grants SELECT/INSERT/UPDATE/DELETE
-- on public schema tables to these three roles when a project is created
-- through the dashboard/platform) would always be present. Confirmed by
-- directly applying this schema to a freshly-created local Postgres via the
-- Supabase CLI: `\dp public.profiles` showed anon/authenticated/service_role
-- with only Dxt (delete/references/trigger) -- missing r/a/w (select/insert/
-- update) entirely -- so every table in this schema was, in that scenario,
-- completely unreachable via PostgREST for anon/authenticated regardless of
-- RLS, and even service_role (which bypasses RLS via BYPASSRLS) still needs
-- these ordinary GRANTs, since RLS bypass and table-level privilege are two
-- separate Postgres permission systems. RLS (already defined per-table above)
-- remains the actual access boundary for anon/authenticated; granting broad
-- table privileges here is the standard, safe PostgREST-with-RLS pattern
-- (grant broadly at the SQL layer, restrict via policy). `alter default
-- privileges` additionally covers any table created after this point without
-- a full schema.sql replay.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;

-- public.profile_identities is the one deliberate exception (see the
-- "Identity lookup shadow table" comment far above, near current_profile_role()):
-- it must stay reachable ONLY by SECURITY DEFINER functions, never directly.
revoke all on public.profile_identities from anon, authenticated;
