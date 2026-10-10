-- Golden Demo rehearsal integrity. Keep the fixture aligned with the same
-- evidence rules shown to learners: repeated misconception and prerequisite
-- recommendation reasons are backed by ordinary item-bank attempts.

insert into public.question_items (curriculum_version_id, item_code, source_tier)
select curriculum.id, seed.item_code, 'Odysseus_authored'::public.curriculum_source_tier
from public.curriculum_versions curriculum
cross join (values
  ('Q.G9.DEMO.HISTORY.DOTS.01'),
  ('Q.G9.DEMO.HISTORY.DOTS.02')
) as seed(item_code)
where curriculum.code = 'CAPS-MATH-G9-2026'
on conflict (curriculum_version_id, item_code) do nothing;

insert into public.question_versions (
  question_item_id, version_number, activity_type, cognitive_level,
  representation, difficulty, calculator_policy, prompt, answer_config,
  solution, marks, review_status, material_change_note
)
select item.id, 1, 'diagnostic'::public.question_activity_type,
  'routine'::public.caps_cognitive_level, 'symbolic'::public.math_representation,
  2, 'not_allowed'::public.calculator_policy, seed.prompt, seed.answer_config::jsonb,
  seed.solution, 2::numeric, 'draft'::public.question_review_status,
  'Golden demo historical fixture. Local reset approves it only for rehearsal.'
from public.question_items item
join (values
  ('Q.G9.DEMO.HISTORY.DOTS.01',
    'Factorise: x² - 25.',
    '{"type":"factorised_expression","accepted_answers":["(x - 5)(x + 5)"],"required_form":"factorised","skill_code":"G9.ALG.FACTOR.DOTS","misconception_rules":[{"code":"DOTS_AS_SQUARE_OF_DIFFERENCE","response":"(x - 5)^2","confidence":"likely"}]}',
    'x² - 25 = x² - 5² = (x - 5)(x + 5).'),
  ('Q.G9.DEMO.HISTORY.DOTS.02',
    'Factorise: y² - 49.',
    '{"type":"factorised_expression","accepted_answers":["(y - 7)(y + 7)"],"required_form":"factorised","skill_code":"G9.ALG.FACTOR.DOTS","misconception_rules":[{"code":"DOTS_AS_SQUARE_OF_DIFFERENCE","response":"(y - 7)^2","confidence":"likely"}]}',
    'y² - 49 = y² - 7² = (y - 7)(y + 7).')
) as seed(item_code, prompt, answer_config, solution) on seed.item_code = item.item_code
on conflict (question_item_id, version_number) do nothing;

insert into public.question_version_skill_links (question_version_id, skill_id, relationship_type)
select version.id, skill.id, 'primary'
from public.question_versions version
join public.question_items item on item.id = version.question_item_id
join public.curriculum_skills skill on skill.skill_code = 'G9.ALG.FACTOR.DOTS'
where item.item_code in ('Q.G9.DEMO.HISTORY.DOTS.01', 'Q.G9.DEMO.HISTORY.DOTS.02')
on conflict do nothing;

