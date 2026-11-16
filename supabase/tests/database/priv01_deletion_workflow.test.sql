begin;

-- Fail instead of waiting on production locks during linked preflight.
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- PRIV01_PENDING_MIGRATION

select no_plan();

-- PRIV-01 focused linked preflight.
-- Uses isolated fixture IDs and rolls back the entire file.

create function pg_temp.authenticate_as(
  p_user_id uuid,
  p_aal text default 'aal1'
)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_user_id::text,
      'role', 'authenticated',
      'aal', p_aal
    )::text,
    true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Structural privilege assertions.
-- ---------------------------------------------------------------------------
select ok(
  not has_function_privilege('anon', 'public.anonymize_student(uuid)', 'execute'),
  'anon cannot execute legacy anonymize_student'
);

select ok(
  not has_function_privilege('authenticated', 'public.anonymize_student(uuid)', 'execute'),
  'authenticated cannot execute legacy anonymize_student'
);

select ok(
  not has_function_privilege('service_role', 'public.anonymize_student(uuid)', 'execute'),
  'service_role cannot bypass workflow through legacy anonymize_student'
);

select ok(
  not has_function_privilege('anon', 'public.begin_student_privacy_deletion(uuid)', 'execute'),
  'anon cannot execute deletion stage RPCs'
);

select ok(
  not has_function_privilege('authenticated', 'public.begin_student_privacy_deletion(uuid)', 'execute'),
  'authenticated cannot execute deletion stage RPCs'
);

select ok(
  has_function_privilege('service_role', 'public.begin_student_privacy_deletion(uuid)', 'execute'),
  'service_role can execute trusted deletion stage RPCs'
);
select ok(
  has_function_privilege('service_role', 'public.claim_student_privacy_deletion(uuid,uuid)', 'execute'),
  'service_role can claim a deletion lease'
);

select ok(
  has_function_privilege('authenticated', 'public.process_privacy_request(uuid)', 'execute'),
  'authenticated can reach non-deletion privacy wrapper'
);

-- ---------------------------------------------------------------------------
-- Isolated fixture.
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
(
  '00000000-0000-0000-0000-000000000000',
  'fb010000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'priv01-student-20260809@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  'priv01-student-confirm',
  '',
  'priv01-student-change',
  'priv01-student-recovery'
),
(
  '00000000-0000-0000-0000-000000000000',
  'fb010000-0000-4000-8000-000000000002',
  'authenticated',
  'authenticated',
  'priv01-admin-20260809@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  'priv01-admin-confirm',
  '',
  'priv01-admin-change',
  'priv01-admin-recovery'
);

insert into public.organizations (
  id,
  name,
  type,
  status
)
values (
  'fb050000-0000-4000-8000-000000000001',
  'PRIV01 Isolation Organisation 20260809',
  'direct',
  'active'
);

insert into public.profiles (
  id,
  auth_user_id,
  full_name,
  email,
  phone,
  role
)
values
(
  'fb020000-0000-4000-8000-000000000001',
  'fb010000-0000-4000-8000-000000000001',
  'PRIV01 Learner PII',
  'priv01-student-20260809@example.test',
  '+27000000001',
  'student'
),
(
  'fb020000-0000-4000-8000-000000000002',
  'fb010000-0000-4000-8000-000000000002',
  'PRIV01 Admin',
  'priv01-admin-20260809@example.test',
  null,
  'admin'
);

insert into public.students (
  id,
  profile_id,
  grade,
  school,
  parent_name,
  parent_contact,
  status,
  organization_id
)
values (
  'fb030000-0000-4000-8000-000000000001',
  'fb020000-0000-4000-8000-000000000001',
  'Grade 11',
  'PRIV01 School PII',
  'PRIV01 Parent PII',
  '+27000000002',
  'active',
  'fb050000-0000-4000-8000-000000000001'
);

