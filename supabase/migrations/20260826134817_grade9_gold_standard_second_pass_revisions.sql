
with revision(item_code, activity_type, cognitive_level, representation, difficulty, prompt, answer_config, solution, marks, primary_skill_code, material_change_note) as (
  values
    ('Q.G9.DIAG.03','diagnostic','routine','symbolic',1,'Simplify: 4x + 3x - 2.','{"accepted_answers":["7x - 2"]}'::jsonb,'4x and 3x are like terms: 4x + 3x = 7x. The constant -2 remains, so 4x + 3x - 2 = 7x - 2.',2::numeric,'G9.ALG.LIKE_TERMS','Second-pass review: memo now explicitly states the complete simplified expression.'),
    ('Q.G9.VERTICAL.01','retrieval','routine','symbolic',2,'Simplify: 5a - 2a + 3.','{"accepted_answers":["3a + 3"]}'::jsonb,'5a and -2a are like terms, so 5a - 2a = 3a. The constant 3 is unlike a-terms and remains unchanged: 3a + 3.',2::numeric,'G9.ALG.LIKE_TERMS','Second-pass review: expanded memo to show the like-term combination and retained constant.'),
    ('Q.G9.DOTS.02','diagnostic','routine','symbolic',2,'Expand: (x - 5)(x + 5).','{"accepted_answers":["x?? - 25"]}'::jsonb,'The middle terms cancel: x?? + 5x - 5x - 25 = x?? - 25.',2::numeric,'G9.ALG.EXPAND.BINOMIAL','Second-pass review: retained as an expansion item and removed the unrelated Difference of Two Squares supporting-skill link.'),
    ('Q.G9.VERTICAL.02','guided_practice','routine','symbolic',2,'Expand: -(x - 4).','{"accepted_answers":["-x + 4"]}'::jsonb,'Treat the negative sign as multiplication by -1: -(x - 4) = (-1)(x - 4) = -x + 4.',2::numeric,'G9.ALG.DISTRIBUTIVE','Second-pass review: added an ordered guidance ladder consistent with guided practice.'),
    ('Q.G9.DOTS.13','interleaved_review','routine','symbolic',3,'Choose the method and factorise: 6x + 18.','{"accepted_answers":["6(x + 3)"]}'::jsonb,'Both terms have a common factor of 6: 6x + 18 = 6(x + 3). This is common factorisation, not a difference of squares.',2::numeric,'G9.ALG.FACTOR.COMMON','Second-pass review: cognitive level corrected to routine and memo made explicit.'),
    ('Q.G9.VERTICAL.05','independent_practice','routine','symbolic',3,'Simplify: (x?? - 9)/(x - 3). State any restriction on x.','{"accepted_answers":["x + 3, x ??? 3","x + 3; x ??? 3"],"required_conditions":["x ??? 3"]}'::jsonb,'Factor the numerator: (x?? - 9)/(x - 3) = ((x - 3)(x + 3))/(x - 3) = x + 3, provided x ??? 3. The restriction remains because the original denominator cannot be zero.',3::numeric,'G9.ALG.FRACTIONS.SIMPLIFY','Second-pass review: cognitive level corrected to routine and the original-domain restriction is now required in the prompt, answer configuration and memo.'),
    ('Q.G9.DOTS.01','retrieval','knowledge','symbolic',1,'Which of 25, 27, 36, 45, 49, 81 and 90 are perfect squares?','{"accepted_answers":["25, 36, 49, 81"]}'::jsonb,'25 = 5??, 36 = 6??, 49 = 7?? and 81 = 9??. The other listed numbers are not perfect squares.',2::numeric,'G9.ALG.EXPAND.BINOMIAL','Second-pass review: made the retrieval discriminating and mapped its evidence to the existing canonical prerequisite skill rather than direct Difference of Two Squares mastery; no separate perfect-square-recognition skill exists in this pilot scope.'),
    ('Q.G9.DIAG.07','diagnostic','routine','symbolic',3,'Factorise: x?? - 25.','{"accepted_answers":["(x - 5)(x + 5)"]}'::jsonb,'Recognise x?? - 25 as x?? - 5?? and use a?? - b?? = (a - b)(a + b): (x - 5)(x + 5).',2::numeric,'G9.ALG.FACTOR.DOTS','Second-pass review: cognitive level corrected to routine.'),
    ('Q.G9.DOTS.03','worked_example','routine','symbolic',2,'Factorise: x?? - 25.','{"accepted_answers":["(x - 5)(x + 5)"]}'::jsonb,'x?? - 25 = x?? - 5?? = (x - 5)(x + 5).',2::numeric,'G9.ALG.FACTOR.DOTS','Second-pass review: corrected hint values to match x?? - 25 and its square root 5.'),
    ('Q.G9.DOTS.04','faded_example','routine','symbolic',2,'Complete: y?? - 49 = (y - 7)(y + __ ).','{"accepted_answers":["7"]}'::jsonb,'49 = 7??, so both factors use 7: (y - 7)(y + 7).',1::numeric,'G9.ALG.FACTOR.DOTS','Second-pass review: corrected hint values to match y?? - 49 and its square root 7.'),
    ('Q.G9.DOTS.09','error_analysis','complex','symbolic',3,'A learner says x?? - 64 = (x - 8)??. Explain and correct the factorisation.','{"accepted_answers":["(x - 8)(x + 8)"],"response_format":"explanation_and_factorisation","required_response_parts":[{"part_key":"explanation","accepted_concepts":["(x - 8)?? = x?? - 16x + 64","not x?? - 64"]},{"part_key":"correct_factorisation","accepted_answers":["(x - 8)(x + 8)"]}]}'::jsonb,'(x - 8)?? expands to x?? - 16x + 64, not x?? - 64. Since 64 = 8??, x?? - 64 = (x - 8)(x + 8).',3::numeric,'G9.ALG.FACTOR.DOTS','Second-pass review: answer configuration now requires both an explanation and the corrected factorisation.'),
    ('Q.G9.DIAG.09','diagnostic','routine','symbolic',2,'Solve: 3x + 12 = 21. Show the operation on both sides at each step.','{"accepted_answers":["x = 3"],"response_format":"worked_steps","required_working_steps":["3x + 12 - 12 = 21 - 12","3x = 9","3x ?? 3 = 9 ?? 3","x = 3"],"misconception_observation":{"code":"EQN_DIVIDE_ONE_SIDE_ONLY","requires_working":true}}'::jsonb,'Subtract 12 from both sides: 3x + 12 - 12 = 21 - 12, so 3x = 9. Divide both sides by 3: 3x ?? 3 = 9 ?? 3, so x = 3.',2::numeric,'G9.EQN.MULTI_STEP','Second-pass review: prompt and answer configuration now capture balanced working before a DIVIDE_ONE_SIDE_ONLY misconception is considered.'),
    ('Q.G9.VERTICAL.07','independent_practice','routine','symbolic',3,'Solve: (x - 4)(x + 1) = 0.','{"accepted_answers":["x = 4 or x = -1"]}'::jsonb,'Apply the zero-product principle: x - 4 = 0 or x + 1 = 0. Therefore x = 4 or x = -1.',2::numeric,'G9.EQN.FACTORISED','Second-pass review: cognitive level corrected to routine and the unnecessary Difference of Two Squares prerequisite was removed from the skill graph.'),
    ('Q.G9.DIAG.12','diagnostic','knowledge','verbal',1,'A point is 2 units to the right and 1 unit down from the origin. Write its ordered pair.','{"accepted_answers":["(2, -1)"]}'::jsonb,'Moving right gives a positive x-coordinate of 2. Moving down gives a negative y-coordinate of -1, so the ordered pair is (2, -1).',1::numeric,'G9.GRAPH.ORDERED_PAIRS','Second-pass review: redesigned the non-discriminating pseudo-graphical prompt as a verbal-to-ordered-pair diagnostic and corrected representation metadata.'),
    ('Q.G9.DIAG.15','diagnostic','routine','symbolic',2,'Find the gradient through (1, 2) and (3, 6).','{"accepted_answers":["2"]}'::jsonb,'The change in y is 6 - 2 = 4 and the change in x is 3 - 1 = 2, so the gradient is 4/2 = 2.',2::numeric,'G9.GRAPH.GRADIENT','Second-pass review: representation corrected from graphical to symbolic because the item supplies coordinate pairs rather than a graph.'),
    ('Q.G9.VERTICAL.10','representation_translation','routine','verbal',2,'A point is 2 units left and 3 units up from the origin. Write its ordered pair.','{"accepted_answers":["(-2, 3)"]}'::jsonb,'Moving 2 units left gives x = -2 and moving 3 units up gives y = 3, so the ordered pair is (-2, 3).',1::numeric,'G9.GRAPH.PLOT_POINTS','Second-pass review: redesigned the prompt so it no longer supplies the requested ordered pair and corrected representation metadata.'),
    ('Q.G9.VERTICAL.12','representation_translation','routine','tabular',3,'A table has x: 0, 1, 2 and y: 3, 5, 7. Write the rule.','{"accepted_answers":["y = 2x + 3"]}'::jsonb,'When x increases by 1, y increases by 2, so the gradient is 2. When x = 0, y = 3, so the y-intercept is 3. The rule is y = 2x + 3.',2::numeric,'G9.GRAPH.RULE_FROM_TABLE','Second-pass review: cognitive level corrected to routine and the skill graph now uses Gradient rather than the reverse table-from-rule skill as its direct prerequisite.'),
    
    ('Q.G9.VERTICAL.16','investigation','problem_solving','verbal',3,'Taxi A costs R10 plus R2 per kilometre. Taxi B costs R4 plus R3 per kilometre. At what distance do the taxis cost the same? Which taxi costs less for a 3 km trip and for a 10 km trip? Explain your reasoning.','{"accepted_answers":["6 km; Taxi B for 3 km; Taxi A for 10 km"],"response_format":"multi_part_investigation","required_response_parts":[{"key":"equal_cost_distance","accepted_answers":["6 km","6"]},{"key":"lower_cost_at_3km","accepted_answers":["Taxi B"]},{"key":"lower_cost_at_10km","accepted_answers":["Taxi A"]},{"key":"reasoning","accepted_concepts":["10 + 2d = 4 + 3d","Taxi A: R16 and Taxi B: R13 at 3 km","Taxi A: R30 and Taxi B: R34 at 10 km"]}]} '::jsonb,'Let d be the distance in kilometres. Equal cost: 10 + 2d = 4 + 3d, so d = 6. For 3 km, Taxi A costs R16 and Taxi B costs R13, so Taxi B costs less. For 10 km, Taxi A costs R30 and Taxi B costs R34, so Taxi A costs less.',3::numeric,'G9.GRAPH.COMPARE_RELATIONSHIPS','Second-pass review: redesigned as a genuine multi-part comparison/investigation with required reasoning.') -- gitleaks:allow 
), latest as (
  select distinct on (version.question_item_id) version.question_item_id, version.version_number, version.calculator_policy
  from public.question_versions version
  join public.question_items item on item.id = version.question_item_id
  join revision on revision.item_code = item.item_code
  order by version.question_item_id, version.version_number desc
)
insert into public.question_versions (question_item_id, version_number, activity_type, cognitive_level, representation, difficulty, calculator_policy, prompt, answer_config, solution, marks, review_status, material_change_note)
select latest.question_item_id, latest.version_number + 1, revision.activity_type::public.question_activity_type, revision.cognitive_level::public.caps_cognitive_level, revision.representation::public.math_representation, revision.difficulty, latest.calculator_policy, revision.prompt, revision.answer_config, revision.solution, revision.marks, 'draft', revision.material_change_note
from revision
join public.question_items item on item.item_code = revision.item_code
join latest on latest.question_item_id = item.id
on conflict (question_item_id, version_number) do nothing;