insert into public.question_version_misconceptions (question_version_id, misconception_id)
select version.id, misconception.id
from public.question_versions version
join public.question_items item on item.id = version.question_item_id
join public.misconceptions misconception on misconception.code = 'DOTS_AS_SQUARE_OF_DIFFERENCE'
where item.item_code in ('Q.G9.DEMO.HISTORY.DOTS.01', 'Q.G9.DEMO.HISTORY.DOTS.02')
on conflict do nothing;

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
  v_dots_attempts uuid[];
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
  select id into v_admin
  from public.profiles
  where email = 'admin@example.com' and role = 'admin';
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
      'Q.G9.DEMO.HISTORY.DOTS.01', 'Q.G9.DEMO.HISTORY.DOTS.02',
      'Q.G9.DIAG.03', 'Q.G9.DIAG.05', 'Q.G9.DIAG.06', 'Q.G9.DIAG.08', 'Q.G9.DIAG.17'
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
      ('Q.G9.DIAG.06', '6(x + 3)', true, 3::smallint, now() - interval '28 days'),
      ('Q.G9.DIAG.06', '6(x + 3)', true, 3::smallint, now() - interval '21 days'),
      ('Q.G9.DIAG.06', '6(x + 3)', true, 4::smallint, now() - interval '14 days'),
      ('Q.G9.DIAG.06', '6(x + 3)', true, 3::smallint, now() - interval '7 days'),
      ('Q.G9.DIAG.17', 'x^2 + 5x + 6', true, 3::smallint, now() - interval '28 days'),
      ('Q.G9.DIAG.17', 'x^2 + 5x + 6', true, 3::smallint, now() - interval '21 days'),
      ('Q.G9.DIAG.17', 'x^2 + 5x + 6', true, 4::smallint, now() - interval '14 days'),
      ('Q.G9.DIAG.17', 'x^2 + 5x + 6', true, 3::smallint, now() - interval '7 days'),
      ('Q.G9.DIAG.08', 'x = 3', true, 3::smallint, now() - interval '21 days'),
      ('Q.G9.DIAG.08', 'x = 4', false, 2::smallint, now() - interval '14 days'),
      ('Q.G9.DIAG.08', 'x = 3', true, 3::smallint, now() - interval '7 days'),
      ('Q.G9.DEMO.HISTORY.DOTS.01', '(x - 5)^2', false, 4::smallint, now() - interval '9 days'),
      ('Q.G9.DEMO.HISTORY.DOTS.02', '(y - 7)^2', false, 3::smallint, now() - interval '2 days')
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

  -- The active rule set classifies two independent errors as suspected, not
  -- confirmed. Both evidence rows are attached to the one persisted state.
  insert into public.learner_misconceptions (student_id, misconception_id, state, determined_at, reason)
  values (v_student, v_dots_misconception, 'suspected', now() - interval '2 days',
    'Two independent Difference of Two Squares responses matched the same square-of-a-difference pattern.');
  select array_agg(attempt.id order by attempt.occurred_at) into v_dots_attempts
  from public.learning_attempts attempt
  join public.question_versions version on version.id = attempt.question_version_id
  join public.question_items item on item.id = version.question_item_id
  where attempt.student_id = v_student
    and item.item_code in ('Q.G9.DEMO.HISTORY.DOTS.01', 'Q.G9.DEMO.HISTORY.DOTS.02');
  if coalesce(cardinality(v_dots_attempts), 0) <> 2 then
    raise exception 'golden_demo_repeated_misconception_evidence_missing' using errcode='P0002';
  end if;
  insert into public.learner_misconception_evidence (learner_misconception_id, learning_attempt_id)
  select misconception.id, attempt_id
  from public.learner_misconceptions misconception
  cross join unnest(v_dots_attempts) as attempt_id
  where misconception.student_id = v_student and misconception.misconception_id = v_dots_misconception;

  insert into public.skill_mastery_evaluations (student_id, skill_id, rule_set_id, state, determined_at, reason, reason_codes)
  select v_student, skill.id, v_rule, state::public.mastery_state, now() - interval '1 day', reason, reason_codes
  from (values
    ('G9.ALG.LIKE_TERMS', 'secure', 'Four independent correct attempts across separate occasions.', array['INDEPENDENT_EVIDENCE_SUFFICIENT']),
    ('G9.ALG.DISTRIBUTIVE', 'developing', 'Independent evidence shows progress, with one inconsistent response.', array['MEANINGFUL_INDEPENDENT_SUCCESS']),
    ('G9.ALG.FACTOR.COMMON', 'secure', 'Four independent correct attempts across separate occasions.', array['INDEPENDENT_EVIDENCE_SUFFICIENT']),
    ('G9.ALG.EXPAND.BINOMIAL', 'secure', 'Four independent correct attempts across separate occasions.', array['INDEPENDENT_EVIDENCE_SUFFICIENT']),
    ('G9.ALG.FACTOR.DOTS', 'emerging', 'Two independent incorrect attempts show this skill is not yet secure.', array['WEAK_OR_INCONSISTENT_INDEPENDENT_EVIDENCE','UNRESOLVED_CRITICAL_MISCONCEPTION']),
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
    'Two independent responses show the same difference-of-squares misconception; focused comparison is recommended.'
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

revoke all on function public.reset_local_golden_demo(text) from public, anon, authenticated;
grant execute on function public.reset_local_golden_demo(text) to service_role;
