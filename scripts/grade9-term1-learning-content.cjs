'use strict';

/*
 * Canonical Sprint 4 instructional content.  This is deliberately the source
 * of truth; the SQL migration is generated from it so lessons and formative
 * questions can be reviewed here without reading a large data migration.
 */

const q = (prompt, correct, wrong, solution, hint, reasoning = false) => ({ prompt, correct, wrong, solution, hint, reasoning, reviewRecord: reasoning ? 'mathematics_reviewer_required' : 'computed_or_procedural_review_required' });
const lesson = (skillCode, grade, slug, title, objective, explanation, workedExample, misconception, questions) => ({ skillCode, grade, slug, title, objective, explanation, workedExample, misconception, questions });

/*
 * Publication-ready feedback is authored against the stable question suffix
 * and the literal distractor value.  It is deliberately data, not inference:
 * a new question, renamed option, or missing explanation must fail generation.
 */
const explicitFeedbackByQuestion = Object.freeze({
  'REAL.01': {
    '0.25': '0.25 is rational because it equals 1/4. A terminating decimal can be written as a fraction of integers.',
    '−7': '−7 is rational because it equals −7/1. A negative sign does not make a number irrational.',
    '3/5': '3/5 is already a ratio of two integers, so it is rational. An irrational number cannot be expressed in that form.',
  },
  'REAL.02': {
    'An irrational number': '√121 is not irrational: 121 is the perfect square 11 × 11, so its root is the integer 11.',
    'A negative integer': 'The principal square root √121 is 11, not −11. The root symbol names the non-negative root.',
    'Not a real number': '√121 is real because 121 is positive. Find the number whose square is 121: it is 11.',
  },
  'REAL.03': {
    'It has infinitely many digits': 'Having infinitely many digits is not enough; non-repeating decimals can be irrational. Here the digits repeat, giving 1/3.',
    'It is close to zero': 'Being close to zero does not decide whether a number is rational. The repeating decimal 0.333… equals 1/3.',
    'It contains a decimal point': 'A decimal point alone does not prove a number rational. This decimal is rational because its repeating pattern equals 1/3.',
  },
  'REAL.04': {
    'It is irrational because 1/4 is not an integer': '1/4 need not be an integer for its root to be rational. Since (1/2)² = 1/4, √(1/4) = 1/2.',
    'It equals 1/16 because both parts are squared': 'Taking a square root reverses squaring; it does not square the numerator and denominator. Test (1/2)² to find the root.',
    'It is not real': '1/4 is non-negative, so it has a real square root. The principal root is the non-negative fraction 1/2.',
  },
  'HCF-LCM.01': {
    '2 × 3 × 7': '2 × 3 × 7 equals 42, so one factor of 2 is missing. Divide 84 by 2 twice before using 3 and 7.',
    '2³ × 3 × 7': '2³ × 3 × 7 equals 168, so this includes one too many factors of 2. Check that the factors multiply back to 84.',
    '2² × 3² × 7': '2² × 3² × 7 equals 252, so the factor 3 has been used twice. Prime-factor products must equal the original number.',
  },
  'HCF-LCM.02': {
    '5': '5 is common, but it is not the highest common factor. Both 30 and 45 are also divisible by 15.',
    '10': '10 divides 30 but not 45, so it cannot be a common factor. Check divisibility in both numbers.',
    '90': '90 is the product-related LCM, not a factor of 30 or 45. An HCF must divide each number exactly.',
  },
  'HCF-LCM.03': {
    '6 minutes': '6 is the HCF of 12 and 18, not their next shared multiple. A future shared arrival must be a multiple of both intervals.',
    '30 minutes': '30 is not divisible by 12 or 18, so the buses would not both arrive then. List common multiples until the first one.',
    '216 minutes': '216 is a common multiple, but not the least one. The question asks for the next time after starting together: 36 minutes.',
  },
  'HCF-LCM.04': {
    'HCF is 40, because factors are added': 'Adding 16 and 24 gives 40, but a common factor must divide both numbers. Test divisors such as 8 instead.',
    'HCF is 384, because numbers are multiplied': '384 is the product of 16 and 24, not a shared divisor. HCF means the greatest number that divides both exactly.',
    'HCF is 16, because it is the smaller number': 'The smaller number is not automatically a common factor: 24 is not divisible by 16. Check which factors both numbers share.',
  },
  'RATIO-RATE.01': {
    '6 : 8 : 2': '6 : 8 : 2 has introduced a third part, so it no longer compares the same two quantities. Divide both original parts by 6.',
    '9 : 12': '9 : 12 is equivalent to 18 : 24, but it is not fully simplified. Divide both parts by their HCF, 3.',
    '42 : 1': '42 : 1 changes the relationship rather than simplifying it. A ratio is simplified by dividing every part by the same factor.',
  },
  'RATIO-RATE.02': {
    '153 km/h': '153 adds the distance and time instead of finding a rate. Average speed is distance divided by time: 150 ÷ 3.',
    '450 km/h': '450 multiplies distance by time, but speed is kilometres per one hour. Divide 150 km by 3 hours.',
    '47 km/h': '47 subtracts the time from the distance. To find a unit rate, divide 150 by 3.',
  },
  'RATIO-RATE.03': {
    '11 cups': '11 adds the two ratio parts rather than scaling the white part. Red changes from 2 to 6 by a factor of 3.',
    '30 cups': '30 scales white by 6 instead of using the ratio scale factor. Since 2 becomes 6, multiply 5 by 3.',
    '5 cups': '5 is the white part in the original ratio, before scaling. The red amount has tripled, so white must also triple.',
  },
  'RATIO-RATE.04': {
    'The claim is correct because the numbers in each ratio are different': 'Different-looking numbers can name the same ratio. Simplify 4 : 6 and 10 : 15 before comparing their multiplicative relationship.',
    'The claim is correct because only ratios already in lowest terms can be equivalent': 'A ratio need not already be simplified to be equivalent. Both ratios simplify to 2 : 3.',
    'The claim is incorrect because all ratios are equivalent': 'The claim is incorrect here, but not all ratios are equivalent. Equivalence requires the same simplified ratio, which is 2 : 3.',
  },
  'PROPORTION.01': {
    'R48': 'R48 uses R6 per notebook, but R40 shared by 5 notebooks is R8 each. Multiply the unit price by 8.',
    'R320': 'R320 multiplies the total R40 by 8 without first finding one notebook’s price. Use R40 ÷ 5, then multiply by 8.',
    'R13': 'R13 is not the cost of eight notebooks at the constant rate. Find the R8 unit price, then scale it to eight.',
  },
  'PROPORTION.02': {
    '9 hours': '9 hours treats more taps as taking more time. With the same tank, more identical taps mean fewer hours.',
    '18 hours': '18 hours multiplies both quantities as if the relationship were direct. Keep the tap-hour product 8 × 6 constant.',
    '6 hours': '6 hours ignores the extra four taps. Divide the fixed 48 tap-hours by 12 taps.',
  },
  'PROPORTION.03': {
    'More loaves cost more at one price': 'More loaves costing more is direct proportion: both quantities increase together. Inverse proportion has a fixed product or task.',
    'More litres give a higher water bill': 'A higher bill for more litres is direct proportion at a constant price. It does not show one quantity decreasing as the other increases.',
    'More pages mean more printing': 'More pages requiring more printing is direct, not inverse. Look for a fixed trip or task where one quantity rises while the other falls.',
  },
  'PROPORTION.04': {
    'They simplified the ratio too far': 'The error is not about simplifying a ratio. For one fixed job, workers and days should change in opposite directions.',
    'They forgot a decimal point': 'No decimal placement causes the problem. Doubling workers should halve days to keep total worker-days unchanged.',
    'They should add workers and days': 'Adding workers and days does not model a fixed job. Multiply workers by days, then keep that product constant.',
  },
  'FINANCE.01': {
    'R21': 'R21 treats 7% as 0.007 or uses the wrong place value. Convert 7% to 0.07 before multiplying R3 000.',
    'R2 790': 'R2 790 is the amount left after subtracting commission, not the commission itself. Calculate 7% of R3 000.',
    'R700': 'R700 treats 7% as 7/30 or a much larger percentage. Use 7 ÷ 100 = 0.07, then multiply.',
  },
  'FINANCE.02': {
    'R390 upfront; R390 net rental': 'R390 counts the R50 deposit three times and never returns it. Add the deposit once to R240, then remove it from net cost.',
    'R240 upfront; R240 net rental': 'R240 is the rental fee only; the refundable R50 must still be paid upfront. Add it once at collection.',
    'R290 upfront; R290 net rental': 'R290 is paid upfront, but the R50 deposit is refundable. After it is returned, only the R240 rental fee remains.',
  },
  'FINANCE.03': {
    'R1 620.00': 'R1 620.00 is the balance after only one 8% increase. Compound interest applies the second 8% to R1 620.',
    'R1 740.00': 'R1 740.00 adds two simple 8% increases to the original amount. Compound interest uses the increased balance in year two.',
    'R1 620.80': 'R1 620.80 applies an incorrect small second increase. Calculate 8% of R1 620, then add it to that balance.',
  },
  'FINANCE.04': {
    'The percentage doubles automatically': 'The percentage stays the same; its base changes. In year two, the same rate is applied to the larger balance.',
    'The original balance is ignored': 'The original balance remains part of the accumulated balance. What changes is that first-year interest also earns interest.',
    'Interest is subtracted first': 'Interest is added to grow the balance, not subtracted. The second calculation uses the balance after year-one interest.',
  },
  'INTEGER-OPS.01': {
    '−21': '−21 combines the magnitudes as if both numbers were negative. Adding +13 moves 13 units right from −8.',
    '−5': '−5 subtracts 13 from 8 rather than adding a positive number. Compare magnitudes: 13 is five more than 8.',
    '21': '21 adds magnitudes but ignores the negative starting value. Start at −8 and move right 13 to reach 5.',
  },
  'INTEGER-OPS.02': {
    '42': '42 has the right magnitude but misses the sign rule. A negative factor times a positive factor gives a negative product.',
    '−13': '−13 adds −7 and 6 instead of multiplying. First multiply the magnitudes, then apply the different-sign rule.',
    '13': '13 adds the magnitudes and ignores multiplication. Calculate 7 × 6, then use the negative sign from unlike factors.',
  },
  'INTEGER-OPS.03': {
    '6': '6 uses the magnitude of the divisor but ignores its negative sign. Evaluate the bracket first: 3 + (−6) is −3.',
    '0': '0 may come from adding 3 and −6 incorrectly. The bracket is −3, and 18 divided by −3 is not zero.',
    '−3': '−3 is the bracket value, not the completed division. After finding −3, divide 18 by it.',
  },
  'INTEGER-OPS.04': {
    'The signs cancel': 'Signs do not cancel in subtraction this way. Subtracting positive 7 means moving left seven units from −4.',
    'Only 7 is negative': '7 is positive in −4 − 7; the subtraction operation changes the movement direction. Use a number line to move left.',
    'All subtraction answers are negative': 'Subtraction can give positive, zero, or negative results. Here it is negative because starting at −4 and moving left gives −11.',
  },
  'POWERS-ROOTS.01': {
    '−25': '−25 keeps a negative sign after squaring. The whole negative number is squared, and two negative factors multiply to a positive.',
    '−10': '−10 doubles −5 instead of squaring it. Squaring means multiplying the base by itself: (−5) × (−5).',
    '10': '10 doubles the magnitude rather than squaring. Expand (−5)² as (−5) × (−5) to get a positive product.',
  },
  'POWERS-ROOTS.02': {
    '6': '6 cubed is positive 216, not −216. A cube root of a negative number must be negative.',
    '−36': '−36 is not a cube root; cubing it would be far from −216. Find the number that multiplied by itself three times gives −216.',
    '36': '36 confuses a square-related value with a cube root. Test −6 × −6 × −6 instead.',
  },
  'POWERS-ROOTS.03': {
    '9': '9 treats −3 as the bracketed base, but there are no brackets. The exponent applies to 3, then the leading negative remains.',
    '−6': '−6 doubles −3 instead of applying the exponent. Calculate 3² first, then apply the outside negative sign.',
    '6': '6 changes the expression into doubling and also loses the leading negative. Without brackets, −3² means −(3 × 3).',
  },
  'POWERS-ROOTS.04': {
    'Square roots have no value': '√64 does have a value: 8 × 8 = 64. The root symbol is defined to select the principal non-negative root.',
    'Both signs are always written': '± is used when solving x² = 64, not when evaluating √64. The radical symbol alone means the non-negative root.',
    '64 has only one square root equation': 'The equation x² = 64 has two solutions, 8 and −8. The notation √64 still names just the principal value 8.',
  },
  'EXP-LAWS.01': {
    'a¹²': 'a¹² multiplies the exponents, which is for a power of a power. With a⁴ × a³, count factors and add exponents.',
    'a¹': 'a¹ subtracts exponents as if dividing. Multiplication of the same base requires 4 + 3.',
    '7a': '7a treats exponents as ordinary coefficients. The base stays a and the total number of factors is a⁷.',
  },
  'EXP-LAWS.02': {
    'y¹³': 'y¹³ adds exponents as in multiplication. Division of equal non-zero bases cancels four factors, leaving 9 − 4.',
    'y³⁶': 'y³⁶ multiplies exponents, which is for a power of a power. Here divide y⁹ by y⁴ and subtract exponents.',
    '1/y⁵': '1/y⁵ would be y⁻⁵, not y⁹ ÷ y⁴. Cancel the four denominator factors from the nine numerator factors.',
  },
  'EXP-LAWS.03': {
    'm⁴n⁵': 'm⁴ is correct, but n³ squared multiplies 3 by 2, giving n⁶. Apply the outside power to every factor.',
    'm⁴n⁹': 'n⁹ adds exponents instead of multiplying for a power of a power. Square n³ by using 3 × 2.',
    'm²n⁶': 'n⁶ is correct, but m² must also be squared. Multiply both inner exponents by the outer 2.',
  },
  'EXP-LAWS.04': {
    'The answer is always x⁵': 'x⁵ would follow from multiplying x² and x³, but the operation here is addition. Exponent laws do not combine unlike addends.',
    'Add the bases instead': 'The bases are both x, so adding bases does not simplify x² + x³. The terms have different exponents and remain separate.',
    'Subtract the exponents': 'Subtracting exponents is a division rule, not an addition rule. Keep x² + x³ as written.',
  },
  'EXP-ZERO-NEGATIVE.01': {
    '0': '0 confuses a zero exponent with a zero base. For non-zero 9, the zero-exponent rule gives 9⁰ = 1.',
    '9': '9 keeps the base but ignores the exponent. A non-zero base raised to zero equals 1.',
    'Undefined': '9⁰ is defined because the base is non-zero. The undefined case to avoid is 0⁰, not 9⁰.',
  },
  'EXP-ZERO-NEGATIVE.02': {
    '−100': '−100 treats the negative exponent as a negative answer and reverses the reciprocal. First write 10⁻² as 1/10².',
    '100': '100 ignores the negative exponent. A negative exponent means reciprocal, so use 1 divided by 100.',
    '−0.01': '−0.01 adds a negative sign that is not in the base. The negative exponent changes position, not the sign.',
  },
  'EXP-ZERO-NEGATIVE.03': {
    '−p⁵': '−p⁵ changes the sign of the expression, but it is not a reciprocal. A negative exponent means 1 divided by p⁵.',
    'p⁵': 'p⁵ has the reciprocal backwards. Move p⁵ to the denominator by giving it exponent −5.',
    '1/5p': '1/5p divides by 5 and then multiplies by p; it is not 1 divided by p⁵. Keep p as the base with exponent −5.',
  },
  'EXP-ZERO-NEGATIVE.04': {
    'Zero has no powers': 'Zero can be raised to positive powers, such as 0² = 0. The issue is specifically the undefined form 0⁰.',
    'It must equal 1': 'The non-zero rule a⁰ = 1 cannot be applied with a = 0. Its quotient-law argument would require division by zero.',
    'It must equal 0': '0⁰ is not set to 0 by the zero-base pattern. The usual zero-exponent proof fails because it would divide 0 by 0.',
  },
  'SCI-NOTATION.01': {
    '72 × 10³': '72 × 10³ has the right value but 72 is not between 1 and 10. Shift the decimal once more and increase the exponent.',
    '7.2 × 10³': '7.2 is correctly sized, but 10³ moves the decimal only three places to 7 200. Count four places for 72 000.',
    '0.72 × 10⁵': '0.72 × 10⁵ has the right value but the coefficient is below 1. Standard notation needs 1 ≤ |a| < 10.',
  },
  'SCI-NOTATION.02': {
    '360': '360 moves the decimal only two places. The exponent 3 means multiply 3.6 by 1 000.',
    '36 000': '36 000 shifts the decimal four places, not three. Starting at 3.6, move it three places right.',
    '0.0036': '0.0036 treats the positive exponent as a negative one. A positive power of 10 makes the number larger.',
  },
  'SCI-NOTATION.03': {
    '4.2 × 10⁻³': '4.2 × 10⁻³ has the right magnitude but loses the original negative sign. Keep the sign in the coefficient.',
    '−4.2 × 10³': '−4.2 × 10³ is −4 200, much larger than −0.0042. Moving the decimal right for a small number needs a negative exponent.',
    '−0.42 × 10⁻²': '−0.42 × 10⁻² equals −0.0042, but −0.42 is not a standard coefficient. Shift it to −4.2 and adjust the exponent.',
  },
  'SCI-NOTATION.04': {
    'The exponent must be negative': 'Positive exponents are valid for large numbers. The issue is the coefficient 45, whose absolute value is not less than 10.',
    'Scientific notation cannot use 10⁵': '10⁵ is allowed in scientific notation. Standard form restricts the coefficient, not whether a positive exponent is used.',
    '45 is too small': '45 is too large for the coefficient range 1 ≤ |a| < 10. Rewrite it as 4.5 × 10⁶ instead.',
  },
  'PATTERN-STRUCTURE.01': {
    '11': '11 is the first term, not the difference. Subtract consecutive terms: 16 − 11 and 21 − 16.',
    '10': '10 does not match the increase from 11 to 16. Calculate the difference by subtraction, not by combining non-adjacent terms.',
    '−5': '−5 reverses the subtraction order. The pattern increases, so use later term minus earlier term to get +5.',
  },
  'PATTERN-STRUCTURE.02': {
    '20, 24': '20, 24 uses an increase of 4, but the given terms increase by 6. Continue the same first difference.',
    '26, 36': '26, 36 changes the step size after the first new term. Add 6 each time to preserve the linear pattern.',
    '18, 20': '18, 20 does not continue the +6 difference. Compare 10 − 4 and 16 − 10 before extending.',
  },
  'PATTERN-STRUCTURE.03': {
    'Its terms are all even': 'Even terms alone do not ensure a linear pattern; their differences could change. A linear sequence has a constant first difference.',
    'Its ratio is constant': 'A constant ratio identifies a geometric pattern, not generally a linear one. Check successive differences instead.',
    'It starts at zero': 'A linear pattern can start at any value. What matters is that the increase or decrease stays constant.',
  },
  'PATTERN-STRUCTURE.04': {
    '37': '37 adds the difference six times from 7, but reaching T8 requires seven increases. Count the jumps from term 1 to term 8.',
    '47': '47 uses too many increases or the wrong starting point. Use T8 = 7 + 5(8 − 1).',
    '52': '52 adds 5 nine times rather than seven. From T1 to T8 there are exactly seven equal steps.',
  },
  'NTH-TERM.01': {
    '4n + 3': '4n + 3 gives 7 when n = 1, not the first term 3. Keep the difference 4, then choose a constant that fits n = 1.',
    '3n + 1': '3n + 1 gives the wrong constant difference of 3. The sequence rises by 4 each time.',
    'n + 3': 'n + 3 increases by only 1 per term. The coefficient of n must match the first difference, 4.',
  },
  'NTH-TERM.02': {
    '30': '30 uses 5 × 6 but omits the +2 in the rule. Substitute both parts of Tn = 5n + 2.',
    '37': '37 adds 2 to the wrong multiple of 5. Calculate 5 × 6 first, then add 2 once.',
    '13': '13 appears to substitute the wrong n-value. The question asks for T6, so use n = 6.',
  },
  'NTH-TERM.03': {
    'It changes the first difference': 'Testing n = 2 does not change the pattern. It checks whether the proposed rule gives the actual second term.',
    'It makes c equal zero': 'The constant c is set by fitting a term, not automatically made zero by testing n = 2. Testing provides another check.',
    'It removes the need for n = 1': 'n = 1 is still useful to find the constant. n = 2 confirms the same rule works beyond one term.',
  },
  'NTH-TERM.04': {
    'It should be 8n + 3': '8n + 3 uses the first term as the difference, but the sequence increases by 3. Use coefficient 3 and fit the constant.',
    'It should be 3n': '3n has the correct difference but gives 3 at n = 1, not 8. Add a constant so the first term fits.',
    'The learner rule is correct': '3n + 8 gives 11 for n = 1, so it does not match the first term 8. Test a rule at n = 1.',
  },
  'VISUAL-PATTERNS.01': {
    '12': '12 uses 3 matchsticks per square but omits the first square’s extra side. A joined row follows 3n + 1.',
    '16': '16 counts four sides for every square and double-counts shared sides. Each extra square adds only 3 matchsticks.',
    '10': '10 treats the first square as if it also adds only 3 sides. Start with 4, then add 3 for each of the next squares.',
  },
  'VISUAL-PATTERNS.02': {
    '3n + 5': '3n + 5 has the right difference but gives 8 at n = 1, not 5. Test the rule using the first figure.',
    '5n + 3': '5n + 3 uses a difference of 5, but the pattern increases by 3. The coefficient must match the first difference.',
    'n + 4': 'n + 4 increases by only 1 each term. The sequence rises by 3, so its n coefficient must be 3.',
  },
  'VISUAL-PATTERNS.03': {
    'The first square has no sides': 'The first square has four sides. The reduction comes because each later square shares one side with its neighbour.',
    'n is always one': 'n counts the number of squares and changes from figure to figure. The +1 comes from the first unshared side, not from n being fixed.',
    'Squares only need three sides': 'A single square has four sides. In a joined row, a shared side is counted once rather than requiring only three sides per square.',
  },
  'VISUAL-PATTERNS.04': {
    '28': '28 makes only five increases of 4 from figure 1. Figure 7 is six steps after figure 1.',
    '34': '34 uses seven increases after figure 1 instead of six. Count the gaps between figure 1 and figure 7.',
    '42': '42 multiplies 6 by 7 as if the total were scaled, but the pattern adds 4 tiles each new figure.',
  },
  'G8-FACTORS.01': {
    '2': '2 subtracts or divides in the wrong order. Do the division 18 ÷ 3 first, then add 4.',
    '3': '3 may be the divisor, but it is not the full expression’s value. Follow order of operations before adding.',
    '22': '22 adds 18 and 4 before dividing, which changes the expression. Division comes before addition here.',
  },
  'G8-FACTORS.02': {
    '8': '8 does not divide 36 exactly; 36 ÷ 8 leaves a remainder. A factor must divide with no remainder.',
    '10': '10 is not a factor because 36 ÷ 10 is not whole. Test division to check a proposed factor.',
    '14': '14 does not divide 36 exactly. Look for a number that makes a whole-number quotient, such as 9.',
  },
  'G8-FACTORS.03': {
    '32': '32 adds 5 and 3 before multiplying by 4. Multiplication has priority, so calculate 3 × 4 first.',
    '20': '20 multiplies 5 by 4 and ignores the 3. Follow the expression as written: only 3 is multiplied by 4.',
    '12': '12 is the product 3 × 4, but the leading +5 still needs to be included.',
  },
  'G8-FACTORS.04': {
    'It is their sum': '6 is not the sum of 18 and 30. It is common because both numbers can be divided by 6 with no remainder.',
    'It is bigger than both': '6 is smaller than both numbers, and size alone does not make a factor. Test whether it divides each exactly.',
    'It is a multiple of neither': 'Whether 6 is a multiple is not the definition of a common factor. Check 18 ÷ 6 and 30 ÷ 6.',
  },
  'G8-FRACTIONS.01': {
    '3/8': '3/8 adds the denominators, which is not allowed when they already match. Keep denominator 4 and add the numerators.',
    '2/8': '2/8 changes both the numerator total and the common denominator. With fourths, 1 fourth plus 2 fourths is 3 fourths.',
    '1/2': '1/2 is equivalent to 2/4, not 3/4. Add the numerators first, then simplify only if possible.',
  },
  'G8-FRACTIONS.02': {
    '3/20': '3/20 changes only the denominator, so it is not equivalent to 3/5. Multiply numerator and denominator by 4.',
    '15/20': '15/20 multiplies the numerator by 5 while the denominator is multiplied by 4. Use the same factor on both parts.',
    '8/20': '8/20 does not keep the fraction’s value because 3 was not multiplied by 4. Make 5 into 20, then do the same to 3.',
  },
  'G8-FRACTIONS.03': {
    '1/6': '1/6 subtracts numerators without first changing 2/3 to sixths. Rewrite 2/3 as 4/6.',
    '1/3': '1/3 may come from using a denominator of 3, but 1/6 must be converted to a common denominator before subtraction.',
    '1/18': '1/18 multiplies denominators, which is not the method for subtracting fractions. Use the common denominator 6.',
  },
  'G8-FRACTIONS.04': {
    'The denominators are added': 'Adding denominators does not show equivalent fractions. Divide both numerator and denominator of 2/4 by the same number.',
    'The numerator is smaller than the denominator': 'Many proper fractions have a smaller numerator, but that does not prove they equal 1/2. Simplify 2/4 using a common factor.',
    'Fractions cannot be simplified': 'Fractions can be simplified when numerator and denominator share a factor. Divide both 2 and 4 by 2.',
  },
  'G8-DECIMALS.01': {
    '5.25': '5.25 misaligns place values during subtraction. Write 6.2 as 6.20, then subtract hundredths, tenths, and ones.',
    '4.65': '4.65 subtracts digits without correctly borrowing across decimal places. Line up the decimal points before subtracting.',
    '4.85': '4.85 has an incorrect tenths or hundredths subtraction. Use 6.20 − 1.45 with aligned columns.',
  },
  'G8-DECIMALS.02': {
    '2': '2 ignores decimal places and is too large: multiplying two numbers below 1 should give a number below 1.',
    '0.02': '0.02 places the decimal one position too far left. Four tenths times five tenths is twenty hundredths, or 0.20.',
    '0.9': '0.9 adds 0.4 and 0.5 rather than multiplying. Estimate first: the product should be about one fifth.',
  },
  'G8-DECIMALS.03': {
    'R15.50': 'R15.50 adds a small amount instead of multiplying the full price by 3. Multiply R12.50 three times.',
    'R36.50': 'R36.50 has the right tens but an incorrect cents calculation. Add 12.50 + 12.50 + 12.50 carefully.',
    'R125.00': 'R125.00 shifts the decimal point and is ten times too large. Keep cents when multiplying 12.50 by 3.',
  },
  'G8-DECIMALS.04': {
    'It replaces calculation': 'Estimating checks whether a calculation is reasonable; it does not replace the exact calculation when an exact answer is needed.',
    'It removes units': 'Estimation still needs units, such as rand or kilometres. Its purpose is to spot unreasonable sizes or decimal placement.',
    'It makes all answers whole': 'Estimates can be decimal values too. They help predict the size of an answer, not force it to be whole.',
  },
  'G8-INTEGERS.01': {
    '5': '5 ignores that −9 has the greater magnitude. Starting at −9 and moving 4 right lands on −5.',
    '−13': '−13 treats +4 as another negative addend. Adding a positive moves toward zero, from −9 to −5.',
    '13': '13 adds magnitudes but loses the sign of the larger magnitude. Compare 9 and 4, then keep the sign of −9.',
  },
  'G8-INTEGERS.02': {
    '−15': '−15 has the right magnitude but the wrong sign. Two negative factors multiply to a positive result.',
    '−8': '−8 adds −5 and −3 instead of multiplying. Multiply the magnitudes first, then use the same-sign rule.',
    '8': '8 adds magnitudes rather than multiplying. Calculate 5 × 3 and remember that matching negative signs give positive.',
  },
  'G8-INTEGERS.03': {
    '5': '5 treats subtracting −2 as subtracting positive 2. Rewrite 7 − (−2) as 7 + 2.',
    '−9': '−9 changes both signs and does not follow the subtraction rule. A double negative here becomes addition.',
    '−5': '−5 uses the difference of the magnitudes with an unsupported negative sign. Add 2 to 7 after rewriting the expression.',
  },
  'G8-INTEGERS.04': {
    'Division ignores signs': 'Division does use signs. A negative divided by a positive has unlike signs, so the quotient is negative.',
    'Both numbers are negative': 'Only −12 is negative; 3 is positive. The different signs explain why the quotient is negative.',
    '12 is greater than 3': 'Magnitude comparison does not set the sign of a quotient. Check whether the two signs match or differ.',
  },
  'G8-EXPONENTS.01': {
    '8': '8 is 2³, so it uses only three factors. The exponent 4 requires 2 × 2 × 2 × 2.',
    '6': '6 multiplies the base by the exponent instead of using repeated multiplication. Write four factors of 2.',
    '24': '24 may come from 2 × 3 × 4, but exponents repeat the base, not consecutive numbers. Multiply four 2s.',
  },
  'G8-EXPONENTS.02': {
    'x¹⁰': 'x¹⁰ multiplies exponents, which is for a power of a power. For multiplication of the same base, add 2 and 5.',
    '2x⁷': '2x⁷ adds an unnecessary coefficient 2. The exponents add while the base remains x.',
    'x³': 'x³ subtracts the exponents as if dividing. Multiplying x² and x⁵ gives seven factors of x.',
  },
  'G8-EXPONENTS.03': {
    '3': '3 is the exponent, not the base. The base is the complete quantity being repeatedly multiplied.',
    '4 only': 'The brackets include the negative sign in the base. The repeated factor is −4, not just 4.',
    '−3': '−3 combines the sign and exponent incorrectly. Read the expression: −4 is inside the brackets and 3 is outside.',
  },
  'G8-EXPONENTS.04': {
    'Bases are added': 'The bases stay a; they are not added. Count the total factors of a to see that exponents add.',
    'The base changes to 6': '6 is not a new base. The base remains a and the exponents 3 and 2 combine by addition.',
    'It is always a⁶': 'a⁶ would result from multiplying exponents, not from multiplying powers with the same base. Use 3 + 2.',
  },
  'G8-PATTERNS.01': {
    '19': '19 adds 2 instead of the constant difference 4. Compare 13 − 9 and 17 − 13.',
    '20': '20 does not continue the +4 pattern. Add the same difference to 17.',
    '22': '22 adds 5, not the established difference 4. Keep the change consistent from term to term.',
  },
  'G8-PATTERNS.02': {
    '7': '7 may use n = 3 rather than n = 4. Substitute the requested value 4 into 2n + 1.',
    '8': '8 doubles 4 but omits the +1 in the rule. Apply both operations in 2(4) + 1.',
    '12': '12 adds or multiplies the rule incorrectly. Evaluate 2 × 4 first, then add 1 once.',
  },
  'G8-PATTERNS.03': {
    '3n + 4': '3n + 4 has the right difference but gives 7 at n = 1, not 4. Test the rule against the first term.',
    '4n − 1': '4n − 1 changes by 4 each term, but the sequence changes by 3. The coefficient must match the difference.',
    'n + 3': 'n + 3 increases by only 1, not 3. Use 3n plus a constant that makes the first term 4.',
  },
  'G8-PATTERNS.04': {
    'It changes n into 1': 'Testing n = 2 does not change n; it substitutes 2 to predict the second term. This checks the proposed rule.',
    'It removes the difference': 'The common difference remains part of the pattern. Testing another n-value verifies that the rule preserves it.',
    'All rules work at n=2': 'A wrong rule can fail at n = 2, so testing it is useful. Compare the predicted second term with the actual one.',
  },
});

