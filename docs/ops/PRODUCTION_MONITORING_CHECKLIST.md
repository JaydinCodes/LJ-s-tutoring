# Production Monitoring Checklist

Project Odysseus uses Sentry for browser crash and workflow error reporting when `VITE_SENTRY_DSN` is configured in a production build.

## Required Environment

```env
VITE_SENTRY_ENABLED=true
VITE_SENTRY_DSN=<project browser DSN>
VITE_SENTRY_ENVIRONMENT=production
VITE_SENTRY_RELEASE=<deployed git sha or release id>
VITE_SENTRY_SAMPLE_RATE=1
```

Do not commit DSNs for staging or production into source control. Configure them in the deployment environment.

## What Is Captured

- App-level render crashes from the React `ErrorBoundary`.
- Route-level crashes bubbling to the app boundary.
- Supabase auth failures, including session/profile/MFA failures.
- Missing profile and unexpected unauthorized route states.
- Assignment upload, submission RPC, and attachment replacement failures.
- Tutor/admin marking, feedback, and result release failures.
- Parent report RPC failures.
- NGO cohort report query failures.
- Shared async resource loader failures.

## Privacy Safeguards

Sentry is configured with `sendDefaultPii: false`.

The frontend monitoring wrapper sends:

- role
- route
- feature area
- action name
- Supabase auth user id only
- safe workflow booleans/statuses

The wrapper filters common sensitive fields before sending events, including learner names, emails, phone/contact fields, parent/guardian fields, feedback, notes, answers, filenames, tokens, marks, scores, and rubric data.

Never add uploaded file contents, learner feedback text, parent contact data, raw marks, or private operational notes to monitoring metadata.

## Launch Verification

Before launch:

1. Confirm production env vars are set.
2. Deploy with a release id in `VITE_SENTRY_RELEASE`.
3. Open `/dashboard/login` and confirm no Sentry setup errors in the console.
4. Trigger a controlled non-production/staging render error and confirm it appears in Sentry.
5. Submit a known-invalid assignment upload in staging and confirm the user sees friendly copy while Sentry receives only sanitized workflow metadata.
6. Verify admin, tutor, student, parent, and NGO smoke routes still load.
7. Keep Sentry issue stream open during the first production live-user test window.

## Hold Criteria

Hold launch if:

- Sentry receives learner names, emails, feedback, marks, uploaded file names, or parent contact data.
- App-level errors are not captured in staging.
- Auth/session failures produce blank screens instead of the existing user-friendly states.
- Assignment upload or marking failures are not visible to either the user or monitoring.
