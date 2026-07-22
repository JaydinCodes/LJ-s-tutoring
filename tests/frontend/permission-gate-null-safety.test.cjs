const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Regression guard for a real, serious bug found while testing the
// growth-risk repoint against real local Postgres (not a design decision):
// Postgres's IF statement treats a NULL condition as false. `if not (A or B
// or C) then raise exception 'forbidden'` -- where the OR-chain itself
// evaluates to NULL because one disjunct is an equality comparison against a
// current_*_id() helper that returns NULL for a non-matching caller (e.g.
// current_student_id() is null for a tutor) -- silently SKIPS the raise
// instead of firing it, because `not null` is null and `if null then` does
// not execute. Confirmed directly: `select not (false or null or false)`
// returns NULL, not true, and a real unrelated tutor (zero allocation to the
// student) could call generate_weekly_report() and recompute_student_risk_
// snapshot() for an arbitrary student before this fix.
//
// The fix wraps the OR-chain in `coalesce(..., false)` before negating it,
// so the IF always receives a real boolean. This test asserts the
// structural invariant: every `if not (` permission gate in the schema must
// be wrapped in coalesce (or otherwise not contain a bare current_*_id()
// equality comparison that can produce NULL).

const repoRoot = path.resolve(__dirname, '..', '..');
const schema = fs.readFileSync(
  path.join(repoRoot, 'docs', 'supabase', 'schema.sql'),
  'utf8',
);

// Strip `--` line comments so explanatory prose (which necessarily quotes
// the very code pattern this test looks for) can't produce false matches.
const schemaWithoutComments = schema
  .split(/\r?\n/)
  .map((line) => line.replace(/--.*$/, ''))
  .join('\n');

test('every `if not (` permission gate is null-safe (coalesced, or has no NULL-producing equality)', () => {
  const re = /if not \(([\s\S]*?)\)\s*then/g;
  let match;
  const uncoalescedWithIdentityEquality = [];
  while ((match = re.exec(schemaWithoutComments)) !== null) {
    const conditionText = match[1];
    const fullMatch = match[0];
    const looksLikeIdentityEquality = /current_(student|tutor|profile)_id\(\)\s*=/.test(conditionText);
    const isCoalesced = /^coalesce\(/.test(conditionText.trim()) || /^\s*coalesce\(/.test(fullMatch.replace('if not (', ''));
    if (looksLikeIdentityEquality && !isCoalesced) {
      uncoalescedWithIdentityEquality.push(fullMatch.slice(0, 80));
    }
  }
  assert.deepEqual(
    uncoalescedWithIdentityEquality,
    [],
    `these gates contain a NULL-producing identity equality inside an unwrapped 'if not (...)' -- must use coalesce(..., false): ${uncoalescedWithIdentityEquality.join(' | ')}`,
  );
});

test('generate_weekly_report and recompute_student_risk_snapshot gates are coalesced', () => {
  function functionBody(name) {
    const start = schema.indexOf(`create or replace function public.${name}(`);
    assert.notEqual(start, -1, `expected function public.${name} to be defined`);
    const rest = schema.slice(start);
    const end = rest.indexOf('$$;');
    return rest.slice(0, end + 3);
  }

  const weeklyReportBody = functionBody('generate_weekly_report');
  assert.match(weeklyReportBody, /if not coalesce\(/, 'generate_weekly_report gate must use coalesce');

  const riskSnapshotBody = functionBody('recompute_student_risk_snapshot');
  assert.match(riskSnapshotBody, /if not coalesce\(public\.is_platform_admin\(\) or public\.current_student_id\(\) = p_student_id, false\)/, 'recompute_student_risk_snapshot gate must use coalesce');
});
