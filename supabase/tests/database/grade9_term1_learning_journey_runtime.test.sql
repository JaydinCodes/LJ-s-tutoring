begin;

select plan(11);

create temp table learning_journey_fixture(
  student_user_id uuid,
  other_student_user_id uuid,
  student_id uuid,
  topic_code text,
  session_id uuid,
  published_definition_id uuid
) on commit drop;

-- This invokes the learner-facing RPC with real authentication claims and
-- persisted activity/assessment state. It does not replace the journey with
-- a source-string assertion or a mocked client response.
do $$
declare
  v_student_user uuid := 'e0000000-0000-0000-0000-000000000201';
  v_other_user uuid := 'e0000000-0000-0000-0000-000000000202';
  v_student_profile uuid := 'e1000000-0000-0000-0000-000000000201';
  v_other_profile uuid := 'e1000000-0000-0000-0000-000000000202';
  v_student uuid := 'e2000000-0000-0000-0000-000000000201';
  v_other_student uuid := 'e2000000-0000-0000-0000-000000000202';
  v_topic uuid;
  v_curriculum uuid;
  v_policy uuid := gen_random_uuid();
  v_definition uuid;
  v_published_definition uuid := gen_random_uuid();
  v_form uuid := gen_random_uuid();
  v_published_form uuid := gen_random_uuid();
  v_session uuid;
  v_topic_code text;
