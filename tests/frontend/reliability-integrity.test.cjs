const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260809182137_harden_submission_integrity_and_session_races.sql'), 'utf8');
const scheduler = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260809182502_schedule_submission_orphan_cleanup.sql'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'supabase', 'functions', 'cleanup-submission-assets', 'index.ts'), 'utf8');
const mutations = fs.readFileSync(path.join(root, 'src', 'features', 'assignments', 'assignmentMutations.ts'), 'utf8');

test('REL-01 validates file metadata against the stored Storage object', () => {
  assert.match(migration, /file_size_limit = 5242880/);
  assert.match(migration, /allowed_mime_types/);
  assert.match(migration, /verify_assignment_submission_storage_object/);
  assert.match(migration, /from storage\.objects o/);
  assert.match(migration, /submission_file_not_found/);
  assert.match(migration, /submission_file_metadata_mismatch/);
  assert.match(migration, /private\.verify_assignment_submission_storage_object/);
  assert.match(mutations, /validateSubmissionFile/);
  assert.match(mutations, /MAX_SUBMISSION_FILE_BYTES/);
});

test('REL-01 cleans orphan objects through the Storage API on a schedule', () => {
  assert.match(migration, /get_orphaned_assignment_submission_objects/);
  assert.match(migration, /created_at < now\(\) - interval '24 hours'/);
  assert.match(worker, /storage[\s\S]*from\('assignment-submissions'\)[\s\S]*\.remove/);
  assert.doesNotMatch(worker, /delete from storage\.objects/i);
  assert.match(scheduler, /cleanup-orphaned-assignment-submission-assets/);
  assert.match(scheduler, /cleanup-submission-assets/);
});

test('REL-02 enforces overlapping-session exclusion and payload-aware idempotency', () => {
  assert.match(migration, /sessions_no_tutor_time_overlap/);
  assert.match(migration, /exclude using gist/);
  assert.match(migration, /tsrange\(\(date \+ start_time\)::timestamp/);
  assert.match(migration, /idempotency_key_payload_mismatch/);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\('session-idempotency:/);
  assert.match(migration, /exception when exclusion_violation/);
});

test('REL-02 serializes session submit and reject transitions', () => {
  for (const name of ['submit_session', 'reject_session']) {
    const start = migration.indexOf(`create or replace function public.${name}(`);
    assert.notEqual(start, -1);
    const body = migration.slice(start, migration.indexOf('$$;', start) + 3);
    assert.match(body, /for update/);
    assert.match(body, /session_state_changed/);
  }
});
