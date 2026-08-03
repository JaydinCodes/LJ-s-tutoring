# Alert Response Matrix

## Purpose

Define first-response actions for the signals the current static React +
Supabase architecture actually emits. Do not use retired Fastify `/ready`,
request-counter, database-maintenance, or restore-verification alerts as current
production evidence.

## Severity

- **P1:** outage, authentication failure, suspected unauthorized access, or
  severe degradation affecting users.
- **P2:** material degradation with a usable workaround and no evidence of data
  exposure.
- **P3:** warning or release-readiness signal for business-hours investigation.

## Matrix

| Signal | Severity | First action (0-5 min) | Follow-up (5-30 min) | Owner |
|---|---|---|---|---|
| Exact `/health.json` contract, Supabase Auth health, or zero-row PostgREST probe fails | P1 | Pause promotions; inspect the `Uptime Check` run and test each failing endpoint independently | Compare the deployed revision and provider status; roll back a recent web revision or escalate to Supabase as evidence requires | Release lead + platform owner |
| Supabase Auth or PostgREST errors block sign-in or a role dashboard | P1 | Preserve timestamps/request IDs, check Supabase service health and recent migration/deploy activity | Hold or roll back the responsible change; rerun the real-auth role journeys before promotion resumes | Platform owner + application owner |
| Suspected cross-role or cross-organization data access | P1 | Disable the affected feature/onboarding path and preserve evidence; do not test with uncontrolled learner data | Start security incident handling, identify affected records/accounts, rotate exposed credentials, and prove the repaired RLS allow/deny matrix | Security lead + data owner |
| Browser error-monitoring spike on a critical route | P1 when blocking, otherwise P2 | Compare release/environment tags and the first failing route; check for a matching Supabase response | Roll back if tied to the release; otherwise assign a bounded remediation and monitor recovery | Application owner + release lead |
| Release database reset, pgTAP, generated-type drift, or real-auth browser gate fails | P3 release blocker | Do not promote; retain the failing logs and reproduce from the committed migration chain | Add an immutable forward migration or application fix, regenerate reviewed types if schema changed, and rerun all dependent gates | Change owner + reviewer |
| Required uptime repository variable is missing | P3 release blocker | Set `HEALTHCHECK_URL`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` to reviewed production public values | Dispatch the uptime workflow and retain a green run before release approval | Repository administrator |

## Escalation and evidence

- Escalate any unresolved P1 after 30 minutes to the named security/release
  authority and service owner.
- Treat two related P2 incidents in 24 hours as a reliability review trigger.
- Record UTC timestamps, commit/deployment identifiers, workflow run links,
  provider incident links, request IDs, scope/impact, and the rollback or
  mitigation decision.
- A created GitHub issue is notification evidence, not proof that a human
  acknowledged the alert. Repository owners must configure and test their
  notification path.
