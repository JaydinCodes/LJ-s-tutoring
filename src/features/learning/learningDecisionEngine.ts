export type MasteryState = 'unassessed' | 'emerging' | 'developing' | 'secure' | 'retained';
export type CognitiveLevel = 'knowledge' | 'routine' | 'complex' | 'problem_solving';
export type MisconceptionState = 'suspected' | 'confirmed' | 'resolved';
export type InterventionType =
  | 'worked_example'
  | 'faded_example'
  | 'contrasting_examples'
  | 'guided_practice'
  | 'error_analysis'
  | 'prerequisite_remediation'
  | 'interleaved_practice'
  | 'retrieval_practice'
  | 'representation_translation';

export interface SkillEvidence {
  id: string;
  occurredAt: string;
  /** A stable session id is preferred; the date is used as an occasion fallback. */
  occasionId?: string | null;
  independent: boolean;
  isTargetSkill: boolean;
  cognitiveLevel: CognitiveLevel;
  correct: boolean;
}

export interface LearnerMisconceptionSignal {
  code: string;
  state: MisconceptionState;
  critical?: boolean;
  /** Number of linked attempts represented by this signal/history entry. */
  evidenceCount?: number;
  /** Contextual diagnostic information; it never changes mastery directly. */
  highConfidenceErrorCount?: number;
}

export interface MisconceptionAttemptSignal {
  id: string;
  occurredAt: string;
  independent: boolean;
  correct: boolean;
  confidence?: 1 | 2 | 3 | 4 | null;
  /** True only for an explicitly scheduled delayed-retrieval opportunity. */
  delayedRetrieval?: boolean;
}

export interface MisconceptionRuleConfiguration {
  suspected: { minimumIndependentIncorrectAttempts: number };
  confirmed: {
    minimumIndependentIncorrectAttempts: number;
    minimumHighConfidenceIncorrectAttempts: number;
  };
  resolved: {
    minimumIndependentCorrectAttemptsAfterLastError: number;
    requiresDelayedIndependentSuccess: boolean;
  };
}

export interface MisconceptionEvaluation {
  state: MisconceptionState | null;
  reason: string;
  reasonCodes: string[];
  supportingEvidenceIds: string[];
  independentIncorrectAttemptCount: number;
  highConfidenceIncorrectAttemptCount: number;
  independentCorrectAfterLastErrorCount: number;
}

export interface MasteryRuleConfiguration {
  emerging: { minimumIndependentAttempts: number; maximumIndependentAccuracy: number };
  developing: { minimumIndependentAttempts: number; minimumIndependentAccuracy: number };
  secure: {
    minimumIndependentAttempts: number;
    minimumIndependentAccuracy: number;
    minimumDistinctOccasions: number;
    requiresTargetLevelEvidence: boolean;
    blocksOnUnresolvedCriticalMisconception: boolean;
  };
  retained: {
    requiresPriorSecure: boolean;
    minimumDelayedDays: number;
    minimumIndependentAccuracy: number;
  };
}

export interface MasteryEvaluation {
  state: MasteryState;
  reason: string;
  reasonCodes: string[];
  supportingEvidenceIds: string[];
  independentAttemptCount: number;
  independentAccuracy: number | null;
  distinctOccasions: number;
}

export interface RecommendationInput {
  mastery: MasteryEvaluation;
  evidence: SkillEvidence[];
  prerequisites: Array<{ code: string; state: MasteryState }>;
  misconceptions: LearnerMisconceptionSignal[];
  complexAccuracyThreshold: number;
  hintDependencyThreshold: number;
  failedDelayedRetrieval?: boolean;
  /** Whether a delayed-retrieval item has already been scheduled or completed. */
  delayedRetrievalAvailable?: boolean;
}

export interface RecommendationDecision {
  recommendationType: InterventionType;
  sequence: InterventionType[];
  reason: string;
  reasonCodes: string[];
  /** Present when remediation should begin below the requested target skill. */
  focusSkillCode?: string;
}

export interface DiagnosticSkillSnapshot {
  code: string;
  state: MasteryState;
}

