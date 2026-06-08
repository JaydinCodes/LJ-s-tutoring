const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('launch privacy page covers sensitive education data and POPIA request handling', () => {
  const publicRoutes = read('src/app/routes/PublicRoutes.tsx');

  assert.match(publicRoutes, /Learners And Minors/);
  assert.match(publicRoutes, /Parent or guardian information/);
  assert.match(publicRoutes, /Assignment submissions and uploaded files/);
  assert.match(publicRoutes, /Academic and operational records/);
  assert.match(publicRoutes, /NGO partner records/);
  assert.match(publicRoutes, /Who Can Access Data/);
  assert.match(publicRoutes, /Supabase for authentication, database, and\s+storage services/);
  assert.match(publicRoutes, /POPIA And Privacy Requests/);
  assert.match(publicRoutes, /access, correct, or delete personal information/);
  assert.match(publicRoutes, /guardian authority where\s+a learner is a minor/);
});

test('launch terms page covers platform expectations for tutoring, roles, uploads, reports, and payments', () => {
  const publicRoutes = read('src/app/routes/PublicRoutes.tsx');

  assert.match(publicRoutes, /Tutoring Service Expectations/);
  assert.match(publicRoutes, /does not guarantee a specific mark, grade, result, or admission outcome/);
  assert.match(publicRoutes, /Accounts And Role Access/);
  assert.match(publicRoutes, /Learner Work, Uploads, And Feedback/);
  assert.match(publicRoutes, /Sessions, Attendance, And Communication/);
  assert.match(publicRoutes, /Parent, Guardian, And NGO Access/);
  assert.match(publicRoutes, /Acceptable Use/);
  assert.match(publicRoutes, /Payments And Admin Records/);
});

test('public footer links to privacy, POPIA requests, and terms without unverified compliance claims', () => {
  const publicRoutes = read('src/app/routes/PublicRoutes.tsx');

  assert.match(publicRoutes, /href="\/privacy#privacy-requests"/);
  assert.match(publicRoutes, />POPIA requests<\/a>/);
  assert.match(publicRoutes, /to="\/privacy"/);
  assert.match(publicRoutes, /to="\/terms"/);
  assert.doesNotMatch(publicRoutes, /POPIA[-\s]compliant/i);
  assert.doesNotMatch(publicRoutes, /certified/i);
});
