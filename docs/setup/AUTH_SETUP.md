# Auth Setup

Project Odysseus uses Supabase Auth for browser identity and sessions. Role
authorization comes from the signed-in user's `profiles` row plus database RLS;
the retired Fastify cookie/OAuth stack is not part of current setup.

## Supabase project configuration

1. Enable the required sign-in methods in Supabase Dashboard > Authentication.
2. Set the Site URL to the deployed public origin.
3. Add exact local, preview, and production callback URLs to the Supabase redirect
   allow list. Keep preview wildcards as narrow as the hosting platform permits.
4. For Google sign-in, create a Google OAuth web client and register the callback
   URL Supabase shows for the provider. Store the client ID and secret in the
   Supabase provider configuration, never in browser variables.
5. Disable unneeded providers and review email-confirmation behavior before
   onboarding real users.

## Browser environment

Only the public project URL and anon key belong in the frontend:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=replace_with_public_anon_key
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` or Edge Function server secrets in
`VITE_*`, generated config, HTML, or a browser bundle. Trusted admin invitations
and AI proxy calls stay in Supabase Edge Functions.

## Profiles and roles

- Each Auth user needs the corresponding application profile created through the
  approved transactional onboarding/admin path.
- RLS is the authorization boundary; hiding a route or navigation item is only a
  user-experience control.
- Role mutations, invitations, and other privileged operations use secured RPCs
  or Edge Functions rather than direct browser table updates.
- Reset and verify local policy behavior with the instructions in
  [LOCAL_DEVELOPMENT.md](../supabase/LOCAL_DEVELOPMENT.md).

## Admin access

Production admin access requires a valid Supabase session and a normalized
`admin` profile role. Database RLS and Edge Functions enforce that role for
privileged operations; the browser route guard is only a user-experience layer.

Supabase MFA can still be enabled for individual accounts in the Supabase
Dashboard, but the application does not require an authenticator factor for
admin access.

## Local development

```bash
npm run supabase:start
npm run supabase:reset
npm run dev:react
```

Use local Auth users and matching profiles; do not commit passwords. To verify
student, tutor, and admin role mapping through RLS, set the temporary
`VERIFY_*_EMAIL` and `VERIFY_*_PASSWORD` variables documented in the root
[README](../../README.md), then run:

```bash
npm run verify:supabase:roles
```

## Manual verification

- An unauthenticated user is sent to `/dashboard/login` from protected routes.
- Student, tutor, parent, NGO-partner, and admin users land on their own shell.
- Cross-role queries and mutations fail at the database boundary, not just in
  React.
- An admin with a valid session and an `admin` profile can render protected
  admin content.
- Sign-out clears the active Supabase session and protected data disappears.
- The runtime pgTAP suite passes after a clean migration reset.

Historical Fastify OAuth callbacks and environment variables are preserved only
in [the archived runbook](../archive/LEGACY_FASTIFY_DOCKER_RUNBOOK.md).
