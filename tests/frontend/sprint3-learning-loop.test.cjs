const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = (name) => fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', name), 'utf8');
const activitySql = migration('20260923162220_sprint3_learner_activities.sql');
const progressSql = migration('20260923162534_sprint3_activity_progress_and_manual_review.sql');
const insightSql = migration('20260923170000_sprint3_tutor_learning_insights.sql');

test('learner activity APIs enforce approved complete content without exposing answer configuration', () => {
  assert.match(activitySql, /activity\.review_status='approved'/);
  assert.match(activitySql, /version\.review_status <> 'approved'/);
  assert.match(activitySql, /item\.retired_at is not null/);
  assert.doesNotMatch(activitySql, /answer_config/);
});

test('activity retry and resume use existing idempotent attempts and persisted progress', () => {
  assert.match(progressSql, /unique\(student_id, learning_activity_template_id\)/);
  assert.match(progressSql, /p_idempotency_key uuid/);
  assert.match(progressSql, /record_learning_attempt/);
  assert.match(progressSql, /on conflict\(learning_attempt_id, question_hint_id\) do nothing/);
});

test('manual review is allocation scoped and converges on skill evidence', () => {
  assert.match(progressSql, /can_access_learning_student\(v_attempt\.student_id\)/);
  assert.match(progressSql, /learning_attempt_skill_evidence/);
  assert.match(progressSql, /learning_attempt\.manually_reviewed/);
  assert.match(progressSql, /grant execute on function public\.review_learning_attempt.*to authenticated/s);
});

test('tutor exceptions are allocation scoped and use documented deterministic thresholds', () => {
  assert.match(insightSql, /can_access_learning_student\(student\.id\)/);
  assert.match(insightSql, /independent_count >= 3/);
  assert.match(insightSql, /correct_count >= 3/);
  assert.match(insightSql, />= 0\.6/);
});
