begin;

select no_plan();

-- Keep role simulation local to this transaction. Supabase's auth.uid() and
-- auth.jwt() helpers read these request settings exactly as PostgREST does.
create function pg_temp.authenticate_as(p_user_id uuid, p_aal text default 'aal1')
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

-- SECURITY INVOKER helper used to count rows affected by an authenticated
-- Storage UPDATE. PostgreSQL only permits a data-modifying CTE at statement
-- top level, so wrapping UPDATE + ROW_COUNT keeps the pgTAP assertion scalar
-- while preserving the caller's RLS context.
create function pg_temp.update_storage_object_metadata(p_name text, p_metadata jsonb)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_rows bigint;
begin
  update storage.objects
  set metadata = p_metadata
  where bucket_id = 'assignment-submissions'
    and name = p_name;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- Stable fixture identities.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  seed.id::uuid,
  'authenticated',
  'authenticated',
  seed.email,
  '',
  now(),
  case when seed.is_invited then now() else null end,
  '{"provider":"email","providers":["email"]}'::jsonb
    || case
      when seed.onboarding_role is null then '{}'::jsonb
      else jsonb_build_object('onboarding_role', seed.onboarding_role)
    end,
  case
    when seed.user_metadata_role is null then '{}'::jsonb
    else jsonb_build_object('role', seed.user_metadata_role)
  end,
  now(),
  now(),
  seed.id,
  '',
  seed.id,
  seed.id
from (values
  ('00000000-0000-0000-0000-000000000001', 'rls-admin@example.test', null, null, false),
  ('00000000-0000-0000-0000-000000000002', 'rls-student-a@example.test', null, null, false),
  ('00000000-0000-0000-0000-000000000003', 'rls-tutor-a@example.test', null, null, false),
  ('00000000-0000-0000-0000-000000000004', 'rls-parent-a@example.test', null, null, false),
  ('00000000-0000-0000-0000-000000000005', 'rls-ngo-a@example.test', null, null, false),
  ('00000000-0000-0000-0000-000000000006', 'rls-student-b@example.test', null, null, false),
  ('00000000-0000-0000-0000-000000000007', 'rls-tutor-b@example.test', null, null, false),
  ('00000000-0000-0000-0000-000000000008', 'rls-parent-b@example.test', null, null, false),
  ('00000000-0000-0000-0000-000000000009', 'rls-uninvited@example.test', 'student', 'student', false),
  ('00000000-0000-0000-0000-000000000010', 'rls-invited-student@example.test', 'student', 'tutor', true),
  ('00000000-0000-0000-0000-000000000011', 'rls-invited-no-role@example.test', null, 'student', true)
) as seed(id, email, onboarding_role, user_metadata_role, is_invited);

insert into public.organizations (id, name, type, status)
values
  ('a0000000-0000-0000-0000-000000000001', 'RLS NGO Alpha', 'ngo', 'active'),
  ('a0000000-0000-0000-0000-000000000002', 'RLS School Beta', 'school', 'active');

insert into public.profiles (id, auth_user_id, full_name, email, role)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'RLS Admin', 'rls-admin@example.test', 'admin'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Student Alpha', 'rls-student-a@example.test', 'student'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'Tutor Alpha', 'rls-tutor-a@example.test', 'tutor'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'Parent Alpha', 'rls-parent-a@example.test', 'parent'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005', 'NGO Alpha Viewer', 'rls-ngo-a@example.test', 'ngo_partner'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000006', 'Student Beta', 'rls-student-b@example.test', 'student'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000007', 'Tutor Beta', 'rls-tutor-b@example.test', 'tutor'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000008', 'Parent Beta', 'rls-parent-b@example.test', 'parent');

insert into public.students (id, profile_id, grade, school, status, organization_id)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Grade 11', 'Alpha School', 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000006', 'Grade 11', 'Beta School', 'active', 'a0000000-0000-0000-0000-000000000002');

insert into public.tutors (id, profile_id, subjects, grades, status, approval_status)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', array['Mathematics'], array['Grade 11'], 'active', 'approved'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007', array['Mathematics'], array['Grade 11'], 'active', 'approved');

insert into public.organization_members (organization_id, profile_id, org_role, status)
values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'tutor', 'active'),
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'partner_viewer', 'active'),
  ('a0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007', 'tutor', 'active');

insert into public.guardians (id, profile_id, full_name, email, status)
values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'Parent Alpha', 'rls-parent-a@example.test', 'active'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000008', 'Parent Beta', 'rls-parent-b@example.test', 'active');

