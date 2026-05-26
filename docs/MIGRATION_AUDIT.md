# Project Odysseus React + Supabase Migration Audit

Date: 2026-05-25

## Current Structure

The repository is a hybrid application:

- Static public website: `index.html`, `privacy.html`, `terms.html`, `guides/**/*.html`.
- Static admin console: `admin/**/*.html` plus `assets/admin/**/*.js`.
- Static tutor portal: `tutor/**/*.html` plus `assets/tutor/**/*.js`.
- Legacy student portal: `dashboard/**/*.html`, `reports/index.html`, and `assets/student/**/*.js`.
- Newer React student slice: `student-app/src/**/*`, built into `student-app-dist`.
- Existing API/backend: `lms-api`, Fastify, Prisma, PostgreSQL, migrations, tests, RBAC, audit, payments, assignments, tutor portal routes, student dashboard routes.
- Assets and branding: `favicon.svg`, `images/*`, `assets/site.css`, `assets/portal.css`, `assets/animations/odie-mascot-idle.lottie.json`, tutor photos in `images/`.

## Static Files Found

Static HTML to replace after React feature parity:

- Public: `index.html`, `login.html`, `privacy.html`, `terms.html`, `guides/index.html`, `guides/matric-maths-mistakes-guide.html`.
- Student legacy: `dashboard/index.html`, `dashboard/login.html`, `dashboard/assignments/index.html`, `dashboard/results/index.html`, `dashboard/community/index.html`, `dashboard/career/**/*.html`, `reports/index.html`.
- Student React shells: `student/dashboard/index.html`, `student/assignments/index.html`, `student/results/index.html`, `student/progress/index.html`, `student/careers/index.html`.
- Admin: `admin/index.html`, `admin/login.html`, `admin/tutors.html`, `admin/students.html`, `admin/assignments.html`, `admin/approvals.html`, `admin/payroll.html`, `admin/reconciliation.html`, `admin/audit.html`, `admin/privacy-requests.html`, `admin/retention.html`, `admin/results.html`, `admin/ops-runbook.html`.
- Tutor: `tutor/index.html`, `tutor/login.html`, `tutor/dashboard/index.html`, `tutor/sessions.html`, `tutor/assignments.html`, `tutor/reports/index.html`, `tutor/risk/index.html`.

Static CSS/JS to phase out after equivalent React routes exist:

- CSS: `assets/site.css`, `assets/portal.css`, `assets/admin/console.css`, large inline styles in several HTML files.
- Shared JS: `assets/common.js`, `assets/portal-shared.js`, `assets/app-critical.js`, `assets/app-noncritical.js`, `assets/login.js`.
- Student JS: `assets/student/*.js`, especially dashboard, assignments, results, reports, community, career modules and auth guard.
- Admin JS: `assets/admin/*.js`, `assets/admin/domains/*.js`.
- Tutor JS: `assets/tutor/*.js`.

## Feature Map

Public website / marketing:

- Landing page, tutor profiles, FAQ, guide lead magnet, contact/enquiry, tutor application CTA.
- Privacy, terms, guides.

Student dashboard:

- React slice already exists under `student-app`.
- Legacy routes still exist under `dashboard` and `reports`.
- Features include overview metrics, assignments, uploads, results, progress, careers, reports, community, notifications, profile, streaks.

Admin dashboard:

- Static `admin/index.html` with inline CSS and `assets/admin/portal.js`.
- Features include dashboard metrics, tutors, students, assignments, approvals, payroll, reconciliation, audit, privacy requests, retention, ops runbook, results analytics.

Tutor dashboard:

- Static tutor dashboard, sessions, assignments, reports, risk monitor.
- Tutor workflows depend on API endpoints and vanilla DOM rendering.

Assignments:

- Admin/tutor assignment creation and student submission exist across static JS and API endpoints.
- File validation/upload logic exists in both `student-app/src/lib/assignments.ts` and `assets/student/learning-api.js`.

Authentication/onboarding:

- Existing role redirects and auth guards are script-based.
- Supabase Auth is not yet wired into the frontend.
- Onboarding is not yet a coherent React route set.

Payments/reporting:

- Payroll, invoices, pay periods, reconciliation, privacy, audit, and weekly reports exist in API/static admin UI.
- Student payment structure and NGO partner reporting need Supabase data model coverage.

Deprecated/removable later:

