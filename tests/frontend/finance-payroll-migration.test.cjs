const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// PRISMA_TO_SUPABASE_MIGRATION_PLAN.md §4/§6: the finance/payroll migration.
// These static-analysis tests (matching the existing regex-against-schema.sql
// pattern used by sessions-migration.test.cjs) lock the pay_periods /
// adjustments / invoices / invoice_lines schema, the finance RLS shape
// (admin-all, tutor-own SELECT, no direct writes), and the SECURITY DEFINER
// payroll RPC layer that ports the Fastify business logic. They also assert the
// sessions-migration `session_date_pay_period_locked` stub is now wired up to
// pay_periods (loop closed).

const repoRoot = path.resolve(__dirname, '..', '..');
const schema = fs.readFileSync(
  path.join(repoRoot, 'docs', 'supabase', 'schema.sql'),
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

function functionBody(name) {
  const start = schema.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `expected function public.${name} to be defined`);
  const rest = schema.slice(start);
  const end = rest.indexOf('$$;');
  assert.notEqual(end, -1, `expected function public.${name} to terminate with $$;`);
  return rest.slice(0, end + 3);
}

// --- Enums -----------------------------------------------------------------

test('the five finance enums exist, lowercase per this schema convention', () => {
  assert.match(schema, /create type public\.pay_period_status as enum \('open', 'locked'\)/);
  assert.match(schema, /create type public\.invoice_status as enum \('draft', 'issued', 'paid'\)/);
  assert.match(schema, /create type public\.adjustment_type as enum \('bonus', 'correction', 'penalty'\)/);
  assert.match(schema, /create type public\.adjustment_status as enum \('draft', 'approved'\)/);
  assert.match(schema, /create type public\.invoice_line_type as enum \('session', 'adjustment'\)/);
});

// --- Tables ----------------------------------------------------------------

test('pay_periods table: unique period_start_date, no organization_id, locked_by -> profiles', () => {
  const block = tableBlock('pay_periods');
  assert.ok(block, 'pay_periods create-table block must exist');
  assert.match(block, /period_start_date date not null unique/);
  assert.match(block, /period_end_date date not null/);
  assert.match(block, /status public\.pay_period_status not null default 'open'/);
  assert.match(block, /locked_at timestamptz/);
  assert.match(block, /locked_by uuid references public\.profiles\(id\)/);
  assert.match(block, /notes text/);
  // Deliberately NOT org-scoped (MULTI_ORG_MODEL_PLAN.md §9 defers this).
  assert.doesNotMatch(block, /organization_id/);
});

test('adjustments table: positive-amount check, profiles actor refs, indexes', () => {
  const block = tableBlock('adjustments');
  assert.ok(block, 'adjustments create-table block must exist');
  assert.match(block, /tutor_id uuid not null references public\.tutors\(id\)/);
  assert.match(block, /pay_period_id uuid not null references public\.pay_periods\(id\)/);
  assert.match(block, /type public\.adjustment_type not null/);
  // amount is always a positive magnitude; the sign is applied at read time.
  assert.match(block, /amount numeric\(12, 2\) not null check \(amount > 0\)/);
  assert.match(block, /reason text not null/);
  assert.match(block, /status public\.adjustment_status not null default 'approved'/);
  assert.match(block, /created_by uuid not null references public\.profiles\(id\)/);
  assert.match(block, /approved_by uuid references public\.profiles\(id\)/);
  assert.match(block, /voided_at timestamptz/);
  assert.match(block, /voided_by uuid references public\.profiles\(id\)/);
  assert.match(block, /void_reason text/);
  assert.match(block, /related_session_id uuid references public\.sessions\(id\)/);
  assert.doesNotMatch(block, /organization_id/);
  assert.match(schema, /create index if not exists idx_adjustments_tutor_pay_period on public\.adjustments\(tutor_id, pay_period_id\)/);
  assert.match(schema, /create index if not exists idx_adjustments_pay_period on public\.adjustments\(pay_period_id\)/);
});

