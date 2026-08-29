import {
  evaluateMisconceptionEvidence,
  evaluateSkillMastery,
  generateRecommendations,
  type LearnerMisconceptionSignal,
  type MasteryEvaluation,
  type MasteryRuleConfiguration,
  type MisconceptionAttemptSignal,
  type MisconceptionEvaluation,
  type MisconceptionRuleConfiguration,
  type SkillEvidence,
} from './learningDecisionEngine';

export const pilotMasteryRules: MasteryRuleConfiguration = {
  emerging: { minimumIndependentAttempts: 1, maximumIndependentAccuracy: 0.59 },
  developing: { minimumIndependentAttempts: 2, minimumIndependentAccuracy: 0.6 },
  secure: {
    minimumIndependentAttempts: 4,
    minimumIndependentAccuracy: 0.8,
    minimumDistinctOccasions: 2,
    requiresTargetLevelEvidence: true,
    blocksOnUnresolvedCriticalMisconception: true,
  },
  retained: { requiresPriorSecure: true, minimumDelayedDays: 14, minimumIndependentAccuracy: 0.8 },
};

export const pilotMisconceptionRules: MisconceptionRuleConfiguration = {
  suspected: { minimumIndependentIncorrectAttempts: 2 },
  confirmed: { minimumIndependentIncorrectAttempts: 3, minimumHighConfidenceIncorrectAttempts: 2 },
  resolved: { minimumIndependentCorrectAttemptsAfterLastError: 3, requiresDelayedIndependentSuccess: true },
};

export interface InstructionalValidationProfile {
  name: string;
  targetSkillCode: string;
  evidence: SkillEvidence[];
  prerequisites: Array<{ code: string; state: 'unassessed' | 'emerging' | 'developing' | 'secure' | 'retained' }>;
  misconceptionCode?: string;
  misconceptionEvidence?: MisconceptionAttemptSignal[];
  priorMisconceptionState?: 'suspected' | 'confirmed' | 'resolved' | null;
  priorSecureAt?: string | null;
  failedDelayedRetrieval?: boolean;
  delayedRetrievalAvailable?: boolean;
  expected: {
    mastery: string;
    recommendation: string | null;
    misconception?: string | null;
    focusSkillCode?: string;
  };
}

export interface InstructionalValidationResult {
  profile: string;
  targetSkillCode: string;
  expected: InstructionalValidationProfile['expected'];
  actual: {
    mastery: string;
    masteryReason: string;
    recommendation: string | null;
    recommendationReason: string | null;
    focusSkillCode?: string;
    misconception: string | null;
    misconceptionReason: string | null;
  };
  pass: boolean;
}

function skillEvidence(id: string, correct: boolean, day: string, extra: Partial<SkillEvidence> = {}): SkillEvidence {
  return { id, correct, occurredAt: `${day}T10:00:00.000Z`, independent: true, isTargetSkill: true, cognitiveLevel: 'routine', ...extra };
}

function misconceptionEvidence(id: string, correct: boolean, day: string, confidence: 1 | 2 | 3 | 4 | null = null, extra: Partial<MisconceptionAttemptSignal> = {}): MisconceptionAttemptSignal {
  return { id, correct, occurredAt: `${day}T10:00:00.000Z`, independent: true, confidence, ...extra };
}

const secureDotsPrerequisite = [{ code: 'G9.ALG.EXPAND.BINOMIAL', state: 'secure' as const }];

/**
 * Purposeful synthetic cases, not generated learner data. Their expected
 * results form a regression contract for instructional decisions.
 */
