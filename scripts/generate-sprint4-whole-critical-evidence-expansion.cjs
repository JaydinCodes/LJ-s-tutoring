'use strict';

/*
 * Generates the additive expansion required by the persisted Whole Numbers
 * policy: Financial Applications is policy-critical and needs four distinct
 * primary-skill samples on each independent form. Historical question
 * versions, approved form snapshots, and learner attempts are untouched.
 */
const fs = require('node:fs');
const path = require('node:path');
const { buildBank } = require('./grade9-term1-assessment-content.cjs');
const { definitionCode } = require('./generate-grade9-term1-assessment-link-repair.cjs');

const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${sql(JSON.stringify(value))}::jsonb`;
const values = (rows) => rows.map((row) => `  (${row.join(', ')})`).join(',\n');

function expansionQuestions() {
  return buildBank().filter((question) => question.topic === 'WHOLE'
    && ['ENDLINE', 'MASTERY-CHALLENGE', 'ENDLINE-REASSESSMENT-B'].includes(question.form)
    && question.sequence > 16);
}

function buildSql() {
  const questions = expansionQuestions();
  const rows = questions.map((question) => [
    sql(question.code), sql(definitionCode(question.topic, question.form)), String(question.sequence),
    sql(question.skillCode), sql(question.prompt),
    json({ type: 'multiple_choice', options: question.options, correct_option: question.correctOption, distractor_explanations: question.distractorExplanations }),
    sql(question.solution), String(question.difficulty), sql(question.reasoningClassification),
    sql(question.reasoningClassification === 'mathematical_reasoning' ? 'complex' : 'routine'),
    sql(question.reasoningClassification === 'mathematical_reasoning' ? 'verbal' : 'symbolic'),
  ]);
  const definitionRows = [...new Set(questions.map((question) => definitionCode(question.topic, question.form)))].map((code) => [sql(code)]);
  return `-- Generated from scripts/generate-sprint4-whole-critical-evidence-expansion.cjs. Do not hand-edit.
-- Additive Sprint 4 Whole Numbers expansion. The persisted policy identifies
-- Financial Applications as critical, so each independent form gains two
-- unique financial items and a proportionate 30-minute duration. Existing
-- approved forms and historical learner evidence are intentionally immutable.

create temporary table whole_critical_evidence_expansion (
  item_code text not null,
  definition_code text not null,
  display_order smallint not null,
  skill_code text not null,
  prompt text not null,
  answer_config jsonb not null,
  solution text not null,
  difficulty smallint not null,
  reasoning_classification text not null,
  cognitive_level text not null,
  representation text not null
) on commit drop;

insert into whole_critical_evidence_expansion(
  item_code, definition_code, display_order, skill_code, prompt, answer_config,
  solution, difficulty, reasoning_classification, cognitive_level, representation
) values
${values(rows)};

insert into public.question_items(curriculum_version_id,item_code,source_tier,source_notes)
select curriculum.id,content.item_code,'Odysseus_authored',
  'Sprint 4 Whole Numbers critical-skill expansion: independently authored Financial Applications evidence.'
from whole_critical_evidence_expansion content
join public.curriculum_versions curriculum on curriculum.code='CAPS-MATH-G9-2026'
on conflict(curriculum_version_id,item_code) do nothing;

insert into public.question_versions(
  question_item_id,version_number,review_status,activity_type,cognitive_level,
  representation,difficulty,reasoning_classification,calculator_policy,prompt,
  answer_config,solution,marks,material_change_note
)
select item.id,1,'draft','independent_practice',
  content.cognitive_level::public.caps_cognitive_level,
  content.representation::public.math_representation,content.difficulty,
  content.reasoning_classification,'not_allowed',content.prompt,content.answer_config,
  content.solution,1,
  'Sprint 4 additive Whole Numbers critical-skill coverage expansion; new draft item with no historical response.'
from whole_critical_evidence_expansion content
join public.curriculum_versions curriculum on curriculum.code='CAPS-MATH-G9-2026'
join public.question_items item on item.curriculum_version_id=curriculum.id and item.item_code=content.item_code
left join public.question_versions existing on existing.question_item_id=item.id and existing.version_number=1
where existing.id is null;

insert into public.question_version_skill_links(question_version_id,skill_id,relationship_type)
select version.id,skill.id,'primary'
from whole_critical_evidence_expansion content
join public.curriculum_versions curriculum on curriculum.code='CAPS-MATH-G9-2026'
join public.question_items item on item.curriculum_version_id=curriculum.id and item.item_code=content.item_code
join public.question_versions version on version.question_item_id=item.id and version.version_number=1
join public.curriculum_skills skill on skill.skill_code=content.skill_code
on conflict(question_version_id,skill_id) do nothing;

-- Draft/rejected definitions remain editable. Do not alter an approved form or
-- its snapshot; administrators use the ordinary revision workflow instead.
insert into public.learning_assessment_definition_questions(
  learning_assessment_definition_id,question_version_id,display_order
)
select definition.id,version.id,content.display_order
from whole_critical_evidence_expansion content
join public.learning_assessment_definitions definition
  on definition.code=content.definition_code and definition.review_status in ('draft','rejected')
join public.curriculum_versions curriculum on curriculum.code='CAPS-MATH-G9-2026'
join public.question_items item on item.curriculum_version_id=curriculum.id and item.item_code=content.item_code
join public.question_versions version on version.question_item_id=item.id and version.version_number=1
on conflict(learning_assessment_definition_id,question_version_id)
  do update set display_order=excluded.display_order;

update public.learning_assessment_definitions
set duration_minutes=30, updated_at=now()
where code in (select definition_code from whole_critical_evidence_expansion)
  and review_status in ('draft','rejected');

do $$
declare v_definition text; v_actual integer;
begin
  for v_definition in values
${values(definitionRows)}
  loop
    select count(*) into v_actual
    from public.learning_assessment_definitions definition
    join public.learning_assessment_definition_questions link
      on link.learning_assessment_definition_id=definition.id
    where definition.code=v_definition and definition.review_status in ('draft','rejected');
    if v_actual not in (0,18) then
      raise exception 'whole_numbers_critical_evidence_expansion_count_mismatch: % expected 18 draft questions, found %', v_definition,v_actual
        using errcode='23514';
    end if;
  end loop;
end;
$$;
`;
}

if (require.main === module) {
  const output = path.join(__dirname, '..', 'supabase', 'migrations', '20261112230000_sprint4_whole_numbers_critical_evidence_expansion.sql');
  fs.writeFileSync(output, buildSql());
  process.stdout.write(`Generated ${output} with ${expansionQuestions().length} new Whole Numbers financial-evidence questions.\n`);
}

module.exports = { buildSql, expansionQuestions };
