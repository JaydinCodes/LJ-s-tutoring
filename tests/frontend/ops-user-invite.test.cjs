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
  assert.match(edgeFunction, /APP_ADMIN_INVITE_REDIRECT_URL/);
  assert.match(edgeFunction, /APP_TUTOR_INVITE_REDIRECT_URL/);
  assert.match(edgeFunction, /APP_STUDENT_INVITE_REDIRECT_URL/);
  assert.match(edgeFunction, /getInviteRedirectUrl\(input\.role\)/);
  assert.match(edgeFunction, /mode: z\.literal\('resend_invite'\)/);
  assert.match(edgeFunction, /admin\.auth\.admin\.getUserById/);
  assert.match(edgeFunction, /admin\.auth\.admin\.generateLink/);
  assert.match(edgeFunction, /type: 'magiclink'/);
  assert.match(edgeFunction, /invite_already_accepted/);
  assert.match(edgeFunction, /admin\.auth\.admin\.createUser/);
  assert.match(edgeFunction, /\.from\('profiles'\)/);
  assert.match(edgeFunction, /\.from\('students'\)/);
  assert.match(edgeFunction, /\.from\('tutors'\)/);
  assert.match(edgeFunction, /duplicate_email/);
  assert.match(edgeFunction, /EXTERNAL_ONBOARDING_ENABLED/);
  assert.match(edgeFunction, /external_onboarding_frozen/);

  assert.match(adminUsersRoute, /functions\.invoke<AdminUserCreateResponse>\('admin-invite-user'/);
  assert.match(adminTutorsRoute, /functions\.invoke<\{ ok: boolean; profileId: string; userId: string \}>\('admin-invite-user'/);
  assert.doesNotMatch(adminTutorsRoute, /Account user ID/);
  assert.match(adminStudentsRoute, /functions\.invoke<\{ ok: boolean; profileId: string; userId: string \}>\('admin-invite-user'/);
  assert.doesNotMatch(adminStudentsRoute, /Account user ID/);
  assert.match(adminTutorsRoute, /Copy fresh tutor sign-in link/);
  assert.match(adminStudentsRoute, /Copy fresh student sign-in link/);
  for (const route of [adminUsersRoute, adminStudentsRoute]) {
    assert.match(route, /Choose grade/);
    assert.match(route, /Grade 12/);
  }
  assert.match(adminUsersRoute, /<select multiple required/);
  assert.match(adminUsersRoute, /Mathematical Literacy/);
  assert.match(adminUsersRoute, /Grade 12/);

  // Tutor selection uses accessible toggle chips instead of a browser-native
  // multi-select, whose rendering is inconsistent in the dashboard dark theme.
  assert.match(adminTutorsRoute, /aria-pressed=\{selected\}/);
  assert.match(adminTutorsRoute, /type="button"/);
  assert.match(adminTutorsRoute, /value\.filter\(\(item\) => item !== option\)/);
  assert.match(adminTutorsRoute, /Mathematical Literacy/);
  assert.match(adminTutorsRoute, /Grade 12/);
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
  assert.match(envExample, /EXTERNAL_ONBOARDING_ENABLED=false/);
  assert.doesNotMatch(frontendSources, /SUPABASE_SERVICE_ROLE_KEY/);
});
