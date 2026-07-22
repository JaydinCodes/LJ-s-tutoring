const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// PRISMA_TO_SUPABASE_MIGRATION_PLAN.md §4E/§6 step 6: academic extras +
// volunteering (baseline_assessments, learning_goals, student_exam_events,
// volunteer_events, volunteer_logs). Prisma's LearningAssignment (+ its own
// raw-SQL assignment_submissions, distinct from the Supabase
// assignment_submissions already live) was DELIBERATELY CUT during this step
// (§7 decision 6) -- a parallel tutor-assigns-one-student system with zero
// src/ usage, whose migration would have required a confusingly-named
// second submissions table. These static-analysis tests follow the same
// regex-against-schema.sql pattern as the other migration test files.

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

function noDirectWritePolicies(table) {
  const policies = policyStatementsForTable(table);
  const insert = policies.find((p) => /for insert/.test(p));
  const update = policies.find((p) => /for update/.test(p));
  const del = policies.find((p) => /for delete/.test(p));
  assert.ok(insert && /with check \(false\)/.test(insert), `${table}: no direct insert`);
  assert.ok(update && /using \(false\)/.test(update) && /with check \(false\)/.test(update), `${table}: no direct update`);
  assert.ok(del && /using \(false\)/.test(del), `${table}: no direct delete`);
}

// --- LearningAssignment cut ---------------------------------------------------

test('LearningAssignment is DELIBERATELY CUT: no learning_assignments table, no learning_assignment_submissions table', () => {
  assert.doesNotMatch(schema, /create table if not exists public\.learning_assignments/);
  assert.doesNotMatch(schema, /create table if not exists public\.learning_assignment_submissions/);
});

// --- Enums ---------------------------------------------------------------------

test('five new enums exist with the exact Fastify Zod vocab', () => {
  assert.match(schema, /create type public\.baseline_source_type as enum \('manual', 'uploaded', 'generated', 'diagnostic'\)/);
  assert.match(schema, /create type public\.learning_goal_category as enum \('academic', 'attendance', 'assignment', 'career', 'intervention'\)/);
  assert.match(schema, /create type public\.learning_goal_status as enum \('active', 'completed', 'paused', 'cancelled'\)/);
  assert.match(schema, /create type public\.volunteer_event_status as enum \('planned', 'cancelled', 'completed'\)/);
  assert.match(schema, /create type public\.volunteer_log_status as enum \('signed_up', 'submitted', 'verified', 'rejected'\)/);
});

// --- Tables ----------------------------------------------------------------

test('baseline_assessments table: org-scoped, student_id -> students, source_type enum, jsonb shape checks', () => {
  const block = tableBlock('baseline_assessments');
  assert.ok(block, 'baseline_assessments create-table block must exist');
  assert.match(block, /organization_id uuid not null references public\.organizations\(id\)/);
  assert.match(block, /student_id uuid not null references public\.students\(id\) on delete cascade/);
  assert.match(block, /score numeric\(8, 2\) not null/);
  assert.match(block, /total numeric\(8, 2\) not null/);
  assert.match(block, /percentage numeric\(5, 2\) not null/);
  assert.match(block, /source_type public\.baseline_source_type not null default 'manual'/);
  assert.match(block, /created_by uuid references public\.profiles\(id\)/);
  assert.doesNotMatch(block, /created_by_user_id/);
  assert.match(schema, /create index if not exists idx_baseline_assessments_student_completed on public\.baseline_assessments\(student_id, completed_at desc\)/);
  assert.match(schema, /create index if not exists idx_baseline_assessments_subject_grade on public\.baseline_assessments\(subject, grade, completed_at desc\)/);
});

test('learning_goals table: org-scoped, category/status enums, visibility flags default true', () => {
  const block = tableBlock('learning_goals');
  assert.ok(block, 'learning_goals create-table block must exist');
  assert.match(block, /organization_id uuid not null references public\.organizations\(id\)/);
  assert.match(block, /student_id uuid not null references public\.students\(id\) on delete cascade/);
  assert.match(block, /category public\.learning_goal_category not null default 'academic'/);
  assert.match(block, /status public\.learning_goal_status not null default 'active'/);
  assert.match(block, /visible_to_student boolean not null default true/);
  assert.match(block, /visible_to_tutor boolean not null default true/);
  assert.match(schema, /create index if not exists idx_learning_goals_student_status_due on public\.learning_goals\(student_id, status, due_date\)/);
});

test('student_exam_events table: org-scoped, student_id -> students, required exam_date', () => {
  const block = tableBlock('student_exam_events');
  assert.ok(block, 'student_exam_events create-table block must exist');
  assert.match(block, /organization_id uuid not null references public\.organizations\(id\)/);
  assert.match(block, /student_id uuid not null references public\.students\(id\) on delete cascade/);
  assert.match(block, /exam_date date not null/);
  assert.match(schema, /create index if not exists idx_student_exam_events_student_date on public\.student_exam_events\(student_id, exam_date\)/);
});