insert into public.student_guardians (student_id, guardian_id, relationship_type, is_primary, can_receive_reports, status)
values
  ('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'parent', true, true, 'active'),
  ('20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'parent', true, true, 'active');

insert into public.subjects (id, name, grade, curriculum)
values ('90000000-0000-0000-0000-000000000001', 'Mathematics', 'Grade 11', 'CAPS');

insert into public.assignments (id, title, subject_id, grade, created_by, status, organization_id)
values
  ('50000000-0000-0000-0000-000000000001', 'Alpha Published One', '90000000-0000-0000-0000-000000000001', 'Grade 11', '10000000-0000-0000-0000-000000000003', 'published', 'a0000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000002', 'Alpha Published Two', '90000000-0000-0000-0000-000000000001', 'Grade 11', '10000000-0000-0000-0000-000000000003', 'published', 'a0000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000003', 'Alpha Draft', '90000000-0000-0000-0000-000000000001', 'Grade 11', '10000000-0000-0000-0000-000000000003', 'draft', 'a0000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000004', 'Beta Published', '90000000-0000-0000-0000-000000000001', 'Grade 11', '10000000-0000-0000-0000-000000000007', 'published', 'a0000000-0000-0000-0000-000000000002');

-- A private legacy path exists to prove the student projection does not leak
-- it even though staff can still retain historical memo data.
update public.assignments
set memo_url = '50000000-0000-0000-0000-000000000001/legacy-private-memo.pdf'
where id = '50000000-0000-0000-0000-000000000001';

insert into public.classes (id, name, tutor_id, subject_id, grade, status, organization_id)
values
  ('c0000000-0000-0000-0000-000000000001', 'Alpha Mathematics', '30000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'Grade 11', 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002', 'Beta Mathematics', '30000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', 'Grade 11', 'active', 'a0000000-0000-0000-0000-000000000002');

insert into public.class_enrollments (id, class_id, student_id, status)
values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'active'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'active');

insert into public.tutor_student_allocations (
  id,
  tutor_id,
  student_id,
  status,
  focus_notes,
  subject_id,
  rate_override,
  allowed_days_json,
  allowed_time_ranges_json
)
values
  (
    'e0000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'active',
    'Internal Alpha focus notes',
    '90000000-0000-0000-0000-000000000001',
    777.77,
    '["monday"]'::jsonb,
    '[{"start":"15:00","end":"17:00"}]'::jsonb
  ),
  (
    'e0000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'active',
    'Internal Beta focus notes',
    '90000000-0000-0000-0000-000000000001',
    888.88,
    '["tuesday"]'::jsonb,
    '[{"start":"14:00","end":"16:00"}]'::jsonb
  );

insert into public.assignment_submissions (
  id,
  assignment_id,
  student_id,
  text_answer,
  status,
  marks_awarded,
  feedback,
  marks_released,
  feedback_released,
  released_at
)
values
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Alpha answer one', 'marked', 61, 'Not released', false, false, null),
  ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Alpha answer two', 'marked', 88, 'Released feedback', true, true, now()),
  ('60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'Beta answer', 'marked', 73, 'Beta feedback', true, true, now());

insert into public.student_notifications (id, student_id, type, title, body)
values
  ('80000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'GRADE_RELEASED', 'Alpha result', 'Your Alpha result is ready.'),
  ('80000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'GRADE_RELEASED', 'Beta result', 'Your Beta result is ready.');

insert into storage.objects (bucket_id, name, owner, metadata)
values
  ('assignment-files', '50000000-0000-0000-0000-000000000001/brief.pdf', '00000000-0000-0000-0000-000000000003', '{}'::jsonb),
  ('assignment-files', '50000000-0000-0000-0000-000000000002/brief.pdf', '00000000-0000-0000-0000-000000000003', '{}'::jsonb),
  ('assignment-files', '50000000-0000-0000-0000-000000000003/draft.pdf', '00000000-0000-0000-0000-000000000003', '{}'::jsonb),
  ('assignment-files', '50000000-0000-0000-0000-000000000004/brief.pdf', '00000000-0000-0000-0000-000000000007', '{}'::jsonb),
  ('assignment-submissions', '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/60000000-0000-0000-0000-000000000001/submission.pdf', '00000000-0000-0000-0000-000000000002', '{}'::jsonb),
  ('assignment-submissions', '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000002/60000000-0000-0000-0000-000000000002/submission.pdf', '00000000-0000-0000-0000-000000000002', '{}'::jsonb),
  ('assignment-submissions', '20000000-0000-0000-0000-000000000002/50000000-0000-0000-0000-000000000004/60000000-0000-0000-0000-000000000003/submission.pdf', '00000000-0000-0000-0000-000000000006', '{}'::jsonb);

-- Edge Function limiter: service-role-only execution, threshold behavior,
-- retention, and a real database failure that must propagate to the caller.
-- The Edge Functions translate that RPC error into a fail-closed 503.
insert into public.edge_function_rate_limit_events (id, subject_id, function_name, created_at)
values (
  'f0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000010',
  'pgTAP-stale-cleanup',
  now() - interval '25 hours'
);

create function pg_temp.force_rate_limit_insert_failure()
returns trigger
language plpgsql
as $$
begin
  if new.function_name = 'pgTAP-forced-insert-failure' then
    raise exception 'forced_rate_limit_insert_failure' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger pg_tap_force_rate_limit_insert_failure
before insert on public.edge_function_rate_limit_events
for each row execute function pg_temp.force_rate_limit_insert_failure();

-- Retention cleanup privileges are split between an authenticated admin RPC and
-- a service-role-only scheduler RPC. The private worker is unreachable to API
-- roles even if a caller knows its name.
select ok(
  not has_function_privilege('anon', 'public.run_retention_cleanup(boolean)', 'execute'),
  'anon has no EXECUTE privilege on the admin retention RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.run_retention_cleanup(boolean)', 'execute'),
  'authenticated can reach the admin RPC so its authoritative admin check can run'
);
select ok(
  not has_function_privilege('service_role', 'public.run_retention_cleanup(boolean)', 'execute'),
  'service_role cannot use the browser/admin retention RPC'
);
select ok(
  not has_function_privilege('anon', 'public.run_retention_cleanup_scheduled()', 'execute'),
  'anon has no EXECUTE privilege on the scheduler retention RPC'
);
select ok(
  not has_function_privilege('authenticated', 'public.run_retention_cleanup_scheduled()', 'execute'),
  'authenticated has no EXECUTE privilege on the scheduler retention RPC'
);
select ok(
  has_function_privilege('service_role', 'public.run_retention_cleanup_scheduled()', 'execute'),
  'service_role has EXECUTE privilege on the scheduler retention RPC'
);
select ok(
  not has_function_privilege('anon', 'private.execute_retention_cleanup(boolean)', 'execute'),
  'anon cannot execute the private retention worker'
);
select ok(
  not has_function_privilege('authenticated', 'private.execute_retention_cleanup(boolean)', 'execute'),
  'authenticated cannot execute the private retention worker'
);
select ok(
  not has_function_privilege('service_role', 'private.execute_retention_cleanup(boolean)', 'execute'),
  'service_role cannot bypass the scheduler wrapper to execute the private worker'
);

set local role service_role;

select throws_ok(
  $$select public.run_retention_cleanup_scheduled()$$,
  '42501',
  'service_role_jwt_required',
  'database role alone is insufficient without a signed service_role JWT claim'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'service_role')::text,
  true
);
select is(
  (public.run_retention_cleanup_scheduled() ->> 'applied')::boolean,
  true,
  'service-role scheduler applies cleanup when both grant and JWT role are valid'
);

select is(
  public.check_and_record_edge_function_rate_limit(
    'f0000000-0000-0000-0000-000000000011',
    'pgTAP-threshold',
    2,
    60
  ),
  true,
  'service-role limiter allows the first request'
);
select is(
  public.check_and_record_edge_function_rate_limit(
    'f0000000-0000-0000-0000-000000000011',
    'pgTAP-threshold',
    2,
    60
  ),
  true,
  'service-role limiter allows the request at the configured threshold'
);
select is(
  public.check_and_record_edge_function_rate_limit(
    'f0000000-0000-0000-0000-000000000011',
    'pgTAP-threshold',
    2,
    60
  ),
  false,
  'service-role limiter denies requests beyond the threshold'
);
select is(
  public.check_and_record_edge_function_rate_limit(
    'f0000000-0000-0000-0000-000000000010',
    'pgTAP-stale-cleanup',
    5,
    60
  ),
  true,
  'limiter records a request after stale-event cleanup'
);
select throws_ok(
  $$
    select public.check_and_record_edge_function_rate_limit(
      'f0000000-0000-0000-0000-000000000012',
      'pgTAP-forced-insert-failure',
      2,
      60
    )
  $$,
  'P0001',
  'forced_rate_limit_insert_failure',
  'limiter propagates a real insert failure instead of failing open'
);

reset role;

select is(
  (select count(*) from public.edge_function_rate_limit_events where id = 'f0000000-0000-0000-0000-000000000001'),
  0::bigint,
  'limiter deletes events older than 24 hours'
);
select is(
  (
    select count(*)
    from public.edge_function_rate_limit_events
    where subject_id = 'f0000000-0000-0000-0000-000000000011'
      and function_name = 'pgTAP-threshold'
  ),
  2::bigint,
  'denied limiter request does not create an event'
);

select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000002');
set local role authenticated;

select throws_ok(
  $$
    select public.check_and_record_edge_function_rate_limit(
      'f0000000-0000-0000-0000-000000000011',
      'pgTAP-authenticated-denial',
      2,
      60
    )
  $$,
  '42501',
  'permission denied for function check_and_record_edge_function_rate_limit',
  'authenticated browser role cannot execute the service-role limiter'
);

reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'anon')::text,
  true
);
set local role anon;

select throws_ok(
  $$select public.run_retention_cleanup(false)$$,
  '42501',
  'permission denied for function run_retention_cleanup',
  'anonymous callers cannot execute the admin retention RPC'
);
select throws_ok(
  $$select public.run_retention_cleanup_scheduled()$$,
  '42501',
  'permission denied for function run_retention_cleanup_scheduled',
  'anonymous callers cannot execute the scheduler retention RPC'
);

reset role;

-- PERF-01: exercising 1,001 records proves that headline dashboard metrics
-- are SQL aggregates rather than an implicitly capped PostgREST response.
insert into public.student_progress (id, student_id, subject_id, topic, score, recorded_at)
select
  ('7' || lpad(series::text, 31, '0'))::uuid,
  '20000000-0000-0000-0000-000000000001'::uuid,
  '90000000-0000-0000-0000-000000000001'::uuid,
  'PERF-01 fixture ' || series,
  42,
  now() - (series || ' minutes')::interval
from generate_series(1, 1001) as series;

-- Student Alpha: published own-org learning data only; results are redacted
-- through the RPC and notifications/storage remain owner scoped.
select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000002');
set local role authenticated;

