const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const schema = fs.readFileSync(path.join(root, 'docs', 'supabase', 'schema.sql'), 'utf8');
const route = fs.readFileSync(path.join(root, 'src', 'features', 'onboarding', 'OnboardingRoute.tsx'), 'utf8');
const mutations = fs.readFileSync(path.join(root, 'src', 'features', 'onboarding', 'onboardingMutations.ts'), 'utf8');
const authService = fs.readFileSync(path.join(root, 'src', 'features', 'auth', 'authService.ts'), 'utf8');
const adminInviteFunction = fs.readFileSync(path.join(root, 'supabase', 'functions', 'admin-invite-user', 'index.ts'), 'utf8');
const runtimeRls = fs.readFileSync(path.join(root, 'supabase', 'tests', 'database', 'rls_role_matrix.test.sql'), 'utf8');
const migrationNames = fs.readdirSync(path.join(root, 'supabase', 'migrations'))
  .filter((name) => name.endsWith('_phase1_transactional_onboarding_rate_limit.sql'));
assert.equal(migrationNames.length, 1, 'expected one immutable Phase 1 forward migration');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', migrationNames[0]), 'utf8');

function functionBody(name) {
  const start = schema.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `expected public.${name} to be defined`);
  const remaining = schema.slice(start);
  const end = remaining.indexOf('$$;');
  assert.notEqual(end, -1, `expected public.${name} to terminate with $$;`);
  return remaining.slice(0, end + 3);
}

