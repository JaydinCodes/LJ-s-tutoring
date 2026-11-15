/**
 * Grade 9 Term 1 policy contracts.
 *
 * These are deliberately pure. The Edge Function remains the authority that
 * reads/writes learning evidence; this module gives that boundary and the
 * admin authoring experience one shared, testable interpretation of a policy.
 */

export type LearningAssessmentType =
  | 'entry_baseline'
  | 'topic_baseline'
  | 'endline'
  | 'mastery_challenge';

export type ReasoningClassification =
  | 'not_classified'
  | 'procedural'
  | 'mathematical_reasoning';

export type PrerequisiteEvidenceState = 'unknown' | 'not_secure' | 'secure';

export interface PrerequisiteEvidence {
  skillCode: string;
  state: PrerequisiteEvidenceState;
}

export interface TopicMasteryPolicyContract {
  overallAchievementThreshold: number;
  /** Required achievement within every critical skill, not mere exposure. */
  criticalSkillAchievementThreshold?: number;
  /** Independent formal questions required before a skill can be judged. */
  minimumQuestionsPerCriticalSkill?: number;
  criticalSkillCoverageThreshold: number;
  minimumReasoningEvidenceCount: number;
  minimumReasoningAchievementThreshold: number;
  strongBaselineThreshold: number;
  formalScoredAttemptsPerQuestion: 1;
  practiceAttemptsPerQuestion: 3;
  requiresMasteryChallenge: boolean;
}

export interface TopicSkillEvidence {
  skillCode: string;
  isCritical: boolean;
  state: PrerequisiteEvidenceState;
  correctResponses?: number;
  independentResponses?: number;
}

export interface MathematicalReasoningEvidence {
  correct: boolean;
  independentlyCompleted: boolean;
}

export interface TopicMasteryEvidence {
  overallAchievement: number | null;
  criticalSkills: TopicSkillEvidence[];
  mathematicalReasoningEvidence: MathematicalReasoningEvidence[];
  /** Endlines and mastery challenges are alternate independent pathways. */
  qualifyingAssessmentPath?: 'endline' | 'mastery_challenge' | null;
  masteryChallengePassed: boolean | null;
}

export type TopicMasteryStatus =
  | 'not_assessed'
  | 'evidence_incomplete'
  | 'not_yet_mastered'
  | 'mastered';

export interface TopicMasteryDecision {
  status: TopicMasteryStatus;
  reasonCodes: string[];
  criticalSkillCoverage: number | null;
  reasoningAchievement: number | null;
}

export type PrerequisiteReadiness =
  | 'ready'
  | 'unknown_needs_diagnostic'
  | 'targeted_remediation_recommended';

export interface PrerequisiteReadinessDecision {
  status: PrerequisiteReadiness;
  unknownSkillCodes: string[];
  unmetSkillCodes: string[];
}

export interface BaselineResult {
  overallAchievement: number;
  criticalSkills: TopicSkillEvidence[];
  mathematicalReasoningEvidence: MathematicalReasoningEvidence[];
}

export type TopicProgressionAction =
  | 'offer_baseline'
  | 'offer_optional_prerequisite_diagnostic'
  | 'targeted_remediation'
  | 'offer_mastery_challenge'
  | 'offer_endline'
  | 'advance_to_dependent_topic';

export interface TopicProgressionDecision {
  action: TopicProgressionAction;
  prerequisiteReadiness: PrerequisiteReadinessDecision;
  eligibleAssessmentTypes: LearningAssessmentType[];
  focusSkillCodes: string[];
  reasonCodes: string[];
}

export type MultipleChoiceOptionKey = 'A' | 'B' | 'C' | 'D';

export interface MultipleChoiceSpecification {
  type: 'multiple_choice';
  options: Record<MultipleChoiceOptionKey, string>;
  correctOption: MultipleChoiceOptionKey;
  distractorExplanations: Partial<Record<MultipleChoiceOptionKey, string>>;
  difficulty: 1 | 2 | 3 | 4 | 5;
  reasoningClassification: ReasoningClassification;
}

export type MultipleChoiceValidationCode =
  | 'MC_OPTIONS_MUST_BE_A_TO_D'
  | 'MC_OPTION_TEXT_REQUIRED'
  | 'MC_OPTIONS_MUST_BE_DISTINCT'
  | 'MC_CORRECT_OPTION_REQUIRED'
  | 'MC_DISTRACTOR_EXPLANATIONS_MUST_MATCH_INCORRECT_OPTIONS'
  | 'MC_DISTRACTOR_EXPLANATION_REQUIRED'
  | 'MC_DIFFICULTY_OUT_OF_RANGE';

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort();
}

function percentage(values: Array<{ correct: boolean }>) {
  return values.length
    ? (values.filter((item) => item.correct).length / values.length) * 100
    : null;
}

