-- PERF-01: PostgREST caps a single table response at 1,000 rows. Report
-- totals must therefore be calculated inside PostgreSQL, not by aggregating
-- an implicitly truncated browser response. The JSON documents below are
-- role-checked report endpoints; presentation lists on the client are capped
-- separately and are never used to calculate a headline metric.

create index if not exists idx_submissions_student_released_report
  on public.assignment_submissions (student_id, released_at desc)
  where marks_released = true and marks_awarded is not null;

create or replace function public.get_admin_progress_reports()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  with student_rows as (
    select
      s.id as student_id,
      s.created_at,
      jsonb_build_object(
        'student_id', s.id,
        'student_name', coalesce(p.full_name, p.email, s.id::text),
        'grade', s.grade,
        'school', s.school,
        'ngo_partner', n.name,
        'guardians', coalesce(guardians.items, '[]'::jsonb),
        'released_results', coalesce(results.items, '[]'::jsonb),
        'progress_topics', coalesce(progress.items, '[]'::jsonb),
        'average_mark', results.average_mark,
        'pending_submissions', submissions.pending_submissions,
        'latest_released_at', results.latest_released_at
      ) as report
    from public.students s
    left join public.profiles p on p.id = s.profile_id
    left join public.ngo_partners n on n.id = s.ngo_partner_id
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'full_name', g.full_name,
        'email', g.email,
        'phone', g.phone,
        'relationship_type', sg.relationship_type,
        'communication_preference', g.communication_preference,
        'can_receive_reports', sg.can_receive_reports,
        'is_primary', sg.is_primary
      ) order by sg.created_at desc) as items
      from public.student_guardians sg
      join public.guardians g on g.id = sg.guardian_id
      where sg.student_id = s.id
        and sg.status = 'active'::public.record_status
    ) guardians on true
    left join lateral (
      select
        jsonb_agg(jsonb_build_object(
          'submission_id', item.id,
          'assignment_title', item.assignment_title,
          'subject_name', item.subject_name,
          'marks_awarded', item.marks_awarded,
          'feedback', item.feedback,
          'released_at', item.released_at,
          'submitted_at', item.submitted_at
        ) order by item.submitted_at desc) as items,
        round(avg(item.marks_awarded), 1) as average_mark,
        max(item.released_at) as latest_released_at
      from (
        select sub.id, sub.marks_awarded, sub.released_at, sub.submitted_at,
          coalesce(a.title, sub.assignment_id::text) as assignment_title,
          coalesce(subject.name, 'General') as subject_name,
          case when sub.feedback_released then sub.feedback else null end as feedback
        from public.assignment_submissions sub
        left join public.assignments a on a.id = sub.assignment_id
        left join public.subjects subject on subject.id = a.subject_id
        where sub.student_id = s.id
          and sub.marks_released = true
          and sub.marks_awarded is not null
      ) item
    ) results on true
    left join lateral (
      select count(*)::integer as pending_submissions
      from public.assignment_submissions sub
      where sub.student_id = s.id
        and (sub.marks_released = false or sub.marks_awarded is null)
    ) submissions on true
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'topic', item.topic,
        'score', item.score,
        'subject_name', item.subject_name,
        'recorded_at', item.recorded_at
      ) order by item.recorded_at desc) as items
      from (
        select sp.topic, sp.score, sp.recorded_at, coalesce(subject.name, 'General') as subject_name
        from public.student_progress sp
        left join public.subjects subject on subject.id = sp.subject_id
        where sp.student_id = s.id
        order by sp.recorded_at desc
        limit 8
      ) item
    ) progress on true
  ), ngo_rows as (
    select jsonb_build_object(
      'ngo_partner_id', n.id,
      'ngo_partner_name', n.name,
      'student_count', (select count(*)::integer from public.students s where s.ngo_partner_id = n.id),
      'released_results', (
        select count(*)::integer
        from public.assignment_submissions sub
        join public.students s on s.id = sub.student_id
        where s.ngo_partner_id = n.id and sub.marks_released = true and sub.marks_awarded is not null
      ),
      'average_mark', (
        select round(avg(sub.marks_awarded), 1)
        from public.assignment_submissions sub
        join public.students s on s.id = sub.student_id
        where s.ngo_partner_id = n.id and sub.marks_released = true and sub.marks_awarded is not null
      ),
      'active_classes', (
        select count(*)::integer
        from public.classes c
        where c.status = 'active'::public.record_status
          and (
            c.ngo_partner_id = n.id or exists (
              select 1
              from public.class_enrollments ce
              join public.students s on s.id = ce.student_id
              where ce.class_id = c.id
                and ce.status = 'active'::public.record_status
                and s.ngo_partner_id = n.id
            )
          )
      ),
      'progress_topic_count', (
        select count(*)::integer
        from public.students s
        cross join lateral (
          select 1
          from public.student_progress sp
          where sp.student_id = s.id
          order by sp.recorded_at desc
          limit 8
        ) recent_progress
        where s.ngo_partner_id = n.id
      )
    ) as report
    from public.ngo_partners n
  )
  select jsonb_build_object(
    'students', coalesce((select jsonb_agg(report order by created_at desc) from student_rows), '[]'::jsonb),
    'ngoReports', coalesce((select jsonb_agg(report order by report ->> 'ngo_partner_name') from ngo_rows), '[]'::jsonb),
    'summary', jsonb_build_object(
      'studentReports', (select count(*)::integer from public.students),
      'guardianRecipients', (
        select count(*)::integer
        from public.student_guardians sg
        where sg.status = 'active'::public.record_status and sg.can_receive_reports = true
      ),
      'ngoReports', (select count(*)::integer from public.ngo_partners),
      'releasedResults', (
        select count(*)::integer
        from public.assignment_submissions
        where marks_released = true and marks_awarded is not null
      )
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_admin_progress_reports() from public, anon, authenticated, service_role;
grant execute on function public.get_admin_progress_reports() to authenticated;

create or replace function public.get_student_dashboard_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := public.current_active_student_id();
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'overall_score', (
      select round(avg(sp.score), 0) from public.student_progress sp where sp.student_id = v_student_id
    ),
    'assignments_completed', (
      select count(distinct sub.assignment_id)::integer
      from public.assignment_submissions sub where sub.student_id = v_student_id
    ),
    'open_assignments', (
      select count(*)::integer
      from public.get_student_accessible_assignments() a
      where not exists (
        select 1 from public.assignment_submissions sub
        where sub.student_id = v_student_id and sub.assignment_id = a.id
      )
    ),
    'classes', (
      select count(distinct ce.class_id)::integer
      from public.class_enrollments ce
      where ce.student_id = v_student_id and ce.status = 'active'::public.record_status
    )
  );
end;
$$;

revoke all on function public.get_student_dashboard_metrics() from public, anon, authenticated, service_role;
grant execute on function public.get_student_dashboard_metrics() to authenticated;

create or replace function public.get_admin_payroll_view(p_week_start date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_period public.pay_periods%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_period
  from public.pay_periods
  where period_start_date = p_week_start;

  return jsonb_build_object(
    'tutors', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'full_name', p.full_name) order by p.full_name, t.id)
      from public.tutors t
      left join public.profiles p on p.id = t.profile_id
    ), '[]'::jsonb),
    'adjustments', case when v_period.id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'tutor_id', a.tutor_id, 'type', a.type,
        'amount', a.amount, 'reason', a.reason, 'voided_at', a.voided_at,
        'tutor_name', p.full_name
      ) order by a.created_at)
      from public.adjustments a
      left join public.tutors t on t.id = a.tutor_id
      left join public.profiles p on p.id = t.profile_id
      where a.pay_period_id = v_period.id
    ), '[]'::jsonb) end
  );
end;
$$;

revoke all on function public.get_admin_payroll_view(date) from public, anon, authenticated, service_role;
grant execute on function public.get_admin_payroll_view(date) to authenticated;
