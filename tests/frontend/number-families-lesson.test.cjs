const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const presentation = read('src', 'features', 'learning', 'studentLearningPresentation.ts');
const visuals = read('src', 'features', 'learning', 'NumberFamiliesVisuals.tsx');
const route = read('src', 'features', 'learning', 'StudentLearningTopicRoute.tsx');

test('Number Families presentation covers the required nested sets and edge examples', () => {
  for (const text of ['Natural numbers', 'Whole numbers', 'Integers', 'Rational numbers', 'Irrational numbers', 'Real numbers']) {
    assert.match(presentation, new RegExp(text));
  }
  for (const example of ['Why is −7 an integer?', 'Is √81 irrational?', 'Why is √20 irrational?', '√20 = √(4 × 5) = 2√5']) {
    assert.ok(presentation.includes(example), `missing ${example}`);
  }
  assert.match(presentation, /natural numbers.*begin at 1/i);
});

test('Number Explorer makes membership explicit for 0, negative values, fractions and irrationals', () => {
  for (const example of ['label: \'0\'', 'label: \'−50\'', 'label: \'1\/2\'', 'label: \'√2\'', 'label: \'π\'']) {
    assert.ok(visuals.includes(example), `missing explorer example ${example}`);
  }
  assert.match(visuals, /aria-pressed/);
  assert.match(visuals, /aria-live="polite"/);
  assert.match(visuals, /Natural numbers sit inside whole numbers/);
});

test('lesson uses visual, progressive worked reasoning without changing saved practice delivery', () => {
  assert.match(route, /NumberFamiliesExplorer/);
  assert.match(route, /WorkedExampleVisual/);
  assert.match(route, /Reveal the next reasoning step/);
  assert.match(route, /lesson\.skillCode === 'G9-NUM-REAL-IRRATIONAL'/);
  assert.doesNotMatch(route, /answerConfig|correct_option|accepted_answers/);
});
