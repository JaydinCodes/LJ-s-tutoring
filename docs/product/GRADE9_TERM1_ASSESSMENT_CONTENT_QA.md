# Grade 9 Term 1 Assessment Content QA — Sprint 2 Closure

## Inventory

All content below is original Odysseus-authored, four-option multiple-choice draft content. It is review-gated: an authorised administrator must approve individual questions, the assessment definition and the policy before publication.

| Form family | Forms | Questions per form | Total |
| --- | ---: | ---: | ---: |
| Term 1 entry baseline A | 1 | 12 | 12 |
| Topic baseline A | 4 | 12 | 48 |
| Endline A | 3 at 16; Whole Numbers at 18 | 66 |
| Mastery challenge A | 3 at 16; Whole Numbers at 18 | 66 |
| Independent endline reassessment B | 3 at 16; Whole Numbers at 18 | 66 |
| **Closure-pack total** | **17** | — | **258** |

The pre-existing 26 Sprint 2 candidates remain in the question bank as separate drafts. The closure forms use different question-item codes and do not attach those candidates, avoiding accidental reuse as a reassessment form.

## Curriculum coverage

- Whole Numbers: real-number classification, HCF, ratio/rate, direct proportion, commission, rental and compound growth. The persisted policy marks HCF/LCM, real-number classification, ratio/rate and financial applications as critical. Each Whole Numbers independent form has four independently scored questions for each critical skill, so it has 18 questions and a 30-minute duration. No response is counted for more than one primary skill.
- Integers: addition/subtraction, multiplication, sign reasoning, squares and cube roots. The two critical skills each have at least four items in every 16-question mastery form.
- Exponents: product and quotient reasoning, powers of powers, zero/negative exponents, simplification and error analysis. Scientific notation remains excluded from the critical-mastery sampling.
- Numeric and Geometric Patterns: first differences, nth-term rules, table-style values, joined-square pattern models, justification and rule-error identification.

## Mathematical and structural QA

Each generated candidate has exactly A–D options, one stored key, three distinct distractor labels, a worked-solution field, mapped primary skill, difficulty, and procedural/reasoning classification. The database’s strict four-option validator and the form publication validator reject malformed questions, retired items, insufficient reasoning, and insufficient critical-skill sampling.

The content is **not represented as human-reviewed mathematics**. Before publishing, an authorised administrator must inspect the question preview and worked solution, approve each question through the existing workflow, and resolve every publication-validation error. This is an intentional integrity boundary, not a second reviewer role.

## Publication status

At migration time every closure-pack question and form is `draft`, so nothing is learner-visible. The Admin Assessment route shows exact blockers and a coverage RPC (`get_grade9_term1_assessment_content_coverage`) returns each form’s count and validation result. A form becomes publishable only after the existing authorised-admin approval steps; no seed migration fabricates a review record.

## Independence

Endline A, mastery challenge A and reassessment B have separate item-code ranges. Reassessment B additionally requires an administrator authorisation tied to a completed prior session; the server rejects forms whose published question overlap is 50% or more.
