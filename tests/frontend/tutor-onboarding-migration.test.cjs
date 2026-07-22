const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// PRISMA_TO_SUPABASE_MIGRATION_PLAN.md §4 / §6 step 6: the tutor-onboarding /
// vetting migration. Static-analysis tests (the regex-against-schema.sql pattern
// used by sessions-migration.test.cjs / finance-payroll-migration.test.cjs /
// weekly-reports-notifications-migration.test.cjs) that lock:
//   * the new approval/qualification columns + check constraint on public.tutors,
//   * the three new tables (tutor_applications / tutor_documents /
//     tutor_availability_slots) + their constraints and indexes,
//   * their RLS shape (tutor-own + admin SELECT; no direct writes -> RPC only),
//   * the private tutor-documents Storage bucket + its ownership-scoped policies,
//   * the six SECURITY DEFINER RPCs + grants,
//   * the approved -> changes_requested revert rule (upsert) and the full
//     approval cascade incl. the coalesce() non-overwrite (decide),
//   * and the THIRD deferred-loop closure: the five session/finance RPCs now
//     require approval_status = 'approved' in addition to status = 'active'.
//
// NOTE on the slicing-bug class flagged by the two prior migrations: this file
// never uses a fixed-size lookback/lookahead window. functionBody() slices
// anchor-to-anchor (function header -> next `$$;`), so a longer comment can never
// silently truncate an expected phrase out of the captured body.

const repoRoot = path.resolve(__dirname, '..', '..');
const schema = fs.readFileSync(
  path.join(repoRoot, 'docs', 'supabase', 'schema.sql'),
  'utf8',
);
const studentDashboardRepo = fs.readFileSync(
  path.join(repoRoot, 'src', 'features', 'students', 'studentDashboardRepository.ts'),
  'utf8',
);

const statements = schema.split(/\n\s*\n/);

function tableBlock(table) {
  return statements.find((chunk) =>
    new RegExp(`create table if not exists public\\.${table} \\(`).test(chunk),
  );
}

function policyStatementsForTable(table) {
  const onClause = new RegExp(`\\bon public\\.${table}\\b`);
  return statements
    .filter((chunk) => /create policy/.test(chunk) && onClause.test(chunk))
    .map((chunk) => chunk.slice(chunk.indexOf('create policy')));
}

function storagePoliciesForBucket(bucket) {
  const bucketClause = new RegExp(`bucket_id = '${bucket}'`);
  return statements
    .filter(
      (chunk) =>
        /create policy/.test(chunk) &&
        /on storage\.objects/.test(chunk) &&
        bucketClause.test(chunk),
    )
    .map((chunk) => chunk.slice(chunk.indexOf('create policy')));
}

// Anchor-to-anchor: from the function header to the terminating `$$;`. No fixed
// window, so length of comments/body cannot truncate a matched phrase.
function functionBody(name) {
  const start = schema.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `expected function public.${name} to be defined`);
  const rest = schema.slice(start);
  const end = rest.indexOf('$$;');
  assert.notEqual(end, -1, `expected function public.${name} to terminate with $$;`);
  return rest.slice(0, end + 3);
}

// --- public.tutors: new approval/qualification columns ----------------------

test('public.tutors gains the new approval/qualification columns (additive ALTER, no active column)', () => {
  const alter = statements.find(
    (c) => /alter table public\.tutors\b/.test(c) && /add column if not exists approval_status/.test(c),
  );
  assert.ok(alter, 'alter table public.tutors add-column block must exist');
  assert.match(alter, /add column if not exists qualification_band text/);
  assert.match(alter, /add column if not exists qualified_subjects_json jsonb/);
  assert.match(alter, /add column if not exists approval_status text not null default 'approved'/);
  assert.match(alter, /add column if not exists approval_reviewed_by uuid references public\.profiles\(id\)/);
  assert.match(alter, /add column if not exists approval_reviewed_at timestamptz/);
  assert.match(alter, /add column if not exists approval_note text/);
  assert.match(alter, /add column if not exists teaching_preferences_json jsonb/);
  // Prisma's separate `active` boolean is NOT re-added (folded into status enum).
  assert.doesNotMatch(alter, /add column if not exists active\b/);
  // full_name / phone are NOT duplicated onto tutors (identity lives on profiles).
  assert.doesNotMatch(alter, /add column if not exists full_name/);
  assert.doesNotMatch(alter, /add column if not exists phone/);
});

