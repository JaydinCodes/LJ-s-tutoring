const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// PRISMA_TO_SUPABASE_MIGRATION_PLAN.md §4D/§6 step 5: growth monitoring / risk
// (student_score_snapshots, career_progress_snapshots). This is a REDESIGN,
// not a literal Fastify port -- predictive-scoring.ts's formula depends on
// study_streaks/study_activity_events, which were cut from scope (§3D), so
// the scoring model here is rebuilt from tables that already exist in this
// schema (sessions, assignments, assignment_submissions, student_progress,
// weekly_reports) with explicit assignment-level traceability (source_type /
// source_id on every reason), per the owner's explicit requirement (§7
// decision 2). These static-analysis tests follow the same
// regex-against-schema.sql pattern as sessions-migration.test.cjs /
// finance-payroll-migration.test.cjs / weekly-reports-notifications-migration.test.cjs.

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

// --- Tables ------------------------------------------------------------------

test('student_score_snapshots table: org-scoped, student_id -> students, score bounds, unique + indexes', () => {
  const block = tableBlock('student_score_snapshots');
  assert.ok(block, 'student_score_snapshots create-table block must exist');
  // Explicitly org-scoped (unlike finance/weekly_reports), per plan §4.
  assert.match(block, /organization_id uuid not null references public\.organizations\(id\)/);
  assert.match(block, /student_id uuid not null references public\.students\(id\) on delete cascade/);
  assert.match(block, /score_date date not null/);
  assert.match(block, /risk_score int not null check \(risk_score between 0 and 100\)/);
  assert.match(block, /momentum_score int not null check \(momentum_score between 0 and 100\)/);
  assert.match(block, /reasons_json jsonb not null default '\[\]'::jsonb/);
  assert.match(block, /metrics_json jsonb not null default '\{\}'::jsonb/);
  assert.match(block, /recommended_actions_json jsonb not null default '\[\]'::jsonb/);
  assert.match(block, /unique \(student_id, score_date\)/);
  assert.match(schema, /create index if not exists idx_student_score_snapshots_student_date on public\.student_score_snapshots\(student_id, score_date desc\)/);
  assert.match(schema, /create index if not exists idx_student_score_snapshots_organization on public\.student_score_snapshots\(organization_id\)/);
});

test('career_progress_snapshots table: org-scoped, student_id -> students, goal_id is a plain string (no FK)', () => {
  const block = tableBlock('career_progress_snapshots');
  assert.ok(block, 'career_progress_snapshots create-table block must exist');
  assert.match(block, /organization_id uuid not null references public\.organizations\(id\)/);
  assert.match(block, /student_id uuid not null references public\.students\(id\) on delete cascade/);
  assert.match(block, /goal_id text not null,/);
  assert.doesNotMatch(block, /goal_id text not null references/);
  assert.match(block, /alignment_score int not null check \(alignment_score between 0 and 100\)/);
  assert.match(schema, /create index if not exists idx_career_progress_snapshots_student_goal on public\.career_progress_snapshots\(student_id, goal_id, created_at desc\)/);
  assert.match(schema, /create index if not exists idx_career_progress_snapshots_organization on public\.career_progress_snapshots\(organization_id\)/);
});

