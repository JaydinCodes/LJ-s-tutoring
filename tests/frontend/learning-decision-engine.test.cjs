const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', '..');

function loadEngine() {
  const source = fs.readFileSync(path.join(root, 'src', 'features', 'learning', 'learningDecisionEngine.ts'), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', '__filename', '__dirname', output)(module.exports, require, module, '', '');
  return module.exports;
}

function loadInstructionalValidationHarness() {
  const engine = loadEngine();
  const source = fs.readFileSync(path.join(root, 'src', 'features', 'learning', 'instructionalValidationHarness.ts'), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (specifier) => (specifier === './learningDecisionEngine' ? engine : require(specifier));
  new Function('exports', 'require', 'module', '__filename', '__dirname', output)(module.exports, localRequire, module, '', '');
  return module.exports;
}

const rules = {
  emerging: { minimumIndependentAttempts: 1, maximumIndependentAccuracy: 0.59 },
  developing: { minimumIndependentAttempts: 2, minimumIndependentAccuracy: 0.60 },
  secure: {
    minimumIndependentAttempts: 4,
    minimumIndependentAccuracy: 0.80,
    minimumDistinctOccasions: 2,
    requiresTargetLevelEvidence: true,
    blocksOnUnresolvedCriticalMisconception: true,
  },
  retained: { requiresPriorSecure: true, minimumDelayedDays: 14, minimumIndependentAccuracy: 0.80 },
};

function evidence(id, correct, day, extra = {}) {
  return { id, correct, occurredAt: `${day}T10:00:00.000Z`, independent: true, isTargetSkill: true, cognitiveLevel: 'routine', ...extra };
}

test('mastery is deterministic across unassessed, emerging, developing, secure and retained states', () => {
  const { evaluateSkillMastery } = loadEngine();
  assert.equal(evaluateSkillMastery([], rules).state, 'unassessed');
  assert.equal(evaluateSkillMastery([evidence('a', false, '2026-02-01')], rules).state, 'emerging');
  assert.equal(evaluateSkillMastery([evidence('a', true, '2026-02-01'), evidence('b', false, '2026-02-01')], rules).state, 'emerging');
  assert.equal(evaluateSkillMastery([evidence('a', true, '2026-02-01'), evidence('b', true, '2026-02-02'), evidence('c', false, '2026-02-02')], rules).state, 'developing');
  assert.equal(evaluateSkillMastery([evidence('a', true, '2026-02-01'), evidence('b', true, '2026-02-01'), evidence('c', true, '2026-02-02'), evidence('d', true, '2026-02-02')], rules).state, 'secure');
  assert.equal(
    evaluateSkillMastery([evidence('a', true, '2026-03-01')], rules, { priorSecureAt: '2026-02-01T10:00:00.000Z', evaluatedAt: '2026-03-02T10:00:00.000Z' }).state,
    'retained',
  );
});

test('a configured unresolved critical misconception blocks secure mastery without erasing the evidence explanation', () => {
  const { evaluateSkillMastery } = loadEngine();
  const result = evaluateSkillMastery(
    [evidence('a', true, '2026-02-01'), evidence('b', true, '2026-02-01'), evidence('c', true, '2026-02-02'), evidence('d', true, '2026-02-02')],
    rules,
    { misconceptions: [{ code: 'DOTS_AS_SQUARE_OF_DIFFERENCE', state: 'confirmed', critical: true }] },
  );
  assert.equal(result.state, 'developing');
  assert.ok(result.reasonCodes.includes('UNRESOLVED_CRITICAL_MISCONCEPTION'));
  assert.deepEqual(result.supportingEvidenceIds, ['a', 'b', 'c', 'd']);
});

test('recommendations are deterministic and preserve reason codes', () => {
  const { generateRecommendations } = loadEngine();
  const input = {
    mastery: { state: 'developing', reason: 'Pilot evidence', reasonCodes: ['MEANINGFUL_INDEPENDENT_SUCCESS'], supportingEvidenceIds: ['a'], independentAttemptCount: 3, independentAccuracy: 0.71, distinctOccasions: 2 },
    evidence: [evidence('a', true, '2026-02-01'), evidence('b', false, '2026-02-02')],
    prerequisites: [{ code: 'G9.ALG.FACTOR.COMMON', state: 'retained' }],
    misconceptions: [
      { code: 'DOTS_AS_SQUARE_OF_DIFFERENCE', state: 'suspected' },
      { code: 'DOTS_AS_SQUARE_OF_DIFFERENCE', state: 'confirmed' },
    ],
    complexAccuracyThreshold: 0.6,
    hintDependencyThreshold: 0.5,
  };
  assert.deepEqual(generateRecommendations(input), generateRecommendations(input));
  assert.ok(generateRecommendations(input).reasonCodes.includes('REPEATED_MISCONCEPTION'));
});

test('diagnostic and recommendation routing remediates a weak prerequisite before equation practice', () => {
  const { evaluateDiagnosticEvidence, generateRecommendations } = loadEngine();
  const diagnostic = evaluateDiagnosticEvidence({
    target: { code: 'G9.EQN.BRACKETS', state: 'emerging' },
    prerequisites: [
      { code: 'G9.ALG.DISTRIBUTIVE', state: 'emerging' },
      { code: 'G9.EQN.MULTI_STEP', state: 'secure' },
    ],
  });
  assert.equal(diagnostic.outcome, 'prerequisite_gap');
  assert.equal(diagnostic.focusSkillCode, 'G9.ALG.DISTRIBUTIVE');
  assert.equal(diagnostic.recommendationType, 'prerequisite_remediation');
  const recommendation = generateRecommendations({
    mastery: { state: 'emerging', reason: 'Weak', reasonCodes: ['WEAK_OR_INCONSISTENT_INDEPENDENT_EVIDENCE'], supportingEvidenceIds: ['a'], independentAttemptCount: 1, independentAccuracy: 0, distinctOccasions: 1 },
    evidence: [evidence('a', false, '2026-02-01')],
    prerequisites: [{ code: 'G9.ALG.DISTRIBUTIVE', state: 'emerging' }],
    misconceptions: [],
    complexAccuracyThreshold: 0.6,
    hintDependencyThreshold: 0.5,
  });
  assert.equal(recommendation.recommendationType, 'prerequisite_remediation');
  assert.equal(recommendation.focusSkillCode, 'G9.ALG.DISTRIBUTIVE');
});

test('a target misconception with secure prerequisites routes to contrasting DOTS examples', () => {
  const { evaluateDiagnosticEvidence } = loadEngine();
  const result = evaluateDiagnosticEvidence({
    target: { code: 'G9.ALG.FACTOR.DOTS', state: 'emerging' },
    prerequisites: [{ code: 'G9.ALG.EXPAND.BINOMIAL', state: 'secure' }],
    misconceptions: [
      { code: 'ALG_DOTS_AS_BINOMIAL_SQUARE', state: 'suspected' },
      { code: 'ALG_DOTS_AS_BINOMIAL_SQUARE', state: 'confirmed' },
    ],
  });
  assert.equal(result.outcome, 'target_skill_gap');
  assert.equal(result.recommendationType, 'contrasting_examples');
  assert.ok(result.reasonCodes.includes('REPEATED_MISCONCEPTION'));
});

test('assisted success is never treated as independent secure evidence and routes to an independent retry', () => {
  const { evaluateSkillMastery, generateRecommendations } = loadEngine();
  const assistedEvidence = [
    evidence('a', true, '2026-02-01', { independent: false }),
    evidence('b', true, '2026-02-02', { independent: false }),
  ];
  const mastery = evaluateSkillMastery(assistedEvidence, rules);
  assert.equal(mastery.state, 'unassessed');
  const recommendation = generateRecommendations({
    mastery,
    evidence: assistedEvidence,
    prerequisites: [{ code: 'G9.ALG.EXPAND.BINOMIAL', state: 'secure' }],
    misconceptions: [],
    complexAccuracyThreshold: 0.6,
    hintDependencyThreshold: 0.5,
  });
  assert.equal(recommendation.recommendationType, 'faded_example');
  assert.ok(recommendation.reasonCodes.includes('HINT_DEPENDENCY'));
});

test('delayed retrieval promotes retained evidence and later independent failures re-evaluate state', () => {
  const { evaluateSkillMastery, generateRecommendations } = loadEngine();
  const retained = evaluateSkillMastery([evidence('a', true, '2026-03-01')], rules, { priorSecureAt: '2026-02-01T10:00:00.000Z' });
  assert.equal(retained.state, 'retained');
  const forgotten = evaluateSkillMastery([evidence('a', false, '2026-03-01'), evidence('b', false, '2026-03-02')], rules, { priorSecureAt: '2026-02-01T10:00:00.000Z' });
  assert.equal(forgotten.state, 'emerging');
  const refresher = generateRecommendations({
    mastery: forgotten,
    evidence: [evidence('a', false, '2026-03-01'), evidence('b', false, '2026-03-02')],
    prerequisites: [{ code: 'G9.ALG.EXPAND.BINOMIAL', state: 'secure' }],
    misconceptions: [],
    complexAccuracyThreshold: 0.6,
    hintDependencyThreshold: 0.5,
    failedDelayedRetrieval: true,
  });
  assert.equal(refresher.recommendationType, 'retrieval_practice');
  assert.ok(refresher.reasonCodes.includes('FAILED_DELAYED_RETRIEVAL'));
});

test('confidence and time remain diagnostic context and do not alter deterministic mastery', () => {
  const { evaluateSkillMastery } = loadEngine();
  const base = [evidence('a', true, '2026-02-01'), evidence('b', true, '2026-02-01'), evidence('c', true, '2026-02-02'), evidence('d', true, '2026-02-02')];
  const contextual = base.map((item, index) => ({ ...item, confidence: index % 2 ? 4 : 1, timeSpentSeconds: 7200 }));
  assert.deepEqual(evaluateSkillMastery(base, rules), evaluateSkillMastery(contextual, rules));
});

test('misconception evidence is deterministic, confidence-aware and resolvable without changing mastery numerically', () => {
  const { evaluateMisconceptionEvidence } = loadEngine();
  const misconceptionRules = {
    suspected: { minimumIndependentIncorrectAttempts: 2 },
    confirmed: { minimumIndependentIncorrectAttempts: 3, minimumHighConfidenceIncorrectAttempts: 2 },
    resolved: { minimumIndependentCorrectAttemptsAfterLastError: 3, requiresDelayedIndependentSuccess: true },
  };
  const confirmed = evaluateMisconceptionEvidence([
    { id: 'a', occurredAt: '2026-02-01T10:00:00.000Z', independent: true, correct: false, confidence: 4 },
    { id: 'b', occurredAt: '2026-02-02T10:00:00.000Z', independent: true, correct: false, confidence: 4 },
  ], misconceptionRules);
  assert.equal(confirmed.state, 'confirmed');
  assert.ok(confirmed.reasonCodes.includes('HIGH_CONFIDENCE_ERROR_PATTERN'));
  const resolved = evaluateMisconceptionEvidence([
    { id: 'a', occurredAt: '2026-02-01T10:00:00.000Z', independent: true, correct: false, confidence: 4 },
    { id: 'b', occurredAt: '2026-03-01T10:00:00.000Z', independent: true, correct: true },
    { id: 'c', occurredAt: '2026-03-02T10:00:00.000Z', independent: true, correct: true },
    { id: 'd', occurredAt: '2026-03-03T10:00:00.000Z', independent: true, correct: true },
    { id: 'e', occurredAt: '2026-03-20T10:00:00.000Z', independent: true, correct: true, delayedRetrieval: true },
  ], misconceptionRules, { priorState: 'confirmed' });
  assert.equal(resolved.state, 'resolved');
});

test('the 22-case instructional validation matrix matches the intended pedagogical decisions', () => {
  const { instructionalValidationProfiles, runInstructionalValidationMatrix } = loadInstructionalValidationHarness();
  const results = runInstructionalValidationMatrix();
  assert.equal(instructionalValidationProfiles.length, 22);
  assert.equal(results.filter((result) => result.pass).length, results.length, JSON.stringify(results.filter((result) => !result.pass), null, 2));
  assert.match(results.find((result) => result.profile === 'dots-high-confidence-misconception').actual.masteryReason, /2 independent attempts/i);
});

test('schema preserves versioned evidence, controlled writes and RLS boundaries', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260826120612_grade9_evidence_learning_system.sql'), 'utf8');
  for (const fragment of [
    'create table public.curriculum_versions',
    'references public.curriculum_skills(id)',
    'create table public.question_versions',
    'approved_question_versions_are_immutable_create_a_new_version',
    'create table public.learning_attempt_hint_events',
    'create table public.skill_mastery_evaluations',
    'create table public.grade9_learning_recommendations',
    'create table public.tutor_recommendation_decisions',
    'create table public.tutor_interventions',
    'create table public.intervention_outcomes',
    'record_learning_attempt',
    'evaluate_learning_attempt',
    'student cannot',
  ]) {
    assert.ok(migration.includes(fragment), `missing ${fragment}`);
  }
  assert.doesNotMatch(migration, /create table public\.skill_prerequisites/);
  assert.match(migration, /public\.curriculum_skills/);
  assert.match(migration, /alter table public\.learning_attempts enable row level security/);
  assert.match(migration, /learning_attempts_scoped_read/);
  assert.match(migration, /question_versions_tutor_admin_read/);
  assert.match(migration, /review_question_version/);
  assert.match(migration, /set search_path = ''/);
});

test('instructional pilot migration seeds a review-gated diagnostic, activity, hints and content validation', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260826123020_grade9_instructional_pilot_vertical.sql'), 'utf8');
  for (const fragment of [
    'create table public.learning_activity_templates',
    'create table public.diagnostic_blueprints',
    'validate_question_version_for_approval',
    'ACT.G9.ALG.FACTOR.DOTS.FOUNDATIONS',
    'DIAG.G9.MATH.VERTICAL.V1',
    'G9.ALG.SUBSTITUTION',
    'G9.EQN.ZERO_PRODUCT',
    'G9.GRAPH.REPRESENTATION_TRANSLATE',
    'ALG_DOTS_AS_BINOMIAL_SQUARE',
    'GRAPH_GRADIENT_RECIPROCAL',
    'Q.G9.DOTS.18',
  ]) assert.ok(migration.includes(fragment), `missing ${fragment}`);
  assert.match(migration, /review_status public\.question_review_status not null default 'draft'/);
  assert.match(migration, /alter table public\.diagnostic_blueprints enable row level security/);
});

test('validation workflow migration keeps approval reviewed, delivery approved-only and retries idempotent', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260826125819_grade9_instructional_validation_workflow.sql'), 'utf8');
  for (const fragment of [
    'create table public.question_review_events',
    'review_question_version_action',
    'MISSING_OR_RETIRED_PRIMARY_SKILL',
    'get_question_version_review_bundle',
    'get_grade9_gold_standard_review_set',
    'get_approved_diagnostic_blueprint',
    'idempotency_key',
    'idempotency_key_reused_with_different_response',
    'item.retired_at is null',
  ]) assert.ok(migration.includes(fragment), `missing ${fragment}`);
  assert.match(migration, /alter table public\.question_review_events enable row level security/);
});
