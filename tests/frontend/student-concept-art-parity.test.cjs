const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('student dashboard uses the concept-art composition and decorative assets', () => {
  const route = read('src', 'features', 'students', 'StudentDashboardRoute.tsx');
  const components = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');
  const shell = read('src', 'components', 'dashboard', 'DashboardShell.tsx');
  const styles = read('src', 'styles', 'tailwind.css');

  assert.match(route, /xl:grid-cols-12/);
  assert.match(route, /xl:col-span-7/);
  assert.match(route, /student-session-voyage\.webp/);
  assert.match(route, /Assignments/);
  assert.match(route, /Your progress/);
  assert.match(route, /Recent feedback/);
  assert.match(components, /student-learning-plan-classical\.webp/);
  assert.match(components, /student-primary-action/);
  assert.match(route, /identity=\{data \? \{ name: data\.profile\.name, meta: data\.profile\.grade/);
  assert.match(route, /Suggested practice/);
  assert.match(shell, /Open student settings/);
  assert.match(shell, /isActive && role === 'student'/);
  assert.match(styles, /\.student-parchment-bg/);
});

test('generated dashboard motifs stay lightweight enough for first-view use', () => {
  for (const filename of ['student-learning-plan-classical.webp', 'student-session-voyage.webp']) {
    const asset = path.join(root, 'images', 'dashboard', filename);
    assert.ok(fs.existsSync(asset), `${filename} must exist`);
    assert.ok(fs.statSync(asset).size < 100 * 1024, `${filename} must remain below 100 KiB`);
  }
});
