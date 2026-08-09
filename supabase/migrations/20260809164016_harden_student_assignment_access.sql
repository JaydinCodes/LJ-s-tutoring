-- AUTH-04 / AUTH-05: Students must never read the raw assignments table.
-- Assignment access is decided once, in the database, and that same decision
-- is used for the student-safe projection, attachment downloads, submission
-- uploads, confirmation, final submission, and AI-job validation.
--
-- `memo_url` and the assignment-memos bucket are retained as private legacy
-- data. New memo uploads or replacements are intentionally not supported.

alter table public.assignments
  add column if not exists available_from timestamptz;

create table if not exists public.assignment_class_targets (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (assignment_id, class_id)
);

create table if not exists public.assignment_student_targets (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (assignment_id, student_id)
);

create index if not exists idx_assignment_class_targets_class_assignment
  on public.assignment_class_targets (class_id, assignment_id);
create index if not exists idx_assignment_student_targets_student_assignment
  on public.assignment_student_targets (student_id, assignment_id);
create index if not exists idx_assignments_student_eligibility
  on public.assignments (organization_id, grade, available_from, due_date)
  where status = 'published';

alter table public.assignment_class_targets enable row level security;
alter table public.assignment_student_targets enable row level security;
revoke all on table public.assignment_class_targets, public.assignment_student_targets from anon, authenticated;