select cmp_ok(
  (select count(*) from public.student_progress where student_id = '20000000-0000-0000-0000-000000000001'),
  '>=',
  1001::bigint,
  'PERF-01 fixture contains more rows than the PostgREST 1,000-row ceiling'
);
select is(
  (public.get_student_dashboard_metrics() ->> 'overall_score')::numeric,
  (select round(avg(score), 0) from public.student_progress where student_id = '20000000-0000-0000-0000-000000000001'),
  'student dashboard overall score aggregates all 1,001+ progress rows in PostgreSQL'
);

select throws_ok(
  $$select public.run_retention_cleanup(false)$$,
  '42501',
  'not_authorized',
  'student cannot run retention cleanup'
);
select throws_ok(
  $$select public.run_retention_cleanup_scheduled()$$,
  '42501',
  'permission denied for function run_retention_cleanup_scheduled',
  'student cannot execute the scheduler retention RPC'
);

select is((select count(*) from public.assignments), 0::bigint, 'student cannot read raw assignment rows or private columns');
select is((select count(*) from public.get_student_accessible_assignments()), 2::bigint, 'student safe assignment RPC returns only eligible published own-org work');
select ok(
  not ((select to_jsonb(a) from public.get_student_accessible_assignments() a where id = '50000000-0000-0000-0000-000000000001') ? 'memo_url'),
  'student safe assignment RPC never returns the private memo path'
);
select ok(
  public.can_student_access_assignment('50000000-0000-0000-0000-000000000001'),
  'student eligibility gate permits a matching active learner, grade, organization, and published assignment'
);
select ok(
  not public.can_student_access_assignment('50000000-0000-0000-0000-000000000003'),
  'student eligibility gate denies a draft assignment'
);
select ok(
  not public.can_student_access_assignment('50000000-0000-0000-0000-000000000004'),
  'student eligibility gate denies a cross-organization assignment'
);
select is((select count(*) from public.assignment_submissions), 0::bigint, 'student cannot read raw submission/result rows');
select is((select count(*) from public.get_student_assignment_submissions()), 2::bigint, 'student result RPC returns only own submissions');
select ok((select marks_awarded is null from public.get_student_assignment_submissions() where assignment_id = '50000000-0000-0000-0000-000000000001'), 'student RPC redacts unreleased marks');
select is((select marks_awarded from public.get_student_assignment_submissions() where assignment_id = '50000000-0000-0000-0000-000000000002'), 88::numeric, 'student RPC exposes released marks');
select is((select count(*) from public.student_notifications), 1::bigint, 'student sees only own notifications');
select is((select count(*) from public.guardians), 0::bigint, 'student cannot read guardian records');
select is((select count(*) from public.tutors), 0::bigint, 'student cannot read tutor base rows or hourly/approval fields');
select is((select count(*) from public.tutor_student_allocations), 0::bigint, 'student cannot read allocation base rows or rate overrides');
select is((select count(*) from public.profiles where id = '10000000-0000-0000-0000-000000000003'), 0::bigint, 'student cannot read the allocated tutor base profile');
select is((select count(*) from public.get_student_assigned_tutors()), 1::bigint, 'student safe RPC returns one actively assigned tutor');
select is((select full_name from public.get_student_assigned_tutors()), 'Tutor Alpha', 'student safe RPC returns the assigned tutor display name');
select is((select email from public.get_student_assigned_tutors()), 'rls-tutor-a@example.test', 'student safe RPC returns the assigned tutor email');
select is((select count(*) from jsonb_object_keys((select to_jsonb(t) from public.get_student_assigned_tutors() t))), 3::bigint, 'student safe RPC exposes exactly id, full_name, and email');
select throws_ok(
  $$select * from public.get_tutor_allocated_students()$$,
  '42501',
  'only_tutors_can_view_allocated_students',
  'student cannot call the tutor-only learner directory RPC'
);
select is((select count(*) from public.classes), 1::bigint, 'student sees only an enrolled own-organization class without recursive RLS');
select is((select count(*) from public.class_enrollments), 1::bigint, 'student sees only their own class enrollment');
select is((select count(*) from public.classes where organization_id = 'a0000000-0000-0000-0000-000000000002'), 0::bigint, 'student cannot see a cross-organization class');
select is((select count(*) from storage.objects where bucket_id = 'assignment-files'), 2::bigint, 'student sees assignment files only for eligible published work');
select is((select count(*) from storage.objects where bucket_id = 'assignment-submissions'), 2::bigint, 'student sees only own submission files');

reset role;

-- Tutor Alpha: organization/member and creator ownership both apply.
select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000003');
set local role authenticated;

select throws_ok(
  $$select public.run_retention_cleanup(false)$$,
  '42501',
  'not_authorized',
  'tutor cannot run retention cleanup'
);
select throws_ok(
  $$select public.run_retention_cleanup_scheduled()$$,
  '42501',
  'permission denied for function run_retention_cleanup_scheduled',
  'tutor cannot execute the scheduler retention RPC'
);

select is((select count(*) from public.assignments), 3::bigint, 'tutor sees own organization assignments including drafts');
select is((select count(*) from public.assignments where organization_id = 'a0000000-0000-0000-0000-000000000002'), 0::bigint, 'tutor cannot see cross-organization assignments');
select is((select count(*) from public.assignment_submissions), 2::bigint, 'tutor sees submissions only for assignments they created');
select is((select count(*) from public.student_notifications), 0::bigint, 'tutor cannot read student notifications');
select is((select count(*) from public.guardians), 0::bigint, 'tutor cannot read guardian records');
select is((select count(*) from public.tutors), 1::bigint, 'tutor retains access to their own tutor base row');
select is((select count(*) from public.tutor_student_allocations), 1::bigint, 'tutor retains access to their own active allocation');
select is((select count(*) from public.students), 0::bigint, 'tutor cannot read learner base rows or guardian/parent fields');
select is((select count(*) from public.profiles where id = '10000000-0000-0000-0000-000000000002'), 0::bigint, 'tutor cannot read the allocated learner base profile');
select is((select count(*) from public.get_tutor_allocated_students()), 1::bigint, 'tutor safe RPC returns one actively allocated learner');
select is((select full_name from public.get_tutor_allocated_students()), 'Student Alpha', 'tutor safe RPC returns the allocated learner display name');
select is((select email from public.get_tutor_allocated_students()), 'rls-student-a@example.test', 'tutor safe RPC returns the allocated learner email');
select is((select grade from public.get_tutor_allocated_students()), 'Grade 11', 'tutor safe RPC returns the allocated learner grade');
select is((select school from public.get_tutor_allocated_students()), 'Alpha School', 'tutor safe RPC returns the allocated learner school');
select is((select count(*) from public.get_tutor_allocated_students() where student_id = '20000000-0000-0000-0000-000000000002'), 0::bigint, 'tutor safe RPC excludes cross-organization learners');
select is((select count(*) from jsonb_object_keys((select to_jsonb(s) from public.get_tutor_allocated_students() s))), 6::bigint, 'tutor safe RPC exposes exactly the six approved learner fields');
select throws_ok(
  $$select * from public.get_student_assigned_tutors()$$,
  '42501',
  'only_students_can_view_assigned_tutors',
  'tutor cannot call the student-only tutor directory RPC'
);
select is((select count(*) from public.classes), 1::bigint, 'tutor sees their own class without recursive RLS');
select is((select count(*) from public.class_enrollments), 1::bigint, 'tutor sees enrollments only for their own class without recursive RLS');
select is((select count(*) from public.class_enrollments where class_id = 'c0000000-0000-0000-0000-000000000002'), 0::bigint, 'tutor cannot see cross-organization class enrollments');
select is((select count(*) from storage.objects where bucket_id = 'assignment-files'), 3::bigint, 'tutor sees files only for assignments they created');
select is((select count(*) from storage.objects where bucket_id = 'assignment-submissions'), 2::bigint, 'tutor sees submission files only for assignments they created');

