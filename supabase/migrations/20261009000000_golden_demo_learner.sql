-- Golden demo content and local-only reset support. This adds no learner
-- decision rules: it uses the existing item bank, activity, evidence,
-- mastery and recommendation contracts.

insert into public.misconceptions (
  skill_id, code, name, description, diagnostic_notes, default_intervention_type
)
select skill.id,
  'DOTS_AS_SQUARE_OF_DIFFERENCE',
  'Difference of squares treated as a square of a difference',
  'A difference of two squares is factorised as the square of a difference.',
  'Example: x² - 25 becomes (x - 5)².',
  'contrasting_examples'::public.intervention_type
from public.curriculum_skills skill
where skill.skill_code = 'G9.ALG.FACTOR.DOTS'
on conflict (skill_id, code) do nothing;

insert into public.question_items (curriculum_version_id, item_code, source_tier)
select curriculum.id, seed.item_code, 'Odysseus_authored'::public.curriculum_source_tier
from public.curriculum_versions curriculum
cross join (values
  ('Q.G9.DEMO.DOTS.01'),
  ('Q.G9.DEMO.DOTS.02'),
  ('Q.G9.DEMO.DOTS.03'),
  ('Q.G9.DEMO.DOTS.04')
) as seed(item_code)
where curriculum.code = 'CAPS-MATH-G9-2026'
on conflict (curriculum_version_id, item_code) do nothing;

-- These remain draft in every environment. The local reset procedure stamps
-- the synthetic demo review record only after creating its local admin user.
insert into public.question_versions (
  question_item_id, version_number, activity_type, cognitive_level,
  representation, difficulty, calculator_policy, prompt, answer_config,
  solution, marks, review_status, material_change_note
)
select item.id, 1, seed.activity_type::public.question_activity_type,
  seed.cognitive_level::public.caps_cognitive_level, 'symbolic'::public.math_representation,
  seed.difficulty, 'not_allowed'::public.calculator_policy, seed.prompt,
  seed.answer_config::jsonb, seed.solution, 2::numeric, 'draft'::public.question_review_status,
  'Golden demo item. Local reset approves the synthetic review fixture; production approval remains the normal reviewed workflow.'
from public.question_items item
join (values
  ('Q.G9.DEMO.DOTS.01', 'guided_practice', 'routine', 1,
    'Factorise: x² - 16.',
    '{"type":"factorised_expression","accepted_answers":["(x - 4)(x + 4)"],"required_form":"factorised","skill_code":"G9.ALG.FACTOR.DOTS"}',
    'x² - 16 = x² - 4² = (x - 4)(x + 4).'),
  ('Q.G9.DEMO.DOTS.02', 'error_analysis', 'routine', 2,
    'Factorise: x² - 25.',
    '{"type":"factorised_expression","accepted_answers":["(x - 5)(x + 5)"],"required_form":"factorised","skill_code":"G9.ALG.FACTOR.DOTS","misconception_rules":[{"code":"DOTS_AS_SQUARE_OF_DIFFERENCE","response":"(x - 5)^2","confidence":"likely"}]}',
    'x² - 25 = x² - 5² = (x - 5)(x + 5).'),
  ('Q.G9.DEMO.DOTS.03', 'guided_practice', 'routine', 2,
    'Factorise: y² - 49.',
    '{"type":"factorised_expression","accepted_answers":["(y - 7)(y + 7)"],"required_form":"factorised","skill_code":"G9.ALG.FACTOR.DOTS"}',
    'y² - 49 = y² - 7² = (y - 7)(y + 7).'),
  ('Q.G9.DEMO.DOTS.04', 'independent_practice', 'complex', 3,
    'Factorise: 4x² - 9.',
    '{"type":"factorised_expression","accepted_answers":["(2x - 3)(2x + 3)"],"required_form":"factorised","skill_code":"G9.ALG.FACTOR.DOTS"}',
    '4x² - 9 = (2x)² - 3² = (2x - 3)(2x + 3).')
) as seed(item_code, activity_type, cognitive_level, difficulty, prompt, answer_config, solution)
  on seed.item_code = item.item_code
