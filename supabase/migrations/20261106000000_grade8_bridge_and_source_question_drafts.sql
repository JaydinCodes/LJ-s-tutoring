-- Batch 1 of the supplied Grade 8/9 maths library.  These are deliberately
-- immutable draft versions: review is required before a learner can receive
-- any item or an activity composed from it.

insert into public.curriculum_versions(subject_id,code,grade,name,valid_from,is_active)
select subject.id,'CAPS-MATH-G8-2023-24','Grade 8','CAPS Mathematics Grade 8 2023/24 bridge',date '2023-01-01',true
from public.subjects subject where subject.name='Mathematics' and subject.grade='Grade 8' and subject.curriculum='CAPS'
on conflict (code) do nothing;

insert into public.curriculum_sources(curriculum_version_id,source_tier,title,source_version,notes)
select curriculum.id,'approved_external','Supplied Grade 8 bridge worksheets','8Maths4Tab modules A4, A5, A7, A8, A9, A10 and A11','Rights for the supplied material were asserted by the content owner. Original attribution visible in the source must be retained and a mathematics/content reviewer must verify provenance before approval.'
from public.curriculum_versions curriculum where curriculum.code='CAPS-MATH-G8-2023-24'
on conflict (curriculum_version_id,title) do nothing;

insert into public.curriculum_sources(curriculum_version_id,source_tier,title,source_version,notes)
select curriculum.id,'Odysseus_authored','Supplied Grade 9 Difference of Two Squares generators','Factorization 2 DOTS; Factorization 3 DOTS and HCF; Factorization 4 DOTS twice','Generator scripts supplied by the content owner. Draft questions below are representative fixed instances; the scripts themselves are retained outside learner delivery.'
from public.curriculum_versions curriculum where curriculum.code='CAPS-MATH-G9-2026'
on conflict (curriculum_version_id,title) do nothing;

