-- Competency evidence is deliberately distinct from both an assessment result
-- and the legacy student_progress snapshot. One released result can support
-- several CAPS concepts, each with its own rubric criterion and thinking level.
create table public.competency_evidence (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  competency text not null check (char_length(btrim(competency)) between 1 and 200),
  cognitive_level text,
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  source_submission_id uuid not null references public.assignment_submissions(id) on delete cascade,
  rubric_criterion_id text not null check (char_length(btrim(rubric_criterion_id)) between 1 and 120),
  recorded_at timestamptz not null default now(),
  unique (source_submission_id, rubric_criterion_id)
);

create index competency_evidence_student_recorded_idx
  on public.competency_evidence(student_id, recorded_at desc);
create index competency_evidence_student_competency_idx
  on public.competency_evidence(student_id, subject_id, competency, recorded_at desc);

alter table public.competency_evidence enable row level security;
grant select on public.competency_evidence to authenticated;

create policy "competency_evidence_select_scoped"
on public.competency_evidence
for select to authenticated
using (
  (select public.is_platform_admin())
  or student_id = (select public.current_student_id())
  or exists (
    select 1
    from public.tutor_student_allocations allocation
    where allocation.student_id = competency_evidence.student_id
      and allocation.tutor_id = (select public.current_tutor_id())
      and allocation.status = 'active'
  )
);

-- The trigger is the sole writer. It removes evidence immediately when a mark
-- is unreleased, returned, or changed, so competency data can never outlive the
-- released assessment evidence that supports it.
create or replace function public.sync_released_submission_competency_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject_id uuid;
  v_criterion jsonb;
  v_rubric jsonb;
  v_criterion_id text;
  v_competency text;
  v_max_marks numeric;
  v_marks numeric;
begin
  delete from public.competency_evidence
  where source_submission_id = new.id;

  if new.status <> 'marked' or new.marks_released is not true then
    return new;
  end if;

  select assignment.subject_id, assignment.rubric_json into v_subject_id, v_rubric
  from public.assignments assignment
  where assignment.id = new.assignment_id;

  if not found or jsonb_typeof(coalesce(v_rubric, '[]'::jsonb)) <> 'array' then
    return new;
  end if;

  for v_criterion in
    select value from jsonb_array_elements(v_rubric)
  loop
    v_criterion_id := nullif(btrim(v_criterion ->> 'id'), '');
    v_competency := coalesce(nullif(btrim(v_criterion ->> 'topic'), ''), nullif(btrim(v_criterion ->> 'label'), ''));
    begin
      v_max_marks := nullif(v_criterion ->> 'maxMarks', '')::numeric;
      v_marks := nullif(new.rubric_scores_json ->> v_criterion_id, '')::numeric;
    exception when invalid_text_representation then
      continue;
    end;

    if v_criterion_id is null or v_competency is null or v_max_marks is null or v_max_marks <= 0 or v_marks is null then
      continue;
    end if;

    insert into public.competency_evidence (
      student_id, subject_id, competency, cognitive_level, score,
      source_submission_id, rubric_criterion_id, recorded_at
    ) values (
      new.student_id, v_subject_id, v_competency,
      nullif(btrim(v_criterion ->> 'cognitiveLevel'), ''),
      least(100, greatest(0, round((v_marks / v_max_marks) * 100, 2))),
      new.id, v_criterion_id, coalesce(new.released_at, now())
    );
  end loop;

  return new;
end;
$$;

revoke all on function public.sync_released_submission_competency_evidence() from public, anon, authenticated, service_role;

create trigger trg_sync_released_submission_competency_evidence
after insert or update of assignment_id, student_id, status, marks_released, rubric_scores_json, released_at
on public.assignment_submissions
for each row execute function public.sync_released_submission_competency_evidence();

comment on table public.competency_evidence is
  'Released, rubric-linked competency evidence. One row per released submission criterion; no direct client writes.';