export interface DiagnosticEvaluationInput {
  target: DiagnosticSkillSnapshot;
  /** Ordered nearest-first by the diagnostic route or prerequisite graph query. */
  prerequisites: DiagnosticSkillSnapshot[];
  misconceptions?: LearnerMisconceptionSignal[];
}

export interface DiagnosticEvaluation {
  outcome: 'prerequisite_gap' | 'target_skill_gap' | 'ready_for_independent_check';
  focusSkillCode: string;
  strongPrerequisiteCodes: string[];
  reasonCodes: string[];
  recommendationType: InterventionType;
}

function accuracy(evidence: SkillEvidence[]) {
  return evidence.length ? evidence.filter((item) => item.correct).length / evidence.length : null;
}

function dateKey(value: string) {
  return value.slice(0, 10);
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort();
}

function percentage(value: number | null) {
  return value === null ? 'no' : `${Math.round(value * 100)}%`;
}

/**
 * Pure, deterministic pilot evaluation. It does not use confidence or time on
 * task as mastery inputs. Callers persist the result together with the rule-set
 * version and cited evidence ids; they never overwrite a prior evaluation.
 */
export function evaluateSkillMastery(
  evidence: SkillEvidence[],
  ruleSet: MasteryRuleConfiguration,
  options: {
    misconceptions?: LearnerMisconceptionSignal[];
    priorSecureAt?: string | null;
    evaluatedAt?: string;
  } = {},
): MasteryEvaluation {
  const independent = evidence.filter((item) => item.independent);
  const targetIndependent = independent.filter((item) => item.isTargetSkill);
  const independentAccuracy = accuracy(independent);
  const occasions = new Set(independent.map((item) => item.occasionId || dateKey(item.occurredAt)));
  const unresolvedCritical = (options.misconceptions || []).filter(
    (item) => item.critical && item.state !== 'resolved',
  );
  const supportingEvidenceIds = independent.map((item) => item.id).sort();
  const base = {
    supportingEvidenceIds,
    independentAttemptCount: independent.length,
    independentAccuracy,
    distinctOccasions: occasions.size,
  };

  if (!independent.length) {
    return { ...base, state: 'unassessed', reason: 'No independent evidence has been recorded.', reasonCodes: ['NO_INDEPENDENT_EVIDENCE'] };
  }

  const now = new Date(options.evaluatedAt || new Date().toISOString());
  const priorSecure = options.priorSecureAt ? new Date(options.priorSecureAt) : null;
  const delayedEvidence = priorSecure
    ? independent.filter((item) => (new Date(item.occurredAt).getTime() - priorSecure.getTime()) >= ruleSet.retained.minimumDelayedDays * 86_400_000)
    : [];
  const delayedAccuracy = accuracy(delayedEvidence);
  if (
    ruleSet.retained.requiresPriorSecure
    && priorSecure
    && now >= priorSecure
    && delayedEvidence.length > 0
    && delayedAccuracy !== null
    && delayedAccuracy >= ruleSet.retained.minimumIndependentAccuracy
  ) {
    return { ...base, state: 'retained', reason: `${independent.filter((item) => item.correct).length} of ${independent.length} independent attempts were correct (${percentage(independentAccuracy)}), including success after the configured retrieval interval.`, reasonCodes: ['PRIOR_SECURE', 'DELAYED_INDEPENDENT_SUCCESS'] };
  }

  const hasSecureAccuracy = independentAccuracy !== null && independentAccuracy >= ruleSet.secure.minimumIndependentAccuracy;
  const enoughTargetEvidence = !ruleSet.secure.requiresTargetLevelEvidence || targetIndependent.length > 0;
  const blockedByMisconception = ruleSet.secure.blocksOnUnresolvedCriticalMisconception && unresolvedCritical.length > 0;
  if (
    independent.length >= ruleSet.secure.minimumIndependentAttempts
    && hasSecureAccuracy
    && occasions.size >= ruleSet.secure.minimumDistinctOccasions
    && enoughTargetEvidence
    && !blockedByMisconception
  ) {
    return { ...base, state: 'secure', reason: `${independent.filter((item) => item.correct).length} of ${independent.length} independent attempts were correct (${percentage(independentAccuracy)}) across ${occasions.size} occasions, including target-skill evidence.`, reasonCodes: ['SUFFICIENT_INDEPENDENT_ACCURACY', 'MULTIPLE_OCCASIONS', 'TARGET_LEVEL_EVIDENCE'] };
  }

  if (
    independent.length >= ruleSet.developing.minimumIndependentAttempts
    && independentAccuracy !== null
    && independentAccuracy >= ruleSet.developing.minimumIndependentAccuracy
  ) {
    return {
      ...base,
      state: 'developing',
      reason: blockedByMisconception
        ? `${independent.filter((item) => item.correct).length} of ${independent.length} independent attempts were correct (${percentage(independentAccuracy)}), but an unresolved critical misconception blocks secure mastery.`
        : `${independent.filter((item) => item.correct).length} of ${independent.length} independent attempts were correct (${percentage(independentAccuracy)}); this is meaningful evidence but does not yet meet the pilot secure criteria.`,
      reasonCodes: uniqueSorted([
        'MEANINGFUL_INDEPENDENT_SUCCESS',
        ...(blockedByMisconception ? ['UNRESOLVED_CRITICAL_MISCONCEPTION'] : []),
        ...(occasions.size < ruleSet.secure.minimumDistinctOccasions ? ['INSUFFICIENT_OCCASIONS'] : []),
        ...(hasSecureAccuracy ? [] : ['INSUFFICIENT_SECURE_ACCURACY']),
      ]),
    };
  }

  return {
    ...base,
    state: 'emerging',
    reason: `${independent.filter((item) => item.correct).length} of ${independent.length} independent attempts were correct (${percentage(independentAccuracy)}), below the pilot developing threshold of ${Math.round(ruleSet.developing.minimumIndependentAccuracy * 100)}%.`,
    reasonCodes: ['WEAK_OR_INCONSISTENT_INDEPENDENT_EVIDENCE'],
  };
}

