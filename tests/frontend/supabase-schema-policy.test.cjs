const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const schema = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'docs', 'supabase', 'schema.sql'),
  'utf8',
);

test('Supabase schema exposes current profile helpers used by RLS policies', () => {
  assert.match(schema, /create or replace function public\.current_profile_role\(\)/);
  assert.match(schema, /create or replace function public\.current_profile_id\(\)/);
});

test('tutor assignment RLS is scoped to assignments created by the current profile', () => {
  assert.match(schema, /create policy "tutors_manage_own_assignments"/);
  assert.match(schema, /created_by = public\.current_profile_id\(\)/);
  assert.doesNotMatch(
    schema,
    /create policy "admin_tutor_manage_assignments"[\s\S]*current_profile_role\(\) in \('admin', 'tutor'\)/,
    'tutors must not receive broad all-assignment write access',
  );
});

test('tutors can insert subjects for assignment creation without admin subject access', () => {
  assert.match(schema, /create policy "tutors_insert_subjects"/);
  assert.match(schema, /on public\.subjects for insert/);
  assert.match(schema, /with check \(public\.current_profile_role\(\) = 'tutor'\)/);
});

test('assignment storage buckets remain private with scoped upload policies', () => {
  assert.match(schema, /\('assignment-files', 'assignment-files', false\)/);
  assert.match(schema, /\('assignment-submissions', 'assignment-submissions', false\)/);
  assert.match(schema, /create policy "admin_tutor_upload_assignment_files"/);
  assert.match(schema, /create policy "students_upload_own_submission_files"/);
  assert.match(schema, /create policy "students_read_own_submission_files_or_admin"/);
});

test('assignment submission writes use RPC for versioning and marking', () => {
  const mutations = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'src', 'features', 'assignments', 'assignmentMutations.ts'),
    'utf8',
  );

  assert.match(schema, /create or replace function public\.submit_assignment_submission/);
  assert.match(schema, /create or replace function public\.mark_assignment_submission/);
  assert.match(schema, /grant execute on function public\.submit_assignment_submission/);
  assert.match(schema, /grant execute on function public\.mark_assignment_submission/);
  assert.match(mutations, /rpc\('submit_assignment_submission'/);
  assert.match(mutations, /rpc\('mark_assignment_submission'/);
  assert.doesNotMatch(mutations, /\.from\('assignment_submissions'\)[\s\S]*\.update\(\{\s*marks_awarded/);
});

test('students cannot update review fields directly through submission policies', () => {
  assert.match(schema, /create policy "submissions_no_direct_student_update"/);
  assert.match(schema, /create policy "submissions_tutor_mark_via_rpc_only"/);
  assert.match(schema, /with check \(\s*false\s*\)/);
  // Students cannot insert submission rows directly at all: the permissive
  // "shape" INSERT policy that once let them set fields was removed (AUDIT.md
  // Critical) and must stay removed; the only insert path is the RPC.
  assert.match(schema, /create policy "submissions_student_insert_via_rpc_guard"[\s\S]*?with check \(\s*false\s*\)/);
  assert.doesNotMatch(schema, /create policy "submissions_student_rpc_insert_shape"/);
  assert.match(schema, /assignment_submissions_marks_range/);
});

test('students read assignment submissions through release-redacted RPC', () => {
  const studentRepo = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'src', 'features', 'students', 'studentDashboardRepository.ts'),
    'utf8',
  );

  assert.match(schema, /create or replace function public\.get_student_assignment_submissions/);
  assert.match(schema, /case when sub\.marks_released then sub\.marks_awarded else null end as marks_awarded/);
  assert.match(schema, /case when sub\.feedback_released then sub\.feedback else null end as feedback/);
  assert.match(schema, /grant execute on function public\.get_student_assignment_submissions\(\) to authenticated/);
  assert.match(
    schema,
    /create policy "submissions_student_self_or_admin"[\s\S]*on public\.assignment_submissions for select[\s\S]*using \(\s*public\.is_platform_admin\(\)\s*\);/,
    'raw submission table select must stay admin-only for this policy',
  );
  assert.match(studentRepo, /rpc\('get_student_assignment_submissions'\)/);
});