-- AUTH-03: raw assignment writes are prohibited and the only write RPC checks
-- the requested organization against the tutor's active membership.
select throws_ok(
  $$
    insert into public.assignments (title, created_by, status, organization_id)
    values ('Cross-org raw write', '10000000-0000-0000-0000-000000000003', 'published', 'a0000000-0000-0000-0000-000000000002')
  $$,
  '42501',
  'new row violates row-level security policy for table "assignments"',
  'tutor cannot directly insert an assignment into another organization'
);
select throws_ok(
  $$
    select public.create_assignment_draft(
      'a0000000-0000-0000-0000-000000000002',
      'Cross-org RPC write', null, '90000000-0000-0000-0000-000000000001',
      'Grade 11', null, '[]'::jsonb,
      'd1111111-1111-4111-8111-111111111111'
    )
  $$,
  '42501',
  'assignment_organization_forbidden',
  'tutor cannot create an assignment through the RPC in another organization'
);
select lives_ok(
  $$
    select public.create_assignment_draft(
      'a0000000-0000-0000-0000-000000000001',
      'Same-org RPC write', null, '90000000-0000-0000-0000-000000000001',
      'Grade 11', null, '[]'::jsonb,
      'd2222222-2222-4222-8222-222222222222'
    )
  $$,
  'approved active tutor can create an assignment through the scoped RPC'
);
select is(
  (select count(*) from public.assignments where title = 'Same-org RPC write' and organization_id = 'a0000000-0000-0000-0000-000000000001'),
  1::bigint,
  'scoped assignment RPC preserves the tutor organization'
);
select lives_ok(
  $$
    select public.create_assignment_draft(
      'a0000000-0000-0000-0000-000000000001',
      'Same-org RPC write', null, '90000000-0000-0000-0000-000000000001',
      'Grade 11', null, '[]'::jsonb,
      'd2222222-2222-4222-8222-222222222222'
    )
  $$,
  'an unchanged assignment-draft retry succeeds'
);
select is(
  (
    select count(*)
    from public.assignments
    where created_by = '10000000-0000-0000-0000-000000000003'
      and client_request_id = 'd2222222-2222-4222-8222-222222222222'
  ),
  1::bigint,
  'an unchanged assignment-draft retry creates one row'
);
select throws_ok(
  $$
    select public.create_assignment_draft(
      'a0000000-0000-0000-0000-000000000001',
      'Changed same request', null, '90000000-0000-0000-0000-000000000001',
      'Grade 11', null, '[]'::jsonb,
      'd2222222-2222-4222-8222-222222222222'
    )
  $$,
  '23505',
  'assignment_create_retry_payload_mismatch',
  'an assignment request UUID cannot be reused for changed content'
);
select lives_ok(
  $$
    update public.assignments
    set organization_id = 'a0000000-0000-0000-0000-000000000002'
    where id = '50000000-0000-0000-0000-000000000001'
  $$,
  'direct assignment update is denied by RLS rather than changing organization'
);
select is(
  (select organization_id from public.assignments where id = '50000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'tutor cannot move an existing assignment to another organization'
);
select throws_ok(
  $$
    select public.finalize_assignment_publication(
      '50000000-0000-0000-0000-000000000003',
      'Legacy stale assignment client',
      null,
      '90000000-0000-0000-0000-000000000001',
      'Grade 11',
      null,
      'draft',
      null,
      null,
      '[]'::jsonb
    )
  $$,
  '40001',
  'assignment_revision_required',
  'a retired assignment client fails closed when it omits the revision'
);
select lives_ok(
  $$
    select public.finalize_assignment_publication(
      p_assignment_id => '50000000-0000-0000-0000-000000000003',
      p_title => 'Alpha Draft CAS winner',
      p_description => null,
      p_subject_id => '90000000-0000-0000-0000-000000000001',
      p_grade => 'Grade 11',
      p_due_date => null,
      p_status => 'draft',
      p_attachment_url => null,
      p_memo_url => null,
      p_expected_revision => 1,
      p_rubric_json => '[]'::jsonb
    )
  $$,
  'the first assignment edit using a current revision succeeds'
);
select throws_ok(
  $$
    select public.finalize_assignment_publication(
      p_assignment_id => '50000000-0000-0000-0000-000000000003',
      p_title => 'Alpha Draft stale loser',
      p_description => null,
      p_subject_id => '90000000-0000-0000-0000-000000000001',
      p_grade => 'Grade 11',
      p_due_date => null,
      p_status => 'draft',
      p_attachment_url => null,
      p_memo_url => null,
      p_expected_revision => 1,
      p_rubric_json => '[]'::jsonb
    )
  $$,
  '40001',
  'assignment_revision_conflict',
  'a stale assignment revision cannot overwrite the winning edit'
);
select is(
  (select title from public.assignments where id = '50000000-0000-0000-0000-000000000003'),
  'Alpha Draft CAS winner',
  'the stale assignment edit leaves the winner intact'
);

reset role;

-- Parent Alpha: no raw learner tables; the linked, release-aware report RPC is
-- the only results path.
select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000004');
set local role authenticated;

select throws_ok(
  $$select public.run_retention_cleanup(false)$$,
  '42501',
  'not_authorized',
  'parent cannot run retention cleanup'
);
select throws_ok(
  $$select public.run_retention_cleanup_scheduled()$$,
  '42501',
  'permission denied for function run_retention_cleanup_scheduled',
  'parent cannot execute the scheduler retention RPC'
);

select is((select count(*) from public.assignments), 0::bigint, 'parent cannot read assignments directly');
select is((select count(*) from public.assignment_submissions), 0::bigint, 'parent cannot read raw submissions/results');
select is((select count(*) from public.get_parent_progress_reports()), 1::bigint, 'parent sees released results for linked learner');
select is((select count(*) from public.get_parent_progress_reports() where student_id = '20000000-0000-0000-0000-000000000002'), 0::bigint, 'parent cannot see another organization learner report');
select is((select count(*) from public.guardians), 1::bigint, 'parent sees only own guardian record');
select is((select count(*) from public.student_guardians), 1::bigint, 'parent sees only own learner link');
select is((select count(*) from public.student_notifications), 0::bigint, 'parent cannot read student notifications');
select is((select count(*) from storage.objects where bucket_id in ('assignment-files', 'assignment-submissions')), 0::bigint, 'parent cannot read assignment storage');

reset role;

-- NGO partner viewer: organization identity and aggregate RPC only; no raw
-- learner, guardian, result, notification, or Storage access.
select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000005');
set local role authenticated;

select throws_ok(
  $$select public.run_retention_cleanup(false)$$,
  '42501',
  'not_authorized',
  'NGO user cannot run retention cleanup'
);
select throws_ok(
  $$select public.run_retention_cleanup_scheduled()$$,
  '42501',
  'permission denied for function run_retention_cleanup_scheduled',
  'NGO user cannot execute the scheduler retention RPC'
);

select is((select count(*) from public.organizations), 1::bigint, 'NGO viewer sees only own organization');
select is((select count(*) from public.organizations where id = 'a0000000-0000-0000-0000-000000000002'), 0::bigint, 'NGO viewer cannot see another organization');
select is((select count(*) from public.students), 0::bigint, 'NGO viewer cannot read raw learner records');
select is((select count(*) from public.assignment_submissions), 0::bigint, 'NGO viewer cannot read raw submissions/results');
select is((select count(*) from public.guardians), 0::bigint, 'NGO viewer cannot read guardian records');
select is((select count(*) from public.student_notifications), 0::bigint, 'NGO viewer cannot read notifications');
select is((select count(*) from storage.objects where bucket_id in ('assignment-files', 'assignment-submissions')), 0::bigint, 'NGO viewer cannot read assignment storage');
select ok((public.get_org_cohort_report('a0000000-0000-0000-0000-000000000001')->>'suppressed')::boolean, 'NGO viewer can call own-org privacy-suppressed aggregate');
select throws_ok(
  $$select public.get_org_cohort_report('a0000000-0000-0000-0000-000000000002')$$,
  '42501',
  'not_authorized',
  'NGO viewer cannot call another organization aggregate'
);

reset role;

-- Admin policy is gated by authoritative AAL2, not the frontend MFA screen.
select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000001', 'aal1');
set local role authenticated;

select ok(not public.is_platform_admin(), 'AAL1 admin session is not platform-admin authorized');
select throws_ok(
  $$select public.run_retention_cleanup(false)$$,
  '42501',
  'not_authorized',
  'AAL1 admin cannot run retention cleanup'
);
select throws_ok(
  $$select * from public.get_admin_ai_grading_queue(10)$$,
  '42501',
  'admin_mfa_required',
  'AAL1 admin cannot inspect AI operations'
);
select throws_ok(
  $$select public.requeue_admin_ai_grading_job('60000000-0000-0000-0000-000000000001', 'must be blocked')$$,
  '42501',
  'admin_mfa_required',
  'AAL1 admin cannot requeue AI work'
);
select is((select count(*) from public.profiles), 1::bigint, 'AAL1 admin sees only their ordinary self profile');
select is((select count(*) from public.assignments), 0::bigint, 'AAL1 admin cannot use admin assignment access');
select is((select count(*) from public.assignment_submissions), 0::bigint, 'AAL1 admin cannot use admin result access');
select is((select count(*) from public.classes), 0::bigint, 'AAL1 admin cannot use admin class access');
select is((select count(*) from public.class_enrollments), 0::bigint, 'AAL1 admin cannot use admin enrollment access');
select is((select count(*) from storage.objects where bucket_id in ('assignment-files', 'assignment-submissions')), 0::bigint, 'AAL1 admin cannot use admin storage access');

reset role;

select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000001', 'aal2');
set local role authenticated;

select ok(public.is_platform_admin(), 'AAL2 admin session is platform-admin authorized');
select is(
  (public.run_retention_cleanup(false) ->> 'applied')::boolean,
  false,
  'AAL2 admin can run a non-destructive retention dry run'
);
select is((select count(*) from public.assignments), 5::bigint, 'AAL2 admin sees assignments across organizations');
select is((select count(*) from public.assignment_submissions), 3::bigint, 'AAL2 admin sees submissions/results across organizations');
select is((select count(*) from public.guardians), 2::bigint, 'AAL2 admin sees guardian records across organizations');
select is((select count(*) from public.student_guardians), 2::bigint, 'AAL2 admin sees guardian links across organizations');
select is((select count(*) from public.tutors), 2::bigint, 'AAL2 admin sees tutor base rows across organizations');
select is((select count(*) from public.tutor_student_allocations), 2::bigint, 'AAL2 admin sees allocations across organizations');
select is((select count(*) from public.classes), 2::bigint, 'AAL2 admin sees classes across organizations');
select is((select count(*) from public.class_enrollments), 2::bigint, 'AAL2 admin sees class enrollments across organizations');
select is((select count(*) from public.organizations where id in ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002')), 2::bigint, 'AAL2 admin sees both organizations');
select is((select count(*) from storage.objects where bucket_id = 'assignment-files'), 4::bigint, 'AAL2 admin sees assignment files across organizations');
select is((select count(*) from storage.objects where bucket_id = 'assignment-submissions'), 3::bigint, 'AAL2 admin sees submission files across organizations');
select is((select count(*) from public.student_notifications), 0::bigint, 'even AAL2 admin cannot read student-only notifications');

reset role;

-- Storage write checks run last so the successful insert cannot affect the
-- read-count assertions above. The allowed key has 4 folders because
-- storage.foldername() excludes submission.pdf.
select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000002');
set local role authenticated;

select is(
  (
    select p.provolatile::text
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'can_write_uncommitted_assignment_submission_storage'
  ),
  'v',
  'Storage write guard is VOLATILE so its lock-and-check cannot be plan-folded'
);
select ok(
  pg_get_functiondef('public.can_write_uncommitted_assignment_submission_storage(text)'::regprocedure)
    like '%pg_advisory_xact_lock%',
  'Storage write guard takes the submission attempt advisory lock'
);
select ok(
  not public.can_write_uncommitted_assignment_submission_storage(
    '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf'
  ),
  'Storage guard rejects an attempt before its payload is reserved'
);
select lives_ok(
  $$
    select public.begin_assignment_submission_attempt(
      p_assignment_id => '50000000-0000-0000-0000-000000000001',
      p_submission_id => '70000000-0000-0000-0000-000000000001',
      p_storage_key => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_original_filename => 'retry.pdf',
      p_mime_type => 'application/pdf',
      p_size_bytes => 123,
      p_content_sha256 => repeat('a', 64),
      p_text_answer => 'Stable retry payload',
      p_text_answer_sha256 => '289500b9823eeccb6b55c65091f6c1b66d1d13661a3160455d44b49648ff7262'
    )
  $$,
  'student reserves one immutable payload before upload'
);
select ok(
  public.can_write_uncommitted_assignment_submission_storage(
    '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf'
  ),
  'locked Storage guard allows the matching reserved attempt'
);
select throws_ok(
  $$
    select public.begin_assignment_submission_attempt(
      p_assignment_id => '50000000-0000-0000-0000-000000000001',
      p_submission_id => '70000000-0000-0000-0000-000000000001',
      p_storage_key => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/submission.pdf',
      p_original_filename => 'retry.pdf',
      p_mime_type => 'application/pdf',
      p_size_bytes => 123,
      p_content_sha256 => repeat('b', 64),
      p_text_answer => 'Stable retry payload',
      p_text_answer_sha256 => '289500b9823eeccb6b55c65091f6c1b66d1d13661a3160455d44b49648ff7262'
    )
  $$,
  '23505',
  'submission_retry_payload_mismatch',
  'same UUID and metadata cannot be rebound to different file bytes'
);
select ok(
  not public.can_write_uncommitted_assignment_submission_storage(
    '20000000-0000-0000-0000-000000000002/50000000-0000-0000-0000-000000000004/60000000-0000-0000-0000-000000000003/submission.pdf'
  ),
  'Storage guard is not a cross-student committed-key oracle'
);
select ok(
  not public.can_write_uncommitted_assignment_submission_storage(
    '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/arbitrary.pdf'
  ),
  'Storage guard rejects filenames outside the submission.ext RPC contract'
);

select lives_ok(
  $$
    insert into storage.objects (bucket_id, name, owner, metadata, user_metadata)
    values (
      'assignment-submissions',
      '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      '00000000-0000-0000-0000-000000000002',
      '{"mimetype":"application/pdf","size":123}'::jsonb,
      '{"sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'::jsonb
    )
  $$,
  'student can upload a correctly-shaped own-org submission key'
);
select is(
  pg_temp.update_storage_object_metadata(
    '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
    '{"retry":true}'::jsonb
  ),
  0::bigint,
  'student cannot overwrite immutable submission evidence'
);

select lives_ok(
  $$
    select public.submit_assignment_submission(
      p_assignment_id => '50000000-0000-0000-0000-000000000001',
      p_submission_id => '70000000-0000-0000-0000-000000000001',
      p_storage_key => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_file_url => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_original_filename => 'retry.pdf',
      p_mime_type => 'application/pdf',
      p_size_bytes => 123,
      p_text_answer => 'Stable retry payload'
    )
  $$,
  'first stable submission attempt commits'
);
select is(
  (
    select submission_id
    from public.confirm_assignment_submission_attempt(
      p_assignment_id => '50000000-0000-0000-0000-000000000001',
      p_submission_id => '70000000-0000-0000-0000-000000000001',
      p_storage_key => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_file_url => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_original_filename => 'retry.pdf',
      p_mime_type => 'application/pdf',
      p_size_bytes => 123,
      p_text_answer => 'Stable retry payload'
    )
  ),
  '70000000-0000-0000-0000-000000000001'::uuid,
  'confirmed attempt returns before a retry upload'
);
select is(
  (
    select submission_id
    from public.confirm_assignment_submission_attempt_digest(
      p_assignment_id => '50000000-0000-0000-0000-000000000001',
      p_submission_id => '70000000-0000-0000-0000-000000000001',
      p_content_sha256 => repeat('a', 64),
      p_text_answer_sha256 => '289500b9823eeccb6b55c65091f6c1b66d1d13661a3160455d44b49648ff7262'
    )
  ),
  '70000000-0000-0000-0000-000000000001'::uuid,
  'reload recovery confirms a commit using fingerprints without persisted answer text'
);
select is(
  pg_temp.update_storage_object_metadata(
    '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
    '{"tampered":true}'::jsonb
  ),
  0::bigint,
  'committed submission evidence cannot be overwritten'
);
select is(
  (
    select metadata
    from storage.objects
    where bucket_id = 'assignment-submissions'
      and name = '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf'
  ),
  '{"mimetype":"application/pdf","size":123}'::jsonb,
  'post-commit overwrite attempt leaves the stored evidence unchanged'
);
select ok(
  not public.can_write_uncommitted_assignment_submission_storage(
    '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf'
  ),
  'locked Storage guard rejects the caller-owned key after commit'
);
select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner, metadata)
    values (
      'assignment-submissions',
      '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/submission.png',
      '00000000-0000-0000-0000-000000000002',
      '{}'::jsonb
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'committed attempt UUID cannot create alternate-extension orphan evidence'
);
select lives_ok(
  $$
    select public.submit_assignment_submission(
      p_assignment_id => '50000000-0000-0000-0000-000000000001',
      p_submission_id => '70000000-0000-0000-0000-000000000001',
      p_storage_key => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_file_url => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_original_filename => 'retry.pdf',
      p_mime_type => 'application/pdf',
      p_size_bytes => 123,
      p_text_answer => 'Stable retry payload'
    )
  $$,
  'unchanged submission retry returns the committed attempt'
);
select throws_ok(
  $$
    select public.submit_assignment_submission(
      p_assignment_id => '50000000-0000-0000-0000-000000000001',
      p_submission_id => '70000000-0000-0000-0000-000000000001',
      p_storage_key => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_file_url => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_original_filename => 'retry.pdf',
      p_mime_type => 'application/pdf',
      p_size_bytes => 123,
      p_text_answer => 'Edited after an ambiguous response'
    )
  $$,
  '23505',
  'submission_retry_payload_mismatch',
  'same attempt UUID cannot confirm a changed payload'
);
select throws_ok(
  $$
    select public.submit_assignment_submission(
      p_assignment_id => '50000000-0000-0000-0000-000000000002',
      p_submission_id => '70000000-0000-0000-0000-000000000001',
      p_storage_key => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_file_url => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_original_filename => 'retry.pdf',
      p_mime_type => 'application/pdf',
      p_size_bytes => 123,
      p_text_answer => 'Stable retry payload'
    )
  $$,
  '23505',
  'submission_id_conflict',
  'same attempt UUID cannot be replayed for another assignment'
);
select is(
  (select count(*) from public.get_student_assignment_submissions() where id = '70000000-0000-0000-0000-000000000001'),
  1::bigint,
  'idempotent replay creates one submission row'
);
select is(
  (select version_number from public.get_student_assignment_submissions() where id = '70000000-0000-0000-0000-000000000001'),
  2,
  'idempotent replay allocates one new version number'
);
select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner, metadata)
    values (
      'assignment-submissions',
      '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000004/70000000-0000-0000-0000-000000000002/submission.pdf',
      '00000000-0000-0000-0000-000000000002',
      '{}'::jsonb
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'student cannot upload a cross-organization submission key'
);

reset role;

select is(
  (
    select count(*)
    from public.audit_log
    where action = 'assignment_submission.created'
      and entity_id = '70000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'idempotent replay creates one audit event'
);

-- Onboarding is an invite-only transition. Existing, fully provisioned rows
-- remain safe retries, while uninvited, role-less, conflicting, and role-
-- escalation attempts are rejected before any profile is created.
select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000002');
set local role authenticated;

select lives_ok(
  $$select public.onboard_current_user('student', '')$$,
  'completed admin-provisioned student onboarding is an idempotent retry'
);
select throws_ok(
  $$select public.onboard_current_user('tutor', 'Student Alpha')$$,
  '23505',
  'onboarding_role_conflict',
  'completed student profile cannot be retried as tutor'
);

reset role;

select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000009');
set local role authenticated;

select throws_ok(
  $$select public.run_retention_cleanup(false)$$,
  '42501',
  'not_authorized',
  'ordinary authenticated user without a profile cannot run retention cleanup'
);
select throws_ok(
  $$select public.run_retention_cleanup_scheduled()$$,
  '42501',
  'permission denied for function run_retention_cleanup_scheduled',
  'ordinary authenticated user cannot execute the scheduler retention RPC'
);

select throws_ok(
  $$
    select public.onboard_current_user(
      p_role => 'student',
      p_full_name => 'Uninvited Student',
      p_grade => 'Grade 10'
    )
  $$,
  '42501',
  'onboarding_invitation_required',
  'confirmed but uninvited Auth identity cannot onboard'
);

reset role;

select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000011');
set local role authenticated;

select throws_ok(
  $$
    select public.onboard_current_user(
      p_role => 'student',
      p_full_name => 'Roleless Invite',
      p_grade => 'Grade 10'
    )
  $$,
  '42501',
  'onboarding_invitation_role_required',
  'invitation without a managed student or tutor role cannot onboard'
);

reset role;

select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000010');
set local role authenticated;

select throws_ok(
  $$
    select public.onboard_current_user(
      p_role => 'tutor',
      p_full_name => 'Invited Student'
    )
  $$,
  '42501',
  'onboarding_invitation_role_mismatch',
  'student invitation cannot be escalated into a tutor account'
);
select lives_ok(
  $$
    select public.onboard_current_user(
      p_role => 'student',
      p_full_name => 'Invited Student',
      p_grade => 'Grade 10'
    )
  $$,
  'matching invited student can complete onboarding atomically'
);
select is(
  (select count(*) from public.profiles where auth_user_id = '00000000-0000-0000-0000-000000000010'),
  1::bigint,
  'successful invited onboarding creates exactly one profile'
);
select is(
  (
    select count(*)
    from public.students s
    join public.profiles p on p.id = s.profile_id
    where p.auth_user_id = '00000000-0000-0000-0000-000000000010'
  ),
  1::bigint,
  'successful invited onboarding creates exactly one student role row'
);

reset role;

-- ============================================================================
-- AUTH-01: inactive/suspended/pending student and tutor principals must lose
-- operational authorization even while their Supabase Auth session remains
-- valid.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Student status denial matrix
-- ---------------------------------------------------------------------------

reset role;

update public.students
set status = 'inactive'
where id = '20000000-0000-0000-0000-000000000001';

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-000000000002'
);
set local role authenticated;

select is(
  public.current_active_student_id(),
  null::uuid,
  'inactive student has no active operational student identity'
);

select is(
  public.current_student_id(),
  null::uuid,
  'legacy current_student_id fails closed for inactive student'
);

select is(
  public.current_student_org_id(),
  null::uuid,
  'inactive student has no operational organization identity'
);

select is(
  (select count(*) from public.get_student_accessible_assignments()),
  0::bigint,
  'inactive student cannot read assignments'
);

select is(
  (select count(*) from public.classes),
  0::bigint,
  'inactive student cannot read learner classes'
);

select is(
  (select count(*) from storage.objects
   where bucket_id = 'assignment-files'),
  0::bigint,
  'inactive student cannot read assignment files'
);

select is(
  (select count(*) from public.get_student_assignment_submissions()),
  0::bigint,
  'inactive student cannot read submission results through student RPC'
);

select throws_ok(
  $$
    select public.submit_assignment_submission(
      p_assignment_id =>
        '50000000-0000-0000-0000-000000000001',
      p_submission_id =>
        '71000000-0000-0000-0000-000000000001',
      p_storage_key => null,
      p_file_url => null,
      p_original_filename => null,
      p_mime_type => null,
      p_size_bytes => null,
      p_text_answer => 'Inactive learner attempt'
    )
  $$,
  '42501',
  'only_students_can_submit',
  'inactive student cannot submit assignment work'
);

reset role;


-- Suspended student
update public.students
set status = 'suspended'
where id = '20000000-0000-0000-0000-000000000001';

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-000000000002'
);
set local role authenticated;

