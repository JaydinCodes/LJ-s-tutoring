const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('student dashboard replaces flat stats with actionable metric cards', () => {
  const source = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');
  const route = read('src', 'features', 'students', 'StudentDashboardRoute.tsx');

  for (const label of ['Next Due', 'Open Assignments', 'Average Score', 'Weakest Topic', 'Study Streak', 'Exam Readiness']) {
    assert.ok(source.includes(`label="${label}"`), `${label} card must be rendered`);
  }

  assert.ok(source.includes('function ActionMetricCard'), 'cards must use the actionable card component');
  assert.ok(source.includes('explanation:'), 'cards must carry explanations');
  assert.ok(source.includes('action:'), 'cards must carry action labels');
  assert.ok(route.includes('<ProgressSummaryCards data={data}'), 'dashboard route must pass full learner state into metric cards');
  assert.ok(!source.includes('label="Completion rate"'), 'old flat completion metric must be removed');
  assert.ok(!source.includes('label="Marked"'), 'old flat marked metric must be removed');
});

test('action metric cards link to the correct student pages', () => {
  const source = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');
  const app = read('src', 'app', 'App.tsx');
  const assignments = read('src', 'features', 'students', 'StudentAssignmentsRoute.tsx');

  assert.ok(source.includes('`/dashboard/student/assignments/${nextTask.assignmentId}`'), 'Next Due must link to assignment detail');
  assert.ok(source.includes("to=\"/dashboard/student/assignments\""), 'Open Assignments must link to assignments');
  assert.ok(source.includes("to=\"/dashboard/student/results\""), 'Average Score must link to results');
  assert.ok(source.includes("to=\"/dashboard/student/progress\""), 'Weakest Topic and study cards must link to progress');
  assert.ok(app.includes('path="/dashboard/student/assignments/:assignmentId"'), 'assignment detail route must exist');
  assert.ok(assignments.includes('useParams()'), 'assignments route must read the selected assignment id');
  assert.ok(source.includes('Selected assignment detail'), 'selected assignment must be visibly identified');
});

test('exam readiness is conditional on real exam data', () => {
  const source = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');

  assert.ok(source.includes('const nextExam = data.examCalendar?.nextExam'), 'cards must use real exam calendar data');
  assert.ok(source.includes('{nextExam ? ('), 'Exam Readiness must render only when exam data exists');
  assert.ok(source.includes('nextExam.subject'), 'Exam Readiness must reference the exam subject');
  assert.ok(source.includes('nextExam.title'), 'Exam Readiness must reference the exam title');
});
