# Grade 9 Term 1 instructional content review

Content version: `sprint4-v3-explicit-distractor-feedback`
Supersedes: `sprint4-v2-mathematics-corrections` for new draft question versions; v1 and v2 remain retained for audit and historical attempts.
Canonical source: `scripts/grade9-term1-learning-content.cjs`
Machine-readable review export: `docs/product/GRADE9_TERM1_INSTRUCTIONAL_CONTENT_EXPORT.json`

## Review status

The Sprint 4 v3 pack is authored and structurally validated, but deliberately starts as `draft`. No production content is automatically approved or published by a migration. The project owner designated ChatGPT as the mathematics reviewer. The previous v2 pack received conditional academic review; the exact v3 feedback revision is awaiting an explicit verdict. An authorised administrator remains responsible for database approval and publication after that verdict.

## v3 feedback correction, retaining the v2 mathematics corrections

- Corrected the ratio-equivalence item: `4 : 6` and `10 : 15` both simplify to `2 : 3`.
- Clarified integer and rational radicands, including `√(1/4) = 1/2`.
- Clarified signed standard scientific notation with `1 ≤ |a| < 10`; the extension remains non-compulsory.
- Replaced all inferred distractor feedback with 228 stable wrong-option-keyed, individually authored explanations for all 76 questions; `(-5)²` has explicit sign, doubling and expansion feedback.
- Added the starting-together condition to the bus LCM question, separated refundable deposit from net rental cost, stated `y ≠ 0` for the exponent quotient, and removed the defensible fraction-equivalence distractor.

| Scope | Lessons | Practice questions | Activities | Status |
| --- | ---: | ---: | ---: | --- |
| Grade 9 Term 1 | 13 | 52 | 13 | Draft; ready for content review |
| Grade 8 prerequisite bridges | 6 | 24 | 6 | Draft; ready for content review |

## Grade 9 lesson inventory

| Topic | Skill code | Lesson focus |
| --- | --- | --- |
| Whole Numbers | `G9-NUM-REAL-IRRATIONAL` | Rational and irrational real numbers |
| Whole Numbers | `G9-NUM-WHOLE-HCF-LCM` | Prime factors, HCF and LCM |
| Whole Numbers | `G9-NUM-RATIO-RATE` | Ratio and unit rate |
| Whole Numbers | `G9-NUM-DIRECT-INVERSE-PROPORTION` | Direct and inverse proportion |
| Whole Numbers | `G9-NUM-FINANCIAL-APPLICATIONS` | Commission, rental and compound interest |
| Integers | `G9-NUM-INTEGERS-OPERATIONS` | Signed operations, brackets and order |
| Integers | `G9-NUM-INTEGERS-POWERS-ROOTS` | Squares, cubes and integer roots |
| Exponents | `G9-EXP-LAWS-EXTENDED` | Product, quotient and power laws |
| Exponents | `G9-EXP-NEGATIVE-SCI` | Zero and negative exponents |
| Exponents | `G9-EXP-SCI-NOTATION-EXTENSION` | Optional scientific-notation extension |
| Patterns | `G9-PAT-NUMERIC-STRUCTURE` | First differences and extension |
| Patterns | `G9-PAT-GENERAL-RULE` | Linear nth-term rules and checks |
| Patterns | `G9-PAT-GEOMETRIC-VISUAL` | Matchstick/tile patterns and shared edges |

Each lesson has a learner objective, concise original explanation, step-by-step worked example, realistic misconception and four original practice questions: introductory/procedural work plus at least one reasoning or misconception item. Each question has four options, a keyed answer, three individually authored distractor explanations, a worked solution and an optional hint. The detailed v3 handoff is [the final academic review pack](GRADE9_TERM1_FINAL_ACADEMIC_REVIEW.md) with [a feedback semantic-review checklist](GRADE9_TERM1_DISTRACTOR_FEEDBACK_SEMANTIC_REVIEW.md).

Scientific notation is explicitly marked as an optional extension. It is not made a compulsory mastery prerequisite.

## Grade 8 bridge coverage

The bridge is intentionally limited to prerequisites mapped to the Grade 9 Term 1 skills:

- `G8-NUM-WHOLE-PROPERTIES` — factors and order of operations
- `G8-NUM-FRACTIONS-OPERATIONS` — fractions
- `G8-NUM-DECIMALS-OPERATIONS` — decimal operations
- `G8-NUM-INTEGERS-OPERATIONS` — signed integers
- `G8-EXP-LAWS-SCI` — exponent basics
- `G8-PAT-REPRESENT-RULE` — simple pattern rules

The Grade 8 delivery RPC exposes only approved material. The learner route keeps an explicit link back to the original Grade 9 topic. Unknown prerequisite evidence still leads to an optional diagnostic under the existing decision engine; it is not a failure signal.

## Mathematical QA

`npm run qa:grade9-term1-content` validates stable codes, lesson structure, meaningful objectives, topic and activity mapping, four distinct options, keyed answers, individually mapped feedback, worked solutions, non-revealing hints, duplicate prompts/feedback, required domain assumptions and representative deterministic mathematics. Reasoning questions carry an explicit `mathematics_reviewer_required` record: structural QA does not claim that they are academically signed off.

The independent formal assessment bank remains separate. `node scripts/assessment-content-qa.cjs` validates its 252 questions across 17 forms, including critical-skill coverage and reasoning requirements.

## Reviewer checklist

Before approval, review the full material in **Admin → Learning content** and confirm:

1. CAPS wording and scope match the locally adopted annual teaching plan.
2. All calculations, notation and visual-pattern descriptions are accurate.
3. The vocabulary remains suitable for Grade 9 learners using a phone.
4. The intended misconception is represented by a real distractor, not a trick option.
5. A lesson and all linked questions are approved before approving its activity.

No academic sign-off is recorded by this change. Optional videos remain outside the core learning path and require their own existing verification process.
