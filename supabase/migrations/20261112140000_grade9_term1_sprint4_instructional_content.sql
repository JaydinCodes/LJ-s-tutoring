-- Generated from scripts/grade9-term1-learning-content.cjs. Do not hand-edit.
-- Sprint 4 content remains draft and review-gated in every production database.

alter table public.learning_skill_content add column if not exists learning_objective text;
alter table public.learning_skill_content add column if not exists common_misconception text;

with authored(skill_code,title,learning_objective,explanation,worked_example,common_misconception) as (
values
  ('G9-NUM-REAL-IRRATIONAL', 'Real numbers: rational or irrational', 'By the end of this lesson, you should be able to classify real numbers as rational or irrational.', 'Rational numbers can be written as a fraction of two integers, with a non-zero denominator. Integers, terminating decimals and recurring decimals are rational. A square root is rational only when its radicand is a perfect square. Numbers such as √2 and π are real but irrational.', 'Classify √81.
1. 81 is a perfect square: 9 × 9 = 81.
2. √81 = 9.
3. 9 is an integer, so it is rational.
Therefore √81 is a rational real number.', 'A root sign does not automatically mean “irrational”. Check whether the number inside the root is a perfect square.'),
  ('G9-NUM-WHOLE-HCF-LCM', 'Factors, multiples, HCF and LCM', 'By the end of this lesson, you should be able to use prime factors to find an HCF or LCM.', 'A factor divides a number exactly; a multiple is made by multiplying. Prime factorisation writes a number as primes. For HCF use only common prime factors at their smallest powers. For LCM use every required prime factor at its largest power.', 'Find the HCF and LCM of 24 and 36.
24 = 2³ × 3 and 36 = 2² × 3².
HCF = 2² × 3 = 12.
LCM = 2³ × 3² = 72.', 'Do not choose the HCF when a situation asks when repeated events next happen together: that needs the LCM.'),
  ('G9-NUM-RATIO-RATE', 'Ratio and unit rate', 'By the end of this lesson, you should be able to simplify a ratio and calculate a unit rate.', 'A ratio compares quantities in the same order. Divide every part by the same common factor to simplify it. A rate compares unlike units, for example kilometres per hour. Find a unit rate by dividing to make one of the quantities equal to one.', 'A recipe uses 6 cups flour for 4 cups water.
Divide both parts by 2.
6 : 4 = 3 : 2.
For every 3 cups flour, use 2 cups water.', 'Do not add the numbers in a ratio. A ratio is multiplicative: both parts must scale by the same factor.'),
  ('G9-NUM-DIRECT-INVERSE-PROPORTION', 'Direct and inverse proportion', 'By the end of this lesson, you should be able to decide whether a situation uses direct or inverse proportion.', 'In direct proportion, both quantities change in the same direction at a constant rate: more items cost more. In inverse proportion, one quantity increases while the other decreases so that their product stays fixed: more equally efficient workers take fewer days.', 'Four workers take 15 days.
Total work = 4 × 15 = 60 worker-days.
With 6 workers: 60 ÷ 6 = 10 days.
This is inverse proportion.', '“One goes up and one goes down” is not enough by itself. The total task or product must stay fixed for inverse proportion.'),
  ('G9-NUM-FINANCIAL-APPLICATIONS', 'Commission, rental and compound interest', 'By the end of this lesson, you should be able to calculate common Grade 9 financial applications.', 'Commission is a percentage of sales. Rental questions often have a per-day amount plus a once-off fee. Compound interest grows the balance each period, so each new percentage is calculated on the previous balance.', 'R2 000 earns 10% compound interest for two years.
Year 1: R2 000 × 1.10 = R2 200.
Year 2: R2 200 × 1.10 = R2 420.
The balance is R2 420.', 'Do not add the once-off rental fee once for every day, and do not use simple interest when the question says compound.'),
  ('G9-NUM-INTEGERS-OPERATIONS', 'Integer operations and order', 'By the end of this lesson, you should be able to calculate with signed integers using the correct order of operations.', 'For addition and subtraction, use a number line or rewrite subtraction as adding the opposite. For multiplication and division, same signs give a positive answer and different signs give a negative answer. Evaluate brackets before powers, multiplication or division, then addition or subtraction.', 'Calculate −6 − (−9).
Subtracting a negative is adding its opposite.
−6 − (−9) = −6 + 9 = 3.', 'A negative sign is not a signal that the answer must be negative. Two negative factors make a positive product.'),
  ('G9-NUM-INTEGERS-POWERS-ROOTS', 'Squares, cubes and roots', 'By the end of this lesson, you should be able to evaluate integer powers and roots.', 'A square multiplies a number by itself; a cube uses three factors. Brackets decide whether a negative sign belongs to the base. √ gives the principal non-negative square root, while cube roots can be negative.', 'Evaluate (−4)².
The brackets make −4 the base.
(−4)² = (−4) × (−4) = 16.', 'Without brackets, −4² means −(4²) = −16. The brackets matter.'),
  ('G9-EXP-LAWS-EXTENDED', 'Exponent laws', 'By the end of this lesson, you should be able to use product, quotient and power laws for exponents.', 'For the same non-zero base: multiply means add exponents, divide means subtract exponents, and a power of a power means multiply exponents. The base does not change just because the exponent changes.', 'Simplify (x³)⁴.
A power of a power multiplies exponents.
(x³)⁴ = x^(3 × 4) = x¹².', 'Do not use the product law for addition: x² + x³ cannot be simplified by adding exponents.'),
  ('G9-EXP-NEGATIVE-SCI', 'Zero and negative exponents', 'By the end of this lesson, you should be able to interpret zero and negative exponents.', 'For any non-zero base a, a⁰ = 1. A negative exponent makes a reciprocal: a⁻ⁿ = 1/aⁿ. These follow from the quotient law, for example a³ ÷ a³ = a⁰ = 1.', 'Find 2⁻³.
2⁻³ = 1/2³.
2³ = 8.
Therefore 2⁻³ = 1/8.', 'A negative exponent does not make the answer negative. It tells you to use a reciprocal.'),
  ('G9-EXP-SCI-NOTATION-EXTENSION', 'Scientific notation extension', 'By the end of this optional extension, you should be able to write large and small numbers in scientific notation.', 'Scientific notation writes a number as a × 10ⁿ where 1 ≤ a < 10. Moving the decimal left gives a positive exponent; moving it right gives a negative exponent. This extension supports number sense but is not a required Term 1 mastery prerequisite.', 'Write 4 500 000 in scientific notation.
Move the decimal six places left: 4.5.
Therefore 4 500 000 = 4.5 × 10⁶.', 'The first number must be at least 1 but less than 10; 45 × 10⁵ is not standard scientific notation.'),
  ('G9-PAT-NUMERIC-STRUCTURE', 'Numeric patterns and differences', 'By the end of this lesson, you should be able to identify a constant first difference and extend a linear pattern.', 'A linear number pattern has the same change between consecutive terms. This constant first difference is the coefficient of n in its nth-term rule. Use a table to record term number n and value Tn.', 'Extend 5, 9, 13, …
First differences: +4, +4.
Add 4 again: 17, then 21.
The pattern has constant first difference 4.', 'Do not use a constant ratio test for a pattern with a constant difference. Ratios are useful for geometric sequences, not these linear patterns.'),
  ('G9-PAT-GENERAL-RULE', 'Linear nth-term rules', 'By the end of this lesson, you should be able to find and test a linear nth-term rule.', 'For a linear pattern, start with Tn = dn + c, where d is the first difference. Substitute n = 1 and the first term to find c. Then test the rule with another term; a rule is only useful if it matches the pattern.', 'Find the rule for 6, 10, 14, …
Difference d = 4, so Tn = 4n + c.
At n = 1: 4 + c = 6, so c = 2.
Rule: Tn = 4n + 2. Check T2 = 10.', 'Using the first term as c is a common error. Remember that n starts at 1, so substitute it to find c.'),
  ('G9-PAT-GEOMETRIC-VISUAL', 'Geometric matchstick and tile patterns', 'By the end of this lesson, you should be able to connect a growing diagram to a table and rule.', 'For a visual pattern, count the first few figures carefully and identify what each new figure adds. In a row of joined squares, the first square uses 4 matchsticks and each extra square shares a side, so it adds 3. The rule is M = 3n + 1.', 'How many matchsticks for 5 joined squares?
M = 3n + 1.
M = 3(5) + 1 = 16.
So 5 joined squares need 16 matchsticks.', 'Counting 4n treats every square as separate and counts shared sides twice.'),
  ('G8-NUM-WHOLE-PROPERTIES', 'Grade 8 bridge: factors and order', 'By the end of this bridge, you should be able to use factors and the order of operations before returning to Grade 9.', 'Factors divide exactly. In calculations, do brackets first, then multiplication or division, then addition or subtraction. This bridge helps with HCF, LCM and integer work.', 'Simplify 20 − 4 × 3.
Multiply first: 4 × 3 = 12.
Then 20 − 12 = 8.', 'Working left to right through every symbol ignores the order of operations.'),
  ('G8-NUM-FRACTIONS-OPERATIONS', 'Grade 8 bridge: fractions', 'By the end of this bridge, you should be able to add and compare simple fractions.', 'Fractions must have a common denominator before adding or subtracting. Equivalent fractions name the same amount and are made by multiplying numerator and denominator by the same number.', 'Calculate 1/3 + 1/6.
The common denominator is 6.
1/3 = 2/6.
2/6 + 1/6 = 3/6 = 1/2.', 'Do not add denominators: 1/3 + 1/6 is not 2/9.'),
  ('G8-NUM-DECIMALS-OPERATIONS', 'Grade 8 bridge: decimal operations', 'By the end of this bridge, you should be able to calculate accurately with decimals.', 'Line up decimal points when adding or subtracting. For multiplication, estimate first and place the decimal after multiplying whole-number digits. Decimals support rates, money and proportional reasoning.', 'Calculate 4.75 + 2.6.
Write 2.6 as 2.60.
4.75 + 2.60 = 7.35.', 'Do not line up the final digits instead of the decimal points.'),
  ('G8-NUM-INTEGERS-OPERATIONS', 'Grade 8 bridge: signed numbers', 'By the end of this bridge, you should be able to add, subtract and multiply signed integers.', 'Use a number line for addition and subtraction. For multiplication, matching signs give a positive result; different signs give a negative result. These ideas support Grade 9 integer calculations.', 'Calculate −3 + 8.
Start at −3.
Move 8 steps right.
The answer is 5.', 'Subtracting a negative changes to adding its opposite.'),
  ('G8-EXP-LAWS-SCI', 'Grade 8 bridge: exponent basics', 'By the end of this bridge, you should be able to read powers and use the product law with the same base.', 'An exponent tells how many equal factors are multiplied. For the same base, multiplication adds exponents. This is the foundation for Grade 9 zero and negative exponents.', 'Simplify 3² × 3⁴.
The base is 3 in both terms.
Add exponents: 2+4=6.
Answer: 3⁶.', 'Exponents are not ordinary numbers to multiply when bases are being multiplied.'),
  ('G8-PAT-REPRESENT-RULE', 'Grade 8 bridge: simple pattern rules', 'By the end of this bridge, you should be able to extend a simple number pattern and test a rule.', 'Find how a pattern changes, then use a table to test a proposed rule. A constant first difference means that each new term adds the same number.', 'For 2, 5, 8, … the change is +3.
The next term is 11.
A matching rule is Tn = 3n − 1.', 'A rule must work for the first and another term, not just one chosen term.')
)
insert into public.learning_skill_content(curriculum_skill_id,title,learning_objective,explanation,worked_example,common_misconception,source_tier,review_status,review_notes)
select skill.id, authored.title, authored.learning_objective, authored.explanation, authored.worked_example, authored.common_misconception, 'Odysseus_authored', 'draft', 'Sprint 4 authored lesson. Verify mathematics, language, worked example and misconception before approval.'
from authored join public.curriculum_skills skill on skill.skill_code=authored.skill_code
on conflict(curriculum_skill_id) do update set title=excluded.title,learning_objective=excluded.learning_objective,explanation=excluded.explanation,worked_example=excluded.worked_example,common_misconception=excluded.common_misconception,updated_at=now() where public.learning_skill_content.review_status in ('draft','rejected');

with authored(item_code,skill_code,grade,prompt,answer_config,solution,reasoning_classification,cognitive_level) as (
values
  ('Q.G9.S4.PRACTICE.REAL.01', 'G9-NUM-REAL-IRRATIONAL', 'Grade 9', 'Which number is irrational?', '{"type":"multiple_choice","options":{"A":"√20","B":"0.25","C":"−7","D":"3/5"},"correct_option":"A","distractor_explanations":{"B":"Revisit the worked method: Check whether the radicand is a perfect square.","C":"Revisit the worked method: Check whether the radicand is a perfect square.","D":"Revisit the worked method: Check whether the radicand is a perfect square."}}'::jsonb, '20 is not a perfect square, so √20 cannot be written as a ratio of integers. The other choices are rational.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.REAL.02', 'G9-NUM-REAL-IRRATIONAL', 'Grade 9', 'Classify √121.', '{"type":"multiple_choice","options":{"A":"Not a real number","B":"A rational integer","C":"An irrational number","D":"A negative integer"},"correct_option":"B","distractor_explanations":{"A":"Revisit the worked method: Find the principal square root first.","C":"Revisit the worked method: Find the principal square root first.","D":"Revisit the worked method: Find the principal square root first."}}'::jsonb, '√121 = 11. It is a natural number, an integer and therefore rational.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.REAL.03', 'G9-NUM-REAL-IRRATIONAL', 'Grade 9', 'Why is 0.333… rational?', '{"type":"multiple_choice","options":{"A":"It is close to zero","B":"It contains a decimal point","C":"It is equal to 1/3","D":"It has infinitely many digits"},"correct_option":"C","distractor_explanations":{"A":"Revisit the worked method: Recurring is different from non-repeating.","B":"Revisit the worked method: Recurring is different from non-repeating.","D":"Revisit the worked method: Recurring is different from non-repeating."}}'::jsonb, 'A recurring decimal has a fractional form. Here 0.333… = 1/3, so it is rational.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.REAL.04', 'G9-NUM-REAL-IRRATIONAL', 'Grade 9', 'Which statement is correct about √49?', '{"type":"multiple_choice","options":{"A":"It is irrational because it has a root sign","B":"It is negative because 49 has two roots","C":"It is not real","D":"It is rational because √49 = 7"},"correct_option":"D","distractor_explanations":{"A":"Revisit the worked method: What positive number squared gives 49?","B":"Revisit the worked method: What positive number squared gives 49?","C":"Revisit the worked method: What positive number squared gives 49?"}}'::jsonb, 'The symbol √ means the principal, non-negative square root. √49 = 7, a rational integer.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.HCF-LCM.01', 'G9-NUM-WHOLE-HCF-LCM', 'Grade 9', 'What is the prime factorisation of 84?', '{"type":"multiple_choice","options":{"A":"2 × 3 × 7","B":"2³ × 3 × 7","C":"2² × 3² × 7","D":"2² × 3 × 7"},"correct_option":"D","distractor_explanations":{"A":"Revisit the worked method: Keep dividing by prime numbers.","B":"Revisit the worked method: Keep dividing by prime numbers.","C":"Revisit the worked method: Keep dividing by prime numbers."}}'::jsonb, '84 = 4 × 21 = 2² × 3 × 7.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.HCF-LCM.02', 'G9-NUM-WHOLE-HCF-LCM', 'Grade 9', 'Find the HCF of 30 and 45.', '{"type":"multiple_choice","options":{"A":"15","B":"5","C":"10","D":"90"},"correct_option":"A","distractor_explanations":{"B":"Revisit the worked method: List the prime factors of both numbers.","C":"Revisit the worked method: List the prime factors of both numbers.","D":"Revisit the worked method: List the prime factors of both numbers."}}'::jsonb, '30 = 2 × 3 × 5 and 45 = 3² × 5. The common factors are 3 and 5, so the HCF is 15.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.HCF-LCM.03', 'G9-NUM-WHOLE-HCF-LCM', 'Grade 9', 'Two buses arrive every 12 and 18 minutes. When do they next arrive together?', '{"type":"multiple_choice","options":{"A":"216 minutes","B":"36 minutes","C":"6 minutes","D":"30 minutes"},"correct_option":"B","distractor_explanations":{"A":"Revisit the worked method: A future time must be a multiple of both intervals.","C":"Revisit the worked method: A future time must be a multiple of both intervals.","D":"Revisit the worked method: A future time must be a multiple of both intervals."}}'::jsonb, 'The next shared arrival is the LCM. LCM(12,18) = 36.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.HCF-LCM.04', 'G9-NUM-WHOLE-HCF-LCM', 'Grade 9', 'A learner says the HCF of 16 and 24 is 384. What is the correction?', '{"type":"multiple_choice","options":{"A":"HCF is 384, because numbers are multiplied","B":"HCF is 16, because it is the smaller number","C":"HCF is 8, the greatest factor common to both","D":"HCF is 40, because factors are added"},"correct_option":"C","distractor_explanations":{"A":"Revisit the worked method: HCF describes a shared divisor, not a product.","B":"Revisit the worked method: HCF describes a shared divisor, not a product.","D":"Revisit the worked method: HCF describes a shared divisor, not a product."}}'::jsonb, '16 = 2⁴ and 24 = 2³ × 3. The common part is 2³ = 8.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.RATIO-RATE.01', 'G9-NUM-RATIO-RATE', 'Grade 9', 'Simplify 18 : 24.', '{"type":"multiple_choice","options":{"A":"9 : 12","B":"42 : 1","C":"3 : 4","D":"6 : 8 : 2"},"correct_option":"C","distractor_explanations":{"A":"Revisit the worked method: Find a number that divides both parts.","B":"Revisit the worked method: Find a number that divides both parts.","D":"Revisit the worked method: Find a number that divides both parts."}}'::jsonb, 'The HCF of 18 and 24 is 6. Divide both parts: 18 ÷ 6 : 24 ÷ 6 = 3 : 4.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.RATIO-RATE.02', 'G9-NUM-RATIO-RATE', 'Grade 9', 'A taxi travels 150 km in 3 hours. What is its average speed?', '{"type":"multiple_choice","options":{"A":"153 km/h","B":"450 km/h","C":"47 km/h","D":"50 km/h"},"correct_option":"D","distractor_explanations":{"A":"Revisit the worked method: A unit rate means “for one hour”.","B":"Revisit the worked method: A unit rate means “for one hour”.","C":"Revisit the worked method: A unit rate means “for one hour”."}}'::jsonb, 'Speed = distance ÷ time = 150 ÷ 3 = 50 km/h.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.RATIO-RATE.03', 'G9-NUM-RATIO-RATE', 'Grade 9', 'Paint is mixed red : white = 2 : 5. If 6 cups are red, how many cups are white?', '{"type":"multiple_choice","options":{"A":"15 cups","B":"11 cups","C":"30 cups","D":"5 cups"},"correct_option":"A","distractor_explanations":{"B":"Revisit the worked method: Find the scale factor first.","C":"Revisit the worked method: Find the scale factor first.","D":"Revisit the worked method: Find the scale factor first."}}'::jsonb, 'Red changes from 2 to 6, so multiply by 3. White is 5 × 3 = 15 cups.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.RATIO-RATE.04', 'G9-NUM-RATIO-RATE', 'Grade 9', 'Why must 4 : 6 and 10 : 15 not be treated as equivalent?', '{"type":"multiple_choice","options":{"A":"Ratios cannot be simplified","B":"Their simplified ratios are 2 : 3 and 2 : 3, so they actually are equivalent","C":"The numbers are different","D":"Only ratios with small numbers are equivalent"},"correct_option":"B","distractor_explanations":{"A":"Revisit the worked method: Simplify both ratios before deciding.","C":"Revisit the worked method: Simplify both ratios before deciding.","D":"Revisit the worked method: Simplify both ratios before deciding."}}'::jsonb, '4 : 6 ÷ 2 = 2 : 3 and 10 : 15 ÷ 5 = 2 : 3. Equal simplified ratios show equal relationships.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.PROPORTION.01', 'G9-NUM-DIRECT-INVERSE-PROPORTION', 'Grade 9', 'Five notebooks cost R40. What do eight cost at the same price?', '{"type":"multiple_choice","options":{"A":"R320","B":"R13","C":"R64","D":"R48"},"correct_option":"C","distractor_explanations":{"A":"Revisit the worked method: Find the cost of one notebook.","B":"Revisit the worked method: Find the cost of one notebook.","D":"Revisit the worked method: Find the cost of one notebook."}}'::jsonb, 'One notebook costs R40 ÷ 5 = R8. Eight cost 8 × R8 = R64.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.PROPORTION.02', 'G9-NUM-DIRECT-INVERSE-PROPORTION', 'Grade 9', 'Eight taps fill a tank in 6 hours. How long would 12 identical taps take?', '{"type":"multiple_choice","options":{"A":"9 hours","B":"18 hours","C":"6 hours","D":"4 hours"},"correct_option":"D","distractor_explanations":{"A":"Revisit the worked method: For inverse proportion, multiply first then divide.","B":"Revisit the worked method: For inverse proportion, multiply first then divide.","C":"Revisit the worked method: For inverse proportion, multiply first then divide."}}'::jsonb, 'The work is 8 × 6 = 48 tap-hours. 48 ÷ 12 = 4 hours.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.PROPORTION.03', 'G9-NUM-DIRECT-INVERSE-PROPORTION', 'Grade 9', 'Which situation is inverse proportion?', '{"type":"multiple_choice","options":{"A":"For a fixed trip, higher speed means less travel time","B":"More loaves cost more at one price","C":"More litres give a higher water bill","D":"More pages mean more printing"},"correct_option":"A","distractor_explanations":{"B":"Revisit the worked method: Look for a fixed total task or distance.","C":"Revisit the worked method: Look for a fixed total task or distance.","D":"Revisit the worked method: Look for a fixed total task or distance."}}'::jsonb, 'For the same distance, speed × time is fixed. Increasing speed decreases time.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.PROPORTION.04', 'G9-NUM-DIRECT-INVERSE-PROPORTION', 'Grade 9', 'A learner doubles workers and doubles days. What error was made?', '{"type":"multiple_choice","options":{"A":"They should add workers and days","B":"They treated an inverse relationship as direct","C":"They simplified the ratio too far","D":"They forgot a decimal point"},"correct_option":"B","distractor_explanations":{"A":"Revisit the worked method: Test the answer: would more workers really take longer?","C":"Revisit the worked method: Test the answer: would more workers really take longer?","D":"Revisit the worked method: Test the answer: would more workers really take longer?"}}'::jsonb, 'For the same job, doubling workers halves the time. The worker-day total stays constant.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.FINANCE.01', 'G9-NUM-FINANCIAL-APPLICATIONS', 'Grade 9', 'What is 7% commission on R3 000?', '{"type":"multiple_choice","options":{"A":"R21","B":"R2 790","C":"R700","D":"R210"},"correct_option":"D","distractor_explanations":{"A":"Revisit the worked method: Change the percent to a decimal.","B":"Revisit the worked method: Change the percent to a decimal.","C":"Revisit the worked method: Change the percent to a decimal."}}'::jsonb, '7% = 0.07. R3 000 × 0.07 = R210.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.FINANCE.02', 'G9-NUM-FINANCIAL-APPLICATIONS', 'Grade 9', 'A bike costs R80 per day plus one R50 deposit. What is paid for 3 days?', '{"type":"multiple_choice","options":{"A":"R290","B":"R390","C":"R240","D":"R130"},"correct_option":"A","distractor_explanations":{"B":"Revisit the worked method: The deposit is once-off.","C":"Revisit the worked method: The deposit is once-off.","D":"Revisit the worked method: The deposit is once-off."}}'::jsonb, '3 × R80 = R240. Add one deposit: R240 + R50 = R290.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.FINANCE.03', 'G9-NUM-FINANCIAL-APPLICATIONS', 'Grade 9', 'R1 500 grows by 8% compound interest for two years. What is the balance?', '{"type":"multiple_choice","options":{"A":"R1 620.80","B":"R1 749.60","C":"R1 620.00","D":"R1 740.00"},"correct_option":"B","distractor_explanations":{"A":"Revisit the worked method: Apply 8% to the new balance in year 2.","C":"Revisit the worked method: Apply 8% to the new balance in year 2.","D":"Revisit the worked method: Apply 8% to the new balance in year 2."}}'::jsonb, 'Year 1: 1500 × 1.08 = 1620. Year 2: 1620 × 1.08 = 1749.60.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.FINANCE.04', 'G9-NUM-FINANCIAL-APPLICATIONS', 'Grade 9', 'Why is compound interest greater than simple interest after two positive years?', '{"type":"multiple_choice","options":{"A":"The original balance is ignored","B":"Interest is subtracted first","C":"Second-year interest is earned on the increased balance","D":"The percentage doubles automatically"},"correct_option":"C","distractor_explanations":{"A":"Revisit the worked method: Compare the base used in the second year.","B":"Revisit the worked method: Compare the base used in the second year.","D":"Revisit the worked method: Compare the base used in the second year."}}'::jsonb, 'Compound interest adds year-one interest to the balance before calculating year two.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.INTEGER-OPS.01', 'G9-NUM-INTEGERS-OPERATIONS', 'Grade 9', 'Calculate −8 + 13.', '{"type":"multiple_choice","options":{"A":"−21","B":"−5","C":"21","D":"5"},"correct_option":"D","distractor_explanations":{"A":"Revisit the worked method: A positive addend moves right.","B":"Revisit the worked method: A positive addend moves right.","C":"Revisit the worked method: A positive addend moves right."}}'::jsonb, 'Starting at −8 and adding 13 gives 5.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.INTEGER-OPS.02', 'G9-NUM-INTEGERS-OPERATIONS', 'Grade 9', 'Calculate (−7) × 6.', '{"type":"multiple_choice","options":{"A":"−42","B":"42","C":"−13","D":"13"},"correct_option":"A","distractor_explanations":{"B":"Revisit the worked method: Check whether the signs match.","C":"Revisit the worked method: Check whether the signs match.","D":"Revisit the worked method: Check whether the signs match."}}'::jsonb, 'The signs differ, so the product is negative. 7 × 6 = 42.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.INTEGER-OPS.03', 'G9-NUM-INTEGERS-OPERATIONS', 'Grade 9', 'Calculate 18 ÷ [3 + (−6)].', '{"type":"multiple_choice","options":{"A":"−3","B":"−6","C":"6","D":"0"},"correct_option":"B","distractor_explanations":{"A":"Revisit the worked method: Brackets are calculated first.","C":"Revisit the worked method: Brackets are calculated first.","D":"Revisit the worked method: Brackets are calculated first."}}'::jsonb, 'Evaluate the bracket: 3 + (−6) = −3. Then 18 ÷ −3 = −6.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.INTEGER-OPS.04', 'G9-NUM-INTEGERS-OPERATIONS', 'Grade 9', 'Why is −4 − 7 equal to −11?', '{"type":"multiple_choice","options":{"A":"Only 7 is negative","B":"All subtraction answers are negative","C":"Subtracting 7 moves 7 units left from −4","D":"The signs cancel"},"correct_option":"C","distractor_explanations":{"A":"Revisit the worked method: Think about direction on a number line.","B":"Revisit the worked method: Think about direction on a number line.","D":"Revisit the worked method: Think about direction on a number line."}}'::jsonb, 'On a number line start at −4 and move seven units left, reaching −11.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.POWERS-ROOTS.01', 'G9-NUM-INTEGERS-POWERS-ROOTS', 'Grade 9', 'What is (−5)²?', '{"type":"multiple_choice","options":{"A":"25","B":"−25","C":"−10","D":"10"},"correct_option":"A","distractor_explanations":{"B":"Revisit the worked method: Square the whole bracketed number.","C":"Revisit the worked method: Square the whole bracketed number.","D":"Revisit the worked method: Square the whole bracketed number."}}'::jsonb, '(−5)² = (−5) × (−5) = 25.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.POWERS-ROOTS.02', 'G9-NUM-INTEGERS-POWERS-ROOTS', 'Grade 9', 'What is ∛(−216)?', '{"type":"multiple_choice","options":{"A":"36","B":"−6","C":"6","D":"−36"},"correct_option":"B","distractor_explanations":{"A":"Revisit the worked method: Which negative number cubed gives −216?","C":"Revisit the worked method: Which negative number cubed gives −216?","D":"Revisit the worked method: Which negative number cubed gives −216?"}}'::jsonb, '(−6) × (−6) × (−6) = −216.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.POWERS-ROOTS.03', 'G9-NUM-INTEGERS-POWERS-ROOTS', 'Grade 9', 'Evaluate −3².', '{"type":"multiple_choice","options":{"A":"−6","B":"6","C":"−9","D":"9"},"correct_option":"C","distractor_explanations":{"A":"Revisit the worked method: There are no brackets around −3.","B":"Revisit the worked method: There are no brackets around −3.","D":"Revisit the worked method: There are no brackets around −3."}}'::jsonb, 'The exponent applies to 3 first: −3² = −(3²) = −9.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.POWERS-ROOTS.04', 'G9-NUM-INTEGERS-POWERS-ROOTS', 'Grade 9', 'Why is √64 not ±8?', '{"type":"multiple_choice","options":{"A":"Square roots have no value","B":"Both signs are always written","C":"64 has only one square root equation","D":"√ means the principal non-negative root"},"correct_option":"D","distractor_explanations":{"A":"Revisit the worked method: Separate a root symbol from solving an equation.","B":"Revisit the worked method: Separate a root symbol from solving an equation.","C":"Revisit the worked method: Separate a root symbol from solving an equation."}}'::jsonb, 'The equation x² = 64 has ±8 solutions, but the symbol √64 is defined as the principal root 8.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.EXP-LAWS.01', 'G9-EXP-LAWS-EXTENDED', 'Grade 9', 'Simplify a⁴ × a³.', '{"type":"multiple_choice","options":{"A":"a⁷","B":"a¹²","C":"a¹","D":"7a"},"correct_option":"A","distractor_explanations":{"B":"Revisit the worked method: The base remains a.","C":"Revisit the worked method: The base remains a.","D":"Revisit the worked method: The base remains a."}}'::jsonb, 'The bases match, so add exponents: 4 + 3 = 7.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.EXP-LAWS.02', 'G9-EXP-LAWS-EXTENDED', 'Grade 9', 'Simplify y⁹ ÷ y⁴.', '{"type":"multiple_choice","options":{"A":"1/y⁵","B":"y⁵","C":"y¹³","D":"y³⁶"},"correct_option":"B","distractor_explanations":{"A":"Revisit the worked method: Use the quotient law.","C":"Revisit the worked method: Use the quotient law.","D":"Revisit the worked method: Use the quotient law."}}'::jsonb, 'For division with the same base, subtract: 9 − 4 = 5.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.EXP-LAWS.03', 'G9-EXP-LAWS-EXTENDED', 'Grade 9', 'Simplify (m²n³)².', '{"type":"multiple_choice","options":{"A":"m⁴n⁹","B":"m²n⁶","C":"m⁴n⁶","D":"m⁴n⁵"},"correct_option":"C","distractor_explanations":{"A":"Revisit the worked method: Every exponent inside the bracket is multiplied.","B":"Revisit the worked method: Every exponent inside the bracket is multiplied.","D":"Revisit the worked method: Every exponent inside the bracket is multiplied."}}'::jsonb, 'Apply the outer power to each factor: m^(2×2)n^(3×2).', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.EXP-LAWS.04', 'G9-EXP-LAWS-EXTENDED', 'Grade 9', 'A learner writes x² + x³ = x⁵. What is correct?', '{"type":"multiple_choice","options":{"A":"The answer is always x⁵","B":"Add the bases instead","C":"Subtract the exponents","D":"The product law applies to multiplication, not addition"},"correct_option":"D","distractor_explanations":{"A":"Revisit the worked method: Look at the operation between the terms.","B":"Revisit the worked method: Look at the operation between the terms.","C":"Revisit the worked method: Look at the operation between the terms."}}'::jsonb, 'x² and x³ are unlike terms, so they do not combine through an exponent law.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.EXP-ZERO-NEGATIVE.01', 'G9-EXP-NEGATIVE-SCI', 'Grade 9', 'What is 9⁰?', '{"type":"multiple_choice","options":{"A":"Undefined","B":"1","C":"0","D":"9"},"correct_option":"B","distractor_explanations":{"A":"Revisit the worked method: The base is non-zero.","C":"Revisit the worked method: The base is non-zero.","D":"Revisit the worked method: The base is non-zero."}}'::jsonb, 'Any non-zero number to exponent zero equals 1.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.EXP-ZERO-NEGATIVE.02', 'G9-EXP-NEGATIVE-SCI', 'Grade 9', 'What is 10⁻²?', '{"type":"multiple_choice","options":{"A":"100","B":"−0.01","C":"0.01","D":"−100"},"correct_option":"C","distractor_explanations":{"A":"Revisit the worked method: Write the reciprocal first.","B":"Revisit the worked method: Write the reciprocal first.","D":"Revisit the worked method: Write the reciprocal first."}}'::jsonb, '10⁻² = 1/10² = 1/100 = 0.01.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.EXP-ZERO-NEGATIVE.03', 'G9-EXP-NEGATIVE-SCI', 'Grade 9', 'Which expression equals 1/p⁵?', '{"type":"multiple_choice","options":{"A":"−p⁵","B":"p⁵","C":"1/5p","D":"p⁻⁵"},"correct_option":"D","distractor_explanations":{"A":"Revisit the worked method: The negative belongs to the exponent.","B":"Revisit the worked method: The negative belongs to the exponent.","C":"Revisit the worked method: The negative belongs to the exponent."}}'::jsonb, 'By definition, p⁻⁵ = 1/p⁵ for p ≠ 0.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.EXP-ZERO-NEGATIVE.04', 'G9-EXP-NEGATIVE-SCI', 'Grade 9', 'Why is 0⁰ not used in the zero-exponent rule?', '{"type":"multiple_choice","options":{"A":"The quotient-law argument would divide 0 by 0","B":"Zero has no powers","C":"It must equal 1","D":"It must equal 0"},"correct_option":"A","distractor_explanations":{"B":"Revisit the worked method: What happens if the denominator is zero?","C":"Revisit the worked method: What happens if the denominator is zero?","D":"Revisit the worked method: What happens if the denominator is zero?"}}'::jsonb, 'The rule a⁰ comes from a¹ ÷ a¹, which needs a non-zero base.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.SCI-NOTATION.01', 'G9-EXP-SCI-NOTATION-EXTENSION', 'Grade 9', 'Write 72 000 in scientific notation.', '{"type":"multiple_choice","options":{"A":"7.2 × 10⁴","B":"72 × 10³","C":"7.2 × 10³","D":"0.72 × 10⁵"},"correct_option":"A","distractor_explanations":{"B":"Revisit the worked method: Make the first number between 1 and 10.","C":"Revisit the worked method: Make the first number between 1 and 10.","D":"Revisit the worked method: Make the first number between 1 and 10."}}'::jsonb, 'Move the decimal four places left: 72 000 = 7.2 × 10⁴.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.SCI-NOTATION.02', 'G9-EXP-SCI-NOTATION-EXTENSION', 'Grade 9', 'What is 3.6 × 10³ in ordinary notation?', '{"type":"multiple_choice","options":{"A":"0.0036","B":"3 600","C":"360","D":"36 000"},"correct_option":"B","distractor_explanations":{"A":"Revisit the worked method: A positive exponent makes a larger number.","C":"Revisit the worked method: A positive exponent makes a larger number.","D":"Revisit the worked method: A positive exponent makes a larger number."}}'::jsonb, '10³ = 1000, so 3.6 × 1000 = 3600.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.SCI-NOTATION.03', 'G9-EXP-SCI-NOTATION-EXTENSION', 'Grade 9', 'Write 0.0042 in scientific notation.', '{"type":"multiple_choice","options":{"A":"42 × 10⁻⁴","B":"0.42 × 10⁻²","C":"4.2 × 10⁻³","D":"4.2 × 10³"},"correct_option":"C","distractor_explanations":{"A":"Revisit the worked method: Small decimals need negative powers of ten.","B":"Revisit the worked method: Small decimals need negative powers of ten.","D":"Revisit the worked method: Small decimals need negative powers of ten."}}'::jsonb, 'Move the decimal three places right to get 4.2, so use exponent −3.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.SCI-NOTATION.04', 'G9-EXP-SCI-NOTATION-EXTENSION', 'Grade 9', 'Why is 45 × 10⁵ not standard scientific notation?', '{"type":"multiple_choice","options":{"A":"The exponent must be negative","B":"Scientific notation cannot use 10⁵","C":"45 is too small","D":"45 is not less than 10"},"correct_option":"D","distractor_explanations":{"A":"Revisit the worked method: Check the leading number.","B":"Revisit the worked method: Check the leading number.","C":"Revisit the worked method: Check the leading number."}}'::jsonb, 'Standard form requires 1 ≤ a < 10. Rewrite it as 4.5 × 10⁶.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.PATTERN-STRUCTURE.01', 'G9-PAT-NUMERIC-STRUCTURE', 'Grade 9', 'What is the first difference of 11, 16, 21, 26, …?', '{"type":"multiple_choice","options":{"A":"−5","B":"5","C":"11","D":"10"},"correct_option":"B","distractor_explanations":{"A":"Revisit the worked method: Subtract consecutive terms.","C":"Revisit the worked method: Subtract consecutive terms.","D":"Revisit the worked method: Subtract consecutive terms."}}'::jsonb, '16 − 11 = 5, and the same change continues.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.PATTERN-STRUCTURE.02', 'G9-PAT-NUMERIC-STRUCTURE', 'Grade 9', 'Extend 4, 10, 16, … by two terms.', '{"type":"multiple_choice","options":{"A":"26, 36","B":"18, 20","C":"22, 28","D":"20, 24"},"correct_option":"C","distractor_explanations":{"A":"Revisit the worked method: Find the constant change.","B":"Revisit the worked method: Find the constant change.","D":"Revisit the worked method: Find the constant change."}}'::jsonb, 'The first difference is 6, so add 6 twice.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.PATTERN-STRUCTURE.03', 'G9-PAT-NUMERIC-STRUCTURE', 'Grade 9', 'Which statement shows a linear pattern?', '{"type":"multiple_choice","options":{"A":"Its terms are all even","B":"Its ratio is constant","C":"It starts at zero","D":"Its first differences are constant"},"correct_option":"D","distractor_explanations":{"A":"Revisit the worked method: Compare changes, not just values.","B":"Revisit the worked method: Compare changes, not just values.","C":"Revisit the worked method: Compare changes, not just values."}}'::jsonb, 'Constant first differences identify a linear pattern.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.PATTERN-STRUCTURE.04', 'G9-PAT-NUMERIC-STRUCTURE', 'Grade 9', 'A table has T1 = 7, T2 = 12, T3 = 17. What is T8?', '{"type":"multiple_choice","options":{"A":"42","B":"37","C":"47","D":"52"},"correct_option":"A","distractor_explanations":{"B":"Revisit the worked method: Count the jumps between term 1 and term 8.","C":"Revisit the worked method: Count the jumps between term 1 and term 8.","D":"Revisit the worked method: Count the jumps between term 1 and term 8."}}'::jsonb, 'The difference is 5. From T1 to T8 there are seven increases: 7 + 7×5 = 42.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.NTH-TERM.01', 'G9-PAT-GENERAL-RULE', 'Grade 9', 'Find the nth term of 3, 7, 11, …', '{"type":"multiple_choice","options":{"A":"4n − 1","B":"4n + 3","C":"3n + 1","D":"n + 3"},"correct_option":"A","distractor_explanations":{"B":"Revisit the worked method: Use the first term to solve for c.","C":"Revisit the worked method: Use the first term to solve for c.","D":"Revisit the worked method: Use the first term to solve for c."}}'::jsonb, 'Difference is 4. At n=1, 4+c=3, so c=−1.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.NTH-TERM.02', 'G9-PAT-GENERAL-RULE', 'Grade 9', 'For Tn = 5n + 2, find T6.', '{"type":"multiple_choice","options":{"A":"13","B":"32","C":"30","D":"37"},"correct_option":"B","distractor_explanations":{"A":"Revisit the worked method: Put 6 in place of n.","C":"Revisit the worked method: Put 6 in place of n.","D":"Revisit the worked method: Put 6 in place of n."}}'::jsonb, 'Substitute n=6: 5(6)+2=32.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.NTH-TERM.03', 'G9-PAT-GENERAL-RULE', 'Grade 9', 'Why should you test an nth-term rule using n = 2?', '{"type":"multiple_choice","options":{"A":"It makes c equal zero","B":"It removes the need for n = 1","C":"It checks that the rule fits more than one term","D":"It changes the first difference"},"correct_option":"C","distractor_explanations":{"A":"Revisit the worked method: A pattern rule must match the sequence, not one value.","B":"Revisit the worked method: A pattern rule must match the sequence, not one value.","D":"Revisit the worked method: A pattern rule must match the sequence, not one value."}}'::jsonb, 'A second test catches a rule that only happens to fit the first term.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.NTH-TERM.04', 'G9-PAT-GENERAL-RULE', 'Grade 9', 'A learner gives Tn = 3n + 8 for 8, 11, 14, … . What is correct?', '{"type":"multiple_choice","options":{"A":"It should be 8n + 3","B":"It should be 3n","C":"The learner rule is correct","D":"It should be 3n + 5"},"correct_option":"D","distractor_explanations":{"A":"Revisit the worked method: Test the learner rule at n=1.","B":"Revisit the worked method: Test the learner rule at n=1.","C":"Revisit the worked method: Test the learner rule at n=1."}}'::jsonb, 'The difference is 3. At n=1, 3+c=8, so c=5.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.VISUAL-PATTERNS.01', 'G9-PAT-GEOMETRIC-VISUAL', 'Grade 9', 'How many matchsticks are needed for 4 joined squares in a row?', '{"type":"multiple_choice","options":{"A":"12","B":"16","C":"10","D":"13"},"correct_option":"D","distractor_explanations":{"A":"Revisit the worked method: Each new square adds 3, not 4.","B":"Revisit the worked method: Each new square adds 3, not 4.","C":"Revisit the worked method: Each new square adds 3, not 4."}}'::jsonb, 'M = 3n+1. For n=4, M=13.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.VISUAL-PATTERNS.02', 'G9-PAT-GEOMETRIC-VISUAL', 'Grade 9', 'Which rule fits a pattern beginning 5, 8, 11, …?', '{"type":"multiple_choice","options":{"A":"3n + 2","B":"3n + 5","C":"5n + 3","D":"n + 4"},"correct_option":"A","distractor_explanations":{"B":"Revisit the worked method: Find the difference, then test n=1.","C":"Revisit the worked method: Find the difference, then test n=1.","D":"Revisit the worked method: Find the difference, then test n=1."}}'::jsonb, 'Difference is 3. At n=1, 3+c=5, so c=2.', 'procedural', 'routine'),
  ('Q.G9.S4.PRACTICE.VISUAL-PATTERNS.03', 'G9-PAT-GEOMETRIC-VISUAL', 'Grade 9', 'Why does a joined-square row use 3n + 1 instead of 4n?', '{"type":"multiple_choice","options":{"A":"Squares only need three sides","B":"Each added square shares one side","C":"The first square has no sides","D":"n is always one"},"correct_option":"B","distractor_explanations":{"A":"Revisit the worked method: Look at what is shared between neighbours.","C":"Revisit the worked method: Look at what is shared between neighbours.","D":"Revisit the worked method: Look at what is shared between neighbours."}}'::jsonb, 'The n−1 shared sides mean the total is 4n−(n−1)=3n+1.', 'mathematical_reasoning', 'complex'),
  ('Q.G9.S4.PRACTICE.VISUAL-PATTERNS.04', 'G9-PAT-GEOMETRIC-VISUAL', 'Grade 9', 'A tile pattern has figure 1 = 6 and adds 4 tiles each figure. What is figure 7?', '{"type":"multiple_choice","options":{"A":"34","B":"42","C":"30","D":"28"},"correct_option":"C","distractor_explanations":{"A":"Revisit the worked method: There are six increases from figure 1 to figure 7.","B":"Revisit the worked method: There are six increases from figure 1 to figure 7.","D":"Revisit the worked method: There are six increases from figure 1 to figure 7."}}'::jsonb, 'Tn=6+4(n−1). T7=6+4×6=30.', 'mathematical_reasoning', 'complex'),
  ('Q.G8.S4.PRACTICE.G8-FACTORS.01', 'G8-NUM-WHOLE-PROPERTIES', 'Grade 8', 'Simplify 18 ÷ 3 + 4.', '{"type":"multiple_choice","options":{"A":"3","B":"22","C":"10","D":"2"},"correct_option":"C","distractor_explanations":{"A":"Revisit the worked method: Divide before adding.","B":"Revisit the worked method: Divide before adding.","D":"Revisit the worked method: Divide before adding."}}'::jsonb, '18 ÷ 3 = 6, then 6 + 4 = 10.', 'procedural', 'routine'),
  ('Q.G8.S4.PRACTICE.G8-FACTORS.02', 'G8-NUM-WHOLE-PROPERTIES', 'Grade 8', 'Which is a factor of 36?', '{"type":"multiple_choice","options":{"A":"8","B":"10","C":"14","D":"9"},"correct_option":"D","distractor_explanations":{"A":"Revisit the worked method: A factor divides exactly.","B":"Revisit the worked method: A factor divides exactly.","C":"Revisit the worked method: A factor divides exactly."}}'::jsonb, '36 ÷ 9 = 4 with no remainder.', 'procedural', 'routine'),
  ('Q.G8.S4.PRACTICE.G8-FACTORS.03', 'G8-NUM-WHOLE-PROPERTIES', 'Grade 8', 'Simplify 5 + 3 × 4.', '{"type":"multiple_choice","options":{"A":"17","B":"32","C":"20","D":"12"},"correct_option":"A","distractor_explanations":{"B":"Revisit the worked method: Multiplication comes before addition.","C":"Revisit the worked method: Multiplication comes before addition.","D":"Revisit the worked method: Multiplication comes before addition."}}'::jsonb, 'Multiply 3×4 first, then add 5.', 'mathematical_reasoning', 'complex'),
  ('Q.G8.S4.PRACTICE.G8-FACTORS.04', 'G8-NUM-WHOLE-PROPERTIES', 'Grade 8', 'Why is 6 a common factor of 18 and 30?', '{"type":"multiple_choice","options":{"A":"It is a multiple of neither","B":"It divides both without a remainder","C":"It is their sum","D":"It is bigger than both"},"correct_option":"B","distractor_explanations":{"A":"Revisit the worked method: Test division for each number.","C":"Revisit the worked method: Test division for each number.","D":"Revisit the worked method: Test division for each number."}}'::jsonb, '18÷6=3 and 30÷6=5.', 'mathematical_reasoning', 'complex'),
  ('Q.G8.S4.PRACTICE.G8-FRACTIONS.01', 'G8-NUM-FRACTIONS-OPERATIONS', 'Grade 8', 'Calculate 1/4 + 2/4.', '{"type":"multiple_choice","options":{"A":"3/4","B":"3/8","C":"2/8","D":"1/2"},"correct_option":"A","distractor_explanations":{"B":"Revisit the worked method: Keep the denominator 4.","C":"Revisit the worked method: Keep the denominator 4.","D":"Revisit the worked method: Keep the denominator 4."}}'::jsonb, 'The denominators match, so add the numerators.', 'procedural', 'routine'),
  ('Q.G8.S4.PRACTICE.G8-FRACTIONS.02', 'G8-NUM-FRACTIONS-OPERATIONS', 'Grade 8', 'Write 3/5 with denominator 20.', '{"type":"multiple_choice","options":{"A":"8/20","B":"12/20","C":"3/20","D":"15/20"},"correct_option":"B","distractor_explanations":{"A":"Revisit the worked method: What makes 5 into 20?","C":"Revisit the worked method: What makes 5 into 20?","D":"Revisit the worked method: What makes 5 into 20?"}}'::jsonb, 'Multiply numerator and denominator by 4.', 'procedural', 'routine'),
  ('Q.G8.S4.PRACTICE.G8-FRACTIONS.03', 'G8-NUM-FRACTIONS-OPERATIONS', 'Grade 8', 'Calculate 2/3 − 1/6.', '{"type":"multiple_choice","options":{"A":"1/3","B":"1/18","C":"1/2","D":"1/6"},"correct_option":"C","distractor_explanations":{"A":"Revisit the worked method: Use denominator 6.","B":"Revisit the worked method: Use denominator 6.","D":"Revisit the worked method: Use denominator 6."}}'::jsonb, '2/3=4/6. 4/6−1/6=3/6=1/2.', 'mathematical_reasoning', 'complex'),
  ('Q.G8.S4.PRACTICE.G8-FRACTIONS.04', 'G8-NUM-FRACTIONS-OPERATIONS', 'Grade 8', 'Why is 2/4 equal to 1/2?', '{"type":"multiple_choice","options":{"A":"The denominators are added","B":"2 is always half of 4","C":"Fractions cannot be simplified","D":"Both simplify to the same part of a whole"},"correct_option":"D","distractor_explanations":{"A":"Revisit the worked method: Simplify the fraction.","B":"Revisit the worked method: Simplify the fraction.","C":"Revisit the worked method: Simplify the fraction."}}'::jsonb, 'Divide numerator and denominator of 2/4 by 2.', 'mathematical_reasoning', 'complex'),
  ('Q.G8.S4.PRACTICE.G8-DECIMALS.01', 'G8-NUM-DECIMALS-OPERATIONS', 'Grade 8', 'Calculate 6.2 − 1.45.', '{"type":"multiple_choice","options":{"A":"5.25","B":"4.65","C":"4.85","D":"4.75"},"correct_option":"D","distractor_explanations":{"A":"Revisit the worked method: Write 6.2 as 6.20.","B":"Revisit the worked method: Write 6.2 as 6.20.","C":"Revisit the worked method: Write 6.2 as 6.20."}}'::jsonb, '6.20−1.45=4.75.', 'procedural', 'routine'),
  ('Q.G8.S4.PRACTICE.G8-DECIMALS.02', 'G8-NUM-DECIMALS-OPERATIONS', 'Grade 8', 'Calculate 0.4 × 0.5.', '{"type":"multiple_choice","options":{"A":"0.2","B":"2","C":"0.02","D":"0.9"},"correct_option":"A","distractor_explanations":{"B":"Revisit the worked method: Estimate: half of 0.4 is 0.2.","C":"Revisit the worked method: Estimate: half of 0.4 is 0.2.","D":"Revisit the worked method: Estimate: half of 0.4 is 0.2."}}'::jsonb, '4×5=20; two decimal places give 0.20.', 'procedural', 'routine'),
  ('Q.G8.S4.PRACTICE.G8-DECIMALS.03', 'G8-NUM-DECIMALS-OPERATIONS', 'Grade 8', 'A R12.50 item costs how much for 3?', '{"type":"multiple_choice","options":{"A":"R125.00","B":"R37.50","C":"R15.50","D":"R36.50"},"correct_option":"B","distractor_explanations":{"A":"Revisit the worked method: Multiply the amount, keeping cents.","C":"Revisit the worked method: Multiply the amount, keeping cents.","D":"Revisit the worked method: Multiply the amount, keeping cents."}}'::jsonb, '12.50×3=37.50.', 'mathematical_reasoning', 'complex'),
  ('Q.G8.S4.PRACTICE.G8-DECIMALS.04', 'G8-NUM-DECIMALS-OPERATIONS', 'Grade 8', 'Why is estimating useful with decimals?', '{"type":"multiple_choice","options":{"A":"It removes units","B":"It makes all answers whole","C":"It can reveal a misplaced decimal point","D":"It replaces calculation"},"correct_option":"C","distractor_explanations":{"A":"Revisit the worked method: Think about the size of the answer.","B":"Revisit the worked method: Think about the size of the answer.","D":"Revisit the worked method: Think about the size of the answer."}}'::jsonb, 'An answer near 20 for 0.4×0.5 is unreasonable; estimate catches it.', 'mathematical_reasoning', 'complex'),
  ('Q.G8.S4.PRACTICE.G8-INTEGERS.01', 'G8-NUM-INTEGERS-OPERATIONS', 'Grade 8', 'Calculate −9 + 4.', '{"type":"multiple_choice","options":{"A":"5","B":"−13","C":"13","D":"−5"},"correct_option":"D","distractor_explanations":{"A":"Revisit the worked method: The negative magnitude is larger.","B":"Revisit the worked method: The negative magnitude is larger.","C":"Revisit the worked method: The negative magnitude is larger."}}'::jsonb, 'Move four right from −9 to −5.', 'procedural', 'routine'),
  ('Q.G8.S4.PRACTICE.G8-INTEGERS.02', 'G8-NUM-INTEGERS-OPERATIONS', 'Grade 8', 'Calculate (−5) × (−3).', '{"type":"multiple_choice","options":{"A":"15","B":"−15","C":"−8","D":"8"},"correct_option":"A","distractor_explanations":{"B":"Revisit the worked method: Two negatives make a positive product.","C":"Revisit the worked method: Two negatives make a positive product.","D":"Revisit the worked method: Two negatives make a positive product."}}'::jsonb, 'Same signs give positive; 5×3=15.', 'procedural', 'routine'),
  ('Q.G8.S4.PRACTICE.G8-INTEGERS.03', 'G8-NUM-INTEGERS-OPERATIONS', 'Grade 8', 'Calculate 7 − (−2).', '{"type":"multiple_choice","options":{"A":"−5","B":"9","C":"5","D":"−9"},"correct_option":"B","distractor_explanations":{"A":"Revisit the worked method: Rewrite as addition.","C":"Revisit the worked method: Rewrite as addition.","D":"Revisit the worked method: Rewrite as addition."}}'::jsonb, 'Subtracting −2 means add 2: 7+2=9.', 'mathematical_reasoning', 'complex'),
  ('Q.G8.S4.PRACTICE.G8-INTEGERS.04', 'G8-NUM-INTEGERS-OPERATIONS', 'Grade 8', 'Why is (−12) ÷ 3 negative?', '{"type":"multiple_choice","options":{"A":"Both numbers are negative","B":"12 is greater than 3","C":"The signs are different","D":"Division ignores signs"},"correct_option":"C","distractor_explanations":{"A":"Revisit the worked method: Compare the signs first.","B":"Revisit the worked method: Compare the signs first.","D":"Revisit the worked method: Compare the signs first."}}'::jsonb, 'A negative divided by a positive is negative.', 'mathematical_reasoning', 'complex'),
  ('Q.G8.S4.PRACTICE.G8-EXPONENTS.01', 'G8-EXP-LAWS-SCI', 'Grade 8', 'What is 2⁴?', '{"type":"multiple_choice","options":{"A":"16","B":"8","C":"6","D":"24"},"correct_option":"A","distractor_explanations":{"B":"Revisit the worked method: Write four factors of 2.","C":"Revisit the worked method: Write four factors of 2.","D":"Revisit the worked method: Write four factors of 2."}}'::jsonb, '2×2×2×2=16.', 'procedural', 'routine'),
  ('Q.G8.S4.PRACTICE.G8-EXPONENTS.02', 'G8-EXP-LAWS-SCI', 'Grade 8', 'Simplify x² × x⁵.', '{"type":"multiple_choice","options":{"A":"x³","B":"x⁷","C":"x¹⁰","D":"2x⁷"},"correct_option":"B","distractor_explanations":{"A":"Revisit the worked method: Keep the base x.","C":"Revisit the worked method: Keep the base x.","D":"Revisit the worked method: Keep the base x."}}'::jsonb, 'Same base product: add 2+5.', 'procedural', 'routine'),
  ('Q.G8.S4.PRACTICE.G8-EXPONENTS.03', 'G8-EXP-LAWS-SCI', 'Grade 8', 'What is the base in (−4)³?', '{"type":"multiple_choice","options":{"A":"4 only","B":"−3","C":"−4","D":"3"},"correct_option":"C","distractor_explanations":{"A":"Revisit the worked method: The exponent sits outside the bracket.","B":"Revisit the worked method: The exponent sits outside the bracket.","D":"Revisit the worked method: The exponent sits outside the bracket."}}'::jsonb, 'Brackets make the complete signed number the base.', 'mathematical_reasoning', 'complex'),
  ('Q.G8.S4.PRACTICE.G8-EXPONENTS.04', 'G8-EXP-LAWS-SCI', 'Grade 8', 'Why is a³ × a² not a⁶?', '{"type":"multiple_choice","options":{"A":"Bases are added","B":"The base changes to 6","C":"It is always a⁶","D":"The exponents are added, not multiplied"},"correct_option":"D","distractor_explanations":{"A":"Revisit the worked method: Count the total factors.","B":"Revisit the worked method: Count the total factors.","C":"Revisit the worked method: Count the total factors."}}'::jsonb, 'There are 3+2 factors of a, giving a⁵.', 'mathematical_reasoning', 'complex'),
  ('Q.G8.S4.PRACTICE.G8-PATTERNS.01', 'G8-PAT-REPRESENT-RULE', 'Grade 8', 'What comes next: 9, 13, 17, …?', '{"type":"multiple_choice","options":{"A":"19","B":"20","C":"22","D":"21"},"correct_option":"D","distractor_explanations":{"A":"Revisit the worked method: Subtract consecutive terms.","B":"Revisit the worked method: Subtract consecutive terms.","C":"Revisit the worked method: Subtract consecutive terms."}}'::jsonb, 'The constant difference is 4.', 'procedural', 'routine'),
  ('Q.G8.S4.PRACTICE.G8-PATTERNS.02', 'G8-PAT-REPRESENT-RULE', 'Grade 8', 'For Tn=2n+1, find T4.', '{"type":"multiple_choice","options":{"A":"9","B":"7","C":"8","D":"12"},"correct_option":"A","distractor_explanations":{"B":"Revisit the worked method: Substitute n=4.","C":"Revisit the worked method: Substitute n=4.","D":"Revisit the worked method: Substitute n=4."}}'::jsonb, '2(4)+1=9.', 'procedural', 'routine'),
  ('Q.G8.S4.PRACTICE.G8-PATTERNS.03', 'G8-PAT-REPRESENT-RULE', 'Grade 8', 'Which rule fits 4, 7, 10, …?', '{"type":"multiple_choice","options":{"A":"n + 3","B":"3n + 1","C":"3n + 4","D":"4n − 1"},"correct_option":"B","distractor_explanations":{"A":"Revisit the worked method: Test n=1.","C":"Revisit the worked method: Test n=1.","D":"Revisit the worked method: Test n=1."}}'::jsonb, 'Difference is 3 and 3(1)+1=4.', 'mathematical_reasoning', 'complex'),
  ('Q.G8.S4.PRACTICE.G8-PATTERNS.04', 'G8-PAT-REPRESENT-RULE', 'Grade 8', 'Why test a rule at n=2?', '{"type":"multiple_choice","options":{"A":"It removes the difference","B":"All rules work at n=2","C":"It confirms another term matches","D":"It changes n into 1"},"correct_option":"C","distractor_explanations":{"A":"Revisit the worked method: Substitute n=2.","B":"Revisit the worked method: Substitute n=2.","D":"Revisit the worked method: Substitute n=2."}}'::jsonb, 'A second value can show whether a rule was fitted incorrectly.', 'mathematical_reasoning', 'complex')
), items as (
insert into public.question_items(curriculum_version_id,item_code,source_tier,source_notes)
select curriculum.id,authored.item_code,'Odysseus_authored','Sprint 4 guided practice; original Odysseus-authored question with worked solution, hint and distractor feedback.'
from authored join public.curriculum_versions curriculum on curriculum.grade=authored.grade and curriculum.is_active
on conflict(curriculum_version_id,item_code) do nothing returning id,item_code
)
insert into public.question_versions(question_item_id,version_number,review_status,activity_type,cognitive_level,representation,difficulty,reasoning_classification,calculator_policy,prompt,answer_config,solution,marks,material_change_note)
select item.id,1,'draft','guided_practice',authored.cognitive_level::public.caps_cognitive_level,'symbolic',case when authored.reasoning_classification='mathematical_reasoning' then 3 else 2 end,authored.reasoning_classification,'not_allowed',authored.prompt,authored.answer_config,authored.solution,1,'Sprint 4 guided practice draft: requires authorised content review before learner delivery.'
from items item join authored on authored.item_code=item.item_code
on conflict(question_item_id,version_number) do nothing;

with authored(item_code,skill_code) as (
values
  ('Q.G9.S4.PRACTICE.REAL.01', 'G9-NUM-REAL-IRRATIONAL'),
  ('Q.G9.S4.PRACTICE.REAL.02', 'G9-NUM-REAL-IRRATIONAL'),
  ('Q.G9.S4.PRACTICE.REAL.03', 'G9-NUM-REAL-IRRATIONAL'),
  ('Q.G9.S4.PRACTICE.REAL.04', 'G9-NUM-REAL-IRRATIONAL'),
  ('Q.G9.S4.PRACTICE.HCF-LCM.01', 'G9-NUM-WHOLE-HCF-LCM'),
  ('Q.G9.S4.PRACTICE.HCF-LCM.02', 'G9-NUM-WHOLE-HCF-LCM'),
  ('Q.G9.S4.PRACTICE.HCF-LCM.03', 'G9-NUM-WHOLE-HCF-LCM'),
  ('Q.G9.S4.PRACTICE.HCF-LCM.04', 'G9-NUM-WHOLE-HCF-LCM'),
  ('Q.G9.S4.PRACTICE.RATIO-RATE.01', 'G9-NUM-RATIO-RATE'),
  ('Q.G9.S4.PRACTICE.RATIO-RATE.02', 'G9-NUM-RATIO-RATE'),
  ('Q.G9.S4.PRACTICE.RATIO-RATE.03', 'G9-NUM-RATIO-RATE'),
  ('Q.G9.S4.PRACTICE.RATIO-RATE.04', 'G9-NUM-RATIO-RATE'),
  ('Q.G9.S4.PRACTICE.PROPORTION.01', 'G9-NUM-DIRECT-INVERSE-PROPORTION'),
  ('Q.G9.S4.PRACTICE.PROPORTION.02', 'G9-NUM-DIRECT-INVERSE-PROPORTION'),
  ('Q.G9.S4.PRACTICE.PROPORTION.03', 'G9-NUM-DIRECT-INVERSE-PROPORTION'),
  ('Q.G9.S4.PRACTICE.PROPORTION.04', 'G9-NUM-DIRECT-INVERSE-PROPORTION'),
  ('Q.G9.S4.PRACTICE.FINANCE.01', 'G9-NUM-FINANCIAL-APPLICATIONS'),
  ('Q.G9.S4.PRACTICE.FINANCE.02', 'G9-NUM-FINANCIAL-APPLICATIONS'),
  ('Q.G9.S4.PRACTICE.FINANCE.03', 'G9-NUM-FINANCIAL-APPLICATIONS'),
  ('Q.G9.S4.PRACTICE.FINANCE.04', 'G9-NUM-FINANCIAL-APPLICATIONS'),
  ('Q.G9.S4.PRACTICE.INTEGER-OPS.01', 'G9-NUM-INTEGERS-OPERATIONS'),
  ('Q.G9.S4.PRACTICE.INTEGER-OPS.02', 'G9-NUM-INTEGERS-OPERATIONS'),
  ('Q.G9.S4.PRACTICE.INTEGER-OPS.03', 'G9-NUM-INTEGERS-OPERATIONS'),
  ('Q.G9.S4.PRACTICE.INTEGER-OPS.04', 'G9-NUM-INTEGERS-OPERATIONS'),
  ('Q.G9.S4.PRACTICE.POWERS-ROOTS.01', 'G9-NUM-INTEGERS-POWERS-ROOTS'),
  ('Q.G9.S4.PRACTICE.POWERS-ROOTS.02', 'G9-NUM-INTEGERS-POWERS-ROOTS'),
  ('Q.G9.S4.PRACTICE.POWERS-ROOTS.03', 'G9-NUM-INTEGERS-POWERS-ROOTS'),
  ('Q.G9.S4.PRACTICE.POWERS-ROOTS.04', 'G9-NUM-INTEGERS-POWERS-ROOTS'),
  ('Q.G9.S4.PRACTICE.EXP-LAWS.01', 'G9-EXP-LAWS-EXTENDED'),
  ('Q.G9.S4.PRACTICE.EXP-LAWS.02', 'G9-EXP-LAWS-EXTENDED'),
  ('Q.G9.S4.PRACTICE.EXP-LAWS.03', 'G9-EXP-LAWS-EXTENDED'),
  ('Q.G9.S4.PRACTICE.EXP-LAWS.04', 'G9-EXP-LAWS-EXTENDED'),
  ('Q.G9.S4.PRACTICE.EXP-ZERO-NEGATIVE.01', 'G9-EXP-NEGATIVE-SCI'),
  ('Q.G9.S4.PRACTICE.EXP-ZERO-NEGATIVE.02', 'G9-EXP-NEGATIVE-SCI'),
  ('Q.G9.S4.PRACTICE.EXP-ZERO-NEGATIVE.03', 'G9-EXP-NEGATIVE-SCI'),
  ('Q.G9.S4.PRACTICE.EXP-ZERO-NEGATIVE.04', 'G9-EXP-NEGATIVE-SCI'),
  ('Q.G9.S4.PRACTICE.SCI-NOTATION.01', 'G9-EXP-SCI-NOTATION-EXTENSION'),
  ('Q.G9.S4.PRACTICE.SCI-NOTATION.02', 'G9-EXP-SCI-NOTATION-EXTENSION'),
  ('Q.G9.S4.PRACTICE.SCI-NOTATION.03', 'G9-EXP-SCI-NOTATION-EXTENSION'),
  ('Q.G9.S4.PRACTICE.SCI-NOTATION.04', 'G9-EXP-SCI-NOTATION-EXTENSION'),
  ('Q.G9.S4.PRACTICE.PATTERN-STRUCTURE.01', 'G9-PAT-NUMERIC-STRUCTURE'),
  ('Q.G9.S4.PRACTICE.PATTERN-STRUCTURE.02', 'G9-PAT-NUMERIC-STRUCTURE'),
  ('Q.G9.S4.PRACTICE.PATTERN-STRUCTURE.03', 'G9-PAT-NUMERIC-STRUCTURE'),
  ('Q.G9.S4.PRACTICE.PATTERN-STRUCTURE.04', 'G9-PAT-NUMERIC-STRUCTURE'),
  ('Q.G9.S4.PRACTICE.NTH-TERM.01', 'G9-PAT-GENERAL-RULE'),
  ('Q.G9.S4.PRACTICE.NTH-TERM.02', 'G9-PAT-GENERAL-RULE'),
  ('Q.G9.S4.PRACTICE.NTH-TERM.03', 'G9-PAT-GENERAL-RULE'),
  ('Q.G9.S4.PRACTICE.NTH-TERM.04', 'G9-PAT-GENERAL-RULE'),
  ('Q.G9.S4.PRACTICE.VISUAL-PATTERNS.01', 'G9-PAT-GEOMETRIC-VISUAL'),
  ('Q.G9.S4.PRACTICE.VISUAL-PATTERNS.02', 'G9-PAT-GEOMETRIC-VISUAL'),
  ('Q.G9.S4.PRACTICE.VISUAL-PATTERNS.03', 'G9-PAT-GEOMETRIC-VISUAL'),
  ('Q.G9.S4.PRACTICE.VISUAL-PATTERNS.04', 'G9-PAT-GEOMETRIC-VISUAL'),
  ('Q.G8.S4.PRACTICE.G8-FACTORS.01', 'G8-NUM-WHOLE-PROPERTIES'),
  ('Q.G8.S4.PRACTICE.G8-FACTORS.02', 'G8-NUM-WHOLE-PROPERTIES'),
  ('Q.G8.S4.PRACTICE.G8-FACTORS.03', 'G8-NUM-WHOLE-PROPERTIES'),
  ('Q.G8.S4.PRACTICE.G8-FACTORS.04', 'G8-NUM-WHOLE-PROPERTIES'),
  ('Q.G8.S4.PRACTICE.G8-FRACTIONS.01', 'G8-NUM-FRACTIONS-OPERATIONS'),
  ('Q.G8.S4.PRACTICE.G8-FRACTIONS.02', 'G8-NUM-FRACTIONS-OPERATIONS'),
  ('Q.G8.S4.PRACTICE.G8-FRACTIONS.03', 'G8-NUM-FRACTIONS-OPERATIONS'),
  ('Q.G8.S4.PRACTICE.G8-FRACTIONS.04', 'G8-NUM-FRACTIONS-OPERATIONS'),
  ('Q.G8.S4.PRACTICE.G8-DECIMALS.01', 'G8-NUM-DECIMALS-OPERATIONS'),
  ('Q.G8.S4.PRACTICE.G8-DECIMALS.02', 'G8-NUM-DECIMALS-OPERATIONS'),
  ('Q.G8.S4.PRACTICE.G8-DECIMALS.03', 'G8-NUM-DECIMALS-OPERATIONS'),
  ('Q.G8.S4.PRACTICE.G8-DECIMALS.04', 'G8-NUM-DECIMALS-OPERATIONS'),
  ('Q.G8.S4.PRACTICE.G8-INTEGERS.01', 'G8-NUM-INTEGERS-OPERATIONS'),
  ('Q.G8.S4.PRACTICE.G8-INTEGERS.02', 'G8-NUM-INTEGERS-OPERATIONS'),
  ('Q.G8.S4.PRACTICE.G8-INTEGERS.03', 'G8-NUM-INTEGERS-OPERATIONS'),
  ('Q.G8.S4.PRACTICE.G8-INTEGERS.04', 'G8-NUM-INTEGERS-OPERATIONS'),
  ('Q.G8.S4.PRACTICE.G8-EXPONENTS.01', 'G8-EXP-LAWS-SCI'),
  ('Q.G8.S4.PRACTICE.G8-EXPONENTS.02', 'G8-EXP-LAWS-SCI'),
  ('Q.G8.S4.PRACTICE.G8-EXPONENTS.03', 'G8-EXP-LAWS-SCI'),
  ('Q.G8.S4.PRACTICE.G8-EXPONENTS.04', 'G8-EXP-LAWS-SCI'),
  ('Q.G8.S4.PRACTICE.G8-PATTERNS.01', 'G8-PAT-REPRESENT-RULE'),
  ('Q.G8.S4.PRACTICE.G8-PATTERNS.02', 'G8-PAT-REPRESENT-RULE'),
  ('Q.G8.S4.PRACTICE.G8-PATTERNS.03', 'G8-PAT-REPRESENT-RULE'),
  ('Q.G8.S4.PRACTICE.G8-PATTERNS.04', 'G8-PAT-REPRESENT-RULE')
)
insert into public.question_version_skill_links(question_version_id,skill_id,relationship_type)
select version.id,skill.id,'primary' from authored join public.question_items item on item.item_code=authored.item_code join public.question_versions version on version.question_item_id=item.id and version.version_number=1 join public.curriculum_skills skill on skill.skill_code=authored.skill_code
on conflict do nothing;

with authored(item_code,hint) as (
values
  ('Q.G9.S4.PRACTICE.REAL.01', 'Check whether the radicand is a perfect square.'),
  ('Q.G9.S4.PRACTICE.REAL.02', 'Find the principal square root first.'),
  ('Q.G9.S4.PRACTICE.REAL.03', 'Recurring is different from non-repeating.'),
  ('Q.G9.S4.PRACTICE.REAL.04', 'What positive number squared gives 49?'),
  ('Q.G9.S4.PRACTICE.HCF-LCM.01', 'Keep dividing by prime numbers.'),
  ('Q.G9.S4.PRACTICE.HCF-LCM.02', 'List the prime factors of both numbers.'),
  ('Q.G9.S4.PRACTICE.HCF-LCM.03', 'A future time must be a multiple of both intervals.'),
  ('Q.G9.S4.PRACTICE.HCF-LCM.04', 'HCF describes a shared divisor, not a product.'),
  ('Q.G9.S4.PRACTICE.RATIO-RATE.01', 'Find a number that divides both parts.'),
  ('Q.G9.S4.PRACTICE.RATIO-RATE.02', 'A unit rate means “for one hour”.'),
  ('Q.G9.S4.PRACTICE.RATIO-RATE.03', 'Find the scale factor first.'),
  ('Q.G9.S4.PRACTICE.RATIO-RATE.04', 'Simplify both ratios before deciding.'),
  ('Q.G9.S4.PRACTICE.PROPORTION.01', 'Find the cost of one notebook.'),
  ('Q.G9.S4.PRACTICE.PROPORTION.02', 'For inverse proportion, multiply first then divide.'),
  ('Q.G9.S4.PRACTICE.PROPORTION.03', 'Look for a fixed total task or distance.'),
  ('Q.G9.S4.PRACTICE.PROPORTION.04', 'Test the answer: would more workers really take longer?'),
  ('Q.G9.S4.PRACTICE.FINANCE.01', 'Change the percent to a decimal.'),
  ('Q.G9.S4.PRACTICE.FINANCE.02', 'The deposit is once-off.'),
  ('Q.G9.S4.PRACTICE.FINANCE.03', 'Apply 8% to the new balance in year 2.'),
  ('Q.G9.S4.PRACTICE.FINANCE.04', 'Compare the base used in the second year.'),
  ('Q.G9.S4.PRACTICE.INTEGER-OPS.01', 'A positive addend moves right.'),
  ('Q.G9.S4.PRACTICE.INTEGER-OPS.02', 'Check whether the signs match.'),
  ('Q.G9.S4.PRACTICE.INTEGER-OPS.03', 'Brackets are calculated first.'),
  ('Q.G9.S4.PRACTICE.INTEGER-OPS.04', 'Think about direction on a number line.'),
  ('Q.G9.S4.PRACTICE.POWERS-ROOTS.01', 'Square the whole bracketed number.'),
  ('Q.G9.S4.PRACTICE.POWERS-ROOTS.02', 'Which negative number cubed gives −216?'),
  ('Q.G9.S4.PRACTICE.POWERS-ROOTS.03', 'There are no brackets around −3.'),
  ('Q.G9.S4.PRACTICE.POWERS-ROOTS.04', 'Separate a root symbol from solving an equation.'),
  ('Q.G9.S4.PRACTICE.EXP-LAWS.01', 'The base remains a.'),
  ('Q.G9.S4.PRACTICE.EXP-LAWS.02', 'Use the quotient law.'),
  ('Q.G9.S4.PRACTICE.EXP-LAWS.03', 'Every exponent inside the bracket is multiplied.'),
  ('Q.G9.S4.PRACTICE.EXP-LAWS.04', 'Look at the operation between the terms.'),
  ('Q.G9.S4.PRACTICE.EXP-ZERO-NEGATIVE.01', 'The base is non-zero.'),
  ('Q.G9.S4.PRACTICE.EXP-ZERO-NEGATIVE.02', 'Write the reciprocal first.'),
  ('Q.G9.S4.PRACTICE.EXP-ZERO-NEGATIVE.03', 'The negative belongs to the exponent.'),
  ('Q.G9.S4.PRACTICE.EXP-ZERO-NEGATIVE.04', 'What happens if the denominator is zero?'),
  ('Q.G9.S4.PRACTICE.SCI-NOTATION.01', 'Make the first number between 1 and 10.'),
  ('Q.G9.S4.PRACTICE.SCI-NOTATION.02', 'A positive exponent makes a larger number.'),
  ('Q.G9.S4.PRACTICE.SCI-NOTATION.03', 'Small decimals need negative powers of ten.'),
  ('Q.G9.S4.PRACTICE.SCI-NOTATION.04', 'Check the leading number.'),
  ('Q.G9.S4.PRACTICE.PATTERN-STRUCTURE.01', 'Subtract consecutive terms.'),
  ('Q.G9.S4.PRACTICE.PATTERN-STRUCTURE.02', 'Find the constant change.'),
  ('Q.G9.S4.PRACTICE.PATTERN-STRUCTURE.03', 'Compare changes, not just values.'),
  ('Q.G9.S4.PRACTICE.PATTERN-STRUCTURE.04', 'Count the jumps between term 1 and term 8.'),
  ('Q.G9.S4.PRACTICE.NTH-TERM.01', 'Use the first term to solve for c.'),
  ('Q.G9.S4.PRACTICE.NTH-TERM.02', 'Put 6 in place of n.'),
  ('Q.G9.S4.PRACTICE.NTH-TERM.03', 'A pattern rule must match the sequence, not one value.'),
  ('Q.G9.S4.PRACTICE.NTH-TERM.04', 'Test the learner rule at n=1.'),
  ('Q.G9.S4.PRACTICE.VISUAL-PATTERNS.01', 'Each new square adds 3, not 4.'),
  ('Q.G9.S4.PRACTICE.VISUAL-PATTERNS.02', 'Find the difference, then test n=1.'),
  ('Q.G9.S4.PRACTICE.VISUAL-PATTERNS.03', 'Look at what is shared between neighbours.'),
  ('Q.G9.S4.PRACTICE.VISUAL-PATTERNS.04', 'There are six increases from figure 1 to figure 7.'),
  ('Q.G8.S4.PRACTICE.G8-FACTORS.01', 'Divide before adding.'),
  ('Q.G8.S4.PRACTICE.G8-FACTORS.02', 'A factor divides exactly.'),
  ('Q.G8.S4.PRACTICE.G8-FACTORS.03', 'Multiplication comes before addition.'),
  ('Q.G8.S4.PRACTICE.G8-FACTORS.04', 'Test division for each number.'),
  ('Q.G8.S4.PRACTICE.G8-FRACTIONS.01', 'Keep the denominator 4.'),
  ('Q.G8.S4.PRACTICE.G8-FRACTIONS.02', 'What makes 5 into 20?'),
  ('Q.G8.S4.PRACTICE.G8-FRACTIONS.03', 'Use denominator 6.'),
  ('Q.G8.S4.PRACTICE.G8-FRACTIONS.04', 'Simplify the fraction.'),
  ('Q.G8.S4.PRACTICE.G8-DECIMALS.01', 'Write 6.2 as 6.20.'),
  ('Q.G8.S4.PRACTICE.G8-DECIMALS.02', 'Estimate: half of 0.4 is 0.2.'),
  ('Q.G8.S4.PRACTICE.G8-DECIMALS.03', 'Multiply the amount, keeping cents.'),
  ('Q.G8.S4.PRACTICE.G8-DECIMALS.04', 'Think about the size of the answer.'),
  ('Q.G8.S4.PRACTICE.G8-INTEGERS.01', 'The negative magnitude is larger.'),
  ('Q.G8.S4.PRACTICE.G8-INTEGERS.02', 'Two negatives make a positive product.'),
  ('Q.G8.S4.PRACTICE.G8-INTEGERS.03', 'Rewrite as addition.'),
  ('Q.G8.S4.PRACTICE.G8-INTEGERS.04', 'Compare the signs first.'),
  ('Q.G8.S4.PRACTICE.G8-EXPONENTS.01', 'Write four factors of 2.'),
  ('Q.G8.S4.PRACTICE.G8-EXPONENTS.02', 'Keep the base x.'),
  ('Q.G8.S4.PRACTICE.G8-EXPONENTS.03', 'The exponent sits outside the bracket.'),
  ('Q.G8.S4.PRACTICE.G8-EXPONENTS.04', 'Count the total factors.'),
  ('Q.G8.S4.PRACTICE.G8-PATTERNS.01', 'Subtract consecutive terms.'),
  ('Q.G8.S4.PRACTICE.G8-PATTERNS.02', 'Substitute n=4.'),
  ('Q.G8.S4.PRACTICE.G8-PATTERNS.03', 'Test n=1.'),
  ('Q.G8.S4.PRACTICE.G8-PATTERNS.04', 'Substitute n=2.')
)
insert into public.question_hints(question_version_id,hint_level,prompt)
select version.id,1,authored.hint from authored join public.question_items item on item.item_code=authored.item_code join public.question_versions version on version.question_item_id=item.id and version.version_number=1
on conflict(question_version_id,hint_level) do update set prompt=excluded.prompt;

with authored(code,skill_code,title,description) as (
values
  ('A.G9.S4.REAL', 'G9-NUM-REAL-IRRATIONAL', 'Real numbers: rational or irrational: short practice', 'Four focused questions for real numbers: rational or irrational. Start independently, use an optional hint, then read the explanation.'),
  ('A.G9.S4.HCF-LCM', 'G9-NUM-WHOLE-HCF-LCM', 'Factors, multiples, HCF and LCM: short practice', 'Four focused questions for factors, multiples, hcf and lcm. Start independently, use an optional hint, then read the explanation.'),
  ('A.G9.S4.RATIO-RATE', 'G9-NUM-RATIO-RATE', 'Ratio and unit rate: short practice', 'Four focused questions for ratio and unit rate. Start independently, use an optional hint, then read the explanation.'),
  ('A.G9.S4.PROPORTION', 'G9-NUM-DIRECT-INVERSE-PROPORTION', 'Direct and inverse proportion: short practice', 'Four focused questions for direct and inverse proportion. Start independently, use an optional hint, then read the explanation.'),
  ('A.G9.S4.FINANCE', 'G9-NUM-FINANCIAL-APPLICATIONS', 'Commission, rental and compound interest: short practice', 'Four focused questions for commission, rental and compound interest. Start independently, use an optional hint, then read the explanation.'),
  ('A.G9.S4.INTEGER-OPS', 'G9-NUM-INTEGERS-OPERATIONS', 'Integer operations and order: short practice', 'Four focused questions for integer operations and order. Start independently, use an optional hint, then read the explanation.'),
  ('A.G9.S4.POWERS-ROOTS', 'G9-NUM-INTEGERS-POWERS-ROOTS', 'Squares, cubes and roots: short practice', 'Four focused questions for squares, cubes and roots. Start independently, use an optional hint, then read the explanation.'),
  ('A.G9.S4.EXP-LAWS', 'G9-EXP-LAWS-EXTENDED', 'Exponent laws: short practice', 'Four focused questions for exponent laws. Start independently, use an optional hint, then read the explanation.'),
  ('A.G9.S4.EXP-ZERO-NEGATIVE', 'G9-EXP-NEGATIVE-SCI', 'Zero and negative exponents: short practice', 'Four focused questions for zero and negative exponents. Start independently, use an optional hint, then read the explanation.'),
  ('A.G9.S4.SCI-NOTATION', 'G9-EXP-SCI-NOTATION-EXTENSION', 'Scientific notation extension: short practice', 'Four focused questions for scientific notation extension. Start independently, use an optional hint, then read the explanation.'),
  ('A.G9.S4.PATTERN-STRUCTURE', 'G9-PAT-NUMERIC-STRUCTURE', 'Numeric patterns and differences: short practice', 'Four focused questions for numeric patterns and differences. Start independently, use an optional hint, then read the explanation.'),
  ('A.G9.S4.NTH-TERM', 'G9-PAT-GENERAL-RULE', 'Linear nth-term rules: short practice', 'Four focused questions for linear nth-term rules. Start independently, use an optional hint, then read the explanation.'),
  ('A.G9.S4.VISUAL-PATTERNS', 'G9-PAT-GEOMETRIC-VISUAL', 'Geometric matchstick and tile patterns: short practice', 'Four focused questions for geometric matchstick and tile patterns. Start independently, use an optional hint, then read the explanation.'),
  ('A.G8.S4.G8-FACTORS', 'G8-NUM-WHOLE-PROPERTIES', 'Grade 8 bridge: factors and order: short practice', 'Four focused questions for grade 8 bridge: factors and order. Start independently, use an optional hint, then read the explanation.'),
  ('A.G8.S4.G8-FRACTIONS', 'G8-NUM-FRACTIONS-OPERATIONS', 'Grade 8 bridge: fractions: short practice', 'Four focused questions for grade 8 bridge: fractions. Start independently, use an optional hint, then read the explanation.'),
  ('A.G8.S4.G8-DECIMALS', 'G8-NUM-DECIMALS-OPERATIONS', 'Grade 8 bridge: decimal operations: short practice', 'Four focused questions for grade 8 bridge: decimal operations. Start independently, use an optional hint, then read the explanation.'),
  ('A.G8.S4.G8-INTEGERS', 'G8-NUM-INTEGERS-OPERATIONS', 'Grade 8 bridge: signed numbers: short practice', 'Four focused questions for grade 8 bridge: signed numbers. Start independently, use an optional hint, then read the explanation.'),
  ('A.G8.S4.G8-EXPONENTS', 'G8-EXP-LAWS-SCI', 'Grade 8 bridge: exponent basics: short practice', 'Four focused questions for grade 8 bridge: exponent basics. Start independently, use an optional hint, then read the explanation.'),
  ('A.G8.S4.G8-PATTERNS', 'G8-PAT-REPRESENT-RULE', 'Grade 8 bridge: simple pattern rules: short practice', 'Four focused questions for grade 8 bridge: simple pattern rules. Start independently, use an optional hint, then read the explanation.')
)
insert into public.learning_activity_templates(curriculum_version_id,target_skill_id,code,title,description,source_tier,review_status,review_notes)
select curriculum.id,skill.id,authored.code,authored.title,authored.description,'Odysseus_authored','draft','Sprint 4 guided practice activity. Approve only after every linked question has passed content review.' from authored join public.curriculum_skills skill on skill.skill_code=authored.skill_code join public.curriculum_versions curriculum on curriculum.subject_id=skill.subject_id and curriculum.grade=skill.grade and curriculum.is_active
on conflict(curriculum_version_id,code) do update set title=excluded.title,description=excluded.description where public.learning_activity_templates.review_status in ('draft','rejected');

with authored(activity_code,stage_type,sequence_number,learner_instruction) as (
values
  ('A.G9.S4.REAL', 'guided_practice', 1, 'Start with the first question. Use a hint only if you need one.'),
  ('A.G9.S4.REAL', 'independent_practice', 2, 'Now apply the idea independently and check the feedback carefully.'),
  ('A.G9.S4.HCF-LCM', 'guided_practice', 1, 'Start with the first question. Use a hint only if you need one.'),
  ('A.G9.S4.HCF-LCM', 'independent_practice', 2, 'Now apply the idea independently and check the feedback carefully.'),
  ('A.G9.S4.RATIO-RATE', 'guided_practice', 1, 'Start with the first question. Use a hint only if you need one.'),
  ('A.G9.S4.RATIO-RATE', 'independent_practice', 2, 'Now apply the idea independently and check the feedback carefully.'),
  ('A.G9.S4.PROPORTION', 'guided_practice', 1, 'Start with the first question. Use a hint only if you need one.'),
  ('A.G9.S4.PROPORTION', 'independent_practice', 2, 'Now apply the idea independently and check the feedback carefully.'),
  ('A.G9.S4.FINANCE', 'guided_practice', 1, 'Start with the first question. Use a hint only if you need one.'),
  ('A.G9.S4.FINANCE', 'independent_practice', 2, 'Now apply the idea independently and check the feedback carefully.'),
  ('A.G9.S4.INTEGER-OPS', 'guided_practice', 1, 'Start with the first question. Use a hint only if you need one.'),
  ('A.G9.S4.INTEGER-OPS', 'independent_practice', 2, 'Now apply the idea independently and check the feedback carefully.'),
  ('A.G9.S4.POWERS-ROOTS', 'guided_practice', 1, 'Start with the first question. Use a hint only if you need one.'),
  ('A.G9.S4.POWERS-ROOTS', 'independent_practice', 2, 'Now apply the idea independently and check the feedback carefully.'),
  ('A.G9.S4.EXP-LAWS', 'guided_practice', 1, 'Start with the first question. Use a hint only if you need one.'),
  ('A.G9.S4.EXP-LAWS', 'independent_practice', 2, 'Now apply the idea independently and check the feedback carefully.'),
  ('A.G9.S4.EXP-ZERO-NEGATIVE', 'guided_practice', 1, 'Start with the first question. Use a hint only if you need one.'),
  ('A.G9.S4.EXP-ZERO-NEGATIVE', 'independent_practice', 2, 'Now apply the idea independently and check the feedback carefully.'),
  ('A.G9.S4.SCI-NOTATION', 'guided_practice', 1, 'Start with the first question. Use a hint only if you need one.'),
  ('A.G9.S4.SCI-NOTATION', 'independent_practice', 2, 'Now apply the idea independently and check the feedback carefully.'),
  ('A.G9.S4.PATTERN-STRUCTURE', 'guided_practice', 1, 'Start with the first question. Use a hint only if you need one.'),
  ('A.G9.S4.PATTERN-STRUCTURE', 'independent_practice', 2, 'Now apply the idea independently and check the feedback carefully.'),
  ('A.G9.S4.NTH-TERM', 'guided_practice', 1, 'Start with the first question. Use a hint only if you need one.'),
  ('A.G9.S4.NTH-TERM', 'independent_practice', 2, 'Now apply the idea independently and check the feedback carefully.'),
  ('A.G9.S4.VISUAL-PATTERNS', 'guided_practice', 1, 'Start with the first question. Use a hint only if you need one.'),
  ('A.G9.S4.VISUAL-PATTERNS', 'independent_practice', 2, 'Now apply the idea independently and check the feedback carefully.'),
  ('A.G8.S4.G8-FACTORS', 'guided_practice', 1, 'Start with the first question. Use a hint only if you need one.'),
  ('A.G8.S4.G8-FACTORS', 'independent_practice', 2, 'Now apply the idea independently and check the feedback carefully.'),
  ('A.G8.S4.G8-FRACTIONS', 'guided_practice', 1, 'Start with the first question. Use a hint only if you need one.'),
  ('A.G8.S4.G8-FRACTIONS', 'independent_practice', 2, 'Now apply the idea independently and check the feedback carefully.'),
  ('A.G8.S4.G8-DECIMALS', 'guided_practice', 1, 'Start with the first question. Use a hint only if you need one.'),
  ('A.G8.S4.G8-DECIMALS', 'independent_practice', 2, 'Now apply the idea independently and check the feedback carefully.'),
  ('A.G8.S4.G8-INTEGERS', 'guided_practice', 1, 'Start with the first question. Use a hint only if you need one.'),
  ('A.G8.S4.G8-INTEGERS', 'independent_practice', 2, 'Now apply the idea independently and check the feedback carefully.'),
  ('A.G8.S4.G8-EXPONENTS', 'guided_practice', 1, 'Start with the first question. Use a hint only if you need one.'),
  ('A.G8.S4.G8-EXPONENTS', 'independent_practice', 2, 'Now apply the idea independently and check the feedback carefully.'),
  ('A.G8.S4.G8-PATTERNS', 'guided_practice', 1, 'Start with the first question. Use a hint only if you need one.'),
  ('A.G8.S4.G8-PATTERNS', 'independent_practice', 2, 'Now apply the idea independently and check the feedback carefully.')
)
insert into public.learning_activity_stages(learning_activity_template_id,stage_type,sequence_number,learner_instruction)
select activity.id,authored.stage_type::public.learning_activity_stage_type,authored.sequence_number,authored.learner_instruction from authored join public.learning_activity_templates activity on activity.code=authored.activity_code
on conflict(learning_activity_template_id,sequence_number) do update set stage_type=excluded.stage_type,learner_instruction=excluded.learner_instruction;

with authored(activity_code,stage_sequence,item_code,display_order) as (
values
  ('A.G9.S4.REAL', 1, 'Q.G9.S4.PRACTICE.REAL.01', 1),
  ('A.G9.S4.REAL', 1, 'Q.G9.S4.PRACTICE.REAL.02', 2),
  ('A.G9.S4.REAL', 2, 'Q.G9.S4.PRACTICE.REAL.03', 1),
  ('A.G9.S4.REAL', 2, 'Q.G9.S4.PRACTICE.REAL.04', 2),
  ('A.G9.S4.HCF-LCM', 1, 'Q.G9.S4.PRACTICE.HCF-LCM.01', 1),
  ('A.G9.S4.HCF-LCM', 1, 'Q.G9.S4.PRACTICE.HCF-LCM.02', 2),
  ('A.G9.S4.HCF-LCM', 2, 'Q.G9.S4.PRACTICE.HCF-LCM.03', 1),
  ('A.G9.S4.HCF-LCM', 2, 'Q.G9.S4.PRACTICE.HCF-LCM.04', 2),
  ('A.G9.S4.RATIO-RATE', 1, 'Q.G9.S4.PRACTICE.RATIO-RATE.01', 1),
  ('A.G9.S4.RATIO-RATE', 1, 'Q.G9.S4.PRACTICE.RATIO-RATE.02', 2),
  ('A.G9.S4.RATIO-RATE', 2, 'Q.G9.S4.PRACTICE.RATIO-RATE.03', 1),
  ('A.G9.S4.RATIO-RATE', 2, 'Q.G9.S4.PRACTICE.RATIO-RATE.04', 2),
  ('A.G9.S4.PROPORTION', 1, 'Q.G9.S4.PRACTICE.PROPORTION.01', 1),
  ('A.G9.S4.PROPORTION', 1, 'Q.G9.S4.PRACTICE.PROPORTION.02', 2),
  ('A.G9.S4.PROPORTION', 2, 'Q.G9.S4.PRACTICE.PROPORTION.03', 1),
  ('A.G9.S4.PROPORTION', 2, 'Q.G9.S4.PRACTICE.PROPORTION.04', 2),
  ('A.G9.S4.FINANCE', 1, 'Q.G9.S4.PRACTICE.FINANCE.01', 1),
  ('A.G9.S4.FINANCE', 1, 'Q.G9.S4.PRACTICE.FINANCE.02', 2),
  ('A.G9.S4.FINANCE', 2, 'Q.G9.S4.PRACTICE.FINANCE.03', 1),
  ('A.G9.S4.FINANCE', 2, 'Q.G9.S4.PRACTICE.FINANCE.04', 2),
  ('A.G9.S4.INTEGER-OPS', 1, 'Q.G9.S4.PRACTICE.INTEGER-OPS.01', 1),
  ('A.G9.S4.INTEGER-OPS', 1, 'Q.G9.S4.PRACTICE.INTEGER-OPS.02', 2),
  ('A.G9.S4.INTEGER-OPS', 2, 'Q.G9.S4.PRACTICE.INTEGER-OPS.03', 1),
  ('A.G9.S4.INTEGER-OPS', 2, 'Q.G9.S4.PRACTICE.INTEGER-OPS.04', 2),
  ('A.G9.S4.POWERS-ROOTS', 1, 'Q.G9.S4.PRACTICE.POWERS-ROOTS.01', 1),
  ('A.G9.S4.POWERS-ROOTS', 1, 'Q.G9.S4.PRACTICE.POWERS-ROOTS.02', 2),
  ('A.G9.S4.POWERS-ROOTS', 2, 'Q.G9.S4.PRACTICE.POWERS-ROOTS.03', 1),
  ('A.G9.S4.POWERS-ROOTS', 2, 'Q.G9.S4.PRACTICE.POWERS-ROOTS.04', 2),
  ('A.G9.S4.EXP-LAWS', 1, 'Q.G9.S4.PRACTICE.EXP-LAWS.01', 1),
  ('A.G9.S4.EXP-LAWS', 1, 'Q.G9.S4.PRACTICE.EXP-LAWS.02', 2),
  ('A.G9.S4.EXP-LAWS', 2, 'Q.G9.S4.PRACTICE.EXP-LAWS.03', 1),
  ('A.G9.S4.EXP-LAWS', 2, 'Q.G9.S4.PRACTICE.EXP-LAWS.04', 2),
  ('A.G9.S4.EXP-ZERO-NEGATIVE', 1, 'Q.G9.S4.PRACTICE.EXP-ZERO-NEGATIVE.01', 1),
  ('A.G9.S4.EXP-ZERO-NEGATIVE', 1, 'Q.G9.S4.PRACTICE.EXP-ZERO-NEGATIVE.02', 2),
  ('A.G9.S4.EXP-ZERO-NEGATIVE', 2, 'Q.G9.S4.PRACTICE.EXP-ZERO-NEGATIVE.03', 1),
  ('A.G9.S4.EXP-ZERO-NEGATIVE', 2, 'Q.G9.S4.PRACTICE.EXP-ZERO-NEGATIVE.04', 2),
  ('A.G9.S4.SCI-NOTATION', 1, 'Q.G9.S4.PRACTICE.SCI-NOTATION.01', 1),
  ('A.G9.S4.SCI-NOTATION', 1, 'Q.G9.S4.PRACTICE.SCI-NOTATION.02', 2),
  ('A.G9.S4.SCI-NOTATION', 2, 'Q.G9.S4.PRACTICE.SCI-NOTATION.03', 1),
  ('A.G9.S4.SCI-NOTATION', 2, 'Q.G9.S4.PRACTICE.SCI-NOTATION.04', 2),
  ('A.G9.S4.PATTERN-STRUCTURE', 1, 'Q.G9.S4.PRACTICE.PATTERN-STRUCTURE.01', 1),
  ('A.G9.S4.PATTERN-STRUCTURE', 1, 'Q.G9.S4.PRACTICE.PATTERN-STRUCTURE.02', 2),
  ('A.G9.S4.PATTERN-STRUCTURE', 2, 'Q.G9.S4.PRACTICE.PATTERN-STRUCTURE.03', 1),
  ('A.G9.S4.PATTERN-STRUCTURE', 2, 'Q.G9.S4.PRACTICE.PATTERN-STRUCTURE.04', 2),
  ('A.G9.S4.NTH-TERM', 1, 'Q.G9.S4.PRACTICE.NTH-TERM.01', 1),
  ('A.G9.S4.NTH-TERM', 1, 'Q.G9.S4.PRACTICE.NTH-TERM.02', 2),
  ('A.G9.S4.NTH-TERM', 2, 'Q.G9.S4.PRACTICE.NTH-TERM.03', 1),
  ('A.G9.S4.NTH-TERM', 2, 'Q.G9.S4.PRACTICE.NTH-TERM.04', 2),
  ('A.G9.S4.VISUAL-PATTERNS', 1, 'Q.G9.S4.PRACTICE.VISUAL-PATTERNS.01', 1),
  ('A.G9.S4.VISUAL-PATTERNS', 1, 'Q.G9.S4.PRACTICE.VISUAL-PATTERNS.02', 2),
  ('A.G9.S4.VISUAL-PATTERNS', 2, 'Q.G9.S4.PRACTICE.VISUAL-PATTERNS.03', 1),
  ('A.G9.S4.VISUAL-PATTERNS', 2, 'Q.G9.S4.PRACTICE.VISUAL-PATTERNS.04', 2),
  ('A.G8.S4.G8-FACTORS', 1, 'Q.G8.S4.PRACTICE.G8-FACTORS.01', 1),
  ('A.G8.S4.G8-FACTORS', 1, 'Q.G8.S4.PRACTICE.G8-FACTORS.02', 2),
  ('A.G8.S4.G8-FACTORS', 2, 'Q.G8.S4.PRACTICE.G8-FACTORS.03', 1),
  ('A.G8.S4.G8-FACTORS', 2, 'Q.G8.S4.PRACTICE.G8-FACTORS.04', 2),
  ('A.G8.S4.G8-FRACTIONS', 1, 'Q.G8.S4.PRACTICE.G8-FRACTIONS.01', 1),
  ('A.G8.S4.G8-FRACTIONS', 1, 'Q.G8.S4.PRACTICE.G8-FRACTIONS.02', 2),
  ('A.G8.S4.G8-FRACTIONS', 2, 'Q.G8.S4.PRACTICE.G8-FRACTIONS.03', 1),
  ('A.G8.S4.G8-FRACTIONS', 2, 'Q.G8.S4.PRACTICE.G8-FRACTIONS.04', 2),
  ('A.G8.S4.G8-DECIMALS', 1, 'Q.G8.S4.PRACTICE.G8-DECIMALS.01', 1),
  ('A.G8.S4.G8-DECIMALS', 1, 'Q.G8.S4.PRACTICE.G8-DECIMALS.02', 2),
  ('A.G8.S4.G8-DECIMALS', 2, 'Q.G8.S4.PRACTICE.G8-DECIMALS.03', 1),
  ('A.G8.S4.G8-DECIMALS', 2, 'Q.G8.S4.PRACTICE.G8-DECIMALS.04', 2),
  ('A.G8.S4.G8-INTEGERS', 1, 'Q.G8.S4.PRACTICE.G8-INTEGERS.01', 1),
  ('A.G8.S4.G8-INTEGERS', 1, 'Q.G8.S4.PRACTICE.G8-INTEGERS.02', 2),
  ('A.G8.S4.G8-INTEGERS', 2, 'Q.G8.S4.PRACTICE.G8-INTEGERS.03', 1),
  ('A.G8.S4.G8-INTEGERS', 2, 'Q.G8.S4.PRACTICE.G8-INTEGERS.04', 2),
  ('A.G8.S4.G8-EXPONENTS', 1, 'Q.G8.S4.PRACTICE.G8-EXPONENTS.01', 1),
  ('A.G8.S4.G8-EXPONENTS', 1, 'Q.G8.S4.PRACTICE.G8-EXPONENTS.02', 2),
  ('A.G8.S4.G8-EXPONENTS', 2, 'Q.G8.S4.PRACTICE.G8-EXPONENTS.03', 1),
  ('A.G8.S4.G8-EXPONENTS', 2, 'Q.G8.S4.PRACTICE.G8-EXPONENTS.04', 2),
  ('A.G8.S4.G8-PATTERNS', 1, 'Q.G8.S4.PRACTICE.G8-PATTERNS.01', 1),
  ('A.G8.S4.G8-PATTERNS', 1, 'Q.G8.S4.PRACTICE.G8-PATTERNS.02', 2),
  ('A.G8.S4.G8-PATTERNS', 2, 'Q.G8.S4.PRACTICE.G8-PATTERNS.03', 1),
  ('A.G8.S4.G8-PATTERNS', 2, 'Q.G8.S4.PRACTICE.G8-PATTERNS.04', 2)
)
insert into public.learning_activity_stage_questions(learning_activity_stage_id,question_version_id,display_order)
select stage.id,version.id,authored.display_order from authored join public.learning_activity_templates activity on activity.code=authored.activity_code join public.learning_activity_stages stage on stage.learning_activity_template_id=activity.id and stage.sequence_number=authored.stage_sequence join public.question_items item on item.item_code=authored.item_code join public.question_versions version on version.question_item_id=item.id and version.version_number=1
on conflict(learning_activity_stage_id,question_version_id) do update set display_order=excluded.display_order;
