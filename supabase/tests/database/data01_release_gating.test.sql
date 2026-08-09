begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- DATA-01 focused linked preflight.
-- Everything in this file is rolled back by the test transaction.

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
-- Isolated fixture created BEFORE the pending migration.
-- This gives the migration a real legacy leaked progress row to clean up.
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
  'fd010000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'data01-student-20260809@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  'data01-student-confirm',
  '',
  'data01-student-change',
  'data01-student-recovery'
),
(
  '00000000-0000-0000-0000-000000000000',
  'fd010000-0000-4000-8000-000000000002',
  'authenticated',
  'authenticated',
  'data01-tutor-20260809@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  'data01-tutor-confirm',
  '',
  'data01-tutor-change',
  'data01-tutor-recovery'
),
(
  '00000000-0000-0000-0000-000000000000',
  'fd010000-0000-4000-8000-000000000003',
  'authenticated',
  'authenticated',
  'data01-parent-20260809@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  'data01-parent-confirm',
  '',
  'data01-parent-change',
  'data01-parent-recovery'
);

insert into public.organizations (id, name, type, status)
values (
  'fd050000-0000-4000-8000-000000000001',
  'DATA01 Isolation Organisation 20260809',
  'direct',
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
  'fd020000-0000-4000-8000-000000000001',
  'fd010000-0000-4000-8000-000000000001',
  'DATA01 Student',
  'data01-student-20260809@example.test',
  'student'
),
(
  'fd020000-0000-4000-8000-000000000002',
  'fd010000-0000-4000-8000-000000000002',
  'DATA01 Tutor',
  'data01-tutor-20260809@example.test',
  'tutor'
),
(
  'fd020000-0000-4000-8000-000000000003',
  'fd010000-0000-4000-8000-000000000003',
  'DATA01 Parent',
  'data01-parent-20260809@example.test',
  'parent'
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
  'fd030000-0000-4000-8000-000000000001',
  'fd020000-0000-4000-8000-000000000001',
  'Grade 11',
  'DATA01 Test School',
  'active',
  'fd050000-0000-4000-8000-000000000001'
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
  'fd040000-0000-4000-8000-000000000001',
  'fd020000-0000-4000-8000-000000000002',
  array['Mathematics'],
  array['Grade 11'],
  'active',
  'approved'
);

insert into public.guardians (
  id,
  profile_id,
  full_name,
  email,
  status
)
values (
  'fd090000-0000-4000-8000-000000000001',
  'fd020000-0000-4000-8000-000000000003',
  'DATA01 Parent',
  'data01-parent-20260809@example.test',
  'active'
);

insert into public.student_guardians (
  id,
  student_id,
  guardian_id,
  relationship_type,
  is_primary,
  can_receive_reports,
  status
)
values (
  'fd0a0000-0000-4000-8000-000000000001',
  'fd030000-0000-4000-8000-000000000001',
  'fd090000-0000-4000-8000-000000000001',
  'parent',
  true,
  true,
  'active'
);

insert into public.subjects (id, name, grade, curriculum)
values (
  'fd060000-0000-4000-8000-000000000001',
  'DATA01 Isolation Mathematics 20260809',
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
values
(
  'fd070000-0000-4000-8000-000000000001',
  'DATA01 Legacy Unreleased Assignment',
  'fd060000-0000-4000-8000-000000000001',
  'Grade 11',
  'fd020000-0000-4000-8000-000000000002',
  'published',
  'fd050000-0000-4000-8000-000000000001'
),
(
  'fd070000-0000-4000-8000-000000000002',
  'DATA01 Release Lifecycle Assignment',
  'fd060000-0000-4000-8000-000000000001',
  'Grade 11',
  'fd020000-0000-4000-8000-000000000002',
  'published',
  'fd050000-0000-4000-8000-000000000001'
);

-- This row represents the bug as it existed before DATA-01:
-- submission is marked but NOT released, while progress already contains score 31.
insert into public.assignment_submissions (
  id,
  assignment_id,
  student_id,
  submitted_at,
  status,
  version_number,
  is_latest,
  marks_awarded,
  feedback,
  rubric_scores_json,
  marks_released,
  feedback_released,
  released_at
)
values
(
  'fd080000-0000-4000-8000-000000000001',
  'fd070000-0000-4000-8000-000000000001',
  'fd030000-0000-4000-8000-000000000001',
  now() - interval '2 days',
  'marked',
  1,
  true,
  31,
  'Unreleased legacy feedback',
  '{}'::jsonb,
  false,
  false,
  null
),
(
  'fd080000-0000-4000-8000-000000000002',
  'fd070000-0000-4000-8000-000000000002',
  'fd030000-0000-4000-8000-000000000001',
  now() - interval '1 day',
  'submitted',
  1,
  true,
  null,
  null,
  '{}'::jsonb,
  false,
  false,
  null
);

insert into public.student_progress (
  id,
  student_id,
  subject_id,
  topic,
  score,
  cognitive_level,
  recorded_at
)
values (
  'fd0b0000-0000-4000-8000-000000000001',
  'fd030000-0000-4000-8000-000000000001',
  'fd060000-0000-4000-8000-000000000001',
  'DATA01 Legacy Unreleased Assignment',
  31,
  null,
  now() - interval '1 day'
);

-- Persisted products that may have copied that leaked score must also be
-- invalidated by the migration.
insert into public.weekly_reports (
  id,
  student_id,
  week_start,
  week_end,
  payload_json,
  created_by
)
values (
  'fd0c0000-0000-4000-8000-000000000001',
  'fd030000-0000-4000-8000-000000000001',
  current_date - 7,
  current_date - 1,
  '{"topicProgress":[{"topic":"DATA01 Legacy Unreleased Assignment","completion":31}]}'::jsonb,
  'fd020000-0000-4000-8000-000000000002'
);

insert into public.student_score_snapshots (
  id,
  organization_id,
  student_id,
  score_date,
  risk_score,
  momentum_score,
  reasons_json,
  metrics_json,
  recommended_actions_json
)
values (
  'fd0d0000-0000-4000-8000-000000000001',
  'fd050000-0000-4000-8000-000000000001',
  'fd030000-0000-4000-8000-000000000001',
  current_date,
  60,
  40,
  '[{"source_type":"student_progress","source_id":"fd0b0000-0000-4000-8000-000000000001","value":31}]'::jsonb,
  '{"weakestTopicScore":31}'::jsonb,
  '[]'::jsonb
);

-- DATA01_PENDING_MIGRATION

-- The normal runtime suite runs *after* all committed migrations. Remove the
-- deliberately pre-migration artifacts above so its behavioural assertions
-- test the current release gate rather than simulating a historical database
-- state that a clean rebuild cannot contain.
delete from public.student_progress where id = 'fd0b0000-0000-4000-8000-000000000001';
delete from public.weekly_reports where id = 'fd0c0000-0000-4000-8000-000000000001';
delete from public.student_score_snapshots where id = 'fd0d0000-0000-4000-8000-000000000001';

select no_plan();

-- ---------------------------------------------------------------------------
-- Fresh-runtime cleanup invariants
-- ---------------------------------------------------------------------------
select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_progress'
      and column_name = 'source_submission_id'
  ),
  'student_progress has submission provenance'
);

