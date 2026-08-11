-- Bind every browser-owned submission attempt to one immutable payload before
-- Storage accepts bytes. This closes both the refresh/lost-response gap and
-- the same-attempt/different-file race.

alter table public.assignment_submissions
  add column if not exists content_sha256 text,
  add column if not exists text_answer_sha256 text;

alter table public.assignment_submissions
  drop constraint if exists assignment_submissions_content_sha256_format,
  add constraint assignment_submissions_content_sha256_format
    check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$') not valid,
  drop constraint if exists assignment_submissions_text_answer_sha256_format,
  add constraint assignment_submissions_text_answer_sha256_format
    check (text_answer_sha256 is null or text_answer_sha256 ~ '^[0-9a-f]{64}$') not valid;

create table if not exists public.assignment_submission_attempts (
  id uuid primary key,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  storage_key text,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  content_sha256 text,
  text_answer_sha256 text,
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  constraint assignment_submission_attempts_content_sha256_format
    check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint assignment_submission_attempts_text_answer_sha256_format
    check (text_answer_sha256 is null or text_answer_sha256 ~ '^[0-9a-f]{64}$'),
  constraint assignment_submission_attempts_file_shape
    check (
      (storage_key is null and original_filename is null and mime_type is null and size_bytes is null and content_sha256 is null)
      or
      (storage_key is not null and original_filename is not null and mime_type is not null and size_bytes is not null and content_sha256 is not null)
    ),
  constraint assignment_submission_attempts_content_required
    check (storage_key is not null or text_answer_sha256 is not null)
);

create unique index if not exists assignment_submission_attempts_storage_key_key
  on public.assignment_submission_attempts (storage_key)
  where storage_key is not null;
create index if not exists assignment_submission_attempts_assignment_id_idx
  on public.assignment_submission_attempts (assignment_id);
create index if not exists assignment_submission_attempts_student_id_idx
  on public.assignment_submission_attempts (student_id);
create index if not exists assignment_submission_attempts_abandoned_idx
  on public.assignment_submission_attempts (created_at)
  where committed_at is null;

alter table public.assignment_submission_attempts enable row level security;
revoke all on table public.assignment_submission_attempts from public, anon, authenticated;

