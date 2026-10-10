const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20261009000000_golden_demo_learner.sql'),
  'utf8',
);
const integrityMigration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20261010000000_golden_demo_rehearsal_integrity.sql'),
  'utf8',
);
const reactPlaywrightConfig = fs.readFileSync(path.join(root, 'playwright.react.config.ts'), 'utf8');
const supabasePlaywrightConfig = fs.readFileSync(path.join(root, 'playwright.supabase.config.ts'), 'utf8');
const goldenDemoJourney = fs.readFileSync(path.join(root, 'tests', 'e2e-react', 'golden-demo-journey.spec.ts'), 'utf8');

test('golden demo is a real short activity targeting Difference of Two Squares', () => {
  assert.match(migration, /ACT\.G9\.ALG\.FACTOR\.DOTS\.CONTRASTING-PRACTICE/);
  assert.match(migration, /'G9\.ALG\.FACTOR\.DOTS'/);
  for (const code of ['Q.G9.DEMO.DOTS.01', 'Q.G9.DEMO.DOTS.02', 'Q.G9.DEMO.DOTS.03', 'Q.G9.DEMO.DOTS.04']) {
    assert.ok(migration.includes(code), `missing ${code}`);
  }
});

test('golden demo browser journey only runs against local Supabase fixtures', () => {
  assert.match(reactPlaywrightConfig, /testIgnore:\s*'golden-demo-journey\.spec\.ts'/);
  assert.match(supabasePlaywrightConfig, /golden-demo-journey/);
  assert.match(goldenDemoJourney, /Good \(morning\|afternoon\|evening\), Lethabo/);
});

test('golden misconception is persisted and retries preserve the original attempt', () => {
  assert.match(migration, /DOTS_AS_SQUARE_OF_DIFFERENCE/);
  assert.match(migration, /"response":"\(x - 5\)\^2"/);
  assert.match(migration, /and attempt\.status = 'evaluated'\s+and attempt\.is_correct/);
  assert.match(migration, /delete from public\.learning_attempts where student_id = v_student/);
});

test('repeated misconception and secure prerequisite reasons use real fixture evidence', () => {
  assert.match(integrityMigration, /Q\.G9\.DEMO\.HISTORY\.DOTS\.01/);
  assert.match(integrityMigration, /Q\.G9\.DEMO\.HISTORY\.DOTS\.02/);
  assert.match(integrityMigration, /\(x - 5\)\^2', false, 4::smallint/);
  assert.match(integrityMigration, /\(y - 7\)\^2', false, 3::smallint/);
  assert.match(integrityMigration, /cardinality\(v_dots_attempts\), 0\) <> 2/);
  assert.match(integrityMigration, /'G9\.ALG\.FACTOR\.COMMON', 'secure'/);
  assert.match(integrityMigration, /'G9\.ALG\.EXPAND\.BINOMIAL', 'secure'/);
  assert.match(integrityMigration, /email = 'admin@example\.com' and role = 'admin'/);
});

test('demo reset is service-role-only and the script refuses non-local projects', () => {
  assert.match(migration, /if auth\.role\(\) <> 'service_role'/);
  assert.match(migration, /grant execute on function public\.reset_local_golden_demo\(text\) to service_role/);
  const script = fs.readFileSync(path.join(root, 'scripts', 'reset-golden-demo.cjs'), 'utf8');
  assert.match(script, /Refusing to reset a non-local Supabase project/);
});
