const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('local Supabase bootstrap scripts are cross-platform and separated from production', () => {
  const pkg = JSON.parse(read('package.json'));
  const envExample = read('.env.example');
  const docs = read('docs/supabase/LOCAL_DEVELOPMENT.md');

  assert.equal(pkg.scripts['supabase:start'], 'npx supabase start');
  assert.match(pkg.scripts['supabase:reset'], /supabase:migration:sync/);
  assert.match(pkg.scripts['test:rls'], /supabase-schema-policy\.test\.cjs/);
  assert.match(envExample, /VITE_SUPABASE_URL=http:\/\/127\.0\.0\.1:54321/);
  assert.match(envExample, /SUPABASE_DB_URL=postgresql:\/\/postgres:postgres@127\.0\.0\.1:54322\/postgres/);
  assert.match(envExample, /SUPABASE_TEST_PROJECT_REF=local/);
  assert.match(envExample, /SUPABASE_PRODUCTION_PROJECT_REF=/);
  assert.match(docs, /Never point CI at production Supabase/);
});

test('local Supabase migration is generated from the canonical schema source', () => {
  const syncScript = read('scripts/sync-supabase-migration.cjs');
  const gitignore = read('.gitignore');
  const config = read('supabase/config.toml');

  assert.match(syncScript, /docs.+supabase.+schema\.sql/s);
  assert.match(syncScript, /supabase.+migrations/s);
  assert.match(syncScript, /Edit docs\/supabase\/schema\.sql/);
  assert.match(gitignore, /supabase\/migrations\/20260606000000_project_odysseus_schema\.sql/);
  assert.match(config, /project_id = "project-odysseus-local"/);
  assert.match(config, /port = 54321/);
  assert.match(config, /port = 54322/);
});