on conflict (question_item_id, version_number) do nothing;

insert into public.question_version_skill_links (question_version_id, skill_id, relationship_type)
select version.id, skill.id, 'primary'
from public.question_versions version
join public.question_items item on item.id = version.question_item_id
join public.curriculum_skills skill on skill.skill_code = 'G9.ALG.FACTOR.DOTS'
where item.item_code in ('Q.G9.DEMO.DOTS.01', 'Q.G9.DEMO.DOTS.02', 'Q.G9.DEMO.DOTS.03', 'Q.G9.DEMO.DOTS.04')
on conflict do nothing;

insert into public.question_version_misconceptions (question_version_id, misconception_id)
select version.id, misconception.id
from public.question_versions version
join public.question_items item on item.id = version.question_item_id
join public.misconceptions misconception on misconception.code = 'DOTS_AS_SQUARE_OF_DIFFERENCE'
where item.item_code = 'Q.G9.DEMO.DOTS.02'
on conflict do nothing;

insert into public.learning_activity_templates (
  curriculum_version_id, target_skill_id, code, title, description, source_tier, review_notes
)
select curriculum.id, skill.id,
  'ACT.G9.ALG.FACTOR.DOTS.CONTRASTING-PRACTICE',
  'Difference of Two Squares Practice',
  'A short guided-to-independent practice sequence for recognising and factorising a difference of two squares.',
  'Odysseus_authored'::public.curriculum_source_tier,
  'Golden demo activity. Local reset approves the synthetic review fixture; production approval remains the normal reviewed workflow.'
from public.curriculum_versions curriculum
join public.curriculum_skills skill on skill.subject_id = curriculum.subject_id
  and skill.skill_code = 'G9.ALG.FACTOR.DOTS'
where curriculum.code = 'CAPS-MATH-G9-2026'
on conflict (curriculum_version_id, code) do nothing;

insert into public.learning_activity_stages (
  learning_activity_template_id, stage_type, sequence_number, learner_instruction, tutor_instruction
)
select activity.id, seed.stage_type::public.learning_activity_stage_type,
  seed.sequence_number, seed.learner_instruction, seed.tutor_instruction
from public.learning_activity_templates activity
join (values
  ('guided_practice', 1::smallint, 'Start with a familiar pattern.', 'Confirm the learner can identify both perfect squares.'),
  ('error_analysis', 2::smallint, 'Compare the expression with the square of a binomial.', 'Use the response pattern as evidence, not a label.'),
  ('guided_practice', 3::smallint, 'Apply the same structure with a new variable.', 'Ask the learner to name each square before factorising.'),
  ('independent_practice', 4::smallint, 'Try one independently.', 'Do not offer hints unless the learner asks.')
) as seed(stage_type, sequence_number, learner_instruction, tutor_instruction) on true
where activity.code = 'ACT.G9.ALG.FACTOR.DOTS.CONTRASTING-PRACTICE'
on conflict (learning_activity_template_id, sequence_number) do nothing;

insert into public.learning_activity_stage_questions (
  learning_activity_stage_id, question_version_id, display_order
)
select stage.id, version.id, 1
from public.learning_activity_templates activity
join public.learning_activity_stages stage on stage.learning_activity_template_id = activity.id
join (values
  (1::smallint, 'Q.G9.DEMO.DOTS.01'),
  (2::smallint, 'Q.G9.DEMO.DOTS.02'),
  (3::smallint, 'Q.G9.DEMO.DOTS.03'),
  (4::smallint, 'Q.G9.DEMO.DOTS.04')
) as seed(stage_sequence, item_code) on seed.stage_sequence = stage.sequence_number
join public.question_items item on item.item_code = seed.item_code
join public.question_versions version on version.question_item_id = item.id and version.version_number = 1
where activity.code = 'ACT.G9.ALG.FACTOR.DOTS.CONTRASTING-PRACTICE'
on conflict do nothing;

