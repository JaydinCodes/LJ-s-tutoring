const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('OPS-07 schema adds guardian records and scoped links', () => {
  const schema = read('docs/supabase/schema.sql');

  assert.match(schema, /create table if not exists public\.guardians/);
  assert.match(schema, /create table if not exists public\.student_guardians/);
  assert.match(schema, /communication_preference text not null default 'email'/);
  assert.match(schema, /can_receive_reports boolean not null default true/);
  assert.match(schema, /unique \(student_id, guardian_id\)/);
  assert.match(schema, /alter table public\.guardians enable row level security/);
  assert.match(schema, /alter table public\.student_guardians enable row level security/);
  assert.match(schema, /create policy "admin_manage_guardians"/);
  assert.match(schema, /create policy "admin_manage_student_guardians"/);
  const guardianSelectPolicy = schema.slice(
    schema.indexOf('create policy "guardians_select_scoped"'),
    schema.indexOf('create policy "admin_manage_guardians"'),
  );
  assert.doesNotMatch(
    guardianSelectPolicy,
    /current_tutor_id\(\)/,
    'tutors must not get guardian contact access by default',
  );
});

test('OPS-07 admin students screen manages guardians and student links', () => {
  const route = read('src/features/admin/AdminStudentsRoute.tsx');
  const mutations = read('src/features/admin/guardianMutations.ts');
  const repository = read('src/features/admin/adminDashboardRepository.ts');
  const types = read('src/types/lms.ts');

  assert.match(types, /export interface Guardian/);
  assert.match(types, /export interface StudentGuardian/);
  assert.match(repository, /from\('guardians'\)\.select\('\*'\)/);
  assert.match(repository, /from\('student_guardians'\)\.select\('\*'\)/);
  assert.match(route, /Add guardian/);
  assert.match(route, /Linked guardians/);
  assert.match(route, /Can receive reports/);
  assert.match(route, /linkGuardianToStudent/);
  assert.match(mutations, /from\('guardians'\)/);
  assert.match(mutations, /from\('student_guardians'\)/);
  assert.match(mutations, /onConflict: 'student_id,guardian_id'/);
});