-- With no explicit targets an assignment remains grade-wide, preserving the
-- current product behaviour. Once either target table has a row, the learner
-- must match at least one active class target or explicit learner target.
-- The optional submission id is service-role-only and lets the grading worker
-- revalidate an already accepted immutable submission after the due date or
-- a later assignment closure, without reopening the learner-facing boundary.
create or replace function public.can_student_access_assignment(
  p_assignment_id uuid,
  p_student_id uuid default null,
  p_submission_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_is_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  v_student_id uuid := coalesce(p_student_id, public.current_active_student_id());
  v_submission public.assignment_submissions%rowtype;
  v_assignment public.assignments%rowtype;
  v_checked_at timestamptz := now();
  v_has_targets boolean;
begin
  if p_assignment_id is null or v_student_id is null then
    return false;
  end if;

  if p_student_id is not null and not v_is_service then
    return false;
  end if;
  if p_submission_id is not null and not v_is_service then
    return false;
  end if;

  if not v_is_service and (
    public.current_profile_role() <> 'student'
    or v_student_id is distinct from public.current_active_student_id()
  ) then
    return false;
  end if;

  if p_submission_id is not null then
    select s.* into v_submission
    from public.assignment_submissions s
    where s.id = p_submission_id
      and s.assignment_id = p_assignment_id
      and s.student_id = v_student_id;

    if not found then
      return false;
    end if;
    v_checked_at := v_submission.submitted_at;
  end if;

  select a.* into v_assignment
  from public.assignments a
  where a.id = p_assignment_id;

  if not found
     or v_assignment.organization_id is distinct from (
       select s.organization_id from public.students s where s.id = v_student_id and s.status = 'active'::public.record_status
     )
     or (v_assignment.grade is not null and v_assignment.grade is distinct from (
       select s.grade from public.students s where s.id = v_student_id
     ))
  then
    return false;
  end if;

  -- A service-role grader may only use this exception when it proved it is
  -- grading the immutable, already accepted submission above. Browser calls
  -- always require the live assignment to be published and inside its window.
  if p_submission_id is null and v_assignment.status <> 'published' then
    return false;
  end if;
  if v_assignment.available_from is not null and v_checked_at < v_assignment.available_from then
    return false;
  end if;
  if v_assignment.due_date is not null and v_checked_at > v_assignment.due_date then
    return false;
  end if;

  select exists (
    select 1 from public.assignment_class_targets act where act.assignment_id = p_assignment_id
    union all
    select 1 from public.assignment_student_targets ast where ast.assignment_id = p_assignment_id
  ) into v_has_targets;

  if not v_has_targets then
    return true;
  end if;

  return exists (
    select 1
    from public.assignment_student_targets ast
    where ast.assignment_id = p_assignment_id
      and ast.student_id = v_student_id
  ) or exists (
    select 1
    from public.assignment_class_targets act
    join public.class_enrollments ce
      on ce.class_id = act.class_id
     and ce.student_id = v_student_id
     and ce.status = 'active'::public.record_status
    where act.assignment_id = p_assignment_id
  );
end;
$$;

revoke all on function public.can_student_access_assignment(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.can_student_access_assignment(uuid, uuid, uuid) to authenticated, service_role;

-- This is the only assignment projection granted to a learner. It deliberately
-- omits memo_url, organization_id, created_by, and the internal rubric.
create or replace function public.get_student_accessible_assignments()
returns table (
  id uuid,
  title text,
  description text,
  subject_id uuid,
  grade text,
  due_date timestamptz,
  status public.assignment_status,
  attachment_url text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.title, a.description, a.subject_id, a.grade, a.due_date,
         a.status, a.attachment_url, a.created_at
  from public.assignments a
  where public.can_student_access_assignment(a.id)
  order by a.due_date asc nulls last, a.created_at desc;
$$;

revoke all on function public.get_student_accessible_assignments() from public, anon, authenticated, service_role;
grant execute on function public.get_student_accessible_assignments() to authenticated;

-- Direct target changes are denied. This RPC validates both assignment
-- ownership and same-organization targets before replacing the target set.
create or replace function public.set_assignment_targets(
  p_assignment_id uuid,
  p_class_ids uuid[] default '{}'::uuid[],
  p_student_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.assignments%rowtype;
  v_profile_id uuid := public.current_profile_id();
  v_class_ids uuid[] := coalesce(p_class_ids, '{}'::uuid[]);
  v_student_ids uuid[] := coalesce(p_student_ids, '{}'::uuid[]);
begin
  select a.* into v_assignment from public.assignments a where a.id = p_assignment_id for update;
  if not found then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;
  if not public.is_platform_admin() and (
    public.current_approved_active_tutor_id() is null
    or v_assignment.created_by <> v_profile_id
    or not exists (
      select 1 from public.organization_members om
      where om.organization_id = v_assignment.organization_id
        and om.profile_id = v_profile_id
        and om.org_role = 'tutor'
        and om.status in ('active'::public.record_status, 'approved'::public.record_status)
    )
  ) then
    raise exception 'assignment_organization_forbidden' using errcode = '42501';
  end if;

  if exists (
    select 1 from unnest(v_class_ids) target_id
    left join public.classes c on c.id = target_id and c.organization_id = v_assignment.organization_id
    where c.id is null
  ) or exists (
    select 1 from unnest(v_student_ids) target_id
    left join public.students s on s.id = target_id and s.organization_id = v_assignment.organization_id
    where s.id is null
  ) then
    raise exception 'assignment_target_organization_forbidden' using errcode = '42501';
  end if;

  delete from public.assignment_class_targets where assignment_id = p_assignment_id;
  delete from public.assignment_student_targets where assignment_id = p_assignment_id;

  insert into public.assignment_class_targets (assignment_id, class_id)
  select distinct p_assignment_id, target_id from unnest(v_class_ids) target_id;
  insert into public.assignment_student_targets (assignment_id, student_id)
  select distinct p_assignment_id, target_id from unnest(v_student_ids) target_id;

  perform public.log_audit_event(
    'assignment.targets_replaced', 'assignment', p_assignment_id::text,
    jsonb_build_object('class_target_count', cardinality(v_class_ids), 'student_target_count', cardinality(v_student_ids))
  );
end;
$$;

revoke all on function public.set_assignment_targets(uuid, uuid[], uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.set_assignment_targets(uuid, uuid[], uuid[]) to authenticated;

-- Remove all student access to raw assignment rows. Coordinators, tutors, and
-- platform admins retain their existing staff policies.
drop policy if exists "assignments_student_read_published_own_org" on public.assignments;
drop policy if exists "assignments_org_scoped_read" on public.assignments;

-- Downloading a learner-facing attachment must obey the exact same decision.
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
      and exists (
        select 1 from public.assignments a
        where a.id::text = (storage.foldername(name))[1]
          and public.can_student_access_assignment(a.id)
      )
    )
  )
);

-- Storage first validates a proposed submission with the central eligibility
-- function; the lock helper still protects the immutable-attempt invariant.
create or replace function public.can_write_uncommitted_assignment_submission_storage(p_storage_key text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := public.current_active_student_id();
  v_path_parts text[] := string_to_array(p_storage_key, '/');
  v_assignment_id uuid;
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
    v_assignment_id := v_path_parts[2]::uuid;
    v_submission_id := v_path_parts[3]::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  if not public.can_student_access_assignment(v_assignment_id) then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('assignment-submission-id:' || v_submission_id::text, 0));
  return not exists (
    select 1 from public.assignment_submissions s
    where s.id = v_submission_id and s.student_id = v_student_id
  );
end;
$$;

drop policy if exists "students_upload_own_submission_files" on storage.objects;
create policy "students_upload_own_submission_files"
on storage.objects for insert
with check (
  bucket_id = 'assignment-submissions'
  and public.current_profile_role() = 'student'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = public.current_active_student_id()::text
  and public.can_write_uncommitted_assignment_submission_storage(name)
);

drop policy if exists "students_update_own_submission_files" on storage.objects;
create policy "students_update_own_submission_files"
on storage.objects for update
using (
  bucket_id = 'assignment-submissions'
  and public.current_profile_role() = 'student'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = public.current_active_student_id()::text
  and public.can_write_uncommitted_assignment_submission_storage(name)
)
with check (
  bucket_id = 'assignment-submissions'
  and public.current_profile_role() = 'student'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = public.current_active_student_id()::text
  and public.can_write_uncommitted_assignment_submission_storage(name)
);

-- Confirmation must reject a new ineligible attempt before a browser upload,
-- while still allowing a retry to confirm an already committed attempt.
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
  v_student_id uuid := public.current_active_student_id();
  v_existing_submission public.assignment_submissions%rowtype;
  v_storage_key text := nullif(btrim(coalesce(p_storage_key, '')), '');
  v_file_url text := nullif(btrim(coalesce(p_file_url, '')), '');
  v_original_filename text := nullif(btrim(coalesce(p_original_filename, '')), '');
  v_mime_type text := nullif(btrim(coalesce(p_mime_type, '')), '');
  v_text_answer text := nullif(btrim(coalesce(p_text_answer, '')), '');
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then raise exception 'only_students_can_confirm_submission' using errcode = '42501'; end if;
  if p_submission_id is null then raise exception 'submission_id_required' using errcode = '23502'; end if;
  if v_text_answer is null and v_storage_key is null then raise exception 'submission_content_required' using errcode = '23514'; end if;
  if v_storage_key is distinct from v_file_url then raise exception 'invalid_submission_file_reference' using errcode = '23514'; end if;
  if v_storage_key is null and (v_original_filename is not null or v_mime_type is not null or p_size_bytes is not null) then raise exception 'invalid_submission_file_metadata' using errcode = '23514'; end if;
  if p_size_bytes is not null and p_size_bytes < 0 then raise exception 'invalid_submission_file_size' using errcode = '23514'; end if;
  if v_storage_key is not null and v_storage_key !~ ('^' || v_student_id::text || '/' || p_assignment_id::text || '/' || p_submission_id::text || '/submission\.[A-Za-z0-9]+$') then raise exception 'invalid_submission_storage_path' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtextextended('assignment-submission-id:' || p_submission_id::text, 0));
  select s.* into v_existing_submission from public.assignment_submissions s where s.id = p_submission_id;
  if not found then
    if not public.can_student_access_assignment(p_assignment_id) then raise exception 'assignment_not_open_for_submission' using errcode = '42501'; end if;
    return;
  end if;
  if v_existing_submission.assignment_id <> p_assignment_id or v_existing_submission.student_id <> v_student_id then raise exception 'submission_id_conflict' using errcode = '23505'; end if;
  if v_existing_submission.storage_key is distinct from v_storage_key or v_existing_submission.file_url is distinct from v_file_url or v_existing_submission.original_filename is distinct from v_original_filename or v_existing_submission.mime_type is distinct from v_mime_type or v_existing_submission.size_bytes is distinct from p_size_bytes or v_existing_submission.text_answer is distinct from v_text_answer then raise exception 'submission_retry_payload_mismatch' using errcode = '23505'; end if;
  return query select v_existing_submission.id;
end;
$$;

-- The submit RPC remains idempotent, but a new attempt must now pass the
-- exact central eligibility decision before it can allocate a version.
create or replace function public.submit_assignment_submission(
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
  v_student_id uuid := public.current_active_student_id();
  v_existing_submission public.assignment_submissions%rowtype;
  v_submission_id uuid := p_submission_id;
  v_next_version integer;
  v_storage_key text := nullif(btrim(coalesce(p_storage_key, '')), '');
  v_file_url text := nullif(btrim(coalesce(p_file_url, '')), '');
  v_original_filename text := nullif(btrim(coalesce(p_original_filename, '')), '');
  v_mime_type text := nullif(btrim(coalesce(p_mime_type, '')), '');
  v_text_answer text := nullif(btrim(coalesce(p_text_answer, '')), '');
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then raise exception 'only_students_can_submit' using errcode = '42501'; end if;
  if v_submission_id is null then raise exception 'submission_id_required' using errcode = '23502'; end if;
  if v_text_answer is null and v_storage_key is null then raise exception 'submission_content_required' using errcode = '23514'; end if;
  if v_storage_key is distinct from v_file_url then raise exception 'invalid_submission_file_reference' using errcode = '23514'; end if;
  if v_storage_key is null and (v_original_filename is not null or v_mime_type is not null or p_size_bytes is not null) then raise exception 'invalid_submission_file_metadata' using errcode = '23514'; end if;
  if p_size_bytes is not null and p_size_bytes < 0 then raise exception 'invalid_submission_file_size' using errcode = '23514'; end if;
  if v_storage_key is not null and v_storage_key !~ ('^' || v_student_id::text || '/' || p_assignment_id::text || '/' || v_submission_id::text || '/submission\.[A-Za-z0-9]+$') then raise exception 'invalid_submission_storage_path' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtextextended('assignment-submission-id:' || v_submission_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('assignment-submission-version:' || p_assignment_id::text || ':' || v_student_id::text, 0));
  select s.* into v_existing_submission from public.assignment_submissions s where s.id = v_submission_id;
  if found then
    if v_existing_submission.assignment_id <> p_assignment_id or v_existing_submission.student_id <> v_student_id then raise exception 'submission_id_conflict' using errcode = '23505'; end if;
    if v_existing_submission.storage_key is distinct from v_storage_key or v_existing_submission.file_url is distinct from v_file_url or v_existing_submission.original_filename is distinct from v_original_filename or v_existing_submission.mime_type is distinct from v_mime_type or v_existing_submission.size_bytes is distinct from p_size_bytes or v_existing_submission.text_answer is distinct from v_text_answer then raise exception 'submission_retry_payload_mismatch' using errcode = '23505'; end if;
    return query select v_existing_submission.id;
    return;
  end if;
  if not public.can_student_access_assignment(p_assignment_id) then raise exception 'assignment_not_open_for_submission' using errcode = '42501'; end if;

  select coalesce(max(s.version_number), 0) + 1 into v_next_version from public.assignment_submissions s where s.assignment_id = p_assignment_id and s.student_id = v_student_id;
  update public.assignment_submissions set is_latest = false where assignment_id = p_assignment_id and student_id = v_student_id and is_latest = true;
  insert into public.assignment_submissions (id, assignment_id, student_id, storage_key, file_url, original_filename, mime_type, size_bytes, text_answer, submitted_at, status, version_number, is_latest, marks_awarded, feedback)
  values (v_submission_id, p_assignment_id, v_student_id, v_storage_key, v_file_url, v_original_filename, v_mime_type, p_size_bytes, v_text_answer, now(), 'submitted', v_next_version, true, null, null);
  perform public.log_audit_event('assignment_submission.created', 'assignment_submission', v_submission_id::text, jsonb_build_object('assignment_id', p_assignment_id, 'student_id', v_student_id, 'version_number', v_next_version, 'file_uploaded', v_storage_key is not null, 'text_answer_provided', v_text_answer is not null));
  if v_next_version > 1 and v_storage_key is not null then perform public.log_audit_event('assignment_submission.file_replaced', 'assignment_submission', v_submission_id::text, jsonb_build_object('assignment_id', p_assignment_id, 'student_id', v_student_id, 'version_number', v_next_version)); end if;
  return query select v_submission_id;
end;
$$;

-- The memo input has been retired. Existing private legacy memo paths remain
-- untouched, but finalisation refuses to create, replace, or clear one.
create or replace function public.finalize_assignment_publication(
  p_assignment_id uuid, p_title text, p_description text, p_subject_id uuid,
  p_grade text, p_due_date timestamptz, p_status public.assignment_status,
  p_attachment_url text, p_memo_url text, p_rubric_json jsonb default '[]'::jsonb
)
returns public.assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_assignment public.assignments;
  v_previous_status public.assignment_status;
  v_previous_attachment_url text;
  v_is_new_attachment boolean;
  v_action text;
begin
  select * into v_assignment from public.assignments where id = p_assignment_id for update;
  if not found then raise exception 'assignment_not_found' using errcode = 'P0002'; end if;
  if v_profile_id is null then raise exception 'assignment_actor_required' using errcode = '42501'; end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null or nullif(btrim(coalesce(p_grade, '')), '') is null then raise exception 'assignment_title_and_grade_required' using errcode = '22023'; end if;
  if p_memo_url is distinct from v_assignment.memo_url then raise exception 'assignment_memos_retired' using errcode = '22023'; end if;
  if not public.is_platform_admin() and (
    public.current_approved_active_tutor_id() is null or v_assignment.created_by <> v_profile_id or not exists (
      select 1 from public.organization_members om where om.organization_id = v_assignment.organization_id and om.profile_id = v_profile_id and om.org_role = 'tutor' and om.status in ('active', 'approved')
    )
  ) then raise exception 'assignment_organization_forbidden' using errcode = '42501'; end if;
  if p_attachment_url is not null and p_attachment_url is distinct from v_assignment.attachment_url and (
    p_attachment_url !~ ('^' || v_assignment.id::text || '/staging/[0-9a-fA-F-]{36}/[^/]+$') or not exists (select 1 from storage.objects o where o.bucket_id = 'assignment-files' and o.name = p_attachment_url)
  ) then raise exception 'assignment_attachment_staging_asset_invalid' using errcode = '22023'; end if;
  v_previous_attachment_url := v_assignment.attachment_url;
  v_previous_status := v_assignment.status;
  v_is_new_attachment := p_attachment_url is distinct from v_previous_attachment_url;
  update public.assignments set title = btrim(p_title), description = nullif(btrim(coalesce(p_description, '')), ''), subject_id = p_subject_id, grade = btrim(p_grade), due_date = p_due_date, status = p_status, attachment_url = p_attachment_url, rubric_json = coalesce(p_rubric_json, '[]'::jsonb) where id = v_assignment.id returning * into v_assignment;
  if v_is_new_attachment and v_previous_attachment_url is not null then
    delete from storage.objects o where o.bucket_id = 'assignment-files' and o.name = v_previous_attachment_url and not exists (select 1 from public.assignments a where a.id <> v_assignment.id and a.attachment_url = v_previous_attachment_url);
  end if;
  v_action := case when v_assignment.status = 'published' and v_previous_status is distinct from 'published' then 'assignment.published' else 'assignment.updated' end;
  perform public.log_audit_event(v_action, 'assignment', v_assignment.id::text, jsonb_build_object('status', v_assignment.status, 'grade', v_assignment.grade, 'subject_id', v_assignment.subject_id, 'attachment_replaced', v_is_new_attachment, 'memo_workflow', 'retired'));
  if v_is_new_attachment then perform public.log_audit_event('assignment.attachment_replaced', 'assignment', v_assignment.id::text, jsonb_build_object('previous_attachment_url', v_previous_attachment_url, 'new_attachment_url', p_attachment_url)); end if;
  return v_assignment;
end;
$$;

drop policy if exists "admin_tutor_upload_assignment_memos" on storage.objects;