-- Copy expected misconceptions to new versions; these remain item metadata.
insert into public.question_version_misconceptions (question_version_id, misconception_id)
select revised.id, existing.misconception_id
from public.question_versions revised
join public.question_versions previous on previous.question_item_id = revised.question_item_id and previous.version_number = revised.version_number - 1
join public.question_items item on item.id = revised.question_item_id
join public.question_version_misconceptions existing on existing.question_version_id = previous.id
where revised.version_number = 2
  and item.item_code in ('Q.G9.DIAG.03','Q.G9.DIAG.07','Q.G9.DIAG.09','Q.G9.DIAG.12','Q.G9.DOTS.03','Q.G9.DOTS.04','Q.G9.DOTS.09','Q.G9.VERTICAL.01','Q.G9.VERTICAL.02','Q.G9.VERTICAL.07','Q.G9.VERTICAL.10','Q.G9.VERTICAL.12')
on conflict do nothing;

-- Copy only still-relevant supporting links. DOTS.02 is intentionally primary
-- expansion evidence only; it no longer carries a DOTS supporting mapping.
insert into public.question_version_skill_links (question_version_id, skill_id, relationship_type)
select revised.id, existing.skill_id, 'supporting'
from public.question_versions revised
join public.question_versions previous on previous.question_item_id = revised.question_item_id and previous.version_number = revised.version_number - 1
join public.question_items item on item.id = revised.question_item_id
join public.question_version_skill_links existing on existing.question_version_id = previous.id
where revised.version_number = 2 and existing.relationship_type = 'supporting' and item.item_code <> 'Q.G9.DOTS.02'
on conflict do nothing;

