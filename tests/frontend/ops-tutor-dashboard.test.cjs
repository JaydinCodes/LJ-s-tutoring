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

  assert.match(route, /Tutor operations/);
  assert.match(route, /Allocated students/);
  assert.match(route, /Marking queue/);
  assert.match(route, /Upcoming and recent sessions/);
  assert.match(route, /Open risk monitor/);
  assert.match(route, /grid gap-3 sm:grid-cols-2 lg:grid-cols-4/);
});

test('OPS-04 tutor dashboard preserves deeper tutor workflows', () => {
  const route = read('src/features/tutors/TutorDashboardRoute.tsx');

  assert.match(route, /href="\/dashboard\/tutor\/submissions"/);
  assert.match(route, /href="\/dashboard\/tutor\/sessions"/);
  assert.match(route, /href="\/dashboard\/tutor\/classes"/);
  assert.match(route, /href="\/dashboard\/tutor\/reports"/);
  assert.match(route, /TutorSubmissionReviewCard/);
  assert.match(route, /Session records are loaded directly from Supabase/);
});
