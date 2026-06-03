const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('dashboard uses one Lucide icon system across navigation and student cards', () => {
  const shell = read('src', 'components', 'dashboard', 'DashboardShell.tsx');
  const design = read('src', 'components', 'dashboard', 'DashboardDesignSystem.tsx');
  const studentCards = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');
  const results = read('src', 'features', 'students', 'StudentResultsRoute.tsx');
  const careers = read('src', 'features', 'students', 'StudentCareersRoute.tsx');
  const joined = [shell, design, studentCards, results, careers].join('\n');

  for (const icon of ['LayoutDashboard', 'ScrollText', 'Trophy', 'TrendingUp', 'Compass', 'BookOpen', 'UploadCloud', 'Sparkles', 'Clock', 'Target', 'Brain', 'GraduationCap']) {
    assert.ok(joined.includes(icon), `${icon} must be used from the Lucide set`);
  }

  assert.ok(shell.includes('type DashboardNavItem'), 'navigation items must type their icon contract');
  assert.ok(shell.includes('icon: LucideIcon'), 'navigation icons must share the Lucide type');
  assert.ok(shell.includes('const Icon = item.icon'), 'desktop and mobile nav must render configured icons');
  assert.ok(design.includes('icon?: LucideIcon'), 'MetricCard and EmptyState must accept Lucide icons');
  assert.ok(design.includes('text-current'), 'icons must inherit the current themed text color');
  assert.ok(studentCards.includes('icon={Clock}'), 'Next Due must use the shared icon system');
  assert.ok(results.includes('icon={Trophy}'), 'result metric cards must use icons');
  assert.ok(careers.includes('icon={Compass}'), 'career metric cards must use icons');
});

test('mobile dashboard layout keeps bottom navigation and tables usable', () => {
  const shell = read('src', 'components', 'dashboard', 'DashboardShell.tsx');
  const table = read('src', 'components', 'ui', 'DataTable.tsx');

  assert.ok(shell.includes('pb-[calc(6.5rem+env(safe-area-inset-bottom))]'), 'main content must reserve space for phone bottom nav');
  assert.ok(shell.includes('bottom-[calc(0.75rem+env(safe-area-inset-bottom))]'), 'bottom nav must respect iOS safe area');
  assert.ok(shell.includes('lg:hidden'), 'mobile nav must hide on desktop breakpoints');
  assert.ok(shell.includes('mx-auto mb-1 h-4 w-4'), 'mobile nav must show icons above labels');
  assert.ok(table.includes('md:hidden'), 'tables must render card rows on small screens');
  assert.ok(table.includes('hidden overflow-x-auto md:block'), 'full tables must only render from medium screens up');
});

test('student empty states are premium, differentiated, and action-oriented', () => {
  const design = read('src', 'components', 'dashboard', 'DashboardDesignSystem.tsx');
  const assignments = read('src', 'features', 'students', 'StudentAssignmentsRoute.tsx');
  const dashboard = read('src', 'features', 'students', 'StudentDashboardRoute.tsx');
  const progress = read('src', 'features', 'students', 'StudentProgressRoute.tsx');
  const results = read('src', 'features', 'students', 'StudentResultsRoute.tsx');
  const careers = read('src', 'features', 'students', 'StudentCareersRoute.tsx');
  const studentCards = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');
  const joined = [assignments, dashboard, progress, results, careers, studentCards].join('\n');

  assert.ok(design.includes('actionLabel?: string'), 'EmptyState must support a next-action label');
  assert.ok(design.includes('actionHref?: string'), 'EmptyState must support a next-action route');
  assert.ok(design.includes('border-dashed border-brand-aegean'), 'EmptyState must keep the Greek dashboard theme');

  for (const title of ['No assignments need action', 'No released marks yet', 'No topic mastery yet', 'No quiz recommendation yet', 'No matching careers yet']) {
    assert.ok(joined.includes(title), `${title} empty state must be present`);
  }

  assert.ok(joined.includes('actionLabel='), 'student empty states must suggest useful next actions');
  assert.ok(joined.includes('actionHref="/dashboard/student/progress"'), 'empty states must route learners toward progress when useful');
  assert.ok(joined.includes('actionHref="/dashboard/student/assignments"'), 'empty states must route learners toward assignments when useful');
});
