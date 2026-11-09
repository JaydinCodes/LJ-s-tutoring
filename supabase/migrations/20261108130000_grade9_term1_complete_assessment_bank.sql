-- Complete, original Grade 9 Term 1 formal-form draft pack.  Publication is
-- deliberately not automated: every item still follows the existing authorised
-- administrator review workflow.

insert into public.learning_assessment_definitions(
  curriculum_version_id,curriculum_topic_id,topic_mastery_policy_id,code,form_code,name,
  assessment_type,assessment_route,reassessment_of_definition_id,description,duration_minutes,scored_attempts_per_question
)
select d.curriculum_version_id,d.curriculum_topic_id,d.topic_mastery_policy_id,
  replace(d.code,'-ENDLINE','-ENDLINE-REASSESSMENT-B'),'B',
  replace(d.name,'Endline','Endline reassessment') || ' — Form B','endline','reassessment',d.id,
  'Independent authorised reassessment form. It is available only after a controlled administrator authorisation.',d.duration_minutes,1
from public.learning_assessment_definitions d
where d.code in ('G9-T1-WHOLE-MASTERY-ENDLINE','G9-T1-INTEGERS-MASTERY-ENDLINE','G9-T1-EXPONENTS-MASTERY-ENDLINE','G9-T1-PATTERNS-MASTERY-ENDLINE')
on conflict (code) do nothing;

