# Sprint 3 Visual QA & UX Refinement

Date: 2026-11-09

## Scope and evidence

This review used the actual Vite application in Chromium, not a source-only render. The Playwright visual suite provisions isolated, test-only learner responses by intercepting only local `127.0.0.1` RPC calls; it does not create, publish, or modify production learners or content.

The suite captures 390 × 844 and 1440 × 900 viewport images and checks that the document does not horizontally overflow. Passing images are retained and uploaded by App CI as the `sprint3-learning-journey-visual-qa` artifact for 14 days. Its source is `tests/e2e-react/sprint3-learning-journey-visual-qa.spec.ts`.

## Screens inspected

| Journey state | Desktop | Mobile | Browser result |
| --- | --- | --- | --- |
| New learner with no evidence | Captured | Captured | Passed |
| Student-selected topic / baseline | Captured | Captured | Passed |
| Baseline introduction and start | Captured | Captured | Passed |
| Weak prerequisite recommendation | Captured | Captured | Passed |
| Guided-practice feedback and completion | Captured | Captured | Passed |
| Strong baseline / mastery challenge | Captured | Captured | Passed |
| Successful mastery result and roadmap | Captured | Captured | Passed |
| Return to unfinished learning | Captured | Captured | Passed |
| Unavailable topic content | Captured before and after | Captured before and after | Passed |

The purpose-built visual fixture completes a test-only guided-practice activity but deliberately does not mark practice as formal mastery evidence. Existing real-local-Supabase Golden Demo coverage remains a separate database-backed journey when the runtime is available.

## Findings and corrections

| Severity | Finding | Correction |
| --- | --- | --- |
| High | A selected topic could still be displaced by the generic entry baseline. | An additive migration now promotes an eligible selected-topic baseline only when the previous primary action was the topic-less entry baseline. Resumable work remains higher priority. |
| High | A roadmap rendered completion ticks for every step whenever a topic was mastered, and ticked the baseline merely because a topic was not `not_started`. | The UI now shows a tick only for actual evidence: baseline evidence at step 1 and a recorded mastery decision at step 5. Lessons and practice remain unticked guidance. |
| Medium | The unavailable-topic empty state contained a second “Back to Learning” action while the page already exposed the same navigation. | Removed the duplicate action. The persistent “All learning topics” navigation remains, and the unavailable explanation no longer offers “Make this my current topic.” |
| Medium | The Learning landing page opened with two large hero panels competing for attention. | Removed the generic second hero. The evidence-based “Continue learning” panel is now the single visual priority. |
| Low | The mobile result view naturally scrolls under the fixed bottom navigation. | The shell already reserves bottom safe-area padding. No control was hidden at the end of the document; retain this as a manual-device observation. |

## Before and after observations

Before the fix, the mastery-topic roadmap displayed five check icons despite only the formal mastery decision being evidenced. After the fix, the same scenario displays the baseline and mastery checks only. Before the fix, the unavailable mobile topic screen showed both the persistent topic-list link and a second empty-state action; after the fix it presents a single clear return path and an explicit publication-status explanation.

The CI artifact contains the post-fix image set at:

```
test-results/**/sprint3-visual-qa/after/<scenario>-390.png
test-results/**/sprint3-visual-qa/after/<scenario>-1440.png
```

## Test results actually run locally

- `typecheck:react` — passed.
- `lint:react` — passed.
- `node --test tests/frontend/grade9-term1-learning-journey.test.cjs` — passed (3 tests).
- Chromium / actual Vite app: new learner, selected topic, baseline start, prerequisite support, guided-practice completion, mastery challenge, successful mastery result, unfinished-learning return, and unavailable-topic paths — passed in individually bounded Playwright runs at both viewports.
- Local Supabase start — not available: the required `supabase/postgres:15.8.1.085` pull was denied with `Forbidden`. No runtime database, local auth, or real local fixture records were created.

## Remaining limitations

- The managed executor blocks the Playwright CDN and the local Postgres image, so the complete runtime-Supabase visual fixture must run in GitHub Actions. App CI already has the required local-Supabase runtime gate; this PR also uploads visual screenshots on success.
- The structured visual fixture is intentionally local/intercepted. It does not replace authenticated RLS, database, or Golden Demo journey testing.
- A physical handset check remains useful for final touch-target and dynamic keyboard behaviour, although the 390 px Chromium run found no horizontal overflow in the inspected screens.
