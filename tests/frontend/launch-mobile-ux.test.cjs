const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('LAUNCH-03 non-student role dashboards have mobile navigation and overflow menu', () => {
  const shell = read('src/components/dashboard/DashboardShell.tsx');

  assert.match(shell, /function MobileRoleNavigation/);
  assert.match(shell, /lg:hidden/);
  assert.match(shell, /overflowItems/);
  assert.match(shell, /aria-expanded=\{open\}/);
  const styles = read('src/styles/tailwind.css');
  assert.match(styles, /mb-\[calc\(0\.75rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.doesNotMatch(styles, /academy-bottom-nav\s*\{\s*@apply fixed/);
  assert.match(shell, /gridTemplateColumns: `repeat\(\$\{visibleItems\.length \+ \(showMore \? 1 : 0\)\}, minmax\(0, 1fr\)\)`/);
  assert.match(shell, /Sign out/);
  assert.match(shell, /getSectionHome/);
});

test('LAUNCH-03 mobile cards and table rows reserve space and tap targets', () => {
  const shell = read('src/components/dashboard/DashboardShell.tsx');
  const styles = read('src/components/dashboard/dashboardStyles.ts');
  const dataTable = read('src/components/ui/DataTable.tsx');

  assert.match(shell, /h-dvh min-h-0/);
  assert.match(shell, /overflow-y-auto overscroll-contain/);
  assert.match(shell, /break-words font-display/);
  assert.match(shell, /hidden min-w-0 sm:block/);
  assert.match(styles, /p-4/);
  assert.match(styles, /sm:p-5/);
  assert.match(dataTable, /md:hidden/);
  assert.match(dataTable, /\[&_button\]:min-h-11/);
  assert.match(dataTable, /\[&_a\]:min-h-11/);
  assert.match(dataTable, /hidden overflow-x-auto md:block/);
});
