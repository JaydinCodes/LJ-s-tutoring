# React Migration Cleanup Checklist

This checklist tracks what can be removed only after equivalent React routes have parity, auth coverage, data coverage, and route-level tests.

## Keep Temporarily

- `index.html`
  - Keep until the React public home route has SEO metadata, enquiry parity, analytics parity, and production root cutover.
- `privacy.html`, `terms.html`
  - Keep until React legal routes are production-routed and validated.
- `guides/**/*.html`
  - Keep until guides are migrated into React or a content system.
- `student-app/` and `student-app-dist/`
  - Keep until unified `src` student routes fully replace `/student/*` route family and route tests pass.
- `dashboard/**/*.html`, `reports/index.html`
  - Keep until `/dashboard/student/*` has final parity and redirects are updated.
- `admin/**/*.html`
  - Keep until React admin routes cover approvals, payroll, reconciliation, audit, privacy, retention, results, and ops runbook workflows with tests.
- `tutor/**/*.html`
  - Keep until React tutor routes cover sessions, assignments, reports, risk, and dashboard parity.

## Candidate Removal After Parity

- `assets/student/*.js`
  - Remove after student dashboard, assignments, results, reports, community, careers, notifications, and auth guard are fully replaced.
- `assets/admin/*.js` and `assets/admin/domains/*.js`
  - Remove after admin React parity and API/Supabase data contracts are verified.
- `assets/tutor/*.js`
  - Remove after tutor React parity.
- `assets/portal.css`, `assets/admin/console.css`, legacy inline page styles
  - Remove after no production route depends on legacy static pages.
- `src/app/routes/PlaceholderRoute.tsx`
  - Removed after public placeholder routes were replaced.

## Remaining Parity Work

- Public site
  - Root cutover, SEO/meta parity, enquiry form migration, guide migration.
- Student
  - Notifications, career subroutes, report exports, community Q&A posting/details, final retirement of `student-app`.
- Admin
  - Reconciliation depth, results analytics, audit export job flow, privacy export/correction details, payroll route-level tests.
- Tutor
  - Tutor assignment creation/editing, invoice/payroll self-service, deeper report parity, route-level tests for sessions/reports/risk.
- Supabase
  - Final RLS policies, storage policies, seed data, generated types, migration from legacy Postgres/API where appropriate.
- Tests
  - Route-level React smoke tests, protected-route tests, assignment E2E, reports/community API integration checks.