test('onboard_current_user derives identity and binds new onboarding to the admin invitation', () => {
  const body = functionBody('onboard_current_user');

  assert.match(body, /returns jsonb/);
  assert.match(body, /security definer/);
  assert.match(body, /set search_path = ''/);
  assert.match(body, /v_auth_user_id uuid := auth\.uid\(\)/);
  assert.match(body, /from auth\.users u[\s\S]*u\.id = v_auth_user_id/);
  assert.match(body, /u\.email_confirmed_at[\s\S]*v_email is null or v_email_confirmed_at is null/);
  assert.match(body, /u\.invited_at/);
  assert.match(body, /u\.raw_app_meta_data ->> 'onboarding_role'/);
  assert.doesNotMatch(body, /u\.raw_user_meta_data/);
  assert.match(body, /v_invited_at is null[\s\S]*onboarding_invitation_required/);
  assert.match(body, /v_authorized_role is null or v_authorized_role not in \('student', 'tutor'\)[\s\S]*onboarding_invitation_role_required/);
  assert.match(body, /v_authorized_role <> p_role[\s\S]*onboarding_invitation_role_mismatch/);
  assert.match(body, /p_role is null or p_role not in \('student', 'tutor'\)/);
  assert.match(body, /pg_advisory_xact_lock/);
  assert.match(body, /insert into public\.profiles/);
  assert.match(body, /insert into public\.students/);
  assert.match(body, /insert into public\.tutors/);
  assert.match(body, /'onboarding\.completed'/);
  assert.doesNotMatch(body, /\bp_email\b/);
  assert.doesNotMatch(body, /\bp_hourly_rate\b/);
  assert.match(body, /hourly_rate,[\s\S]*values \([\s\S]*v_grades,[\s\S]*null,[\s\S]*'pending'/);

  const completedRetry = body.indexOf("if found and v_requested_role = 'student'");
  const invitationRead = body.indexOf('u.invited_at');
  assert.ok(completedRetry !== -1 && completedRetry < invitationRead, 'completed admin-provisioned accounts remain idempotent before invitation checks');
});

test('onboarding RPC is authenticated-only and direct self-insert policies stay removed', () => {
  const signature = 'public\\.onboard_current_user\\(text, text, text, text, text, text, text, text\\[\\], text\\[\\]\\)';
  assert.match(schema, new RegExp(`revoke execute on function ${signature} from public;`));
  assert.match(schema, new RegExp(`revoke execute on function ${signature} from anon;`));
  assert.match(schema, new RegExp(`grant execute on function ${signature} to authenticated;`));

  for (const policy of [
    'profiles_insert_self_student_or_tutor',
    'students_insert_self',
    'tutors_insert_self_pending',
  ]) {
    assert.doesNotMatch(schema, new RegExp(`create policy "${policy}"`));
    assert.match(schema, new RegExp(`drop policy if exists "${policy}"`));
  }
});

test('onboarding frontend uses one RPC and exposes neither email nor tutor rate inputs', () => {
  assert.match(mutations, /rpc\('onboard_current_user'/);
  assert.doesNotMatch(mutations, /\.from\('(?:profiles|students|tutors)'\)/);
  assert.doesNotMatch(mutations, /auth\.getUser/);
  assert.doesNotMatch(mutations, /\bemail\b/i);
  assert.doesNotMatch(mutations, /hourlyRate|hourly_rate/);
  assert.doesNotMatch(route, /FormField label="Email"/);
  assert.doesNotMatch(route, /FormField label="Hourly rate"/);
  assert.doesNotMatch(route, /setEmail|setHourlyRate/);
});

test('public magic links never create an uninvited Auth identity', () => {
  assert.match(
    authService,
    /signInWithOtp\(\{[\s\S]*email,[\s\S]*options:\s*\{\s*emailRedirectTo:\s*redirectTo,\s*shouldCreateUser:\s*false\s*\}/,
  );
});

test('admin invite stamps role in trusted app metadata without discarding provider fields', () => {
  assert.match(adminInviteFunction, /const userMetadata = \{ full_name: input\.fullName \}/);
  assert.doesNotMatch(adminInviteFunction, /const userMetadata = \{[^}]*role/);
  assert.match(adminInviteFunction, /existingAppMetadata = data\.user\?\.app_metadata \?\? \{\}/);
  assert.match(
    adminInviteFunction,
    /updateUserById\(userId,[\s\S]*app_metadata:\s*\{[\s\S]*\.\.\.existingAppMetadata,[\s\S]*onboarding_role:\s*input\.role/,
  );
});

test('runtime pgTAP matrix covers onboarding invitation failures and cross-role RLS isolation', () => {
  assert.match(runtimeRls, /onboarding_invitation_required/);
  assert.match(runtimeRls, /onboarding_invitation_role_required/);
  assert.match(runtimeRls, /onboarding_invitation_role_mismatch/);
  assert.match(runtimeRls, /onboarding_role_conflict/);
  assert.match(runtimeRls, /'rls-invited-student@example\.test', 'student', 'tutor', true/);
  assert.match(runtimeRls, /'rls-invited-no-role@example\.test', null, 'student', true/);
  assert.match(runtimeRls, /get_student_assignment_submissions/);
  assert.match(runtimeRls, /get_parent_progress_reports/);
  assert.match(runtimeRls, /get_org_cohort_report/);
  assert.match(runtimeRls, /storage\.objects/);
  assert.match(runtimeRls, /student cannot upload a cross-organization submission key/);
  assert.match(runtimeRls, /AAL2 admin sees assignments across organizations/);
  assert.match(runtimeRls, /service-role limiter allows the first request/);
  assert.match(runtimeRls, /service-role limiter denies requests beyond the threshold/);
  assert.match(runtimeRls, /authenticated browser role cannot execute the service-role limiter/);
  assert.match(runtimeRls, /limiter deletes events older than 24 hours/);
  assert.match(runtimeRls, /forced_rate_limit_insert_failure/);
});

test('edge-function limiter performs one locked check-and-record operation', () => {
  const body = functionBody('check_and_record_edge_function_rate_limit');

  assert.match(
    body,
    /p_subject_id uuid,[\s\S]*p_function_name text,[\s\S]*p_limit integer,[\s\S]*p_window_seconds integer/,
  );
  assert.match(body, /returns boolean/);
  assert.match(body, /security definer/);
  assert.match(body, /set search_path = ''/);
  assert.match(body, /pg_advisory_xact_lock/);
  assert.match(body, /delete from public\.edge_function_rate_limit_events[\s\S]*interval '24 hours'/);
  assert.match(body, /select count\(\*\)[\s\S]*p_window_seconds/);
  assert.match(body, /if v_recent_count >= p_limit then[\s\S]*return false/);
  assert.match(body, /insert into public\.edge_function_rate_limit_events/);
  assert.match(body, /return true/);

  const signature = 'public\\.check_and_record_edge_function_rate_limit\\(uuid, text, integer, integer\\)';
  for (const role of ['public', 'anon', 'authenticated']) {
    assert.match(schema, new RegExp(`revoke execute on function ${signature} from ${role};`));
  }
  assert.match(schema, new RegExp(`grant execute on function ${signature} to service_role;`));
});

test('forward migration carries only the Phase 1 policy, onboarding, and limiter upgrade', () => {
  assert.match(migration, /drop policy if exists "profiles_insert_self_student_or_tutor"/);
  assert.match(migration, /drop policy if exists "students_insert_self"/);
  assert.match(migration, /drop policy if exists "tutors_insert_self_pending"/);
  assert.match(migration, /create or replace function public\.onboard_current_user\(/);
  assert.match(migration, /u\.email_confirmed_at/);
  assert.match(migration, /u\.invited_at/);
  assert.match(migration, /u\.raw_app_meta_data ->> 'onboarding_role'/);
  assert.doesNotMatch(migration, /u\.raw_user_meta_data/);
  assert.match(migration, /onboarding_invitation_required/);
  assert.match(migration, /onboarding_invitation_role_required/);
  assert.match(migration, /onboarding_invitation_role_mismatch/);
  assert.match(migration, /create or replace function public\.check_and_record_edge_function_rate_limit\(/);
  assert.match(migration, /grant execute on function public\.onboard_current_user[\s\S]*to authenticated/);
  assert.match(migration, /grant execute on function public\.check_and_record_edge_function_rate_limit[\s\S]*to service_role/);
  assert.doesNotMatch(migration, /create table|alter table .* enable row level security/i);
});
