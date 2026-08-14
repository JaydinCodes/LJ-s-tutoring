const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');

function functionConfigSection(config, name) {
  const start = config.indexOf(`[functions.${name}]`);
  if (start === -1) return null;
  const next = config.indexOf('\n[', start + 1);
  return config.slice(start, next === -1 ? undefined : next);
}

test('learner-facing Edge Functions require an active student record, not merely a valid JWT', () => {
  const odie = read('supabase/functions/odie-careers-chat-stream/index.ts');
  const grading = read('supabase/functions/grade-submission/index.ts');

  for (const source of [odie, grading]) {
    assert.match(source, /admin\.auth\.getUser\(token\)/);
    assert.match(source, /\.from\('students'\)[\s\S]{0,240}\.eq\('status', 'active'\)/);
  }
  assert.match(odie, /operational student access requires an active/);
  assert.ok(
    grading.indexOf(".eq('status', 'active')") < grading.indexOf("error: 'gemini_not_configured'"),
    'grade-submission must reject inactive or wrong-role users before checking optional Gemini configuration',
  );
  assert.ok(
    odie.indexOf(".eq('status', 'active')") < odie.indexOf("error: 'groq_not_configured'"),
    'careers chat must reject inactive or wrong-role users before checking optional Groq configuration',
  );
});

test('privileged workers require the actual service-role secret and do not trust decoded JWT role claims', () => {
  const grading = read('supabase/functions/grade-submission/index.ts');
  const cleanup = read('supabase/functions/cleanup-submission-assets/index.ts');
  const reportRefresh = read('supabase/functions/refresh-stale-weekly-reports/index.ts');
  const trustedWorker = read('supabase/functions/_shared/trusted-worker.ts');

  for (const source of [grading, cleanup, reportRefresh]) {
    assert.match(source, /isTrustedServiceWorkerToken\(token, serviceRoleKey\)/);
    assert.doesNotMatch(source, /decodeJwtPayload|safeJwtRole|decodeRole/);
  }
  assert.match(grading, /if \(!isTrustedWorker\)/);
  assert.match(grading, /if \(isTrustedWorker\)/);
  assert.match(trustedWorker, /token\.length !== serviceRoleKey\.length/);
  assert.match(trustedWorker, /difference \|=/);
});

test('all non-public Edge Functions explicitly retain gateway JWT verification', () => {
  const config = read('supabase/config.toml');
  for (const name of ['admin-invite-user', 'complete-temporary-password', 'cleanup-submission-assets', 'grade-submission', 'odie-careers-chat-stream', 'refresh-stale-weekly-reports']) {
    const section = functionConfigSection(config, name);
    assert.ok(section, `expected a config section for ${name}`);
    assert.match(section, /^verify_jwt\s*=\s*true\s*$/m);
  }

  execFileSync(process.execPath, ['scripts/verify-edge-function-policy.cjs'], { cwd: root, stdio: 'pipe' });
});

test('the local runtime Edge authorization matrix is a required executable CI command', () => {
  const packageJson = JSON.parse(read('package.json'));
  const appCi = read('.github/workflows/app-ci.yml');
  const releaseGates = read('.github/workflows/release-gates.yml');

  assert.equal(packageJson.scripts['test:edge:auth:runtime'], 'node scripts/test-local-edge-function-auth.cjs');
  assert.match(appCi, /npm run test:edge:auth:runtime/);
  assert.match(releaseGates, /npm run test:edge:auth:runtime/);
});

test('production deployment verifies the deployed Edge gateway policy with a pinned CLI', () => {
  const deployment = read('.github/workflows/deploy-production.yml');

  assert.match(deployment, /Install pinned deployment tooling/);
  assert.match(deployment, /HUSKY=0 npm ci/);
  assert.match(deployment, /SUPABASE_ACCESS_TOKEN/);
  assert.match(deployment, /SUPABASE_PRODUCTION_PROJECT_REF/);
  assert.match(deployment, /npm run verify:edge-function-policy -- --production/);
});

test('new SECURITY DEFINER functions and the schema inventory have executable guardrails', () => {
  const packageJson = JSON.parse(read('package.json'));
  execFileSync(process.execPath, ['scripts/check-security-definer-search-path.cjs'], { cwd: root, stdio: 'pipe' });
  assert.match(packageJson.scripts['supabase:docs:update'], /generate-supabase-schema-docs/);
  assert.match(packageJson.scripts['supabase:docs:check'], /--check/);
  assert.match(read('docs/supabase/SCHEMA_AND_POLICY_INVENTORY.md'), /Canonical Supabase Schema and Policy Inventory/);
});
