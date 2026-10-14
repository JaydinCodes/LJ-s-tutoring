# Student Portal Product Audit

Audit date: 14 October 2026  
Scope: current `fix/core-learning-integrity-closure` working tree, disposable local Supabase fixtures, mock browser states, and source/data-flow review. Production was not mutated.

## Executive assessment

Project Odysseus is a credible early educational platform, not merely a static dashboard. The strongest implemented loop is the Grade 9 Difference of Two Squares activity: a learner receives a targeted recommendation, answers questions, declares confidence, sees misconception-specific feedback, retries, completes the activity, and sees persisted progress. This path was verified in a real browser against local Auth, Postgres, RLS, RPCs, and the evaluation Edge Function.

The broader product promise is only partially delivered. Assignments, released results, progress, tutor sessions, reports, careers, notifications, and learning activities exist, but the fixture provides deep evidence for one mathematics intervention only. The dashboard is visually distinctive and action-oriented, yet it is dense, terminology is sometimes more product-like than learner-like, and the relationship between school marks, skill mastery, interventions, and future reassessment is not consistently explained.

No P0 learner-data exposure or incorrect result calculation was reproduced. Readiness is conditional: the verified golden journey and role isolation are demonstration-ready when the complete local stack is running, but password recovery, broad curriculum coverage, assistive-technology testing, poor-network recovery, and multiple real learner histories remain insufficiently verified.

## Architecture discovered

- Vite 5, React 18, TypeScript and React Router; this repository is not Next.js.
- TanStack Query for server state.
- Supabase Auth, Postgres/RLS, Storage, RPCs and Edge Functions form the backend.
- Privileged mutations and deterministic learning evaluation stay behind RPC/Edge Function boundaries.
- Student routes are registered in `src/app/App.tsx`; repository functions live under `src/features/students`, `src/features/assignments`, and `src/features/learning`.

## Verification summary

| Area | Result | Evidence |
|---|---|---|
| Password login and session | Pass | Real local Supabase login; refresh retained the learner session. |
| Logout and route protection | Pass in mock browser suite | Logout test passed; real role suite denied student access to admin content. |
| Role/RLS journeys | Pass | Student, tutor, parent, NGO-partner and admin browser journeys passed against local Supabase. |
| Student dashboard | Pass, UX reservations | Recommendation, identity, responsive layout and persisted state verified at 1440/1366/1024/768/390 px. |
| Assignments/submission | Pass in mock suite/source contracts; real mutation not repeated | Existing upload, idempotency, tutor marking and release flows are covered; the full parallel run was resource-starved before a sequential rerun. |
| Results/feedback | Pass | Fresh real student session read tutor-released result and feedback. |
| Learning activity | Pass | Correct, misconception, retry, completion, persistence and progress link verified against real local services. |
| Diagnostic route | Partially verified | Code/data flow reviewed; no complete disposable diagnostic fixture was available for all learner archetypes. |
| Careers/Odie | Partial | Pathway Builder interactions passed with mock data; live AI provider response was not invoked. |
| Password recovery | Missing/unclear | Login offers password sign-in and magic link, but no explicit forgotten-password/reset completion journey. |
| Accessibility | Partial | Labels, headings, focusable controls, touch layouts and contrast browser checks exist; no screen-reader session was performed. |
| Production behavior | Not verified | Public production endpoints were not mutated or authenticated into. |

## Findings

### SP-01 — P1 — Learning submissions can appear indefinitely busy when evaluation is unavailable

- Route/component: `/dashboard/student/learning/activity/:activityCode`, `StudentActivityRoute`, `submitLearningAttempt`.
- Reproduction: run the UI and database without the local Edge Functions runtime; sign in as the golden learner; submit a valid answer.
- Expected: a bounded request ends in a clear retryable error without uncertainty about whether the answer was saved.
- Actual: the button remained on “Checking answer…” beyond the assertion window. The canonical integrated test previously hung at this state.
- Evidence: initial failed runtime screenshot; passing rerun after `npx supabase functions serve`.
- Recommendation: add an explicit client request timeout/cancellation policy and an idempotent “Retry same answer” state. Monitor function availability. The test harness now fails fast when its runtime dependency is absent.

### SP-02 — P1 — Canonical browser QA was unreliable under default workstation parallelism

- Route/component: Playwright/Vite test infrastructure.
- Reproduction: run `npm run test:e2e` on the audited 22-logical-core Windows host using Playwright's default worker count.
- Expected: lazy chunks compile and the 67-test suite exercises product behavior.
- Actual: 11 simultaneous workers starved first-load compilation; 14 tests timed out on blank/login-loading pages while 47 passed and 6 were intentionally skipped.
- Evidence: repeated missing `Email` locator and blank first-load screenshots; sequential/low-concurrency targeted tests pass.
- Resolution: `playwright.react.config.ts` now caps the suite at two workers. A four-worker verification improved the run to 57 passed/4 loading-timeout failures/6 expected skips, but was still not deterministic on this host. This is a QA reliability fix, not a product behavior change.

### SP-03 — P1 — Password recovery is not a complete, explicit learner journey

- Route/component: `/dashboard/login`, `LoginRoute`.
- Reproduction: arrive unable to remember the password.
- Expected: “Forgot password?” starts a clearly named recovery flow and confirms next steps without requiring the learner to understand authentication terminology.
- Actual: “Send magic link” is available after entering email, but no explicit password-reset route or recovery completion UI was found.
- Recommendation: decide whether passwordless sign-in is the recovery policy. If yes, rename and explain it; otherwise implement Supabase recovery and verified reset tests.

