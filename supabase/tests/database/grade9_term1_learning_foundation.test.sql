begin;

select no_plan();

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
  17::bigint,
  'entry baseline, topic pathways and independent reassessment forms are represented as drafts'
);

select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.topic_mastery_policies'::regclass),
  'topic mastery policy RLS is active'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.topic_mastery_policy_skills'::regclass),
  'topic mastery policy skill RLS is active'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.learning_assessment_definitions'::regclass),
  'assessment definition RLS is active'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.learning_assessment_definition_questions'::regclass),
  'assessment question mapping RLS is active'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.qualifying_assignment_mastery_evidence'::regclass),
  'qualified assignment evidence RLS is active'
);

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
  has_function_privilege('authenticated', 'public.qualify_assignment_mastery_evidence(uuid,uuid,uuid,numeric,boolean,text,smallint,text,jsonb)', 'execute'),
  'authenticated reaches the controlled assignment-evidence RPC, which rechecks admin authority'
);
select ok(
  not has_function_privilege('anon', 'public.qualify_assignment_mastery_evidence(uuid,uuid,uuid,numeric,boolean,text,smallint,text,jsonb)', 'execute'),
  'anon cannot execute the assignment-evidence RPC'
);

create temp table release_initial_form_count as
  select count(*) as form_count from public.learning_assessment_form_versions where review_status = 'approved';

insert into auth.users(id, aud, role, email, created_at, updated_at)
  values('fa160000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'batch-release-admin@example.test', now(), now());
insert into public.profiles(id, auth_user_id, full_name, email, role)
  values('fa160000-0000-4000-8000-000000000002', 'fa160000-0000-4000-8000-000000000001', 'Batch release admin fixture', 'batch-release-admin@example.test', 'admin');

select set_config('request.jwt.claim.sub', 'fa160000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"fa160000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

select is((public.release_grade9_term1_content()->>'practice_questions')::integer, 76,
  'batch preview scopes the exact reviewed v3 practice pack');
select is((public.release_grade9_term1_content()->>'formal_questions')::integer, 0,
  'batch publication excludes formal content by default');
select throws_ok($$select public.release_grade9_term1_content(true, 'stale', 'Fixture review')$$,
  '40001', 'grade9_release_preview_stale', 'batch publication rejects a changed or unpreviewed pack');
select throws_ok($$select public.release_grade9_term1_content(true, public.release_grade9_term1_content()->>'fingerprint')$$,
  '23514', 'academic_review_reference_required', 'batch publication requires an academic review reference');
select throws_ok($$select public.release_grade9_term1_content(true, public.release_grade9_term1_content(p_include_formal => true)->>'fingerprint', 'Fixture review', true)$$,
  '23514', 'formal_academic_signoff_reference_required', 'formal publication requires its separate academic sign-off');
select lives_ok($$select public.release_grade9_term1_content(true, public.release_grade9_term1_content()->>'fingerprint', 'Disposable instructional review fixture')$$,
  'one atomic admin operation approves reviewed questions, lessons and activities');
select lives_ok($$select public.release_grade9_term1_content(true, public.release_grade9_term1_content()->>'fingerprint', 'Disposable instructional review fixture')$$,
  'repeat instructional publication is safe');
reset role;

select is((select count(*) from public.learning_activity_templates where code ~ '^A\.G[89]\.S4\.' and review_status = 'approved'), 19::bigint,
  'the whole reviewed practice pack becomes learner-visible');
select is((select count(*) from public.learning_assessment_form_versions where review_status = 'approved'), (select form_count from release_initial_form_count),
  'practice publication does not silently publish unreviewed formal forms');

set local role authenticated;
select lives_ok($$select public.release_grade9_term1_content(true, public.release_grade9_term1_content(p_include_formal => true)->>'fingerprint', 'Disposable instructional review fixture', true, 'Disposable formal review fixture')$$,
  'the separately signed-off formal pack uses existing publication validators');
select is((public.release_grade9_term1_content(true, public.release_grade9_term1_content(p_include_formal => true)->>'fingerprint', 'Disposable instructional review fixture', true, 'Disposable formal review fixture')->>'forms_published')::integer, 0,
  'repeat formal publication creates no duplicate immutable forms');
reset role;

select is((select count(*) from public.learning_assessment_form_versions where review_status = 'approved'), 17::bigint,
  'the reviewed formal pack publishes exactly 17 immutable forms');

select set_config('request.jwt.claim.sub', 'fa160000-0000-4000-8000-000000000099', true);
select set_config('request.jwt.claims', '{"sub":"fa160000-0000-4000-8000-000000000099","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$select public.release_grade9_term1_content()$$,
  '42501', null, 'a non-admin cannot preview or publish the answer-key-bearing release pack');
reset role;

select * from finish();
rollback;
