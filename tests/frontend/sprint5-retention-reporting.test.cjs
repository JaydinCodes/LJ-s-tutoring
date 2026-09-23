const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260923205016_sprint5_learning_retention_reporting.sql'), 'utf8');
const learningPage = fs.readFileSync(path.join(root, 'src/features/learning/StudentLearningRoute.tsx'), 'utf8');
const edge = fs.readFileSync(path.join(root, 'supabase/functions/evaluate-learning-attempt/index.ts'), 'utf8');

test('Sprint 5 retention uses an idempotent, sequential 7/21/60 day server schedule', () => {
  assert.match(migration, /short_delay_days integer not null/);
  assert.match(migration, /values \('grade9_default', 1, 7, 21, 60, true\)/);
  assert.match(migration, /unique \(student_id, skill_id, source_mastery_evaluation_id, stage\)/);
  assert.match(migration, /materialize_learning_retention_checks/);
  assert.match(migration, /when 'short_delay' then 'medium_delay'/);
  assert.match(migration, /when 'medium_delay' then 'long_delay'/);
  assert.match(migration, /status='due'/);
});

test('Sprint 5 protects retention authority and uses existing activity evidence', () => {
  assert.match(migration, /auth\.role\(\) <> 'service_role'/);
  assert.match(migration, /complete_my_learning_retention_check/);
  assert.match(migration, /evidence\.independence='independent'/);
  assert.match(migration, /v_outcome:=case when v_correct and v_independent then 'passed' when v_correct then 'assisted' else 'failed' end/);
  assert.match(edge, /p_complete_retention===true/);
  assert.match(edge, /await recalculate\(admin,check\.student_id\)/);
});

test('learner next step prioritises a due quick review without exposing answer configuration', () => {
  assert.match(learningPage, /useDueRetentionStep/);
  assert.match(learningPage, /Start quick review/);
  assert.doesNotMatch(learningPage, /answer_config|accepted answers|misconception rule/i);
});

test('safe reporting RPCs remain role-scoped and do not return raw responses', () => {
  assert.match(migration, /get_my_learning_progress_summary/);
  assert.match(migration, /get_parent_learning_progress_summary/);
  assert.match(migration, /get_admin_learning_aggregate/);
  assert.match(migration, /public\.current_profile_role\(\)='parent'/);
  assert.doesNotMatch(migration.match(/create or replace function public\.get_parent_learning_progress_summary\(\)[\s\S]*?\$\$;/)?.[0] ?? '', /learner_response|answer_config|attempt\.response/);
});
