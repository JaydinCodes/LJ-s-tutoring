const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(...parts) {
  return fs.readFileSync(path.resolve(__dirname, '..', '..', ...parts), 'utf8');
}

test('LAUNCH-06 Sentry monitoring is env-gated and privacy-safe', () => {
  const pkg = read('package.json');
  const monitoring = read('src', 'lib', 'monitoring', 'errorReporting.ts');
  const main = read('src', 'app', 'main.tsx');
  const env = read('.env.example');
  const docs = read('docs', 'ops', 'PRODUCTION_MONITORING_CHECKLIST.md');

  assert.match(pkg, /"@sentry\/react"/);
  assert.match(monitoring, /Sentry\.init/);
  assert.match(monitoring, /VITE_SENTRY_DSN/);
  assert.match(monitoring, /sendDefaultPii: false/);
  assert.match(monitoring, /beforeSend/);
  assert.match(monitoring, /sensitiveKeyPattern/);
  assert.match(monitoring, /setMonitoringUserContext/);
  assert.match(main, /initErrorReporting\(\)/);
  assert.match(env, /VITE_SENTRY_ENABLED=false/);
  assert.match(env, /VITE_SENTRY_DSN=/);
  assert.match(env, /VITE_SENTRY_RELEASE=/);
  assert.match(docs, /Never add uploaded file contents/);
});

test('LAUNCH-06 app crashes and auth anomalies are captured', () => {
  const boundary = read('src', 'components', 'ui', 'ErrorBoundary.tsx');
  const authProvider = read('src', 'features', 'auth', 'AuthProvider.tsx');
  const protectedRoute = read('src', 'features', 'auth', 'ProtectedRoute.tsx');
  const authService = read('src', 'features', 'auth', 'authService.ts');

  assert.match(boundary, /captureAppError\(error/);
  assert.match(boundary, /render_error/);
  assert.match(authProvider, /setMonitoringUserContext/);
  assert.match(authProvider, /auth\.missing_profile/);
  assert.match(protectedRoute, /auth\.unauthorized_route/);
  assert.match(authService, /auth\.password_sign_in_failed/);
  assert.match(authService, /auth\.profile_load_failed/);
  assert.match(authService, /auth\.admin_mfa_/);
});

test('LAUNCH-06 critical workflow failures are captured', () => {
  const assignmentMutations = read('src', 'features', 'assignments', 'assignmentMutations.ts');
  const studentComponents = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');
  const tutorReview = read('src', 'features', 'tutors', 'TutorSubmissionReviewCard.tsx');
  const adminResults = read('src', 'features', 'admin', 'AdminResultsRoute.tsx');
  const adminAssignments = read('src', 'features', 'admin', 'AdminAssignmentsRoute.tsx');
  const parentReports = read('src', 'features', 'parents', 'parentReportsRepository.ts');
  const ngoReports = read('src', 'features', 'ngo', 'ngoReportsRepository.ts');

  assert.match(assignmentMutations, /assignment_submission\.upload_failed/);
  assert.match(assignmentMutations, /assignment_submission\.rpc_failed/);
  assert.match(assignmentMutations, /submission_marking\.rpc_failed/);
  assert.match(studentComponents, /assignment_upload\.submit_failed/);
  assert.match(tutorReview, /submission_review\.save_failed/);
  assert.match(adminResults, /admin_result_release\.save_failed/);
  assert.match(adminAssignments, /admin_assignment\.create_failed/);
  assert.match(adminAssignments, /admin_submission_review\.save_failed/);
  assert.match(parentReports, /parent_reports\.rpc_failed/);
  assert.match(ngoReports, /ngo_reports\.load_failed/);
});
