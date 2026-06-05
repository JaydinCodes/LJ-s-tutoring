# Local Supabase Development

Project Odysseus is Supabase-first. Local Supabase is the repeatable test surface for Auth, RLS, Storage, and RPC work.

## Prerequisites

- Node.js 20
- Docker Desktop
- Supabase CLI, either installed globally or run through `npx supabase`

Do not use production Supabase credentials for local tests.

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
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SUPABASE_TEST_PROJECT_REF=local
SUPABASE_PRODUCTION_PROJECT_REF=
```

`SUPABASE_PRODUCTION_PROJECT_REF` is intentionally blank in local files. Production project refs and service-role keys belong only in the deployment secret manager.

## Schema Source Of Truth

Edit this file when changing Supabase schema, RLS, Storage policies, or RPC:

```text
docs/supabase/schema.sql
```

The Supabase CLI applies migrations from `supabase/migrations`. To avoid two editable SQL sources, the repo generates a local migration copy from the schema source:

```bash
npm run supabase:migration:sync
```

The generated migration file is ignored by git.

## Start And Reset

Start local Supabase:

```bash
npm run supabase:start
```

Apply or reset local schema/RLS/RPC:

```bash
npm run supabase:reset
```

This runs `supabase:migration:sync` first, then resets the local Supabase database with the generated migration.

## Tests

Frontend source-contract tests:

```bash
npm run test:frontend:unit
```

RLS/RPC contract tests:

```bash
npm run test:rls
```

These tests do not contact production Supabase. `test:rls` validates that the local schema source includes the required RLS/RPC contracts before you apply them.

Fastify API tests remain separate:

```bash
npm run test:api
```

Those tests still use `DATABASE_URL_TEST` and the transitional API database setup.

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

## CI Notes

CI should run:

```bash
npm ci
npm run supabase:migration:sync
npm run test:frontend:unit
npm run test:rls
```

Only add live Supabase integration tests to CI after a dedicated non-production Supabase project exists. Never point CI at production Supabase.
