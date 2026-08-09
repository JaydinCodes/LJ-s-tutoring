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
  $$select public.begin_student_privacy_deletion('fb060000-0000-4000-8000-000000000001'::uuid)$$,
  'trusted worker can lock deletion request'
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
  $$select public.mark_student_privacy_storage_deleted('fb060000-0000-4000-8000-000000000001'::uuid, 0)$$,
  'worker records Storage deletion stage'
);

select lives_ok(
  $$select public.erase_student_privacy_data('fb060000-0000-4000-8000-000000000001'::uuid)$$,
  'database erasure manifest executes against production schema'
);

reset role;

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
  'PRIV-01-v1',
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