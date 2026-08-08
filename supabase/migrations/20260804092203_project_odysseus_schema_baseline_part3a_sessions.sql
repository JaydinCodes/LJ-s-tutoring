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

update public.students
set organization_id = (select id from public.organizations where type = 'direct' limit 1)
where organization_id is null;

update public.classes
set organization_id = (select id from public.organizations where type = 'direct' limit 1)
where organization_id is null;

update public.assignments
set organization_id = (select id from public.organizations where type = 'direct' limit 1)
where organization_id is null;

alter table public.students alter column organization_id set not null;
alter table public.classes alter column organization_id set not null;
alter table public.assignments alter column organization_id set not null;

drop policy if exists "assignments_student_read_published_own_org" on public.assignments;
create policy "assignments_student_read_published_own_org"
on public.assignments for select
using (
  status = 'published'
  and organization_id = public.current_student_org_id()
);

drop policy if exists "assignments_read_authenticated" on public.assignments;

drop policy if exists "authenticated_read_assignment_files" on storage.objects;
create policy "authenticated_read_assignment_files"
on storage.objects for select
using (
  bucket_id = 'assignment-files'
  and (
    public.is_platform_admin()
    or (
      public.current_profile_role() = 'tutor'
      and exists (
        select 1 from public.assignments a
        where a.id::text = (storage.foldername(name))[1]
          and a.created_by = public.current_profile_id()
      )
    )
    or (
      public.current_profile_role() = 'student'
      and exists (
        select 1 from public.assignments a
        where a.id::text = (storage.foldername(name))[1]
          and a.status = 'published'
          and a.organization_id = public.current_student_org_id()
      )
    )
  )
);

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
      and a.organization_id = public.current_student_org_id()
  )
);

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
      and a.organization_id = public.current_student_org_id()
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
      and a.organization_id = public.current_student_org_id()
  )
);

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

  if v_assignment.status <> 'published' or v_assignment.organization_id <> public.current_student_org_id() then
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

do $$
begin
  if not exists (select 1 from pg_type where typname = 'session_status') then
    create type public.session_status as enum ('draft', 'submitted', 'approved', 'rejected');
  end if;
end
$$;

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

alter table public.sessions add column if not exists organization_id uuid not null references public.organizations(id);
alter table public.sessions add column if not exists tutor_student_allocation_id uuid not null references public.tutor_student_allocations(id);

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

alter table public.session_history add column if not exists changed_by_profile_id uuid references public.profiles(id);

create index if not exists idx_sessions_tutor_date on public.sessions(tutor_id, date);
create index if not exists idx_sessions_student_date on public.sessions(student_id, date desc, start_time desc);
create index if not exists idx_sessions_organization on public.sessions(organization_id);
create unique index if not exists idx_sessions_tutor_sync_key on public.sessions(tutor_id, sync_key) where sync_key is not null;
create index if not exists idx_session_history_session on public.session_history(session_id);

alter table public.sessions enable row level security;
alter table public.session_history enable row level security;

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

  if v_key is not null then
    select * into v_existing
    from public.sessions
    where tutor_id = v_tutor_id and sync_key = v_key
    limit 1;
    if found then
      return v_existing;
    end if;
  end if;

  if exists (
    select 1 from public.sessions
    where tutor_id = v_tutor_id
      and date = p_date
      and not (end_time <= p_start_time or start_time >= p_end_time)
  ) then
    raise exception 'overlapping_session' using errcode = '23505';
  end if;

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

grant execute on function public.create_session(uuid, uuid, date, time, time, text, text, text, text) to authenticated;
grant execute on function public.update_session(uuid, date, time, time, text, text, text) to authenticated;
grant execute on function public.submit_session_report(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.submit_session(uuid) to authenticated;
grant execute on function public.approve_session(uuid) to authenticated;
grant execute on function public.reject_session(uuid, text) to authenticated;
grant execute on function public.get_student_sessions() to authenticated;
revoke execute on function public.insert_session_history(uuid, text, jsonb, jsonb) from public;
revoke execute on function public.insert_session_history(uuid, text, jsonb, jsonb) from anon;
revoke execute on function public.insert_session_history(uuid, text, jsonb, jsonb) from authenticated;;
