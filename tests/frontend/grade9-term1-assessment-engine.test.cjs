const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', '..');
const engineMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261107120000_grade9_term1_assessment_engine.sql'), 'utf8');
const contentMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261107130000_grade9_term1_assessment_drafts.sql'), 'utf8');

function contracts() {
  const source = fs.readFileSync(path.join(root, 'src', 'features', 'learning', 'grade9Term1FoundationContracts.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', '__filename', '__dirname', output)(module.exports, require, module, '', '');
  return module.exports;
}

const policy = {
  overallAchievementThreshold: 80,
  criticalSkillCoverageThreshold: 100,
  minimumReasoningEvidenceCount: 2,
  minimumReasoningAchievementThreshold: 80,
  strongBaselineThreshold: 90,
  formalScoredAttemptsPerQuestion: 1,
  practiceAttemptsPerQuestion: 3,
  requiresMasteryChallenge: true,
};

const secureEvidence = (pathway) => ({
  overallAchievement: 88,
  criticalSkills: [{ skillCode: 'G9-NUM-WHOLE-HCF-LCM', isCritical: true, state: 'secure' }],
  mathematicalReasoningEvidence: [{ independentlyCompleted: true, correct: true }, { independentlyCompleted: true, correct: true }],
  qualifyingAssessmentPath: pathway,
  masteryChallengePassed: pathway === 'mastery_challenge',
});

test('a successful endline and a successful mastery challenge are alternate topic-mastery routes', () => {
  const { evaluateTopicMastery } = contracts();
  assert.equal(evaluateTopicMastery(policy, secureEvidence('endline')).status, 'mastered');
  assert.equal(evaluateTopicMastery(policy, secureEvidence('mastery_challenge')).status, 'mastered');
  const missing = evaluateTopicMastery(policy, secureEvidence(null));
  assert.equal(missing.status, 'not_yet_mastered');
  assert.ok(missing.reasonCodes.includes('MISSING_QUALIFYING_INDEPENDENT_ASSESSMENT'));
});

test('mastered-topic progression takes precedence over a stale strong baseline', () => {
  const { determineTopicProgression } = contracts();
  const decision = determineTopicProgression(policy, [], {
    overallAchievement: 95,
    criticalSkills: [{ skillCode: 'G9-NUM-WHOLE-HCF-LCM', isCritical: true, state: 'secure' }],
    mathematicalReasoningEvidence: [{ independentlyCompleted: true, correct: true }, { independentlyCompleted: true, correct: true }],
  }, secureEvidence('endline'));
  assert.equal(decision.action, 'advance_to_dependent_topic');
});

test('assessment migration snapshots forms, enforces the server deadline, and records append-only decisions', () => {
  for (const pattern of [
    /create table public\.learning_assessment_form_versions/,
    /create table public\.learning_assessment_sessions/,
    /create table public\.learning_assessment_session_answer_events/,
    /create table public\.topic_mastery_evaluations/,
    /unique \(student_id, start_idempotency_key\)/,
    /where status = 'in_progress'/,
    /now\(\) >= v_session\.expires_at/,
    /learning_assessment_session_question_results/,
    /qualifying_assignment_mastery_evidence/,
    /MISSING_MATHEMATICAL_REASONING_EVIDENCE/,
    /learning_assessment_requires_approved_valid_multiple_choice_questions/,
  ]) assert.match(engineMigration, pattern);
});

test('active learner session payloads expose option labels but withhold answers until the configured release condition', () => {
  const getter = engineMigration.slice(engineMigration.indexOf('create or replace function public.get_my_learning_assessment_session'), engineMigration.indexOf('create or replace function public.get_learning_assessment_management_catalog'));
  const activeQuestions = getter.slice(getter.indexOf("'questions'"), getter.indexOf("'result'"));
  assert.match(activeQuestions, /'options', question\.options_snapshot/);
  assert.doesNotMatch(activeQuestions, /correct_option|distractor_explanations/);
  assert.match(getter, /solution_release_policy.*after_submission/s);
});

test('author draft bank covers all four topics and keeps new content draft/review-gated', () => {
  for (const family of ['Q.G9.T1.WHOLE', 'Q.G9.T1.INT', 'Q.G9.T1.EXP', 'Q.G9.T1.PAT']) assert.match(contentMigration, new RegExp(family.replaceAll('.', '\\.')));
  assert.match(contentMigration, /'G9-NUM-RATIO-RATE'/);
  assert.match(contentMigration, /'G9-NUM-FINANCIAL-APPLICATIONS'/);
  assert.match(contentMigration, /'draft', 'independent_practice'/);
  assert.match(contentMigration, /'distractor_explanations'/);
  assert.match(contentMigration, /Requires authorised curriculum review before publication/);
});

test('student runner is a four-option, server-timed UI with no embedded answer key', () => {
  const runner = fs.readFileSync(path.join(root, 'src', 'features', 'learning', 'StudentAssessmentRoutes.tsx'), 'utf8');
  assert.match(runner, /\['A', 'B', 'C', 'D'\]/);
  assert.match(runner, /expiresAt/);
  assert.match(runner, /useSaveLearningAssessmentAnswerMutation/);
  assert.match(runner, /useSubmitLearningAssessmentMutation/);
  assert.doesNotMatch(runner, /correct_option|distractor_explanations|answer_config/);
});
