create table public.tutor_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id),
  requested_by uuid references public.profiles(id),
  reason text,
  status public.record_status not null default 'pending',
  processing_state text not null default 'queued'
    check (processing_state in (
      'queued',
      'locked',
      'storage_deleted',
      'database_erased',
      'auth_deleted',
      'completed',
      'failed'
    )),
  auth_user_id uuid,
  storage_files_expected integer not null default 0,
  storage_files_removed integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processing_started_at timestamptz,
  processing_completed_at timestamptz
);

alter table public.tutor_deletion_requests enable row level security;

-- No browser/table API writes. Only an admin Edge Function with service_role
-- should operate on these rows.
revoke all on public.tutor_deletion_requests from anon, authenticated;
grant select on public.tutor_deletion_requests to authenticated;

create or replace function public.begin_tutor_deletion(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.tutor_deletion_requests%rowtype;
  v_profile public.profiles%rowtype;
  v_files text[];
begin
  select * into v_request
  from public.tutor_deletion_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'tutor_deletion_request_not_found';
  end if;

  -- Safe for retries.
  if v_request.processing_state <> 'queued'
     and v_request.processing_state <> 'failed' then
    return jsonb_build_object(
      'tutor_id', v_request.tutor_id,
      'auth_user_id', v_request.auth_user_id,
      'processing_state', v_request.processing_state
    );
  end if;

  select p.* into v_profile
  from public.tutors t
  join public.profiles p on p.id = t.profile_id
  where t.id = v_request.tutor_id
  for update;

  if not found then
    raise exception 'tutor_not_found';
  end if;

  -- Stop login/operational access before removing anything.
  update public.tutors
  set status = 'inactive',
      approval_status = 'rejected',
      approval_note = 'Account deletion in progress'
  where id = v_request.tutor_id;

  -- Stop future allocations; preserve history.
  update public.tutor_student_allocations
  set status = 'inactive',
      end_date = coalesce(end_date, current_date)
  where tutor_id = v_request.tutor_id
    and status = 'active';

  -- Stop classes rather than cascade-delete them silently.
  update public.classes
  set status = 'inactive'
  where tutor_id = v_request.tutor_id
    and status = 'active';

  select coalesce(array_agg(storage_key), '{}')
  into v_files
  from public.tutor_documents
  where tutor_id = v_request.tutor_id;

  update public.tutor_deletion_requests
  set auth_user_id = v_profile.auth_user_id,
      storage_files_expected = cardinality(v_files),
      processing_state = 'locked',
      processing_started_at = coalesce(processing_started_at, now()),
      last_error = null
  where id = p_request_id;

  return jsonb_build_object(
    'tutor_id', v_request.tutor_id,
    'auth_user_id', v_profile.auth_user_id,
    'storage_files', to_jsonb(v_files)
  );
end;
$$;

create or replace function public.erase_tutor_data(
  p_request_id uuid,
  p_storage_files_removed integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.tutor_deletion_requests%rowtype;
  v_profile_id uuid;
begin
  select * into v_request
  from public.tutor_deletion_requests
  where id = p_request_id
  for update;

  if not found or v_request.processing_state not in ('locked', 'storage_deleted') then
    raise exception 'invalid_tutor_deletion_stage';
  end if;

  if p_storage_files_removed <> v_request.storage_files_expected then
    raise exception 'tutor_storage_delete_count_mismatch';
  end if;

  select profile_id into v_profile_id
  from public.tutors
  where id = v_request.tutor_id;

  -- Delete personally identifying / operational tutor data.
  -- Do NOT delete tutor_payments or audit rows: finance/audit retention.
  delete from public.tutor_documents where tutor_id = v_request.tutor_id;
  delete from public.tutor_availability_slots where tutor_id = v_request.tutor_id;
  delete from public.tutor_applications where tutor_id = v_request.tutor_id;
  delete from public.volunteer_logs where tutor_id = v_request.tutor_id;

  -- These are now inactive; delete if you do not need allocation/class history.
  delete from public.tutor_student_allocations where tutor_id = v_request.tutor_id;
  delete from public.classes where tutor_id = v_request.tutor_id;

  delete from public.tutors where id = v_request.tutor_id;

  -- Preserve the profile if payments/audit records still reference it,
  -- but remove the Auth mapping and PII.
  update public.profiles
  set auth_user_id = null,
      full_name = 'Deleted tutor',
      email = concat('deleted-tutor-', v_profile_id::text, '@example.invalid'),
      phone = null
  where id = v_profile_id;

  update public.tutor_deletion_requests
  set storage_files_removed = p_storage_files_removed,
      processing_state = 'database_erased'
  where id = p_request_id;
end;
$$;

revoke all on function public.begin_tutor_deletion(uuid) from public, anon, authenticated;
revoke all on function public.erase_tutor_data(uuid, integer) from public, anon, authenticated;

grant execute on function public.begin_tutor_deletion(uuid) to service_role;
grant execute on function public.erase_tutor_data(uuid, integer) to service_role;
