-- 20260917_fix_grade9_mojibake_v3.sql
--
-- The second-pass review batch (18 items) was inserted as version 2 with
-- mojibake: multi-byte UTF-8 math symbols were collapsed to literal '?'
-- characters during that insert (2 bytes -> '??' for ² and ÷, 3 bytes ->
-- '???' for ≠). This migration inserts corrected version-3 rows for all 18
-- items (only the symbol-bearing fields differ from v2; items with no
-- special characters are carried forward unchanged for a consistent
-- checkpoint), carries forward version-scoped metadata (skill links,
-- misconceptions, hints) so nothing regresses, and repoints the active
-- blueprint/stage references from v2 to v3.
--
-- v1/v2 rows are never mutated or deleted (immutable history).
-- get_grade9_gold_standard_review_set() needs no change: it already selects
-- MAX(version_number) per item dynamically, so it will pick up v3 on its own.

begin;

-- 1. Insert v3 rows (version_number = current max + 1 per item)
with revision(item_code, activity_type, cognitive_level, representation, difficulty, prompt, answer_config, solution, marks, material_change_note) as (
  values
    ('Q.G9.DIAG.03','diagnostic','routine','symbolic',1,'Simplify: 4x + 3x - 2.','{"accepted_answers":["7x - 2"]}'::jsonb,'4x and 3x are like terms: 4x + 3x = 7x. The constant -2 remains, so 4x + 3x - 2 = 7x - 2.',2::numeric,'v3: encoding checkpoint only, no content change.'),
    ('Q.G9.VERTICAL.01','retrieval','routine','symbolic',2,'Simplify: 5a - 2a + 3.','{"accepted_answers":["3a + 3"]}'::jsonb,'5a and -2a are like terms, so 5a - 2a = 3a. The constant 3 is unlike a-terms and remains unchanged: 3a + 3.',2::numeric,'v3: encoding checkpoint only, no content change.'),
    ('Q.G9.DOTS.02','diagnostic','routine','symbolic',2,'Expand: (x - 5)(x + 5).','{"accepted_answers":["x² - 25"]}'::jsonb,'The middle terms cancel: x² + 5x - 5x - 25 = x² - 25.',2::numeric,'v3: fixed mojibake ?? -> ² in answer_config and solution.'),
    ('Q.G9.VERTICAL.02','guided_practice','routine','symbolic',2,'Expand: -(x - 4).','{"accepted_answers":["-x + 4"]}'::jsonb,'Treat the negative sign as multiplication by -1: -(x - 4) = (-1)(x - 4) = -x + 4.',2::numeric,'v3: encoding checkpoint only, no content change.'),
    ('Q.G9.DOTS.13','interleaved_review','routine','symbolic',3,'Choose the method and factorise: 6x + 18.','{"accepted_answers":["6(x + 3)"]}'::jsonb,'Both terms have a common factor of 6: 6x + 18 = 6(x + 3). This is common factorisation, not a difference of squares.',2::numeric,'v3: encoding checkpoint only, no content change.'),
    ('Q.G9.VERTICAL.05','independent_practice','routine','symbolic',3,'Simplify: (x² - 9)/(x - 3). State any restriction on x.','{"accepted_answers":["x + 3, x ≠ 3","x + 3; x ≠ 3"],"required_conditions":["x ≠ 3"]}'::jsonb,'Factor the numerator: (x² - 9)/(x - 3) = ((x - 3)(x + 3))/(x - 3) = x + 3, provided x ≠ 3. The restriction remains because the original denominator cannot be zero.',3::numeric,'v3: fixed mojibake ?? -> ² and ??? -> ≠ in prompt, answer_config and solution.'),
    ('Q.G9.DOTS.01','retrieval','knowledge','symbolic',1,'Which of 25, 27, 36, 45, 49, 81 and 90 are perfect squares?','{"accepted_answers":["25, 36, 49, 81"]}'::jsonb,'25 = 5², 36 = 6², 49 = 7² and 81 = 9². The other listed numbers are not perfect squares.',2::numeric,'v3: fixed mojibake ?? -> ² in solution.'),
    ('Q.G9.DIAG.07','diagnostic','routine','symbolic',3,'Factorise: x² - 25.','{"accepted_answers":["(x - 5)(x + 5)"]}'::jsonb,'Recognise x² - 25 as x² - 5² and use a² - b² = (a - b)(a + b): (x - 5)(x + 5).',2::numeric,'v3: fixed mojibake ?? -> ² in prompt and solution.'),
    ('Q.G9.DOTS.03','worked_example','routine','symbolic',2,'Factorise: x² - 25.','{"accepted_answers":["(x - 5)(x + 5)"]}'::jsonb,'x² - 25 = x² - 5² = (x - 5)(x + 5).',2::numeric,'v3: fixed mojibake ?? -> ² in prompt and solution.'),
    ('Q.G9.DOTS.04','faded_example','routine','symbolic',2,'Complete: y² - 49 = (y - 7)(y + __ ).','{"accepted_answers":["7"]}'::jsonb,'49 = 7², so both factors use 7: (y - 7)(y + 7).',1::numeric,'v3: fixed mojibake ?? -> ² in prompt and solution.'),
    ('Q.G9.DOTS.09','error_analysis','complex','symbolic',3,'A learner says x² - 64 = (x - 8)². Explain and correct the factorisation.','{"accepted_answers":["(x - 8)(x + 8)"],"response_format":"explanation_and_factorisation","required_response_parts":[{"part_key":"explanation","accepted_concepts":["(x - 8)² = x² - 16x + 64","not x² - 64"]},{"part_key":"correct_factorisation","accepted_answers":["(x - 8)(x + 8)"]}]}'::jsonb,'(x - 8)² expands to x² - 16x + 64, not x² - 64. Since 64 = 8², x² - 64 = (x - 8)(x + 8).',3::numeric,'v3: fixed mojibake ?? -> ² throughout prompt, answer_config and solution.'),
    ('Q.G9.DIAG.09','diagnostic','routine','symbolic',2,'Solve: 3x + 12 = 21. Show the operation on both sides at each step.','{"accepted_answers":["x = 3"],"response_format":"worked_steps","required_working_steps":["3x + 12 - 12 = 21 - 12","3x = 9","3x ÷ 3 = 9 ÷ 3","x = 3"],"misconception_observation":{"code":"EQN_DIVIDE_ONE_SIDE_ONLY","requires_working":true}}'::jsonb,'Subtract 12 from both sides: 3x + 12 - 12 = 21 - 12, so 3x = 9. Divide both sides by 3: 3x ÷ 3 = 9 ÷ 3, so x = 3.',2::numeric,'v3: fixed mojibake ?? -> ÷ in answer_config and solution.'),
    ('Q.G9.VERTICAL.07','independent_practice','routine','symbolic',3,'Solve: (x - 4)(x + 1) = 0.','{"accepted_answers":["x = 4 or x = -1"]}'::jsonb,'Apply the zero-product principle: x - 4 = 0 or x + 1 = 0. Therefore x = 4 or x = -1.',2::numeric,'v3: encoding checkpoint only, no content change.'),
    ('Q.G9.DIAG.12','diagnostic','knowledge','verbal',1,'A point is 2 units to the right and 1 unit down from the origin. Write its ordered pair.','{"accepted_answers":["(2, -1)"]}'::jsonb,'Moving right gives a positive x-coordinate of 2. Moving down gives a negative y-coordinate of -1, so the ordered pair is (2, -1).',1::numeric,'v3: encoding checkpoint only, no content change.'),
    ('Q.G9.DIAG.15','diagnostic','routine','symbolic',2,'Find the gradient through (1, 2) and (3, 6).','{"accepted_answers":["2"]}'::jsonb,'The change in y is 6 - 2 = 4 and the change in x is 3 - 1 = 2, so the gradient is 4/2 = 2.',2::numeric,'v3: encoding checkpoint only, no content change.'),
    ('Q.G9.VERTICAL.10','representation_translation','routine','verbal',2,'A point is 2 units left and 3 units up from the origin. Write its ordered pair.','{"accepted_answers":["(-2, 3)"]}'::jsonb,'Moving 2 units left gives x = -2 and moving 3 units up gives y = 3, so the ordered pair is (-2, 3).',1::numeric,'v3: encoding checkpoint only, no content change.'),
    ('Q.G9.VERTICAL.12','representation_translation','routine','tabular',3,'A table has x: 0, 1, 2 and y: 3, 5, 7. Write the rule.','{"accepted_answers":["y = 2x + 3"]}'::jsonb,'When x increases by 1, y increases by 2, so the gradient is 2. When x = 0, y = 3, so the y-intercept is 3. The rule is y = 2x + 3.',2::numeric,'v3: encoding checkpoint only, no content change.'),
    ('Q.G9.VERTICAL.16','investigation','problem_solving','verbal',3,'Taxi A costs R10 plus R2 per kilometre. Taxi B costs R4 plus R3 per kilometre. At what distance do the taxis cost the same? Which taxi costs less for a 3 km trip and for a 10 km trip? Explain your reasoning.','{"accepted_answers":["6 km; Taxi B for 3 km; Taxi A for 10 km"],"response_format":"multi_part_investigation","required_response_parts":[{"part_key":"equal_cost_distance","accepted_answers":["6 km","6"]},{"part_key":"lower_cost_at_3km","accepted_answers":["Taxi B"]},{"part_key":"lower_cost_at_10km","accepted_answers":["Taxi A"]},{"part_key":"reasoning","accepted_concepts":["10 + 2d = 4 + 3d","Taxi A: R16 and Taxi B: R13 at 3 km","Taxi A: R30 and Taxi B: R34 at 10 km"]}]}'::jsonb,'Let d be the distance in kilometres. Equal cost: 10 + 2d = 4 + 3d, so d = 6. For 3 km, Taxi A costs R16 and Taxi B costs R13, so Taxi B costs less. For 10 km, Taxi A costs R30 and Taxi B costs R34, so Taxi A costs less.',3::numeric,'v3: encoding checkpoint only, no content change.') -- gitleaks:allow
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

-- 2. Carry forward misconceptions from v2 to v3 (generic: whatever the
--    immediate predecessor had, for each of the 18 items just revised)
insert into public.question_version_misconceptions (question_version_id, misconception_id)
select revised.id, existing.misconception_id
from public.question_versions revised
       join public.question_versions previous on previous.question_item_id = revised.question_item_id and previous.version_number = revised.version_number - 1
       join public.question_items item on item.id = revised.question_item_id
       join public.question_version_misconceptions existing on existing.question_version_id = previous.id
where revised.version_number = (select max(v.version_number) from public.question_versions v where v.question_item_id = revised.question_item_id)
  and item.item_code in ('Q.G9.DIAG.03','Q.G9.VERTICAL.01','Q.G9.DOTS.02','Q.G9.VERTICAL.02','Q.G9.DOTS.13','Q.G9.VERTICAL.05','Q.G9.DOTS.01','Q.G9.DIAG.07','Q.G9.DOTS.03','Q.G9.DOTS.04','Q.G9.DOTS.09','Q.G9.DIAG.09','Q.G9.VERTICAL.07','Q.G9.DIAG.12','Q.G9.DIAG.15','Q.G9.VERTICAL.10','Q.G9.VERTICAL.12','Q.G9.VERTICAL.16')
  on conflict do nothing;

-- 3. Carry forward 'supporting' skill links from v2 to v3 (DOTS.02
--    intentionally excluded - it carries primary expansion evidence only)
insert into public.question_version_skill_links (question_version_id, skill_id, relationship_type)
select revised.id, existing.skill_id, 'supporting'
from public.question_versions revised
       join public.question_versions previous on previous.question_item_id = revised.question_item_id and previous.version_number = revised.version_number - 1
       join public.question_items item on item.id = revised.question_item_id
       join public.question_version_skill_links existing on existing.question_version_id = previous.id
where revised.version_number = (select max(v.version_number) from public.question_versions v where v.question_item_id = revised.question_item_id)
  and existing.relationship_type = 'supporting'
  and item.item_code <> 'Q.G9.DOTS.02'
  on conflict do nothing;

-- 4. Re-link primary skills for v3 (same mapping used for v2 - the fix is
--    encoding-only, skill mapping is unchanged)
with primary_skills(item_code, skill_code) as (
  values
    ('Q.G9.DIAG.03','G9.ALG.LIKE_TERMS'), ('Q.G9.VERTICAL.01','G9.ALG.LIKE_TERMS'), ('Q.G9.DOTS.02','G9.ALG.EXPAND.BINOMIAL'), ('Q.G9.VERTICAL.02','G9.ALG.DISTRIBUTIVE'), ('Q.G9.DOTS.13','G9.ALG.FACTOR.COMMON'), ('Q.G9.VERTICAL.05','G9.ALG.FRACTIONS.SIMPLIFY'), ('Q.G9.DOTS.01','G9.ALG.EXPAND.BINOMIAL'), ('Q.G9.DIAG.07','G9.ALG.FACTOR.DOTS'), ('Q.G9.DOTS.03','G9.ALG.FACTOR.DOTS'), ('Q.G9.DOTS.04','G9.ALG.FACTOR.DOTS'), ('Q.G9.DOTS.09','G9.ALG.FACTOR.DOTS'), ('Q.G9.DIAG.09','G9.EQN.MULTI_STEP'), ('Q.G9.VERTICAL.07','G9.EQN.FACTORISED'), ('Q.G9.DIAG.12','G9.GRAPH.ORDERED_PAIRS'), ('Q.G9.DIAG.15','G9.GRAPH.GRADIENT'), ('Q.G9.VERTICAL.10','G9.GRAPH.PLOT_POINTS'), ('Q.G9.VERTICAL.12','G9.GRAPH.RULE_FROM_TABLE'), ('Q.G9.VERTICAL.16','G9.GRAPH.COMPARE_RELATIONSHIPS')
)
insert into public.question_version_skill_links (question_version_id, skill_id, relationship_type)
select revised.id, skill.id, 'primary'
from primary_skills
       join public.question_items item on item.item_code = primary_skills.item_code
       join public.question_versions revised on revised.question_item_id = item.id
  and revised.version_number = (select max(v.version_number) from public.question_versions v where v.question_item_id = item.id)
       join public.curriculum_skills skill on skill.skill_code = primary_skills.skill_code and skill.subject_id = (select subject_id from public.curriculum_versions where id = item.curriculum_version_id)
  on conflict do nothing;

-- 5. Corrected hints for the 3 items whose hint text also had mojibake,
--    plus VERTICAL.02 (unchanged text, re-authored here since hints are
--    version-scoped and must exist on v3 too)
with hint_seed(item_code, hint_level, prompt) as (
  values
    ('Q.G9.VERTICAL.02',1::smallint,'Treat the negative sign as multiplication by -1.'), ('Q.G9.VERTICAL.02',2::smallint,'Rewrite -(x - 4) as (-1)(x - 4).'), ('Q.G9.VERTICAL.02',3::smallint,'Multiply -1 by x and then by -4.'), ('Q.G9.VERTICAL.02',4::smallint,'Complete: (-1)x + (-1)(-4) = -x + __.'), ('Q.G9.VERTICAL.02',5::smallint,'-(x - 4) = -x + 4.'),
    ('Q.G9.DOTS.03',1::smallint,'Look at both terms. Are they perfect squares?'), ('Q.G9.DOTS.03',2::smallint,'Recall: a² - b² = (a - b)(a + b).'), ('Q.G9.DOTS.03',3::smallint,'x² = x² and 25 = 5².'), ('Q.G9.DOTS.03',4::smallint,'Complete: (x - 5)(x + ___).'), ('Q.G9.DOTS.03',5::smallint,'x² - 25 = (x - 5)(x + 5).'),
    ('Q.G9.DOTS.04',1::smallint,'First express 49 as a perfect square.'), ('Q.G9.DOTS.04',2::smallint,'Use the difference-of-two-squares structure.'), ('Q.G9.DOTS.04',3::smallint,'49 = 7².'), ('Q.G9.DOTS.04',4::smallint,'Complete: (y - 7)(y + ___).'), ('Q.G9.DOTS.04',5::smallint,'y² - 49 = (y - 7)(y + 7).'),
    ('Q.G9.DOTS.09',1::smallint,'A difference of squares is not a binomial square.'), ('Q.G9.DOTS.09',2::smallint,'Compare a² - b² with (a - b)².'), ('Q.G9.DOTS.09',3::smallint,'64 = 8².'), ('Q.G9.DOTS.09',4::smallint,'Complete: (x - 8)(x + ___).'), ('Q.G9.DOTS.09',5::smallint,'x² - 64 = (x - 8)(x + 8).')
)
insert into public.question_hints (question_version_id, hint_level, prompt)
select revised.id, hint_seed.hint_level, hint_seed.prompt
from hint_seed
       join public.question_items item on item.item_code = hint_seed.item_code
       join public.question_versions revised on revised.question_item_id = item.id
  and revised.version_number = (select max(v.version_number) from public.question_versions v where v.question_item_id = item.id)
  on conflict do nothing;

-- 6. Carry forward hints for the remaining 14 items (no mojibake in their
--    hint text, but hints are version-scoped so they'd silently disappear
--    on v3 otherwise). No-op for any item with no hints on v2.
insert into public.question_hints (question_version_id, hint_level, prompt)
select revised.id, existing.hint_level, existing.prompt
from public.question_versions revised
       join public.question_versions previous on previous.question_item_id = revised.question_item_id and previous.version_number = revised.version_number - 1
       join public.question_items item on item.id = revised.question_item_id
       join public.question_hints existing on existing.question_version_id = previous.id
where revised.version_number = (select max(v.version_number) from public.question_versions v where v.question_item_id = revised.question_item_id)
  and item.item_code not in ('Q.G9.VERTICAL.02','Q.G9.DOTS.03','Q.G9.DOTS.04','Q.G9.DOTS.09')
  on conflict do nothing;

-- 7. Repoint active diagnostic blueprint references from v2 to v3
update public.diagnostic_blueprint_questions blueprint_question
set question_version_id = revised.id
  from public.question_versions previous
join public.question_items item on item.id = previous.question_item_id
  join public.question_versions revised on revised.question_item_id = previous.question_item_id
  and revised.version_number = (select max(v.version_number) from public.question_versions v where v.question_item_id = previous.question_item_id)
where blueprint_question.question_version_id = previous.id
  and item.item_code in ('Q.G9.DIAG.03','Q.G9.DIAG.07','Q.G9.DIAG.09','Q.G9.DIAG.12','Q.G9.DIAG.15');

-- 8. Repoint active learning-activity stage references from v2 to v3
update public.learning_activity_stage_questions stage_question
set question_version_id = revised.id
  from public.question_versions previous
join public.question_items item on item.id = previous.question_item_id
  join public.question_versions revised on revised.question_item_id = previous.question_item_id
  and revised.version_number = (select max(v.version_number) from public.question_versions v where v.question_item_id = previous.question_item_id)
where stage_question.question_version_id = previous.id
  and item.item_code in ('Q.G9.DOTS.01','Q.G9.DOTS.02','Q.G9.DOTS.03','Q.G9.DOTS.04','Q.G9.DOTS.09','Q.G9.DOTS.13');

-- NOTE: the source v2 migration only repointed DIAG.* blueprint questions
-- and DOTS.* stage questions - VERTICAL.* items weren't referenced by
-- either table there. If a VERTICAL-specific active-reference table exists
-- elsewhere, add an equivalent UPDATE for it before committing.

-- 9. Verify: no v3 row for these 18 items still contains a mojibake
--    marker, and no blueprint row still points at a non-current version
do $$
declare
still_broken int;
  dangling int;
begin
select count(*) into still_broken
from public.question_versions qv
       join public.question_items item on item.id = qv.question_item_id
where item.item_code in ('Q.G9.DIAG.03','Q.G9.VERTICAL.01','Q.G9.DOTS.02','Q.G9.VERTICAL.02','Q.G9.DOTS.13','Q.G9.VERTICAL.05','Q.G9.DOTS.01','Q.G9.DIAG.07','Q.G9.DOTS.03','Q.G9.DOTS.04','Q.G9.DOTS.09','Q.G9.DIAG.09','Q.G9.VERTICAL.07','Q.G9.DIAG.12','Q.G9.DIAG.15','Q.G9.VERTICAL.10','Q.G9.VERTICAL.12','Q.G9.VERTICAL.16')
  and qv.version_number = (select max(v.version_number) from public.question_versions v where v.question_item_id = qv.question_item_id)
  and (qv.prompt like '%??%' or qv.solution like '%??%' or qv.answer_config::text like '%??%');

if still_broken > 0 then
    raise exception 'v3 migration incomplete: % row(s) still contain mojibake', still_broken;
end if;

select count(*) into dangling
from public.diagnostic_blueprint_questions bq
       join public.question_versions qv on qv.id = bq.question_version_id
       join public.question_items item on item.id = qv.question_item_id
where item.item_code in ('Q.G9.DIAG.03','Q.G9.DIAG.07','Q.G9.DIAG.09','Q.G9.DIAG.12','Q.G9.DIAG.15')
  and qv.version_number < (select max(v.version_number) from public.question_versions v where v.question_item_id = qv.question_item_id);

if dangling > 0 then
    raise exception 'v3 migration incomplete: % blueprint reference(s) still point at a non-current version', dangling;
end if;
end $$;

commit;