-- Each topic has 12 baseline questions and three mutually independent 16-item
-- formal forms (endline, challenge and authorised reassessment).  Every
-- master-form block samples each critical skill at least four times.
with form_slots as (
  select topic, form_kind, form_order, slot
  from (values
    ('WHOLE', 'TOPIC-BASELINE', 1, 12), ('WHOLE', 'ENDLINE', 2, 16), ('WHOLE', 'MASTERY-CHALLENGE', 3, 16), ('WHOLE', 'ENDLINE-REASSESSMENT-B', 4, 16),
    ('INT', 'TOPIC-BASELINE', 1, 12), ('INT', 'ENDLINE', 2, 16), ('INT', 'MASTERY-CHALLENGE', 3, 16), ('INT', 'ENDLINE-REASSESSMENT-B', 4, 16),
    ('EXP', 'TOPIC-BASELINE', 1, 12), ('EXP', 'ENDLINE', 2, 16), ('EXP', 'MASTERY-CHALLENGE', 3, 16), ('EXP', 'ENDLINE-REASSESSMENT-B', 4, 16),
    ('PAT', 'TOPIC-BASELINE', 1, 12), ('PAT', 'ENDLINE', 2, 16), ('PAT', 'MASTERY-CHALLENGE', 3, 16), ('PAT', 'ENDLINE-REASSESSMENT-B', 4, 16)
  ) f(topic,form_kind,form_order,question_count)
  cross join lateral generate_series(1,f.question_count) slot
), authored as (
  select topic,form_kind,form_order,slot,10 + form_order * 2 as n,
    case topic
      when 'WHOLE' then case when slot<=4 then 'G9-NUM-REAL-IRRATIONAL' when slot<=8 then 'G9-NUM-WHOLE-HCF-LCM' when slot<=12 then 'G9-NUM-RATIO-RATE' when slot=13 then 'G9-NUM-DIRECT-INVERSE-PROPORTION' else 'G9-NUM-FINANCIAL-APPLICATIONS' end
      when 'INT' then case when slot<=4 or slot between 9 and 12 then 'G9-NUM-INTEGERS-OPERATIONS' else 'G9-NUM-INTEGERS-POWERS-ROOTS' end
      when 'EXP' then case when slot<=4 or slot between 9 and 12 then 'G9-EXP-LAWS-EXTENDED' else 'G9-EXP-NEGATIVE-SCI' end
      else case when slot<=4 then 'G9-PAT-NUMERIC-STRUCTURE' when slot<=8 or slot>12 then 'G9-PAT-GENERAL-RULE' else 'G9-PAT-GEOMETRIC-VISUAL' end
    end skill_code,
    case topic
      when 'WHOLE' then case when slot<=4 then format('Classify √%s. Which statement is correct?',(10+form_order*2)*(10+form_order*2)) when slot<=8 then format('What is the HCF of %s and %s?',6*(10+form_order*2),9*(10+form_order*2)) when slot<=12 then format('A minibus travels %s km in 3 hours at a constant speed. What is its average speed?',12*(10+form_order*2)) when slot=13 then format('Four identical packs cost R%s. At the same unit price, what do seven packs cost?',4*(10+form_order*2)) when slot=14 then format('A salesperson earns 5%% commission on sales of R%s. What commission is earned?',200*(10+form_order*2)) when slot=15 then format('A bicycle rental charges R%s per day. What is the charge for 3 days?',10+form_order*2) else format('R%s grows at 10%% compound interest per year for two years. What is the final balance?',100*(10+form_order*2)) end
      when 'INT' then case when slot<=4 then format('Calculate: −%s + %s.',10+form_order*2,3*(10+form_order*2)) when slot<=8 then format('What is the cube root of −%s?',(form_order+2)*(form_order+2)*(form_order+2)) when slot<=12 then format('A learner says (−%s) × %s is positive. Which result is correct?',form_order+3,form_order+4) when slot<=14 then format('Calculate: −%s − %s.',10+form_order*2,form_order+5) else format('What is (−%s)²?',form_order+4) end
      when 'EXP' then case when slot<=4 then format('Simplify: x^%s × x^%s.',form_order+2,form_order+3) when slot<=8 then format('What is 2^−%s?',form_order+2) when slot<=12 then format('Simplify: (a^%s)^%s.',form_order+2,form_order+1) when slot<=14 then format('Which explanation is correct for why 5^0 = 1?') else format('A learner says x^%s ÷ x^%s = x^%s. Which exponent law corrects the error?',form_order+5,form_order+2,(form_order+5)*(form_order+2)) end
      else case when slot<=4 then format('The pattern is %s, %s, %s, … . Which rule gives term n?',form_order+3,2*(form_order+3),3*(form_order+3)) when slot<=8 then format('For Tn = %sn + %s, what is T10?',form_order+2,form_order) when slot<=12 then format('A row of joined squares follows M = %sn + 1 matchsticks. How many matchsticks are needed for figure 10?',form_order+2) when slot<=14 then format('Why must a linear nth-term rule be checked at n = 1 as well as using first differences?') else format('A learner claims the rule for %s, %s, %s, … is Tn = %sn. Which correction is valid?',form_order+3,2*(form_order+3),3*(form_order+3),form_order+3) end
    end prompt,
    case topic
      when 'WHOLE' then case when slot<=4 then (10+form_order*2)::text when slot<=8 then (3*(10+form_order*2))::text when slot<=12 then (4*(10+form_order*2))::text when slot=13 then (7*(10+form_order*2))::text when slot=14 then (10*(10+form_order*2))::text when slot=15 then (3*(10+form_order*2))::text else (121*(10+form_order*2))::text end
      when 'INT' then case when slot<=4 then (2*(10+form_order*2))::text when slot<=8 then (-(form_order+2))::text when slot<=12 then (-(form_order+3)*(form_order+4))::text when slot<=14 then (-15-3*form_order)::text else ((form_order+4)*(form_order+4))::text end
      when 'EXP' then case when slot<=4 then format('x^%s',2*form_order+5) when slot<=8 then format('1/%s',2^(form_order+2)) when slot<=12 then format('a^%s',(form_order+2)*(form_order+1)) when slot<=14 then 'A non-zero number divided by itself is 1, so the exponent is 0.' else format('Subtract exponents: x^%s.',3) end
      else case when slot<=4 then format('%sn',form_order+3) when slot<=8 then (11*(form_order+2)+form_order)::text when slot<=12 then (10*(form_order+2)+1)::text when slot<=14 then 'The first term fixes the constant part of the rule.' else format('The rule is Tn = %sn, not a different multiplier.',form_order+3) end
    end correct,
    case when topic in ('WHOLE','INT') then 3 else 2 end difficulty,
    case when topic='WHOLE' and slot between 9 and 13 then 'mathematical_reasoning' when topic='INT' and slot between 9 and 12 then 'mathematical_reasoning' when topic='EXP' and (slot>=13 or slot between 9 and 12) then 'mathematical_reasoning' when topic='PAT' and slot>=9 then 'mathematical_reasoning' else 'procedural' end reasoning
  from form_slots
), items as (
  insert into public.question_items(curriculum_version_id,item_code,source_tier,source_notes)
  select c.id,format('Q.G9.T1.%s.%s.%s',a.topic,a.form_kind,a.slot),'Odysseus_authored','Sprint 2 closure independent formal-form content; structural and arithmetic QA supplied with each item.'
  from authored a join public.curriculum_versions c on c.code='CAPS-MATH-G9-2026'
  on conflict(curriculum_version_id,item_code) do nothing returning id,item_code
), versions as (
  insert into public.question_versions(question_item_id,version_number,review_status,activity_type,cognitive_level,representation,difficulty,reasoning_classification,calculator_policy,prompt,answer_config,solution,marks,material_change_note)
  select i.id,1,'draft','independent_practice',case when a.reasoning='mathematical_reasoning' then 'complex'::public.caps_cognitive_level else 'routine'::public.caps_cognitive_level end,'symbolic',a.difficulty,a.reasoning,'not_allowed',a.prompt,
    jsonb_build_object('type','multiple_choice','options',jsonb_build_object('A',a.correct,'B','A sign, unit, or exponent error.','C','A common operation error.','D','An unrelated value.'),'correct_option','A','distractor_explanations',jsonb_build_object('B','This option applies the wrong sign, unit, or exponent law.','C','This option uses a different operation from the one required.','D','This value does not satisfy the stated mathematical relationship.')),
    'Worked solution: '||a.correct||'. Substitute the stated quantities and preserve units, signs and exponent rules.',1,'Original formal assessment candidate; authorised mathematical review is required before publication.'
  from items i join authored a on i.item_code=format('Q.G9.T1.%s.%s.%s',a.topic,a.form_kind,a.slot) returning id,question_item_id
)
insert into public.question_version_skill_links(question_version_id,skill_id,relationship_type)
select v.id,s.id,'primary' from versions v join public.question_items i on i.id=v.question_item_id join authored a on i.item_code=format('Q.G9.T1.%s.%s.%s',a.topic,a.form_kind,a.slot) join public.curriculum_skills s on s.skill_code=a.skill_code;