const lessons = [
  lesson('G9-NUM-REAL-IRRATIONAL', 'Grade 9', 'REAL', 'Real numbers: rational or irrational',
    'By the end of this lesson, you should be able to classify real numbers as rational or irrational.',
    'Rational numbers can be written as a fraction of two integers, with a non-zero denominator. Integers, terminating decimals and recurring decimals are rational. For a non-negative integer radicand, its square root is rational exactly when that integer is a perfect square. More generally, rational radicands can also have rational roots: √(1/4) = 1/2. Numbers such as √2 and π are real but irrational.',
    'Classify √81.\n1. 81 is a non-negative integer and a perfect square: 9 × 9 = 81.\n2. √81 = 9.\n3. 9 is an integer, so it is rational.\nAlso, √(1/4) = 1/2, showing that a rational non-integer radicand can have a rational square root.\nTherefore √81 is a rational real number.',
    'A root sign does not automatically mean “irrational”. For an integer inside √, check whether it is a perfect square; for fractions, simplify the root carefully.', [
      q('Which number is irrational?', '√20', ['0.25', '−7', '3/5'], '20 is not a perfect square, so √20 cannot be written as a ratio of integers. The other choices are rational.', 'Check whether the radicand is a perfect square.'),
      q('Classify √121.', 'A rational integer', ['An irrational number', 'A negative integer', 'Not a real number'], '√121 = 11. It is a natural number, an integer and therefore rational.', 'Find the principal square root first.'),
      q('Why is 0.333… rational?', 'It is equal to 1/3', ['It has infinitely many digits', 'It is close to zero', 'It contains a decimal point'], 'A recurring decimal has a fractional form. Here 0.333… = 1/3, so it is rational.', 'Recurring is different from non-repeating.' , true),
      q('Which statement is correct about √(1/4)?', 'It is rational because √(1/4) = 1/2', ['It is irrational because 1/4 is not an integer', 'It equals 1/16 because both parts are squared', 'It is not real'], 'The principal square root of 1/4 is 1/2 because (1/2)² = 1/4. A rational radicand need not be an integer.', 'Which non-negative fraction squared gives 1/4?', true),
    ]),
  lesson('G9-NUM-WHOLE-HCF-LCM', 'Grade 9', 'HCF-LCM', 'Factors, multiples, HCF and LCM',
    'By the end of this lesson, you should be able to use prime factors to find an HCF or LCM.',
    'A factor divides a number exactly; a multiple is made by multiplying. Prime factorisation writes a number as primes. For HCF use only common prime factors at their smallest powers. For LCM use every required prime factor at its largest power.',
    'Find the HCF and LCM of 24 and 36.\n24 = 2³ × 3 and 36 = 2² × 3².\nHCF = 2² × 3 = 12.\nLCM = 2³ × 3² = 72.',
    'Do not choose the HCF when a situation asks when repeated events next happen together: that needs the LCM.', [
      q('What is the prime factorisation of 84?', '2² × 3 × 7', ['2 × 3 × 7', '2³ × 3 × 7', '2² × 3² × 7'], '84 = 4 × 21 = 2² × 3 × 7.', 'Keep dividing by prime numbers.'),
      q('Find the HCF of 30 and 45.', '15', ['5', '10', '90'], '30 = 2 × 3 × 5 and 45 = 3² × 5. The common factors are 3 and 5, so the HCF is 15.', 'List the prime factors of both numbers.'),
      q('Two buses arrive together at the starting time, then every 12 and 18 minutes. How many minutes later do they next arrive together?', '36 minutes', ['6 minutes', '30 minutes', '216 minutes'], 'Starting together means the next shared arrival is the LCM. LCM(12,18) = 36.', 'A future time must be a multiple of both intervals.', true),
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
      q('A learner claims that 4 : 6 and 10 : 15 are not equivalent. Which explanation correctly evaluates the claim?', 'The claim is incorrect: 4 : 6 = 2 : 3 and 10 : 15 = 2 : 3', ['The claim is correct because the numbers in each ratio are different', 'The claim is correct because only ratios already in lowest terms can be equivalent', 'The claim is incorrect because all ratios are equivalent'], 'Simplify each ratio by its own common factor: 4 : 6 ÷ 2 = 2 : 3 and 10 : 15 ÷ 5 = 2 : 3. Both describe the same multiplicative relationship, so the learner’s claim is incorrect.', 'Simplify both ratios before deciding.', true),
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
    'Commission is a percentage of sales. Rental questions can include a per-day amount, a non-refundable fee, and a refundable deposit; identify which amount is returned before finding the final cost. Compound interest grows the balance each period, so each new percentage is calculated on the previous balance.',
    'R2 000 earns 10% compound interest for two years.\nYear 1: R2 000 × 1.10 = R2 200.\nYear 2: R2 200 × 1.10 = R2 420.\nThe balance is R2 420.',
    'Do not add the once-off rental fee once for every day, and do not use simple interest when the question says compound.', [
      q('What is 7% commission on R3 000?', 'R210', ['R21', 'R2 790', 'R700'], '7% = 0.07. R3 000 × 0.07 = R210.', 'Change the percent to a decimal.'),
      q('A bike rents for R80 per day and requires a refundable R50 deposit paid at collection. What is paid upfront for 3 days, and what is the net rental cost after the deposit is returned?', 'R290 upfront; R240 net rental', ['R390 upfront; R390 net rental', 'R240 upfront; R240 net rental', 'R290 upfront; R290 net rental'], 'The 3-day rental fee is 3 × R80 = R240. The R50 deposit is added once at collection, so R290 is paid upfront; because it is refundable, the net rental cost after return is R240.', 'Separate the once-off refundable deposit from the rental fee.'),
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
    'For the same non-zero base: multiply means add exponents, divide means subtract exponents, and a power of a power means multiply exponents. A quotient law needs a non-zero divisor, for example y⁹ ÷ y⁴ requires y ≠ 0. The base does not change just because the exponent changes.',
    'Simplify (x³)⁴.\nA power of a power multiplies exponents.\n(x³)⁴ = x^(3 × 4) = x¹².',
    'Do not use the product law for addition: x² + x³ cannot be simplified by adding exponents.', [
      q('Simplify a⁴ × a³.', 'a⁷', ['a¹²', 'a¹', '7a'], 'The bases match, so add exponents: 4 + 3 = 7.', 'The base remains a.'),
      q('For y ≠ 0, simplify y⁹ ÷ y⁴.', 'y⁵', ['y¹³', 'y³⁶', '1/y⁵'], 'Because y ≠ 0, the quotient is defined. For division with the same base, subtract: 9 − 4 = 5.', 'Use the quotient law only after checking the divisor is non-zero.'),
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
    'For a positive number, scientific notation writes a number as a × 10ⁿ where 1 ≤ a < 10. For any nonzero real number in standard scientific notation, the coefficient satisfies 1 ≤ |a| < 10, so negative numbers may have a negative coefficient. Moving the decimal left gives a positive exponent; moving it right gives a negative exponent. This optional extension supports number sense but is not a required Term 1 mastery prerequisite.',
    'Write −4 500 000 in scientific notation.\nKeep the sign and move the decimal six places left: −4.5.\nBecause |−4.5| is between 1 and 10, −4 500 000 = −4.5 × 10⁶ is standard scientific notation.',
    'For a nonzero number, the absolute value of the coefficient must be at least 1 but less than 10; 45 × 10⁵ is not standard scientific notation.', [
      q('Write 72 000 in scientific notation.', '7.2 × 10⁴', ['72 × 10³', '7.2 × 10³', '0.72 × 10⁵'], 'Move the decimal four places left: 72 000 = 7.2 × 10⁴.', 'Make the first number between 1 and 10.'),
      q('What is 3.6 × 10³ in ordinary notation?', '3 600', ['360', '36 000', '0.0036'], '10³ = 1000, so 3.6 × 1000 = 3600.', 'A positive exponent makes a larger number.'),
      q('Write −0.0042 in standard scientific notation.', '−4.2 × 10⁻³', ['4.2 × 10⁻³', '−4.2 × 10³', '−0.42 × 10⁻²'], 'Keep the negative sign. Move the decimal three places right to get −4.2, so use exponent −3; |−4.2| is between 1 and 10.', 'Small decimals need negative powers of ten; keep the original sign.', true),
      q('Why is 45 × 10⁵ not standard scientific notation?', '|45| is not less than 10', ['The exponent must be negative', 'Scientific notation cannot use 10⁵', '45 is too small'], 'For any nonzero number in standard form, 1 ≤ |a| < 10. Here |45| is too large; rewrite it as 4.5 × 10⁶.', 'Check the absolute value of the coefficient.', true),
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
    'Working left to right through every symbol ignores the order of operations.', [q('Simplify 18 ÷ 3 + 4.', '10', ['2', '3', '22'], '18 ÷ 3 = 6, then 6 + 4 = 10.', 'Divide before adding.'), q('Which is a factor of 36?', '9', ['8', '10', '14'], '36 ÷ 9 = 4 with no remainder.', 'A factor divides exactly.'), q('Simplify 5 + 3 × 4.', '17', ['32', '20', '12'], 'Multiply 3×4 first, then add 5.', 'Multiplication comes before addition.', true), q('Why is 6 a common factor of 18 and 30?', 'It divides both without a remainder', ['It is their sum', 'It is bigger than both', 'It is a multiple of neither'], '18 ÷ 6 = 3 and 30 ÷ 6 = 5, so 6 divides both numbers exactly.', 'Test division for each number.', true)]),
  lesson('G8-NUM-FRACTIONS-OPERATIONS', 'Grade 8', 'G8-FRACTIONS', 'Grade 8 bridge: fractions',
    'By the end of this bridge, you should be able to add and compare simple fractions.',
    'Fractions must have a common denominator before adding or subtracting. Equivalent fractions name the same amount and are made by multiplying numerator and denominator by the same number.',
    'Calculate 1/3 + 1/6.\nThe common denominator is 6.\n1/3 = 2/6.\n2/6 + 1/6 = 3/6 = 1/2.',
    'Do not add denominators: 1/3 + 1/6 is not 2/9.', [q('Calculate 1/4 + 2/4.', '3/4', ['3/8', '2/8', '1/2'], 'The denominators match, so add the numerators.', 'Keep the denominator 4.'), q('Write 3/5 with denominator 20.', '12/20', ['3/20', '15/20', '8/20'], 'Multiply numerator and denominator by 4.', 'What makes 5 into 20?'), q('Calculate 2/3 − 1/6.', '1/2', ['1/6', '1/3', '1/18'], '2/3=4/6. 4/6−1/6=3/6=1/2.', 'Use denominator 6.', true), q('Why is 2/4 equal to 1/2?', 'Dividing both numerator and denominator by 2 gives 1/2', ['The denominators are added', 'The numerator is smaller than the denominator', 'Fractions cannot be simplified'], 'Divide numerator and denominator of 2/4 by the same non-zero number: 2÷2 / 4÷2 = 1/2.', 'Simplify both parts by the same factor.', true)]),
  lesson('G8-NUM-DECIMALS-OPERATIONS', 'Grade 8', 'G8-DECIMALS', 'Grade 8 bridge: decimal operations',
    'By the end of this bridge, you should be able to calculate accurately with decimals.',
    'Line up decimal points when adding or subtracting. For multiplication, estimate first and place the decimal after multiplying whole-number digits. Decimals support rates, money and proportional reasoning.',
    'Calculate 4.75 + 2.6.\nWrite 2.6 as 2.60.\n4.75 + 2.60 = 7.35.',
    'Do not line up the final digits instead of the decimal points.', [q('Calculate 6.2 − 1.45.', '4.75', ['5.25', '4.65', '4.85'], 'Write 6.2 as 6.20, then subtract: 6.20 − 1.45 = 4.75.', 'Write 6.2 as 6.20.'), q('Calculate 0.4 × 0.5.', '0.2', ['2', '0.02', '0.9'], '4×5=20; two decimal places give 0.20.', 'Estimate whether multiplying two numbers smaller than one should make the result larger or smaller.'), q('A R12.50 item costs how much for 3?', 'R37.50', ['R15.50', 'R36.50', 'R125.00'], 'Multiply R12.50 by 3: 12.50 × 3 = 37.50, so the total is R37.50.', 'Multiply the amount, keeping cents.', true), q('Why is estimating useful with decimals?', 'It can reveal a misplaced decimal point', ['It replaces calculation', 'It removes units', 'It makes all answers whole'], 'An answer near 20 for 0.4×0.5 is unreasonable; estimate catches it.', 'Think about the size of the answer.', true)]),
  lesson('G8-NUM-INTEGERS-OPERATIONS', 'Grade 8', 'G8-INTEGERS', 'Grade 8 bridge: signed numbers',
    'By the end of this bridge, you should be able to add, subtract and multiply signed integers.',
    'Use a number line for addition and subtraction. For multiplication, matching signs give a positive result; different signs give a negative result. These ideas support Grade 9 integer calculations.',
    'Calculate −3 + 8.\nStart at −3.\nMove 8 steps right.\nThe answer is 5.',
    'Subtracting a negative changes to adding its opposite.', [q('Calculate −9 + 4.', '−5', ['5', '−13', '13'], 'Move four right from −9 to −5.', 'The negative magnitude is larger.'), q('Calculate (−5) × (−3).', '15', ['−15', '−8', '8'], 'Same signs give positive; 5×3=15.', 'Two negatives make a positive product.'), q('Calculate 7 − (−2).', '9', ['5', '−9', '−5'], 'Subtracting −2 means add 2: 7+2=9.', 'Rewrite as addition.', true), q('Why is (−12) ÷ 3 negative?', 'The signs are different', ['Division ignores signs', 'Both numbers are negative', '12 is greater than 3'], 'A negative divided by a positive is negative.', 'Compare the signs first.', true)]),
  lesson('G8-EXP-LAWS-SCI', 'Grade 8', 'G8-EXPONENTS', 'Grade 8 bridge: exponent basics',
    'By the end of this bridge, you should be able to read powers and use the product law with the same base.',
    'An exponent tells how many equal factors are multiplied. For the same base, multiplication adds exponents. This is the foundation for Grade 9 zero and negative exponents.',
    'Simplify 3² × 3⁴.\nThe base is 3 in both terms.\nAdd exponents: 2+4=6.\nAnswer: 3⁶.',
    'Exponents are not ordinary numbers to multiply when bases are being multiplied.', [q('What is 2⁴?', '16', ['8', '6', '24'], 'The exponent 4 means four factors: 2 × 2 × 2 × 2 = 16.', 'Write four factors of 2.'), q('Simplify x² × x⁵.', 'x⁷', ['x¹⁰', '2x⁷', 'x³'], 'Same base product: add 2+5.', 'Keep the base x.'), q('What is the base in (−4)³?', '−4', ['3', '4 only', '−3'], 'Brackets make the complete signed number the base.', 'The exponent sits outside the bracket.', true), q('Why is a³ × a² not a⁶?', 'The exponents are added, not multiplied', ['Bases are added', 'The base changes to 6', 'It is always a⁶'], 'There are 3+2 factors of a, giving a⁵.', 'Count the total factors.', true)]),
  lesson('G8-PAT-REPRESENT-RULE', 'Grade 8', 'G8-PATTERNS', 'Grade 8 bridge: simple pattern rules',
    'By the end of this bridge, you should be able to extend a simple number pattern and test a rule.',
    'Find how a pattern changes, then use a table to test a proposed rule. A constant first difference means that each new term adds the same number.',
    'For 2, 5, 8, … the change is +3.\nThe next term is 11.\nA matching rule is Tn = 3n − 1.',
    'A rule must work for the first and another term, not just one chosen term.', [q('What comes next: 9, 13, 17, …?', '21', ['19', '20', '22'], 'The constant difference is 4.', 'Subtract consecutive terms.'), q('For Tn=2n+1, find T4.', '9', ['7', '8', '12'], 'Substitute n = 4: T4 = 2(4) + 1 = 9.', 'Substitute n=4.'), q('Which rule fits 4, 7, 10, …?', '3n + 1', ['3n + 4', '4n − 1', 'n + 3'], 'Difference is 3 and 3(1)+1=4.', 'Test n=1.', true), q('Why test a rule at n=2?', 'It confirms another term matches', ['It changes n into 1', 'It removes the difference', 'All rules work at n=2'], 'A second value can show whether a rule was fitted incorrectly.', 'Substitute n=2.', true)]),
];

function buildPracticeQuestions() {
  return lessons.flatMap((entry) => entry.questions.map((question, index) => {
    const position = ['A', 'B', 'C', 'D'][(index + entry.slug.length) % 4];
    const labels = [question.correct, ...question.wrong];
    const options = {};
    const distractorExplanations = {};
    const feedbackKey = `${entry.slug}.${String(index + 1).padStart(2, '0')}`;
    const authoredFeedback = explicitFeedbackByQuestion[feedbackKey];
    if (!authoredFeedback) throw new Error(`${feedbackKey}: explicit distractor feedback is required for publication-ready content.`);
    const authoredAnswers = Object.keys(authoredFeedback).sort();
    const expectedAnswers = question.wrong.slice().sort();
    if (authoredAnswers.join('\u0000') !== expectedAnswers.join('\u0000')) throw new Error(`${feedbackKey}: authored feedback must map exactly to its three stable wrong-answer values.`);
    ['A', 'B', 'C', 'D'].forEach((key, optionIndex) => {
      const label = labels[(optionIndex - ['A', 'B', 'C', 'D'].indexOf(position) + 4) % 4];
      options[key] = label;
      if (key !== position) distractorExplanations[key] = authoredFeedback[label];
    });
    return {
      code: `Q.${entry.grade === 'Grade 8' ? 'G8' : 'G9'}.S4.PRACTICE.${entry.slug}.${String(index + 1).padStart(2, '0')}`,
      skillCode: entry.skillCode, grade: entry.grade, activityCode: `A.${entry.grade === 'Grade 8' ? 'G8' : 'G9'}.S4.${entry.slug}`,
      activityTitle: `${entry.title}: short practice`, prompt: question.prompt, options, correctOption: position,
      distractorExplanations, solution: question.solution, hint: question.hint,
      reasoning: question.reasoning, reviewRecord: question.reviewRecord,
      feedbackSource: 'explicitly_authored_v3', feedbackByWrong: authoredFeedback,
    };
  }));
}

module.exports = { lessons, buildPracticeQuestions, explicitFeedbackByQuestion };
