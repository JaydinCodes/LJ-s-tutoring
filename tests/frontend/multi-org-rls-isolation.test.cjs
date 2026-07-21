const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const schema = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'docs', 'supabase', 'schema.sql'),
  'utf8',
);

// Statements in schema.sql are separated by at least one blank line, and none
// of the (pre-existing or newly-added) single policy statements contain an
// internal blank line, so splitting on blank lines gives us one chunk per
// statement. This lets us assert what a specific table's policies do (or,
// critically, do NOT) grant, without a full SQL parser.
const statements = schema.split(/\n\s*\n/);

function policyStatementsForTable(table) {
  const onClause = new RegExp(`\\bon public\\.${table}\\b`);
  return statements
    .filter((chunk) => /create policy/.test(chunk) && onClause.test(chunk))
    // Drop any leading comment lines: what a policy actually grants is its
    // using()/with check() body, not prose in a preceding comment that may
    // (for good reason) name a role it explicitly excludes.
    .map((chunk) => chunk.slice(chunk.indexOf('create policy')));
}

test('Phase 2 org helper functions exist, matching the style of the existing current_* helpers', () => {
  assert.match(
    schema,
    /create or replace function public\.current_org_ids\(\)\s*\nreturns setof uuid\s*\nlanguage sql\s*\nstable\s*\nsecurity definer\s*\nset search_path = public/,
  );
  assert.match(schema, /from public\.organization_members om[\s\S]*?om\.status = 'active'/);

  assert.match(
    schema,
    /create or replace function public\.current_student_org_id\(\)\s*\nreturns uuid\s*\nlanguage sql\s*\nstable\s*\nsecurity definer\s*\nset search_path = public/,
  );
  assert.match(schema, /select s\.organization_id\s*\n\s*from public\.students s/);

  assert.match(
    schema,
    /create or replace function public\.current_org_role\(org uuid\)\s*\nreturns public\.org_member_role\s*\nlanguage sql\s*\nstable\s*\nsecurity definer\s*\nset search_path = public/,
  );

  assert.match(
    schema,
    /create or replace function public\.is_platform_admin\(\)\s*\nreturns boolean\s*\nlanguage sql\s*\nstable\s*\nsecurity definer\s*\nset search_path = public/,
  );
  assert.match(schema, /create or replace function public\.is_platform_admin[\s\S]*?current_profile_role\(\) = 'admin'/);
});

test('a composite index backs the org-role/membership lookup the new helpers run on every row check', () => {
  assert.match(
    schema,
    /create index if not exists idx_organization_members_profile_org_status\s*\n\s*on public\.organization_members\(profile_id, organization_id, status\)/,
  );
  // Phase 1 indexes the helpers and org-scoped policies also depend on must
  // still be present (confirmed, not re-added).
  assert.match(schema, /idx_organization_members_profile on public\.organization_members\(profile_id, status\)/);
  assert.match(schema, /idx_organization_members_org_role on public\.organization_members\(organization_id, org_role\)/);
  assert.match(schema, /idx_students_organization on public\.students\(organization_id\)/);
  assert.match(schema, /idx_classes_organization on public\.classes\(organization_id\)/);
  assert.match(schema, /idx_assignments_organization on public\.assignments\(organization_id\)/);
});

test('organizations and organization_members now have RLS enabled with real policies (Phase 1 deliberately left this off)', () => {
  assert.match(schema, /alter table public\.organizations enable row level security;/);
  assert.match(schema, /alter table public\.organization_members enable row level security;/);
  assert.match(schema, /create policy "organizations_select_member_or_admin"/);
  assert.match(schema, /create policy "admin_manage_organizations"/);
  assert.match(schema, /create policy "organization_members_select_scoped"/);
  assert.match(schema, /create policy "organization_members_coordinator_manage"/);
  assert.match(schema, /create policy "admin_manage_organization_members"/);
});

test('coordinators cannot self-escalate or manage other coordinators via organization_members', () => {
  const block = statements.find((chunk) => /create policy "organization_members_coordinator_manage"/.test(chunk));
  assert.ok(block, 'organization_members_coordinator_manage policy must exist');
  assert.match(block, /current_org_role\(organization_id\) = 'coordinator'/);
  // Guard must appear in both using() and with check() (select/update/delete
  // visibility as well as insert/update values), so count >= 2.
  const guardMatches = block.match(/org_role <> 'coordinator'/g) || [];
  assert.ok(guardMatches.length >= 2, 'coordinator-role exclusion guard must apply to both using() and with check()');
});