insert into public.privacy_requests (
  id,
  subject_student_id,
  subject_profile_id,
  request_type,
  status,
  requested_by,
  notes,
  result
)
values
(
  'fb060000-0000-4000-8000-000000000001',
  'fb030000-0000-4000-8000-000000000001',
  'fb020000-0000-4000-8000-000000000001',
  'deletion',
  'pending',
  'fb020000-0000-4000-8000-000000000002',
  'Delete learner PRIV01 Learner PII',
  '{}'::jsonb
),
(
  'fb060000-0000-4000-8000-000000000002',
  'fb030000-0000-4000-8000-000000000001',
  'fb020000-0000-4000-8000-000000000001',
  'access',
  'approved',
  'fb020000-0000-4000-8000-000000000002',
  'Historical export containing learner PII',
  jsonb_build_object(
    'full_name', 'PRIV01 Learner PII',
    'email', 'priv01-student-20260809@example.test'
  )
);

-- Profile trigger should have created both identity mappings.
create function pg_temp.seed_learning_privacy_graph(p_student_id uuid, p_age interval)
returns void language plpgsql as $$
declare
  v_definition public.learning_assessment_definitions;
  v_form uuid;
  v_session uuid;
  v_question uuid;
  v_result uuid;
  v_evaluation uuid;
  v_question_version uuid;
  v_skill uuid;
begin
  select * into strict v_definition from public.learning_assessment_definitions
    where topic_mastery_policy_id is not null order by code limit 1;
  select link.question_version_id, skill.skill_id into strict v_question_version, v_skill
    from public.learning_assessment_definition_questions link
    join public.question_version_skill_links skill on skill.question_version_id = link.question_version_id and skill.relationship_type = 'primary'
    where link.learning_assessment_definition_id = v_definition.id order by link.display_order limit 1;
  select id into v_form from public.learning_assessment_form_versions
    where learning_assessment_definition_id = v_definition.id order by form_version desc limit 1;
  if v_form is null then
    insert into public.learning_assessment_form_versions(learning_assessment_definition_id, form_version, duration_minutes, question_order_mode, solution_release_policy)
      values(v_definition.id, 1, 30, 'fixed', 'after_submission') returning id into v_form;
  end if;
  insert into public.learning_assessment_sessions(student_id, learning_assessment_definition_id, learning_assessment_form_version_id,
    curriculum_version_id, curriculum_topic_id, topic_mastery_policy_id, assessment_type, start_idempotency_key, started_at, expires_at, original_expires_at, created_at)
    values(p_student_id, v_definition.id, v_form, v_definition.curriculum_version_id, v_definition.curriculum_topic_id,
      v_definition.topic_mastery_policy_id, v_definition.assessment_type, gen_random_uuid(), now() - p_age, now() - p_age + interval '30 minutes', now() - p_age + interval '30 minutes', now() - p_age)
    returning id into v_session;
  insert into public.learning_assessment_session_questions(learning_assessment_session_id, question_version_id, primary_skill_id, sequence_number, prompt_snapshot, options_snapshot, marks_snapshot, reasoning_classification)
    values(v_session, v_question_version, v_skill, 1, 'Privacy fixture response', '{"A":"1","B":"2","C":"3","D":"4"}', 1, 'procedural') returning id into v_question;
  insert into public.learning_assessment_session_answers(learning_assessment_session_question_id, selected_option, last_event_id, updated_at)
    values(v_question, 'B', gen_random_uuid(), now() - p_age);
  insert into public.learning_assessment_session_answer_events(learning_assessment_session_id, learning_assessment_session_question_id, selected_option, idempotency_key, created_at)
    values(v_session, v_question, 'B', gen_random_uuid(), now() - p_age);
  insert into public.learning_assessment_session_question_results(learning_assessment_session_id, learning_assessment_session_question_id, skill_id, reasoning_classification, selected_option, is_correct, marks_awarded, marks_available, created_at)
    values(v_session, v_question, v_skill, 'procedural', 'B', true, 1, 1, now() - p_age) returning id into v_result;
  insert into public.topic_mastery_evaluations(student_id, curriculum_topic_id, curriculum_version_id, topic_mastery_policy_id, policy_version, assessment_session_id, assessment_type, status, determined_at, created_at)
    values(p_student_id, v_definition.curriculum_topic_id, v_definition.curriculum_version_id, v_definition.topic_mastery_policy_id, 1, v_session, 'endline', 'not_yet_mastered', now() - p_age, now() - p_age) returning id into v_evaluation;
  insert into public.topic_mastery_evaluation_evidence(topic_mastery_evaluation_id, learning_assessment_session_question_result_id, created_at)
    values(v_evaluation, v_result, now() - p_age);
  insert into public.topic_mastery_evaluation_skill_evidence(topic_mastery_evaluation_id, skill_id, is_critical, formal_question_count, formal_correct_count, total_independent_evidence_count, achievement, evidence_state)
    values(v_evaluation, v_skill, true, 1, 1, 1, 100, 'insufficient');
  insert into public.learning_assessment_session_extensions(learning_assessment_session_id, previous_expires_at, extended_expires_at, added_minutes, reason, authorised_by, authorised_at)
    values(v_session, now() - p_age + interval '30 minutes', now() - p_age + interval '45 minutes', 15, 'Privacy fixture', 'fb020000-0000-4000-8000-000000000002', now() - p_age);
  insert into public.learning_assessment_reassessment_authorizations(student_id, prior_session_id, reassessment_definition_id, reason, authorised_by, authorised_at)
    values(p_student_id, v_session, v_definition.id, 'Privacy fixture', 'fb020000-0000-4000-8000-000000000002', now() - p_age);
