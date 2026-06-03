const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('resources page uses grouped rows instead of resource cards or tables', () => {
  const source = read('src', 'features', 'students', 'StudentSupportRoutes.tsx');

  for (const component of ['ResourceList', 'ResourceRow']) {
    assert.ok(source.includes(`export function ${component}`), `${component} must be exported`);
  }

  assert.ok(source.includes('title="Resources"'), 'reports route must now present as Resources');
  assert.ok(source.includes("title: 'Learning'"), 'resources must group learning links');
  assert.ok(source.includes("title: 'Schedule'"), 'resources must group schedule rows');
  assert.ok(source.includes("title: 'Report history'"), 'resources must group report history rows');
  assert.ok(!source.includes('<DataTable<WeeklyReport'), 'resources must avoid report tables');
});

test('settings page uses iOS-style settings groups and is routed from student shell', () => {
  const source = read('src', 'features', 'students', 'StudentSupportRoutes.tsx');
  const app = read('src', 'app', 'App.tsx');
  const shell = read('src', 'components', 'dashboard', 'DashboardShell.tsx');

  for (const component of ['StudentSettingsRoute', 'SettingsGroup', 'SettingsRow']) {
    assert.ok(source.includes(`export function ${component}`), `${component} must be exported`);
  }

  for (const label of ['Profile', 'Account', 'Privacy', 'Appearance']) {
    assert.ok(source.includes(`title="${label}"`), `${label} settings group must be present`);
  }

  assert.ok(app.includes('path="/dashboard/student/settings"'), 'student settings route must be registered');
  assert.ok(shell.includes("to: '/dashboard/student/settings'"), 'student rail settings link must target settings route');
  assert.ok(shell.includes('to="/dashboard/student/settings"'), 'top header settings link must target settings route');
});