- Duplicate legacy student dashboard routes under `dashboard/*` once `student/*` or unified React routes have parity.
- Inline admin/student demo data such as `INITIAL_STUDENTS` in `admin/students.html`.
- Sample career marks should become seed/dev fixtures rather than production UI defaults.

## Data Sources And Hardcoded Data

Existing durable backend data:

- `lms-api/prisma/schema.prisma`, `lms-api/migrations`, and `lms-api/prisma/migrations`.
- JSON catalogs for Odie careers and career goals in `lms-api/data`.

Hardcoded/mock/browser-only data to migrate or classify:

- Inline demo students in `admin/students.html`.
- Career sample marks in `assets/student/odie-careers.js`.
- UI state in `localStorage`/`sessionStorage` for theme, throttling, consent, reflection notes, impersonation metadata.
- Static arrays for nav links, dashboard cards, tutor/admin domain labels.
- Static public copy can remain in React code until CMS/content storage is needed.

## Duplicated UI Patterns

- Admin nav appears independently across admin HTML files.
- Tutor nav appears independently across tutor HTML files.
- Student nav exists in legacy static pages and React components.
- Cards, badges, tables, empty states, status indicators, and dashboard metrics are reimplemented in multiple JS/HTML files.
- API base resolution exists in several files: `assets/common.js`, `assets/portal-shared.js`, role auth guards, and `student-app/src/lib/api.ts`.

## Routing Risks

- There are two student route families: `/dashboard/*` and `/student/*`.
- Login routes are split across `/login.html`, `/dashboard/login.html`, `/admin/login.html`, and `/tutor/login.html`.
- Static admin links use `.html` paths; target React routes should use extensionless paths.
- Current build copies static files into `dist` and separately copies `student-app-dist`; unified React output is not yet wired into production build.

## Migration Risks

- Auth cutover is the highest-risk area because current role access is cookie/API guard based, while Supabase Auth will introduce JWT/RLS semantics.
- Admin dashboard is large and has operational flows; replacing it requires parity tests for approvals, payroll, privacy, audit, and reconciliation.
- Existing backend uses Prisma/PostgreSQL. Moving directly to Supabase means either adopting Supabase Postgres as the primary database or bridging during migration.
- npm reported the repo expects npm 10.x, while the current machine used npm 11.8.0.
- `npm audit` reports 12 vulnerabilities at the root; do not force-fix without dependency review.

## React Architecture Started

Added a parallel React app under `src/` with:

- `src/app` for route registration and app bootstrap.
- `src/components/ui` for reusable primitives.
- `src/components/dashboard` for shared dashboard shell and metrics.
- `src/features/students` for student dashboard data loading and route.
- `src/features/admin` for admin dashboard data loading and route.
- `src/lib/api` for legacy API fallback.
- `src/lib/supabase` for Supabase browser client.
- `src/types` for LMS and database typing.

Current static pages remain active until each React route has feature parity.

## Suggested Migration Order

1. Keep current static build stable.
2. Use `npm run dev:react` to iterate on the new React app.
3. Bring Student Dashboard to parity first, using Supabase where configured and existing API as fallback.
4. Bring Admin Dashboard overview, students, tutors, assignments, payments, NGO reporting, and organogram into React.
5. Implement Supabase schema, RLS, storage buckets, and seed data.
6. Cut over route families one at a time.
7. Remove obsolete static files only after parity and tests.

## First Files Changed

- Added `app.html`, `vite.app.config.ts`, `tsconfig.app.json`.
- Added `src/` React app, dashboard components, Supabase client, typed LMS models, Student/Admin dashboard routes.
- Added Supabase public env placeholders to `.env.example`.
- Added `dev:react`, `build:react`, and split typecheck scripts.
- Added `docs/supabase/schema.sql`.

## First Cutover Slice

The unified React LMS app is now built into `react-app-dist` with stable asset names:

- `/react-app-dist/react-app.css`
- `/react-app-dist/react-app.js`

The existing static build now copies this bundle into `dist`, and the first production-addressable React shells are:

- `/dashboard/student/`
- `/dashboard/admin/`

The older student routes (`/student/dashboard/`, `/student/assignments/`, etc.) and legacy admin routes (`/admin/*.html`) remain active. This avoids breaking the current production surface while allowing the new React routes to be tested in built output.

Netlify rewrites were added for nested React dashboard paths:

