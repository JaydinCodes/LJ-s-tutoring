const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const supabaseCli = require.resolve('supabase/dist/supabase.js');
const password = 'ProjectOdysseus!23';
const studentEmail = 'student.supabase-e2e@projectodysseus.test';
const tutorEmail = 'tutor.supabase-e2e@projectodysseus.test';

function status() {
  return JSON.parse(execFileSync(process.execPath, [supabaseCli, 'status', '-o', 'json'], { cwd: root, encoding: 'utf8' }));
}

function assertLocal(url) {
  const host = new URL(url).hostname;
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error(`Refusing to test a non-local Supabase URL: ${url}`);
}

async function api(baseUrl, serviceKey, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? 'GET',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${options.method ?? 'GET'} ${pathname} failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

async function passwordToken(baseUrl, anonKey, email) {
  const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(`Could not create local test session for ${email}`);
  return data.access_token;
}

function forgedJwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.forged-signature`;
}

async function edge(baseUrl, anonKey, name, token, body) {
  const response = await fetch(`${baseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.text() };
}

async function waitForEdge(baseUrl, anonKey, processRef) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (processRef.exitCode !== null) throw new Error('supabase functions serve exited before the authorization tests started');
    try {
      const responses = await Promise.all(
        ['grade-submission', 'refresh-stale-weekly-reports'].map((name) =>
          edge(baseUrl, anonKey, name, forgedJwt({ exp: 1 }), {}),
        ),
      );
      if (responses.every((response) => [400, 401, 403].includes(response.status))) return;
    } catch {
      // The Edge runtime is still starting or downloading its imports.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Timed out waiting for local Edge Functions');
}

async function main() {
  const local = status();
  assertLocal(local.API_URL);
  const studentToken = await passwordToken(local.API_URL, local.ANON_KEY, studentEmail);
  const tutorToken = await passwordToken(local.API_URL, local.ANON_KEY, tutorEmail);
  const [studentProfile] = await api(local.API_URL, local.SERVICE_ROLE_KEY, `/rest/v1/profiles?select=id&email=eq.${encodeURIComponent(studentEmail)}`);
  if (!studentProfile?.id) throw new Error('Run npm run test:e2e:supabase before the Edge authorization matrix.');
  const [student] = await api(local.API_URL, local.SERVICE_ROLE_KEY, `/rest/v1/students?select=id,status&profile_id=eq.${studentProfile.id}`);
  if (!student?.id) throw new Error('The local student fixture is missing.');

  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odysseus-edge-auth-'));
  const envFile = path.join(temporaryDir, '.env');
  fs.writeFileSync(envFile, [
    `SUPABASE_URL=${local.API_URL}`,
    `SUPABASE_SERVICE_ROLE_KEY=${local.SERVICE_ROLE_KEY}`,
    'GROQ_API_KEY=local-test-key-not-sent-upstream',
    'GEMINI_API_KEY=local-test-key-not-sent-upstream',
  ].join('\n'));
  const functions = spawn(process.execPath, [supabaseCli, 'functions', 'serve', '--env-file', envFile], {
    cwd: root,
    stdio: 'ignore',
  });

  try {
    await waitForEdge(local.API_URL, local.ANON_KEY, functions);
    const forgedServiceRole = forgedJwt({ role: 'service_role', exp: Math.floor(Date.now() / 1000) + 3600 });
    const expiredToken = forgedJwt({ sub: 'stale-user', role: 'authenticated', exp: 1 });

    for (const token of [forgedServiceRole, expiredToken]) {
      for (const name of ['grade-submission', 'odie-careers-chat-stream', 'refresh-stale-weekly-reports']) {
        const result = await edge(local.API_URL, local.ANON_KEY, name, token, {});
        if (result.status !== 401) throw new Error(`${name} must reject forged or expired tokens; received ${result.status}`);
      }
    }

    for (const name of ['grade-submission', 'odie-careers-chat-stream']) {
        const result = await edge(local.API_URL, local.ANON_KEY, name, tutorToken, {});
        if (result.status !== 403) throw new Error(`${name} must reject a valid wrong-role token; received ${result.status}: ${result.body}`);
    }

    for (const learnerStatus of ['inactive', 'suspended', 'pending']) {
      await api(local.API_URL, local.SERVICE_ROLE_KEY, `/rest/v1/students?id=eq.${student.id}`, { method: 'PATCH', body: { status: learnerStatus } });
      for (const name of ['grade-submission', 'odie-careers-chat-stream']) {
        const result = await edge(local.API_URL, local.ANON_KEY, name, studentToken, {});
        if (result.status !== 403) throw new Error(`${name} must reject ${learnerStatus} learner JWTs; received ${result.status}`);
      }
    }

    await api(local.API_URL, local.SERVICE_ROLE_KEY, `/rest/v1/students?id=eq.${student.id}`, { method: 'PATCH', body: { status: 'active' } });
    for (const name of ['grade-submission', 'odie-careers-chat-stream']) {
      const result = await edge(local.API_URL, local.ANON_KEY, name, studentToken, {});
      if ([401, 403].includes(result.status)) throw new Error(`${name} must admit an active learner before processing the request; received ${result.status}: ${result.body}`);
    }

    const serviceWorker = await edge(local.API_URL, local.ANON_KEY, 'grade-submission', local.SERVICE_ROLE_KEY, { submissionId: '00000000-0000-0000-0000-000000000099' });
    if (serviceWorker.status === 401 || /service_role_required|supabase_bearer_invalid/.test(serviceWorker.body)) {
      throw new Error(`Trusted worker token must pass worker authentication; received ${serviceWorker.status}: ${serviceWorker.body}`);
    }
    const cleanupWorker = await edge(local.API_URL, local.ANON_KEY, 'cleanup-submission-assets', local.SERVICE_ROLE_KEY, {});
    if (cleanupWorker.status !== 200) throw new Error(`Cleanup worker token must be accepted; received ${cleanupWorker.status}: ${cleanupWorker.body}`);
    const reportRefreshWorker = await edge(local.API_URL, local.ANON_KEY, 'refresh-stale-weekly-reports', local.SERVICE_ROLE_KEY, {});
    if (reportRefreshWorker.status !== 200) throw new Error(`Weekly-report refresh worker token must be accepted; received ${reportRefreshWorker.status}: ${reportRefreshWorker.body}`);
    console.log('Local Edge authorization matrix passed.');
  } finally {
    await api(local.API_URL, local.SERVICE_ROLE_KEY, `/rest/v1/students?id=eq.${student.id}`, { method: 'PATCH', body: { status: 'active' } }).catch(() => {});
    functions.kill();
    fs.rmSync(temporaryDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
