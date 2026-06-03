const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('student routes use cached TanStack Query hooks', () => {
  const routes = {
    StudentDashboardRoute: 'useStudentDashboardQuery',
    StudentAssignmentsRoute: 'useStudentDashboardQuery',
    StudentProgressRoute: 'useStudentDashboardQuery',
    StudentResultsRoute: 'useStudentResultsQuery',
    StudentCareersRoute: 'useStudentCareersQuery',
  };

  for (const [route, hook] of Object.entries(routes)) {
    const source = read('src', 'features', 'students', `${route}.tsx`);
    assert.ok(source.includes(hook), `${route} must use ${hook}`);
    assert.ok(!source.includes('useAsyncResource'), `${route} must not use useAsyncResource`);
  }
});

test('student queries use scoped keys and assignment mutation invalidates only dashboard data', () => {
  const main = read('src', 'app', 'main.tsx');
  const client = read('src', 'lib', 'query', 'client.ts');
  const queries = read('src', 'features', 'students', 'studentQueries.ts');

  assert.ok(main.includes('QueryClientProvider'), 'React root must install QueryClientProvider');
  assert.ok(client.includes('retry: 2'), 'student reads must preserve automatic retries');
  assert.ok(queries.includes("dashboard: (studentScope: string)"), 'dashboard key must be learner scoped');
  assert.ok(queries.includes("results: (studentScope: string)"), 'results key must be learner scoped');
  assert.ok(queries.includes("careers: (studentScope: string)"), 'careers key must be learner scoped');
  assert.ok(queries.includes('invalidateQueries({'), 'assignment submission must invalidate cached data');
  assert.ok(queries.includes('queryKey: studentQueryKeys.dashboard(studentScope)'), 'assignment submission must invalidate only dashboard data');
  assert.ok(queries.includes('exact: true'), 'assignment submission invalidation must use an exact query key');
  assert.ok(!queries.includes('queryClient.clear('), 'student mutation must not clear the whole cache');
});
