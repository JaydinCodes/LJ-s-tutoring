/**
 * Learner-facing language is deliberately separate from the CAPS-aligned
 * skill title and outcome stored by the curriculum model. The academic
 * identifiers remain the source of truth for assessment and evidence.
 */
export type WorkedExample = {
  title: string;
  subtitle: string;
  prompt: string;
  setup?: string;
  steps: Array<{ title: string; body: string }>;
  answer: string;
  keyIdea?: string;
};

export type ConceptStep = {
  title: string;
  body: string;
  example: string;
  depth: number;
};

export type LessonPresentation = {
  learnerTitle?: string;
  learnerSummary?: string;
  hook?: { title: string; body: string };
  idea?: { title: string; body: string };
  conceptSteps?: ConceptStep[];
  numberHierarchy?: Array<{ label: string; detail?: string; depth: number }>;
  examples?: WorkedExample[];
};

type TopicPresentation = {
  description: string;
  skills: Record<string, { title: string; description: string }>;
};

const wholeNumbers: TopicPresentation = {
  description: 'Explore different kinds of numbers, then use them to solve everyday problems with factors, proportions, ratios and money.',
  skills: {
    'G9-NUM-REAL-IRRATIONAL': {
      title: 'Know your numbers',
      description: 'Learn where natural, whole, integer, rational and irrational numbers belong.',
    },
    'G9-NUM-WHOLE-HCF-LCM': {
      title: 'Break numbers apart',
      description: 'Use prime factors to find an HCF or LCM without guessing.',
    },
    'G9-NUM-DIRECT-INVERSE-PROPORTION': {
      title: 'When one thing changes another',
      description: 'Work out whether quantities change together or in opposite directions.',
    },
    'G9-NUM-RATIO-RATE': {
      title: 'Compare things properly',
      description: 'Use ratios and rates to compare amounts fairly.',
    },
    'G9-NUM-FINANCIAL-APPLICATIONS': {
      title: 'Money maths',
      description: 'Use percentages and growth to make sense of commission, rentals and interest.',
    },
  },
};

const topicPresentations: Record<string, TopicPresentation> = {
  'WHOLE-NUMBERS': wholeNumbers,
};

const lessonPresentations: Record<string, LessonPresentation> = {
  'G9-NUM-REAL-IRRATIONAL': {
    learnerTitle: 'Know your numbers',
    learnerSummary: 'Learn where different numbers belong.',
    hook: {
      title: 'Numbers are weirder than they look',
      body: 'Your age might be 14. A temperature could be −3 °C. Your phone battery might be at 62.5%. They are all numbers, but they are not the same kind of number. Let’s sort them out.',
    },
    idea: {
      title: 'The idea',
      body: 'Number sets are not random labels to memorise. Each new set exists because the earlier set cannot describe a situation you might actually meet. Start with counting. Add zero when you have none. Add negatives when you owe money or the temperature drops below zero. Add fractions when you share something. Finally, some numbers cannot be written as one exact fraction at all. Those are irrational.',
    },
    conceptSteps: [
      {
        title: 'Start by counting',
        body: 'Natural numbers are the counting numbers: 1, 2, 3, and so on. They work when you can count whole things.',
        example: 'You have 3 PlayStation games. The number 3 is natural.',
        depth: 4,
      },
      {
        title: 'What if there are none?',
        body: 'Zero is useful, but it is not normally included in natural numbers. Add zero and you get whole numbers.',
        example: 'You have no games yet. That is 0, a whole number.',
        depth: 3,
      },
      {
        title: 'What if you are below zero?',
        body: 'A bank balance can be negative and so can a temperature. Add negative whole numbers and you get integers.',
        example: 'Your balance is −R50. That is an integer.',
        depth: 2,
      },
      {
        title: 'What if you share something?',
        body: 'Half a pizza is not an integer, but it is still a real amount. Fractions, terminating decimals and recurring decimals can all be written as a fraction of two integers. They are rational numbers.',
        example: 'One half equals 1/2, so it is rational.',
        depth: 1,
      },
      {
        title: 'Some numbers do not fit that fraction rule',
        body: 'Pi and the square root of 2 continue forever without repeating, and they cannot be written as one simple fraction. They are irrational, but they are still real numbers.',
        example: 'Irrational does not mean imaginary or wrong. It is just another kind of real number.',
        depth: 1,
      },
    ],
    numberHierarchy: [
      { label: 'Real numbers', detail: 'every number on a number line', depth: 0 },
      { label: 'Rational numbers', detail: 'can be written as a fraction', depth: 1 },
      { label: 'Integers', detail: '…, −2, −1, 0, 1, 2, …', depth: 2 },
      { label: 'Whole numbers', detail: '0, 1, 2, 3, …', depth: 3 },
      { label: 'Natural numbers', detail: '1, 2, 3, …', depth: 4 },
      { label: 'Fractions and terminating or recurring decimals', depth: 2 },
      { label: 'Irrational numbers', detail: 'pi and the square root of 2', depth: 1 },
    ],
    examples: [
      {
        title: 'Example 1',
        subtitle: 'Start simple',
        prompt: 'Classify the square root of 81',
        setup: 'Before calculating, ask yourself: is 81 a perfect square?',
        steps: [
          { title: 'Find the square root', body: 'The square root of 81 is 9\nbecause 9 × 9 = 81.' },
          { title: 'Classify 9', body: '9 is natural, whole and an integer. That means it is rational and real.' },
        ],
        answer: 'The square root of 81 is rational.',
        keyIdea: 'A square root is not automatically irrational.',
      },
      {
        title: 'Example 2',
        subtitle: 'Now introduce the trap',
        prompt: 'Is the square root of 10 rational or irrational?',
        setup: 'The square root of 81 simplified to a whole number. What happens when the number is not a perfect square?',
        steps: [
          { title: 'Check nearby perfect squares', body: '3² = 9 and 4² = 16, so the square root of 10 lies between 3 and 4.' },
          { title: 'Look for a simple result', body: '10 is not a perfect square, so its square root does not simplify to an integer or a simple fraction.' },
        ],
        answer: 'The square root of 10 is irrational.',
        keyIdea: 'The square root of 81 is rational, but the square root of 10 is irrational.',
      },
      {
        title: 'Example 3',
        subtitle: 'Fractions can work too',
        prompt: 'Classify the square root of one quarter',
        setup: 'A number does not need to be an integer for its square root to be rational.',
        steps: [
          { title: 'Think of the fraction that squares to one quarter', body: 'One half × one half = one quarter.' },
          { title: 'Name the result', body: 'The square root of one quarter is one half.' },
          { title: 'Classify one half', body: 'One half is a fraction of two integers, so it is rational.' },
        ],
        answer: 'The square root of one quarter is rational.',
        keyIdea: 'Roots of fractions are not automatically irrational either.',
      },
    ],
  },
};

/**
 * Do not mutate the answer sent to the evaluator. This is display copy only.
 */
export function formatLearnerMath(value: string) {
  return value
    .replace(/√\(([^)]+)\)/g, 'the square root of $1')
    .replace(/√(\d+)/g, 'the square root of $1');
}

export function learnerTopicDescription(topicCode: string, fallback: string | null | undefined) {
  return topicPresentations[topicCode]?.description ?? fallback;
}

export function learnerSkillPresentation(topicCode: string, skillCode: string, fallback: { title: string; description: string }) {
  return topicPresentations[topicCode]?.skills[skillCode] ?? fallback;
}

export function lessonPresentation(skillCode: string) {
  return lessonPresentations[skillCode];
}
