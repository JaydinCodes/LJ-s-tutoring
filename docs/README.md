# Documentation Map

Use this as the entry point for project docs beyond the root `README.md`.

## Current Sources Of Truth

- Current system architecture: `architecture/ARCHITECTURE.md`
- Static asset ownership: `architecture/STATIC_ASSET_OWNERSHIP.md`
- Local database and migration workflow: `supabase/LOCAL_DEVELOPMENT.md`
- Testing and release checks: `testing/TESTING.md`
- Build and DigitalOcean deployment: `deployment/BUILD.md`
- Release governance: `release/RELEASE_GOVERNANCE.md`
- Current audit remediation/readiness: `release/AUDIT_REMEDIATION_STATUS_2026-08-03.md`

If an older planning document conflicts with one of these, use the maintained
source above and the executable package/workflow configuration.

## Product And Strategy

- Product roadmap: `product/ROADMAP.md`
- Analytics events: `product/ANALYTICS_EVENTS.md`
- UX strategy: `ux/UX_STRATEGY_AND_GOVERNANCE.md`

## Architecture And Setup

- Google auth setup: `setup/AUTH_SETUP.md`
- Public client config: `setup/PUBLIC_CONFIG.md`

## Data, Security, And Compliance

- Supabase schema and RLS notes: `supabase/`
- Local Supabase setup: `supabase/LOCAL_DEVELOPMENT.md`
- Data retention: `compliance/DATA_RETENTION_AND_DELETION.md`
- POPIA data classification: `compliance/POPIA_DATA_CLASSIFICATION.md`
- Database operations: `db/`

## Testing, Release, And Ops

- Browser smoke suites: `testing/E2E_SMOKE.md`
- Operational docs: `ops/`
- Rollback plans and evidence: `../releases/`

## Historical And Archived Records

- Historical implementation summary: `archive/IMPLEMENTATION_SUMMARY.md`
- Retired Fastify/Docker runbook: `archive/LEGACY_FASTIFY_DOCKER_RUNBOOK.md`
- 2026-05-25 migration snapshot: `MIGRATION_AUDIT.md`
- React cutover tracker: `REACT_MIGRATION_CLEANUP_CHECKLIST.md`
- Prisma-to-Supabase implementation plan: `architecture/PRISMA_TO_SUPABASE_MIGRATION_PLAN.md`
- Pre-retirement LMS security blueprint: `security/FUTURE_LMS_SECURITY_BLUEPRINT.md`
- Retired arcade capacity plan: `testing/CAPACITY_TEST_PLAN.md`
