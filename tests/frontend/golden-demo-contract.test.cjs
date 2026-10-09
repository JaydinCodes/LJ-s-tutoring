const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20261009000000_golden_demo_learner.sql'),
  'utf8',
);

test('golden demo is a real short activity targeting Difference of Two Squares', () => {
  assert.match(migration, /ACT\.G9\.ALG\.FACTOR\.DOTS\.CONTRASTING-PRACTICE/);
  assert.match(migration, /'G9\.ALG\.FACTOR\.DOTS'/);
  for (const code of ['Q.G9.DEMO.DOTS.01', 'Q.G9.DEMO.DOTS.02', 'Q.G9.DEMO.DOTS.03', 'Q.G9.DEMO.DOTS.04']) {
    assert.ok(migration.includes(code), `missing ${code}`);
  }
});

test('golden misconception is persisted and retries preserve the original attempt', () => {
  assert.match(migration, /DOTS_AS_SQUARE_OF_DIFFERENCE/);
  assert.match(migration, /"response":"\(x - 5\)\^2"/);
  assert.match(migration, /and attempt\.status = 'evaluated'\s+and attempt\.is_correct/);
  assert.match(migration, /delete from public\.learning_attempts where student_id = v_student/);
});

test('demo reset is service-role-only and the script refuses non-local projects', () => {
  assert.match(migration, /if auth\.role\(\) <> 'service_role'/);
  assert.match(migration, /grant execute on function public\.reset_local_golden_demo\(text\) to service_role/);
  const script = fs.readFileSync(path.join(root, 'scripts', 'reset-golden-demo.cjs'), 'utf8');
  assert.match(script, /Refusing to reset a non-local Supabase project/);
});
