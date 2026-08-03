# Testing

This is the maintained test guide for the unified React + Supabase application.
The retired Fastify/Prisma integration suites and their `DATABASE_URL_TEST`
database are not part of the current repository.

## Test layers

- **Frontend and source contracts:** Node's test runner validates UI behavior,
  build output, Supabase schema/RLS/RPC definitions, and operational config.
- **Runtime database authorization:** pgTAP tests run against a local Supabase
  stack rebuilt from committed migrations.
- **Browser journeys:** Playwright exercises the unified React routes with the
  explicit in-memory auth/data adapter. This is deterministic UI coverage, not
  evidence of production Supabase authorization.
- **Release quality:** generated HTML, links, accessibility, static performance
  budgets, and Lighthouse run against the built `dist/` site.

## Prerequisites

- Node.js 24 with npm 11.
- Installed npm dependencies (`npm ci` in CI, `npm install` locally).
- Chromium for browser tests (`npm run test:e2e:install`).
- Docker Desktop or another Docker-compatible runtime only for local Supabase
  reset and pgTAP tests.

No standalone Postgres instance or `DATABASE_URL_TEST` variable is required.

## Fast checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run perf:budget
```

`npm test` is the frontend/source-contract aggregate. Database source-contract
tests are also available directly with `npm run test:rls`.

## Runtime Supabase authorization

The runtime gate proves policies using the same committed migration sequence CI
uses:

```bash
npm run supabase:start
npm run supabase:reset
npm run test:rls:runtime
```

Do not edit an applied migration or regenerate the frozen baseline. Add an
immutable forward migration, update the desired-state schema, reset locally,
and rerun both source-contract and runtime tests. See
[LOCAL_DEVELOPMENT.md](../supabase/LOCAL_DEVELOPMENT.md).

## React browser tests

```bash
npm run test:e2e:install
npm run test:e2e
```

The suite covers role navigation and login behavior plus computed visual
contrast for login and all role shells at mobile/desktop widths in light/dark
themes. `VITE_E2E_AUTH_MOCK=true` is set by the Playwright config; never treat a
passing mock journey as a substitute for the pgTAP authorization gate.

## Built-site quality checks

Build first, start the canonical QA server in one terminal, and wait for it:

```bash
npm run build
npm run qa:serve
```

Then run in another terminal:

```bash
npm run qa:wait
npm run qa:html
npm run qa:links
npm run qa:a11y
npm run perf:lighthouse
```

The workflows use these package scripts too, so local and CI commands remain in
parity. Production monitoring assets can be checked with
`npm run validate:monitoring`.

## 20-minute production live-user test

Run this only after the required release gates pass and the deployment is live.
Use approved internal or explicitly consented pilot accounts and do not create
uncontrolled learner data.

### Before starting

- Record the deployed commit SHA and release-gate artifact.
- Invite test users through the `admin-invite-user` Edge Function and complete
  Supabase MFA (AAL2) for the admin account.
- Confirm the static `/health.json`, Supabase Auth health, and zero-row PostgREST
  probes are green in the uptime workflow.
- Keep frontend error monitoring and Supabase service health visible.

### Scope

| Minute | Owner | Action | Evidence |
|---|---|---|---|
| 0-3 | Release lead | Confirm SHA, production URLs, and release-gate artifact. | SHA and gate link recorded. |
| 3-7 | Admin tester | Sign in with MFA and open users, tutors, students, assignments, approvals, payroll, audit, privacy, and retention. | Routes render with no blocking errors or unauthorized data. |
| 7-11 | Tutor tester | Open assigned classes, sessions, submissions, reports, and risk views. | Only allocated learner data is visible. |
| 11-15 | Student tester | Open dashboard, assignments, progress, results, careers, and reports. | Only the signed-in learner's data is visible. |
| 15-18 | Release lead | Recheck uptime probes and recent browser/Supabase errors. | Monitoring snapshot recorded. |
| 18-20 | Release lead | Promote, hold, or start rollback assessment; name any cleanup owner. | Decision and timestamp recorded. |

### Pass and stop criteria

Pass only when every pilot can authenticate, cross-role access is blocked, core
routes render without blocking errors, and all three uptime probes remain
green. Stop and assess rollback on any unauthorized-data exposure, repeated
auth failure, failed health probe, or unexpected privacy/payroll/retention
mutation.

## Codespaces

Use the same commands. A Docker-capable Codespace is required only for the local
Supabase runtime gate.
