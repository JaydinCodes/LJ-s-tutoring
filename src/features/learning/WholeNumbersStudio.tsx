import { ArrowRight, Lightbulb } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { NumberFamiliesExplorer } from './NumberFamiliesVisuals';
import { factorPairs, highestCommonFactor, lowestCommonMultiple, primeFactorNotation } from './wholeNumbersStudioMath';
import './whole-numbers-studio.css';

// Vite's library-mode output does not automatically attach stylesheets for
// lazy chunks. Keep one promise and one stylesheet link across lesson visits.
let studioCssPromise: Promise<void> | null = null;
function ensureStudioCss(): Promise<void> {
  if (import.meta.env.DEV) return Promise.resolve();
  if (!studioCssPromise) {
    studioCssPromise = new Promise<void>((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/react-app-dist/whole-numbers-studio.css';
      link.dataset.odysseusStudioStyles = 'true';
      link.onload = () => resolve();
      link.onerror = () => {
        studioCssPromise = null;
        link.remove();
        reject(new Error('Whole Numbers Studio stylesheet could not be loaded'));
      };
      document.head.appendChild(link);
    });
  }
  return studioCssPromise;
}

type StudioLesson = 'number-families' | 'factors' | 'prime-factorisation' | 'common-factors' | 'proportion' | 'financial';

type StudioDefinition = {
  chapter: string;
  eyebrow: string;
  title: string;
  question: string;
  explanation: string;
  realLife: string;
  insight: string;
  instructions: string;
};

const definitions: Record<StudioLesson, StudioDefinition> = {
  'number-families': {
    chapter: 'Chapter 1 · Number families', eyebrow: 'Discover the idea', title: 'Where does every number belong?',
    question: 'What makes √2 different from 3, 0, −7 and 1/2?',
    explanation: 'Each family solves a new problem: counting, none, below zero, sharing, then values that cannot be written as one exact fraction.',
    realLife: 'A game score, unread messages, a temperature, and half a pizza all need different number families.',
    insight: 'Natural numbers begin at 1 here. Zero is whole; every integer is rational because it can be written over 1.',
    instructions: 'Choose a discovery, then choose a number to see every family it belongs to.',
  },
  factors: {
    chapter: 'Chapter 2 · Factors, multiples and primes', eyebrow: 'Build equal groups', title: 'How can 24 cones make equal rows?',
    question: 'Which rectangles can you make without leaving a cone over?',
    explanation: 'A factor divides a number exactly. Every equal-row rectangle gives a factor pair.',
    realLife: 'A coach has 24 training cones and wants equal rows for a drill.',
    insight: '1 has only one positive factor, so it is neither prime nor composite. A prime number greater than 1 has exactly two positive factors.',
    instructions: 'Pick a row arrangement. Each rectangle reveals one factor pair of 24.',
  },
  'prime-factorisation': {
    chapter: 'Chapter 3 · Prime factorisation', eyebrow: 'Break it down', title: 'Can 60 be split until only primes remain?',
    question: 'Do different factor-tree routes end at the same prime factors?',
    explanation: 'A composite number can split in more than one valid way. Keep splitting composite branches; stop only at primes.',
    realLife: 'Prime factors are the smallest building blocks that multiply to make a composite number.',
    insight: 'The route may change, but the final prime factorisation does not: 60 = 2² × 3 × 5.',
    instructions: 'Choose a valid first split, then inspect the prime leaves.',
  },
  'common-factors': {
    chapter: 'Chapter 4 · HCF and LCM', eyebrow: 'Compare two patterns', title: 'Shared pieces or a shared moment?',
    question: 'When do we need the greatest shared factor, and when do we need the first shared multiple?',
    explanation: 'HCF makes the largest equal groups with no leftovers. LCM finds the first time repeating patterns meet again.',
    realLife: 'Cut 24 cm and 36 cm ribbons equally, or wait for events that repeat every 6 and 8 minutes.',
    insight: 'HCF asks “what can divide both?” LCM asks “what can both land on?”',
    instructions: 'Switch between the ribbon and timeline scene to compare the two ideas.',
  },
  proportion: {
    chapter: 'Chapter 5 · Ratios, rates and proportion', eyebrow: 'Keep the relationship', title: 'What must stay the same when a recipe grows?',
    question: 'How can a drink get bigger without changing its taste?',
    explanation: 'A ratio compares like quantities. A rate compares quantities with different units. Direct proportion keeps a unit rate constant; inverse proportion keeps total work constant.',
    realLife: 'A juice mix uses 2 parts concentrate to 3 parts water. Four equally productive workers can complete a job in 6 hours.',
    insight: 'More notebooks at one price each means more cost. More workers on fixed work means less time.',
    instructions: 'Move the mixer control. The coloured parts change together while the 2:3 relationship stays fixed.',
  },
  financial: {
    chapter: 'Chapter 6 · Financial mathematics', eyebrow: 'Read the receipt', title: 'What do discount and VAT actually change?',
    question: 'Can you follow each amount from shelf price to final total?',
    explanation: 'Calculate a discount from the original price, then calculate VAT on the discounted price in this illustrative receipt.',
    realLife: 'A receipt separates the original price, money saved, VAT and the amount paid.',
    insight: 'VAT is configurable because rates can change. This studio uses the current South African standard rate of 15% as an example, not financial advice.',
    instructions: 'Change the discount. Read each line of the receipt before checking the final total.',
  },
};

