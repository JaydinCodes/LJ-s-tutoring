const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('student dashboard queries avoid unnecessary refetches', () => {
  const queries = read('src', 'features', 'students', 'studentQueries.ts');

  assert.ok(queries.includes('DEFAULT_STUDENT_STALE_TIME_MS = 60_000'), 'student queries must have an explicit freshness window');
  assert.ok(queries.includes('refetchOnWindowFocus: false'), 'dashboard queries must not refetch just because the window refocused');
  assert.ok(queries.includes('refetchOnReconnect: false'), 'dashboard queries must not refetch just because the network reconnected');
  assert.ok(queries.includes('exact: true'), 'assignment mutation invalidation must stay scoped to the affected dashboard key');
});

test('large result lists are bounded and dashboard visuals stay low-jank', () => {
  const academic = read('lms-api', 'src', 'routes', 'academic.ts');
  const motion = read('src', 'components', 'dashboard', 'DashboardDesignSystem.tsx');

  assert.match(academic, /order by completed_at desc\s+limit 24/, 'student result list API must remain bounded');
  assert.match(academic, /order by completed_at desc\s+limit 100/, 'results analytics API must bound large input sets');
  assert.ok(motion.includes('useReducedMotion'), 'animations must honor reduced-motion users');
  assert.ok(motion.includes('transformOrigin'), 'progress bars must animate via transform instead of layout width changes');
});

test('icons and Lighthouse tracking are covered by the performance budget', () => {
  const pkg = JSON.parse(read('package.json'));
  const shell = read('src', 'components', 'dashboard', 'DashboardShell.tsx');
  const script = read('scripts', 'check-frontend-performance-budget.cjs');
  const docs = read('docs', 'performance', 'frontend-dashboard-budget.md');

  assert.equal(pkg.scripts['perf:budget'], 'node scripts/check-frontend-performance-budget.cjs');
  assert.ok(shell.includes("from 'lucide-react'"), 'dashboard icons must use Lucide named imports');
  assert.ok(script.includes('react-app-dist/react-app.js'), 'budget checker must inspect the built JS bundle when present');
  assert.ok(script.includes('react-app-dist/react-app.css'), 'budget checker must inspect the built CSS bundle when present');
  assert.ok(docs.includes('Lighthouse before'), 'performance docs must track the before Lighthouse state');
  assert.ok(docs.includes('Lighthouse after'), 'performance docs must track the after Lighthouse state');
});
