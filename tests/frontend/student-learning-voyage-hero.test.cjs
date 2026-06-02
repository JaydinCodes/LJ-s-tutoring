const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('Learning Voyage hero renders concrete learner state and Oracle Insight', () => {
  const source = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');
  const dataType = read('src', 'types', 'lms.ts');
  const repository = read('src', 'features', 'students', 'studentDashboardRepository.ts');
  const api = read('lms-api', 'src', 'routes', 'academic.ts');

  for (const label of ['Learner', 'Grade', 'School', 'Next task', 'Next exam', 'Academic status']) {
    assert.ok(source.includes(`label="${label}"`), `hero must show ${label}`);
  }

  assert.ok(source.includes('Oracle Insight'), 'hero must include the Oracle Insight micro-card');
  assert.ok(source.includes('dailyInsight.action'), 'Oracle Insight must render the selected recommendation');
  assert.ok(source.includes('completionRate'), 'hero must show visible assignment completion');
  assert.ok(dataType.includes('examCalendar?:'), 'dashboard view must carry exam calendar state');
  assert.ok(dataType.includes('supportStatus?:'), 'dashboard view must carry academic support status');
  assert.ok(repository.includes('nextExamTitle:'), 'repository must preserve next exam title');
  assert.ok(repository.includes('currentAcademicStatus:'), 'repository must preserve current academic status');
  assert.ok(api.includes('currentAcademicStatus: supportStatus.label'), 'API must project academic status into dashboard context');
});

test('Learning Voyage hero uses brand styling, responsive collapse, and subtle motion shine', () => {
  const hero = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');
  const designSystem = read('src', 'components', 'dashboard', 'DashboardDesignSystem.tsx');

  for (const token of ['brand-aegean', 'brand-gold', 'brand-parchment']) {
    assert.ok(hero.includes(token) || designSystem.includes(token), `hero must use ${token}`);
  }

  assert.ok(hero.includes('lg:grid-cols-[minmax(0,1fr)_340px]'), 'hero must collapse to one column before desktop');
  assert.ok(hero.includes('sm:grid-cols-2'), 'hero stats must become two columns on small screens');
  assert.ok(designSystem.includes('<motion.section'), 'GreekHeroCard must use motion for hover treatment');
  assert.ok(designSystem.includes('whileHover'), 'GreekHeroCard must define a hover motion state');
  assert.ok(designSystem.includes('motion-safe:group-hover:translate-x-[420%]'), 'hero must include a subtle shine effect');
  assert.ok(designSystem.includes('motion-reduce:hidden'), 'shine effect must respect reduced motion');
});
