const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const migrationDirectory = path.join(root, 'supabase', 'migrations');
const migrationName = fs.readdirSync(migrationDirectory)
  .find((name) => name.endsWith('_harden_payroll_and_editor_concurrency.sql'));

assert.ok(migrationName, 'the concurrency hardening migration must exist');

const migration = fs.readFileSync(path.join(migrationDirectory, migrationName), 'utf8');
const mutations = fs.readFileSync(path.join(root, 'src', 'features', 'assignments', 'assignmentMutations.ts'), 'utf8');
const adminAssignments = fs.readFileSync(path.join(root, 'src', 'features', 'admin', 'AdminAssignmentsRoute.tsx'), 'utf8');
const adminResults = fs.readFileSync(path.join(root, 'src', 'features', 'admin', 'AdminResultsRoute.tsx'), 'utf8');
const tutorReview = fs.readFileSync(path.join(root, 'src', 'features', 'tutors', 'TutorSubmissionReviewCard.tsx'), 'utf8');

test('REL-08 serializes every session write with payroll close and rechecks after waiting', () => {
  assert.match(migration, /create or replace function private\.lock_session_payroll_mutation\(\)/);
  assert.match(migration, /least\(v_old_week, v_new_week\)[\s\S]*greatest\(v_old_week, v_new_week\)/);
  assert.match(migration, /perform public\.lock_payroll_week_mutation/);
  assert.match(migration, /public\.session_date_pay_period_locked\(old\.date\)/);
  assert.match(migration, /public\.session_date_pay_period_locked\(new\.date\)/);
  assert.match(migration, /before insert or update or delete on public\.sessions/);
  assert.match(migration, /raise exception 'pay_period_locked'/);
});

test('REL-04 assignment writes require a compare-and-swap revision', () => {
  assert.match(migration, /alter table public\.assignments[\s\S]*add column if not exists revision integer not null default 1/);
  assert.match(migration, /p_expected_revision integer/);
  assert.match(migration, /assignment_revision_conflict/);
  assert.match(migration, /where id = v_assignment\.id[\s\S]*and revision = p_expected_revision/);
  assert.match(migration, /revision = revision \+ 1/);
  assert.match(migration, /raise exception 'assignment_revision_required'/);

  assert.match(mutations, /p_expected_revision: input\.expectedRevision/);
  assert.match(mutations, /p_expected_revision: draft\.revision/);
  assert.match(adminAssignments, /expectedRevision: assignment\.revision/);
  assert.match(mutations, /This assignment changed while you were editing/);
});

test('REL-05 marking writes require the revision loaded by every review surface', () => {
  assert.match(migration, /alter table public\.assignment_submissions[\s\S]*add column if not exists revision integer not null default 1/);
  assert.match(migration, /select \* into v_previous[\s\S]*for update/);
  assert.match(migration, /submission_revision_conflict/);
  assert.match(migration, /where id = p_submission_id[\s\S]*and revision = p_expected_revision/);
  assert.match(migration, /raise exception 'submission_revision_required'/);

  assert.match(mutations, /p_expected_revision: input\.expectedRevision/);
  assert.match(adminAssignments, /expectedRevision: submission\.revision/);
  assert.match(adminResults, /expectedRevision: selectedRow\.revision/);
  assert.match(tutorReview, /expectedRevision: submission\.revision/);
  assert.match(mutations, /This submission changed while you were editing/);
});

test('retired mutation signatures fail closed instead of retaining last-writer-wins behavior', () => {
  assert.match(migration, /raise exception 'submission_revision_required'[\s\S]*hint = 'Reload the submission/);
  assert.match(migration, /raise exception 'assignment_revision_required'[\s\S]*hint = 'Reload the assignment/);
  assert.match(migration, /revoke all on function public\.mark_assignment_submission/);
  assert.match(migration, /revoke all on function public\.finalize_assignment_publication/);
});
