# Project Odysseus

React LMS + public site + Supabase-first platform monorepo.

## Architecture source of truth

Project Odysseus is Supabase-first:

- Supabase Auth owns browser identity and sessions.
- Supabase RLS owns row-level authorization.
- Supabase Storage owns private learner, tutor, and assignment files.
- Secure Supabase RPC functions own privileged mutations.

Backend-only / trusted-execution work (the Odie AI proxy, admin user invites) runs
on **Supabase Edge Functions** (`supabase/functions/`), not a separate backend
service — the Fastify+Prisma stack this repo used to run alongside Supabase
(`lms-api/`) was fully retired 2026-07-24 (see
[ADR-0003](docs/architecture/ADR-0003-single-stack-supabase.md)).

Start with `docs/architecture/ARCHITECTURE.md` for the current implementation map. See `docs/architecture/ADR-0001-supabase-first.md` for the accepted architecture decision.

## What this repo now contains

- A unified Vite + React + TypeScript LMS migration app in `src/`.
- `supabase/` for immutable Postgres schema/RLS/RPC migrations and Edge Functions requiring trusted server execution. The generated [schema/policy inventory](docs/supabase/SCHEMA_AND_POLICY_INVENTORY.md) records the canonical migration manifest.
- Build scripts that compile the unified React bundle, generate React route
  shells, serve the React public root from `dist/index.html`, and validate the
  generated public configuration/assets.

## Quick start

```bash
npm install
cp .env.example .env
npm run supabase:start
npm run build
npm run start
```

You can also use `.env.local` for machine-specific secrets; it is ignored by git.

## Repository map

```text
src/                 Unified React + TypeScript LMS frontend
supabase/            Edge Functions and local Supabase CLI config
docs/                Architecture, setup, deployment, compliance, release, and ops docs
.do/                 DigitalOcean App Platform spec
assets/              Closed public-asset allowlist plus one owner-excluded historical Community file
images/              Public images used by React routes and SEO metadata
scripts/             Build, verification, release, and operational helper scripts
tests/               Frontend unit tests and browser E2E tests
ops/                 Monitoring assets
releases/            Release evidence and rollback templates
```

Root-level config files are intentionally kept at the top level because the related tools expect them there. Deeper project notes live in `docs/README.md`.

## React LMS migration

The production build now serves the unified React app for public, student,
tutor, parent, NGO-partner, admin, auth, and onboarding routes. Retired static
route trees and non-Community legacy assets were removed. The sole historical
asset left in place is excluded Community code that is not copied to production.
See `docs/architecture/STATIC_ASSET_OWNERSHIP.md` for the exact inventory.

Primary React app:

```bash
npm run dev:react
npm run typecheck:react
npm run build:react
```

Important unified React routes:

- Public: `/`, `/about`, `/programs`, `/guides`, `/guides/matric-maths-mistakes-guide`, `/privacy`, `/terms`
- Auth/onboarding: `/dashboard/login`, `/onboarding/student`, `/onboarding/tutor`
- Student: `/dashboard/student`, `/dashboard/student/assignments`, `/dashboard/student/progress`, `/dashboard/student/results`, `/dashboard/student/careers`, `/dashboard/student/reports`, `/dashboard/student/community`
- Admin: `/dashboard/admin`, `/dashboard/admin/users`, `/dashboard/admin/students`, `/dashboard/admin/tutors`, `/dashboard/admin/allocations`, `/dashboard/admin/classes`, `/dashboard/admin/assignments`, `/dashboard/admin/approvals`, `/dashboard/admin/payments`, `/dashboard/admin/payroll`, `/dashboard/admin/reconciliation`, `/dashboard/admin/reports`, `/dashboard/admin/results`, `/dashboard/admin/audit`, `/dashboard/admin/privacy-requests`, `/dashboard/admin/retention`, `/dashboard/admin/ops-runbook`
- Tutor: `/dashboard/tutor`, `/dashboard/tutor/classes`, `/dashboard/tutor/sessions`, `/dashboard/tutor/submissions`, `/dashboard/tutor/reports`, `/dashboard/tutor/risk`
- Parent: `/dashboard/parent/reports`
- NGO partner: `/dashboard/ngo/reports`

Migration tracking:

- Historical audit and slice snapshot: `docs/MIGRATION_AUDIT.md`
- Documentation map: `docs/README.md`
- Canonical Supabase schema/policy manifest: `docs/supabase/SCHEMA_AND_POLICY_INVENTORY.md`
- Supabase auth seed notes: `docs/supabase/auth-seed-notes.md`
- Supabase production RLS review: `docs/supabase/PRODUCTION_RLS_REVIEW.md`
- Local Supabase setup: `docs/supabase/LOCAL_DEVELOPMENT.md`
- Historical cleanup checklist: `docs/REACT_MIGRATION_CLEANUP_CHECKLIST.md`

Supabase-first migration rules:

