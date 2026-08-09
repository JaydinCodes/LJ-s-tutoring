const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
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
  assert.equal(pkg.scripts['supabase:reset'], 'npx supabase db reset --local');
  assert.doesNotMatch(pkg.scripts['supabase:reset'], /sync-supabase-migration|legacy-baseline|overwrite/);
  assert.match(pkg.scripts['test:rls'], /supabase-schema-policy\.test\.cjs/);
  assert.doesNotMatch(pkg.scripts['test:rls'], /sync-supabase-migration|legacy-baseline|overwrite/);
  assert.equal(
    pkg.scripts['supabase:legacy-baseline:overwrite'],
    'node scripts/sync-supabase-migration.cjs --overwrite-frozen-baseline',
  );
  assert.match(envExample, /VITE_SUPABASE_URL=http:\/\/127\.0\.0\.1:54321/);
  assert.match(envExample, /SUPABASE_DB_URL=postgresql:\/\/postgres:postgres@127\.0\.0\.1:54322\/postgres/);
  assert.match(envExample, /SUPABASE_TEST_PROJECT_REF=local/);
  assert.match(envExample, /SUPABASE_PRODUCTION_PROJECT_REF=/);
  assert.match(docs, /must never point at production Supabase/i);
});

test('local Supabase migration history is committed, immutable, and separate from the canonical clean-install schema', () => {
  const syncScript = read('scripts/sync-supabase-migration.cjs');
  const gitignore = read('.gitignore');
  const config = read('supabase/config.toml');
  const baseline = read('supabase/migrations/20260606000000_project_odysseus_schema.sql');
  const normalizedBaselineHash = crypto
    .createHash('sha256')
    .update(baseline.replace(/\r\n/g, '\n'))
    .digest('hex');

  assert.match(syncScript, /docs.+supabase.+schema\.sql/s);
  assert.match(syncScript, /supabase.+migrations/s);
  assert.match(syncScript, /--overwrite-frozen-baseline/);
  assert.match(syncScript, /Refusing to overwrite the committed Supabase baseline migration/);
  assert.doesNotMatch(gitignore, /supabase\/migrations\/20260606000000_project_odysseus_schema\.sql/);
  assert.equal(
    normalizedBaselineHash,
    '41da48c544d276adf91730ad0a6c1f2bc96c8d93927cf02bb1bb36d39a0c7efd',
    'the historical baseline must never be regenerated from the evolving canonical schema',
  );
  assert.match(config, /project_id = "project-odysseus-local"/);
  assert.match(config, /port = 54321/);
  assert.match(config, /\[db\][\s\S]*port = 55432/);
  assert.match(config, /shadow_port = 55430/);
});
