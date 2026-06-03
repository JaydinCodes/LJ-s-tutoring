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
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  subject_id uuid references public.subjects(id),
  grade text,
  location text,
  day_of_week text,
  start_time time,
  end_time time,
  ngo_partner_id uuid references public.ngo_partners(id)
);

create table if not exists public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (class_id, student_id)
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

create policy "profiles_select_self_or_admin"
on public.profiles for select
using (auth_user_id = auth.uid() or public.current_profile_role() = 'admin');

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

create policy "submissions_student_insert_self"
on public.assignment_submissions for insert
with check (
  status = 'submitted'
  and is_latest = true
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

create policy "submissions_student_update_self"
on public.assignment_submissions for update
using (
  false
)
with check (
  false
);

create policy "submissions_student_mark_previous_versions"
on public.assignment_submissions for update
using (
  student_id in (
    select s.id from public.students s
    join public.profiles p on p.id = s.profile_id
    where p.auth_user_id = auth.uid()
  )
)
with check (
  status in ('submitted', 'returned')
  and is_latest = false
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

create policy "tutors_update_own_assignment_submissions"
on public.assignment_submissions for update
using (
  assignment_id in (
    select a.id from public.assignments a
    join public.profiles p on p.id = a.created_by
    where p.auth_user_id = auth.uid()
      and p.role = 'tutor'
  )
)
with check (
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

create policy "tutor_insert_progress"
on public.student_progress for insert
with check (public.current_profile_role() = 'tutor');

create policy "admin_finance_access"
on public.payments for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy "admin_tutor_payment_access"
on public.tutor_payments for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy "classes_read_authenticated"
on public.classes for select
using (auth.uid() is not null);

create policy "admin_manage_classes"
on public.classes for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy "class_enrollments_read_authenticated"
on public.class_enrollments for select
using (auth.uid() is not null);

create policy "admin_manage_class_enrollments"
on public.class_enrollments for all
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
  and (storage.foldername(name))[3] is not null
  and (storage.foldername(name))[1] in (
    select s.id::text from public.students s
    join public.profiles p on p.id = s.profile_id
    where p.auth_user_id = auth.uid()
  )
);

create policy "students_update_own_submission_files"
on storage.objects for update
using (
  bucket_id = 'assignment-submissions'
  and public.current_profile_role() = 'student'
  and (storage.foldername(name))[3] is not null
  and (storage.foldername(name))[1] in (
    select s.id::text from public.students s
    join public.profiles p on p.id = s.profile_id
    where p.auth_user_id = auth.uid()
  )
)
with check (
  bucket_id = 'assignment-submissions'
  and public.current_profile_role() = 'student'
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
