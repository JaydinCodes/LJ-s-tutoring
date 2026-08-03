const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

const schema = read('docs/supabase/schema.sql');

// Regression coverage for the 2026-07-24 security sweep. Each test below
// pins the specific gap that was found and fixed, so a future refactor that
// silently reopens one of these fails loudly here rather than only in a
// live pentest. Where practical, the underlying fix was also live-verified
// against a local Supabase instance with simulated JWTs (aal1 vs aal2
// sessions, cross-org vs same-org submissions) -- these tests cover the
// static, always-run half of that verification.

test('admin RLS/RPC checks require AAL2, not just role=admin', () => {
  const block = schema.slice(
    schema.indexOf('create or replace function public.is_platform_admin()'),
  ).split('$$;')[0];

  assert.match(block, /current_profile_role\(\) = 'admin'/, 'is_platform_admin must still check role');
  assert.match(block, /auth\.jwt\(\) ->> 'aal'/, 'is_platform_admin must check the AAL2 claim, not just role');
  assert.match(block, /= 'aal2'/);

  // Every direct current_profile_role() = 'admin' equality check was
  // converted to is_platform_admin() -- a lingering direct check would be a
  // silent MFA bypass reintroduced somewhere. Strip comment lines and
  // is_platform_admin()'s own body (the one legitimate place this still
  // appears, as part of computing the AAL2-aware result) before checking.
  const codeWithoutComments = schema
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  const withoutIsPlatformAdminBody = codeWithoutComments.replace(
    /create or replace function public\.is_platform_admin\(\)[\s\S]*?\$\$;/,
    '',
  );
  assert.doesNotMatch(withoutIsPlatformAdminBody, /current_profile_role\(\) = 'admin'/, 'no policy/RPC may check admin role without also going through is_platform_admin()');

  // is_platform_admin() must be defined before current_org_role()/other
  // Phase-2 helpers that come later, and (critically) before the many
  // policies defined earlier in the file that call it -- Postgres executes
  // this file's statements in order, so a forward reference breaks `supabase
  // db reset` outright (a real bug caught while building this fix).
  const definitionIndex = schema.indexOf('create or replace function public.is_platform_admin()');
  const firstCallerIndex = schema.indexOf('public.is_platform_admin()');
  assert.ok(definitionIndex >= 0 && definitionIndex <= firstCallerIndex, 'is_platform_admin() must be defined before its first caller in file order');
});

test('the three most sensitive POPIA admin RPCs (export, anonymize, process privacy request) require AAL2', () => {
  for (const fnName of ['export_student_data', 'anonymize_student', 'process_privacy_request']) {
    const startIdx = schema.indexOf(`create or replace function public.${fnName}(`);
    assert.ok(startIdx >= 0, `public.${fnName} must exist`);
    const block = schema.slice(startIdx, startIdx + 800);
    assert.match(block, /if not public\.is_platform_admin\(\) then/, `${fnName} must gate on the AAL2-aware admin check`);
  }
});

test('submit_assignment_submission() rejects cross-org assignments, matching the read-side org scoping', () => {
  const startIdx = schema.indexOf('create or replace function public.submit_assignment_submission(');
  // The function is defined twice in the file (an interim version early,
  // before organization_id exists yet, then a full create-or-replace once it
  // does -- see the comment at the second definition). Assert on the LAST
  // (authoritative, actually-applied) definition.
  const lastIdx = schema.lastIndexOf('create or replace function public.submit_assignment_submission(');
  assert.ok(lastIdx > startIdx, 'expected an interim definition followed by the authoritative one');
  const block = schema.slice(lastIdx, schema.indexOf('$$;', lastIdx) + 3);
  assert.match(block, /v_assignment\.organization_id is distinct from public\.current_student_org_id\(\)/, 'submission must reject a different org and a missing student-org binding');
});

test('assignment-submissions storage policies (insert + update) are org-scoped, not just published-status-scoped', () => {
  for (const policyName of ['students_upload_own_submission_files', 'students_update_own_submission_files']) {
    const lastIdx = schema.lastIndexOf(`create policy "${policyName}"`);
    const block = schema.slice(lastIdx, lastIdx + 700);
    assert.match(block, /a\.organization_id = public\.current_student_org_id\(\)/, `${policyName} must scope to the student's own org`);
  }
});