test('volunteer_events / volunteer_logs are deliberately NOT org-scoped', () => {
  const eventsBlock = tableBlock('volunteer_events');
  const logsBlock = tableBlock('volunteer_logs');
  assert.ok(eventsBlock && logsBlock);
  assert.doesNotMatch(eventsBlock, /^\s*organization_id uuid/m);
  assert.doesNotMatch(logsBlock, /^\s*organization_id uuid/m);
});

test('volunteer_events table: status enum, mode length-checked (not enum, matching sessions.mode precedent)', () => {
  const block = tableBlock('volunteer_events');
  assert.match(block, /status public\.volunteer_event_status not null default 'planned'/);
  assert.match(block, /mode text not null default 'in-person'/);
  assert.match(block, /volunteer_events_mode_len check \(char_length\(mode\) between 1 and 40\)/);
});

test('volunteer_logs table: tutor_id -> tutors, event_id -> volunteer_events, evidence_document_id -> tutor_documents', () => {
  const block = tableBlock('volunteer_logs');
  assert.match(block, /tutor_id uuid not null references public\.tutors\(id\) on delete cascade/);
  assert.match(block, /event_id uuid references public\.volunteer_events\(id\)/);
  assert.match(block, /evidence_document_id uuid references public\.tutor_documents\(id\)/);
  assert.match(block, /status public\.volunteer_log_status not null default 'signed_up'/);
  assert.match(schema, /create index if not exists idx_volunteer_logs_tutor_created on public\.volunteer_logs\(tutor_id, created_at desc\)/);
});

