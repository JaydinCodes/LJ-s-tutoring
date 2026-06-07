const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('LAUNCH-04 shared state components and app error boundary exist', () => {
  const state = read('src/components/ui/State.tsx');
  const boundary = read('src/components/ui/ErrorBoundary.tsx');
  const main = read('src/app/main.tsx');

  for (const component of ['LoadingState', 'ErrorState', 'PermissionDeniedState', 'MissingProfileState', 'RetryButton', 'InlineFeedback']) {
    assert.match(state, new RegExp(`function ${component}`), `${component} must be available as a shared state component`);
  }

  assert.match(boundary, /componentDidCatch/);
  assert.match(boundary, /Portal screen unavailable/);
  assert.match(main, /<ErrorBoundary>/, 'React root must be wrapped in the app-level error boundary');
});

test('LAUNCH-04 async errors are normalized and technical details are logged', () => {
  const errors = read('src/lib/utils/errors.ts');
  const asyncHook = read('src/hooks/useAsyncResource.ts');

  assert.match(errors, /toUserFacingError/);
  assert.match(errors, /violates row-level security/);
  assert.match(errors, /Your session has expired/);
  assert.match(errors, /could not reach the server/);
  assert.match(asyncHook, /logTechnicalError\('Async resource failed', err\)/);
  assert.match(asyncHook, /setError\(toUserFacingError\(err\)\)/);
});

test('LAUNCH-04 protected and major role routes use shared launch states', () => {
  const protectedRoute = read('src/features/auth/ProtectedRoute.tsx');
  const adminDashboard = read('src/features/admin/AdminDashboardRoute.tsx');
  const adminAssignments = read('src/features/admin/AdminAssignmentsRoute.tsx');
  const adminResults = read('src/features/admin/AdminResultsRoute.tsx');
  const tutorSubmissions = read('src/features/tutors/TutorSubmissionsRoute.tsx');
  const parentReports = read('src/features/parents/ParentReportsRoute.tsx');
  const ngoReports = read('src/features/ngo/NgoReportsRoute.tsx');
  const studentDashboardComponents = read('src/features/students/StudentDashboardComponents.tsx');

  assert.match(protectedRoute, /MissingProfileState/);
  assert.match(protectedRoute, /PermissionDeniedState/);
  assert.match(protectedRoute, /LoadingState/);

  for (const source of [adminDashboard, adminAssignments, adminResults, tutorSubmissions, parentReports, ngoReports]) {
    assert.match(source, /LoadingState/, 'route must use shared loading state');
    assert.match(source, /ErrorState/, 'route must use shared error state');
  }

  assert.match(adminAssignments, /No submissions yet/);
  assert.match(adminResults, /Marking or result release failed/);
  assert.match(tutorSubmissions, /No submissions yet/);
  assert.match(parentReports, /No reports available/);
  assert.match(ngoReports, /No cohort reports available/);
  assert.match(studentDashboardComponents, /Upload failed/);
});
