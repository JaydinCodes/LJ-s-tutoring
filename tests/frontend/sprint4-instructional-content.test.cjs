const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const pack = require(path.join(root, 'scripts', 'grade9-term1-learning-content.cjs'));
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261112140000_grade9_term1_sprint4_instructional_content.sql'), 'utf8');
const bridgeMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261112150000_sprint4_bridge_lesson_delivery.sql'), 'utf8');
const bridgeRoute = fs.readFileSync(path.join(root, 'src', 'features', 'learning', 'StudentLearningBridgeRoute.tsx'), 'utf8');

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
    assert.ok(question.solution.length >= 8);
    assert.ok(question.hint.length >= 8);
  }
  assert.match(migration, /Sprint 4 content remains draft and review-gated/);
  assert.match(migration, /learning_activity_stage_questions/);
});

test('bridge delivery exposes only approved Grade 8 lessons and preserves a return path', () => {
  assert.match(bridgeMigration, /get_my_grade8_learning_bridge/);
  assert.match(bridgeMigration, /content\.review_status='approved'/);
  assert.match(bridgeMigration, /skill\.grade='Grade 8'/);
  assert.match(bridgeMigration, /LEARNING_OBJECTIVE_REQUIRED/);
  assert.match(bridgeRoute, /Return to your Grade 9 topic/);
  assert.match(bridgeRoute, /Practise this foundation/);
});
