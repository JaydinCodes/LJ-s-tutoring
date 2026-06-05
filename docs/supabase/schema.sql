-- Project Odysseus initial Supabase LMS schema plan.
-- This is additive planning SQL for a Supabase project, not yet wired into the existing Prisma migrations.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('student', 'tutor', 'admin', 'parent', 'ngo_partner');
create type public.record_status as enum ('active', 'inactive', 'pending', 'approved', 'suspended');
create type public.assignment_status as enum ('draft', 'published', 'closed', 'archived');
create type public.submission_status as enum ('not_submitted', 'submitted', 'marked', 'returned');
create type public.payment_status as enum ('pending', 'paid', 'overdue', 'voided');

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
  created_at timestamptz not null default now()
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
  unique (assignment_id, student_id, version_number)
);

alter table public.assignment_submissions
  add constraint assignment_submissions_marks_range
  check (marks_awarded is null or (marks_awarded >= 0 and marks_awarded <= 100));

create table if not exists public.student_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid references public.subjects(id),
  topic text not null,
  score numeric(5, 2) not null check (score >= 0 and score <= 100),
  cognitive_level text,
  recorded_at timestamptz not null default now()
);

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tutor_id, student_id)
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_students_ngo_partner on public.students(ngo_partner_id);
create index if not exists idx_student_career_profiles_student_updated on public.student_career_profiles(student_id, updated_at desc);
create index if not exists idx_assignments_due_date on public.assignments(due_date);
create index if not exists idx_submissions_student on public.assignment_submissions(student_id);
create index if not exists idx_submissions_student_assignment on public.assignment_submissions(student_id, assignment_id);
create unique index if not exists idx_submissions_latest_assignment_student
  on public.assignment_submissions(assignment_id, student_id)
  where is_latest;
create index if not exists idx_submissions_assignment_versions
  on public.assignment_submissions(assignment_id, student_id, version_number desc);
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
alter table public.student_career_profiles enable row level security;
alter table public.tutors enable row level security;
alter table public.ngo_partners enable row level security;
alter table public.subjects enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.student_progress enable row level security;
alter table public.payments enable row level security;
alter table public.tutor_payments enable row level security;
alter table public.classes enable row level security;
alter table public.class_enrollments enable row level security;
alter table public.tutor_student_allocations enable row level security;

create or replace function public.current_profile_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where auth_user_id = auth.uid()
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid()
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
  join public.profiles p on p.id = s.profile_id
  where p.auth_user_id = auth.uid()
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
  join public.profiles p on p.id = t.profile_id
  where p.auth_user_id = auth.uid()
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

  return query select v_submission_id;
end;
$$;

create or replace function public.mark_assignment_submission(
  p_submission_id uuid,
  p_marks_awarded numeric,
  p_feedback text,
  p_status public.submission_status
)
returns setof public.assignment_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
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

  update public.assignment_submissions
  set marks_awarded = p_marks_awarded,
      feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
      status = p_status
  where id = p_submission_id
  returning * into v_submission;

  if not found then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;

  if p_status = 'marked' and p_marks_awarded is not null then
    select * into v_assignment
    from public.assignments
    where id = v_submission.assignment_id;

    insert into public.student_progress (
      student_id,
      subject_id,
      topic,
      score,
      cognitive_level,
      recorded_at
    )
    values (
      v_submission.student_id,
      v_assignment.subject_id,
      coalesce(v_assignment.title, 'Marked assignment'),
      p_marks_awarded,
      null,
      now()
    );
  end if;

  return next v_submission;
end;
$$;

grant execute on function public.submit_assignment_submission(uuid, uuid, text, text, text, text, bigint, text) to authenticated;
grant execute on function public.mark_assignment_submission(uuid, numeric, text, public.submission_status) to authenticated;

create policy "profiles_select_self_or_admin"
on public.profiles for select
using (auth_user_id = auth.uid() or public.current_profile_role() = 'admin');

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

create policy "profiles_insert_self_student_or_tutor"
on public.profiles for insert
with check (
  auth_user_id = auth.uid()
  and role in ('student', 'tutor', 'parent')
);

create policy "admin_full_access_profiles"
on public.profiles for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy "students_select_self_or_admin"
on public.students for select
using (
  public.current_profile_role() = 'admin'
  or profile_id in (select id from public.profiles where auth_user_id = auth.uid())
  or id in (
    select tsa.student_id
    from public.tutor_student_allocations tsa
    where tsa.tutor_id = public.current_tutor_id()
      and tsa.status = 'active'
  )
);

create policy "students_insert_self"
on public.students for insert
with check (
  profile_id in (
    select id from public.profiles
    where auth_user_id = auth.uid()
    and role = 'student'
  )
);

create policy "admin_full_access_students"
on public.students for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy "students_select_own_career_profile"
on public.student_career_profiles for select
using (
  student_id in (
    select s.id from public.students s
    join public.profiles p on p.id = s.profile_id
    where p.auth_user_id = auth.uid()
  )
);

create policy "students_upsert_own_career_profile"
on public.student_career_profiles for all
using (
  student_id in (
    select s.id from public.students s
    join public.profiles p on p.id = s.profile_id
    where p.auth_user_id = auth.uid()
  )
)
with check (
  student_id in (
    select s.id from public.students s
    join public.profiles p on p.id = s.profile_id
    where p.auth_user_id = auth.uid()
  )
);

create policy "tutors_select_self_or_admin"
on public.tutors for select
using (
  public.current_profile_role() = 'admin'
  or profile_id in (select id from public.profiles where auth_user_id = auth.uid())
  or id in (
    select tsa.tutor_id
    from public.tutor_student_allocations tsa
    where tsa.student_id = public.current_student_id()
      and tsa.status = 'active'
  )
);