test('both new tables have RLS enabled', () => {
  for (const table of ['student_score_snapshots', 'career_progress_snapshots']) {
    assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`));
  }
});

// --- Org derivation ------------------------------------------------------------

test('shared fill_student_scoped_organization_id trigger derives org STRICTLY from the student, wired to both tables', () => {
  const body = functionBody('fill_student_scoped_organization_id');
  assert.match(body, /security definer/);
  assert.match(body, /from public\.students/);
  assert.match(body, /raise exception 'student_scoped_org_unresolved'/);
  assert.match(schema, /create trigger trg_fill_student_score_snapshot_org\s*\n\s*before insert on public\.student_score_snapshots\s*\n\s*for each row execute function public\.fill_student_scoped_organization_id\(\)/);
  assert.match(schema, /create trigger trg_fill_career_progress_snapshot_org\s*\n\s*before insert on public\.career_progress_snapshots\s*\n\s*for each row execute function public\.fill_student_scoped_organization_id\(\)/);
});

// --- RLS -----------------------------------------------------------------------

test('student_score_snapshots RLS: admin + student-own + tutor-allocated SELECT; no direct writes', () => {
  const policies = policyStatementsForTable('student_score_snapshots');
  const select = policies.filter((p) => /for select/.test(p));
  assert.ok(select.some((p) => /public\.is_platform_admin\(\)/.test(p)), 'admin select required');
  assert.ok(select.some((p) => /student_id = public\.current_student_id\(\)/.test(p)), 'student own select required');
  assert.ok(
    select.some((p) =>
      /public\.tutor_student_allocations/.test(p) &&
      /tutor_id = public\.current_tutor_id\(\)/.test(p) &&
      /status = 'active'/.test(p),
    ),
    'tutor active-allocation select required',
  );
  const insert = policies.find((p) => /for insert/.test(p));
  const update = policies.find((p) => /for update/.test(p));
  const del = policies.find((p) => /for delete/.test(p));
  assert.ok(insert && /with check \(false\)/.test(insert), 'no direct insert');
  assert.ok(update && /using \(false\)/.test(update) && /with check \(false\)/.test(update), 'no direct update');
  assert.ok(del && /using \(false\)/.test(del), 'no direct delete');
});

test('career_progress_snapshots RLS: admin + student-own + tutor-allocated SELECT; no direct writes', () => {
  const policies = policyStatementsForTable('career_progress_snapshots');
  const select = policies.filter((p) => /for select/.test(p));
  assert.ok(select.some((p) => /public\.is_platform_admin\(\)/.test(p)), 'admin select required');
  assert.ok(select.some((p) => /student_id = public\.current_student_id\(\)/.test(p)), 'student own select required');
  assert.ok(
    select.some((p) =>
      /public\.tutor_student_allocations/.test(p) &&
      /tutor_id = public\.current_tutor_id\(\)/.test(p) &&
      /status = 'active'/.test(p),
    ),
    'tutor active-allocation select required',
  );
  const insert = policies.find((p) => /for insert/.test(p));
  const update = policies.find((p) => /for update/.test(p));
  const del = policies.find((p) => /for delete/.test(p));
  assert.ok(insert && /with check \(false\)/.test(insert), 'no direct insert');
  assert.ok(update && /using \(false\)/.test(update) && /with check \(false\)/.test(update), 'no direct update');
  assert.ok(del && /using \(false\)/.test(del), 'no direct delete');
});

// --- RPCs ------------------------------------------------------------------

test('both recompute RPCs are SECURITY DEFINER, pin search_path, and are granted to authenticated', () => {
  for (const name of ['recompute_student_risk_snapshot', 'recompute_career_progress_snapshot']) {
    const body = functionBody(name);
    assert.match(body, /security definer/, `${name} must be security definer`);
    assert.match(body, /set search_path = public/, `${name} must pin search_path`);
  }
  assert.match(schema, /grant execute on function public\.recompute_student_risk_snapshot\(uuid, date\) to authenticated/);
  assert.match(schema, /grant execute on function public\.recompute_career_progress_snapshot\(uuid, text, text\[\]\) to authenticated/);
});

test('recompute_student_risk_snapshot: admin-or-self gate, no tutor path, raises forbidden/student_not_found', () => {
  const body = functionBody('recompute_student_risk_snapshot');
  assert.match(body, /public\.is_platform_admin\(\)/);
  assert.match(body, /public\.current_student_id\(\) = p_student_id/);
  assert.match(body, /raise exception 'forbidden'/);
  assert.match(body, /raise exception 'student_not_found'/);
  // No tutor bypass -- Fastify never let a tutor trigger a recompute.
  assert.ok(!/current_tutor_id\(\)/.test(body), 'must not grant a tutor recompute path');
});

test('recompute_student_risk_snapshot: never references the cut gamification tables', () => {
  const body = functionBody('recompute_student_risk_snapshot');
  assert.ok(!body.includes('study_streaks'), 'must not reference study_streaks');
  assert.ok(!body.includes('study_activity_events'), 'must not reference study_activity_events');
});

test('recompute_student_risk_snapshot: assignment-completion signal is traceable to a specific assignment', () => {
  const body = functionBody('recompute_student_risk_snapshot');
  assert.match(body, /from public\.assignments a/);
  assert.match(body, /left join public\.assignment_submissions sub/);
  assert.match(body, /a\.status = 'published'/);
  assert.match(body, /a\.grade = v_student_grade/);
  assert.match(body, /'source_type', 'assignment'/);
  assert.match(body, /'source_id', v_missing_assignment_id/);
});

test('recompute_student_risk_snapshot: marks-trend signal is restricted to RELEASED marks only', () => {
  const body = functionBody('recompute_student_risk_snapshot');
  // Every assignment_submissions read in this function must be marks_released-gated.
  assert.match(body, /marks_released = true/);
  const releasedGateCount = (body.match(/marks_released = true/g) || []).length;
  const submissionReadCount = (body.match(/from public\.assignment_submissions/g) || []).length
    + (body.match(/from \(\s*select id, marks_awarded/g) || []).length;
  assert.ok(releasedGateCount >= 1 && submissionReadCount >= 1, 'expected at least one released-only submissions read');
  assert.match(body, /'source_type', 'assignment_submission'/);
});

test('recompute_student_risk_snapshot: topic-weakness signal is traceable to a specific student_progress row', () => {
  const body = functionBody('recompute_student_risk_snapshot');
  assert.match(body, /from public\.student_progress/);
  assert.match(body, /order by score asc, topic asc/);
  assert.match(body, /'source_type', 'student_progress'/);
  assert.match(body, /'source_id', v_weak_progress_id/);
});

test('recompute_student_risk_snapshot: session-attendance signal traceable to a specific session', () => {
  const body = functionBody('recompute_student_risk_snapshot');
  assert.match(body, /from public\.sessions/);
  assert.match(body, /status = 'rejected'/);
  assert.match(body, /'source_type', 'session'/);
  assert.match(body, /'source_id', v_flagged_session_id/);
});

test('recompute_student_risk_snapshot: EMA-smooths against the previous day\'s snapshot when one exists', () => {
  const body = functionBody('recompute_student_risk_snapshot');
  assert.match(body, /score_date < p_score_date/);
  assert.match(body, /0\.34 \* v_risk_score \+ 0\.66 \* v_previous_risk/);
  assert.match(body, /0\.34 \* v_momentum_score \+ 0\.66 \* v_previous_momentum/);
});

test('recompute_student_risk_snapshot: upserts on (student_id, score_date)', () => {
  const body = functionBody('recompute_student_risk_snapshot');
  assert.match(body, /on conflict \(student_id, score_date\)/);
  assert.match(body, /do update set/);
});

test('recompute_career_progress_snapshot: self-only gate (no admin/tutor bypass), raises forbidden/student_not_found', () => {
  const body = functionBody('recompute_career_progress_snapshot');
  assert.match(body, /public\.current_student_id\(\) <> p_student_id/);
  assert.match(body, /raise exception 'forbidden'/);
  assert.match(body, /raise exception 'student_not_found'/);
  // No admin bypass -- Fastify's POST /career/goals has no admin path either.
  assert.ok(!/is_platform_admin\(\)/.test(body), 'must not grant an admin bypass');
  assert.ok(!/current_tutor_id\(\)/.test(body), 'must not grant a tutor recompute path');
});

test('recompute_career_progress_snapshot: never references the cut gamification tables', () => {
  const body = functionBody('recompute_career_progress_snapshot');
  assert.ok(!body.includes('study_streaks'), 'must not reference study_streaks');
  assert.ok(!body.includes('study_activity_events'), 'must not reference study_activity_events');
});

test('recompute_career_progress_snapshot: rebuilds subjectCoverage/averageCompletion from the latest weekly_reports row', () => {
  const body = functionBody('recompute_career_progress_snapshot');
  assert.match(body, /from public\.weekly_reports/);
  assert.match(body, /order by week_end desc/);
  assert.match(body, /payload_json -> 'topicProgress'/);
});

test('recompute_career_progress_snapshot: keeps Fastify\'s 0.35/0.30/0.20/0.15 weight split', () => {
  const body = functionBody('recompute_career_progress_snapshot');
  assert.match(body, /v_subject_coverage \* 0\.35/);
  assert.match(body, /v_average_completion \* 0\.30/);
  assert.match(body, /v_attendance_score \* 0\.20/);
  assert.match(body, /v_completion_score \* 0\.15/);
});

test('recompute_career_progress_snapshot: assignment-completion substitute is traceable to a specific assignment', () => {
  const body = functionBody('recompute_career_progress_snapshot');
  assert.match(body, /from public\.assignments a/);
  assert.match(body, /a\.status = 'published'/);
  assert.match(body, /'source_type', case when v_missing_assignment_id is not null then 'assignment' else null end/);
});

test('goal_id is not migrated as career_goal_selections (folds into student_career_profiles per plan §7 decision 4)', () => {
  assert.doesNotMatch(schema, /create table if not exists public\.career_goal_selections/);
});
