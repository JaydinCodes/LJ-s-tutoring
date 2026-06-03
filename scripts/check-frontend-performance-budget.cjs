const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertSizeIfBuilt(relativePath, maxBytes) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    console.log(`[perf-budget] skipped size check for missing ${relativePath}`);
    return;
  }
  const size = fs.statSync(filePath).size;
  assert(size <= maxBytes, `${relativePath} is ${size} bytes, above budget ${maxBytes}`);
  console.log(`[perf-budget] ${relativePath}: ${size}/${maxBytes} bytes`);
}

const queries = read('src', 'features', 'students', 'studentQueries.ts');
const academicApi = read('lms-api', 'src', 'routes', 'academic.ts');
const shell = read('src', 'components', 'dashboard', 'DashboardShell.tsx');
const motion = read('src', 'components', 'dashboard', 'DashboardDesignSystem.tsx');
const docs = read('docs', 'performance', 'frontend-dashboard-budget.md');

assert(queries.includes('DEFAULT_STUDENT_STALE_TIME_MS = 60_000'), 'student queries must define a dashboard stale-time budget');
assert(queries.includes('refetchOnWindowFocus: false'), 'student queries must avoid focus-triggered dashboard refetches');
assert(queries.includes('refetchOnReconnect: false'), 'student queries must avoid reconnect-triggered dashboard refetches');
assert(queries.includes('exact: true'), 'assignment mutations must invalidate only the affected dashboard query');
assert(/order by completed_at desc\s+limit 24/.test(academicApi), 'student result lists must be bounded for large result sets');
assert(/order by completed_at desc\s+limit 100/.test(academicApi), 'results analytics must bound its input set');
assert(shell.includes("from 'lucide-react'"), 'dashboard icons must stay tree-shakable through Lucide imports');
assert(motion.includes('useReducedMotion'), 'route/card motion must honor reduced-motion preferences');
assert(motion.includes('transformOrigin'), 'progress animation must use transform-based tracks');
assert(docs.includes('Lighthouse before'), 'Lighthouse before score must be tracked in docs');
assert(docs.includes('Lighthouse after'), 'Lighthouse after score must be tracked in docs');

assertSizeIfBuilt('react-app-dist/react-app.js', 1_500_000);
assertSizeIfBuilt('react-app-dist/react-app.css', 90_000);

console.log('[perf-budget] frontend performance budget checks passed');
