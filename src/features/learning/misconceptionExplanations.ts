import type { LearnerConfidence } from './studentLearningRepository';

export interface MisconceptionDetail {
  code: string;
  title: string;
  explanation: string;
  guidance: string;
  example?: string;
  category: 'algebra' | 'equations' | 'graphs' | 'general';
}

export interface ConfidenceInsight {
  tone: 'confident_success' | 'hesitant_success' | 'confident_misconception' | 'hesitant_gap' | 'success' | 'review';
  badge: string;
  title: string;
  message: string;
}

const MISCONCEPTION_DICTIONARY: Record<string, MisconceptionDetail> = {
  DOTS_AS_SQUARE_OF_DIFFERENCE: {
    code: 'DOTS_AS_SQUARE_OF_DIFFERENCE',
    title: 'Difference of Squares vs. Square of a Binomial',
    explanation:
      'A difference of squares (a² - b²) factors into conjugate brackets with alternating signs: (a - b)(a + b). Squaring a single bracket like (x - 7)² gives a middle term (x² - 14x + 49).',
    guidance: 'Use opposite signs inside the brackets so the middle terms cancel out: a² - b² = (a - b)(a + b).',
    example: 'x² - 49 = (x - 7)(x + 7)',
    category: 'algebra',
  },
  ALG_DOTS_AS_BINOMIAL_SQUARE: {
    code: 'ALG_DOTS_AS_BINOMIAL_SQUARE',
    title: 'Difference of Squares vs. Square of a Binomial',
    explanation:
      'Squaring a bracket (x - k)² expands to x² - 2kx + k², which introduces a middle term. For a pure difference of two squares x² - k², the signs must alternate so the middle terms sum to zero.',
    guidance: 'Always check your factors by multiplying back: (x - k)(x + k) = x² - k².',
    example: 'x² - 25 = (x - 5)(x + 5)',
    category: 'algebra',
  },
  DISTRIBUTIVE_PARTIAL_MULTIPLICATION: {
    code: 'DISTRIBUTIVE_PARTIAL_MULTIPLICATION',
    title: 'Incomplete Distribution Across Brackets',
    explanation:
      'When multiplying a bracket by a number, every single term inside the bracket must be multiplied by that factor, not just the first term.',
    guidance: 'Multiply the outer factor into each term individually: a(b + c) = ab + ac.',
    example: '3(x + 4) = 3 · x + 3 · 4 = 3x + 12',
    category: 'algebra',
  },
  ALG_DISTRIBUTIVE_PARTIAL: {
    code: 'ALG_DISTRIBUTIVE_PARTIAL',
    title: 'Incomplete Distribution Across Brackets',
    explanation:
      'The multiplier outside the bracket was applied to the first term, but the second term was left unmultiplied.',
    guidance: 'Distribute across the entire bracket: a(x + y) = ax + ay.',
    example: '3(x + 4) = 3x + 12 (not 3x + 4)',
    category: 'algebra',
  },
  ALG_COMBINE_UNLIKE_TERMS: {
    code: 'ALG_COMBINE_UNLIKE_TERMS',
    title: 'Combining Unlike Terms',
    explanation:
      'Terms can only be added or subtracted together if they have the exact same variable parts and exponents. Variable terms and standalone numbers cannot be merged.',
    guidance: 'Group like terms together first. Standalone constant numbers cannot merge with variable terms.',
    example: '4x + 3x - 2 = 7x - 2 (do not combine 7x and -2 into 5x)',
    category: 'algebra',
  },
  ALG_SIGN_DISTRIBUTION: {
    code: 'ALG_SIGN_DISTRIBUTION',
    title: 'Distributing Negative Signs',
    explanation:
      'A negative sign outside brackets behaves like multiplying by -1. It reverses the sign of every term inside.',
    guidance: 'Remember: -(a - b) = -a + b because -1 × -b = +b.',
    example: '-(x - 4) = -x + 4',
    category: 'algebra',
  },
  ALG_DOTS_INCORRECT_ROOT: {
    code: 'ALG_DOTS_INCORRECT_ROOT',
    title: 'Incorrect Square Root in Factorisation',
    explanation:
      'Each factor in a difference of squares requires the principal square root of the constant term.',
    guidance: 'Identify what number multiplied by itself gives the second term: √49 = 7.',
    example: 'y² - 49 = (y - 7)(y + 7)',
    category: 'algebra',
  },
  TRINOMIAL_SIGN_ERROR: {
    code: 'TRINOMIAL_SIGN_ERROR',
    title: 'Trinomial Factor Pair Signs',
    explanation:
      'When factorising a quadratic trinomial, the product of the two constants must give the last term, and their sum must reconstruct the middle term with the correct sign.',
    guidance: 'List factors of the constant term and check which pair adds up to the middle coefficient.',
    example: 'For x² + 5x + 6: factors of 6 are (+2) and (+3) because 2 + 3 = 5.',
    category: 'algebra',
  },
  ALG_TRINOMIAL_SIGN_ERROR: {
    code: 'ALG_TRINOMIAL_SIGN_ERROR',
    title: 'Trinomial Factor Pair Signs',
    explanation:
      'The chosen factors do not add up to the coefficient of the middle term when signs are taken into account.',
    guidance: 'Multiply your factors back out using FOIL to verify that the middle term matches.',
    example: '(x + 2)(x + 3) = x² + 5x + 6',
    category: 'algebra',
  },
  BINOMIAL_MISSING_CROSS_TERM: {
    code: 'BINOMIAL_MISSING_CROSS_TERM',
    title: 'Missing Middle Term in Binomial Expansion',
    explanation:
      'When expanding (a + b)², squaring both terms individually is not enough. You must include the cross term 2ab from the inner and outer products.',
    guidance: 'Remember: (a + b)² = a² + 2ab + b².',
    example: '(x - 4)² = (x - 4)(x - 4) = x² - 8x + 16',
    category: 'algebra',
  },
  EQUATION_OPERATION_ONE_SIDE: {
    code: 'EQUATION_OPERATION_ONE_SIDE',
    title: 'Unbalanced Equation Operation',
    explanation:
      'An equation is a balanced scale. Any operation (addition, subtraction, multiplication, or division) performed on one side must be performed on the other side as well.',
    guidance: 'Keep the equation balanced: whatever you do to the left side, do identically to the right side.',
    example: 'If 3x + 12 = 21, subtract 12 from BOTH sides: 3x = 9, then divide BOTH sides by 3: x = 3.',
    category: 'equations',
  },
  EQN_DIVIDE_ONE_SIDE_ONLY: {
    code: 'EQN_DIVIDE_ONE_SIDE_ONLY',
    title: 'Unbalanced Equation Step',
    explanation:
      'Operations in algebra must be applied to the complete equation on both sides of the equals sign to preserve equality.',
    guidance: 'Apply inverse operations symmetrically across the equals sign.',
    example: '3x + 12 = 21 → 3x = 21 - 12 = 9 → x = 9 / 3 = 3',
    category: 'equations',
  },
  EQN_MOVE_TERM_SIGN_RULE: {
    code: 'EQN_MOVE_TERM_SIGN_RULE',
    title: 'Sign Inversion Across the Equals Sign',
    explanation:
      'When a term moves across the equals sign, its operation inverts (addition becomes subtraction, and vice versa).',
    guidance: 'Think of it as subtracting or adding that exact term to both sides.',
    example: '2(x + 3) = 14 → x + 3 = 7 → x = 7 - 3 = 4',
    category: 'equations',
  },
  ZERO_PRODUCT_WITHOUT_ZERO: {
    code: 'ZERO_PRODUCT_WITHOUT_ZERO',
    title: 'Zero-Product Property Requires Zero',
    explanation:
      'The property ab = 0 implies a = 0 or b = 0 ONLY works when the right-hand side is exactly zero. It cannot be applied to other numbers like ab = 6.',
    guidance: 'Make sure all terms are gathered on one side so the other side equals 0 before factorising.',
    example: '(x - 2)(x + 3) = 0 → x - 2 = 0 or x + 3 = 0',
    category: 'equations',
  },
  EQN_ZERO_PRODUCT_NOT_APPLIED: {
    code: 'EQN_ZERO_PRODUCT_NOT_APPLIED',
    title: 'Solving via Zero-Product Property',
    explanation:
      'Once an equation is written in factored form equal to zero, set each linear factor equal to zero to find the two possible solutions.',
    guidance: 'If (x - a)(x + b) = 0, then either x - a = 0 (so x = a) or x + b = 0 (so x = -b).',
    example: '(x - 2)(x + 3) = 0 → x = 2 or x = -3',
    category: 'equations',
  },
  GRAPH_XY_REVERSED: {
    code: 'GRAPH_XY_REVERSED',
    title: 'Reversed Coordinate Order (x, y)',
    explanation:
      'In a Cartesian plane, ordered pairs are always written (x, y) — horizontal position first, vertical position second.',
    guidance: 'Remember: x comes before y in the alphabet. Move along the horizontal axis first, then the vertical axis.',
    example: 'For (2, -1): move 2 right, then 1 down.',
    category: 'graphs',
  },
  GRADIENT_RISE_OVER_RUN_REVERSED: {
    code: 'GRADIENT_RISE_OVER_RUN_REVERSED',
    title: 'Gradient Ratio Inverted (Run over Rise)',
    explanation:
      'The gradient of a line measures vertical steepness over horizontal distance: m = Δy / Δx (change in y divided by change in x).',
    guidance: 'Think "Rise over Run": vertical change goes in the numerator, horizontal change in the denominator.',
    example: 'Between (1, 2) and (3, 6): Δy = 6 - 2 = 4, Δx = 3 - 1 = 2 → gradient = 4 / 2 = 2.',
    category: 'graphs',
  },
  GRAPH_GRADIENT_RECIPROCAL: {
    code: 'GRAPH_GRADIENT_RECIPROCAL',
    title: 'Gradient Ratio Inverted',
    explanation:
      'The gradient calculation was inverted to Δx / Δy instead of Δy / Δx.',
    guidance: 'Always calculate vertical change (y₂ - y₁) first, then divide by horizontal change (x₂ - x₁).',
    example: 'm = (y₂ - y₁) / (x₂ - x₁)',
    category: 'graphs',
  },
  GRAPH_GRADIENT_AS_INTERCEPT: {
    code: 'GRAPH_GRADIENT_AS_INTERCEPT',
    title: 'Confusing Gradient (m) and y-Intercept (c)',
    explanation:
      'In the linear equation y = mx + c, m is the gradient (rate of change multiplying x) and c is the constant y-intercept (the value of y when x = 0).',
    guidance: 'The coefficient multiplying x is the slope. The standalone constant is where the line crosses the y-axis.',
    example: 'In y = 2x - 1, gradient is 2 and y-intercept is -1.',
    category: 'graphs',
  },
  GRAPH_INTERCEPT_CONFUSION: {
    code: 'GRAPH_INTERCEPT_CONFUSION',
    title: 'Confusing x-Intercept and y-Intercept',
    explanation:
      'The y-intercept occurs where the graph crosses the vertical axis (so x = 0). The x-intercept occurs where it crosses the horizontal axis (so y = 0).',
    guidance: 'For y-intercept: substitute x = 0 into the equation and solve for y.',
    example: 'For y = 2x - 3, when x = 0, y = -3 (y-intercept is -3).',
    category: 'graphs',
  },
  REQUIRED_FORM_NOT_MET: {
    code: 'REQUIRED_FORM_NOT_MET',
    title: 'Answer Not in Fully Factorised Form',
    explanation:
      'Your answer is mathematically equivalent, but the question specifically asks for factorised form into brackets.',
    guidance: 'Write your answer as a product of factors using brackets, such as (x - a)(x + a).',
    example: 'Instead of x² - 25, write (x - 5)(x + 5).',
    category: 'algebra',
  },
  WRONG_SOLUTION_VARIABLE: {
    code: 'WRONG_SOLUTION_VARIABLE',
    title: 'Incorrect Variable Specified',
    explanation:
      'The solution used an unexpected variable name when stating the final answer.',
    guidance: 'State your answer using the exact variable in the equation, e.g. x = 3.',
    example: 'x = 3',
    category: 'equations',
  },
};

