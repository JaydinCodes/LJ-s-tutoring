const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('OPS-05 admin results route is a Supabase-backed markbook', () => {
  const app = read('src/app/App.tsx');
  const route = read('src/features/admin/AdminResultsRoute.tsx');
  const repository = read('src/features/admin/adminMarkbookRepository.ts');

  assert.match(app, /AdminResultsRoute/);
  assert.match(app, /path="\/dashboard\/admin\/results"/);
  assert.match(route, /Admin Markbook/);
  assert.match(route, /Results filters/);
  assert.match(route, /Class or cohort/);
  assert.match(route, /Assignment/);
  assert.match(route, /Markbook table/);
  assert.match(route, /markSubmission\(\{ submissionId: selectedRow\.id, marksAwarded, feedback, status, rubricScoresJson, marksReleased, feedbackReleased \}\)/);

  assert.match(repository, /from\('assignment_submissions'\)\.select\('\*'\)/);
  assert.match(repository, /from\('class_enrollments'\)\.select\('\*'\)\.eq\('status', 'active'\)/);
  assert.match(repository, /class_ids:/);
  assert.match(repository, /subject_name:/);
  assert.match(repository, /summarizeRows/);
});

test('OPS-05 mark writes stay on the secure RPC path', () => {
  const route = read('src/features/admin/AdminResultsRoute.tsx');
  const mutations = read('src/features/assignments/assignmentMutations.ts');

  assert.match(route, /import \{ markSubmission \} from '\.\.\/assignments\/assignmentMutations'/);
  assert.match(mutations, /rpc\('mark_assignment_submission'/);
  assert.doesNotMatch(route, /\.from\('assignment_submissions'\)[\s\S]*\.update\(/);
  assert.doesNotMatch(mutations, /\.from\('assignment_submissions'\)[\s\S]*\.update\(\{\s*marks_awarded/);
});
