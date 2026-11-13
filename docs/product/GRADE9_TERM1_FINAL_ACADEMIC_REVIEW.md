# Grade 9 Term 1 final academic review package

**Pack version:** sprint4-v3-explicit-distractor-feedback  
**Generated:** 2026-11-12  
**Purpose:** final mathematical inspection of the corrected instructional pack before an authorised administrator approves or publishes it.

## Review status

- **Authored:** Complete — 13 Grade 9 lessons, 6 Grade 8 bridge lessons, 76 practice questions, 19 practice activities, and 228 explicit incorrect-answer explanations.
- **Mathematically reviewed:** The project’s ChatGPT reviewer granted conditional approval to the earlier Sprint 4 v2 pack. That historical conditional verdict is retained. It is **not** a final approval of this v3 feedback revision.
- **Admin approved:** Not approved by this document.
- **Published:** Not published to production by this document.
- **Pilot-ready:** Pending the reviewer’s explicit v3 verdict and observed real-data release-gate results.

## Required reviewer verdict

Review the questions and feedback below, paying particular attention to whether each wrong-answer explanation identifies the selected misconception and gives an appropriate next mathematical idea. Return one of: **Approved**, **Approved with specified amendments**, or **Not approved**. Do not infer administrator approval or publication from an academic verdict.

## Automated checks and human boundary

The companion QA process verifies all 76 stable codes, four distinct choices per question, correct option presence, exactly three feedback entries, explicit value-keyed feedback mapping, repeated/near-duplicate feedback, hints that do not reveal the answer, skill/activity links, key numerical regressions, and absence of the former inferred-feedback fallback. It cannot establish that every sentence is the best pedagogical diagnosis; [the semantic-review checklist](GRADE9_TERM1_DISTRACTOR_FEEDBACK_SEMANTIC_REVIEW.md) records that human decision explicitly.

## Lesson inventory

| Grade | Skill | Lesson | Questions |
| --- | --- | --- | ---: |
| Grade 9 | G9-NUM-REAL-IRRATIONAL | Real numbers: rational or irrational | 4 |
| Grade 9 | G9-NUM-WHOLE-HCF-LCM | Factors, multiples, HCF and LCM | 4 |
| Grade 9 | G9-NUM-RATIO-RATE | Ratio and unit rate | 4 |
| Grade 9 | G9-NUM-DIRECT-INVERSE-PROPORTION | Direct and inverse proportion | 4 |
| Grade 9 | G9-NUM-FINANCIAL-APPLICATIONS | Commission, rental and compound interest | 4 |
| Grade 9 | G9-NUM-INTEGERS-OPERATIONS | Integer operations and order | 4 |
| Grade 9 | G9-NUM-INTEGERS-POWERS-ROOTS | Squares, cubes and roots | 4 |
| Grade 9 | G9-EXP-LAWS-EXTENDED | Exponent laws | 4 |
| Grade 9 | G9-EXP-NEGATIVE-SCI | Zero and negative exponents | 4 |
| Grade 9 | G9-EXP-SCI-NOTATION-EXTENSION | Scientific notation extension | 4 |
| Grade 9 | G9-PAT-NUMERIC-STRUCTURE | Numeric patterns and differences | 4 |
| Grade 9 | G9-PAT-GENERAL-RULE | Linear nth-term rules | 4 |
| Grade 9 | G9-PAT-GEOMETRIC-VISUAL | Geometric matchstick and tile patterns | 4 |
| Grade 8 | G8-NUM-WHOLE-PROPERTIES | Grade 8 bridge: factors and order | 4 |
| Grade 8 | G8-NUM-FRACTIONS-OPERATIONS | Grade 8 bridge: fractions | 4 |
| Grade 8 | G8-NUM-DECIMALS-OPERATIONS | Grade 8 bridge: decimal operations | 4 |
| Grade 8 | G8-NUM-INTEGERS-OPERATIONS | Grade 8 bridge: signed numbers | 4 |
| Grade 8 | G8-EXP-LAWS-SCI | Grade 8 bridge: exponent basics | 4 |
| Grade 8 | G8-PAT-REPRESENT-RULE | Grade 8 bridge: simple pattern rules | 4 |

## Mathematical assumptions retained from Sprint 4 v2

- For a non-negative integer radicand, a square root is rational exactly when the integer is a perfect square; rational non-integer radicands can also have rational roots, for example √(1/4) = 1/2.
- Standard scientific notation for non-zero real numbers uses 1 ≤ |a| < 10; the positive-number convention is a special case.
- Exponent quotients state non-zero divisor conditions.
- The HCF/LCM bus question says both buses start together; the rental question separates an upfront refundable deposit from net rental cost.
- Scientific notation remains an optional Grade 9 Term 1 extension, not mastery-critical content.

## Complete corrected content

## Grade 9 — Real numbers: rational or irrational

- Skill: G9-NUM-REAL-IRRATIONAL
- Objective: By the end of this lesson, you should be able to classify real numbers as rational or irrational.
- Explanation: Rational numbers can be written as a fraction of two integers, with a non-zero denominator. Integers, terminating decimals and recurring decimals are rational. For a non-negative integer radicand, its square root is rational exactly when that integer is a perfect square. More generally, rational radicands can also have rational roots: √(1/4) = 1/2. Numbers such as √2 and π are real but irrational.
- Worked example: Classify √81.
1. 81 is a non-negative integer and a perfect square: 9 × 9 = 81.
2. √81 = 9.
3. 9 is an integer, so it is rational.
Also, √(1/4) = 1/2, showing that a rational non-integer radicand can have a rational square root.
Therefore √81 is a rational real number.
- Common misconception: A root sign does not automatically mean “irrational”. For an integer inside √, check whether it is a perfect square; for fractions, simplify the root carefully.

### Q.G9.S4.PRACTICE.REAL.01

- Prompt: Which number is irrational?
- Skill: G9-NUM-REAL-IRRATIONAL
- Activity: A.G9.S4.REAL
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A (correct): √20
- B: 0.25
- C: −7
- D: 3/5
- Worked solution: 20 is not a perfect square, so √20 cannot be written as a ratio of integers. The other choices are rational.
- Hint: Check whether the radicand is a perfect square.
- Individually authored incorrect-answer feedback:
- Selected B — **0.25**: 0.25 is rational because it equals 1/4. A terminating decimal can be written as a fraction of integers.
- Selected C — **−7**: −7 is rational because it equals −7/1. A negative sign does not make a number irrational.
- Selected D — **3/5**: 3/5 is already a ratio of two integers, so it is rational. An irrational number cannot be expressed in that form.

### Q.G9.S4.PRACTICE.REAL.02

- Prompt: Classify √121.
- Skill: G9-NUM-REAL-IRRATIONAL
- Activity: A.G9.S4.REAL
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: Not a real number
- B (correct): A rational integer
- C: An irrational number
- D: A negative integer
- Worked solution: √121 = 11. It is a natural number, an integer and therefore rational.
- Hint: Find the principal square root first.
- Individually authored incorrect-answer feedback:
- Selected A — **Not a real number**: √121 is real because 121 is positive. Find the number whose square is 121: it is 11.
- Selected C — **An irrational number**: √121 is not irrational: 121 is the perfect square 11 × 11, so its root is the integer 11.
- Selected D — **A negative integer**: The principal square root √121 is 11, not −11. The root symbol names the non-negative root.

### Q.G9.S4.PRACTICE.REAL.03

- Prompt: Why is 0.333… rational?
- Skill: G9-NUM-REAL-IRRATIONAL
- Activity: A.G9.S4.REAL
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: It is close to zero
- B: It contains a decimal point
- C (correct): It is equal to 1/3
- D: It has infinitely many digits
- Worked solution: A recurring decimal has a fractional form. Here 0.333… = 1/3, so it is rational.
- Hint: Recurring is different from non-repeating.
- Individually authored incorrect-answer feedback:
- Selected A — **It is close to zero**: Being close to zero does not decide whether a number is rational. The repeating decimal 0.333… equals 1/3.
- Selected B — **It contains a decimal point**: A decimal point alone does not prove a number rational. This decimal is rational because its repeating pattern equals 1/3.
- Selected D — **It has infinitely many digits**: Having infinitely many digits is not enough; non-repeating decimals can be irrational. Here the digits repeat, giving 1/3.

### Q.G9.S4.PRACTICE.REAL.04

- Prompt: Which statement is correct about √(1/4)?
- Skill: G9-NUM-REAL-IRRATIONAL
- Activity: A.G9.S4.REAL
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: It is irrational because 1/4 is not an integer
- B: It equals 1/16 because both parts are squared
- C: It is not real
- D (correct): It is rational because √(1/4) = 1/2
- Worked solution: The principal square root of 1/4 is 1/2 because (1/2)² = 1/4. A rational radicand need not be an integer.
- Hint: Which non-negative fraction squared gives 1/4?
- Individually authored incorrect-answer feedback:
- Selected A — **It is irrational because 1/4 is not an integer**: 1/4 need not be an integer for its root to be rational. Since (1/2)² = 1/4, √(1/4) = 1/2.
- Selected B — **It equals 1/16 because both parts are squared**: Taking a square root reverses squaring; it does not square the numerator and denominator. Test (1/2)² to find the root.
- Selected C — **It is not real**: 1/4 is non-negative, so it has a real square root. The principal root is the non-negative fraction 1/2.


## Grade 9 — Factors, multiples, HCF and LCM

- Skill: G9-NUM-WHOLE-HCF-LCM
- Objective: By the end of this lesson, you should be able to use prime factors to find an HCF or LCM.
- Explanation: A factor divides a number exactly; a multiple is made by multiplying. Prime factorisation writes a number as primes. For HCF use only common prime factors at their smallest powers. For LCM use every required prime factor at its largest power.
- Worked example: Find the HCF and LCM of 24 and 36.
24 = 2³ × 3 and 36 = 2² × 3².
HCF = 2² × 3 = 12.
LCM = 2³ × 3² = 72.
- Common misconception: Do not choose the HCF when a situation asks when repeated events next happen together: that needs the LCM.

### Q.G9.S4.PRACTICE.HCF-LCM.01

- Prompt: What is the prime factorisation of 84?
- Skill: G9-NUM-WHOLE-HCF-LCM
- Activity: A.G9.S4.HCF-LCM
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: 2 × 3 × 7
- B: 2³ × 3 × 7
- C: 2² × 3² × 7
- D (correct): 2² × 3 × 7
- Worked solution: 84 = 4 × 21 = 2² × 3 × 7.
- Hint: Keep dividing by prime numbers.
- Individually authored incorrect-answer feedback:
- Selected A — **2 × 3 × 7**: 2 × 3 × 7 equals 42, so one factor of 2 is missing. Divide 84 by 2 twice before using 3 and 7.
- Selected B — **2³ × 3 × 7**: 2³ × 3 × 7 equals 168, so this includes one too many factors of 2. Check that the factors multiply back to 84.
- Selected C — **2² × 3² × 7**: 2² × 3² × 7 equals 252, so the factor 3 has been used twice. Prime-factor products must equal the original number.

