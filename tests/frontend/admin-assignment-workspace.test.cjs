const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'src', 'features', 'admin', 'AdminAssignmentsRoute.tsx'),
  'utf8',
);

test('admin assignments separates library management from the learner submission queue', () => {
  for (const label of ['Assignment library', 'Search assignments', 'Lifecycle', 'Submission queue', 'Review state']) {
    assert.match(source, new RegExp(label), `${label} should be available in the admin workspace`);
  }

  assert.match(source, /filterAssignments\(data\?\.assignments \|\| \[\], assignmentStatus, assignmentSearch\)/);
  assert.match(source, /filterSubmissions\(data\?\.submissions \|\| \[\], submissionStatus, assignmentSearch\)/);
  assert.match(source, /No assignment selected/);
  assert.match(source, /No submission selected/);
});

test('admin assignment operational metrics distinguish publishing, review, and learner release', () => {
  for (const label of ['Assignments', 'Published', 'Needs review', 'Released']) {
    assert.match(source, new RegExp(`label: '${label}'`));
  }

  assert.match(source, /assignment\.status === 'published'/);
  assert.match(source, /submission\.status === 'submitted'/);
  assert.match(source, /submission\.marks_released \|\| submission\.feedback_released/);
});
