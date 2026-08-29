# Grade 9 Gold Standard Item Review Packet

**Purpose:** a read-only packet for named human mathematics and instructional review of the existing Grade 9 pilot gold-standard set. This file reproduces the current stored item content and metadata. It does not approve, alter, or publish any item.

**Extracted from:** the current `question_items`, `question_versions`, skill-link, misconception-link, hint, curriculum, and prerequisite records.

**Publication safeguard:** every item in this packet has current review status **`draft`**. A reviewer must use the audited review workflow; completing this packet alone does not change a review state or make content learner-facing.

## Review instructions

For each item, select one outcome in every review field and record supporting notes. Use **REVISE** when the item can be corrected, and **FAIL/REJECT** when it should not continue through the review lifecycle. The stored prompt, answer configuration, and memo are reproduced verbatim beneath each item so reviewer comments can point to the precise source content.

## Summary matrix

| Item ID | Skill | Type | Cognitive level | Expected misconception | Status | Reviewer decision |
| --- | --- | --- | --- | --- | --- | --- |
| Q.G9.DIAG.03 | G9.ALG.LIKE_TERMS | diagnostic | routine | ALG_COMBINE_UNLIKE_TERMS | draft | __________ |
| Q.G9.DIAG.04 | G9.ALG.SUBSTITUTION | diagnostic | routine | — | draft | __________ |
| Q.G9.DIAG.05 | G9.ALG.DISTRIBUTIVE | diagnostic | routine | ALG_DISTRIBUTIVE_PARTIAL | draft | __________ |
| Q.G9.DOTS.02 | G9.ALG.EXPAND.BINOMIAL | diagnostic | routine | — | draft | __________ |
| Q.G9.VERTICAL.02 | G9.ALG.DISTRIBUTIVE | guided_practice | routine | ALG_SIGN_DISTRIBUTION | draft | __________ |
| Q.G9.DOTS.13 | G9.ALG.FACTOR.COMMON | interleaved_review | complex | — | draft | __________ |
| Q.G9.VERTICAL.05 | G9.ALG.FRACTIONS.SIMPLIFY | independent_practice | complex | — | draft | __________ |
| Q.G9.DOTS.01 | G9.ALG.FACTOR.DOTS | retrieval | knowledge | — | draft | __________ |
| Q.G9.DIAG.07 | G9.ALG.FACTOR.DOTS | diagnostic | complex | ALG_DOTS_AS_BINOMIAL_SQUARE | draft | __________ |
| Q.G9.DOTS.03 | G9.ALG.FACTOR.DOTS | worked_example | routine | ALG_DOTS_AS_BINOMIAL_SQUARE | draft | __________ |
| Q.G9.DOTS.04 | G9.ALG.FACTOR.DOTS | faded_example | routine | ALG_DOTS_INCORRECT_ROOT | draft | __________ |
| Q.G9.DOTS.09 | G9.ALG.FACTOR.DOTS | error_analysis | complex | ALG_DOTS_AS_BINOMIAL_SQUARE | draft | __________ |
| Q.G9.DOTS.10 | G9.ALG.FACTOR.DOTS | independent_practice | routine | — | draft | __________ |
| Q.G9.DOTS.18 | G9.ALG.FACTOR.DOTS | delayed_retention | routine | — | draft | __________ |
| Q.G9.DIAG.09 | G9.EQN.MULTI_STEP | diagnostic | routine | EQN_DIVIDE_ONE_SIDE_ONLY | draft | __________ |
| Q.G9.VERTICAL.07 | G9.EQN.FACTORISED | independent_practice | complex | EQN_ZERO_PRODUCT_NOT_APPLIED | draft | __________ |
| Q.G9.DIAG.12 | G9.GRAPH.ORDERED_PAIRS | diagnostic | knowledge | GRAPH_XY_REVERSED | draft | __________ |
| Q.G9.DIAG.15 | G9.GRAPH.GRADIENT | diagnostic | routine | GRAPH_GRADIENT_RECIPROCAL | draft | __________ |
| Q.G9.VERTICAL.10 | G9.GRAPH.PLOT_POINTS | representation_translation | routine | GRAPH_XY_REVERSED | draft | __________ |
| Q.G9.VERTICAL.12 | G9.GRAPH.RULE_FROM_TABLE | representation_translation | complex | GRAPH_GRADIENT_AS_INTERCEPT | draft | __________ |
| Q.G9.VERTICAL.16 | G9.GRAPH.COMPARE_RELATIONSHIPS | investigation | problem_solving | — | draft | __________ |
| Q.G9.VERTICAL.01 | G9.ALG.LIKE_TERMS | retrieval | routine | ALG_COMBINE_UNLIKE_TERMS | draft | __________ |

