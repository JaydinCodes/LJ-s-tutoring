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

  assert.match(mutations, /enqueue_ai_grading/);
  assert.match(mutations, /void\s+\(client as unknown as/);
  assert.match(mutations, /functions\.invoke\('grade-submission'/);
  assert.doesNotMatch(mutations, /await triggerAiGrading\(client, submissionId\);[^]*functions\.invoke\('grade-submission'/);

  assert.match(worker, /claim_ai_grading_job/);
  assert.match(worker, /claim_next_ai_grading_job/);
  assert.match(worker, /complete_ai_grading_job/);
  assert.match(worker, /fail_ai_grading_job/);
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
