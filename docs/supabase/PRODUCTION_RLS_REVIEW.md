# Supabase Production RLS Review

The current `docs/supabase/schema.sql` is a migration plan for React/Supabase parity, not yet a final production authorization model.

## Already Covered

- Profiles are self-readable and admin-readable.
- Student and tutor onboarding can create self-owned profile/domain rows.
- Admins can manage operational LMS tables.
- Tutors can manage only assignments where `assignments.created_by = current_profile_id()`.
- Tutors can insert missing `subjects` rows for assignment creation without broad subject-management access.
- Assignment and submission storage buckets are private.
- Student submission file paths are student-scoped.
- Tutors can read submission files only for assignments they created.

## Must Review Before Production Cutover

- `assignment_submissions`
  - Students currently need update access for their own submission row so they can resubmit text/files.
  - PostgreSQL RLS does not restrict individual columns by default. Without additional controls, a malicious client could try to update marking fields such as `marks_awarded` or `feedback`.
  - Production options:
    - Use RPC functions for student submission updates and remove direct student update policy.
    - Add column-level privileges so authenticated students cannot update marking columns.
    - Split learner-owned submission content from marker-owned assessment rows.

- `student_progress`
  - Tutors can insert progress after marking submissions.
  - The policy should be tightened further with an RPC or relational proof tying the inserted progress row to a tutor-owned assignment/submission.

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

Expand this test when direct table policies change.
