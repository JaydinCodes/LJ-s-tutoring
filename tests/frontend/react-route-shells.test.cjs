const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

const protectedRoutes = [
  '/dashboard/student',
  '/dashboard/student/assignments',
  '/dashboard/student/progress',
  '/dashboard/student/results',
  '/dashboard/student/careers',
  '/dashboard/student/reports',
  '/dashboard/student/community',
  '/dashboard/admin',
  '/dashboard/admin/students',
  '/dashboard/admin/tutors',
  '/dashboard/admin/assignments',
  '/dashboard/admin/approvals',
  '/dashboard/admin/payments',
  '/dashboard/admin/payroll',
  '/dashboard/admin/reconciliation',
  '/dashboard/admin/reports',
  '/dashboard/admin/results',
  '/dashboard/admin/audit',
  '/dashboard/admin/privacy-requests',
  '/dashboard/admin/retention',
  '/dashboard/admin/ops-runbook',
  '/dashboard/tutor',
  '/dashboard/tutor/classes',
  '/dashboard/tutor/sessions',
  '/dashboard/tutor/submissions',
  '/dashboard/tutor/reports',
  '/dashboard/tutor/risk',
];

const publicRoutes = [
  '/',
  '/about',
  '/programs',
  '/privacy',
  '/terms',
  '/dashboard/login',
  '/onboarding/student',
  '/onboarding/tutor',
];

test('unified React app registers migrated public and protected routes', () => {
  const app = fs.readFileSync(path.join(root, 'src', 'app', 'App.tsx'), 'utf8');

  for (const route of [...publicRoutes, ...protectedRoutes]) {
    if (route === '/') {
      assert.match(app, /<Route path="\/" element=/, 'root route must be registered');
    } else {
      assert.ok(app.includes(`path="${route}"`), `${route} must be registered in App.tsx`);
    }
  }

  assert.ok(!app.includes('PlaceholderRoute'), 'migrated public routes must not use PlaceholderRoute');
});

test('build-static generates direct shell files for every nested React route', () => {
  const buildStatic = fs.readFileSync(path.join(root, 'scripts', 'build-static.js'), 'utf8');
  const shellRoutes = [...publicRoutes, ...protectedRoutes]
    .filter((route) => route !== '/')
    .map((route) => route.replace(/^\//, ''));

  for (const route of shellRoutes) {
    assert.ok(
      buildStatic.includes(`'${route}'`),
      `${route} must be listed in reactDashboardRoutes for direct static loads`,
    );
  }

  assert.ok(buildStatic.includes('/react-app-dist/react-app.js'), 'React shell must load the unified React bundle');
  assert.ok(buildStatic.includes('/react-app-dist/react-app.css'), 'React shell must load the unified React stylesheet');
});

test('React migration docs name the cleanup checklist and active route families', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

  assert.ok(readme.includes('docs/REACT_MIGRATION_CLEANUP_CHECKLIST.md'));
  assert.ok(readme.includes('/dashboard/student/community'));
  assert.ok(readme.includes('/dashboard/admin/payroll'));
  assert.ok(readme.includes('/dashboard/tutor/risk'));
});
