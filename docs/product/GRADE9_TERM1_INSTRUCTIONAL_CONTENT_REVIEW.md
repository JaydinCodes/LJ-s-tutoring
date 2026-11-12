# Grade 9 Term 1 instructional content review

Content version: `sprint4-v1`
Canonical source: `scripts/grade9-term1-learning-content.cjs`
Machine-readable review export: `docs/product/GRADE9_TERM1_INSTRUCTIONAL_CONTENT_EXPORT.json`

## Review status

The Sprint 4 pack is authored and validated, but deliberately starts as `draft`. No production content is automatically approved or published by a migration. An authorised administrator must inspect the objective, explanation, worked example, common misconception, practice questions, hints and feedback in Learning content before moving each record through the existing review workflow.

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

Each lesson has a learner objective, concise original explanation, step-by-step worked example, realistic misconception and four original practice questions: introductory/procedural work plus at least one reasoning or misconception item. Each question has four options, a keyed answer, three distractor explanations, a worked solution and an optional hint.

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

`npm run qa:grade9-term1-content` validates stable codes, lesson structure, topic coverage, four distinct options, keyed answers, distractor feedback, worked solutions, hints, duplicate prompts, absence of placeholders, activity coverage, and representative deterministic calculations for compound interest, inverse proportion, nth-term rules and joined-square patterns.

The independent formal assessment bank remains separate. `node scripts/assessment-content-qa.cjs` validates its 252 questions across 17 forms, including critical-skill coverage and reasoning requirements.

## Reviewer checklist

Before approval, review the full material in **Admin → Learning content** and confirm:

1. CAPS wording and scope match the locally adopted annual teaching plan.
2. All calculations, notation and visual-pattern descriptions are accurate.
3. The vocabulary remains suitable for Grade 9 learners using a phone.
4. The intended misconception is represented by a real distractor, not a trick option.
5. A lesson and all linked questions are approved before approving its activity.

No reviewer sign-off is recorded by this change. Optional videos remain outside the core learning path and require their own existing verification process.
