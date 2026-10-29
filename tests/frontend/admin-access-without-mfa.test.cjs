const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');

test('admins use the normal role gate without an MFA enrollment screen', () => {
  const authService = read('src/features/auth/authService.ts');
  const protectedRoute = read('src/features/auth/ProtectedRoute.tsx');

  assert.doesNotMatch(authService, /auth\.mfa\./);
  assert.doesNotMatch(protectedRoute, /AdminMfaGate|adminMfa/);
  assert.doesNotMatch(read('src/features/auth/AuthProvider.tsx'), /adminMfa/);
});

test('Supabase authorization remains role-based without an AAL2 requirement', () => {
  const migration = read('supabase/migrations/20261029120000_remove_admin_mfa_requirement.sql');
  const inviteWorker = read('supabase/functions/admin-invite-user/index.ts');
  const privacyWorker = read('supabase/functions/process-privacy-deletion/index.ts');
  const tutorWorker = read('supabase/functions/process-tutor-deletion/index.ts');

  assert.match(migration, /coalesce\(public\.current_profile_role\(\) = 'admin', false\)/);
  assert.doesNotMatch(migration, /aal2|admin_mfa_required/);
  for (const worker of [inviteWorker, privacyWorker, tutorWorker]) {
    assert.match(worker, /role[^\n]*admin|role !== 'admin'/);
    assert.doesNotMatch(worker, /decodeAal|admin_mfa_required/);
  }
});
