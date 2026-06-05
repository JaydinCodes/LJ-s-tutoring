# Auth Setup

Project Odysseus is Supabase-first. Browser sign-in, session state, and role access should use Supabase Auth plus Supabase-backed `profiles` rows.

This document previously described Fastify-owned Google OAuth sessions as the primary portal auth model. Treat that flow as transitional backend history unless a specific backend-only service still needs it. New browser-facing auth work must use Supabase Auth providers and RLS-backed role checks.

## Supabase Auth Direction

- Configure email/password, magic link, and Google OAuth in the Supabase project.
- Store application role and profile metadata in the `profiles` table.
- Use RLS policies and secure RPC functions for authorization.
- Do not store browser auth tokens in localStorage.
- Do not introduce a second browser session cookie for LMS routes.

## Admin MFA

Production admin access requires Supabase Auth MFA. The React admin route guard checks:

1. A valid Supabase session.
2. A linked `profiles` row with the normalized `admin` role.
3. Supabase authenticator assurance level `aal2`, or a verified TOTP factor that can be challenged and verified.

Enable MFA in Supabase Dashboard > Authentication > Multi-Factor Auth, then require each admin account to enroll and verify a TOTP factor before using `/dashboard/admin`. Admins without a verified factor see `MFA setup required`; admins with a factor but an `aal1` session see `MFA required` and must enter their authenticator code. If Supabase MFA status cannot be read, admin access remains blocked.

The frontend uses `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`, `supabase.auth.mfa.listFactors()`, `supabase.auth.mfa.challenge()`, and `supabase.auth.mfa.verify()`.

Local UI development can set `VITE_PO_DEV_ADMIN_MFA_BYPASS=true`, but the code ignores that flag in production builds. Do not set it in staging or production.

## Transitional Google Auth Notes

The Fastify API still contains Google OAuth routes from the older API-session model. Keep these notes only for migration support while the platform converges on Supabase Auth.

## Google Cloud Console

1. Create or open a Google Cloud project.
2. Configure the OAuth consent screen.
3. Create an OAuth 2.0 Client ID for a Web application.
4. Add authorized redirect URIs:
   - Local student callback: `http://localhost:3001/auth/google/student/callback`
   - Local tutor callback: `http://localhost:3001/auth/google/callback`
   - Local admin callback: `http://localhost:3001/auth/google/admin/callback`
   - Production student callback: `https://<api-host>/auth/google/student/callback`
   - Production tutor callback: `https://<api-host>/auth/google/callback`
   - Production admin callback: `https://<api-host>/auth/google/admin/callback`
5. Copy the client ID and client secret into environment variables. Do not commit real secrets.

## Required Environment

Set these for local development:

```env
PUBLIC_PO_API_BASE=https://api.projectodysseus.live
PUBLIC_BASE_URL=https://api.projectodysseus.live
STUDENT_PORTAL_URL=https://student.projectodysseus.live
TUTOR_PORTAL_URL=https://tutor.projectodysseus.live
ADMIN_PORTAL_URL=https://admin.projectodysseus.live
CORS_ORIGIN=https://student.projectodysseus.live
COOKIE_SECRET=replace_with_long_random_value
JWT_SECRET=replace_with_long_random_value
JWT_EXPIRES_IN=15m
SESSION_MAX_AGE_SECONDS=900
GOOGLE_CLIENT_ID=replace_with_google_client_id
GOOGLE_CLIENT_SECRET=replace_with_google_client_secret
GOOGLE_CALLBACK_URL=https://api.projectodysseus.live/auth/google/callback
GOOGLE_STUDENT_CALLBACK_URL=https://api.projectodysseus.live/auth/google/student/callback
GOOGLE_ADMIN_CALLBACK_URL=https://api.projectodysseus.live/auth/google/admin/callback
```

Production additionally fails fast unless `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PUBLIC_BASE_URL`, `STUDENT_PORTAL_URL`, and `GOOGLE_STUDENT_CALLBACK_URL` are present. Production URL values must use HTTPS.

Portal URL values must be origins only. The auth service appends `/dashboard/admin/`, `/dashboard/tutor/`, or `/dashboard/student/` after login.

## Local Development

1. Copy `.env.example` to `.env` and fill only local values.
2. Run database migrations with `npm run migrate`.
3. Start the API and static site with `npm run dev`.
4. Open `http://localhost:8081/dashboard/login/`.
5. Use a Google account whose email already exists as an active `STUDENT` user.

## Production Notes

- Serve the API over HTTPS behind the configured `PUBLIC_BASE_URL`.
- Set `NODE_ENV=production` so session and OAuth cookies use `Secure`.
- Keep `ENFORCE_SAME_ORIGIN=true`.
- Include the student portal origin in `CORS_ORIGIN`.
- Rotate `JWT_SECRET` and `COOKIE_SECRET` through the deployment secret manager, not source control.

## Security Assumptions

- Google OAuth is sign-in only; student accounts are pre-created by admins.
- ID tokens are validated server-side for signature, issuer, audience, expiry, nonce, and verified email.
- Sessions are stored in HttpOnly cookies; frontend code never stores auth tokens in localStorage.
- Student API data remains protected by server-side session validation and `STUDENT` RBAC.
- Static HTML may load before auth validation, but private dashboard data is fetched only after `/auth/session` confirms a student session.

## Manual Verification

- Visit `/dashboard/` while signed out and confirm redirect to `/dashboard/login/`.
- Confirm the login page shows only `Continue with Google`.
- Complete Google sign-in with a registered active student email and confirm redirect to `/dashboard/`.
- Confirm the dashboard shows the Google profile name/email/avatar when available.
- Sign out from the dashboard and confirm the old session cannot access `/dashboard`.
- Try Google sign-in with an unregistered or wrong-role account and confirm the login page shows an error.
