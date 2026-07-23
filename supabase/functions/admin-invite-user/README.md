# admin-invite-user (Supabase Edge Function)

Single-stack migration (ADR-0003), Tier-2 slice 1. Replaces the Fastify route
`POST /supabase/admin/users/invite` (`lms-api/src/routes/supabase-admin.ts`).

Invites/creates a Supabase Auth user and provisions their `profiles` row plus a
`students`/`tutors` record, using the service-role key that must never reach the
browser. Caller must be an **ADMIN** profile that has passed **MFA (AAL2)**.

## Status: deployed, verified, frontend repointed

Verified live with a real AAL2 admin token: both the student and tutor create
paths succeed (correct `profiles` + `students`/`tutors` rows), duplicate email
is correctly rejected (`409`), and a non-admin/non-AAL2 caller is correctly
rejected (`403`). `src/features/admin/AdminUsersRoute.tsx` now calls this
function via `supabase.functions.invoke`. The Fastify route stays registered
until the broader `lms-api` retirement.

One real bug surfaced during verification and is now fixed: production's
`students` table carried a leftover `full_name` column (`NOT NULL`, no
default) from an earlier schema iteration, not modeled in
`docs/supabase/schema.sql` at all (`profiles.full_name` is the actual source
of truth). This silently blocked every insert into `students` -- nothing had
attempted a new row there until this function's own verification. Fixed by
relaxing the constraint (table had zero rows, so a pure constraint fix, not a
backfill); see the guarded `alter table students alter column full_name drop
not null` block near the `students` table definition in `schema.sql`.

## Deploy

```bash
supabase functions deploy admin-invite-user --project-ref <your-project-ref>
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected
automatically by the Edge runtime. Only one optional secret is custom:

```bash
supabase secrets set SUPABASE_INVITE_REDIRECT_URL="https://<app>/dashboard/login"
```

> Note: unlike the Fastify route, this function has **no dev MFA bypass** — AAL2 is
> always required, because an Edge Function only runs deployed. Keep using the
> Fastify route for local dev until the full cutover.

## Verify

Get an admin session's access token that has completed MFA (AAL2), then:

```bash
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/admin-invite-user" \
  -H "Authorization: Bearer <ADMIN_AAL2_ACCESS_TOKEN>" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "content-type: application/json" \
  -d '{"mode":"invite","role":"tutor","fullName":"Test Tutor","email":"test.tutor@example.com","tutor":{"subjects":["Mathematics"],"grades":["10"]}}'
```

Expect `{"ok":true,...}`. Confirm the `profiles` + `tutors` rows exist. Also check
the guard rails: a non-admin token → `403 admin_required`; a non-AAL2 admin token
→ `403 admin_mfa_required`; a duplicate email → `409 duplicate_email`.

## Retire the Fastify route (not yet done)

Delete `supabaseAdminRoutes` / `lms-api/src/routes/supabase-admin.ts` and its
registration once nothing else calls it. This removes the last browser
dependency on the Fastify service for admin user provisioning.
