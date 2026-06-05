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
