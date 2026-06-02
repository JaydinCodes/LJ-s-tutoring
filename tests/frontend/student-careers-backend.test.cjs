const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('career profile API persists learner context with RLS-backed storage', () => {
  const route = read('lms-api', 'src', 'routes', 'odie-careers.ts');
  const schema = read('lms-api', 'src', 'lib', 'schemas.ts');
  const migration = read('lms-api', 'prisma', 'migrations', '20260603_student_career_profiles', 'migration.sql');
  const supabase = read('docs', 'supabase', 'schema.sql');

  assert.ok(route.includes("app.get('/odie-careers/profile'"), 'profile read endpoint must exist');
  assert.ok(route.includes("app.put('/odie-careers/profile'"), 'profile update endpoint must exist');
  assert.ok(route.includes('StudentCareerProfileUpdateSchema'), 'profile payload must be validated');
  assert.ok(schema.includes('savedCareers'), 'saved careers must be part of the typed payload');
  assert.ok(migration.includes('create table if not exists student_career_profiles'), 'profile table must be created');
  assert.ok(migration.includes('alter table student_career_profiles enable row level security'), 'profile table must enable RLS');
  assert.ok(migration.includes('student_id::text = current_setting'), 'RLS must scope rows to the current student');
  assert.ok(supabase.includes('create table if not exists public.student_career_profiles'), 'Supabase schema must document the profile table');
  assert.ok(supabase.includes('students_upsert_own_career_profile'), 'Supabase schema must document student-owned profile writes');
});

test('streaming Odie career chat is Groq-backed and guarded', () => {
  const route = read('lms-api', 'src', 'routes', 'assistant.ts');

  assert.ok(route.includes("app.post('/assistant/careers-chat/stream'"), 'streaming careers endpoint must exist');
  assert.ok(route.includes('https://api.groq.com/openai/v1/chat/completions'), 'streaming endpoint must call Groq');
  assert.ok(route.includes('Accept: \'text/event-stream\''), 'Groq request must ask for streaming events');
  assert.ok(route.includes('req.raw.on(\'close\', () => controller.abort())'), 'client disconnect must stop generation');
  assert.ok(route.includes('Do not pretend to be a university admissions officer'), 'guardrails must prevent admissions-officer impersonation');
  assert.ok(route.includes('verify current requirements on official institution pages'), 'guardrails must label uncertainty and require verification');
  assert.ok(route.includes('Never reveal, infer, or reference another student'), 'guardrails must protect other students data');
});
