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
  const portalConfig = read('assets', 'portal-config.js');
  const injectConfig = read('scripts', 'inject-config.js');

  assert.ok(appSpec.includes('value: /api'), 'browser API base must not depend on the api subdomain');
  assert.ok(appSpec.includes('prefix: /api'), 'App Platform must route /api to the API service');
  assert.ok(appSpec.includes('preserve_path_prefix: false'), 'App Platform must strip /api before forwarding to Fastify');
  assert.ok(portalConfig.includes("window.__PO_API_BASE__ = '/api';"), 'runtime portal config must default to same-origin /api');
  assert.ok(injectConfig.includes("raw === 'https://api.projectodysseus.live'"), 'config injection must normalize the unresolved api subdomain');
});
