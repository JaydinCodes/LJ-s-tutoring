const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('assignment status buckets use a Map and place each assignment in one tab bucket', () => {
  const source = read('src', 'features', 'students', 'studentData.ts');

  assert.ok(source.includes('assignmentBuckets: Map<string, AssignmentItem[]>'), 'normalized student data must expose assignment buckets');
  assert.ok(source.includes("export type AssignmentStatusBucket = 'due-now' | 'submitted' | 'marked' | 'archived'"));
  assert.ok(source.includes("assignmentStatusBucketOrder: AssignmentStatusBucket[] = ['due-now', 'submitted', 'marked', 'archived']"));
  assert.ok(source.includes('export function selectAssignmentStatusBuckets'), 'bucket selector must be reusable');
  assert.ok(source.includes('const buckets = new Map<string, AssignmentItem[]>()'), 'bucket storage must be a Map<string, AssignmentItem[]>');
  assert.ok(source.includes('const bucket = getAssignmentStatusBucket(status)'), 'each assignment must resolve to one status bucket');
  assert.ok(source.includes('buckets.set(bucket, [...(buckets.get(bucket) || []), assignment])'), 'assignment insertion must target only the resolved bucket');
  assert.ok(source.includes("status === 'marked'"), 'marked work must have a dedicated bucket');
  assert.ok(source.includes("status === 'submitted' || status === 'under_review' || status === 'late_submitted'"), 'submitted states must stay together');
});

test('assignments page renders status tabs instead of one long assignment list', () => {
  const route = read('src', 'features', 'students', 'StudentAssignmentsRoute.tsx');

  for (const label of ['Due Now', 'Submitted', 'Marked', 'Archived']) {
    assert.ok(route.includes(`label: '${label}'`), `${label} tab must be configured`);
  }

  assert.ok(route.includes('role="tablist"'), 'tabs must use tablist semantics');
  assert.ok(route.includes('role="tab"'), 'each bucket control must be a tab');
  assert.ok(route.includes('role="tabpanel"'), 'active bucket must render in a tab panel');
  assert.ok(route.includes('export function AssignmentSegmentedControl'), 'tabs must live in a reusable segmented control');
  assert.ok(route.includes('const count = buckets.get(tab.key)?.length || 0'), 'tab counts must come from normalized buckets');
  assert.ok(route.includes('studentData?.assignmentBuckets.get(activeBucket)'), 'active list must come from the selected bucket');
  assert.ok(route.includes('grid-cols-4'), 'segmented control must fit all statuses in one mobile-first control');
  assert.ok(!route.includes('SubmittedAssignmentsList'), 'submitted work should not be a separate long list below the tabs');
});

test('assignment tabs provide helpful empty states and preserve detail linking', () => {
  const route = read('src', 'features', 'students', 'StudentAssignmentsRoute.tsx');
  const cards = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');

  for (const emptyTitle of [
    'No assignments need action',
    'No submitted work waiting',
    'No marked assignments yet',
    'No archived assignments',
  ]) {
    assert.ok(route.includes(`emptyTitle: '${emptyTitle}'`), `${emptyTitle} empty state must be present`);
  }

  assert.ok(!route.includes('useParams()'), 'assignment list must not double as the detail route');
  assert.ok(route.includes('submission={studentData.submissionsByAssignmentId.get(assignment.id)}'), 'cards must still show real submission state');
  assert.ok(route.includes('export function AssignmentRow'), 'assignment list must render row-based assignment items');
  assert.ok(route.includes('export function AssignmentDetailDrawer'), 'desktop assignment preview drawer must be available');
  assert.ok(route.includes('to={`/student/assignments/${assignment.id}`'), 'assignment rows must link to the detail page');
  assert.ok(route.includes('Open assignment'), 'assignment drawer must expose a clear detail action');
  assert.ok(cards.includes('to={`/student/assignments/${assignment.id}`'), 'existing dashboard assignment card detail links must be preserved');
});