create or replace function public.begin_assignment_submission_attempt(
  p_assignment_id uuid,
  p_submission_id uuid,
  p_storage_key text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint,
  p_content_sha256 text,
  p_text_answer text,
  p_text_answer_sha256 text
)
returns table (submission_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := public.current_active_student_id();
  v_storage_key text := nullif(btrim(coalesce(p_storage_key, '')), '');
  v_original_filename text := nullif(btrim(coalesce(p_original_filename, '')), '');
  v_mime_type text := nullif(btrim(coalesce(p_mime_type, '')), '');
  v_text_answer text := nullif(btrim(coalesce(p_text_answer, '')), '');
  v_content_sha256 text := nullif(lower(btrim(coalesce(p_content_sha256, ''))), '');
  v_text_answer_sha256 text := nullif(lower(btrim(coalesce(p_text_answer_sha256, ''))), '');
  v_computed_text_sha256 text;
  v_existing public.assignment_submission_attempts%rowtype;
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then
    raise exception 'only_students_can_begin_submission' using errcode = '42501';
  end if;
  if p_submission_id is null then
    raise exception 'submission_id_required' using errcode = '23502';
  end if;
  if v_text_answer is null and v_storage_key is null then
    raise exception 'submission_content_required' using errcode = '23514';
  end if;
  if v_content_sha256 is not null and v_content_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_submission_content_digest' using errcode = '23514';
  end if;
  if v_text_answer_sha256 is not null and v_text_answer_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_submission_text_digest' using errcode = '23514';
  end if;

  v_computed_text_sha256 := case
    when v_text_answer is null then null
    else encode(extensions.digest(convert_to(v_text_answer, 'UTF8'), 'sha256'), 'hex')
  end;
  if v_text_answer_sha256 is distinct from v_computed_text_sha256 then
    raise exception 'submission_text_digest_mismatch' using errcode = '23514';
  end if;

  if v_storage_key is null then
    if v_original_filename is not null or v_mime_type is not null or p_size_bytes is not null or v_content_sha256 is not null then
      raise exception 'invalid_submission_file_metadata' using errcode = '23514';
    end if;
  else
    if v_content_sha256 is null then
      raise exception 'submission_content_digest_required' using errcode = '23502';
    end if;
    if v_storage_key !~ (
      '^' || v_student_id::text || '/' || p_assignment_id::text || '/' || p_submission_id::text || '/' ||
      v_content_sha256 || '/submission[.][A-Za-z0-9]+$'
    ) then
      raise exception 'invalid_submission_storage_path' using errcode = '42501';
    end if;
    perform private.validate_assignment_submission_file_metadata(
      v_storage_key, v_original_filename, v_mime_type, p_size_bytes
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended('assignment-submission-id:' || p_submission_id::text, 0));
  select a.* into v_existing
  from public.assignment_submission_attempts a
  where a.id = p_submission_id;

  if found then
    if v_existing.assignment_id <> p_assignment_id or v_existing.student_id <> v_student_id then
      raise exception 'submission_id_conflict' using errcode = '23505';
    end if;
    if v_existing.storage_key is distinct from v_storage_key
       or v_existing.original_filename is distinct from v_original_filename
       or v_existing.mime_type is distinct from v_mime_type
       or v_existing.size_bytes is distinct from p_size_bytes
       or v_existing.content_sha256 is distinct from v_content_sha256
       or v_existing.text_answer_sha256 is distinct from v_text_answer_sha256
    then
      raise exception 'submission_retry_payload_mismatch' using errcode = '23505';
    end if;
    return query select v_existing.id;
    return;
  end if;

  if not public.can_student_access_assignment(p_assignment_id) then
    raise exception 'assignment_not_open_for_submission' using errcode = '42501';
  end if;

  insert into public.assignment_submission_attempts (
    id, assignment_id, student_id, storage_key, original_filename, mime_type,
    size_bytes, content_sha256, text_answer_sha256
  ) values (
    p_submission_id, p_assignment_id, v_student_id, v_storage_key, v_original_filename, v_mime_type,
    p_size_bytes, v_content_sha256, v_text_answer_sha256
  );

  return query select p_submission_id;
end;
$$;

create or replace function private.verify_assignment_submission_storage_object(
  p_storage_key text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint
)
returns table (verified_mime_type text, verified_size_bytes bigint)
language plpgsql
security definer
set search_path = 'pg_catalog'
as $$
declare
  v_metadata jsonb;
  v_user_metadata jsonb;
  v_stored_mime_type text;
  v_stored_size_bytes bigint;
  v_stored_sha256 text;
  v_path_sha256 text := split_part(p_storage_key, '/', 4);
  v_requested_mime_type text := lower(split_part(btrim(coalesce(p_mime_type, '')), ';', 1));
begin
  perform private.validate_assignment_submission_file_metadata(
    p_storage_key, p_original_filename, p_mime_type, p_size_bytes
  );

  select o.metadata, o.user_metadata into v_metadata, v_user_metadata
  from storage.objects o
  where o.bucket_id = 'assignment-submissions'
    and o.name = p_storage_key;

  if not found then
    raise exception 'submission_file_not_found' using errcode = 'P0002';
  end if;

  v_stored_mime_type := lower(split_part(coalesce(v_metadata ->> 'mimetype', ''), ';', 1));
  v_stored_sha256 := lower(coalesce(v_user_metadata ->> 'sha256', ''));
  begin
    v_stored_size_bytes := nullif(v_metadata ->> 'size', '')::bigint;
  exception when invalid_text_representation then
    raise exception 'submission_file_metadata_unreadable' using errcode = '23514';
  end;

  if v_path_sha256 !~ '^[0-9a-f]{64}$'
     or v_stored_sha256 is distinct from v_path_sha256
  then
    raise exception 'submission_file_digest_mismatch' using errcode = '23514';
  end if;
  if v_stored_mime_type is distinct from v_requested_mime_type
     or v_stored_size_bytes is distinct from p_size_bytes
  then
    raise exception 'submission_file_metadata_mismatch' using errcode = '23514';
  end if;

  verified_mime_type := v_stored_mime_type;
  verified_size_bytes := v_stored_size_bytes;
  return next;
end;
$$;

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
  v_content_sha256 text;
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then
    return false;
  end if;
  if array_length(v_path_parts, 1) <> 5
     or v_path_parts[1] <> v_student_id::text
     or v_path_parts[4] !~ '^[0-9a-f]{64}$'
     or v_path_parts[5] !~ '^submission[.][A-Za-z0-9]+$'
  then
    return false;
  end if;
  begin
    v_assignment_id := v_path_parts[2]::uuid;
    v_submission_id := v_path_parts[3]::uuid;
    v_content_sha256 := v_path_parts[4];
  exception when invalid_text_representation then
    return false;
  end;

  perform pg_advisory_xact_lock(hashtextextended('assignment-submission-id:' || v_submission_id::text, 0));
  return exists (
    select 1
    from public.assignment_submission_attempts a
    where a.id = v_submission_id
      and a.assignment_id = v_assignment_id
      and a.student_id = v_student_id
      and a.storage_key = p_storage_key
      and a.content_sha256 = v_content_sha256
      and a.committed_at is null
  );
end;
$$;

drop policy if exists "students_update_own_submission_files" on storage.objects;
drop policy if exists "students_upload_own_submission_files" on storage.objects;
create policy "students_upload_own_submission_files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'assignment-submissions'
  and public.can_write_uncommitted_assignment_submission_storage(name)
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
  v_student_id uuid := public.current_active_student_id();
  v_existing_submission public.assignment_submissions%rowtype;
  v_attempt public.assignment_submission_attempts%rowtype;
  v_storage_key text := nullif(btrim(coalesce(p_storage_key, '')), '');
  v_file_url text := nullif(btrim(coalesce(p_file_url, '')), '');
  v_original_filename text := nullif(btrim(coalesce(p_original_filename, '')), '');
  v_mime_type text := nullif(btrim(coalesce(p_mime_type, '')), '');
  v_text_answer text := nullif(btrim(coalesce(p_text_answer, '')), '');
  v_content_sha256 text := case when v_storage_key is null then null else split_part(v_storage_key, '/', 4) end;
  v_text_answer_sha256 text := case when v_text_answer is null then null else encode(extensions.digest(convert_to(v_text_answer, 'UTF8'), 'sha256'), 'hex') end;
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then raise exception 'only_students_can_confirm_submission' using errcode = '42501'; end if;
  if p_submission_id is null then raise exception 'submission_id_required' using errcode = '23502'; end if;
  if v_text_answer is null and v_storage_key is null then raise exception 'submission_content_required' using errcode = '23514'; end if;
  if v_storage_key is distinct from v_file_url then raise exception 'invalid_submission_file_reference' using errcode = '23514'; end if;
  if v_storage_key is null and (v_original_filename is not null or v_mime_type is not null or p_size_bytes is not null) then raise exception 'invalid_submission_file_metadata' using errcode = '23514'; end if;
  if v_storage_key is not null and v_storage_key !~ ('^' || v_student_id::text || '/' || p_assignment_id::text || '/' || p_submission_id::text || '/' || v_content_sha256 || '/submission[.][A-Za-z0-9]+$') then raise exception 'invalid_submission_storage_path' using errcode = '42501'; end if;
  if v_storage_key is not null then perform private.validate_assignment_submission_file_metadata(v_storage_key, v_original_filename, v_mime_type, p_size_bytes); end if;

  perform pg_advisory_xact_lock(hashtextextended('assignment-submission-id:' || p_submission_id::text, 0));
  select s.* into v_existing_submission from public.assignment_submissions s where s.id = p_submission_id;
  if found then
    if v_existing_submission.assignment_id <> p_assignment_id or v_existing_submission.student_id <> v_student_id then raise exception 'submission_id_conflict' using errcode = '23505'; end if;
    if v_existing_submission.storage_key is distinct from v_storage_key or v_existing_submission.file_url is distinct from v_file_url or v_existing_submission.original_filename is distinct from v_original_filename or v_existing_submission.mime_type is distinct from v_mime_type or v_existing_submission.size_bytes is distinct from p_size_bytes or v_existing_submission.text_answer is distinct from v_text_answer or v_existing_submission.content_sha256 is distinct from v_content_sha256 or v_existing_submission.text_answer_sha256 is distinct from v_text_answer_sha256 then raise exception 'submission_retry_payload_mismatch' using errcode = '23505'; end if;
    return query select v_existing_submission.id;
    return;
  end if;

  select a.* into v_attempt from public.assignment_submission_attempts a where a.id = p_submission_id;
  if found and (
    v_attempt.assignment_id <> p_assignment_id or v_attempt.student_id <> v_student_id or
    v_attempt.storage_key is distinct from v_storage_key or v_attempt.original_filename is distinct from v_original_filename or
    v_attempt.mime_type is distinct from v_mime_type or v_attempt.size_bytes is distinct from p_size_bytes or
    v_attempt.content_sha256 is distinct from v_content_sha256 or v_attempt.text_answer_sha256 is distinct from v_text_answer_sha256
  ) then
    raise exception 'submission_retry_payload_mismatch' using errcode = '23505';
  end if;
  if not public.can_student_access_assignment(p_assignment_id) then raise exception 'assignment_not_open_for_submission' using errcode = '42501'; end if;
  return;
end;
$$;

create or replace function public.confirm_assignment_submission_attempt_digest(
  p_assignment_id uuid,
  p_submission_id uuid,
  p_content_sha256 text,
  p_text_answer_sha256 text
)
returns table (submission_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := public.current_active_student_id();
  v_content_sha256 text := nullif(lower(btrim(coalesce(p_content_sha256, ''))), '');
  v_text_answer_sha256 text := nullif(lower(btrim(coalesce(p_text_answer_sha256, ''))), '');
  v_existing_submission public.assignment_submissions%rowtype;
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then
    raise exception 'only_students_can_confirm_submission' using errcode = '42501';
  end if;
  if p_submission_id is null then
    raise exception 'submission_id_required' using errcode = '23502';
  end if;
  if v_content_sha256 is null and v_text_answer_sha256 is null then
    raise exception 'submission_content_required' using errcode = '23514';
  end if;
  if (v_content_sha256 is not null and v_content_sha256 !~ '^[0-9a-f]{64}$')
     or (v_text_answer_sha256 is not null and v_text_answer_sha256 !~ '^[0-9a-f]{64}$')
  then
    raise exception 'invalid_submission_digest' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('assignment-submission-id:' || p_submission_id::text, 0));
  select s.* into v_existing_submission
  from public.assignment_submissions s
  where s.id = p_submission_id;

  if not found then
    if not public.can_student_access_assignment(p_assignment_id) then
      raise exception 'assignment_not_open_for_submission' using errcode = '42501';
    end if;
    return;
  end if;
  if v_existing_submission.assignment_id <> p_assignment_id or v_existing_submission.student_id <> v_student_id then
    raise exception 'submission_id_conflict' using errcode = '23505';
  end if;
  if v_existing_submission.content_sha256 is distinct from v_content_sha256
     or v_existing_submission.text_answer_sha256 is distinct from v_text_answer_sha256
  then
    raise exception 'submission_retry_payload_mismatch' using errcode = '23505';
  end if;
  return query select v_existing_submission.id;
end;
$$;

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
  v_attempt public.assignment_submission_attempts%rowtype;
  v_submission_id uuid := p_submission_id;
  v_next_version integer;
  v_storage_key text := nullif(btrim(coalesce(p_storage_key, '')), '');
  v_file_url text := nullif(btrim(coalesce(p_file_url, '')), '');
  v_original_filename text := nullif(btrim(coalesce(p_original_filename, '')), '');
  v_mime_type text := nullif(btrim(coalesce(p_mime_type, '')), '');
  v_text_answer text := nullif(btrim(coalesce(p_text_answer, '')), '');
  v_content_sha256 text := case when v_storage_key is null then null else split_part(v_storage_key, '/', 4) end;
  v_text_answer_sha256 text := case when v_text_answer is null then null else encode(extensions.digest(convert_to(v_text_answer, 'UTF8'), 'sha256'), 'hex') end;
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then raise exception 'only_students_can_submit' using errcode = '42501'; end if;
  if v_submission_id is null then raise exception 'submission_id_required' using errcode = '23502'; end if;
  if v_text_answer is null and v_storage_key is null then raise exception 'submission_content_required' using errcode = '23514'; end if;
  if v_storage_key is distinct from v_file_url then raise exception 'invalid_submission_file_reference' using errcode = '23514'; end if;
  if v_storage_key is null and (v_original_filename is not null or v_mime_type is not null or p_size_bytes is not null) then raise exception 'invalid_submission_file_metadata' using errcode = '23514'; end if;
  if v_storage_key is not null and v_storage_key !~ ('^' || v_student_id::text || '/' || p_assignment_id::text || '/' || v_submission_id::text || '/' || v_content_sha256 || '/submission[.][A-Za-z0-9]+$') then raise exception 'invalid_submission_storage_path' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtextextended('assignment-submission-id:' || v_submission_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('assignment-submission-version:' || p_assignment_id::text || ':' || v_student_id::text, 0));
  select s.* into v_existing_submission from public.assignment_submissions s where s.id = v_submission_id;
  if found then
    if v_existing_submission.assignment_id <> p_assignment_id or v_existing_submission.student_id <> v_student_id then raise exception 'submission_id_conflict' using errcode = '23505'; end if;
    if v_existing_submission.storage_key is distinct from v_storage_key or v_existing_submission.file_url is distinct from v_file_url or v_existing_submission.original_filename is distinct from v_original_filename or v_existing_submission.mime_type is distinct from v_mime_type or v_existing_submission.size_bytes is distinct from p_size_bytes or v_existing_submission.text_answer is distinct from v_text_answer or v_existing_submission.content_sha256 is distinct from v_content_sha256 or v_existing_submission.text_answer_sha256 is distinct from v_text_answer_sha256 then raise exception 'submission_retry_payload_mismatch' using errcode = '23505'; end if;
    return query select v_existing_submission.id;
    return;
  end if;

  select a.* into v_attempt from public.assignment_submission_attempts a where a.id = v_submission_id;
  if not found then raise exception 'submission_attempt_not_reserved' using errcode = '55000'; end if;
  if v_attempt.assignment_id <> p_assignment_id or v_attempt.student_id <> v_student_id then raise exception 'submission_id_conflict' using errcode = '23505'; end if;
  if v_attempt.storage_key is distinct from v_storage_key or v_attempt.original_filename is distinct from v_original_filename or v_attempt.mime_type is distinct from v_mime_type or v_attempt.size_bytes is distinct from p_size_bytes or v_attempt.content_sha256 is distinct from v_content_sha256 or v_attempt.text_answer_sha256 is distinct from v_text_answer_sha256 then raise exception 'submission_retry_payload_mismatch' using errcode = '23505'; end if;
  if v_storage_key is not null then perform private.verify_assignment_submission_storage_object(v_storage_key, v_original_filename, v_mime_type, p_size_bytes); end if;
  if not public.can_student_access_assignment(p_assignment_id) then raise exception 'assignment_not_open_for_submission' using errcode = '42501'; end if;

  select coalesce(max(s.version_number), 0) + 1 into v_next_version from public.assignment_submissions s where s.assignment_id = p_assignment_id and s.student_id = v_student_id;
  update public.assignment_submissions set is_latest = false where assignment_id = p_assignment_id and student_id = v_student_id and is_latest = true;
  insert into public.assignment_submissions (id, assignment_id, student_id, storage_key, file_url, original_filename, mime_type, size_bytes, content_sha256, text_answer, text_answer_sha256, submitted_at, status, version_number, is_latest, marks_awarded, feedback)
  values (v_submission_id, p_assignment_id, v_student_id, v_storage_key, v_file_url, v_original_filename, v_mime_type, p_size_bytes, v_content_sha256, v_text_answer, v_text_answer_sha256, now(), 'submitted', v_next_version, true, null, null);
  update public.assignment_submission_attempts set committed_at = now() where id = v_submission_id;
  perform public.log_audit_event('assignment_submission.created', 'assignment_submission', v_submission_id::text, jsonb_build_object('assignment_id', p_assignment_id, 'student_id', v_student_id, 'version_number', v_next_version, 'file_uploaded', v_storage_key is not null, 'content_sha256', v_content_sha256, 'text_answer_provided', v_text_answer is not null));
  return query select v_submission_id;
end;
$$;

create or replace function public.get_orphaned_assignment_submission_objects(p_limit integer default 500)
returns table (bucket_id text, object_name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  return query
  select o.bucket_id, o.name
  from storage.objects o
  where o.bucket_id = 'assignment-submissions'
    and o.created_at < now() - interval '24 hours'
    and (
      o.name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/submission[.][A-Za-z0-9]+$'
      or o.name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[0-9a-f]{64}/submission[.][A-Za-z0-9]+$'
    )
    and not exists (
      select 1 from public.assignment_submissions s
      where s.storage_key = o.name or s.file_url = o.name
    )
  order by o.created_at asc
  limit greatest(1, least(coalesce(p_limit, 500), 1000));
end;
$$;

revoke all on function public.begin_assignment_submission_attempt(uuid, uuid, text, text, text, bigint, text, text, text) from public, anon;
grant execute on function public.begin_assignment_submission_attempt(uuid, uuid, text, text, text, bigint, text, text, text) to authenticated;
revoke all on function public.confirm_assignment_submission_attempt_digest(uuid, uuid, text, text) from public, anon;
grant execute on function public.confirm_assignment_submission_attempt_digest(uuid, uuid, text, text) to authenticated;

comment on table public.assignment_submission_attempts is
  'Server-side reservation binding a caller-owned submission UUID to one immutable payload.';
