const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('NGO reports use the approved cohort aggregate RPC and never query protected learner tables', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'features', 'ngo', 'ngoReportsRepository.ts'), 'utf8');
  assert.match(source, /rpc\('get_org_cohort_report'/);
  for (const table of ['students', 'assignment_submissions', 'assignments', 'classes', 'class_enrollments', 'student_progress', 'ngo_partners']) {
    assert.doesNotMatch(source, new RegExp(`from\('${table}'\)`), `${table} must not be queried by an NGO browser session`);
  }
});
