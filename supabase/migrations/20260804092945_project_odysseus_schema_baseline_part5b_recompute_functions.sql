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
  if not coalesce(public.is_platform_admin() or public.current_student_id() = p_student_id, false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select grade into v_student_grade from public.students where id = p_student_id;
  if not found then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;

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

  select id, topic, score
    into v_weak_progress_id, v_weak_topic, v_weak_score
  from public.student_progress
  where student_id = p_student_id
    and recorded_at >= (p_score_date::timestamptz - interval '60 day')
  order by score asc, topic asc
  limit 1;

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

  select count(*) filter (where status = 'approved')
    into v_approved_sessions_14
  from public.sessions
  where student_id = p_student_id
    and date between v_window_start and current_date;
  v_attendance_score := least(100, v_approved_sessions_14 * 10);

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
$$;;