function studioLessonFor(skillCode: string, discovery: string | null): StudioLesson | null {
  if (skillCode === 'G9-NUM-REAL-IRRATIONAL') return 'number-families';
  if (skillCode === 'G9-NUM-WHOLE-HCF-LCM') return discovery === 'factors' ? 'factors' : discovery === 'prime-factorisation' ? 'prime-factorisation' : 'common-factors';
  if (skillCode === 'G9-NUM-RATIO-RATE' || skillCode === 'G9-NUM-DIRECT-INVERSE-PROPORTION') return 'proportion';
  if (skillCode === 'G9-NUM-FINANCIAL-APPLICATIONS') return 'financial';
  return null;
}

export function isWholeNumbersStudioLesson(skillCode: string) {
  return studioLessonFor(skillCode, null) !== null;
}

export function WholeNumbersStudio({ skillCode, discovery, lessonRoute, practiceRoute }: {
  skillCode: string;
  discovery: string | null;
  lessonRoute: string;
  practiceRoute?: string;
}) {
  const [cssState, setCssState] = useState<'loading' | 'ready' | 'error'>(import.meta.env.DEV ? 'ready' : 'loading');
  useEffect(() => {
    let mounted = true;
    void ensureStudioCss().then(() => {
      if (mounted) setCssState('ready');
    }).catch(() => {
      if (mounted) setCssState('error');
    });
    return () => { mounted = false; };
  }, []);
  const lesson = studioLessonFor(skillCode, discovery);
  if (!lesson) return null;
  if (cssState === 'loading') return <p role="status">Preparing the interactive maths visuals…</p>;
  if (cssState === 'error') return <div role="alert">The interactive lesson styles could not be loaded. <button type="button" onClick={() => {
    setCssState('loading');
    void ensureStudioCss().then(() => setCssState('ready')).catch(() => setCssState('error'));
  }}>Retry loading the lesson</button></div>;
  const definition = definitions[lesson];
  const chapterLinks = skillCode === 'G9-NUM-WHOLE-HCF-LCM'
    ? [{ id: 'factors', label: 'Factors' }, { id: 'prime-factorisation', label: 'Prime factors' }, { id: 'common', label: 'HCF & LCM' }]
    : null;
  const buildDiscoveryRoute = (id: string) => `${lessonRoute}&discovery=${encodeURIComponent(id)}`;

  return <section className="learning-studio" aria-labelledby="learning-studio-title">
    <div className="learning-studio-chapter"><span>{definition.chapter}</span><span>Concrete → visual → abstract → apply</span></div>
    {chapterLinks ? <nav className="learning-studio-subnav" aria-label="Factors and common multiples discoveries">{chapterLinks.map((item) => <Link key={item.id} className={(lesson === 'common-factors' ? item.id === 'common' : lesson === item.id) ? 'is-active' : ''} to={buildDiscoveryRoute(item.id)}>{item.label}</Link>)}</nav> : null}
    <div className="learning-studio-grid">
      <aside className="learning-studio-guide">
        <p className="learning-eyebrow">{definition.eyebrow}</p>
        <h2 id="learning-studio-title">{definition.title}</h2>
        <p className="learning-studio-question">{definition.question}</p>
        <p>{definition.explanation}</p>
        <section className="learning-studio-real-life"><h3>In context</h3><p>{definition.realLife}</p></section>
        <section className="learning-studio-insight"><Lightbulb size={20} aria-hidden="true" /><p><strong>Key insight.</strong> {definition.insight}</p></section>
        <p className="learning-studio-instructions"><strong>Try it.</strong> {definition.instructions}</p>
        {practiceRoute ? <Link className="learning-studio-practice" to={practiceRoute}>Ready for recorded practice <ArrowRight size={18} aria-hidden="true" /></Link> : null}
      </aside>
      <div className="learning-studio-stage" role="region" aria-label={`${definition.title} interactive mathematics stage`}>
        {lesson === 'number-families' ? <NumberFamiliesStage /> : null}
        {lesson === 'factors' ? <FactorsStage /> : null}
        {lesson === 'prime-factorisation' ? <PrimeFactorisationStage /> : null}
        {lesson === 'common-factors' ? <CommonFactorsStage /> : null}
        {lesson === 'proportion' ? <ProportionStage /> : null}
        {lesson === 'financial' ? <FinancialStage /> : null}
      </div>
    </div>
  </section>;
}

