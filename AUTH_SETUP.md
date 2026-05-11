# Student Google Auth Setup

Project Odysseus student dashboard sign-in uses Google OAuth Authorization Code flow with PKCE. Student magic links are not accepted for student dashboard sessions.

## Google Cloud Console

1. Create or open a Google Cloud project.
2. Configure the OAuth consent screen.
3. Create an OAuth 2.0 Client ID for a Web application.
4. Add authorized redirect URIs:
   - Local student callback: `http://localhost:3001/auth/google/student/callback`
   - Local tutor callback, if tutor Google sign-in is enabled: `http://localhost:3001/auth/google/callback`
   - Production student callback: `https://<api-host>/auth/google/student/callback`
   - Production tutor callback, if used: `https://<api-host>/auth/google/callback`
5. Copy the client ID and client secret into environment variables. Do not commit real secrets.

## Required Environment

Set these for local development:

```env
PUBLIC_PO_API_BASE=https://api.projectodysseus.live
PUBLIC_BASE_URL=https://api.projectodysseus.live
STUDENT_PORTAL_URL=https://student.projectodysseus.live
CORS_ORIGIN=https://student.projectodysseus.live
COOKIE_SECRET=replace_with_long_random_value
JWT_SECRET=replace_with_long_random_value
JWT_EXPIRES_IN=15m
SESSION_MAX_AGE_SECONDS=900
GOOGLE_CLIENT_ID=replace_with_google_client_id
GOOGLE_CLIENT_SECRET=replace_with_google_client_secret
GOOGLE_STUDENT_CALLBACK_URL=https://api.projectodysseus.live/auth/google/student/callback
```

Production additionally fails fast unless `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PUBLIC_BASE_URL`, `STUDENT_PORTAL_URL`, and `GOOGLE_STUDENT_CALLBACK_URL` are present. Production URL values must use HTTPS.

## Local Development

1. Copy `.env.example` to `.env` and fill only local values.
2. Run database migrations with `npm run migrate`.
3. Start the API and static site with `npm run dev`.
4. Open `http://localhost:8081/dashboard/login.html`.
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

- Visit `/dashboard/` while signed out and confirm redirect to `/dashboard/login.html`.
- Confirm the login page shows only `Continue with Google`.
- Complete Google sign-in with a registered active student email and confirm redirect to `/dashboard/`.
- Confirm the dashboard shows the Google profile name/email/avatar when available.
- Sign out from the dashboard and confirm the old session cannot access `/dashboard`.
- Try Google sign-in with an unregistered or wrong-role account and confirm the login page shows an error.
