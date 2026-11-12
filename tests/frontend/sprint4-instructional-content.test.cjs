const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const pack = require(path.join(root, 'scripts', 'grade9-term1-learning-content.cjs'));
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261112140000_grade9_term1_sprint4_instructional_content.sql'), 'utf8');
const bridgeMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261112150000_sprint4_bridge_lesson_delivery.sql'), 'utf8');
const correctionsMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261112160000_sprint4_mathematics_corrections_v2.sql'), 'utf8');
const bridgeRoute = fs.readFileSync(path.join(root, 'src', 'features', 'learning', 'StudentLearningBridgeRoute.tsx'), 'utf8');
const learningDashboard = fs.readFileSync(path.join(root, 'src', 'features', 'learning', 'StudentLearningRoute.tsx'), 'utf8');

test('Sprint 4 instructional pack covers the four Grade 9 topics and focused Grade 8 bridges', () => {
  const lessons = pack.lessons;
  const grade9 = lessons.filter((lesson) => lesson.grade === 'Grade 9');
  const grade8 = lessons.filter((lesson) => lesson.grade === 'Grade 8');
  assert.equal(grade9.length, 13);
  assert.equal(grade8.length, 6);
  for (const lesson of lessons) {
    assert.match(lesson.objective, /^By the end/);
    assert.ok(lesson.explanation.length > 80);
    assert.ok(lesson.workedExample.length > 24);
    assert.ok(lesson.misconception.length > 40);
    assert.equal(lesson.questions.length, 4);
    assert.ok(lesson.questions.some((question) => question.reasoning));
  }
});

test('guided-practice bank contains full multiple-choice feedback and stable activity links', () => {
  const questions = pack.buildPracticeQuestions();
  assert.equal(questions.length, 76);
  assert.equal(new Set(questions.map((question) => question.code)).size, 76);
  for (const question of questions) {
    assert.deepEqual(Object.keys(question.options).sort(), ['A', 'B', 'C', 'D']);
    assert.ok(question.options[question.correctOption]);
    assert.equal(Object.keys(question.distractorExplanations).length, 3);
    assert.equal(new Set(Object.values(question.distractorExplanations)).size, 3);
    assert.ok(Object.values(question.distractorExplanations).every((feedback) => feedback.length >= 45 && !feedback.includes('Revisit the worked method')));
    assert.ok(question.solution.length >= 8);
    assert.ok(question.hint.length >= 8);
  }
  assert.match(migration, /Sprint 4 content remains draft and review-gated/);
  assert.match(migration, /learning_activity_stage_questions/);
});

test('Sprint 4 mathematics corrections retain v1 history and protect confirmed defect fixes', () => {
  const questions = pack.buildPracticeQuestions();
  const byCode = (code) => questions.find((question) => question.code === code);
  assert.equal(byCode('Q.G9.S4.PRACTICE.RATIO-RATE.04').options[byCode('Q.G9.S4.PRACTICE.RATIO-RATE.04').correctOption], 'The claim is incorrect: 4 : 6 = 2 : 3 and 10 : 15 = 2 : 3');
  assert.equal(byCode('Q.G9.S4.PRACTICE.POWERS-ROOTS.01').distractorExplanations[Object.entries(byCode('Q.G9.S4.PRACTICE.POWERS-ROOTS.01').options).find(([, value]) => value === '−25')[0]], '−25 keeps a negative sign after squaring. The bracket makes both factors negative, and (−5) × (−5) is +25.');
  assert.match(byCode('Q.G9.S4.PRACTICE.HCF-LCM.03').prompt, /starting time/);
  assert.match(byCode('Q.G9.S4.PRACTICE.FINANCE.02').prompt, /refundable/);
  assert.match(byCode('Q.G9.S4.PRACTICE.EXP-LAWS.02').prompt, /y ≠ 0/);
  assert.match(byCode('Q.G8.S4.PRACTICE.G8-FRACTIONS.04').options[byCode('Q.G8.S4.PRACTICE.G8-FRACTIONS.04').correctOption], /Dividing both numerator/);
  assert.match(pack.lessons.find((lesson) => lesson.skillCode === 'G9-NUM-REAL-IRRATIONAL').explanation, /√\(1\/4\) = 1\/2/);
  assert.match(pack.lessons.find((lesson) => lesson.skillCode === 'G9-EXP-SCI-NOTATION-EXTENSION').explanation, /1 ≤ \|a\| < 10/);
  assert.match(correctionsMigration, /learning_skill_content_revisions/);
  assert.match(correctionsMigration, /item\.id,2,'draft'/);
});

test('no-content primary action never links the learner back to the current dashboard', () => {
  assert.match(learningDashboard, /journey\.primary\.action === 'explore_topic' && journey\.primary\.route === '\/dashboard\/student\/learning'/);
  assert.match(learningDashboard, /No reviewed learning action is available yet/);
});

test('bridge delivery exposes only approved Grade 8 lessons and preserves a return path', () => {
  assert.match(bridgeMigration, /get_my_grade8_learning_bridge/);
  assert.match(bridgeMigration, /content\.review_status='approved'/);
  assert.match(bridgeMigration, /skill\.grade='Grade 8'/);
  assert.match(bridgeMigration, /LEARNING_OBJECTIVE_REQUIRED/);
  assert.match(bridgeRoute, /Return to your Grade 9 topic/);
  assert.match(bridgeRoute, /Practise this foundation/);
});
