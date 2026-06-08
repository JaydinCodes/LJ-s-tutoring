# React Role Smoke E2E

The launch smoke suite uses Playwright against the active React + Vite app.

## Commands

```powershell
npm run test:e2e
npm run test:e2e:ui
```

The existing legacy/static browser suite remains available as:

```powershell
npm run test:e2e:web
```

## Test Auth

The React smoke suite does not use production Supabase credentials. `playwright.react.config.ts` starts Vite with `VITE_E2E_AUTH_MOCK=true`, which enables a dev-only auth/data harness. The harness is disabled when `import.meta.env.PROD` is true, so production builds still require real Supabase Auth, profiles, RLS, and RPCs.

Shared password:

```text
ProjectOdysseus!23
```

Documented smoke users:

| Role | Email |
|---|---|
| Student | `student.e2e@projectodysseus.test` |
| Tutor | `tutor.e2e@projectodysseus.test` |
| Admin | `admin.e2e@projectodysseus.test` |
| Parent/guardian | `parent.e2e@projectodysseus.test` |
| NGO partner | `ngo.e2e@projectodysseus.test` |

## Covered Flows

- Public homepage load.
- Student, tutor, admin, parent, and NGO partner login and dashboard access.
- Unauthorized cross-role dashboard blocking.
- Student assignment view and upload/submission.
- Tutor submission review and marking.
- Admin markbook result release.
- Parent released report access.
- NGO aggregate cohort report access.
- Logout clearing the session and blocking protected routes.

For local Supabase Auth/RLS testing with real users, use `docs/supabase/LOCAL_DEVELOPMENT.md` and `docs/supabase/auth-seed-notes.md`.
