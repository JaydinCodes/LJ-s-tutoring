const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('OPS-08 admin reports route builds parent-ready and NGO aggregate reports', () => {
  const route = read('src/features/admin/AdminReportsRoute.tsx');
  const repository = read('src/features/admin/adminProgressReportsRepository.ts');
  const app = read('src/app/App.tsx');

  assert.match(app, /AdminReportsRoute/);
  assert.match(route, /Parent report/);
  assert.match(route, /Guardian recipients/);
  assert.match(route, /NGO aggregate reports/);
  assert.match(route, /window\.print\(\)/);
  assert.match(repository, /marks_released/);
  assert.match(repository, /feedback_released/);
  assert.match(repository, /can_receive_reports/);
  assert.match(repository, /NgoProgressReport/);
  assert.doesNotMatch(route, /guardian\.email[\s\S]*NGO aggregate reports/, 'NGO reports must not render guardian contact fields');
});

test('OPS-08 schema provides a parent-scoped report RPC using linked guardian records', () => {
  const schema = read('docs/supabase/schema.sql');
  const databaseTypes = read('src/types/database.ts');
  const docs = read('docs/supabase/PRODUCTION_RLS_REVIEW.md');

  assert.match(schema, /create or replace function public\.get_parent_progress_reports\(\)/);
  assert.match(schema, /public\.current_profile_role\(\) = 'parent'/);
  assert.match(schema, /g\.profile_id = public\.current_profile_id\(\)/);
  assert.match(schema, /sg\.can_receive_reports = true/);
  assert.match(schema, /sub\.marks_released = true/);
  assert.match(schema, /case when sub\.feedback_released then sub\.feedback else null end as feedback/);
  assert.match(schema, /grant execute on function public\.get_parent_progress_reports\(\) to authenticated/);
  assert.match(databaseTypes, /get_parent_progress_reports/);
  assert.match(docs, /NGO report rows are aggregate-only/);
});

test('launch parent and NGO report routes use protected Supabase data paths', () => {
  const parentRoute = read('src/features/parents/ParentReportsRoute.tsx');
  const parentRepository = read('src/features/parents/parentReportsRepository.ts');
  const ngoRoute = read('src/features/ngo/NgoReportsRoute.tsx');
  const ngoRepository = read('src/features/ngo/ngoReportsRepository.ts');

  assert.match(parentRepository, /rpc\('get_parent_progress_reports'\)/, 'parent portal must use the parent-scoped RPC');
  assert.match(parentRoute, /Guardian Reports/);
  assert.match(parentRoute, /No reports available/);
  assert.match(parentRoute, /Guardian reports unavailable/);

  assert.match(ngoRepository, /from\('ngo_partners'\)/);
  assert.match(ngoRepository, /marks_released/);
  assert.match(ngoRoute, /NGO Cohort Reports/);
  assert.match(ngoRoute, /No cohort reports available/);
  assert.match(ngoRoute, /learner names, guardian contacts, individual feedback, and raw submission details/);
  assert.doesNotMatch(ngoRoute, /row\.student_name|row\.feedback|row\.email|row\.phone/, 'NGO route must not render learner identity, guardian contact, or feedback fields');
});
