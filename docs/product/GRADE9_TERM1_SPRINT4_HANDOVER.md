# Project Odysseus — Grade 9 Term 1 Sprint 4 handover

## Delivered

- A canonical, reviewable instructional source at `scripts/grade9-term1-learning-content.cjs`.
- 13 Grade 9 Term 1 lessons across Whole Numbers, Integers, Exponents, and Numeric/Geometric Patterns.
- 6 focused Grade 8 bridges for factors/order, fractions, decimals, integers, exponent basics and pattern rules.
- 76 original guided-practice MCQs with stable codes, hints, worked solutions and distractor feedback; 19 four-question activity sequences.
- Generated additive migration `20261112140000_grade9_term1_sprint4_instructional_content.sql`; its source is the canonical content file, not the migration.
- Objective and common-misconception metadata displayed to learners, full lesson inspection in Admin, and an approved-only Grade 8 bridge route that returns to the original Grade 9 context.
- Content QA plus an instructional review export.

## Assessment publication readiness

The existing 252-question, 17-form formal assessment pack passed its structural QA. Sprint 4 does not auto-approve a policy or form. The existing per-form server validation remains the publication authority, including Whole Numbers critical-skill and reasoning evidence checks. Administrators should use that report to resolve remaining form-specific blockers.

## Verification run

Passed locally:

- `npm run qa:grade9-term1-content`
- `node scripts/assessment-content-qa.cjs`
- targeted Grade 9 foundation, assessment engine, learning journey and Sprint 4 authoring tests (23 passing)
- `npm run typecheck:react`
- `npm run lint:react`
- `npm run build`

Not executed successfully:

- local Supabase reset/migrations and database-backed scenarios A–H
- pgTAP/RLS runtime matrix for this change
- non-intercepted Playwright learner journeys and their screenshots (browser download was blocked; the system-Chromium fallback exhausted artifact space)

The local Supabase startup blocker is documented in the pilot-readiness document. CI should run these after the registry/image access issue is resolved.

## Handover links

- [Instructional review](GRADE9_TERM1_INSTRUCTIONAL_CONTENT_REVIEW.md)
- [Pilot readiness](GRADE9_TERM1_PILOT_READINESS.md)
- [Machine-readable content inventory](GRADE9_TERM1_INSTRUCTIONAL_CONTENT_EXPORT.json)
