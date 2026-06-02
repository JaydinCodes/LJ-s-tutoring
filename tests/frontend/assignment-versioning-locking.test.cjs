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

  assert.ok(source.includes('.order(\'version_number\', { ascending: false })'), 'existing versions must be read in version order');
  assert.ok(source.includes('const nextVersion = Math.max(0, ...existingSubmissions.map'), 'next version must be calculated from previous versions');
  assert.ok(source.includes('.update({ is_latest: false })'), 'previous rows must be moved out of latest state');
  assert.ok(source.includes('.insert({'), 're-upload must insert a new row');
  assert.ok(!source.includes('.upsert({'), 'submission upload must not silently overwrite the existing row');
  assert.ok(source.includes('version_number: nextVersion'), 'new row must carry version_number');
  assert.ok(source.includes('is_latest: true'), 'new row must be clearly marked latest');
});

test('submission storage path uses stable ids and not raw uploaded filenames', () => {
  const source = read('src', 'features', 'assignments', 'assignmentMutations.ts');
  const api = read('lms-api', 'src', 'routes', 'academic.ts');

  assert.ok(source.includes('const submissionId = stableUploadId()'), 'frontend storage path must include a generated submission id');
  assert.ok(source.includes('`${student.id}/${input.assignmentId}/${submissionId}/submission.${ext}`'), 'frontend path must use stable ids plus normalized extension');
  assert.ok(!source.includes('${Date.now()}-${safeFileName(input.file)}'), 'frontend submission path must not include raw filenames');
  assert.ok(api.includes('const submissionId = crypto.randomUUID()'), 'API storage path must include a generated submission id');
  assert.ok(api.includes("path.posix.join('submissions', studentId, params.data.id, submissionId, objectName)"), 'API path must use stable ids and normalized object name');
  assert.ok(!api.includes('`${Date.now()}-${originalFilename}`'), 'API submission path must not include raw filenames');
});

test('backend locking rejects uploads to closed or archived assignments with clear errors', () => {
  const api = read('lms-api', 'src', 'routes', 'academic.ts');
  const schema = read('docs', 'supabase', 'schema.sql');

  assert.ok(api.includes("assignment.status === 'closed' || assignment.status === 'archived'"), 'API must check locked assignment states');
  assert.ok(api.includes("error: 'assignment_locked'"), 'API must return a clear locked-assignment error code');
  assert.ok(api.includes('no longer accepts uploads'), 'API must return a clear locked-assignment message');
  assert.ok(schema.includes("a.status = 'published'"), 'Supabase RLS must only allow student uploads to published assignments');
  assert.ok(schema.includes("status = 'submitted'"), 'Supabase RLS must prevent students from spoofing marked statuses on insert');
});

test('student and tutor/admin views expose submission version history and latest marker', () => {
  const detail = read('src', 'features', 'students', 'StudentAssignmentDetailRoute.tsx');
  const repository = read('src', 'features', 'students', 'studentDashboardRepository.ts');
  const admin = read('lms-api', 'src', 'routes', 'admin.ts');
  const tutor = read('lms-api', 'src', 'routes', 'tutor.ts');

  assert.ok(detail.includes('submissionHistory'), 'student detail route must build submission history');
  assert.ok(detail.includes('Latest version'), 'student history must clearly mark the latest version');
  assert.ok(detail.includes('Version ${submission.version_number || 1}'), 'student history must show version numbers');
  assert.ok(repository.includes('submission_versions'), 'API submission versions must be projected into React state');
  assert.ok(admin.includes('submission_versions'), 'admin assignment overview must expose previous versions');
  assert.ok(tutor.includes('submission_versions'), 'tutor assignment overview must expose previous versions');
});

test('database migration adds version constraints and latest indexes', () => {
  const migration = read('lms-api', 'prisma', 'migrations', '20260603_assignment_submission_versioning', 'migration.sql');

  assert.ok(migration.includes('add column if not exists version_number integer'), 'migration must add version_number');
  assert.ok(migration.includes('add column if not exists is_latest boolean'), 'migration must add is_latest');
  assert.ok(migration.includes('assignment_submissions_assignment_student_version_uidx'), 'migration must enforce one row per version number');
  assert.ok(migration.includes('assignment_submissions_latest_assignment_student_uidx'), 'migration must enforce one latest row per student assignment');
  assert.ok(migration.includes("status in ('draft','published','submitted','reviewed','closed','archived','marked')"), 'migration must include locking lifecycle states');
});