test('invoices table: unique invoice_number, status default draft, index', () => {
  const block = tableBlock('invoices');
  assert.ok(block, 'invoices create-table block must exist');
  assert.match(block, /tutor_id uuid not null references public\.tutors\(id\)/);
  assert.match(block, /period_start date not null/);
  assert.match(block, /period_end date not null/);
  assert.match(block, /invoice_number text not null unique/);
  assert.match(block, /total_amount numeric\(12, 2\) not null/);
  assert.match(block, /status public\.invoice_status not null default 'draft'/);
  assert.doesNotMatch(block, /organization_id/);
  // Prisma's vestigial nullable Invoice.userId is intentionally NOT replicated.
  assert.doesNotMatch(block, /user_id/);
  assert.match(schema, /create index if not exists idx_invoices_tutor_period_start on public\.invoices\(tutor_id, period_start\)/);
});

test('invoice_lines table: session/adjustment refs, line_type default session, indexes', () => {
  const block = tableBlock('invoice_lines');
  assert.ok(block, 'invoice_lines create-table block must exist');
  assert.match(block, /invoice_id uuid not null references public\.invoices\(id\)/);
  assert.match(block, /session_id uuid references public\.sessions\(id\)/);
  assert.match(block, /adjustment_id uuid references public\.adjustments\(id\)/);
  assert.match(block, /line_type public\.invoice_line_type not null default 'session'/);
  assert.match(block, /description text not null/);
  assert.match(block, /minutes int not null/);
  assert.match(block, /rate numeric\(12, 2\) not null/);
  assert.match(block, /amount numeric\(12, 2\) not null/);
  assert.match(schema, /create index if not exists idx_invoice_lines_invoice on public\.invoice_lines\(invoice_id\)/);
  assert.match(schema, /create index if not exists idx_invoice_lines_session on public\.invoice_lines\(session_id\)/);
  assert.match(schema, /create index if not exists idx_invoice_lines_adjustment on public\.invoice_lines\(adjustment_id\)/);
});

// --- RLS --------------------------------------------------------------------

test('pay_periods RLS: admin-only SELECT, no direct writes, NO tutor/student policy', () => {
  const policies = policyStatementsForTable('pay_periods');
  const select = policies.filter((p) => /for select/.test(p));
  assert.ok(select.length === 1 && /public\.is_platform_admin\(\)/.test(select[0]), 'admin-only select required');
  // No tutor or student identity helper appears in any pay_periods policy.
  for (const p of policies) {
    assert.ok(!/current_tutor_id\(\)/.test(p), 'pay_periods must not grant tutors direct access');
    assert.ok(!/current_student_id\(\)/.test(p), 'pay_periods must not grant students direct access');
  }
  const insert = policies.find((p) => /for insert/.test(p));
  const update = policies.find((p) => /for update/.test(p));
  const del = policies.find((p) => /for delete/.test(p));
  assert.ok(insert && /with check \(false\)/.test(insert), 'no direct insert');
  assert.ok(update && /using \(false\)/.test(update) && /with check \(false\)/.test(update), 'no direct update');
  assert.ok(del && /using \(false\)/.test(del), 'no direct delete');
});

for (const table of ['adjustments', 'invoices']) {
  test(`${table} RLS: admin SELECT all + tutor SELECT own; no direct writes; no student access`, () => {
    const policies = policyStatementsForTable(table);
    const select = policies.filter((p) => /for select/.test(p));
    assert.ok(select.some((p) => /public\.is_platform_admin\(\)/.test(p)), 'admin select required');
    assert.ok(select.some((p) => /tutor_id = public\.current_tutor_id\(\)/.test(p)), 'tutor own select required');
    for (const p of policies) {
      assert.ok(!/current_student_id\(\)/.test(p), `${table} must not grant students access`);
    }
    const insert = policies.find((p) => /for insert/.test(p));
    const update = policies.find((p) => /for update/.test(p));
    const del = policies.find((p) => /for delete/.test(p));
    assert.ok(insert && /with check \(false\)/.test(insert), 'no direct insert');
    assert.ok(update && /using \(false\)/.test(update) && /with check \(false\)/.test(update), 'no direct update');
    assert.ok(del && /using \(false\)/.test(del), 'no direct delete');
  });
}

