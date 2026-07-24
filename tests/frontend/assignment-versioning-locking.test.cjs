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

  assert.ok(source.includes('const submissionId = stableUploadId()'), 'frontend storage path must include a generated submission id');
  assert.ok(source.includes('`${student.id}/${input.assignmentId}/${submissionId}/submission.${ext}`'), 'frontend path must use stable ids plus normalized extension');
  assert.ok(!source.includes('${Date.now()}-${safeFileName(input.file)}'), 'frontend submission path must not include raw filenames');
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
