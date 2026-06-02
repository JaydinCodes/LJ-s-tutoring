const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('student assignment detail route is registered for dashboard and short student URLs', () => {
  const app = read('src', 'app', 'App.tsx');

  assert.ok(app.includes("import { StudentAssignmentDetailRoute }"), 'detail route component must be imported');
  assert.ok(app.includes('path="/student/assignments/:assignmentId"'), 'requested /student/assignments/:assignmentId route must exist');
  assert.ok(app.includes('path="/dashboard/student/assignments/:assignmentId"'), 'dashboard assignment detail route must remain supported');
  assert.ok(app.includes('<StudentAssignmentDetailRoute />'), 'detail URLs must render the dedicated detail component');
});

test('assignment detail page shows instructions, due date, topic, status, feedback, and history', () => {
  const detail = read('src', 'features', 'students', 'StudentAssignmentDetailRoute.tsx');

  for (const label of ['Instructions', 'Due date', 'Topic', 'Status', 'Feedback', 'Submission History']) {
    assert.ok(detail.includes(label), `${label} must appear on the detail page`);
  }

  assert.ok(detail.includes('assignment.description'), 'instructions must come from the real assignment description');
  assert.ok(detail.includes('assignment.subject || assignment.subject_id'), 'topic must use real assignment subject data');
  assert.ok(detail.includes('formatDueDate(assignment.due_date, dueDelta)'), 'due date must be formatted from assignment data');
  assert.ok(detail.includes('submission?.feedback'), 'feedback must come from the learner submission');
  assert.ok(detail.includes('SubmissionHistory submission={submission} assignment={assignment}'), 'submission history must render from real submission data');
});

test('assignment upload workflow lives on detail page and disables closed or archived work', () => {
  const detail = read('src', 'features', 'students', 'StudentAssignmentDetailRoute.tsx');
  const list = read('src', 'features', 'students', 'StudentAssignmentsRoute.tsx');
  const cards = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');

  assert.ok(detail.includes('Upload Work'), 'detail page must own the upload section');
  assert.ok(detail.includes('<AssignmentUploadPanel assignment={assignment} submission={submission} disabled={uploadDisabled} />'), 'detail page must render upload controls');
  assert.ok(detail.includes("status === 'archived' || status === 'closed'"), 'archived and closed lifecycle statuses must disable upload');
  assert.ok(detail.includes("assignment.status === 'archived' || assignment.status === 'closed'"), 'raw archived and closed assignment statuses must disable upload');
  assert.ok(detail.includes('Back to assignment list'), 'student must be able to return to assignment list');
  assert.ok(!list.includes('AssignmentUploadPanel'), 'list route must not render upload controls');
  assert.ok(!cards.includes('<AssignmentUploadPanel assignment={assignment} submission={submission}'), 'list cards must not embed upload controls');
});
