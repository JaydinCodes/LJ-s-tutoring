# Grade 9 Term 1 Sprint 4 closure

## Current recommendation: technically validated, not yet pilot-ready

This closure corrects the identified mathematics defects, records a formal-assessment blueprint matrix and makes the no-content Learning action non-clickable. It does not fabricate a mathematics approval, database publication or real-data journey result.

## Explicit release state

| State | Instructional content | Formal assessments | Pilot |
| --- | --- | --- | --- |
| Authored | v2 draft authored | 17-form bank authored | Fixture/test plan authored |
| Tested | Content QA and regression tests passed | 17-form matrix and publication validation passed in disposable CI | Real A–H journeys, RLS and browser capture passed in disposable CI |
| Mathematically reviewed | v2 conditional verdict historical; v3 explicit verdict pending | Pending policy/form content approval | Not applicable |
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

Whole Numbers has five instructional areas. The persisted policy’s critical skills are real-number classification, HCF/LCM, ratio/rate and financial applications; direct/inverse proportion remains essential sampling rather than duplicate critical evidence. Each independent Whole Numbers endline, mastery challenge and reassessment now has 18 questions, a 30-minute duration, four distinct primary-skill questions for every critical skill, and the required reasoning evidence. Topic baselines remain diagnostic and do not establish mastery without independent challenge/endline evidence.

The matrix reports structural sufficiency only. Every form still reports database publication blockers until the existing approval RPCs approve its definition, policy and question versions. It never labels a draft form publishable.

## Real-data and visual evidence

All real-Supabase Journey A–H scenarios passed in [App CI 43697944135](https://github.com/JaydinCodes/LJ-s-tutoring/actions/runs/43697944135). The job rebuilt a disposable database from committed migrations, passed runtime RLS and Edge authorization, and captured real-data mobile/desktop screenshots in [the Sprint 4 artifact](https://github.com/JaydinCodes/LJ-s-tutoring/actions/runs/43697944135/artifacts/14155077723). The workspace could not download that Azure Blob artifact for manual pixel inspection; screenshot review remains a release-owner task. No production data, deployment or publication is claimed.

## Administrator activation checklist after academic approval

1. Apply migrations in staging and run the review-export and assessment-matrix commands.
2. In Admin → Learning content, inspect and approve the corrected v3 question drafts and the relevant lessons; retain v1/v2 records as historical versions.
3. Approve only activities whose linked v3 questions are approved.
4. In assessment management, inspect the publication validation result for every definition, approve the policy revision/questions/definition, then call the existing publication control.
5. Use a disposable Grade 9 student to verify the published learner path, bridge return route, answer redaction and reassessment authorisation.
6. Capture the non-intercepted desktop and mobile artifacts in CI before inviting the controlled pilot cohort.

Production data is not changed by this branch, and production publication/deployment is not automatic.
