const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// PRISMA_TO_SUPABASE_MIGRATION_PLAN.md §2: the `sessions` linchpin migration.
// These static-analysis tests (matching the existing regex-against-schema.sql
// pattern) lock the schema, RLS, and SECURITY DEFINER RPC layer that ports the
// Fastify session business logic into Supabase: the org-from-student trigger,
// the no-direct-writes RLS shape, the state-machine RPCs, the append-only
// history mirror, the pay-period-lock stub, and the student read path's
// exclusion of tutor/admin-only financial/internal columns.

const repoRoot = path.resolve(__dirname, '..', '..');
const schema = fs.readFileSync(
  path.join(repoRoot, 'docs', 'supabase', 'schema.sql'),
  'utf8',
);

// schema.sql statements are separated by blank lines and no single table/policy
// statement has an internal blank line, so this isolates whole statements.
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

// Extract a SECURITY DEFINER / SQL function body: from its `create or replace
// function public.<name>(` header to the terminating `$$;`.
function functionBody(name) {
  const start = schema.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `expected function public.${name} to be defined`);
  const rest = schema.slice(start);
  const end = rest.indexOf('$$;');
  assert.notEqual(end, -1, `expected function public.${name} to terminate with $$;`);
  return rest.slice(0, end + 3);
}

test('session_status enum is lowercase, matching the schema convention', () => {
  assert.match(
    schema,
    /create type public\.session_status as enum \('draft', 'submitted', 'approved', 'rejected'\)/,
  );
});

test('sessions table exists, org-scoped (organization_id NOT NULL), with the ported columns', () => {
  const block = tableBlock('sessions');
  assert.ok(block, 'sessions create-table block must exist');
  assert.match(block, /organization_id uuid not null references public\.organizations\(id\)/);
  assert.match(block, /tutor_id uuid not null references public\.tutors\(id\)/);
  assert.match(block, /student_id uuid not null references public\.students\(id\)/);
  // Replaces Prisma's assignment_id; must NOT reuse the taken `assignment_id` name.
  assert.match(block, /tutor_student_allocation_id uuid not null references public\.tutor_student_allocations\(id\)/);
  // No COLUMN named assignment_id (the taken homework-assignments name). A
  // column definition starts at the line head; prose mentioning it is fine.
  assert.doesNotMatch(block, /^\s*assignment_id\s/m);
  assert.match(block, /status public\.session_status not null default 'draft'/);
  assert.match(block, /attendance_status is null or attendance_status in \('present', 'absent', 'late', 'excused'\)/);
  // Tutor/admin-only financial/internal columns exist on the table itself.
  assert.match(block, /tutor_private_notes text/);
  assert.match(block, /report_review_note text/);
  assert.match(block, /payout_override boolean not null default false/);
});

test('session_history table exists, org-agnostic append-only mirror with the change_type set', () => {
  const block = tableBlock('session_history');
  assert.ok(block, 'session_history create-table block must exist');
  assert.match(block, /session_id uuid not null references public\.sessions\(id\)/);
  assert.match(block, /changed_by_profile_id uuid references public\.profiles\(id\)/);
  assert.match(block, /before_json jsonb/);
  assert.match(block, /after_json jsonb/);
  assert.match(block, /change_type in \('create', 'edit', 'report_update', 'submit', 'approve', 'reject'\)/);
});

test('sessions has the required indexes incl. the partial unique idempotency index', () => {
  assert.match(schema, /create index if not exists idx_sessions_tutor_date on public\.sessions\(tutor_id, date\)/);
  assert.match(schema, /create index if not exists idx_sessions_student_date on public\.sessions\(student_id, date desc, start_time desc\)/);
  assert.match(schema, /create index if not exists idx_sessions_organization on public\.sessions\(organization_id\)/);
  assert.match(
    schema,
    /create unique index if not exists idx_sessions_tutor_sync_key on public\.sessions\(tutor_id, sync_key\) where sync_key is not null/,
  );
});

test('dedicated fill_session_organization_id() derives org from the STUDENT, not the generic fallback chain', () => {
  const body = functionBody('fill_session_organization_id');
  assert.match(body, /security definer/);
  assert.match(body, /set search_path = public/);
  // Derives from students.organization_id for new.student_id.
  assert.match(body, /from public\.students/);
  assert.match(body, /where id = new\.student_id/);
  assert.match(body, /new\.organization_id := v_org/);
  // Raises rather than silently defaulting to `direct` when the lookup is null.
  assert.match(body, /raise exception 'session_org_unresolved'/);
  // Must NOT reuse the generic multi-org fallback chain (ngo_partner_id ->
  // organization_members creator org -> direct org).
  assert.doesNotMatch(body, /ngo_partner_id/);
  assert.doesNotMatch(body, /organization_members/);
  assert.doesNotMatch(body, /type = 'direct'/);
  // And a dedicated before-insert trigger is wired to it (NOT the generic one).
  assert.match(
    schema,
    /create trigger trg_fill_session_organization_id\s*\n\s*before insert on public\.sessions\s*\n\s*for each row execute function public\.fill_session_organization_id\(\)/,
  );
});

