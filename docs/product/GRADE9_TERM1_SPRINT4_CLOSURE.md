# Grade 9 Term 1 Sprint 4 closure

## Current recommendation: not yet pilot-ready

This closure corrects the identified mathematics defects, records a formal-assessment blueprint matrix and makes the no-content Learning action non-clickable. It does not fabricate a mathematics approval, database publication or real-data journey result.

## Explicit release state

| State | Instructional content | Formal assessments | Pilot |
| --- | --- | --- | --- |
| Authored | v2 draft authored | 17-form bank authored | Fixture/test plan authored |
| Tested | Source QA and regression tests | Source QA and blueprint matrix | Local runtime is environment-blocked |
| Mathematically reviewed | Pending designated ChatGPT verdict | Pending designated ChatGPT verdict | Not applicable |
| Admin approved | No | No | No |
| Published | No | No | No |
| Pilot-ready | No | No | No |

## Corrected review package

- [Instructional review](GRADE9_TERM1_INSTRUCTIONAL_CONTENT_REVIEW.md)
- [Corrected instructional export](GRADE9_TERM1_INSTRUCTIONAL_CONTENT_EXPORT.json)
- [Assessment publication matrix](GRADE9_TERM1_ASSESSMENT_PUBLICATION_MATRIX.json)
- [Assessment review export](GRADE9_TERM1_ASSESSMENT_CONTENT_EXPORT.json)

The corrected instructional export is the package for the designated ChatGPT mathematics review. It must receive an explicit verdict before an administrator moves draft content through the normal approval workflow.

## Assessment interpretation

Whole Numbers has five instructional areas. The draft policy’s critical skills are real-number classification, HCF/LCM, and ratio/rate; direct/inverse proportion and financial applications remain sampled but are not silently counted as duplicate critical evidence. Every independent Whole Numbers form now has four questions for each critical skill, two or more questions for each remaining area, at least two reasoning questions, and a 25-minute recommended duration. Topic baselines remain diagnostic and do not establish mastery without the independent challenge/endline evidence required by the policy.

The matrix reports structural sufficiency only. Every form still reports database publication blockers until the existing approval RPCs approve its definition, policy and question versions. It never labels a draft form publishable.

## Real-data and visual evidence

No real-Supabase Journey A–H run or non-intercepted Sprint 4 screenshot is claimed by this branch yet. The managed environment cannot pull `supabase/postgres:15.8.1.085` (`Forbidden`); the prior system-Chromium visual fallback also exhausted artifact space. GitHub Actions already starts a disposable local Supabase stack and runs database/RLS/browser gates; this branch adds the content and assessment gates to that workflow, and its PR run is the next evidence source.

## Administrator activation checklist after academic approval

1. Apply migrations in staging and run the review-export and assessment-matrix commands.
2. In Admin → Learning content, inspect and approve the v2 lessons and question versions; do not approve the v1 corrections by mistake.
3. Approve only activities whose linked v2 questions are approved.
4. In assessment management, inspect the publication validation result for every definition, approve the policy revision/questions/definition, then call the existing publication control.
5. Use a disposable Grade 9 student to verify the published learner path, bridge return route, answer redaction and reassessment authorisation.
6. Capture the non-intercepted desktop and mobile artifacts in CI before inviting the controlled pilot cohort.

Production data is not changed by this branch, and production publication/deployment is not automatic.