### Q.G9.S4.PRACTICE.HCF-LCM.02

- Prompt: Find the HCF of 30 and 45.
- Skill: G9-NUM-WHOLE-HCF-LCM
- Activity: A.G9.S4.HCF-LCM
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A (correct): 15
- B: 5
- C: 10
- D: 90
- Worked solution: 30 = 2 × 3 × 5 and 45 = 3² × 5. The common factors are 3 and 5, so the HCF is 15.
- Hint: List the prime factors of both numbers.
- Individually authored incorrect-answer feedback:
- Selected B — **5**: 5 is common, but it is not the highest common factor. Both 30 and 45 are also divisible by 15.
- Selected C — **10**: 10 divides 30 but not 45, so it cannot be a common factor. Check divisibility in both numbers.
- Selected D — **90**: 90 is the product-related LCM, not a factor of 30 or 45. An HCF must divide each number exactly.

### Q.G9.S4.PRACTICE.HCF-LCM.03

- Prompt: Two buses arrive together at the starting time, then every 12 and 18 minutes. How many minutes later do they next arrive together?
- Skill: G9-NUM-WHOLE-HCF-LCM
- Activity: A.G9.S4.HCF-LCM
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: 216 minutes
- B (correct): 36 minutes
- C: 6 minutes
- D: 30 minutes
- Worked solution: Starting together means the next shared arrival is the LCM. LCM(12,18) = 36.
- Hint: A future time must be a multiple of both intervals.
- Individually authored incorrect-answer feedback:
- Selected A — **216 minutes**: 216 is a common multiple, but not the least one. The question asks for the next time after starting together: 36 minutes.
- Selected C — **6 minutes**: 6 is the HCF of 12 and 18, not their next shared multiple. A future shared arrival must be a multiple of both intervals.
- Selected D — **30 minutes**: 30 is not divisible by 12 or 18, so the buses would not both arrive then. List common multiples until the first one.

### Q.G9.S4.PRACTICE.HCF-LCM.04

- Prompt: A learner says the HCF of 16 and 24 is 384. What is the correction?
- Skill: G9-NUM-WHOLE-HCF-LCM
- Activity: A.G9.S4.HCF-LCM
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: HCF is 384, because numbers are multiplied
- B: HCF is 16, because it is the smaller number
- C (correct): HCF is 8, the greatest factor common to both
- D: HCF is 40, because factors are added
- Worked solution: 16 = 2⁴ and 24 = 2³ × 3. The common part is 2³ = 8.
- Hint: HCF describes a shared divisor, not a product.
- Individually authored incorrect-answer feedback:
- Selected A — **HCF is 384, because numbers are multiplied**: 384 is the product of 16 and 24, not a shared divisor. HCF means the greatest number that divides both exactly.
- Selected B — **HCF is 16, because it is the smaller number**: The smaller number is not automatically a common factor: 24 is not divisible by 16. Check which factors both numbers share.
- Selected D — **HCF is 40, because factors are added**: Adding 16 and 24 gives 40, but a common factor must divide both numbers. Test divisors such as 8 instead.


## Grade 9 — Ratio and unit rate

- Skill: G9-NUM-RATIO-RATE
- Objective: By the end of this lesson, you should be able to simplify a ratio and calculate a unit rate.
- Explanation: A ratio compares quantities in the same order. Divide every part by the same common factor to simplify it. A rate compares unlike units, for example kilometres per hour. Find a unit rate by dividing to make one of the quantities equal to one.
- Worked example: A recipe uses 6 cups flour for 4 cups water.
Divide both parts by 2.
6 : 4 = 3 : 2.
For every 3 cups flour, use 2 cups water.
- Common misconception: Do not add the numbers in a ratio. A ratio is multiplicative: both parts must scale by the same factor.

### Q.G9.S4.PRACTICE.RATIO-RATE.01

- Prompt: Simplify 18 : 24.
- Skill: G9-NUM-RATIO-RATE
- Activity: A.G9.S4.RATIO-RATE
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: 9 : 12
- B: 42 : 1
- C (correct): 3 : 4
- D: 6 : 8 : 2
- Worked solution: The HCF of 18 and 24 is 6. Divide both parts: 18 ÷ 6 : 24 ÷ 6 = 3 : 4.
- Hint: Find a number that divides both parts.
- Individually authored incorrect-answer feedback:
- Selected A — **9 : 12**: 9 : 12 is equivalent to 18 : 24, but it is not fully simplified. Divide both parts by their HCF, 3.
- Selected B — **42 : 1**: 42 : 1 changes the relationship rather than simplifying it. A ratio is simplified by dividing every part by the same factor.
- Selected D — **6 : 8 : 2**: 6 : 8 : 2 has introduced a third part, so it no longer compares the same two quantities. Divide both original parts by 6.

### Q.G9.S4.PRACTICE.RATIO-RATE.02

- Prompt: A taxi travels 150 km in 3 hours. What is its average speed?
- Skill: G9-NUM-RATIO-RATE
- Activity: A.G9.S4.RATIO-RATE
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: 153 km/h
- B: 450 km/h
- C: 47 km/h
- D (correct): 50 km/h
- Worked solution: Speed = distance ÷ time = 150 ÷ 3 = 50 km/h.
- Hint: A unit rate means “for one hour”.
- Individually authored incorrect-answer feedback:
- Selected A — **153 km/h**: 153 adds the distance and time instead of finding a rate. Average speed is distance divided by time: 150 ÷ 3.
- Selected B — **450 km/h**: 450 multiplies distance by time, but speed is kilometres per one hour. Divide 150 km by 3 hours.
- Selected C — **47 km/h**: 47 subtracts the time from the distance. To find a unit rate, divide 150 by 3.

### Q.G9.S4.PRACTICE.RATIO-RATE.03

- Prompt: Paint is mixed red : white = 2 : 5. If 6 cups are red, how many cups are white?
- Skill: G9-NUM-RATIO-RATE
- Activity: A.G9.S4.RATIO-RATE
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A (correct): 15 cups
- B: 11 cups
- C: 30 cups
- D: 5 cups
- Worked solution: Red changes from 2 to 6, so multiply by 3. White is 5 × 3 = 15 cups.
- Hint: Find the scale factor first.
- Individually authored incorrect-answer feedback:
- Selected B — **11 cups**: 11 adds the two ratio parts rather than scaling the white part. Red changes from 2 to 6 by a factor of 3.
- Selected C — **30 cups**: 30 scales white by 6 instead of using the ratio scale factor. Since 2 becomes 6, multiply 5 by 3.
- Selected D — **5 cups**: 5 is the white part in the original ratio, before scaling. The red amount has tripled, so white must also triple.

### Q.G9.S4.PRACTICE.RATIO-RATE.04

- Prompt: A learner claims that 4 : 6 and 10 : 15 are not equivalent. Which explanation correctly evaluates the claim?
- Skill: G9-NUM-RATIO-RATE
- Activity: A.G9.S4.RATIO-RATE
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: The claim is incorrect because all ratios are equivalent
- B (correct): The claim is incorrect: 4 : 6 = 2 : 3 and 10 : 15 = 2 : 3
- C: The claim is correct because the numbers in each ratio are different
- D: The claim is correct because only ratios already in lowest terms can be equivalent
- Worked solution: Simplify each ratio by its own common factor: 4 : 6 ÷ 2 = 2 : 3 and 10 : 15 ÷ 5 = 2 : 3. Both describe the same multiplicative relationship, so the learner’s claim is incorrect.
- Hint: Simplify both ratios before deciding.
- Individually authored incorrect-answer feedback:
- Selected A — **The claim is incorrect because all ratios are equivalent**: The claim is incorrect here, but not all ratios are equivalent. Equivalence requires the same simplified ratio, which is 2 : 3.
- Selected C — **The claim is correct because the numbers in each ratio are different**: Different-looking numbers can name the same ratio. Simplify 4 : 6 and 10 : 15 before comparing their multiplicative relationship.
- Selected D — **The claim is correct because only ratios already in lowest terms can be equivalent**: A ratio need not already be simplified to be equivalent. Both ratios simplify to 2 : 3.


## Grade 9 — Direct and inverse proportion

- Skill: G9-NUM-DIRECT-INVERSE-PROPORTION
- Objective: By the end of this lesson, you should be able to decide whether a situation uses direct or inverse proportion.
- Explanation: In direct proportion, both quantities change in the same direction at a constant rate: more items cost more. In inverse proportion, one quantity increases while the other decreases so that their product stays fixed: more equally efficient workers take fewer days.
- Worked example: Four workers take 15 days.
Total work = 4 × 15 = 60 worker-days.
With 6 workers: 60 ÷ 6 = 10 days.
This is inverse proportion.
- Common misconception: “One goes up and one goes down” is not enough by itself. The total task or product must stay fixed for inverse proportion.

### Q.G9.S4.PRACTICE.PROPORTION.01

- Prompt: Five notebooks cost R40. What do eight cost at the same price?
- Skill: G9-NUM-DIRECT-INVERSE-PROPORTION
- Activity: A.G9.S4.PROPORTION
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: R320
- B: R13
- C (correct): R64
- D: R48
- Worked solution: One notebook costs R40 ÷ 5 = R8. Eight cost 8 × R8 = R64.
- Hint: Find the cost of one notebook.
- Individually authored incorrect-answer feedback:
- Selected A — **R320**: R320 multiplies the total R40 by 8 without first finding one notebook’s price. Use R40 ÷ 5, then multiply by 8.
- Selected B — **R13**: R13 is not the cost of eight notebooks at the constant rate. Find the R8 unit price, then scale it to eight.
- Selected D — **R48**: R48 uses R6 per notebook, but R40 shared by 5 notebooks is R8 each. Multiply the unit price by 8.

### Q.G9.S4.PRACTICE.PROPORTION.02

- Prompt: Eight taps fill a tank in 6 hours. How long would 12 identical taps take?
- Skill: G9-NUM-DIRECT-INVERSE-PROPORTION
- Activity: A.G9.S4.PROPORTION
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: 9 hours
- B: 18 hours
- C: 6 hours
- D (correct): 4 hours
- Worked solution: The work is 8 × 6 = 48 tap-hours. 48 ÷ 12 = 4 hours.
- Hint: For inverse proportion, multiply first then divide.
- Individually authored incorrect-answer feedback:
- Selected A — **9 hours**: 9 hours treats more taps as taking more time. With the same tank, more identical taps mean fewer hours.
- Selected B — **18 hours**: 18 hours multiplies both quantities as if the relationship were direct. Keep the tap-hour product 8 × 6 constant.
- Selected C — **6 hours**: 6 hours ignores the extra four taps. Divide the fixed 48 tap-hours by 12 taps.

### Q.G9.S4.PRACTICE.PROPORTION.03