begin
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,invited_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
  values
    ('00000000-0000-0000-0000-000000000000',v_student_user,'authenticated','authenticated','journey-runtime-student@example.test','',now(),null,'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now(),v_student_user::text,'',v_student_user::text,v_student_user::text),
    ('00000000-0000-0000-0000-000000000000',v_other_user,'authenticated','authenticated','journey-runtime-other@example.test','',now(),null,'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now(),v_other_user::text,'',v_other_user::text,v_other_user::text);
  insert into public.profiles(id,auth_user_id,full_name,email,role) values
    (v_student_profile,v_student_user,'Journey Runtime Student','journey-runtime-student@example.test','student'),
    (v_other_profile,v_other_user,'Journey Runtime Other','journey-runtime-other@example.test','student');
  insert into public.students(id,profile_id,grade,school,status) values
    (v_student,v_student_profile,'Grade 9','Runtime Test School','active'),
    (v_other_student,v_other_profile,'Grade 9','Runtime Test School','active');

  select topic.id, metadata.curriculum_version_id, topic.code
  into v_topic, v_curriculum, v_topic_code
  from public.curriculum_topics topic
  join public.grade9_skill_metadata metadata on metadata.curriculum_topic_id = topic.id
    and metadata.term = 1 and metadata.valid_until is null
  order by topic.display_order, topic.code
  limit 1;
  select id into v_definition from public.learning_assessment_definitions
  where curriculum_topic_id = v_topic and assessment_type = 'topic_baseline'
  order by created_at limit 1;
  if v_topic is null or v_definition is null then
    raise exception 'learning journey runtime fixture lacks Grade 9 Term 1 assessment metadata';
  end if;

  insert into public.topic_mastery_policies(
    id,curriculum_topic_id,code,version,name,overall_achievement_threshold,
    critical_skill_achievement_threshold,minimum_questions_per_critical_skill,
    critical_skill_coverage_threshold,minimum_reasoning_evidence_count,
    minimum_reasoning_achievement_threshold,strong_baseline_threshold,
    requires_mastery_challenge,allow_qualifying_assignment_evidence,
    qualifying_assignment_minimum_achievement,assignment_evidence_maximum_question_equivalents,
    review_status,reviewed_by,reviewed_at,created_by
  ) values (
    v_policy,v_topic,'RUNTIME-JOURNEY-POLICY',91,'Runtime journey policy',80,75,4,100,2,80,90,
    true,false,80,2,'approved',v_student_profile,now(),v_student_profile
  );

  insert into public.learning_assessment_form_versions(
    id,learning_assessment_definition_id,topic_mastery_policy_id,form_version,
    review_status,duration_minutes,question_order_mode,solution_release_policy,blueprint_snapshot
  ) values (v_form,v_definition,v_policy,91,'draft',20,'fixed','never','{}');
  insert into public.learning_assessment_definitions(
    id,curriculum_version_id,curriculum_topic_id,topic_mastery_policy_id,code,form_code,name,
    assessment_type,assessment_route,description,duration_minutes,review_status,reviewed_by,reviewed_at,created_by
  ) values (
    v_published_definition,v_curriculum,v_topic,v_policy,'RUNTIME-JOURNEY-BASELINE','RUNTIME-JOURNEY-A','Runtime published baseline',
    'topic_baseline','standard','Published journey fixture',20,'approved',v_student_profile,now(),v_student_profile
  );
  insert into public.learning_assessment_form_versions(
    id,learning_assessment_definition_id,topic_mastery_policy_id,form_version,review_status,
    duration_minutes,question_order_mode,solution_release_policy,blueprint_snapshot,published_by,published_at
  ) values (
    v_published_form,v_published_definition,v_policy,1,'approved',20,'fixed','never',
    '{"questionCount":0}'::jsonb,v_student_profile,now()
  );
  insert into public.learning_assessment_sessions(
    student_id,learning_assessment_definition_id,learning_assessment_form_version_id,
    curriculum_version_id,curriculum_topic_id,topic_mastery_policy_id,policy_snapshot,
    assessment_type,start_idempotency_key,started_at,expires_at,original_expires_at
  ) values (
    v_student,v_definition,v_form,v_curriculum,v_topic,v_policy,'{}'::jsonb,
    'topic_baseline',gen_random_uuid(),now(),now() + interval '20 minutes',now() + interval '20 minutes'
  ) returning id into v_session;

  perform set_config('request.jwt.claim.sub', v_student_user::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_student_user::text,'role','authenticated')::text, true);
  insert into learning_journey_fixture values(v_student_user,v_other_user,v_student,v_topic_code,v_session,v_published_definition);
end;
$$;

select has_table('public', 'student_learning_journey_context', 'journey context is persisted independently of mastery records');
select has_function('public', 'get_my_grade9_term1_learning_journey', array[]::text[], 'the learner receives a single server-owned Grade 9 Term 1 journey contract');
select has_function('public', 'set_my_grade9_term1_learning_context', array['text', 'text', 'text'], 'a learner may persist a current topic through a controlled RPC');
select is(
  (select public.get_my_grade9_term1_learning_journey() #>> '{primary,action}'),
  'resume_assessment',
  'an in-progress formal session wins the primary learning action'
);
select is(
  (select public.get_my_grade9_term1_learning_journey() #>> '{primary,reasonCodes,0}'),
  'FORMAL_SESSION_IN_PROGRESS',
  'the resume action carries a stable learner-safe reason code'
);
select lives_ok(
  format('select public.set_my_grade9_term1_learning_context(%L, null, null)', (select topic_code from learning_journey_fixture)),
  'a learner can select one Grade 9 Term 1 topic without writing directly to the context table'
);
select is(
  (select public.get_my_grade9_term1_learning_journey() #>> '{context,selectedTopicCode}'),
  (select topic_code from learning_journey_fixture),
  'the next journey response includes the persisted selected topic'
);
select is(
  (select jsonb_array_length(public.get_my_grade9_term1_learning_journey() -> 'topics')),
  4,
  'the runtime roadmap contains all four Grade 9 Term 1 topics'
);
update public.learning_assessment_sessions
set status = 'submitted', submitted_at = now(), finalised_at = now()
where id = (select session_id from learning_journey_fixture);
select is(
  (select public.get_my_grade9_term1_learning_journey() #>> '{primary,action}'),
  'start_baseline',
  'when no activity or session is resumable, an eligible server-published baseline becomes the single primary action'
);
select is(
  (select public.get_my_grade9_term1_learning_journey() #>> '{primary,assessmentDefinitionId}'),
  (select published_definition_id::text from learning_journey_fixture),
  'the journey exposes only the server-approved assessment definition identifier'
);
do $$
begin
  perform set_config('request.jwt.claim.sub', (select other_student_user_id::text from learning_journey_fixture), true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', (select other_student_user_id::text from learning_journey_fixture), 'role', 'authenticated')::text, true);
end;
$$;
select is(
  (select public.get_my_grade9_term1_learning_journey() #>> '{context,selectedTopicCode}'),
  null::text,
  'another learner cannot retrieve the first learner’s saved journey context'
);

select * from finish();
rollback;
