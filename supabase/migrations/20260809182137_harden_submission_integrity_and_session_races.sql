-- REL-01: keep accepted submission files within the same supported set as the
-- grading worker. Storage enforces these limits before its metadata is written;
-- the submission RPC independently verifies that metadata before creating a row.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array[
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
      'text/plain', 'text/markdown', 'text/csv',
      'application/json', 'application/xml', 'text/xml'
    ]::text[]
where id = 'assignment-submissions';

create schema if not exists private;

create or replace function private.validate_assignment_submission_file_metadata(
  p_storage_key text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_extension text := lower((regexp_match(p_storage_key, '\\.([A-Za-z0-9]+)$'))[1]);
  v_mime_type text := lower(split_part(btrim(coalesce(p_mime_type, '')), ';', 1));
begin
  if nullif(btrim(coalesce(p_original_filename, '')), '') is null
     or v_mime_type = ''
     or p_size_bytes is null
     or p_size_bytes < 1
     or p_size_bytes > 5242880
  then
    raise exception 'invalid_submission_file_metadata' using errcode = '23514';
  end if;

  if not (
    (v_mime_type = 'application/pdf' and v_extension = 'pdf')
    or (v_mime_type = 'image/jpeg' and v_extension in ('jpg', 'jpeg'))
    or (v_mime_type = 'image/png' and v_extension = 'png')
    or (v_mime_type = 'image/webp' and v_extension = 'webp')
    or (v_mime_type = 'text/plain' and v_extension = 'txt')
    or (v_mime_type = 'text/markdown' and v_extension in ('md', 'markdown'))
    or (v_mime_type = 'text/csv' and v_extension = 'csv')
    or (v_mime_type = 'application/json' and v_extension = 'json')
    or (v_mime_type in ('application/xml', 'text/xml') and v_extension = 'xml')
  ) then
    raise exception 'submission_file_type_not_allowed' using errcode = '23514';
  end if;
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
set search_path = pg_catalog
as $$
declare
  v_metadata jsonb;
  v_stored_mime_type text;
  v_stored_size_bytes bigint;
  v_requested_mime_type text := lower(split_part(btrim(coalesce(p_mime_type, '')), ';', 1));
begin
  perform private.validate_assignment_submission_file_metadata(
    p_storage_key, p_original_filename, p_mime_type, p_size_bytes
  );

  select o.metadata into v_metadata
  from storage.objects o
  where o.bucket_id = 'assignment-submissions'
    and o.name = p_storage_key;

  if not found then
    raise exception 'submission_file_not_found' using errcode = 'P0002';
  end if;

  v_stored_mime_type := lower(split_part(coalesce(v_metadata ->> 'mimetype', ''), ';', 1));
  begin
    v_stored_size_bytes := nullif(v_metadata ->> 'size', '')::bigint;
  exception when invalid_text_representation then
    raise exception 'submission_file_metadata_unreadable' using errcode = '23514';
  end;

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

revoke all on function private.validate_assignment_submission_file_metadata(text, text, text, bigint) from public, anon, authenticated, service_role;
revoke all on function private.verify_assignment_submission_storage_object(text, text, text, bigint) from public, anon, authenticated, service_role;

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
  if v_storage_key is not null and v_storage_key !~ ('^' || v_student_id::text || '/' || p_assignment_id::text || '/' || p_submission_id::text || '/submission\\.[A-Za-z0-9]+$') then raise exception 'invalid_submission_storage_path' using errcode = '42501'; end if;
  if v_storage_key is not null then perform private.validate_assignment_submission_file_metadata(v_storage_key, v_original_filename, v_mime_type, p_size_bytes); end if;

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
  if v_storage_key is not null and v_storage_key !~ ('^' || v_student_id::text || '/' || p_assignment_id::text || '/' || v_submission_id::text || '/submission\\.[A-Za-z0-9]+$') then raise exception 'invalid_submission_storage_path' using errcode = '42501'; end if;
  if v_storage_key is not null then perform private.verify_assignment_submission_storage_object(v_storage_key, v_original_filename, v_mime_type, p_size_bytes); end if;

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
  return query select v_submission_id;
end;
$$;

-- The edge worker deletes through the Storage API. This RPC exposes only a
-- bounded manifest; it never mutates the Storage schema directly.
create or replace function public.get_orphaned_assignment_submission_objects(p_limit integer default 500)
returns table (bucket_id text, object_name text)
language plpgsql
security definer
set search_path = public
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
    and o.name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/submission\\.[A-Za-z0-9]+$'
    and not exists (
      select 1 from public.assignment_submissions s
      where s.storage_key = o.name or s.file_url = o.name
    )
  order by o.created_at asc
  limit greatest(1, least(coalesce(p_limit, 500), 1000));
end;
$$;

create or replace function public.record_orphaned_assignment_submission_cleanup(p_removed_count integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  perform public.log_audit_event('assignment_submission.orphaned_assets_cleaned', 'system', null, jsonb_build_object('asset_count', greatest(coalesce(p_removed_count, 0), 0)));
end;
$$;

revoke all on function public.get_orphaned_assignment_submission_objects(integer) from public, anon, authenticated;
revoke all on function public.record_orphaned_assignment_submission_cleanup(integer) from public, anon, authenticated;
grant execute on function public.get_orphaned_assignment_submission_objects(integer) to service_role;
grant execute on function public.record_orphaned_assignment_submission_cleanup(integer) to service_role;

-- REL-02: reject historical conflicts before the database becomes the source
-- of truth for overlap prevention, then make a concurrent overlap impossible.
do $$
begin
  if exists (
    select 1
    from public.sessions s1
    join public.sessions s2
      on s1.id < s2.id
     and s1.tutor_id = s2.tutor_id
     and s1.date = s2.date
     and not (s1.end_time <= s2.start_time or s1.start_time >= s2.end_time)
  ) then
    raise exception 'overlapping_sessions_exist'
      using errcode = '23514', hint = 'Resolve historical tutor-session overlaps before applying this constraint.';
  end if;
end;
$$;

create extension if not exists btree_gist;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sessions'::regclass
      and conname = 'sessions_no_tutor_time_overlap'
  ) then
    alter table public.sessions
      add constraint sessions_no_tutor_time_overlap
      exclude using gist (
        tutor_id with =,
        tsrange((date + start_time)::timestamp, (date + end_time)::timestamp, '[)') with &&
      );
  end if;
end;
$$;

create or replace function public.create_session(
  p_tutor_student_allocation_id uuid, p_student_id uuid, p_date date,
  p_start_time time, p_end_time time, p_mode text, p_location text,
  p_notes text, p_idempotency_key text
)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := public.current_tutor_id();
  v_alloc public.tutor_student_allocations%rowtype;
  v_minutes int;
  v_mode text := btrim(coalesce(p_mode, ''));
  v_location text := nullif(btrim(coalesce(p_location, '')), '');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_existing public.sessions%rowtype;
  v_session public.sessions%rowtype;
begin
  if v_tutor_id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.tutors t where t.id = v_tutor_id and t.status = 'active' and t.approval_status = 'approved') then raise exception 'tutor_not_active' using errcode = '42501'; end if;
  if char_length(v_mode) not between 1 and 40 then raise exception 'invalid_request' using errcode = '23514'; end if;
  select * into v_alloc from public.tutor_student_allocations where id = p_tutor_student_allocation_id;
  if not found then raise exception 'assignment_not_found' using errcode = 'P0002'; end if;
  if v_alloc.tutor_id <> v_tutor_id then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_alloc.student_id <> p_student_id then raise exception 'student_mismatch' using errcode = '23514'; end if;
  if v_alloc.status <> 'active' then raise exception 'assignment_inactive' using errcode = '42501'; end if;
  if public.session_date_pay_period_locked(p_date) then raise exception 'pay_period_locked' using errcode = '42501'; end if;
  if not public.session_within_allocation_window(p_date, p_start_time, p_end_time, v_alloc.start_date, v_alloc.end_date, v_alloc.allowed_days_json, v_alloc.allowed_time_ranges_json) then raise exception 'outside_assignment_window' using errcode = '23514'; end if;
  v_minutes := (extract(epoch from (p_end_time - p_start_time)) / 60)::int;
  if v_minutes <= 0 then raise exception 'invalid_duration_minutes' using errcode = '23514'; end if;

  if v_key is not null then
    perform pg_advisory_xact_lock(hashtextextended('session-idempotency:' || v_tutor_id::text || ':' || v_key, 0));
    select * into v_existing from public.sessions where tutor_id = v_tutor_id and sync_key = v_key for update;
    if found then
      if v_existing.tutor_student_allocation_id is distinct from p_tutor_student_allocation_id or v_existing.student_id is distinct from p_student_id or v_existing.date is distinct from p_date or v_existing.start_time is distinct from p_start_time or v_existing.end_time is distinct from p_end_time or v_existing.mode is distinct from v_mode or v_existing.location is distinct from v_location or v_existing.notes is distinct from v_notes then
        raise exception 'idempotency_key_payload_mismatch' using errcode = '23505';
      end if;
      return v_existing;
    end if;
  end if;

  begin
    insert into public.sessions (tutor_id, student_id, tutor_student_allocation_id, date, start_time, end_time, duration_minutes, mode, location, notes, status, sync_key)
    values (v_tutor_id, p_student_id, p_tutor_student_allocation_id, p_date, p_start_time, p_end_time, v_minutes, v_mode, v_location, v_notes, 'draft', v_key)
    returning * into v_session;
  exception when exclusion_violation then
    raise exception 'overlapping_session' using errcode = '23505';
  end;
  perform public.insert_session_history(v_session.id, 'create', null, to_jsonb(v_session));
  return v_session;