function NumberFamiliesStage() {
  const [discovery, setDiscovery] = useState<'count' | 'zero' | 'negative' | 'fraction' | 'root' | 'pi'>('count');
  const content = {
    count: ['Three controllers', '3', 'Natural numbers count complete objects: 1, 2, 3, …'],
    zero: ['No unread messages', '0', 'Zero tells us there are none. Add 0 to natural numbers and we have whole numbers.'],
    negative: ['Temperature below freezing', '−7 °C', 'Negative whole values need integers. −7 = −7/1, so it is rational too.'],
    fraction: ['Share a pizza fairly', '1/2', 'A fraction is a ratio of integers. 1/2 = 0.5, so it is rational.'],
    root: ['The diagonal of a 1 by 1 square', '√2', 'By Pythagoras, d² = 1² + 1² = 2, so d = √2 ≈ 1.41421356…. It has a precise place on the number line but is not an exact fraction.'],
    pi: ['Every circle', 'π', 'Circumference ÷ diameter is π ≈ 3.14159265…. The fraction 22/7 is close, not exact.'],
  } as const;
  const [label, value, explanation] = content[discovery];
  return <div className="studio-number-family">
    <div className="studio-choice-row" role="group" aria-label="Choose a number-family discovery">{(Object.keys(content) as Array<keyof typeof content>).map((item) => <button type="button" className={item === discovery ? 'is-selected' : ''} aria-pressed={item === discovery} onClick={() => setDiscovery(item)} key={item}>{content[item][1]}</button>)}</div>
    <figure className="studio-family-scene">
      <figcaption>{label}</figcaption>
      {discovery === 'root' ? <svg viewBox="0 0 430 250" role="img" aria-label="A one by one square with diagonal square root of two"><path d="M82 210V45H247V210Z" className="studio-svg-shape" /><path d="M82 210 247 45" className="studio-svg-diagonal" /><text x="152" y="145" className="studio-svg-label">√2</text><text x="157" y="233" className="studio-svg-small">1</text><text x="53" y="136" className="studio-svg-small">1</text></svg> : discovery === 'pi' ? <svg viewBox="0 0 430 250" role="img" aria-label="Circle showing diameter and circumference ratio"><circle cx="180" cy="125" r="82" className="studio-svg-shape" /><path d="M98 125H262" className="studio-svg-diagonal" /><text x="158" y="115" className="studio-svg-label">d</text><text x="286" y="119" className="studio-svg-small">C ÷ d = π</text></svg> : <div className="studio-family-concrete" aria-hidden="true"><strong>{value}</strong><span>{discovery === 'count' ? '● ● ●' : discovery === 'fraction' ? '◐' : discovery === 'negative' ? '← −7 ─ 0 →' : '○'}</span></div>}
      <p>{explanation}</p>
    </figure>
    <NumberFamiliesExplorer />
  </div>;
}

