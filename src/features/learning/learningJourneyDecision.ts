/**
 * Presentation-safe precedence for the Sprint 3 journey contract. Database
 * functions remain authoritative for formal-assessment eligibility; this
 * function only chooses between server-approved possibilities.
 */
export type JourneyCandidate = {
  kind: 'mastered' | 'unfinished_assessment' | 'unfinished_activity' | 'retention' | 'baseline' | 'mastery_challenge' | 'prerequisite_support' | 'misconception_support' | 'practice' | 'endline' | 'next_topic' | 'unavailable';
  route: string;
  title: string;
  description: string;
  topicCode?: string | null;
  reasonCodes?: string[];
};

const order: JourneyCandidate['kind'][] = [
  'mastered', 'unfinished_assessment', 'unfinished_activity', 'retention', 'baseline',
  'mastery_challenge', 'prerequisite_support', 'misconception_support', 'practice',
  'endline', 'next_topic', 'unavailable',
];

/** A mastered topic candidate is ignored: it is state, never an action. */
export function selectLearningJourneyAction(candidates: JourneyCandidate[]): JourneyCandidate {
  const actionable = candidates.filter((candidate) => candidate.kind !== 'mastered');
  return [...actionable].sort((left, right) => {
    const precedence = order.indexOf(left.kind) - order.indexOf(right.kind);
    if (precedence) return precedence;
    return `${left.topicCode ?? ''}:${left.route}:${left.title}`.localeCompare(`${right.topicCode ?? ''}:${right.route}:${right.title}`);
  })[0] ?? {
    kind: 'unavailable', route: '/dashboard/student/learning', title: 'Choose a Grade 9 topic',
    description: 'Reviewed learning content will appear here when it is available.', reasonCodes: ['NO_APPROVED_CONTENT'],
  };
}