end;
$$;

create or replace function public.update_session(
  p_session_id uuid, p_date date, p_start_time time, p_end_time time,
  p_mode text, p_location text, p_notes text
)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := public.current_tutor_id();
  v_current public.sessions%rowtype;
  v_alloc public.tutor_student_allocations%rowtype;
  v_date date; v_start time; v_end time; v_mode text; v_minutes int;
  v_updated public.sessions%rowtype;
begin
  if v_tutor_id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.tutors t where t.id = v_tutor_id and t.status = 'active' and t.approval_status = 'approved') then raise exception 'tutor_not_active' using errcode = '42501'; end if;
  select * into v_current from public.sessions where id = p_session_id and tutor_id = v_tutor_id for update;
  if not found then raise exception 'session_not_found' using errcode = 'P0002'; end if;
  if v_current.status <> 'draft' then raise exception 'only_draft_editable'; end if;
  v_date := coalesce(p_date, v_current.date); v_start := coalesce(p_start_time, v_current.start_time); v_end := coalesce(p_end_time, v_current.end_time); v_mode := coalesce(nullif(btrim(coalesce(p_mode, '')), ''), v_current.mode);
  if char_length(v_mode) not between 1 and 40 then raise exception 'invalid_request' using errcode = '23514'; end if;
  v_minutes := (extract(epoch from (v_end - v_start)) / 60)::int;
  if v_minutes <= 0 then raise exception 'invalid_duration_minutes' using errcode = '23514'; end if;
  if public.session_date_pay_period_locked(v_date) then raise exception 'pay_period_locked' using errcode = '42501'; end if;
  select * into v_alloc from public.tutor_student_allocations where id = v_current.tutor_student_allocation_id;
  if not found then raise exception 'assignment_not_found' using errcode = 'P0002'; end if;
  if v_alloc.status <> 'active' then raise exception 'assignment_inactive' using errcode = '42501'; end if;
  if not public.session_within_allocation_window(v_date, v_start, v_end, v_alloc.start_date, v_alloc.end_date, v_alloc.allowed_days_json, v_alloc.allowed_time_ranges_json) then raise exception 'outside_assignment_window' using errcode = '23514'; end if;
  begin
    update public.sessions set date = v_date, start_time = v_start, end_time = v_end, duration_minutes = v_minutes, mode = v_mode, location = coalesce(nullif(btrim(coalesce(p_location, '')), ''), v_current.location), notes = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), v_current.notes)
    where id = p_session_id and status = 'draft'
    returning * into v_updated;
  exception when exclusion_violation then
    raise exception 'overlapping_session' using errcode = '23505';
  end;
  if not found then raise exception 'session_state_changed' using errcode = '40001'; end if;
  perform public.insert_session_history(p_session_id, 'edit', to_jsonb(v_current), to_jsonb(v_updated));
  return v_updated;