- `/dashboard/student/* -> /dashboard/student/index.html`
- `/dashboard/admin/* -> /dashboard/admin/index.html`

Do not remove legacy dashboard/admin static files until the equivalent React route has feature parity, Supabase data coverage, and route-level test coverage.

## Second Cutover Slice

The following nested React routes now render functional data views rather than placeholders:

- `/dashboard/student/assignments/`
- `/dashboard/student/progress/`
- `/dashboard/admin/students/`
- `/dashboard/admin/tutors/`
- `/dashboard/admin/assignments/`
- `/dashboard/admin/payments/`
- `/dashboard/admin/reports/`

`scripts/build-static.js` generates static shell files for these routes inside `dist` so direct URL loads work on a simple static server as well as on Netlify rewrites. This keeps migration testing independent from a server-side SPA fallback.

Validation completed:

- `npm run typecheck`
- `npm run build`
- Direct built-route checks returned HTTP 200 for all React dashboard routes listed above.

## Assignment Workflow Slice

Implemented the first Supabase write workflows in React:

- Admin assignment creation on `/dashboard/admin/assignments/`
  - Requires a signed-in Supabase profile with role `admin` or `tutor`.
  - Creates or reuses a `subjects` row by subject name, grade, and curriculum.
  - Inserts a published row into `assignments`.
  - Uploads optional assignment files to the private `assignment-files` storage bucket and stores the resulting storage path on `assignments.attachment_url`.

- Student assignment submission on `/dashboard/student/assignments/`
  - Requires a signed-in Supabase profile with role `student`.
  - Resolves the current `students` row from the current profile.
  - Uploads optional files to the private `assignment-submissions` bucket using a student-scoped path.
  - Upserts `assignment_submissions` by `(assignment_id, student_id)`.
  - Allows updating text without erasing an existing uploaded file path.

The UI intentionally shows Supabase/auth errors directly for now. This keeps the migration honest: these workflows are real database/storage writes and require Supabase env vars, Auth, RLS, and storage policies to be configured.

## Auth And Role Guard Slice

Implemented Supabase Auth integration for the React LMS routes:

- `/dashboard/login/` provides Supabase password sign-in and magic-link sign-in.
- React dashboard routes are wrapped in role guards.
- `/dashboard/admin/*` requires a signed-in `profiles.role = 'admin'`.
- `/dashboard/student/*` requires a signed-in `profiles.role = 'student'`.
- Missing Supabase env vars show a setup-required screen.
- Signed-in users without a matching `profiles` row get a profile-missing screen.
- Shared dashboard shell includes current profile display and sign out.

Seed/setup notes are documented in `docs/supabase/auth-seed-notes.md`.

## Onboarding Slice

Implemented initial Supabase onboarding routes:

- `/onboarding/student/`
  - Requires a Supabase session.
  - Creates a self-owned `profiles` row with role `student`.
  - Creates the linked `students` row.

- `/onboarding/tutor/`
  - Requires a Supabase session.
  - Creates a self-owned `profiles` row with role `tutor`.
  - Creates the linked `tutors` row with `pending` status.

The auth provider now treats "signed in but no profile row yet" as a valid onboarding state instead of clearing the session. RLS policy planning was updated to allow self-service creation only for non-admin onboarding roles.

## Submission Review Slice

Implemented the first review/marking workflow:

- Admin assignment page now loads recent `assignment_submissions`.
- Admins can update submission status to `submitted`, `marked`, or `returned`.
- Admins can save marks and feedback.
- Marking a submission with marks creates a `student_progress` row using the linked assignment title/subject.
- Student assignment cards now show submitted status, file path, marks, and feedback when available.

This completes the first end-to-end assignment loop at the React/Supabase layer: create assignment -> student submits -> admin reviews -> learner sees feedback/progress.

## Student Payment Workflow Slice

Implemented the first Supabase-backed student payment workflow:

- Admin payments route can create `payments` rows for existing students.
- Admins can update payment status to `pending`, `paid`, `overdue`, or `voided`.
- Setting a payment to `paid` stamps `paid_at`.
- Admin dashboard payment records include a learner label where available.

This covers student payment structure at the first operational level. Tutor payouts still need a dedicated workflow using `tutor_payments`.

## Tutor Payment Workflow Slice

Implemented the first Supabase-backed tutor payout workflow:

