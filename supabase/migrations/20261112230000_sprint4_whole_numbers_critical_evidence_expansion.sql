-- Generated from scripts/generate-sprint4-whole-critical-evidence-expansion.cjs. Do not hand-edit.
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
  ('Q.G9.T1C.WHOLE.ENDLINE.17', 'G9-T1-WHOLE-MASTERY-ENDLINE', 17, 'G9-NUM-FINANCIAL-APPLICATIONS', 'A salesperson earns 5% commission on R11500 of sales. What commission is earned?', '{"type":"multiple_choice","options":{"A":"R57500.00","B":"R580.00","C":"R575.00","D":"R2300.00"},"correct_option":"C","distractor_explanations":{"A":"This treats the percentage as a whole-number multiplier rather than ${rate}/100.","B":"This adds the rate after calculating the percentage instead of using the commission amount.","D":"This divides by the percentage number instead of taking the stated percent of sales."}}'::jsonb, '5% = 0.05. Commission = R11500 × 0.05 = R575.00.', 2, 'procedural', 'routine', 'symbolic'),
  ('Q.G9.T1C.WHOLE.ENDLINE.18', 'G9-T1-WHOLE-MASTERY-ENDLINE', 18, 'G9-NUM-FINANCIAL-APPLICATIONS', 'A bicycle rents for R100 per day for 3 days, with a non-refundable booking fee of R50 and a refundable R325 deposit. The bicycle is returned undamaged. What is the final rental cost after the deposit is returned?', '{"type":"multiple_choice","options":{"A":"R300","B":"R350","C":"R675","D":"R150"},"correct_option":"B","distractor_explanations":{"A":"This omits the non-refundable booking fee.","C":"This counts the refundable deposit as a cost even though it is returned.","D":"This charges for one day only instead of all ${days} rental days."}}'::jsonb, 'Rental charge = 3 × R100 = R300. Add the non-refundable fee: R300 + R50 = R350. The R325 deposit is returned, so it is not part of the final cost.', 2, 'mathematical_reasoning', 'complex', 'verbal'),
  ('Q.G9.T1C.WHOLE.MASTERY-CHALLENGE.17', 'G9-T1-WHOLE-MASTERY-MASTERY-CHALLENGE', 17, 'G9-NUM-FINANCIAL-APPLICATIONS', 'A salesperson earns 6% commission on R12000 of sales. What commission is earned?', '{"type":"multiple_choice","options":{"A":"R720.00","B":"R2000.00","C":"R72000.00","D":"R726.00"},"correct_option":"A","distractor_explanations":{"B":"This divides by the percentage number instead of taking the stated percent of sales.","C":"This treats the percentage as a whole-number multiplier rather than ${rate}/100.","D":"This adds the rate after calculating the percentage instead of using the commission amount."}}'::jsonb, '6% = 0.06. Commission = R12000 × 0.06 = R720.00.', 2, 'procedural', 'routine', 'symbolic'),
  ('Q.G9.T1C.WHOLE.MASTERY-CHALLENGE.18', 'G9-T1-WHOLE-MASTERY-MASTERY-CHALLENGE', 18, 'G9-NUM-FINANCIAL-APPLICATIONS', 'A bicycle rents for R110 per day for 4 days, with a non-refundable booking fee of R55 and a refundable R350 deposit. The bicycle is returned undamaged. What is the final rental cost after the deposit is returned?', '{"type":"multiple_choice","options":{"A":"R845","B":"R165","C":"R440","D":"R495"},"correct_option":"D","distractor_explanations":{"A":"This counts the refundable deposit as a cost even though it is returned.","B":"This charges for one day only instead of all ${days} rental days.","C":"This omits the non-refundable booking fee."}}'::jsonb, 'Rental charge = 4 × R110 = R440. Add the non-refundable fee: R440 + R55 = R495. The R350 deposit is returned, so it is not part of the final cost.', 2, 'mathematical_reasoning', 'complex', 'verbal'),
  ('Q.G9.T1C.WHOLE.ENDLINE-REASSESSMENT-B.17', 'G9-T1-WHOLE-MASTERY-ENDLINE-REASSESSMENT-B', 17, 'G9-NUM-FINANCIAL-APPLICATIONS', 'A salesperson earns 7% commission on R12500 of sales. What commission is earned?', '{"type":"multiple_choice","options":{"A":"R882.00","B":"R875.00","C":"R1785.71","D":"R87500.00"},"correct_option":"B","distractor_explanations":{"A":"This adds the rate after calculating the percentage instead of using the commission amount.","C":"This divides by the percentage number instead of taking the stated percent of sales.","D":"This treats the percentage as a whole-number multiplier rather than ${rate}/100."}}'::jsonb, '7% = 0.07. Commission = R12500 × 0.07 = R875.00.', 2, 'procedural', 'routine', 'symbolic'),
  ('Q.G9.T1C.WHOLE.ENDLINE-REASSESSMENT-B.18', 'G9-T1-WHOLE-MASTERY-ENDLINE-REASSESSMENT-B', 18, 'G9-NUM-FINANCIAL-APPLICATIONS', 'A bicycle rents for R120 per day for 5 days, with a non-refundable booking fee of R60 and a refundable R375 deposit. The bicycle is returned undamaged. What is the final rental cost after the deposit is returned?', '{"type":"multiple_choice","options":{"A":"R660","B":"R1035","C":"R180","D":"R600"},"correct_option":"A","distractor_explanations":{"B":"This counts the refundable deposit as a cost even though it is returned.","C":"This charges for one day only instead of all ${days} rental days.","D":"This omits the non-refundable booking fee."}}'::jsonb, 'Rental charge = 5 × R120 = R600. Add the non-refundable fee: R600 + R60 = R660. The R375 deposit is returned, so it is not part of the final cost.', 2, 'mathematical_reasoning', 'complex', 'verbal');

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
  ('G9-T1-WHOLE-MASTERY-ENDLINE'),
  ('G9-T1-WHOLE-MASTERY-MASTERY-CHALLENGE'),
  ('G9-T1-WHOLE-MASTERY-ENDLINE-REASSESSMENT-B')
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
