# Grade 9 Term 1 Sprint 4 pilot release gate

**Release-gate branch:** `codex/grade9-term1-sprint4-release-gate`
**Pull request:** [#124](https://github.com/JaydinCodes/LJ-s-tutoring/pull/124)
**Observed CI run:** [App CI 43697944135](https://github.com/JaydinCodes/LJ-s-tutoring/actions/runs/43697944135) on `a6a38da`
**Observed:** 15 November 2026
**Scope:** v3 misconception-feedback correction, formal-form publication validation, disposable-Supabase Grade 9 journeys, browser captures, and controlled pilot evidence.

## Release states

| State | Meaning | Current status |
| --- | --- | --- |
| Implemented | Source, additive migrations, fixtures, tests and review materials are committed. | Yes. |
| Mathematically reviewed | Explicit academic verdict for this exact version. | Sprint 4 v3 instructional content is recorded as academically approved in the project handover; the 258 formal assessment questions/forms still require comprehensive independent academic sign-off. |
| Technically tested | Observed execution, rather than source inspection. | Yes — the disposable Supabase run passed. |
| Admin approved | Existing authorised administrator completed a deliberate production review transition. | No. Fixture-admin workflow passed only in disposable data. |
| Published | Learner-visible production publication completed deliberately. | No. |
| Pilot-ready | Academic, technical and production-administration gates are all complete. | No — pending formal-assessment academic sign-off, authorised production approval/publication, and release-owner review of the attached screenshots. |

## Sprint 5 overlay

Sprint 5 does not change this release verdict or authorise a production transition. Its [publication investigation and learning-map record](GRADE9_TERM1_SPRINT5_READINESS.md) identifies review-gated drafts—not a learner-page defect—as the reason current topics show unavailable content. It adds the missing activity-review controls and learner-scoped map projection while keeping formal assessments behind the existing academic review and immutable-form publication gates.

## Observed technical evidence

- [App CI 43697944135](https://github.com/JaydinCodes/LJ-s-tutoring/actions/runs/43697944135) passed: build, lint, typecheck, unit tests, instructional-content QA, assessment-content QA, form validation, mocked smoke tests, disposable Supabase migration rebuild, schema guardrails, runtime RLS, real learner journeys, browser captures, and Edge authorization checks.
- The real-data job rebuilt the database exclusively from committed migrations and authenticated fresh Grade 9 fixture students. It did not connect to production.
- The job completed 17 Playwright tests with one intentionally skipped reset helper; all eight mandatory Grade 9 scenarios A–H passed.
- The normal admin RPC workflow was exercised in the fixture: invalid publication was rejected; fixture question/lesson/activity/policy/form records were approved through authorised paths; valid forms were published through `publish_learning_assessment_form`; ordinary-student publication was denied.
- Instructional QA passed: 13 Grade 9 lessons, 6 Grade 8 bridges, 76 practice questions, 19 activities, and 228 explicit distractor explanations.
- Formal assessment QA passed: 258 questions across 17 forms. Each independent Whole Numbers endline, mastery challenge and reassessment has 18 questions over 30 minutes, with four distinct primary-skill samples for each persisted critical skill: real-number classification, HCF/LCM, ratio/rate, and financial applications.

## Real Grade 9 learner evidence

| Scenario | Observed result | Persisted/runtime evidence |
| --- | --- | --- |
| A — New learner | Passed | Authenticated Grade 9 learner submitted the Integers baseline and received a server-derived next recommendation. |
| B — Weak baseline | Passed | Weak baseline, lesson, tailored incorrect-answer feedback, corrected practice response, and evaluated activity evidence were observed. |
| C — Grade 8 bridge | Passed | Evidenced prerequisite weakness routed to the approved bridge; retry-safe bridge evidence persisted and the Integers return context was preserved. |
| D — Strong baseline | Passed | Strong baseline unlocked an independent challenge; challenge completion persisted server-authoritative mastery and roadmap progression. |
| E — Normal endline | Passed | Guided practice plus eligible endline awarded mastery without a compulsory challenge. |
| F — Failed endline | Passed | Failed endline recorded remediation, blocked the original form, and allowed only an administrator-authorised independent reassessment. |
| G — Persistence | Passed | Guided-practice state survived refresh, cleared browser storage, a new authenticated session, and resume. |
| H — Security | Passed | Cross-student access and student publication were denied; draft questions and premature answers were withheld. |

## Visual evidence

The same real-data suite captured learning dashboard, topic roadmap, baseline introduction, active assessment, result, lesson/worked example, incorrect and correct feedback, completed practice, Grade 8 bridge, mastery achievement, next-topic return, and no-content/error states. It exercised 360 px, 390 × 844, and 1440 × 900 viewports and asserts no horizontal overflow before capture.

- [Sprint 4 Grade 9 real-journey artifact](https://github.com/JaydinCodes/LJ-s-tutoring/actions/runs/43697944135/artifacts/14155077723) — uploaded successfully (221,826 bytes; SHA-256 `11bfb6ee3c970a17bad510dd02644311430e0633d1c9086adda82be937359a9a`; 14-day retention).
- The managed workspace was denied access to the Azure Blob download URL (`Forbidden`), so a human pixel-level inspection of the uploaded images was not performed from this workspace. The screenshots were created by passing browser tests and uploaded by CI; a release owner with GitHub artifact access must review them before inviting learners.

## Academic review handoff

The Sprint 4 v3 instructional-content handover records academic approval, but that handover does not create database review records. An authorised administrator must still use the normal lesson/question/activity review transitions. The [complete v3 academic pack](GRADE9_TERM1_FINAL_ACADEMIC_REVIEW.md) and [semantic feedback checklist](GRADE9_TERM1_DISTRACTOR_FEEDBACK_SEMANTIC_REVIEW.md) remain review material. The 258 formal assessment questions/forms have only passed structural validation; obtain independent comprehensive academic sign-off before any administrator approves policies/forms or publishes immutable forms.

## Controlled pilot activation — authorised administrator only

After formal-assessment academic sign-off and release-owner screenshot review:

1. Sign in with the existing authorised administrator account; do not alter roles or use raw SQL.
2. Review and approve the intended v3 questions, then the lessons and activities that reference them, using the existing content-review controls.
3. Use assessment publication validation for every intended form. Resolve blockers without reducing critical-skill or reasoning thresholds.
4. Approve the associated policies/forms and deliberately publish the immutable approved form versions through the existing publication controls.
5. Confirm as a designated pilot student that only approved content is visible, answer release remains protected, and the Grade 8 bridge returns to the original topic.
6. Enrol only the authorised small pilot cohort. Keep Assignments separate from Learning; do not deploy or auto-publish unrelated production content.

## Current release verdict

**Technically passed, but not pilot-ready.** The release gate has observed real-data evidence, but production remains deliberately unpublished. The remaining release conditions are independent academic sign-off for the formal assessment bank, authorised administrator approval/publication in the target environment, and human review of the attached real-data screenshots.
