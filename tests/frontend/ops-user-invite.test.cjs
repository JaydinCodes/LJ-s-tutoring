const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('admin user invite workflow is routed through a backend-only Supabase admin endpoint', () => {
  const route = read('lms-api/src/routes/supabase-admin.ts');
  const app = read('lms-api/src/app.ts');
  const adminUsersRoute = read('src/features/admin/AdminUsersRoute.tsx');

  assert.match(route, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(route, /supabaseFetchWithUserToken/);
  assert.match(route, /profile\[0\]\?\.role !== 'admin'/);
  assert.match(route, /aal !== 'aal2'/);
  assert.match(route, /\/auth\/v1\/invite/);
  assert.match(route, /\/auth\/v1\/admin\/users/);
  assert.match(route, /\/rest\/v1\/profiles\?select=id/);
  assert.match(route, /\/rest\/v1\/students/);
  assert.match(route, /\/rest\/v1\/tutors/);
  assert.match(app, /supabaseAdminRoutes/);
  assert.match(adminUsersRoute, /apiPost<AdminUserCreateResponse>\('\/supabase\/admin\/users\/invite'/);
});

test('admin user invite route is visible in the React admin app without exposing service-role keys', () => {
  const reactApp = read('src/app/App.tsx');
  const shell = read('src/components/dashboard/DashboardShell.tsx');
  const buildStatic = read('scripts/build-static.js');
  const envExample = read('.env.example');
  const frontendSources = [
    read('src/features/admin/AdminUsersRoute.tsx'),
    read('src/lib/api/client.ts'),
    read('src/lib/supabase/client.ts'),
  ].join('\n');

  assert.match(reactApp, /path="\/dashboard\/admin\/users"/);
  assert.match(shell, /to: '\/dashboard\/admin\/users'/);
  assert.match(buildStatic, /dashboard\/admin\/users/);
  assert.match(envExample, /SUPABASE_SERVICE_ROLE_KEY=replace_with_local_service_role_key_from_supabase_status/);
  assert.doesNotMatch(frontendSources, /SUPABASE_SERVICE_ROLE_KEY/);
});
