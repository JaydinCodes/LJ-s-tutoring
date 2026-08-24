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
  const pathway = read('src', 'features', 'students', 'StudentPathwayBuilderComponents.tsx');
  const joined = [shell, design, studentCards, results, careers, pathway].join('\n');

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
  assert.ok(pathway.includes('icon={Route}'), 'career selection states must use the shared icon system');
});

test('mobile dashboard layout keeps bottom navigation and tables usable', () => {
  const shell = read('src', 'components', 'dashboard', 'DashboardShell.tsx');
  const styles = read('src', 'styles', 'tailwind.css');
  const table = read('src', 'components', 'ui', 'DataTable.tsx');

  assert.ok(shell.includes('pb-[calc(6.75rem+env(safe-area-inset-bottom))]'), 'main content must reserve space for phone bottom nav');
  assert.ok(styles.includes('bottom-[calc(0.75rem+env(safe-area-inset-bottom))]'), 'bottom nav must respect iOS safe area');
  assert.ok(shell.includes('lg:hidden'), 'mobile nav must hide on desktop breakpoints');
  assert.ok(shell.includes('mx-auto mb-1 h-[1.15rem] w-[1.15rem]'), 'mobile nav must show icons above labels');
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
  const pathway = read('src', 'features', 'students', 'StudentPathwayBuilderComponents.tsx');
  const studentCards = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');
  const joined = [assignments, dashboard, progress, results, careers, pathway, studentCards].join('\n');

  assert.ok(design.includes('actionLabel?: string'), 'EmptyState must support a next-action label');
  assert.ok(design.includes('actionHref?: string'), 'EmptyState must support a next-action route');
  assert.ok(design.includes('border-slate-200'), 'EmptyState must use the shared thin border rule');
  assert.ok(!design.match(/EmptyState[\s\S]*backdrop-blur-2xl[\s\S]*export function ErrorState/), 'EmptyState must use a solid surface');
  assert.ok(design.includes('via-brand-gold/[0.45]'), 'EmptyState must keep the Greek accent without a loud dashed card');

  for (const title of ['No actionable work', 'No released marks yet', 'No topic mastery yet', 'No quiz recommendation yet', 'No careers match those filters']) {
    assert.ok(joined.includes(title), `${title} empty state must be present`);
  }

  assert.ok(joined.includes('actionLabel='), 'student empty states must suggest useful next actions');
  assert.ok(joined.includes('actionHref="/dashboard/student/progress"'), 'empty states must route learners toward progress when useful');
  assert.ok(joined.includes('actionHref="/dashboard/student/assignments"'), 'empty states must route learners toward assignments when useful');
});