test('public.tutors approval_status check covers both vocabularies, excludes draft/submitted', () => {
  assert.match(
    schema,
    /constraint tutors_approval_status_check\s+check \(approval_status in \('pending', 'under_review', 'approved', 'rejected', 'changes_requested'\)\)/,
  );
  // Added under a guard so re-applying schema.sql is idempotent.
  assert.match(schema, /if not exists \(\s*select 1 from pg_constraint where conname = 'tutors_approval_status_check'\s*\)/);
});

test('the exposure of approval fields to allocated students is FLAGGED and FIXED (query-level, not RLS)', () => {
  // tutors_select_self_or_admin's third arm (an allocated student) grants row
  // access to the whole tutors row -- RLS is row-level, it cannot exclude just
  // the new approval columns for that arm. The schema must still carry the
  // EXPOSURE NOTE explaining why (reviewer context for anyone re-deriving this),
  // but the actual fix is that the one student-facing reader of this table
  // (studentDashboardRepository.ts) selects an explicit, narrowed column list
  // instead of select('*') -- verified below, not left as a bare TODO.
  assert.match(schema, /EXPOSURE NOTE/);
  assert.match(schema, /approval_note/);

  // The frontend fix: studentDashboardRepository.ts's tutors read must be an
  // explicit column list that excludes every new vetting field, restoring
  // exactly the pre-migration (safe) column set.
  const tutorsReadBlock = studentDashboardRepo.slice(
    studentDashboardRepo.indexOf("from('tutors')"),
  );
  const firstLine = tutorsReadBlock.slice(0, tutorsReadBlock.indexOf('\n'));
  assert.doesNotMatch(
    studentDashboardRepo,
    /from\('tutors'\)\.select\('\*'\)/,
    'studentDashboardRepository.ts must not select(\'*\') from tutors',
  );
  for (const sensitive of [
    'qualification_band',
    'qualified_subjects_json',
    'approval_status',
    'approval_reviewed_by',
    'approval_reviewed_at',
    'approval_note',
    'teaching_preferences_json',
  ]) {
    assert.ok(
      !firstLine.includes(sensitive),
      `studentDashboardRepository.ts's tutors query must not select ${sensitive}`,
    );
  }
  assert.match(
    studentDashboardRepo,
    /from\('tutors'\)\.select\('id, profile_id, subjects, grades, hourly_rate, status, created_at'\)/,
    'studentDashboardRepository.ts must select the exact pre-migration-safe column list',
  );
});

// --- tutor_applications table ----------------------------------------------

test('tutor_applications table: columns, unique tutor_id, status check, jsonb defaults', () => {
  const block = tableBlock('tutor_applications');
  assert.ok(block, 'tutor_applications create-table block must exist');
  assert.match(block, /tutor_id uuid not null unique references public\.tutors\(id\) on delete cascade/);
  assert.match(
    block,
    /status text not null default 'draft' check \(status in \('draft', 'submitted', 'under_review', 'approved', 'rejected', 'changes_requested'\)\)/,
  );
  assert.match(block, /personal_details_json jsonb not null default '\{\}'::jsonb/);
  assert.match(block, /subjects_json jsonb not null default '\[\]'::jsonb/);
  assert.match(block, /grades_json jsonb not null default '\[\]'::jsonb/);
  assert.match(block, /teaching_preferences_json jsonb not null default '\[\]'::jsonb/);
  assert.match(block, /experience text/);
  assert.match(block, /availability_notes text/);
  assert.match(block, /submitted_at timestamptz/);
  assert.match(block, /reviewed_by uuid references public\.profiles\(id\)/);
  assert.match(block, /reviewed_at timestamptz/);
  assert.match(block, /review_note text/);
  assert.match(block, /created_at timestamptz not null default now\(\)/);
  assert.match(block, /updated_at timestamptz not null default now\(\)/);
});

// --- tutor_documents table -------------------------------------------------

