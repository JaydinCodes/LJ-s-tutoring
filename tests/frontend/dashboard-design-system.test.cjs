const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('dashboard design system exports the shared component inventory', () => {
  const source = read('src', 'components', 'dashboard', 'DashboardDesignSystem.tsx');
  const components = [
    'PageShell',
    'GreekHeroCard',
    'MetricCard',
    'InsightCard',
    'ProgressRing',
    'TimelineCard',
    'EmptyState',
    'ErrorState',
    'SkeletonCard',
    'PremiumButton',
  ];

  for (const component of components) {
    assert.ok(source.includes(`export function ${component}`), `${component} must be exported`);
  }

  assert.ok(source.includes('dark:'), 'dashboard primitives must define dark-mode contrast rules');
});

test('dashboard surfaces use the homepage brand palette and shared visual rules', () => {
  const tailwind = read('tailwind.config.js');
  const styles = read('src', 'components', 'dashboard', 'dashboardStyles.ts');
  const shell = read('src', 'components', 'dashboard', 'DashboardShell.tsx');
  const card = read('src', 'components', 'ui', 'Card.tsx');

  for (const token of ['navy', 'aegean', 'gold', 'parchment', 'marble', 'obsidian']) {
    assert.match(tailwind, new RegExp(`${token}:`), `brand.${token} must remain configured`);
    assert.ok(shell.includes(`brand-${token}`) || styles.includes(`brand-${token}`), `dashboard must use brand.${token}`);
  }

  assert.ok(styles.includes('rounded-[1.5rem]'), 'shared cards must use one radius rule');
  assert.ok(styles.includes('border-white/70'), 'shared cards must use the translucent glass border rule');
  assert.ok(styles.includes('backdrop-blur-2xl'), 'shared cards must use the iOS-style glass blur rule');
  assert.ok(styles.includes('shadow-[0_18px_45px_rgba(15,23,42,0.07)]'), 'shared cards must use the quiet elevation rule');
  assert.ok(card.includes('dashboardSurfaceClass'), 'legacy Card imports must inherit shared surface rules');
});

test('student pages use PageShell and shared dashboard primitives', () => {
  const primaryRoutes = [
    'StudentDashboardRoute.tsx',
    'StudentAssignmentsRoute.tsx',
    'StudentProgressRoute.tsx',
    'StudentResultsRoute.tsx',
    'StudentCareersRoute.tsx',
    'StudentSupportRoutes.tsx',
  ];
  const joined = primaryRoutes.map((file) => read('src', 'features', 'students', file)).join('\n');

  for (const file of primaryRoutes) {
    const source = read('src', 'features', 'students', file);
    assert.ok(source.includes('<PageShell'), `${file} must use PageShell`);
    assert.ok(!source.includes('<DashboardShell'), `${file} must not bypass PageShell`);
  }

  for (const primitive of ['GreekHeroCard', 'MetricCard', 'InsightCard', 'ProgressRing', 'TimelineCard', 'ErrorState', 'SkeletonCard', 'PremiumButton']) {
    assert.ok(joined.includes(primitive), `student pages must use ${primitive}`);
  }
});
