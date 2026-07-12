# admin-invite-user (Supabase Edge Function)

Single-stack migration (ADR-0003), Tier-2 slice 1. Replaces the Fastify route
`POST /supabase/admin/users/invite` (`lms-api/src/routes/supabase-admin.ts`).

Invites/creates a Supabase Auth user and provisions their `profiles` row plus a
`students`/`tutors` record, using the service-role key that must never reach the
browser. Caller must be an **ADMIN** profile that has passed **MFA (AAL2)**.

## Status: written, NOT yet wired in

Follow the strangler-fig order — **do not repoint the frontend or delete the
Fastify route until this function is deployed and verified.** The Fastify route
stays live until cutover.

## 1. Deploy

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

## 2. Verify (before repointing)

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

## 3. Repoint the frontend (after verify)

In `src/features/admin/AdminUsersRoute.tsx`, replace the Fastify call
`apiPost('/supabase/admin/users/invite', payload)` with the Supabase client
invoke (it attaches the session bearer + anon apikey automatically):

```ts
const { data, error } = await supabase.functions.invoke('admin-invite-user', { body: payload });
if (error) throw error;
```

## 4. Retire the Fastify route (after the frontend is on the function)

Delete `supabaseAdminRoutes` / `lms-api/src/routes/supabase-admin.ts` and its
registration. This removes the last browser dependency on the Fastify service for
admin user provisioning.