test('classes and assignments get an org-scoped read policy plus a coordinator-manage policy, additive alongside existing policies', () => {
  assert.match(schema, /create policy "classes_org_scoped_read"/);
  assert.match(schema, /create policy "classes_coordinator_manage"/);
  assert.match(schema, /create policy "assignments_org_scoped_read"/);
  assert.match(schema, /create policy "assignments_coordinator_manage"/);

  for (const name of ['classes_org_scoped_read', 'assignments_org_scoped_read']) {
    const block = statements.find((chunk) => chunk.includes(`create policy "${name}"`));
    assert.ok(block, `${name} must exist`);
    assert.match(block, /organization_id in \(select public\.current_org_ids\(\)\)/);
    assert.match(block, /public\.is_platform_admin\(\)/);
  }
  for (const name of ['classes_coordinator_manage', 'assignments_coordinator_manage']) {
    const block = statements.find((chunk) => chunk.includes(`create policy "${name}"`));
    assert.ok(block, `${name} must exist`);
    assert.match(block, /current_org_role\(organization_id\) = 'coordinator'/);
    assert.match(block, /public\.is_platform_admin\(\)/);
  }

  // Pre-existing policies on these tables must be untouched by this pass.
  assert.match(schema, /create policy "classes_select_scoped"/);
  assert.match(schema, /create policy "admin_manage_classes"/);
  assert.match(schema, /create policy "tutors_manage_own_assignments"/);
  assert.match(schema, /create policy "admin_manage_assignments"/);
});

test('students get an additive coordinator-scoped policy, but NOT a blanket any-org-member read (PII, unlike classes/assignments)', () => {
  const block = statements.find((chunk) => chunk.includes('create policy "students_coordinator_org_manage"'));
  assert.ok(block, 'students_coordinator_org_manage must exist');
  assert.match(block, /current_org_role\(organization_id\) = 'coordinator'/);
  assert.match(block, /public\.is_platform_admin\(\)/);

  // No new policy on students may grant access via bare org membership
  // (current_org_ids()) — that would hand any org member (including a
  // partner_viewer) direct row access to raw learner PII.
  const studentPolicies = policyStatementsForTable('students');
  for (const block2 of studentPolicies) {
    assert.doesNotMatch(
      block2,
      /current_org_ids\(\)/,
      'no students policy may grant blanket org-membership read access',
    );
  }

  // Pre-existing student policies untouched.
  assert.match(schema, /create policy "students_select_self_or_admin"/);
  assert.match(schema, /create policy "admin_full_access_students"/);
});

test('Phase 2 step 2 cutover: the draft/cross-org assignment over-exposure bug is now fixed (assignments_read_authenticated removed, scoped replacement added)', () => {
  // The over-permissive policy must be gone — no create statement, and an
  // explicit drop so existing databases lose it on apply too.
  assert.doesNotMatch(schema, /create policy "assignments_read_authenticated"/);
  assert.match(schema, /drop policy if exists "assignments_read_authenticated" on public\.assignments;/);

  // Its replacement must exist and scope to published assignments in the
  // student's OWN org (closing both the draft-exposure and cross-org axes).
  const block = statements.find((chunk) =>
    chunk.includes('create policy "assignments_student_read_published_own_org"'),
  );
  assert.ok(block, 'assignments_student_read_published_own_org must exist');
  assert.match(block, /on public\.assignments for select/);
  assert.match(block, /status = 'published'/);
  assert.match(block, /organization_id = public\.current_student_org_id\(\)/);
});

test('Phase 2 step 2 cutover: fill_organization_id() trigger function exists and is attached to all three org-scoped tables', () => {
  // Single reusable SECURITY DEFINER trigger function.
  assert.match(
    schema,
    /create or replace function public\.fill_organization_id\(\)\s*\nreturns trigger\s*\nlanguage plpgsql\s*\nsecurity definer\s*\nset search_path = public/,
  );
  const fnMatch = schema.match(/create or replace function public\.fill_organization_id\(\)[\s\S]*?\n\$\$;/);
  assert.ok(fnMatch, 'fill_organization_id function body must be present');
  const fn = fnMatch[0];
  // Fallback precedence: explicit value, then ngo_partner_id (students/classes),
  // then creator org via active membership, then the seeded direct org.
  assert.match(fn, /if new\.organization_id is not null then/);
  assert.match(fn, /tg_table_name in \('students', 'classes'\) and new\.ngo_partner_id is not null/);
  assert.match(fn, /new\.organization_id := new\.ngo_partner_id/);
  assert.match(fn, /from public\.organization_members om[\s\S]*?om\.status = 'active'/);
  assert.match(fn, /where type = 'direct'/);

  // Attached BEFORE INSERT to each of the three tables.
  for (const table of ['students', 'classes', 'assignments']) {
    const trigRe = new RegExp(
      `create trigger trg_fill_organization_id\\s*\\n\\s*before insert on public\\.${table}\\s*\\n\\s*for each row execute function public\\.fill_organization_id\\(\\);`,
    );
    assert.match(schema, trigRe, `trigger must be attached before insert on ${table}`);
  }
});

