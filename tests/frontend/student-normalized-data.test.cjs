const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('student normalized layer defines indexed records, submitted IDs, topic mastery, and due task queue', () => {
  const source = read('src', 'features', 'students', 'studentData.ts');

  assert.ok(source.includes('assignmentsById: Map<string, AssignmentItem>'));
  assert.ok(source.includes('resultsById: Map<string, ResultsItem>'));
  assert.ok(source.includes('submittedAssignmentIds: Set<string>'));
  assert.ok(source.includes('topicMasteryByKey: Map<string, TopicMastery>'));
  assert.ok(source.includes('dueTasks: PriorityQueue<StudentTask>'));
  assert.ok(source.includes('assignmentsById.set(assignment.id, assignment)'));
  assert.ok(source.includes('submittedAssignmentIds.add(submission.assignment_id)'));
});

test('student UI consumes pure normalized selectors instead of rebuilding route-local indexes', () => {
  const dataLayer = read('src', 'features', 'students', 'studentData.ts');
  const dashboard = read('src', 'features', 'students', 'StudentDashboardRoute.tsx');
  const assignments = read('src', 'features', 'students', 'StudentAssignmentsRoute.tsx');
  const results = read('src', 'features', 'students', 'StudentResultsRoute.tsx');

  for (const selector of ['normalizeStudentData', 'selectDueTaskQueue', 'selectDueTasks', 'selectCompletionRate', 'normalizeStudentResults', 'selectResults']) {
    assert.ok(dataLayer.includes(`export function ${selector}`), `${selector} must be exported as a pure selector`);
  }

  assert.ok(dashboard.includes('normalizeStudentData(data)'));
  assert.ok(dashboard.includes('selectDueTasks(studentData, 1)'));
  assert.ok(assignments.includes('normalizeStudentData(data)'));
  assert.ok(results.includes('releasedResults(data?.items || [])'));
  assert.ok(results.includes('groupBySubject(items)'));
  assert.ok(!dashboard.includes('new Map('), 'dashboard route must not rebuild indexes');
  assert.ok(!dashboard.includes('new Set('), 'dashboard route must not rebuild submitted ID sets');
  assert.ok(!assignments.includes('new Map('), 'assignments route must not rebuild indexes');
});