### SP-04 — P1 — Mathematics trust is narrow despite strong deterministic foundations

- Route/component: learning authoring/evaluator and approved content catalogue.
- Reproduction: inspect approved fixture content and execute the available golden journey.
- Expected: representative CAPS coverage across grades, subjects, answer types and cognitive levels.
- Actual: the evaluator supports seven answer types and passes extensive unit cases, but real-browser evidence is concentrated on one Grade 9 factorisation activity.
- Recommendation: establish a reviewed CAPS content matrix and golden activities for fractions, equations, graphs/coordinates, numeric tolerance, Mathematical Literacy and Physical Sciences.

### SP-05 — P2 — Dashboard information density competes with the next learning action

- Route/component: `/dashboard/student`.
- Reproduction: view the desktop and mobile dashboard as a first-time learner.
- Expected: current standing, urgent work, reason, and improvement are understandable within seconds.
- Actual: “Needs attention” is useful, but multiple rich surfaces, decorative imagery, battle-plan language and result/mastery summaries require interpretation. School marks and mastery are visually separated but their relationship is not taught.
- Evidence: `evidence/golden-demo/golden-dashboard-1440.png` and `golden-dashboard-390.png`.
- Recommendation: preserve one dominant “Do this next, because…” block; demote secondary analytics; add a one-sentence distinction between school results and demonstrated skill mastery.

### SP-06 — P2 — Learning vocabulary is not consistently learner-centred

- Route/component: dashboard, progress and activity completion.
- Reproduction: follow Dashboard → Learning → activity → Progress.
- Expected: Grade 8–12 learners can explain what each status means and what to do next.
- Actual: terms such as “mastery”, “retention”, “diagnostic signal”, “evidence” and “intervention” are conceptually sound but occasionally exposed without plain-language framing.
- Recommendation: keep domain terminology for tutors; pair learner statuses with concrete descriptions such as “You can do this independently” or “Review this again in a few days.”

### SP-07 — P2 — The complete diagnosis-to-reassessment loop is not visible as one journey

- Route/component: Learning, Progress and Dashboard routes.
- Reproduction: complete the golden activity and inspect the completion/progress screens.
- Expected: learner sees initial need → practice → what changed → scheduled reassessment → new evidence.
- Actual: diagnosis, recommendation, practice, feedback and persistence exist. The reassessment date/criterion and an explicit before-versus-after explanation are not prominent.
- Recommendation: show a compact learning-loop timeline with evidence, not points: “Identified”, “Practised”, “Check again”, “Secure”.

### SP-08 — P2 — Accessibility evidence is incomplete

- Route/component: all student routes.
- Reproduction: review automated semantic/contrast checks and keyboard-focusable controls.
- Expected: WCAG-oriented keyboard, screen-reader, zoom, reflow, reduced-motion and error-announcement verification.
- Actual: labels, landmarks, reduced motion, responsive layouts and contrast contracts are present. Live-region behavior, focus restoration after feedback, 200% zoom and screen-reader announcements were not fully exercised.
- Recommendation: add axe checks to the browser suite and a short manual NVDA/VoiceOver test script for login, navigation, answer submission and errors.

### SP-09 — P3 — Visual identity is distinctive but can become theatrically dense

- Route/component: student shell/dashboard/activity.
- Actual: navy, parchment, gold, editorial serif headings and voyage language create recognizable identity. Large classical art, all-caps eyebrow labels, many rounded containers and ornamental textures can compete with mathematical work.
- Recommendation: reserve illustration and voyage language for orientation/milestones; keep question and feedback surfaces quieter and more worksheet-like.

## Educational philosophy alignment

| Stage | Status | Assessment |
|---|---|---|
| Diagnose understanding | Implemented, narrow evidence | Diagnostic schemas and routes exist; only a narrow real fixture was walked end-to-end. |
| Identify misconception | Implemented for configured patterns | DOTS misconception was recognized without exposing an internal code to the learner. |
| Target practice | Implemented | Dashboard recommendation deep-links to the matching activity. |
| Explain mistakes | Implemented on golden path | Feedback explains why the square-of-a-difference confusion occurs and offers a retry. |
| Reassess | Partial | Retry is immediate; delayed reassessment/retention exists in data logic but was not visible as a coherent learner promise. |
| Demonstrate improvement | Partial | Progress persists, but before/after evidence is not strongly narrated. |
| Communicate to tutor/guardian | Partial | Tutor and parent reporting routes exist and authorization passed; educational interpretation needs deeper content evidence. |

## Evidence index

- `evidence/golden-demo/golden-question-1440.png` — desktop question state.
- `evidence/golden-demo/golden-correct-feedback-1440.png` — correct feedback.
- `evidence/golden-demo/golden-misconception-1024.png` — misconception explanation.
- `evidence/golden-demo/golden-retry-768.png` — tablet retry state.
- `evidence/golden-demo/golden-completion-390.png` — mobile completion.
- `evidence/golden-demo/golden-dashboard-{1440,1366,1024,768,390}.png` — responsive dashboard.

## Limitations

- No production learner account or production mutation was used.
- The live Groq/Gemini-backed AI paths were not exercised.
- File upload was not performed against production Storage.
- Browser testing used Chromium; Safari/WebKit and Firefox were not run.
- No assistive-technology user session or classroom usability study was conducted.
- Learner archetypes A–E were tested chiefly through deterministic evaluator/unit matrices; only the mixed-correctness golden learner was run end-to-end in the real browser.
- The full mock suite's first run was invalidated by excessive parallelism; the verified affected tests were rerun through targeted/real journeys, and worker limits were fixed for the next complete run.

