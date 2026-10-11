# Golden Demo backup plan

## Presenter disclosure

If the live environment is unavailable, say: **“The live demo is unavailable, so I’ll show the same verified local Golden Demo journey as screenshots.”** Do not imply that screenshots are live.

## Fallback sequence

Use the screenshots in this order at the same pace as the live demonstration:

1. `01-dashboard.png` — Lethabo has a coherent Grade 9 profile, school-result context, progress, and one clear action: Difference of Two Squares.
2. `02-targeted-activity.png` — the recommendation leads to a real Grade 9 factorisation activity.
3. `03-misconception-feedback.png` — `(x - 5)^2`, entered with high confidence, receives an explanation of the difference-of-squares pattern rather than only an incorrect mark.
4. `04-correct-retry.png` — `(x - 5)(x + 5)` is correct; say explicitly that the first answer remains evidence.
5. `06-learning-progress.png` — the skill is shown alongside other states; explain that a retry is not automatically mastery.

Use `05-activity-complete.png` only if time permits, to show that answers/confidence evidence were saved and the journey continues. Use `07-school-result-vs-progress.png` only where it is visually clean enough to explain the distinction.

## Failure-specific actions

| Failure | Action |
| --- | --- |
| Wi-Fi fails | Use the local screenshots from the presentation machine; do not attempt a web recovery during the pitch. |
| Local Supabase does not start | Use the screenshot sequence and say it is the verified local-demo capture. |
| Browser session expires | Use screenshots; do not enter credentials on the projector. |
| Projector scaling is poor | Switch the deck to 16:10/1440×900 fit mode, enlarge the product slide, and narrate the next screenshot rather than shrinking browser UI. |

## Pre-flight checklist

- Store the screenshot pack in the deck asset folder and offline on the presentation machine.
- Verify every image is 1440×900 and uses only Lethabo’s synthetic fixture data.
- Open the image files locally before the event.
- Rehearse both the live and screenshot paths to the same 2–3-minute timebox.

## Current capture status

The capture process is defined in `SCREENSHOT_INDEX.md`. Do not mark this backup as operational until the seven images have been captured and visually checked at 100% scale.