export const instructionalValidationProfiles: InstructionalValidationProfile[] = [
  {
    name: 'strong-learner-retained', targetSkillCode: 'G9.ALG.FACTOR.DOTS',
    evidence: [skillEvidence('p1a', true, '2026-03-01'), skillEvidence('p1b', true, '2026-03-01'), skillEvidence('p1c', true, '2026-03-02'), skillEvidence('p1d', true, '2026-03-02')],
    prerequisites: secureDotsPrerequisite, priorSecureAt: '2026-02-01T10:00:00.000Z', delayedRetrievalAvailable: true,
    expected: { mastery: 'retained', recommendation: null },
  },
  {
    name: 'emerging-algebra-prerequisite-before-equations', targetSkillCode: 'G9.EQN.BRACKETS',
    evidence: [skillEvidence('p2a', false, '2026-03-01')], prerequisites: [{ code: 'G9.ALG.DISTRIBUTIVE', state: 'emerging' }],
    expected: { mastery: 'emerging', recommendation: 'prerequisite_remediation', focusSkillCode: 'G9.ALG.DISTRIBUTIVE' },
  },
  {
    name: 'dots-high-confidence-misconception', targetSkillCode: 'G9.ALG.FACTOR.DOTS',
    evidence: [skillEvidence('p3a', false, '2026-03-01'), skillEvidence('p3b', false, '2026-03-02')], prerequisites: secureDotsPrerequisite,
    misconceptionCode: 'ALG_DOTS_AS_BINOMIAL_SQUARE', misconceptionEvidence: [misconceptionEvidence('p3a', false, '2026-03-01', 4), misconceptionEvidence('p3b', false, '2026-03-02', 4)],
    expected: { mastery: 'emerging', recommendation: 'contrasting_examples', misconception: 'confirmed' },
  },
  {
    name: 'scaffold-dependent-independent-retry', targetSkillCode: 'G9.ALG.FACTOR.DOTS',
    evidence: [skillEvidence('p4a', true, '2026-03-01', { independent: false }), skillEvidence('p4b', true, '2026-03-02', { independent: false }), skillEvidence('p4c', false, '2026-03-03')], prerequisites: secureDotsPrerequisite,
    expected: { mastery: 'emerging', recommendation: 'faded_example' },
  },
  {
    name: 'routine-only-complex-gap', targetSkillCode: 'G9.ALG.FACTOR.DOTS',
    evidence: [skillEvidence('p5a', true, '2026-03-01'), skillEvidence('p5b', true, '2026-03-01'), skillEvidence('p5c', true, '2026-03-02'), skillEvidence('p5d', true, '2026-03-02'), skillEvidence('p5e', false, '2026-03-03', { cognitiveLevel: 'complex' }), skillEvidence('p5f', false, '2026-03-04', { cognitiveLevel: 'complex' })], prerequisites: secureDotsPrerequisite,
    expected: { mastery: 'developing', recommendation: 'faded_example' },
  },
  {
    name: 'forgotten-skill-retrieval-refresher', targetSkillCode: 'G9.ALG.FACTOR.DOTS',
    evidence: [skillEvidence('p6a', false, '2026-03-01'), skillEvidence('p6b', false, '2026-03-02')], prerequisites: secureDotsPrerequisite, priorSecureAt: '2026-02-01T10:00:00.000Z', failedDelayedRetrieval: true,
    expected: { mastery: 'emerging', recommendation: 'retrieval_practice' },
  },
  {
    name: 'slow-but-accurate', targetSkillCode: 'G9.ALG.LIKE_TERMS',
    evidence: [skillEvidence('p7a', true, '2026-03-01'), skillEvidence('p7b', true, '2026-03-01'), skillEvidence('p7c', true, '2026-03-02'), skillEvidence('p7d', true, '2026-03-02')], prerequisites: [{ code: 'G9.ALG.LANGUAGE.TERMS', state: 'secure' }], delayedRetrievalAvailable: true,
    expected: { mastery: 'secure', recommendation: null },
  },
  {
    name: 'fast-guessing-incorrect', targetSkillCode: 'G9.ALG.LIKE_TERMS',
    evidence: [skillEvidence('p8a', false, '2026-03-01'), skillEvidence('p8b', false, '2026-03-02')], prerequisites: [{ code: 'G9.ALG.LANGUAGE.TERMS', state: 'secure' }],
    expected: { mastery: 'emerging', recommendation: 'guided_practice' },
  },
  {
    name: 'low-confidence-correct', targetSkillCode: 'G9.GRAPH.GRADIENT',
    evidence: [skillEvidence('p9a', true, '2026-03-01'), skillEvidence('p9b', true, '2026-03-01'), skillEvidence('p9c', true, '2026-03-02'), skillEvidence('p9d', true, '2026-03-02')], prerequisites: [{ code: 'G9.GRAPH.CARTESIAN_PLANE', state: 'secure' }], delayedRetrievalAvailable: true,
    expected: { mastery: 'secure', recommendation: null },
  },
  {
    name: 'high-confidence-gradient-reciprocal', targetSkillCode: 'G9.GRAPH.GRADIENT',
    evidence: [skillEvidence('p10a', false, '2026-03-01'), skillEvidence('p10b', false, '2026-03-02')], prerequisites: [{ code: 'G9.GRAPH.CARTESIAN_PLANE', state: 'secure' }],
    misconceptionCode: 'GRAPH_GRADIENT_RECIPROCAL', misconceptionEvidence: [misconceptionEvidence('p10a', false, '2026-03-01', 4), misconceptionEvidence('p10b', false, '2026-03-02', 4)],
    expected: { mastery: 'emerging', recommendation: 'contrasting_examples', misconception: 'confirmed' },
  },
  {
    name: 'older-failure-recent-success', targetSkillCode: 'G9.EQN.MULTI_STEP',
    evidence: [skillEvidence('p11a', false, '2026-01-01'), skillEvidence('p11b', true, '2026-03-01'), skillEvidence('p11c', true, '2026-03-01'), skillEvidence('p11d', true, '2026-03-02'), skillEvidence('p11e', true, '2026-03-02')], prerequisites: [{ code: 'G9.EQN.ONE_STEP', state: 'secure' }], delayedRetrievalAvailable: true,
    expected: { mastery: 'secure', recommendation: null },
  },
  {
    name: 'critical-misconception-blocks-secure', targetSkillCode: 'G9.ALG.FACTOR.DOTS',
    evidence: [skillEvidence('p12a', true, '2026-03-01'), skillEvidence('p12b', true, '2026-03-01'), skillEvidence('p12c', true, '2026-03-02'), skillEvidence('p12d', true, '2026-03-02')], prerequisites: secureDotsPrerequisite,
    misconceptionCode: 'ALG_DOTS_AS_BINOMIAL_SQUARE', misconceptionEvidence: [misconceptionEvidence('p12a', false, '2026-02-20', 4), misconceptionEvidence('p12b', false, '2026-02-21', 4)],
    expected: { mastery: 'developing', recommendation: 'contrasting_examples', misconception: 'confirmed' },
  },
  {
    name: 'resolved-dots-misconception', targetSkillCode: 'G9.ALG.FACTOR.DOTS',
    evidence: [skillEvidence('p13a', true, '2026-03-01'), skillEvidence('p13b', true, '2026-03-01'), skillEvidence('p13c', true, '2026-03-02'), skillEvidence('p13d', true, '2026-03-02')], prerequisites: secureDotsPrerequisite, delayedRetrievalAvailable: true,
    misconceptionCode: 'ALG_DOTS_AS_BINOMIAL_SQUARE', priorMisconceptionState: 'confirmed', misconceptionEvidence: [misconceptionEvidence('p13a', false, '2026-02-01', 4), misconceptionEvidence('p13b', true, '2026-03-01'), misconceptionEvidence('p13c', true, '2026-03-02'), misconceptionEvidence('p13d', true, '2026-03-03'), misconceptionEvidence('p13e', true, '2026-03-20', null, { delayedRetrieval: true })],
    expected: { mastery: 'secure', recommendation: null, misconception: 'resolved' },
  },
  {
    name: 'single-arithmetic-slip-not-misconception', targetSkillCode: 'G9.EQN.MULTI_STEP',
    evidence: [skillEvidence('p14a', true, '2026-03-01'), skillEvidence('p14b', true, '2026-03-01'), skillEvidence('p14c', true, '2026-03-02'), skillEvidence('p14d', false, '2026-03-02')], prerequisites: [{ code: 'G9.EQN.ONE_STEP', state: 'secure' }],
    misconceptionCode: 'EQN_DIVIDE_ONE_SIDE_ONLY', misconceptionEvidence: [misconceptionEvidence('p14d', false, '2026-03-02', 2)],
    expected: { mastery: 'developing', recommendation: 'guided_practice', misconception: null },
  },
  {
    name: 'unassessed-target-secure-prerequisites', targetSkillCode: 'G9.ALG.FACTOR.TRINOMIAL',
    evidence: [], prerequisites: [{ code: 'G9.ALG.EXPAND.BINOMIAL', state: 'secure' }],
    expected: { mastery: 'unassessed', recommendation: 'guided_practice' },
  },
  {
    name: 'secure-needs-delayed-retrieval', targetSkillCode: 'G9.EQN.ONE_STEP',
    evidence: [skillEvidence('p16a', true, '2026-03-01'), skillEvidence('p16b', true, '2026-03-01'), skillEvidence('p16c', true, '2026-03-02'), skillEvidence('p16d', true, '2026-03-02')], prerequisites: [{ code: 'G9.ALG.LIKE_TERMS', state: 'secure' }], delayedRetrievalAvailable: false,
    expected: { mastery: 'secure', recommendation: 'retrieval_practice' },
  },
  {
    name: 'unknown-prerequisite-routes-remediation', targetSkillCode: 'G9.GRAPH.LINEAR_DRAW',
    evidence: [skillEvidence('p17a', false, '2026-03-01')], prerequisites: [{ code: 'G9.GRAPH.PLOT_POINTS', state: 'unassessed' }],
    expected: { mastery: 'emerging', recommendation: 'prerequisite_remediation', focusSkillCode: 'G9.GRAPH.PLOT_POINTS' },
  },
  {
    name: 'zero-product-pattern', targetSkillCode: 'G9.EQN.ZERO_PRODUCT',
    evidence: [skillEvidence('p18a', false, '2026-03-01'), skillEvidence('p18b', false, '2026-03-02')], prerequisites: [{ code: 'G9.ALG.FACTOR.COMMON', state: 'secure' }],
    misconceptionCode: 'EQN_ZERO_PRODUCT_NOT_APPLIED', misconceptionEvidence: [misconceptionEvidence('p18a', false, '2026-03-01', 3), misconceptionEvidence('p18b', false, '2026-03-02', 3)],
    expected: { mastery: 'emerging', recommendation: 'contrasting_examples', misconception: 'suspected' },
  },
  {
    name: 'high-hint-ratio-fades-scaffold', targetSkillCode: 'G9.ALG.EXPAND.BINOMIAL',
    evidence: [skillEvidence('p19a', true, '2026-03-01', { independent: false }), skillEvidence('p19b', true, '2026-03-01', { independent: false }), skillEvidence('p19c', true, '2026-03-02', { independent: false }), skillEvidence('p19d', true, '2026-03-02', { independent: true }), skillEvidence('p19e', false, '2026-03-03', { independent: true })], prerequisites: [{ code: 'G9.ALG.EXPAND.MONOMIAL', state: 'secure' }],
    expected: { mastery: 'emerging', recommendation: 'faded_example' },
  },
  {
    name: 'representation-translation-secure', targetSkillCode: 'G9.GRAPH.REPRESENTATION_TRANSLATE',
    evidence: [skillEvidence('p20a', true, '2026-03-01', { cognitiveLevel: 'complex' }), skillEvidence('p20b', true, '2026-03-01'), skillEvidence('p20c', true, '2026-03-02'), skillEvidence('p20d', true, '2026-03-02')], prerequisites: [{ code: 'G9.GRAPH.RULE_FROM_TABLE', state: 'secure' }, { code: 'G9.GRAPH.LINEAR_DRAW', state: 'secure' }], delayedRetrievalAvailable: true,
    expected: { mastery: 'secure', recommendation: null },
  },
  {
    name: 'assisted-then-independent-secure', targetSkillCode: 'G9.ALG.DISTRIBUTIVE',
    evidence: [skillEvidence('p21a', true, '2026-02-25', { independent: false }), skillEvidence('p21b', true, '2026-03-01'), skillEvidence('p21c', true, '2026-03-01'), skillEvidence('p21d', true, '2026-03-02'), skillEvidence('p21e', true, '2026-03-02')], prerequisites: [{ code: 'G9.ALG.LIKE_TERMS', state: 'secure' }], delayedRetrievalAvailable: true,
    expected: { mastery: 'secure', recommendation: null },
  },
  {
    name: 'formal-and-formative-consistent', targetSkillCode: 'G9.ALG.FACTOR.COMMON',
    evidence: [skillEvidence('p22a', true, '2026-03-01'), skillEvidence('p22b', true, '2026-03-01'), skillEvidence('p22c', true, '2026-03-02'), skillEvidence('p22d', true, '2026-03-02')], prerequisites: [{ code: 'G9.ALG.LIKE_TERMS', state: 'retained' }], delayedRetrievalAvailable: true,
    expected: { mastery: 'secure', recommendation: null },
  },
];

