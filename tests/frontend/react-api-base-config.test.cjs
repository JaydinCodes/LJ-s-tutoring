const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('React API client reads runtime portal API base before falling back to /api', () => {
  const client = read('src', 'lib', 'api', 'client.ts');

  assert.ok(client.includes('window.__PO_API_BASE__'), 'React API client must read the injected runtime API base');
  assert.ok(!client.includes('import.meta.env.PUBLIC_PO_API_BASE'), 'React API client must not rely on non-Vite PUBLIC env variables');
  assert.ok(client.includes('api\\.projectodysseus\\.live'), 'React API client must coerce the retired api.projectodysseus.live subdomain to /api (guards a stale baked VITE_PO_API_BASE)');
});

test('dashboard React shells load portal config before the React bundle', () => {
  const build = read('scripts', 'build-static.js');

  assert.ok(build.includes('const configScript'), 'build must define a shared portal config script');
  assert.ok(build.includes('script defer src="/assets/portal-config.js"'), 'portal config must be emitted into React shells');
  assert.ok(build.includes('isProtected'), 'protected dashboard shells must be handled explicitly');
  assert.ok(build.includes('? `${configScript}'), 'protected dashboard shells must still load portal config');
});

test('DigitalOcean app spec no longer routes to the retired lms-api service', () => {
  const appSpec = read('.do', 'app.yaml');
  const normalizedAppSpec = appSpec.replace(/\r\n/g, '\n');
  const portalConfig = read('assets', 'portal-config.js');
  const injectConfig = read('scripts', 'inject-config.js');
  const deployWorkflow = read('.github', 'workflows', 'deploy-api.yml');

  assert.ok(!normalizedAppSpec.includes('domain: api.projectodysseus.live'), 'removed API subdomain must not be referenced as a live app domain');
  assert.ok(!normalizedAppSpec.includes('name: lms-api'), 'lms-api must not be referenced as a live component -- it is retired from the app spec');
  assert.ok(!normalizedAppSpec.includes('prefix: /api'), 'no ingress rule may route /api to a backend service -- lms-api is retired');
  assert.ok(portalConfig.includes("window.__PO_API_BASE__ = '/api';"), 'runtime portal config keeps its same-origin default (inert now that lms-api is retired)');
  assert.ok(injectConfig.includes("raw === 'https://api.projectodysseus.live'"), 'config injection keeps normalizing the retired API subdomain, in case a stale build asset references it');
  assert.ok(deployWorkflow.includes('"prefix"[[:space:]]*:[[:space:]]*"/api"'), 'deploy-api.yml keeps its API-component detection so it degrades gracefully with no API component');
  assert.ok(deployWorkflow.includes('No API component detected in app spec; deploying static site only.'), 'deploy-api.yml must no-op the API deploy steps now that no component matches');
});
