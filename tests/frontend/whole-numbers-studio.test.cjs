const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', '..');

function math() {
  const source = fs.readFileSync(path.join(root, 'src', 'features', 'learning', 'wholeNumbersStudioMath.ts'), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', output)(module.exports, require, module);
  return module.exports;
}

test('Whole Numbers studio calculations are deterministic and mathematically correct', () => {
  const { factorPairs, primeFactors, primeFactorNotation, highestCommonFactor, lowestCommonMultiple } = math();
  assert.deepEqual(factorPairs(24), [[1, 24], [2, 12], [3, 8], [4, 6]]);
  assert.deepEqual(factorPairs(0), []);
  assert.deepEqual(primeFactors(60), [2, 2, 3, 5]);
  assert.equal(primeFactorNotation(60), '2² × 3 × 5');
  assert.equal(highestCommonFactor(24, 36), 12);
  assert.equal(lowestCommonMultiple(6, 8), 24);
});

test('Whole Numbers studio keeps exploration separate from recorded assessment and covers six chapters', () => {
  const studio = fs.readFileSync(path.join(root, 'src', 'features', 'learning', 'WholeNumbersStudio.tsx'), 'utf8');
  const route = fs.readFileSync(path.join(root, 'src', 'features', 'learning', 'StudentLearningTopicRoute.tsx'), 'utf8');
  for (const chapter of [
    'Chapter 1 · Number families',
    'Chapter 2 · Factors, multiples and primes',
    'Chapter 3 · Prime factorisation',
    'Chapter 4 · HCF and LCM',
    'Chapter 5 · Ratios, rates and proportion',
    'Chapter 6 · Financial mathematics',
  ]) assert.ok(studio.includes(chapter), `missing ${chapter}`);
  assert.match(studio, /current South African standard rate of 15%/);
  assert.match(studio, /22\/7 is close, not exact/);
  assert.match(studio, /cannot be written as one exact fraction/);
  assert.match(studio, /Ready for recorded practice/);
  assert.match(route, /WholeNumbersStudio/);
  assert.doesNotMatch(studio, /completeLearnerActivity|submitLearningAttempt|mastery/);
});