with source_questions(item_code,skill_code,activity_type,cognitive_level,difficulty,question_type,prompt,accepted,solution,hint,source_tier,curriculum_code) as (
  values
    ('Q.G8.SRC.ORDER.001','G8-NUM-WHOLE-PROPERTIES','retrieval','knowledge',1,'numeric','Simplify: 20 - 5 × 2.','["10"]'::jsonb,'Multiply before subtracting: 5 × 2 = 10, then 20 - 10 = 10.','Do multiplication before addition or subtraction.','approved_external','CAPS-MATH-G8-2023-24'),
    ('Q.G8.SRC.ORDER.002','G8-NUM-WHOLE-PROPERTIES','guided_practice','routine',2,'numeric','Simplify: 300 ÷ (4 + 2) - 7 × 7 - 1.','["0"]'::jsonb,'Evaluate the bracket first: 300 ÷ 6 - 49 - 1 = 50 - 49 - 1 = 0.','Start with the bracket.','approved_external','CAPS-MATH-G8-2023-24'),
    ('Q.G8.SRC.SUB.001','G8-ALG-LANGUAGE-TERMS','guided_practice','routine',1,'numeric','If a = 4, b = 7 and c = 2, find a + b - c.','["9"]'::jsonb,'Substitute the values: 4 + 7 - 2 = 9.','Replace each letter with its given value.','approved_external','CAPS-MATH-G8-2023-24'),
    ('Q.G8.SRC.SUB.002','G8-ALG-LANGUAGE-TERMS','guided_practice','routine',2,'numeric','If p = 9, find 5p - 30.','["15"]'::jsonb,'5p means 5 × p, so 5 × 9 - 30 = 15.','5p means 5 multiplied by p.','approved_external','CAPS-MATH-G8-2023-24'),
    ('Q.G8.SRC.EQN.001','G8-EQ-LINEAR-INVERSES','diagnostic','knowledge',1,'linear_equation_solution','Solve: 3a = 24.','["8","a=8"]'::jsonb,'Divide both sides by 3: a = 24 ÷ 3 = 8.','Use the inverse of multiplication by 3.','approved_external','CAPS-MATH-G8-2023-24'),
    ('Q.G8.SRC.EQN.002','G8-EQ-LINEAR-INVERSES','guided_practice','routine',1,'linear_equation_solution','Solve: b + 20 = 30.','["10","b=10"]'::jsonb,'Subtract 20 from both sides: b = 10.','Undo the +20 first.','approved_external','CAPS-MATH-G8-2023-24'),
    ('Q.G8.SRC.EQN.003','G8-EQ-LINEAR-INVERSES','guided_practice','routine',2,'linear_equation_solution','Solve: 5f - 15 = 30.','["9","f=9"]'::jsonb,'Add 15: 5f = 45. Divide by 5: f = 9.','First isolate the term containing f.','approved_external','CAPS-MATH-G8-2023-24'),
    ('Q.G8.SRC.INT.001','G8-NUM-INTEGERS-OPERATIONS','diagnostic','knowledge',1,'numeric','Simplify: -6 + 10.','["4"]'::jsonb,'Starting at -6 and adding 10 gives 4.','A positive addend moves right on the number line.','approved_external','CAPS-MATH-G8-2023-24'),
    ('Q.G8.SRC.INT.002','G8-NUM-INTEGERS-OPERATIONS','guided_practice','routine',1,'numeric','Simplify: -6 - 10.','["-16"]'::jsonb,'Subtracting 10 from -6 gives -16.','Subtracting a positive number moves left.','approved_external','CAPS-MATH-G8-2023-24'),
    ('Q.G8.SRC.INT.003','G8-NUM-INTEGERS-OPERATIONS','guided_practice','routine',2,'numeric','Simplify: (-4) × 5 × (-2).','["40"]'::jsonb,'(-4) × 5 = -20 and -20 × (-2) = 40.','Two negative factors make a positive product.','approved_external','CAPS-MATH-G8-2023-24'),
    ('Q.G8.SRC.FACT.001','G8-NUM-WHOLE-PROPERTIES','diagnostic','knowledge',1,'numeric','Find the HCF of 18 and 60.','["6"]'::jsonb,'The greatest common factor of 18 and 60 is 6.','List or prime-factorise both numbers.','approved_external','CAPS-MATH-G8-2023-24'),
    ('Q.G8.SRC.FACT.002','G8-NUM-WHOLE-PROPERTIES','guided_practice','routine',2,'numeric','Find the LCM of 12 and 18.','["36"]'::jsonb,'12 = 2² × 3 and 18 = 2 × 3², so the LCM is 2² × 3² = 36.','Use each prime factor at its greatest required power.','approved_external','CAPS-MATH-G8-2023-24'),
    ('Q.G8.SRC.FRACT.001','G8-NUM-FRACTIONS-OPERATIONS','guided_practice','routine',2,'fraction','Calculate: 3/4 + 1/8.','["7/8"]'::jsonb,'Write 3/4 as 6/8, then 6/8 + 1/8 = 7/8.','Use a common denominator.','approved_external','CAPS-MATH-G8-2023-24'),
    ('Q.G8.SRC.EXP.001','G8-EXP-LAWS-SCI','guided_practice','routine',2,'algebraic_expression','Simplify: x^3 × x^5.','["x^8"]'::jsonb,'For equal bases, add the exponents: x^(3 + 5) = x^8.','The base stays x; add the exponents.','approved_external','CAPS-MATH-G8-2023-24'),
    ('Q.G8.SRC.ROOT.001','G8-NUM-INTEGERS-OPERATIONS','retrieval','knowledge',1,'numeric','Evaluate: √144.','["12"]'::jsonb,'12 × 12 = 144, so √144 = 12.','What number multiplied by itself makes 144?','approved_external','CAPS-MATH-G8-2023-24'),
    ('Q.G9.SRC.DOTS.001','G9.ALG.FACTOR.DOTS','guided_practice','routine',1,'factorised_expression','Factorise: x^2 - 16.','["(x-4)(x+4)"]'::jsonb,'x² - 16 = x² - 4² = (x - 4)(x + 4).','Write 16 as a perfect square.','Odysseus_authored','CAPS-MATH-G9-2026'),
    ('Q.G9.SRC.DOTS.002','G9.ALG.FACTOR.DOTS','guided_practice','routine',2,'factorised_expression','Factorise: 9x^2 - 25.','["(3x-5)(3x+5)"]'::jsonb,'9x² - 25 = (3x)² - 5² = (3x - 5)(3x + 5).','Identify the square root of each term.','Odysseus_authored','CAPS-MATH-G9-2026'),
    ('Q.G9.SRC.DOTS.003','G9.ALG.FACTOR.DOTS','error_analysis','routine',2,'factorised_expression','Factorise: y^2 - 49.','["(y-7)(y+7)"]'::jsonb,'y² - 49 = y² - 7² = (y - 7)(y + 7).','A difference of squares has one plus and one minus bracket.','Odysseus_authored','CAPS-MATH-G9-2026'),
    ('Q.G9.SRC.DOTS.004','G9.ALG.FACTOR.DOTS','guided_practice','complex',3,'factorised_expression','Factorise fully: 3x^2 - 75.','["3(x-5)(x+5)"]'::jsonb,'First take out 3: 3(x² - 25), then factor x² - 5².','Check first for a common factor.','Odysseus_authored','CAPS-MATH-G9-2026'),
    ('Q.G9.SRC.DOTS.005','G9.ALG.FACTOR.DOTS','independent_practice','complex',3,'factorised_expression','Factorise fully: x^4 - 81.','["(x-3)(x+3)(x^2+9)"]'::jsonb,'x⁴ - 81 = (x² - 9)(x² + 9) = (x - 3)(x + 3)(x² + 9).','Use difference of squares, then check whether either factor can be factorised again.','Odysseus_authored','CAPS-MATH-G9-2026')
), items as (
  insert into public.question_items(curriculum_version_id,item_code,source_tier)
  select curriculum.id,source.item_code,source.source_tier::public.curriculum_source_tier from source_questions source join public.curriculum_versions curriculum on curriculum.code=source.curriculum_code
  on conflict(curriculum_version_id,item_code) do nothing returning id,item_code
), versions as (
  insert into public.question_versions(question_item_id,version_number,review_status,activity_type,cognitive_level,representation,difficulty,calculator_policy,prompt,answer_config,solution,marks,material_change_note)
  select item.id,1,'draft',source.activity_type::public.question_activity_type,source.cognitive_level::public.caps_cognitive_level,'symbolic',source.difficulty,'not_allowed',source.prompt,jsonb_build_object('type',source.question_type,'accepted_answers',source.accepted,'required_form',case when source.question_type='factorised_expression' then 'factorised' else null end,'skill_code',source.skill_code),source.solution,1,'Initial draft transcribed from the supplied Batch 1 source material; requires mathematical and provenance review before approval.'
  from items item join source_questions source on source.item_code=item.item_code
  on conflict(question_item_id,version_number) do nothing returning id,question_item_id
)
insert into public.question_version_skill_links(question_version_id,skill_id,relationship_type)
select version.id,skill.id,'primary' from versions version join public.question_items item on item.id=version.question_item_id join source_questions source on source.item_code=item.item_code join public.curriculum_skills skill on skill.skill_code=source.skill_code
on conflict do nothing;

