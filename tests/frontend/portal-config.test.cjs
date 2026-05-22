const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('portal-config.js does not ship a hard-coded Odie access key', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'assets', 'portal-config.js'),
    'utf8',
  );
  assert.ok(
    !/window\.__ODIE_ACCESS_KEY__/.test(src),
    'portal-config.js must not expose window.__ODIE_ACCESS_KEY__ to the browser',
  );
  // Paranoia: no long hex-looking secrets in the file.
  assert.ok(
    !/[a-f0-9]{32,}/i.test(src),
    'portal-config.js must not contain embedded hex secrets',
  );
});

test('portal-config.js exposes an assistant feature flag', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'assets', 'portal-config.js'),
    'utf8',
  );
  assert.ok(
    /window\.__ODIE_ASSISTANT_ENABLED__\s*=/.test(src),
    'portal-config.js must export window.__ODIE_ASSISTANT_ENABLED__',
  );
});

test('inject-config.js strips any legacy Odie key assignment instead of rewriting it', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'scripts', 'inject-config.js'),
    'utf8',
  );
  assert.ok(
    !/window\.__ODIE_ACCESS_KEY__\s*=\s*['"]\$\{/.test(src),
    'inject-config.js must not template a real Odie access key into portal-config.js',
  );
  assert.ok(
    /__ODIE_ASSISTANT_ENABLED__/.test(src),
    'inject-config.js must write the assistant feature flag instead',
  );
});

test('student reports page includes the student auth-guard', () => {
  const html = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'reports', 'index.html'),
    'utf8',
  );
  const configIdx = html.indexOf('portal-config.js');
  const guardIdx = html.indexOf('student/auth-guard.js');
  const scriptIdx = html.indexOf('student/reports.js');
  assert.ok(configIdx !== -1, 'reports/index.html must load portal-config.js');
  assert.ok(guardIdx !== -1, 'reports/index.html must load the student auth-guard');
  assert.ok(
    configIdx < guardIdx && guardIdx < scriptIdx,
    'auth-guard must load after portal-config and before the page script',
  );
});

test('all protected portal pages load config, role guard, then page module', () => {
  const protectedPages = [
    { file: ['reports', 'index.html'], guard: 'student/auth-guard.js', module: 'student/reports.js' },
    { file: ['dashboard', 'index.html'], guard: 'student/auth-guard.js', module: 'student/dashboard.js' },
    { file: ['dashboard', 'assignments', 'index.html'], guard: 'student/auth-guard.js', module: 'student/assignments.js' },
    { file: ['dashboard', 'results', 'index.html'], guard: 'student/auth-guard.js', module: 'student/results.js' },
    { file: ['dashboard', 'community', 'index.html'], guard: 'student/auth-guard.js', module: 'student/community.js' },
    { file: ['dashboard', 'career', 'index.html'], guard: 'student/auth-guard.js', module: 'student/career.js' },
    { file: ['dashboard', 'career', 'readiness', 'index.html'], guard: 'student/auth-guard.js', module: 'student/career-readiness.js' },
    { file: ['dashboard', 'career', 'eligibility', 'index.html'], guard: 'student/auth-guard.js', module: 'student/career-eligibility.js' },
    { file: ['dashboard', 'career', 'paths', 'index.html'], guard: 'student/auth-guard.js', module: 'student/career-paths.js' },
    { file: ['student', 'dashboard', 'index.html'], guard: 'student/auth-guard.js', module: 'student-app-dist/student-app.js' },
    { file: ['student', 'assignments', 'index.html'], guard: 'student/auth-guard.js', module: 'student-app-dist/student-app.js' },
    { file: ['student', 'results', 'index.html'], guard: 'student/auth-guard.js', module: 'student-app-dist/student-app.js' },
    { file: ['student', 'progress', 'index.html'], guard: 'student/auth-guard.js', module: 'student-app-dist/student-app.js' },
    { file: ['student', 'careers', 'index.html'], guard: 'student/auth-guard.js', module: 'student-app-dist/student-app.js' },
    { file: ['tutor', 'dashboard', 'index.html'], guard: 'tutor/auth-guard.js', module: 'tutor/dashboard.js' },
    { file: ['tutor', 'reports', 'index.html'], guard: 'tutor/auth-guard.js', module: 'tutor/reports.js' },
    { file: ['tutor', 'risk', 'index.html'], guard: 'tutor/auth-guard.js', module: 'tutor/risk.js' },
    { file: ['tutor', 'sessions.html'], guard: 'tutor/auth-guard.js', module: 'tutor/sessions.js' },
    { file: ['tutor', 'assignments.html'], guard: 'tutor/auth-guard.js', module: 'tutor/assignments.js' },
    { file: ['admin', 'index.html'], guard: 'admin/auth-guard.js', module: 'admin/portal.js' },
    { file: ['admin', 'tutors.html'], guard: 'admin/auth-guard.js', module: 'admin/portal.js' },
    { file: ['admin', 'students.html'], guard: 'admin/auth-guard.js', module: 'admin/portal.js' },
    { file: ['admin', 'assignments.html'], guard: 'admin/auth-guard.js', module: 'admin/portal.js' },
    { file: ['admin', 'approvals.html'], guard: 'admin/auth-guard.js', module: 'admin/portal.js' },
    { file: ['admin', 'payroll.html'], guard: 'admin/auth-guard.js', module: 'admin/portal.js' },
    { file: ['admin', 'reconciliation.html'], guard: 'admin/auth-guard.js', module: 'admin/portal.js' },
    { file: ['admin', 'audit.html'], guard: 'admin/auth-guard.js', module: 'admin/portal.js' },
    { file: ['admin', 'privacy-requests.html'], guard: 'admin/auth-guard.js', module: 'admin/portal.js' },
    { file: ['admin', 'retention.html'], guard: 'admin/auth-guard.js', module: 'admin/portal.js' },
    { file: ['admin', 'ops-runbook.html'], guard: 'admin/auth-guard.js', module: 'admin/portal.js' },
  ];

  for (const page of protectedPages) {
    const html = fs.readFileSync(path.resolve(__dirname, '..', '..', ...page.file), 'utf8');
    const configIdx = html.indexOf('portal-config.js');
    const guardIdx = html.indexOf(page.guard);
    const moduleIdx = html.indexOf(page.module);
    const label = page.file.join('/');

    assert.ok(configIdx !== -1, `${label} must load portal-config.js`);
    assert.ok(guardIdx !== -1, `${label} must load ${page.guard}`);
    assert.ok(moduleIdx !== -1, `${label} must load ${page.module}`);
    assert.ok(configIdx < guardIdx && guardIdx < moduleIdx, `${label} must load config, guard, then module`);
  }
});