-- A question is complete only after a correct evaluated attempt. Incorrect
-- attempts remain immutable evidence and keep the learner on the question.
create or replace function public.complete_my_learning_activity(p_activity_code text)
returns void language plpgsql security definer set search_path='' as $$
declare v_student uuid; v_template uuid;
begin
  if public.current_profile_role() <> 'student' then raise exception 'not_authorized' using errcode='42501'; end if;
  v_student := public.current_student_id();
  select id into v_template from public.learning_activity_templates
  where code = p_activity_code and review_status = 'approved';
  if v_template is null then raise exception 'activity_not_available' using errcode='23514'; end if;
  if exists (
    select 1
    from public.learning_activity_stage_questions link
    join public.learning_activity_stages stage on stage.id = link.learning_activity_stage_id
    where stage.learning_activity_template_id = v_template
      and not exists (
        select 1 from public.learning_attempts attempt
        where attempt.student_id = v_student
          and attempt.question_version_id = link.question_version_id
          and attempt.status = 'evaluated'
          and attempt.is_correct
      )
  ) then raise exception 'activity_not_complete' using errcode='23514'; end if;
  update public.learner_activity_progress
  set status = 'completed', completed_at = coalesce(completed_at, now())
  where student_id = v_student and learning_activity_template_id = v_template;
  perform public.log_audit_event('learning_activity.completed', 'learning_activity_template', v_template::text,
    jsonb_build_object('student_id', v_student));
end;
$$;

create or replace function public.get_my_learning_activity_state(p_activity_code text)
returns table(question_version_id uuid, stage_id uuid, stage_sequence smallint,
  stage_type public.learning_activity_stage_type, stage_instruction text,
  question_sequence smallint, attempt_id uuid, attempt_status public.attempt_status)
language plpgsql security definer set search_path='' as $$
declare v_student_id uuid;
begin
  if public.current_profile_role() <> 'student' then raise exception 'not_authorized' using errcode='42501'; end if;
  v_student_id := public.current_student_id();
  return query
  select link.question_version_id, stage.id, stage.sequence_number, stage.stage_type,
    stage.learner_instruction, link.display_order, latest.id, latest.status
  from public.learning_activity_templates activity
  join public.learning_activity_stages stage on stage.learning_activity_template_id = activity.id
  join public.learning_activity_stage_questions link on link.learning_activity_stage_id = stage.id
  left join lateral (
    select attempt.id, attempt.status
    from public.learning_attempts attempt
    where attempt.student_id = v_student_id
      and attempt.question_version_id = link.question_version_id
      and attempt.status = 'evaluated'
      and attempt.is_correct
    order by attempt.attempt_number desc
    limit 1
  ) latest on true
  where activity.code = p_activity_code and activity.review_status = 'approved'
    and not exists (
      select 1 from public.learning_activity_stage_questions bad_link
      join public.learning_activity_stages bad_stage on bad_stage.id = bad_link.learning_activity_stage_id
      join public.question_versions bad_version on bad_version.id = bad_link.question_version_id
      join public.question_items bad_item on bad_item.id = bad_version.question_item_id
      where bad_stage.learning_activity_template_id = activity.id
        and (bad_version.review_status <> 'approved' or bad_item.retired_at is not null)
    )
  order by stage.sequence_number, link.display_order;
end;
$$;

