# Grade 9 Instructional Validation

## Internal audit

The pilot has 15 canonical fine-grained skills, while superseded broad skill rows remain soft-retired for historic evidence. The prerequisite graph remains acyclic and contains the instructional chains for algebraic expressions, factorisation, equations and linear graphs. The diagnostic blueprint contains 18 item-level probes; the Difference of Two Squares activity has ten composed stages; and the misconception taxonomy contains 13 evidence-based patterns.

Questions are immutable versions with one primary skill, optional supporting skills, CAPS cognitive level, activity type, representation, memo, marks, source tier, review state, expected misconceptions and hints where relevant. The active pilot mastery and recommendation rules remain versioned in the existing rule-set tables and are evaluated by pure domain functions.

## Review workflow

Question review now follows this controlled path:

```text
draft/rejected → in_review → approved | rejected | draft (return for revision)
approved → retired
```

`review_question_version_action` is admin-only. Every decision creates an append-only `question_review_events` row with reviewer, timestamp, notes and transition, as well as the existing audit event. The legacy review RPC remains a compatibility adapter. `get_question_version_review_bundle` is an admin-only review packet containing the prompt, answer configuration, memo, skills, metadata, misconceptions, hints, validation errors and history.

No seed item was approved by this work.

## Structural validation

Before approval, `validate_question_version_for_approval` checks active curriculum/item state, an active primary skill, deterministic expected answer, positive marks, memo, diagnostic scoring, contiguous hint levels, and applicable item-family requirements. It also checks that error-analysis, worked-example, faded-example and delayed-retrieval items have the structural signals their activity type promises. These are quality gates, not a claim to automatically prove arbitrary mathematics.

## Gold-standard review set

`get_grade9_gold_standard_review_set()` produces an admin-only review packet for 22 draft items. It spans like terms, substitution, distributive property, common factorisation, Difference of Two Squares, equations, Cartesian coordinates, tables/rules, gradient and linear-relationship comparison.

It includes retrieval, diagnostic, worked and faded examples, independent practice, error analysis, interleaved review, representation translation, investigation and delayed retrieval. Its selection is stored in the report function, so a reviewer receives a stable set rather than an arbitrary query.

## CAPS alignment record

The repository’s [Mathematics curriculum map](../product/MATHS_CURRICULUM_MAP.md) places the represented Grade 9 content as follows:

- Term 2: algebraic expansion/simplification, common-factor/DOTS/trinomial factorisation, algebraic fractions, linear equations and equations by factorisation.
- Term 2: functions/relationships represented through rules, tables and equivalent representations.
- Term 3: linear graphs, intercepts, gradient, drawing graphs and equations from graphs.

The packet records this source version through its curriculum version. It does not quote DBE wording and does not certify any individual question as CAPS approved. A mathematics reviewer must check scope, terminology, expected method, cognitive demand and assumed prerequisites before approval. Any item that is mathematically correct but inappropriate for its claimed Grade 9 skill must be rejected or returned for revision.

## Reviewer checklist

For every item, review:

- Mathematical validity: correct answer, memo, notation and plausible alternative answers.
- CAPS fit: Grade 9 scope, claimed skill, cognitive demand and prerequisites.
- Language: unambiguous wording, low unnecessary reading load and appropriate South African conventions.
- Diagnostic value: useful evidence, plausible misconception link and whether the same wrong answer could have unrelated causes.
- Hints: conceptual-to-explicit progression; no premature giveaway at H1; correct final model.
- Fairness: no unnecessary cultural, contextual or background knowledge.
- Technical metadata: skill links, marks, accepted-answer encoding, activity type, source and review status.

## Synthetic validation matrix

`instructionalValidationHarness.ts` provides 22 deliberate synthetic learner profiles. They vary prerequisite strength, independent/assisted evidence, routine/complex demand, sessions, delayed retrieval, confidence and misconception patterns. The matrix compares expected and actual mastery, recommendation, focus skill and misconception state; it is a regression test.

The profile set includes strong/retained, prerequisite-first equations, DOTS misconception, scaffold dependence, routine-only performance, forgetting, slow accurate and fast inaccurate patterns, high/low confidence cases, contradictory old failure/recent success, misconception resolution and approved-content safety cases.

## Current deterministic handling and limits

- Independence is explicit: assisted success cannot by itself establish secure mastery.
- Multiple occasions and cognitive level feed the existing mastery and recommendation rules.
- Confidence can strengthen a misconception signal, but never directly reduces mastery. Time-on-task is not a mastery input.
- A misconception can move from suspected to confirmed and, after configured corrective independent and delayed evidence, resolved. It is not a permanent learner label.
- Delayed success can establish retained; delayed failure routes to retrieval support.
- The current engine evaluates the evidence set supplied by its caller. It has no built-in recency decay or formal-versus-formative weighting. Evaluation services must deliberately select/cite the evidence window, and a future pilot must validate whether this is educationally sufficient.

Passing synthetic tests demonstrates deterministic correctness, consistency, technical reliability and intended pedagogical behaviour. It does not prove improved achievement, optimal thresholds, optimal diagnostic length, causal intervention effectiveness or external validity for South African learners. Those require a supervised real-learner pilot.

## Delivery and transaction boundary

`get_approved_diagnostic_blueprint` returns no rows unless the blueprint, curriculum and every linked item are approved and active. It returns only ordered question-version ids and purposes; `get_learning_question` then returns only the learner-safe prompt/hint payload. Draft, in-review, rejected and retired content cannot start an activity.

An attempt is stored first through `record_learning_attempt`; tutor evaluation, misconception recording, mastery evaluation and recommendation persistence remain separate audited operations. This avoids a single oversized RPC while preserving cited evidence at each decision. The next orchestration service must treat those steps as a monitored workflow and surface a failed downstream evaluation rather than silently losing it.

The learner runner must supply a UUID idempotency key on every answer submission. A retry with the same key and response returns the original attempt; a key reused with a different response is rejected. This prevents duplicate attempts from falsely strengthening mastery.
