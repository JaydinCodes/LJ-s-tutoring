# Screenshot index

**Capture contract:** use the real local Supabase Golden Demo fixture only, at **1440 × 900** browser viewport, with no browser chrome, devtools, console, credentials, or non-synthetic data. The target activity is `ACT.G9.ALG.FACTOR.DOTS.CONTRASTING-PRACTICE`.

## Capture status

Run `npm run demo:reset:local`, then `npm run demo:capture:pitch`. The capture runner refuses a non-local Supabase URL, uses only the synthetic Lethabo fixture, verifies no horizontal overflow, records unexpected runtime errors as a failure, and writes seven browser-chrome-free 1440×900 PNGs to `docs/pitch/screenshots/`.

| Filename | Screen | Audience should notice | One-line talking point | Recommended slide | Backup/demo relevance | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `01-dashboard.png` | Lethabo Mokoena, Grade 9 dashboard | Needs attention: Difference of Two Squares; learning progress; latest school result. | “The learner has a clear next action in the context of a broader academic profile.” | Demo start / optional slide 7 | First fallback image | Captured and visually reviewed |
| `02-targeted-activity.png` | Difference of Two Squares Practice before submission | `Factorise: x² − 25` is a real learning task, not a dashboard suggestion. | “The recommendation leads straight into targeted practice.” | Demo / optional slide 6 | Second fallback image | Captured and visually reviewed |
| `03-misconception-feedback.png` | Incorrect `(x − 5)²`, Very sure, learner-friendly explanation | The explanation contrasts a difference of squares with a square of a binomial. | “We are not only recording that an answer is wrong; we are retaining evidence about the approach.” | Slide 5 | Primary fallback image | Captured and visually reviewed |
| `04-correct-retry.png` | Correct retry `(x − 5)(x + 5)` | The learner applied the contrasting pattern correctly. | “The correction is valuable evidence, but it does not erase the first response.” | Demo / optional slide 6 | Fourth fallback image | Captured and visually reviewed |
| `05-activity-complete.png` | Real Activity complete screen | Answers and confidence evidence are saved; next actions/progress are updated. | “The interaction is persisted as part of a continuing learning record.” | Optional slide 7 | Optional fallback image | Captured and visually reviewed |
| `06-learning-progress.png` | Progress route with Difference of Two Squares and other skill states | Difference of Two Squares is not labelled Strong understanding after the activity. | “Progress represents accumulated evidence; one corrected answer is not mastery.” | Slide 6 | Fifth fallback image | Captured and visually reviewed |
| `07-school-result-vs-progress.png` | Clean combined dashboard/progress view, if readable | School-result context and granular learning-progress states are visibly distinct. | “School results are academic outcomes; learning progress is evidence about specific skills.” | Slide 3 or 6 | Optional fallback image | Captured and visually reviewed |

## Capture sequence

1. Start local Supabase, reset the database, and run `npm run demo:reset:local`.
2. Run the Vite app against the local stack; sign in using the synthetic Lethabo fixture.
3. Capture `01` at the initial dashboard and `02` at Question 2 before submission.
4. Submit `(x - 5)^2` with **Very sure**; capture `03`.
5. Retry with `(x - 5)(x + 5)`; capture `04`.
6. Complete Questions 3–4; capture `05`, then Progress for `06` and, if presentation-readable, `07`.
7. Inspect every image at 100% and remove/re-capture any image with browser chrome, debug content, loading/error UI, or private data.
8. Reset the local fixture after capture.
