const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('student dashboard performance indexes are present in the Supabase schema', () => {
  const docs = read('docs', 'performance', 'student-dashboard-indexes.md');
  const supabase = read('docs', 'supabase', 'schema.sql');

  assert.ok(supabase.includes('idx_submissions_student_assignment'), 'Supabase schema must document the submission lookup index');
  assert.ok(docs.includes('Supabase Query Plan Checks'), 'query plan checks must be documented');
});

test('student dashboard RLS protects learner-owned data', () => {
  const schema = read('docs', 'supabase', 'schema.sql');
  const docs = read('docs', 'security', 'student-rls-audit.md');

  for (const table of ['assignment_submissions', 'baseline_assessments', 'learning_goals', 'student_exam_events', 'sessions', 'student_notifications']) {
    assert.ok(schema.includes(`alter table public.${table} enable row level security`), `${table} must enable RLS`);
  }

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

  // Single-stack migration: dashboard/results repos are Supabase-first now; the
  // legacy /dashboard and /student/results APIs (and their response parsers) are retired.
  assert.ok(dashboardRepo.includes("supabase.from('students')"), 'dashboard repository is Supabase-first');
  assert.ok(resultsRepo.includes('buildFallbackFromDashboard'), 'results analytics derive from the Supabase-backed dashboard');
  assert.ok(careersRepo.includes('parseStudentCareersApiResponse'), 'careers repository must validate API response');
});
