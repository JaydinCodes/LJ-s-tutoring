begin;

select plan(48);

select has_table('public', 'learning_assessment_form_versions', 'published assessment forms are immutable version records');
select has_table('public', 'learning_assessment_form_questions', 'published forms snapshot their question selection');
select has_table('public', 'learning_assessment_sessions', 'formal assessment sessions are persisted separately from practice attempts');
select has_table('public', 'learning_assessment_session_extensions', 'authorised extensions have an immutable audit record');
select has_table('public', 'learning_assessment_form_solution_releases', 'manual solution release is explicitly audited');
select has_table('public', 'learning_assessment_session_questions', 'sessions snapshot learner-safe question display fields');
select has_table('public', 'learning_assessment_session_answers', 'one current selected answer is stored per session question');
select has_table('public', 'learning_assessment_session_answer_events', 'answer revisions retain append-only event history');
select has_table('public', 'learning_assessment_session_question_results', 'server-side scoring persists per-question evidence');
select has_table('public', 'topic_mastery_evaluations', 'topic mastery decisions are append-only records');
select has_table('public', 'topic_mastery_evaluation_evidence', 'mastery decisions cite their evidence');
select has_table('public', 'learning_assessment_reassessment_authorizations', 'controlled reassessment authorisations are persisted');
select has_table('public', 'topic_mastery_evaluation_skill_evidence', 'per-skill formal achievement evidence is persisted');

select ok((select relrowsecurity from pg_class where oid = 'public.learning_assessment_sessions'::regclass), 'session RLS is enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.learning_assessment_session_extensions'::regclass), 'extension RLS is enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.learning_assessment_session_question_results'::regclass), 'result RLS is enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.topic_mastery_evaluations'::regclass), 'mastery-evaluation RLS is enabled');
select policies_are('public', 'learning_assessment_sessions', array['learning_assessment_sessions_student_or_admin_read'], 'sessions permit only their learner or an administrator to read');
select policies_are('public', 'learning_assessment_session_extensions', array['learning_assessment_session_extensions_admin_read'], 'extension reasons are administrator-only');

select has_column('public', 'learning_assessment_sessions', 'original_expires_at', 'the original deadline is retained');
select has_column('public', 'learning_assessment_sessions', 'policy_snapshot', 'each session captures policy inputs');
select has_column('public', 'learning_assessment_sessions', 'learning_assessment_form_version_id', 'each session points at an immutable form version');
select has_column('public', 'learning_assessment_sessions', 'attempt_number', 'historical attempt numbers are retained');
select has_column('public', 'topic_mastery_policies', 'minimum_questions_per_critical_skill', 'critical skills require meaningful independent sampling');
select has_column('public', 'topic_mastery_policies', 'critical_skill_achievement_threshold', 'critical skill achievement has a separate threshold');

select has_function('public', 'get_my_available_learning_assessments', array[]::text[], 'learner availability is supplied by a controlled function');
select has_function('public', 'start_my_learning_assessment', array['uuid', 'uuid'], 'starting a timed session is server controlled');
select has_function('public', 'save_my_learning_assessment_answer', array['uuid', 'uuid', 'text', 'uuid'], 'formal answer saving is server controlled');
select has_function('public', 'submit_my_learning_assessment', array['uuid'], 'formal submission is server controlled');
select has_function('public', 'get_my_learning_assessment_session', array['uuid'], 'session recovery uses a safe learner payload');
select has_function('public', 'publish_learning_assessment_form', array['uuid'], 'publishing snapshots a reviewed configuration');
select has_function('public', 'evaluate_topic_mastery_from_assessment_session', array['uuid'], 'finalisation evaluates mastery from cited session evidence');
select has_function('public', 'create_learning_assessment_revision', array['uuid', 'text', 'text', 'text'], 'form revisions create a new draft rather than modifying history');
select has_function('public', 'extend_learning_assessment_session', array['uuid', 'smallint', 'text'], 'authorised timed-session extensions are explicit');
select has_function('public', 'release_learning_assessment_form_solutions', array['uuid', 'text'], 'manual solution release is administrator controlled');
select has_function('public', 'authorize_learning_assessment_reassessment', array['uuid', 'uuid', 'text', 'timestamp with time zone'], 'reassessment is an explicit controlled action');
select has_function('public', 'get_learning_assessment_publication_validation', array['uuid'], 'publication blockers are returned precisely to administrators');
select has_function('public', 'get_grade9_term1_assessment_content_coverage', array[]::text[], 'content coverage is reportable without publishing it');

select ok(has_function_privilege('authenticated', 'public.start_my_learning_assessment(uuid,uuid)', 'execute'), 'authenticated learners may reach the start RPC, which rechecks student identity');
select ok(not has_function_privilege('anon', 'public.start_my_learning_assessment(uuid,uuid)', 'execute'), 'anonymous callers cannot start an assessment');
select ok(not has_function_privilege('authenticated', 'public.finalize_learning_assessment_session(uuid,text)', 'execute'), 'learners cannot invoke the scorer directly');
select ok(has_function_privilege('authenticated', 'public.extend_learning_assessment_session(uuid,smallint,text)', 'execute'), 'authenticated users reach the controlled extension RPC, which rechecks administrator authority');
select ok(not has_function_privilege('anon', 'public.extend_learning_assessment_session(uuid,smallint,text)', 'execute'), 'anonymous callers cannot extend time');
select ok(not has_table_privilege('authenticated', 'public.learning_assessment_sessions', 'select'), 'learners cannot directly read policy snapshots from session rows');
select ok(not has_table_privilege('authenticated', 'public.learning_assessment_session_question_results', 'select'), 'question-level correctness remains behind the release-aware RPC');

select is(
  (select count(*) from public.curriculum_skills where skill_code in ('G9-NUM-RATIO-RATE', 'G9-NUM-FINANCIAL-APPLICATIONS')),
  2::bigint,
  'targeted Grade 9 whole-number ratio/rate and financial-application skills are mapped'
);
select ok(
  not exists (
    select 1
    from public.question_versions version
    join public.question_items item on item.id = version.question_item_id
    where item.item_code like 'Q.G9.T1.%' and version.review_status = 'approved'
  ),
  'the authored Grade 9 Term 1 question bank remains unpublished pending review'
);
select is(
  (select count(*) from public.learning_assessment_definitions where code like 'G9-T1-%' and review_status = 'draft'),
  17::bigint,
  'all planned assessment definitions, including independent reassessments, remain review-gated drafts'
);

select * from finish();
rollback;