## A. Algebra foundations

### Q.G9.DIAG.03 — Like terms diagnostic

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Algebraic Expressions |
| Primary skill | G9.ALG.LIKE_TERMS — Like terms |
| Supporting skills | None |
| Prerequisite skills | G9.ALG.LANGUAGE — Algebraic language; G9.ALG.LANGUAGE.TERMS — Terms in algebraic expressions |
| Question/activity type | diagnostic |
| CAPS cognitive level | routine |
| Representation | symbolic |
| Difficulty | 1 |
| Marks | 2.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
Simplify: 4x + 3x - 2.
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["7x - 2"]}
```

**Full memo/solution (stored exactly):**

```text
4x and 3x are like terms, so 4x + 3x = 7x.
```

**Expected misconceptions:** ALG_COMBINE_UNLIKE_TERMS — Combining unlike terms. Unlike terms are combined as though their variable parts match.

**Ordered hint ladder:** No hints stored.

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

### Q.G9.DIAG.04 — Substitution diagnostic

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Algebraic Expressions |
| Primary skill | G9.ALG.SUBSTITUTION — Substitution |
| Supporting skills | None |
| Prerequisite skills | G9.ALG.LANGUAGE.VARIABLES — Variables in algebraic expressions |
| Question/activity type | diagnostic |
| CAPS cognitive level | routine |
| Representation | symbolic |
| Difficulty | 1 |
| Marks | 2.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
If x = 3, find 2x + 5.
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["11"]}
```

**Full memo/solution (stored exactly):**

```text
Substitute x = 3: 2(3) + 5 = 11.
```

**Expected misconceptions:** None stored.

**Ordered hint ladder:** No hints stored.

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

### Q.G9.VERTICAL.01 — Like terms retrieval

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Algebraic Expressions |
| Primary skill | G9.ALG.LIKE_TERMS — Like terms |
| Supporting skills | None |
| Prerequisite skills | G9.ALG.LANGUAGE — Algebraic language; G9.ALG.LANGUAGE.TERMS — Terms in algebraic expressions |
| Question/activity type | retrieval |
| CAPS cognitive level | routine |
| Representation | symbolic |
| Difficulty | 2 |
| Marks | 2.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
Simplify: 5a - 2a + 3.
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["3a + 3"]}
```

**Full memo/solution (stored exactly):**

```text
Combine like terms only.
```

**Expected misconceptions:** ALG_COMBINE_UNLIKE_TERMS — Combining unlike terms. Unlike terms are combined as though their variable parts match.

**Ordered hint ladder:** No hints stored.

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

## B. Expanding expressions

### Q.G9.DIAG.05 — Distributive property diagnostic

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Algebraic Expressions |
| Primary skill | G9.ALG.DISTRIBUTIVE — Distributive property |
| Supporting skills | None |
| Prerequisite skills | G9.ALG.LIKE_TERMS — Like terms |
| Question/activity type | diagnostic |
| CAPS cognitive level | routine |
| Representation | symbolic |
| Difficulty | 2 |
| Marks | 2.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
Expand: 3(x + 4).
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["3x + 12"]}
```

**Full memo/solution (stored exactly):**

```text
Multiply 3 by x and by 4.
```

**Expected misconceptions:** ALG_DISTRIBUTIVE_PARTIAL — Partial distribution. A factor is distributed to only one term inside a bracket.

**Ordered hint ladder:** No hints stored.

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

