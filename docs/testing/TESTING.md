# Testing

This repo uses a test pyramid:
- Unit: Frontend helper tests (Node test runner).
- API integration: LMS API tests (Vitest + Postgres).
- E2E: LMS API E2E tests (Vitest).

## Prerequisites
- Node.js 20
- Postgres (local or Docker)
- `DATABASE_URL_TEST` set for LMS tests

Example Docker-backed local Postgres:
```
docker compose up -d db
export DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5433/lms_test
```

If you use the default compose setup, create the `lms_test` database before running tests.

## Run all tests
```
npm run test:all
```

## Individual suites
```
# Unit (frontend helpers)
npm run test:unit

# API integration (LMS)
npm run test:api

# LMS API E2E (Vitest)
npm run test:e2e:api

# Browser E2E (Playwright)
npx playwright install --with-deps chromium
npm run test:e2e:web
```

## Notes
- LMS API E2E uses the test-only login endpoint enabled when `NODE_ENV=test`.
- API E2E resets and seeds the test DB before running.
- Browser E2E also uses the test-only login endpoint for deterministic role-based portal access.

## 20-Minute Production Live-User Test Scope

Use this only after the release gates in `../release/RELEASE_GOVERNANCE.md` have passed and the production deployment is already live. The goal is to validate real production auth, routing, and core workflows with a small controlled group while protecting learner data and keeping rollback simple.

### Guardrails

- Test with approved internal, pilot, or explicitly consented production users only.
- Use real email addresses for production test users. `@dev.local` accounts are local-only and will fail browser email validation on production.
- Do not create synthetic learner data in real student records unless it is clearly marked as test data and can be cleaned up immediately.
- Do not run destructive admin actions against real users, including deletion, retention cleanup, payroll locking, or broad reassignment.
- Keep monitoring open for API health, 5xx rate, slow request ratio, and auth failures.
- Stop the test and start rollback assessment if any P1 alert fires, 5xx ratio stays above 2% for 5 minutes, or more than one pilot user cannot complete login.

### Ensure Production Test Users

Run this only against the production database after choosing real email addresses you control. The student email must be the exact Google account used with the production Google sign-in button. The admin email must be able to receive the OTP email.

PowerShell example:

```powershell
$env:CONFIRM_PROD_TEST_USERS = "yes"
$env:DATABASE_URL = "<production database url>"
$env:PROD_TEST_ADMIN_EMAIL = "admin-test@example.com"
$env:PROD_TEST_ADMIN_PASSWORD = "<strong temporary password>"
$env:PROD_TEST_STUDENT_EMAIL = "student-test@gmail.com"
$env:PROD_TEST_TUTOR_EMAIL = "tutor-test@example.com"
$env:PROD_TEST_TUTOR_PASSWORD = "<strong temporary password>"
npm run seed:prod-test-users --prefix lms-api
```

Expected login paths:

- Student: `https://student.projectodysseus.live/dashboard/login/`, then sign in with Google using `PROD_TEST_STUDENT_EMAIL`.
- Admin: `https://admin.projectodysseus.live/dashboard/login/`, then use `PROD_TEST_ADMIN_EMAIL`, `PROD_TEST_ADMIN_PASSWORD`, and the emailed OTP.
- Tutor, if seeded: `https://tutor.projectodysseus.live/dashboard/login/`, then use `PROD_TEST_TUTOR_EMAIL` and `PROD_TEST_TUTOR_PASSWORD`.

### Scope

| Minute | Owner | Action | Evidence |
|---|---|---|---|
| 0-3 | Release lead | Confirm deployed SHA, production URL, and release gates artifact. | SHA + release gate link recorded. |
| 3-6 | Admin tester | Log in to admin, open dashboard, students, tutors, assignments, approvals, payroll, and audit pages. | Pages load without console/API errors. |
| 6-10 | Tutor tester | Log in as a live/pilot tutor, open dashboard, assignments, sessions, reports, and risk view. | Tutor can access assigned views only. |
| 10-14 | Student tester | Log in as a live/pilot student, open dashboard, reports, community, and career views. | Student can access assigned views only. |
| 14-17 | Release lead | Check `/ready`, `/health`, dashboards, and recent logs for errors or latency spikes. | Health check and monitoring snapshot recorded. |
| 17-20 | Release lead | Decide promote, hold, or rollback assessment. | Decision, timestamp, owner, and cleanup notes recorded. |

### Pass Criteria

- All pilot users can log in through the production auth path.
- Role-based navigation blocks cross-role access.
- Core pages render without visible broken assets or blocking JavaScript errors.
- API health remains green and no alert thresholds are breached.
- Any test data created during the window has a named cleanup owner.

### Hold Or Rollback Triggers

- Production login fails for more than one pilot user.
- Admin pages expose unauthorized data or cross-role access.
- `/ready` fails 3 consecutive checks.
- 5xx ratio exceeds 2% for 5 minutes.
- Slow request ratio exceeds 10% for 5 minutes on core API paths.
- Any payroll, privacy, retention, or audit action behaves unexpectedly.

## Codespaces
Use the same commands as above. Make sure Postgres is available and `DATABASE_URL_TEST` is set.
