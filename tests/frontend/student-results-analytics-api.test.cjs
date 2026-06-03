const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('student results analytics API exposes a stable typed contract', () => {
  const api = read('lms-api', 'src', 'routes', 'academic.ts');

  assert.ok(api.includes("app.get('/student/results/analytics'"), 'analytics route must be registered');
  assert.ok(api.includes('interface StudentResultAnalyticsResponse'), 'analytics response must be typed');
  assert.ok(api.includes('buildStudentResultsAnalytics(studentId)'), 'route must use the shared analytics builder');

  for (const field of ['overallAverage', 'subjectAverages', 'topicAverages', 'cognitiveBreakdown', 'trendPoints', 'classComparison']) {
    assert.ok(api.includes(field), `${field} must be part of the response contract`);
  }
});

test('student results analytics API is scoped to the authenticated learner and anonymizes class data', () => {
  const api = read('lms-api', 'src', 'routes', 'academic.ts');

  assert.ok(api.includes('where student_id = $1'), 'private result rows must be scoped by authenticated student id');
  assert.ok(api.includes('requireRole(\'STUDENT\')'), 'analytics endpoint must require the student role');
  assert.ok(api.includes('CLASS_ANALYTICS_PRIVACY_THRESHOLD'), 'class comparison must enforce the privacy threshold');
  assert.ok(api.includes('classSize >= CLASS_ANALYTICS_PRIVACY_THRESHOLD'), 'class comparison must only appear above the threshold');
  assert.ok(!api.includes('classComparison: studentAverages'), 'response must not expose individual classmate averages');
});

test('student results analytics queries have supporting indexes', () => {
  const migration = read('lms-api', 'prisma', 'migrations', '20260603_student_results_analytics_api', 'migration.sql');

  assert.ok(migration.includes('baseline_assessments_student_completed_subject_idx'), 'student result analytics index must exist');
  assert.ok(migration.includes('on baseline_assessments(student_id, completed_at desc, subject)'), 'student index must match private read ordering');
  assert.ok(migration.includes('baseline_assessments_subject_grade_student_completed_idx'), 'class comparison index must exist');
  assert.ok(migration.includes('on baseline_assessments(subject, grade, student_id, completed_at desc)'), 'class comparison index must match aggregate filters');
});
