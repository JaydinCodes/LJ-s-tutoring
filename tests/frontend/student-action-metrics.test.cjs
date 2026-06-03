const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('student dashboard replaces flat stats with a focused today flow', () => {
  const source = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');
  const route = read('src', 'features', 'students', 'StudentDashboardRoute.tsx');

  for (const component of ['TodayOdyssey', 'LearningTimeline', 'SubjectProgressBands']) {
    assert.ok(source.includes(`export function ${component}`), `${component} must be exported`);
    assert.ok(route.includes(`<${component}`), `${component} must be rendered by the dashboard route`);
  }

  assert.ok(source.includes("Today's Odyssey") || source.includes('Today&apos;s Odyssey'), 'dashboard must lead with the Today Odyssey surface');
  assert.ok(source.includes('What should I do today?'), 'dashboard must frame the main learner question');
  assert.ok(source.includes('Progress by subject'), 'dashboard must render subject progress bands');
  assert.ok(route.includes('battlePlan={battlePlan}'), 'dashboard route must pass learner state into Today Odyssey');
  assert.ok(!source.includes('label="Completion rate"'), 'old flat completion metric must be removed');
  assert.ok(!source.includes('label="Marked"'), 'old flat marked metric must be removed');
});

test('action metric cards link to the correct student pages', () => {
  const source = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');
  const app = read('src', 'app', 'App.tsx');
  const detail = read('src', 'features', 'students', 'StudentAssignmentDetailRoute.tsx');

  assert.ok(source.includes('`/dashboard/student/assignments/${nextTask.assignmentId}`'), 'Next Due must link to assignment detail');
  assert.ok(source.includes("to=\"/dashboard/student/assignments\""), 'Open Assignments must link to assignments');
  assert.ok(source.includes("to=\"/dashboard/student/results\""), 'Average Score must link to results');
  assert.ok(source.includes("to=\"/dashboard/student/progress\""), 'Weakest Topic and study cards must link to progress');
  assert.ok(app.includes('path="/dashboard/student/assignments/:assignmentId"'), 'assignment detail route must exist');
  assert.ok(detail.includes('useParams()'), 'assignment detail route must read the selected assignment id');
  assert.ok(detail.includes('Back to assignment list'), 'detail route must let students return to the list');
});

test('exam readiness is conditional on real exam data', () => {
  const source = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');

  assert.ok(source.includes('const nextExam = data.examCalendar?.nextExam'), 'cards must use real exam calendar data');
  assert.ok(source.includes('{nextExam ? ('), 'Exam Readiness must render only when exam data exists');
  assert.ok(source.includes('nextExam.subject'), 'Exam Readiness must reference the exam subject');
  assert.ok(source.includes('nextExam.title'), 'Exam Readiness must reference the exam title');
});
