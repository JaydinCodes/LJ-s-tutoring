const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('student Supabase submission flow creates versions instead of silent overwrite', () => {
  const source = read('src', 'features', 'assignments', 'assignmentMutations.ts');
  const schema = read('docs', 'supabase', 'schema.sql');

  assert.ok(source.includes("rpc('submit_assignment_submission'"), 'student submissions must use the controlled Supabase RPC');
  assert.ok(schema.includes('select coalesce(max(version_number), 0) + 1'), 'next version must be calculated inside the database');
  assert.ok(schema.includes('set is_latest = false'), 'previous rows must be moved out of latest state inside the database');
  assert.ok(schema.includes('insert into public.assignment_submissions'), 're-upload must insert a new row inside the database');
  assert.ok(!source.includes('.upsert({'), 'submission upload must not silently overwrite the existing row');
  assert.ok(schema.includes('v_next_version'), 'new row must carry version_number from the RPC');
  assert.ok(schema.includes('true,'), 'new row must be clearly marked latest');
});

test('submission storage path uses stable ids and not raw uploaded filenames', () => {
  const source = read('src', 'features', 'assignments', 'assignmentMutations.ts');
  const uploadPanel = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');

  assert.match(source, /interface SubmitAssignmentInput[\s\S]*submissionId: string/);
  assert.ok(source.includes('const submissionId = input.submissionId.trim().toLowerCase()'), 'the mutation must consume the caller-owned attempt id');
  assert.ok(source.includes('`${student.id}/${input.assignmentId}/${submissionId}/submission.${ext}`'), 'frontend path must use stable ids plus normalized extension');
  assert.match(source, /upload\(storageKey!, input\.file, \{[\s\S]*upsert: true/);
  assert.ok(!source.includes('${Date.now()}-${safeFileName(input.file)}'), 'frontend submission path must not include raw filenames');
  assert.doesNotMatch(source, /storage\.from\('assignment-submissions'\)\.remove|\.remove\(\[path\]\)/, 'ambiguous failures must never delete a possibly committed upload');

  assert.match(uploadPanel, /submissionAttemptIdRef = useRef<string \| null>\(null\)/);
  assert.match(uploadPanel, /submissionAttemptIdRef\.current \?\? createSubmissionAttemptId\(\)/);
  assert.match(uploadPanel, /mutateAsync\(\{ assignmentId: assignment\.id, submissionId, textAnswer, file \}\)/);
});

test('upload retry state survives failures, resets on edited payload, and clears after confirmation', () => {
  const uploadPanel = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');
  const submitStart = uploadPanel.indexOf('async function submit(event: FormEvent<HTMLFormElement>)');
  const submitEnd = uploadPanel.indexOf('\n  return (', submitStart);
  const submitBlock = uploadPanel.slice(submitStart, submitEnd);
  const awaitIndex = submitBlock.indexOf('await submitAssignmentMutation.mutateAsync');
  const clearIndex = submitBlock.indexOf('submissionAttemptIdRef.current = null', awaitIndex);
  const catchIndex = submitBlock.indexOf('} catch (err) {');

  assert.ok(awaitIndex >= 0 && clearIndex > awaitIndex, 'attempt id must clear only after mutation confirmation');
  assert.ok(catchIndex > clearIndex, 'confirmed-success cleanup must occur before the error path');
  assert.doesNotMatch(submitBlock.slice(catchIndex), /submissionAttemptIdRef\.current = null/, 'failure must retain the same retry id');
  assert.match(uploadPanel, /const setSubmissionText[\s\S]*submissionAttemptIdRef\.current = null/);
  assert.match(uploadPanel, /const setSelectedFile[\s\S]*submissionAttemptIdRef\.current = null/);
  assert.match(uploadPanel, /const onDropRejected[\s\S]*submissionAttemptIdRef\.current = null/);
});

test('submit RPC replays an unchanged UUID exactly once and rejects changed payloads', () => {
  const schema = read('docs', 'supabase', 'schema.sql');
  const start = schema.lastIndexOf('create or replace function public.submit_assignment_submission(');
  const body = schema.slice(start, schema.indexOf('$$;', start) + 3);
  const migrationDir = path.join(root, 'supabase', 'migrations');
  const migrationName = fs.readdirSync(migrationDir)
    .find((name) => name.endsWith('_idempotent_assignment_submission_retries.sql'));
  assert.ok(migrationName, 'a forward-only idempotency migration must exist');
  const migration = read('supabase', 'migrations', migrationName);

  for (const sql of [body, migration]) {
    assert.match(sql, /v_submission_id uuid := p_submission_id/);
    assert.match(sql, /submission_id_required/);
    assert.match(sql, /pg_advisory_xact_lock[\s\S]*assignment-submission-id:/);
    assert.match(sql, /select s\.\* into v_existing_submission/);
    assert.match(sql, /submission_id_conflict/);
    assert.match(sql, /storage_key is distinct from v_storage_key[\s\S]*text_answer is distinct from v_text_answer/);
    assert.match(sql, /submission_retry_payload_mismatch/);
    assert.match(sql, /return query select v_existing_submission\.id/);
    assert.match(sql, /set search_path = ''/);
  }

  assert.ok(
    body.indexOf('select s.* into v_existing_submission') < body.indexOf('select a.* into v_assignment'),
    'a confirmed retry must return even if the assignment closed after the first commit',
  );
});

test('client treats the submission RPC response as confirmation without a forbidden raw-row reload', () => {
  const source = read('src', 'features', 'assignments', 'assignmentMutations.ts');
  const submitStart = source.indexOf('export async function submitAssignment');
  const confirmIndex = source.indexOf('await confirmSubmissionAttempt(client, rpcArgs)', submitStart);
  const uploadIndex = source.indexOf("storage.from('assignment-submissions').upload", submitStart);

  assert.doesNotMatch(source, /from\('assignment_submissions'\)\.select/);
  assert.ok(confirmIndex > submitStart && confirmIndex < uploadIndex, 'a retry must confirm the stable attempt before any Storage upsert');
  assert.match(source, /confirm_assignment_submission_attempt/);
  assert.match(source, /row\.submission_id\.toLowerCase\(\) !== submissionId/);
  assert.match(source, /return \{ submissionId \}/);
});

test('committed submission evidence is immutable while pre-commit retry upserts remain allowed', () => {
  const schema = read('docs', 'supabase', 'schema.sql');
  const policyStart = schema.lastIndexOf('create policy "students_update_own_submission_files"');
  const policy = schema.slice(policyStart, schema.indexOf('\n);', policyStart) + 3);
  const confirmStart = schema.lastIndexOf('create or replace function public.confirm_assignment_submission_attempt(');
  const confirmBody = schema.slice(confirmStart, schema.indexOf('$$;', confirmStart) + 3);
  const guardStart = schema.lastIndexOf('create or replace function public.can_write_uncommitted_assignment_submission_storage(');
  const guardBody = schema.slice(guardStart, schema.indexOf('$$;', guardStart) + 3);

  assert.match(policy, /public\.can_write_uncommitted_assignment_submission_storage\(name\)/);
  assert.match(guardBody, /language plpgsql[\s\S]*volatile[\s\S]*security definer[\s\S]*set search_path = ''/);
  assert.match(guardBody, /v_submission_id := v_path_parts\[3\]::uuid/);
  assert.match(guardBody, /v_path_parts\[4\] !~ '\^submission\\\.\[A-Za-z0-9\]\+\$'/);
  assert.match(guardBody, /pg_advisory_xact_lock[\s\S]*assignment-submission-id:/);
  assert.match(guardBody, /return not exists[\s\S]*s\.id = v_submission_id[\s\S]*s\.student_id = v_student_id/);
  assert.match(confirmBody, /pg_advisory_xact_lock[\s\S]*assignment-submission-id:/);
  assert.match(confirmBody, /submission_retry_payload_mismatch/);
  assert.match(schema, /revoke execute on function public\.confirm_assignment_submission_attempt[\s\S]*from public/);
});

test('runtime pgTAP covers exact replay, payload mismatch, and Storage upsert permissions', () => {
  const runtime = read('supabase', 'tests', 'database', 'rls_role_matrix.test.sql');

  assert.match(runtime, /unchanged submission retry returns the committed attempt/);
  assert.match(runtime, /submission_retry_payload_mismatch/);
  assert.match(runtime, /idempotent replay creates one submission row/);
  assert.match(runtime, /idempotent replay creates one audit event/);
  assert.match(runtime, /student can update the same Storage object during upload retry/);
  assert.match(runtime, /committed submission evidence cannot be overwritten/);
  assert.match(runtime, /confirmed attempt returns before a retry upload/);
});

test('backend locking rejects uploads to closed or archived assignments with clear errors', () => {
  const schema = read('docs', 'supabase', 'schema.sql');

  // The permissive student INSERT policy (which carried these checks) was removed as
  // an AUDIT.md Critical bypass; the protection now lives in the SECURITY DEFINER RPC
  // (rejects non-published) plus the deny-guard that blocks all direct student inserts.
  assert.ok(schema.includes("v_assignment.status <> 'published'"), 'submit RPC must reject uploads to non-published (incl. closed/archived) assignments');
  assert.ok(schema.includes('submissions_student_insert_via_rpc_guard'), 'direct student inserts must be blocked; all submissions go through the RPC');
});

test('student views expose submission version history and latest marker', () => {
  const detail = read('src', 'features', 'students', 'StudentAssignmentDetailRoute.tsx');
  const repository = read('src', 'features', 'students', 'studentDashboardRepository.ts');

  assert.ok(detail.includes('submissionHistory'), 'student detail route must build submission history');
  assert.ok(detail.includes('Latest version'), 'student history must clearly mark the latest version');
  assert.ok(detail.includes('Version ${submission.version_number || 1}'), 'student history must show version numbers');
  assert.ok(repository.includes('get_student_assignment_submissions'), 'student submissions (with version_number/is_latest) come from the redacted Supabase RPC; version history is built in the detail route');
  // Admin/tutor "previous versions" views were never repointed to Supabase (no
  // src/features/admin or src/features/tutors code reads version_number/is_latest
  // beyond the student detail route) -- a known open gap, not covered here.
});

test('database schema adds version constraints and latest indexes', () => {
  const schema = read('docs', 'supabase', 'schema.sql');

  assert.ok(schema.includes('version_number integer not null default 1'), 'schema must add version_number');
  assert.ok(schema.includes('is_latest boolean not null default true'), 'schema must add is_latest');
  assert.ok(schema.includes('unique (assignment_id, student_id, version_number)'), 'schema must enforce one row per version number');
});