/** Unknown is intentionally different from a demonstrated prerequisite gap. */
export function evaluatePrerequisiteReadiness(
  prerequisites: PrerequisiteEvidence[],
): PrerequisiteReadinessDecision {
  const unknownSkillCodes = prerequisites
    .filter((item) => item.state === 'unknown')
    .map((item) => item.skillCode)
    .sort();
  const unmetSkillCodes = prerequisites
    .filter((item) => item.state === 'not_secure')
    .map((item) => item.skillCode)
    .sort();

  if (unmetSkillCodes.length) {
    return {
      status: 'targeted_remediation_recommended',
      unknownSkillCodes,
      unmetSkillCodes,
    };
  }

  if (unknownSkillCodes.length) {
    return {
      status: 'unknown_needs_diagnostic',
      unknownSkillCodes,
      unmetSkillCodes,
    };
  }

  return { status: 'ready', unknownSkillCodes, unmetSkillCodes };
}

export function evaluateTopicMastery(
  policy: TopicMasteryPolicyContract,
  evidence: TopicMasteryEvidence,
): TopicMasteryDecision {
  if (evidence.overallAchievement === null) {
    return {
      status: 'not_assessed',
      reasonCodes: ['NO_TOPIC_ACHIEVEMENT_EVIDENCE'],
      criticalSkillCoverage: null,
      reasoningAchievement: null,
    };
  }

  const critical = evidence.criticalSkills.filter((item) => item.isCritical);
  const minimumCriticalQuestions = policy.minimumQuestionsPerCriticalSkill ?? 1;
  const criticalAchievementThreshold = policy.criticalSkillAchievementThreshold ?? 75;
  const criticalUnknown = critical.filter((item) =>
    item.independentResponses !== undefined
      ? item.independentResponses < minimumCriticalQuestions
      : item.state === 'unknown',
  );
  const criticalNotSecure = critical.filter((item) => {
    if (item.independentResponses !== undefined) {
      return item.independentResponses >= minimumCriticalQuestions
        && ((item.correctResponses ?? 0) / item.independentResponses) * 100 < criticalAchievementThreshold;
    }
    return item.state === 'not_secure';
  });
  const criticalSkillCoverage = critical.length
    ? ((critical.length - criticalUnknown.length - criticalNotSecure.length) / critical.length) * 100
    : 100;
  const independentReasoning = evidence.mathematicalReasoningEvidence
    .filter((item) => item.independentlyCompleted);
  const reasoningAchievement = percentage(independentReasoning);
  const reasonCodes: string[] = [];

  if (criticalUnknown.length || independentReasoning.length < policy.minimumReasoningEvidenceCount) {
    if (criticalUnknown.length) reasonCodes.push('MISSING_CRITICAL_SKILL_EVIDENCE');
    if (independentReasoning.length < policy.minimumReasoningEvidenceCount) reasonCodes.push('MISSING_MATHEMATICAL_REASONING_EVIDENCE');
    return {
      status: 'evidence_incomplete',
      reasonCodes: uniqueSorted(reasonCodes),
      criticalSkillCoverage,
      reasoningAchievement,
    };
  }

  if (evidence.overallAchievement < policy.overallAchievementThreshold) reasonCodes.push('OVERALL_ACHIEVEMENT_BELOW_THRESHOLD');
  if (criticalSkillCoverage < policy.criticalSkillCoverageThreshold) reasonCodes.push('CRITICAL_SKILL_COVERAGE_BELOW_THRESHOLD');
  if (criticalNotSecure.length) reasonCodes.push('CRITICAL_SKILL_NOT_SECURE');
  if (reasoningAchievement === null || reasoningAchievement < policy.minimumReasoningAchievementThreshold) reasonCodes.push('MATHEMATICAL_REASONING_ACHIEVEMENT_BELOW_THRESHOLD');
  // A challenge accelerates a learner who has a strong baseline. A qualifying
  // endline is the normal independent route and must not be blocked by the
  // policy flag that enables the challenge route.
  const qualifyingPath = evidence.qualifyingAssessmentPath
    ?? (evidence.masteryChallengePassed === true ? 'mastery_challenge' : null);
  if (policy.requiresMasteryChallenge && qualifyingPath === null) {
    reasonCodes.push('MISSING_QUALIFYING_INDEPENDENT_ASSESSMENT');
  }

  return {
    status: reasonCodes.length ? 'not_yet_mastered' : 'mastered',
    reasonCodes: uniqueSorted(reasonCodes),
    criticalSkillCoverage,
    reasoningAchievement,
  };
}

/**
 * Progression is self-paced: an unknown prerequisite offers a diagnostic and
 * never becomes a failed prerequisite or a hard lock on unrelated topics.
 */