test('class and enrollment RLS is scoped to admins, assigned tutors, and enrolled students', () => {
  assert.match(schema, /create or replace function public\.current_tutor_id\(\)/);
  assert.match(schema, /create or replace function public\.current_student_class_ids\(\)[\s\S]*security definer[\s\S]*set search_path = ''/);
  assert.match(schema, /create or replace function public\.current_tutor_class_ids\(\)[\s\S]*security definer[\s\S]*set search_path = ''/);
  assert.match(schema, /alter table public\.classes add column if not exists name/);
  assert.match(schema, /alter table public\.classes add column if not exists status/);
  assert.match(schema, /drop policy if exists "classes_read_authenticated"/);
  assert.match(schema, /create policy "classes_select_scoped"/);
  assert.match(schema, /tutor_id = public\.current_tutor_id\(\)/);
  assert.match(schema, /id in \(select public\.current_student_class_ids\(\)\)/);
  assert.match(schema, /drop policy if exists "class_enrollments_read_authenticated"/);
  assert.match(schema, /create policy "class_enrollments_select_scoped"/);
  assert.match(schema, /class_id in \(select public\.current_tutor_class_ids\(\)\)/);
  assert.doesNotMatch(schema, /create policy "classes_read_authenticated"[\s\S]*auth\.uid\(\) is not null/);
  assert.doesNotMatch(schema, /create policy "class_enrollments_read_authenticated"[\s\S]*auth\.uid\(\) is not null/);
});

test('tutor-student allocation base rows are tutor/admin-only and students use a safe RPC', () => {
  assert.match(schema, /create table if not exists public\.tutor_student_allocations/);
  assert.match(schema, /unique \(tutor_id, student_id\)/);
  assert.match(schema, /alter table public\.tutor_student_allocations enable row level security/);
  assert.match(schema, /create policy "tutor_student_allocations_select_scoped"/);
  assert.match(schema, /tutor_id = public\.current_tutor_id\(\)/);
  assert.match(schema, /create policy "admin_manage_tutor_student_allocations"/);
  assert.doesNotMatch(schema, /create policy "profiles_select_allocated_learning_relationship"/);
  assert.match(schema, /create or replace function public\.get_student_assigned_tutors\(\)/);
  assert.match(schema, /revoke execute on function public\.get_student_assigned_tutors\(\) from public/);
  assert.match(schema, /grant execute on function public\.get_student_assigned_tutors\(\) to authenticated/);
  assert.match(schema, /create or replace function public\.get_tutor_allocated_students\(\)/);
  assert.match(schema, /revoke execute on function public\.get_tutor_allocated_students\(\) from public/);
  assert.match(schema, /grant execute on function public\.get_tutor_allocated_students\(\) to authenticated/);

  for (const [policyName, forbidden] of [
    ['students_select_self_or_admin', /current_tutor_id|tutor_student_allocations/],
    ['tutors_select_self_or_admin', /current_student_id|tutor_student_allocations/],
    ['tutor_student_allocations_select_scoped', /current_student_id/],
  ]) {
    const start = schema.indexOf(`create policy "${policyName}"`);
    const block = schema.slice(start, schema.indexOf('\n);', start) + 3);
    assert.ok(start >= 0, `expected ${policyName}`);
    assert.doesNotMatch(block, forbidden, `${policyName} must not expose a cross-role base row`);
  }
});

test('retention cleanup has separate fail-closed admin and scheduler entry points', () => {
  const adminStart = schema.indexOf('create or replace function public.run_retention_cleanup(p_apply boolean default false)');
  const schedulerStart = schema.indexOf('create or replace function public.run_retention_cleanup_scheduled()');
  const adminBlock = schema.slice(adminStart, schedulerStart);
  const schedulerBlock = schema.slice(schedulerStart);

  assert.ok(adminStart >= 0, 'expected admin retention RPC');
  assert.ok(schedulerStart >= 0, 'expected scheduled retention RPC');
  assert.match(schema, /create schema if not exists private/);
  assert.match(schema, /create or replace function private\.execute_retention_cleanup\(p_apply boolean\)/);
  assert.match(
    schema,
    /revoke all on function private\.execute_retention_cleanup\(boolean\)\s+from public, anon, authenticated, service_role;/,
  );

  assert.match(adminBlock, /if not public\.is_platform_admin\(\) then/);
  assert.doesNotMatch(adminBlock, /auth\.uid\(\) is null/);
  assert.match(
    adminBlock,
    /revoke all on function public\.run_retention_cleanup\(boolean\)\s+from public, anon, authenticated, service_role;/,
  );
  assert.match(adminBlock, /grant execute on function public\.run_retention_cleanup\(boolean\) to authenticated;/);

  assert.match(schedulerBlock, /coalesce\(auth\.jwt\(\) ->> 'role', ''\) <> 'service_role'/);
  assert.match(
    schedulerBlock,
    /revoke all on function public\.run_retention_cleanup_scheduled\(\)\s+from public, anon, authenticated, service_role;/,
  );
  assert.match(schedulerBlock, /grant execute on function public\.run_retention_cleanup_scheduled\(\) to service_role;/);
});

