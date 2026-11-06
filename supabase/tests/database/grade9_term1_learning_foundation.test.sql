begin;

select plan(22);

select has_table('public', 'topic_mastery_policies', 'topic mastery policies are persisted in the existing public learning schema');
select has_table('public', 'topic_mastery_policy_skills', 'topic policy skill requirements are persisted separately from skill evidence');
select has_table('public', 'learning_assessment_definitions', 'formal assessment definitions are persisted');
select has_table('public', 'learning_assessment_definition_questions', 'assessment forms link immutable question versions');
select has_table('public', 'qualifying_assignment_mastery_evidence', 'assignment evidence has an explicit learning boundary');

select is(
  (select count(*) from public.curriculum_topics topic
   join public.curriculum_areas area on area.id = topic.curriculum_area_id
   join public.curriculum_versions version on version.id = area.curriculum_version_id
   where version.code = 'CAPS-MATH-G9-2026' and topic.term = 1
     and topic.code in ('WHOLE-NUMBERS', 'INTEGERS', 'EXPONENTS', 'NUMERIC-GEOMETRIC-PATTERNS')),
  4::bigint,
  'the complete Grade 9 Term 1 topic sequence is mapped'
);
select ok(
  exists (
    select 1 from public.skill_prerequisites dependency
    join public.curriculum_skills target on target.id = dependency.skill_id
    join public.curriculum_skills prerequisite on prerequisite.id = dependency.prerequisite_skill_id
    where target.skill_code = 'G9-EXP-LAWS-EXTENDED'
      and prerequisite.skill_code = 'G8-EXP-LAWS-SCI'
  ),
  'extended Grade 9 exponent laws point to the Grade 8 foundation'
);
select ok(
  exists (
    select 1 from public.skill_prerequisites dependency
    join public.curriculum_skills target on target.id = dependency.skill_id
    join public.curriculum_skills prerequisite on prerequisite.id = dependency.prerequisite_skill_id
    where target.skill_code = 'G9-PAT-GEOMETRIC-VISUAL'
      and prerequisite.skill_code = 'G8-PAT-REPRESENT-RULE'
  ),
  'visual geometric patterns point to the Grade 8 representation foundation'
);
select is(
  (select count(*) from public.learning_assessment_definitions where code like 'G9-T1-%'),
  13::bigint,
  'entry baseline plus each topic baseline, endline and mastery challenge are represented as drafts'
);

select row_security_active('public.topic_mastery_policies'::regclass), 'topic mastery policy RLS is active';
select row_security_active('public.topic_mastery_policy_skills'::regclass), 'topic mastery policy skill RLS is active';
select row_security_active('public.learning_assessment_definitions'::regclass), 'assessment definition RLS is active';
select row_security_active('public.learning_assessment_definition_questions'::regclass), 'assessment question mapping RLS is active';
select row_security_active('public.qualifying_assignment_mastery_evidence'::regclass), 'qualified assignment evidence RLS is active';

select policies_are('public', 'topic_mastery_policies', array['topic_mastery_policies_admin_read'], 'only the admin read policy exists for topic policies');
select policies_are('public', 'learning_assessment_definitions', array['learning_assessment_definitions_admin_read'], 'only the admin read policy exists for assessment definitions');
select policies_are('public', 'qualifying_assignment_mastery_evidence', array['qualifying_assignment_mastery_evidence_admin_read'], 'only the admin read policy exists for qualified assignment evidence');

select ok(
  not has_table_privilege('anon', 'public.topic_mastery_policies', 'select'),
  'anon cannot read mastery policy configuration'
);
select ok(
  has_function_privilege('authenticated', 'public.save_topic_mastery_policy_draft(jsonb,uuid)', 'execute'),
  'authenticated reaches the controlled topic-policy RPC, which rechecks admin authority'
);
select ok(
  not has_function_privilege('anon', 'public.save_topic_mastery_policy_draft(jsonb,uuid)', 'execute'),
  'anon cannot execute the topic-policy RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.qualify_assignment_mastery_evidence(uuid,uuid,uuid,numeric,boolean,text)', 'execute'),
  'authenticated reaches the controlled assignment-evidence RPC, which rechecks admin authority'
);
select ok(
  not has_function_privilege('anon', 'public.qualify_assignment_mastery_evidence(uuid,uuid,uuid,numeric,boolean,text)', 'execute'),
  'anon cannot execute the assignment-evidence RPC'
);

select * from finish();
rollback;
