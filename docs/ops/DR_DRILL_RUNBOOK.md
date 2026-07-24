# Disaster Recovery Drill Runbook

Frequency: Monthly

> **Stale (2026-07-24):** step 1 below (`npm run migrate --prefix lms-api`,
> `/ready`, `npm run restore:verify --prefix lms-api`) referenced the retired
> `lms-api` service and its DR script, which checked stale/wrong tables and
> was deleted rather than fixed forward. This repo's database is a single
> Supabase-managed Postgres project — restore verification should use
> Supabase's own backup/restore tooling. No replacement drill procedure
> exists yet; see `docs/architecture/PRISMA_TO_SUPABASE_MIGRATION_PLAN.md` §6
> step 7 for context.

## 1) Database Restore Verification (stale, see note above)
1) Provision a clean Postgres instance.
2) Restore the latest production backup.
3) ~~Run migrations: npm run migrate --prefix lms-api~~ (script deleted)
4) ~~Verify /ready returns ok.~~ (endpoint deleted)
5) ~~Run restore verification script: npm run restore:verify --prefix lms-api~~ (script deleted)
6) Attach output as drill evidence.

## 2) Session Integrity Verification
1) Run a sample arcade session (start, score, end).
2) Verify session token validation accepts only signed tokens.
3) Confirm scores appear only when validated.

## 3) Audit Continuity Verification
1) Export audit log from admin console.
2) Check that audit_log records exist for last 24 hours.

## 4) Evidence Logging
- Record timestamps, operator, and outcome.
- Attach logs/screenshots to the DR logbook.
- Attach latest `DR Restore Verify` workflow run reference.

## Rollback Procedure
1) Activate read-only mode for API.
2) Restore DB snapshot to last known good.
3) Re-run migrations.
4) Re-enable API and confirm health endpoints.
