const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('active tooling and CI use the supported Node 24 and npm 11 runtime', () => {
  const packageJson = JSON.parse(read('package.json'));
  const packageLock = JSON.parse(read('package-lock.json'));
  const workflows = [
    '.github/workflows/app-ci.yml',
    '.github/workflows/lighthouse-ci.yml',
    '.github/workflows/preview-deploy.yml',
    '.github/workflows/qa.yml',
    '.github/workflows/release-gates.yml',
  ];

  assert.deepEqual(packageJson.engines, { node: '24.x', npm: '11.x' });
  assert.deepEqual(packageLock.packages[''].engines, packageJson.engines);
  assert.equal(packageLock.lockfileVersion, 3);
  assert.equal(read('.nvmrc').trim(), '24');

  for (const workflowPath of workflows) {
    const workflow = read(workflowPath);
    const configuredVersions = [...workflow.matchAll(/node-version:\s*['"]?(\d+)/g)]
      .map((match) => match[1]);

    assert.ok(configuredVersions.length > 0, `${workflowPath} must configure Node.js`);
    assert.deepEqual(
      [...new Set(configuredVersions)],
      ['24'],
      `${workflowPath} must use only Node.js 24`,
    );
  }
});

test('active TypeScript and React sources are covered by the canonical lint gate', () => {
  const packageJson = JSON.parse(read('package.json'));
  const eslintConfig = require(path.join(root, '.eslintrc.js'));
  const reactOverride = eslintConfig.overrides.find((override) =>
    override.files?.includes('src/**/*.{ts,tsx}'),
  );

  assert.match(packageJson.scripts['lint:react'], /src\/\*\*\/\*\.\{ts,tsx\}/);
  assert.match(packageJson.scripts.lint, /lint:react/);
  assert.ok(reactOverride, 'expected an ESLint override for active TypeScript/React sources');
  assert.equal(reactOverride.parser, '@typescript-eslint/parser');
  assert.ok(reactOverride.plugins.includes('react-hooks'));
  assert.ok(reactOverride.plugins.includes('jsx-a11y'));
  assert.ok(reactOverride.rules['@typescript-eslint/no-floating-promises']);
  assert.equal(reactOverride.rules['react-hooks/rules-of-hooks'], 'error');
});

test('production dependency audit is a required app CI gate', () => {
  const packageJson = JSON.parse(read('package.json'));
  const packageLock = JSON.parse(read('package-lock.json'));
  const workflow = read('.github/workflows/app-ci.yml');
  const auditJob = workflow.slice(
    workflow.indexOf('  dependency-security:'),
    workflow.indexOf('\n  lint:', workflow.indexOf('  dependency-security:')),
  );

  assert.ok(packageJson.devDependencies['@vitejs/plugin-react']);
  assert.ok(packageJson.devDependencies['@tailwindcss/typography']);
  assert.equal(packageJson.dependencies['@emotion/is-prop-valid'], '1.4.0');
  assert.equal(packageLock.packages[''].dependencies['@emotion/is-prop-valid'], '1.4.0');
  assert.equal(packageJson.dependencies?.['@vitejs/plugin-react'], undefined);
  assert.equal(packageJson.dependencies?.['@tailwindcss/typography'], undefined);
  assert.match(auditJob, /npm audit --omit=dev --audit-level=high/);
  assert.doesNotMatch(auditJob, /continue-on-error/);
});

test('frontend mock journeys are a required, explicitly scoped app CI job', () => {
  const workflow = read('.github/workflows/app-ci.yml');
  const smokeJob = workflow.slice(
    workflow.indexOf('  frontend-smoke:'),
    workflow.indexOf('\n  build:', workflow.indexOf('  frontend-smoke:')),
  );

  assert.match(smokeJob, /npm run test:e2e:install/);
  assert.match(smokeJob, /Run frontend mock smoke journeys/);
  assert.match(smokeJob, /npm run test:e2e/);
  assert.match(smokeJob, /Runtime Supabase\/RLS and seeded local-Supabase/);
  assert.doesNotMatch(smokeJob, /continue-on-error/);
});

test('runtime Supabase RLS tests rebuild committed migrations in app CI', () => {
  const packageJson = JSON.parse(read('package.json'));
  const workflow = read('.github/workflows/app-ci.yml');
  const runtimeJob = workflow.slice(
    workflow.indexOf('  supabase-rls-runtime:'),
    workflow.indexOf('\n  frontend-smoke:', workflow.indexOf('  supabase-rls-runtime:')),
  );

  assert.match(packageJson.devDependencies.supabase, /^\d+\.\d+\.\d+$/);
  assert.equal(packageJson.scripts['test:rls:runtime'], 'npx supabase test db');
  assert.match(runtimeJob, /npm run supabase:start/);
  assert.match(runtimeJob, /npm run supabase:reset/);
  assert.match(runtimeJob, /npm run test:rls:runtime/);
  assert.match(runtimeJob, /npm run supabase:types:check/);
  assert.match(runtimeJob, /npm run test:e2e:supabase/);
  assert.match(runtimeJob, /seeded local-Supabase role journeys/i);
  assert.doesNotMatch(runtimeJob, /continue-on-error/);
  assert.ok(fs.existsSync(path.join(root, 'supabase', 'tests', 'database', 'rls_role_matrix.test.sql')));
});

test('real Supabase browser gate covers the released academic loop and real admin AAL2', () => {
  const runner = read('scripts/run-local-supabase-e2e.cjs');
  const journeys = read('tests/e2e-react/supabase-role-journeys.spec.ts');

  assert.match(runner, /assertLoopback\('Supabase API URL'/);
  assert.match(runner, /assertLoopback\('Supabase database URL'/);
  assert.match(runner, /VITE_PO_DEV_ADMIN_MFA_BYPASS: 'false'/);
  assert.match(journeys, /page\.on\('pageerror'/);
  assert.match(journeys, /message\.type\(\) === 'error'/);
  assert.match(journeys, /response\.status\(\) >= 400/);
  assert.match(journeys, /local-supabase-evidence\.pdf/);
  assert.match(journeys, /Submission review saved\./);
  assert.match(journeys, /fresh student session sees the tutor-released result/);
  assert.match(journeys, /84% average/);
  assert.match(journeys, /Start MFA setup/);
  assert.match(journeys, /currentTotp\(secret!/);
  assert.match(journeys, /Verify and unlock admin/);
});

test('accessibility and link checks use pinned local tools and canonical routes', () => {
  const packageJson = JSON.parse(read('package.json'));
  const pa11yConfig = JSON.parse(read('.pa11yci'));
  const qaWorkflow = read('.github/workflows/qa.yml');
  const pinnedTools = ['@lhci/cli', 'linkinator', 'pa11y-ci', 'wait-on'];
  const canonicalRoutes = [
    '/',
    '/about',
    '/programs',
    '/guides',
    '/guides/matric-maths-mistakes-guide',
    '/privacy',
    '/terms',
    '/dashboard/login',
  ];

  for (const tool of pinnedTools) {
    assert.match(packageJson.devDependencies[tool], /^\d+\.\d+\.\d+$/);
  }

  assert.deepEqual(
    pa11yConfig.urls,
    canonicalRoutes.map((route) => `http://localhost:8080${route}`),
  );
  for (const route of canonicalRoutes) {
    assert.match(packageJson.scripts['qa:links'], new RegExp(`localhost:8080${route.replaceAll('/', '\\/')}(?:\\s|$)`));
  }

  assert.match(qaWorkflow, /npm run --silent qa:links/);
  assert.match(qaWorkflow, /npm run --silent qa:a11y/);
  assert.doesNotMatch(qaWorkflow, /npx (?:linkinator|pa11y-ci|wait-on)/);
});

test('Lighthouse and release workflows use the same pinned package commands', () => {
  const packageJson = JSON.parse(read('package.json'));
  const lighthouseConfig = read('lighthouserc.js');
  const appWorkflow = read('.github/workflows/app-ci.yml');
  const lighthouseWorkflow = read('.github/workflows/lighthouse-ci.yml');
  const releaseWorkflow = read('.github/workflows/release-gates.yml');

  assert.equal(packageJson.scripts['perf:lighthouse'], 'lhci autorun --config=./lighthouserc.js');
  assert.match(lighthouseConfig, /chromePath: process\.env\.CHROME_PATH/);
  assert.doesNotMatch(lighthouseWorkflow, /npx (?:http-server|wait-on|lhci)/);
  assert.match(lighthouseWorkflow, /npm run qa:serve/);
  assert.match(lighthouseWorkflow, /npm run qa:wait/);
  assert.match(lighthouseWorkflow, /npm run perf:lighthouse/);
  assert.match(releaseWorkflow, /Install system Chromium for Lighthouse/);
  assert.match(releaseWorkflow, /SYSTEM_CHROME_PATH=/);
  assert.match(releaseWorkflow, /CHROME_PATH: \$\{\{ env\.SYSTEM_CHROME_PATH \}\}/);

  for (const command of ['lint', 'typecheck', 'test', 'build', 'perf:budget', 'validate:monitoring']) {
    const invocation = command === 'test' ? 'npm test' : `npm run ${command}`;
    assert.match(appWorkflow + lighthouseWorkflow, new RegExp(invocation.replaceAll(':', '\\:')));
    assert.match(releaseWorkflow, new RegExp(invocation.replaceAll(':', '\\:')));
  }
  for (const command of ['test:e2e:install', 'test:e2e', 'qa:html', 'qa:links', 'qa:a11y', 'perf:lighthouse']) {
    assert.match(releaseWorkflow, new RegExp(`npm run ${command.replaceAll(':', '\\:')}`));
  }
  for (const command of ['supabase:start', 'supabase:reset', 'test:rls:runtime', 'supabase:types:check', 'test:e2e:supabase']) {
    assert.match(releaseWorkflow, new RegExp(`npm run ${command.replaceAll(':', '\\:')}`));
  }
  assert.ok(
    releaseWorkflow.indexOf('npm run test:rls:runtime') < releaseWorkflow.indexOf('npm run test:e2e'),
    'runtime database authorization must pass before browser gates',
  );
  assert.ok(
    releaseWorkflow.indexOf('npm run supabase:types:check') < releaseWorkflow.indexOf('npm run test:e2e:supabase'),
    'generated type drift must pass before seeded local-Supabase browser journeys',
  );
  assert.match(releaseWorkflow, /PUPPETEER_EXECUTABLE_PATH/);
  assert.doesNotMatch(releaseWorkflow, /npx (?:http-server|wait-on|lhci)/);
});

test('uptime monitoring validates the exact web and Supabase health contracts', () => {
  const health = JSON.parse(read('health.json'));
  const workflow = read('.github/workflows/uptime-check.yml');

  assert.deepEqual(health, {
    status: 'ok',
    service: 'project-odysseus-web',
    version: '1',
  });
  assert.match(workflow, /secrets\.HEALTHCHECK_URL/);
  assert.match(workflow, /secrets\.SUPABASE_URL/);
  assert.match(workflow, /secrets\.SUPABASE_ANON_KEY/);
  assert.match(workflow, /permissions:[\s\S]*contents: read[\s\S]*issues: write/);
  assert.match(workflow, /content-type:\.\*application\/json/);
  assert.match(workflow, /keys == \["service", "status", "version"\]/);
  assert.match(workflow, /\.version == "1"/);
  assert.match(workflow, /\/auth\/v1\/health/);
  assert.match(workflow, /\/rest\/v1\/profiles\?select=id&limit=0/);
  assert.match(workflow, /type == "array" and length == 0/);
  assert.match(workflow, /issues\.listForRepo/);
  assert.match(workflow, /issues\.createComment/);
  assert.doesNotMatch(workflow, /skipping/i);
});

test('production deployment is gated by the tested main SHA and workflow actions are immutable', () => {
  const appSpec = read('.do/app.yaml');
  const releaseWorkflow = read('.github/workflows/release-gates.yml');
  const deploymentWorkflow = read('.github/workflows/deploy-production.yml');
  const workflowDirectory = path.join(root, '.github', 'workflows');

  assert.match(appSpec, /deploy_on_push:\s*false/);
  assert.match(releaseWorkflow, /pull_request:/);
  assert.match(releaseWorkflow, /branches: \[ main \]/);
  assert.match(deploymentWorkflow, /workflow_run:/);
  assert.match(deploymentWorkflow, /workflows: \["Release Gates"\]/);
  assert.match(deploymentWorkflow, /workflow_run\.conclusion == 'success'/);
  assert.match(deploymentWorkflow, /workflow_run\.head_sha/);
  assert.match(deploymentWorkflow, /secrets\.DIGITAL_ACCESS_TOKEN/);
  assert.match(deploymentWorkflow, /secrets\.DIGITAL_APP_ID/);
  assert.match(deploymentWorkflow, /doctl apps create-deployment/);
  assert.match(deploymentWorkflow, /Apply Supabase migrations and Edge Functions/);
  assert.match(deploymentWorkflow, /SUPABASE_ACCESS_TOKEN/);
  assert.match(deploymentWorkflow, /SUPABASE_PRODUCTION_PROJECT_REF/);
  assert.match(deploymentWorkflow, /SUPABASE_DB_PASSWORD/);
  assert.match(deploymentWorkflow, /supabase link --project-ref/);
  assert.match(deploymentWorkflow, /supabase db push --linked/);
  assert.match(deploymentWorkflow, /supabase db push/);
  assert.match(deploymentWorkflow, /supabase functions deploy .*--use-api/);
  assert.match(deploymentWorkflow, /Bootstrap and verify recovery schedules/);
  assert.match(deploymentWorkflow, /private\.ensure_recovery_schedules/);
  assert.match(deploymentWorkflow, /private\.assert_recovery_schedules_ready/);

  for (const filename of fs.readdirSync(workflowDirectory).filter((name) => name.endsWith('.yml'))) {
    const workflow = read(path.join('.github', 'workflows', filename));
    for (const reference of workflow.matchAll(/^\s*(?:-\s+)?uses:\s+[^@\s]+@([^\s#]+)/gm)) {
      assert.match(reference[1], /^[a-f0-9]{40}$/i, `${filename} has an unpinned action reference`);
    }
  }
});

test('service worker rejects incomplete or mis-typed app shells and bounds navigation fetches', () => {
  const worker = read('sw.js');
  const workerRegistration = read('assets/sw-register.js');
  const staticBuild = read('scripts/build-static.js');

  assert.doesNotMatch(worker, /Promise\.allSettled/);
  assert.match(worker, /await Promise\.all\(/);
  assert.match(worker, /PRECACHE_TIMEOUT_MS/);
  assert.match(worker, /NAVIGATION_TIMEOUT_MS/);
  assert.match(worker, /fetchWithTimeout\(req, NAVIGATION_TIMEOUT_MS\)/);
  assert.match(worker, /function isCacheableResponse/);
  assert.match(worker, /text\\\/html/);
  assert.match(worker, /text\\\/css/);
  assert.match(worker, /javascript/);
  assert.match(worker, /Precache failed validation/);
  assert.match(worker, /isCacheableResponse\(req, res\)/);
  assert.match(worker, /fresh\.redirected/);
  assert.match(worker, /Response\.redirect\(redirectedUrl\.toString\(\), 302\)/);
  assert.match(workerRegistration, /PORTAL_DASHBOARDS/);
  assert.match(workerRegistration, /navigator\.serviceWorker\.getRegistrations\(\)/);
  assert.match(workerRegistration, /registration\.unregister\(\)/);
  assert.match(workerRegistration, /location\.replace\(portalDashboard\)/);
  assert.match(staticBuild, /<script defer src="\/assets\/sw-register\.js"><\/script>/);
});

test('SEC-02 security headers are an executable edge policy with live production probes', () => {
  const packageJson = JSON.parse(read('package.json'));
  const worker = read('cloudflare/src/worker.mjs');
  const workerConfig = read('cloudflare/wrangler.toml');
  const probe = read('scripts/verify-production-security-headers.cjs');
  const uptime = read('.github/workflows/uptime-check.yml');
  const deployment = read('.github/workflows/deploy-production.yml');
  const structuredData = read('src/components/seo/StructuredData.tsx');
  const rootHtml = read('index.html');
  const staticBuild = read('scripts/build-static.js');

  assert.match(workerConfig, /main = "src\/worker\.mjs"/);
  assert.match(worker, /ORIGIN_URL/);
  assert.match(worker, /PORTALS/);
  for (const [host, dashboard] of [
    ['admin.projectodysseus.live', '/dashboard/admin/'],
    ['tutor.projectodysseus.live', '/dashboard/tutor/'],
    ['student.projectodysseus.live', '/dashboard/student/'],
  ]) {
    assert.match(worker, new RegExp(`'${host.replaceAll('.', '\\.')}'\\s*:\\s*'${dashboard.replaceAll('/', '\\/')}'`));
  }
  assert.match(worker, /requestedUrl\.pathname === '\/'/);
  assert.match(worker, /Response\.redirect\(requestedUrl\.toString\(\), 302\)/);
  assert.match(worker, /requestedUrl\.pathname\.startsWith\('\/dashboard\/'\)/);
  assert.match(worker, /\$\{portalEntryPoint\}index\.html/);
  assert.match(worker, /X-Frame-Options': 'DENY'/);
  assert.match(worker, /X-Content-Type-Options': 'nosniff'/);
  assert.match(worker, /Strict-Transport-Security/);
  assert.match(worker, /frame-ancestors 'none'/);
  assert.match(worker, /'nonce-\$\{nonce\}'/);
  assert.match(worker, /HTMLRewriter/);
  assert.match(worker, /name="csp-nonce"/);
  assert.match(worker, /Cache-Control', 'no-store, max-age=0'/);

  assert.equal(packageJson.scripts['verify:production:headers'], 'node scripts/verify-production-security-headers.cjs');
  assert.match(probe, /PRODUCTION_ORIGINS is required/);
  assert.match(probe, /X-Frame-Options must be DENY/);
  assert.match(probe, /X-Content-Type-Options must be nosniff/);
  assert.match(probe, /Strict-Transport-Security must have max-age/);
  assert.match(probe, /frame-ancestors/);
  assert.match(probe, /__security_header_probe/);
  assert.match(uptime, /vars\.PRODUCTION_ORIGINS/);
  assert.match(uptime, /npm run verify:production:headers/);
  assert.match(deployment, /npm run verify:production:headers/);
  assert.match(deployment, /source_commit_hash/);
  assert.match(deployment, /Deployment source mismatch/);

  assert.match(structuredData, /meta\[name="csp-nonce"\]/);
  assert.match(structuredData, /nonce=\{cspNonce\(\)\}/);
  assert.doesNotMatch(rootHtml + staticBuild, /frame-ancestors 'none'/);
});
