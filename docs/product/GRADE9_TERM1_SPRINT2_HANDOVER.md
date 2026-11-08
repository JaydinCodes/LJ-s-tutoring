# Grade 9 Term 1 Assessment Engine — Sprint 2 Handover

**Status:** Implemented as a review-gated assessment-delivery foundation. No authored Grade 9 Term 1 question or formal form is published by this sprint.

## What Sprint 2 adds

Sprint 2 extends the existing Learning architecture rather than replacing it:

- `question_items` and immutable `question_versions` remain the canonical bank. The existing strict multiple-choice validator remains the quality gate.
- OLA v1 remains the selector for reviewed learning activities. It is not used to mark or time formal work.
- `learning_attempts` remains skill-level formative evidence. Formal work has its own session layer so one formal answer cannot masquerade as repeated practice evidence.
- `topic_mastery_policies`, `qualifying_assignment_mastery_evidence`, and the existing content-admin review workflow remain the configuration and Assignments boundary from Sprint 1.

The migration adds immutable form snapshots, server-authoritative timed sessions, append-only answer-event history, per-question result evidence, and append-only topic-mastery evaluations. A session records the immutable form version and a policy-input snapshot; its original expiry is retained even if an authorised administrator extension is granted.

## Formal assessment contract

| Type | Availability and outcome |
| --- | --- |
| Entry baseline | Available as a broad Term 1 diagnostic; it creates no topic-mastery decision. |
| Topic baseline | Always available for its topic, including when prerequisite evidence is unknown. It produces placement evidence only. |
| Endline | Requires a completed topic baseline. It may establish mastery when all policy requirements are met. |
| Mastery challenge | Requires the latest baseline to meet the configured strong-baseline recommendation. It is an alternate route to an endline, not an extra mandatory hurdle after a qualifying endline. |

Unknown prerequisite evidence never fails eligibility. Known prerequisite gaps remain a targeted OLA/remediation recommendation, not a global lock. A learner cannot start another mastery route after an append-only evaluation has already established the topic as mastered.

On each formal question the learner can revise their selection while the server session is active, but only the final one of `A`–`D` is scored. The browser supplies neither marks, answers keys, deadline nor policy thresholds. The server marks immutable question versions after submit/expiry and uses the database clock. A retry uses caller-supplied UUID idempotency keys, and all answer changes are retained in `learning_assessment_session_answer_events`.

## Topic mastery decision

For an endline or mastery challenge, the evaluator writes one `topic_mastery_evaluations` record with cited result and qualified-assignment evidence. It tests:

1. overall formal assessment achievement;
2. coverage of every critical skill;
3. at least two independently correct mathematical-reasoning items; and
4. configured reasoning achievement.

The policy thresholds remain configurable pilot values: 80% overall, 100% critical coverage, 80% reasoning achievement, 90% strong baseline. The two-reasoning-item rule was chosen to avoid a single lucky response standing in for mathematical reasoning evidence; it remains educator-reviewable rather than a universal claim.

Assignments remain separate. Only an administrator-created `qualifying_assignment_mastery_evidence` row, for an approved opt-in policy and released marked submission, can contribute to critical-skill or reasoning coverage. Generic assignment percentages never enter the evaluation.

## Administration and publishing

The new Admin **Assessments** route configures duration, stable question order, solution-release policy, approved question choices, and policy thresholds/skill classifications. It uses existing review status transitions. Publication:

1. requires an approved assessment definition, approved mastery policy, and approved non-retired strict four-option question versions;
2. validates critical-skill and reasoning coverage and protects against substantially overlapping live forms;
3. snapshots form questions before making a form available to students.

Published configurations cannot be edited. The admin route can create a cloned assessment revision or policy version. Replacing a policy retires the previously active policy atomically; historical forms, sessions, evidence and decisions retain their old IDs and snapshots. The new form revision must be linked to the new approved policy before publication.

Solution feedback is absent while a session is in progress. An `after_submission` form releases its selected-answer feedback and stored worked solution only after finalisation; `never` continues to withhold it. A `manual` form additionally requires the audited, content-admin `release_learning_assessment_form_solutions` action before the redacted learner-session RPC includes it.

Authorised extensions are intentionally a narrow admin RPC with a required reason and bounded additional minutes. The learner cannot extend their own deadline; the original deadline, old expiry, authoriser and reason remain auditable.

## Content state and quality assurance

Sprint 2 seeds authored draft candidates for all four topics plus Grade 9 ratio/rate and financial-application skills. The scientific-notation extension remains supplementary. The draft bank includes four options, a single key, distractor explanations, primary skill mapping, difficulty and reasoning classification, but no candidate is auto-approved or learner-visible.

The current draft candidates are mapped only to topic-baseline configuration drafts. Sprint 3 content work must author and educator-review parallel endline and mastery-challenge forms before any formal assessment is published. This is deliberate: content coverage cannot be inferred from an unreviewed draft bank.

## Deployment and verification handover

- Apply `20261107120000_grade9_term1_assessment_engine.sql` after the Sprint 1 foundation migration, then `20261107130000_grade9_term1_assessment_drafts.sql`.
- Production deployment now includes the existing `evaluate-learning-attempt` Edge Function, keeping the established learning evaluator in the deployment set. The formal-session scorer is a transactionally controlled database function; no duplicate evaluator Edge Function was introduced.
- Regenerate `supabase/types/public.generated.ts` from the migrated target before a production release. The new frontend repository deliberately uses narrow RPC adapters until generated types can be synchronized.
- Run the database suite, including `supabase/tests/database/grade9_term1_assessment_engine.test.sql`, against an actual local or CI Supabase instance. It covers new tables, RLS, RPC privileges, snapshots, draft gating, and the new curriculum skills. Add fixture-driven end-to-end cases for expiry, idempotent saves, cross-learner access, extension audit, endline mastery, challenge mastery, and qualified Assignment evidence before publishing a form.

## Known limitations

- No Sprint 2 Grade 9 Term 1 questions, forms, videos, or learning activities are published; mathematical/CAPS review is still required.
- The draft pack does not yet make a parallel reviewed endline/challenge form available.
- Runtime migration and RLS execution must be repeated in CI or a developer environment with the Supabase Postgres image available. The current cloud workspace cannot pull that image because its registry request is denied.
- Generated Supabase database types have not been regenerated in this workspace for the same unavailable local database reason.
