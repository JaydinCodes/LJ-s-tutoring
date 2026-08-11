-- REL-11: rebuild stale persisted weekly-report snapshots without relying on
-- a browser/admin to revisit each report. Row locks with SKIP LOCKED prevent
-- concurrent cron invocations from rebuilding the same snapshot.

create function public.refresh_stale_weekly_reports(p_limit integer default 10)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.weekly_reports%rowtype;
  v_week_start date;
  v_week_end date;
  v_student_name text;
  v_student_grade text;
  v_attended integer;
  v_minutes integer;
  v_notes_summary jsonb;
  v_topic_progress jsonb;
  v_weak_topic text;
  v_weak_completion integer;
  v_goals jsonb;
  v_payload jsonb;
  v_refreshed integer := 0;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  for v_report in
    select * from public.weekly_reports
    where is_stale = true
    order by stale_since nulls last, created_at
    limit least(greatest(coalesce(p_limit, 10), 1), 25)
    for update skip locked
  loop
    v_week_start := date_trunc('week', v_report.week_start::timestamp)::date;
    v_week_end := v_week_start + 6;

    select pr.full_name, st.grade into v_student_name, v_student_grade
    from public.students st join public.profiles pr on pr.id = st.profile_id
    where st.id = v_report.student_id;
    if not found then continue; end if;

    select coalesce(count(*) filter (where status = 'approved'), 0)::integer,
           coalesce(sum(duration_minutes) filter (where status = 'approved'), 0)::integer
      into v_attended, v_minutes
    from public.sessions
    where student_id = v_report.student_id and date between v_week_start and v_week_end;

    select coalesce(jsonb_agg(sub.line order by sub.rn), '[]'::jsonb) into v_notes_summary
    from (
      select left(btrim(s.student_summary), 120) as line,
             row_number() over (order by s.date desc, s.start_time desc, s.id) as rn
      from public.sessions s
      where s.student_id = v_report.student_id
        and s.date between v_week_start and v_week_end
        and s.status = 'approved'
        and nullif(btrim(coalesce(s.student_summary, '')), '') is not null
    ) sub where sub.rn <= 3;

    select coalesce(jsonb_agg(jsonb_build_object(
      'subject', t.subject, 'topic', t.topic, 'completion', t.completion
    ) order by t.completion asc, t.topic asc), '[]'::jsonb) into v_topic_progress
    from (
      select coalesce(subj.name, 'General') as subject, sp.topic,
             greatest(0, least(100, round(avg(sp.score))))::integer as completion
      from public.student_progress sp
      left join public.subjects subj on subj.id = sp.subject_id
      where sp.student_id = v_report.student_id
      group by coalesce(subj.name, 'General'), sp.topic
    ) t;

    select t.topic, t.completion into v_weak_topic, v_weak_completion
    from (
      select sp.topic, greatest(0, least(100, round(avg(sp.score))))::integer as completion
      from public.student_progress sp
      left join public.subjects subj on subj.id = sp.subject_id
      where sp.student_id = v_report.student_id
      group by coalesce(subj.name, 'General'), sp.topic
    ) t order by t.completion asc, t.topic asc limit 1;

    v_goals := case when v_weak_topic is not null then jsonb_build_array(
      'Lift ' || v_weak_topic || ' to at least ' || least(100, v_weak_completion + 15)::text || '% mastery.'
    ) else jsonb_build_array('Complete at least one focused practice session.') end;
    v_payload := jsonb_build_object(
      'student', jsonb_build_object('id', v_report.student_id, 'name', v_student_name, 'grade', v_student_grade),
      'week', jsonb_build_object('start', v_week_start::text, 'end', v_week_end::text),
      'metrics', jsonb_build_object('sessionsAttended', v_attended, 'timeStudiedMinutes', v_minutes),
      'topicProgress', v_topic_progress, 'tutorNotesSummary', v_notes_summary, 'goalsNextWeek', v_goals
    );

    -- The stale-marker trigger clears the marker and refreshes its watermark.
    -- A correction does not emit a second learner notification.
    update public.weekly_reports
    set payload_json = v_payload, created_by = null, created_at = now()
    where id = v_report.id and is_stale = true;
    v_refreshed := v_refreshed + 1;
  end loop;
  return v_refreshed;
end;
$$;

revoke all on function public.refresh_stale_weekly_reports(integer) from public, anon, authenticated;
grant execute on function public.refresh_stale_weekly_reports(integer) to service_role;

create or replace function private.ensure_weekly_report_refresh_schedule()
returns void language plpgsql security definer
set search_path = public, extensions, pg_catalog
as $$
begin
  if not exists (select 1 from vault.secrets where name = 'ai_grading_service_role_key') then
    raise exception 'recovery_schedule_secret_missing';
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'refresh-stale-weekly-reports';
  perform cron.schedule('refresh-stale-weekly-reports', '*/5 * * * *', $job$
    select net.http_post(
      url := 'https://jscrgpwyniphagitliuz.supabase.co/functions/v1/refresh-stale-weekly-reports',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'ai_grading_service_role_key'
      )), body := jsonb_build_object('maxReports', 10), timeout_milliseconds := 120000
    );
  $job$);
  if not exists (select 1 from cron.job where jobname = 'refresh-stale-weekly-reports') then
    raise exception 'weekly_report_refresh_schedule_install_failed';
  end if;
end;
$$;

create or replace function private.assert_weekly_report_refresh_schedule_ready()
returns void language plpgsql security definer stable
set search_path = public, extensions, pg_catalog
as $$
begin
  if not exists (select 1 from cron.job where jobname = 'refresh-stale-weekly-reports') then
    raise exception 'weekly_report_refresh_schedule_missing';
  end if;
end;
$$;

revoke all on function private.ensure_weekly_report_refresh_schedule() from public, anon, authenticated;
revoke all on function private.assert_weekly_report_refresh_schedule_ready() from public, anon, authenticated;
