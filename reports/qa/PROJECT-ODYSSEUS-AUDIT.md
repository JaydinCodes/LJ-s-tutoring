# Project Odysseus QA and UI/UX Audit

**Audit date:** 13 October 2026  
**Branch:** `qa/autonomous-audit-2026-10-13` at `e742b0f`  
**Scope:** read-only production sign-in review; synthetic, disposable local-Supabase role journeys; no application code changed.

## Executive summary

The unauthenticated production sign-in page is stable and polished at desktop, tablet, and mobile sizes: all three checks returned HTTP 200 with no browser errors, request failures, or horizontal overflow. The local authorization suite is also strong: 621 pgTAP/RLS checks passed and the synthetic tutor, admin MFA, parent, NGO, and released-results learner flows completed.

Two issues should block confidence in a learning-demo walkthrough: a learner activity remains indefinitely in **“Checking answer…”** when its evaluator is unavailable, and the fixed mobile navigation overlaps a primary session action. The dedicated visual-sweep audit is unusable because it is both outside the configured Playwright test directory and syntactically invalid.

Production authenticated learner review is **not scored**: no credential was securely available in this session. No credential was printed, stored, or used.

## Evidence and checks

| Check | Result | Evidence |
| --- | --- | --- |
| Clean audit worktree created from requested branch | Pass | Sibling checkout; initial worktree status clean at `e742b0f` |
| Production login, desktop/tablet/mobile | Pass | 3/3 HTTP 200; zero console/page/request errors; zero horizontal overflow |
| Build | Pass | `npm run build` |
| Typecheck | Pass | `npm run typecheck` |
| Lint | Pass | `npm run lint` |
| Source/unit contracts | Pass | `npm test`: 450/450 |
| Local database/RLS authorization matrix | Pass | `npm run test:rls:runtime`: 621 tests across 7 files |
| Mock browser suite | Partial | Initial `npm run test:e2e`: 67 tests, 4 failures; serial rerun of the four failures passed 3 and retained 1 admin-login failure |
| Real local-Supabase browser suite | Partial | 8 tests: 5 passed, 2 failed, 1 reset-verification skipped |
| Dedicated visual audit sweep | Blocked | `tests/audit/visual-sweep.spec.ts` is outside configured `testDir`; esbuild reports unexpected `)` at line 114 |
| Pa11y WCAG 2 AA canonical routes | Executed; result not captured | `npm run qa:a11y` completed after serving built output, but this command does not persist a machine-readable result in this checkout |

## Role and route coverage

“Pass” means the stated flow completed in a rendered browser against the indicated surface. “Partial” means at least one core route or state could not complete.

| Role | Routes/workflow actually exercised | Surface and viewports | Status |
| --- | --- | --- | --- |
| Public / unauthenticated | `/dashboard/login` | Production; 1440×1000, 768×1024, 390×844 | Pass |
| Learner | `/dashboard/student`, assignments list/detail, upload/submit, resources, results, progress, attempted learning activity, denied `/dashboard/admin` | Local Supabase desktop; mock desktop/tablet/mobile | Partial — assignments, reports, results, and access denial render; learning activity cannot resolve evaluator response |
| Tutor | `/dashboard/tutor`, classes, submissions/mark release | Local Supabase; mock browser coverage | Pass |
| Admin | `/dashboard/admin`, real TOTP setup/unlock, operational dashboard | Local Supabase; mock browser coverage | Pass locally; mock login regression remains |
| Parent | `/dashboard/parent/reports`, linked released result | Local Supabase; mock browser coverage | Pass |
| NGO partner | `/dashboard/ngo/reports`, aggregate-only cohort report/no learner names | Local Supabase; mock browser coverage | Pass |
| Broad role-route visual matrix | Public + learner + tutor + admin + parent + NGO, 3 viewports | Intended `visual-sweep.spec.ts` | Blocked — test cannot be discovered or parsed |

## Confirmed defects

### QA-01 — Learning activity can remain permanently pending when its evaluator is unavailable

- **Severity:** High
- **Evidence:** Real local-Supabase Golden Demo failed after the learner submitted Question 1. The button stayed disabled as “Checking answer…”. The local `evaluate-learning-attempt` function endpoint returned HTTP 503 because `supabase_edge_runtime_project-odysseus-local` was stopped. See [stuck activity screenshot](screenshots/local-golden-stuck-checking.png) and [initial activity screenshot](screenshots/local-golden-question-desktop.png).
- **Reproduction:** Start the documented local stack with Edge Runtime unavailable; sign in as synthetic Golden Demo learner; open Difference of Two Squares activity; enter an answer and select confidence; choose **Check answer**.
- **Expected:** A bounded failure state that restores the form and gives a retry/support action.
- **Actual:** The primary action stays busy and disabled; the learner has no recovery path.
- **Impact:** A dependency outage blocks a learner in a core lesson and makes the pitch demo unreliable.

### QA-02 — Mobile bottom navigation overlays the next-session action

- **Severity:** Medium
- **Evidence:** At 390px, the fixed bottom navigation covers the “View session details” action in the “Next tutoring session” card. See [mobile screenshot](screenshots/local-student-mobile-bottom-nav-overlap.png).
- **Reproduction:** Open the synthetic learner dashboard at 390×844 with a next session present; inspect the first dashboard viewport.
- **Expected:** Fixed navigation has reserved bottom content space, so card actions remain visible and tappable.
- **Actual:** The navigation is drawn over the action area.
- **Impact:** Learners can miss or be unable to tap a high-value session action on phone.

### QA-03 — The role/viewport visual sweep is not executable