with primary_skills(item_code, skill_code) as (
  values
    ('Q.G9.DIAG.03','G9.ALG.LIKE_TERMS'), ('Q.G9.VERTICAL.01','G9.ALG.LIKE_TERMS'), ('Q.G9.DOTS.02','G9.ALG.EXPAND.BINOMIAL'), ('Q.G9.VERTICAL.02','G9.ALG.DISTRIBUTIVE'), ('Q.G9.DOTS.13','G9.ALG.FACTOR.COMMON'), ('Q.G9.VERTICAL.05','G9.ALG.FRACTIONS.SIMPLIFY'), ('Q.G9.DOTS.01','G9.ALG.EXPAND.BINOMIAL'), ('Q.G9.DIAG.07','G9.ALG.FACTOR.DOTS'), ('Q.G9.DOTS.03','G9.ALG.FACTOR.DOTS'), ('Q.G9.DOTS.04','G9.ALG.FACTOR.DOTS'), ('Q.G9.DOTS.09','G9.ALG.FACTOR.DOTS'), ('Q.G9.DIAG.09','G9.EQN.MULTI_STEP'), ('Q.G9.VERTICAL.07','G9.EQN.FACTORISED'), ('Q.G9.DIAG.12','G9.GRAPH.ORDERED_PAIRS'), ('Q.G9.DIAG.15','G9.GRAPH.GRADIENT'), ('Q.G9.VERTICAL.10','G9.GRAPH.PLOT_POINTS'), ('Q.G9.VERTICAL.12','G9.GRAPH.RULE_FROM_TABLE'), ('Q.G9.VERTICAL.16','G9.GRAPH.COMPARE_RELATIONSHIPS')
)
insert into public.question_version_skill_links (question_version_id, skill_id, relationship_type)
select revised.id, skill.id, 'primary'
from primary_skills
join public.question_items item on item.item_code = primary_skills.item_code
join public.question_versions revised on revised.question_item_id = item.id and revised.version_number = 2
join public.curriculum_skills skill on skill.skill_code = primary_skills.skill_code and skill.subject_id = (select subject_id from public.curriculum_versions where id = item.curriculum_version_id)
on conflict do nothing;