select is(
  public.current_active_student_id(),
  null::uuid,
  'suspended student has no active operational student identity'
);

select is(
  (select count(*) from public.assignments),
  0::bigint,
  'suspended student cannot read assignments'
);

select throws_ok(
  $$
    select public.submit_assignment_submission(
      p_assignment_id =>
        '50000000-0000-0000-0000-000000000001',
      p_submission_id =>
        '71000000-0000-0000-0000-000000000002',
      p_storage_key => null,
      p_file_url => null,
      p_original_filename => null,
      p_mime_type => null,
      p_size_bytes => null,
      p_text_answer => 'Suspended learner attempt'
    )
  $$,
  '42501',
  'only_students_can_submit',
  'suspended student cannot submit assignment work'
);

reset role;


-- Pending student
update public.students
set status = 'pending'
where id = '20000000-0000-0000-0000-000000000001';

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-000000000002'
);
set local role authenticated;

select is(
  public.current_active_student_id(),
  null::uuid,
  'pending student has no active operational student identity'
);

select is(
  (select count(*) from public.assignments),
  0::bigint,
  'pending student cannot read assignments'
);

reset role;


-- Restore positive student state and prove access returns.
update public.students
set status = 'active'
where id = '20000000-0000-0000-0000-000000000001';

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-000000000002'
);
set local role authenticated;

