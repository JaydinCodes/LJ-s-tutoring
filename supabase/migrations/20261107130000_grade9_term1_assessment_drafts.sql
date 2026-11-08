-- Sprint 2 authored assessment draft bank. These items are original Odysseus
-- questions with structural QA notes. They intentionally remain drafts: an
-- authorised administrator must use the existing review action before any
-- form can be published to learners.

-- A single reasoning MCQ is not enough to establish a topic-wide reasoning
-- requirement. These still-draft pilot policies can safely be tightened before
-- first approval; approved historical policy versions are never rewritten.
update public.topic_mastery_policies
set minimum_reasoning_evidence_count = greatest(minimum_reasoning_evidence_count, 2), updated_at = now()
where code like 'G9-T1-%-MASTERY' and review_status in ('draft', 'rejected');

with missing_skills(skill_code, strand, topic, title, description, cognitive_level) as (
  values
    ('G9-NUM-RATIO-RATE', 'Numbers', 'Whole numbers', 'Reason with ratio and rate', 'Compare quantities using ratio, unit rate and equivalent-rate reasoning in a stated context.', 'application'),
    ('G9-NUM-FINANCIAL-APPLICATIONS', 'Numbers', 'Whole numbers', 'Solve Grade 9 financial applications', 'Calculate commission, rental and stated compound-growth applications with clear units and assumptions.', 'application')
), inserted as (
  insert into public.curriculum_skills(subject_id, grade, curriculum, strand, topic, skill_code, title, description, cognitive_level, review_status)
  select subject.id, 'Grade 9', 'CAPS', missing_skills.strand, missing_skills.topic, missing_skills.skill_code, missing_skills.title, missing_skills.description, missing_skills.cognitive_level, 'teacher_review'
  from missing_skills join public.subjects subject on subject.name = 'Mathematics' and subject.grade = 'Grade 9' and subject.curriculum = 'CAPS'
  on conflict (skill_code) do update set title = excluded.title, description = excluded.description, cognitive_level = excluded.cognitive_level, updated_at = now()
  returning id, skill_code, title, description, cognitive_level
)
insert into public.curriculum_question_types(skill_id, question_type_code, title, description, representation, cognitive_demand, source_reference, review_status)
select id, skill_code || '-FORM', title || ' question family', description, 'word_problem', 'application', 'Sprint 2 Grade 9 Term 1 authored assessment scope; administrator review required.', 'teacher_review'
from inserted
on conflict (question_type_code) do update set title = excluded.title, description = excluded.description, updated_at = now();

insert into public.grade9_skill_metadata(curriculum_skill_id, curriculum_version_id, curriculum_topic_id, term, valid_from, display_order)
select skill.id, curriculum.id, topic.id, 1, date '2026-01-01', seed.display_order
from public.curriculum_versions curriculum
join public.curriculum_areas area on area.curriculum_version_id = curriculum.id
join public.curriculum_topics topic on topic.curriculum_area_id = area.id
join (values ('G9-NUM-RATIO-RATE', 3), ('G9-NUM-FINANCIAL-APPLICATIONS', 4)) as seed(skill_code, display_order) on topic.code = 'WHOLE-NUMBERS'
join public.curriculum_skills skill on skill.skill_code = seed.skill_code
where curriculum.code = 'CAPS-MATH-G9-2026'
on conflict (curriculum_version_id, curriculum_skill_id) do update set curriculum_topic_id = excluded.curriculum_topic_id, term = excluded.term, display_order = excluded.display_order;

insert into public.skill_prerequisites(skill_id, prerequisite_skill_id, strength)
select target.id, prerequisite.id, seed.strength
from (values
  ('G9-NUM-RATIO-RATE', 'G8-NUM-FRACTIONS-OPERATIONS', 0.9::numeric),
  ('G9-NUM-RATIO-RATE', 'G8-NUM-DECIMALS-OPERATIONS', 0.9::numeric),
  ('G9-NUM-FINANCIAL-APPLICATIONS', 'G9-NUM-RATIO-RATE', 0.9::numeric)
) as seed(skill_code, prerequisite_code, strength)
join public.curriculum_skills target on target.skill_code = seed.skill_code
join public.curriculum_skills prerequisite on prerequisite.skill_code = seed.prerequisite_code
on conflict (skill_id, prerequisite_skill_id) do update set strength = excluded.strength;

