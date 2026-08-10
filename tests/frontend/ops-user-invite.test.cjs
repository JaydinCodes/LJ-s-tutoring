const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('admin user invite workflow is routed through a backend-only Supabase admin endpoint', () => {
  // The Fastify route this replaced is retired along with the rest of
  // lms-api; the frontend now calls the Supabase Edge Function
  // (supabase/functions/admin-invite-user), which carries the same
  // security properties the old route did.
  const edgeFunction = read('supabase/functions/admin-invite-user/index.ts');
  const adminUsersRoute = read('src/features/admin/AdminUsersRoute.tsx');
  const adminTutorsRoute = read('src/features/admin/AdminTutorsRoute.tsx');
  const adminStudentsRoute = read('src/features/admin/AdminStudentsRoute.tsx');

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
  assert.match(adminTutorsRoute, /functions\.invoke<\{ ok: boolean; profileId: string; userId: string \}>\('admin-invite-user'/);
  assert.doesNotMatch(adminTutorsRoute, /Account user ID/);
  assert.match(adminStudentsRoute, /functions\.invoke<\{ ok: boolean; profileId: string; userId: string \}>\('admin-invite-user'/);
  assert.doesNotMatch(adminStudentsRoute, /Account user ID/);
  for (const route of [adminUsersRoute, adminStudentsRoute]) {
    assert.match(route, /Choose grade/);
    assert.match(route, /Grade 12/);
  }
  for (const route of [adminUsersRoute, adminTutorsRoute]) {
    assert.match(route, /<select multiple required/);
    assert.match(route, /Mathematical Literacy/);
    assert.match(route, /Grade 12/);
  }
  assert.doesNotMatch(adminUsersRoute, /apiPost/);
});

test('admin user invite route is visible in the React admin app without exposing service-role keys', () => {
  const reactApp = read('src/app/App.tsx');
  const shell = read('src/components/dashboard/DashboardShell.tsx');
  const buildStatic = read('scripts/build-static.js');
  const envExample = read('.env.example');
  const frontendSources = [
    read('src/features/admin/AdminUsersRoute.tsx'),
    read('src/lib/supabase/client.ts'),
  ].join('\n');

  assert.match(reactApp, /path="\/dashboard\/admin\/users"/);
  assert.match(shell, /to: '\/dashboard\/admin\/users'/);
  assert.match(buildStatic, /dashboard\/admin\/users/);
  assert.match(envExample, /SUPABASE_SERVICE_ROLE_KEY=replace_with_local_service_role_key_from_supabase_status/);
  assert.doesNotMatch(frontendSources, /SUPABASE_SERVICE_ROLE_KEY/);
});
