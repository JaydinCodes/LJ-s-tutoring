'use strict';

/*
 * Canonical Sprint 4 instructional content.  This is deliberately the source
 * of truth; the SQL migration is generated from it so lessons and formative
 * questions can be reviewed here without reading a large data migration.
 */

const q = (prompt, correct, wrong, solution, hint, reasoning = false) => ({ prompt, correct, wrong, solution, hint, reasoning });
const lesson = (skillCode, grade, slug, title, objective, explanation, workedExample, misconception, questions) => ({ skillCode, grade, slug, title, objective, explanation, workedExample, misconception, questions });

const lessons = [
  lesson('G9-NUM-REAL-IRRATIONAL', 'Grade 9', 'REAL', 'Real numbers: rational or irrational',
    'By the end of this lesson, you should be able to classify real numbers as rational or irrational.',
    'Rational numbers can be written as a fraction of two integers, with a non-zero denominator. Integers, terminating decimals and recurring decimals are rational. A square root is rational only when its radicand is a perfect square. Numbers such as √2 and π are real but irrational.',
    'Classify √81.\n1. 81 is a perfect square: 9 × 9 = 81.\n2. √81 = 9.\n3. 9 is an integer, so it is rational.\nTherefore √81 is a rational real number.',
    'A root sign does not automatically mean “irrational”. Check whether the number inside the root is a perfect square.', [
      q('Which number is irrational?', '√20', ['0.25', '−7', '3/5'], '20 is not a perfect square, so √20 cannot be written as a ratio of integers. The other choices are rational.', 'Check whether the radicand is a perfect square.'),
      q('Classify √121.', 'A rational integer', ['An irrational number', 'A negative integer', 'Not a real number'], '√121 = 11. It is a natural number, an integer and therefore rational.', 'Find the principal square root first.'),
      q('Why is 0.333… rational?', 'It is equal to 1/3', ['It has infinitely many digits', 'It is close to zero', 'It contains a decimal point'], 'A recurring decimal has a fractional form. Here 0.333… = 1/3, so it is rational.', 'Recurring is different from non-repeating.' , true),
      q('Which statement is correct about √49?', 'It is rational because √49 = 7', ['It is irrational because it has a root sign', 'It is negative because 49 has two roots', 'It is not real'], 'The symbol √ means the principal, non-negative square root. √49 = 7, a rational integer.', 'What positive number squared gives 49?', true),
    ]),
  lesson('G9-NUM-WHOLE-HCF-LCM', 'Grade 9', 'HCF-LCM', 'Factors, multiples, HCF and LCM',
    'By the end of this lesson, you should be able to use prime factors to find an HCF or LCM.',
    'A factor divides a number exactly; a multiple is made by multiplying. Prime factorisation writes a number as primes. For HCF use only common prime factors at their smallest powers. For LCM use every required prime factor at its largest power.',
    'Find the HCF and LCM of 24 and 36.\n24 = 2³ × 3 and 36 = 2² × 3².\nHCF = 2² × 3 = 12.\nLCM = 2³ × 3² = 72.',
    'Do not choose the HCF when a situation asks when repeated events next happen together: that needs the LCM.', [
      q('What is the prime factorisation of 84?', '2² × 3 × 7', ['2 × 3 × 7', '2³ × 3 × 7', '2² × 3² × 7'], '84 = 4 × 21 = 2² × 3 × 7.', 'Keep dividing by prime numbers.'),
      q('Find the HCF of 30 and 45.', '15', ['5', '10', '90'], '30 = 2 × 3 × 5 and 45 = 3² × 5. The common factors are 3 and 5, so the HCF is 15.', 'List the prime factors of both numbers.'),
      q('Two buses arrive every 12 and 18 minutes. When do they next arrive together?', '36 minutes', ['6 minutes', '30 minutes', '216 minutes'], 'The next shared arrival is the LCM. LCM(12,18) = 36.', 'A future time must be a multiple of both intervals.', true),
      q('A learner says the HCF of 16 and 24 is 384. What is the correction?', 'HCF is 8, the greatest factor common to both', ['HCF is 40, because factors are added', 'HCF is 384, because numbers are multiplied', 'HCF is 16, because it is the smaller number'], '16 = 2⁴ and 24 = 2³ × 3. The common part is 2³ = 8.', 'HCF describes a shared divisor, not a product.', true),
    ]),
  lesson('G9-NUM-RATIO-RATE', 'Grade 9', 'RATIO-RATE', 'Ratio and unit rate',
    'By the end of this lesson, you should be able to simplify a ratio and calculate a unit rate.',
    'A ratio compares quantities in the same order. Divide every part by the same common factor to simplify it. A rate compares unlike units, for example kilometres per hour. Find a unit rate by dividing to make one of the quantities equal to one.',
    'A recipe uses 6 cups flour for 4 cups water.\nDivide both parts by 2.\n6 : 4 = 3 : 2.\nFor every 3 cups flour, use 2 cups water.',
    'Do not add the numbers in a ratio. A ratio is multiplicative: both parts must scale by the same factor.', [
      q('Simplify 18 : 24.', '3 : 4', ['6 : 8 : 2', '9 : 12', '42 : 1'], 'The HCF of 18 and 24 is 6. Divide both parts: 18 ÷ 6 : 24 ÷ 6 = 3 : 4.', 'Find a number that divides both parts.'),
      q('A taxi travels 150 km in 3 hours. What is its average speed?', '50 km/h', ['153 km/h', '450 km/h', '47 km/h'], 'Speed = distance ÷ time = 150 ÷ 3 = 50 km/h.', 'A unit rate means “for one hour”.'),
      q('Paint is mixed red : white = 2 : 5. If 6 cups are red, how many cups are white?', '15 cups', ['11 cups', '30 cups', '5 cups'], 'Red changes from 2 to 6, so multiply by 3. White is 5 × 3 = 15 cups.', 'Find the scale factor first.', true),
      q('Why must 4 : 6 and 10 : 15 not be treated as equivalent?', 'Their simplified ratios are 2 : 3 and 2 : 3, so they actually are equivalent', ['The numbers are different', 'Only ratios with small numbers are equivalent', 'Ratios cannot be simplified'], '4 : 6 ÷ 2 = 2 : 3 and 10 : 15 ÷ 5 = 2 : 3. Equal simplified ratios show equal relationships.', 'Simplify both ratios before deciding.', true),
    ]),
  lesson('G9-NUM-DIRECT-INVERSE-PROPORTION', 'Grade 9', 'PROPORTION', 'Direct and inverse proportion',
    'By the end of this lesson, you should be able to decide whether a situation uses direct or inverse proportion.',
    'In direct proportion, both quantities change in the same direction at a constant rate: more items cost more. In inverse proportion, one quantity increases while the other decreases so that their product stays fixed: more equally efficient workers take fewer days.',
    'Four workers take 15 days.\nTotal work = 4 × 15 = 60 worker-days.\nWith 6 workers: 60 ÷ 6 = 10 days.\nThis is inverse proportion.',
    '“One goes up and one goes down” is not enough by itself. The total task or product must stay fixed for inverse proportion.', [
      q('Five notebooks cost R40. What do eight cost at the same price?', 'R64', ['R48', 'R320', 'R13'], 'One notebook costs R40 ÷ 5 = R8. Eight cost 8 × R8 = R64.', 'Find the cost of one notebook.'),
      q('Eight taps fill a tank in 6 hours. How long would 12 identical taps take?', '4 hours', ['9 hours', '18 hours', '6 hours'], 'The work is 8 × 6 = 48 tap-hours. 48 ÷ 12 = 4 hours.', 'For inverse proportion, multiply first then divide.'),
      q('Which situation is inverse proportion?', 'For a fixed trip, higher speed means less travel time', ['More loaves cost more at one price', 'More litres give a higher water bill', 'More pages mean more printing'], 'For the same distance, speed × time is fixed. Increasing speed decreases time.', 'Look for a fixed total task or distance.', true),
      q('A learner doubles workers and doubles days. What error was made?', 'They treated an inverse relationship as direct', ['They simplified the ratio too far', 'They forgot a decimal point', 'They should add workers and days'], 'For the same job, doubling workers halves the time. The worker-day total stays constant.', 'Test the answer: would more workers really take longer?', true),
    ]),
  lesson('G9-NUM-FINANCIAL-APPLICATIONS', 'Grade 9', 'FINANCE', 'Commission, rental and compound interest',
    'By the end of this lesson, you should be able to calculate common Grade 9 financial applications.',
    'Commission is a percentage of sales. Rental questions often have a per-day amount plus a once-off fee. Compound interest grows the balance each period, so each new percentage is calculated on the previous balance.',
    'R2 000 earns 10% compound interest for two years.\nYear 1: R2 000 × 1.10 = R2 200.\nYear 2: R2 200 × 1.10 = R2 420.\nThe balance is R2 420.',
    'Do not add the once-off rental fee once for every day, and do not use simple interest when the question says compound.', [
      q('What is 7% commission on R3 000?', 'R210', ['R21', 'R2 790', 'R700'], '7% = 0.07. R3 000 × 0.07 = R210.', 'Change the percent to a decimal.'),
      q('A bike costs R80 per day plus one R50 deposit. What is paid for 3 days?', 'R290', ['R390', 'R240', 'R130'], '3 × R80 = R240. Add one deposit: R240 + R50 = R290.', 'The deposit is once-off.'),
      q('R1 500 grows by 8% compound interest for two years. What is the balance?', 'R1 749.60', ['R1 620.00', 'R1 740.00', 'R1 620.80'], 'Year 1: 1500 × 1.08 = 1620. Year 2: 1620 × 1.08 = 1749.60.', 'Apply 8% to the new balance in year 2.', true),
      q('Why is compound interest greater than simple interest after two positive years?', 'Second-year interest is earned on the increased balance', ['The percentage doubles automatically', 'The original balance is ignored', 'Interest is subtracted first'], 'Compound interest adds year-one interest to the balance before calculating year two.', 'Compare the base used in the second year.', true),
    ]),
  lesson('G9-NUM-INTEGERS-OPERATIONS', 'Grade 9', 'INTEGER-OPS', 'Integer operations and order',
    'By the end of this lesson, you should be able to calculate with signed integers using the correct order of operations.',
    'For addition and subtraction, use a number line or rewrite subtraction as adding the opposite. For multiplication and division, same signs give a positive answer and different signs give a negative answer. Evaluate brackets before powers, multiplication or division, then addition or subtraction.',
    'Calculate −6 − (−9).\nSubtracting a negative is adding its opposite.\n−6 − (−9) = −6 + 9 = 3.',
    'A negative sign is not a signal that the answer must be negative. Two negative factors make a positive product.', [
      q('Calculate −8 + 13.', '5', ['−21', '−5', '21'], 'Starting at −8 and adding 13 gives 5.', 'A positive addend moves right.'),
      q('Calculate (−7) × 6.', '−42', ['42', '−13', '13'], 'The signs differ, so the product is negative. 7 × 6 = 42.', 'Check whether the signs match.'),
      q('Calculate 18 ÷ [3 + (−6)].', '−6', ['6', '0', '−3'], 'Evaluate the bracket: 3 + (−6) = −3. Then 18 ÷ −3 = −6.', 'Brackets are calculated first.', true),
      q('Why is −4 − 7 equal to −11?', 'Subtracting 7 moves 7 units left from −4', ['The signs cancel', 'Only 7 is negative', 'All subtraction answers are negative'], 'On a number line start at −4 and move seven units left, reaching −11.', 'Think about direction on a number line.', true),
    ]),
  lesson('G9-NUM-INTEGERS-POWERS-ROOTS', 'Grade 9', 'POWERS-ROOTS', 'Squares, cubes and roots',
    'By the end of this lesson, you should be able to evaluate integer powers and roots.',
    'A square multiplies a number by itself; a cube uses three factors. Brackets decide whether a negative sign belongs to the base. √ gives the principal non-negative square root, while cube roots can be negative.',
    'Evaluate (−4)².\nThe brackets make −4 the base.\n(−4)² = (−4) × (−4) = 16.',
    'Without brackets, −4² means −(4²) = −16. The brackets matter.', [
      q('What is (−5)²?', '25', ['−25', '−10', '10'], '(−5)² = (−5) × (−5) = 25.', 'Square the whole bracketed number.'),
      q('What is ∛(−216)?', '−6', ['6', '−36', '36'], '(−6) × (−6) × (−6) = −216.', 'Which negative number cubed gives −216?'),
      q('Evaluate −3².', '−9', ['9', '−6', '6'], 'The exponent applies to 3 first: −3² = −(3²) = −9.', 'There are no brackets around −3.', true),
      q('Why is √64 not ±8?', '√ means the principal non-negative root', ['Square roots have no value', 'Both signs are always written', '64 has only one square root equation'], 'The equation x² = 64 has ±8 solutions, but the symbol √64 is defined as the principal root 8.', 'Separate a root symbol from solving an equation.', true),
    ]),
  lesson('G9-EXP-LAWS-EXTENDED', 'Grade 9', 'EXP-LAWS', 'Exponent laws',
    'By the end of this lesson, you should be able to use product, quotient and power laws for exponents.',
    'For the same non-zero base: multiply means add exponents, divide means subtract exponents, and a power of a power means multiply exponents. The base does not change just because the exponent changes.',
    'Simplify (x³)⁴.\nA power of a power multiplies exponents.\n(x³)⁴ = x^(3 × 4) = x¹².',
    'Do not use the product law for addition: x² + x³ cannot be simplified by adding exponents.', [
      q('Simplify a⁴ × a³.', 'a⁷', ['a¹²', 'a¹', '7a'], 'The bases match, so add exponents: 4 + 3 = 7.', 'The base remains a.'),
      q('Simplify y⁹ ÷ y⁴.', 'y⁵', ['y¹³', 'y³⁶', '1/y⁵'], 'For division with the same base, subtract: 9 − 4 = 5.', 'Use the quotient law.'),
      q('Simplify (m²n³)².', 'm⁴n⁶', ['m⁴n⁵', 'm⁴n⁹', 'm²n⁶'], 'Apply the outer power to each factor: m^(2×2)n^(3×2).', 'Every exponent inside the bracket is multiplied.', true),
      q('A learner writes x² + x³ = x⁵. What is correct?', 'The product law applies to multiplication, not addition', ['The answer is always x⁵', 'Add the bases instead', 'Subtract the exponents'], 'x² and x³ are unlike terms, so they do not combine through an exponent law.', 'Look at the operation between the terms.', true),
    ]),
  lesson('G9-EXP-NEGATIVE-SCI', 'Grade 9', 'EXP-ZERO-NEGATIVE', 'Zero and negative exponents',
    'By the end of this lesson, you should be able to interpret zero and negative exponents.',
    'For any non-zero base a, a⁰ = 1. A negative exponent makes a reciprocal: a⁻ⁿ = 1/aⁿ. These follow from the quotient law, for example a³ ÷ a³ = a⁰ = 1.',
    'Find 2⁻³.\n2⁻³ = 1/2³.\n2³ = 8.\nTherefore 2⁻³ = 1/8.',
    'A negative exponent does not make the answer negative. It tells you to use a reciprocal.', [
      q('What is 9⁰?', '1', ['0', '9', 'Undefined'], 'Any non-zero number to exponent zero equals 1.', 'The base is non-zero.'),
      q('What is 10⁻²?', '0.01', ['−100', '100', '−0.01'], '10⁻² = 1/10² = 1/100 = 0.01.', 'Write the reciprocal first.'),
      q('Which expression equals 1/p⁵?', 'p⁻⁵', ['−p⁵', 'p⁵', '1/5p'], 'By definition, p⁻⁵ = 1/p⁵ for p ≠ 0.', 'The negative belongs to the exponent.', true),
      q('Why is 0⁰ not used in the zero-exponent rule?', 'The quotient-law argument would divide 0 by 0', ['Zero has no powers', 'It must equal 1', 'It must equal 0'], 'The rule a⁰ comes from a¹ ÷ a¹, which needs a non-zero base.', 'What happens if the denominator is zero?', true),
    ]),
  lesson('G9-EXP-SCI-NOTATION-EXTENSION', 'Grade 9', 'SCI-NOTATION', 'Scientific notation extension',
    'By the end of this optional extension, you should be able to write large and small numbers in scientific notation.',
    'Scientific notation writes a number as a × 10ⁿ where 1 ≤ a < 10. Moving the decimal left gives a positive exponent; moving it right gives a negative exponent. This extension supports number sense but is not a required Term 1 mastery prerequisite.',
    'Write 4 500 000 in scientific notation.\nMove the decimal six places left: 4.5.\nTherefore 4 500 000 = 4.5 × 10⁶.',
    'The first number must be at least 1 but less than 10; 45 × 10⁵ is not standard scientific notation.', [
      q('Write 72 000 in scientific notation.', '7.2 × 10⁴', ['72 × 10³', '7.2 × 10³', '0.72 × 10⁵'], 'Move the decimal four places left: 72 000 = 7.2 × 10⁴.', 'Make the first number between 1 and 10.'),
      q('What is 3.6 × 10³ in ordinary notation?', '3 600', ['360', '36 000', '0.0036'], '10³ = 1000, so 3.6 × 1000 = 3600.', 'A positive exponent makes a larger number.'),
      q('Write 0.0042 in scientific notation.', '4.2 × 10⁻³', ['4.2 × 10³', '42 × 10⁻⁴', '0.42 × 10⁻²'], 'Move the decimal three places right to get 4.2, so use exponent −3.', 'Small decimals need negative powers of ten.', true),
      q('Why is 45 × 10⁵ not standard scientific notation?', '45 is not less than 10', ['The exponent must be negative', 'Scientific notation cannot use 10⁵', '45 is too small'], 'Standard form requires 1 ≤ a < 10. Rewrite it as 4.5 × 10⁶.', 'Check the leading number.', true),
    ]),
  lesson('G9-PAT-NUMERIC-STRUCTURE', 'Grade 9', 'PATTERN-STRUCTURE', 'Numeric patterns and differences',
    'By the end of this lesson, you should be able to identify a constant first difference and extend a linear pattern.',
    'A linear number pattern has the same change between consecutive terms. This constant first difference is the coefficient of n in its nth-term rule. Use a table to record term number n and value Tn.',
    'Extend 5, 9, 13, …\nFirst differences: +4, +4.\nAdd 4 again: 17, then 21.\nThe pattern has constant first difference 4.',
    'Do not use a constant ratio test for a pattern with a constant difference. Ratios are useful for geometric sequences, not these linear patterns.', [
      q('What is the first difference of 11, 16, 21, 26, …?', '5', ['11', '10', '−5'], '16 − 11 = 5, and the same change continues.', 'Subtract consecutive terms.'),
      q('Extend 4, 10, 16, … by two terms.', '22, 28', ['20, 24', '26, 36', '18, 20'], 'The first difference is 6, so add 6 twice.', 'Find the constant change.'),
      q('Which statement shows a linear pattern?', 'Its first differences are constant', ['Its terms are all even', 'Its ratio is constant', 'It starts at zero'], 'Constant first differences identify a linear pattern.', 'Compare changes, not just values.', true),
      q('A table has T1 = 7, T2 = 12, T3 = 17. What is T8?', '42', ['37', '47', '52'], 'The difference is 5. From T1 to T8 there are seven increases: 7 + 7×5 = 42.', 'Count the jumps between term 1 and term 8.', true),
    ]),
  lesson('G9-PAT-GENERAL-RULE', 'Grade 9', 'NTH-TERM', 'Linear nth-term rules',
    'By the end of this lesson, you should be able to find and test a linear nth-term rule.',
    'For a linear pattern, start with Tn = dn + c, where d is the first difference. Substitute n = 1 and the first term to find c. Then test the rule with another term; a rule is only useful if it matches the pattern.',
    'Find the rule for 6, 10, 14, …\nDifference d = 4, so Tn = 4n + c.\nAt n = 1: 4 + c = 6, so c = 2.\nRule: Tn = 4n + 2. Check T2 = 10.',
    'Using the first term as c is a common error. Remember that n starts at 1, so substitute it to find c.', [
      q('Find the nth term of 3, 7, 11, …', '4n − 1', ['4n + 3', '3n + 1', 'n + 3'], 'Difference is 4. At n=1, 4+c=3, so c=−1.', 'Use the first term to solve for c.'),
      q('For Tn = 5n + 2, find T6.', '32', ['30', '37', '13'], 'Substitute n=6: 5(6)+2=32.', 'Put 6 in place of n.'),
      q('Why should you test an nth-term rule using n = 2?', 'It checks that the rule fits more than one term', ['It changes the first difference', 'It makes c equal zero', 'It removes the need for n = 1'], 'A second test catches a rule that only happens to fit the first term.', 'A pattern rule must match the sequence, not one value.', true),
      q('A learner gives Tn = 3n + 8 for 8, 11, 14, … . What is correct?', 'It should be 3n + 5', ['It should be 8n + 3', 'It should be 3n', 'The learner rule is correct'], 'The difference is 3. At n=1, 3+c=8, so c=5.', 'Test the learner rule at n=1.', true),
    ]),
  lesson('G9-PAT-GEOMETRIC-VISUAL', 'Grade 9', 'VISUAL-PATTERNS', 'Geometric matchstick and tile patterns',
    'By the end of this lesson, you should be able to connect a growing diagram to a table and rule.',
    'For a visual pattern, count the first few figures carefully and identify what each new figure adds. In a row of joined squares, the first square uses 4 matchsticks and each extra square shares a side, so it adds 3. The rule is M = 3n + 1.',
    'How many matchsticks for 5 joined squares?\nM = 3n + 1.\nM = 3(5) + 1 = 16.\nSo 5 joined squares need 16 matchsticks.',
    'Counting 4n treats every square as separate and counts shared sides twice.', [
      q('How many matchsticks are needed for 4 joined squares in a row?', '13', ['12', '16', '10'], 'M = 3n+1. For n=4, M=13.', 'Each new square adds 3, not 4.'),
      q('Which rule fits a pattern beginning 5, 8, 11, …?', '3n + 2', ['3n + 5', '5n + 3', 'n + 4'], 'Difference is 3. At n=1, 3+c=5, so c=2.', 'Find the difference, then test n=1.'),
      q('Why does a joined-square row use 3n + 1 instead of 4n?', 'Each added square shares one side', ['The first square has no sides', 'n is always one', 'Squares only need three sides'], 'The n−1 shared sides mean the total is 4n−(n−1)=3n+1.', 'Look at what is shared between neighbours.', true),
      q('A tile pattern has figure 1 = 6 and adds 4 tiles each figure. What is figure 7?', '30', ['28', '34', '42'], 'Tn=6+4(n−1). T7=6+4×6=30.', 'There are six increases from figure 1 to figure 7.', true),
    ]),
  lesson('G8-NUM-WHOLE-PROPERTIES', 'Grade 8', 'G8-FACTORS', 'Grade 8 bridge: factors and order',
    'By the end of this bridge, you should be able to use factors and the order of operations before returning to Grade 9.',
    'Factors divide exactly. In calculations, do brackets first, then multiplication or division, then addition or subtraction. This bridge helps with HCF, LCM and integer work.',
    'Simplify 20 − 4 × 3.\nMultiply first: 4 × 3 = 12.\nThen 20 − 12 = 8.',
    'Working left to right through every symbol ignores the order of operations.', [q('Simplify 18 ÷ 3 + 4.', '10', ['2', '3', '22'], '18 ÷ 3 = 6, then 6 + 4 = 10.', 'Divide before adding.'), q('Which is a factor of 36?', '9', ['8', '10', '14'], '36 ÷ 9 = 4 with no remainder.', 'A factor divides exactly.'), q('Simplify 5 + 3 × 4.', '17', ['32', '20', '12'], 'Multiply 3×4 first, then add 5.', 'Multiplication comes before addition.', true), q('Why is 6 a common factor of 18 and 30?', 'It divides both without a remainder', ['It is their sum', 'It is bigger than both', 'It is a multiple of neither'], '18÷6=3 and 30÷6=5.', 'Test division for each number.', true)]),
  lesson('G8-NUM-FRACTIONS-OPERATIONS', 'Grade 8', 'G8-FRACTIONS', 'Grade 8 bridge: fractions',
    'By the end of this bridge, you should be able to add and compare simple fractions.',
    'Fractions must have a common denominator before adding or subtracting. Equivalent fractions name the same amount and are made by multiplying numerator and denominator by the same number.',
    'Calculate 1/3 + 1/6.\nThe common denominator is 6.\n1/3 = 2/6.\n2/6 + 1/6 = 3/6 = 1/2.',
    'Do not add denominators: 1/3 + 1/6 is not 2/9.', [q('Calculate 1/4 + 2/4.', '3/4', ['3/8', '2/8', '1/2'], 'The denominators match, so add the numerators.', 'Keep the denominator 4.'), q('Write 3/5 with denominator 20.', '12/20', ['3/20', '15/20', '8/20'], 'Multiply numerator and denominator by 4.', 'What makes 5 into 20?'), q('Calculate 2/3 − 1/6.', '1/2', ['1/6', '1/3', '1/18'], '2/3=4/6. 4/6−1/6=3/6=1/2.', 'Use denominator 6.', true), q('Why is 2/4 equal to 1/2?', 'Both simplify to the same part of a whole', ['The denominators are added', '2 is always half of 4', 'Fractions cannot be simplified'], 'Divide numerator and denominator of 2/4 by 2.', 'Simplify the fraction.', true)]),
  lesson('G8-NUM-DECIMALS-OPERATIONS', 'Grade 8', 'G8-DECIMALS', 'Grade 8 bridge: decimal operations',
    'By the end of this bridge, you should be able to calculate accurately with decimals.',
    'Line up decimal points when adding or subtracting. For multiplication, estimate first and place the decimal after multiplying whole-number digits. Decimals support rates, money and proportional reasoning.',
    'Calculate 4.75 + 2.6.\nWrite 2.6 as 2.60.\n4.75 + 2.60 = 7.35.',
    'Do not line up the final digits instead of the decimal points.', [q('Calculate 6.2 − 1.45.', '4.75', ['5.25', '4.65', '4.85'], '6.20−1.45=4.75.', 'Write 6.2 as 6.20.'), q('Calculate 0.4 × 0.5.', '0.2', ['2', '0.02', '0.9'], '4×5=20; two decimal places give 0.20.', 'Estimate: half of 0.4 is 0.2.'), q('A R12.50 item costs how much for 3?', 'R37.50', ['R15.50', 'R36.50', 'R125.00'], '12.50×3=37.50.', 'Multiply the amount, keeping cents.', true), q('Why is estimating useful with decimals?', 'It can reveal a misplaced decimal point', ['It replaces calculation', 'It removes units', 'It makes all answers whole'], 'An answer near 20 for 0.4×0.5 is unreasonable; estimate catches it.', 'Think about the size of the answer.', true)]),
  lesson('G8-NUM-INTEGERS-OPERATIONS', 'Grade 8', 'G8-INTEGERS', 'Grade 8 bridge: signed numbers',
    'By the end of this bridge, you should be able to add, subtract and multiply signed integers.',
    'Use a number line for addition and subtraction. For multiplication, matching signs give a positive result; different signs give a negative result. These ideas support Grade 9 integer calculations.',
    'Calculate −3 + 8.\nStart at −3.\nMove 8 steps right.\nThe answer is 5.',
    'Subtracting a negative changes to adding its opposite.', [q('Calculate −9 + 4.', '−5', ['5', '−13', '13'], 'Move four right from −9 to −5.', 'The negative magnitude is larger.'), q('Calculate (−5) × (−3).', '15', ['−15', '−8', '8'], 'Same signs give positive; 5×3=15.', 'Two negatives make a positive product.'), q('Calculate 7 − (−2).', '9', ['5', '−9', '−5'], 'Subtracting −2 means add 2: 7+2=9.', 'Rewrite as addition.', true), q('Why is (−12) ÷ 3 negative?', 'The signs are different', ['Division ignores signs', 'Both numbers are negative', '12 is greater than 3'], 'A negative divided by a positive is negative.', 'Compare the signs first.', true)]),
  lesson('G8-EXP-LAWS-SCI', 'Grade 8', 'G8-EXPONENTS', 'Grade 8 bridge: exponent basics',
    'By the end of this bridge, you should be able to read powers and use the product law with the same base.',
    'An exponent tells how many equal factors are multiplied. For the same base, multiplication adds exponents. This is the foundation for Grade 9 zero and negative exponents.',
    'Simplify 3² × 3⁴.\nThe base is 3 in both terms.\nAdd exponents: 2+4=6.\nAnswer: 3⁶.',
    'Exponents are not ordinary numbers to multiply when bases are being multiplied.', [q('What is 2⁴?', '16', ['8', '6', '24'], '2×2×2×2=16.', 'Write four factors of 2.'), q('Simplify x² × x⁵.', 'x⁷', ['x¹⁰', '2x⁷', 'x³'], 'Same base product: add 2+5.', 'Keep the base x.'), q('What is the base in (−4)³?', '−4', ['3', '4 only', '−3'], 'Brackets make the complete signed number the base.', 'The exponent sits outside the bracket.', true), q('Why is a³ × a² not a⁶?', 'The exponents are added, not multiplied', ['Bases are added', 'The base changes to 6', 'It is always a⁶'], 'There are 3+2 factors of a, giving a⁵.', 'Count the total factors.', true)]),
  lesson('G8-PAT-REPRESENT-RULE', 'Grade 8', 'G8-PATTERNS', 'Grade 8 bridge: simple pattern rules',
    'By the end of this bridge, you should be able to extend a simple number pattern and test a rule.',
    'Find how a pattern changes, then use a table to test a proposed rule. A constant first difference means that each new term adds the same number.',
    'For 2, 5, 8, … the change is +3.\nThe next term is 11.\nA matching rule is Tn = 3n − 1.',
    'A rule must work for the first and another term, not just one chosen term.', [q('What comes next: 9, 13, 17, …?', '21', ['19', '20', '22'], 'The constant difference is 4.', 'Subtract consecutive terms.'), q('For Tn=2n+1, find T4.', '9', ['7', '8', '12'], '2(4)+1=9.', 'Substitute n=4.'), q('Which rule fits 4, 7, 10, …?', '3n + 1', ['3n + 4', '4n − 1', 'n + 3'], 'Difference is 3 and 3(1)+1=4.', 'Test n=1.', true), q('Why test a rule at n=2?', 'It confirms another term matches', ['It changes n into 1', 'It removes the difference', 'All rules work at n=2'], 'A second value can show whether a rule was fitted incorrectly.', 'Substitute n=2.', true)]),
];