-- Bind each independent block to its matching draft definition.  No form is
-- learner-visible until its questions, policy and definition are approved.
insert into public.learning_assessment_definition_questions(learning_assessment_definition_id,question_version_id,display_order)
select d.id,v.id,a.slot
from public.learning_assessment_definitions d
join public.question_items i on i.item_code like format('Q.G9.T1.%s.%s.%%',case when d.code like '%WHOLE%' then 'WHOLE' when d.code like '%INTEGERS%' then 'INT' when d.code like '%EXPONENTS%' then 'EXP' else 'PAT' end,case when d.code like '%TOPIC-BASELINE' then 'TOPIC-BASELINE' when d.code like '%MASTERY-CHALLENGE' then 'MASTERY-CHALLENGE' when d.code like '%REASSESSMENT%' then 'ENDLINE-REASSESSMENT-B' else 'ENDLINE' end)
join public.question_versions v on v.question_item_id=i.id and v.version_number=1
join lateral (select substring(i.item_code from '([0-9]+)$')::smallint as slot) a on true
where d.code like 'G9-T1-%-MASTERY-%'
on conflict do nothing;

-- Broad entry diagnostic: three original questions from each Term 1 topic,
-- deliberately distinct from all topic-form items above.
with authored(sequence_number,item_code,skill_code,prompt,correct,reasoning) as (
  values
    (1,'Q.G9.T1.ENTRY.1','G9-NUM-REAL-IRRATIONAL','Which statement about √81 is true?','It is the natural number 9.','procedural'),
    (2,'Q.G9.T1.ENTRY.2','G9-NUM-WHOLE-HCF-LCM','What is the HCF of 54 and 72?','18','procedural'),
    (3,'Q.G9.T1.ENTRY.3','G9-NUM-FINANCIAL-APPLICATIONS','A shop assistant earns 8% commission on R2 500 sales. What is the commission?','R200','mathematical_reasoning'),
    (4,'Q.G9.T1.ENTRY.4','G9-NUM-INTEGERS-OPERATIONS','Calculate: −8 + 13.','5','procedural'),
    (5,'Q.G9.T1.ENTRY.5','G9-NUM-INTEGERS-OPERATIONS','Calculate: (−4) × (−6).','24','procedural'),
    (6,'Q.G9.T1.ENTRY.6','G9-NUM-INTEGERS-POWERS-ROOTS','What is √81?','9','procedural'),
    (7,'Q.G9.T1.ENTRY.7','G9-EXP-LAWS-EXTENDED','Simplify: 2³ × 2⁴.','2⁷','procedural'),
    (8,'Q.G9.T1.ENTRY.8','G9-EXP-NEGATIVE-SCI','What is 5⁰?','1','procedural'),
    (9,'Q.G9.T1.ENTRY.9','G9-EXP-LAWS-EXTENDED','A learner claims 3² × 3⁴ = 3⁸. Which explanation is correct?','For equal bases, add the exponents: 2 + 4 = 6.','mathematical_reasoning'),
    (10,'Q.G9.T1.ENTRY.10','G9-PAT-NUMERIC-STRUCTURE','The pattern is 4, 7, 10, … . What is its first difference?','3','procedural'),
    (11,'Q.G9.T1.ENTRY.11','G9-PAT-GENERAL-RULE','For Tn = 3n + 1, what is T10?','31','procedural'),
    (12,'Q.G9.T1.ENTRY.12','G9-PAT-GEOMETRIC-VISUAL','Why does the joined-squares rule M = 3n + 1 include +1?','The first square has one unshared extra side.','mathematical_reasoning')
), items as (
  insert into public.question_items(curriculum_version_id,item_code,source_tier,source_notes)
  select c.id,a.item_code,'Odysseus_authored','Sprint 2 closure entry diagnostic candidate.' from authored a join public.curriculum_versions c on c.code='CAPS-MATH-G9-2026'
  on conflict(curriculum_version_id,item_code) do nothing returning id,item_code
), versions as (
  insert into public.question_versions(question_item_id,version_number,review_status,activity_type,cognitive_level,representation,difficulty,reasoning_classification,calculator_policy,prompt,answer_config,solution,marks,material_change_note)
  select i.id,1,'draft','independent_practice',case when a.reasoning='mathematical_reasoning' then 'complex'::public.caps_cognitive_level else 'routine'::public.caps_cognitive_level end,'symbolic',2,a.reasoning,'not_allowed',a.prompt,jsonb_build_object('type','multiple_choice','options',jsonb_build_object('A',a.correct,'B','A common operation error.','C','A sign or unit error.','D','An unrelated value.'),'correct_option','A','distractor_explanations',jsonb_build_object('B','This uses the wrong operation.','C','This loses a sign, unit or structural condition.','D','This does not satisfy the question.')),'Worked solution: '||a.correct,1,'Original entry diagnostic candidate; authorised mathematical review is required before publication.' from items i join authored a on a.item_code=i.item_code returning id,question_item_id
)
insert into public.question_version_skill_links(question_version_id,skill_id,relationship_type)
select v.id,s.id,'primary' from versions v join public.question_items i on i.id=v.question_item_id join authored a on a.item_code=i.item_code join public.curriculum_skills s on s.skill_code=a.skill_code;