-- This RPC is intentionally service-role-only. The local reset script also
-- refuses non-local Supabase URLs; ordinary learners cannot invoke it.
create or replace function public.reset_local_golden_demo(
  p_demo_email text default 'lethabo.mokoena@example.com'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_student uuid;
  v_admin uuid;
  v_subject uuid;
  v_rule uuid;
  v_recommendation_rule uuid;
  v_dots_misconception uuid;
  v_dots_attempt uuid;
  v_recommendation uuid;
  v_assignment uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'not_authorized' using errcode='42501'; end if;
  if p_demo_email <> 'lethabo.mokoena@example.com' then raise exception 'unknown_demo_fixture' using errcode='22023'; end if;

  select student.id into v_student
  from public.students student
  join public.profiles profile on profile.id = student.profile_id
  where profile.email = p_demo_email and profile.role = 'student';
  if v_student is null then raise exception 'demo_student_not_found' using errcode='P0002'; end if;
  select id into v_admin from public.profiles where role = 'admin' order by created_at limit 1;
  if v_admin is null then raise exception 'demo_admin_not_found' using errcode='P0002'; end if;
  select id into v_subject from public.subjects where name = 'Mathematics' and grade = 'Grade 9' and curriculum = 'CAPS';
  select id into v_rule from public.mastery_rule_sets where is_active order by valid_from desc limit 1;
  select id into v_recommendation_rule from public.recommendation_rule_sets where is_active order by created_at desc limit 1;
  select id into v_dots_misconception from public.misconceptions where code = 'DOTS_AS_SQUARE_OF_DIFFERENCE';
  if v_subject is null or v_rule is null or v_recommendation_rule is null or v_dots_misconception is null then
    raise exception 'golden_demo_dependencies_not_found' using errcode='P0002';
  end if;

  update public.question_versions version
  set review_status = 'approved', reviewed_by = v_admin, reviewed_at = now(),
    review_notes = 'Synthetic local golden-demo fixture reviewed for rehearsal.'
  from public.question_items item
  where item.id = version.question_item_id
    and item.item_code in (
      'Q.G9.DEMO.DOTS.01', 'Q.G9.DEMO.DOTS.02', 'Q.G9.DEMO.DOTS.03', 'Q.G9.DEMO.DOTS.04',
      'Q.G9.DIAG.03', 'Q.G9.DIAG.05', 'Q.G9.DIAG.07', 'Q.G9.DIAG.08'
    )
    and version.review_status <> 'approved';
  update public.learning_activity_templates
  set review_status = 'approved', reviewed_by = v_admin, reviewed_at = now(),
    review_notes = 'Synthetic local golden-demo fixture reviewed for rehearsal.'
  where code = 'ACT.G9.ALG.FACTOR.DOTS.CONTRASTING-PRACTICE'
    and review_status <> 'approved';

  delete from public.learning_recommendation_reasons reason
  using public.grade9_learning_recommendations recommendation
  where reason.recommendation_id = recommendation.id and recommendation.student_id = v_student;
  delete from public.grade9_learning_recommendations where student_id = v_student;
  delete from public.learning_retention_checks where student_id = v_student;
  delete from public.skill_mastery_evaluation_evidence evidence
  using public.skill_mastery_evaluations evaluation
  where evidence.mastery_evaluation_id = evaluation.id and evaluation.student_id = v_student;
  delete from public.skill_mastery_evaluations where student_id = v_student;
  delete from public.learner_misconception_evidence evidence
  using public.learner_misconceptions misconception
  where evidence.learner_misconception_id = misconception.id and misconception.student_id = v_student;
  delete from public.learner_misconceptions where student_id = v_student;
  delete from public.learner_activity_progress where student_id = v_student;
  delete from public.learning_attempt_reviews review
  using public.learning_attempts attempt
  where review.learning_attempt_id = attempt.id and attempt.student_id = v_student;
  delete from public.learning_attempt_skill_evidence evidence
  using public.learning_attempts attempt
  where evidence.learning_attempt_id = attempt.id and attempt.student_id = v_student;
  delete from public.learning_attempts where student_id = v_student;
  delete from public.student_progress where student_id = v_student;

  with baseline(item_code, response, correct, confidence, occurred_at) as (
    values
      ('Q.G9.DIAG.03', '7x - 2', true, 3::smallint, now() - interval '28 days'),
      ('Q.G9.DIAG.03', '7x - 2', true, 3::smallint, now() - interval '21 days'),
      ('Q.G9.DIAG.03', '7x - 2', true, 4::smallint, now() - interval '14 days'),
      ('Q.G9.DIAG.03', '7x - 2', true, 3::smallint, now() - interval '7 days'),
      ('Q.G9.DIAG.05', '3x + 12', true, 2::smallint, now() - interval '21 days'),
      ('Q.G9.DIAG.05', '3x + 4', false, 2::smallint, now() - interval '14 days'),
      ('Q.G9.DIAG.05', '3x + 12', true, 2::smallint, now() - interval '7 days'),
      ('Q.G9.DIAG.08', 'x = 3', true, 3::smallint, now() - interval '21 days'),
      ('Q.G9.DIAG.08', 'x = 4', false, 2::smallint, now() - interval '14 days'),
      ('Q.G9.DIAG.08', 'x = 3', true, 3::smallint, now() - interval '7 days'),
      ('Q.G9.DIAG.07', '(x - 5)^2', false, 4::smallint, now() - interval '2 days')
  ), selected as (
    select baseline.*, version.id as question_version_id, version.marks,
      version.cognitive_level, link.skill_id,
      row_number() over (partition by baseline.item_code order by baseline.occurred_at) as attempt_number
    from baseline
    join public.question_items item on item.item_code = baseline.item_code
    join lateral (
      select candidate.* from public.question_versions candidate
      where candidate.question_item_id = item.id
      order by candidate.version_number desc limit 1
    ) version on true
    join public.question_version_skill_links link on link.question_version_id = version.id and link.relationship_type = 'primary'
  ), inserted as (
    insert into public.learning_attempts (
      student_id, question_version_id, evidence_context, attempt_number, response,
      confidence, status, is_correct, marks_awarded, evaluated_at, occurred_at
    )
    select v_student, question_version_id, 'formative'::public.evidence_context, attempt_number,
      jsonb_build_object('answer', response), confidence, 'evaluated'::public.attempt_status,
      correct, case when correct then marks else 0 end, occurred_at, occurred_at
    from selected
    returning id, question_version_id, is_correct, marks_awarded, occurred_at
  )
  insert into public.learning_attempt_skill_evidence (
    learning_attempt_id, skill_id, independence, is_target_skill, cognitive_level,
    correct, marks_awarded, marks_possible, recorded_at
  )
  select inserted.id, link.skill_id, 'independent'::public.attempt_independence,
    link.relationship_type = 'primary', version.cognitive_level, inserted.is_correct,
    inserted.marks_awarded, version.marks, inserted.occurred_at
  from inserted
  join public.question_versions version on version.id = inserted.question_version_id
  join public.question_version_skill_links link on link.question_version_id = version.id;

  insert into public.learner_misconceptions (student_id, misconception_id, state, determined_at, reason)
  values (v_student, v_dots_misconception, 'suspected', now() - interval '2 days',
    'A recent independent response matched the difference-of-squares pattern.');
  select attempt.id into v_dots_attempt
  from public.learning_attempts attempt
  join public.question_versions version on version.id = attempt.question_version_id
  join public.question_items item on item.id = version.question_item_id
  where attempt.student_id = v_student and item.item_code = 'Q.G9.DIAG.07'
  order by attempt.occurred_at desc limit 1;
  insert into public.learner_misconception_evidence (learner_misconception_id, learning_attempt_id)
  select misconception.id, v_dots_attempt
  from public.learner_misconceptions misconception
  where misconception.student_id = v_student and misconception.misconception_id = v_dots_misconception;

  insert into public.skill_mastery_evaluations (student_id, skill_id, rule_set_id, state, determined_at, reason, reason_codes)
  select v_student, skill.id, v_rule, state::public.mastery_state, now() - interval '1 day', reason, reason_codes
  from (values
    ('G9.ALG.LIKE_TERMS', 'secure', 'Four independent correct attempts across separate occasions.', array['INDEPENDENT_EVIDENCE_SUFFICIENT']),
    ('G9.ALG.DISTRIBUTIVE', 'developing', 'Independent evidence shows progress, with one inconsistent response.', array['MEANINGFUL_INDEPENDENT_SUCCESS']),
    ('G9.ALG.FACTOR.DOTS', 'emerging', 'Recent independent work shows this skill is still developing.', array['WEAK_OR_INCONSISTENT_INDEPENDENT_EVIDENCE','UNRESOLVED_CRITICAL_MISCONCEPTION']),
    ('G9.EQN.ONE_STEP', 'developing', 'Independent evidence shows progress, with one inconsistent response.', array['MEANINGFUL_INDEPENDENT_SUCCESS'])
  ) as seed(skill_code, state, reason, reason_codes)
  join public.curriculum_skills skill on skill.skill_code = seed.skill_code;

  insert into public.skill_mastery_evaluation_evidence (
    mastery_evaluation_id, learning_attempt_skill_evidence_id
  )
  select evaluation.id, evidence.id
  from public.skill_mastery_evaluations evaluation
  join public.learning_attempt_skill_evidence evidence on evidence.skill_id = evaluation.skill_id
  join public.learning_attempts attempt on attempt.id = evidence.learning_attempt_id
  where evaluation.student_id = v_student and attempt.student_id = v_student;

  insert into public.skill_mastery_evaluation_evidence (
    mastery_evaluation_id, learner_misconception_id
  )
  select evaluation.id, misconception.id
  from public.skill_mastery_evaluations evaluation
  join public.curriculum_skills skill on skill.id = evaluation.skill_id
  join public.learner_misconceptions misconception on misconception.student_id = evaluation.student_id
  where evaluation.student_id = v_student
    and skill.skill_code = 'G9.ALG.FACTOR.DOTS'
    and misconception.misconception_id = v_dots_misconception;

  insert into public.grade9_learning_recommendations (
    student_id, skill_id, mastery_evaluation_id, rule_set_id, recommendation_type,
    recommended_sequence, reason
  )
  select v_student, skill.id, evaluation.id, v_recommendation_rule,
    'contrasting_examples'::public.intervention_type,
    array['contrasting_examples', 'faded_example', 'error_analysis', 'retrieval_practice'],
    'Recent independent work shows this skill would benefit from focused comparison and practice.'
  from public.curriculum_skills skill
  join lateral (
    select id from public.skill_mastery_evaluations
    where student_id = v_student and skill_id = skill.id
    order by determined_at desc limit 1
  ) evaluation on true
  where skill.skill_code = 'G9.ALG.FACTOR.DOTS'
  returning id into v_recommendation;
  insert into public.learning_recommendation_reasons (recommendation_id, reason_code)
  values (v_recommendation, 'REPEATED_MISCONCEPTION'),
    (v_recommendation, 'PREREQUISITES_SECURE'),
    (v_recommendation, 'TARGET_SKILL_NOT_SECURE');

  insert into public.student_progress (student_id, subject_id, topic, score, cognitive_level, recorded_at)
  values
    (v_student, v_subject, 'Algebraic Expressions', 62, 'school result', now() - interval '24 days'),
    (v_student, v_subject, 'Equations', 68, 'school result', now() - interval '17 days'),
    (v_student, v_subject, 'Geometry', 74, 'school result', now() - interval '10 days'),
    (v_student, v_subject, 'Graphs', 71, 'school result', now() - interval '3 days');

  delete from public.assignments where title = 'Algebra factorisation check-in' and grade = 'Grade 9'
    and created_by = v_admin;
  insert into public.assignments (organization_id, title, description, subject_id, grade, due_date, created_by, status, available_from)
  select student.organization_id, 'Algebra factorisation check-in',
    'A short Mathematics check-in on factorisation patterns.', v_subject, 'Grade 9',
    now() + interval '7 days', v_admin, 'published'::public.assignment_status, now()
  from public.students student where student.id = v_student
  returning id into v_assignment;
  insert into public.assignment_student_targets (assignment_id, student_id) values (v_assignment, v_student);

  return jsonb_build_object(
    'studentEmail', p_demo_email,
    'activityCode', 'ACT.G9.ALG.FACTOR.DOTS.CONTRASTING-PRACTICE',
    'reset', true
  );
end;
$$;

revoke all on function public.complete_my_learning_activity(text) from public;
revoke all on function public.get_my_learning_activity_state(text) from public;
revoke all on function public.reset_local_golden_demo(text) from public, anon, authenticated;
grant execute on function public.complete_my_learning_activity(text) to authenticated;
grant execute on function public.get_my_learning_activity_state(text) to authenticated;
grant execute on function public.reset_local_golden_demo(text) to service_role;
