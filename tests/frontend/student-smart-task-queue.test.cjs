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

test('Smart Task Queue uses accessible filters and omits empty desktop detail panes', () => {
  const route = read('src', 'features', 'students', 'StudentAssignmentsRoute.tsx');

  assert.ok(route.includes('title="Tasks"'));
  assert.ok(route.includes('subtitle="Know what to do next."'));
  assert.ok(!route.includes('Assignment desk'));
  assert.ok(!route.includes('Work sorted by status'));
  assert.ok(route.includes('role="tablist"'));
  assert.ok(route.includes('role="tab"'));
  assert.ok(route.includes('aria-selected={selected}'));
  assert.ok(route.includes("aria-pressed={activeFilter === 'archived'}"));
  assert.ok(route.includes('{selectedAssignment ? ('), 'detail panel must render only when a real selected assignment exists');
  assert.ok(!route.includes('Select an assignment'), 'empty detail placeholder must be removed');
  assert.ok(route.includes('useSearchParams()'), 'desktop selection must support URL deep linking and browser history');
});

test('Smart Task Queue never invents concept-only fields or exposes internal identifiers', () => {
  const route = read('src', 'features', 'students', 'StudentAssignmentsRoute.tsx');

  assert.ok(!route.includes('estimatedMinutes'));
  assert.ok(!route.includes('subject_id ||'), 'subject UUIDs must never be used as display fallbacks');
  assert.ok(route.includes("assignment.subject?.trim() || 'Subject not listed'"));
  assert.ok(route.includes("if (!value) return 'No due date'"), 'null due dates need an explicit stable label');
  assert.ok(route.includes('PDF, JPG, PNG, or written response'), 'accepted formats must match the existing upload validation');
  assert.ok(route.includes('Maximum file size: 5 MiB.'), 'detail preview must match the enforced upload size');
});

test('unreleased marked records stay under review until release evidence exists', () => {
  const status = read('src', 'features', 'assignments', 'assignmentStatus.ts');

  assert.ok(status.includes('const hasReleasedResult = Boolean('));
  assert.ok(status.includes("return hasReleasedResult ? 'marked' : 'under_review'"));
  assert.ok(status.includes('submission.marks_released'));
  assert.ok(status.includes('submission.feedback_released'));
});
