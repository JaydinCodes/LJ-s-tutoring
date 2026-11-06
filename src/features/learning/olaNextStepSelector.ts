import type { MasteryState } from './learningDecisionEngine';

export type OlaContentKind = 'activity' | 'diagnostic' | 'worked_example' | 'challenge' | 'retention';

export type OlaAvailableContent = {
  code: string;
  kind: OlaContentKind;
  skillCode: string;
  topicCode: string;
  approved: boolean;
  allQuestionsApproved?: boolean;
  tutorApprovalRequired?: boolean;
};

export type OlaUnfinishedActivity = {
  activityCode: string;
  topicCode: string;
  skillCode: string;
};

export type OlaPrerequisite = { code: string; state: MasteryState };

export type OlaNextStepInput = {
  subject: string;
  grade: string;
  topicCode: string;
  skillCode?: string;
  targetMastery: MasteryState;
  targetEvidenceCount: number;
  prerequisites: OlaPrerequisite[];
  repeatedMisconception: boolean;
  unfinished: OlaUnfinishedActivity[];
  dueRetention?: { activityCode: string; topicCode: string; skillCode: string } | null;
  content: OlaAvailableContent[];
};

export type OlaNextStep = {
  outcome: 'resume' | 'diagnostic' | 'prerequisite' | 'misconception' | 'practice' | 'challenge' | 'retention' | 'fallback';
  activityCode?: string;
  focusSkillCode?: string;
  reasonCodes: string[];
  learnerReason: string;
};

function eligible(content: OlaAvailableContent[], kind: OlaContentKind, topicCode: string, skillCode?: string) {
  return content
    .filter((item) => item.approved && item.allQuestionsApproved !== false && !item.tutorApprovalRequired)
    .filter((item) => item.kind === kind && item.topicCode === topicCode && (!skillCode || item.skillCode === skillCode))
    .sort((left, right) => left.code.localeCompare(right.code));
}

function firstActivity(content: OlaAvailableContent[], topicCode: string, skillCode?: string) {
  return eligible(content, 'activity', topicCode, skillCode)[0];
}

/**
 * OLA v1's browser-safe selector. It decides only among staff-approved
 * content supplied by the repository/RPC; it neither calculates mastery nor
 * accepts tutor-only recommendations. Ties are always resolved by code.
 */
export function selectOlaNextStep(input: OlaNextStepInput): OlaNextStep {
  const target = input.skillCode;
  const sameTopicUnfinished = input.unfinished
    .filter((item) => item.topicCode === input.topicCode && (!target || item.skillCode === target))
    .sort((left, right) => left.activityCode.localeCompare(right.activityCode))[0];
  if (sameTopicUnfinished) {
    return { outcome: 'resume', activityCode: sameTopicUnfinished.activityCode, focusSkillCode: sameTopicUnfinished.skillCode, reasonCodes: ['CHOSEN_TOPIC', 'UNFINISHED_ACTIVITY'], learnerReason: 'Continue the practice you already started in this topic.' };
  }

  if (input.dueRetention && input.dueRetention.topicCode === input.topicCode && (!target || input.dueRetention.skillCode === target)) {
    return { outcome: 'retention', activityCode: input.dueRetention.activityCode, focusSkillCode: input.dueRetention.skillCode, reasonCodes: ['CHOSEN_TOPIC', 'DELAYED_RETRIEVAL_DUE'], learnerReason: 'Do a short retrieval check to keep this skill fresh.' };
  }

  if (input.targetEvidenceCount === 0 || input.targetMastery === 'unassessed') {
    const diagnostic = eligible(input.content, 'diagnostic', input.topicCode, target)[0];
    if (diagnostic) return { outcome: 'diagnostic', activityCode: diagnostic.code, focusSkillCode: target, reasonCodes: ['CHOSEN_TOPIC', 'INSUFFICIENT_EVIDENCE', 'OPTIONAL_DIAGNOSTIC'], learnerReason: 'Start with an optional short check, or explore the explanation first.' };
  }

  const evidencedGap = input.prerequisites.find((item) => item.state === 'emerging' || item.state === 'developing');
  if (evidencedGap) {
    const remediation = firstActivity(input.content, input.topicCode, evidencedGap.code);
    if (remediation) return { outcome: 'prerequisite', activityCode: remediation.code, focusSkillCode: evidencedGap.code, reasonCodes: ['CHOSEN_TOPIC', 'EVIDENCED_PREREQUISITE_GAP'], learnerReason: 'Strengthen one earlier skill that supports this topic.' };
  }

  if (input.repeatedMisconception) {
    const misconceptionActivity = firstActivity(input.content, input.topicCode, target);
    if (misconceptionActivity) return { outcome: 'misconception', activityCode: misconceptionActivity.code, focusSkillCode: target, reasonCodes: ['CHOSEN_TOPIC', 'REPEATED_MISCONCEPTION', 'WORKED_EXAMPLE_AND_GUIDED_PRACTICE'], learnerReason: 'Compare two similar patterns, then practise with guidance.' };
  }

  if (input.targetMastery === 'secure' || input.targetMastery === 'retained') {
    const challenge = eligible(input.content, 'challenge', input.topicCode, target)[0] || eligible(input.content, 'retention', input.topicCode, target)[0];
    if (challenge) return { outcome: challenge.kind === 'retention' ? 'retention' : 'challenge', activityCode: challenge.code, focusSkillCode: target, reasonCodes: ['CHOSEN_TOPIC', challenge.kind === 'retention' ? 'APPROPRIATE_LATER_RETRIEVAL' : 'SECURE_SKILL_CHALLENGE'], learnerReason: challenge.kind === 'retention' ? 'Keep this skill fresh with a short later check.' : 'Try an independent challenge when you are ready.' };
  }

  const practice = firstActivity(input.content, input.topicCode, target);
  if (practice) return { outcome: 'practice', activityCode: practice.code, focusSkillCode: target, reasonCodes: ['CHOSEN_TOPIC', 'TARGETED_PRACTICE'], learnerReason: 'Practise this skill in a short, focused activity.' };

  return { outcome: 'fallback', focusSkillCode: target, reasonCodes: ['CHOSEN_TOPIC', 'NO_APPROVED_CONTENT'], learnerReason: 'There is no reviewed activity for this selection yet. You can return to the catalogue or ask your tutor for help.' };
}
