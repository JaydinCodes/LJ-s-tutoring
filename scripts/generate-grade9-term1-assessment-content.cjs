/* Generates review-only content artefacts and the additive database migration.
 * The source module remains the authoring source of truth. Do not hand-edit
 * the generated migration or reviewer export. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildBank } = require('./grade9-term1-assessment-content.cjs');

const root = path.resolve(__dirname, '..');
const migration = path.join(root, 'supabase/migrations/20261109120000_grade9_term1_content_reconstruction.sql');
const exportPath = path.join(root, 'docs/product/GRADE9_TERM1_ASSESSMENT_CONTENT_EXPORT.json');
const reviewPath = path.join(root, 'docs/product/GRADE9_TERM1_ASSESSMENT_CONTENT_REVIEW.md');

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
function topicDefinitionCode(topic, form) {
  if (form === 'ENTRY-BASELINE-A') return 'G9-T1-ENTRY-BASELINE-A';
  const label = { WHOLE: 'WHOLE', INT: 'INTEGERS', EXP: 'EXPONENTS', PAT: 'PATTERNS' }[topic];
  const suffix = {
    'TOPIC-BASELINE': 'MASTERY-TOPIC-BASELINE',
    ENDLINE: 'MASTERY-ENDLINE',
    'MASTERY-CHALLENGE': 'MASTERY-CHALLENGE',
    'ENDLINE-REASSESSMENT-B': 'MASTERY-ENDLINE-REASSESSMENT-B',
  }[form];
  return `G9-T1-${label}-${suffix}`;
}
function row(question) {
  const answerConfig = JSON.stringify({
    type: 'multiple_choice',
    options: question.options,
    correct_option: question.correctOption,
    distractor_explanations: question.distractorExplanations,
  });
  return `(${[
    sql(question.code), sql(topicDefinitionCode(question.topic, question.form)), question.sequence,
    sql(question.skillCode), sql(question.prompt), sql(answerConfig), sql(question.solution),
    question.difficulty, sql(question.reasoningClassification), sql(question.reasoningClassification === 'mathematical_reasoning' ? 'complex' : 'routine'),
    sql(question.reasoningClassification === 'mathematical_reasoning' ? 'verbal' : 'symbolic'),
  ].join(', ')})`;
}
function migrationText(bank) {
  const values = bank.map(row).join(',\n    ');
  return `-- Generated from scripts/grade9-term1-assessment-content.cjs.\n-- This is an additive correction: invalid generated draft candidates remain\n-- traceable, while only unreleased drafts are retired and relinked.\n\nwith content(item_code, definition_code, display_order, skill_code, prompt, answer_config, solution, difficulty, reasoning_classification, cognitive_level, representation) as (\n  values\n    ${values}\n), retired_links as (\n  delete from public.learning_assessment_definition_questions link\n  using public.learning_assessment_definitions definition, public.question_versions version, public.question_items item\n  where link.learning_assessment_definition_id = definition.id\n    and link.question_version_id = version.id\n    and version.question_item_id = item.id\n    and definition.review_status in ('draft', 'rejected')\n    and item.item_code like 'Q.G9.T1.%'\n    and item.item_code not like 'Q.G9.T1C.%'\n  returning item.id\n), retired_items as (\n  update public.question_items item\n  set retired_at = coalesce(item.retired_at, now())\n  where item.id in (select id from retired_links)\n    and not exists (\n      select 1 from public.question_versions version\n      join public.learning_assessment_form_questions snapshot on snapshot.question_version_id = version.id\n      where version.question_item_id = item.id\n    )\n  returning item.id\n), new_items as (\n  insert into public.question_items(curriculum_version_id, item_code, source_tier)\n  select curriculum.id, content.item_code, 'Odysseus_authored'\n  from content\n  join public.curriculum_versions curriculum on curriculum.code = 'CAPS-MATH-G9-2026'\n  on conflict (curriculum_version_id, item_code) do nothing\n  returning id\n)\ninsert into public.question_versions(\n  question_item_id, version_number, review_status, activity_type, cognitive_level, representation, difficulty, reasoning_classification, calculator_policy, prompt, answer_config, solution, marks, material_change_note\n)\nselect item.id, 1, 'draft', 'independent_practice', content.cognitive_level::public.caps_cognitive_level, content.representation::public.math_representation, content.difficulty, content.reasoning_classification, 'not_allowed', content.prompt, content.answer_config::jsonb, content.solution, 1, 'Content reconstruction v1: corrected original formal-assessment item; independent mathematical review remains required before publication.'\nfrom content\njoin public.question_items item on item.item_code = content.item_code\nleft join public.question_versions version on version.question_item_id = item.id and version.version_number = 1\nwhere version.id is null;\n\nwith content(item_code, definition_code, display_order, skill_code) as (\n  values\n    ${bank.map((question) => `(${sql(question.code)}, ${sql(topicDefinitionCode(question.topic, question.form))}, ${question.sequence}, ${sql(question.skillCode)})`).join(',\n    ')}\n)\ninsert into public.question_version_skill_links(question_version_id, skill_id, relationship_type)\nselect version.id, skill.id, 'primary'\nfrom content\njoin public.question_items item on item.item_code = content.item_code\njoin public.question_versions version on version.question_item_id = item.id and version.version_number = 1\njoin public.curriculum_skills skill on skill.skill_code = content.skill_code\non conflict (question_version_id, skill_id) do nothing;\n\nwith content(item_code, definition_code, display_order) as (\n  values\n    ${bank.map((question) => `(${sql(question.code)}, ${sql(topicDefinitionCode(question.topic, question.form))}, ${question.sequence})`).join(',\n    ')}\n)\ninsert into public.learning_assessment_definition_questions(learning_assessment_definition_id, question_version_id, display_order)\nselect definition.id, version.id, content.display_order\nfrom content\njoin public.learning_assessment_definitions definition on definition.code = content.definition_code\njoin public.question_items item on item.item_code = content.item_code\njoin public.question_versions version on version.question_item_id = item.id and version.version_number = 1\nwhere definition.review_status in ('draft', 'rejected')\non conflict (learning_assessment_definition_id, question_version_id) do update set display_order = excluded.display_order;\n\n-- Admin-only structural QA summary. This never approves or publishes content.\ncreate or replace function public.get_grade9_term1_assessment_content_qa()\nreturns jsonb language plpgsql security definer set search_path = '' as $$\nbegin\n  perform public.content_admin_required();\n  return coalesce((\n    select jsonb_agg(jsonb_build_object(\n      'definitionId', definition.id, 'code', definition.code,\n      'questionCount', count(link.question_version_id),\n      'reasoningQuestionCount', count(link.question_version_id) filter (where version.reasoning_classification = 'mathematical_reasoning'),\n      'correctOptionDistribution', jsonb_build_object(\n        'A', count(*) filter (where version.answer_config->>'correct_option' = 'A'),\n        'B', count(*) filter (where version.answer_config->>'correct_option' = 'B'),\n        'C', count(*) filter (where version.answer_config->>'correct_option' = 'C'),\n        'D', count(*) filter (where version.answer_config->>'correct_option' = 'D')\n      ),\n      'invalidQuestionCount', count(*) filter (where cardinality(public.validate_learning_answer_config(version.answer_config)) > 0),\n      'publicationValidation', public.get_learning_assessment_publication_validation(definition.id)\n    ) order by definition.code)\n    from public.learning_assessment_definitions definition\n    left join public.learning_assessment_definition_questions link on link.learning_assessment_definition_id = definition.id\n    left join public.question_versions version on version.id = link.question_version_id\n    where definition.code like 'G9-T1-%'\n    group by definition.id\n  ), '[]'::jsonb);\nend;\n$$;\nrevoke all on function public.get_grade9_term1_assessment_content_qa() from public;\ngrant execute on function public.get_grade9_term1_assessment_content_qa() to authenticated;\n`;
}
function countBy(items, key) {
  return Object.fromEntries([...items.reduce((map, item) => map.set(key(item), (map.get(key(item)) ?? 0) + 1), new Map())].sort());
}
function reviewText(bank) {
  const byDefinition = new Map();
  for (const question of bank) {
    const code = topicDefinitionCode(question.topic, question.form);
    if (!byDefinition.has(code)) byDefinition.set(code, []);
    byDefinition.get(code).push(question);
  }
  const rows = [...byDefinition].sort().map(([code, questions]) => {
    const distribution = countBy(questions, (q) => q.correctOption);
    const reasoning = questions.filter((q) => q.reasoningClassification === 'mathematical_reasoning').length;
    const skills = Object.keys(countBy(questions, (q) => q.skillCode)).join(', ');
    return `| ${code} | ${questions.length} | ${reasoning} | A ${distribution.A ?? 0} · B ${distribution.B ?? 0} · C ${distribution.C ?? 0} · D ${distribution.D ?? 0} | ${skills} | Draft — administrator publication required |`;
  }).join('\n');
  const byTopic = Object.entries(countBy(bank, (q) => q.topic)).map(([topic, count]) => `| ${topic} | ${count} | ${Object.keys(countBy(bank.filter((q) => q.topic === topic), (q) => q.skillCode)).join(', ')} |`).join('\n');
  return `# Grade 9 Term 1 assessment-content review pack\n\nGenerated from [the version-controlled source](../../scripts/grade9-term1-assessment-content.cjs). This document is for the project owner and mathematics-content reviewer. It does **not** assert an external educator review, approve content, or publish forms. The complete answer-key-bearing inspection export is [GRADE9_TERM1_ASSESSMENT_CONTENT_EXPORT.json](GRADE9_TERM1_ASSESSMENT_CONTENT_EXPORT.json), a repository-review/admin artefact and never a student static asset.\n\n## Inventory\n\n- 17 formal assessment definitions; 252 authored MCQs.\n- Entry baseline: 12 questions.\n- Four topic baselines: 48 questions.\n- Four endlines: 64 questions.\n- Four mastery challenges: 64 questions.\n- Four independent endline reassessments: 64 questions.\n\n| Topic code | Questions | Primary-skill coverage |\n| --- | ---: | --- |\n${byTopic}\n\n## Form blueprints and automated QA evidence\n\n| Form | Questions | Reasoning | Correct-option distribution | Primary skills | Publication readiness |\n| --- | ---: | ---: | --- | --- | --- |\n${rows}\n\nThe QA harness checks four choices, a single correct choice, actual non-placeholder distractors and rationales, worked-solution presence, mappings, duplicate codes, exact prompt collisions, independent-form overlap, reasoning evidence and answer-position distribution. Numeric families receive deterministic checks; conceptual/reasoning items are explicitly marked for reviewer inspection rather than falsely described as mechanically proven.\n\n## Curriculum coverage\n\n- **Whole Numbers:** real-number classification; factors, prime factorisation, HCF/LCM; ratio/rate; direct and inverse proportion; commission, rental and compound-interest applications.\n- **Integers:** signed operations, brackets and order, squares/cubes and roots, absolute values, temperature context, and sign-error diagnosis.\n- **Exponents:** product, quotient and power laws, zero and negative exponents, simplification, equivalence and domain reasoning. Scientific notation is not required for mastery.\n- **Numeric and Geometric Patterns:** first differences, tables, nth-term rules, joined-square matchsticks using M(n) = 3n + 1, verification and generalisation-error diagnosis.\n\n## Independence and mathematical review\n\nEach endline, mastery challenge and reassessment uses its own question codes and prompt/solution/answer data. The reassessment form is separately defined and can only be opened through a server-side administrator authorisation. Automated checks found no duplicate question codes or exact prompt collisions inside a form. Parameterised numerical families are intentionally listed in the export and remain a reviewer focus: automated structure cannot certify that two examples are pedagogically independent or that a conceptual explanation is best-in-class.\n\n## Review queue and publication status\n\nNo external educator has signed off this pack. The reviewer should inspect all reasoning items and the parameterised families before publication, particularly the question codes beginning Q.G9.T1C.*. All reconstructed questions and forms deliberately remain draft. Automated QA is a publication prerequisite, not publication authority. An authorised administrator must inspect this export, resolve any reported QA issue, use the existing review controls to approve the questions/form/policy, and explicitly publish the immutable form version.\n`;
}

const bank = buildBank();
fs.writeFileSync(migration, migrationText(bank));
fs.writeFileSync(exportPath, `${JSON.stringify({ generatedAt: 'source-controlled', questionCount: bank.length, questions: bank }, null, 2)}\n`);
fs.writeFileSync(reviewPath, reviewText(bank));
process.stdout.write(`Generated ${bank.length} authored questions, migration, reviewer export and review pack.\n`);
