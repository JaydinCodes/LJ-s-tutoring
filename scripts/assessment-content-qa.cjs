/* Structural, coverage and deterministic-arithmetic QA for the Grade 9 pack. */
'use strict';

const { buildBank, FORMS, TOPICS } = require('./grade9-term1-assessment-content.cjs');

const allowedSkills = new Set([
  'G9-NUM-REAL-IRRATIONAL', 'G9-NUM-WHOLE-HCF-LCM', 'G9-NUM-RATIO-RATE', 'G9-NUM-DIRECT-INVERSE-PROPORTION', 'G9-NUM-FINANCIAL-APPLICATIONS',
  'G9-NUM-INTEGERS-OPERATIONS', 'G9-NUM-INTEGERS-POWERS-ROOTS', 'G9-EXP-LAWS-EXTENDED', 'G9-EXP-NEGATIVE-SCI',
  'G9-PAT-NUMERIC-STRUCTURE', 'G9-PAT-GENERAL-RULE', 'G9-PAT-GEOMETRIC-VISUAL',
]);
const banned = /common (operation )?error|unrelated (answer|value)|sign, unit, or exponent error|substitute the values and preserve units/i;
// Preserve mathematical tokens and values. This catches true duplicate prompts
// without mistaking two independently authored examples of the same required
// curriculum skill for a duplicate merely because both contain "calculate".
const normalise = (value) => String(value).toLowerCase().replace(/\s+/g, ' ').trim();
function gcd(a, b) { return b ? gcd(b, a % b) : Math.abs(a); }
function lcm(a, b) { return Math.abs(a * b) / gcd(a, b); }
function validateDeterministic(question, errors) {
  const v = question.verification;
  const answer = question.options[question.correctOption];
  if (!v || v.kind === 'editorial') return;
  if (v.kind === 'hcf' && Number(answer) !== v.expected) errors.push(`${question.code}: HCF answer is not independently verified.`);
  if (v.kind === 'lcm' && Number(answer) !== v.expected) errors.push(`${question.code}: LCM answer is not independently verified.`);
  if (v.kind === 'factorisation') {
    const product = [...answer.matchAll(/(\d+)(?:\^(\d+))?/g)].reduce((total, match) => total * (Number(match[1]) ** Number(match[2] ?? 1)), 1);
    if (product !== v.value) errors.push(`${question.code}: stated prime factorisation multiplies to ${product}, not ${v.value}.`);
  }
  if (v.expected != null && ['percentage', 'rental', 'compound-interest', 'rate', 'inverse-proportion', 'direct-proportion', 'direct-ratio', 'perfect-square-classification'].includes(v.kind)) {
    const numeric = Number((answer.match(/-?\d+(?:\.\d+)?/) ?? [])[0]);
    if (Math.abs(numeric - Number(v.expected)) > 0.005) errors.push(`${question.code}: deterministic answer does not equal ${v.expected}.`);
  }
  if (v.kind === 'hcf' && gcd(v.a, v.b) !== v.expected) errors.push(`${question.code}: expected HCF is incorrect.`);
  if (v.kind === 'lcm' && lcm(v.a, v.b) !== v.expected) errors.push(`${question.code}: expected LCM is incorrect.`);
}
function main() {
  const bank = buildBank(); const errors = []; const warnings = [];
  const codes = new Set(); const forms = new Map();
  for (const q of bank) {
    if (codes.has(q.code)) errors.push(`${q.code}: duplicate code.`); codes.add(q.code);
    const options = Object.entries(q.options ?? {});
    if (options.length !== 4 || new Set(options.map(([, value]) => value.trim())).size !== 4) errors.push(`${q.code}: options must be four, non-empty and distinct.`);
    if (!['A', 'B', 'C', 'D'].includes(q.correctOption) || !q.options[q.correctOption]) errors.push(`${q.code}: invalid correct option.`);
    const wrong = ['A', 'B', 'C', 'D'].filter((key) => key !== q.correctOption);
    if (Object.keys(q.distractorExplanations ?? {}).sort().join() !== wrong.join()) errors.push(`${q.code}: requires rationale for exactly the three incorrect choices.`);
    if (options.some(([, value]) => banned.test(value)) || Object.values(q.distractorExplanations ?? {}).some((value) => banned.test(value))) errors.push(`${q.code}: contains a placeholder distractor or rationale.`);
    if (!q.solution || q.solution.length < 20) errors.push(`${q.code}: worked solution lacks an inspectable explanation.`);
    if (!allowedSkills.has(q.skillCode) || !Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 5) errors.push(`${q.code}: invalid skill or difficulty.`);
    if (!['procedural', 'mathematical_reasoning'].includes(q.reasoningClassification)) errors.push(`${q.code}: invalid reasoning classification.`);
    if (!forms.has(q.form)) forms.set(q.form, []); forms.get(q.form).push(q); validateDeterministic(q, errors);
  }
  if (bank.length !== 252) errors.push(`expected 252 questions, found ${bank.length}.`);
  for (const topic of TOPICS) {
    for (const [form, count] of FORMS) {
      const questions = bank.filter((q) => q.topic === topic && q.form === form);
      if (questions.length !== count) errors.push(`${topic}/${form}: expected ${count}, found ${questions.length}.`);
      const prompts = new Set();
      for (const question of questions) { const key = normalise(question.prompt); if (prompts.has(key)) errors.push(`${topic}/${form}: duplicate or parameter-clone prompt ${question.code}.`); prompts.add(key); }
      const reasoning = questions.filter((q) => q.reasoningClassification === 'mathematical_reasoning').length;
      if (form !== 'TOPIC-BASELINE' && reasoning < 4) errors.push(`${topic}/${form}: fewer than four reasoning questions.`);
      const distribution = Object.fromEntries(['A', 'B', 'C', 'D'].map((option) => [option, questions.filter((q) => q.correctOption === option).length]));
      if (Math.max(...Object.values(distribution)) > Math.ceil(count * 0.55)) warnings.push(`${topic}/${form}: option distribution warning ${JSON.stringify(distribution)}.`);
    }
  }
  for (const topic of TOPICS) {
    const formal = bank.filter((q) => q.topic === topic && q.form !== 'TOPIC-BASELINE');
    const skills = new Map(); for (const q of formal) skills.set(q.skillCode, (skills.get(q.skillCode) ?? 0) + 1);
    if ([...skills.values()].some((count) => count < 4)) errors.push(`${topic}: a mastery-form skill has fewer than four independent questions.`);
  }
  const independent = ['ENDLINE', 'MASTERY-CHALLENGE', 'ENDLINE-REASSESSMENT-B'];
  for (const topic of TOPICS) for (let index = 0; index < independent.length; index += 1) for (let other = index + 1; other < independent.length; other += 1) {
    const a = new Set(bank.filter((q) => q.topic === topic && q.form === independent[index]).map((q) => normalise(q.prompt)));
    const b = bank.filter((q) => q.topic === topic && q.form === independent[other]).map((q) => normalise(q.prompt));
    const overlap = b.filter((prompt) => a.has(prompt)).length;
    if (overlap) errors.push(`${topic}: independent forms ${independent[index]} and ${independent[other]} share ${overlap} normalised prompt(s).`);
  }
  if (errors.length) { process.stderr.write(`Assessment content QA failed:\n- ${errors.join('\n- ')}\n`); process.exit(1); }
  process.stdout.write(`Assessment content QA passed: ${bank.length} questions across 17 forms.\n`);
  if (warnings.length) process.stdout.write(`Warnings for administrator review:\n- ${warnings.join('\n- ')}\n`);
}
main();
