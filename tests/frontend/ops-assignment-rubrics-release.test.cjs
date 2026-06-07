const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('OPS-06 schema adds rubrics and release-controlled submission fields', () => {
  const schema = read('docs/supabase/schema.sql');

  assert.match(schema, /rubric_json jsonb not null default '\[\]'::jsonb/);
  assert.match(schema, /rubric_scores_json jsonb not null default '\{\}'::jsonb/);
  assert.match(schema, /marks_released boolean not null default false/);
  assert.match(schema, /feedback_released boolean not null default false/);
  assert.match(schema, /assignments_rubric_json_array/);
  assert.match(schema, /assignment_submissions_rubric_scores_object/);
  assert.match(schema, /create or replace function public\.get_student_assignment_submissions/);
  assert.match(schema, /case when sub\.marks_released then sub\.marks_awarded else null end as marks_awarded/);
  assert.match(schema, /case when sub\.feedback_released then sub\.feedback else null end as feedback/);
});

test('OPS-06 frontend uses redacted student reads and RPC-backed release controls', () => {
  const studentRepo = read('src/features/students/studentDashboardRepository.ts');
  const mutations = read('src/features/assignments/assignmentMutations.ts');
  const tutorCard = read('src/features/tutors/TutorSubmissionReviewCard.tsx');
  const adminResults = read('src/features/admin/AdminResultsRoute.tsx');
  const adminAssignments = read('src/features/admin/AdminAssignmentsRoute.tsx');

  assert.match(studentRepo, /rpc\('get_student_assignment_submissions'\)/);
  assert.doesNotMatch(studentRepo, /from\('assignment_submissions'\)\.select\('\*'\)\.eq\('student_id'/);
  assert.match(mutations, /p_rubric_scores: parseJsonField\(input\.rubricScoresJson, \{\}, 'Rubric scores'\)/);
  assert.match(mutations, /p_marks_released: Boolean\(input\.marksReleased\)/);
  assert.match(mutations, /p_feedback_released: Boolean\(input\.feedbackReleased\)/);

  for (const source of [tutorCard, adminResults, adminAssignments]) {
    assert.match(source, /Release marks to learner/);
    assert.match(source, /Release feedback and rubric to learner/);
    assert.match(source, /Rubric scores JSON/);
  }

  assert.match(adminAssignments, /Rubric JSON/);
  assert.match(adminAssignments, /rubricJson/);
});
