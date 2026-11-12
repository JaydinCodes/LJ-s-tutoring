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
const normalise = (value) => String(value).toLowerCase().replace(/\s+/g, ' ').trim();

function inventory() {
  const questions = buildPracticeQuestions();
  return {
    contentVersion: 'sprint4-v1', generatedAt: '2026-11-12',
    lessons: lessons.map((lesson) => ({
      skillCode: lesson.skillCode, grade: lesson.grade, title: lesson.title, objective: lesson.objective,
      explanation: lesson.explanation, workedExample: lesson.workedExample, misconception: lesson.misconception,
      practiceQuestions: questions.filter((question) => question.skillCode === lesson.skillCode).map((question) => ({
        code: question.code, prompt: question.prompt, options: question.options, correctOption: question.correctOption,
        distractorExplanations: question.distractorExplanations, solution: question.solution, hint: question.hint,
        reasoning: question.reasoning, activityCode: question.activityCode,
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
    const set = questions.filter((question) => question.skillCode === lesson.skillCode);
    if (set.length !== 4) errors.push(`${lesson.skillCode}: expected exactly four focused practice questions, found ${set.length}.`);
    if (!set.some((question) => question.reasoning)) errors.push(`${lesson.skillCode}: needs a misconception or reasoning question.`);
  }
  const codes = new Set(); const prompts = new Set();
  for (const question of questions) {
    if (codes.has(question.code)) errors.push(`${question.code}: duplicate stable item code.`); codes.add(question.code);
    const prompt = normalise(question.prompt);
    if (prompts.has(prompt)) errors.push(`${question.code}: duplicate prompt.`); prompts.add(prompt);
    const optionKeys = Object.keys(question.options).sort();
    if (optionKeys.join(',') !== 'A,B,C,D') errors.push(`${question.code}: needs A–D options.`);
    if (new Set(Object.values(question.options)).size !== 4) errors.push(`${question.code}: options must be distinct.`);
    if (!question.options[question.correctOption]) errors.push(`${question.code}: correct option is absent.`);
    const expectedDistractors = optionKeys.filter((key) => key !== question.correctOption).sort().join(',');
    if (Object.keys(question.distractorExplanations).sort().join(',') !== expectedDistractors) errors.push(`${question.code}: each distractor needs feedback.`);
    if (![question.prompt, question.solution, question.hint, ...Object.values(question.options), ...Object.values(question.distractorExplanations)].every((value) => String(value).trim().length && !banned.test(String(value)))) errors.push(`${question.code}: placeholder or incomplete instructional text.`);
  }
  // Independent deterministic checks for representative calculations and the visual-pattern rule.
  const answer = (code) => questions.find((question) => question.code === code)?.options[questions.find((question) => question.code === code)?.correctOption];
  if (answer('Q.G9.S4.PRACTICE.FINANCE.03') !== 'R1 749.60') errors.push('Compound-interest calculation check failed.');
  if (answer('Q.G9.S4.PRACTICE.PROPORTION.02') !== '4 hours') errors.push('Inverse-proportion calculation check failed.');
  if (answer('Q.G9.S4.PRACTICE.VISUAL-PATTERNS.01') !== '13') errors.push('Joined-square pattern rule check failed.');
  if (answer('Q.G9.S4.PRACTICE.NTH-TERM.01') !== '4n − 1') errors.push('Linear nth-term rule check failed.');
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