/**
 * Deterministic priority order for the initial intervention rules. The output
 * is an explanation, not a prediction; it must be stored with the rule-set id.
 */
export function generateRecommendations(input: RecommendationInput): RecommendationDecision | null {
  const confirmedOrSuspected = input.misconceptions.filter((item) => item.state !== 'resolved');
  const hasRepeatedMisconception = confirmedOrSuspected.length >= 2 || confirmedOrSuspected.some((item) => (item.evidenceCount || 1) >= 2);
  const prerequisitesSecure = input.prerequisites.length > 0 && input.prerequisites.every((item) => item.state === 'secure' || item.state === 'retained');
  const firstWeakPrerequisite = input.prerequisites.find((item) => !['secure', 'retained'].includes(item.state));
  const complexIndependent = input.evidence.filter((item) => item.independent && (item.cognitiveLevel === 'complex' || item.cognitiveLevel === 'problem_solving'));
  const complexAccuracy = accuracy(complexIndependent);
  const assisted = input.evidence.filter((item) => !item.independent);
  const assistanceRate = input.evidence.length ? assisted.length / input.evidence.length : 0;

  if (
    (input.mastery.state === 'unassessed' || input.mastery.state === 'emerging' || input.mastery.state === 'developing')
    && firstWeakPrerequisite
  ) {
    return {
      recommendationType: 'prerequisite_remediation',
      sequence: ['prerequisite_remediation', 'guided_practice', 'retrieval_practice'],
      focusSkillCode: firstWeakPrerequisite.code,
      reason: 'A required prerequisite is not secure, so remediation starts there before returning to the target skill.',
      reasonCodes: uniqueSorted(['PREREQUISITE_NOT_SECURE', 'TARGET_SKILL_NOT_SECURE', ...input.mastery.reasonCodes]),
    };
  }

  if (hasRepeatedMisconception) {
    return {
      recommendationType: 'contrasting_examples',
      sequence: ['contrasting_examples', 'faded_example', 'error_analysis', 'retrieval_practice'],
      reason: 'Repeated misconception evidence should be addressed explicitly before more independent practice.',
      reasonCodes: uniqueSorted(['REPEATED_MISCONCEPTION', ...(prerequisitesSecure ? ['PREREQUISITES_SECURE'] : [])]),
    };
  }

  if (input.failedDelayedRetrieval) {
    return {
      recommendationType: 'retrieval_practice',
      sequence: ['retrieval_practice', 'guided_practice', 'retrieval_practice'],
      reason: 'A formerly secure skill needs delayed retrieval support.',
      reasonCodes: ['FAILED_DELAYED_RETRIEVAL'],
    };
  }

  if (complexAccuracy !== null && complexAccuracy < input.complexAccuracyThreshold) {
    return {
      recommendationType: 'faded_example',
      sequence: ['worked_example', 'faded_example', 'guided_practice', 'retrieval_practice'],
      reason: 'Routine evidence is not yet transferring reliably to complex tasks.',
      reasonCodes: uniqueSorted(['LOW_COMPLEX_ACCURACY', ...(prerequisitesSecure ? ['PREREQUISITES_SECURE'] : [])]),
    };
  }

  if (
    (input.mastery.state === 'secure' || input.mastery.state === 'retained')
    && input.delayedRetrievalAvailable === false
  ) {
    return {
      recommendationType: 'retrieval_practice',
      sequence: ['retrieval_practice'],
      reason: 'Secure performance has not yet been checked after a delayed retrieval interval.',
      reasonCodes: ['DELAYED_RETRIEVAL_DUE', 'PRIOR_SECURE'],
    };
  }

  if (assistanceRate >= input.hintDependencyThreshold && input.evidence.length > 0) {
    return {
      recommendationType: 'faded_example',
      sequence: ['faded_example', 'guided_practice', 'retrieval_practice'],
      reason: 'Success is frequently assisted; fade support before the next independent check.',
      reasonCodes: ['HINT_DEPENDENCY'],
    };
  }

  if (input.mastery.state === 'unassessed' || input.mastery.state === 'emerging' || input.mastery.state === 'developing') {
    return {
      recommendationType: 'guided_practice',
      sequence: ['guided_practice', 'faded_example', 'retrieval_practice'],
      reason: 'More independent, target-skill evidence is required by the active pilot rule set.',
      reasonCodes: input.mastery.reasonCodes,
    };
  }

  return null;
}

