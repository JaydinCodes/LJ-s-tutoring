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
  assert.match(schema, /marks_awarded is null/);
  assert.match(schema, /feedback is null/);
  assert.match(schema, /assignment_submissions_marks_range/);
});

test('class and enrollment RLS is scoped to admins, assigned tutors, and enrolled students', () => {
  assert.match(schema, /create or replace function public\.current_tutor_id\(\)/);
  assert.match(schema, /alter table public\.classes add column if not exists name/);
  assert.match(schema, /alter table public\.classes add column if not exists status/);
  assert.match(schema, /drop policy if exists "classes_read_authenticated"/);
  assert.match(schema, /create policy "classes_select_scoped"/);
  assert.match(schema, /tutor_id = public\.current_tutor_id\(\)/);
  assert.match(schema, /ce\.student_id = public\.current_student_id\(\)/);
  assert.match(schema, /drop policy if exists "class_enrollments_read_authenticated"/);
  assert.match(schema, /create policy "class_enrollments_select_scoped"/);
  assert.doesNotMatch(schema, /create policy "classes_read_authenticated"[\s\S]*auth\.uid\(\) is not null/);
  assert.doesNotMatch(schema, /create policy "class_enrollments_read_authenticated"[\s\S]*auth\.uid\(\) is not null/);
});
