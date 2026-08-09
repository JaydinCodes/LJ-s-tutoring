begin;

select no_plan();

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
-- AUTH-01 isolated fixtures.
-- Deliberately unique IDs/names so this file can run against a populated DB.
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
  'fa010000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'auth01-student-20260809@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  'auth01-student-confirm',
  '',
  'auth01-student-change',
  'auth01-student-recovery'
),
(
  '00000000-0000-0000-0000-000000000000',
  'fa010000-0000-4000-8000-000000000002',
  'authenticated',
  'authenticated',
  'auth01-tutor-20260809@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  'auth01-tutor-confirm',
  '',
  'auth01-tutor-change',
  'auth01-tutor-recovery'
);

insert into public.organizations (
  id,
  name,
  type,
  status
)
values (
  'fa050000-0000-4000-8000-000000000001',
  'AUTH01 Isolation Organisation 20260809',
  'ngo',
  'active'
);

insert into public.profiles (
  id,
  auth_user_id,
  full_name,
  email,
  role
)
values
(
  'fa020000-0000-4000-8000-000000000001',
  'fa010000-0000-4000-8000-000000000001',
  'AUTH01 Student',
  'auth01-student-20260809@example.test',
  'student'
),
(
  'fa020000-0000-4000-8000-000000000002',
  'fa010000-0000-4000-8000-000000000002',
  'AUTH01 Tutor',
  'auth01-tutor-20260809@example.test',
  'tutor'
);

insert into public.students (
  id,
  profile_id,
  grade,
  school,
  status,
  organization_id
)
values (
  'fa030000-0000-4000-8000-000000000001',
  'fa020000-0000-4000-8000-000000000001',
  'Grade 11',
  'AUTH01 Test School',
  'active',
  'fa050000-0000-4000-8000-000000000001'
);

insert into public.tutors (
  id,
  profile_id,
  subjects,
  grades,
  status,
  approval_status
)
values (
  'fa040000-0000-4000-8000-000000000001',
  'fa020000-0000-4000-8000-000000000002',
  array['Mathematics'],
  array['Grade 11'],
  'active',
  'approved'
);

insert into public.organization_members (
  organization_id,
  profile_id,
  org_role,
  status
)
values (
  'fa050000-0000-4000-8000-000000000001',
  'fa020000-0000-4000-8000-000000000002',
  'tutor',
  'active'
);

insert into public.subjects (
  id,
  name,
  grade,
  curriculum
)
values (
  'fa060000-0000-4000-8000-000000000001',
  'AUTH01 Isolation Mathematics 20260809',
  'Grade 11',
  'CAPS'
);

insert into public.assignments (
  id,
  title,
  subject_id,
  grade,
  created_by,
  status,
  organization_id
)
values (
  'fa070000-0000-4000-8000-000000000001',
  'AUTH01 Published Assignment',
  'fa060000-0000-4000-8000-000000000001',
  'Grade 11',
  'fa020000-0000-4000-8000-000000000002',
  'published',
  'fa050000-0000-4000-8000-000000000001'
);


-- ===========================================================================
-- ACTIVE STUDENT: positive control
-- ===========================================================================

select pg_temp.authenticate_as(
  'fa010000-0000-4000-8000-000000000001'
);

set local role authenticated;

select is(
  public.current_active_student_id(),
  'fa030000-0000-4000-8000-000000000001'::uuid,
  'active student gets operational identity'
);

select is(
  public.current_student_id(),
  'fa030000-0000-4000-8000-000000000001'::uuid,
  'legacy student helper delegates to active authorization'
);

