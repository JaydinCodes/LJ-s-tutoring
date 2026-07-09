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

alter table public.assignment_submissions
  add constraint assignment_submissions_marks_range
  check (marks_awarded is null or (marks_awarded >= 0 and marks_awarded <= 100));

alter table public.assignments add column if not exists rubric_json jsonb not null default '[]'::jsonb;
alter table public.assignment_submissions add column if not exists rubric_scores_json jsonb not null default '{}'::jsonb;
alter table public.assignment_submissions add column if not exists marks_released boolean not null default false;
alter table public.assignment_submissions add column if not exists feedback_released boolean not null default false;
alter table public.assignment_submissions add column if not exists released_at timestamptz;

alter table public.assignments
  add constraint assignments_rubric_json_array
  check (jsonb_typeof(rubric_json) = 'array');

alter table public.assignment_submissions
  add constraint assignment_submissions_rubric_scores_object
  check (jsonb_typeof(rubric_scores_json) = 'object');

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
create index if not exists idx_guardians_profile on public.guardians(profile_id);
create index if not exists idx_student_guardians_student on public.student_guardians(student_id, status);
create index if not exists idx_student_guardians_guardian on public.student_guardians(guardian_id, status);
create index if not exists idx_student_career_profiles_student_updated on public.student_career_profiles(student_id, updated_at desc);
create index if not exists idx_assignments_due_date on public.assignments(due_date);
create index if not exists idx_submissions_student on public.assignment_submissions(student_id);
create index if not exists idx_submissions_student_assignment on public.assignment_submissions(student_id, assignment_id);
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

create policy "admin_select_audit_log"
on public.audit_log for select
using (public.current_profile_role() = 'admin');

create policy "no_direct_audit_log_insert"
on public.audit_log for insert
with check (false);

create policy "no_direct_audit_log_update"
on public.audit_log for update
using (false)
with check (false);

create policy "no_direct_audit_log_delete"
on public.audit_log for delete
using (false);

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

create policy "guardians_select_scoped"
on public.guardians for select
using (
  public.current_profile_role() = 'admin'
  or profile_id = public.current_profile_id()
);

create policy "admin_manage_guardians"
on public.guardians for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

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

create policy "admin_manage_student_guardians"
on public.student_guardians for all
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

create index if not exists idx_privacy_requests_subject_student
  on public.privacy_requests(subject_student_id);

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