function FactorsStage() {
  const pairs = factorPairs(24);
  const [pair, setPair] = useState(pairs[0]);
  return <div className="studio-factor-stage">
    <div className="studio-choice-row" role="group" aria-label="Choose an equal row arrangement">{pairs.map((item) => <button type="button" aria-pressed={item === pair} className={item === pair ? 'is-selected' : ''} key={item.join('x')} onClick={() => setPair(item)}>{item[0]} × {item[1]}</button>)}</div>
    <figure className="studio-factor-array"><figcaption>{pair[0]} rows of {pair[1]} cones makes 24 exactly.</figcaption><div className="studio-cone-grid" style={{ gridTemplateColumns: `repeat(${pair[1]}, minmax(0, 1fr))` }}>{Array.from({ length: 24 }, (_, index) => <span key={index} aria-hidden="true" />)}</div></figure>
    <p className="studio-equation"><strong>24 = {pair[0]} × {pair[1]}</strong> · factor pair: {pair[0]} and {pair[1]}</p>
    <p className="studio-stage-caption">The possible factor pairs are {pairs.map(([left, right]) => `${left} × ${right}`).join(', ')}. A multiple is made by equal jumps: 4, 8, 12, 16, … are multiples of 4.</p>
  </div>;
}

function PrimeFactorisationStage() {
  const [route, setRoute] = useState<'six-ten' | 'four-fifteen'>('six-ten');
  const middle = route === 'six-ten' ? [6, 10] : [4, 15];
  const leaves = route === 'six-ten' ? [2, 3, 2, 5] : [2, 2, 3, 5];
  return <div className="studio-tree-stage"><div className="studio-choice-row" role="group" aria-label="Choose a factor tree route"><button type="button" className={route === 'six-ten' ? 'is-selected' : ''} aria-pressed={route === 'six-ten'} onClick={() => setRoute('six-ten')}>60 = 6 × 10</button><button type="button" className={route === 'four-fifteen' ? 'is-selected' : ''} aria-pressed={route === 'four-fifteen'} onClick={() => setRoute('four-fifteen')}>60 = 4 × 15</button></div><div className="studio-factor-tree" role="img" aria-label={`Factor tree for 60 through ${route === 'six-ten' ? 'six and ten' : 'four and fifteen'}`}><div className="studio-tree-root"><strong>60</strong></div><div className="studio-tree-middle">{middle.map((factor) => <strong key={factor}>{factor}</strong>)}</div><div className="studio-tree-leaves">{leaves.map((factor, index) => <span key={`${factor}-${index}`}>{factor}<small>prime</small></span>)}</div></div><p className="studio-equation"><strong>60 = {primeFactorNotation(60)}</strong></p><p className="studio-stage-caption">Both valid routes finish with exactly the same prime leaves: 2, 2, 3 and 5.</p></div>;
}

