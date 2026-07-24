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
- `supabase/` for the Postgres schema/RLS/RPC source of truth (`docs/supabase/schema.sql`) and Edge Functions requiring trusted server execution.
- Build scripts that compile the unified React bundle, generate React route shells, serve the React public root from `dist/index.html`, and inject the public API base.

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
assets/              Public support assets copied into the React static build
images/              Public images used by React routes and SEO metadata
scripts/             Build, verification, release, and operational helper scripts
tests/               Frontend unit tests and browser E2E tests
ops/                 Monitoring assets
releases/            Release evidence and rollback templates
```

Root-level config files are intentionally kept at the top level because the related tools expect them there. Deeper project notes live in `docs/README.md`.

## React LMS migration

The production build now serves the unified React app for public, student, admin, tutor, auth, and onboarding routes. Legacy static source files are retained only as inactive reference material unless explicitly reintroduced.

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

Migration tracking:

- Audit and slice history: `docs/MIGRATION_AUDIT.md`
- Documentation map: `docs/README.md`
- Supabase schema source: `docs/supabase/schema.sql`
- Supabase auth seed notes: `docs/supabase/auth-seed-notes.md`
- Supabase production RLS review: `docs/supabase/PRODUCTION_RLS_REVIEW.md`
- Local Supabase setup: `docs/supabase/LOCAL_DEVELOPMENT.md`
- Cleanup checklist: `docs/REACT_MIGRATION_CLEANUP_CHECKLIST.md`

Supabase-first migration rules:

- Edit `docs/supabase/schema.sql` for Supabase tables, RLS, Storage policies, and RPC.
- Run `npm run supabase:migration:sync` before local Supabase resets.
- Use direct browser Supabase writes only when RLS fully protects ownership and allowed fields.
- Use RPC or trusted backend code for marking, feedback, result release, role management, payments, privacy work, and other privileged mutations.
- Treat `student-app/`, `legacy/static/`, and Prisma-era API migrations as legacy/transitional unless a task explicitly targets them.

## Docker Postgres

If you do not have Postgres installed locally, use the bundled Docker setup.

```bash
docker compose up -d db
```

That starts Postgres 16 on `localhost:5433` with the defaults from `.env.example`:

```env
LOCAL_POSTGRES_PASSWORD=postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/lms
```

To run the API and Postgres together in Docker:

```bash
docker compose up api db
```

The API container waits for Postgres to become healthy before starting migrations.

## Production Docker API

Use the dedicated production compose file to run only the API service against an external managed Postgres database.

Required environment variables in `.env`:

- `DATABASE_URL` (Supabase pooler/session Postgres connection string; direct Supabase DB hosts can be IPv6-only)
- `COOKIE_SECRET`
- `JWT_SECRET`
- `PUBLIC_BASE_URL`

Start production API container:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

View logs:

```bash
docker compose -f docker-compose.prod.yml logs -f api
```

Stop production API container:

```bash
docker compose -f docker-compose.prod.yml down
```

If you use DigitalOcean Managed Postgres, make sure the server public IP is allowed in the cluster Trusted Sources list, otherwise the API cannot connect.

Optional P4 gateway layer (Nginx, centralized edge auth + rate limiting):

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.gateway.yml up -d --build
```

Set `GATEWAY_SHARED_KEY` in `.env` (or shell) before running the gateway overlay.
For CI/CD and hosted deployments, set `GATEWAY_SHARED_KEY` as a repository/deployment secret as well.

Gateway docs and policy template: `ops/gateway/README.md` and `ops/gateway/nginx/nginx.conf`.

## Uptime Monitor

The scheduled workflow at `.github/workflows/uptime-check.yml` checks:

- `GET ${HEALTHCHECK_URL}/health`

Set the `HEALTHCHECK_URL` repository secret to enable it.

### Local URLs

- Static React build: `http://localhost:8080`
- React dev app: `http://localhost:5173`
- API: `http://localhost:3001`
- Login: `http://localhost:8080/dashboard/login/`
- Student dashboard: `http://localhost:8080/dashboard/student/`
- Tutor dashboard: `http://localhost:8080/dashboard/tutor/`

## Environment variables

### Public client config

Only safe public values should be exposed to browser code.

```env
PUBLIC_PO_API_BASE=http://localhost:3001
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_PO_FORMSPREE_ENDPOINT=
```

`PUBLIC_PO_API_BASE` is injected into `dist/assets/portal-config.js` during the static build.
`VITE_PO_FORMSPREE_ENDPOINT` is optional; when omitted, the React public enquiry form opens a pre-filled email fallback.
`SUPABASE_SERVICE_ROLE_KEY` is intentionally omitted from public client config. It is backend-only for API operations such as admin user invitations.

See `.env.example` for the canonical variable list (placeholders only).

### Supabase dashboard role verification

After applying `docs/supabase/schema.sql` and creating Auth users plus matching `profiles` rows, verify role mapping without committing passwords:

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
npm run supabase:reset # Generate and apply the local Supabase schema/RLS/RPC migration
npm run inject:config
npm run serve        # Serve dist/ on port 8080
npm run dev          # Serve the static site (build:static + serve)
npm run start        # Serve static site + run API prod server (after build:api)
npm run lint         # Lint JS and validate HTML
npm run test:unit    # Run frontend helper and React migration unit tests
npm run test:rls     # Validate Supabase schema/RLS/RPC source contracts
npm run test:api     # Run LMS API integration tests
npm run test:e2e:api # Run LMS API E2E tests
npm run test:all     # Run frontend unit + API integration + API E2E
npm run test         # Alias of test:all
docker compose up -d db # Start only Postgres in Docker
docker compose up api db # Run API + Postgres in Docker
```

## Production Static Output

```text
dist/
  index.html
  react-app-dist/
  assets/
    analytics.js
    portal-config.js
    seo-index.js
    sw-register.js
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
