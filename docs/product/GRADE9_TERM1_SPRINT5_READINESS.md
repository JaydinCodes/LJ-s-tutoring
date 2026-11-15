# Grade 9 Term 1 Sprint 5 publication readiness and learning-map record

## Scope and evidence boundary

Sprint 5 investigates why the Grade 9 Term 1 map reported “Content unavailable”, makes the existing activity-review workflow reachable in the content workspace, and replaces the five-item instructional checklist with a learner-scoped visual map.

This report is a repository and disposable-environment readiness record. This workspace has no production Supabase credential or runtime binding, so it did **not** execute `get_grade9_term1_learning_journey_readiness` against project `jscrgpwyniphagitliuz`. It must not be read as a production audit or an instruction to change production data.

## Publication investigation

The unavailable state is intentional review gating, not a frontend failure:

1. `20261112140000_grade9_term1_sprint4_instructional_content.sql` explicitly says the Sprint 4 package remains draft and seeds its 13 Grade 9 lessons, six Grade 8 bridge lessons, 76 guided-practice question versions, and 19 activities as review-gated drafts.
2. Student catalogue, topic, bridge, and journey queries join lessons and activities only where `review_status = 'approved'`. An activity also remains hidden until every linked question version is approved and its item is active.
3. Formal learner forms are exposed only when their definition, immutable form version, and associated policy are approved and the existing server-side eligibility function returns eligible. Structural validation is not publication.
4. The readiness RPC reports each Grade 9 topic as blocked when it has no approved lesson/activity and/or no approved assessment form. It never approves or publishes records.

The authored record distribution is:

| Package | Repository record state | Learner effect |
| --- | --- | --- |
| 13 Grade 9 lessons | Draft, awaiting authorised review transition | No learner-visible explanation or worked example |
| 6 Grade 8 prerequisite lessons | Draft, awaiting authorised review transition | No learner-visible bridge lesson |
| 76 guided-practice questions | Draft review versions | Their 19 activities cannot be approved |
| 19 practice activities | Draft | No learner-visible practice activity |
| 258 formal questions / 17 forms | Structural validation passed; independent academic sign-off and authorised review/publication remain pending | No formal form is made available |
| Associated mastery policies | Existing reviewed-policy gate remains authoritative | No threshold or policy bypass |

### Topic-by-topic repository blockers

| Topic | Lessons | Practice activities | Formal forms | Current blocker |
| --- | ---: | ---: | ---: | --- |
| Whole Numbers | 5 draft | 5 draft | Review/publication-gated | No approved learner content; no approved immutable form |
| Integers | 2 draft | 2 draft | Review/publication-gated | No approved learner content; no approved immutable form |
| Exponents | 3 draft | 3 draft | Review/publication-gated | No approved learner content; no approved immutable form |
| Numeric and Geometric Patterns | 3 draft | 3 draft | Review/publication-gated | No approved learner content; no approved immutable form |

The administrator should run **Admin → Learning content → Grade 9 Term 1 learner readiness** in the target environment to obtain the live count and blockers. The screen now translates the readiness RPC codes into actions a reviewer can understand, and the activity cards list each stage, its linked question review state, and the exact approval dependency.

## Controlled administrative actions still required

The project handover’s academic approval is not a database transition. An authorised administrator must deliberately perform these existing controls in the target environment:

1. Inspect the mathematics lesson, worked example, misconception, and linked questions; submit eligible drafts for review and approve them through the existing review RPCs.
2. Use the activity cards to check that every non-worked-example stage has questions and that every linked question version is approved and active. Then submit and approve the activity through `review_learning_activity_action`.
3. Keep the 258 formal questions and 17 forms behind their existing academic review, policy, validation, immutable-form publication, and eligibility gates. Structural validation does not replace independent academic sign-off.
4. Confirm, using a designated pilot learner, that only the intended approved content appears. Preserve the audit log and use revisions/retirement rather than destructive edits.

No content was approved, published, retired, or mutated in production by Sprint 5.

## Visual learning-map architecture

`LearningMap.tsx` is intentionally a lightweight React/Tailwind map, avoiding a graph dependency. The main map renders the actual Grade 9 Term 1 curriculum-topic order from the existing journey RPC as connected checkpoints:

`Whole Numbers → Integers → Exponents → Numeric and Geometric Patterns`

Each topic is interactive and shows a server-derived state: ready to begin, currently learning, assessment available, needs more practice, mastered, or content awaiting publication. The active checkpoint is visually distinguished; mastered checkpoints use formal-evidence recognition rather than arbitrary completion counts.

The topic map uses `get_my_grade9_term1_topic_learning_map`, a learner-scoped, read-only projection over existing approved content, `learner_activity_progress`, evaluated attempts, `skill_mastery_evaluations`, formal sessions, and `get_my_available_learning_assessments`. It makes the following distinctions explicit:

- Lesson available is a publication state, not proof a lesson was completed.
- Practice attempted and practice completed come from persisted attempts/progress.
- Skill evidence is the existing mastery-evaluation state.
- Topic mastery remains the existing formal topic-mastery decision.

OLA remains the sole recommender. When its persisted recommendation contains `PREREQUISITE_NOT_SECURE`, the map renders a helpful Grade 8 detour and preserves the Grade 9 return topic. The map never infers an unlocked challenge from a client score; it uses the existing assessment eligibility result.

## Accessibility and responsive behaviour

- Topic cards are semantic links, with the current checkpoint exposed through `aria-current="step"`.
- The main map is a compact vertical connector layout on mobile and becomes a connected four-topic grid on larger screens; it does not require a horizontally scrolling canvas.
- Topic skills remain a vertical sequence at every size.
- Existing focus-visible styles apply to all interactive checkpoints.
- The current-checkpoint pulse is disabled when `prefers-reduced-motion` is enabled.
- Unavailable checkpoints are still visible and explain the publication/eligibility requirement without offering a dead-end action.

## Verification record

Completed locally:

- TypeScript typecheck, full lint, production build, static asset performance budget, and `git diff --check`.
- 502 frontend unit tests, plus the focused Grade 9, Sprint 3, Sprint 4, and OLA contract suite (24 tests).
- Grade 9 content QA (13 Grade 9 lessons, six Grade 8 lessons, 76 guided-practice questions, and 19 activities), formal assessment structural QA (258 questions / 17 forms), and the assessment-form QA command.
- 184 static RLS/security contract tests, edge-function policy verification, and the security-definer search-path check.
- The nine-scenario mocked Playwright visual suite at 360 px, 390 px, and 1440 px. It includes the main map, selected/current checkpoint, Integers topic map, Whole Numbers mastery map, Grade 8 branch, and unavailable-content state. The screenshots were manually inspected: desktop connectors are visible between the four checkpoints; mobile stays single-column with no horizontal overflow; map states, the supportive prerequisite detour, formal mastery recognition, and unavailable messaging are legible. These screenshots exercise the committed UI against controlled learner-RPC fixtures, not production data.

Blocked in this workspace:

- Local Supabase migration rebuild, runtime RLS tests, formal form validation runtime path, and authenticated Grade 9 Playwright journeys could not start because Docker was denied the Supabase Postgres image manifest with `Forbidden` during `supabase start`.
- No production database access was configured, so live readiness RPC output and production screenshots were not available.

Before pilot release, rerun the committed local/CI flows against a rebuilt Supabase database and execute the Grade 9 A–H journeys with real persisted evidence. Reconfirm the live readiness RPC output, then capture and manually review the same views against authorised pilot data. A passing browser assertion alone is not a production audit.
