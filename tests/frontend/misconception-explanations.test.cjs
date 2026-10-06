const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'features', 'learning', 'misconceptionExplanations.ts'),
  'utf8',
);
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUnderTest = { exports: {} };
new Function('exports', 'require', 'module', '__filename', '__dirname', output)(
  moduleUnderTest.exports,
  require,
  moduleUnderTest,
  '',
  '',
);
const { getMisconceptionExplanation, getConfidenceFeedback } = moduleUnderTest.exports;

test('misconception dictionary resolves difference of squares vs binomial square', () => {
  const dots1 = getMisconceptionExplanation('DOTS_AS_SQUARE_OF_DIFFERENCE');
  assert.equal(dots1.title, 'Difference of Squares vs. Square of a Binomial');
  assert.ok(dots1.explanation.includes('(a - b)(a + b)'));
  assert.ok(dots1.guidance.includes('a² - b²'));

  const dots2 = getMisconceptionExplanation('ALG_DOTS_AS_BINOMIAL_SQUARE');
  assert.equal(dots2.title, 'Difference of Squares vs. Square of a Binomial');
});

test('misconception dictionary resolves partial distribution and unlike terms', () => {
  const dist = getMisconceptionExplanation('DISTRIBUTIVE_PARTIAL_MULTIPLICATION');
  assert.equal(dist.title, 'Incomplete Distribution Across Brackets');
  assert.ok(dist.explanation.includes('bracket'));

  const unlike = getMisconceptionExplanation('ALG_COMBINE_UNLIKE_TERMS');
  assert.equal(unlike.title, 'Combining Unlike Terms');
  assert.ok(unlike.explanation.includes('same variable parts'));
});

test('misconception dictionary resolves linear equation misconceptions', () => {
  const oneSide = getMisconceptionExplanation('EQUATION_OPERATION_ONE_SIDE');
  assert.equal(oneSide.title, 'Unbalanced Equation Operation');
  assert.ok(oneSide.guidance.includes('balanced'));

  const signRule = getMisconceptionExplanation('EQN_MOVE_TERM_SIGN_RULE');
  assert.equal(signRule.title, 'Sign Inversion Across the Equals Sign');

  const zeroProduct = getMisconceptionExplanation('ZERO_PRODUCT_WITHOUT_ZERO');
  assert.equal(zeroProduct.title, 'Zero-Product Property Requires Zero');
});

test('misconception dictionary resolves Cartesian coordinate and gradient misconceptions', () => {
  const coords = getMisconceptionExplanation('GRAPH_XY_REVERSED');
  assert.equal(coords.title, 'Reversed Coordinate Order (x, y)');

  const gradient = getMisconceptionExplanation('GRADIENT_RISE_OVER_RUN_REVERSED');
  assert.equal(gradient.title, 'Gradient Ratio Inverted (Run over Rise)');
  assert.ok(gradient.explanation.includes('Δy / Δx'));

  const intercepts = getMisconceptionExplanation('GRAPH_INTERCEPT_CONFUSION');
  assert.equal(intercepts.title, 'Confusing x-Intercept and y-Intercept');
});

test('misconception dictionary provides safe fallbacks for arbitrary or malformed codes', () => {
  const fallback = getMisconceptionExplanation('UNKNOWN_ARBITRARY_CODE');
  assert.equal(fallback.title, 'Mathematical Concept Review');
  assert.ok(fallback.guidance.length > 0);

  const dotsFallback = getMisconceptionExplanation('custom_dots_variant');
  assert.equal(dotsFallback.title, 'Difference of Squares vs. Square of a Binomial');
});

test('confidence matrix generates pedagogically calibrated feedback', () => {
  // Correct + High Confidence
  const highConfCorrect = getConfidenceFeedback(true, 4);
  assert.equal(highConfCorrect.tone, 'confident_success');
  assert.ok(highConfCorrect.badge.includes('High confidence'));

  // Correct + Low Confidence
  const lowConfCorrect = getConfidenceFeedback(true, 1);
  assert.equal(lowConfCorrect.tone, 'hesitant_success');
  assert.ok(lowConfCorrect.badge.includes('Growing confidence'));

  // Incorrect + High Confidence (Misconception signal)
  const highConfIncorrect = getConfidenceFeedback(false, 4);
  assert.equal(highConfIncorrect.tone, 'confident_misconception');
  assert.ok(highConfIncorrect.badge.includes('Diagnostic insight'));

  // Incorrect + Low Confidence (Uncertainty gap)
  const lowConfIncorrect = getConfidenceFeedback(false, 2);
  assert.equal(lowConfIncorrect.tone, 'hesitant_gap');
  assert.ok(lowConfIncorrect.badge.includes('Targeted support'));

  // Null confidence
  const neutralCorrect = getConfidenceFeedback(true, null);
  assert.equal(neutralCorrect.tone, 'success');

  const neutralIncorrect = getConfidenceFeedback(false, null);
  assert.equal(neutralIncorrect.tone, 'review');
});
