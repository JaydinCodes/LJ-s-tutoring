# Project Odysseus

React LMS + public site + API monorepo.

## What this repo now contains

- Preserved legacy HTML/CSS/JS pages for rollback/reference while React route parity is validated.
- A unified Vite + React + TypeScript LMS migration app in `src/`.
- A temporary older student React bundle in `student-app/` while `/student/*` routes are consolidated.
- `lms-api/` for the Fastify + Postgres backend.
- Build scripts that compile React bundles, generate React route shells, serve the React public root from `dist/index.html`, and inject the public API base.

## Quick start

```bash
npm install
npm install --prefix lms-api
cp .env.example .env
npm run build
npm run build:api
npm run start
```

You can also use `.env.local` for machine-specific secrets; it is ignored by git.

## React LMS migration

The migration is incremental. The built public root now serves React; legacy static source files remain until final deletion/redirect cleanup is approved.

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
- Admin: `/dashboard/admin`, `/dashboard/admin/students`, `/dashboard/admin/tutors`, `/dashboard/admin/assignments`, `/dashboard/admin/approvals`, `/dashboard/admin/payments`, `/dashboard/admin/payroll`, `/dashboard/admin/reconciliation`, `/dashboard/admin/reports`, `/dashboard/admin/results`, `/dashboard/admin/audit`, `/dashboard/admin/privacy-requests`, `/dashboard/admin/retention`, `/dashboard/admin/ops-runbook`
- Tutor: `/dashboard/tutor`, `/dashboard/tutor/classes`, `/dashboard/tutor/sessions`, `/dashboard/tutor/submissions`, `/dashboard/tutor/reports`, `/dashboard/tutor/risk`

Migration tracking:

- Audit and slice history: `docs/MIGRATION_AUDIT.md`
- Supabase schema plan: `docs/supabase/schema.sql`
- Supabase auth seed notes: `docs/supabase/auth-seed-notes.md`
- Supabase production RLS review: `docs/supabase/PRODUCTION_RLS_REVIEW.md`
- Cleanup checklist: `docs/REACT_MIGRATION_CLEANUP_CHECKLIST.md`

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

- `DATABASE_URL` (managed Postgres connection string)
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

- Static build: `http://localhost:8080`
- React dev app: `http://localhost:5173`
- API: `http://localhost:3001`
- Login: `http://localhost:8080/login.html`
- Student dashboard: `http://localhost:8080/dashboard/`
- Tutor dashboard: `http://localhost:8080/tutor/dashboard/`

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

### API config

The API bootstrap loads environment variables from repository and package files in this order:

- `../.env.local`
- `../.env`
- `./.env.local`
- `./.env`

For local `npm start`, make sure `DATABASE_URL`, `COOKIE_SECRET`, `JWT_SECRET`, and `GROQ_API_KEY` are set before starting the API.

See `.env.example` for the canonical variable list (placeholders only).

### Google OAuth

Tutor and student Google sign-in is enabled when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.

Configure these authorized redirect URIs in Google Cloud Console:

- Tutor: `http://localhost:3001/auth/google/callback`
- Student: `http://localhost:3001/auth/google/student/callback`

For production, use the deployed API host in `GOOGLE_CALLBACK_URL` and `GOOGLE_STUDENT_CALLBACK_URL`. Set `GOOGLE_ALLOWED_DOMAIN` when only one Google Workspace or email domain should be accepted. OAuth is sign-in only: tutor and student accounts must already exist in `users`.

### Seed Users

Local dev seed users are created by `npm run seed:dev --prefix lms-api`:

- `admin@dev.local` / `DevPass123!`
- `tutor@dev.local` / `DevPass123!`
- `student@dev.local` / `DevPass123!`

Test seed users from `npm run seed:test --prefix lms-api` use `TestPass123!`.

### Assistant API

The student dashboard now uses the assistant layer at:

- `POST /assistant/chat`
- `POST /assistant/document`

Both endpoints expect an authenticated session and a CSRF token when called from the browser.

## Scripts

```bash
npm run build        # Build React bundles, copy static files, inject config, verify assets
npm run build:react  # Build the unified React LMS bundle
npm run build:student-app # Build the temporary older student React bundle
npm run build:api    # Install + build lms-api from repo root
npm run build:static # Copy static source files to dist/
npm run inject:config
npm run serve        # Serve dist/ on port 8080
npm run dev          # Serve static site + run API dev server
npm run start        # Serve static site + run API prod server (after build:api)
npm run lint         # Lint JS and validate HTML
npm run test:unit    # Run frontend helper and React migration unit tests
npm run test:api     # Run LMS API integration tests
npm run test:e2e:api # Run LMS API E2E tests
npm run test:all     # Run frontend unit + API integration + API E2E
npm run test         # Alias of test:all
docker compose up -d db # Start only Postgres in Docker
docker compose up api db # Run API + Postgres in Docker
```

## Static site structure

```text
index.html
login.html
privacy.html
terms.html
assets/
  portal.css
  portal-config.js
  common.js
  student/
  tutor/
  admin/
dashboard/
reports/
guides/
tutor/
admin/
lms-api/
```

## Operations Docs

- Observability and SLO baseline: `docs/ops/OBSERVABILITY_AND_SLO_BASELINE.md`
- PITR and restore verification: `docs/db/PITR_STRATEGY_AND_RESTORE_VERIFICATION.md`
- RLS feasibility analysis: `docs/db/RLS_DEFENSE_IN_DEPTH_FEASIBILITY.md`
- UX strategy and governance: `docs/ux/UX_STRATEGY_AND_GOVERNANCE.md`
