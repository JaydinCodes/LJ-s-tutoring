-- Deterministic tutor exception summaries. Routine successful attempts are intentionally omitted.
create or replace function public.get_tutor_learning_insights()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with accessible_students as (
    select student.id, coalesce(profile.full_name, 'Learner') as student_name
    from public.students student
    join public.profiles profile on profile.id = student.profile_id
    where public.current_profile_role() in ('tutor', 'admin')
      and public.can_access_learning_student(student.id)
  ),
  latest_mastery as (
    select distinct on (evaluation.student_id, evaluation.skill_id)
      evaluation.student_id, evaluation.skill_id, evaluation.state, evaluation.determined_at
    from public.skill_mastery_evaluations evaluation
    join accessible_students access on access.id = evaluation.student_id
    order by evaluation.student_id, evaluation.skill_id, evaluation.determined_at desc, evaluation.id desc
  ),
  repeated as (
    select access.id as student_id, access.student_name, misconception.name as misconception_name,
      count(distinct evidence.learning_attempt_id) as observed_count,
      max(skill.title) as skill_name
    from accessible_students access
    join public.learner_misconceptions learner on learner.student_id = access.id and learner.state in ('suspected', 'confirmed')
    join public.misconceptions misconception on misconception.id = learner.misconception_id
    join public.learner_misconception_evidence evidence on evidence.learner_misconception_id = learner.id
    left join public.question_version_skill_links link on link.question_version_id = (
      select attempt.question_version_id from public.learning_attempts attempt where attempt.id = evidence.learning_attempt_id
    ) and link.relationship_type = 'primary'
    left join public.curriculum_skills skill on skill.id = link.skill_id
    group by access.id, access.student_name, misconception.id, misconception.name
    having count(distinct evidence.learning_attempt_id) >= 2
  ),
  evidence_counts as (
    select attempt.student_id, evidence.skill_id,
      count(*) filter (where evidence.independence = 'independent') as independent_count,
      count(*) filter (where evidence.correct) as correct_count,
      count(*) filter (where evidence.correct and evidence.independence = 'assisted') as assisted_correct_count
    from public.learning_attempt_skill_evidence evidence
    join public.learning_attempts attempt on attempt.id = evidence.learning_attempt_id
    join accessible_students access on access.id = attempt.student_id
    group by attempt.student_id, evidence.skill_id
  ),
  ranked_mastery as (
    select evaluation.student_id, evaluation.skill_id, evaluation.state, evaluation.determined_at,
      lag(evaluation.state) over (partition by evaluation.student_id, evaluation.skill_id order by evaluation.determined_at, evaluation.id) as previous_state,
      row_number() over (partition by evaluation.student_id, evaluation.skill_id order by evaluation.determined_at desc, evaluation.id desc) as newest
    from public.skill_mastery_evaluations evaluation
    join accessible_students access on access.id = evaluation.student_id
  )
  select jsonb_build_object(
    'repeatedMisconceptions', coalesce((select jsonb_agg(jsonb_build_object(
      'studentId', repeated.student_id, 'studentName', repeated.student_name,
      'skillName', repeated.skill_name, 'pattern', repeated.misconception_name,
      'observedCount', repeated.observed_count
    ) order by repeated.observed_count desc) from repeated), '[]'::jsonb),
    'stalledLearners', coalesce((select jsonb_agg(jsonb_build_object(
      'studentId', access.id, 'studentName', access.student_name, 'skillName', skill.title,
      'masteryState', latest.state, 'independentAttempts', counts.independent_count
    )) from latest_mastery latest join evidence_counts counts using (student_id, skill_id)
      join accessible_students access on access.id = latest.student_id join public.curriculum_skills skill on skill.id = latest.skill_id
      where latest.state in ('emerging', 'developing') and counts.independent_count >= 3), '[]'::jsonb),
    'hintDependency', coalesce((select jsonb_agg(jsonb_build_object(
      'studentId', access.id, 'studentName', access.student_name, 'skillName', skill.title,
      'correctAttempts', counts.correct_count, 'assistedCorrectAttempts', counts.assisted_correct_count
    )) from evidence_counts counts join accessible_students access on access.id = counts.student_id
      join public.curriculum_skills skill on skill.id = counts.skill_id
      where counts.correct_count >= 3 and counts.assisted_correct_count::numeric / counts.correct_count >= 0.6), '[]'::jsonb),
    'recentlyImproved', coalesce((select jsonb_agg(jsonb_build_object(
      'studentId', access.id, 'studentName', access.student_name, 'skillName', skill.title,
      'previousState', history.previous_state, 'currentState', history.state, 'determinedAt', history.determined_at
    ) order by history.determined_at desc) from ranked_mastery history join accessible_students access on access.id = history.student_id
      join public.curriculum_skills skill on skill.id = history.skill_id
      where history.newest = 1 and history.previous_state is not null
        and array_position(array['unassessed','emerging','developing','secure','retained']::text[], history.state::text)
          > array_position(array['unassessed','emerging','developing','secure','retained']::text[], history.previous_state::text)
        and history.determined_at >= now() - interval '30 days'), '[]'::jsonb)
  );
$$;

revoke all on function public.get_tutor_learning_insights() from public;
grant execute on function public.get_tutor_learning_insights() to authenticated;

comment on function public.get_tutor_learning_insights() is
  'Allocation-scoped deterministic tutor exceptions. Stalled means emerging/developing after at least three independent attempts; hint dependency means at least 60% of three or more correct attempts were assisted.';
