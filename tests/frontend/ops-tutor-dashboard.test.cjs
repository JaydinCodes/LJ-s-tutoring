const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('OPS-04 tutor dashboard is an allocation-scoped operations cockpit', () => {
  const route = read('src/features/tutors/TutorDashboardRoute.tsx');
  const repository = read('src/features/tutors/tutorDashboardRepository.ts');
  const types = read('src/types/lms.ts');

  assert.match(repository, /from\('tutor_student_allocations'\)\.select\('\*'\)\.eq\('tutor_id', tutor\.id\)\.eq\('status', 'active'\)/);
  assert.match(repository, /loadTutorSessions\(\),/);
  assert.match(repository, /markingQueue = enrichedSubmissions\.filter/);
  assert.match(repository, /learnerProgress: allocations\.map/);
  assert.match(repository, /pending_submissions:/);
  assert.match(repository, /average_mark:/);

  assert.match(types, /markingQueue:/);
  assert.match(types, /sessions: Array/);
  assert.match(types, /learnerProgress: Array/);

  assert.match(route, /Today’s teaching plan/);
  assert.match(route, /Learners needing attention/);
  assert.match(route, /Submissions awaiting review/);
  assert.match(route, /Upcoming sessions/);
  assert.match(route, /Open learner brief/);
  assert.match(route, /sm:grid-cols-3/);
});

test('OPS-04 tutor dashboard preserves deeper tutor workflows', () => {
  const route = read('src/features/tutors/TutorDashboardRoute.tsx');

  assert.match(route, /to="\/dashboard\/tutor\/submissions"/);
  assert.match(route, /to="\/dashboard\/tutor\/sessions"/);
  assert.match(route, /to="\/dashboard\/tutor\/assignments"/);
  assert.match(route, /to=\{nextLearner \? `\/dashboard\/tutor\/learners/);
  assert.match(route, /Review work and respond/);
  assert.match(route, /Brief ready/);
});