- Prompt: Which situation is inverse proportion?
- Skill: G9-NUM-DIRECT-INVERSE-PROPORTION
- Activity: A.G9.S4.PROPORTION
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A (correct): For a fixed trip, higher speed means less travel time
- B: More loaves cost more at one price
- C: More litres give a higher water bill
- D: More pages mean more printing
- Worked solution: For the same distance, speed × time is fixed. Increasing speed decreases time.
- Hint: Look for a fixed total task or distance.
- Individually authored incorrect-answer feedback:
- Selected B — **More loaves cost more at one price**: More loaves costing more is direct proportion: both quantities increase together. Inverse proportion has a fixed product or task.
- Selected C — **More litres give a higher water bill**: A higher bill for more litres is direct proportion at a constant price. It does not show one quantity decreasing as the other increases.
- Selected D — **More pages mean more printing**: More pages requiring more printing is direct, not inverse. Look for a fixed trip or task where one quantity rises while the other falls.

### Q.G9.S4.PRACTICE.PROPORTION.04

- Prompt: A learner doubles workers and doubles days. What error was made?
- Skill: G9-NUM-DIRECT-INVERSE-PROPORTION
- Activity: A.G9.S4.PROPORTION
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: They should add workers and days
- B (correct): They treated an inverse relationship as direct
- C: They simplified the ratio too far
- D: They forgot a decimal point
- Worked solution: For the same job, doubling workers halves the time. The worker-day total stays constant.
- Hint: Test the answer: would more workers really take longer?
- Individually authored incorrect-answer feedback:
- Selected A — **They should add workers and days**: Adding workers and days does not model a fixed job. Multiply workers by days, then keep that product constant.
- Selected C — **They simplified the ratio too far**: The error is not about simplifying a ratio. For one fixed job, workers and days should change in opposite directions.
- Selected D — **They forgot a decimal point**: No decimal placement causes the problem. Doubling workers should halve days to keep total worker-days unchanged.


## Grade 9 — Commission, rental and compound interest

- Skill: G9-NUM-FINANCIAL-APPLICATIONS
- Objective: By the end of this lesson, you should be able to calculate common Grade 9 financial applications.
- Explanation: Commission is a percentage of sales. Rental questions can include a per-day amount, a non-refundable fee, and a refundable deposit; identify which amount is returned before finding the final cost. Compound interest grows the balance each period, so each new percentage is calculated on the previous balance.
- Worked example: R2 000 earns 10% compound interest for two years.
Year 1: R2 000 × 1.10 = R2 200.
Year 2: R2 200 × 1.10 = R2 420.
The balance is R2 420.
- Common misconception: Do not add the once-off rental fee once for every day, and do not use simple interest when the question says compound.

### Q.G9.S4.PRACTICE.FINANCE.01

- Prompt: What is 7% commission on R3 000?
- Skill: G9-NUM-FINANCIAL-APPLICATIONS
- Activity: A.G9.S4.FINANCE
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: R21
- B: R2 790
- C: R700
- D (correct): R210
- Worked solution: 7% = 0.07. R3 000 × 0.07 = R210.
- Hint: Change the percent to a decimal.
- Individually authored incorrect-answer feedback:
- Selected A — **R21**: R21 treats 7% as 0.007 or uses the wrong place value. Convert 7% to 0.07 before multiplying R3 000.
- Selected B — **R2 790**: R2 790 is the amount left after subtracting commission, not the commission itself. Calculate 7% of R3 000.
- Selected C — **R700**: R700 treats 7% as 7/30 or a much larger percentage. Use 7 ÷ 100 = 0.07, then multiply.

### Q.G9.S4.PRACTICE.FINANCE.02

- Prompt: A bike rents for R80 per day and requires a refundable R50 deposit paid at collection. What is paid upfront for 3 days, and what is the net rental cost after the deposit is returned?
- Skill: G9-NUM-FINANCIAL-APPLICATIONS
- Activity: A.G9.S4.FINANCE
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A (correct): R290 upfront; R240 net rental
- B: R390 upfront; R390 net rental
- C: R240 upfront; R240 net rental
- D: R290 upfront; R290 net rental
- Worked solution: The 3-day rental fee is 3 × R80 = R240. The R50 deposit is added once at collection, so R290 is paid upfront; because it is refundable, the net rental cost after return is R240.
- Hint: Separate the once-off refundable deposit from the rental fee.
- Individually authored incorrect-answer feedback:
- Selected B — **R390 upfront; R390 net rental**: R390 counts the R50 deposit three times and never returns it. Add the deposit once to R240, then remove it from net cost.
- Selected C — **R240 upfront; R240 net rental**: R240 is the rental fee only; the refundable R50 must still be paid upfront. Add it once at collection.
- Selected D — **R290 upfront; R290 net rental**: R290 is paid upfront, but the R50 deposit is refundable. After it is returned, only the R240 rental fee remains.

### Q.G9.S4.PRACTICE.FINANCE.03

- Prompt: R1 500 grows by 8% compound interest for two years. What is the balance?
- Skill: G9-NUM-FINANCIAL-APPLICATIONS
- Activity: A.G9.S4.FINANCE
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: R1 620.80
- B (correct): R1 749.60
- C: R1 620.00
- D: R1 740.00
- Worked solution: Year 1: 1500 × 1.08 = 1620. Year 2: 1620 × 1.08 = 1749.60.
- Hint: Apply 8% to the new balance in year 2.
- Individually authored incorrect-answer feedback:
- Selected A — **R1 620.80**: R1 620.80 applies an incorrect small second increase. Calculate 8% of R1 620, then add it to that balance.
- Selected C — **R1 620.00**: R1 620.00 is the balance after only one 8% increase. Compound interest applies the second 8% to R1 620.
- Selected D — **R1 740.00**: R1 740.00 adds two simple 8% increases to the original amount. Compound interest uses the increased balance in year two.

### Q.G9.S4.PRACTICE.FINANCE.04

- Prompt: Why is compound interest greater than simple interest after two positive years?
- Skill: G9-NUM-FINANCIAL-APPLICATIONS
- Activity: A.G9.S4.FINANCE
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: The original balance is ignored
- B: Interest is subtracted first
- C (correct): Second-year interest is earned on the increased balance
- D: The percentage doubles automatically
- Worked solution: Compound interest adds year-one interest to the balance before calculating year two.
- Hint: Compare the base used in the second year.
- Individually authored incorrect-answer feedback:
- Selected A — **The original balance is ignored**: The original balance remains part of the accumulated balance. What changes is that first-year interest also earns interest.
- Selected B — **Interest is subtracted first**: Interest is added to grow the balance, not subtracted. The second calculation uses the balance after year-one interest.
- Selected D — **The percentage doubles automatically**: The percentage stays the same; its base changes. In year two, the same rate is applied to the larger balance.


## Grade 9 — Integer operations and order

- Skill: G9-NUM-INTEGERS-OPERATIONS
- Objective: By the end of this lesson, you should be able to calculate with signed integers using the correct order of operations.
- Explanation: For addition and subtraction, use a number line or rewrite subtraction as adding the opposite. For multiplication and division, same signs give a positive answer and different signs give a negative answer. Evaluate brackets before powers, multiplication or division, then addition or subtraction.
- Worked example: Calculate −6 − (−9).
Subtracting a negative is adding its opposite.
−6 − (−9) = −6 + 9 = 3.
- Common misconception: A negative sign is not a signal that the answer must be negative. Two negative factors make a positive product.

### Q.G9.S4.PRACTICE.INTEGER-OPS.01

- Prompt: Calculate −8 + 13.
- Skill: G9-NUM-INTEGERS-OPERATIONS
- Activity: A.G9.S4.INTEGER-OPS
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: −21
- B: −5
- C: 21
- D (correct): 5
- Worked solution: Starting at −8 and adding 13 gives 5.
- Hint: A positive addend moves right.
- Individually authored incorrect-answer feedback:
- Selected A — **−21**: −21 combines the magnitudes as if both numbers were negative. Adding +13 moves 13 units right from −8.
- Selected B — **−5**: −5 subtracts 13 from 8 rather than adding a positive number. Compare magnitudes: 13 is five more than 8.
- Selected C — **21**: 21 adds magnitudes but ignores the negative starting value. Start at −8 and move right 13 to reach 5.

### Q.G9.S4.PRACTICE.INTEGER-OPS.02

- Prompt: Calculate (−7) × 6.
- Skill: G9-NUM-INTEGERS-OPERATIONS
- Activity: A.G9.S4.INTEGER-OPS
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A (correct): −42
- B: 42
- C: −13
- D: 13
- Worked solution: The signs differ, so the product is negative. 7 × 6 = 42.
- Hint: Check whether the signs match.
- Individually authored incorrect-answer feedback:
- Selected B — **42**: 42 has the right magnitude but misses the sign rule. A negative factor times a positive factor gives a negative product.
- Selected C — **−13**: −13 adds −7 and 6 instead of multiplying. First multiply the magnitudes, then apply the different-sign rule.
- Selected D — **13**: 13 adds the magnitudes and ignores multiplication. Calculate 7 × 6, then use the negative sign from unlike factors.

### Q.G9.S4.PRACTICE.INTEGER-OPS.03

- Prompt: Calculate 18 ÷ [3 + (−6)].
- Skill: G9-NUM-INTEGERS-OPERATIONS
- Activity: A.G9.S4.INTEGER-OPS
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: −3
- B (correct): −6
- C: 6
- D: 0
- Worked solution: Evaluate the bracket: 3 + (−6) = −3. Then 18 ÷ −3 = −6.
- Hint: Brackets are calculated first.
- Individually authored incorrect-answer feedback:
- Selected A — **−3**: −3 is the bracket value, not the completed division. After finding −3, divide 18 by it.
- Selected C — **6**: 6 uses the magnitude of the divisor but ignores its negative sign. Evaluate the bracket first: 3 + (−6) is −3.
- Selected D — **0**: 0 may come from adding 3 and −6 incorrectly. The bracket is −3, and 18 divided by −3 is not zero.

### Q.G9.S4.PRACTICE.INTEGER-OPS.04

- Prompt: Why is −4 − 7 equal to −11?
- Skill: G9-NUM-INTEGERS-OPERATIONS
- Activity: A.G9.S4.INTEGER-OPS
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: Only 7 is negative
- B: All subtraction answers are negative
- C (correct): Subtracting 7 moves 7 units left from −4
- D: The signs cancel
- Worked solution: On a number line start at −4 and move seven units left, reaching −11.
- Hint: Think about direction on a number line.
- Individually authored incorrect-answer feedback:
- Selected A — **Only 7 is negative**: 7 is positive in −4 − 7; the subtraction operation changes the movement direction. Use a number line to move left.
- Selected B — **All subtraction answers are negative**: Subtraction can give positive, zero, or negative results. Here it is negative because starting at −4 and moving left gives −11.
- Selected D — **The signs cancel**: Signs do not cancel in subtraction this way. Subtracting positive 7 means moving left seven units from −4.


## Grade 9 — Squares, cubes and roots

- Skill: G9-NUM-INTEGERS-POWERS-ROOTS
- Objective: By the end of this lesson, you should be able to evaluate integer powers and roots.
- Explanation: A square multiplies a number by itself; a cube uses three factors. Brackets decide whether a negative sign belongs to the base. √ gives the principal non-negative square root, while cube roots can be negative.
- Worked example: Evaluate (−4)².
The brackets make −4 the base.
(−4)² = (−4) × (−4) = 16.
- Common misconception: Without brackets, −4² means −(4²) = −16. The brackets matter.