### Q.G9.DOTS.02 — Binomial expansion diagnostic

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Algebraic Expressions |
| Primary skill | G9.ALG.EXPAND.BINOMIAL — Binomial × binomial |
| Supporting skills | G9.ALG.FACTOR.DOTS — Difference of two squares |
| Prerequisite skills | G9.ALG.EXPAND.MONOMIAL — Monomial × polynomial |
| Question/activity type | diagnostic |
| CAPS cognitive level | routine |
| Representation | symbolic |
| Difficulty | 2 |
| Marks | 2.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
Expand: (x - 5)(x + 5).
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["x² - 25"]}
```

**Full memo/solution (stored exactly):**

```text
The middle terms cancel: x² + 5x - 5x - 25.
```

**Expected misconceptions:** None stored.

**Ordered hint ladder:** No hints stored.

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

### Q.G9.VERTICAL.02 — Negative-sign distribution guided practice

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Algebraic Expressions |
| Primary skill | G9.ALG.DISTRIBUTIVE — Distributive property |
| Supporting skills | None |
| Prerequisite skills | G9.ALG.LIKE_TERMS — Like terms |
| Question/activity type | guided_practice |
| CAPS cognitive level | routine |
| Representation | symbolic |
| Difficulty | 2 |
| Marks | 2.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
Expand: -(x - 4).
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["-x + 4"]}
```

**Full memo/solution (stored exactly):**

```text
Multiply both terms by -1.
```

**Expected misconceptions:** ALG_SIGN_DISTRIBUTION — Sign distribution error. A negative sign is not distributed to every term in a bracket.

**Ordered hint ladder:** No hints stored.

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

## C. Factorisation

### Q.G9.DOTS.13 — Common-factor interleaved review

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Algebraic Expressions |
| Primary skill | G9.ALG.FACTOR.COMMON — Common factorisation |
| Supporting skills | None |
| Prerequisite skills | G9.ALG.LIKE_TERMS — Like terms |
| Question/activity type | interleaved_review |
| CAPS cognitive level | complex |
| Representation | symbolic |
| Difficulty | 3 |
| Marks | 2.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
Choose the method and factorise: 6x + 18.
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["6(x + 3)"]}
```

**Full memo/solution (stored exactly):**

```text
This uses a common factor, not a difference of squares.
```

**Expected misconceptions:** None stored.

**Ordered hint ladder:** No hints stored.

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

### Q.G9.VERTICAL.05 — Simplifying algebraic fractions independent practice

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Algebraic Expressions |
| Primary skill | G9.ALG.FRACTIONS.SIMPLIFY — Simplifying algebraic fractions |
| Supporting skills | G9.ALG.FACTOR.DOTS — Difference of two squares |
| Prerequisite skills | G9.ALG.FACTOR.COMMON — Common factorisation |
| Question/activity type | independent_practice |
| CAPS cognitive level | complex |
| Representation | symbolic |
| Difficulty | 3 |
| Marks | 3.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
Simplify: (x² - 9)/(x - 3).
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["x + 3"]}
```

**Full memo/solution (stored exactly):**

```text
Factor x² - 9 as (x-3)(x+3), then cancel x-3 where defined.
```

**Expected misconceptions:** None stored.

**Ordered hint ladder:** No hints stored.

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

## D. Difference of Two Squares

### Q.G9.DOTS.01 — Perfect-square retrieval

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Algebraic Expressions |
| Primary skill | G9.ALG.FACTOR.DOTS — Difference of two squares |
| Supporting skills | None |
| Prerequisite skills | G9.ALG.EXPAND.BINOMIAL — Binomial × binomial; G9.ALG.FACTOR.COMMON — Common factorisation |
| Question/activity type | retrieval |
| CAPS cognitive level | knowledge |
| Representation | symbolic |
| Difficulty | 1 |
| Marks | 2.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
Which of 25, 36, 49 and 81 are perfect squares?
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["25, 36, 49, 81"]}
```

**Full memo/solution (stored exactly):**

```text
5² = 25, 6² = 36, 7² = 49 and 9² = 81.
```

**Expected misconceptions:** None stored.

**Ordered hint ladder:** No hints stored.

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

### Q.G9.DIAG.07 — Difference-of-two-squares diagnostic

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Algebraic Expressions |
| Primary skill | G9.ALG.FACTOR.DOTS — Difference of two squares |
| Supporting skills | G9.ALG.EXPAND.BINOMIAL — Binomial × binomial |
| Prerequisite skills | G9.ALG.EXPAND.BINOMIAL — Binomial × binomial; G9.ALG.FACTOR.COMMON — Common factorisation |
| Question/activity type | diagnostic |
| CAPS cognitive level | complex |
| Representation | symbolic |
| Difficulty | 3 |
| Marks | 2.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
Factorise: x² - 25.
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["(x - 5)(x + 5)"]}
```

**Full memo/solution (stored exactly):**

```text
Recognise x² - 5² and use a² - b² = (a-b)(a+b).
```

