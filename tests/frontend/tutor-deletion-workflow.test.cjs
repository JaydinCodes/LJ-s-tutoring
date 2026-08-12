const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');

const migration = read('supabase/migrations/20260812101923_harden_tutor_deletion_workflow.sql');
const worker = read('supabase/functions/process-tutor-deletion/index.ts');
const route = read('src/features/admin/AdminTutorsRoute.tsx');
const mutations = read('src/features/admin/rosterMutations.ts');

test('TUT-DEL-01 uses a trusted, leased tutor deletion saga', () => {
  assert.match(migration, /create or replace function public\.request_tutor_deletion\(/);
  assert.match(migration, /if not public\.is_platform_admin\(\) then[\s\S]*?admin_mfa_required/);
  assert.match(migration, /create or replace function public\.claim_tutor_deletion\(/);
  assert.match(migration, /processing_claim_token/);
  assert.match(migration, /processing_lease_expires_at/);
  assert.match(migration, /create or replace function public\.renew_tutor_deletion_lease\(/);
  assert.match(migration, /revoke all on function public\.erase_tutor_data\(uuid\) from public, anon, authenticated, service_role/);
  assert.match(migration, /grant execute on function public\.erase_tutor_data\(uuid\) to service_role/);
});

test('TUT-DEL-01 retains financial history while erasing tutor personal data', () => {
  assert.match(migration, /delete from public\.tutor_documents/);
  assert.match(migration, /delete from public\.tutor_availability_slots/);
  assert.match(migration, /delete from public\.tutor_applications/);
  assert.match(migration, /delete from public\.volunteer_logs/);
  assert.match(migration, /tutor_payments_retained/);
  assert.doesNotMatch(migration, /delete from public\.tutor_payments/);
  assert.doesNotMatch(migration, /delete from public\.tutors where id = v_request\.tutor_id/);
  assert.match(migration, /full_name = 'Deleted tutor'/);
  assert.match(migration, /tutor_deletion_receipts/);
});

test('TUT-DEL-01 worker bans, clears storage, erases database data, and deletes Auth last', () => {
  assert.match(worker, /decodeAal\(token\) !== 'aal2'/);
  assert.match(worker, /claim_tutor_deletion/);
  assert.match(worker, /updateUserById\(authUserId, \{ ban_duration: '876000h' \}\)/);
  assert.match(worker, /get_tutor_deletion_storage_manifest/);
  assert.match(worker, /storage\.from\('tutor-documents'\)\.remove/);
  assert.match(worker, /erase_tutor_data/);
  assert.match(worker, /auth\.admin\.deleteUser\(authUserId, false\)/);
  assert.match(worker, /finalize_tutor_deletion/);
  assert.match(worker, /record_tutor_deletion_error/);
});

test('admin tutor roster invokes the single deletion entry point after confirmation', () => {
  assert.match(route, /Delete tutor account/);
  assert.match(route, /window\.confirm/);
  assert.match(route, /deleteTutorAccount\(\{ tutorId: tutor\.id/);
  assert.match(mutations, /callRpc\([\s\S]*?'request_tutor_deletion'/);
  assert.match(mutations, /functions\.invoke\('process-tutor-deletion'/);
  assert.doesNotMatch(mutations, /SUPABASE_SERVICE_ROLE_KEY/);
});