### Q.G9.S4.PRACTICE.POWERS-ROOTS.01

- Prompt: What is (−5)²?
- Skill: G9-NUM-INTEGERS-POWERS-ROOTS
- Activity: A.G9.S4.POWERS-ROOTS
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A (correct): 25
- B: −25
- C: −10
- D: 10
- Worked solution: (−5)² = (−5) × (−5) = 25.
- Hint: Square the whole bracketed number.
- Individually authored incorrect-answer feedback:
- Selected B — **−25**: −25 keeps a negative sign after squaring. The whole negative number is squared, and two negative factors multiply to a positive.
- Selected C — **−10**: −10 doubles −5 instead of squaring it. Squaring means multiplying the base by itself: (−5) × (−5).
- Selected D — **10**: 10 doubles the magnitude rather than squaring. Expand (−5)² as (−5) × (−5) to get a positive product.

### Q.G9.S4.PRACTICE.POWERS-ROOTS.02

- Prompt: What is ∛(−216)?
- Skill: G9-NUM-INTEGERS-POWERS-ROOTS
- Activity: A.G9.S4.POWERS-ROOTS
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: 36
- B (correct): −6
- C: 6
- D: −36
- Worked solution: (−6) × (−6) × (−6) = −216.
- Hint: Which negative number cubed gives −216?
- Individually authored incorrect-answer feedback:
- Selected A — **36**: 36 confuses a square-related value with a cube root. Test −6 × −6 × −6 instead.
- Selected C — **6**: 6 cubed is positive 216, not −216. A cube root of a negative number must be negative.
- Selected D — **−36**: −36 is not a cube root; cubing it would be far from −216. Find the number that multiplied by itself three times gives −216.

### Q.G9.S4.PRACTICE.POWERS-ROOTS.03

- Prompt: Evaluate −3².
- Skill: G9-NUM-INTEGERS-POWERS-ROOTS
- Activity: A.G9.S4.POWERS-ROOTS
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: −6
- B: 6
- C (correct): −9
- D: 9
- Worked solution: The exponent applies to 3 first: −3² = −(3²) = −9.
- Hint: There are no brackets around −3.
- Individually authored incorrect-answer feedback:
- Selected A — **−6**: −6 doubles −3 instead of applying the exponent. Calculate 3² first, then apply the outside negative sign.
- Selected B — **6**: 6 changes the expression into doubling and also loses the leading negative. Without brackets, −3² means −(3 × 3).
- Selected D — **9**: 9 treats −3 as the bracketed base, but there are no brackets. The exponent applies to 3, then the leading negative remains.

### Q.G9.S4.PRACTICE.POWERS-ROOTS.04

- Prompt: Why is √64 not ±8?
- Skill: G9-NUM-INTEGERS-POWERS-ROOTS
- Activity: A.G9.S4.POWERS-ROOTS
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: Square roots have no value
- B: Both signs are always written
- C: 64 has only one square root equation
- D (correct): √ means the principal non-negative root
- Worked solution: The equation x² = 64 has ±8 solutions, but the symbol √64 is defined as the principal root 8.
- Hint: Separate a root symbol from solving an equation.
- Individually authored incorrect-answer feedback:
- Selected A — **Square roots have no value**: √64 does have a value: 8 × 8 = 64. The root symbol is defined to select the principal non-negative root.
- Selected B — **Both signs are always written**: ± is used when solving x² = 64, not when evaluating √64. The radical symbol alone means the non-negative root.
- Selected C — **64 has only one square root equation**: The equation x² = 64 has two solutions, 8 and −8. The notation √64 still names just the principal value 8.


## Grade 9 — Exponent laws

- Skill: G9-EXP-LAWS-EXTENDED
- Objective: By the end of this lesson, you should be able to use product, quotient and power laws for exponents.
- Explanation: For the same non-zero base: multiply means add exponents, divide means subtract exponents, and a power of a power means multiply exponents. A quotient law needs a non-zero divisor, for example y⁹ ÷ y⁴ requires y ≠ 0. The base does not change just because the exponent changes.
- Worked example: Simplify (x³)⁴.
A power of a power multiplies exponents.
(x³)⁴ = x^(3 × 4) = x¹².
- Common misconception: Do not use the product law for addition: x² + x³ cannot be simplified by adding exponents.

### Q.G9.S4.PRACTICE.EXP-LAWS.01

- Prompt: Simplify a⁴ × a³.
- Skill: G9-EXP-LAWS-EXTENDED
- Activity: A.G9.S4.EXP-LAWS
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A (correct): a⁷
- B: a¹²
- C: a¹
- D: 7a
- Worked solution: The bases match, so add exponents: 4 + 3 = 7.
- Hint: The base remains a.
- Individually authored incorrect-answer feedback:
- Selected B — **a¹²**: a¹² multiplies the exponents, which is for a power of a power. With a⁴ × a³, count factors and add exponents.
- Selected C — **a¹**: a¹ subtracts exponents as if dividing. Multiplication of the same base requires 4 + 3.
- Selected D — **7a**: 7a treats exponents as ordinary coefficients. The base stays a and the total number of factors is a⁷.

### Q.G9.S4.PRACTICE.EXP-LAWS.02

- Prompt: For y ≠ 0, simplify y⁹ ÷ y⁴.
- Skill: G9-EXP-LAWS-EXTENDED
- Activity: A.G9.S4.EXP-LAWS
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: 1/y⁵
- B (correct): y⁵
- C: y¹³
- D: y³⁶
- Worked solution: Because y ≠ 0, the quotient is defined. For division with the same base, subtract: 9 − 4 = 5.
- Hint: Use the quotient law only after checking the divisor is non-zero.
- Individually authored incorrect-answer feedback:
- Selected A — **1/y⁵**: 1/y⁵ would be y⁻⁵, not y⁹ ÷ y⁴. Cancel the four denominator factors from the nine numerator factors.
- Selected C — **y¹³**: y¹³ adds exponents as in multiplication. Division of equal non-zero bases cancels four factors, leaving 9 − 4.
- Selected D — **y³⁶**: y³⁶ multiplies exponents, which is for a power of a power. Here divide y⁹ by y⁴ and subtract exponents.

### Q.G9.S4.PRACTICE.EXP-LAWS.03

- Prompt: Simplify (m²n³)².
- Skill: G9-EXP-LAWS-EXTENDED
- Activity: A.G9.S4.EXP-LAWS
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: m⁴n⁹
- B: m²n⁶
- C (correct): m⁴n⁶
- D: m⁴n⁵
- Worked solution: Apply the outer power to each factor: m^(2×2)n^(3×2).
- Hint: Every exponent inside the bracket is multiplied.
- Individually authored incorrect-answer feedback:
- Selected A — **m⁴n⁹**: n⁹ adds exponents instead of multiplying for a power of a power. Square n³ by using 3 × 2.
- Selected B — **m²n⁶**: n⁶ is correct, but m² must also be squared. Multiply both inner exponents by the outer 2.
- Selected D — **m⁴n⁵**: m⁴ is correct, but n³ squared multiplies 3 by 2, giving n⁶. Apply the outside power to every factor.

### Q.G9.S4.PRACTICE.EXP-LAWS.04

- Prompt: A learner writes x² + x³ = x⁵. What is correct?
- Skill: G9-EXP-LAWS-EXTENDED
- Activity: A.G9.S4.EXP-LAWS
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: The answer is always x⁵
- B: Add the bases instead
- C: Subtract the exponents
- D (correct): The product law applies to multiplication, not addition
- Worked solution: x² and x³ are unlike terms, so they do not combine through an exponent law.
- Hint: Look at the operation between the terms.
- Individually authored incorrect-answer feedback:
- Selected A — **The answer is always x⁵**: x⁵ would follow from multiplying x² and x³, but the operation here is addition. Exponent laws do not combine unlike addends.
- Selected B — **Add the bases instead**: The bases are both x, so adding bases does not simplify x² + x³. The terms have different exponents and remain separate.
- Selected C — **Subtract the exponents**: Subtracting exponents is a division rule, not an addition rule. Keep x² + x³ as written.


## Grade 9 — Zero and negative exponents

- Skill: G9-EXP-NEGATIVE-SCI
- Objective: By the end of this lesson, you should be able to interpret zero and negative exponents.
- Explanation: For any non-zero base a, a⁰ = 1. A negative exponent makes a reciprocal: a⁻ⁿ = 1/aⁿ. These follow from the quotient law, for example a³ ÷ a³ = a⁰ = 1.
- Worked example: Find 2⁻³.
2⁻³ = 1/2³.
2³ = 8.
Therefore 2⁻³ = 1/8.
- Common misconception: A negative exponent does not make the answer negative. It tells you to use a reciprocal.

### Q.G9.S4.PRACTICE.EXP-ZERO-NEGATIVE.01

- Prompt: What is 9⁰?
- Skill: G9-EXP-NEGATIVE-SCI
- Activity: A.G9.S4.EXP-ZERO-NEGATIVE
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: Undefined
- B (correct): 1
- C: 0
- D: 9
- Worked solution: Any non-zero number to exponent zero equals 1.
- Hint: The base is non-zero.
- Individually authored incorrect-answer feedback:
- Selected A — **Undefined**: 9⁰ is defined because the base is non-zero. The undefined case to avoid is 0⁰, not 9⁰.
- Selected C — **0**: 0 confuses a zero exponent with a zero base. For non-zero 9, the zero-exponent rule gives 9⁰ = 1.
- Selected D — **9**: 9 keeps the base but ignores the exponent. A non-zero base raised to zero equals 1.

### Q.G9.S4.PRACTICE.EXP-ZERO-NEGATIVE.02

- Prompt: What is 10⁻²?
- Skill: G9-EXP-NEGATIVE-SCI
- Activity: A.G9.S4.EXP-ZERO-NEGATIVE
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: 100
- B: −0.01
- C (correct): 0.01
- D: −100
- Worked solution: 10⁻² = 1/10² = 1/100 = 0.01.
- Hint: Write the reciprocal first.
- Individually authored incorrect-answer feedback:
- Selected A — **100**: 100 ignores the negative exponent. A negative exponent means reciprocal, so use 1 divided by 100.
- Selected B — **−0.01**: −0.01 adds a negative sign that is not in the base. The negative exponent changes position, not the sign.
- Selected D — **−100**: −100 treats the negative exponent as a negative answer and reverses the reciprocal. First write 10⁻² as 1/10².

### Q.G9.S4.PRACTICE.EXP-ZERO-NEGATIVE.03

- Prompt: Which expression equals 1/p⁵?
- Skill: G9-EXP-NEGATIVE-SCI
- Activity: A.G9.S4.EXP-ZERO-NEGATIVE
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: −p⁵
- B: p⁵
- C: 1/5p
- D (correct): p⁻⁵
- Worked solution: By definition, p⁻⁵ = 1/p⁵ for p ≠ 0.
- Hint: The negative belongs to the exponent.
- Individually authored incorrect-answer feedback:
- Selected A — **−p⁵**: −p⁵ changes the sign of the expression, but it is not a reciprocal. A negative exponent means 1 divided by p⁵.
- Selected B — **p⁵**: p⁵ has the reciprocal backwards. Move p⁵ to the denominator by giving it exponent −5.
- Selected C — **1/5p**: 1/5p divides by 5 and then multiplies by p; it is not 1 divided by p⁵. Keep p as the base with exponent −5.

