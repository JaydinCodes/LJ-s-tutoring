-- Phase 4 integration hardening:
--   * break the classes <-> class_enrollments RLS recursion with narrowly
--     scoped SECURITY DEFINER ID helpers;
--   * let clients confirm an already-committed submission attempt before a
--     retry upload; and
--   * make submission evidence immutable as soon as its database row commits.

create or replace function public.current_student_class_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ce.class_id
  from public.class_enrollments ce
  where ce.student_id = public.current_student_id()
    and ce.status = 'active'
$$;

create or replace function public.current_tutor_class_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.classes c
  where c.tutor_id = public.current_tutor_id()
$$;

revoke execute on function public.current_student_class_ids() from public;
revoke execute on function public.current_student_class_ids() from anon;
grant execute on function public.current_student_class_ids() to authenticated;
revoke execute on function public.current_tutor_class_ids() from public;
revoke execute on function public.current_tutor_class_ids() from anon;
grant execute on function public.current_tutor_class_ids() to authenticated;

drop policy if exists "classes_select_scoped" on public.classes;
create policy "classes_select_scoped"
on public.classes for select
using (
  public.is_platform_admin()
  or tutor_id = public.current_tutor_id()
  or id in (select public.current_student_class_ids())
);

drop policy if exists "class_enrollments_select_scoped" on public.class_enrollments;
create policy "class_enrollments_select_scoped"
on public.class_enrollments for select
using (
  public.is_platform_admin()
  or student_id = public.current_student_id()
  or class_id in (select public.current_tutor_class_ids())
);

create or replace function public.confirm_assignment_submission_attempt(
  p_assignment_id uuid,
  p_submission_id uuid,
  p_storage_key text,
  p_file_url text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint,
  p_text_answer text
)
returns table (submission_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := public.current_student_id();
  v_existing_submission public.assignment_submissions%rowtype;
  v_storage_key text := nullif(btrim(coalesce(p_storage_key, '')), '');
  v_file_url text := nullif(btrim(coalesce(p_file_url, '')), '');
  v_original_filename text := nullif(btrim(coalesce(p_original_filename, '')), '');
  v_mime_type text := nullif(btrim(coalesce(p_mime_type, '')), '');
  v_text_answer text := nullif(btrim(coalesce(p_text_answer, '')), '');
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then
    raise exception 'only_students_can_confirm_submission' using errcode = '42501';
  end if;
  if p_submission_id is null then
    raise exception 'submission_id_required' using errcode = '23502';
  end if;
  if v_text_answer is null and v_storage_key is null then
    raise exception 'submission_content_required' using errcode = '23514';
  end if;
  if v_storage_key is distinct from v_file_url then
    raise exception 'invalid_submission_file_reference' using errcode = '23514';
  end if;
  if v_storage_key is null
     and (v_original_filename is not null or v_mime_type is not null or p_size_bytes is not null)
  then
    raise exception 'invalid_submission_file_metadata' using errcode = '23514';
  end if;
  if p_size_bytes is not null and p_size_bytes < 0 then
    raise exception 'invalid_submission_file_size' using errcode = '23514';
  end if;
  if v_storage_key is not null
     and v_storage_key !~ ('^' || v_student_id::text || '/' || p_assignment_id::text || '/' || p_submission_id::text || '/submission\.[A-Za-z0-9]+$')
  then
    raise exception 'invalid_submission_storage_path' using errcode = '42501';
  end if;

  -- Wait for an in-flight submit using this UUID. After the lock is acquired,
  -- the row is either durably committed (return it) or absent (the caller may
  -- safely retry the same Storage upload and submit RPC).
  perform pg_advisory_xact_lock(
    hashtextextended('assignment-submission-id:' || p_submission_id::text, 0)
  );

  select s.* into v_existing_submission
  from public.assignment_submissions s
  where s.id = p_submission_id;

  if not found then
    return;
  end if;

  if v_existing_submission.assignment_id <> p_assignment_id
     or v_existing_submission.student_id <> v_student_id
  then
    raise exception 'submission_id_conflict' using errcode = '23505';
  end if;

  if v_existing_submission.storage_key is distinct from v_storage_key
     or v_existing_submission.file_url is distinct from v_file_url
     or v_existing_submission.original_filename is distinct from v_original_filename
     or v_existing_submission.mime_type is distinct from v_mime_type
     or v_existing_submission.size_bytes is distinct from p_size_bytes
     or v_existing_submission.text_answer is distinct from v_text_answer
  then
    raise exception 'submission_retry_payload_mismatch' using errcode = '23505';
  end if;

  return query select v_existing_submission.id;
end;
$$;

revoke execute on function public.confirm_assignment_submission_attempt(uuid, uuid, text, text, text, text, bigint, text) from public;
revoke execute on function public.confirm_assignment_submission_attempt(uuid, uuid, text, text, text, text, bigint, text) from anon;
grant execute on function public.confirm_assignment_submission_attempt(uuid, uuid, text, text, text, text, bigint, text) to authenticated;

create index if not exists idx_assignment_submissions_storage_key
  on public.assignment_submissions(storage_key)
  where storage_key is not null;

create or replace function public.can_write_uncommitted_assignment_submission_storage(p_storage_key text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := public.current_student_id();
  v_path_parts text[] := string_to_array(p_storage_key, '/');
  v_submission_id uuid;
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then
    return false;
  end if;
  if array_length(v_path_parts, 1) <> 4
     or v_path_parts[1] <> v_student_id::text
     or v_path_parts[4] !~ '^submission\.[A-Za-z0-9]+$'
  then
    return false;
  end if;

  begin
    v_submission_id := v_path_parts[3]::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  -- This is intentionally the exact lock namespace used by both submission
  -- RPCs. A Storage write that starts first completes before submit can commit;
  -- a submit that starts first commits before this function checks the row.
  perform pg_advisory_xact_lock(
    hashtextextended('assignment-submission-id:' || v_submission_id::text, 0)
  );

  return not exists (
    select 1
    from public.assignment_submissions s
    where s.id = v_submission_id
      and s.student_id = v_student_id
  );
end;
$$;

revoke execute on function public.can_write_uncommitted_assignment_submission_storage(text) from public;
revoke execute on function public.can_write_uncommitted_assignment_submission_storage(text) from anon;
grant execute on function public.can_write_uncommitted_assignment_submission_storage(text) to authenticated;

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
  and public.can_write_uncommitted_assignment_submission_storage(name)
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
  and public.can_write_uncommitted_assignment_submission_storage(name)
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
  and public.can_write_uncommitted_assignment_submission_storage(name)
);
