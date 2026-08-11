# Local Supabase Development

Project Odysseus is Supabase-first. Local Supabase is the repeatable test surface for Auth, RLS, Storage, and RPC work.

## Prerequisites

- Node.js 24 with npm 11
- A Docker-compatible container runtime
- The project-pinned Supabase CLI installed by `npm ci`

Do not use production Supabase credentials for local tests, and never expose the
local stack to an external network.

## Local Environment

Copy `.env.example` to `.env.local`, then run:

```bash
npm run supabase:start
npm run supabase:status
```

Use the local values from `supabase status`:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local anon key from supabase status>
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<local service_role key from supabase status>
APP_INVITE_REDIRECT_URL=http://localhost:5173/dashboard/login
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SUPABASE_TEST_PROJECT_REF=local
SUPABASE_PRODUCTION_PROJECT_REF=
```

`SUPABASE_PRODUCTION_PROJECT_REF` is intentionally blank in local files. Production project refs and service-role keys belong only in the deployment secret manager. `SUPABASE_SERVICE_ROLE_KEY` is Edge-Function-only for trusted work such as admin user invitations; never expose it through Vite or `portal-config.js`.

Production release prerequisites are checked by `.github/workflows/deploy-production.yml`:
`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PRODUCTION_PROJECT_REF`, and
`SUPABASE_DB_PASSWORD` must be configured as environment secrets. The workflow
applies migrations, deploys all Edge Functions, then calls the idempotent
recovery-schedule bootstrap. The Vault secret
`ai_grading_service_role_key` must exist before that bootstrap; it installs the
AI worker, submission-orphan cleanup, and privacy-deletion resumer cron jobs.

## Canonical Schema And Migration History

The ordered, committed SQL in `supabase/migrations/` is the canonical database
and policy source. `docs/supabase/SCHEMA_AND_POLICY_INVENTORY.md` is generated
from that immutable history and records the exact manifest. The baseline is
frozen. Normal changes are forward-only:

```bash
npx supabase migration --help
npx supabase migration new <descriptive-name>
```

Put only the forward delta in the new migration, run
`npm run supabase:docs:update`, and commit both. Never amend an applied
migration. `docs/supabase/schema.sql` is retained as historical clean-install
reference material; it cannot override a later migration.

## Start And Reset

Start local Supabase:

```bash
npm run supabase:start
```

Apply or reset local schema/RLS/RPC:

```bash
npm run supabase:reset
```

This destroys only the local database, replays every committed migration in
timestamp order, and loads configured local seed data. It must never be used
with `--linked` against production.

## Tests

Frontend and source-contract tests:

```bash
npm test
```

RLS/RPC source-contract and real PostgreSQL tests:

```bash
npm run test:rls
npm run test:rls:runtime
```

Neither command contacts production Supabase. `test:rls` checks source
contracts; `test:rls:runtime` executes the same policy matrix against the
local database rebuilt from committed migrations. The generated-type fingerprint
check in CI also uses that rebuilt local database, so it is reproducible in a
fresh runner and never depends on a developer's `supabase link` state.
contracts. `test:rls:runtime` runs pgTAP against the reset local database with
real role/session settings and verifies allow and deny paths. Browser
Playwright tests use a mock adapter and do not replace this database gate.

## Manual RLS Verification

After `npm run supabase:reset`, create local Supabase Auth users for student, tutor, and admin through Supabase Studio:

```text
http://127.0.0.1:54323
```

Then insert matching `profiles`, `students`, and `tutors` rows using `docs/supabase/auth-seed-notes.md`.

Verify these policies locally before production cutover:

- Student can read only their profile, student row, submissions, progress, and allowed assignments.
- Student can upload only to `assignment-submissions/<student-id>/<assignment-id>/<submission-id>/submission.<ext>`.
- Student can call `submit_assignment_submission` only for their own published assignment.
- Student cannot directly update `marks_awarded`, `feedback`, `status`, or `is_latest`.
- Tutor can select and mark submissions only for assignments they created.
- Tutor cannot mark another tutor's assignment submission.
- Admin can manage assignment submissions according to the admin policy.
- Parent and NGO roles cannot escape their explicitly linked/scoped reports.

## CI Notes

CI should run:

```bash
npm ci
npm run supabase:start
npm run supabase:reset
npm test
npm run test:rls
npm run test:rls:runtime
```

The required app CI job performs this against an ephemeral local stack. It uses
no hosted-project credentials and must never point at production Supabase.