### Q.G9.S4.PRACTICE.EXP-ZERO-NEGATIVE.04

- Prompt: Why is 0⁰ not used in the zero-exponent rule?
- Skill: G9-EXP-NEGATIVE-SCI
- Activity: A.G9.S4.EXP-ZERO-NEGATIVE
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A (correct): The quotient-law argument would divide 0 by 0
- B: Zero has no powers
- C: It must equal 1
- D: It must equal 0
- Worked solution: The rule a⁰ comes from a¹ ÷ a¹, which needs a non-zero base.
- Hint: What happens if the denominator is zero?
- Individually authored incorrect-answer feedback:
- Selected B — **Zero has no powers**: Zero can be raised to positive powers, such as 0² = 0. The issue is specifically the undefined form 0⁰.
- Selected C — **It must equal 1**: The non-zero rule a⁰ = 1 cannot be applied with a = 0. Its quotient-law argument would require division by zero.
- Selected D — **It must equal 0**: 0⁰ is not set to 0 by the zero-base pattern. The usual zero-exponent proof fails because it would divide 0 by 0.


## Grade 9 — Scientific notation extension

- Skill: G9-EXP-SCI-NOTATION-EXTENSION
- Objective: By the end of this optional extension, you should be able to write large and small numbers in scientific notation.
- Explanation: For a positive number, scientific notation writes a number as a × 10ⁿ where 1 ≤ a < 10. For any nonzero real number in standard scientific notation, the coefficient satisfies 1 ≤ |a| < 10, so negative numbers may have a negative coefficient. Moving the decimal left gives a positive exponent; moving it right gives a negative exponent. This optional extension supports number sense but is not a required Term 1 mastery prerequisite.
- Worked example: Write −4 500 000 in scientific notation.
Keep the sign and move the decimal six places left: −4.5.
Because |−4.5| is between 1 and 10, −4 500 000 = −4.5 × 10⁶ is standard scientific notation.
- Common misconception: For a nonzero number, the absolute value of the coefficient must be at least 1 but less than 10; 45 × 10⁵ is not standard scientific notation.

### Q.G9.S4.PRACTICE.SCI-NOTATION.01

- Prompt: Write 72 000 in scientific notation.
- Skill: G9-EXP-SCI-NOTATION-EXTENSION
- Activity: A.G9.S4.SCI-NOTATION
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A (correct): 7.2 × 10⁴
- B: 72 × 10³
- C: 7.2 × 10³
- D: 0.72 × 10⁵
- Worked solution: Move the decimal four places left: 72 000 = 7.2 × 10⁴.
- Hint: Make the first number between 1 and 10.
- Individually authored incorrect-answer feedback:
- Selected B — **72 × 10³**: 72 × 10³ has the right value but 72 is not between 1 and 10. Shift the decimal once more and increase the exponent.
- Selected C — **7.2 × 10³**: 7.2 is correctly sized, but 10³ moves the decimal only three places to 7 200. Count four places for 72 000.
- Selected D — **0.72 × 10⁵**: 0.72 × 10⁵ has the right value but the coefficient is below 1. Standard notation needs 1 ≤ |a| < 10.

### Q.G9.S4.PRACTICE.SCI-NOTATION.02

- Prompt: What is 3.6 × 10³ in ordinary notation?
- Skill: G9-EXP-SCI-NOTATION-EXTENSION
- Activity: A.G9.S4.SCI-NOTATION
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: 0.0036
- B (correct): 3 600
- C: 360
- D: 36 000
- Worked solution: 10³ = 1000, so 3.6 × 1000 = 3600.
- Hint: A positive exponent makes a larger number.
- Individually authored incorrect-answer feedback:
- Selected A — **0.0036**: 0.0036 treats the positive exponent as a negative one. A positive power of 10 makes the number larger.
- Selected C — **360**: 360 moves the decimal only two places. The exponent 3 means multiply 3.6 by 1 000.
- Selected D — **36 000**: 36 000 shifts the decimal four places, not three. Starting at 3.6, move it three places right.

### Q.G9.S4.PRACTICE.SCI-NOTATION.03

- Prompt: Write −0.0042 in standard scientific notation.
- Skill: G9-EXP-SCI-NOTATION-EXTENSION
- Activity: A.G9.S4.SCI-NOTATION
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: −4.2 × 10³
- B: −0.42 × 10⁻²
- C (correct): −4.2 × 10⁻³
- D: 4.2 × 10⁻³
- Worked solution: Keep the negative sign. Move the decimal three places right to get −4.2, so use exponent −3; |−4.2| is between 1 and 10.
- Hint: Small decimals need negative powers of ten; keep the original sign.
- Individually authored incorrect-answer feedback:
- Selected A — **−4.2 × 10³**: −4.2 × 10³ is −4 200, much larger than −0.0042. Moving the decimal right for a small number needs a negative exponent.
- Selected B — **−0.42 × 10⁻²**: −0.42 × 10⁻² equals −0.0042, but −0.42 is not a standard coefficient. Shift it to −4.2 and adjust the exponent.
- Selected D — **4.2 × 10⁻³**: 4.2 × 10⁻³ has the right magnitude but loses the original negative sign. Keep the sign in the coefficient.

### Q.G9.S4.PRACTICE.SCI-NOTATION.04

- Prompt: Why is 45 × 10⁵ not standard scientific notation?
- Skill: G9-EXP-SCI-NOTATION-EXTENSION
- Activity: A.G9.S4.SCI-NOTATION
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: The exponent must be negative
- B: Scientific notation cannot use 10⁵
- C: 45 is too small
- D (correct): |45| is not less than 10
- Worked solution: For any nonzero number in standard form, 1 ≤ |a| < 10. Here |45| is too large; rewrite it as 4.5 × 10⁶.
- Hint: Check the absolute value of the coefficient.
- Individually authored incorrect-answer feedback:
- Selected A — **The exponent must be negative**: Positive exponents are valid for large numbers. The issue is the coefficient 45, whose absolute value is not less than 10.
- Selected B — **Scientific notation cannot use 10⁵**: 10⁵ is allowed in scientific notation. Standard form restricts the coefficient, not whether a positive exponent is used.
- Selected C — **45 is too small**: 45 is too large for the coefficient range 1 ≤ |a| < 10. Rewrite it as 4.5 × 10⁶ instead.


## Grade 9 — Numeric patterns and differences

- Skill: G9-PAT-NUMERIC-STRUCTURE
- Objective: By the end of this lesson, you should be able to identify a constant first difference and extend a linear pattern.
- Explanation: A linear number pattern has the same change between consecutive terms. This constant first difference is the coefficient of n in its nth-term rule. Use a table to record term number n and value Tn.
- Worked example: Extend 5, 9, 13, …
First differences: +4, +4.
Add 4 again: 17, then 21.
The pattern has constant first difference 4.
- Common misconception: Do not use a constant ratio test for a pattern with a constant difference. Ratios are useful for geometric sequences, not these linear patterns.

### Q.G9.S4.PRACTICE.PATTERN-STRUCTURE.01

- Prompt: What is the first difference of 11, 16, 21, 26, …?
- Skill: G9-PAT-NUMERIC-STRUCTURE
- Activity: A.G9.S4.PATTERN-STRUCTURE
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: −5
- B (correct): 5
- C: 11
- D: 10
- Worked solution: 16 − 11 = 5, and the same change continues.
- Hint: Subtract consecutive terms.
- Individually authored incorrect-answer feedback:
- Selected A — **−5**: −5 reverses the subtraction order. The pattern increases, so use later term minus earlier term to get +5.
- Selected C — **11**: 11 is the first term, not the difference. Subtract consecutive terms: 16 − 11 and 21 − 16.
- Selected D — **10**: 10 does not match the increase from 11 to 16. Calculate the difference by subtraction, not by combining non-adjacent terms.

### Q.G9.S4.PRACTICE.PATTERN-STRUCTURE.02

- Prompt: Extend 4, 10, 16, … by two terms.
- Skill: G9-PAT-NUMERIC-STRUCTURE
- Activity: A.G9.S4.PATTERN-STRUCTURE
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: 26, 36
- B: 18, 20
- C (correct): 22, 28
- D: 20, 24
- Worked solution: The first difference is 6, so add 6 twice.
- Hint: Find the constant change.
- Individually authored incorrect-answer feedback:
- Selected A — **26, 36**: 26, 36 changes the step size after the first new term. Add 6 each time to preserve the linear pattern.
- Selected B — **18, 20**: 18, 20 does not continue the +6 difference. Compare 10 − 4 and 16 − 10 before extending.
- Selected D — **20, 24**: 20, 24 uses an increase of 4, but the given terms increase by 6. Continue the same first difference.

### Q.G9.S4.PRACTICE.PATTERN-STRUCTURE.03

- Prompt: Which statement shows a linear pattern?
- Skill: G9-PAT-NUMERIC-STRUCTURE
- Activity: A.G9.S4.PATTERN-STRUCTURE
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: Its terms are all even
- B: Its ratio is constant
- C: It starts at zero
- D (correct): Its first differences are constant
- Worked solution: Constant first differences identify a linear pattern.
- Hint: Compare changes, not just values.
- Individually authored incorrect-answer feedback:
- Selected A — **Its terms are all even**: Even terms alone do not ensure a linear pattern; their differences could change. A linear sequence has a constant first difference.
- Selected B — **Its ratio is constant**: A constant ratio identifies a geometric pattern, not generally a linear one. Check successive differences instead.
- Selected C — **It starts at zero**: A linear pattern can start at any value. What matters is that the increase or decrease stays constant.

### Q.G9.S4.PRACTICE.PATTERN-STRUCTURE.04

- Prompt: A table has T1 = 7, T2 = 12, T3 = 17. What is T8?
- Skill: G9-PAT-NUMERIC-STRUCTURE
- Activity: A.G9.S4.PATTERN-STRUCTURE
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A (correct): 42
- B: 37
- C: 47
- D: 52
- Worked solution: The difference is 5. From T1 to T8 there are seven increases: 7 + 7×5 = 42.
- Hint: Count the jumps between term 1 and term 8.
- Individually authored incorrect-answer feedback:
- Selected B — **37**: 37 adds the difference six times from 7, but reaching T8 requires seven increases. Count the jumps from term 1 to term 8.
- Selected C — **47**: 47 uses too many increases or the wrong starting point. Use T8 = 7 + 5(8 − 1).
- Selected D — **52**: 52 adds 5 nine times rather than seven. From T1 to T8 there are exactly seven equal steps.


## Grade 9 — Linear nth-term rules