with hint_seed(item_code, hint_level, prompt) as (
  values
    ('Q.G9.VERTICAL.02',1::smallint,'Treat the negative sign as multiplication by -1.'), ('Q.G9.VERTICAL.02',2::smallint,'Rewrite -(x - 4) as (-1)(x - 4).'), ('Q.G9.VERTICAL.02',3::smallint,'Multiply -1 by x and then by -4.'), ('Q.G9.VERTICAL.02',4::smallint,'Complete: (-1)x + (-1)(-4) = -x + __.'), ('Q.G9.VERTICAL.02',5::smallint,'-(x - 4) = -x + 4.'),
    ('Q.G9.DOTS.03',1::smallint,'Look at both terms. Are they perfect squares?'), ('Q.G9.DOTS.03',2::smallint,'Recall: a?? - b?? = (a - b)(a + b).'), ('Q.G9.DOTS.03',3::smallint,'x?? = x?? and 25 = 5??.'), ('Q.G9.DOTS.03',4::smallint,'Complete: (x - 5)(x + ___).'), ('Q.G9.DOTS.03',5::smallint,'x?? - 25 = (x - 5)(x + 5).'),
    ('Q.G9.DOTS.04',1::smallint,'First express 49 as a perfect square.'), ('Q.G9.DOTS.04',2::smallint,'Use the difference-of-two-squares structure.'), ('Q.G9.DOTS.04',3::smallint,'49 = 7??.'), ('Q.G9.DOTS.04',4::smallint,'Complete: (y - 7)(y + ___).'), ('Q.G9.DOTS.04',5::smallint,'y?? - 49 = (y - 7)(y + 7).'),
    ('Q.G9.DOTS.09',1::smallint,'A difference of squares is not a binomial square.'), ('Q.G9.DOTS.09',2::smallint,'Compare a?? - b?? with (a - b)??.'), ('Q.G9.DOTS.09',3::smallint,'64 = 8??.'), ('Q.G9.DOTS.09',4::smallint,'Complete: (x - 8)(x + ___).'), ('Q.G9.DOTS.09',5::smallint,'x?? - 64 = (x - 8)(x + 8).')
)
insert into public.question_hints (question_version_id, hint_level, prompt)
select revised.id, hint_seed.hint_level, hint_seed.prompt
from hint_seed
join public.question_items item on item.item_code = hint_seed.item_code
join public.question_versions revised on revised.question_item_id = item.id and revised.version_number = 2
on conflict do nothing;

