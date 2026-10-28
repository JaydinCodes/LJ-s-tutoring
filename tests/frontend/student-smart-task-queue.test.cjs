const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('Smart Task Queue defines exclusive groups and deterministic priority ordering', () => {
  const source = read('src', 'features', 'students', 'studentData.ts');

  assert.ok(source.includes("export type SmartTaskQueueGroup = 'needs-attention' | 'upcoming' | 'waiting-feedback' | 'recently-marked'"));
  assert.ok(source.includes('const group = getSmartTaskQueueGroup(status)'), 'each assignment must resolve through one grouping function');
  assert.ok(source.includes('if (!group) continue'), 'archived and unsupported states must stay outside active groups');
  assert.ok(source.includes('groups.get(group)?.push({'), 'each assignment must be inserted into exactly one queue group');
  assert.ok(source.includes("if (status === 'returned_for_correction') return 0"), 'returned corrections must be highest priority');
  assert.ok(source.includes("if (status === 'missing') return 1"), 'overdue missing work must follow returned corrections');
  assert.ok(source.includes('left.priority - right.priority'), 'priority must be the first ordering key');
  assert.ok(source.includes('left.dueAt - right.dueAt'), 'due timestamp must break equal-priority ties');
});

test('submitted work is isolated from overdue learner-action groups', () => {
  const status = read('src', 'features', 'assignments', 'assignmentStatus.ts');
  const data = read('src', 'features', 'students', 'studentData.ts');

  assert.ok(status.includes("if (submissionStatus === 'submitted')"));
  assert.ok(status.includes("return isOverdue ? 'late_submitted' : 'under_review'"));
  assert.ok(data.includes("status === 'submitted' || status === 'under_review' || status === 'late_submitted'"));
  assert.ok(data.includes("return 'waiting-feedback'"), 'all submitted states must go to waiting for feedback');
  assert.ok(!data.includes("status === 'late_submitted') return 'needs-attention'"), 'late submitted work must never return to overdue action');
});

test('student assignments use the university-style column table with one detail route', () => {
  const route = read('src', 'features', 'students', 'StudentAssignmentsRoute.tsx');
  for (const label of ['Assignment Title', 'Status', 'Posted', 'Due Date', 'Submitted Date', 'Grade']) {
    assert.ok(route.includes(label), `Missing LMS table column: ${label}`);
  }
  assert.ok(route.includes('title="Assignments"'));
  assert.ok(route.includes('<table'));
  assert.ok(route.includes('type="search"'));
  assert.ok(route.includes('<select'));
  assert.ok(route.includes('aria-label="View assignments"'));
  assert.ok(route.includes('useSearchParams()'));
  assert.ok(route.includes('PAGE_SIZE = 10'), 'large histories should be paginated');
  assert.ok(route.includes('/dashboard/student/assignments/${assignment.id}'));
  assert.ok(!route.includes('QueueSummaryTabs'));
  assert.ok(!route.includes('NextUpPanel'));
  assert.ok(!route.includes('AssignmentDetailPanel'));
  assert.ok(!route.includes('StatusBadge'));
  assert.ok(!route.includes('<Card'));
});

test('list renders only authorized records and marks released by tutors', () => {
  const route = read('src', 'features', 'students', 'StudentAssignmentsRoute.tsx');
  assert.ok(route.includes('submission?.marks_released && submission.marks_awarded != null'));
  assert.ok(route.includes('assignment.status !== \'draft\''));
  assert.ok(route.includes("if (!value) return '—'"));
  assert.ok(route.includes('statusGroup'));
  assert.ok(route.includes('isVisible'));
  assert.ok(route.includes("return 'Returned'"));
});

test('unreleased marked records stay under review until release evidence exists', () => {
  const status = read('src', 'features', 'assignments', 'assignmentStatus.ts');

  assert.ok(status.includes('const hasReleasedResult = Boolean('));
  assert.ok(status.includes("return hasReleasedResult ? 'marked' : 'under_review'"));
  assert.ok(status.includes('submission.marks_released'));
  assert.ok(status.includes('submission.feedback_released'));
});
