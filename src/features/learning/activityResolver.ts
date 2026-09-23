export type RecommendationActivityInput = {
  recommendationType: string;
  reasonCodes: string[];
  focusSkillCode?: string;
  targetSkillCode: string;
};

export type ApprovedActivity = {
  code: string;
  targetSkillCode: string;
  approved: boolean;
  allQuestionsApproved: boolean;
  stageTypes: string[];
};

/** Pure selection: recommendation decides need; this resolver decides delivery. */
export function resolveActivityForRecommendation(
  recommendation: RecommendationActivityInput,
  activities: ApprovedActivity[],
): ApprovedActivity | null {
  const target = recommendation.focusSkillCode || recommendation.targetSkillCode;
  const requiredStages = recommendation.reasonCodes.includes('REPEATED_MISCONCEPTION')
    ? ['error_analysis', 'guided_practice']
    : recommendation.reasonCodes.includes('HINT_DEPENDENCY')
      ? ['faded_example', 'independent_practice']
      : recommendation.recommendationType === 'retrieval_practice'
        ? ['retrieval_warm_up']
        : recommendation.recommendationType === 'prerequisite_remediation'
          ? ['prerequisite_check', 'guided_practice']
          : ['guided_practice'];
  return activities
    .filter((activity) => activity.approved && activity.allQuestionsApproved && activity.targetSkillCode === target)
    .filter((activity) => requiredStages.every((stage) => activity.stageTypes.includes(stage)))
    .sort((left, right) => left.code.localeCompare(right.code))[0] || null;
}
