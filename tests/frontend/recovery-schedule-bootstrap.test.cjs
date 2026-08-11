const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('recovery schedules bootstrap independently of migration-time Vault state', () => {
  const migration = read('supabase', 'migrations', '20260811130100_bootstrap_recovery_schedules.sql');
  const workflow = read('.github', 'workflows', 'deploy-production.yml');

  assert.match(migration, /create or replace function private\.ensure_recovery_schedules/);
  assert.match(migration, /create or replace function private\.assert_recovery_schedules_ready/);
  assert.match(migration, /recovery_schedule_secret_missing/);
  assert.match(migration, /ai-grading-worker/);
  assert.match(migration, /cleanup-orphaned-assignment-submission-assets/);
  assert.match(workflow, /private\.ensure_recovery_schedules/);
  assert.match(workflow, /private\.assert_recovery_schedules_ready/);
  assert.match(workflow, /SUPABASE_ACCESS_TOKEN/);
  assert.match(workflow, /supabase db query --linked/);
});
