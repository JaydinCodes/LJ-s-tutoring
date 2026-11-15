# Sprint 5 Stabilisation and Controlled Pilot Readiness

## Scope and Safety

PR: https://github.com/JaydinCodes/LJ-s-tutoring/pull/128

Base: `main`, Sprint 5 PR #127 (`70ade21`). The stabilisation branch preserves the existing learning map, OLA recommendation logic, three-attempt practice rules, formal-assessment eligibility and server-authoritative mastery. It does not begin Sprint 6.

All database mutations and publication tests target disposable loopback Supabase fixtures. No production student record, content approval, assessment publication, RLS permission or release flag was changed. The forward migration is committed for review, not applied to production. `ODYSSEUS_GRADE9_PILOT_RELEASE_APPROVED` remains unchanged; this PR must not be automatically merged or deployed.

## Scenario E Root Cause

The original failure is observable in [main App CI](https://github.com/JaydinCodes/LJ-s-tutoring/actions/runs/43746591336). A-D and F-H passed; E timed out in `completeActivity()` after its final Continue. The saved screenshot showed Activity complete and four recorded questions.

The polling callback first counted the completion heading, then awaited `textContent()` on the next question's input ancestor. When the final refetch replaced that input with Activity complete between those operations, the nested locator waited for a question that would never appear. It consumed the poll's remaining time before the callback could recheck completion. This is a brittle asynchronous assertion, not proof that persisted learning evidence was lost.

A separate application-state defect was found: completion was a fire-and-forget effect, while the page already claimed completion and updated recommendations. Completion RPC errors were unhandled, and dependent cached journey/progress views could remain stale.

The fix uses persisted `question_version_id`/`attempt_id`, stable `data-question-id` and explicit question/feedback/complete states. The final-question branch waits for the confirmed completed page instead of looking for another input. A completion mutation awaits the authoritative activity and optional retention operations, shows saving/error states, supports retry, and invalidates next-step, mastery, retention, journey and topic-map queries after success. Activity progress still advances only after Continue so feedback is not prematurely discarded. No arbitrary sleeps or timeout increases were added.

## Additional Verified Fixes

- Runner errors are classified as fixture setup, application startup, authentication, database/RPC, browser assertion or artifact collection failures. Playwright JSON supplies scenario status, errors and artifact paths. Missing/skipped scenarios are never passed, and fixture evidence is preserved after Playwright clears its output directory.
- CI retains screenshots, video, trace, error context and structured reports. Traces use retain-on-failure, which works with the real suite's zero retries. Both App CI and Release Gates upload runtime evidence on failure.
- Repeat disposable fixture cleanup follows evidence dependencies and retains the fixture reviewer identity, avoiding unintended updates to immutable approval references.
- Learning Map checkpoints have visible keyboard focus and more legible connectors. Map screenshots are framed around the actual map after viewport resizing.
- The new admin verification exposed an existing Sprint 5 `get_learning_activity_content_catalog()` failure: nested PostgreSQL aggregates made all activity review cards unavailable. Forward migration `20261115130000_sprint5_activity_catalog_stage_aggregation.sql` aggregates question rows per stage before aggregating stages. The signature, administrator guard and grants remain unchanged. Runtime tests cover student denial, nineteen activities, ordered stages, linked question counts and draft approval blockers.
- Question review errors now display the server's validation reason rather than becoming unhandled promises. Failed bundle loads cannot leave a previous bundle associated with a newly selected question. Creating a revision opens the new draft. The admin test preserves rejection of an invalid historical v2 version and approves a new, fully mapped revision of approved v3 content instead of bypassing primary-skill validation.

## Verification Evidence

The [first stabilisation App CI](https://github.com/JaydinCodes/LJ-s-tutoring/actions/runs/43758208291) and [Release Gates](https://github.com/JaydinCodes/LJ-s-tutoring/actions/runs/43758208304) independently passed A-H, Learning Map and the existing role journeys. They failed only the new admin scenario, which revealed the catalog aggregate bug described above. This is before/after evidence for E, not a claim that those complete workflow runs were green.

| Real Grade 9 Scenario | Observed Result |
| --- | --- |
| A: new learner baseline and recommendation | Passed locally and in both initial PR gates |
| B: targeted lesson, practice and feedback | Passed locally and in both initial PR gates |
| C: Grade 8 evidence, bridge and Grade 9 return | Passed locally and in both initial PR gates |
| D: strong baseline, challenge and persisted mastery | Passed locally and in both initial PR gates |
| E: practice, endline and mastery without compulsory challenge | Passed locally; passed in App CI in 10.8 s and Release Gates in 12.2 s |
| F: failed endline and authorised independent reassessment | Passed locally and in both initial PR gates |
| G: refresh and fresh-authentication persistence | Passed locally and in both initial PR gates |
| H: learner isolation, draft/answer isolation and permissions | Passed locally and in both initial PR gates |

Executed checks include `npm run test:e2e:supabase`, typecheck, full lint, frontend unit/source-contract tests, full production build, assessment-bank QA, Grade 9 instructional QA, formal-form QA, migration rebuild, Supabase type/schema checks, SECURITY DEFINER guardrails and Edge Function policy checks. The fresh local database runtime suite passes **716 checks in 11 files** after the catalog repair; the focused journey/catalog slice passes **19 checks**. QA verifies 13 Grade 9 lessons, six Grade 8 bridges, 76 practice questions, 19 activities and 258 formal questions across 17 structurally sufficient forms.

Local limitations are retained as evidence: running draft-dependent RLS tests after fixture approval caused predictable draft/policy conflicts; rerunning after reset passed. Some local browser attempts failed on Vite startup/cold route loading or the local assignment-storage environment. These are not represented as passing executions. CI's isolated runners passed the original role/assignment workflows.

Final PR checks and the post-repair admin result must be green before technical stabilisation is declared complete. The current status is available on the PR's Checks tab; the completion record below is updated only from observed results.

## Learning Map UX

Real-Supabase Playwright covers 360 px, 390 px and 1440 px, with screenshots named `sprint5-learning-map-*` and `sprint5-topic-skill-map-*` inside the uploaded evidence. Topic order is Whole Numbers, Integers, Exponents, Numeric and Geometric Patterns. Checks cover the selected checkpoint, no mastery from practice alone, persisted practice/skill evidence, keyboard focus and entry, reduced motion, and document-width overflow. E also checks persisted completed practice and formal mastery on the topic map. C verifies the Grade 8 branch and return context. Existing visual scenarios cover content-awaiting-publication states.

The initial mobile viewport screenshot framing was inadequate and was corrected to capture the full map element. Only justified focus/connector changes were made; the application and Learning Journey layout were not redesigned.

Initial CI screenshots, page context and failure traces: [real-journey evidence](https://github.com/JaydinCodes/LJ-s-tutoring/actions/runs/43758208291/artifacts/14179880169). These artifacts include A-H and the real responsive maps even though the admin scenario failed. Final artifact links are recorded below after verification.

## Admin Publication Readiness

Disposable fixtures exercise the existing authorised review RPCs for 19 lessons, 76 practice question versions, 19 linked activities, four policies and formal definitions/forms. They record readiness before and after review and require database publication validation. An invalid draft form publication is rejected on a fresh fixture; an already-approved repeat-run check is explicitly not-run, not a synthetic success.

The authenticated admin browser scenario inspects lesson objectives/worked examples, linked stage/question approval blockers, individual immutable question-version review transitions, formal question previews, all seventeen Grade 9 publication validations and eligible immutable fixture publication. The catalog repair restores the existing activity-review pathway; it does not introduce a bypass.

Academic boundaries remain separate: the project's designated reviewer has academically reviewed the 19 instructional lessons and 76 practice questions. Discussion approval is not a database transition. The full 258-question formal bank has **not** received complete independent academic sign-off. Functional fixture approvals do not provide that sign-off and do not authorise production publication.

An authorised administrator still must inspect the intended production versions, explicitly review/approve the academically approved instructional questions and lessons, then approve each linked activity after its dependencies pass. Formal questions, policies, definitions and immutable forms require all applicable independent academic and database approvals before publication. Recheck topic-specific blockers in Admin Learning Content and Assessment Management in the target environment.

## Production Verification

The shared public page at https://student.projectodysseus.live/dashboard/login loads the sign-in form. No authenticated production learner or read-only production database session was supplied, so deployment of the Learning Map RPC and authenticated Learning page are **not verified**. Source compatibility is not proof that production project `jscrgpwyniphagitliuz` is up to date.

The frontend calls `get_my_grade9_term1_topic_learning_map` with `{ p_topic_code: string }`. Committed migration `20261115120000_sprint5_learning_map_projection.sql` supplies `public.get_my_grade9_term1_topic_learning_map(p_topic_code text) returns jsonb`, stable, SECURITY DEFINER with an empty search path and a current-student check.

An authorised operator can run these read-only SQL checks in the production SQL editor:

```sql
select current_database(), current_user;

select to_regprocedure('public.get_my_grade9_term1_topic_learning_map(text)') as learning_map_rpc,
       to_regprocedure('public.get_learning_activity_content_catalog()') as activity_catalog_rpc;

select p.oid::regprocedure as signature,
       pg_get_function_result(p.oid) as result_type,
       p.provolatile, p.prosecdef, p.proconfig,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       pg_get_functiondef(p.oid) as deployed_definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_my_grade9_term1_topic_learning_map', 'get_learning_activity_content_catalog');

select version, name
from supabase_migrations.schema_migrations
where version in ('20261115120000', '20261115130000')
order by version;
```

Expected map signature/result: `(p_topic_code text)` / `jsonb`; authenticated execute true, anon false, stable volatility `s`, restricted search path. Compare the deployed activity catalog definition with the forward repair; the stage aggregate must use `stage_data`, not nested aggregate calls. Migration-history rows alone are insufficient without the deployed function definition.

After a separately reviewed migration deployment, use a designated production pilot account to open Learning and each topic, confirm successful map RPC responses and persisted states, and inspect Admin readiness read-only. Do not invoke review/publish functions during verification. Keep deploy-on-push disabled and the pilot release flag opt-in; a green PR is not release approval.

## Pilot Readiness Verdict

Technical pilot readiness requires all eight real journeys, the responsive map, admin workflow and complete required CI to pass on this PR. Production pilot release remains **not authorised** until live RPC/deployment checks and deliberate instructional publication are complete. Formal assessments remain blocked pending complete independent academic sign-off and all existing publication requirements. No merge or deployment has been performed.

## Final Completion Record

Post-repair CI/admin verification and final screenshot artifact links: pending at the time this document was first written. Replace this sentence only after observing the completed required checks.