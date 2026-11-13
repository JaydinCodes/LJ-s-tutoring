'use strict';

/*
 * Generates a narrowly-scoped additive repair for the Grade 9 Term 1 formal
 * bank.  Earlier reconstruction migrations retained canonical question rows
 * but left four 16-question draft form links absent in a clean rebuild.  This
 * repair only rewires draft/rejected definitions; approved form snapshots and
 * their historical learner evidence remain immutable.
 */
const fs = require('node:fs');
const path = require('node:path');
const { buildBank } = require('./grade9-term1-assessment-content.cjs');

const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${sql(JSON.stringify(value))}::jsonb`;
const values = (rows) => rows.map((row) => `  (${row.join(', ')})`).join(',\n');

function definitionCode(topic, form) {
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

function questionRows(bank) {
  return bank.map((question) => [
    sql(question.code), sql(definitionCode(question.topic, question.form)), String(question.sequence),
    sql(question.skillCode), sql(question.prompt),
    json({ type: 'multiple_choice', options: question.options, correct_option: question.correctOption, distractor_explanations: question.distractorExplanations }),
    sql(question.solution), String(question.difficulty), sql(question.reasoningClassification),
    sql(question.reasoningClassification === 'mathematical_reasoning' ? 'complex' : 'routine'),
    sql(question.reasoningClassification === 'mathematical_reasoning' ? 'verbal' : 'symbolic'),
  ]);
}

function buildSql() {
  const bank = buildBank();
  const expected = [...new Map(
    bank.map((question) => [definitionCode(question.topic, question.form), 0]),
  ).keys()].map((code) => [sql(code), String(bank.filter((question) => definitionCode(question.topic, question.form) === code).length)]);
  return `-- Generated from scripts/generate-grade9-term1-assessment-link-repair.cjs. Do not hand-edit.
-- Additive Sprint 4 repair: restore the canonical 17 draft Grade 9 Term 1
-- form blueprints. Approved/published definitions and form snapshots are not
-- changed, preserving audit history and historical learner attempts.

create temporary table grade9_term1_assessment_repair_content (
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

insert into grade9_term1_assessment_repair_content(
  item_code, definition_code, display_order, skill_code, prompt, answer_config,
  solution, difficulty, reasoning_classification, cognitive_level, representation
) values
${values(questionRows(bank))};

-- Question identities are inserted only if an earlier draft migration did not
-- create them. Existing items, their versions and all learner evidence remain.
insert into public.question_items(curriculum_version_id,item_code,source_tier,source_notes)
select curriculum.id, content.item_code, 'Odysseus_authored',
  'Grade 9 Term 1 canonical formal-assessment candidate restored by Sprint 4 blueprint repair.'
from grade9_term1_assessment_repair_content content
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
  'Sprint 4 canonical formal-bank repair: restored missing draft blueprint linkage without replacing historical versions.'
from grade9_term1_assessment_repair_content content
join public.curriculum_versions curriculum on curriculum.code='CAPS-MATH-G9-2026'
join public.question_items item on item.curriculum_version_id=curriculum.id and item.item_code=content.item_code
left join public.question_versions version_one on version_one.question_item_id=item.id and version_one.version_number=1
where version_one.id is null;

-- Preserve the Whole Numbers v2 blueprint correction where it exists; all
-- other records use their canonical v1. This does not conflate a response
-- with multiple skill samples and retains a primary skill on every live item.
insert into public.question_version_skill_links(question_version_id,skill_id,relationship_type)
select selected_version.id,skill.id,'primary'
from grade9_term1_assessment_repair_content content
join public.curriculum_versions curriculum on curriculum.code='CAPS-MATH-G9-2026'
join public.question_items item on item.curriculum_version_id=curriculum.id and item.item_code=content.item_code
join lateral (
  select version.id
  from public.question_versions version
  where version.question_item_id=item.id
  order by version.version_number desc
  limit 1
) selected_version on true
join public.curriculum_skills skill on skill.skill_code=content.skill_code
on conflict(question_version_id,skill_id) do nothing;

-- Draft definitions are configuration, not learner evidence. Replace only
-- their old Grade 9 candidate links with the canonical independent set. An
-- approved definition is deliberately excluded so its published form remains
-- an immutable historical snapshot.
delete from public.learning_assessment_definition_questions link
using public.learning_assessment_definitions definition,
      public.question_versions version,
      public.question_items item
where link.learning_assessment_definition_id=definition.id
  and link.question_version_id=version.id
  and version.question_item_id=item.id
  and definition.code in (select distinct definition_code from grade9_term1_assessment_repair_content)
  and definition.review_status in ('draft','rejected')
  and item.item_code like 'Q.G9.T1.%';

insert into public.learning_assessment_definition_questions(
  learning_assessment_definition_id,question_version_id,display_order
)
select definition.id,selected_version.id,content.display_order
from grade9_term1_assessment_repair_content content
join public.learning_assessment_definitions definition
  on definition.code=content.definition_code and definition.review_status in ('draft','rejected')
join public.curriculum_versions curriculum on curriculum.code='CAPS-MATH-G9-2026'
join public.question_items item on item.curriculum_version_id=curriculum.id and item.item_code=content.item_code
join lateral (
  select version.id
  from public.question_versions version
  where version.question_item_id=item.id
  order by version.version_number desc
  limit 1
) selected_version on true
on conflict(learning_assessment_definition_id,question_version_id)
  do update set display_order=excluded.display_order;

do $$
declare v_definition text; v_expected integer; v_actual integer;
begin
  for v_definition,v_expected in
    values
${values(expected)}
  loop
    select count(*) into v_actual
    from public.learning_assessment_definition_questions link
    join public.learning_assessment_definitions definition on definition.id=link.learning_assessment_definition_id
    where definition.code=v_definition;
    if v_actual <> v_expected then
      raise exception 'grade9_term1_assessment_blueprint_count_mismatch: % expected %, found %', v_definition,v_expected,v_actual
        using errcode='23514';
    end if;
  end loop;
end;
$$;
`;
}

if (require.main === module) {
  const output = path.join(__dirname, '..', 'supabase', 'migrations', '20261112200000_sprint4_grade9_assessment_blueprint_link_repair.sql');
  fs.writeFileSync(output, buildSql());
  process.stdout.write(`Generated ${output} with ${buildBank().length} canonical formal-question links.\n`);
}

module.exports = { buildSql, definitionCode };
