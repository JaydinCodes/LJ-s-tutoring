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

## Sprint 2 closure — 8 November 2026

### Retake eligibility and history

`20261108120000_grade9_term1_assessment_closure.sql` closes the completed-form restart gap. A standard formal definition now permits one completed session per learner; an active session is resumed, and a previously used idempotency key returns its original session rather than manufacturing a new attempt. A new key is rejected after completion.

Reassessment is a separate, review-gated Form B definition with a controlled administrator authorisation record. The authorisation is single-use, records its reason and author, checks the prior completed attempt, rejects already-mastered learners, and rejects insufficiently independent forms. Sessions retain their attempt number, immutable form-version reference and reassessment reason. Existing sessions and topic decisions remain append-only history.

### Critical skills and reasoning

The evaluator now persists `topic_mastery_evaluation_skill_evidence`, including independent formal-question count, correct count, achievement, and sufficient/insufficient/below-threshold state for every mapped skill. The pilot default is 80% overall, 75% in every critical skill, four independently scored questions per critical skill, and 80% reasoning achievement with configurable reasoning evidence count.

It distinguishes inadequate sampling from weak performance. Qualified Assignment evidence is still cited only through the existing controlled skill-level qualification record; it cannot substitute a single aggregate assignment percentage for formal critical-skill evidence, and previously cited Assignment evidence is not counted again.

### Expiry transaction repair

Saving after the authoritative database deadline no longer finalises then raises an exception. It finalises as `timed_out` and returns successfully; the learner UI refreshes the session and displays the durable result. Finalisation locks the session, writes result rows idempotently, and preserves saved answers, so concurrent expiry/submit/refresh paths score exactly once.

### Form and content inventory

The closure pack supplies 17 draft forms and 252 original formal candidates: one 12-item entry baseline; four 12-item topic baselines; four 16-item endlines; four 16-item mastery challenges; and four independent 16-item reassessment forms. The full inventory, coverage map and review boundary are in [GRADE9_TERM1_ASSESSMENT_CONTENT_QA.md](GRADE9_TERM1_ASSESSMENT_CONTENT_QA.md).

### Administration and publication

The Admin Assessment route now displays exact publication blockers, manages draft durations and solution release as before, configures the critical-skill threshold and minimum independent samples, previews question metadata, and provides a controlled reassessment-authorisation action. Published policies/forms remain immutable; a policy revision is still required for changes to an approved policy.

### Verification and security

Executed locally on the closure branch: React type-check; the full frontend unit suite (487 passing); the focused assessment-contract suite (7 passing); React lint; production build and static-asset verification. The database test plan now covers the closure schema/functions, and frontend contract tests cover the 14/16-style high-total/weak-critical-skill outcome.

Local Supabase migration reset, pgTAP/RLS journeys and generated-type verification did **not** run: Docker rejected the `supabase/postgres` image download with `Forbidden`, leaving no local database container. This is an environment limitation, not a passing result. The closure PR must run the committed-migration rebuild, pgTAP/RLS runtime suite, type generation and browser/mobile journeys in GitHub CI before release. The historical PR #117 GitHub checks passed App CI, QA, Release Gates, Security Stack and Lighthouse CI, including Supabase RLS runtime; those results do not substitute for checks on this closure PR.

### Outstanding release gate

The content remains unpublished until authorised administrators complete the existing mathematical review and publication workflow. That is the only content-publication blocker; it is not a new mandatory reviewer role. Sprint 3 may proceed only after this branch’s CI and runtime database checks pass, generated types are regenerated from the applied migration chain, and the administrator has either published validated forms or explicitly scheduled their review.
