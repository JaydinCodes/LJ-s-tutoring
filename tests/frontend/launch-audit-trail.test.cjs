const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(...parts) {
  return fs.readFileSync(path.resolve(__dirname, '..', '..', ...parts), 'utf8');
}

test('LAUNCH-05 Supabase audit log table, RLS, and secure functions exist', () => {
  const schema = read('docs', 'supabase', 'schema.sql');

  assert.match(schema, /create table if not exists public\.audit_log/);
  assert.match(schema, /actor_user_id uuid references auth\.users\(id\) on delete set null/);
  assert.match(schema, /actor_role public\.user_role/);
  assert.match(schema, /metadata jsonb not null default '\{\}'::jsonb/);
  assert.match(schema, /alter table public\.audit_log enable row level security/);
  assert.match(schema, /create policy "admin_select_audit_log"/);
  assert.match(schema, /create policy "no_direct_audit_log_insert"[\s\S]*with check \(false\)/);
  assert.match(schema, /create policy "no_direct_audit_log_update"[\s\S]*using \(false\)[\s\S]*with check \(false\)/);
  assert.match(schema, /create policy "no_direct_audit_log_delete"[\s\S]*using \(false\)/);
  assert.match(schema, /create or replace function public\.log_audit_event/);
  assert.match(schema, /create or replace function public\.record_audit_event/);
  assert.match(schema, /auth\.uid\(\)/, 'audit functions must source actor from Supabase auth');
  assert.match(schema, /revoke execute on function public\.log_audit_event/);
  assert.match(schema, /grant execute on function public\.record_audit_event/);
});

test('LAUNCH-05 critical assignment and release RPCs write audit events', () => {
  const schema = read('docs', 'supabase', 'schema.sql');

  assert.match(schema, /public\.submit_assignment_submission[\s\S]*assignment_submission\.created/);
  assert.match(schema, /public\.submit_assignment_submission[\s\S]*assignment_submission\.file_replaced/);
  assert.match(schema, /public\.mark_assignment_submission[\s\S]*submission\.marked/);
  assert.match(schema, /public\.mark_assignment_submission[\s\S]*feedback\.updated/);
  assert.match(schema, /public\.mark_assignment_submission[\s\S]*result\.released/);
  assert.match(schema, /public\.mark_assignment_submission[\s\S]*result\.unreleased/);
});

test('LAUNCH-05 admin and tutor mutation surfaces record audit events', () => {
  const assignmentMutations = read('src', 'features', 'assignments', 'assignmentMutations.ts');
  const allocationMutations = read('src', 'features', 'admin', 'allocationManagementMutations.ts');
  const guardianMutations = read('src', 'features', 'admin', 'guardianMutations.ts');
  const rosterMutations = read('src', 'features', 'admin', 'rosterMutations.ts');
  const userRoute = read('src', 'features', 'admin', 'AdminUsersRoute.tsx');
  const classMutations = read('src', 'features', 'admin', 'classManagementMutations.ts');

  for (const source of [assignmentMutations, allocationMutations, guardianMutations, rosterMutations, userRoute, classMutations]) {
    assert.match(source, /recordAuditEvent/);
  }

  assert.match(assignmentMutations, /assignment\.created/);
  assert.match(assignmentMutations, /assignment\.updated/);
  assert.match(assignmentMutations, /assignment\.attachment_replaced/);
  assert.match(allocationMutations, /tutor_student_allocation\.upserted/);
  assert.match(guardianMutations, /guardian_access\.upserted/);
  assert.match(rosterMutations, /user_profile\.created/);
  assert.match(userRoute, /user\.invited/);
  assert.match(userRoute, /user\.created/);
  assert.match(classMutations, /ngo_cohort_access\.updated/);
});

test('LAUNCH-05 admin audit route reads Supabase audit logs with filters', () => {
  const repository = read('src', 'features', 'admin', 'adminOperationsRepository.ts');
  const route = read('src', 'features', 'admin', 'AdminOperationsRoutes.tsx');

  assert.match(repository, /from\('audit_log'\)/);
  assert.match(repository, /ilike\('action'/);
  assert.match(repository, /ilike\('entity_type'/);
  assert.match(repository, /eq\('actor_user_id'/);
  assert.match(repository, /gte\('created_at'/);
  assert.match(repository, /lte\('created_at'/);
  assert.match(route, /Action/);
  assert.match(route, /Entity type/);
  assert.match(route, /Actor auth ID/);
  assert.match(route, /Metadata/);
});
