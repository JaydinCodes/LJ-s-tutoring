# Observability And SLO Baseline

This baseline applies to the current static React + Supabase architecture. The
retired Fastify Prometheus counters, Grafana dashboard, `/metrics`, and `/ready`
probe were removed because validating unused telemetry produced misleading
release evidence.

## Active signals

- **Web availability:** the hourly `Uptime Check` workflow verifies the exact
  versioned `/health.json` body and JSON content type.
- **Supabase availability:** the same workflow verifies Supabase Auth health and
  an authenticated zero-row PostgREST query with the public anon key.
- **Browser/workflow errors:** the production React bundle can report sanitized
  failures to Sentry when its reviewed public DSN and release variables are set.
- **Provider signals:** Supabase and DigitalOcean service dashboards/logs remain
  necessary for platform-side diagnosis; this repository does not manufacture
  equivalent server metrics.

`npm run validate:monitoring` is a source/configuration contract. It validates
that the exact health probes, Sentry privacy controls, React not-found event,
and CI wiring remain present. It is not proof that production variables,
notifications, provider health, or a Sentry project are configured.

## Initial objectives

Until enough real traffic exists to set defensible percentile targets:

- All three scheduled health probes succeed on every hourly run.
- A release introduces no sustained increase in blocking browser errors on
  login or protected role routes.
- P1 signals are acknowledged within 5 minutes during an announced release or
  pilot window and escalated by 30 minutes if unresolved.
- Every production error event includes an environment and release identifier
  while excluding learner content and direct contact data.

Review and replace these objectives with measured service-level indicators once
production traffic and an owned on-call window exist. Do not claim a monthly
availability percentage without retained probe history.

## Required setup and evidence

1. Configure GitHub repository variables `HEALTHCHECK_URL`, `SUPABASE_URL`, and
   `SUPABASE_ANON_KEY` and retain a green dispatched uptime run.
2. Configure and verify the deployment's Sentry browser variables using
   [PRODUCTION_MONITORING_CHECKLIST.md](PRODUCTION_MONITORING_CHECKLIST.md).
3. Confirm the GitHub issue notification path reaches a named human; automatic
   issue creation alone is not acknowledgement.
4. Record deployment SHA/release, provider incident links, relevant request
   identifiers, probe snapshots, and remediation or rollback decisions.

Use [ALERT_RESPONSE_MATRIX.md](ALERT_RESPONSE_MATRIX.md) for first response.
