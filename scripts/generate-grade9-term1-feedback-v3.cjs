'use strict';

/*
 * Generates the additive v3 feedback correction.  Do not regenerate the v2
 * migration from current source: v2 is a historical audit artifact.  This
 * revision creates new draft question versions only, leaving published and
 * attempted v1/v2 question versions immutable.
 */
const fs = require('node:fs');
const path = require('node:path');
const { buildPracticeQuestions } = require('./grade9-term1-learning-content.cjs');

const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${sql(JSON.stringify(value))}::jsonb`;
const values = (rows) => rows.map((row) => `  (${row.join(', ')})`).join(',\n');

function buildExplicitFeedbackV3Sql() {
  const questions = buildPracticeQuestions();
  const questionRows = questions.map((question) => [
    sql(question.code), sql(question.skillCode), sql(question.grade), sql(question.prompt),
    json({
      type: 'multiple_choice', options: question.options, correct_option: question.correctOption,
      distractor_explanations: question.distractorExplanations,
      feedback_source: question.feedbackSource,
    }),
    sql(question.solution), question.reasoning ? "'mathematical_reasoning'" : "'procedural'", question.reasoning ? "'complex'" : "'routine'",
  ]);
  const hintRows = questions.map((question) => [sql(question.code), sql(question.grade), sql(question.hint)]);
  const activityRows = questions.map((question, index) => [sql(question.activityCode), index % 4 < 2 ? '1' : '2', sql(question.code), sql(question.grade), String((index % 2) + 1)]);
  return `-- Generated from scripts/grade9-term1-learning-content.cjs. Do not hand-edit.
-- Additive Sprint 4 v3 explicit distractor-feedback corrections. v1/v2 remain retained for audit and attempt history.

with authored(item_code,skill_code,grade,prompt,answer_config,solution,reasoning_classification,cognitive_level) as (
values
${values(questionRows)}
)
insert into public.question_versions(question_item_id,version_number,review_status,activity_type,cognitive_level,representation,difficulty,reasoning_classification,calculator_policy,prompt,answer_config,solution,marks,material_change_note)
select item.id,3,'draft','guided_practice',authored.cognitive_level::public.caps_cognitive_level,'symbolic',case when authored.reasoning_classification='mathematical_reasoning' then 3 else 2 end,authored.reasoning_classification,'not_allowed',authored.prompt,authored.answer_config,authored.solution,1,'Sprint 4 v3: replaces inferred distractor feedback with individually authored misconception-specific feedback. Versions 1 and 2 remain immutable for audit and historical attempts.'
from authored
join public.curriculum_versions curriculum on curriculum.grade=authored.grade and curriculum.is_active
join public.question_items item on item.item_code=authored.item_code and item.curriculum_version_id=curriculum.id
on conflict(question_item_id,version_number) do nothing;

-- Each revision retains the canonical primary skill link independently.
with authored(item_code,skill_code,grade) as (
values
${values(questions.map((question) => [sql(question.code), sql(question.skillCode), sql(question.grade)]))}
)
insert into public.question_version_skill_links(question_version_id,skill_id,relationship_type)
select version_three.id,skill.id,'primary'
from authored
join public.curriculum_versions curriculum on curriculum.grade=authored.grade and curriculum.is_active
join public.question_items item on item.item_code=authored.item_code and item.curriculum_version_id=curriculum.id
join public.question_versions version_three on version_three.question_item_id=item.id and version_three.version_number=3
join public.curriculum_skills skill on skill.skill_code=authored.skill_code
-- The link's primary key is (question_version_id, skill_id); relationship_type
-- is deliberately not part of its conflict target.
on conflict do nothing;

with authored(item_code,grade,hint) as (
values
${values(hintRows)}
)
insert into public.question_hints(question_version_id,hint_level,prompt)
select version.id,1,authored.hint
from authored
join public.curriculum_versions curriculum on curriculum.grade=authored.grade and curriculum.is_active
join public.question_items item on item.item_code=authored.item_code and item.curriculum_version_id=curriculum.id
join public.question_versions version on version.question_item_id=item.id and version.version_number=3
on conflict(question_version_id,hint_level) do update set prompt=excluded.prompt;

-- Only unapproved activities move from their retained v1/v2 question version to v3.
-- Published historical activities and their learner evidence are never rewritten.
with authored(activity_code,stage_sequence,item_code,grade,display_order) as (
values
${values(activityRows)}
)
delete from public.learning_activity_stage_questions link
using public.learning_activity_stages stage, public.learning_activity_templates activity, public.curriculum_versions curriculum, public.question_items item, public.question_versions version_previous, authored
where link.learning_activity_stage_id=stage.id
  and stage.learning_activity_template_id=activity.id
  and link.question_version_id=version_previous.id
  and version_previous.question_item_id=item.id and version_previous.version_number in (1,2)
  and activity.code=authored.activity_code and stage.sequence_number=authored.stage_sequence and item.item_code=authored.item_code
  and item.curriculum_version_id=curriculum.id and curriculum.grade=authored.grade and curriculum.is_active
  and activity.review_status in ('draft','rejected');

with authored(activity_code,stage_sequence,item_code,grade,display_order) as (
values
${values(activityRows)}
)
insert into public.learning_activity_stage_questions(learning_activity_stage_id,question_version_id,display_order)
select stage.id,version_three.id,authored.display_order
from authored
join public.learning_activity_templates activity on activity.code=authored.activity_code and activity.review_status in ('draft','rejected')
join public.learning_activity_stages stage on stage.learning_activity_template_id=activity.id and stage.sequence_number=authored.stage_sequence
join public.curriculum_versions curriculum on curriculum.grade=authored.grade and curriculum.is_active
join public.question_items item on item.item_code=authored.item_code and item.curriculum_version_id=curriculum.id
join public.question_versions version_three on version_three.question_item_id=item.id and version_three.version_number=3
on conflict(learning_activity_stage_id,question_version_id) do update set display_order=excluded.display_order;
`;
}

if (require.main === module) {
  const output = path.join(__dirname, '..', 'supabase', 'migrations', '20261112190000_sprint4_explicit_distractor_feedback_v3.sql');
  fs.writeFileSync(output, buildExplicitFeedbackV3Sql());
  process.stdout.write(`Generated ${output} with ${buildPracticeQuestions().length} v3 question revisions.\n`);
}

module.exports = { buildExplicitFeedbackV3Sql };
