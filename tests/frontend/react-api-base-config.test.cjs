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

test('DigitalOcean config exposes same-origin /api for browser API calls', () => {
  const appSpec = read('.do', 'app.yaml');
  const normalizedAppSpec = appSpec.replace(/\r\n/g, '\n');
  const portalConfig = read('assets', 'portal-config.js');
  const injectConfig = read('scripts', 'inject-config.js');
  const deployWorkflow = read('.github', 'workflows', 'deploy-api.yml');

  assert.ok(normalizedAppSpec.includes('value: /api'), 'browser API base must use same-origin /api');
  assert.ok(!normalizedAppSpec.includes('domain: api.projectodysseus.live'), 'removed API subdomain must not be referenced as a live app domain');
  assert.ok(normalizedAppSpec.includes('prefix: /api'), 'App Platform must route /api to the API service');
  assert.ok(normalizedAppSpec.includes('preserve_path_prefix: false'), 'App Platform must strip /api before forwarding to Fastify');
  const studentApiRouteIndex = normalizedAppSpec.indexOf('exact: student.projectodysseus.live\n        path:\n          prefix: /api');
  const studentCatchAllRedirectIndex = normalizedAppSpec.indexOf('exact: student.projectodysseus.live\n        path:\n          prefix: /\n      redirect:');
  assert.ok(studentApiRouteIndex >= 0, 'student /api route must exist');
  assert.ok(studentCatchAllRedirectIndex >= 0, 'student catch-all redirect must exist');
  assert.ok(studentApiRouteIndex < studentCatchAllRedirectIndex, 'student /api route must be ordered before the student catch-all redirect');
  assert.ok(portalConfig.includes("window.__PO_API_BASE__ = '/api';"), 'runtime portal config must default to same-origin /api');
  assert.ok(injectConfig.includes("raw === 'https://api.projectodysseus.live'"), 'config injection must normalize the retired API subdomain');
  assert.ok(deployWorkflow.includes("default: 'true'"), 'deployment must sync the app spec by default');
  assert.ok(deployWorkflow.includes('"prefix"[[:space:]]*:[[:space:]]*"/api"'), 'deployment must detect /api prefix routes in App Platform JSON');
  assert.ok(deployWorkflow.includes('"(api|lms-api)"'), 'deployment must detect the lms-api service when checking /api routing');
  assert.ok(deployWorkflow.includes('https://projectodysseus.live/api'), 'deployment health check must hit /api/ready by default');
});