select is(
  (
    select count(*)
    from public.get_student_accessible_assignments()
    where id = 'fa070000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'active student can read own-organization published assignment'
);

reset role;


-- ===========================================================================
-- INACTIVE STUDENT
-- ===========================================================================

update public.students
set status = 'inactive'
where id = 'fa030000-0000-4000-8000-000000000001';

select pg_temp.authenticate_as(
  'fa010000-0000-4000-8000-000000000001'
);

set local role authenticated;

select is(
  public.current_active_student_id(),
  null::uuid,
  'inactive student has no operational identity'
);

select is(
  public.current_student_id(),
  null::uuid,
  'legacy student helper fails closed for inactive student'
);

select is(
  public.current_student_org_id(),
  null::uuid,
  'inactive student has no organization authorization'
);

select is(
  (
    select count(*)
    from public.assignments
    where id = 'fa070000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'inactive student cannot read assignment'
);

select throws_ok(
  $$
    select public.submit_assignment_submission(
      p_assignment_id =>
        'fa070000-0000-4000-8000-000000000001',
      p_submission_id =>
        'fa080000-0000-4000-8000-000000000001',
      p_storage_key => null,
      p_file_url => null,
      p_original_filename => null,
      p_mime_type => null,
      p_size_bytes => null,
      p_text_answer => 'AUTH01 inactive attempt'
    )
  $$,
  '42501',
  'only_students_can_submit',
  'inactive student cannot submit work'
);

reset role;


-- ===========================================================================
-- SUSPENDED STUDENT
-- ===========================================================================

update public.students
set status = 'suspended'
where id = 'fa030000-0000-4000-8000-000000000001';

select pg_temp.authenticate_as(
  'fa010000-0000-4000-8000-000000000001'
);

set local role authenticated;

select is(
  public.current_active_student_id(),
  null::uuid,
  'suspended student has no operational identity'
);

select is(
  (
    select count(*)
    from public.assignments
    where id = 'fa070000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'suspended student cannot read assignment'
);

select throws_ok(
  $$
    select public.submit_assignment_submission(
      p_assignment_id =>
        'fa070000-0000-4000-8000-000000000001',
      p_submission_id =>
        'fa080000-0000-4000-8000-000000000002',
      p_storage_key => null,
      p_file_url => null,
      p_original_filename => null,
      p_mime_type => null,
      p_size_bytes => null,
      p_text_answer => 'AUTH01 suspended attempt'
    )
  $$,
  '42501',
  'only_students_can_submit',
  'suspended student cannot submit work'
);

reset role;


-- ===========================================================================
-- PENDING STUDENT
-- ===========================================================================

update public.students
set status = 'pending'
where id = 'fa030000-0000-4000-8000-000000000001';

select pg_temp.authenticate_as(
  'fa010000-0000-4000-8000-000000000001'
);

set local role authenticated;

select is(
  public.current_active_student_id(),
  null::uuid,
  'pending student has no operational identity'
);

select is(
  (
    select count(*)
    from public.assignments
    where id = 'fa070000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'pending student cannot read assignment'
);

reset role;


-- Restore student.
update public.students
set status = 'active'
where id = 'fa030000-0000-4000-8000-000000000001';


-- ===========================================================================
-- ACTIVE + APPROVED TUTOR: positive control
-- ===========================================================================

select pg_temp.authenticate_as(
  'fa010000-0000-4000-8000-000000000002'
);

set local role authenticated;

select is(
  public.current_approved_active_tutor_id(),
  'fa040000-0000-4000-8000-000000000001'::uuid,
  'approved active tutor gets operational identity'
);

select is(
  public.current_tutor_id(),
  'fa040000-0000-4000-8000-000000000001'::uuid,
  'legacy tutor helper delegates to approved active authorization'
);

select is(
  (
    select count(*)
    from public.assignments
    where id = 'fa070000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'approved active tutor can read own assignment'
);

reset role;


-- ===========================================================================
-- PENDING TUTOR
-- ===========================================================================

update public.tutors
set
  status = 'pending',
  approval_status = 'pending'
where id = 'fa040000-0000-4000-8000-000000000001';

select pg_temp.authenticate_as(
  'fa010000-0000-4000-8000-000000000002'
);

set local role authenticated;

select is(
  public.current_approved_active_tutor_id(),
  null::uuid,
  'pending tutor has no operational identity'
);

select is(
  public.current_tutor_id(),
  null::uuid,
  'legacy tutor helper fails closed for pending tutor'
);

select is(
  public.current_tutor_onboarding_id(),
  'fa040000-0000-4000-8000-000000000001'::uuid,
  'pending tutor retains onboarding identity'
);

select is(
  (
    select count(*)
    from public.assignments
    where id = 'fa070000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'pending tutor cannot read operational assignment'
);

reset role;


-- ===========================================================================
-- UNDER-REVIEW TUTOR
-- ===========================================================================

update public.tutors
set
  status = 'active',
  approval_status = 'under_review'
where id = 'fa040000-0000-4000-8000-000000000001';

select pg_temp.authenticate_as(
  'fa010000-0000-4000-8000-000000000002'
);

set local role authenticated;

select is(
  public.current_approved_active_tutor_id(),
  null::uuid,
  'under-review tutor has no operational identity'
);

select is(
  (
    select count(*)
    from public.assignments
    where id = 'fa070000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'under-review tutor cannot read operational assignment'
);

select is(
  public.current_tutor_onboarding_id(),
  'fa040000-0000-4000-8000-000000000001'::uuid,
  'under-review tutor retains onboarding identity'
);

reset role;


-- ===========================================================================
-- REJECTED TUTOR
-- ===========================================================================

update public.tutors
set
  status = 'active',
  approval_status = 'rejected'
where id = 'fa040000-0000-4000-8000-000000000001';

select pg_temp.authenticate_as(
  'fa010000-0000-4000-8000-000000000002'
);

set local role authenticated;

select is(
  public.current_approved_active_tutor_id(),
  null::uuid,
  'rejected tutor has no operational identity'
);

select is(
  (
    select count(*)
    from public.assignments
    where id = 'fa070000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'rejected tutor cannot read operational assignment'
);

reset role;


-- ===========================================================================
-- INACTIVE TUTOR
-- ===========================================================================

update public.tutors
set
  status = 'inactive',
  approval_status = 'approved'
where id = 'fa040000-0000-4000-8000-000000000001';

select pg_temp.authenticate_as(
  'fa010000-0000-4000-8000-000000000002'
);

set local role authenticated;

select is(
  public.current_approved_active_tutor_id(),
  null::uuid,
  'inactive tutor has no operational identity'
);

select is(
  public.current_tutor_onboarding_id(),
  null::uuid,
  'inactive tutor loses onboarding exception'
);

select is(
  (
    select count(*)
    from public.assignments
    where id = 'fa070000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'inactive tutor cannot read operational assignment'
);

reset role;


-- ===========================================================================
-- SUSPENDED TUTOR
-- ===========================================================================

update public.tutors
set
  status = 'suspended',
  approval_status = 'approved'
where id = 'fa040000-0000-4000-8000-000000000001';

select pg_temp.authenticate_as(
  'fa010000-0000-4000-8000-000000000002'
);

set local role authenticated;

select is(
  public.current_approved_active_tutor_id(),
  null::uuid,
  'suspended tutor has no operational identity'
);

select is(
  public.current_tutor_onboarding_id(),
  null::uuid,
  'suspended tutor loses onboarding exception'
);

select is(
  (
    select count(*)
    from public.assignments
    where id = 'fa070000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'suspended tutor cannot read operational assignment'
);

reset role;

select * from finish();

rollback;
