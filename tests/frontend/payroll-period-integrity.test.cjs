const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20260809170748_harden_payroll_period_closure.sql'),
  'utf8',
);
const route = fs.readFileSync(path.join(root, 'src', 'features', 'admin', 'AdminPayrollRoute.tsx'), 'utf8');
const repository = fs.readFileSync(path.join(root, 'src', 'features', 'admin', 'adminPayrollRepository.ts'), 'utf8');

test('pay periods are Monday-to-Sunday and cannot overlap', () => {
  assert.match(migration, /pay_periods_start_monday/);
  assert.match(migration, /extract\(isodow from period_start_date\) = 1/);
  assert.match(migration, /pay_periods_exactly_seven_days/);
  assert.match(migration, /period_end_date = period_start_date \+ 6/);
  assert.match(migration, /pay_periods_no_overlapping_dates/);
  assert.match(migration, /exclude using gist/);
});

test('every payroll mutation normalizes to Monday and serializes a week', () => {
  assert.match(migration, /create or replace function public\.payroll_week_start/);
  assert.match(migration, /date_trunc\('week', p_date::timestamp\)::date/);
  assert.match(migration, /create or replace function public\.lock_payroll_week_mutation/);
  assert.match(migration, /pg_advisory_xact_lock/);
  for (const name of ['get_or_create_pay_period', 'generate_payroll_week', 'lock_pay_period', 'create_adjustment']) {
    const body = migration.slice(migration.indexOf(`create or replace function public.${name}(`));
    assert.match(body.slice(0, body.indexOf('$$;') + 3), /public\.payroll_week_start/);
  }
});

test('close rebuilds invoices in the same transaction and blocks missing rates', () => {
  const lockBody = migration.slice(migration.indexOf('create or replace function public.lock_pay_period('));
  const lockFunction = lockBody.slice(0, lockBody.indexOf('$$;') + 3);
  assert.match(lockFunction, /perform public\.generate_payroll_week\(v_week_start\)/);
  assert.match(lockFunction, /status = 'locked'/);
  const generateBody = migration.slice(migration.indexOf('create or replace function public.generate_payroll_week('));
  const generateFunction = generateBody.slice(0, generateBody.indexOf('$$;') + 3);
  assert.doesNotMatch(generateFunction, /invoices_already_generated/);
  assert.match(generateFunction, /delete from public\.invoice_lines/);
  assert.match(generateFunction, /delete from public\.invoices/);
  assert.match(generateFunction, /missing_tutor_rate/);
  assert.match(migration, /effective_tutor_rate_required/);
  assert.match(migration, /'missingRates'/);
});

test('admin UI and repository normalize date input and expose close blockers', () => {
  assert.match(route, /normalizeWeekStart\(event\.target\.value\)/);
  assert.match(route, /Missing tutor rates/);
  assert.match(route, /Close &amp; lock week/);
  assert.match(route, /data\?\.integrity\.canClose === false/);
  assert.match(repository, /function normalizePayrollWeekStart/);
  assert.match(repository, /p_week_start: normalizePayrollWeekStart\(weekStart\)/);
});