insert into public.topic_mastery_policy_skills(topic_mastery_policy_id, skill_id, is_essential, is_critical, requires_reasoning_evidence)
select policy.id, skill.id, true, seed.is_critical, seed.requires_reasoning
from public.topic_mastery_policies policy
join (values
  ('G9-NUM-RATIO-RATE', true, true),
  ('G9-NUM-FINANCIAL-APPLICATIONS', true, false)
) as seed(skill_code, is_critical, requires_reasoning) on policy.code = 'G9-T1-WHOLE-MASTERY'
join public.curriculum_skills skill on skill.skill_code = seed.skill_code
on conflict (topic_mastery_policy_id, skill_id) do update set is_essential = excluded.is_essential, is_critical = excluded.is_critical, requires_reasoning_evidence = excluded.requires_reasoning_evidence;

-- Each prompt, option set, correct key and distractor explanation is explicit.
-- The worked solution independently verifies the keyed answer; it is not
-- learner-visible through the assessment RPC.
with authored(item_code, skill_code, prompt, options, correct_option, distractors, solution, difficulty, reasoning) as (
  values
    ('Q.G9.T1.WHOLE.001', 'G9-NUM-REAL-IRRATIONAL', 'Which statement is true about √49?', '{"A":"It is irrational.","B":"It is a negative integer.","C":"It is the natural number 7.","D":"It is not a real number."}'::jsonb, 'C', '{"A":"√49 equals 7, which is rational rather than irrational.","B":"The principal square root is positive 7.","D":"Every square root of a positive number is real."}'::jsonb, '√49 = 7. Since 7 is a natural number, C is correct.', 1, 'procedural'),
    ('Q.G9.T1.WHOLE.002', 'G9-NUM-WHOLE-HCF-LCM', 'What is the HCF of 42 and 56?', '{"A":"7","B":"12","C":"14","D":"28"}'::jsonb, 'C', '{"A":"7 is a common factor, but 14 is greater and divides both numbers.","B":"12 does not divide either 42 or 56 exactly.","D":"28 divides 56 but not 42."}'::jsonb, '42 = 2 × 3 × 7 and 56 = 2³ × 7, so the HCF is 2 × 7 = 14.', 2, 'procedural'),
    ('Q.G9.T1.WHOLE.003', 'G9-NUM-WHOLE-HCF-LCM', 'What is the LCM of 12 and 18?', '{"A":"6","B":"24","C":"30","D":"36"}'::jsonb, 'D', '{"A":"6 is a common factor, not a common multiple.","B":"24 is divisible by 12 but not by 18.","C":"30 is divisible by neither 12 nor 18."}'::jsonb, '12 = 2² × 3 and 18 = 2 × 3². The LCM is 2² × 3² = 36.', 2, 'procedural'),
    ('Q.G9.T1.WHOLE.004', 'G9-NUM-RATIO-RATE', 'A car travels 180 km in 3 hours at a constant speed. What is its average speed?', '{"A":"60 km/h","B":"90 km/h","C":"177 km/h","D":"540 km/h"}'::jsonb, 'A', '{"B":"90 results from dividing 180 by 2 rather than by 3 hours.","C":"177 is found by subtracting 3 instead of finding a unit rate.","D":"540 is distance multiplied by time, not divided by time."}'::jsonb, 'Average speed = distance ÷ time = 180 ÷ 3 = 60 km/h.', 2, 'procedural'),
    ('Q.G9.T1.WHOLE.005', 'G9-NUM-DIRECT-INVERSE-PROPORTION', 'Five identical books cost R60. At the same price per book, what do eight books cost?', '{"A":"R75","B":"R96","C":"R100","D":"R480"}'::jsonb, 'B', '{"A":"R75 uses an incorrect R15 unit price.","C":"R100 assumes R12.50 per book rather than R12.","D":"R480 multiplies the total cost by 8 instead of the unit price."}'::jsonb, 'The unit price is R60 ÷ 5 = R12. Eight books cost 8 × R12 = R96.', 2, 'mathematical_reasoning'),
    ('Q.G9.T1.WHOLE.006', 'G9-NUM-DIRECT-INVERSE-PROPORTION', 'Four workers complete a task in 15 days at the same rate. How many days would six workers take?', '{"A":"9 days","B":"10 days","C":"15 days","D":"22.5 days"}'::jsonb, 'B', '{"A":"9 treats days as directly proportional to workers.","C":"15 ignores the extra workers.","D":"22.5 multiplies 15 by 1.5 instead of dividing the fixed worker-days."}'::jsonb, 'The task is 4 × 15 = 60 worker-days. With 6 workers, 60 ÷ 6 = 10 days.', 3, 'mathematical_reasoning'),
    ('Q.G9.T1.WHOLE.007', 'G9-NUM-FINANCIAL-APPLICATIONS', 'A salesperson earns 5% commission on R8 000 of sales. What commission is earned?', '{"A":"R40","B":"R250","C":"R400","D":"R1 600"}'::jsonb, 'C', '{"A":"R40 is 0.5% of R8 000.","B":"R250 is not 5% of R8 000.","D":"R1 600 is 20% of R8 000."}'::jsonb, '5% = 0.05. Commission = 0.05 × R8 000 = R400.', 2, 'procedural'),
    ('Q.G9.T1.WHOLE.008', 'G9-NUM-FINANCIAL-APPLICATIONS', 'R1 000 is invested at 10% compound interest per year. What is the balance after 2 years?', '{"A":"R1 100","B":"R1 200","C":"R1 210","D":"R1 220"}'::jsonb, 'C', '{"A":"R1 100 is the balance after one year only.","B":"R1 200 adds simple interest of R100 twice.","D":"R1 220 incorrectly adds R110 twice to R1 000."}'::jsonb, 'After year 1: R1 000 × 1.10 = R1 100. After year 2: R1 100 × 1.10 = R1 210.', 3, 'mathematical_reasoning'),
    ('Q.G9.T1.INT.001', 'G9-NUM-INTEGERS-OPERATIONS', 'Calculate: −8 + 13.', '{"A":"−21","B":"−5","C":"5","D":"21"}'::jsonb, 'C', '{"A":"−21 treats addition as adding two negative magnitudes.","B":"−5 reverses the direction on the number line.","D":"21 ignores the negative sign on 8."}'::jsonb, 'Starting at −8 and adding 13 gives 5.', 1, 'procedural'),
    ('Q.G9.T1.INT.002', 'G9-NUM-INTEGERS-OPERATIONS', 'Calculate: −7 − 9.', '{"A":"−16","B":"−2","C":"2","D":"16"}'::jsonb, 'A', '{"B":"−2 subtracts the magnitudes instead of moving 9 left.","C":"2 has the wrong sign.","D":"16 ignores the negative result."}'::jsonb, 'Subtracting 9 from −7 moves 9 units left: −7 − 9 = −16.', 1, 'procedural'),
    ('Q.G9.T1.INT.003', 'G9-NUM-INTEGERS-OPERATIONS', 'Calculate: (−4) × (−6).', '{"A":"−24","B":"−10","C":"10","D":"24"}'::jsonb, 'D', '{"A":"One negative factor would give −24; two give a positive product.","B":"−10 is an addition error.","C":"10 is an addition error with the wrong operation."}'::jsonb, 'The product of two negative numbers is positive: 4 × 6 = 24.', 1, 'procedural'),
    ('Q.G9.T1.INT.004', 'G9-NUM-INTEGERS-OPERATIONS', 'Calculate: (−36) ÷ 9.', '{"A":"−4","B":"4","C":"−27","D":"27"}'::jsonb, 'A', '{"B":"The magnitude is correct but the negative sign is lost.","C":"−27 subtracts rather than divides.","D":"27 subtracts and loses the sign."}'::jsonb, 'A negative divided by a positive is negative. 36 ÷ 9 = 4, so the result is −4.', 1, 'procedural'),
    ('Q.G9.T1.INT.005', 'G9-NUM-INTEGERS-POWERS-ROOTS', 'What is (−3)²?', '{"A":"−9","B":"−6","C":"6","D":"9"}'::jsonb, 'D', '{"A":"The brackets mean the negative number is squared, so the result is positive.","B":"−6 multiplies −3 by 2 rather than squaring it.","C":"6 is also multiplication by 2."}'::jsonb, '(−3)² = (−3) × (−3) = 9.', 2, 'procedural'),
    ('Q.G9.T1.INT.006', 'G9-NUM-INTEGERS-POWERS-ROOTS', 'What is the cube root of −125?', '{"A":"−25","B":"−5","C":"5","D":"25"}'::jsonb, 'B', '{"A":"−25 cubed is not −125.","C":"5 cubed is positive 125.","D":"25 is neither the cube root nor a factor giving the required cube."}'::jsonb, '(−5) × (−5) × (−5) = −125, so the cube root is −5.', 2, 'mathematical_reasoning'),
    ('Q.G9.T1.EXP.001', 'G9-EXP-LAWS-EXTENDED', 'Simplify: 2³ × 2⁴.', '{"A":"2⁷","B":"2¹²","C":"4⁷","D":"2¹"}'::jsonb, 'A', '{"B":"Exponents are added for equal-base multiplication, not multiplied.","C":"The base remains 2.","D":"2³ ÷ 2⁴ would give 2⁻¹, not this product."}'::jsonb, 'For equal bases, add exponents: 2³ × 2⁴ = 2^(3 + 4) = 2⁷.', 1, 'procedural'),
    ('Q.G9.T1.EXP.002', 'G9-EXP-LAWS-EXTENDED', 'Simplify: x⁶ ÷ x².', '{"A":"x³","B":"x⁴","C":"x⁸","D":"x¹²"}'::jsonb, 'B', '{"A":"3 is half of 6, not the quotient-law exponent.","C":"Adding exponents is the multiplication law.","D":"Multiplying exponents is not the quotient law."}'::jsonb, 'For equal-base division, subtract exponents: x^(6 − 2) = x⁴.', 1, 'procedural'),
    ('Q.G9.T1.EXP.003', 'G9-EXP-LAWS-EXTENDED', 'Simplify: (3²)³.', '{"A":"3⁵","B":"3⁶","C":"9⁶","D":"3⁹"}'::jsonb, 'B', '{"A":"Adding exponents is not the power-of-a-power law.","C":"The base remains 3.","D":"3⁹ would multiply the value 3 by the exponents incorrectly."}'::jsonb, 'For a power of a power, multiply exponents: (3²)³ = 3^(2 × 3) = 3⁶.', 2, 'procedural'),
    ('Q.G9.T1.EXP.004', 'G9-EXP-NEGATIVE-SCI', 'What is 5⁰?', '{"A":"0","B":"1","C":"5","D":"Undefined"}'::jsonb, 'B', '{"A":"A zero exponent does not make the value zero.","C":"5¹ is 5; the exponent here is zero.","D":"A non-zero base to exponent zero is defined as 1."}'::jsonb, 'Any non-zero number raised to the zero power equals 1.', 1, 'procedural'),
    ('Q.G9.T1.EXP.005', 'G9-EXP-NEGATIVE-SCI', 'What is 2⁻³?', '{"A":"−8","B":"−1/8","C":"1/8","D":"8"}'::jsonb, 'C', '{"A":"A negative exponent does not make the power negative.","B":"The reciprocal is positive because the base is positive.","D":"8 is 2³ before applying the negative exponent."}'::jsonb, '2⁻³ = 1 ÷ 2³ = 1/8.', 2, 'procedural'),
    ('Q.G9.T1.EXP.006', 'G9-EXP-LAWS-EXTENDED', 'Simplify: (a³b²)².', '{"A":"a⁵b⁴","B":"a⁶b⁴","C":"a⁶b⁸","D":"a⁹b⁴"}'::jsonb, 'B', '{"A":"The exponent outside multiplies each exponent; it does not add 2 only to a.","C":"b exponent is 2 × 2 = 4, not 8.","D":"a exponent is 3 × 2 = 6, not 9."}'::jsonb, 'Apply the outer exponent to both factors: a^(3 × 2)b^(2 × 2) = a⁶b⁴.', 3, 'mathematical_reasoning'),
    ('Q.G9.T1.PAT.001', 'G9-PAT-NUMERIC-STRUCTURE', 'The pattern is 4, 7, 10, 13, … . Which expression gives term n?', '{"A":"3n + 1","B":"3n + 4","C":"4n − 1","D":"n + 3"}'::jsonb, 'A', '{"B":"At n = 1, 3n + 4 gives 7 instead of 4.","C":"At n = 2, 4n − 1 gives 7 but the common difference would be 4, not 3.","D":"n + 3 has a common difference of 1."}'::jsonb, 'The common difference is 3. For n = 1 the term is 4, so Tn = 3n + 1.', 2, 'mathematical_reasoning'),
    ('Q.G9.T1.PAT.002', 'G9-PAT-GENERAL-RULE', 'For Tn = 3n + 1, what is T10?', '{"A":"13","B":"30","C":"31","D":"34"}'::jsonb, 'C', '{"A":"13 is T4, not T10.","B":"30 omits the +1.","D":"34 treats the starting term as 4n + ? rather than using the given rule."}'::jsonb, 'T10 = 3(10) + 1 = 31.', 1, 'procedural'),
    ('Q.G9.T1.PAT.003', 'G9-PAT-NUMERIC-STRUCTURE', 'A table has n values 1, 2, 3 and Tn values 5, 9, 13. Which rule fits the table?', '{"A":"n + 4","B":"2n + 3","C":"4n + 1","D":"5n"}'::jsonb, 'C', '{"A":"n + 4 gives 6 when n = 2, not 9.","B":"2n + 3 gives 7 when n = 2, not 9.","D":"5n gives 10 when n = 2, not 9."}'::jsonb, 'The terms increase by 4. Using n = 1: 4(1) + 1 = 5, so Tn = 4n + 1.', 2, 'mathematical_reasoning'),
    ('Q.G9.T1.PAT.004', 'G9-PAT-GEOMETRIC-VISUAL', 'One row of joined squares uses 4 matchsticks for 1 square, 7 for 2 squares and 10 for 3 squares. How many matchsticks are needed for 10 squares?', '{"A":"30","B":"31","C":"34","D":"40"}'::jsonb, 'B', '{"A":"30 uses 3n and omits the first unmatched side.","C":"34 treats the initial count as 4n − 6 incorrectly.","D":"40 counts every square as if it had no shared sides."}'::jsonb, 'Each additional square adds 3 matchsticks, so M = 3n + 1. For n = 10, M = 31.', 3, 'mathematical_reasoning'),
    ('Q.G9.T1.PAT.005', 'G9-PAT-GENERAL-RULE', 'Why does the matchstick rule M = 3n + 1 include +1?', '{"A":"Because every square adds four new matchsticks.","B":"Because the first square has one side that is not shared, while each added square contributes three new sides.","C":"Because 1 is always added to any pattern rule.","D":"Because there are three squares in every pattern."}'::jsonb, 'B', '{"A":"Joined squares share a side, so each added square contributes three, not four.","C":"The constant depends on the pattern’s starting structure.","D":"n can be any positive figure number, not always three."}'::jsonb, 'The first square has 4 matchsticks. Each later square shares one side and adds 3, giving 3n + 1.', 3, 'mathematical_reasoning'),
    ('Q.G9.T1.PAT.006', 'G9-PAT-GENERAL-RULE', 'The pattern 2, 5, 8, … has rule Tn = 3n − 1. What is T20?', '{"A":"41","B":"57","C":"59","D":"61"}'::jsonb, 'C', '{"A":"41 is not obtained from 3(20) − 1.","B":"57 subtracts 3 from 60 instead of 1.","D":"61 adds 1 instead of subtracting it."}'::jsonb, 'T20 = 3(20) − 1 = 59.', 2, 'procedural')
), items as (
  insert into public.question_items(curriculum_version_id, item_code, source_tier)
  select curriculum.id, authored.item_code, 'Odysseus_authored'::public.curriculum_source_tier
  from authored join public.curriculum_versions curriculum on curriculum.code = 'CAPS-MATH-G9-2026'
  on conflict (curriculum_version_id, item_code) do nothing
  returning id, item_code
), versions as (
  insert into public.question_versions(question_item_id, version_number, review_status, activity_type, cognitive_level, representation, difficulty, reasoning_classification, calculator_policy, prompt, answer_config, solution, marks, material_change_note)
  select item.id, 1, 'draft', 'independent_practice', case when authored.reasoning = 'mathematical_reasoning' then 'complex'::public.caps_cognitive_level else 'routine'::public.caps_cognitive_level end, 'symbolic', authored.difficulty, authored.reasoning, 'not_allowed', authored.prompt,
    jsonb_build_object('type', 'multiple_choice', 'options', authored.options, 'correct_option', authored.correct_option, 'distractor_explanations', authored.distractors), authored.solution, 1,
    'Automated structural and arithmetic QA recorded in Sprint 2 authoring migration. Requires authorised curriculum review before publication.'
  from items item join authored on authored.item_code = item.item_code
  returning id, question_item_id
)
insert into public.question_version_skill_links(question_version_id, skill_id, relationship_type)
select version.id, skill.id, 'primary'
from versions version join public.question_items item on item.id = version.question_item_id join authored on authored.item_code = item.item_code join public.curriculum_skills skill on skill.skill_code = authored.skill_code;