test('tutor_documents table: enums, storage_key metadata (no bytes), index', () => {
  const block = tableBlock('tutor_documents');
  assert.ok(block, 'tutor_documents create-table block must exist');
  assert.match(block, /tutor_id uuid not null references public\.tutors\(id\) on delete cascade/);
  assert.match(block, /document_type text not null check \(document_type in \('identity', 'cv', 'qualification', 'additional'\)\)/);
  assert.match(block, /storage_key text not null/);
  assert.match(block, /original_filename text not null/);
  assert.match(block, /mime_type text not null check \(mime_type in \('application\/pdf', 'image\/jpeg', 'image\/png'\)\)/);
  assert.match(block, /file_size_bytes int not null/);
  assert.match(block, /uploaded_at timestamptz not null default now\(\)/);
  assert.match(block, /verification_status text not null default 'pending' check \(verification_status in \('pending', 'accepted', 'rejected'\)\)/);
  assert.match(block, /verified_by uuid references public\.profiles\(id\)/);
  assert.match(block, /verified_at timestamptz/);
  assert.match(block, /notes text/);
  // Metadata only -- never a bytes/content column (bytes live in Storage).
  assert.doesNotMatch(block, /content|file_bytes|data bytea/i);
  assert.match(schema, /create index if not exists idx_tutor_documents_tutor_uploaded on public\.tutor_documents\(tutor_id, uploaded_at desc\)/);
});

// --- tutor_availability_slots table ----------------------------------------

test('tutor_availability_slots table: day/time checks, end>start, mode default, index', () => {
  const block = tableBlock('tutor_availability_slots');
  assert.ok(block, 'tutor_availability_slots create-table block must exist');
  assert.match(block, /tutor_id uuid not null references public\.tutors\(id\) on delete cascade/);
  assert.match(block, /day_of_week int not null check \(day_of_week between 0 and 6\)/);
  assert.match(block, /start_time time not null/);
  assert.match(block, /end_time time not null check \(end_time > start_time\)/);
  assert.match(block, /mode text not null default 'online'/);
  assert.match(block, /notes text/);
  assert.match(block, /active boolean not null default true/);
  assert.match(schema, /create index if not exists idx_tutor_availability_tutor_day_start on public\.tutor_availability_slots\(tutor_id, day_of_week, start_time\)/);
});