- Treat committed forward migrations as the database source of truth; regenerate `docs/supabase/SCHEMA_AND_POLICY_INVENTORY.md` after each migration.
- Create a new immutable forward migration under `supabase/migrations/` for every database change; never amend an applied migration.
- Run `npm run supabase:reset`, `npm run test:rls`, and `npm run test:rls:runtime` before sharing a migration.
- Use direct browser Supabase writes only when RLS fully protects ownership and allowed fields.
- Use RPC or trusted backend code for marking, feedback, result release, role management, payments, privacy work, and other privileged mutations.
- The retired `student-app/` tree and obsolete `assets/app-critical.js` were removed after unified React parity; use Git history for comparisons instead of restoring them to the active tree.

## Retired backend instructions

The Fastify/Prisma API and its Docker Compose deployment are not part of the
active repository or production topology. Their former commands are preserved
only in [the archived runbook](docs/archive/LEGACY_FASTIFY_DOCKER_RUNBOOK.md)
for audit/history context. Do not use them for current setup or deployment.

## Uptime Monitor

The scheduled workflow at `.github/workflows/uptime-check.yml` checks:

- `GET ${HEALTHCHECK_URL}/health.json`, including JSON Content-Type and the exact static contract.
- Supabase Auth health at `${SUPABASE_URL}/auth/v1/health`.
- A zero-row PostgREST `profiles` probe using only the public anon key.

Set repository variables `HEALTHCHECK_URL`, `SUPABASE_URL`, and
`SUPABASE_ANON_KEY`. Missing configuration fails rather than reporting a false
green result.

### Local URLs

- Static React build: `http://localhost:8080`
- React dev app: `http://localhost:5173`
- Local Supabase API: `http://127.0.0.1:54321`
- Login: `http://localhost:8080/dashboard/login/`
- Student dashboard: `http://localhost:8080/dashboard/student/`
- Tutor dashboard: `http://localhost:8080/dashboard/tutor/`

## Environment variables

### Public client config

Only safe public values should be exposed to browser code.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Public enquiries open a pre-filled message in the visitor's email app, with WhatsApp offered as an alternative. The site does not send enquiry details to a third-party form processor.
`SUPABASE_SERVICE_ROLE_KEY` is intentionally omitted from public client config. It is available only to trusted Edge Functions such as admin user invitations.

See `.env.example` for the canonical variable list (placeholders only).

### Supabase dashboard role verification

After resetting from committed migrations and creating Auth users plus matching `profiles` rows, verify role mapping without committing passwords:

```powershell
$env:VERIFY_ADMIN_EMAIL="admin@example.com"
$env:VERIFY_ADMIN_PASSWORD="admin_password"
$env:VERIFY_STUDENT_EMAIL="student@example.com"
$env:VERIFY_STUDENT_PASSWORD="student_password"
$env:VERIFY_TUTOR_EMAIL="tutor@example.com"
$env:VERIFY_TUTOR_PASSWORD="tutor_password"
npm run verify:supabase:roles
```

The script signs in with the public Supabase anon client, reads each user's own `profiles` row through RLS, confirms the expected role, then signs out.

## Scripts

```bash
npm run build        # Build the React bundle, generate route shells, inject config, verify assets
npm run build:react  # Build the unified React LMS bundle
npm run build:static # Generate React route shells and copy required public assets to dist/
npm run supabase:start # Start local Supabase through the CLI
npm run supabase:reset # Rebuild local Supabase from committed migrations
npm run inject:config
npm run serve        # Serve dist/ on port 8080
npm run dev          # Serve the static site (build:static + serve)
npm run start        # Serve the built static site
npm run lint         # Lint JS, active TypeScript/React, and root HTML
npm run typecheck    # Type-check the active React app
npm test             # Run frontend and source-contract tests
npm run test:rls     # Validate Supabase schema/RLS/RPC source contracts
npm run test:rls:runtime # Run pgTAP authorization tests on local Supabase
npm run test:e2e     # Run deterministic frontend browser journeys (mock adapter)
npm run perf:budget  # Enforce static asset budgets
npm run qa:html      # Validate generated route shells after npm run build
npm run qa:links     # Check canonical internal routes while dist is served
npm run qa:a11y      # Run Pa11y on canonical public/login routes while dist is served
```

## Production Static Output

```text
dist/
  index.html
  react-app-dist/
  assets/
    analytics-module.js
    analytics.js
    lib/
      sanitize.js
    portal-config.js
    sw-register.js
    tailwind-input.css
  dashboard/
    student/
    admin/
    tutor/
  onboarding/
  guides/
```

## Operations Docs

- Observability and SLO baseline: `docs/ops/OBSERVABILITY_AND_SLO_BASELINE.md`
- PITR and restore verification: `docs/db/PITR_STRATEGY_AND_RESTORE_VERIFICATION.md`
- RLS feasibility analysis: `docs/db/RLS_DEFENSE_IN_DEPTH_FEASIBILITY.md`
- UX strategy and governance: `docs/ux/UX_STRATEGY_AND_GOVERNANCE.md`
