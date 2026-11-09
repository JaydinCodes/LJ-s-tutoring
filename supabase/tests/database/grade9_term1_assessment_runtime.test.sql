begin;

select plan(13);

-- This fixture deliberately calls the production finaliser/evaluator. It does
-- not mock the scoring or mastery query. The formal result is 80% overall but
-- only 2/4 on the critical skill; the production admin qualification RPC then
-- records a skill-specific Assignment observation with four capped independent
-- equivalents for the second session.
create temp table assessment_runtime_fixture(
  policy_id uuid, student_id uuid, critical_skill_id uuid, support_skill_id uuid,
  first_session_id uuid, second_session_id uuid, assignment_evidence_id uuid, assignment_submission_id uuid,
  timeout_session_id uuid, timeout_question_id uuid, timeout_original_option text
) on commit drop;

do $$
declare
  v_admin_user uuid := 'e0000000-0000-0000-0000-000000000101';
  v_student_user uuid := 'e0000000-0000-0000-0000-000000000102';
  v_admin_profile uuid := 'e1000000-0000-0000-0000-000000000101';
  v_student_profile uuid := 'e1000000-0000-0000-0000-000000000102';
  v_student uuid := 'e2000000-0000-0000-0000-000000000102';
  v_policy uuid := gen_random_uuid(); v_definition uuid := gen_random_uuid(); v_form uuid := gen_random_uuid();
  v_version uuid; v_topic uuid; v_curriculum uuid; v_critical uuid; v_support uuid; v_session uuid;
  v_question record; v_attempt integer; v_sequence integer; v_selected text; v_first uuid; v_second uuid;
  v_timeout_session uuid; v_timeout_question uuid; v_timeout_original_option text := 'A';
  v_assignment uuid := gen_random_uuid(); v_submission uuid := gen_random_uuid(); v_evidence uuid;
