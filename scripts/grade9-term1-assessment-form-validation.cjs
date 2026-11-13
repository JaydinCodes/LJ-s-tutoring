'use strict';

/* Review-only structural publication matrix. This models the same critical
 * skill minimum used by the database publication validator; it deliberately
 * records draft/approval blockers instead of declaring a form publishable. */
const fs = require('node:fs');
const path = require('node:path');
const { buildBank } = require('./grade9-term1-assessment-content.cjs');

const policyByTopic = {
  WHOLE: { code: 'G9-T1-WHOLE-MASTERY', version: 1, criticalSkills: ['G9-NUM-REAL-IRRATIONAL', 'G9-NUM-WHOLE-HCF-LCM', 'G9-NUM-RATIO-RATE'] },
  INT: { code: 'G9-T1-INTEGERS-MASTERY', version: 1, criticalSkills: ['G9-NUM-INTEGERS-OPERATIONS', 'G9-NUM-INTEGERS-POWERS-ROOTS'] },
  EXP: { code: 'G9-T1-EXPONENTS-MASTERY', version: 1, criticalSkills: ['G9-EXP-LAWS-EXTENDED', 'G9-EXP-NEGATIVE-SCI'] },
  PAT: { code: 'G9-T1-PATTERNS-MASTERY', version: 1, criticalSkills: ['G9-PAT-NUMERIC-STRUCTURE', 'G9-PAT-GENERAL-RULE', 'G9-PAT-GEOMETRIC-VISUAL'] },
};
const formDefinition = (topic, form) => {
  if (form === 'ENTRY-BASELINE-A') return 'G9-T1-ENTRY-BASELINE-A';
  const label = { WHOLE: 'WHOLE', INT: 'INTEGERS', EXP: 'EXPONENTS', PAT: 'PATTERNS' }[topic];
  // The historical definition was generated from a policy ending in MASTERY
  // plus the MASTERY-CHALLENGE form suffix. It remains draft-only, so report
  // the identifier the publication RPC actually resolves rather than a
  // cosmetically normalised code that does not exist in the database.
  const suffix = { 'TOPIC-BASELINE': 'MASTERY-TOPIC-BASELINE', ENDLINE: 'MASTERY-ENDLINE', 'MASTERY-CHALLENGE': 'MASTERY-MASTERY-CHALLENGE', 'ENDLINE-REASSESSMENT-B': 'MASTERY-ENDLINE-REASSESSMENT-B' }[form];
  return `G9-T1-${label}-${suffix}`;
};
const duration = (form) => ({ 'ENTRY-BASELINE-A': 20, 'TOPIC-BASELINE': 15, ENDLINE: 25, 'MASTERY-CHALLENGE': 25, 'ENDLINE-REASSESSMENT-B': 25 })[form];
const independentForms = new Set(['ENDLINE', 'MASTERY-CHALLENGE', 'ENDLINE-REASSESSMENT-B']);

function report() {
  const bank = buildBank();
  const groups = new Map();
  for (const question of bank) {
    const key = question.form === 'ENTRY-BASELINE-A' ? `ENTRY/${question.form}` : `${question.topic}/${question.form}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(question);
  }
  const forms = [...groups.entries()].map(([key, questions]) => {
    const [topic, form] = key.split('/');
    const policy = policyByTopic[topic] ?? null;
    const countBySkill = Object.fromEntries([...questions.reduce((counts, question) => counts.set(question.skillCode, (counts.get(question.skillCode) ?? 0) + 1), new Map())].sort());
    const reasoningEvidence = questions.filter((question) => question.reasoningClassification === 'mathematical_reasoning').length;
    const invalidQuestions = questions.filter((question) => Object.keys(question.options).length !== 4 || !question.options[question.correctOption]).map((question) => question.code);
    const criticalSkillCounts = policy ? Object.fromEntries(policy.criticalSkills.map((skill) => [skill, countBySkill[skill] ?? 0])) : {};
    const coverageBlockers = independentForms.has(form) && policy ? Object.entries(criticalSkillCounts).filter(([, count]) => count < 4).map(([skill, count]) => `CRITICAL_SKILL_UNDERSAMPLED:${skill}:${count}/4`) : [];
    const reasoningBlockers = form !== 'ENTRY-BASELINE-A' && reasoningEvidence < 2 ? [`INSUFFICIENT_REASONING_EVIDENCE:${reasoningEvidence}/2`] : [];
    const independenceBlockers = form === 'ENDLINE-REASSESSMENT-B' ? (() => {
      const endline = groups.get(`${topic}/ENDLINE`) ?? [];
      const prompts = new Set(endline.map((question) => question.prompt.toLowerCase().replace(/\s+/g, ' ').trim()));
      return questions.filter((question) => prompts.has(question.prompt.toLowerCase().replace(/\s+/g, ' ').trim())).map((question) => `REASSESSMENT_PROMPT_NOT_INDEPENDENT:${question.code}`);
    })() : [];
    const structuralBlockers = [...coverageBlockers, ...reasoningBlockers, ...independenceBlockers, ...invalidQuestions.map((code) => `INVALID_QUESTION:${code}`)];
    return {
      definitionCode: form === 'ENTRY-BASELINE-A' ? formDefinition('WHOLE', form) : formDefinition(topic, form), topic, assessmentForm: form, policyVersion: policy?.version ?? null,
      policyCode: policy?.code ?? null, recommendedDurationMinutes: duration(form), questionCount: questions.length,
      countPerPrimarySkill: countBySkill, countPerCriticalSkill: criticalSkillCounts, reasoningEvidenceCount: reasoningEvidence,
      invalidQuestions, structuralBlockers, databasePublicationBlockers: ['ASSESSMENT_DEFINITION_NOT_APPROVED', 'QUESTION_NOT_APPROVED_OR_INVALID', ...(policy ? ['POLICY_NOT_APPROVED'] : [])],
      publicationEligible: false,
      publicationEligibilityReason: structuralBlockers.length ? 'BLOCKED_BY_BLUEPRINT' : 'STRUCTURALLY_READY_BUT_DRAFT_REVIEW_AND_DATABASE_VALIDATION_REQUIRED',
    };
  }).sort((a, b) => a.definitionCode.localeCompare(b.definitionCode));
  const defects = forms.filter((form) => form.structuralBlockers.length);
  return {
    reportVersion: 'sprint4-closure-v1', generatedAt: '2026-11-12', source: 'scripts/grade9-term1-assessment-content.cjs',
    policyInterpretation: 'Whole Numbers has five instructional areas, but the approved draft policy identifies real-number classification, HCF/LCM, and ratio/rate as its three critical skills. Direct/inverse proportion and financial applications remain essential sampling areas, not duplicate critical evidence targets.',
    formCount: forms.length, forms, structuralFailures: defects.map((form) => ({ definitionCode: form.definitionCode, blockers: form.structuralBlockers })),
    allStructurallyReady: defects.length === 0, allDatabasePublishable: false,
  };
}

const output = path.join(__dirname, '..', 'docs', 'product', 'GRADE9_TERM1_ASSESSMENT_PUBLICATION_MATRIX.json');
const value = report();
if (process.argv.includes('--write')) fs.writeFileSync(output, `${JSON.stringify(value, null, 2)}\n`);
if (value.structuralFailures.length) {
  process.stderr.write(`Assessment form validation found ${value.structuralFailures.length} blueprint blocker(s).\n`);
  process.exit(1);
}
process.stdout.write(`Assessment form validation passed: ${value.formCount} forms are structurally sufficient; database publication remains review-gated.\n`);

module.exports = { report };
