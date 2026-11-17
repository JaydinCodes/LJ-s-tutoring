# Project Odysseus — Student UX redesign

## Goal

Give a Grade 9 learner one connected route: understand the next step, learn one skill, practise it, take an eligible formal assessment, understand the result, and continue.

This change intentionally does not alter assessment eligibility, academic mastery thresholds, review states, server-owned timers, answer release, activity completion, evidence attribution, misconception mappings, hints, or idempotency.

## Visual audit before implementation

### Evidence and limitation

The repository's existing visual-QA journey was inspected. Before/after browser screenshots were captured from the actual rendered React routes at 360px, 390px and 1440px using the controlled learner fixture. The before suite ran from an isolated `origin/main` worktree (9 scenarios); the redesigned branch ran 12 scenarios. I inspected the complete before and after contact sheets, including the lesson and bridge screens rather than treating their topic introductions as lessons.

The following local-runtime checks were also attempted:

- `npm run supabase:start` — blocked while Docker tried to retrieve `supabase/postgres:15.8.1.085`; the image-config download was refused with `Forbidden`.
- `npx playwright install chromium` — blocked because `cdn.playwright.dev` returned `403 Domain forbidden`. A supported system Chromium at `/usr/bin/chromium` was then used successfully for the browser suite.

The managed environment has a restricted network policy and exposes no callable Cloud Desktop NodeREPL tool. The browser captures use the app's controlled RPC fixture, so they validate rendered UI and responsive layout but are not substituted for the still-blocked real-Supabase release gate.

### Issues found

| Screen / step | UX issue before | Design response |
| --- | --- | --- |
| Learning home | The same topics appeared in a journey map, catalogue cards, diagnostics, mastery cards, and assessment grid. The dominant action was surrounded by competing cards. | One next-step action, a small current-focus/progress line, one four-topic roadmap, and secondary disclosure only. |
| Topic overview | Every lesson explanation, worked example, video and practice block was expanded on one long topic page. | The overview is a compact pathway; each skill opens a focused lesson route. |
| Lesson / worked example | Teaching content had no dedicated learner space and required scanning a topic card. | A single-skill lesson has Understand, See an example, Try it yourself, and optional support. |
| Practice | Progress, question, nested feedback cards, hints and confidence UI competed for attention. Completion returned to generic dashboard/progress surfaces. | A one-question player, compact progress, readable prompt/options, concise feedback, and direct continuation to Learning. |
| Incorrect response | Several nested warning/explanation cards made immediate recovery hard to scan. | One inline feedback surface uses authored distractor feedback first, then a clear Try again action. |
| Assessment introduction | Rules and decorative framing could push the start action down on mobile. | Purpose, question count, time and Start assessment are all before a collapsed rules disclosure. |
| Assessment session | Timer, progress, choices, review and navigation were visually separate dashboard panels. | A compact assessment header, touch-friendly choices, visible saved state, answer review, and explicit submit confirmation. |
| Results | Raw topic-mastery vocabulary and detailed evidence appeared before a learner recommendation; next action returned to the dashboard. | A learner-facing result summary appears first, names strongest/build-next skills, and links directly to a lesson or next topic. Details are disclosed. |
| Grade 8 support | The bridge used the old full-card lesson pattern. | It reuses the focused lesson pattern and keeps an explicit Grade 9 return route. |

## Learner journeys

1. **New learner:** Learning home → choose a roadmap topic → baseline introduction → focused assessment → learner-facing baseline result → recommended lesson.
2. **Guided learning:** Topic pathway → focused lesson → worked example → one-question practice → contextual feedback → Learning next step.
3. **Prerequisite support:** Relevant Grade 8 support link → focused bridge lesson → practice → return to the originating Grade 9 topic.
4. **Strong baseline:** Assessment result → mastery challenge when server eligibility exposes it.
5. **Topic completion:** Guided work → eligible endline → mastery result → next available topic.
6. **Interrupted work:** The existing persisted `learner_activity_progress` / session contracts continue to restore the first unattempted question or server-owned assessment session.

## Screen inventory

| Screen | Route / state | New primary focus |
| --- | --- | --- |
| Learning home | `/dashboard/student/learning` | One Continue Learning action and four-topic roadmap |
| Topic overview | `/learning/topic/:topicCode` | Status, recommended action, compact skill pathway |
| Lesson | `/learning/topic/:topicCode/lesson/:skillCode` | Understand, worked example, linked practice |
| Grade 8 bridge | `/learning/bridge/:skillCode` | Short prerequisite support and return path |
| Practice | `/learning/activity/:activityCode` | One question, hint/confidence, feedback/retry |
| Assessment introduction | `/learning/assessment/:definitionId` | Purpose, count, time, start action |
| Assessment session | `/learning/assessment/session/:sessionId` | Timer/progress, choices, saved answers, final confirmation |
| Assessment result | Submitted or timed-out session | Achievement, meaning, strength, build next, direct action |

## Reusable learning UI

`LearningExperienceDesignSystem.tsx` provides:

- `PrimaryNextStep`
- `LearningProgressHeader`
- `FocusedLessonSection`
- `WorkedExample`
- `PracticeQuestionFrame` and `PracticeFeedback`
- `AssessmentNavigation`
- `LearnerResultSummary`
- `LessonStartLink`

The palette remains Odysseus navy, cream/parchment, aegean and gold. Surfaces reduce nested containers and shadows; visible controls retain at least 44px practical touch targets.

## Accessibility

- Semantic progress bars expose current/maximum values.
- Practice feedback uses `aria-live="polite"`.
- Question options use native radio controls and grouped accessible labels.
- Every typed response has an associated label and accessible answer name.
- Keyboard-operable links, native buttons, radio choices, `details` disclosures and focus-visible styles are retained.
- Motion for the progress fill has a `motion-reduce` fallback; no new essential animation was added.
- Layouts use one-column mobile defaults and only expand at `sm`, `lg`, and `xl`; automated visual captures target 360px, 390px and 1440px.

## Browser artifact plan

`tests/e2e-react/sprint3-learning-journey-visual-qa.spec.ts` captures these named images under Playwright's preserved output:

- `baseline-introduction`, `baseline-question`, `baseline-result`
- `focused-lesson`
- `practice-incorrect-feedback`, `guided-practice-complete`
- `grade8-bridge-lesson`, `grade8-prerequisite-branch`
- `mastery-result`, topic-roadmap states, home states, and unavailable-content state

The current app CI already uploads `test-results/**/sprint3-visual-qa/` as the `sprint3-learning-journey-visual-qa` artifact for 14 days. Set `SPRINT3_VISUAL_QA_CAPTURE=before` on `main` to obtain the matching baseline set; the local audit used that mode in an isolated `origin/main` worktree.

## Verification performed

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint:react` | Passed |
| `npm run test:frontend:unit` | Passed |
| `npm run build:react` | Passed |
| Real-Supabase fixture journey | Blocked by refused Supabase image pull |
| Mobile/desktop Playwright screenshot run | Passed — 12 rendered fixture journeys, 35 after captures inspected |

## Remaining issues / release gate

1. Re-run the real-Supabase learner journeys in an environment permitted to pull the Supabase image; do not substitute mocked RPC scenarios for that release check.
2. Re-run the expanded Playwright suite in PR CI and retain the existing `sprint3-learning-journey-visual-qa` artifact alongside the baseline capture from `main`.
3. Verify live approved content supplies a direct skill match for each assessment recommendation; the result UI has a safe topic-pathway fallback if it does not.
4. No database migration, review-state update, publication action, mastery-policy change, production deploy, or merge is included in this change.