test('sessions never uses the generic fill_organization_id() trigger', () => {
  assert.doesNotMatch(
    schema,
    /create trigger[\s\S]*?on public\.sessions[\s\S]*?execute function public\.fill_organization_id\(\)/,
  );
});

test('pay-period-lock check exists, returns boolean, and is now WIRED UP to pay_periods', () => {
  // The finance/payroll migration un-stubbed this: it no longer returns a bare
  // `false`; it looks up pay_periods.status for the date's Monday week-start.
  const body = functionBody('session_date_pay_period_locked');
  assert.match(body, /returns boolean/);
  assert.doesNotMatch(body, /select false/);
  assert.match(body, /public\.pay_periods/);
  assert.match(body, /status = 'locked'/);
  assert.match(body, /date_trunc\('week'/);
  // The preceding comment now reflects that the loop is closed, not open.
  const start = schema.indexOf('create or replace function public.session_date_pay_period_locked(');
  const preamble = schema.slice(Math.max(0, start - 1600), start);
  assert.match(preamble, /WIRED UP by the finance\/payroll migration/);
});

test('every state-mutating RPC references the pay-period-lock stub at its check point', () => {
  for (const rpc of ['create_session', 'update_session', 'submit_session', 'approve_session', 'reject_session']) {
    assert.match(
      functionBody(rpc),
      /public\.session_date_pay_period_locked\(/,
      `${rpc} must call the pay-period-lock stub`,
    );
  }
});

test('all six mutation RPCs + student read + internal history helper are SECURITY DEFINER', () => {
  const definerRpcs = [
    ['create_session', /returns public\.sessions/],
    ['update_session', /returns public\.sessions/],
    ['submit_session_report', /returns public\.sessions/],
    ['submit_session', /returns public\.sessions/],
    ['approve_session', /returns public\.sessions/],
    ['reject_session', /returns public\.sessions/],
    ['get_student_sessions', /returns table/],
    ['insert_session_history', /returns uuid/],
  ];
  for (const [name, returnsRe] of definerRpcs) {
    const body = functionBody(name);
    assert.match(body, returnsRe, `${name} return type`);
    assert.match(body, /security definer/, `${name} must be security definer`);
    assert.match(body, /set search_path = public/, `${name} must pin search_path`);
  }
});

test('mutation RPCs resolve identity internally (never a client-supplied tutor/admin id)', () => {
  // Tutor RPCs use current_tutor_id(); admin RPCs use is_platform_admin(). None
  // takes a tutor-id/admin-id parameter (replicating rbac.ts self-scope).
  for (const rpc of ['create_session', 'update_session', 'submit_session_report', 'submit_session']) {
    assert.match(functionBody(rpc), /current_tutor_id\(\)/, `${rpc} must resolve tutor via current_tutor_id()`);
  }
  for (const rpc of ['approve_session', 'reject_session']) {
    assert.match(functionBody(rpc), /is_platform_admin\(\)/, `${rpc} must gate on is_platform_admin()`);
  }
  assert.doesNotMatch(functionBody('create_session'), /p_tutor_id\b/);
});

test('RPCs raise Fastify-parity distinct error codes for each precondition', () => {
  assert.match(functionBody('create_session'), /assignment_inactive/);
  assert.match(functionBody('create_session'), /outside_assignment_window/);
  assert.match(functionBody('create_session'), /invalid_duration_minutes/);
  assert.match(functionBody('create_session'), /overlapping_session/);
  assert.match(functionBody('update_session'), /only_draft_editable/);
  assert.match(functionBody('submit_session'), /only_draft_submittable/);
  assert.match(functionBody('approve_session'), /only_submitted_approvable/);
  assert.match(functionBody('reject_session'), /only_submitted_rejectable/);
});

test('state machine: each transition RPC logs the matching history change_type', () => {
  assert.match(functionBody('create_session'), /insert_session_history\(v_session\.id, 'create'/);
  assert.match(functionBody('update_session'), /insert_session_history\(p_session_id, 'edit'/);
  assert.match(functionBody('submit_session_report'), /insert_session_history\(p_session_id, 'report_update'/);
  assert.match(functionBody('submit_session'), /insert_session_history\(p_session_id, 'submit'/);
  assert.match(functionBody('approve_session'), /insert_session_history\(p_session_id, 'approve'/);
  // reject folds the reason into after_json (Fastify's { ...updated, reject_reason }).
  assert.match(functionBody('reject_session'), /'reject'[\s\S]*?jsonb_build_object\('reject_reason'/);
});

test('reject/approve gate on submitted; submit/update/report gate on draft', () => {
  assert.match(functionBody('submit_session'), /v_current\.status <> 'draft'/);
  assert.match(functionBody('update_session'), /v_current\.status <> 'draft'/);
  assert.match(functionBody('submit_session_report'), /v_current\.status <> 'draft'/);
  assert.match(functionBody('approve_session'), /v_current\.status <> 'submitted'/);
  assert.match(functionBody('reject_session'), /v_current\.status <> 'submitted'/);
});

test('get_student_sessions() excludes tutor/admin-only financial & internal columns', () => {
  const body = functionBody('get_student_sessions');
  assert.match(body, /where s\.student_id = public\.current_student_id\(\)/);
  for (const forbidden of ['tutor_private_notes', 'report_review_note', 'payout_override', 'sync_key', 'approved_by', 'notes']) {
    assert.ok(
      !body.includes(forbidden),
      `get_student_sessions must not expose ${forbidden} to students`,
    );
  }
  // But it DOES carry the student-safe fields.
  assert.match(body, /student_summary/);
  assert.match(body, /attendance_status/);
  assert.match(body, /homework_assigned/);
});

test('sessions RLS: SELECT scoped to admin + own-tutor only; NO student direct policy', () => {
  const policies = policyStatementsForTable('sessions');
  const selectPolicies = policies.filter((p) => /for select/.test(p));
  assert.ok(selectPolicies.length >= 2, 'expected admin + tutor select policies');
  assert.ok(
    selectPolicies.some((p) => /public\.is_platform_admin\(\)/.test(p)),
    'admin select policy required',
  );
  assert.ok(
    selectPolicies.some((p) => /tutor_id = public\.current_tutor_id\(\)/.test(p)),
    'tutor own-sessions select policy required',
  );
  // Students have ZERO direct policies: no policy on sessions may reference the
  // student identity helper.
  for (const p of policies) {
    assert.ok(
      !/current_student_id\(\)/.test(p),
      'no sessions policy may grant students direct access',
    );
  }
});

test('sessions RLS: no direct INSERT/UPDATE/DELETE is grantable (all via RPCs)', () => {
  const policies = policyStatementsForTable('sessions');
  const insert = policies.find((p) => /for insert/.test(p));
  const update = policies.find((p) => /for update/.test(p));
  const del = policies.find((p) => /for delete/.test(p));
  assert.ok(insert && /with check \(false\)/.test(insert), 'insert must be with check (false)');
  assert.ok(update && /using \(false\)/.test(update) && /with check \(false\)/.test(update), 'update must be using/with check (false)');
  assert.ok(del && /using \(false\)/.test(del), 'delete must be using (false)');
});

test('session_history RLS mirrors audit_log: admin-only select, no direct writes', () => {
  const policies = policyStatementsForTable('session_history');
  const select = policies.find((p) => /for select/.test(p));
  assert.ok(select && /public\.is_platform_admin\(\)/.test(select), 'admin-only select required');
  const insert = policies.find((p) => /for insert/.test(p));
  const update = policies.find((p) => /for update/.test(p));
  const del = policies.find((p) => /for delete/.test(p));
  assert.ok(insert && /with check \(false\)/.test(insert), 'no direct history insert');
  assert.ok(update && /using \(false\)/.test(update) && /with check \(false\)/.test(update), 'no direct history update');
  assert.ok(del && /using \(false\)/.test(del), 'no direct history delete');
});

test('insert_session_history is locked down like log_audit_event (execute revoked)', () => {
  for (const role of ['public', 'anon', 'authenticated']) {
    assert.match(
      schema,
      new RegExp(`revoke execute on function public\\.insert_session_history\\(uuid, text, jsonb, jsonb\\) from ${role}`),
    );
  }
});

test('the six mutation RPCs + student read are granted to authenticated', () => {
  assert.match(schema, /grant execute on function public\.create_session\(uuid, uuid, date, time, time, text, text, text, text\) to authenticated/);
  assert.match(schema, /grant execute on function public\.update_session\(uuid, date, time, time, text, text, text\) to authenticated/);
  assert.match(schema, /grant execute on function public\.submit_session_report\(uuid, text, text, text, text, text, text\) to authenticated/);
  assert.match(schema, /grant execute on function public\.submit_session\(uuid\) to authenticated/);
  assert.match(schema, /grant execute on function public\.approve_session\(uuid\) to authenticated/);
  assert.match(schema, /grant execute on function public\.reject_session\(uuid, text\) to authenticated/);
  assert.match(schema, /grant execute on function public\.get_student_sessions\(\) to authenticated/);
});
