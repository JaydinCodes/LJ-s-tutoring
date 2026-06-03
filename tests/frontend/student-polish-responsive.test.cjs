const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('student portal polish removes broken glyphs from redesigned routes', () => {
  const files = [
    ['src', 'features', 'students', 'StudentDashboardRoute.tsx'],
    ['src', 'features', 'students', 'StudentAssignmentsRoute.tsx'],
    ['src', 'features', 'students', 'StudentResultsRoute.tsx'],
    ['src', 'features', 'students', 'StudentProgressRoute.tsx'],
    ['src', 'features', 'students', 'StudentCareersRoute.tsx'],
    ['src', 'features', 'students', 'StudentSupportRoutes.tsx'],
  ];

  for (const file of files) {
    const source = read(...file);
    assert.equal(/[ÂÃ�]/.test(source), false, `${file.join('/')} must not include mojibake glyphs`);
    assert.equal(source.includes('â€¢'), false, `${file.join('/')} must not include broken bullet separators`);
  }
});

test('student app header allows long page titles to wrap on phone screens', () => {
  const shell = read('src', 'components', 'dashboard', 'DashboardShell.tsx');

  assert.ok(shell.includes('leading-tight'), 'student top heading should keep wrapped titles compact');
  assert.equal(shell.includes('mt-1 truncate text-2xl'), false, 'student top heading must not clip long titles');
});

test('career Odie surfaces expose dialog semantics only on the careers route', () => {
  const careers = read('src', 'features', 'students', 'StudentCareersRoute.tsx');
  const dashboard = read('src', 'features', 'students', 'StudentDashboardRoute.tsx');

  assert.ok(careers.includes('role="dialog"'), 'Odie sheet and drawer must expose dialog semantics');
  assert.ok(careers.includes('aria-hidden={!props.open}'), 'closed Odie surfaces must be hidden from assistive tech');
  assert.ok(careers.includes('aria-label="Odie career assistant"'), 'Odie dialog must have an accessible label');
  assert.equal(dashboard.includes('Odie career assistant'), false, 'Odie accessibility surface must stay out of the normal dashboard');
});