**Expected misconceptions:** ALG_DOTS_AS_BINOMIAL_SQUARE — Difference of squares treated as binomial square. A difference of squares is factorised as the square of a difference.

**Ordered hint ladder:** No hints stored.

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

### Q.G9.DOTS.03 — Difference-of-two-squares worked example

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Algebraic Expressions |
| Primary skill | G9.ALG.FACTOR.DOTS — Difference of two squares |
| Supporting skills | G9.ALG.EXPAND.BINOMIAL — Binomial × binomial |
| Prerequisite skills | G9.ALG.EXPAND.BINOMIAL — Binomial × binomial; G9.ALG.FACTOR.COMMON — Common factorisation |
| Question/activity type | worked_example |
| CAPS cognitive level | routine |
| Representation | symbolic |
| Difficulty | 2 |
| Marks | 2.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
Factorise: x² - 25.
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["(x - 5)(x + 5)"]}
```

**Full memo/solution (stored exactly):**

```text
x² - 25 = x² - 5² = (x-5)(x+5).
```

**Expected misconceptions:** ALG_DOTS_AS_BINOMIAL_SQUARE — Difference of squares treated as binomial square. A difference of squares is factorised as the square of a difference.

**Complete ordered hint ladder:**

1. H1: Look at both terms. Are they perfect squares?
2. H2: Recall: a² - b² = (a - b)(a + b).
3. H3: x² = x² and 49 = 7².
4. H4: Complete: (x - 7)(x + ___).
5. H5: x² - 49 = (x - 7)(x + 7).

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

### Q.G9.DOTS.04 — Difference-of-two-squares faded example

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Algebraic Expressions |
| Primary skill | G9.ALG.FACTOR.DOTS — Difference of two squares |
| Supporting skills | None |
| Prerequisite skills | G9.ALG.EXPAND.BINOMIAL — Binomial × binomial; G9.ALG.FACTOR.COMMON — Common factorisation |
| Question/activity type | faded_example |
| CAPS cognitive level | routine |
| Representation | symbolic |
| Difficulty | 2 |
| Marks | 1.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
Complete: y² - 49 = (y - 7)(y + __ ).
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["7"]}
```

**Full memo/solution (stored exactly):**

```text
49 = 7², so both factors use 7.
```

**Expected misconceptions:** ALG_DOTS_INCORRECT_ROOT — Incorrect roots in difference of squares. The constant itself is used instead of its square root.

**Complete ordered hint ladder:**

1. H1: First express 25 as a perfect square.
2. H2: Use the difference-of-two-squares structure.
3. H3: 25 = 5².
4. H4: Complete: (y - 5)(y + ___).
5. H5: y² - 25 = (y - 5)(y + 5).

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

### Q.G9.DOTS.09 — Difference-of-two-squares error analysis

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Algebraic Expressions |
| Primary skill | G9.ALG.FACTOR.DOTS — Difference of two squares |
| Supporting skills | G9.ALG.EXPAND.BINOMIAL — Binomial × binomial |
| Prerequisite skills | G9.ALG.EXPAND.BINOMIAL — Binomial × binomial; G9.ALG.FACTOR.COMMON — Common factorisation |
| Question/activity type | error_analysis |
| CAPS cognitive level | complex |
| Representation | symbolic |
| Difficulty | 3 |
| Marks | 3.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
A learner says x² - 64 = (x - 8)². Explain and correct the factorisation.
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["(x - 8)(x + 8)"]}
```

**Full memo/solution (stored exactly):**

```text
(x - 8)² expands to x² - 16x + 64, not x² - 64.
```

**Expected misconceptions:** ALG_DOTS_AS_BINOMIAL_SQUARE — Difference of squares treated as binomial square. A difference of squares is factorised as the square of a difference.

**Complete ordered hint ladder:**

1. H1: A difference of squares is not a binomial square.
2. H2: Compare a² - b² with (a - b)².
3. H3: 64 = 8².
4. H4: Complete: (x - 8)(x + ___).
5. H5: x² - 64 = (x - 8)(x + 8).

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

### Q.G9.DOTS.10 — Difference-of-two-squares independent practice

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Algebraic Expressions |
| Primary skill | G9.ALG.FACTOR.DOTS — Difference of two squares |
| Supporting skills | None |
| Prerequisite skills | G9.ALG.EXPAND.BINOMIAL — Binomial × binomial; G9.ALG.FACTOR.COMMON — Common factorisation |
| Question/activity type | independent_practice |
| CAPS cognitive level | routine |
| Representation | symbolic |
| Difficulty | 2 |
| Marks | 2.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
Factorise: t² - 36.
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["(t - 6)(t + 6)"]}
```

