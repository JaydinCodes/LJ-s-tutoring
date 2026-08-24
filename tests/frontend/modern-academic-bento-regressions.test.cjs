const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('desktop role navigation is grouped and independently scrollable', () => {
  const shell = read('src', 'components', 'dashboard', 'DashboardShell.tsx');
  for (const group of ['Learners', 'Teaching', 'Finance', 'Governance', 'Reports']) {
    assert.ok(shell.includes(`label: '${group}'`), `${group} admin group must remain present`);
  }
  assert.match(shell, /h-screen min-h-0/);
  assert.match(shell, /min-h-0 flex-1 overflow-y-auto overscroll-contain/);
  assert.match(shell, /data-testid=\{`\$\{role\}-desktop-navigation`\}/);
});

test('all role shells use a five-destination mobile nav with an accessible More dialog', () => {
  const shell = read('src', 'components', 'dashboard', 'DashboardShell.tsx');
  assert.match(shell, /student: \['Today', 'Tasks', 'Results', 'Progress'\]/);
  assert.match(shell, /tutor: \['Today', 'Learners', 'Teach', 'Assess'\]/);
  assert.match(shell, /admin: \['Today', 'Learners & guardians', 'Learning quality', 'Finance'\]/);
  assert.match(shell, /aria-haspopup="dialog"/);
  assert.match(shell, /aria-expanded=\{open\}/);
  assert.match(shell, /useModalDialog\(\{ dialogRef, onClose: \(\) => setOpen\(false\), open \}\)/);
  assert.match(shell, /env\(safe-area-inset-bottom\)/);
});

test('saved theme is restored after refresh and Tailwind honours explicit theme classes', () => {
  const preferences = read('src', 'features', 'settings', 'portalPreferences.ts');
  const main = read('src', 'app', 'main.tsx');
  const tailwind = read('tailwind.config.js');
  assert.match(preferences, /readPreferences\(auth\.profile\?\.id\)\.theme/);
  assert.match(preferences, /applyTheme\(preference\)/);
  assert.match(main, /<PortalThemeRestorer \/>/);
  assert.match(tailwind, /darkMode: 'class'/);
});

test('dashboard primary actions remain identifiable and the shell prevents page overflow', () => {
  const shell = read('src', 'components', 'dashboard', 'DashboardShell.tsx');
  const student = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');
  const tutor = read('src', 'features', 'tutors', 'TutorDashboardRoute.tsx');
  assert.match(shell, /overflow-x-clip/);
  assert.match(shell, /min-w-0/);
  assert.match(student, /data-testid="student-primary-action"/);
  assert.match(tutor, /data-testid="tutor-primary-action"/);
  assert.match(student, /Continue learning/);
  assert.match(tutor, /Open learner brief/);
});

test('public tutor bios have an explicit touch and keyboard control', () => {
  const publicRoutes = read('src', 'app', 'routes', 'PublicRoutes.tsx');
  assert.match(publicRoutes, /aria-controls=\{bioId\}/);
  assert.match(publicRoutes, /aria-expanded=\{isBioVisible\}/);
  assert.match(publicRoutes, /Read tutor bio/);
  assert.match(publicRoutes, /group-focus-within:pointer-events-auto/);
});

test('route lazy loading uses the branded shell skeleton instead of raw loading copy', () => {
  const app = read('src', 'app', 'App.tsx');
  assert.doesNotMatch(app, />Loading page\.\.\.</);
  assert.match(app, /Preparing your Project Odysseus page/);
  assert.match(app, /aria-busy="true"/);
});