test('assignment-files storage bucket is ownership/org-scoped, not a blanket authenticated read', () => {
  const lastIdx = schema.lastIndexOf('create policy "authenticated_read_assignment_files"');
  const block = schema.slice(lastIdx, lastIdx + 900);
  assert.doesNotMatch(block, /using \(\s*bucket_id = 'assignment-files'\s*and auth\.uid\(\) is not null\s*\)/, 'must not be the old blanket-authenticated policy');
  assert.match(block, /a\.created_by = public\.current_profile_id\(\)/, 'tutor read must be scoped to assignments they created');
  assert.match(block, /a\.organization_id = public\.current_student_org_id\(\)/, 'student read must be scoped to their own org');

  const uploadBlock = schema.slice(schema.indexOf('create policy "admin_tutor_upload_assignment_files"'), schema.indexOf('create policy "admin_tutor_upload_assignment_files"') + 700);
  assert.match(uploadBlock, /a\.created_by = public\.current_profile_id\(\)/, 'tutor upload must be scoped to assignments they created');
});

test('record_audit_event() checks a tutor actually owns the assignment before allowing an assignment.* entry', () => {
  const startIdx = schema.indexOf('create or replace function public.record_audit_event(');
  const block = schema.slice(startIdx, startIdx + 1200);
  assert.match(
    block,
    /v_role = 'tutor'[\s\S]*?exists \(\s*select 1 from public\.assignments a\s*where a\.id::text = p_entity_id\s*and a\.created_by = public\.current_profile_id\(\)\s*\)/,
    'a tutor must only be able to record an assignment.* audit event for an assignment they created',
  );
});

test('edge_function_rate_limit_events table exists, RLS-locked with no policies (service-role-only access)', () => {
  assert.match(schema, /create table if not exists public\.edge_function_rate_limit_events/);
  assert.match(schema, /alter table public\.edge_function_rate_limit_events enable row level security/);
  assert.doesNotMatch(schema, /create policy "[^"]*"\s*\non public\.edge_function_rate_limit_events/, 'this table must stay default-deny -- only Edge Functions (service-role) may touch it');
});

test('both Edge Functions rate-limit before doing real work', () => {
  const odieFn = read('supabase/functions/odie-careers-chat-stream/index.ts');
  const inviteFn = read('supabase/functions/admin-invite-user/index.ts');

  for (const [fn, name] of [[odieFn, 'odie-careers-chat-stream'], [inviteFn, 'admin-invite-user']]) {
    assert.match(fn, /rpc\(\s*'check_and_record_edge_function_rate_limit'/, `${name} must use the atomic rate-limit RPC`);
    assert.doesNotMatch(fn, /\.from\('edge_function_rate_limit_events'\)/, `${name} must not use a race-prone count/insert pair`);
    assert.match(fn, /'rate_limited'.*429|429.*'rate_limited'|error: 'rate_limited' \}, 429\)/, `${name} must reject over-limit callers with 429`);
    assert.match(fn, /'rate_limiter_unavailable'.*503|503.*'rate_limiter_unavailable'|error: 'rate_limiter_unavailable' \}, 503\)/, `${name} must fail closed when the limiter is unavailable`);
  }
});

test('anonymize_student() covers every table added to the schema since it was written, not just the original set', () => {
  const startIdx = schema.indexOf('create or replace function public.anonymize_student(');
  const endIdx = schema.indexOf('\n$$;', startIdx);
  const block = schema.slice(startIdx, endIdx);

  // Tables added later in the schema's evolution that carry identifiable
  // per-student content -- deleted outright, same category as the original
  // assignment_submissions/student_progress erasure.
  for (const table of [
    'weekly_reports',
    'student_notifications',
    'baseline_assessments',
    'learning_goals',
    'student_exam_events',
    'student_score_snapshots',
    'career_progress_snapshots',
  ]) {
    assert.match(block, new RegExp(`delete from public\\.${table} where student_id = p_student_id`), `anonymize_student must delete ${table} rows for the erased student`);
  }

  // weekly_reports bakes the student's name/grade into a stored JSON payload
  // as literal text at generation time (generate_weekly_report) -- that copy
  // must not survive an erasure request. Confirmed by the delete above; this
  // additionally pins the source of the leak so the connection isn't lost.
  const reportGenIdx = schema.indexOf('create or replace function public.generate_weekly_report(');
  const reportGenEndIdx = schema.indexOf('\n$$;', reportGenIdx);
  const reportGenBlock = schema.slice(reportGenIdx, reportGenEndIdx);
  assert.match(reportGenBlock, /'name', v_student_name/, 'weekly_reports is expected to bake in the student name (documents why deleting the row, not just the profile, is required)');

  // sessions rows are kept (financial/payroll reconciliation via
  // invoice_lines.session_id -- same statutory-hold reasoning as payments),
  // but the free-text case-note fields must be nulled out.
  assert.match(block, /update public\.sessions/);
  for (const field of ['notes', 'topics_covered', 'learner_struggles', 'homework_assigned', 'tutor_private_notes', 'student_summary', 'report_review_note']) {
    assert.match(block, new RegExp(`${field} = null`), `anonymize_student must null out sessions.${field}`);
  }
});