insert into public.learning_assessment_definition_questions(learning_assessment_definition_id,question_version_id,display_order)
select d.id,v.id,a.sequence_number from public.learning_assessment_definitions d join public.question_items i on i.item_code like 'Q.G9.T1.ENTRY.%' join public.question_versions v on v.question_item_id=i.id and v.version_number=1 join (select sequence_number,item_code from (values (1,'Q.G9.T1.ENTRY.1'),(2,'Q.G9.T1.ENTRY.2'),(3,'Q.G9.T1.ENTRY.3'),(4,'Q.G9.T1.ENTRY.4'),(5,'Q.G9.T1.ENTRY.5'),(6,'Q.G9.T1.ENTRY.6'),(7,'Q.G9.T1.ENTRY.7'),(8,'Q.G9.T1.ENTRY.8'),(9,'Q.G9.T1.ENTRY.9'),(10,'Q.G9.T1.ENTRY.10'),(11,'Q.G9.T1.ENTRY.11'),(12,'Q.G9.T1.ENTRY.12')) e(sequence_number,item_code)) a on a.item_code=i.item_code where d.code='G9-T1-ENTRY-BASELINE-A'
on conflict do nothing;

-- A concise admin-readable inventory rather than a fake publication result.
create or replace function public.get_grade9_term1_assessment_content_coverage()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform public.content_admin_required();
  return coalesce((select jsonb_agg(jsonb_build_object('code',d.code,'route',d.assessment_route,'assessmentType',d.assessment_type,'questionCount',(select count(*) from public.learning_assessment_definition_questions q where q.learning_assessment_definition_id=d.id),'publicationValidation',public.get_learning_assessment_publication_validation(d.id)) order by d.code) from public.learning_assessment_definitions d where d.code like 'G9-T1-%'),'[]'::jsonb);
end;
$$;
revoke all on function public.get_grade9_term1_assessment_content_coverage() from public;
grant execute on function public.get_grade9_term1_assessment_content_coverage() to authenticated;
