grant execute on function public.recompute_student_risk_snapshot(uuid, date) to authenticated;
grant execute on function public.recompute_career_progress_snapshot(uuid, text, text[]) to authenticated;

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

alter table public.student_exam_events add column if not exists created_by uuid references public.profiles(id);
alter table public.student_exam_events add column if not exists organization_id uuid not null references public.organizations(id);

create index if not exists idx_student_exam_events_student_date on public.student_exam_events(student_id, exam_date);
create index if not exists idx_student_exam_events_organization on public.student_exam_events(organization_id);

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

grant execute on function public.record_baseline_assessment(uuid, text, numeric, numeric, text, text, jsonb, jsonb, jsonb, timestamptz, public.baseline_source_type) to authenticated;
grant execute on function public.create_learning_goal(uuid, text, text, public.learning_goal_category, text, numeric, numeric, date, public.learning_goal_status, boolean, boolean) to authenticated;
grant execute on function public.update_learning_goal(uuid, text, text, public.learning_goal_category, text, numeric, numeric, date, public.learning_goal_status, boolean, boolean) to authenticated;
grant execute on function public.create_exam_event(uuid, text, text, date) to authenticated;
grant execute on function public.create_volunteer_event(text, text, date, time, time, text, text, public.volunteer_event_status) to authenticated;
grant execute on function public.create_volunteer_log(uuid, numeric, date, text, uuid) to authenticated;
grant execute on function public.verify_volunteer_log(uuid, public.volunteer_log_status, text) to authenticated;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'community_moderation_state') then
    create type public.community_moderation_state as enum ('visible', 'flagged');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'community_question_status') then
    create type public.community_question_status as enum ('open', 'resolved', 'closed');
  end if;
end
$$;

create table if not exists public.community_study_rooms (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  grade text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.community_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.community_study_rooms(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (room_id, profile_id)
);

create table if not exists public.community_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.community_study_rooms(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  moderation_state public.community_moderation_state not null default 'visible',
  moderation_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.community_challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  grade text,
  week_start date not null,
  week_end date not null,
  xp_reward int not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.community_challenge_submissions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.community_challenges(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  unique (challenge_id, profile_id)
);

create table if not exists public.community_questions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  topic text not null,
  title text not null,
  body text not null,
  status public.community_question_status not null default 'open',
  moderation_state public.community_moderation_state not null default 'visible',
  moderation_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);;
