# Grade 9 Term 1 pilot readiness

## Current verdict: not ready to pilot

Sprint 4 supplies the corrected instructional package, learner bridge delivery and administrative review surface. The release-gate branch adds v3 explicitly authored distractor feedback and a dedicated real Grade 9 journey suite. It does **not** publish content automatically. The local Supabase journey run remains blocked by a registry image-pull failure; GitHub Actions is the required execution environment for the real-data evidence. Do not treat a merged pull request as a production release.

## Release states

| State | Current position |
| --- | --- |
| Authored | Corrected v3 lessons/practice, bridge route, form matrix, review metadata, QA and documentation are authored. |
| Tested | Local content QA, assessment form validation, TypeScript and lint are observed; real database/browser evidence remains pending CI. |
| Mathematically reviewed | v2 was conditionally reviewed historically; v3 requires the designated ChatGPT reviewer’s explicit verdict. |
| Admin approved | No new lesson, practice question, activity, policy or assessment form is approved by this change. |
| Published | None. Production delivery remains off until authorised administrators publish reviewed records. |
| Ready for pilot | No — requires real local/CI Supabase journey evidence, content approval and controlled publication. |

## Administrator-controlled publication

1. Apply migrations in a disposable/staging Supabase environment.
2. Run `npm run qa:grade9-term1-content` and `npm run qa:grade9-term1-assessment-forms`; inspect both JSON exports.
3. In **Admin → Learning content**, inspect each lesson, question and activity.
4. After the designated mathematics review verdict, submit and approve v3 question drafts and the relevant lesson/activity drafts; approve activities only once every linked question is approved.
5. Use the existing assessment-management publication validation for each individual baseline, endline, challenge and reassessment form. Resolve blockers; never weaken policy thresholds to publish a form.
6. Approve the relevant mastery-policy revision, then publish valid form versions through the existing admin controls.
7. Sign in as a disposable student and confirm that only approved lessons, activities and assessment forms are visible.

## Required real-data verification before release

Run Scenarios A–H from the Sprint 4 brief against a fresh local or CI Supabase database: new learner baseline; remediation; Grade 8 bridge return; strong learner challenge; qualifying endline; failed endline/reassessment; persistence; and RLS/answer-protection checks. Capture desktop and 390×844 mobile evidence from those non-intercepted runs.

The attempted local run on 12 November 2026 could not start Supabase: Docker was available, but the configured registry returned `Forbidden` while fetching `supabase/postgres:15.8.1.085`. The bundled Playwright visual suite also could not produce an artifact: its browser download is blocked by the environment CDN policy, and a system-Chromium retry ran out of available artifact space. No real-database result, screenshot or production-publish result is claimed here.

See [the Sprint 4 closure record](GRADE9_TERM1_SPRINT4_CLOSURE.md) for the original correction history and [the current release gate](GRADE9_TERM1_PILOT_RELEASE_GATE.md) for CI evidence, v3 academic review, and the activation checklist.

## Security and rollback

- The learner catalogue and bridge RPCs return approved content only, never answers or drafts.
- The existing server-side activity, assessment, policy and RLS controls remain authoritative.
- Roll back before publication by not approving/publishing the drafts. After a migration deployment, retire the affected lesson/activity/form through authorised admin controls; do not delete learner evidence or immutable published question versions.
- If a defect appears in published material, create a revised draft, review it, publish the replacement under the existing versioning workflow, and retain the audit trail.