end;
$$;

create or replace function public.submit_session(p_session_id uuid)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := public.current_tutor_id(); v_current public.sessions%rowtype; v_updated public.sessions%rowtype;
begin
  if v_tutor_id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.tutors t where t.id = v_tutor_id and t.status = 'active' and t.approval_status = 'approved') then raise exception 'tutor_not_active' using errcode = '42501'; end if;
  select * into v_current from public.sessions where id = p_session_id and tutor_id = v_tutor_id for update;
  if not found then raise exception 'session_not_found' using errcode = 'P0002'; end if;
  if v_current.status <> 'draft' then raise exception 'only_draft_submittable'; end if;
  if public.session_date_pay_period_locked(v_current.date) then raise exception 'pay_period_locked' using errcode = '42501'; end if;
  update public.sessions set status = 'submitted', submitted_at = now() where id = p_session_id and status = 'draft' returning * into v_updated;
  if not found then raise exception 'session_state_changed' using errcode = '40001'; end if;
  perform public.create_student_notification(v_current.student_id, 'session_report_submitted', 'Session notes submitted', 'Your tutor submitted the latest session summary for review.', '/dashboard/', 'session', p_session_id, '{}'::jsonb);
  perform public.insert_session_history(p_session_id, 'submit', to_jsonb(v_current), to_jsonb(v_updated));
  return v_updated;
