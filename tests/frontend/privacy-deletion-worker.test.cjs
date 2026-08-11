const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const repository = fs.readFileSync(
  path.join(root, 'src/features/admin/adminOperationsRepository.ts'),
  'utf8',
);
const routes = fs.readFileSync(
  path.join(root, 'src/features/admin/AdminOperationsRoutes.tsx'),
  'utf8',
);
const worker = fs.readFileSync(
  path.join(root, 'supabase/functions/process-privacy-deletion/index.ts'),
  'utf8',
);
const sagaMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260811133000_lease_privacy_deletion_saga.sql'),
  'utf8',
);
const scheduleMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260811130100_bootstrap_recovery_schedules.sql'),
  'utf8',
);

test('privacy deletion uses the trusted Edge Function while access/correction keep the admin RPC', () => {
  assert.match(
    repository,
    /if \(requestType === 'deletion'\)[\s\S]{0,600}functions\.invoke\('process-privacy-deletion'/,
  );
  assert.match(
    repository,
    /else \{[\s\S]{0,250}callRpc\(client, 'process_privacy_request'/,
  );
});

test('privacy deletion UI is destructive-confirmed and exposes worker state instead of claiming early completion', () => {
  assert.match(routes, /Permanently delete this learner account and erase their personal data/);
  assert.match(routes, /Deletion stage:/);
  assert.match(routes, /request stays pending until Auth, Storage, database erasure, and the compliance receipt all complete/);
  assert.match(routes, /Retry deletion/);
});

test('privacy deletion claims a lease and preserves the storage manifest across retries', () => {
  assert.match(worker, /claim_student_privacy_deletion/);
  assert.match(worker, /claim_next_student_privacy_deletion/);
  assert.match(worker, /renew_student_privacy_deletion_lease/);
  assert.match(worker, /record_student_privacy_storage_manifest/);
  assert.match(sagaMigration, /processing_claim_token uuid/);
  assert.match(sagaMigration, /processing_lease_expires_at timestamptz/);
  assert.match(sagaMigration, /storage_files_expected integer/);
  assert.match(sagaMigration, /privacy_deletion_busy/);
  assert.match(sagaMigration, /greatest\(storage_files_removed, p_files_removed, v_expected\)/);
  assert.match(scheduleMigration, /privacy-deletion-resumer/);
});