/**
 * Deterministically evaluates evidence for one known misconception code. It
 * creates no permanent learner label: a resolved result is possible only after
 * new independent corrective evidence, and high confidence strengthens the
 * diagnostic signal rather than changing mastery.
 */
export function evaluateMisconceptionEvidence(
  evidence: MisconceptionAttemptSignal[],
  ruleSet: MisconceptionRuleConfiguration,
  options: { priorState?: MisconceptionState | null } = {},
): MisconceptionEvaluation {
  const independentIncorrect = evidence.filter((item) => item.independent && !item.correct);
  const highConfidenceIncorrect = independentIncorrect.filter((item) => item.confidence === 4);
  const lastIncorrectAt = independentIncorrect.length
    ? Math.max(...independentIncorrect.map((item) => new Date(item.occurredAt).getTime()))
    : null;
  const independentCorrectAfterLastError = evidence.filter(
    (item) => item.independent
      && item.correct
      && (lastIncorrectAt === null || new Date(item.occurredAt).getTime() > lastIncorrectAt),
  );
  const delayedSuccess = independentCorrectAfterLastError.some((item) => item.delayedRetrieval);
  const base = {
    supportingEvidenceIds: evidence.map((item) => item.id).sort(),
    independentIncorrectAttemptCount: independentIncorrect.length,
    highConfidenceIncorrectAttemptCount: highConfidenceIncorrect.length,
    independentCorrectAfterLastErrorCount: independentCorrectAfterLastError.length,
  };

  if (
    options.priorState
    && options.priorState !== 'resolved'
    && independentCorrectAfterLastError.length >= ruleSet.resolved.minimumIndependentCorrectAttemptsAfterLastError
    && (!ruleSet.resolved.requiresDelayedIndependentSuccess || delayedSuccess)
  ) {
    return {
      ...base,
      state: 'resolved',
      reason: `${independentCorrectAfterLastError.length} independent corrective attempts followed the last error${delayedSuccess ? ', including delayed retrieval success' : ''}.`,
      reasonCodes: uniqueSorted(['CORRECTIVE_INDEPENDENT_EVIDENCE', ...(delayedSuccess ? ['DELAYED_CORRECTIVE_SUCCESS'] : [])]),
    };
  }

  if (
    independentIncorrect.length >= ruleSet.confirmed.minimumIndependentIncorrectAttempts
    || highConfidenceIncorrect.length >= ruleSet.confirmed.minimumHighConfidenceIncorrectAttempts
  ) {
    return {
      ...base,
      state: 'confirmed',
      reason: `${independentIncorrect.length} independent incorrect attempts support this pattern, including ${highConfidenceIncorrect.length} high-confidence errors.`,
      reasonCodes: uniqueSorted(['REPEATED_INDEPENDENT_ERROR', ...(highConfidenceIncorrect.length ? ['HIGH_CONFIDENCE_ERROR_PATTERN'] : [])]),
    };
  }

  if (independentIncorrect.length >= ruleSet.suspected.minimumIndependentIncorrectAttempts) {
    return {
      ...base,
      state: 'suspected',
      reason: `${independentIncorrect.length} independent incorrect attempts suggest a pattern, but do not yet confirm it.`,
      reasonCodes: ['REPEATED_INDEPENDENT_ERROR'],
    };
  }

  return {
    ...base,
    state: null,
    reason: 'There is insufficient repeated independent error evidence to assign a misconception state.',
    reasonCodes: ['INSUFFICIENT_MISCONCEPTION_EVIDENCE'],
  };
}

