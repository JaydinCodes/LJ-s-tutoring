# Grade 9 Term 1 Learning Journey — Sprint 3 Handover

**Status:** Implemented as a review-gated, self-paced learner journey. It is not a claim that Grade 9 Term 1 content is published or production-ready.

## Architecture overview

Sprint 3 connects, rather than replaces, the existing systems:

- `get_my_grade9_term1_learning_journey()` is the learner-safe orchestration read model. It derives state from the existing formal assessment sessions and evaluations, OLA activity selector, retention checks, learning activity progress, approved content, and learner-owned context.
- OLA remains the deterministic selector for approved activity support. Formal assessment availability remains entirely controlled by `learning_assessment_eligibility` and the existing Sprint 2 start RPC.
- `topic_mastery_evaluations` and `skill_mastery_evaluations` remain separate evidence records. The React UI does not calculate mastery from page visits, practice time, or video views.
- `student_learning_journey_context` is a minimal RLS-protected cursor for selected Grade 9 topic, focus skill and return origin. It never duplicates assessment scores or mastery.

No generative-AI dependency, new assessment timer/scorer, parallel mastery table, or duplicate practice engine was introduced.

## Student routes and journey flow

| Route | Implemented behaviour |
| --- | --- |
| `/dashboard/student/learning` | One dominant **Continue learning** action, four-topic Term 1 roadmap, evidence-derived status, compact academic progress and targeted Grade 8 support only when a prerequisite recommendation exists. |
| `/dashboard/student/learning/topic/:topicCode` | Five-stage learner roadmap: baseline, concepts, practice, endline, mastery/next step. A valid Term 1 roadmap remains visible even when lessons and forms are not published. |
| `/dashboard/student/learning/activity/:activityCode` | Reuses the established three-attempt, hint-aware, persisted practice experience. Practice invalidates the journey query after evidence changes; it does not award topic mastery. |
| `/dashboard/student/learning/assessment/*` | Reuses the Sprint 2 server-timed assessment introduction, session, answer saving, results and solution-release controls. Starting or submitting invalidates the journey query. |

The topic context button allows a learner to choose a current topic without locking exploration of the others. It is server-persisted and scoped to the authenticated student.

## Decision contract and precedence

The database contract returns primary action, topic statuses, selected/current topic, current focus, learner-safe reason codes, activity/assessment identifiers, available assessment alternatives, prerequisite recommendation, last progress timestamp and content availability.

The precedence is deterministic:

1. resume an active formal session;
2. resume an unfinished approved activity (including a targeted Grade 8 bridge); 
3. offer due retrieval;
4. offer an eligible entry/topic baseline before remediation when baseline evidence is absent;
5. offer an eligible mastery challenge from a strong baseline;
6. follow OLA for known prerequisite gaps, repeated misconceptions and focused practice;
7. offer an eligible endline;
8. return an explicit `NO_APPROVED_CONTENT` fallback.

Mastered topics are represented as status only, never as a new mastery-challenge action. A selected topic breaks ties only among equally eligible topic choices. Unknown prerequisites are not treated as failed prerequisites.

## Grade 8 prerequisite support and retention

OLA reason codes are surfaced only when an existing open recommendation identifies a `PREREQUISITE_NOT_SECURE` condition. The dashboard then shows the specific approved bridge activity, optional matching approved resource, and a return route to the learner's saved Grade 9 topic. It does not render a compulsory Grade 8 course or lock unrelated topics.

Due retention checks still use the existing retention RPC and activity route. They are presented as optional review, preserve the learner context, and have no Journey-imposed deadline.

## Lessons, practice, assessments and history

Reviewed explanations, worked examples, curated videos and approved activities continue to be supplied by the existing review-gated catalogue. The topic UI never fabricates an activity, video or formal assessment for draft-only content.

Formal result screens continue to show only the learner-safe result payload from Sprint 2. Existing invalidation now keeps the dashboard state fresh after an assessment starts/submits and after practice evidence is recorded. Immutable form snapshots, attempts, policies, topic evaluations, skill evidence and controlled Assignment evidence remain untouched.

## Administrator readiness view

The existing **Admin → Learning content** page now includes a Grade 9 Term 1 learner-readiness report. For each topic it shows approved lesson/activity counts, published formal-form count, draft definition count and precise blockers such as `NO_APPROVED_LESSON_OR_ACTIVITY` and `NO_PUBLISHED_ASSESSMENT_FORM`.

It is read-only, content-admin-authorized, contains no learner records and cannot approve or publish content. Existing question, activity, lesson, video and assessment publication workflows remain the only publication path.

## Content publication boundary

Sprint 2's 252-question / 17-form formal bank remains draft-only. Sprint 3 intentionally does **not** publish questions, forms, lessons or videos. A learner sees an accurate content-unavailable state until an authorized administrator completes the existing mathematical/CAPS review and explicit publication steps.

The new database runtime fixture creates isolated approved objects only inside a rolled-back test transaction; it cannot publish fixture or production material.

## Local validation commands

```sh
npm run typecheck:react
npm run lint:react
npm run test:frontend:unit
npm run assessment:content:qa
npm run build
npm run supabase:start
npm run supabase:reset
npx supabase test db
npm run supabase:types:check
npm run test:e2e:supabase
npm run test:e2e
```

Run `npm run supabase:docs:update` after a migration. The local stack is required for the migration rebuild, pgTAP runtime tests, generated-type check and real-auth browser journeys.

## Test evidence for this branch

| Check | Result in this workspace |
| --- | --- |
| React typecheck | Passed |
| React lint | Passed |
| Focused journey unit tests | Passed (3 tests) |
| Full frontend unit suite | Passed: 492 tests |
| Repository RLS/security contract suite | Passed: 184 tests |
| Assessment content QA | Passed: 252 questions across 17 forms |
| Schema inventory update/check | Passed |
| Security-definer search-path and Edge Function gateway policy checks | Passed |
| React production build and static-asset verification | Passed |
| Local Supabase start/rebuild, pgTAP/RLS, generated types, real-auth and Playwright | Not run: the cloud Docker registry denied the `supabase/postgres` image download with `Forbidden` |

`supabase/tests/database/grade9_term1_learning_journey_runtime.test.sql` is a real-claims, database-backed test added for CI/local Docker. It exercises active formal-session resume, baseline selection from a server-published test fixture, selected-topic persistence, four-topic retrieval and cross-student context isolation. It is not reported as passed until it executes in a Supabase runtime.

## Implemented vs tested vs published vs production-ready

- **Implemented:** unified server journey contract, context persistence/RLS, dashboard and topic roadmaps, targeted prerequisite support, progress invalidation, administrator readiness view and test coverage.
- **Tested locally:** only the successful checks listed above.
- **Published:** no Grade 9 Term 1 learner content or formal form is published by this branch.
- **Production-ready:** conditional. Code release still requires this PR's clean Supabase migration/type/pgTAP/RLS/runtime browser gates to pass. Learner release additionally requires authorized content approval and publication; no reviewer approval has been invented.

## Sprint 4 recommendations

1. Run and preserve the clean Supabase runtime evidence in CI before release.
2. Complete authorized mathematical/CAPS review and publish only forms/lessons that pass the existing gates.
3. Add an authenticated mobile Playwright journey against a published disposable fixture before real learner publication.
4. Expand reviewed Grade 9 Term 1 lesson/activity coverage using the existing content workflow, rather than bypassing it with generated or static client content.