select is(
  public.current_active_student_id(),
  '20000000-0000-0000-0000-000000000001'::uuid,
  'active student receives operational student identity'
);

select is(
  (select count(*) from public.get_student_accessible_assignments()),
  2::bigint,
  'active student regains published own-organization assignments'
);

reset role;


-- ---------------------------------------------------------------------------
-- Tutor status + approval denial matrix
-- ---------------------------------------------------------------------------

-- Pending tutor: onboarding remains available, operational access is denied.
update public.tutors
set
  status = 'pending',
  approval_status = 'pending'
where id = '30000000-0000-0000-0000-000000000001';

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-000000000003'
);
set local role authenticated;

select is(
  public.current_approved_active_tutor_id(),
  null::uuid,
  'pending tutor has no approved active operational identity'
);

select is(
  public.current_tutor_id(),
  null::uuid,
  'legacy current_tutor_id fails closed for pending tutor'
);

select is(
  public.current_tutor_onboarding_id(),
  '30000000-0000-0000-0000-000000000001'::uuid,
  'pending tutor retains onboarding identity'
);

select is(
  (select count(*) from public.assignments),
  0::bigint,
  'pending tutor cannot read operational assignments'
);

select is(
  (select count(*) from public.classes),
  0::bigint,
  'pending tutor cannot read organization classes'
);

