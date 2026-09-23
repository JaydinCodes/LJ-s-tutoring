const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '20260923202257_sprint4_learning_content_authoring.sql'), 'utf8');
const route = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'features', 'admin', 'AdminLearningContentRoute.tsx'), 'utf8');

test('Sprint 4 content authoring uses controlled admin RPCs and draft-only creation', () => {
  assert.match(migration, /content_admin_required/);
  assert.match(migration, /review_status,activity_type/);
  assert.match(migration, /'draft'/);
  assert.match(migration, /save_learning_question_draft/);
  assert.match(migration, /create_learning_question_revision/);
});

test('structured answer configuration validates the supported deterministic types', () => {
  for (const type of ['numeric', 'fraction', 'multiple_choice', 'coordinate', 'linear_equation_solution', 'algebraic_expression', 'factorised_expression']) {
    assert.match(migration, new RegExp(`'${type}'`));
  }
  assert.match(migration, /FACTORISED_FORM_REQUIRED/);
  assert.match(migration, /MISSING_CORRECT_OPTION/);
});

test('approval remains a canonical reviewed server-side transition', () => {
  assert.match(migration, /validate_question_version_for_approval/);
  assert.match(route, /Submit for review/);
  assert.match(route, /Create revision draft/);
  assert.match(route, /ReviewPanel/);
});

test('import is validate-first, duplicate-safe, and never auto-approves', () => {
  assert.match(migration, /p_dry_run boolean default true/);
  assert.match(migration, /DUPLICATE_ITEM_CODE/);
  assert.match(migration, /UNKNOWN_SKILL_CODE/);
  assert.match(migration, /INVALID_ANSWER_CONFIG/);
  const importBody = migration.split('create or replace function public.import_learning_question_drafts')[1].split('revoke all on function public.content_admin_required')[0];
  assert.doesNotMatch(importBody, /review_status[^\n]*'approved'/);
});

test('catalog has bounded server-side pagination and learner APIs remain separate', () => {
  assert.match(migration, /limit least\(greatest\(coalesce\(p_page_size,25\),1\),100\)/);
  assert.match(migration, /offset v_offset/);
  assert.doesNotMatch(route, /answerConfig.*learner-safe/i);
});

test('activity authoring stays draft-first and approval validates learner-facing stage content', () => {
  assert.match(migration, /save_learning_activity_draft/);
  assert.match(migration, /review_learning_activity_action/);
  assert.match(migration, /activity_requires_stage/);
  assert.match(migration, /assessed_activity_stage_requires_question/);
  assert.match(migration, /activity_requires_approved_active_questions/);
});
