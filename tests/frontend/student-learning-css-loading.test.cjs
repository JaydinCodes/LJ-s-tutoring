const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('library build defers student CSS and explicitly loads it before learning routes render', () => {
  const vite = read('vite.app.config.ts');
  const app = read('src/app/App.tsx');
  assert.match(vite, /cssCodeSplit:\s*true/);
  assert.match(app, /link\.href = '\/react-app-dist\/student-learning\.css'/);
  assert.match(app, /link\.rel = 'stylesheet'/);
  assert.match(app, /link\.onload = \(\) => resolve\(\)/);
  assert.match(app, /link\.onerror = \(\) =>/);
  assert.match(app, /Promise\.all\(\[ensureStudentLearningCss\(\), importer\(\)\]\)/);
  assert.match(app, /import\.meta\.env\.DEV/);
  const routeImports = app.match(/loadWithStudentLearningCss\(\(\) => import\('\.\.\/features\/learning\/[^']+'\)\)/g) || [];
  assert.equal(routeImports.length, 8, 'all eight lazy learning route components must load the stylesheet');
  for (const name of [
    'StudentLearningRoute',
    'StudentDiagnosticRoute',
    'StudentActivityRoute',
    'StudentLearningTopicRoute',
    'StudentLearningLessonRoute',
    'StudentLearningBridgeRoute',
    'StudentAssessmentRoutes',
  ]) {
    assert.ok(routeImports.some((code) => code.includes(name)), 'Missing learner CSS loading: ' + name);
  }
});

test('production export retains the copied CSS bundle and the deferred stylesheet budget', () => {
  const staticBuilder = read('scripts/build-static.js');
  const budget = read('scripts/check-frontend-performance-budget.cjs');
  assert.match(staticBuilder, /'react-app-dist'/);
  assert.match(budget, /student-learning\.css/);
  assert.match(budget, /deferred CSS/);
  assert.match(budget, /155_000/);
  assert.match(budget, /55_000/);
});

test('Whole Numbers Studio CSS is isolated from general learning routes and budgeted', () => {
  const route = read('src/features/learning/StudentLearningTopicRoute.tsx');
  const studio = read('src/features/learning/WholeNumbersStudio.tsx');
  const learnerCss = read('src/features/learning/student-learning.css');
  const studioCss = read('src/features/learning/whole-numbers-studio.css');
  const budget = read('scripts/check-frontend-performance-budget.cjs');
  assert.match(route, /lazy\(\(\) => import\('\.\/WholeNumbersStudio'\)/);
  assert.doesNotMatch(route, /from '\.\/WholeNumbersStudio'/);
  assert.match(studio, /import '\.\/whole-numbers-studio\.css'/);
  assert.match(studio, /link\.href = '\/react-app-dist\/whole-numbers-studio\.css'/);
  assert.match(studio, /link\.onerror = \(\) =>/);
  assert.doesNotMatch(learnerCss, /\.learning-studio\s*\{/);
  assert.match(studioCss, /\.learning-studio\s*\{/);
  assert.match(budget, /whole-numbers-studio\.css/);
  assert.match(budget, /deferred CSS/);
});