begin
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,invited_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
  values
    ('00000000-0000-0000-0000-000000000000',v_admin_user,'authenticated','authenticated','assessment-runtime-admin@example.test','',now(),null,'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now(),v_admin_user::text,'',v_admin_user::text,v_admin_user::text),
    ('00000000-0000-0000-0000-000000000000',v_student_user,'authenticated','authenticated','assessment-runtime-student@example.test','',now(),null,'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now(),v_student_user::text,'',v_student_user::text,v_student_user::text);
  insert into public.profiles(id,auth_user_id,full_name,email,role) values
    (v_admin_profile,v_admin_user,'Assessment Runtime Admin','assessment-runtime-admin@example.test','admin'),
    (v_student_profile,v_student_user,'Assessment Runtime Student','assessment-runtime-student@example.test','student');
  insert into public.students(id,profile_id,grade,school,status) values(v_student,v_student_profile,'Grade 9','Runtime Test School','active');

  select metadata.curriculum_topic_id, metadata.curriculum_version_id, metadata.curriculum_skill_id
  into v_topic,v_curriculum,v_critical
  from public.grade9_skill_metadata metadata
  join public.curriculum_skills skill on skill.id=metadata.curriculum_skill_id
  where metadata.term=1 and skill.skill_code='G9-NUM-WHOLE-HCF-LCM' limit 1;
  select metadata.curriculum_skill_id into v_support
  from public.grade9_skill_metadata metadata
  where metadata.curriculum_topic_id=v_topic and metadata.curriculum_skill_id<>v_critical limit 1;
  if v_topic is null or v_support is null then raise exception 'assessment runtime fixture lacks Grade 9 Whole Numbers skills'; end if;

  insert into public.topic_mastery_policies(id,curriculum_topic_id,code,version,name,overall_achievement_threshold,critical_skill_achievement_threshold,minimum_questions_per_critical_skill,critical_skill_coverage_threshold,minimum_reasoning_evidence_count,minimum_reasoning_achievement_threshold,strong_baseline_threshold,requires_mastery_challenge,allow_qualifying_assignment_evidence,qualifying_assignment_minimum_achievement,assignment_evidence_maximum_question_equivalents,review_status,reviewed_by,reviewed_at,created_by)
  values(v_policy,v_topic,'RUNTIME-WHOLE-MASTERY',1,'Runtime Whole mastery',80,75,4,100,2,80,90,true,true,80,4,'approved',v_admin_profile,now(),v_admin_profile);
  insert into public.topic_mastery_policy_skills(topic_mastery_policy_id,skill_id,is_essential,is_critical,requires_reasoning_evidence)
  values(v_policy,v_critical,true,true,true),(v_policy,v_support,true,false,false);
  insert into public.learning_assessment_definitions(id,curriculum_version_id,curriculum_topic_id,topic_mastery_policy_id,code,form_code,name,assessment_type,description,duration_minutes,review_status,created_by)
  values(v_definition,v_curriculum,v_topic,v_policy,'RUNTIME-WHOLE-ENDLINE','RUNTIME-A','Runtime endline','endline','Transactional assessment fixture',30,'draft',v_admin_profile);
  insert into public.learning_assessment_form_versions(id,learning_assessment_definition_id,topic_mastery_policy_id,form_version,review_status,duration_minutes,question_order_mode,solution_release_policy,blueprint_snapshot)
  values(v_form,v_definition,v_policy,1,'draft',30,'fixed','never','{}');

  for v_attempt in 1..2 loop
    insert into public.learning_assessment_sessions(student_id,learning_assessment_definition_id,learning_assessment_form_version_id,curriculum_version_id,curriculum_topic_id,topic_mastery_policy_id,policy_snapshot,assessment_type,start_idempotency_key,started_at,expires_at,original_expires_at)
    values(v_student,v_definition,v_form,v_curriculum,v_topic,v_policy,jsonb_build_object('version',1,'overallAchievementThreshold',80,'criticalSkillAchievementThreshold',75,'minimumQuestionsPerCriticalSkill',4,'minimumReasoningEvidenceCount',2,'minimumReasoningAchievementThreshold',80,'strongBaselineThreshold',90,'allowQualifyingAssignmentEvidence',true,'assignmentEvidenceMaximumQuestionEquivalents',4,'skills',jsonb_build_array(jsonb_build_object('skillId',v_critical,'isEssential',true,'isCritical',true,'requiresReasoningEvidence',true),jsonb_build_object('skillId',v_support,'isEssential',true,'isCritical',false,'requiresReasoningEvidence',false))),'endline',gen_random_uuid(),now(),now()+interval '30 minutes',now()+interval '30 minutes') returning id into v_session;
    v_sequence := 0;
    for v_question in
      select version.id,version.prompt,version.answer_config,version.marks,row_number() over(order by item.item_code) as n
      from public.question_versions version join public.question_items item on item.id=version.question_item_id
      where item.item_code like 'Q.G9.T1C.%' and version.answer_config->>'type'='multiple_choice'
      order by item.item_code limit 10
    loop
      v_sequence := v_sequence + 1;
      insert into public.learning_assessment_session_questions(learning_assessment_session_id,question_version_id,primary_skill_id,sequence_number,prompt_snapshot,options_snapshot,marks_snapshot,reasoning_classification)
      values(v_session,v_question.id,case when v_sequence<=4 then v_critical else v_support end,v_sequence,v_question.prompt,v_question.answer_config->'options',v_question.marks,case when v_sequence in (5,6) then 'mathematical_reasoning' else 'procedural' end);
      v_selected := case when v_sequence<=2 or v_sequence>4 then v_question.answer_config->>'correct_option' when v_question.answer_config->>'correct_option'='A' then 'B' else 'A' end;
      insert into public.learning_assessment_session_answers(learning_assessment_session_question_id,selected_option,last_event_id)
      select question.id,v_selected,gen_random_uuid() from public.learning_assessment_session_questions question where question.learning_assessment_session_id=v_session and question.sequence_number=v_sequence;
    end loop;
    perform public.finalize_learning_assessment_session(v_session,'submitted');
    if v_first is null then v_first:=v_session; else v_second:=v_session; end if;
    if v_attempt = 1 then
      insert into public.assignments(id,title,subject_id,grade,created_by,status) values(v_assignment,'Runtime qualified Assignment',(select id from public.subjects where name='Mathematics' and grade='Grade 9' and curriculum='CAPS' limit 1),'Grade 9',v_admin_profile,'published');
      insert into public.assignment_submissions(id,assignment_id,student_id,text_answer,status,marks_awarded,marks_released,feedback_released,released_at) values(v_submission,v_assignment,v_student,'Independent skill demonstration','marked',100,true,true,now());
      perform set_config('request.jwt.claim.sub', v_admin_user::text, true);
      perform set_config('request.jwt.claims', jsonb_build_object('sub',v_admin_user::text,'role','authenticated')::text, true);
      v_evidence := public.qualify_assignment_mastery_evidence(v_policy,v_submission,v_critical,100,false,'Administrator verified four independent, skill-specific Assignment items.',4,'item_level','{"provenance":"runtime-test-item-level-rubric"}'::jsonb);
    end if;
  end loop;
  insert into public.learning_assessment_sessions(student_id,learning_assessment_definition_id,learning_assessment_form_version_id,curriculum_version_id,curriculum_topic_id,topic_mastery_policy_id,policy_snapshot,assessment_type,start_idempotency_key,started_at,expires_at,original_expires_at)
  values(v_student,v_definition,v_form,v_curriculum,v_topic,v_policy,'{}'::jsonb,'endline',gen_random_uuid(),now()-interval '31 minutes',now()-interval '1 minute',now()-interval '1 minute') returning id into v_timeout_session;
  select version.id, version.prompt, version.answer_config, version.marks into v_question
  from public.question_versions version join public.question_items item on item.id=version.question_item_id
  where item.item_code like 'Q.G9.T1C.%' and version.answer_config->>'type'='multiple_choice'
  order by item.item_code limit 1;
  insert into public.learning_assessment_session_questions(learning_assessment_session_id,question_version_id,primary_skill_id,sequence_number,prompt_snapshot,options_snapshot,marks_snapshot,reasoning_classification)
  values(v_timeout_session,v_question.id,v_critical,1,v_question.prompt,v_question.answer_config->'options',v_question.marks,'procedural') returning id into v_timeout_question;
  insert into public.learning_assessment_session_answers(learning_assessment_session_question_id,selected_option,last_event_id)
  values(v_timeout_question,v_timeout_original_option,gen_random_uuid());
  perform set_config('request.jwt.claim.sub', v_student_user::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_student_user::text,'role','authenticated')::text, true);
  insert into assessment_runtime_fixture values(v_policy,v_student,v_critical,v_support,v_first,v_second,v_evidence,v_submission,v_timeout_session,v_timeout_question,v_timeout_original_option);
end;
$$;

select is((select status from public.topic_mastery_evaluations where assessment_session_id=(select first_session_id from assessment_runtime_fixture)), 'not_yet_mastered', '80% total with only 2/4 on a critical skill is withheld');
select ok((select 'CRITICAL_SKILL_ACHIEVEMENT_BELOW_THRESHOLD'=any(reason_codes) from public.topic_mastery_evaluations where assessment_session_id=(select first_session_id from assessment_runtime_fixture)), 'the weak critical skill produces the targeted mastery reason');
select is((select status from public.topic_mastery_evaluations where assessment_session_id=(select second_session_id from assessment_runtime_fixture)), 'mastered', 'qualified item-level Assignment evidence changes the skill decision when the formal overall requirement is already met');
select is((select overall_achievement from public.topic_mastery_evaluations where assessment_session_id=(select second_session_id from assessment_runtime_fixture)), 80::numeric, 'Assignment evidence does not change the formal overall achievement');
select is((select assignment_evidence_count from public.topic_mastery_evaluation_skill_evidence where topic_mastery_evaluation_id=(select id from public.topic_mastery_evaluations where assessment_session_id=(select second_session_id from assessment_runtime_fixture)) and skill_id=(select critical_skill_id from assessment_runtime_fixture)), 4::smallint, 'the evaluation records the four capped Assignment equivalents separately');
select is((select count(*) from public.topic_mastery_evaluation_evidence where qualifying_assignment_mastery_evidence_id=(select assignment_evidence_id from assessment_runtime_fixture)), 1::bigint, 'qualified Assignment evidence is consumed exactly once');
select is((select count(*) from public.assignment_evidence_for_mastery_session((select second_session_id from assessment_runtime_fixture),(select critical_skill_id from assessment_runtime_fixture),false)), 0::bigint, 'consumed Assignment evidence cannot be selected again');
select is((select count(*) from public.learning_assessment_session_question_results where learning_assessment_session_id=(select second_session_id from assessment_runtime_fixture)), 10::bigint, 'finalisation marked the ten saved responses exactly once');
select lives_ok(format('select public.save_my_learning_assessment_answer(%L::uuid,%L::uuid,''D'',gen_random_uuid())', (select timeout_session_id from assessment_runtime_fixture), (select timeout_question_id from assessment_runtime_fixture)), 'a late answer save returns safely after durable timeout finalisation');
select is((select status from public.learning_assessment_sessions where id=(select timeout_session_id from assessment_runtime_fixture)), 'timed_out', 'an expired session is persisted as timed out');
select is((select selected_option from public.learning_assessment_session_answers where learning_assessment_session_question_id=(select timeout_question_id from assessment_runtime_fixture)), (select timeout_original_option from assessment_runtime_fixture), 'a late answer cannot overwrite the existing saved answer');
select is((select count(*) from public.learning_assessment_session_question_results where learning_assessment_session_id=(select timeout_session_id from assessment_runtime_fixture)), 1::bigint, 'timeout marking is produced exactly once');
do $$ begin
  perform set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000101', true);
  perform set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-000000000101","role":"authenticated"}', true);
end $$;
select throws_ok(
  format('select public.qualify_assignment_mastery_evidence(%L::uuid,%L::uuid,%L::uuid,50,false,''Below the approved minimum.'',1,''skill_aggregate'',''{"provenance":"runtime-unqualified-check"}''::jsonb)', (select policy_id from assessment_runtime_fixture), (select assignment_submission_id from assessment_runtime_fixture), (select critical_skill_id from assessment_runtime_fixture)),
  '23514', 'assignment_evidence_below_configured_qualification_threshold',
  'an unqualified Assignment cannot create evidence or improve mastery'
);

select * from finish();
rollback;
