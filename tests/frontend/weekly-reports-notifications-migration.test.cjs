const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// PRISMA_TO_SUPABASE_MIGRATION_PLAN.md §4/§6 step 4: the weekly-reports +
// student-notifications migration. These static-analysis tests (matching the
// regex-against-schema.sql pattern used by sessions-migration.test.cjs /
// finance-payroll-migration.test.cjs) lock the weekly_reports /
// student_notifications schema, their RLS shape (weekly_reports:
// admin/tutor/student/guardian SELECT + no direct writes; student_notifications:
// student-own SELECT only + no direct writes), the SECURITY DEFINER RPC layer
// (create_student_notification internal helper, generate_weekly_report, the two
// mark-read RPCs), the deliberate streak/xp omission, and the wiring of the four
// session RPCs back into create_student_notification (closing the gap-2 loop the
// sessions migration left open).

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

// --- Tables ----------------------------------------------------------------

test('weekly_reports table: student_id -> students (NOT Prisma user_id), created_by -> profiles, unique + index', () => {
  const block = tableBlock('weekly_reports');
  assert.ok(block, 'weekly_reports create-table block must exist');
  // student_id replaces Prisma's polymorphic user_id (a report only belongs to a student).
  assert.match(block, /student_id uuid not null references public\.students\(id\)/);
  // No user_id COLUMN (Prisma's polymorphic key is replaced by student_id). A
  // column def starts at the line head; the prose comment mentioning user_id is fine.
  assert.doesNotMatch(block, /^\s*user_id\s/m);
  assert.match(block, /week_start date not null/);
  assert.match(block, /week_end date not null/);
  assert.match(block, /payload_json jsonb not null/);
  // Prisma created_by_user_id -> created_by (actor-column convention, no _user_id suffix).
  assert.match(block, /created_by uuid references public\.profiles\(id\)/);
  assert.doesNotMatch(block, /^\s*created_by_user_id\s/m);
  assert.match(block, /created_at timestamptz not null default now\(\)/);
  assert.match(block, /unique \(student_id, week_start, week_end\)/);
  // Deliberately NOT org-scoped (task schema design + finance-table precedent).
  assert.doesNotMatch(block, /organization_id/);
  assert.match(schema, /create index if not exists idx_weekly_reports_student_created on public\.weekly_reports\(student_id, created_at desc\)/);
});

test('student_notifications table: faithful port of the raw migration, created_by -> profiles, two indexes', () => {
  const block = tableBlock('student_notifications');
  assert.ok(block, 'student_notifications create-table block must exist');
  assert.match(block, /student_id uuid not null references public\.students\(id\) on delete cascade/);
  assert.match(block, /type text not null/);
  assert.match(block, /title text not null/);
  assert.match(block, /body text not null/);
  assert.match(block, /link text/);
  assert.match(block, /entity_type text/);
  assert.match(block, /entity_id uuid/);
  assert.match(block, /metadata_json jsonb not null default '\{\}'::jsonb/);
  assert.match(block, /is_read boolean not null default false/);
  assert.match(block, /read_at timestamptz/);
  // created_by_user_id -> created_by (this schema's actor-column convention).
  assert.match(block, /created_by uuid references public\.profiles\(id\)/);
  assert.doesNotMatch(block, /^\s*created_by_user_id\s/m);
  assert.match(block, /updated_at timestamptz not null default now\(\)/);
  assert.doesNotMatch(block, /organization_id/);
  assert.match(schema, /create index if not exists idx_student_notifications_student_created on public\.student_notifications\(student_id, created_at desc\)/);
  assert.match(schema, /create index if not exists idx_student_notifications_student_read on public\.student_notifications\(student_id, is_read, created_at desc\)/);
});

