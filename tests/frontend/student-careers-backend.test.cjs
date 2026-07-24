const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('career profile storage is RLS-backed in the Supabase schema', () => {
  const supabase = read('docs', 'supabase', 'schema.sql');

  assert.ok(supabase.includes('create table if not exists public.student_career_profiles'), 'Supabase schema must document the profile table');
  assert.ok(supabase.includes('students_upsert_own_career_profile'), 'Supabase schema must document student-owned profile writes');
});

test('streaming Odie career chat is Groq-backed via a Supabase Edge Function and guarded', () => {
  const fn = read('supabase', 'functions', 'odie-careers-chat-stream', 'index.ts');
  const edgeHelper = read('src', 'lib', 'supabase', 'edgeFunctions.ts');
  const careersRoute = read('src', 'features', 'students', 'StudentCareersRoute.tsx');

  assert.ok(fn.includes('https://api.groq.com/openai/v1/chat/completions'), 'streaming function must call Groq');
  assert.ok(fn.includes("Accept: 'text/event-stream'"), 'Groq request must ask for streaming events');
  assert.ok(fn.includes("error: 'groq_not_configured'"), 'missing Groq configuration must be explicit');
  assert.ok(fn.includes("req.signal.addEventListener('abort'"), 'client disconnect must stop generation');
  assert.ok(fn.includes('admin.auth.getUser(token)'), 'streaming function must validate the Supabase bearer token');
  assert.ok(fn.includes("role !== 'student'"), 'streaming function must require a student profile');
  assert.ok(fn.includes("error: 'student_record_missing'"), 'streaming function must require a linked students row');
  assert.ok(fn.includes('Do not pretend to be a university admissions officer'), 'guardrails must prevent admissions-officer impersonation');
  assert.ok(fn.includes('verify current requirements on official institution pages'), 'guardrails must label uncertainty and require verification');
  assert.ok(fn.includes('Never reveal, infer, or reference another student'), 'guardrails must protect other students data');
  assert.ok(edgeHelper.includes('api_html_response'), 'streaming helper must guard against an HTML fallback response');
  assert.ok(careersRoute.includes("streamSupabaseFunctionText('odie-careers-chat-stream'"), 'careers chat must call the Edge Function, not the retired Fastify API');
});
