# Grade 9 Term 1 pilot readiness

## Current verdict: technically validated, not ready to pilot

Sprint 4 supplies the corrected instructional package, learner bridge delivery and administrative review surface. The release-gate branch adds v3 explicitly authored distractor feedback and a dedicated real Grade 9 journey suite. It does **not** publish content automatically. The managed workspace remains unable to download some Supabase/browser artifacts, but GitHub Actions successfully ran the required real-data evidence against a disposable stack. Do not treat a merged pull request as a production release.

## Release states

| State | Current position |
| --- | --- |
| Authored | Corrected v3 lessons/practice, bridge route, form matrix, review metadata, QA and documentation are authored. |
| Tested | [App CI 43697944135](https://github.com/JaydinCodes/LJ-s-tutoring/actions/runs/43697944135) passed migration rebuild, RLS, Edge authorization, all A–H Grade 9 journeys, browser captures, QA, lint, typecheck and build. |
| Mathematically reviewed | v2 was conditionally reviewed historically; v3 requires the designated ChatGPT reviewer’s explicit verdict. |
| Admin approved | No new lesson, practice question, activity, policy or assessment form is approved by this change. |
| Published | None. Production delivery remains off until authorised administrators publish reviewed records. |
| Ready for pilot | No — real CI evidence exists, but v3 academic approval, release-owner screenshot review, authorised production approval and controlled publication remain required. |

## Administrator-controlled publication

1. Apply migrations in a disposable/staging Supabase environment.
2. Run `npm run qa:grade9-term1-content` and `npm run qa:grade9-term1-assessment-forms`; inspect both JSON exports.
3. In **Admin → Learning content**, inspect each lesson, question and activity.
4. After the designated mathematics review verdict, submit and approve v3 question drafts and the relevant lesson/activity drafts; approve activities only once every linked question is approved.
5. Use the existing assessment-management publication validation for each individual baseline, endline, challenge and reassessment form. Resolve blockers; never weaken policy thresholds to publish a form.
6. Approve the relevant mastery-policy revision, then publish valid form versions through the existing admin controls.
7. Sign in as a disposable student and confirm that only approved lessons, activities and assessment forms are visible.

## Required real-data verification before release

Scenarios A–H were executed successfully by [App CI 43697944135](https://github.com/JaydinCodes/LJ-s-tutoring/actions/runs/43697944135) against a fresh disposable Supabase database. The run captured database-backed 360 px, 390 × 844 and 1440 × 900 screenshots and uploaded [the Grade 9 journey artifact](https://github.com/JaydinCodes/LJ-s-tutoring/actions/runs/43697944135/artifacts/14155077723). The CI runner created and uploaded the images; this managed workspace could not download the Azure Blob artifact for manual pixel review, so that release-owner review remains outstanding. No production-publish result is claimed here.

See [the Sprint 4 closure record](GRADE9_TERM1_SPRINT4_CLOSURE.md) for the original correction history and [the current release gate](GRADE9_TERM1_PILOT_RELEASE_GATE.md) for CI evidence, v3 academic review, and the activation checklist.

Sprint 5 adds the repository-level [publication investigation and learning-map record](GRADE9_TERM1_SPRINT5_READINESS.md). It confirms that the learner-empty state is review gating in the authored database records—not a frontend assumption—and documents the remaining authorised review and publication actions. It is not a production database audit.

## Security and rollback

- The learner catalogue and bridge RPCs return approved content only, never answers or drafts.
- The existing server-side activity, assessment, policy and RLS controls remain authoritative.
- Roll back before publication by not approving/publishing the drafts. After a migration deployment, retire the affected lesson/activity/form through authorised admin controls; do not delete learner evidence or immutable published question versions.
- If a defect appears in published material, create a revised draft, review it, publish the replacement under the existing versioning workflow, and retain the audit trail.
