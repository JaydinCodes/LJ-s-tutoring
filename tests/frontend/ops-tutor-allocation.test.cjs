const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('admin allocation workflow is routed and supports assign update deactivate', () => {
  const route = read('src/features/admin/AdminAllocationsRoute.tsx');
  const mutations = read('src/features/admin/allocationManagementMutations.ts');
  const repository = read('src/features/admin/allocationManagementRepository.ts');
  const app = read('src/app/App.tsx');
  const shell = read('src/components/dashboard/DashboardShell.tsx');

  assert.match(app, /path="\/dashboard\/admin\/allocations"/);
  assert.match(shell, /to: '\/dashboard\/admin\/allocations'/);
  assert.match(route, /Assign student to tutor/);
  assert.match(route, /deactivateTutorStudentAllocation/);
  assert.match(mutations, /from\('tutor_student_allocations'\)/);
  assert.match(mutations, /\.upsert\(allocationPayload\(input\), \{ onConflict: 'tutor_id,student_id' \}\)/);
  assert.match(mutations, /status: 'inactive'/);
  assert.match(repository, /from\('tutor_student_allocations'\)\.select\('\*'\)/);
});

test('tutor and student dashboards consume allocation-scoped data', () => {
  const tutorRepo = read('src/features/tutors/tutorDashboardRepository.ts');
  const tutorRoute = read('src/features/tutors/TutorDashboardRoute.tsx');
  const studentRepo = read('src/features/students/studentDashboardRepository.ts');

  assert.match(tutorRepo, /from\('tutor_student_allocations'\)\.select\('\*'\)\.eq\('tutor_id', tutor\.id\)\.eq\('status', 'active'\)/);
  assert.match(tutorRepo, /allocatedStudents:/);
  assert.match(tutorRoute, /Allocated students/);
  assert.match(studentRepo, /from\('tutor_student_allocations'\)\.select\('\*'\)\.eq\('student_id', student\.id\)\.eq\('status', 'active'\)/);
  assert.match(studentRepo, /assignedTutors:/);
});