-- Attach the authored baseline candidates to their existing Sprint 1 drafts.
-- They are still unavailable because both the questions and definitions remain
-- draft until an administrator completes the ordinary review workflow.
insert into public.learning_assessment_definition_questions(learning_assessment_definition_id, question_version_id, display_order)
select definition.id, version.id, row_number() over (partition by definition.id order by item.item_code)::smallint
from public.learning_assessment_definitions definition
join public.question_items item on item.item_code like case
  when definition.code = 'G9-T1-WHOLE-MASTERY-TOPIC-BASELINE' then 'Q.G9.T1.WHOLE.%'
  when definition.code = 'G9-T1-INTEGERS-MASTERY-TOPIC-BASELINE' then 'Q.G9.T1.INT.%'
  when definition.code = 'G9-T1-EXPONENTS-MASTERY-TOPIC-BASELINE' then 'Q.G9.T1.EXP.%'
  when definition.code = 'G9-T1-PATTERNS-MASTERY-TOPIC-BASELINE' then 'Q.G9.T1.PAT.%'
  else '__no_assessment_draft__'
end
join public.question_versions version on version.question_item_id = item.id and version.version_number = 1
where definition.code in ('G9-T1-WHOLE-MASTERY-TOPIC-BASELINE', 'G9-T1-INTEGERS-MASTERY-TOPIC-BASELINE', 'G9-T1-EXPONENTS-MASTERY-TOPIC-BASELINE', 'G9-T1-PATTERNS-MASTERY-TOPIC-BASELINE')
on conflict do nothing;