end;
$$;

select pg_temp.seed_learning_privacy_graph('fb030000-0000-4000-8000-000000000001', interval '1 day');

insert into public.profiles(id, full_name, email, role)
  values('fb020000-0000-4000-8000-000000000003', 'Expired learning fixture', 'privacy-expired@example.test', 'student');
insert into public.students(id, profile_id, grade, status, organization_id)
  values('fb030000-0000-4000-8000-000000000003', 'fb020000-0000-4000-8000-000000000003', 'Grade 9', 'active', 'fb050000-0000-4000-8000-000000000001');
select pg_temp.seed_learning_privacy_graph('fb030000-0000-4000-8000-000000000003', interval '4 years');

select ok(
  (private.execute_retention_cleanup(false) #>> '{eligible,learning_students}')::integer >= 1,
  'retention dry-run counts expired learning graphs'
);
select is((select count(*) from public.learning_assessment_sessions where student_id = 'fb030000-0000-4000-8000-000000000003'), 1::bigint,
  'retention dry-run preserves expired answers and sessions');
select lives_ok($$select private.execute_retention_cleanup(true)$$, 'retention apply removes an expired evidence graph in FK order');
select is((select count(*) from public.learning_assessment_sessions where student_id = 'fb030000-0000-4000-8000-000000000003'), 0::bigint,
  'retention apply removes expired formal sessions');
select is((select count(*) from public.learning_assessment_sessions where student_id = 'fb030000-0000-4000-8000-000000000001'), 1::bigint,
  'retention preserves another learner recent formal session');

select is(
  (
    select count(*)
    from public.profile_identities
    where profile_id = 'fb020000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'learner starts with an Auth-to-profile identity mapping'
);

-- ---------------------------------------------------------------------------
-- Browser/admin wrapper must refuse deletion even for an AAL2 platform admin.
-- ---------------------------------------------------------------------------
select pg_temp.authenticate_as(
  'fb010000-0000-4000-8000-000000000002',
  'aal2'
);
set local role authenticated;

select is(jsonb_array_length(public.export_student_data('fb030000-0000-4000-8000-000000000001') #> '{learning_records,learning_assessment_session_answers}'), 1,
  'admin export includes only the subject answers');
select is(jsonb_array_length(public.export_student_data('fb030000-0000-4000-8000-000000000001') #> '{learning_records,topic_mastery_evaluation_evidence}'), 1,
  'admin export includes formal mastery evidence');

select throws_ok(
  $$select public.process_privacy_request('fb060000-0000-4000-8000-000000000001'::uuid)$$,
  '42501',
  'privacy_deletion_requires_trusted_worker',
  'AAL2 admin cannot complete deletion through browser privacy RPC'
);

reset role;

-- ---------------------------------------------------------------------------
-- Stage 1: lock. Simulates the first service-role RPC made by the Edge Function.
-- ---------------------------------------------------------------------------
set local role service_role;

select lives_ok(
  $$select public.claim_student_privacy_deletion(
    'fb060000-0000-4000-8000-000000000001'::uuid,
    'fb070000-0000-4000-8000-000000000001'::uuid
  )$$,
  'trusted worker can claim and lock deletion request'
);

select throws_ok(
  $$select public.claim_student_privacy_deletion(
    'fb060000-0000-4000-8000-000000000001'::uuid,
    'fb070000-0000-4000-8000-000000000002'::uuid
  )$$,
  '55P03',
  'privacy_deletion_busy',
  'a second privacy worker cannot steal an active lease'
);

select lives_ok(
  $$select public.renew_student_privacy_deletion_lease(
    'fb060000-0000-4000-8000-000000000001'::uuid,
    'fb070000-0000-4000-8000-000000000001'::uuid
  )$$,
  'lease holder can renew privacy work before the next external stage'
);

reset role;

select is(
  (
    select processing_state
    from public.privacy_requests
    where id = 'fb060000-0000-4000-8000-000000000001'
  ),
  'locked',
  'request enters locked state'
);

select is(
  (
    select status::text
    from public.students
    where id = 'fb030000-0000-4000-8000-000000000001'
  ),
  'inactive',
  'learner is operationally disabled at lock stage'
);

select is(
  (
    select count(*)
    from public.profile_identities
    where profile_id = 'fb020000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'Auth-to-profile identity mapping is removed at lock stage'
);

select is(
  (
    select processing_subject_auth_user_id
    from public.privacy_requests
    where id = 'fb060000-0000-4000-8000-000000000001'
  ),
  'fb010000-0000-4000-8000-000000000001'::uuid,
  'workflow retains Auth user ID only as transient processing state'
);

select is(
  (
    select status::text
    from public.privacy_requests
    where id = 'fb060000-0000-4000-8000-000000000001'
  ),
  'pending',
  'request is not presented as approved after lock only'
);

select throws_ok(
  $$select public.finalize_student_privacy_deletion('fb060000-0000-4000-8000-000000000001'::uuid)$$,
  '23514',
  'invalid_privacy_deletion_stage:locked',
  'finalization fails closed before external stages complete'
);

-- Storage manifest must be callable only through trusted worker and should be
-- empty for this fixture because no Storage objects were created.
set local role service_role;
select is(
  (
    select count(*)
    from public.get_student_privacy_storage_manifest(
      'fb060000-0000-4000-8000-000000000001'::uuid
    )
  ),
  0::bigint,
  'storage manifest resolves cleanly for learner with no files'
);

-- ---------------------------------------------------------------------------
-- Simulate successful Auth-ban and Storage-API stages.
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.mark_student_privacy_auth_banned('fb060000-0000-4000-8000-000000000001'::uuid)$$,
  'worker records Auth ban stage'
);

select lives_ok(
  $$select public.record_student_privacy_storage_manifest(
    'fb060000-0000-4000-8000-000000000001'::uuid,
    7
  )$$,
  'worker persists the Storage manifest count before external deletion'
);

select lives_ok(
  $$select public.mark_student_privacy_storage_deleted('fb060000-0000-4000-8000-000000000001'::uuid, 0)$$,
  'worker records Storage deletion stage after an external-delete response loss'
);

select is(
  (
    select storage_files_removed
    from public.privacy_requests
    where id = 'fb060000-0000-4000-8000-000000000001'
  ),
  7,
  'Storage receipt count survives a crash before the stage write'
);

select lives_ok(
  $$select public.erase_student_privacy_data('fb060000-0000-4000-8000-000000000001'::uuid)$$,
  'database erasure manifest executes against production schema'
);

reset role;

select is(jsonb_array_length(private.export_student_learning_data('fb030000-0000-4000-8000-000000000001')->'learning_assessment_sessions'), 0,
  'trusted deletion removes formal sessions after dependent evidence');
select is((select result #>> '{db_erasure_counts,topic_mastery_evaluation_evidence_deleted}' from public.privacy_requests where id = 'fb060000-0000-4000-8000-000000000001'), '1',
  'trusted deletion records mastery evidence counts in the compliance receipt payload');

select is(
  (
    select processing_state
    from public.privacy_requests
    where id = 'fb060000-0000-4000-8000-000000000001'
  ),
  'db_erased',
  'request reaches db_erased stage'
);

select is(
  (
    select status::text
    from public.privacy_requests
    where id = 'fb060000-0000-4000-8000-000000000001'
  ),
  'pending',
  'database erasure still does not mark request approved'
);

select is(
  (
    select auth_user_id
    from public.profiles
    where id = 'fb020000-0000-4000-8000-000000000001'
  ),
  null::uuid,
  'profile is detached from Auth before hard Auth deletion'
);

select is(
  (
    select full_name
    from public.profiles
    where id = 'fb020000-0000-4000-8000-000000000001'
  ),
  'Redacted Learner',
  'profile name is anonymized'
);

select is(
  (
    select phone
    from public.profiles
    where id = 'fb020000-0000-4000-8000-000000000001'
  ),
  null::text,
  'profile phone is erased'
);

select is(
  (
    select grade
    from public.students
    where id = 'fb030000-0000-4000-8000-000000000001'
  ),
  null::text,
  'student grade is erased'
);

select is(
  (
    select school
    from public.students
    where id = 'fb030000-0000-4000-8000-000000000001'
  ),
  null::text,
  'student school is erased'
);

select is(
  (
    select parent_name
    from public.students
    where id = 'fb030000-0000-4000-8000-000000000001'
  ),
  null::text,
  'student parent name is erased'
);

select is(
  (
    select parent_contact
    from public.students
    where id = 'fb030000-0000-4000-8000-000000000001'
  ),
  null::text,
  'student parent contact is erased'
);

select is(
  (
    select subject_student_id
    from public.privacy_requests
    where id = 'fb060000-0000-4000-8000-000000000002'
  ),
  null::uuid,
  'historical privacy request is detached from student'
);

select is(
  (
    select subject_profile_id
    from public.privacy_requests
    where id = 'fb060000-0000-4000-8000-000000000002'
  ),
  null::uuid,
  'historical privacy request is detached from profile'
);

select is(
  (
    select notes
    from public.privacy_requests
    where id = 'fb060000-0000-4000-8000-000000000002'
  ),
  null::text,
  'historical privacy request notes are erased'
);

select is(
  (
    select result
    from public.privacy_requests
    where id = 'fb060000-0000-4000-8000-000000000002'
  ),
  '{"redacted_by_deletion": true}'::jsonb,
  'historical privacy export payload is redacted'
);

-- ---------------------------------------------------------------------------
-- Simulate the Edge Function's Auth hard-delete. The profile/student must
-- survive because the migration changes the profile FK to ON DELETE SET NULL.
-- ---------------------------------------------------------------------------
delete from auth.users
where id = 'fb010000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)
    from public.profiles
    where id = 'fb020000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'Auth hard-delete does not cascade-delete retained anonymized profile'
);

select is(
  (
    select count(*)
    from public.students
    where id = 'fb030000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'Auth hard-delete does not cascade-delete retained anonymized student row'
);

set local role service_role;

select lives_ok(
  $$select public.mark_student_privacy_auth_deleted('fb060000-0000-4000-8000-000000000001'::uuid)$$,
  'worker records Auth hard-delete stage'
);

select lives_ok(
  $$select public.finalize_student_privacy_deletion('fb060000-0000-4000-8000-000000000001'::uuid)$$,
  'worker finalizes only after Auth hard-delete stage'
);

reset role;

select is(
  (
    select processing_state
    from public.privacy_requests
    where id = 'fb060000-0000-4000-8000-000000000001'
  ),
  'completed',
  'request reaches completed state'
);

select is(
  (
    select status::text
    from public.privacy_requests
    where id = 'fb060000-0000-4000-8000-000000000001'
  ),
  'approved',
  'deletion request becomes approved only after complete workflow'
);

select is(
  (
    select subject_student_id
    from public.privacy_requests
    where id = 'fb060000-0000-4000-8000-000000000001'
  ),
  null::uuid,
  'completed request contains no student identifier'
);

select is(
  (
    select subject_profile_id
    from public.privacy_requests
    where id = 'fb060000-0000-4000-8000-000000000001'
  ),
  null::uuid,
  'completed request contains no profile identifier'
);

select is(
  (
    select processing_subject_auth_user_id
    from public.privacy_requests
    where id = 'fb060000-0000-4000-8000-000000000001'
  ),
  null::uuid,
  'completed request removes transient Auth identifier'
);

select is(
  (
    select notes
    from public.privacy_requests
    where id = 'fb060000-0000-4000-8000-000000000001'
  ),
  null::text,
  'completed request contains no free-text notes'
);

select ok(
  not (
    select result::text ~* 'priv01-student|example\\.test|Learner PII|School PII|Parent PII'
    from public.privacy_requests
    where id = 'fb060000-0000-4000-8000-000000000001'
  ),
  'completed request result contains no fixture PII'
);

select is(
  (
    select count(*)
    from public.privacy_deletion_receipts
    where request_id = 'fb060000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'exactly one compliance receipt is created'
);

select ok(
  (
    select auth_account_deleted
    from public.privacy_deletion_receipts
    where request_id = 'fb060000-0000-4000-8000-000000000001'
  ),
  'compliance receipt records Auth account deletion'
);

select is(
  (
    select manifest_version
    from public.privacy_deletion_receipts
    where request_id = 'fb060000-0000-4000-8000-000000000001'
  ),
  'PRIV-02-learning-v1',
  'receipt records erasure manifest version'
);

select ok(
  not (
    select row_to_json(r)::text ~* 'priv01-student|example\\.test|Learner PII|School PII|Parent PII'
    from public.privacy_deletion_receipts r
    where request_id = 'fb060000-0000-4000-8000-000000000001'
  ),
  'receipt contains no fixture PII'
);

select throws_ok(
  $$
    update public.privacy_deletion_receipts
    set storage_files_removed = storage_files_removed + 1
    where request_id = 'fb060000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'privacy_deletion_receipt_is_immutable',
  'compliance receipt cannot be updated'
);

select throws_ok(
  $$
    delete from public.privacy_deletion_receipts
    where request_id = 'fb060000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'privacy_deletion_receipt_is_immutable',
  'compliance receipt cannot be deleted'
);

-- Idempotent finalization should return without creating another receipt.
set local role service_role;
select lives_ok(
  $$select public.finalize_student_privacy_deletion('fb060000-0000-4000-8000-000000000001'::uuid)$$,
  'finalization is idempotent after completion'
);
reset role;

select is(
  (
    select count(*)
    from public.privacy_deletion_receipts
    where request_id = 'fb060000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'idempotent finalization keeps exactly one receipt'
);

select * from finish();
rollback;