- Admin payments route can create `tutor_payments` rows for existing tutors.
- Admins can update tutor payout status to `pending`, `paid`, `overdue`, or `voided`.
- Setting a tutor payout to `paid` stamps `paid_at`.
- Admin payment route now separates student payments and tutor payouts.
- Admin dashboard data now loads `tutor_payments` and attaches tutor labels where available.

This covers the first tutor payment structure. Automatic payout generation from approved sessions remains a future workflow.

## Tutor Dashboard Cutover Slice

Replaced the React tutor placeholders with protected Supabase-backed routes:

- `/dashboard/tutor/`
  - Requires a signed-in Supabase profile with role `tutor`.
  - Loads the current tutor profile, linked classes, tutor-created assignments, and submissions for those assignments.
  - Shows tutor metrics, profile context, classes, assignment status, and recent submission review cards.

- `/dashboard/tutor/classes/`
  - Lists classes linked to the current `tutors.id`.
  - Uses the shared dashboard shell and table pattern.

- `/dashboard/tutor/submissions/`
  - Lets tutors review, mark, and return submissions for assignments they created.
  - Uses the existing `markSubmission` workflow so tutor marking also creates progress records when marked with marks.

The Supabase schema plan now includes tutor-specific submission select/update policies and tutor read access for submission storage files tied to tutor-created assignments. This avoids building a React page that only works for admins.

## Assignment Lifecycle Slice

Implemented the first edit/close/archive workflow for assignments:

- Admin assignment management now includes editable assignment cards.
- Admins can update title, description, grade, due date, status, subject replacement, curriculum, and attachment path.
- Admins can close or archive an assignment directly from the management view.
- `updateAssignment` writes changes to Supabase `assignments` and uploads replacement files to `assignment-files` when provided.
- Student submission logic now rejects submissions for `closed` and `archived` assignments.
- Student assignment panels disable the submission form and show a closed-state message for closed or archived work.

This turns assignment status into functional workflow state instead of display-only metadata.

## Admin Roster Management Slice

Implemented the first operational student/tutor roster workflows:

- Admin dashboard data now enriches `students` and `tutors` with linked `profiles` data.
- `/dashboard/admin/students/` can create a student profile/record for an existing Supabase Auth user.
- `/dashboard/admin/students/` can update learner name, email, phone, grade, school, parent details, NGO partner, and status.
- `/dashboard/admin/tutors/` can create a tutor profile/record for an existing Supabase Auth user.
- `/dashboard/admin/tutors/` can update tutor name, email, phone, subjects, grades, hourly rate, and status.

These forms intentionally require an existing `auth.users.id`; browser-side admin user creation would require service-role privileges and must be handled by a server function or trusted admin backend later.

## Admin Operations Cutover Slice

Added React routes for the remaining static admin operations surfaces:

- `/dashboard/admin/approvals/`
  - Loads the legacy admin session approval queue through the API.
  - Supports single-session approve/reject actions.
  - Preserves status filtering and operational summary cards.

- `/dashboard/admin/privacy-requests/`
  - Creates POPIA privacy requests through the API.
  - Lists open/closed requests.
  - Supports request closure with outcome/note capture.

- `/dashboard/admin/audit/`
  - Reads the audit log through the API.
  - Supports entity type filtering.

- `/dashboard/admin/retention/`
  - Shows retention policy cutoffs, eligible cleanup counts, and the latest retention event.

- `/dashboard/admin/reconciliation/`, `/dashboard/admin/results/`, and `/dashboard/admin/ops-runbook/`
  - Provide React route surfaces for the remaining admin console areas so direct route testing and navigation can move off `admin/*.html`.

These routes intentionally use the existing admin API where the source of truth is still the Fastify/Prisma operational backend. They are cutover scaffolds plus the highest-value actions, not a Supabase rewrite of every legacy finance/compliance detail yet.

## Student App Consolidation Slice

Started reducing the duplicate `student-app` surface by adding unified React routes under `src/` for:

- `/dashboard/student/results/`
  - Shows marked assignment submissions, feedback, and progress records from the unified student dashboard data loader.

- `/dashboard/student/careers/`
  - Moves the career catalogue and targeted assistant workflow into the unified React dashboard.
  - Uses the existing careers and assistant APIs while the long-term Supabase careers/reporting model is finalized.

- `/dashboard/student/reports/`
  - Adds parent/NGO-ready summary counts using the current assignment/submission/progress/class data.
  - Generates weekly reports through the existing reports API.
  - Lists report history and opens report details including sessions, minutes, summary, topics, assignment highlights, and next step where available.

