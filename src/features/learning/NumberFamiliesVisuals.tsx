import { useState } from 'react';

import type { WorkedExample } from './studentLearningPresentation';

type NumberSet = 'natural' | 'whole' | 'integer' | 'rational' | 'irrational' | 'real';
type ExplorerNumber = { label: string; context: string; memberships: NumberSet[]; explanation: string };

const explorerNumbers: ExplorerNumber[] = [
  { label: '3', context: '3 PlayStation games', memberships: ['natural', 'whole', 'integer', 'rational', 'real'], explanation: '3 begins in the smallest counting set, so it is also in every larger set around it.' },
  { label: '0', context: '0 unread messages', memberships: ['whole', 'integer', 'rational', 'real'], explanation: '0 is whole, but here natural numbers begin at 1.' },
  { label: '−50', context: 'a −R50 bank balance', memberships: ['integer', 'rational', 'real'], explanation: 'A negative whole value is an integer. It cannot be natural or whole.' },
  { label: '1/2', context: 'half a pizza', memberships: ['rational', 'real'], explanation: '1/2 is a ratio of two integers, so it is rational even though it is not an integer.' },
  { label: '√2', context: 'the diagonal of a 1 by 1 square', memberships: ['irrational', 'real'], explanation: '√2 cannot be written as one exact fraction. It is irrational, but it is still on the real number line.' },
  { label: 'π', context: 'a circle measurement', memberships: ['irrational', 'real'], explanation: 'π is another real number whose decimal digits do not end or repeat in a fixed pattern.' },
];

const setLabels: Record<NumberSet, string> = { natural: 'Natural numbers', whole: 'Whole numbers', integer: 'Integers', rational: 'Rational numbers', irrational: 'Irrational numbers', real: 'Real numbers' };

export function NumberFamiliesExplorer() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = explorerNumbers[selectedIndex];
  const has = (set: NumberSet) => selected.memberships.includes(set);
  return <section className="number-explorer" aria-labelledby="number-explorer-heading">
    <div className="number-explorer-heading"><div><p className="learning-eyebrow">Try it yourself</p><h3 id="number-explorer-heading">Number Explorer</h3></div><p>Choose a number. The diagram highlights every family it belongs to.</p></div>
    <div className="number-explorer-options" role="group" aria-label="Choose a number to classify">
      {explorerNumbers.map((item, index) => <button className={index === selectedIndex ? 'is-selected' : ''} type="button" key={item.label} aria-pressed={index === selectedIndex} onClick={() => setSelectedIndex(index)}><strong>{item.label}</strong><span>{item.context}</span></button>)}
    </div>
    <div className="number-explorer-diagram" aria-describedby="number-explorer-result">
      <div className={`number-set number-set-real ${has('real') ? 'is-highlighted' : ''}`}><strong>Real numbers</strong>
        <div className={`number-set number-set-rational ${has('rational') ? 'is-highlighted' : ''}`}><strong>Rational numbers</strong>
          <div className={`number-set number-set-integer ${has('integer') ? 'is-highlighted' : ''}`}><strong>Integers</strong>
            <div className={`number-set number-set-whole ${has('whole') ? 'is-highlighted' : ''}`}><strong>Whole numbers</strong>
              <div className={`number-set number-set-natural ${has('natural') ? 'is-highlighted' : ''}`}><strong>Natural numbers</strong></div>
            </div>
          </div>
        </div>
        <div className={`number-set number-set-irrational ${has('irrational') ? 'is-highlighted' : ''}`}><strong>Irrational numbers</strong></div>
      </div>
    </div>
    <div id="number-explorer-result" className="number-explorer-result" aria-live="polite"><p><strong>{selected.label}</strong> belongs to: {selected.memberships.map((set) => setLabels[set]).join(', ')}.</p><p>{selected.explanation}</p></div>
    <p className="number-explorer-accessible"><strong>Reading the diagram:</strong> Natural numbers sit inside whole numbers, inside integers, inside rational numbers, inside real numbers. Irrational numbers are also real, but sit outside rational numbers.</p>
  </section>;
}

export function WorkedExampleVisual({ example }: { example: WorkedExample }) {
  if (example.visual === 'number-line') return <figure className="number-line-visual" aria-label="Number line from negative ten to ten with negative seven highlighted"><figcaption>On a number line, −7 is left of zero. It is a negative integer.</figcaption><div className="number-line-axis" aria-hidden="true">{[-10, -7, -4, 0, 4, 7, 10].map((value) => <span className={value === -7 ? 'is-focus' : ''} key={value}><i />{value}</span>)}</div></figure>;
  if (example.visual === 'perfect-square') return <figure className="square-visual" aria-label="Nine by nine square, showing that nine times nine equals eighty-one"><figcaption>81 makes a complete 9 by 9 square.</figcaption><div aria-hidden="true">{Array.from({ length: 81 }, (_, index) => <span key={index} />)}</div><p>9 × 9 = 81, so √81 = 9.</p></figure>;
  if (example.visual === 'between-squares') return <figure className="between-squares-visual" aria-label="Twenty is between the perfect squares sixteen and twenty-five"><figcaption>20 is between two consecutive perfect squares.</figcaption><div><strong>4² = 16</strong><span>16 &lt; 20 &lt; 25</span><strong>5² = 25</strong></div><p>√20 is between 4 and 5; it does not simplify to an integer.</p></figure>;
  return null;
}
