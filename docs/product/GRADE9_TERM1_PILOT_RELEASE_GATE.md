# Grade 9 Term 1 Sprint 4 pilot release gate

**Release-gate branch:** `codex/grade9-term1-sprint4-release-gate`  
**Base:** `codex/grade9-term1-learning-foundation` at Sprint 4 closure PR #123  
**Scope:** v3 misconception-feedback correction, real disposable-Supabase Grade 9 journeys, publication workflow verification, and browser evidence.  
**Last updated:** 2026-11-12

## State definitions

| State | Meaning | Current status |
| --- | --- | --- |
| Implemented | Source, migration, test, or documentation is committed to the release-gate branch. | In progress until PR commit is created. |
| Mathematically reviewed | Explicit verdict for the exact material version. | v2 conditionally reviewed historically; v3 feedback pack pending explicit review. |
| Technically tested | Observed execution against the disposable stack/CI, not a source inspection. | Pending GitHub Actions run. |
| Admin approved | Existing authorised administrator completed the controlled review transition. | Not approved in production. Disposable fixture approval is test evidence only. |
| Published | Learner-visible production publication completed deliberately. | Not published. |
| Pilot-ready | Academic, technical, administrative and risk conditions all met. | Not yet determined. |

## Implemented release-gate changes

- Replaced the inferred distractor-feedback fallback with 76 stable value-keyed maps containing 228 authored explanations.
- Generated additive migration `20261112190000_sprint4_explicit_distractor_feedback_v3.sql`; v1 and v2 question versions are retained.
- Made the selected wrong-option explanation available only after a real activity attempt is submitted and evaluated.
- Added the `grade9-term1-real-journey.spec.ts` suite and fixture setup inside the existing local-Supabase runner.
- Extended the Supabase Playwright configuration and GitHub Actions workflow; the required artifact is `sprint4-grade9-real-journey-evidence`.
- Generated the academic review pack and the feedback semantic-review checklist.

## Required observed evidence

| Check | Expected evidence | Status before CI |
| --- | --- | --- |
| Content QA | 19 lessons, 76 questions, 228 explicit feedback entries, no inference fallback. | Passed locally. |
| Migration rebuild | Additive v3 migration applies after the committed history. | Pending CI/local Docker availability. |
| Publication workflow | Invalid form rejected; questions, lessons, activities, policies and forms approved/published through authenticated admin RPCs in disposable Supabase. | Pending CI. |
| A — New learner | Baseline session, calculated result and next recommendation persist. | Pending CI. |
| B — Weak baseline | Weak evidence, lesson/practice, persisted attempt and updated recommendation. | Pending CI. |
| C — Grade 8 bridge | Evidenced support, bridge activity and original Grade 9 return context. | Pending CI. |
| D — Strong baseline | Challenge becomes available; independent challenge, mastery and roadmap update. | Pending CI. |
| E — Normal endline | Learning activity plus eligible endline awards mastery without compulsory challenge. | Pending CI. |
| F — Failed endline | Weak-skill remediation, original-form lockout and authorised independent reassessment. | Pending CI. |
| G — Persistence | Practice response survives refresh, sign-out/sign-in and resume. | Pending CI. |
| H — Security | Cross-student denial, server-authoritative mastery/publication, draft isolation and protected answers. | Pending CI. |
| Visual QA | Real database-backed 360 px, 390×844 and 1440×900 screenshots. | Pending CI. |

## CI and artifact links

The pull-request CI run and its GitHub artifact URL must be inserted here only after they exist. The required artifact must contain the Playwright HTML report, per-scenario JSON evidence, desktop screenshots, mobile screenshots, and any failure artifacts. A successful simulated visual suite is not substitute evidence for this gate.

## Academic review handoff

Review [the complete v3 academic pack](GRADE9_TERM1_FINAL_ACADEMIC_REVIEW.md) and [the semantic feedback checklist](GRADE9_TERM1_DISTRACTOR_FEEDBACK_SEMANTIC_REVIEW.md). The conditional approval of v2 is historical context only; an explicit v3 verdict is still required before a production administrator approves or publishes the revised questions.

## Controlled pilot activation — authorised administrator only

After an explicit academic v3 verdict and a passing release-gate CI run:

1. Sign in with the existing authorised administrator account; do not alter roles or use raw SQL.
2. Review the v3 questions and their correction note; submit and approve the intended versions through the content-review controls.
3. Approve the related lessons and activities only after their referenced v3 questions are approved.
4. Use assessment publication validation for each intended form; resolve every blocker without reducing critical-skill or reasoning thresholds.
5. Approve policies/forms and publish the immutable forms through the existing publication controls.
6. Verify as a designated test student that only approved content is visible, answers remain protected until allowed release, and the Grade 8 bridge returns to the original topic.
7. Enrol only the small approved pilot cohort. Keep Assignments separate from Learning and do not deploy or auto-publish unrelated production content.

## Current release verdict

**Release gate: FAILED / not yet eligible for pilot.** This is the honest pre-CI state: v3 content awaits explicit academic review and the mandatory real-Supabase scenarios/screenshots have not yet produced observed CI evidence. This document must be updated from CI results, not optimistic assumptions.
