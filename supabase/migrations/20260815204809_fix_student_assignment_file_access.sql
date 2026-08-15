-- Storage's object lookup evaluates the policy against the object row. Keep
-- the assignment access decision centralized, but pass the assignment ID
-- directly to the eligibility function. Wrapping the same lookup in an
-- EXISTS subquery makes signed URLs for student-visible assignment files
-- resolve as "object not found" even though the assignment RPC can see them.
drop policy if exists "authenticated_read_assignment_files" on storage.objects;
create policy "authenticated_read_assignment_files"
on storage.objects for select
using (
  bucket_id = 'assignment-files'
  and (
    public.is_platform_admin()
    or (
      public.current_profile_role() = 'tutor'
      and exists (
        select 1 from public.assignments a
        where a.id::text = (storage.foldername(name))[1]
          and a.created_by = public.current_profile_id()
      )
    )
    or (
      public.current_profile_role() = 'student'
      and public.can_student_access_assignment(
        case
          when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
            then (storage.foldername(name))[1]::uuid
          else null
        end
      )
    )
  )
);
