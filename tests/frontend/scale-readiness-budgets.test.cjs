const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, ...file.split('/')), 'utf8');

test('scale-readiness budgets and read-only AI capacity probe are present', () => {
  const budgets = read('docs/performance/SCALE_READINESS_BUDGETS.md');
  const probe = read('scripts/check-ai-queue-capacity.cjs');

  assert.match(budgets, /Learner dashboard/);
  assert.match(budgets, /Admin markbook/);
  assert.match(budgets, /Estimated drain time/);
  assert.match(budgets, /Deferred work/);
  assert.match(probe, /get_ai_grading_queue_metrics/);
  assert.match(probe, /does not insert, update, claim, or retry/);
  assert.match(probe, /AI_WORKER_JOBS_PER_MINUTE/);
});