**Full memo/solution (stored exactly):**

```text
36 = 6².
```

**Expected misconceptions:** None stored.

**Ordered hint ladder:** No hints stored.

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

### Q.G9.DOTS.18 — Difference-of-two-squares delayed retrieval

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Algebraic Expressions |
| Primary skill | G9.ALG.FACTOR.DOTS — Difference of two squares |
| Supporting skills | None |
| Prerequisite skills | G9.ALG.EXPAND.BINOMIAL — Binomial × binomial; G9.ALG.FACTOR.COMMON — Common factorisation |
| Question/activity type | delayed_retention |
| CAPS cognitive level | routine |
| Representation | symbolic |
| Difficulty | 2 |
| Marks | 2.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
Factorise: n² - 144.
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["(n - 12)(n + 12)"]}
```

**Full memo/solution (stored exactly):**

```text
144 = 12².
```

**Expected misconceptions:** None stored.

**Ordered hint ladder:** No hints stored.

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

## E. Algebraic equations

### Q.G9.DIAG.09 — Multi-step equation diagnostic

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Algebraic Equations |
| Primary skill | G9.EQN.MULTI_STEP — Multi-step equations |
| Supporting skills | None |
| Prerequisite skills | G9.EQN.ONE_STEP — One-step equations |
| Question/activity type | diagnostic |
| CAPS cognitive level | routine |
| Representation | symbolic |
| Difficulty | 2 |
| Marks | 2.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
Solve: 3x + 12 = 21.
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["x = 3"]}
```

**Full memo/solution (stored exactly):**

```text
Subtract 12, then divide by 3.
```

**Expected misconceptions:** EQN_DIVIDE_ONE_SIDE_ONLY — Divide one side only. An operation is performed on only one side of an equation.

**Ordered hint ladder:** No hints stored.

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

### Q.G9.VERTICAL.07 — Factorised equation independent practice

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Algebraic Equations |
| Primary skill | G9.EQN.FACTORISED — Factorised equations |
| Supporting skills | G9.EQN.ZERO_PRODUCT — Zero-product principle |
| Prerequisite skills | G9.ALG.FACTOR.DOTS — Difference of two squares; G9.EQN.ZERO_PRODUCT — Zero-product principle |
| Question/activity type | independent_practice |
| CAPS cognitive level | complex |
| Representation | symbolic |
| Difficulty | 3 |
| Marks | 2.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
Solve: (x - 4)(x + 1) = 0.
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["x = 4 or x = -1"]}
```

**Full memo/solution (stored exactly):**

```text
Apply zero product to each factor.
```

**Expected misconceptions:** EQN_ZERO_PRODUCT_NOT_APPLIED — Zero product not applied. The learner does not split zero-product factors into alternatives.

**Ordered hint ladder:** No hints stored.

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

## F. Cartesian plane / linear graphs

### Q.G9.DIAG.12 — Ordered-pairs diagnostic

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Graphs |
| Primary skill | G9.GRAPH.ORDERED_PAIRS — Ordered pairs |
| Supporting skills | None |
| Prerequisite skills | G9.GRAPH.CARTESIAN — Cartesian plane; G9.GRAPH.CARTESIAN_PLANE — Cartesian plane |
| Question/activity type | diagnostic |
| CAPS cognitive level | knowledge |
| Representation | graphical |
| Difficulty | 1 |
| Marks | 1.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
Which point is (2, -1): move 2 across and 1 down from the origin.
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["(2, -1)"]}
```

**Full memo/solution (stored exactly):**

```text
Read an ordered pair as horizontal coordinate then vertical coordinate.
```

**Expected misconceptions:** GRAPH_XY_REVERSED — Coordinates reversed. An ordered pair is read as (y, x).

**Ordered hint ladder:** No hints stored.

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

