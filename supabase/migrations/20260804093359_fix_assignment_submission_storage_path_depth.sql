-- storage.foldername() excludes the filename. The frontend object key is
-- <student>/<assignment>/<submission>/submission.ext, so it has 3 folders,
-- not 4. The former predicate rejected every legitimate student upload.

drop policy if exists "students_upload_own_submission_files" on storage.objects;
create policy "students_upload_own_submission_files"
on storage.objects for insert
with check (
  bucket_id = 'assignment-submissions'
  and public.current_profile_role() = 'student'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = public.current_student_id()::text
  and (storage.foldername(name))[2] in (
    select a.id::text from public.assignments a
    where a.status = 'published'
      and a.organization_id = public.current_student_org_id()
  )
);

drop policy if exists "students_update_own_submission_files" on storage.objects;
create policy "students_update_own_submission_files"
on storage.objects for update
using (
  bucket_id = 'assignment-submissions'
  and public.current_profile_role() = 'student'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = public.current_student_id()::text
  and (storage.foldername(name))[2] in (
    select a.id::text from public.assignments a
    where a.status = 'published'
      and a.organization_id = public.current_student_org_id()
  )
)
with check (
  bucket_id = 'assignment-submissions'
  and public.current_profile_role() = 'student'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = public.current_student_id()::text
  and (storage.foldername(name))[2] in (
    select a.id::text from public.assignments a
    where a.status = 'published'
      and a.organization_id = public.current_student_org_id()
  )
);;
