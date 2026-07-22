const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Regression guard for a real bug found while verifying the sessions repoint
// (not a design decision): ANY RLS policy that reads public.profiles (raw, not
// through a SECURITY DEFINER helper) from within a chain that can loop back
// to the SAME relation's own policy evaluation raises "infinite recursion
// detected in policy for relation ...", CONFIRMED by direct testing against a
// real local Postgres instance -- and this happens regardless of SECURITY
// DEFINER, the calling role's BYPASSRLS attribute, or an explicit
// `set local row_security = off` inside the function (all three were tried
// and all three still recursed). This affected public.profiles' own
// self-referencing policies, and cascaded into public.tutors, public.students,
// public.student_career_profiles, public.student_progress,
// public.assignment_submissions, and three storage.objects policies -- every
// one of them had a raw join into public.profiles embedded directly in a
// policy instead of going through current_profile_id()/current_profile_role()/
// current_student_id()/current_tutor_id().
//
// The fix: those four helper functions (plus current_org_ids/
// current_student_org_id/current_org_role) now resolve auth_user_id via
// public.profile_identities -- a tiny denormalized table with NO RLS at all,
// kept in sync via a trigger on public.profiles, reachable only through these
// SECURITY DEFINER functions (table privileges are revoked from anon/
// authenticated). Every policy that used to embed a raw profiles/students/
// tutors subquery now calls one of these functions instead.
//
// This class of bug is INVISIBLE to the schema-vs-regex tests the rest of
// tests/frontend/*.test.cjs uses -- static text matching cannot detect
// runtime recursion. These tests instead assert the STRUCTURAL invariant that
// prevents it: no `create policy` anywhere in the schema may contain a raw
// join/subquery into public.profiles, public.students, or public.tutors --
// only calls to the safe current_*() functions are allowed.

const repoRoot = path.resolve(__dirname, '..', '..');
const schema = fs.readFileSync(
  path.join(repoRoot, 'docs', 'supabase', 'schema.sql'),
  'utf8',
);

function functionBody(name) {
  const start = schema.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `expected function public.${name} to be defined`);
  const rest = schema.slice(start);
  const end = rest.indexOf('$$;');
  assert.notEqual(end, -1, `expected function public.${name} to terminate with $$;`);
  return rest.slice(0, end + 3);
}

// Extracts every `create policy ... ( ... );` statement in the file, in full,
// including any leading `for select/insert/...`/`using`/`with check` clauses.
function allPolicyBlocks() {
  const blocks = [];
  // Schema.sql is checked out with CRLF line endings; match \r?\n throughout.
  const re = /create policy "?[\w-]+"?\s*\r?\n\s*on\s+[\w.]+[\s\S]*?;/g;
  let match;
  while ((match = re.exec(schema)) !== null) {
    blocks.push(match[0]);
  }
  return blocks;
}

test('public.profile_identities exists: no RLS, revoked from anon/authenticated, kept in sync via trigger', () => {
  assert.match(schema, /create table if not exists public\.profile_identities \(/);
  assert.match(schema, /auth_user_id uuid primary key references auth\.users\(id\) on delete cascade/);
  assert.match(schema, /profile_id uuid not null references public\.profiles\(id\) on delete cascade/);
  assert.match(schema, /role public\.user_role not null/);

  // Deliberately NOT `alter table ... enable row level security` -- this
  // table has no RLS at all (see header comment), not "RLS enabled with deny-all".
  const rlsEnableLines = schema.match(/alter table public\.\w+ enable row level security;/g) || [];
  assert.ok(
    !rlsEnableLines.some((line) => line.includes('profile_identities')),
    'profile_identities must NOT have RLS enabled (by design -- see header comment)',
  );

  assert.match(schema, /revoke all on public\.profile_identities from anon, authenticated;/);

  const triggerBody = functionBody('sync_profile_identity');
  assert.match(triggerBody, /security definer/);
  assert.match(triggerBody, /insert into public\.profile_identities/);
  assert.match(triggerBody, /on conflict \(auth_user_id\) do update set/);
  assert.match(triggerBody, /delete from public\.profile_identities where profile_id = old\.id/);
  assert.match(schema, /create trigger trg_sync_profile_identity\s*\n\s*after insert or update of auth_user_id, role or delete on public\.profiles/);

  // One-time backfill for rows that predate the trigger.
  assert.match(schema, /insert into public\.profile_identities \(auth_user_id, profile_id, role\)\s*\nselect auth_user_id, id, role from public\.profiles/);
});

test('all seven identity/org helper functions resolve via profile_identities, never a raw join into profiles', () => {
  for (const name of ['current_profile_role', 'current_profile_id', 'current_student_id', 'current_tutor_id', 'current_org_ids', 'current_student_org_id', 'current_org_role']) {
    const body = functionBody(name);
    assert.ok(
      !/join public\.profiles|from public\.profiles\b/.test(body),
      `${name} must not read public.profiles directly -- it must go through public.profile_identities`,
    );
    assert.match(body, /public\.profile_identities/, `${name} must reference public.profile_identities`);
  }
});

test('no RLS policy anywhere embeds a raw join/subquery into profiles, students, or tutors', () => {
  const blocks = allPolicyBlocks();
  assert.ok(blocks.length > 50, 'sanity check: expected to find many policy blocks in the schema');

  const offenders = [];
  for (const block of blocks) {
    if (/join public\.profiles|from public\.profiles\b/.test(block)) {
      offenders.push(block.split('\n')[0]);
    }
  }
  assert.deepEqual(offenders, [], `these policies embed a raw join into public.profiles (must use current_profile_id()/current_profile_role() instead): ${offenders.join(', ')}`);
});

test('the four previously-broken table policies (students, tutors, student_career_profiles, student_progress, assignment_submissions, storage) now use the safe helper functions', () => {
  const mustUseHelpers = [
    'students_select_self_or_admin',
    'students_insert_self',
    'tutors_select_self_or_admin',
    'tutors_insert_self_pending',
    'students_select_own_career_profile',
    'students_upsert_own_career_profile',
    'tutors_select_own_assignment_submissions',
    'student_progress_self_or_admin',
    'students_upload_own_submission_files',
    'students_update_own_submission_files',
    'students_read_own_submission_files_or_admin',
  ];
  const blocks = allPolicyBlocks();
  for (const name of mustUseHelpers) {
    const block = blocks.find((b) => b.includes(`"${name}"`));
    assert.ok(block, `expected to find policy ${name}`);
    assert.match(block, /public\.current_(profile_id|profile_role|student_id|tutor_id)\(\)/, `${name} must use a current_*() helper`);
  }
});

test('base table privileges are granted to anon/authenticated/service_role (a real deployment gap, not implicit)', () => {
  assert.match(schema, /grant usage on schema public to anon, authenticated, service_role;/);
  assert.match(schema, /grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;/);
  assert.match(schema, /alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;/);
});
