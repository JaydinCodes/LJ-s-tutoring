const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = (filename) => fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'features', 'learning', filename),
  'utf8',
);

test('shared learning response inputs keep their labels associated with the rendered control', () => {
  const input = source('QuestionResponseInput.tsx');
  const activityRoute = source('StudentActivityRoute.tsx');
  const diagnosticRoute = source('StudentDiagnosticRoute.tsx');

  assert.match(input, /id="activity-answer"/);
  assert.match(activityRoute, /htmlFor="activity-answer"/);
  assert.match(diagnosticRoute, /htmlFor="activity-answer"/);
});
