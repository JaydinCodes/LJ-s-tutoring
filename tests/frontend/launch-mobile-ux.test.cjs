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

  assert.match(shell, /function MobileRoleNav/);
  assert.match(shell, /lg:hidden/);
  assert.match(shell, /overflowItems/);
  assert.match(shell, /aria-expanded=\{open\}/);
  assert.match(shell, /bottom-\[calc\(0\.75rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(shell, /gridTemplateColumns: `repeat\(\$\{visibleCount\}, minmax\(0, 1fr\)\)`/);
  assert.match(shell, /Sign out/);
  assert.match(shell, /getSectionHome/);
});

test('LAUNCH-03 mobile cards and table rows reserve space and tap targets', () => {
  const shell = read('src/components/dashboard/DashboardShell.tsx');
  const styles = read('src/components/dashboard/dashboardStyles.ts');
  const dataTable = read('src/components/ui/DataTable.tsx');

  assert.match(shell, /pb-\[calc\(6\.5rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(shell, /break-words text-2xl/);
  assert.match(shell, /hidden min-w-0 sm:block/);
  assert.match(styles, /p-4/);
  assert.match(styles, /sm:p-5/);
  assert.match(dataTable, /md:hidden/);
  assert.match(dataTable, /\[&_button\]:min-h-10/);
  assert.match(dataTable, /\[&_a\]:min-h-10/);
  assert.match(dataTable, /hidden overflow-x-auto md:block/);
});