export function getMisconceptionExplanation(code: string): MisconceptionDetail {
  const direct = MISCONCEPTION_DICTIONARY[code];
  if (direct) return direct;

  const normalised = code.toUpperCase().replace(/[-.]/g, '_');
  const matched = MISCONCEPTION_DICTIONARY[normalised];
  if (matched) return matched;

  // General fallbacks based on prefix/suffix
  if (normalised.includes('DOTS') || normalised.includes('SQUARE')) {
    return MISCONCEPTION_DICTIONARY.DOTS_AS_SQUARE_OF_DIFFERENCE;
  }
  if (normalised.includes('DISTRIBUTIVE')) {
    return MISCONCEPTION_DICTIONARY.DISTRIBUTIVE_PARTIAL_MULTIPLICATION;
  }
  if (normalised.includes('GRADIENT')) {
    return MISCONCEPTION_DICTIONARY.GRADIENT_RISE_OVER_RUN_REVERSED;
  }
  if (normalised.includes('LIKE_TERMS')) {
    return MISCONCEPTION_DICTIONARY.ALG_COMBINE_UNLIKE_TERMS;
  }
  if (normalised.includes('EQN') || normalised.includes('EQUATION')) {
    return MISCONCEPTION_DICTIONARY.EQUATION_OPERATION_ONE_SIDE;
  }

  return {
    code,
    title: 'Mathematical Concept Review',
    explanation:
      'Your answer shows a common pattern where a mathematical rule was partially applied. Taking a moment to verify each step will help strengthen this skill.',
    guidance: 'Review each line of your working to confirm signs, operations, and bracket expansion.',
    category: 'general',
  };
}

