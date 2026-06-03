const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('dashboard motion primitives use motion react and honor reduced-motion preferences', () => {
  const source = read('src', 'components', 'dashboard', 'DashboardDesignSystem.tsx');

  assert.ok(source.includes("from 'motion/react'"), 'dashboard animation must use motion/react');
  assert.ok(source.includes('useReducedMotion()'), 'shared animation primitives must read the reduced-motion preference');

  for (const primitive of ['RouteTransition', 'StaggerGrid', 'StaggerItem', 'AnimatedProgressBar']) {
    assert.ok(source.includes(`export function ${primitive}`), `${primitive} must be exported`);
  }

  assert.ok(source.includes('<RouteTransition>{children}</RouteTransition>'), 'PageShell must animate route content');
  assert.ok(source.includes('className="min-h-px space-y-4"'), 'route transitions must retain a stable layout wrapper');
});

test('dashboard progress indicators animate once with transform-based tracks', () => {
  const source = read('src', 'components', 'dashboard', 'DashboardDesignSystem.tsx');

  // Scale and SVG path animation avoid changing surrounding layout while values enter.
  assert.ok(source.includes('initial={{ scaleX:'), 'progress bars must animate from an initial mounted state');
  assert.ok(source.includes("transformOrigin: 'left'"), 'progress bars must scale from their leading edge');
  assert.ok(source.includes('<motion.circle'), 'progress rings must use a motion SVG circle');
  assert.ok(source.includes('animate={{ pathLength: score / 100 }}'), 'progress rings must animate their score path');
});

test('student card collections opt into shared first-load staggering', () => {
  const components = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');
  const results = read('src', 'features', 'students', 'StudentResultsRoute.tsx');
  const progress = read('src', 'features', 'students', 'StudentProgressRoute.tsx');
  const careers = read('src', 'features', 'students', 'StudentCareersRoute.tsx');

  for (const [name, source] of [
    ['assignment cards', components],
    ['careers', careers],
  ]) {
    assert.ok(source.includes('<StaggerGrid'), `${name} must use StaggerGrid`);
    assert.ok(source.includes('<StaggerItem'), `${name} must use StaggerItem`);
  }

  assert.ok(components.includes('<AnimatedProgressBar'), 'dashboard mastery bars must use the shared animation');
  assert.ok(results.includes('<AnimatedProgressBar'), 'results bars must use the shared animation');
  assert.ok(progress.includes('<AnimatedProgressBar'), 'progress rows must use shared animated bars');
  assert.ok(progress.includes('TopicProgressList'), 'progress page must use a stable row list instead of forced card staggering');
});
