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
  const deployment = read('.github', 'workflows', 'deploy-production.yml');
  const edgeHelper = read('src', 'lib', 'supabase', 'edgeFunctions.ts');
  const careersRoute = read('src', 'features', 'students', 'StudentCareersRoute.tsx');

  assert.match(fn, /fetch\('https:\/\/api\.groq\.com\/openai\/v1\/chat\/completions'/, 'streaming function must call Groq');
  assert.ok(fn.includes("Accept: 'text/event-stream'"), 'Groq request must ask for streaming events');
  assert.ok(fn.includes("DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b'"), 'Odie must default to a supported Groq model');
  assert.ok(fn.includes("RETIRED_GROQ_MODELS = new Set(['llama-3.1-8b-instant'])"), 'Odie must reject the retired production model setting');
  assert.ok(deployment.includes('supabase secrets set GROQ_MODEL=openai/gpt-oss-20b'), 'production deploys must pin the supported Groq model');
  assert.ok(fn.includes("error: 'groq_not_configured'"), 'missing Groq configuration must be explicit');
  assert.ok(fn.includes("req.signal.addEventListener('abort'"), 'client disconnect must stop generation');
  assert.ok(fn.includes('const GROQ_TIMEOUT_MS = 30_000'), 'provider calls must finish before the Edge Function idle timeout');
  assert.ok(fn.includes('max_completion_tokens: 600'), 'Groq GPT-OSS responses must use the supported completion-token limit');
  assert.ok(fn.includes("reasoning_effort: 'low'"), 'learner chat must favour a fast response over hidden reasoning latency');
  assert.ok(fn.includes('include_reasoning: false'), 'hidden provider reasoning must not be streamed to learners');
  assert.ok(fn.includes('clean GitHub-flavoured Markdown'), 'Odie must return content the learner UI can format consistently');
  assert.ok(fn.includes('Keep the first answer under 350 words'), 'Odie answers must remain scannable for learners');
  assert.ok(fn.includes('EdgeRuntime.waitUntil(pumpPromise)'), 'the Edge Function must stay alive while proxying the provider stream');
  assert.ok(fn.includes('buffer.split(/\\r?\\n\\r?\\n/)'), 'the SSE parser must accept LF and CRLF event boundaries');
  assert.ok(careersRoute.includes('Odie took too long to answer'), 'provider timeouts must give learners an actionable message');
  assert.ok(fn.includes('admin.auth.getUser(token)'), 'streaming function must validate the Supabase bearer token');
  assert.ok(fn.includes("role !== 'student'"), 'streaming function must require a student profile');
  assert.ok(fn.includes("error: 'student_record_missing'"), 'streaming function must require a linked students row');
  assert.ok(fn.includes('Do not pretend to be a university admissions officer'), 'guardrails must prevent admissions-officer impersonation');
  assert.ok(fn.includes('verify current requirements on official institution pages'), 'guardrails must label uncertainty and require verification');
  assert.ok(fn.includes('Never reveal, infer, or reference another student'), 'guardrails must protect other students data');
  assert.ok(edgeHelper.includes('api_html_response'), 'streaming helper must guard against an HTML fallback response');
  assert.ok(careersRoute.includes("streamSupabaseFunctionText('odie-careers-chat-stream'"), 'careers chat must call the Edge Function, not the retired Fastify API');
});
