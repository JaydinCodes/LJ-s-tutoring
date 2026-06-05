const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('student dashboard performance migration adds only non-duplicate supporting indexes', () => {
  const migration = read('lms-api', 'prisma', 'migrations', '20260603_student_dashboard_performance_indexes', 'migration.sql');
  const oldTutorPortal = read('lms-api', 'prisma', 'migrations', '20260518_tutor_portal', 'migration.sql');
  const oldResults = read('lms-api', 'prisma', 'migrations', '20260518_student_dashboard', 'migration.sql');
  const docs = read('docs', 'performance', 'student-dashboard-indexes.md');
  const supabase = read('docs', 'supabase', 'schema.sql');

  assert.ok(oldTutorPortal.includes('learning_assignments_student_idx'), 'assignment due index already exists and must be reused');
  assert.ok(oldResults.includes('baseline_assessments_student_idx'), 'result marked index already exists and must be reused');
  assert.ok(migration.includes('assignment_submissions_student_assignment_idx'), 'missing student submission lookup index must be added');
  assert.ok(migration.includes('sessions_student_date_start_idx'), 'student attendance session index must be added');
  assert.ok(migration.includes('student_notifications_student_unread_idx'), 'notification index must be added');
  assert.ok(supabase.includes('idx_submissions_student_assignment'), 'Supabase schema must document the submission lookup index');
  assert.ok(!migration.includes('idx_assignments_student_due'), 'do not add duplicate placeholder assignment index');
  assert.ok(!migration.includes('idx_results_student_marked'), 'do not add duplicate placeholder results index');
  assert.ok(docs.includes('Supabase Query Plan Checks'), 'query plan checks must be documented');
  assert.ok(docs.includes('db.query.slow'), 'slow query logging must be documented');
});

test('student dashboard RLS audit protects learner-owned data and class stats', () => {
  const migration = read('lms-api', 'prisma', 'migrations', '20260603_student_dashboard_rls_audit', 'migration.sql');
  const resultsPrivacy = read('lms-api', 'prisma', 'migrations', '20260529_student_results_privacy_analytics', 'migration.sql');
  const docs = read('docs', 'security', 'student-rls-audit.md');

  for (const table of ['learning_assignments', 'assignment_submissions', 'learning_goals', 'student_exam_events', 'sessions', 'student_notifications']) {
    assert.ok(migration.includes(`alter table ${table} enable row level security`), `${table} must enable RLS`);
  }

  assert.ok(migration.includes('assignment_submissions_student_own_insert'), 'students can insert only own submissions');
  assert.ok(!migration.includes('assignment_submissions_student_own_update'), 'students must not update marks, feedback, or review fields');
  assert.ok(resultsPrivacy.includes('having count(distinct b.student_id) >= 3'), 'anonymous class stats must require minimum group size');
  assert.ok(docs.includes('Students cannot edit marks or feedback'), 'RLS audit must document mark/feedback protection');
  assert.ok(docs.includes('public.can_mark_submission'), 'Supabase-first staff marking access must remain documented');
});

test('student API contracts validate dashboard, results, mastery, quizzes, careers, and daily insight', () => {
  const contracts = read('src', 'types', 'studentApiContracts.ts');
  const dashboardRepo = read('src', 'features', 'students', 'studentDashboardRepository.ts');
  const resultsRepo = read('src', 'features', 'students', 'studentResultsRepository.ts');
  const careersRepo = read('src', 'features', 'students', 'studentCareersRepository.ts');

  for (const symbol of [
    'StudentAssignmentsApiResponse',
    'StudentResultsApiResponse',
    'StudentMasteryApiItem',
    'StudentQuizApiItem',
    'CareerOverview',
    'dailyInsightContext',
    'parseStudentDashboardApiResponse',
    'parseStudentAssignmentsApiResponse',
    'parseStudentResultsApiResponse',
    'parseStudentCareersApiResponse',
    'parseStudentMasteryItems',
    'parseStudentQuizItems',
  ]) {
    assert.ok(contracts.includes(symbol), `${symbol} must be part of the shared student contract layer`);
  }

  assert.ok(dashboardRepo.includes('parseStudentDashboardApiResponse'), 'dashboard repository must validate API response');
  assert.ok(resultsRepo.includes('parseStudentResultsApiResponse'), 'results repository must validate API response');
  assert.ok(careersRepo.includes('parseStudentCareersApiResponse'), 'careers repository must validate API response');
});
