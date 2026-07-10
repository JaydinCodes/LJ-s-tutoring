const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('admin MFA is enforced with Supabase MFA APIs and a production-safe bypass', () => {
  const authService = read('src/features/auth/authService.ts');
  const protectedRoute = read('src/features/auth/ProtectedRoute.tsx');
  const adminMfaGate = read('src/features/auth/AdminMfaGate.tsx');

  assert.match(authService, /auth\.mfa\.getAuthenticatorAssuranceLevel\(\)/);
  assert.match(authService, /auth\.mfa\.listFactors\(\)/);
  assert.match(authService, /auth\.mfa\.enroll\(\{\s*factorType: 'totp'/);
  assert.match(authService, /friendlyName: 'Project Odysseus Admin'/);
  assert.match(authService, /auth\.mfa\.challenge\(\{ factorId \}\)/);
  assert.match(authService, /auth\.mfa\.verify\(input\)/);
  assert.match(authService, /!import\.meta\.env\.PROD && import\.meta\.env\.VITE_PO_DEV_ADMIN_MFA_BYPASS === 'true'/);

  assert.match(protectedRoute, /currentRole === 'admin'/);
  assert.match(protectedRoute, /<AdminMfaGate>\{children\}<\/AdminMfaGate>/);

  assert.match(adminMfaGate, /MFA required/);
  assert.match(adminMfaGate, /MFA setup required/);
  assert.match(adminMfaGate, /Start MFA setup/);
  assert.match(adminMfaGate, /Project Odysseus admin MFA QR code/);
  assert.match(adminMfaGate, /Manual setup secret/);
  assert.match(adminMfaGate, /Email OTP is not used/);
  assert.match(adminMfaGate, /MFA verification failed/);
  assert.match(adminMfaGate, /MFA verified/);
});

test('admin MFA setup is documented and disabled by default in example env', () => {
  const envExample = read('.env.example');
  const authDocs = read('docs/setup/AUTH_SETUP.md');
  const fastifyAuth = read('lms-api/src/routes/auth.ts');

  assert.match(envExample, /VITE_PO_DEV_ADMIN_MFA_BYPASS=false/);
  assert.match(authDocs, /Production admin access requires Supabase Auth MFA/);
  assert.match(authDocs, /getAuthenticatorAssuranceLevel\(\)/);
  assert.match(authDocs, /Do not set it in staging or production/);
  // Legacy Fastify admin login was retired (AUDIT.md Critical): it minted an admin
  // session with no server-side MFA. It now returns admin_login_via_supabase.
  assert.match(fastifyAuth, /admin_login_via_supabase/);
});
