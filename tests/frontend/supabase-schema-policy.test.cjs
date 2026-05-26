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
