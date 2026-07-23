const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('admin user invite workflow is routed through a backend-only Supabase admin endpoint', () => {
  // The Fastify route is unchanged and still registered -- it stays live
  // until the broader lms-api retirement -- but the frontend now calls the
  // Supabase Edge Function that replaced it (supabase/functions/
  // admin-invite-user), which carries the same security properties.
  const route = read('lms-api/src/routes/supabase-admin.ts');
  const app = read('lms-api/src/app.ts');
  const edgeFunction = read('supabase/functions/admin-invite-user/index.ts');
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

  assert.match(edgeFunction, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(edgeFunction, /role !== 'admin'/);
  assert.match(edgeFunction, /decodeAal\(token\) !== 'aal2'/);
  assert.match(edgeFunction, /inviteUserByEmail/);
  assert.match(edgeFunction, /admin\.auth\.admin\.createUser/);
  assert.match(edgeFunction, /\.from\('profiles'\)/);
  assert.match(edgeFunction, /\.from\('students'\)/);
  assert.match(edgeFunction, /\.from\('tutors'\)/);
  assert.match(edgeFunction, /duplicate_email/);

  assert.match(adminUsersRoute, /functions\.invoke<AdminUserCreateResponse>\('admin-invite-user'/);
  assert.doesNotMatch(adminUsersRoute, /apiPost/);
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