-- Correct the two over-connected prerequisites identified in review.
delete from public.skill_prerequisites edge
using public.curriculum_skills dependent, public.curriculum_skills prerequisite
where edge.skill_id = dependent.id and edge.prerequisite_skill_id = prerequisite.id
  and ((dependent.skill_code = 'G9.EQN.FACTORISED' and prerequisite.skill_code = 'G9.ALG.FACTOR.DOTS') or (dependent.skill_code = 'G9.GRAPH.RULE_FROM_TABLE' and prerequisite.skill_code = 'G9.GRAPH.TABLE_FROM_RULE'));

insert into public.skill_prerequisites (skill_id, prerequisite_skill_id)
select dependent.id, prerequisite.id
from public.curriculum_skills dependent
join public.curriculum_skills prerequisite on prerequisite.subject_id = dependent.subject_id
where dependent.skill_code = 'G9.GRAPH.RULE_FROM_TABLE' and prerequisite.skill_code = 'G9.GRAPH.GRADIENT'
on conflict do nothing;

-- Draft activity/diagnostic composition follows the current revision, while
-- learner attempts remain pinned to whichever immutable version they used.
update public.diagnostic_blueprint_questions blueprint_question
set question_version_id = revised.id
from public.question_versions previous
join public.question_items item on item.id = previous.question_item_id
join public.question_versions revised on revised.question_item_id = previous.question_item_id and revised.version_number = previous.version_number + 1
where blueprint_question.question_version_id = previous.id and revised.version_number = 2
  and item.item_code in ('Q.G9.DIAG.03','Q.G9.DIAG.07','Q.G9.DIAG.09','Q.G9.DIAG.12','Q.G9.DIAG.15');

update public.learning_activity_stage_questions stage_question
set question_version_id = revised.id
from public.question_versions previous
join public.question_items item on item.id = previous.question_item_id
join public.question_versions revised on revised.question_item_id = previous.question_item_id and revised.version_number = previous.version_number + 1
where stage_question.question_version_id = previous.id and revised.version_number = 2
  and item.item_code in ('Q.G9.DOTS.01','Q.G9.DOTS.02','Q.G9.DOTS.03','Q.G9.DOTS.04','Q.G9.DOTS.09','Q.G9.DOTS.13');

-- The review-set RPC returns one current version per item, never a mixture of
-- historical and revised versions.
create or replace function public.get_grade9_gold_standard_review_set()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(public.get_question_version_review_bundle(current_version.id) order by item.item_code)
    from public.question_items item
    join lateral (
      select version.id from public.question_versions version
      where version.question_item_id = item.id
      order by version.version_number desc limit 1
    ) current_version on true
    where item.item_code in (
      'Q.G9.DIAG.03','Q.G9.DIAG.04','Q.G9.DIAG.05','Q.G9.DIAG.07','Q.G9.DIAG.09','Q.G9.DIAG.12','Q.G9.DIAG.15',
      'Q.G9.DOTS.01','Q.G9.DOTS.02','Q.G9.DOTS.03','Q.G9.DOTS.04','Q.G9.DOTS.09','Q.G9.DOTS.10','Q.G9.DOTS.13','Q.G9.DOTS.18',
      'Q.G9.VERTICAL.01','Q.G9.VERTICAL.02','Q.G9.VERTICAL.05','Q.G9.VERTICAL.07','Q.G9.VERTICAL.10','Q.G9.VERTICAL.12','Q.G9.VERTICAL.16'
    )
  ), '[]'::jsonb);
end;
$$;