- Skill: G9-PAT-GENERAL-RULE
- Objective: By the end of this lesson, you should be able to find and test a linear nth-term rule.
- Explanation: For a linear pattern, start with Tn = dn + c, where d is the first difference. Substitute n = 1 and the first term to find c. Then test the rule with another term; a rule is only useful if it matches the pattern.
- Worked example: Find the rule for 6, 10, 14, …
Difference d = 4, so Tn = 4n + c.
At n = 1: 4 + c = 6, so c = 2.
Rule: Tn = 4n + 2. Check T2 = 10.
- Common misconception: Using the first term as c is a common error. Remember that n starts at 1, so substitute it to find c.

### Q.G9.S4.PRACTICE.NTH-TERM.01

- Prompt: Find the nth term of 3, 7, 11, …
- Skill: G9-PAT-GENERAL-RULE
- Activity: A.G9.S4.NTH-TERM
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A (correct): 4n − 1
- B: 4n + 3
- C: 3n + 1
- D: n + 3
- Worked solution: Difference is 4. At n=1, 4+c=3, so c=−1.
- Hint: Use the first term to solve for c.
- Individually authored incorrect-answer feedback:
- Selected B — **4n + 3**: 4n + 3 gives 7 when n = 1, not the first term 3. Keep the difference 4, then choose a constant that fits n = 1.
- Selected C — **3n + 1**: 3n + 1 gives the wrong constant difference of 3. The sequence rises by 4 each time.
- Selected D — **n + 3**: n + 3 increases by only 1 per term. The coefficient of n must match the first difference, 4.

### Q.G9.S4.PRACTICE.NTH-TERM.02

- Prompt: For Tn = 5n + 2, find T6.
- Skill: G9-PAT-GENERAL-RULE
- Activity: A.G9.S4.NTH-TERM
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: 13
- B (correct): 32
- C: 30
- D: 37
- Worked solution: Substitute n=6: 5(6)+2=32.
- Hint: Put 6 in place of n.
- Individually authored incorrect-answer feedback:
- Selected A — **13**: 13 appears to substitute the wrong n-value. The question asks for T6, so use n = 6.
- Selected C — **30**: 30 uses 5 × 6 but omits the +2 in the rule. Substitute both parts of Tn = 5n + 2.
- Selected D — **37**: 37 adds 2 to the wrong multiple of 5. Calculate 5 × 6 first, then add 2 once.

### Q.G9.S4.PRACTICE.NTH-TERM.03

- Prompt: Why should you test an nth-term rule using n = 2?
- Skill: G9-PAT-GENERAL-RULE
- Activity: A.G9.S4.NTH-TERM
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: It makes c equal zero
- B: It removes the need for n = 1
- C (correct): It checks that the rule fits more than one term
- D: It changes the first difference
- Worked solution: A second test catches a rule that only happens to fit the first term.
- Hint: A pattern rule must match the sequence, not one value.
- Individually authored incorrect-answer feedback:
- Selected A — **It makes c equal zero**: The constant c is set by fitting a term, not automatically made zero by testing n = 2. Testing provides another check.
- Selected B — **It removes the need for n = 1**: n = 1 is still useful to find the constant. n = 2 confirms the same rule works beyond one term.
- Selected D — **It changes the first difference**: Testing n = 2 does not change the pattern. It checks whether the proposed rule gives the actual second term.

### Q.G9.S4.PRACTICE.NTH-TERM.04

- Prompt: A learner gives Tn = 3n + 8 for 8, 11, 14, … . What is correct?
- Skill: G9-PAT-GENERAL-RULE
- Activity: A.G9.S4.NTH-TERM
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: It should be 8n + 3
- B: It should be 3n
- C: The learner rule is correct
- D (correct): It should be 3n + 5
- Worked solution: The difference is 3. At n=1, 3+c=8, so c=5.
- Hint: Test the learner rule at n=1.
- Individually authored incorrect-answer feedback:
- Selected A — **It should be 8n + 3**: 8n + 3 uses the first term as the difference, but the sequence increases by 3. Use coefficient 3 and fit the constant.
- Selected B — **It should be 3n**: 3n has the correct difference but gives 3 at n = 1, not 8. Add a constant so the first term fits.
- Selected C — **The learner rule is correct**: 3n + 8 gives 11 for n = 1, so it does not match the first term 8. Test a rule at n = 1.


## Grade 9 — Geometric matchstick and tile patterns

- Skill: G9-PAT-GEOMETRIC-VISUAL
- Objective: By the end of this lesson, you should be able to connect a growing diagram to a table and rule.
- Explanation: For a visual pattern, count the first few figures carefully and identify what each new figure adds. In a row of joined squares, the first square uses 4 matchsticks and each extra square shares a side, so it adds 3. The rule is M = 3n + 1.
- Worked example: How many matchsticks for 5 joined squares?
M = 3n + 1.
M = 3(5) + 1 = 16.
So 5 joined squares need 16 matchsticks.
- Common misconception: Counting 4n treats every square as separate and counts shared sides twice.

### Q.G9.S4.PRACTICE.VISUAL-PATTERNS.01

- Prompt: How many matchsticks are needed for 4 joined squares in a row?
- Skill: G9-PAT-GEOMETRIC-VISUAL
- Activity: A.G9.S4.VISUAL-PATTERNS
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: 12
- B: 16
- C: 10
- D (correct): 13
- Worked solution: M = 3n+1. For n=4, M=13.
- Hint: Each new square adds 3, not 4.
- Individually authored incorrect-answer feedback:
- Selected A — **12**: 12 uses 3 matchsticks per square but omits the first square’s extra side. A joined row follows 3n + 1.
- Selected B — **16**: 16 counts four sides for every square and double-counts shared sides. Each extra square adds only 3 matchsticks.
- Selected C — **10**: 10 treats the first square as if it also adds only 3 sides. Start with 4, then add 3 for each of the next squares.

### Q.G9.S4.PRACTICE.VISUAL-PATTERNS.02

- Prompt: Which rule fits a pattern beginning 5, 8, 11, …?
- Skill: G9-PAT-GEOMETRIC-VISUAL
- Activity: A.G9.S4.VISUAL-PATTERNS
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A (correct): 3n + 2
- B: 3n + 5
- C: 5n + 3
- D: n + 4
- Worked solution: Difference is 3. At n=1, 3+c=5, so c=2.
- Hint: Find the difference, then test n=1.
- Individually authored incorrect-answer feedback:
- Selected B — **3n + 5**: 3n + 5 has the right difference but gives 8 at n = 1, not 5. Test the rule using the first figure.
- Selected C — **5n + 3**: 5n + 3 uses a difference of 5, but the pattern increases by 3. The coefficient must match the first difference.
- Selected D — **n + 4**: n + 4 increases by only 1 each term. The sequence rises by 3, so its n coefficient must be 3.

### Q.G9.S4.PRACTICE.VISUAL-PATTERNS.03

- Prompt: Why does a joined-square row use 3n + 1 instead of 4n?
- Skill: G9-PAT-GEOMETRIC-VISUAL
- Activity: A.G9.S4.VISUAL-PATTERNS
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: Squares only need three sides
- B (correct): Each added square shares one side
- C: The first square has no sides
- D: n is always one
- Worked solution: The n−1 shared sides mean the total is 4n−(n−1)=3n+1.
- Hint: Look at what is shared between neighbours.
- Individually authored incorrect-answer feedback:
- Selected A — **Squares only need three sides**: A single square has four sides. In a joined row, a shared side is counted once rather than requiring only three sides per square.
- Selected C — **The first square has no sides**: The first square has four sides. The reduction comes because each later square shares one side with its neighbour.
- Selected D — **n is always one**: n counts the number of squares and changes from figure to figure. The +1 comes from the first unshared side, not from n being fixed.

### Q.G9.S4.PRACTICE.VISUAL-PATTERNS.04

- Prompt: A tile pattern has figure 1 = 6 and adds 4 tiles each figure. What is figure 7?
- Skill: G9-PAT-GEOMETRIC-VISUAL
- Activity: A.G9.S4.VISUAL-PATTERNS
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: 34
- B: 42
- C (correct): 30
- D: 28
- Worked solution: Tn=6+4(n−1). T7=6+4×6=30.
- Hint: There are six increases from figure 1 to figure 7.
- Individually authored incorrect-answer feedback:
- Selected A — **34**: 34 uses seven increases after figure 1 instead of six. Count the gaps between figure 1 and figure 7.
- Selected B — **42**: 42 multiplies 6 by 7 as if the total were scaled, but the pattern adds 4 tiles each new figure.
- Selected D — **28**: 28 makes only five increases of 4 from figure 1. Figure 7 is six steps after figure 1.


## Grade 8 — Grade 8 bridge: factors and order

- Skill: G8-NUM-WHOLE-PROPERTIES
- Objective: By the end of this bridge, you should be able to use factors and the order of operations before returning to Grade 9.
- Explanation: Factors divide exactly. In calculations, do brackets first, then multiplication or division, then addition or subtraction. This bridge helps with HCF, LCM and integer work.
- Worked example: Simplify 20 − 4 × 3.
Multiply first: 4 × 3 = 12.
Then 20 − 12 = 8.
- Common misconception: Working left to right through every symbol ignores the order of operations.

### Q.G8.S4.PRACTICE.G8-FACTORS.01

- Prompt: Simplify 18 ÷ 3 + 4.
- Skill: G8-NUM-WHOLE-PROPERTIES
- Activity: A.G8.S4.G8-FACTORS
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: 3
- B: 22
- C (correct): 10
- D: 2
- Worked solution: 18 ÷ 3 = 6, then 6 + 4 = 10.
- Hint: Divide before adding.
- Individually authored incorrect-answer feedback:
- Selected A — **3**: 3 may be the divisor, but it is not the full expression’s value. Follow order of operations before adding.
- Selected B — **22**: 22 adds 18 and 4 before dividing, which changes the expression. Division comes before addition here.
- Selected D — **2**: 2 subtracts or divides in the wrong order. Do the division 18 ÷ 3 first, then add 4.

### Q.G8.S4.PRACTICE.G8-FACTORS.02

- Prompt: Which is a factor of 36?
- Skill: G8-NUM-WHOLE-PROPERTIES
- Activity: A.G8.S4.G8-FACTORS
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: 8
- B: 10
- C: 14
- D (correct): 9
- Worked solution: 36 ÷ 9 = 4 with no remainder.
- Hint: A factor divides exactly.
- Individually authored incorrect-answer feedback:
- Selected A — **8**: 8 does not divide 36 exactly; 36 ÷ 8 leaves a remainder. A factor must divide with no remainder.
- Selected B — **10**: 10 is not a factor because 36 ÷ 10 is not whole. Test division to check a proposed factor.
- Selected C — **14**: 14 does not divide 36 exactly. Look for a number that makes a whole-number quotient, such as 9.

### Q.G8.S4.PRACTICE.G8-FACTORS.03

- Prompt: Simplify 5 + 3 × 4.
- Skill: G8-NUM-WHOLE-PROPERTIES
- Activity: A.G8.S4.G8-FACTORS
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A (correct): 17
- B: 32
- C: 20
- D: 12
- Worked solution: Multiply 3×4 first, then add 5.
- Hint: Multiplication comes before addition.
- Individually authored incorrect-answer feedback:
- Selected B — **32**: 32 adds 5 and 3 before multiplying by 4. Multiplication has priority, so calculate 3 × 4 first.
- Selected C — **20**: 20 multiplies 5 by 4 and ignores the 3. Follow the expression as written: only 3 is multiplied by 4.
- Selected D — **12**: 12 is the product 3 × 4, but the leading +5 still needs to be included.

