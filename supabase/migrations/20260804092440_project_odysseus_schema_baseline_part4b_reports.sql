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

alter table public.student_notifications add column if not exists created_by uuid references public.profiles(id);

create index if not exists idx_student_notifications_student_created on public.student_notifications(student_id, created_at desc);
create index if not exists idx_student_notifications_student_read on public.student_notifications(student_id, is_read, created_at desc);

alter table public.weekly_reports enable row level security;
alter table public.student_notifications enable row level security;

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

  select pr.full_name, st.grade
    into v_student_name, v_student_grade
  from public.students st
  join public.profiles pr on pr.id = st.profile_id
  where st.id = p_student_id;
  if not found then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;

  select
    coalesce(count(*) filter (where status = 'approved'), 0)::int,
    coalesce(sum(duration_minutes) filter (where status = 'approved'), 0)::int
    into v_attended, v_minutes
  from public.sessions
  where student_id = p_student_id
    and date between v_week_start and v_week_end;

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

grant execute on function public.generate_weekly_report(uuid, date) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
revoke execute on function public.create_student_notification(uuid, text, text, text, text, text, uuid, jsonb) from public;
revoke execute on function public.create_student_notification(uuid, text, text, text, text, text, uuid, jsonb) from anon;
revoke execute on function public.create_student_notification(uuid, text, text, text, text, text, uuid, jsonb) from authenticated;;