- **Severity:** Medium (release-confidence/QA tooling)
- **Evidence:** `playwright.react.config.ts` limits discovery to `./tests/e2e-react`, while the visual sweep is in `tests/audit`. A direct Playwright invocation reports “No tests found”; parsing the file reports `Unexpected ")"` at line 114.
- **Reproduction:** Run `npx playwright test tests/audit/visual-sweep.spec.ts --config playwright.react.config.ts`; then parse the test with esbuild.
- **Impact:** The advertised 105-route/viewport inspection does not protect responsiveness, browser errors, screenshots, or route availability.

## UX and design observations

- Production login is visually coherent and responsive. Its desktop two-column composition collapses cleanly at tablet and mobile, inputs remain comfortably sized, and no horizontal clipping was observed. Screens: [desktop](screenshots/production-login-desktop.png), [tablet](screenshots/production-login-tablet.png), [mobile](screenshots/production-login-mobile.png).
- The learner dashboard has a purposeful visual identity and a readable action hierarchy, but the mobile first view is dense and repeats the day-plan concept (“Today’s learning plan” followed by “What should I do today?”). Consolidating these would reduce a long initial scroll and improve task focus.
- On the admin dashboard, the display typeface makes the numeral `1` visually close to capital `I` in summary metrics. This is a clarity risk for operational counts; use a tabular/sans numeral style for metrics.
- The student-to-admin denial screen is clear, has an obvious return action, and was rendered successfully. However, its real-Supabase browser test failed only at its captured-runtime-error assertion; the test does not persist the unexpected error payload, so this is a test-observability gap rather than a confirmed authorization defect. See [denial screenshot](screenshots/local-student-admin-denial.png).

## Missing features and blocked tests

| Item | Exact blocker | Consequence |
| --- | --- | --- |
| Authenticated production learner audit | No supplied student credential was accessible as a session secret or environment variable | Production dashboard, assignment, results, and learning states were not tested or scored |
| Local learning-activity completion | `supabase_edge_runtime_project-odysseus-local` is stopped; `POST /functions/v1/evaluate-learning-attempt` returns 503 | Golden Demo completion/responsive sweep cannot finish |
| Full role × route × viewport visual inspection | Test is excluded by `testDir` and has syntax error at line 114 | No reliable 105-case visual/breakpoint gate |
| Mock suite admin login result | One serial rerun failure remains, but generated artifact contains only video, not the assertion/error text | Root cause cannot be confirmed from retained evidence |
| Accessible authenticated role surfaces | Pa11y configuration covers only public/login URLs | No automated WCAG scan of learner, tutor, parent, NGO, or admin content |

For a future read-only production learner audit, set these only in the local shell before starting the audit, never in files or source control:

```powershell
$env:ODYSSEUS_STUDENT_EMAIL = '...'
$env:ODYSSEUS_STUDENT_PASSWORD = '...'
```

## Measured scorecard

| Area | Measurement | Score/status |
| --- | --- | --- |
| Compile/type safety | Typecheck | Pass |
| Source-contract suite | 450 / 450 | 100% |
| Database authorization | 621 / 621 | 100% |
| Production unauthenticated login | 3 / 3 target viewports, no observed browser errors/overflow | Pass |
| Real local role journeys | 5 pass / 2 fail / 1 skipped | Partial (62.5% of defined tests passed) |
| Mock browser journeys | 63 pass / 4 fail initially; targeted rerun: 3 pass / 1 fail | Partial; not stable enough for a release score |
| Responsive visual sweep | 0 / intended 105 cases executable | Not scored — tooling broken |
| Authenticated production learner journey | 0 routes | Not scored — credential unavailable |
| Accessibility | Public/login Pa11y run executed; authenticated roles lack scan coverage | Not scored |

## Ten highest-priority fixes

1. Make `evaluate-learning-attempt` fail fast with a learner-visible retry/error state and re-enable the answer form.
2. Reserve bottom safe-area/navigation space in learner mobile content; regression-test the next-session CTA.
3. Repair and register `tests/audit/visual-sweep.spec.ts` in Playwright so it is parsed and run in CI.
4. Make local Edge Runtime a fail-closed prerequisite for Golden Demo tests; report its status before browser tests start.
5. Persist browser console/network failure details as Playwright attachments so route-test failures are diagnosable.
6. Investigate and fix the remaining mock admin-login test failure; run the mock suite serially once to separate race from application defect.
7. Add authenticated Pa11y/axe coverage for one representative screen per role and critical detail forms.
8. Add visual regression assertions for fixed mobile navigation versus final card controls.
9. Use a distinct numeric font treatment for dashboard metrics and test count legibility at desktop and mobile sizes.
10. Simplify the learner mobile landing page into one primary daily-plan entry point, with secondary work below the fold.

## Pitch-demo rehearsal checklist

- Confirm local Supabase **and Edge Runtime** are healthy before inviting observers.
- Run `npm run demo:reset:local`; verify Golden Demo learner starts on Question 1.
- Open learner dashboard at 1440px and 390px; verify the next-session action is not obscured.
- Rehearse one correct response, one misconception response, retry, and completion; verify no permanent “Checking answer…” state.
- Show tutor review and learner released-feedback result only after the learning activity is proven healthy.
- Demonstrate parent aggregate-safe report and NGO aggregate-only report; do not claim production usage or learner outcomes from synthetic fixtures.

## Screenshot inventory

- [Production login — desktop](screenshots/production-login-desktop.png)
- [Production login — tablet](screenshots/production-login-tablet.png)
- [Production login — mobile](screenshots/production-login-mobile.png)
- [Local Golden Demo — question](screenshots/local-golden-question-desktop.png)
- [Local Golden Demo — stuck pending](screenshots/local-golden-stuck-checking.png)
- [Local learner dashboard — mobile overlap](screenshots/local-student-mobile-bottom-nav-overlap.png)
- [Local learner denied admin route](screenshots/local-student-admin-denial.png)