export function runInstructionalValidationProfile(profile: InstructionalValidationProfile): InstructionalValidationResult {
  const misconceptionEvaluation: MisconceptionEvaluation | null = profile.misconceptionEvidence
    ? evaluateMisconceptionEvidence(profile.misconceptionEvidence, pilotMisconceptionRules, { priorState: profile.priorMisconceptionState })
    : null;
  const misconceptionSignals: LearnerMisconceptionSignal[] = misconceptionEvaluation?.state && misconceptionEvaluation.state !== 'resolved' && profile.misconceptionCode
    ? [{ code: profile.misconceptionCode, state: misconceptionEvaluation.state, critical: profile.name === 'critical-misconception-blocks-secure', evidenceCount: misconceptionEvaluation.independentIncorrectAttemptCount, highConfidenceErrorCount: misconceptionEvaluation.highConfidenceIncorrectAttemptCount }]
    : [];
  const mastery: MasteryEvaluation = evaluateSkillMastery(profile.evidence, pilotMasteryRules, {
    priorSecureAt: profile.priorSecureAt,
    misconceptions: misconceptionSignals,
  });
  const recommendation = generateRecommendations({
    mastery,
    evidence: profile.evidence,
    prerequisites: profile.prerequisites,
    misconceptions: misconceptionSignals,
    complexAccuracyThreshold: 0.6,
    hintDependencyThreshold: 0.5,
    failedDelayedRetrieval: profile.failedDelayedRetrieval,
    delayedRetrievalAvailable: profile.delayedRetrievalAvailable,
  });
  const actual = {
    mastery: mastery.state,
    masteryReason: mastery.reason,
    recommendation: recommendation?.recommendationType || null,
    recommendationReason: recommendation?.reason || null,
    focusSkillCode: recommendation?.focusSkillCode,
    misconception: misconceptionEvaluation?.state || null,
    misconceptionReason: misconceptionEvaluation?.reason || null,
  };
  const pass = actual.mastery === profile.expected.mastery
    && actual.recommendation === profile.expected.recommendation
    && actual.misconception === (profile.expected.misconception || null)
    && actual.focusSkillCode === profile.expected.focusSkillCode;
  return { profile: profile.name, targetSkillCode: profile.targetSkillCode, expected: profile.expected, actual, pass };
}

export function runInstructionalValidationMatrix() {
  return instructionalValidationProfiles.map(runInstructionalValidationProfile);
}
