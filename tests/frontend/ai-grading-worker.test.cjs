const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('AI grading queues work, fires the worker without waiting, and never uses legacy memos', () => {
  const mutations = read('src/features/assignments/assignmentMutations.ts');
  const worker = read('supabase/functions/grade-submission/index.ts');
  const readme = read('supabase/functions/grade-submission/README.md');
  const config = read('supabase/config.toml');
  const privacy = read('docs/compliance/POPIA_DATA_MAP.md');
  const adminAssignments = read('src/features/admin/AdminAssignmentsRoute.tsx');
  const retryMigration = read('supabase/migrations/20260811124013_bound_ai_grading_retries.sql');
  const snapshotMigration = read('supabase/migrations/20260811140000_snapshot_assignment_for_ai_grading.sql');

  assert.match(mutations, /enqueue_ai_grading/);
  assert.match(mutations, /void\s+\(client as unknown as/);
  assert.match(mutations, /functions\.invoke\('grade-submission'/);
  assert.doesNotMatch(mutations, /await triggerAiGrading\(client, submissionId\);[^]*functions\.invoke\('grade-submission'/);

  assert.match(worker, /claim_ai_grading_job/);
  assert.match(worker, /claim_next_ai_grading_job/);
  assert.match(worker, /complete_ai_grading_job/);
  assert.match(worker, /fail_ai_grading_job/);
  assert.match(worker, /ai_assignment_snapshot_json/);
  assert.match(worker, /Rubric snapshot captured at/);
  assert.match(snapshotMigration, /capture_assignment_snapshot/);
  assert.match(snapshotMigration, /ai_assignment_snapshot_json jsonb/);
  assert.match(retryMigration, /ai_grading_max_attempts/);
  assert.match(retryMigration, /dead_lettered/);
  assert.match(retryMigration, /ai_grading_retry_delay_minutes/);
  assert.match(retryMigration, /requeue_ai_grading_job/);
  assert.match(retryMigration, /get_ai_grading_queue_metrics/);
  assert.match(retryMigration, /ai_grading\.dead_lettered/);
  assert.match(worker, /AbortSignal\.timeout/);
  assert.match(worker, /GeminiResponseSchema/);
  assert.match(worker, /private legacy memo data is never/);
  assert.doesNotMatch(worker, /assignment-memos/);
  assert.doesNotMatch(worker, /memo_url/);
  assert.doesNotMatch(worker, /Access-Control-Allow-Origin': '\*'/);
  assert.doesNotMatch(worker, /No memo -> the row's `ai_grading_status` is set to `skipped`/);

  assert.match(readme, /memos are retired/i);
  assert.match(config, /\[functions\.grade-submission\]/);
  assert.match(privacy, /Google Gemini/);
  assert.doesNotMatch(adminAssignments, /Memo \/ model answer|memo_url|setMemo/);
});