test('Phase 2 step 2 cutover: organization_id is NOT NULL on students, classes, and assignments', () => {
  for (const table of ['students', 'classes', 'assignments']) {
    const alterRe = new RegExp(
      `alter table public\\.${table} alter column organization_id set not null;`,
    );
    assert.match(schema, alterRe, `organization_id must be set NOT NULL on ${table}`);
  }
});

test('partner_viewer has zero direct SELECT policies on students, assignment_submissions, student_progress, or guardians', () => {
  for (const table of ['students', 'assignment_submissions', 'student_progress', 'guardians']) {
    const blocks = policyStatementsForTable(table);
    assert.ok(blocks.length > 0, `expected at least one policy on ${table}`);
    for (const block of blocks) {
      assert.doesNotMatch(
        block,
        /partner_viewer/,
        `no policy on public.${table} may reference partner_viewer directly`,
      );
    }
  }
});

test('get_org_cohort_report is a SECURITY DEFINER aggregate-only RPC gated on active partner_viewer membership', () => {
  assert.match(schema, /create or replace function public\.get_org_cohort_report\(p_org_id uuid\)/);
  const fnMatch = schema.match(/create or replace function public\.get_org_cohort_report\(p_org_id uuid\)[\s\S]*?\n\$\$;/);
  assert.ok(fnMatch, 'get_org_cohort_report function body must be present');
  const fn = fnMatch[0];

  assert.match(fn, /security definer/);
  assert.match(fn, /om\.org_role = 'partner_viewer'/);
  assert.match(fn, /om\.status = 'active'/);
  assert.match(fn, /om\.organization_id = p_org_id/);
  assert.match(fn, /raise exception 'not_authorized'/);

  // Aggregates only: counts / averages / distributions, no learner names,
  // ids, or guardian contact fields.
  assert.doesNotMatch(fn, /full_name/);
  assert.doesNotMatch(fn, /parent_name/);
  assert.doesNotMatch(fn, /parent_contact/);
  assert.doesNotMatch(fn, /\bguardian/);
  assert.doesNotMatch(fn, /\bemail\b/);
  assert.doesNotMatch(fn, /\bphone\b/);
  assert.match(fn, /count\(\*\)/);
  assert.match(fn, /avg\(sp\.score\)/);

  assert.match(schema, /grant execute on function public\.get_org_cohort_report\(uuid\) to authenticated;/);
});

test('small-cohort suppression uses a named, configurable constant (not a bare magic number) and suppresses cohorts under 5', () => {
  const fnMatch = schema.match(/create or replace function public\.get_org_cohort_report\(p_org_id uuid\)[\s\S]*?\n\$\$;/);
  const fn = fnMatch[0];

  assert.match(fn, /v_min_cohort_size\s+constant\s+int\s*:=\s*5/, 'suppression threshold must be a named constant, not an inline literal in the comparison');
  assert.match(fn, /if v_learner_count < v_min_cohort_size then/);
  assert.match(fn, /'suppressed', true/);
  assert.match(fn, /'suppressed', false/);
  assert.doesNotMatch(fn, /if v_learner_count < 5 then/, 'the comparison itself must use the named constant, not a bare 5');
});

test('platform admin retains cross-org access on every new Phase 2 policy', () => {
  const newPolicies = [
    'organizations_select_member_or_admin',
    'admin_manage_organizations',
    'organization_members_select_scoped',
    'organization_members_coordinator_manage',
    'admin_manage_organization_members',
    'students_coordinator_org_manage',
    'classes_org_scoped_read',
    'classes_coordinator_manage',
    'assignments_org_scoped_read',
    'assignments_coordinator_manage',
  ];
  for (const name of newPolicies) {
    const block = statements.find((chunk) => chunk.includes(`create policy "${name}"`));
    assert.ok(block, `${name} must exist`);
    assert.match(block, /public\.is_platform_admin\(\)/, `${name} must preserve platform-admin cross-org access`);
  }
});

test('nothing pre-existing was removed: submission-insert bypass fix and prior RLS-critical policies remain in place', () => {
  assert.doesNotMatch(schema, /create policy "submissions_student_rpc_insert_shape"/);
  assert.match(schema, /create policy "submissions_student_insert_via_rpc_guard"/);
  assert.match(schema, /create policy "submissions_no_direct_student_update"/);
  assert.match(schema, /create policy "submissions_tutor_mark_via_rpc_only"/);
  assert.match(schema, /create policy "admin_manage_submissions"/);
  assert.match(schema, /create policy "tutors_select_own_assignment_submissions"/);
});
