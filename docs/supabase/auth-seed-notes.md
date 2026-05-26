# Supabase Auth Seed Notes

The React dashboard routes now require Supabase Auth plus a matching row in `public.profiles`.

## Required Local Test Users

Create these users in Supabase Auth, then insert matching `profiles` rows using their Auth user IDs:

```sql
insert into public.profiles (auth_user_id, full_name, email, role)
values
  ('00000000-0000-0000-0000-000000000001', 'Admin User', 'admin@example.com', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'Student User', 'student@example.com', 'student'),
  ('00000000-0000-0000-0000-000000000003', 'Tutor User', 'tutor@example.com', 'tutor');
```

Replace the UUIDs above with real IDs from `auth.users`.

For the student assignment submission workflow, also create a linked student row:

```sql
insert into public.students (profile_id, grade, school, parent_name, parent_contact, status)
select id, 'Grade 11', 'Demo School', 'Demo Parent', 'demo-parent@example.com', 'active'
from public.profiles
where email = 'student@example.com';
```

For admin assignment creation, the signed-in user must have `profiles.role = 'admin'`.

For tutor assignment creation, the signed-in user must have:

- `profiles.role = 'tutor'`
- a linked `tutors` row
- assignment rows with `assignments.created_by = profiles.id`

RLS intentionally scopes tutor assignment updates to rows created by the current tutor profile. Tutors can insert missing `subjects` rows so assignment creation can reuse or create subject records without granting broad subject-management access.

## Storage

The schema file creates private buckets:

- `assignment-files`
- `assignment-submissions`

If you create buckets manually in the Supabase dashboard, keep them private and apply the storage policies from `docs/supabase/schema.sql`.

## Route Behavior

- `/dashboard/login/` signs in with Supabase Auth.
- `/onboarding/student/` lets signed-in users without a profile create a `student` profile and linked `students` row.
- `/onboarding/tutor/` lets signed-in users without a profile create a `tutor` profile and linked `tutors` row with `pending` status.
- `/dashboard/admin/*` requires `profiles.role = 'admin'`.
- `/dashboard/student/*` requires `profiles.role = 'student'`.
- `/dashboard/tutor/*` requires `profiles.role = 'tutor'`.
- Users without a profile row see a clear profile-missing message.
- Missing Supabase env vars show a setup-required message.

Admin profiles are still intended to be created by a trusted operator or SQL seed, not by public onboarding.
