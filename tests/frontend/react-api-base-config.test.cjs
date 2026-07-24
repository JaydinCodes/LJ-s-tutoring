const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

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

  assert.ok(!normalizedAppSpec.includes('domain: api.projectodysseus.live'), 'removed API subdomain must not be referenced as a live app domain');
  assert.ok(!normalizedAppSpec.includes('name: lms-api'), 'lms-api must not be referenced as a live component -- it is retired from the app spec');
  assert.ok(!normalizedAppSpec.includes('prefix: /api'), 'no ingress rule may route /api to a backend service -- lms-api is retired');
  assert.ok(portalConfig.includes("window.__PO_API_BASE__ = '/api';"), 'runtime portal config keeps its same-origin default (inert now that lms-api is retired)');
  assert.ok(injectConfig.includes("raw === 'https://api.projectodysseus.live'"), 'config injection keeps normalizing the retired API subdomain, in case a stale build asset references it');
});
