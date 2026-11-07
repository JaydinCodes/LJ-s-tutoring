const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', '..');
const migrationPath = path.join(root, 'supabase', 'migrations', '20261106120000_grade9_term1_learning_foundation.sql');

function loadContracts() {
  const source = fs.readFileSync(
    path.join(root, 'src', 'features', 'learning', 'grade9Term1FoundationContracts.ts'),
    'utf8',
  );
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', '__filename', '__dirname', output)(module.exports, require, module, '', '');
  return module.exports;
}

const policy = {
  overallAchievementThreshold: 80,
  criticalSkillCoverageThreshold: 100,
  minimumReasoningEvidenceCount: 1,
  minimumReasoningAchievementThreshold: 80,
  strongBaselineThreshold: 90,
  formalScoredAttemptsPerQuestion: 1,
  practiceAttemptsPerQuestion: 3,
  requiresMasteryChallenge: true,
};

test('unknown prerequisites request an optional diagnostic instead of being treated as failed', () => {
  const { evaluatePrerequisiteReadiness, determineTopicProgression } = loadContracts();
  const prerequisites = [{ skillCode: 'G8-NUM-INTEGERS-OPERATIONS', state: 'unknown' }];

  assert.deepEqual(evaluatePrerequisiteReadiness(prerequisites), {
    status: 'unknown_needs_diagnostic',
    unknownSkillCodes: ['G8-NUM-INTEGERS-OPERATIONS'],
    unmetSkillCodes: [],
  });
  const decision = determineTopicProgression(policy, prerequisites, null, null);
  assert.equal(decision.action, 'offer_optional_prerequisite_diagnostic');
  assert.deepEqual(decision.eligibleAssessmentTypes, ['entry_baseline', 'topic_baseline']);
  assert.ok(decision.reasonCodes.includes('DIAGNOSTIC_OFFERED_NOT_REQUIRED'));
});

test('known prerequisite gaps route targeted remediation while a strong baseline unlocks a mastery challenge', () => {
  const { determineTopicProgression } = loadContracts();
  const weak = determineTopicProgression(policy, [{ skillCode: 'G8-EXP-LAWS-SCI', state: 'not_secure' }], null, null);
  assert.equal(weak.action, 'targeted_remediation');
  assert.deepEqual(weak.focusSkillCodes, ['G8-EXP-LAWS-SCI']);

  const strong = determineTopicProgression(policy, [{ skillCode: 'G8-EXP-LAWS-SCI', state: 'secure' }], {
    overallAchievement: 92,
    criticalSkills: [{ skillCode: 'G9-EXP-LAWS-EXTENDED', isCritical: true, state: 'secure' }],
    mathematicalReasoningEvidence: [{ independentlyCompleted: true, correct: true }],
  }, null);
  assert.equal(strong.action, 'offer_mastery_challenge');
  assert.ok(strong.eligibleAssessmentTypes.includes('mastery_challenge'));
});

test('topic mastery requires overall, critical-skill, reasoning, and challenge evidence', () => {
  const { evaluateTopicMastery } = loadContracts();
  const unknown = evaluateTopicMastery(policy, {
    overallAchievement: 95,
    criticalSkills: [{ skillCode: 'G9-PAT-GENERAL-RULE', isCritical: true, state: 'unknown' }],
    mathematicalReasoningEvidence: [],
    masteryChallengePassed: null,
  });
  assert.equal(unknown.status, 'evidence_incomplete');
  assert.ok(unknown.reasonCodes.includes('MISSING_CRITICAL_SKILL_EVIDENCE'));

  const mastered = evaluateTopicMastery(policy, {
    overallAchievement: 85,
    criticalSkills: [{ skillCode: 'G9-PAT-GENERAL-RULE', isCritical: true, state: 'secure' }],
    mathematicalReasoningEvidence: [{ independentlyCompleted: true, correct: true }],
    masteryChallengePassed: true,
  });
  assert.equal(mastered.status, 'mastered');
});

test('multiple-choice contract requires four unique options, one key, and explanations for every distractor', () => {
  const { validateMultipleChoiceSpecification } = loadContracts();
  const valid = {
    type: 'multiple_choice',
    options: { A: '12', B: '14', C: '16', D: '18' },
    correctOption: 'C',
    distractorExplanations: { A: 'This misses a factor.', B: 'This applies the wrong operation.', D: 'This overcounts a term.' },
    difficulty: 3,
    reasoningClassification: 'mathematical_reasoning',
  };
  assert.deepEqual(validateMultipleChoiceSpecification(valid), []);
  assert.ok(validateMultipleChoiceSpecification({ ...valid, options: { A: '12', B: '12', C: '16', D: '18' } }).includes('MC_OPTIONS_MUST_BE_DISTINCT'));
  assert.ok(validateMultipleChoiceSpecification({ ...valid, distractorExplanations: { A: 'reason', B: 'reason' } }).includes('MC_DISTRACTOR_EXPLANATIONS_MUST_MATCH_INCORRECT_OPTIONS'));
});

test('migration reuses the secured learning system with admin-gated configuration and no draft publication path', () => {
  const migration = fs.readFileSync(migrationPath, 'utf8');
  for (const skill of [
    'G9-NUM-WHOLE-HCF-LCM',
    'G9-NUM-INTEGERS-OPERATIONS',
    'G9-EXP-LAWS-EXTENDED',
    'G9-PAT-GEOMETRIC-VISUAL',
  ]) assert.match(migration, new RegExp(`'${skill}'`));

  assert.match(migration, /create table public\.topic_mastery_policies/);
  assert.match(migration, /formal_scored_attempts_per_question smallint not null default 1 check \(formal_scored_attempts_per_question = 1\)/);
  assert.match(migration, /practice_attempts_per_question smallint not null default 3 check \(practice_attempts_per_question = 3\)/);
  assert.match(migration, /assessment_type in \('entry_baseline', 'topic_baseline', 'endline', 'mastery_challenge'\)/);
  assert.match(migration, /duration_minutes smallint not null check \(duration_minutes between 1 and 180\)/);
  assert.match(migration, /create table public\.qualifying_assignment_mastery_evidence/);
  assert.match(migration, /assignment_submission_must_be_latest_marked_and_released/);
  assert.match(migration, /topic_policy_does_not_allow_qualifying_assignment_evidence/);
  assert.match(migration, /alter table public\.topic_mastery_policies enable row level security/);
  assert.match(migration, /create policy "topic_mastery_policies_admin_read"/);
  assert.match(migration, /revoke all on table public\.topic_mastery_policies/);
  assert.match(migration, /'MC_OPTIONS_MUST_BE_A_TO_D'/);
  assert.match(migration, /'MC_DISTRACTOR_EXPLANATIONS_MUST_MATCH_INCORRECT_OPTIONS'/);
  assert.match(migration, /'MISSING_REASONING_CLASSIFICATION'/);
  assert.match(migration, /creates no learner-visible content:[\s\S]*?are drafts/);
});
