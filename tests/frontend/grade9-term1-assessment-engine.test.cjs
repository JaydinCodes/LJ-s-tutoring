const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', '..');
const engineMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261107120000_grade9_term1_assessment_engine.sql'), 'utf8');
const closureMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261108120000_grade9_term1_assessment_closure.sql'), 'utf8');
const contentMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261107130000_grade9_term1_assessment_drafts.sql'), 'utf8');
const reconstructionMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261109120000_grade9_term1_content_reconstruction.sql'), 'utf8');
const assessmentBlueprintRepairMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261112200000_sprint4_grade9_assessment_blueprint_link_repair.sql'), 'utf8');
const policyReviewTransitionFixMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261112210000_sprint4_policy_review_transition_fix.sql'), 'utf8');
const assignmentEvidenceMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261109130000_grade9_term1_assignment_evidence_combination.sql'), 'utf8');

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

test('a high overall score cannot turn two correct responses out of four on a critical skill into mastery', () => {
  const { evaluateTopicMastery } = contracts();
  const decision = evaluateTopicMastery({ ...policy, criticalSkillAchievementThreshold: 75, minimumQuestionsPerCriticalSkill: 4 }, {
    overallAchievement: 87.5,
    criticalSkills: [{ skillCode: 'G9-NUM-WHOLE-HCF-LCM', isCritical: true, state: 'secure', independentResponses: 4, correctResponses: 2 }],
    mathematicalReasoningEvidence: [{ independentlyCompleted: true, correct: true }, { independentlyCompleted: true, correct: true }],
    qualifyingAssessmentPath: 'endline',
    masteryChallengePassed: false,
  });
  assert.equal(decision.status, 'not_yet_mastered');
  assert.ok(decision.reasonCodes.includes('CRITICAL_SKILL_NOT_SECURE'));
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
    /learning_assessment_reassessment_authorizations/,
    /FORM_ALREADY_COMPLETED/,
    /minimum_questions_per_critical_skill/,
  ]) assert.match(`${engineMigration}\n${closureMigration}`, pattern);
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

test('reconstructed content source has 252 inspectable questions with shuffled correct-option positions and no placeholder distractors', () => {
  const { buildBank } = require(path.join(root, 'scripts', 'grade9-term1-assessment-content.cjs'));
  const bank = buildBank();
  assert.equal(bank.length, 252);
  assert.equal(new Set(bank.map((question) => question.code)).size, 252);
  for (const question of bank) {
    assert.deepEqual(Object.keys(question.options).sort(), ['A', 'B', 'C', 'D']);
    assert.ok(question.options[question.correctOption]);
    assert.equal(Object.keys(question.distractorExplanations).length, 3);
    assert.doesNotMatch(Object.values(question.options).join(' '), /common operation error|unrelated answer|unrelated value/i);
    assert.ok(question.solution.length >= 20);
  }
  for (const form of ['TOPIC-BASELINE', 'ENDLINE', 'MASTERY-CHALLENGE', 'ENDLINE-REASSESSMENT-B']) {
    const positions = new Set(bank.filter((question) => question.form === form).map((question) => question.correctOption));
    assert.ok(positions.size >= 3, `${form} should not concentrate answers in one position`);
  }
  assert.match(reconstructionMigration, /get_grade9_term1_assessment_content_qa/);
});

test('Sprint 4 repairs every draft formal blueprint without rewriting approved assessment history', () => {
  const { buildSql, definitionCode } = require(path.join(root, 'scripts', 'generate-grade9-term1-assessment-link-repair.cjs'));
  const { buildBank } = require(path.join(root, 'scripts', 'grade9-term1-assessment-content.cjs'));
  const bank = buildBank();
  const byDefinition = new Map();
  for (const question of bank) {
    const code = definitionCode(question.topic, question.form);
    byDefinition.set(code, (byDefinition.get(code) ?? 0) + 1);
  }
  assert.equal(byDefinition.size, 17);
  assert.equal([...byDefinition.values()].reduce((total, count) => total + count, 0), 252);
  assert.equal(definitionCode('INT', 'MASTERY-CHALLENGE'), 'G9-T1-INTEGERS-MASTERY-MASTERY-CHALLENGE');
  assert.match(buildSql(), /grade9_term1_assessment_blueprint_count_mismatch/);
  assert.match(assessmentBlueprintRepairMigration, /definition\.review_status in \('draft','rejected'\)/);
  assert.match(assessmentBlueprintRepairMigration, /order by version\.version_number desc/);
  assert.doesNotMatch(assessmentBlueprintRepairMigration, /update public\.learning_assessment_definitions\s+set\s+review_status/i);
});

test('policy review uses the admin transition RPC without violating approved-review metadata invariants', () => {
  assert.match(policyReviewTransitionFixMigration, /create or replace function public\.review_topic_mastery_policy_action/);
  assert.match(policyReviewTransitionFixMigration, /reviewed_by = case when v_to = 'approved' then public\.current_profile_id\(\) else null end/);
  assert.match(policyReviewTransitionFixMigration, /reviewed_at = case when v_to = 'approved' then now\(\) else null end/);
  assert.match(policyReviewTransitionFixMigration, /topic_mastery_policy_requires_critical_skill/);
});

test('assignment evidence is a conservative, traceable skill-level contribution rather than an overall-mark shortcut', () => {
  for (const pattern of [
    /assignment_evidence_maximum_question_equivalents/,
    /aggregate_assignment_evidence_counts_as_one_independent_observation/,
    /assignment_evidence_for_mastery_session/,
    /topic_mastery_assignment_evidence_consumed_once_idx/,
    /OVERALL_ACHIEVEMENT_BELOW_THRESHOLD/,
    /grade9-term1-assessment-v3-assignment-skill-weighted/,
  ]) assert.match(assignmentEvidenceMigration, pattern);
});

test('student runner is a four-option, server-timed UI with no embedded answer key', () => {
  const runner = fs.readFileSync(path.join(root, 'src', 'features', 'learning', 'StudentAssessmentRoutes.tsx'), 'utf8');
  assert.match(runner, /\['A', 'B', 'C', 'D'\]/);
  assert.match(runner, /expiresAt/);
  assert.match(runner, /useSaveLearningAssessmentAnswerMutation/);
  assert.match(runner, /useSubmitLearningAssessmentMutation/);
  assert.doesNotMatch(runner, /correct_option|distractor_explanations|answer_config/);
});
