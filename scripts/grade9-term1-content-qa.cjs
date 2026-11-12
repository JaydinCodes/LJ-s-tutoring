'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { lessons, buildPracticeQuestions } = require('./grade9-term1-learning-content.cjs');

const requiredGrade9Skills = new Set([
  'G9-NUM-REAL-IRRATIONAL', 'G9-NUM-WHOLE-HCF-LCM', 'G9-NUM-RATIO-RATE', 'G9-NUM-DIRECT-INVERSE-PROPORTION', 'G9-NUM-FINANCIAL-APPLICATIONS',
  'G9-NUM-INTEGERS-OPERATIONS', 'G9-NUM-INTEGERS-POWERS-ROOTS', 'G9-EXP-LAWS-EXTENDED', 'G9-EXP-NEGATIVE-SCI', 'G9-EXP-SCI-NOTATION-EXTENSION',
  'G9-PAT-NUMERIC-STRUCTURE', 'G9-PAT-GENERAL-RULE', 'G9-PAT-GEOMETRIC-VISUAL',
]);
const banned = /placeholder|lorem ipsum|tbd|common operation error|unrelated answer/i;
const genericFeedback = /revisit the worked method|choose the correct answer|try again/i;
const normalise = (value) => String(value).toLowerCase().replace(/\s+/g, ' ').trim();

function inventory() {
  const questions = buildPracticeQuestions();
  return {
    contentVersion: 'sprint4-v2-mathematics-corrections', revisionOf: 'sprint4-v1', generatedAt: '2026-11-12',
    lessons: lessons.map((lesson) => ({
      skillCode: lesson.skillCode, grade: lesson.grade, title: lesson.title, objective: lesson.objective,
      explanation: lesson.explanation, workedExample: lesson.workedExample, misconception: lesson.misconception,
      practiceQuestions: questions.filter((question) => question.skillCode === lesson.skillCode).map((question) => ({
        code: question.code, prompt: question.prompt, options: question.options, correctOption: question.correctOption,
        distractorExplanations: question.distractorExplanations, solution: question.solution, hint: question.hint,
        reasoning: question.reasoning, reviewRecord: question.reviewRecord, activityCode: question.activityCode,
      })),
      publicationStatus: 'draft_requires_admin_review',
    })),
    totals: { lessons: lessons.length, grade9Lessons: lessons.filter((item) => item.grade === 'Grade 9').length, grade8BridgeLessons: lessons.filter((item) => item.grade === 'Grade 8').length, practiceQuestions: questions.length, activities: lessons.length },
  };
}

