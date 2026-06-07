const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('frontend auth uses Supabase session, profile, and centralized role normalization', () => {
  const authProvider = read('src/features/auth/AuthProvider.tsx');
  const authService = read('src/features/auth/authService.ts');
  const protectedRoute = read('src/features/auth/ProtectedRoute.tsx');
  const roles = read('src/features/auth/roles.ts');

  assert.match(authProvider, /fetchCurrentProfile/);
  assert.match(authService, /supabase\.auth\.getSession\(\)/);
  assert.match(authService, /\.from\('profiles'\)/);
  assert.match(roles, /function normalizeUserRole/);
  assert.match(roles, /DASHBOARD_ROLES/);
  assert.match(protectedRoute, /normalizeUserRole/);
  assert.match(protectedRoute, /auth\.status === 'missing_profile'/);
  assert.match(protectedRoute, /auth\.status === 'invalid_role'/);
  assert.doesNotMatch(protectedRoute, /auth\/session/);
});

test('transitional API client forwards Supabase bearer auth and documents legacy cookies', () => {
  const apiClient = read('src/lib/api/client.ts');
  const fastifyPlugin = read('lms-api/src/plugins/auth.ts');
  const fastifyRoutes = read('lms-api/src/routes/auth.ts');

  assert.match(apiClient, /supabase\.auth\.getSession\(\)/);
  assert.match(apiClient, /authorization: `Bearer \$\{accessToken\}`/);
  assert.match(apiClient, /Transitional Fastify endpoints/);
  assert.match(fastifyPlugin, /Transitional: browser LMS access is Supabase-first/);
  assert.match(fastifyRoutes, /Transitional: Supabase Auth is the browser source of truth/);
});

test('protected routes cover Supabase-first access states for every dashboard role', () => {
  const app = read('src/app/App.tsx');
  const protectedRoute = read('src/features/auth/ProtectedRoute.tsx');

  assert.match(protectedRoute, /if \(!auth\.session\)/, 'unauthenticated users must be blocked before protected content renders');
  assert.match(protectedRoute, /to="\/dashboard\/login"/, 'unauthenticated users must go to the Supabase login route');
  assert.match(protectedRoute, /MissingProfileState/, 'missing Supabase profiles must show a clear shared state');
  assert.match(protectedRoute, /PermissionDeniedState/, 'wrong-role users must show a clear denial state');
  assert.match(protectedRoute, /roles\.includes\(currentRole\)/, 'role checks must use normalized profile role');

  assert.match(app, /path="\/dashboard\/student"[\s\S]*<ProtectedRoute roles=\{\['student'\]\}>/, 'student dashboard must require the student role');
  assert.match(app, /path="\/dashboard\/tutor"[\s\S]*<ProtectedRoute roles=\{\['tutor'\]\}>/, 'tutor dashboard must require the tutor role');
  assert.match(app, /path="\/dashboard\/admin"[\s\S]*<ProtectedRoute roles=\{\['admin'\]\}>/, 'admin dashboard must require the admin role');
  assert.match(app, /path="\/dashboard\/parent\/reports"[\s\S]*<ProtectedRoute roles=\{\['parent'\]\}>/, 'parent reports must require the parent role');
  assert.match(app, /path="\/dashboard\/ngo\/reports"[\s\S]*<ProtectedRoute roles=\{\['ngo_partner'\]\}>/, 'NGO reports must require the NGO partner role');
});

test('launch dashboard role normalization includes parent and NGO partner roles', () => {
  const roles = read('src/features/auth/roles.ts');

  assert.match(roles, /'parent'/, 'parent role must be treated as a valid dashboard role');
  assert.match(roles, /'ngo_partner'/, 'NGO partner role must be treated as a valid dashboard role');
  assert.match(roles, /parent: '\/dashboard\/parent\/reports'/);
  assert.match(roles, /ngo_partner: '\/dashboard\/ngo\/reports'/);
});