test('all five new tables have RLS enabled', () => {
  for (const table of ['baseline_assessments', 'learning_goals', 'student_exam_events', 'volunteer_events', 'volunteer_logs']) {
    assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`));
  }
});

// --- Org derivation (shared trigger reuse) --------------------------------

test('baseline_assessments / learning_goals / student_exam_events reuse the growth/risk shared trigger (no new trigger function)', () => {
  for (const [trigger, table] of [
    ['trg_fill_baseline_assessment_org', 'baseline_assessments'],
    ['trg_fill_learning_goal_org', 'learning_goals'],
    ['trg_fill_student_exam_event_org', 'student_exam_events'],
  ]) {
    assert.match(
      schema,
      new RegExp(`create trigger ${trigger}\\s*\\n\\s*before insert on public\\.${table}\\s*\\n\\s*for each row execute function public\\.fill_student_scoped_organization_id\\(\\)`),
      `${table} must reuse fill_student_scoped_organization_id`,
    );
  }
});

// --- RLS ---------------------------------------------------------------------

test('baseline_assessments / student_exam_events RLS: admin + student-own + tutor-allocated SELECT; no direct writes', () => {
  for (const table of ['baseline_assessments', 'student_exam_events']) {
    const policies = policyStatementsForTable(table);
    const select = policies.filter((p) => /for select/.test(p));
    assert.ok(select.some((p) => /public\.is_platform_admin\(\)/.test(p)), `${table}: admin select required`);
    assert.ok(select.some((p) => /student_id = public\.current_student_id\(\)/.test(p)), `${table}: student own select required`);
    assert.ok(
      select.some((p) => /public\.tutor_student_allocations/.test(p) && /tutor_id = public\.current_tutor_id\(\)/.test(p) && /status = 'active'/.test(p)),
      `${table}: tutor active-allocation select required`,
    );
    noDirectWritePolicies(table);
  }
});

test('learning_goals RLS: student/tutor SELECT arms gated on visible_to_student/visible_to_tutor; admin sees all', () => {
  const policies = policyStatementsForTable('learning_goals');
  const select = policies.filter((p) => /for select/.test(p));
  assert.ok(select.some((p) => /public\.is_platform_admin\(\)/.test(p)), 'admin select required');
  assert.ok(
    select.some((p) => /student_id = public\.current_student_id\(\)/.test(p) && /visible_to_student = true/.test(p)),
    'student select must be gated on visible_to_student',
  );
  assert.ok(
    select.some((p) => /visible_to_tutor = true/.test(p) && /tutor_id = public\.current_tutor_id\(\)/.test(p) && /status = 'active'/.test(p)),
    'tutor select must be gated on visible_to_tutor + active allocation',
  );
  noDirectWritePolicies('learning_goals');
});

test('volunteer_events RLS: admin + any tutor SELECT; no student/parent access; no direct writes', () => {
  const policies = policyStatementsForTable('volunteer_events');
  const select = policies.filter((p) => /for select/.test(p));
  assert.ok(select.some((p) => /public\.is_platform_admin\(\)/.test(p)), 'admin select required');
  assert.ok(select.some((p) => /public\.current_tutor_id\(\) is not null/.test(p)), 'any tutor select required');
  for (const p of policies) {
    assert.ok(!/current_student_id\(\)/.test(p), 'volunteer_events must not grant student read');
  }
  noDirectWritePolicies('volunteer_events');
});

test('volunteer_logs RLS: admin + own-tutor SELECT only (no cross-tutor visibility); no direct writes', () => {
  const policies = policyStatementsForTable('volunteer_logs');
  const select = policies.filter((p) => /for select/.test(p));
  assert.equal(select.length, 1, 'exactly one SELECT policy expected');
  assert.match(select[0], /public\.is_platform_admin\(\)/);
  assert.match(select[0], /tutor_id = public\.current_tutor_id\(\)/);
  noDirectWritePolicies('volunteer_logs');
});

// --- RPCs ------------------------------------------------------------------

test('all seven RPCs are SECURITY DEFINER, pin search_path, and are granted to authenticated', () => {
  const rpcs = [
    ['record_baseline_assessment', /returns public\.baseline_assessments/],
    ['create_learning_goal', /returns public\.learning_goals/],
    ['update_learning_goal', /returns public\.learning_goals/],
    ['create_exam_event', /returns public\.student_exam_events/],
    ['create_volunteer_event', /returns public\.volunteer_events/],
    ['create_volunteer_log', /returns public\.volunteer_logs/],
    ['verify_volunteer_log', /returns public\.volunteer_logs/],
  ];
  for (const [name, returnsRe] of rpcs) {
    const body = functionBody(name);
    assert.match(body, returnsRe, `${name} return type`);
    assert.match(body, /security definer/, `${name} must be security definer`);
    assert.match(body, /set search_path = public/, `${name} must pin search_path`);
  }
  assert.match(schema, /grant execute on function public\.record_baseline_assessment\(/);
  assert.match(schema, /grant execute on function public\.create_learning_goal\(/);
  assert.match(schema, /grant execute on function public\.update_learning_goal\(/);
  assert.match(schema, /grant execute on function public\.create_exam_event\(/);
  assert.match(schema, /grant execute on function public\.create_volunteer_event\(/);
  assert.match(schema, /grant execute on function public\.create_volunteer_log\(/);
  assert.match(schema, /grant execute on function public\.verify_volunteer_log\(/);
});

test('record_baseline_assessment: admin-gated, computes percentage server-side, fires notification', () => {
  const body = functionBody('record_baseline_assessment');
  assert.match(body, /raise exception 'forbidden'/);
  assert.match(body, /round\(\(p_score \/ p_total\) \* 100, 2\)/);
  assert.match(body, /perform public\.create_student_notification\(/);
  assert.match(body, /'baseline_assessment_created'/);
});

test('create_learning_goal: admin-gated, notification fires ONLY when visible_to_student', () => {
  const body = functionBody('create_learning_goal');
  assert.match(body, /raise exception 'forbidden'/);
  assert.match(body, /if v_row\.visible_to_student then/);
  assert.match(body, /'learning_goal_created'/);
});

test('update_learning_goal: coalesce-against-current partial update, status-dependent notification', () => {
  const body = functionBody('update_learning_goal');
  assert.match(body, /raise exception 'goal_not_found'/);
  assert.match(body, /title = coalesce\(p_title, title\)/);
  assert.match(body, /status = coalesce\(p_status, status\)/);
  assert.match(body, /'learning_goal_completed'/);
  assert.match(body, /'learning_goal_updated'/);
});

test('create_exam_event: admin-gated, no notification (Fastify parity)', () => {
  const body = functionBody('create_exam_event');
  assert.match(body, /raise exception 'forbidden'/);
  assert.ok(!/create_student_notification/.test(body), 'must not fire a notification (Fastify has none)');
});

test('create_volunteer_log: tutor-self-service, status derived from hours, evidence-document ownership enforced (defense in depth)', () => {
  const body = functionBody('create_volunteer_log');
  assert.match(body, /v_tutor_id uuid := public\.current_tutor_id\(\)/);
  assert.match(body, /raise exception 'forbidden'/);
  assert.match(body, /case when p_hours is not null then 'submitted' else 'signed_up' end/);
  assert.match(body, /from public\.tutor_documents\s*\n\s*where id = p_evidence_document_id and tutor_id = v_tutor_id/);
});

test('verify_volunteer_log: admin-gated, allowed-from-status set, not-found handling', () => {
  const body = functionBody('verify_volunteer_log');
  assert.match(body, /raise exception 'forbidden'/);
  assert.match(body, /where id = p_log_id\s*\n\s*and status in \('submitted', 'signed_up', 'rejected'\)/);
  assert.match(body, /raise exception 'volunteer_log_not_found'/);
});