-- Extend the existing partner aggregate with delivery and evidence metrics.
-- It preserves the original JSON contract and the same minimum-cohort gate.
create or replace function public.get_org_cohort_report(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min_cohort_size constant int := 5;
  v_learner_count int;
  v_active_learner_count int;
  v_avg_progress_score numeric;
  v_submission_count int;
  v_marked_submission_count int;
  v_progress_distribution jsonb;
  v_session_count int;
  v_attended_session_count int;
  v_competency_evidence_count int;
  v_average_competency_score numeric;
  v_intervention_count int;
begin
  if not exists (
    select 1 from public.organization_members membership
    join public.profiles profile on profile.id = membership.profile_id
    where profile.auth_user_id = auth.uid()
      and membership.organization_id = p_org_id
      and membership.org_role = 'partner_viewer'
      and membership.status = 'active'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select count(*), count(*) filter (where student.status = 'active')
    into v_learner_count, v_active_learner_count
  from public.students student where student.organization_id = p_org_id;

  if v_learner_count < v_min_cohort_size then
    return jsonb_build_object('organization_id', p_org_id, 'learner_count', v_learner_count, 'suppressed', true, 'suppression_reason', format('cohort below minimum reporting size (fewer than %s learners)', v_min_cohort_size));
  end if;

  select avg(progress.score), count(*) into v_avg_progress_score, v_competency_evidence_count
  from public.competency_evidence progress
  join public.students student on student.id = progress.student_id
  where student.organization_id = p_org_id;

  select count(*), count(*) filter (where submission.status = 'marked')
    into v_submission_count, v_marked_submission_count
  from public.assignment_submissions submission
  join public.students student on student.id = submission.student_id
  where student.organization_id = p_org_id;

  select count(*), count(*) filter (where session.attendance_status in ('present', 'late'))
    into v_session_count, v_attended_session_count
  from public.sessions session
  join public.students student on student.id = session.student_id
  where student.organization_id = p_org_id;

  select avg(evidence.score) into v_average_competency_score
  from public.competency_evidence evidence
  join public.students student on student.id = evidence.student_id
  where student.organization_id = p_org_id;

  select count(*) into v_intervention_count
  from public.assignment_submissions submission
  join public.students student on student.id = submission.student_id
  where student.organization_id = p_org_id
    and submission.feedback_released is true
    and submission.rubric_scores_json ? '__learning_action';

  select coalesce(jsonb_agg(jsonb_build_object('cognitive_level', bucket.cognitive_level, 'count', bucket.learner_count)), '[]'::jsonb)
    into v_progress_distribution
  from (select evidence.cognitive_level, count(*) as learner_count from public.competency_evidence evidence join public.students student on student.id = evidence.student_id where student.organization_id = p_org_id group by evidence.cognitive_level) bucket;

  return jsonb_build_object(
    'organization_id', p_org_id, 'learner_count', v_learner_count, 'active_learner_count', v_active_learner_count,
    'suppressed', false, 'average_progress_score', round(coalesce(v_avg_progress_score, 0), 2),
    'submission_count', v_submission_count, 'marked_submission_count', v_marked_submission_count,
    'session_count', v_session_count, 'attended_session_count', v_attended_session_count,
    'attendance_rate', case when v_session_count > 0 then round(v_attended_session_count::numeric / v_session_count * 100, 2) else null end,
    'competency_evidence_count', v_competency_evidence_count, 'average_competency_score', round(v_average_competency_score, 2),
    'intervention_count', v_intervention_count, 'progress_distribution_by_cognitive_level', v_progress_distribution
  );
end;
$$;

revoke execute on function public.get_org_cohort_report(uuid) from public;
grant execute on function public.get_org_cohort_report(uuid) to authenticated;

-- Parent-safe engagement context supplements (but does not replace) the
-- released-result report. Its counts intentionally cover the latest 14 days,
-- so the parent UI can honestly present a "since recent activity" summary.
-- Private tutor notes and detailed risk data never leave the sessions table.
create or replace function public.get_parent_learning_updates()
returns table (
  student_id uuid,
  session_count integer,
  attendance_rate numeric,
  completed_work_count integer,
  latest_student_summary text,
  next_session_date date
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    link.student_id,
    coalesce(session_summary.session_count, 0)::integer,
    session_summary.attendance_rate,
    coalesce(work_summary.completed_work_count, 0)::integer,
    session_summary.latest_student_summary,
    session_summary.next_session_date
  from public.student_guardians link
  join public.guardians guardian on guardian.id = link.guardian_id
  left join lateral (
    select
      count(*) filter (where session.date >= current_date - 13) as session_count,
      round((count(*) filter (where session.date >= current_date - 13 and session.attendance_status in ('present', 'late'))::numeric / nullif(count(*) filter (where session.date >= current_date - 13), 0)) * 100, 2) as attendance_rate,
      (array_agg(nullif(btrim(session.student_summary), '') order by session.date desc, session.start_time desc))[1] as latest_student_summary,
      min(session.date) filter (where session.date >= current_date) as next_session_date
    from public.sessions session
    where session.student_id = link.student_id
  ) session_summary on true
  left join lateral (
    select count(*) as completed_work_count
    from public.assignment_submissions submission
    where submission.student_id = link.student_id
      and submission.submitted_at >= now() - interval '14 days'
  ) work_summary on true
  where public.current_profile_role() = 'parent'
    and guardian.profile_id = public.current_profile_id()
    and guardian.status = 'active'
    and link.status = 'active'
    and link.can_receive_reports is true;
$$;

revoke execute on function public.get_parent_learning_updates() from public;
grant execute on function public.get_parent_learning_updates() to authenticated;