### Q.G8.S4.PRACTICE.G8-FACTORS.04

- Prompt: Why is 6 a common factor of 18 and 30?
- Skill: G8-NUM-WHOLE-PROPERTIES
- Activity: A.G8.S4.G8-FACTORS
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: It is a multiple of neither
- B (correct): It divides both without a remainder
- C: It is their sum
- D: It is bigger than both
- Worked solution: 18 ÷ 6 = 3 and 30 ÷ 6 = 5, so 6 divides both numbers exactly.
- Hint: Test division for each number.
- Individually authored incorrect-answer feedback:
- Selected A — **It is a multiple of neither**: Whether 6 is a multiple is not the definition of a common factor. Check 18 ÷ 6 and 30 ÷ 6.
- Selected C — **It is their sum**: 6 is not the sum of 18 and 30. It is common because both numbers can be divided by 6 with no remainder.
- Selected D — **It is bigger than both**: 6 is smaller than both numbers, and size alone does not make a factor. Test whether it divides each exactly.


## Grade 8 — Grade 8 bridge: fractions

- Skill: G8-NUM-FRACTIONS-OPERATIONS
- Objective: By the end of this bridge, you should be able to add and compare simple fractions.
- Explanation: Fractions must have a common denominator before adding or subtracting. Equivalent fractions name the same amount and are made by multiplying numerator and denominator by the same number.
- Worked example: Calculate 1/3 + 1/6.
The common denominator is 6.
1/3 = 2/6.
2/6 + 1/6 = 3/6 = 1/2.
- Common misconception: Do not add denominators: 1/3 + 1/6 is not 2/9.

### Q.G8.S4.PRACTICE.G8-FRACTIONS.01

- Prompt: Calculate 1/4 + 2/4.
- Skill: G8-NUM-FRACTIONS-OPERATIONS
- Activity: A.G8.S4.G8-FRACTIONS
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A (correct): 3/4
- B: 3/8
- C: 2/8
- D: 1/2
- Worked solution: The denominators match, so add the numerators.
- Hint: Keep the denominator 4.
- Individually authored incorrect-answer feedback:
- Selected B — **3/8**: 3/8 adds the denominators, which is not allowed when they already match. Keep denominator 4 and add the numerators.
- Selected C — **2/8**: 2/8 changes both the numerator total and the common denominator. With fourths, 1 fourth plus 2 fourths is 3 fourths.
- Selected D — **1/2**: 1/2 is equivalent to 2/4, not 3/4. Add the numerators first, then simplify only if possible.

### Q.G8.S4.PRACTICE.G8-FRACTIONS.02

- Prompt: Write 3/5 with denominator 20.
- Skill: G8-NUM-FRACTIONS-OPERATIONS
- Activity: A.G8.S4.G8-FRACTIONS
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: 8/20
- B (correct): 12/20
- C: 3/20
- D: 15/20
- Worked solution: Multiply numerator and denominator by 4.
- Hint: What makes 5 into 20?
- Individually authored incorrect-answer feedback:
- Selected A — **8/20**: 8/20 does not keep the fraction’s value because 3 was not multiplied by 4. Make 5 into 20, then do the same to 3.
- Selected C — **3/20**: 3/20 changes only the denominator, so it is not equivalent to 3/5. Multiply numerator and denominator by 4.
- Selected D — **15/20**: 15/20 multiplies the numerator by 5 while the denominator is multiplied by 4. Use the same factor on both parts.

### Q.G8.S4.PRACTICE.G8-FRACTIONS.03

- Prompt: Calculate 2/3 − 1/6.
- Skill: G8-NUM-FRACTIONS-OPERATIONS
- Activity: A.G8.S4.G8-FRACTIONS
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: 1/3
- B: 1/18
- C (correct): 1/2
- D: 1/6
- Worked solution: 2/3=4/6. 4/6−1/6=3/6=1/2.
- Hint: Use denominator 6.
- Individually authored incorrect-answer feedback:
- Selected A — **1/3**: 1/3 may come from using a denominator of 3, but 1/6 must be converted to a common denominator before subtraction.
- Selected B — **1/18**: 1/18 multiplies denominators, which is not the method for subtracting fractions. Use the common denominator 6.
- Selected D — **1/6**: 1/6 subtracts numerators without first changing 2/3 to sixths. Rewrite 2/3 as 4/6.

### Q.G8.S4.PRACTICE.G8-FRACTIONS.04

- Prompt: Why is 2/4 equal to 1/2?
- Skill: G8-NUM-FRACTIONS-OPERATIONS
- Activity: A.G8.S4.G8-FRACTIONS
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: The denominators are added
- B: The numerator is smaller than the denominator
- C: Fractions cannot be simplified
- D (correct): Dividing both numerator and denominator by 2 gives 1/2
- Worked solution: Divide numerator and denominator of 2/4 by the same non-zero number: 2÷2 / 4÷2 = 1/2.
- Hint: Simplify both parts by the same factor.
- Individually authored incorrect-answer feedback:
- Selected A — **The denominators are added**: Adding denominators does not show equivalent fractions. Divide both numerator and denominator of 2/4 by the same number.
- Selected B — **The numerator is smaller than the denominator**: Many proper fractions have a smaller numerator, but that does not prove they equal 1/2. Simplify 2/4 using a common factor.
- Selected C — **Fractions cannot be simplified**: Fractions can be simplified when numerator and denominator share a factor. Divide both 2 and 4 by 2.


## Grade 8 — Grade 8 bridge: decimal operations

- Skill: G8-NUM-DECIMALS-OPERATIONS
- Objective: By the end of this bridge, you should be able to calculate accurately with decimals.
- Explanation: Line up decimal points when adding or subtracting. For multiplication, estimate first and place the decimal after multiplying whole-number digits. Decimals support rates, money and proportional reasoning.
- Worked example: Calculate 4.75 + 2.6.
Write 2.6 as 2.60.
4.75 + 2.60 = 7.35.
- Common misconception: Do not line up the final digits instead of the decimal points.

### Q.G8.S4.PRACTICE.G8-DECIMALS.01

- Prompt: Calculate 6.2 − 1.45.
- Skill: G8-NUM-DECIMALS-OPERATIONS
- Activity: A.G8.S4.G8-DECIMALS
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: 5.25
- B: 4.65
- C: 4.85
- D (correct): 4.75
- Worked solution: Write 6.2 as 6.20, then subtract: 6.20 − 1.45 = 4.75.
- Hint: Write 6.2 as 6.20.
- Individually authored incorrect-answer feedback:
- Selected A — **5.25**: 5.25 misaligns place values during subtraction. Write 6.2 as 6.20, then subtract hundredths, tenths, and ones.
- Selected B — **4.65**: 4.65 subtracts digits without correctly borrowing across decimal places. Line up the decimal points before subtracting.
- Selected C — **4.85**: 4.85 has an incorrect tenths or hundredths subtraction. Use 6.20 − 1.45 with aligned columns.

### Q.G8.S4.PRACTICE.G8-DECIMALS.02

- Prompt: Calculate 0.4 × 0.5.
- Skill: G8-NUM-DECIMALS-OPERATIONS
- Activity: A.G8.S4.G8-DECIMALS
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A (correct): 0.2
- B: 2
- C: 0.02
- D: 0.9
- Worked solution: 4×5=20; two decimal places give 0.20.
- Hint: Estimate whether multiplying two numbers smaller than one should make the result larger or smaller.
- Individually authored incorrect-answer feedback:
- Selected B — **2**: 2 ignores decimal places and is too large: multiplying two numbers below 1 should give a number below 1.
- Selected C — **0.02**: 0.02 places the decimal one position too far left. Four tenths times five tenths is twenty hundredths, or 0.20.
- Selected D — **0.9**: 0.9 adds 0.4 and 0.5 rather than multiplying. Estimate first: the product should be about one fifth.

### Q.G8.S4.PRACTICE.G8-DECIMALS.03

- Prompt: A R12.50 item costs how much for 3?
- Skill: G8-NUM-DECIMALS-OPERATIONS
- Activity: A.G8.S4.G8-DECIMALS
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: R125.00
- B (correct): R37.50
- C: R15.50
- D: R36.50
- Worked solution: Multiply R12.50 by 3: 12.50 × 3 = 37.50, so the total is R37.50.
- Hint: Multiply the amount, keeping cents.
- Individually authored incorrect-answer feedback:
- Selected A — **R125.00**: R125.00 shifts the decimal point and is ten times too large. Keep cents when multiplying 12.50 by 3.
- Selected C — **R15.50**: R15.50 adds a small amount instead of multiplying the full price by 3. Multiply R12.50 three times.
- Selected D — **R36.50**: R36.50 has the right tens but an incorrect cents calculation. Add 12.50 + 12.50 + 12.50 carefully.

### Q.G8.S4.PRACTICE.G8-DECIMALS.04

- Prompt: Why is estimating useful with decimals?
- Skill: G8-NUM-DECIMALS-OPERATIONS
- Activity: A.G8.S4.G8-DECIMALS
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: It removes units
- B: It makes all answers whole
- C (correct): It can reveal a misplaced decimal point
- D: It replaces calculation
- Worked solution: An answer near 20 for 0.4×0.5 is unreasonable; estimate catches it.
- Hint: Think about the size of the answer.
- Individually authored incorrect-answer feedback:
- Selected A — **It removes units**: Estimation still needs units, such as rand or kilometres. Its purpose is to spot unreasonable sizes or decimal placement.
- Selected B — **It makes all answers whole**: Estimates can be decimal values too. They help predict the size of an answer, not force it to be whole.
- Selected D — **It replaces calculation**: Estimating checks whether a calculation is reasonable; it does not replace the exact calculation when an exact answer is needed.


## Grade 8 — Grade 8 bridge: signed numbers

- Skill: G8-NUM-INTEGERS-OPERATIONS
- Objective: By the end of this bridge, you should be able to add, subtract and multiply signed integers.
- Explanation: Use a number line for addition and subtraction. For multiplication, matching signs give a positive result; different signs give a negative result. These ideas support Grade 9 integer calculations.
- Worked example: Calculate −3 + 8.
Start at −3.
Move 8 steps right.
The answer is 5.
- Common misconception: Subtracting a negative changes to adding its opposite.

### Q.G8.S4.PRACTICE.G8-INTEGERS.01

- Prompt: Calculate −9 + 4.
- Skill: G8-NUM-INTEGERS-OPERATIONS
- Activity: A.G8.S4.G8-INTEGERS
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: 5
- B: −13
- C: 13
- D (correct): −5
- Worked solution: Move four right from −9 to −5.
- Hint: The negative magnitude is larger.
- Individually authored incorrect-answer feedback:
- Selected A — **5**: 5 ignores that −9 has the greater magnitude. Starting at −9 and moving 4 right lands on −5.
- Selected B — **−13**: −13 treats +4 as another negative addend. Adding a positive moves toward zero, from −9 to −5.
- Selected C — **13**: 13 adds magnitudes but loses the sign of the larger magnitude. Compare 9 and 4, then keep the sign of −9.

