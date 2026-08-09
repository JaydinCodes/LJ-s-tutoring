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