with source_hints(item_code,hint) as (
  values
    ('Q.G8.SRC.ORDER.001','Do multiplication before addition or subtraction.'),('Q.G8.SRC.ORDER.002','Start with the bracket.'),('Q.G8.SRC.SUB.001','Replace each letter with its given value.'),('Q.G8.SRC.SUB.002','5p means 5 multiplied by p.'),('Q.G8.SRC.EQN.001','Use the inverse of multiplication by 3.'),('Q.G8.SRC.EQN.002','Undo the +20 first.'),('Q.G8.SRC.EQN.003','First isolate the term containing f.'),('Q.G8.SRC.INT.001','A positive addend moves right on the number line.'),('Q.G8.SRC.INT.002','Subtracting a positive number moves left.'),('Q.G8.SRC.INT.003','Two negative factors make a positive product.'),('Q.G8.SRC.FACT.001','List or prime-factorise both numbers.'),('Q.G8.SRC.FACT.002','Use each prime factor at its greatest required power.'),('Q.G8.SRC.FRACT.001','Use a common denominator.'),('Q.G8.SRC.EXP.001','The base stays x; add the exponents.'),('Q.G8.SRC.ROOT.001','What number multiplied by itself makes 144?'),('Q.G9.SRC.DOTS.001','Write 16 as a perfect square.'),('Q.G9.SRC.DOTS.002','Identify the square root of each term.'),('Q.G9.SRC.DOTS.003','A difference of squares has one plus and one minus bracket.'),('Q.G9.SRC.DOTS.004','Check first for a common factor.'),('Q.G9.SRC.DOTS.005','Use difference of squares, then check whether either factor can be factorised again.')
)
insert into public.question_hints(question_version_id,hint_level,prompt)
select version.id,1,source.hint from source_hints source join public.question_items item on item.item_code=source.item_code join public.question_versions version on version.question_item_id=item.id and version.version_number=1
on conflict(question_version_id,hint_level) do nothing;