function CommonFactorsStage() {
  const [mode, setMode] = useState<'hcf' | 'lcm'>('hcf');
  const hcf = highestCommonFactor(24, 36);
  const lcm = lowestCommonMultiple(6, 8);
  return <div className="studio-common-stage"><div className="studio-choice-row" role="group" aria-label="Choose HCF or LCM visual"><button type="button" className={mode === 'hcf' ? 'is-selected' : ''} aria-pressed={mode === 'hcf'} onClick={() => setMode('hcf')}>HCF · ribbons</button><button type="button" className={mode === 'lcm' ? 'is-selected' : ''} aria-pressed={mode === 'lcm'} onClick={() => setMode('lcm')}>LCM · timeline</button></div>{mode === 'hcf' ? <><div className="studio-ribbons" aria-label="24 centimetre and 36 centimetre ribbons divided into 12 centimetre pieces"><div><span>24 cm</span><i /><i /></div><div><span>36 cm</span><i /><i /><i /></div></div><p className="studio-equation"><strong>HCF(24, 36) = {hcf}</strong> · the longest equal piece is 12 cm.</p></> : <><div className="studio-timeline" aria-label="Timeline showing 6 minute and 8 minute repeating events meeting at 24 minutes">{Array.from({ length: 25 }, (_, minute) => <span key={minute} className={`${minute % 6 === 0 ? 'event-a' : ''} ${minute % 8 === 0 ? 'event-b' : ''} ${minute === 24 ? 'is-meeting' : ''}`}>{minute % 4 === 0 ? minute : ''}</span>)}</div><p className="studio-equation"><strong>LCM(6, 8) = {lcm}</strong> · both events first happen together after 24 minutes.</p></>}<p className="studio-stage-caption">Prime factors confirm it: 24 = 2³ × 3 and 36 = 2² × 3²; 6 = 2 × 3 and 8 = 2³.</p></div>;
}

function ProportionStage() {
  const [batches, setBatches] = useState(2);
  const concentrate = batches * 2;
  const water = batches * 3;
  const workers = 4 + batches;
  const hours = 24 / workers;
  return <div className="studio-proportion-stage"><label htmlFor="mixer-batches">Recipe batches: <strong>{batches}</strong></label><input id="mixer-batches" type="range" min="1" max="6" value={batches} onChange={(event) => setBatches(Number(event.target.value))} /><div className="studio-mixer" aria-label={`${concentrate} parts concentrate and ${water} parts water`}><div style={{ flex: concentrate }}><span>{concentrate} concentrate</span></div><div style={{ flex: water }}><span>{water} water</span></div></div><p className="studio-equation"><strong>{concentrate} : {water} = 2 : 3</strong> · equivalent ratios keep the same taste.</p><div className="studio-proportion-cards"><p><strong>Rate</strong> 3 notebooks for R45 → R15 per notebook.</p><p><strong>Direct</strong> {batches} notebook packs at R15 each → R{batches * 15}.</p><p><strong>Inverse</strong> {workers} equally productive workers → {hours % 1 === 0 ? hours : hours.toFixed(1)} hours for 24 worker-hours.</p></div></div>;
}

function FinancialStage() {
  const [discount, setDiscount] = useState(10);
  const [vatRate, setVatRate] = useState(15);
  const original = 250;
  const saved = original * (discount / 100);
  const beforeVat = original - saved;
  const vat = beforeVat * (vatRate / 100);
  const total = beforeVat + vat;
  const money = (value: number) => `R${value.toFixed(2)}`;
  return <div className="studio-financial-stage"><label htmlFor="receipt-discount">Discount: <strong>{discount}%</strong></label><input id="receipt-discount" type="range" min="0" max="40" step="5" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} /><label className="studio-vat-control" htmlFor="receipt-vat">VAT rate for this illustration <input id="receipt-vat" type="number" inputMode="decimal" min="0" max="25" step="0.5" value={vatRate} onChange={(event) => setVatRate(Math.min(25, Math.max(0, Number(event.target.value) || 0)))} />%</label><section className="studio-receipt" aria-label="Interactive illustrative shopping receipt"><h3>Odysseus Market <span>Illustrative only</span></h3><p><span>Original price</span><strong>{money(original)}</strong></p><p><span>{discount}% discount</span><strong>−{money(saved)}</strong></p><p><span>Price after discount</span><strong>{money(beforeVat)}</strong></p><p><span>VAT ({vatRate}%)</span><strong>{money(vat)}</strong></p><p className="is-total"><span>Final price</span><strong>{money(total)}</strong></p></section><p className="studio-stage-caption">For comparison: buying for R80 and selling for R100 gives a R20 profit; profit percentage is calculated from the cost price: 20 ÷ 80 = 25%.</p></div>;
}