/**
 * Classifies a diagnostic route without calculating an aggregate learner
 * ability score. The caller supplies prerequisite snapshots in deliberate
 * instructional order, normally nearest prerequisite first.
 */
export function evaluateDiagnosticEvidence(input: DiagnosticEvaluationInput): DiagnosticEvaluation {
  const strongPrerequisiteCodes = input.prerequisites
    .filter((item) => item.state === 'secure' || item.state === 'retained')
    .map((item) => item.code);
  const firstWeakPrerequisite = input.prerequisites.find(
    (item) => item.state === 'unassessed' || item.state === 'emerging' || item.state === 'developing',
  );

  if (firstWeakPrerequisite) {
    return {
      outcome: 'prerequisite_gap',
      focusSkillCode: firstWeakPrerequisite.code,
      strongPrerequisiteCodes,
      recommendationType: 'prerequisite_remediation',
      reasonCodes: ['PREREQUISITE_NOT_SECURE', 'TARGET_SKILL_NOT_SECURE'],
    };
  }

  if (input.target.state === 'unassessed' || input.target.state === 'emerging' || input.target.state === 'developing') {
    const hasOpenMisconception = (input.misconceptions || []).some((item) => item.state !== 'resolved');
    return {
      outcome: 'target_skill_gap',
      focusSkillCode: input.target.code,
      strongPrerequisiteCodes,
      recommendationType: hasOpenMisconception ? 'contrasting_examples' : 'guided_practice',
      reasonCodes: uniqueSorted([
        'PREREQUISITES_SECURE',
        'TARGET_SKILL_NOT_SECURE',
        ...(hasOpenMisconception ? ['REPEATED_MISCONCEPTION'] : []),
      ]),
    };
  }

  return {
    outcome: 'ready_for_independent_check',
    focusSkillCode: input.target.code,
    strongPrerequisiteCodes,
    recommendationType: 'retrieval_practice',
    reasonCodes: ['PREREQUISITES_SECURE', 'TARGET_READY_FOR_INDEPENDENT_CHECK'],
  };
}
