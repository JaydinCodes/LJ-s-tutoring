# Launch Role-Based QA Report

Date: 2026-06-07
Scope: LAUNCH-01 role-based QA pass for the active React + Vite + Supabase app.

## Architecture Checks

- PASS: Active frontend is `src/app/App.tsx` with React Router routes for student, tutor, admin, parent/guardian, and NGO partner launch access.
- PASS: Supabase Auth remains the browser authentication source of truth through `src/features/auth/AuthProvider.tsx` and `src/features/auth/authService.ts`.
- PASS: Role access is driven by Supabase `profiles.role` and centralized normalization in `src/features/auth/roles.ts`.
- PASS: Protected routes handle loading, unconfigured Supabase, unauthenticated, missing profile, invalid role, unauthorized role, and admin MFA states.
- PASS: Major direct-load dashboard routes are included in `scripts/build-static.js` so production refreshes render the React shell.

## Role Flow Matrix

| Flow | Student | Tutor | Admin | Parent/guardian | NGO partner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Login/logout | PASS | PASS | PASS | PASS | PASS | Login is shared Supabase Auth. Logout is present in dashboard shell. |
| Role-based route guards | PASS | PASS | PASS | PASS | PASS | Parent and NGO roles were added to supported dashboard normalization. |
| Unauthorized role blocking | PASS | PASS | PASS | PASS | PASS | `ProtectedRoute` shows Access denied with required/current role. |
| Dashboard loading | PASS | PASS | PASS | N/A | N/A | Parent and NGO launch surface is report access, not a separate dashboard. |
| Student dashboard loading | PASS | N/A | N/A | N/A | N/A | Existing student dashboard route guarded by student role. |
| Student assignment viewing | PASS | N/A | N/A | N/A | N/A | Existing list/detail routes guarded by student role. |
| Student assignment upload/submission | PASS | N/A | N/A | N/A | N/A | Existing mutation uses Supabase RPC/storage path; covered by existing tests. |
| Tutor dashboard loading | N/A | PASS | N/A | N/A | N/A | Existing tutor dashboard route guarded by tutor role. |
| Tutor marking/review workflow | N/A | PASS | N/A | N/A | N/A | Existing submissions route and marking repository remain guarded by tutor role. |
| Admin dashboard loading | N/A | N/A | PASS | N/A | N/A | Existing admin dashboard route guarded by admin role and MFA gate. |
| Admin user/cohort/tutor allocation workflows | N/A | N/A | PASS | N/A | N/A | Existing users, students, tutors, classes, and allocations routes are registered. |
| Admin result release workflow | N/A | N/A | PASS | N/A | N/A | Existing results and assignment release route coverage retained. |
| Parent/guardian report access | N/A | N/A | N/A | PASS | N/A | Added `/dashboard/parent/reports` using `get_parent_progress_reports()`. |
| NGO cohort report access | N/A | N/A | N/A | N/A | PASS | Added `/dashboard/ngo/reports` with aggregate-only Supabase reads. |
| Mobile navigation | PASS | PASS | PASS | PASS | PASS | Student uses bottom nav; tutor/admin/parent/NGO use responsive shell content without blank screens. |
| Missing profile handling | PASS | PASS | PASS | PASS | PASS | Shared guard shows Profile missing. |
| Empty data handling | PASS | PASS | PASS | PASS | PASS | New parent/NGO report pages include explicit empty states. |
| Permission denied handling | PASS | PASS | PASS | PASS | PASS | Shared guard and new report pages show denial/error states. |
| Supabase RLS/RPC error handling | PASS | PASS | PASS | PASS | PASS | Route repositories throw Supabase errors; pages render retryable user-facing messages. |

## Bugs Fixed During QA

- P1: Parent and NGO partner profiles were valid schema roles but treated as invalid dashboard roles by `normalizeUserRole`.
  - Fix: Added `parent` and `ngo_partner` to supported dashboard roles and default dashboard paths.
- P1: Parent/guardian and NGO partner launch report access had no active React routes, causing role accounts to land on invalid-role or redirect-only states.
  - Fix: Added protected `/dashboard/parent/reports` and `/dashboard/ngo/reports` pages.
- P1: Direct production loads for parent/NGO report routes would not have generated static React shell files.
  - Fix: Added parent/NGO routes to `scripts/build-static.js`.
- P1: Assignment storage bucket definitions did not include explicit private bucket flags, causing the storage/RLS contract test to fail.
  - Fix: Restored private bucket creation values for `assignment-files` and `assignment-submissions`.

## Remaining Issues

- P1: NGO partner RLS is documented as aggregate-only, but there is no dedicated NGO-scoped RPC equivalent to `get_parent_progress_reports()`. The new NGO route uses aggregate-only client-side reads and will surface a permission error if RLS does not permit the partner account to read enough aggregate source rows. Recommended follow-up: add a security-definer `get_ngo_cohort_reports()` RPC scoped to the signed-in NGO partner.
- P2: Parent and NGO launch surfaces are report-only. They do not yet have broader dashboards, settings, or profile-management workflows.
- P2: This local pass verified routing, build, type safety, and static test coverage. A final live Supabase seeded-user click-through should still be run in staging with one account per role before launch.

## Manual Verification Notes

- Inspected active routes in `src/app/App.tsx` and confirmed every major dashboard route has a protected element, redirect, or catch-all redirect.
- Inspected `ProtectedRoute` states for loading, Supabase unavailable, unauthenticated, missing profile, invalid role, unauthorized role, and admin MFA.
- Inspected Supabase client setup and confirmed invalid/missing env values produce a user-facing unavailable state.
- Inspected parent report RPC in `docs/supabase/schema.sql` and confirmed it checks `current_profile_role() = 'parent'`, linked guardian profile, active link status, and `can_receive_reports = true`.
- Inspected admin report implementation and confirmed NGO reports remain aggregate-only.
- Confirmed parent/NGO routes render explicit loading, empty, permission/error, and data states.