test('both new tables have RLS enabled', () => {
  for (const table of ['weekly_reports', 'student_notifications']) {
    assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`));
  }
});

// --- weekly_reports RLS -----------------------------------------------------

test('weekly_reports RLS: admin + student-own + tutor-allocated + guardian-gated SELECT', () => {
  const policies = policyStatementsForTable('weekly_reports');
  const select = policies.filter((p) => /for select/.test(p));
  assert.ok(select.some((p) => /public\.is_platform_admin\(\)/.test(p)), 'admin select required');
  assert.ok(select.some((p) => /student_id = public\.current_student_id\(\)/.test(p)), 'student own select required');
  // Tutor sees reports for students they have an ACTIVE allocation with.
  assert.ok(
    select.some((p) =>
      /public\.tutor_student_allocations/.test(p) &&
      /tutor_id = public\.current_tutor_id\(\)/.test(p) &&
      /status = 'active'/.test(p),
    ),
    'tutor active-allocation select required',
  );
  // Guardian read reuses get_parent_progress_reports()'s exact gating shape.
  assert.ok(
    select.some((p) =>
      /public\.current_profile_role\(\) = 'parent'/.test(p) &&
      /public\.guardians g/.test(p) &&
      /public\.student_guardians sg/.test(p) &&
      /g\.profile_id = public\.current_profile_id\(\)/.test(p) &&
      /g\.status = 'active'/.test(p) &&
      /sg\.status = 'active'/.test(p) &&
      /sg\.can_receive_reports = true/.test(p),
    ),
    'guardian gated select required (matching get_parent_progress_reports)',
  );
});

test('weekly_reports RLS: no direct INSERT/UPDATE/DELETE (all via generate_weekly_report)', () => {
  const policies = policyStatementsForTable('weekly_reports');
  const insert = policies.find((p) => /for insert/.test(p));
  const update = policies.find((p) => /for update/.test(p));
  const del = policies.find((p) => /for delete/.test(p));
  assert.ok(insert && /with check \(false\)/.test(insert), 'no direct insert');
  assert.ok(update && /using \(false\)/.test(update) && /with check \(false\)/.test(update), 'no direct update');
  assert.ok(del && /using \(false\)/.test(del), 'no direct delete');
});

// --- student_notifications RLS ---------------------------------------------

test('student_notifications RLS: student-own SELECT only; NO admin/tutor/guardian read', () => {
  const policies = policyStatementsForTable('student_notifications');
  const select = policies.filter((p) => /for select/.test(p));
  assert.equal(select.length, 1, 'exactly one SELECT policy (student-own) expected');
  assert.match(select[0], /student_id = public\.current_student_id\(\)/);
  // No broader visibility invented (no admin notifications route exists in Fastify).
  for (const p of policies) {
    assert.ok(!/is_platform_admin\(\)/.test(p), 'student_notifications must not grant admin read');
    assert.ok(!/current_tutor_id\(\)/.test(p), 'student_notifications must not grant tutor read');
    assert.ok(!/current_profile_role\(\)/.test(p), 'student_notifications must not grant guardian/role read');
  }
});

test('student_notifications RLS: no direct INSERT/UPDATE/DELETE (all via RPCs)', () => {
  const policies = policyStatementsForTable('student_notifications');
  const insert = policies.find((p) => /for insert/.test(p));
  const update = policies.find((p) => /for update/.test(p));
  const del = policies.find((p) => /for delete/.test(p));
  assert.ok(insert && /with check \(false\)/.test(insert), 'no direct insert');
  assert.ok(update && /using \(false\)/.test(update) && /with check \(false\)/.test(update), 'no direct update');
  assert.ok(del && /using \(false\)/.test(del), 'no direct delete');
});

// --- RPCs -------------------------------------------------------------------

test('the four new RPCs are SECURITY DEFINER and pin search_path', () => {
  const rpcs = [
    ['create_student_notification', /returns uuid/],
    ['generate_weekly_report', /returns public\.weekly_reports/],
    ['mark_notification_read', /returns public\.student_notifications/],
    ['mark_all_notifications_read', /returns int/],
  ];
  for (const [name, returnsRe] of rpcs) {
    const body = functionBody(name);
    assert.match(body, returnsRe, `${name} return type`);
    assert.match(body, /security definer/, `${name} must be security definer`);
    assert.match(body, /set search_path = public/, `${name} must pin search_path`);
  }
});

test('create_student_notification is locked down like insert_session_history (execute revoked)', () => {
  const sig = 'create_student_notification\\(uuid, text, text, text, text, text, uuid, jsonb\\)';
  for (const role of ['public', 'anon', 'authenticated']) {
    assert.match(
      schema,
      new RegExp(`revoke execute on function public\\.${sig} from ${role}`),
      `execute must be revoked from ${role}`,
    );
  }
  // It is NOT granted to authenticated (only other SECURITY DEFINER fns call it).
  assert.doesNotMatch(schema, new RegExp(`grant execute on function public\\.${sig} to authenticated`));
  // created_by is always the acting profile, never a client-supplied id.
  assert.match(functionBody('create_student_notification'), /public\.current_profile_id\(\)/);
});

test('the three caller-facing RPCs are granted execute to authenticated (self-gate internally)', () => {
  assert.match(schema, /grant execute on function public\.generate_weekly_report\(uuid, date\) to authenticated/);
  assert.match(schema, /grant execute on function public\.mark_notification_read\(uuid\) to authenticated/);
  assert.match(schema, /grant execute on function public\.mark_all_notifications_read\(\) to authenticated/);
});

test('generate_weekly_report: ported permission gate, Monday week math, upsert, notification', () => {
  const body = functionBody('generate_weekly_report');
  // userCanAccessStudent port: admin OR self-student OR active-allocation tutor.
  assert.match(body, /public\.is_platform_admin\(\)/);
  assert.match(body, /public\.current_student_id\(\) = p_student_id/);
  assert.match(body, /public\.tutor_student_allocations tsa/);
  assert.match(body, /tsa\.tutor_id = public\.current_tutor_id\(\)/);
  assert.match(body, /tsa\.status = 'active'/);
  assert.match(body, /raise exception 'forbidden'/);
  // Monday-Sunday week via date_trunc('week', ...) (getWeekRange parity).
  assert.match(body, /date_trunc\('week', p_week_start::timestamp\)::date/);
  assert.match(body, /date_trunc\('week', p_week_start::timestamp\)::date \+ 6/);
  // Upsert on the natural key.
  assert.match(body, /on conflict \(student_id, week_start, week_end\)/);
  assert.match(body, /do update set payload_json = excluded\.payload_json/);
  // Fires the weekly_report_ready notification with the ported shape.
  assert.match(body, /perform public\.create_student_notification\(/);
  assert.match(body, /'weekly_report_ready'/);
  assert.match(body, /'Weekly report ready'/);
  assert.match(body, /'\/reports\/'/);
  assert.match(body, /'weekly_report'/);
  // Payload built from the migrated Supabase tables, not the retired ones.
  assert.match(body, /public\.student_progress/);
  assert.match(body, /s\.status = 'approved'|status = 'approved'/);
});

test('generate_weekly_report: streak/xp OMITTED and study_streaks NEVER referenced', () => {
  const body = functionBody('generate_weekly_report');
  // The deliberate cut (locked plan §3C/§3D): no study_streaks table reference
  // may ever appear in the body, so nobody "fixes" the omission by adding a
  // gamification table that was consciously dropped from scope.
  assert.ok(!body.includes('study_streaks'), 'generate_weekly_report must not reference study_streaks');
  // The payload's metrics object carries ONLY sessionsAttended + timeStudiedMinutes
  // (streak/longestStreak/xp are gone).
  assert.match(
    body,
    /'metrics', jsonb_build_object\('sessionsAttended', v_attended, 'timeStudiedMinutes', v_minutes\)/,
  );
  assert.doesNotMatch(body, /'longestStreak'/);
  assert.doesNotMatch(body, /jsonb_build_object[^)]*'xp'/);
});

test('mark_notification_read: owner-scoped, sets read fields, raises notification_not_found', () => {
  const body = functionBody('mark_notification_read');
  assert.match(body, /student_id = public\.current_student_id\(\)/);
  assert.match(body, /is_read = true/);
  assert.match(body, /read_at = coalesce\(read_at, now\(\)\)/);
  assert.match(body, /updated_at = now\(\)/);
  assert.match(body, /raise exception 'notification_not_found'/);
});

test('mark_all_notifications_read: owner-scoped bulk update over unread, returns changed count', () => {
  const body = functionBody('mark_all_notifications_read');
  assert.match(body, /student_id = public\.current_student_id\(\)/);
  assert.match(body, /is_read = false/);
  assert.match(body, /is_read = true/);
  assert.match(body, /read_at = coalesce\(read_at, now\(\)\)/);
  assert.match(body, /count\(\*\)::int/);
});

// --- The four session RPCs, wired back into create_student_notification ------

test('the four session RPCs now dispatch notifications (gap-2 loop closed, no deferred comment)', () => {
  const cases = [
    ['submit_session_report', 'session_report_updated', 'Session summary updated'],
    ['submit_session', 'session_report_submitted', 'Session notes submitted'],
    ['approve_session', 'session_approved', 'Session approved'],
    ['reject_session', 'session_rejected', 'Session rejected'],
  ];
  for (const [rpc, type, title] of cases) {
    const body = functionBody(rpc);
    assert.match(body, /perform public\.create_student_notification\(/, `${rpc} must dispatch a notification`);
    assert.match(body, new RegExp(`'${type}'`), `${rpc} must use type ${type}`);
    assert.match(body, new RegExp(`'${title}'`), `${rpc} must use its title`);
    assert.match(body, /'\/dashboard\/'/, `${rpc} notification links to /dashboard/`);
    assert.match(body, /'session'/, `${rpc} entity_type = session`);
    // The old placeholder comment must be gone (replaced by the real call).
    assert.ok(
      !body.includes('Notification dispatch deferred to the notifications migration'),
      `${rpc} must no longer carry the deferred-notification placeholder comment`,
    );
  }
});

test('approve_session / reject_session resolve subject via allocation -> subject_id -> subjects.name', () => {
  for (const [rpc, verb] of [['approve_session', 'approved'], ['reject_session', 'rejected']]) {
    const body = functionBody(rpc);
    // Subject resolved from the session's allocation, with 'Your session' fallback.
    assert.match(body, /from public\.tutor_student_allocations alloc/, `${rpc} joins the allocation`);
    assert.match(body, /left join public\.subjects subj on subj\.id = alloc\.subject_id/, `${rpc} joins subjects`);
    assert.match(body, /where alloc\.id = v_current\.tutor_student_allocation_id/, `${rpc} keys on the session allocation`);
    assert.match(body, new RegExp(`coalesce\\(v_subject, 'Your session'\\) \\|\\| ' on ' \\|\\| v_current\\.date::text \\|\\| ' was ${verb}\\.'`), `${rpc} body text`);
  }
});