create policy "tutors_insert_self_pending"
on public.tutors for insert
with check (
  status = 'pending'
  and profile_id in (
    select id from public.profiles
    where auth_user_id = auth.uid()
    and role = 'tutor'
  )
);

create policy "admin_full_access_tutors"
on public.tutors for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy "subjects_read_authenticated"
on public.subjects for select
using (auth.uid() is not null);

create policy "admin_manage_subjects"
on public.subjects for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy "tutors_insert_subjects"
on public.subjects for insert
with check (public.current_profile_role() = 'tutor');

create policy "assignments_read_authenticated"
on public.assignments for select
using (auth.uid() is not null);

create policy "admin_manage_assignments"
on public.assignments for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

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

create policy "submissions_student_self_or_admin"
on public.assignment_submissions for select
using (
  public.current_profile_role() = 'admin'
  or student_id in (
    select s.id from public.students s
    join public.profiles p on p.id = s.profile_id
    where p.auth_user_id = auth.uid()
  )
);

drop policy if exists "submissions_student_insert_self" on public.assignment_submissions;
drop policy if exists "submissions_student_update_self" on public.assignment_submissions;
drop policy if exists "submissions_student_mark_previous_versions" on public.assignment_submissions;
drop policy if exists "tutors_update_own_assignment_submissions" on public.assignment_submissions;
drop policy if exists "tutor_insert_progress" on public.student_progress;

create policy "submissions_student_insert_via_rpc_guard"
on public.assignment_submissions for insert
with check (
  false
);

create policy "submissions_no_direct_student_update"
on public.assignment_submissions for update
using (
  false
)
with check (
  false
);

create policy "submissions_tutor_mark_via_rpc_only"
on public.assignment_submissions for update
using (
  false
)
with check (
  false
);

create policy "submissions_student_rpc_insert_shape"
on public.assignment_submissions for insert
with check (
  status = 'submitted'
  and is_latest = true
  and marks_awarded is null
  and feedback is null
  and exists (
    select 1 from public.assignments a
    where a.id = assignment_id
      and a.status = 'published'
  )
  and
  student_id in (
    select s.id from public.students s
    join public.profiles p on p.id = s.profile_id
    where p.auth_user_id = auth.uid()
  )
);

create policy "admin_manage_submissions"
on public.assignment_submissions for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy "tutors_select_own_assignment_submissions"
on public.assignment_submissions for select
using (
  assignment_id in (
    select a.id from public.assignments a
    join public.profiles p on p.id = a.created_by
    where p.auth_user_id = auth.uid()
      and p.role = 'tutor'
  )
);

create policy "student_progress_self_or_admin"
on public.student_progress for select
using (
  public.current_profile_role() = 'admin'
  or student_id in (
    select s.id from public.students s
    join public.profiles p on p.id = s.profile_id
    where p.auth_user_id = auth.uid()
  )
);

create policy "admin_manage_progress"
on public.student_progress for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy "progress_insert_via_marking_rpc_only"
on public.student_progress for insert
with check (false);

create policy "admin_finance_access"
on public.payments for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy "admin_tutor_payment_access"
on public.tutor_payments for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "classes_read_authenticated" on public.classes;

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

create policy "admin_manage_classes"
on public.classes for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "class_enrollments_read_authenticated" on public.class_enrollments;

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

create policy "admin_manage_class_enrollments"
on public.class_enrollments for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

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

create policy "admin_manage_tutor_student_allocations"
on public.tutor_student_allocations for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

insert into storage.buckets (id, name, public)
values
  ('assignment-files', 'assignment-files', false),
  ('assignment-submissions', 'assignment-submissions', false)
on conflict (id) do nothing;

create policy "admin_tutor_upload_assignment_files"
on storage.objects for insert
with check (
  bucket_id = 'assignment-files'
  and public.current_profile_role() in ('admin', 'tutor')
);

create policy "authenticated_read_assignment_files"
on storage.objects for select
using (
  bucket_id = 'assignment-files'
  and auth.uid() is not null
);

create policy "students_upload_own_submission_files"
on storage.objects for insert
with check (
  bucket_id = 'assignment-submissions'
  and public.current_profile_role() = 'student'
  and array_length(storage.foldername(name), 1) = 4
  and (storage.foldername(name))[1] in (
    select s.id::text from public.students s
    join public.profiles p on p.id = s.profile_id
    where p.auth_user_id = auth.uid()
  )
  and (storage.foldername(name))[2] in (
    select a.id::text from public.assignments a
    where a.status = 'published'
  )
);

create policy "students_update_own_submission_files"
on storage.objects for update
using (
  bucket_id = 'assignment-submissions'
  and public.current_profile_role() = 'student'
  and array_length(storage.foldername(name), 1) = 4
  and (storage.foldername(name))[1] in (
    select s.id::text from public.students s
    join public.profiles p on p.id = s.profile_id
    where p.auth_user_id = auth.uid()
  )
)
with check (
  bucket_id = 'assignment-submissions'
  and public.current_profile_role() = 'student'
  and array_length(storage.foldername(name), 1) = 4
  and (storage.foldername(name))[1] in (
    select s.id::text from public.students s
    join public.profiles p on p.id = s.profile_id
    where p.auth_user_id = auth.uid()
  )
);

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
        join public.profiles p on p.id = a.created_by
        where p.auth_user_id = auth.uid()
      )
    )
    or (storage.foldername(name))[1] in (
      select s.id::text from public.students s
      join public.profiles p on p.id = s.profile_id
      where p.auth_user_id = auth.uid()
    )
  )
);
