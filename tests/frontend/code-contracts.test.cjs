const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');

test('CODE-01 client uses the generated Supabase schema as its only database contract', () => {
  const client = read('src/lib/supabase/client.ts');
  const database = read('src/types/database.ts');
  const driftCheck = read('scripts/check-supabase-type-drift.cjs');

  assert.match(client, /supabase\/types\/public\.generated/);
  assert.match(database, /export type \{ Database, Json \} from '..\/..\/supabase\/types\/public\.generated'/);
  assert.doesNotMatch(database, /interface Database|type Table</);
  assert.match(driftCheck, /--local/);
});

test('CODE-02 route manifest drives static output and validates portal ingress assets', () => {
  const manifest = JSON.parse(read('src/app/route-manifest.json'));
  const staticBuild = read('scripts/build-static.js');
  const validator = read('scripts/validate-route-manifest.cjs');
  const reactHelper = read('src/app/routeManifest.ts');

  assert.ok(manifest.routes.some((route) => route.path === '/dashboard/admin'));
  assert.ok(manifest.routes.some((route) => route.public && route.path === '/guides'));
  assert.ok(manifest.rootAssets.includes('/sw.js'));
  assert.match(staticBuild, /route-manifest\.json/);
  assert.match(staticBuild, /routeManifest\.routes/);
  assert.match(validator, /rootAssets/);
  assert.match(validator, /portalHosts/);
  assert.match(reactHelper, /routeRedirects/);
});
