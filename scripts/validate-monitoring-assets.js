#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error(`Monitoring validation failed: ${message}`);
  process.exit(1);
}

function read(relativePath) {
  const filePath = path.join(root, ...relativePath.split('/'));
  if (!fs.existsSync(filePath)) {
    fail(`missing ${relativePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function mustInclude(source, pattern, description) {
  if (!pattern.test(source)) {
    fail(`missing ${description}`);
  }
}

let health;
try {
  health = JSON.parse(read('health.json'));
} catch (error) {
  fail(`health.json is not valid JSON (${error.message})`);
}

const healthKeys = Object.keys(health).sort();
if (
  healthKeys.join(',') !== 'service,status,version'
  || health.status !== 'ok'
  || health.service !== 'project-odysseus-web'
  || health.version !== '1'
) {
  fail('health.json does not match the exact versioned web contract');
}

const uptime = read('.github/workflows/uptime-check.yml');
for (const variable of ['HEALTHCHECK_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY']) {
  mustInclude(uptime, new RegExp(`secrets\\.${variable}`), `${variable} repository secret`);
}
for (const endpoint of [
  '/health.json',
  '/auth/v1/health',
  '/rest/v1/rpc/monitoring_health_probe',
]) {
  mustInclude(uptime, new RegExp(endpoint.replace(/[?]/g, '\\?')), `${endpoint} probe`);
}
mustInclude(uptime, /content-type:.*application\/json/i, 'web JSON content-type assertion');
mustInclude(uptime, /if: failure\(\)/, 'failed-probe notification step');

const reporting = read('src/lib/monitoring/errorReporting.ts');
for (const [pattern, description] of [
  [/import\.meta\.env\.PROD/, 'production-only Sentry guard'],
  [/VITE_SENTRY_DSN/, 'Sentry DSN guard'],
  [/sendDefaultPii: false/, 'Sentry PII default-off setting'],
  [/beforeSend\(event\)/, 'Sentry event sanitizer'],
  [/sensitiveKeyPattern/, 'sensitive metadata key filter'],
  [/Sentry\.setUser\(context\.authUserId \? \{ id: context\.authUserId \} : null\)/, 'identifier-only monitoring user context'],
]) {
  mustInclude(reporting, pattern, description);
}

const notFound = read('src/app/routes/NotFoundRoute.tsx');
mustInclude(notFound, /captureAppMessage\('not_found_route'/, 'React not-found monitoring event');
mustInclude(notFound, /action: 'not_found'/, 'not-found action tag');

for (const workflowPath of ['.github/workflows/app-ci.yml', '.github/workflows/release-gates.yml']) {
  mustInclude(read(workflowPath), /npm run validate:monitoring/, `${workflowPath} monitoring gate`);
}

console.log('monitoring_assets_validation_passed');