select is(
  (
    select count(*)
    from public.student_progress
    where id = 'fd0b0000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'legacy unreleased assignment-derived progress is removed'
);

select is(
  (
    select count(*)
    from public.weekly_reports
    where id = 'fd0c0000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'weekly report that may contain the leaked score is invalidated'
);

select is(
  (
    select count(*)
    from public.student_score_snapshots
    where id = 'fd0d0000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'risk snapshot that may contain the leaked score is invalidated'
);

-- ---------------------------------------------------------------------------
-- Mark but do NOT release: no derived progress may exist.
-- ---------------------------------------------------------------------------
select pg_temp.authenticate_as(
  'fd010000-0000-4000-8000-000000000002'
);
set local role authenticated;

select lives_ok(
  $$
    select public.mark_assignment_submission(
      'fd080000-0000-4000-8000-000000000002'::uuid,
      67,
      'Tutor-only draft feedback',
      'marked'::public.submission_status,
      '{}'::jsonb,
      false,
      false
    )
  $$,
  'tutor can mark a submission without releasing it'
);

reset role;

select is(
  (
    select count(*)
    from public.student_progress
    where source_submission_id =
      'fd080000-0000-4000-8000-000000000002'::uuid
  ),
  0::bigint,
  'unreleased marked submission creates no derived progress'
);

-- Student's raw RLS-visible progress must not expose the score.
select pg_temp.authenticate_as(
  'fd010000-0000-4000-8000-000000000001'
);
set local role authenticated;

select is(
  (
    select count(*)
    from public.student_progress
    where source_submission_id =
      'fd080000-0000-4000-8000-000000000002'::uuid
  ),
  0::bigint,
  'student cannot observe unreleased mark through raw student_progress'
);

reset role;

-- Parent report must also have no topic score from the unreleased submission.
select pg_temp.authenticate_as(
  'fd010000-0000-4000-8000-000000000003'
);
set local role authenticated;

select is(
  (
    select count(*)
    from public.get_parent_progress_reports()
    where student_id = 'fd030000-0000-4000-8000-000000000001'::uuid
      and topic_score is not null
  ),
  0::bigint,
  'parent report cannot infer unreleased mark through progress'
);

reset role;

-- ---------------------------------------------------------------------------
-- Release marks: exactly one derived progress row becomes visible.
-- ---------------------------------------------------------------------------
select pg_temp.authenticate_as(
  'fd010000-0000-4000-8000-000000000002'
);
set local role authenticated;

select lives_ok(
  $$
    select public.mark_assignment_submission(
      'fd080000-0000-4000-8000-000000000002'::uuid,
      67,
      'Released feedback',
      'marked'::public.submission_status,
      '{}'::jsonb,
      true,
      true
    )
  $$,
  'tutor can release marked result'
);

reset role;

select is(
  (
    select count(*)
    from public.student_progress
    where source_submission_id =
      'fd080000-0000-4000-8000-000000000002'::uuid
  ),
  1::bigint,
  'released mark creates exactly one derived progress row'
);

select is(
  (
    select score
    from public.student_progress
    where source_submission_id =
      'fd080000-0000-4000-8000-000000000002'::uuid
  ),
  67::numeric,
  'released progress contains the released mark'
);

select pg_temp.authenticate_as(
  'fd010000-0000-4000-8000-000000000001'
);
set local role authenticated;

select is(
  (
    select score
    from public.student_progress
    where source_submission_id =
      'fd080000-0000-4000-8000-000000000002'::uuid
  ),
  67::numeric,
  'student sees progress only after mark release'
);

reset role;

select pg_temp.authenticate_as(
  'fd010000-0000-4000-8000-000000000003'
);
set local role authenticated;

select is(
  (
    select count(*)
    from public.get_parent_progress_reports()
    where student_id = 'fd030000-0000-4000-8000-000000000001'::uuid
      and marks_awarded = 67
      and topic_score = 67
  ),
  1::bigint,
  'parent report sees released mark and released progress'
);

reset role;

-- ---------------------------------------------------------------------------
-- Re-mark while released: update in place, never append duplicates.
-- ---------------------------------------------------------------------------
select pg_temp.authenticate_as(
  'fd010000-0000-4000-8000-000000000002'
);
set local role authenticated;

select lives_ok(
  $$
    select public.mark_assignment_submission(
      'fd080000-0000-4000-8000-000000000002'::uuid,
      72,
      'Adjusted released feedback',
      'marked'::public.submission_status,
      '{}'::jsonb,
      true,
      true
    )
  $$,
  'editing a released mark succeeds'
);

reset role;

select is(
  (
    select count(*)
    from public.student_progress
    where source_submission_id =
      'fd080000-0000-4000-8000-000000000002'::uuid
  ),
  1::bigint,
  'editing released mark does not duplicate progress'
);

select is(
  (
    select score
    from public.student_progress
    where source_submission_id =
      'fd080000-0000-4000-8000-000000000002'::uuid
  ),
  72::numeric,
  'editing released mark refreshes derived progress score'
);

-- ---------------------------------------------------------------------------
-- Unrelease through normal marking RPC: derived progress disappears atomically.
-- ---------------------------------------------------------------------------
select pg_temp.authenticate_as(
  'fd010000-0000-4000-8000-000000000002'
);
set local role authenticated;

select lives_ok(
  $$
    select public.mark_assignment_submission(
      'fd080000-0000-4000-8000-000000000002'::uuid,
      72,
      'Hidden again',
      'marked'::public.submission_status,
      '{}'::jsonb,
      false,
      false
    )
  $$,
  'tutor can unrelease result'
);

reset role;

select is(
  (
    select count(*)
    from public.student_progress
    where source_submission_id =
      'fd080000-0000-4000-8000-000000000002'::uuid
  ),
  0::bigint,
  'unrelease removes assignment-derived progress'
);

-- ---------------------------------------------------------------------------
-- Trigger is authoritative even outside the normal marking RPC.
-- Simulate a privileged/admin direct row change.
-- ---------------------------------------------------------------------------
update public.assignment_submissions
set status = 'marked',
    marks_awarded = 81,
    marks_released = true,
    released_at = now()
where id = 'fd080000-0000-4000-8000-000000000002';

select is(
  (
    select score
    from public.student_progress
    where source_submission_id =
      'fd080000-0000-4000-8000-000000000002'::uuid
  ),
  81::numeric,
  'direct privileged release still synchronizes progress'
);

update public.assignment_submissions
set marks_released = false,
    released_at = null
where id = 'fd080000-0000-4000-8000-000000000002';

select is(
  (
    select count(*)
    from public.student_progress
    where source_submission_id =
      'fd080000-0000-4000-8000-000000000002'::uuid
  ),
  0::bigint,
  'direct privileged unrelease still removes progress'
);

-- A manual/non-submission progress row remains independent.
insert into public.student_progress (
  id,
  student_id,
  subject_id,
  topic,
  score,
  cognitive_level,
  recorded_at,
  source_submission_id
)
values (
  'fd0b0000-0000-4000-8000-000000000002',
  'fd030000-0000-4000-8000-000000000001',
  'fd060000-0000-4000-8000-000000000001',
  'DATA01 Manual Tutor Observation',
  88,
  'application',
  now(),
  null
);

update public.assignment_submissions
set status = 'marked',
    marks_awarded = 81,
    marks_released = true,
    released_at = now()
where id = 'fd080000-0000-4000-8000-000000000002';

update public.assignment_submissions
set status = 'returned'
where id = 'fd080000-0000-4000-8000-000000000002';

select is(
  (
    select count(*)
    from public.student_progress
    where source_submission_id =
      'fd080000-0000-4000-8000-000000000002'::uuid
  ),
  0::bigint,
  'non-marked submission status removes derived progress even if release flag remains true'
);

select is(
  (
    select count(*)
    from public.student_progress
    where id = 'fd0b0000-0000-4000-8000-000000000002'
      and source_submission_id is null
      and score = 88
  ),
  1::bigint,
  'manual progress is not removed by submission release synchronization'
);

select * from finish();

rollback;