function validate() {
  const errors = []; const questions = buildPracticeQuestions();
  const lessonSkills = new Set(lessons.map((item) => item.skillCode));
  for (const skill of requiredGrade9Skills) if (!lessonSkills.has(skill)) errors.push(`Missing Grade 9 lesson for ${skill}.`);
  for (const lesson of lessons) {
    for (const field of ['title', 'objective', 'explanation', 'workedExample', 'misconception']) {
      const minimum = field === 'title' ? 8 : 24;
      if (!lesson[field] || lesson[field].trim().length < minimum) errors.push(`${lesson.skillCode}: missing or too-short ${field}.`);
    }
    if (!/\b(identify|classify|calculate|find|simplify|write|use|evaluate|extend|interpret|represent|decide|describe|explain|apply|model|connect|add|subtract|multiply|compare)\b/i.test(lesson.objective)) errors.push(`${lesson.skillCode}: learning objective needs an observable mathematical action.`);
    const set = questions.filter((question) => question.skillCode === lesson.skillCode);
    if (set.length !== 4) errors.push(`${lesson.skillCode}: expected exactly four focused practice questions, found ${set.length}.`);
    if (!set.some((question) => question.reasoning)) errors.push(`${lesson.skillCode}: needs a misconception or reasoning question.`);
  }
  const codes = new Set(); const prompts = new Set(); const feedbackTexts = [];
  const knownSkills = new Set(lessons.map((lesson) => lesson.skillCode));
  for (const question of questions) {
    if (codes.has(question.code)) errors.push(`${question.code}: duplicate stable item code.`); codes.add(question.code);
    const prompt = normalise(question.prompt);
    if (prompts.has(prompt)) errors.push(`${question.code}: duplicate prompt.`); prompts.add(prompt);
    const optionKeys = Object.keys(question.options).sort();
    if (optionKeys.join(',') !== 'A,B,C,D') errors.push(`${question.code}: needs A–D options.`);
    if (new Set(Object.values(question.options)).size !== 4) errors.push(`${question.code}: options must be distinct.`);
    if (!question.options[question.correctOption]) errors.push(`${question.code}: correct option is absent.`);
    if (!knownSkills.has(question.skillCode)) errors.push(`${question.code}: maps to an unknown skill.`);
    if (question.activityCode !== `A.${question.grade === 'Grade 8' ? 'G8' : 'G9'}.S4.${lessons.find((lesson) => lesson.skillCode === question.skillCode)?.slug}`) errors.push(`${question.code}: activity reference does not match its skill.`);
    const expectedDistractors = optionKeys.filter((key) => key !== question.correctOption).sort().join(',');
    if (Object.keys(question.distractorExplanations).sort().join(',') !== expectedDistractors) errors.push(`${question.code}: each distractor needs feedback.`);
    const feedback = Object.values(question.distractorExplanations);
    if (![question.prompt, question.solution, question.hint, ...Object.values(question.options), ...feedback].every((value) => String(value).trim().length && !banned.test(String(value)))) errors.push(`${question.code}: placeholder or incomplete instructional text.`);
    if (feedback.some((value) => genericFeedback.test(String(value)) || String(value).trim().length < 45)) errors.push(`${question.code}: distractor feedback must name a likely misconception and corrective method.`);
    if (new Set(feedback.map(normalise)).size !== feedback.length) errors.push(`${question.code}: distractor feedback is repeated within the question.`);
    feedback.forEach((value) => feedbackTexts.push({ code: question.code, value }));
    if (normalise(question.hint).includes(normalise(question.options[question.correctOption])) || normalise(question.hint).includes(normalise(question.correct))) errors.push(`${question.code}: hint reveals the keyed answer.`);
    if (question.solution.trim().length < 24 || /^answer[:.]?\s*$/i.test(question.solution.trim())) errors.push(`${question.code}: worked solution is not mathematically complete.`);
    if (question.reasoning && question.reviewRecord !== 'mathematics_reviewer_required') errors.push(`${question.code}: conceptual/reasoning item lacks a reviewer record.`);
  }
  for (let left = 0; left < feedbackTexts.length; left += 1) for (let right = left + 1; right < feedbackTexts.length; right += 1) {
    if (feedbackTexts[left].code !== feedbackTexts[right].code && normalise(feedbackTexts[left].value) === normalise(feedbackTexts[right].value)) errors.push(`${feedbackTexts[left].code}/${feedbackTexts[right].code}: duplicate distractor feedback needs independent wording.`);
  }
  // Independent deterministic checks for representative calculations and the visual-pattern rule.
  const answer = (code) => questions.find((question) => question.code === code)?.options[questions.find((question) => question.code === code)?.correctOption];
  if (answer('Q.G9.S4.PRACTICE.FINANCE.03') !== 'R1 749.60') errors.push('Compound-interest calculation check failed.');
  if (answer('Q.G9.S4.PRACTICE.PROPORTION.02') !== '4 hours') errors.push('Inverse-proportion calculation check failed.');
  if (answer('Q.G9.S4.PRACTICE.VISUAL-PATTERNS.01') !== '13') errors.push('Joined-square pattern rule check failed.');
  if (answer('Q.G9.S4.PRACTICE.NTH-TERM.01') !== '4n − 1') errors.push('Linear nth-term rule check failed.');
  if (answer('Q.G9.S4.PRACTICE.RATIO-RATE.04') !== 'The claim is incorrect: 4 : 6 = 2 : 3 and 10 : 15 = 2 : 3') errors.push('Ratio-equivalence correction check failed.');
  if (answer('Q.G9.S4.PRACTICE.POWERS-ROOTS.01') !== '25') errors.push('Negative-base square check failed.');
  if (!questions.find((question) => question.code === 'Q.G9.S4.PRACTICE.EXP-LAWS.02')?.prompt.includes('y ≠ 0')) errors.push('Exponent quotient-domain condition is missing.');
  if (!questions.find((question) => question.code === 'Q.G9.S4.PRACTICE.HCF-LCM.03')?.prompt.includes('starting time')) errors.push('LCM starting-time condition is missing.');
  if (!questions.find((question) => question.code === 'Q.G9.S4.PRACTICE.FINANCE.02')?.prompt.includes('refundable')) errors.push('Refundable-deposit condition is missing.');
  if (!lessons.find((lesson) => lesson.skillCode === 'G9-NUM-REAL-IRRATIONAL')?.explanation.includes('√(1/4) = 1/2')) errors.push('Rational-radicand clarification is missing.');
  if (!lessons.find((lesson) => lesson.skillCode === 'G9-EXP-SCI-NOTATION-EXTENSION')?.explanation.includes('1 ≤ |a| < 10')) errors.push('Signed scientific-notation condition is missing.');
  return errors;
}

const errors = validate();
if (errors.length) { process.stderr.write(`Grade 9 Term 1 content QA failed:\n- ${errors.join('\n- ')}\n`); process.exit(1); }
const summary = inventory();
if (process.argv.includes('--write')) {
  const output = path.join(__dirname, '..', 'docs', 'product', 'GRADE9_TERM1_INSTRUCTIONAL_CONTENT_EXPORT.json');
  fs.writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`Wrote ${output}\n`);
}
process.stdout.write(`Grade 9 Term 1 content QA passed: ${summary.totals.grade9Lessons} Grade 9 lessons, ${summary.totals.grade8BridgeLessons} Grade 8 bridges, ${summary.totals.practiceQuestions} practice questions and ${summary.totals.activities} activities.\n`);
