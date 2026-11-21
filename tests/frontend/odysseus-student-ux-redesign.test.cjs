const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, 'src', 'features', 'learning', file), 'utf8');

test('Odysseus home keeps one learner action and makes roadmap exploration secondary', () => {
  const home = read('StudentLearningRoute.tsx');
  assert.match(home, /const primary = journey\?\.primary/);
  assert.match(home, /className="learning-primary" to=\{primary\.route\}/);
  assert.match(home, /Current focus/);
  assert.match(home, /topics completed/);
  assert.match(home, /Your progress/);
  assert.match(home, /Up next/);
  assert.match(home, /View all upcoming items/);
  assert.doesNotMatch(home, /Course content/);
  assert.match(home, /No learning action is available yet/);
  assert.doesNotMatch(home, /Available assessments/);
  assert.doesNotMatch(home, /Published topic catalogue/);
});

test('topic overview routes individual skills to a focused learner lesson', () => {
  const topic = read('StudentLearningTopicRoute.tsx');
  const map = read('LearningMap.tsx');
  const lesson = read('StudentLearningLessonRoute.tsx');
  const design = read('LearningExperienceDesignSystem.tsx');
  const app = fs.readFileSync(path.join(root, 'src', 'app', 'App.tsx'), 'utf8');
  assert.match(map, /lesson: skill\.skillCode/);
  assert.match(topic, /searchParams\.get\('lesson'\)/);
  assert.match(app, /learning\/topic\/:topicCode\/lesson\/:skillCode/);
  assert.match(map, /Your learning path/);
  assert.match(topic, /LessonSteps/);
  assert.match(lesson, /Navigate/);
  assert.match(lesson, /topic\/\$\{encodeURIComponent\(topicCode\)\}/);
  assert.match(topic, /WorkedExamples/);
  assert.match(topic, /Move up a level/);
  assert.match(design, /See an example/);
});

test('practice preserves evidence inputs while presenting one readable question and contextual feedback', () => {
  const activity = read('StudentActivityRoute.tsx');
  assert.match(activity, /learning-question/);
  assert.match(activity, /data-state=\{activeFeedback/);
  assert.match(activity, /QuestionResponseInput/);
  assert.match(activity, /How confident are you\?/);
  assert.match(activity, /learning-feedback/);
  assert.match(activity, /idempotencyKey: key/);
  assert.match(activity, /hintIds/);
  assert.match(activity, /Try again with this insight/);
});

test('assessment remains server-timed, answer-safe, and results use learner-facing next steps', () => {
  const assessment = read('StudentAssessmentRoutes.tsx');
  assert.match(assessment, /AssessmentNavigation/);
  assert.match(assessment, /expiresAt/);
  assert.match(assessment, /useSaveLearningAssessmentAnswerMutation/);
  assert.match(assessment, /Submit assessment\?/);
  assert.match(assessment, /LearnerResultSummary/);
  assert.match(assessment, /Open recommended lesson/);
  assert.doesNotMatch(assessment, /evidence_incomplete/);
});

test('shared learning components retain semantic progress, live feedback and reduced motion-safe transitions', () => {
  const design = read('LearningExperienceDesignSystem.tsx');
  const input = read('QuestionResponseInput.tsx');
  assert.match(design, /role="progressbar"/);
  assert.match(design, /aria-live="polite"/);
  assert.match(design, /motion-reduce:transition-none/);
  assert.match(input, /role="radiogroup"/);
  assert.match(input, /aria-label="Your answer"/);
});
