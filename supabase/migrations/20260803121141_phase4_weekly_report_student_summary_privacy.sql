-- Phase 4 confidentiality fix: weekly reports are learner/guardian-visible.
-- Only the deliberately learner-facing summary from an approved session may
-- appear in tutorNotesSummary; general notes and tutor-private notes stay out.

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
    select left(btrim(s.student_summary), 120) as line,
           row_number() over (order by s.date desc, s.start_time desc, s.id) as rn
    from public.sessions s
    where s.student_id = p_student_id
      and s.date between v_week_start and v_week_end
      and s.status = 'approved'
      and nullif(btrim(coalesce(s.student_summary, '')), '') is not null
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

revoke execute on function public.generate_weekly_report(uuid, date) from public;
revoke execute on function public.generate_weekly_report(uuid, date) from anon;
grant execute on function public.generate_weekly_report(uuid, date) to authenticated;