export function determineTopicProgression(
  policy: TopicMasteryPolicyContract,
  prerequisites: PrerequisiteEvidence[],
  baseline: BaselineResult | null,
  currentTopicEvidence: TopicMasteryEvidence | null,
): TopicProgressionDecision {
  const prerequisiteReadiness = evaluatePrerequisiteReadiness(prerequisites);

  // Completion is terminal for this topic. It deliberately takes precedence
  // over a stale baseline or later prerequisite snapshot so a mastered topic
  // is never offered another challenge.
  if (currentTopicEvidence) {
    const mastery = evaluateTopicMastery(policy, currentTopicEvidence);
    if (mastery.status === 'mastered') {
      return {
        action: 'advance_to_dependent_topic',
        prerequisiteReadiness,
        eligibleAssessmentTypes: [],
        focusSkillCodes: [],
        reasonCodes: ['TOPIC_MASTERY_DEMONSTRATED'],
      };
    }
  }

  if (prerequisiteReadiness.status === 'targeted_remediation_recommended') {
    return {
      action: 'targeted_remediation',
      prerequisiteReadiness,
      eligibleAssessmentTypes: ['topic_baseline'],
      focusSkillCodes: prerequisiteReadiness.unmetSkillCodes,
      reasonCodes: ['KNOWN_PREREQUISITE_GAP', 'TARGETED_REMEDIATION_AVAILABLE'],
    };
  }

  if (!baseline) {
    return {
      action: prerequisiteReadiness.status === 'unknown_needs_diagnostic'
        ? 'offer_optional_prerequisite_diagnostic'
        : 'offer_baseline',
      prerequisiteReadiness,
      eligibleAssessmentTypes: ['entry_baseline', 'topic_baseline'],
      focusSkillCodes: prerequisiteReadiness.unknownSkillCodes,
      reasonCodes: prerequisiteReadiness.status === 'unknown_needs_diagnostic'
        ? ['PREREQUISITE_EVIDENCE_UNKNOWN', 'DIAGNOSTIC_OFFERED_NOT_REQUIRED']
        : ['TOPIC_BASELINE_AVAILABLE'],
    };
  }

  const baselineDecision = evaluateTopicMastery(
    { ...policy, requiresMasteryChallenge: false },
    {
      overallAchievement: baseline.overallAchievement,
      criticalSkills: baseline.criticalSkills,
      mathematicalReasoningEvidence: baseline.mathematicalReasoningEvidence,
      masteryChallengePassed: null,
    },
  );
  const baselineStrong = baseline.overallAchievement >= policy.strongBaselineThreshold
    && baselineDecision.status === 'mastered';

  // Unknown is not a demonstrated gap, so it cannot withhold a challenge
  // from a learner who has already shown a strong topic baseline.
  if (baselineStrong) {
    return {
      action: 'offer_mastery_challenge',
      prerequisiteReadiness,
      eligibleAssessmentTypes: ['mastery_challenge', 'endline'],
      focusSkillCodes: [],
      reasonCodes: uniqueSorted([
        'STRONG_TOPIC_BASELINE',
        'MASTERY_CHALLENGE_ELIGIBLE',
        ...(prerequisiteReadiness.status === 'unknown_needs_diagnostic' ? ['PREREQUISITE_EVIDENCE_UNKNOWN'] : []),
      ]),
    };
  }

  return {
    action: 'offer_endline',
    prerequisiteReadiness,
    eligibleAssessmentTypes: ['endline'],
    focusSkillCodes: baseline.criticalSkills
      .filter((item) => item.state === 'not_secure')
      .map((item) => item.skillCode)
      .sort(),
    reasonCodes: ['BASELINE_NOT_YET_STRONG', 'STUDY_AND_TARGETED_REMEDIATION_AVAILABLE'],
  };
}

export function validateMultipleChoiceSpecification(
  specification: MultipleChoiceSpecification,
): MultipleChoiceValidationCode[] {
  const optionKeys = Object.keys(specification.options).sort();
  const expectedKeys: MultipleChoiceOptionKey[] = ['A', 'B', 'C', 'D'];
  const errors: MultipleChoiceValidationCode[] = [];

  if (optionKeys.join(',') !== expectedKeys.join(',')) errors.push('MC_OPTIONS_MUST_BE_A_TO_D');
  const optionValues = expectedKeys.map((key) => specification.options[key]?.trim() || '');
  if (optionValues.some((value) => !value)) errors.push('MC_OPTION_TEXT_REQUIRED');
  if (new Set(optionValues).size !== optionValues.length) errors.push('MC_OPTIONS_MUST_BE_DISTINCT');
  if (!expectedKeys.includes(specification.correctOption)) errors.push('MC_CORRECT_OPTION_REQUIRED');
  if (!Number.isInteger(specification.difficulty) || specification.difficulty < 1 || specification.difficulty > 5) {
    errors.push('MC_DIFFICULTY_OUT_OF_RANGE');
  }

  const expectedDistractorKeys = expectedKeys.filter((key) => key !== specification.correctOption).sort();
  const suppliedDistractorKeys = Object.keys(specification.distractorExplanations).sort();
  if (suppliedDistractorKeys.join(',') !== expectedDistractorKeys.join(',')) {
    errors.push('MC_DISTRACTOR_EXPLANATIONS_MUST_MATCH_INCORRECT_OPTIONS');
  }
  if (expectedDistractorKeys.some((key) => !specification.distractorExplanations[key]?.trim())) {
    errors.push('MC_DISTRACTOR_EXPLANATION_REQUIRED');
  }

  return uniqueSorted(errors) as MultipleChoiceValidationCode[];
}