### Q.G9.DIAG.15 — Gradient diagnostic

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Graphs |
| Primary skill | G9.GRAPH.GRADIENT — Gradient |
| Supporting skills | None |
| Prerequisite skills | G9.GRAPH.CARTESIAN_PLANE — Cartesian plane; G9.GRAPH.ORDERED_PAIRS — Ordered pairs |
| Question/activity type | diagnostic |
| CAPS cognitive level | routine |
| Representation | graphical |
| Difficulty | 2 |
| Marks | 2.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
Find the gradient through (1, 2) and (3, 6).
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["2"]}
```

**Full memo/solution (stored exactly):**

```text
Rise is 4 and run is 2, so gradient is 2.
```

**Expected misconceptions:** GRAPH_GRADIENT_RECIPROCAL — Gradient reciprocal. Run over rise is calculated instead of rise over run.

**Ordered hint ladder:** No hints stored.

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

### Q.G9.VERTICAL.10 — Plot-points representation translation

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Graphs |
| Primary skill | G9.GRAPH.PLOT_POINTS — Plot points |
| Supporting skills | None |
| Prerequisite skills | G9.GRAPH.ORDERED_PAIRS — Ordered pairs |
| Question/activity type | representation_translation |
| CAPS cognitive level | routine |
| Representation | graphical |
| Difficulty | 2 |
| Marks | 1.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
Plot the point (-2, 3). Write its ordered pair.
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["(-2, 3)"]}
```

**Full memo/solution (stored exactly):**

```text
Move 2 left then 3 up.
```

**Expected misconceptions:** GRAPH_XY_REVERSED — Coordinates reversed. An ordered pair is read as (y, x).

**Ordered hint ladder:** No hints stored.

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

### Q.G9.VERTICAL.12 — Table-to-rule representation translation

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Graphs |
| Primary skill | G9.GRAPH.RULE_FROM_TABLE — Rule from table |
| Supporting skills | G9.GRAPH.GRADIENT — Gradient |
| Prerequisite skills | G9.GRAPH.TABLE_FROM_RULE — Table from rule |
| Question/activity type | representation_translation |
| CAPS cognitive level | complex |
| Representation | tabular |
| Difficulty | 3 |
| Marks | 2.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
A table has x: 0, 1, 2 and y: 3, 5, 7. Write the rule.
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["y = 2x + 3"]}
```

**Full memo/solution (stored exactly):**

```text
The gradient is 2 and the y-intercept is 3.
```

**Expected misconceptions:** GRAPH_GRADIENT_AS_INTERCEPT — Gradient and intercept roles confused. The coefficient and constant in y = mx + c are swapped.

**Ordered hint ladder:** No hints stored.

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

### Q.G9.VERTICAL.16 — Compare-linear-relationships investigation

| Field | Stored value |
| --- | --- |
| Curriculum version | CAPS-MATH-G9-2026 |
| Grade | Grade 9 |
| CAPS topic | Graphs |
| Primary skill | G9.GRAPH.COMPARE_RELATIONSHIPS — Compare linear relationships |
| Supporting skills | None |
| Prerequisite skills | G9.GRAPH.EQUATION_FROM_GRAPH — Equation from graph |
| Question/activity type | investigation |
| CAPS cognitive level | problem_solving |
| Representation | verbal |
| Difficulty | 3 |
| Marks | 2.00 |
| Source tier | Odysseus_authored |
| Current review status | draft |

**Learner-facing prompt (stored exactly):**

```text
Taxi A costs R10 plus R2 per kilometre. Taxi B costs R4 plus R3 per kilometre. Which has the lower fixed cost?
```

**Expected answer (stored `answer_config`):**

```json
{"accepted_answers": ["Taxi B"]}
```

**Full memo/solution (stored exactly):**

```text
The fixed cost is the value at zero kilometres: R10 versus R4.
```

**Expected misconceptions:** None stored.

**Ordered hint ladder:** No hints stored.

**Human review**

- Mathematical validity: ☐ PASS ☐ REVISE ☐ FAIL
- CAPS alignment: ☐ PASS ☐ REVISE ☐ FAIL
- Skill mapping: ☐ PASS ☐ REVISE ☐ FAIL
- Cognitive classification: ☐ PASS ☐ REVISE ☐ FAIL
- Diagnostic value: ☐ PASS ☐ REVISE ☐ FAIL
- Language/clarity: ☐ PASS ☐ REVISE ☐ FAIL
- Hint quality: ☐ PASS ☐ REVISE ☐ FAIL ☐ N/A
- Memo quality: ☐ PASS ☐ REVISE ☐ FAIL
- Reviewer notes:
- Final decision: ☐ APPROVE ☐ REVISE ☐ REJECT