### Q.G8.S4.PRACTICE.G8-INTEGERS.02

- Prompt: Calculate (−5) × (−3).
- Skill: G8-NUM-INTEGERS-OPERATIONS
- Activity: A.G8.S4.G8-INTEGERS
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A (correct): 15
- B: −15
- C: −8
- D: 8
- Worked solution: Same signs give positive; 5×3=15.
- Hint: Two negatives make a positive product.
- Individually authored incorrect-answer feedback:
- Selected B — **−15**: −15 has the right magnitude but the wrong sign. Two negative factors multiply to a positive result.
- Selected C — **−8**: −8 adds −5 and −3 instead of multiplying. Multiply the magnitudes first, then use the same-sign rule.
- Selected D — **8**: 8 adds magnitudes rather than multiplying. Calculate 5 × 3 and remember that matching negative signs give positive.

### Q.G8.S4.PRACTICE.G8-INTEGERS.03

- Prompt: Calculate 7 − (−2).
- Skill: G8-NUM-INTEGERS-OPERATIONS
- Activity: A.G8.S4.G8-INTEGERS
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: −5
- B (correct): 9
- C: 5
- D: −9
- Worked solution: Subtracting −2 means add 2: 7+2=9.
- Hint: Rewrite as addition.
- Individually authored incorrect-answer feedback:
- Selected A — **−5**: −5 uses the difference of the magnitudes with an unsupported negative sign. Add 2 to 7 after rewriting the expression.
- Selected C — **5**: 5 treats subtracting −2 as subtracting positive 2. Rewrite 7 − (−2) as 7 + 2.
- Selected D — **−9**: −9 changes both signs and does not follow the subtraction rule. A double negative here becomes addition.

### Q.G8.S4.PRACTICE.G8-INTEGERS.04

- Prompt: Why is (−12) ÷ 3 negative?
- Skill: G8-NUM-INTEGERS-OPERATIONS
- Activity: A.G8.S4.G8-INTEGERS
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: Both numbers are negative
- B: 12 is greater than 3
- C (correct): The signs are different
- D: Division ignores signs
- Worked solution: A negative divided by a positive is negative.
- Hint: Compare the signs first.
- Individually authored incorrect-answer feedback:
- Selected A — **Both numbers are negative**: Only −12 is negative; 3 is positive. The different signs explain why the quotient is negative.
- Selected B — **12 is greater than 3**: Magnitude comparison does not set the sign of a quotient. Check whether the two signs match or differ.
- Selected D — **Division ignores signs**: Division does use signs. A negative divided by a positive has unlike signs, so the quotient is negative.


## Grade 8 — Grade 8 bridge: exponent basics

- Skill: G8-EXP-LAWS-SCI
- Objective: By the end of this bridge, you should be able to read powers and use the product law with the same base.
- Explanation: An exponent tells how many equal factors are multiplied. For the same base, multiplication adds exponents. This is the foundation for Grade 9 zero and negative exponents.
- Worked example: Simplify 3² × 3⁴.
The base is 3 in both terms.
Add exponents: 2+4=6.
Answer: 3⁶.
- Common misconception: Exponents are not ordinary numbers to multiply when bases are being multiplied.

### Q.G8.S4.PRACTICE.G8-EXPONENTS.01

- Prompt: What is 2⁴?
- Skill: G8-EXP-LAWS-SCI
- Activity: A.G8.S4.G8-EXPONENTS
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A (correct): 16
- B: 8
- C: 6
- D: 24
- Worked solution: The exponent 4 means four factors: 2 × 2 × 2 × 2 = 16.
- Hint: Write four factors of 2.
- Individually authored incorrect-answer feedback:
- Selected B — **8**: 8 is 2³, so it uses only three factors. The exponent 4 requires 2 × 2 × 2 × 2.
- Selected C — **6**: 6 multiplies the base by the exponent instead of using repeated multiplication. Write four factors of 2.
- Selected D — **24**: 24 may come from 2 × 3 × 4, but exponents repeat the base, not consecutive numbers. Multiply four 2s.

### Q.G8.S4.PRACTICE.G8-EXPONENTS.02

- Prompt: Simplify x² × x⁵.
- Skill: G8-EXP-LAWS-SCI
- Activity: A.G8.S4.G8-EXPONENTS
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: x³
- B (correct): x⁷
- C: x¹⁰
- D: 2x⁷
- Worked solution: Same base product: add 2+5.
- Hint: Keep the base x.
- Individually authored incorrect-answer feedback:
- Selected A — **x³**: x³ subtracts the exponents as if dividing. Multiplying x² and x⁵ gives seven factors of x.
- Selected C — **x¹⁰**: x¹⁰ multiplies exponents, which is for a power of a power. For multiplication of the same base, add 2 and 5.
- Selected D — **2x⁷**: 2x⁷ adds an unnecessary coefficient 2. The exponents add while the base remains x.

### Q.G8.S4.PRACTICE.G8-EXPONENTS.03

- Prompt: What is the base in (−4)³?
- Skill: G8-EXP-LAWS-SCI
- Activity: A.G8.S4.G8-EXPONENTS
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: 4 only
- B: −3
- C (correct): −4
- D: 3
- Worked solution: Brackets make the complete signed number the base.
- Hint: The exponent sits outside the bracket.
- Individually authored incorrect-answer feedback:
- Selected A — **4 only**: The brackets include the negative sign in the base. The repeated factor is −4, not just 4.
- Selected B — **−3**: −3 combines the sign and exponent incorrectly. Read the expression: −4 is inside the brackets and 3 is outside.
- Selected D — **3**: 3 is the exponent, not the base. The base is the complete quantity being repeatedly multiplied.

### Q.G8.S4.PRACTICE.G8-EXPONENTS.04

- Prompt: Why is a³ × a² not a⁶?
- Skill: G8-EXP-LAWS-SCI
- Activity: A.G8.S4.G8-EXPONENTS
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: Bases are added
- B: The base changes to 6
- C: It is always a⁶
- D (correct): The exponents are added, not multiplied
- Worked solution: There are 3+2 factors of a, giving a⁵.
- Hint: Count the total factors.
- Individually authored incorrect-answer feedback:
- Selected A — **Bases are added**: The bases stay a; they are not added. Count the total factors of a to see that exponents add.
- Selected B — **The base changes to 6**: 6 is not a new base. The base remains a and the exponents 3 and 2 combine by addition.
- Selected C — **It is always a⁶**: a⁶ would result from multiplying exponents, not from multiplying powers with the same base. Use 3 + 2.


## Grade 8 — Grade 8 bridge: simple pattern rules

- Skill: G8-PAT-REPRESENT-RULE
- Objective: By the end of this bridge, you should be able to extend a simple number pattern and test a rule.
- Explanation: Find how a pattern changes, then use a table to test a proposed rule. A constant first difference means that each new term adds the same number.
- Worked example: For 2, 5, 8, … the change is +3.
The next term is 11.
A matching rule is Tn = 3n − 1.
- Common misconception: A rule must work for the first and another term, not just one chosen term.

### Q.G8.S4.PRACTICE.G8-PATTERNS.01

- Prompt: What comes next: 9, 13, 17, …?
- Skill: G8-PAT-REPRESENT-RULE
- Activity: A.G8.S4.G8-PATTERNS
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A: 19
- B: 20
- C: 22
- D (correct): 21
- Worked solution: The constant difference is 4.
- Hint: Subtract consecutive terms.
- Individually authored incorrect-answer feedback:
- Selected A — **19**: 19 adds 2 instead of the constant difference 4. Compare 13 − 9 and 17 − 13.
- Selected B — **20**: 20 does not continue the +4 pattern. Add the same difference to 17.
- Selected C — **22**: 22 adds 5, not the established difference 4. Keep the change consistent from term to term.

### Q.G8.S4.PRACTICE.G8-PATTERNS.02

- Prompt: For Tn=2n+1, find T4.
- Skill: G8-PAT-REPRESENT-RULE
- Activity: A.G8.S4.G8-PATTERNS
- Classification: Procedural — deterministic check plus reviewer inspection
- Feedback source: explicitly_authored_v3
- Options:
- A (correct): 9
- B: 7
- C: 8
- D: 12
- Worked solution: Substitute n = 4: T4 = 2(4) + 1 = 9.
- Hint: Substitute n=4.
- Individually authored incorrect-answer feedback:
- Selected B — **7**: 7 may use n = 3 rather than n = 4. Substitute the requested value 4 into 2n + 1.
- Selected C — **8**: 8 doubles 4 but omits the +1 in the rule. Apply both operations in 2(4) + 1.
- Selected D — **12**: 12 adds or multiplies the rule incorrectly. Evaluate 2 × 4 first, then add 1 once.

### Q.G8.S4.PRACTICE.G8-PATTERNS.03

- Prompt: Which rule fits 4, 7, 10, …?
- Skill: G8-PAT-REPRESENT-RULE
- Activity: A.G8.S4.G8-PATTERNS
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: n + 3
- B (correct): 3n + 1
- C: 3n + 4
- D: 4n − 1
- Worked solution: Difference is 3 and 3(1)+1=4.
- Hint: Test n=1.
- Individually authored incorrect-answer feedback:
- Selected A — **n + 3**: n + 3 increases by only 1, not 3. Use 3n plus a constant that makes the first term 4.
- Selected C — **3n + 4**: 3n + 4 has the right difference but gives 7 at n = 1, not 4. Test the rule against the first term.
- Selected D — **4n − 1**: 4n − 1 changes by 4 each term, but the sequence changes by 3. The coefficient must match the difference.

### Q.G8.S4.PRACTICE.G8-PATTERNS.04

- Prompt: Why test a rule at n=2?
- Skill: G8-PAT-REPRESENT-RULE
- Activity: A.G8.S4.G8-PATTERNS
- Classification: Mathematical reasoning — reviewer record required
- Feedback source: explicitly_authored_v3
- Options:
- A: It removes the difference
- B: All rules work at n=2
- C (correct): It confirms another term matches
- D: It changes n into 1
- Worked solution: A second value can show whether a rule was fitted incorrectly.
- Hint: Substitute n=2.
- Individually authored incorrect-answer feedback:
- Selected A — **It removes the difference**: The common difference remains part of the pattern. Testing another n-value verifies that the rule preserves it.
- Selected B — **All rules work at n=2**: A wrong rule can fail at n = 2, so testing it is useful. Compare the predicted second term with the actual one.
- Selected D — **It changes n into 1**: Testing n = 2 does not change n; it substitutes 2 to predict the second term. This checks the proposed rule.


## Reviewer notes

- Grade 8 bridges provide prerequisites in factors/order, fractions, decimals, signed numbers, exponent basics and patterns.
- Reasoning-labelled items have reviewer records and are not certified solely by answer-key checks.
- No final academic approval is asserted here.
