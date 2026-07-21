const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Migration plan §3A / §6 step 1: the Prisma `Assignment` engagement/contract
// concept folds into `tutor_student_allocations`. These tests lock (a) the four
// new contract columns and their types on schema.sql, and (b) the one
// financial-confidentiality invariant that comes with them: `rate_override`
// (the tutor's negotiated pay rate) must never be selected by a student's own
// dashboard read, while remaining visible to the tutor for their own rows.

const repoRoot = path.resolve(__dirname, '..', '..');

const schema = fs.readFileSync(
  path.join(repoRoot, 'docs', 'supabase', 'schema.sql'),
  'utf8',
);
const studentRepo = fs.readFileSync(
  path.join(repoRoot, 'src', 'features', 'students', 'studentDashboardRepository.ts'),
  'utf8',
);
const tutorRepo = fs.readFileSync(
  path.join(repoRoot, 'src', 'features', 'tutors', 'tutorDashboardRepository.ts'),
  'utf8',
);

// schema.sql statements are separated by blank lines and the create-table body
// has no internal blank line, so this isolates the whole table definition.
const statements = schema.split(/\n\s*\n/);
const allocationsTable = statements.find((chunk) =>
  /create table if not exists public\.tutor_student_allocations \(/.test(chunk),
);

test('tutor_student_allocations gains the four Prisma-Assignment contract columns with the right types', () => {
  assert.ok(allocationsTable, 'tutor_student_allocations create-table block must exist');
  // subject_id maps Prisma free-text `subject` to the shared subjects table,
  // matching the existing assignments.subject_id convention.
  assert.match(allocationsTable, /\bsubject_id uuid references public\.subjects\(id\)/);
  // rate_override matches Prisma Decimal(12,2).
  assert.match(allocationsTable, /\brate_override numeric\(12, 2\)/);
  assert.match(allocationsTable, /\ballowed_days_json jsonb\b/);
  assert.match(allocationsTable, /\ballowed_time_ranges_json jsonb\b/);
  // Additive only: no NOT NULL forced onto the new columns.
  assert.doesNotMatch(allocationsTable, /rate_override numeric\(12, 2\) not null/);
  assert.doesNotMatch(allocationsTable, /subject_id uuid references public\.subjects\(id\) not null/);
});

// Extract the exact tutor_student_allocations query block from a repository
// file: from `.from('tutor_student_allocations')` up to the terminating
// `.eq('status', 'active')` (both reader queries filter to active rows).
function allocationQueryBlock(source) {
  const start = source.indexOf(".from('tutor_student_allocations')");
  assert.notEqual(start, -1, "expected a .from('tutor_student_allocations') query");
  const rest = source.slice(start);
  const end = rest.indexOf(".eq('status', 'active')");
  assert.notEqual(end, -1, "expected the query to filter .eq('status', 'active')");
  return rest.slice(0, end + ".eq('status', 'active')".length);
}

test("student dashboard read of tutor_student_allocations does NOT select rate_override", () => {
  const block = allocationQueryBlock(studentRepo);
  // The financial leak guard: the student's own dashboard query must not pull
  // the tutor's pay rate. A plain substring search must not find it.
  assert.ok(
    !block.includes('rate_override'),
    'studentDashboardRepository must not select rate_override for tutor_student_allocations',
  );
  // And it must be an explicit column list (not select('*')) that still carries
  // the schedule/subject fields a student is allowed to see.
  assert.doesNotMatch(block, /\.select\('\*'\)/, 'must not use select(*) here');
  assert.match(block, /subject_id/);
  assert.match(block, /allowed_days_json/);
  assert.match(block, /allowed_time_ranges_json/);
});

test("tutor dashboard read of tutor_student_allocations is unchanged (tutor sees their own rate override)", () => {
  const block = allocationQueryBlock(tutorRepo);
  // A tutor seeing their own negotiated rate for their own engagement is
  // correct; confirm this reader was not accidentally narrowed to a column list
  // (which would have dropped rate_override). select('*') keeps it visible.
  assert.match(block, /\.select\('\*'\)/, 'tutor read must still select(*) so rate_override stays visible for its own rows');
});