test('invoice_lines RLS: admin SELECT all + tutor SELECT own via parent invoice; no direct writes', () => {
  const policies = policyStatementsForTable('invoice_lines');
  const select = policies.filter((p) => /for select/.test(p));
  assert.ok(select.some((p) => /public\.is_platform_admin\(\)/.test(p)), 'admin select required');
  // Tutor scoping is via the parent invoice's tutor_id, not a direct column.
  assert.ok(
    select.some((p) => /from public\.invoices i/.test(p) && /i\.tutor_id = public\.current_tutor_id\(\)/.test(p)),
    'tutor own-via-parent select required',
  );
  for (const p of policies) {
    assert.ok(!/current_student_id\(\)/.test(p), 'invoice_lines must not grant students access');
  }
  const insert = policies.find((p) => /for insert/.test(p));
  const update = policies.find((p) => /for update/.test(p));
  const del = policies.find((p) => /for delete/.test(p));
  assert.ok(insert && /with check \(false\)/.test(insert), 'no direct insert');
  assert.ok(update && /using \(false\)/.test(update) && /with check \(false\)/.test(update), 'no direct update');
  assert.ok(del && /using \(false\)/.test(del), 'no direct delete');
});

test('all four finance tables have RLS enabled', () => {
  for (const table of ['pay_periods', 'adjustments', 'invoices', 'invoice_lines']) {
    assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`));
  }
});

// --- RPCs -------------------------------------------------------------------

test('all five payroll RPCs are SECURITY DEFINER, pin search_path, and admin-gate', () => {
  const rpcs = [
    ['get_or_create_pay_period', /returns public\.pay_periods/],
    ['generate_payroll_week', /returns setof public\.invoices/],
    ['lock_pay_period', /returns public\.pay_periods/],
    ['create_adjustment', /returns public\.adjustments/],
    ['void_adjustment', /returns public\.adjustments/],
  ];
  for (const [name, returnsRe] of rpcs) {
    const body = functionBody(name);
    assert.match(body, returnsRe, `${name} return type`);
    assert.match(body, /security definer/, `${name} must be security definer`);
    assert.match(body, /set search_path = public/, `${name} must pin search_path`);
    assert.match(body, /is_platform_admin\(\)/, `${name} must gate on is_platform_admin()`);
  }
});

test('RPCs raise Fastify-parity distinct error codes for each precondition', () => {
  assert.match(functionBody('generate_payroll_week'), /invoices_already_generated/);
  assert.match(functionBody('generate_payroll_week'), /pay_period_locked/);
  assert.match(functionBody('lock_pay_period'), /pay_period_locked/);
  assert.match(functionBody('lock_pay_period'), /pending_sessions/);
  assert.match(functionBody('create_adjustment'), /tutor_not_found/);
  assert.match(functionBody('create_adjustment'), /related_session_invalid/);
  assert.match(functionBody('void_adjustment'), /adjustment_not_found/);
  assert.match(functionBody('void_adjustment'), /pay_period_locked/);
  assert.match(functionBody('void_adjustment'), /adjustment_already_voided/);
});

test('get_or_create_pay_period is idempotent get-or-create on period_start_date', () => {
  const body = functionBody('get_or_create_pay_period');
  assert.match(body, /period_end_date/);
  assert.match(body, /p_period_start_date \+ 6/);
  assert.match(body, /on conflict \(period_start_date\) do nothing/);
});

test('generate_payroll_week: invoice-number format, hourly_rate lookup, signed-amount, issued status', () => {
  const body = functionBody('generate_payroll_week');
  // Exact Fastify invoice-number format.
  assert.match(body, /'INV-' \|\| replace\(p_week_start::text, '-', ''\) \|\| '-' \|\| substr\(v_tutor\.tutor_id::text, 1, 8\)/);
  // Rate = coalesce(allocation.rate_override, tutor.hourly_rate) -- confirms the
  // real Supabase column name is hourly_rate (NOT Prisma's default_hourly_rate).
  assert.match(body, /coalesce\(alloc\.rate_override, v_tutor\.hourly_rate\)/);
  assert.doesNotMatch(body, /default_hourly_rate/);
  // Session-line amount math.
  assert.match(body, /v_line\.duration_minutes \/ 60\.0\) \* v_line\.rate/);
  // getSignedAmount: penalty negative, else positive.
  assert.match(body, /case when v_adj\.type = 'penalty' then -abs\(v_adj\.amount\) else abs\(v_adj\.amount\) end/);
  // Only APPROVED sessions / APPROVED non-voided adjustments contribute.
  assert.match(body, /s\.status = 'approved'/);
  assert.match(body, /a\.status = 'approved'/);
  assert.match(body, /a\.voided_at is null/);
  // Invoices written as 'issued'.
  assert.match(body, /'issued'/);
});

test('lock_pay_period delegates generation (does NOT duplicate the algorithm)', () => {
  const body = functionBody('lock_pay_period');
  assert.match(body, /perform public\.generate_payroll_week\(p_week_start\)/);
  // No re-inlined invoice-number formatting in the lock RPC.
  assert.doesNotMatch(body, /'INV-'/);
  assert.match(body, /status = 'submitted'/);
  assert.match(body, /status = 'locked', locked_at = now\(\), locked_by = public\.current_profile_id\(\)/);
});

test('create_adjustment inserts approved-in-one-step with self as creator+approver', () => {
  const body = functionBody('create_adjustment');
  assert.match(body, /'approved'/);
  assert.match(body, /v_profile uuid := public\.current_profile_id\(\)/);
  // related-session window check spans [week_start, week_start + 6].
  assert.match(body, /date between p_week_start and p_week_start \+ 6/);
  // approved_at stamped now(); no draft-approval workflow invented.
  assert.match(body, /approved_at/);
});

test('void_adjustment is a soft-void refused when the pay period is locked', () => {
  const body = functionBody('void_adjustment');
  // Soft-void: stamps voided_* rather than deleting.
  assert.match(body, /set voided_at = now\(\)/);
  assert.match(body, /voided_by = public\.current_profile_id\(\)/);
  assert.match(body, /void_reason = coalesce\(p_reason, 'deleted_by_admin'\)/);
  // Locked-period refusal reads pay_periods.status for the linked period.
  assert.match(body, /v_period_status = 'locked'/);
  // It is not a hard DELETE.
  assert.doesNotMatch(body, /delete from public\.adjustments/);
});

test('payroll RPCs are granted execute to authenticated (self-gate internally)', () => {
  assert.match(schema, /grant execute on function public\.get_or_create_pay_period\(date\) to authenticated/);
  assert.match(schema, /grant execute on function public\.generate_payroll_week\(date\) to authenticated/);
  assert.match(schema, /grant execute on function public\.lock_pay_period\(date\) to authenticated/);
  assert.match(schema, /grant execute on function public\.create_adjustment\(uuid, public\.adjustment_type, numeric, text, uuid, date\) to authenticated/);
  assert.match(schema, /grant execute on function public\.void_adjustment\(uuid, text\) to authenticated/);
});

// --- The un-stubbed sessions loop-closer -----------------------------------

test('session_date_pay_period_locked is un-stubbed: reads pay_periods, no bare false', () => {
  const body = functionBody('session_date_pay_period_locked');
  assert.doesNotMatch(body, /select false/);
  assert.match(body, /public\.pay_periods/);
  assert.match(body, /status = 'locked'/);
  // Monday week-start resolution via date_trunc (ISO Monday), per the brief.
  assert.match(body, /date_trunc\('week', p_date::timestamp\)::date/);
  // Now reads a table, so it must be stable (not immutable) and plpgsql (so the
  // forward reference to pay_periods resolves at run time).
  assert.match(body, /language plpgsql/);
  assert.match(body, /stable/);
});