- `/dashboard/student/community/`
  - Loads study rooms, weekly challenges, and peer Q&A through the existing community API.
  - Supports room creation, room joining, message loading, and message posting.
  - Keeps moderation and RBAC enforcement in the existing API while the frontend moves out of vanilla JS.

The older `student-app` bundle remains in the build temporarily. It should not be deleted until the unified routes cover the remaining UX and route-level tests confirm parity.

## Public Website React Slice

Replaced the first public React placeholders with real routes:

- `/`
  - React public home route now carries the Project Odysseus tutoring offer, dashboard migration context, tutor trust section, program cards, guide CTA, FAQ, tutor application CTA, enquiry capture, and portal CTA.

- `/about`
  - React route for the tutoring/team story and tutor cards.

- `/programs`
  - React route for Grade 8-12 tutoring programs and NGO rollout support.

- `/privacy` and `/terms`
  - React legal routes based on the existing static legal copy.

- `/guides` and `/guides/matric-maths-mistakes-guide`
  - React guide routes now preserve the learning guide index and Matric Maths Mistakes Guide content.
  - Legacy `.html` guide files are still copied for compatibility, but the public React home links to the React guide route.

The React public home route now also owns first-pass enquiry capture:

- Uses a React-controlled quick enquiry form with name, email, grade, message, honeypot spam field, validation, and repeat-submit throttling.
- Posts to `VITE_PO_FORMSPREE_ENDPOINT` when configured.
- Falls back to pre-filled email and WhatsApp contact actions when the endpoint is not configured or submission fails.
- Avoids embedding the legacy hard-coded Formspree endpoint in the React source.

The static build now writes the React shell to `dist/index.html`, so the built root serves the unified React public home. Legacy source HTML remains in the repository for rollback/reference until final cleanup. Public React shells are generated for direct `/about/`, `/programs/`, `/guides/`, `/guides/matric-maths-mistakes-guide/`, `/privacy/`, and `/terms/` checks, now with route-specific descriptions, canonical URLs, Open Graph metadata, indexable robots tags, and the existing fail-safe analytics/SEO scripts. Protected React shells emit `noindex` robots metadata.

## Tutor Operations Cutover Slice

Added React routes for the remaining high-value tutor portal surfaces:

- `/dashboard/tutor/sessions/`
  - Loads tutor sessions through the existing tutor API.
  - Lets tutors open a session, save report notes, and submit draft reports for admin review.

- `/dashboard/tutor/reports/`
  - Loads tutor-linked weekly reports.
  - Opens report details.
  - Regenerates a report for a linked student where the API provides a student ID.

- `/dashboard/tutor/risk/`
  - Loads linked learner risk and momentum signals from the tutor scores API.
  - Presents support-oriented risk cards instead of the legacy list renderer.

These routes currently use the existing Fastify tutor APIs because session/payroll/report approval workflows still live in the legacy operational backend. The old `tutor/*.html` pages remain until tests confirm React parity.

## Admin Payroll Cutover Slice

Added `/dashboard/admin/payroll/` as a React route for the legacy payroll console:

- Loads pay-period adjustments for a selected week.
- Loads pay-period integrity checks including pending submissions, missing invoice lines, overlaps, duplicate sessions, and invoice mismatches.
- Generates weekly invoices through the existing payroll API.
- Locks a pay period through the existing payroll API.
- Creates bonus/correction/penalty adjustments for tutors.

This route complements the Supabase-backed `/dashboard/admin/payments/` route. Payroll remains API-backed because invoice generation, pay-period locks, adjustments, and approval integrity still live in the operational Fastify/Postgres backend.

## Supabase RLS Hardening Slice

Tightened the Supabase schema plan for React workflows:

- Added `public.current_profile_id()` for ownership-scoped policies.
- Changed tutor assignment write access from broad role-based access to `assignments.created_by = current_profile_id()`.
- Added a tutor-only subject insert policy so tutor assignment creation can create missing `subjects` rows without granting broad subject management.
- Added schema policy regression coverage in `tests/frontend/supabase-schema-policy.test.cjs`.
- Added `docs/supabase/PRODUCTION_RLS_REVIEW.md` to document remaining production authorization concerns, especially student submission update columns and tutor progress insertion scope.
