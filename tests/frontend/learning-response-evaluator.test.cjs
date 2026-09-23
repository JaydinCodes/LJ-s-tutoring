const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'features', 'learning', 'learningResponseEvaluator.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleUnderTest = { exports: {} };
new Function('exports', 'require', 'module', '__filename', '__dirname', output)(moduleUnderTest.exports, require, moduleUnderTest, '', '');
const { evaluateLearningResponse } = moduleUnderTest.exports;
const evaluate = (questionType, answerConfig, learnerResponse) => evaluateLearningResponse({ questionVersionId: 'q', questionType, answerConfig, learnerResponse, marksAvailable: 2 });

test('numeric and fraction normalisation is exact, with optional tolerance', () => {
  assert.equal(evaluate('numeric', { expected: 3 }, '3.00').status, 'correct');
  assert.equal(evaluate('numeric', { expected: 3 }, '4').status, 'incorrect');
  assert.equal(evaluate('numeric', { expected: 0.333, tolerance: 0.001 }, '0.3339').status, 'correct');
  assert.equal(evaluate('fraction', { expected: '1/2' }, '2/4').status, 'correct');
  assert.equal(evaluate('fraction', { expected: '1/2' }, '0.5').status, 'correct');
  assert.equal(evaluate('fraction', { expected: '1/2' }, '1/0').status, 'needs_review');
  assert.equal(evaluate('fraction', { expected: '1/2' }, 'half').status, 'needs_review');
});

test('multiple choice, coordinates and linear solutions validate their form', () => {
  assert.equal(evaluate('multiple_choice', { correct_option: 'B' }, 'b').status, 'correct');
  assert.equal(evaluate('multiple_choice', { correct_option: 'B' }, 'A').status, 'incorrect');
  assert.equal(evaluate('multiple_choice', { correct_option: 'B' }, 'B!').status, 'needs_review');
  for (const answer of ['(2, 3)', '(2;3)', '2,3']) assert.equal(evaluate('coordinate', { accepted: ['(2,3)'] }, answer).status, 'correct');
  assert.equal(evaluate('linear_equation_solution', { expected: 3, variables: ['x'] }, 'x = 3').status, 'correct');
  assert.equal(evaluate('linear_equation_solution', { expected: 3, variables: ['x'] }, '3').status, 'correct');
  assert.equal(evaluate('linear_equation_solution', { expected: 3, variables: ['x'] }, 'y = 3').explanationCode, 'WRONG_SOLUTION_VARIABLE');
  assert.equal(evaluate('linear_equation_solution', { expected: 3 }, 'x = 4').status, 'incorrect');
});

test('safe polynomial equivalence honours required answer form', () => {
  assert.equal(evaluate('algebraic_expression', { accepted: ['2(x+3)'] }, '2x+6').status, 'correct');
  assert.equal(evaluate('factorised_expression', { accepted: ['(x-5)(x+5)'], required_form: 'factorised' }, '(x+5)(x-5)').status, 'correct');
  const unchanged = evaluate('factorised_expression', { accepted: ['(x-5)(x+5)'], required_form: 'factorised' }, 'x^2-25');
  assert.equal(unchanged.status, 'incorrect');
  assert.equal(unchanged.explanationCode, 'REQUIRED_FORM_NOT_MET');
});

test('known Grade 9 misconception patterns are evidence, not diagnoses', () => {
  const dots = evaluate('factorised_expression', { accepted: ['(x-7)(x+7)'], required_form: 'factorised' }, '(x-7)^2');
  assert.equal(dots.misconceptionMatches[0].code, 'DOTS_AS_SQUARE_OF_DIFFERENCE');
  const distribution = evaluate('algebraic_expression', { accepted: ['3x+12'] }, '3x+4');
  assert.equal(distribution.misconceptionMatches[0].code, 'DISTRIBUTIVE_PARTIAL_MULTIPLICATION');
  const gradient = evaluate('numeric', { expected: 2, skill_code: 'G9.GRAPH.GRADIENT' }, '0.5');
  assert.equal(gradient.misconceptionMatches[0].code, 'GRADIENT_RISE_OVER_RUN_REVERSED');
});

test('unsupported and hostile-looking input cannot execute code', () => {
  assert.equal(evaluate('open_response', { expected: 3 }, 'process.exit()').status, 'needs_review');
  assert.equal(evaluate('algebraic_expression', { accepted: ['x+1'] }, 'globalThis.pwned=1').status, 'needs_review');
  assert.equal(globalThis.pwned, undefined);
});