select is(
  (select count(*) from public.assignment_submissions),
  0::bigint,
  'pending tutor cannot read learner submissions'
);

select throws_ok(
  $$select * from public.get_tutor_allocated_students()$$,
  '42501',
  'only_tutors_can_view_allocated_students',
  'pending tutor cannot use allocated learner directory'
);

select lives_ok(
  $$
    select public.upsert_tutor_application(
      '{}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      null,
      null
    )
  $$,
  'pending tutor can still update onboarding application'
);

reset role;


-- Active tutor whose approval is still under review.
update public.tutors
set
  status = 'active',
  approval_status = 'under_review'
where id = '30000000-0000-0000-0000-000000000001';

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-000000000003'
);
set local role authenticated;

select is(
  public.current_approved_active_tutor_id(),
  null::uuid,
  'under-review tutor has no operational tutor identity'
);

select is(
  (select count(*) from public.assignments),
  0::bigint,
  'under-review tutor cannot read operational assignments'
);

select is(
  public.current_tutor_onboarding_id(),
  '30000000-0000-0000-0000-000000000001'::uuid,
  'under-review active tutor retains onboarding access'
);

reset role;


-- Rejected tutor.
update public.tutors
set
  status = 'active',
  approval_status = 'rejected'
where id = '30000000-0000-0000-0000-000000000001';

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-000000000003'
);
set local role authenticated;

select is(
  public.current_approved_active_tutor_id(),
  null::uuid,
  'rejected tutor has no operational tutor identity'
);

select is(
  (select count(*) from public.assignments),
  0::bigint,
  'rejected tutor cannot read operational assignments'
);

reset role;


-- Inactive tutor must lose BOTH operational and onboarding access.
update public.tutors
set
  status = 'inactive',
  approval_status = 'approved'
where id = '30000000-0000-0000-0000-000000000001';

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-000000000003'
);
set local role authenticated;

select is(
  public.current_approved_active_tutor_id(),
  null::uuid,
  'inactive tutor has no operational tutor identity'
);

select is(
  public.current_tutor_onboarding_id(),
  null::uuid,
  'inactive tutor has no onboarding exception'
);

select is(
  (select count(*) from public.assignments),
  0::bigint,
  'inactive tutor cannot read assignments through organization membership'
);

select is(
  (select count(*) from public.classes),
  0::bigint,
  'inactive tutor cannot read classes through organization membership'
);

select is(
  (select count(*) from public.assignment_submissions),
  0::bigint,
  'inactive tutor cannot read learner submissions'
);

select is(
  (select count(*) from storage.objects
   where bucket_id = 'assignment-files'),
  0::bigint,
  'inactive tutor cannot read assignment files'
);

select throws_ok(
  $$
    select public.upsert_tutor_application(
      '{}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      null,
      null
    )
  $$,
  '42501',
  'forbidden',
  'inactive tutor cannot use onboarding application RPC'
);

reset role;


-- Suspended tutor must also lose both access classes.
update public.tutors
set
  status = 'suspended',
  approval_status = 'approved'
where id = '30000000-0000-0000-0000-000000000001';

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-000000000003'
);
set local role authenticated;

select is(
  public.current_approved_active_tutor_id(),
  null::uuid,
  'suspended tutor has no operational tutor identity'
);

select is(
  public.current_tutor_onboarding_id(),
  null::uuid,
  'suspended tutor has no onboarding exception'
);

select is(
  (select count(*) from public.assignments),
  0::bigint,
  'suspended tutor cannot read assignments'
);

select throws_ok(
  $$select * from public.get_tutor_allocated_students()$$,
  '42501',
  'only_tutors_can_view_allocated_students',
  'suspended tutor cannot use allocated learner directory'
);

reset role;


-- Restore approved active tutor and prove normal access still works.
update public.tutors
set
  status = 'active',
  approval_status = 'approved'
where id = '30000000-0000-0000-0000-000000000001';

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-000000000003'
);
set local role authenticated;

select is(
  public.current_approved_active_tutor_id(),
  '30000000-0000-0000-0000-000000000001'::uuid,
  'approved active tutor receives operational tutor identity'
);

select is(
  (select count(*) from public.assignments),
  4::bigint,
  'approved active tutor regains own-organization assignments'
);

select is(
  (select count(*) from public.get_tutor_allocated_students()),
  1::bigint,
  'approved active tutor regains allocated learner directory'
);

reset role;