end;
$$;

create or replace function public.reject_session(p_session_id uuid, p_reason text)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.sessions%rowtype; v_updated public.sessions%rowtype; v_reason text := nullif(btrim(coalesce(p_reason, '')), ''); v_subject text;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_reason is not null and char_length(v_reason) > 500 then raise exception 'invalid_request' using errcode = '23514'; end if;
  select * into v_current from public.sessions where id = p_session_id for update;
  if not found then raise exception 'session_not_found' using errcode = 'P0002'; end if;
  if public.session_date_pay_period_locked(v_current.date) then raise exception 'pay_period_locked' using errcode = '42501'; end if;
  if v_current.status <> 'submitted' then raise exception 'only_submitted_rejectable'; end if;
  update public.sessions set status = 'rejected' where id = p_session_id and status = 'submitted' returning * into v_updated;
  if not found then raise exception 'session_state_changed' using errcode = '40001'; end if;
  select subj.name into v_subject from public.tutor_student_allocations alloc left join public.subjects subj on subj.id = alloc.subject_id where alloc.id = v_current.tutor_student_allocation_id;
  perform public.create_student_notification(v_current.student_id, 'session_rejected', 'Session rejected', coalesce(v_subject, 'Your session') || ' on ' || v_current.date::text || ' was rejected.', '/dashboard/', 'session', p_session_id, '{}'::jsonb);
  perform public.insert_session_history(p_session_id, 'reject', to_jsonb(v_current), to_jsonb(v_updated) || jsonb_build_object('reject_reason', v_reason));
  return v_updated;
end;
$$;

revoke execute on function public.confirm_assignment_submission_attempt(uuid, uuid, text, text, text, text, bigint, text) from public, anon;
revoke execute on function public.submit_assignment_submission(uuid, uuid, text, text, text, text, bigint, text) from public, anon;
revoke execute on function public.get_orphaned_assignment_submission_objects(integer) from service_role;
revoke execute on function public.record_orphaned_assignment_submission_cleanup(integer) from service_role;
grant execute on function public.confirm_assignment_submission_attempt(uuid, uuid, text, text, text, text, bigint, text) to authenticated;
grant execute on function public.submit_assignment_submission(uuid, uuid, text, text, text, text, bigint, text) to authenticated;
grant execute on function public.get_orphaned_assignment_submission_objects(integer) to service_role;
grant execute on function public.record_orphaned_assignment_submission_cleanup(integer) to service_role;