function buildPracticeQuestions() {
  return lessons.flatMap((entry) => entry.questions.map((question, index) => {
    const position = ['A', 'B', 'C', 'D'][(index + entry.slug.length) % 4];
    const labels = [question.correct, ...question.wrong];
    const options = {};
    const distractorExplanations = {};
    ['A', 'B', 'C', 'D'].forEach((key, optionIndex) => {
      const label = labels[(optionIndex - ['A', 'B', 'C', 'D'].indexOf(position) + 4) % 4];
      options[key] = label;
      if (key !== position) distractorExplanations[key] = `Revisit the worked method: ${question.hint}`;
    });
    return {
      code: `Q.${entry.grade === 'Grade 8' ? 'G8' : 'G9'}.S4.PRACTICE.${entry.slug}.${String(index + 1).padStart(2, '0')}`,
      skillCode: entry.skillCode, grade: entry.grade, activityCode: `A.${entry.grade === 'Grade 8' ? 'G8' : 'G9'}.S4.${entry.slug}`,
      activityTitle: `${entry.title}: short practice`, prompt: question.prompt, options, correctOption: position,
      distractorExplanations, solution: question.solution, hint: question.hint,
      reasoning: question.reasoning,
    };
  }));
}

module.exports = { lessons, buildPracticeQuestions };