test('all three new tables have RLS enabled', () => {
  for (const table of ['tutor_applications', 'tutor_documents', 'tutor_availability_slots']) {
    assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`));
  }
});

// --- RLS: identical shape on all three (tutor-own + admin SELECT; RPC-only writes)

for (const table of ['tutor_applications', 'tutor_documents', 'tutor_availability_slots']) {
  test(`${table} RLS: admin SELECT all + tutor SELECT own; NO student/parent read`, () => {
    const policies = policyStatementsForTable(table);
    const select = policies.filter((p) => /for select/.test(p));
    assert.ok(select.some((p) => /public\.is_platform_admin\(\)/.test(p)), 'admin select required');
    assert.ok(select.some((p) => /tutor_id = public\.current_tutor_id\(\)/.test(p)), 'tutor own select required');
    // No student/parent/coordinator access invented.
    for (const p of policies) {
      assert.ok(!/current_student_id\(\)/.test(p), `${table} must not grant student read`);
      assert.ok(!/'parent'/.test(p), `${table} must not grant guardian read`);
    }
  });

  test(`${table} RLS: no direct INSERT/UPDATE/DELETE (all writes via RPC)`, () => {
    const policies = policyStatementsForTable(table);
    const insert = policies.find((p) => /for insert/.test(p));
    const update = policies.find((p) => /for update/.test(p));
    const del = policies.find((p) => /for delete/.test(p));
    assert.ok(insert && /with check \(false\)/.test(insert), `${table} no direct insert`);
    assert.ok(update && /using \(false\)/.test(update) && /with check \(false\)/.test(update), `${table} no direct update`);
    assert.ok(del && /using \(false\)/.test(del), `${table} no direct delete`);
  });
}

// --- Storage: private tutor-documents bucket + policies ---------------------

test('tutor-documents Storage bucket is private', () => {
  assert.match(
    schema,
    /insert into storage\.buckets \(id, name, public\)\s+values \('tutor-documents', 'tutor-documents', false\)/,
  );
});

test('tutor-documents Storage policies: tutor INSERT/SELECT own folder, admin SELECT any, NO update/delete', () => {
  const policies = storagePoliciesForBucket('tutor-documents');
  const insert = policies.find((p) => /for insert/.test(p));
  const select = policies.find((p) => /for select/.test(p));
  assert.ok(insert, 'tutor-documents insert policy required');
  assert.ok(select, 'tutor-documents select policy required');

  // INSERT: tutor role, single-folder path convention, own tutor_id as folder[1].
  assert.match(insert, /public\.current_profile_role\(\) = 'tutor'/);
  assert.match(insert, /array_length\(storage\.foldername\(name\), 1\) = 1/);
  assert.match(insert, /\(storage\.foldername\(name\)\)\[1\] = public\.current_tutor_id\(\)::text/);

  // SELECT: admin any, OR own folder.
  assert.match(select, /public\.current_profile_role\(\) = 'admin'/);
  assert.match(select, /\(storage\.foldername\(name\)\)\[1\] = public\.current_tutor_id\(\)::text/);

  // Documents are never edited -> no UPDATE/DELETE policy for this bucket.
  assert.ok(!policies.some((p) => /for update/.test(p)), 'no tutor-documents update policy');
  assert.ok(!policies.some((p) => /for delete/.test(p)), 'no tutor-documents delete policy');
});

// --- RPCs: SECURITY DEFINER + grants ----------------------------------------

test('all six RPCs are SECURITY DEFINER and pin search_path', () => {
  const rpcs = [
    ['upsert_tutor_application', /returns public\.tutor_applications/],
    ['submit_tutor_application', /returns public\.tutor_applications/],
    ['decide_tutor_application', /returns public\.tutor_applications/],
    ['record_tutor_document', /returns public\.tutor_documents/],
    ['verify_tutor_document', /returns public\.tutor_documents/],
    ['replace_tutor_availability', /returns setof public\.tutor_availability_slots/],
  ];
  for (const [name, returnsRe] of rpcs) {
    const body = functionBody(name);
    assert.match(body, returnsRe, `${name} return type`);
    assert.match(body, /security definer/, `${name} must be security definer`);
    assert.match(body, /set search_path = public/, `${name} must pin search_path`);
  }
});

test('all six RPCs are granted execute to authenticated (each self-gates internally)', () => {
  assert.match(schema, /grant execute on function public\.upsert_tutor_application\(jsonb, jsonb, jsonb, jsonb, text, text\) to authenticated/);
  assert.match(schema, /grant execute on function public\.submit_tutor_application\(\) to authenticated/);
  assert.match(schema, /grant execute on function public\.decide_tutor_application\(uuid, text, text\) to authenticated/);
  assert.match(schema, /grant execute on function public\.record_tutor_document\(text, text, text, text, int\) to authenticated/);
  assert.match(schema, /grant execute on function public\.verify_tutor_document\(uuid, text, text\) to authenticated/);
  assert.match(schema, /grant execute on function public\.replace_tutor_availability\(jsonb\) to authenticated/);
});

// --- RPC bodies: the business rules -----------------------------------------

test('upsert_tutor_application: tutor-scoped + the exact approved->changes_requested revert rule', () => {
  const body = functionBody('upsert_tutor_application');
  assert.match(body, /v_tutor_id uuid := public\.current_tutor_id\(\)/);
  assert.match(body, /raise exception 'forbidden'/);
  assert.match(body, /on conflict \(tutor_id\) do update set/);
  // The critical rule: an approved application reverts to changes_requested on edit.
  assert.match(
    body,
    /status = case when tutor_applications\.status = 'approved' then 'changes_requested' else tutor_applications\.status end/,
  );
  assert.match(body, /updated_at = now\(\)/);
});

test('submit_tutor_application: tutor-scoped submit gate (allowed-from set incl. submitted = idempotent)', () => {
  const body = functionBody('submit_tutor_application');
  assert.match(body, /v_tutor_id uuid := public\.current_tutor_id\(\)/);
  assert.match(body, /set status = 'submitted'/);
  assert.match(body, /submitted_at = coalesce\(submitted_at, now\(\)\)/);
  assert.match(body, /and status in \('draft', 'changes_requested', 'rejected', 'submitted'\)/);
  assert.match(body, /raise exception 'application_not_found'/);
});

test('decide_tutor_application: admin-gated, enum-validated, with the full approval cascade', () => {
  const body = functionBody('decide_tutor_application');
  // Admin only + reviewer id is the acting profile.
  assert.match(body, /if not public\.is_platform_admin\(\) then/);
  assert.match(body, /v_admin uuid := public\.current_profile_id\(\)/);
  // Same enum as TutorApplicationDecisionSchema.
  assert.match(body, /p_status not in \('under_review', 'approved', 'rejected', 'changes_requested'\)/);
  // Application row always updated.
  assert.match(body, /set status = p_status,\s*reviewed_by = v_admin,\s*reviewed_at = now\(\),\s*review_note = p_note/);
  assert.match(body, /raise exception 'application_not_found'/);
  // Approval branch: the full cascade onto public.tutors.
  assert.match(body, /if p_status = 'approved' then/);
  assert.match(body, /approval_status = 'approved'/);
  // coalesce() must NOT overwrite an existing band.
  assert.match(body, /qualification_band = coalesce\(qualification_band, 'BOTH'\)/);
  // Qualification/prefs copied from the application row.
  assert.match(body, /qualified_subjects_json = v_row\.subjects_json/);
  assert.match(body, /teaching_preferences_json = v_row\.teaching_preferences_json/);
  // Flips operational: status = 'active' (the record_status collapse of ACTIVE+active).
  assert.match(body, /status = 'active'/);
  // The operational flip only happens in the approval branch: status='active' and
  // qualification_band each appear exactly once in the body (not in the else branch).
  assert.equal((body.match(/status = 'active'/g) || []).length, 1, 'status=active only in approval branch');
  assert.equal((body.match(/qualification_band = coalesce/g) || []).length, 1, 'qualification set only on approval');
  // Non-approval branch updates only approval_status = p_status.
  assert.match(body, /set approval_status = p_status/);
});

test('record_tutor_document: tutor-scoped, enum-validated, storage_key ownership-scoped', () => {
  const body = functionBody('record_tutor_document');
  assert.match(body, /v_tutor_id uuid := public\.current_tutor_id\(\)/);
  assert.match(body, /p_document_type not in \('identity', 'cv', 'qualification', 'additional'\)/);
  assert.match(body, /p_mime_type not in \('application\/pdf', 'image\/jpeg', 'image\/png'\)/);
  // Defense in depth: metadata row can only point at the caller's own folder.
  assert.match(body, /starts_with\(coalesce\(p_storage_key, ''\), v_tutor_id::text \|\| '\/'\)/);
  assert.match(body, /insert into public\.tutor_documents/);
  assert.match(body, /\(v_tutor_id, p_document_type, p_storage_key, p_original_filename, p_mime_type, p_file_size_bytes\)/);
});

test('verify_tutor_document: admin-gated, status enum, sets verified_by/at, not-found', () => {
  const body = functionBody('verify_tutor_document');
  assert.match(body, /if not public\.is_platform_admin\(\) then/);
  assert.match(body, /p_status not in \('accepted', 'rejected'\)/);
  assert.match(body, /verification_status = p_status/);
  assert.match(body, /verified_by = public\.current_profile_id\(\)/);
  assert.match(body, /verified_at = now\(\)/);
  assert.match(body, /raise exception 'document_not_found'/);
});

test('replace_tutor_availability: tutor-scoped delete-all-then-insert with Zod-bound validation', () => {
  const body = functionBody('replace_tutor_availability');
  assert.match(body, /v_tutor_id uuid := public\.current_tutor_id\(\)/);
  // Full replace: delete all the caller's slots first.
  assert.match(body, /delete from public\.tutor_availability_slots where tutor_id = v_tutor_id/);
  // Bounds per TutorAvailabilitySchema.
  assert.match(body, /jsonb_array_length\(p_slots\) > 42/);
  assert.match(body, /v_day < 0 or v_day > 6/);
  assert.match(body, /v_end <= v_start/);
  assert.match(body, /char_length\(v_mode\) < 1 or char_length\(v_mode\) > 40/);
  assert.match(body, /char_length\(v_notes\) > 500/);
  assert.match(body, /insert into public\.tutor_availability_slots/);
});

// --- Third deferred-loop closure: session/finance tutor-active check ---------

test('the five session/finance RPCs now require approval_status = approved (not just status = active)', () => {
  const rpcs = ['create_session', 'update_session', 'submit_session_report', 'submit_session', 'approve_session'];
  for (const name of rpcs) {
    const body = functionBody(name);
    // The upgraded check: status = 'active' AND approval_status = 'approved'.
    assert.match(
      body,
      /and t\.status = 'active' and t\.approval_status = 'approved'\) then/,
      `${name} must check approval_status = 'approved' in addition to status = 'active'`,
    );
    // The old bare check (status only) must be gone from this function.
    assert.ok(
      !/and t\.status = 'active'\) then/.test(body),
      `${name} must no longer carry the status-only tutor-active check`,
    );
  }
});
