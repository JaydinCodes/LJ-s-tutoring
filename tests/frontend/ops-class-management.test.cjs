const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('admin class management route supports create edit archive and enrollment workflows', () => {
  const route = read('src/features/admin/AdminClassesRoute.tsx');
  const mutations = read('src/features/admin/classManagementMutations.ts');
  const repository = read('src/features/admin/classManagementRepository.ts');
  const app = read('src/app/App.tsx');
  const shell = read('src/components/dashboard/DashboardShell.tsx');

  assert.match(app, /path="\/dashboard\/admin\/classes"/);
  assert.match(shell, /to: '\/dashboard\/admin\/classes'/);
  assert.match(route, /Create class or cohort/);
  assert.match(route, /assignStudentToClass/);
  assert.match(route, /removeStudentFromClass/);
  assert.match(route, /archiveClassRecord/);
  assert.match(mutations, /from\('classes'\)[\s\S]*\.insert\(classPayload\(input\)\)/);
  assert.match(mutations, /from\('classes'\)[\s\S]*\.update\(classPayload\(input\)\)/);
  assert.match(mutations, /from\('class_enrollments'\)\s*[\s\S]*\.upsert/);
  assert.match(mutations, /status: 'inactive'/);
  assert.match(repository, /from\('class_enrollments'\)\.select\('\*'\)/);
});

test('student class loading uses enrollments rather than broad grade-matched class reads', () => {
  const studentRepo = read('src/features/students/studentDashboardRepository.ts');

  assert.match(studentRepo, /from\('class_enrollments'\)\.select\('class_id'\)/);
  assert.match(studentRepo, /\.eq\('student_id', student\.id\)/);
  assert.match(studentRepo, /\.eq\('status', 'active'\)/);
  assert.match(studentRepo, /from\('classes'\)\.select\('\*'\)\.in\('id', enrolledClassIds\)/);
  assert.doesNotMatch(studentRepo, /from\('classes'\)\.select\('\*'\)\.eq\('grade', student\.grade/);
});
