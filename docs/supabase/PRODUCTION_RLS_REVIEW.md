# Supabase Production RLS Review

Project Odysseus is Supabase-first. Supabase Auth, RLS, Storage, and secure RPC functions are the platform authorization source of truth.

The current `docs/supabase/schema.sql` is the production schema direction, but its policies still need the reviews below before full production cutover.

## Already Covered

- Profiles are self-readable and admin-readable.
- Student and tutor onboarding can create self-owned profile/domain rows.
- Admins can manage operational LMS tables.
- Tutors can manage only assignments where `assignments.created_by = current_profile_id()`.
- Tutors can insert missing `subjects` rows for assignment creation without broad subject-management access.
- Assignment and submission storage buckets are private.
- Student submission file paths are student-scoped.
- Tutors can read submission files only for assignments they created.

## Assignment Submission Cutover

- `assignment_submissions`
  - Student resubmission/versioning is handled by `public.submit_assignment_submission`.
  - Tutor/admin marking is handled by `public.mark_assignment_submission`.
  - Students can insert only submitted rows with `marks_awarded is null` and `feedback is null`.
  - Direct student/tutor update policies are disabled so marks, feedback, status changes, and `is_latest` changes are not browser-controlled.

- `student_progress`
  - Progress rows created from marks are inserted inside `public.mark_assignment_submission`.
  - Direct tutor inserts are disabled in the Supabase schema plan.

## Must Review Before Production Cutover

- `classes` and `class_enrollments`
  - Current read policies are broad for authenticated users to support early dashboard migration.
  - Before production, restrict class visibility to enrolled students, assigned tutors, admins, and relevant NGO partner profiles.

- `payments` and `tutor_payments`
  - Current Supabase finance workflows are admin-only.
  - If parent, student, tutor, or NGO read views are added, create read-only scoped policies rather than broad table access.

- Public onboarding
  - Public self-service onboarding is limited to non-admin roles.
  - Admin role creation must remain trusted-operator or service-role only.

## Test Guardrails

`tests/frontend/supabase-schema-policy.test.cjs` checks the current critical assumptions:

- helper functions exist for role and profile identity.
- tutor assignment writes are scoped to the current tutor profile.
- tutors can insert subjects for assignment creation.
- assignment storage buckets are private and scoped by policy.
- assignment submissions and marking use RPC functions.
- student direct update policies cannot change marks, feedback, or status.

Expand this test whenever direct table policies, RPC functions, or Storage policies change.

## Manual Verification Before Applying In Production

Run these checks with real Supabase Auth test users before production cutover:

- Student can upload to `assignment-submissions/<student-id>/<assignment-id>/<submission-id>/submission.<ext>`.
- Student cannot upload to another student's folder.
- Student can call `submit_assignment_submission` for their own published assignment.
- Student cannot directly update `marks_awarded`, `feedback`, `status`, or `is_latest`.
- Tutor can call `mark_assignment_submission` only for submissions on assignments they created.
- Tutor cannot mark another tutor's assignment submission.
- Admin can mark through the same RPC.
