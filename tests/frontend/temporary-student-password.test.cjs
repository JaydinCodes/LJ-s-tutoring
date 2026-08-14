const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, ...file.split('/')), 'utf8');

test('student temporary passwords are set by an admin and replaced before portal access', () => {
  const adminFunction = read('supabase/functions/admin-invite-user/index.ts');
  const completionFunction = read('supabase/functions/complete-temporary-password/index.ts');
  const studentRoute = read('src/features/admin/AdminStudentsRoute.tsx');
  const passwordGate = read('src/features/auth/TemporaryPasswordGate.tsx');
  const protectedRoute = read('src/features/auth/ProtectedRoute.tsx');

  assert.match(adminFunction, /mode: z\.literal\('reset_student_password'\)/);
  assert.match(adminFunction, /require_password_change: true/);
  assert.match(adminFunction, /email_confirm: true/);
  assert.match(studentRoute, /mode: 'create'/);
  assert.match(studentRoute, /Temporary password/);
  assert.match(studentRoute, /Reset temporary password/);
  assert.match(completionFunction, /user\.app_metadata\?\.require_password_change !== true/);
  assert.match(completionFunction, /require_password_change: false/);
  assert.match(completionFunction, /check_and_record_edge_function_rate_limit/);
  assert.match(passwordGate, /complete-temporary-password/);
  assert.match(protectedRoute, /TemporaryPasswordGate/);
});
