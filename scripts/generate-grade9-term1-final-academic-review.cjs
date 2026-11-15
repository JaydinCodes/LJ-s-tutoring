'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { lessons, buildPracticeQuestions } = require('./grade9-term1-learning-content.cjs');

function escapeTable(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

function renderQuestion(question) {
  const options = Object.entries(question.options)
    .map(([key, value]) => `- ${key}${key === question.correctOption ? ' (correct)' : ''}: ${value}`)
    .join('\n');
  const feedback = Object.entries(question.distractorExplanations)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `- Selected ${key} — **${question.options[key]}**: ${value}`)
    .join('\n');
  return `### ${question.code}\n\n- Prompt: ${question.prompt}\n- Skill: ${question.skillCode}\n- Activity: ${question.activityCode}\n- Classification: ${question.reasoning ? 'Mathematical reasoning — reviewer record required' : 'Procedural — deterministic check plus reviewer inspection'}\n- Feedback source: ${question.feedbackSource}\n- Options:\n${options}\n- Worked solution: ${question.solution}\n- Hint: ${question.hint}\n- Individually authored incorrect-answer feedback:\n${feedback}\n`;
}

function generate() {
  const questions = buildPracticeQuestions();
  const sections = lessons.map((lesson) => {
    const lessonQuestions = questions.filter((question) => question.skillCode === lesson.skillCode);
    return `## ${lesson.grade} — ${lesson.title}\n\n- Skill: ${lesson.skillCode}\n- Objective: ${lesson.objective}\n- Explanation: ${lesson.explanation}\n- Worked example: ${lesson.workedExample}\n- Common misconception: ${lesson.misconception}\n\n${lessonQuestions.map(renderQuestion).join('\n')}`;
  });
  const inventory = lessons.map((lesson) => `| ${lesson.grade} | ${lesson.skillCode} | ${escapeTable(lesson.title)} | ${questions.filter((question) => question.skillCode === lesson.skillCode).length} |`).join('\n');
  return `# Grade 9 Term 1 final academic review package\n\n**Pack version:** sprint4-v3-explicit-distractor-feedback  \n**Generated:** 2026-11-12  \n**Purpose:** final mathematical inspection of the corrected instructional pack before an authorised administrator approves or publishes it.\n\n## Review status\n\n- **Authored:** Complete — 13 Grade 9 lessons, 6 Grade 8 bridge lessons, 76 practice questions, 19 practice activities, and 228 explicit incorrect-answer explanations.\n- **Mathematically reviewed:** The project’s ChatGPT reviewer granted conditional approval to the earlier Sprint 4 v2 pack. That historical conditional verdict is retained. It is **not** a final approval of this v3 feedback revision.\n- **Admin approved:** Not approved by this document.\n- **Published:** Not published to production by this document.\n- **Pilot-ready:** Pending the reviewer’s explicit v3 verdict and observed real-data release-gate results.\n\n## Required reviewer verdict\n\nReview the questions and feedback below, paying particular attention to whether each wrong-answer explanation identifies the selected misconception and gives an appropriate next mathematical idea. Return one of: **Approved**, **Approved with specified amendments**, or **Not approved**. Do not infer administrator approval or publication from an academic verdict.\n\n## Automated checks and human boundary\n\nThe companion QA process verifies all 76 stable codes, four distinct choices per question, correct option presence, exactly three feedback entries, explicit value-keyed feedback mapping, repeated/near-duplicate feedback, hints that do not reveal the answer, skill/activity links, key numerical regressions, and absence of the former inferred-feedback fallback. It cannot establish that every sentence is the best pedagogical diagnosis; [the semantic-review checklist](GRADE9_TERM1_DISTRACTOR_FEEDBACK_SEMANTIC_REVIEW.md) records that human decision explicitly.\n\n## Lesson inventory\n\n| Grade | Skill | Lesson | Questions |\n| --- | --- | --- | ---: |\n${inventory}\n\n## Mathematical assumptions retained from Sprint 4 v2\n\n- For a non-negative integer radicand, a square root is rational exactly when the integer is a perfect square; rational non-integer radicands can also have rational roots, for example √(1/4) = 1/2.\n- Standard scientific notation for non-zero real numbers uses 1 ≤ |a| < 10; the positive-number convention is a special case.\n- Exponent quotients state non-zero divisor conditions.\n- The HCF/LCM bus question says both buses start together; the rental question separates an upfront refundable deposit from net rental cost.\n- Scientific notation remains an optional Grade 9 Term 1 extension, not mastery-critical content.\n\n## Complete corrected content\n\n${sections.join('\n\n')}\n\n## Reviewer notes\n\n- Grade 8 bridges provide prerequisites in factors/order, fractions, decimals, signed numbers, exponent basics and patterns.\n- Reasoning-labelled items have reviewer records and are not certified solely by answer-key checks.\n- No final academic approval is asserted here.\n`;
}

if (require.main === module) {
  const output = path.join(__dirname, '..', 'docs', 'product', 'GRADE9_TERM1_FINAL_ACADEMIC_REVIEW.md');
  fs.writeFileSync(output, generate());
  process.stdout.write(`Wrote ${output}\n`);
}

module.exports = { generate };