export function getConfidenceFeedback(
  isCorrect: boolean,
  confidence: LearnerConfidence | null,
): ConfidenceInsight {
  if (isCorrect) {
    if (confidence === 4 || confidence === 3) {
      return {
        tone: 'confident_success',
        badge: 'High confidence · Mastered',
        title: 'Spot on — strong understanding!',
        message:
          'You were confident in your approach and executed it cleanly. This shows solid conceptual mastery.',
      };
    }
    if (confidence === 1 || confidence === 2) {
      return {
        tone: 'hesitant_success',
        badge: 'Growing confidence',
        title: 'Great work — trust your method!',
        message:
          'You got this right even though you felt unsure. Notice how your method worked — you know more than you think!',
      };
    }
    return {
      tone: 'success',
      badge: 'Correct',
      title: 'Nicely done!',
      message: 'Your answer is correct. Continue to build consistent practice on this skill.',
    };
  }

  // Incorrect branch
  if (confidence === 4 || confidence === 3) {
    return {
      tone: 'confident_misconception',
      badge: 'Diagnostic insight',
      title: 'Surprising result — let’s break it down',
      message:
        'You felt sure about this one, but a very common misconception came into play. Take a close look at the explanation below so you can spot this pattern next time!',
    };
  }
  if (confidence === 1 || confidence === 2) {
    return {
      tone: 'hesitant_gap',
      badge: 'Targeted support',
      title: 'No problem — this is where learning happens',
      message:
        'You felt unsure here, and that’s completely fine. Review the breakdown below, and try the question again to lock in the method.',
    };
  }
  return {
    tone: 'review',
    badge: 'Needs review',
    title: 'Let’s check this together',
    message: 'Check the guidance below to see what step needs adjusting before you continue.',
  };
}