-- TEST-01: durable AI grading jobs must execute their lease, stale-worker, and
-- retry boundaries in PostgreSQL—not merely match migration source text.
select set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'service_role')::text,
  true
);
set local role service_role;

update public.assignment_submissions
set ai_grading_status = 'pending',
    ai_job_attempts = 0,
    ai_job_available_at = now() - interval '1 second',
    ai_job_lease_expires_at = null,
    ai_job_claim_token = null,
    ai_job_claimed_at = null,
    ai_job_last_error = null
where id = '60000000-0000-0000-0000-000000000001';

select ok(
  exists (
    select 1
    from public.claim_ai_grading_job('60000000-0000-0000-0000-000000000001')
  ),
  'service worker atomically claims a pending AI grading job'
);
select is(
  (select ai_grading_status from public.assignment_submissions where id = '60000000-0000-0000-0000-000000000001'),
  'in_progress',
  'claimed AI job is in progress'
);
select is(
  (select ai_job_attempts from public.assignment_submissions where id = '60000000-0000-0000-0000-000000000001'),
  1,
  'first AI lease increments the attempt counter'
);
select ok(
  not public.complete_ai_grading_job(
    '60000000-0000-0000-0000-000000000001',
    gen_random_uuid(),
    80,
    'stale worker result',
    '{}'::jsonb,
    0.9
  ),
  'stale AI worker token cannot complete another worker’s lease'
);
select ok(
  public.fail_ai_grading_job(
    '60000000-0000-0000-0000-000000000001',
    (select ai_job_claim_token from public.assignment_submissions where id = '60000000-0000-0000-0000-000000000001'),
    'intentional pgTAP retry probe',
    1
  ),
  'current AI worker can schedule a bounded retry'
);
select is(
  (select ai_grading_status from public.assignment_submissions where id = '60000000-0000-0000-0000-000000000001'),
  'failed',
  'failed AI work is durable and visible for retry'
);
select ok(
  (select ai_job_available_at > now() + interval '4 minutes'
   from public.assignment_submissions
   where id = '60000000-0000-0000-0000-000000000001'),
  'AI retry uses server-owned backoff instead of the caller delay'
);
update public.assignment_submissions
set ai_job_available_at = now() - interval '1 second'
where id = '60000000-0000-0000-0000-000000000001';
select ok(
  exists (
    select 1
    from public.claim_ai_grading_job('60000000-0000-0000-0000-000000000001')
  ),
  'eligible failed AI job can be leased again'
);
select is(
  (select ai_job_attempts from public.assignment_submissions where id = '60000000-0000-0000-0000-000000000001'),
  2,
  'retry lease increments the AI attempt counter exactly once'
);

update public.assignment_submissions
set ai_grading_status = 'in_progress',
    ai_job_attempts = 8,
    ai_job_claim_token = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    ai_job_claimed_at = now(),
    ai_job_lease_expires_at = now() + interval '20 minutes',
    ai_job_last_error = null
where id = '60000000-0000-0000-0000-000000000001';
select ok(
  public.fail_ai_grading_job(
    '60000000-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    'permanent provider failure',
    1
  ),
  'the maximum AI attempt is dead-lettered atomically'
);
select is(
  (select ai_grading_status from public.assignment_submissions where id = '60000000-0000-0000-0000-000000000001'),
  'dead_lettered',
  'dead-lettered AI work is no longer automatically claimable'
);
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'ai_grading.dead_lettered'
      and entity_id = '60000000-0000-0000-0000-000000000001'
  ),
  'dead-lettering writes one operational audit event'
);
reset role;
select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000001', 'aal2');
set local role authenticated;
select lives_ok(
  $$select * from public.get_admin_ai_grading_queue(100)$$,
  'AAL2 admin can inspect the bounded AI operations queue'
);
select ok(
  public.requeue_admin_ai_grading_job('60000000-0000-0000-0000-000000000001', 'operator retry after provider recovery'),
  'AAL2 admin can manually requeue a dead-lettered AI job'
);
select is(
  (select ai_job_attempts from public.assignment_submissions where id = '60000000-0000-0000-0000-000000000001'),
  0,
  'admin AI requeue resets the bounded attempt budget'
);
select ok(
  exists (
    select 1 from public.get_admin_ai_grading_queue(100)
    where submission_id = '60000000-0000-0000-0000-000000000001'
      and status = 'pending'
      and attempts = 0
  ),
  'admin queue exposes the requeued pending job'
);
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'ai_grading.requeued_by_admin'
      and entity_id = '60000000-0000-0000-0000-000000000001'
  ),
  'admin AI requeue writes an operational audit event'
);

reset role;

set local role service_role;
select public.create_student_notification(
  '20000000-0000-0000-0000-000000000001'::uuid,
  'retry_probe',
  'Retry probe',
  'One notification despite a replay.',
  '/dashboard/',
  'assignment',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  '{}'::jsonb
);
select public.create_student_notification(
  '20000000-0000-0000-0000-000000000001'::uuid,
  'retry_probe',
  'Retry probe',
  'One notification despite a replay.',
  '/dashboard/',
  'assignment',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  '{}'::jsonb
);
select is(
  (
    select count(*)
    from public.notification_outbox_events
    where event_key = 'retry_probe:assignment:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and status = 'pending'
  ),
  1::bigint,
  'notification replay leaves one pending transactional outbox event'
);
select set_config(
  'request.jwt.claims',
  '{"role":"service_role"}',
  true
);
select lives_ok(
  $$
    with claimed as (
      select * from public.claim_next_notification_outbox_event()
    )
    select public.dispatch_notification_outbox_event(claimed.id, claimed.claim_token)
    from claimed
  $$,
  'a trusted worker dispatches the claimed notification event'
);
select is(
  (
    select count(*)
    from public.student_notifications
    where dedupe_key = 'retry_probe:assignment:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  1::bigint,
  'notification replay returns one deterministic event'
);
reset role;

set local role service_role;
insert into public.weekly_reports (
  id, student_id, week_start, week_end, payload_json, created_by
) values (
  '73000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '2026-08-10', '2026-08-16', '{"stale":true}'::jsonb, null
);
update public.weekly_reports
set is_stale = true, stale_since = now() - interval '1 minute'
where id = '73000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select ok(
  public.refresh_stale_weekly_reports(10) >= 1,
  'trusted report worker refreshes a bounded batch of stale snapshots'
);
select is(
  (select is_stale from public.weekly_reports where id = '73000000-0000-0000-0000-000000000001'),
  false,
  'refreshing a report clears its stale marker'
);
select ok(
  (select payload_json ? 'student' from public.weekly_reports where id = '73000000-0000-0000-0000-000000000001'),
  'refreshed report has the canonical computed payload'
);

reset role;

-- A locked period cannot accept a new adjustment, even through its trusted RPC.
insert into public.sessions (
  id, organization_id, tutor_id, student_id, tutor_student_allocation_id,
  date, start_time, end_time, duration_minutes, mode, status
)
values (
  '71000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000001',
  '2099-01-05', '15:00', '16:00', 60, 'online', 'draft'
);
select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000001', 'aal2');
set local role authenticated;
select lives_ok(
  $$select public.lock_pay_period('2099-01-05'::date)$$,
  'admin locks the test pay period through the trusted payroll RPC'
);
select throws_ok(
  $$
    select public.create_adjustment(
      '30000000-0000-0000-0000-000000000001',
      'bonus'::public.adjustment_type,
      100,
      'must not alter a locked payroll period',
      null,
      '2099-01-05'::date
    )
  $$,
  '42501',
  'pay_period_locked',
  'admin cannot create an adjustment after the pay period is locked'
);

reset role;

select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000003');
set local role authenticated;
select throws_ok(
  $$select public.submit_session('71000000-0000-0000-0000-000000000001')$$,
  '42501',
  'pay_period_locked',
  'a tutor cannot submit a draft session after payroll wins the week lock'
);

reset role;

select * from finish();
rollback;
