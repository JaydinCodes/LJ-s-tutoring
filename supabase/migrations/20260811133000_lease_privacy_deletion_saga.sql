-- PRIV-01: make the cross-service deletion saga independently claimable and
-- preserve the Storage manifest count across a crash after external deletion.

alter table public.privacy_requests
  add column if not exists processing_claim_token uuid,
  add column if not exists processing_lease_expires_at timestamptz,
  add column if not exists storage_files_expected integer not null default 0;

alter table public.privacy_requests
  drop constraint if exists privacy_requests_storage_files_expected_check;
alter table public.privacy_requests
  add constraint privacy_requests_storage_files_expected_check
  check (storage_files_expected >= 0);

create index if not exists idx_privacy_requests_processing_lease
  on public.privacy_requests (processing_lease_expires_at)
  where request_type = 'deletion' and processing_state <> 'completed';

create or replace function public.claim_student_privacy_deletion(
  p_request_id uuid,
  p_claim_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.privacy_requests%rowtype;
  v_context jsonb;
  v_lease_expires_at timestamptz := now() + interval '30 minutes';
begin
  if p_claim_token is null then
    raise exception 'privacy_deletion_claim_required' using errcode = '23514';
  end if;

  select * into v_req
  from public.privacy_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'privacy_request_not_found' using errcode = 'P0002';
  end if;
  if v_req.request_type <> 'deletion' then
    raise exception 'privacy_request_is_not_deletion' using errcode = '23514';
  end if;
  if v_req.processing_state = 'completed' then
    return jsonb_build_object('already_completed', true, 'processing_state', 'completed');
  end if;
  if v_req.processing_claim_token is not null
     and v_req.processing_claim_token <> p_claim_token
     and v_req.processing_lease_expires_at > now() then
    raise exception 'privacy_deletion_busy' using errcode = '55P03';
  end if;

  update public.privacy_requests
  set processing_claim_token = p_claim_token,
      processing_lease_expires_at = v_lease_expires_at,
      updated_at = now()
  where id = p_request_id;

  v_context := public.begin_student_privacy_deletion(p_request_id);
  return v_context || jsonb_build_object(
    'claim_token', p_claim_token,
    'lease_expires_at', v_lease_expires_at
  );
end;
$$;

create or replace function public.renew_student_privacy_deletion_lease(
  p_request_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.privacy_requests
  set processing_lease_expires_at = now() + interval '30 minutes',
      updated_at = now()
  where id = p_request_id
    and processing_state <> 'completed'
    and processing_claim_token = p_claim_token;
  if not found then
    raise exception 'privacy_deletion_lease_lost' using errcode = '55P03';
  end if;
  return true;
end;
$$;

create or replace function public.claim_next_student_privacy_deletion(
  p_claim_token uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
begin
  if p_claim_token is null then
    raise exception 'privacy_deletion_claim_required' using errcode = '23514';
  end if;

  with candidate as (
    select id
    from public.privacy_requests
    where request_type = 'deletion'
      and processing_state <> 'completed'
      and (
        processing_claim_token is null
        or processing_lease_expires_at is null
        or processing_lease_expires_at < now()
      )
    order by created_at asc, id asc
    limit 1
    for update skip locked
  )
  update public.privacy_requests pr
  set processing_claim_token = p_claim_token,
      processing_lease_expires_at = now() + interval '30 minutes',
      updated_at = now()
  from candidate
  where pr.id = candidate.id
  returning pr.id into v_request_id;

  return v_request_id;
end;
$$;

create or replace function public.record_student_privacy_storage_manifest(
  p_request_id uuid,
  p_files_expected integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_files_expected < 0 then
    raise exception 'invalid_storage_files_expected' using errcode = '23514';
  end if;
  update public.privacy_requests
  set storage_files_expected = greatest(storage_files_expected, p_files_expected),
      updated_at = now()
  where id = p_request_id
    and processing_state in ('auth_banned', 'storage_deleted');
  if not found then
    raise exception 'invalid_privacy_deletion_stage' using errcode = '23514';
  end if;
end;
$$;

-- A retry after Storage.remove() succeeded but before this stage write must
-- retain the original count even when the manifest query is now empty.
create or replace function public.mark_student_privacy_storage_deleted(
  p_request_id uuid,
  p_files_removed integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state text;
  v_expected integer;
begin
  if p_files_removed < 0 then
    raise exception 'invalid_storage_files_removed' using errcode = '23514';
  end if;

  select processing_state, storage_files_expected
  into v_state, v_expected
  from public.privacy_requests
  where id = p_request_id
  for update;
  if not found then
    raise exception 'privacy_request_not_found' using errcode = 'P0002';
  end if;
  if v_state not in ('auth_banned', 'storage_deleted') then
    raise exception 'invalid_privacy_deletion_stage:%', v_state using errcode = '23514';
  end if;

  update public.privacy_requests
  set processing_state = 'storage_deleted',
      storage_files_removed = greatest(storage_files_removed, p_files_removed, v_expected),
      last_error = null,
      updated_at = now()
  where id = p_request_id;
end;
$$;

create or replace function public.finalize_student_privacy_deletion(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.privacy_requests%rowtype;
  v_receipt public.privacy_deletion_receipts%rowtype;
  v_financial_hold boolean;
  v_counts jsonb;
begin
  select * into v_req from public.privacy_requests where id = p_request_id for update;
  if not found then raise exception 'privacy_request_not_found' using errcode = 'P0002'; end if;
  if v_req.processing_state = 'completed' then
    select * into v_receipt from public.privacy_deletion_receipts where request_id = p_request_id;
    return jsonb_build_object('completed', true, 'receipt_id', v_receipt.id, 'completed_at', v_receipt.completed_at);
  end if;
  if v_req.processing_state <> 'auth_deleted' then
    raise exception 'invalid_privacy_deletion_stage:%', v_req.processing_state using errcode = '23514';
  end if;

  v_financial_hold := coalesce((v_req.result ->> 'financial_hold')::boolean, false);
  v_counts := coalesce(v_req.result -> 'db_erasure_counts', '{}'::jsonb);
  insert into public.privacy_deletion_receipts (
    request_id, manifest_version, financial_hold, storage_files_removed,
    db_erasure_counts, auth_account_deleted
  ) values (
    p_request_id,
    coalesce(v_req.result ->> 'manifest_version', 'PRIV-01-v1'),
    v_financial_hold,
    greatest(v_req.storage_files_removed, v_req.storage_files_expected),
    v_counts,
    true
  ) on conflict (request_id) do nothing;

  select * into v_receipt from public.privacy_deletion_receipts where request_id = p_request_id;
  update public.privacy_requests
  set status = 'approved', processing_state = 'completed', subject_student_id = null,
      subject_profile_id = null, processing_subject_auth_user_id = null,
      processing_claim_token = null, processing_lease_expires_at = null,
      notes = null, result = jsonb_build_object(
        'completed', true, 'manifest_version', v_receipt.manifest_version,
        'receipt_id', v_receipt.id, 'completed_at', v_receipt.completed_at
      ), processing_completed_at = v_receipt.completed_at,
      last_error = null, updated_at = now()
  where id = p_request_id;
  perform public.log_audit_event('privacy.deletion_completed', 'privacy_request', p_request_id::text,
    jsonb_build_object('stage', 'completed', 'manifest_version', v_receipt.manifest_version, 'receipt_id', v_receipt.id));
  return jsonb_build_object('completed', true, 'receipt_id', v_receipt.id, 'completed_at', v_receipt.completed_at);
end;
$$;

revoke all on function public.claim_student_privacy_deletion(uuid, uuid) from public, anon, authenticated;
revoke all on function public.renew_student_privacy_deletion_lease(uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_next_student_privacy_deletion(uuid) from public, anon, authenticated;
revoke all on function public.record_student_privacy_storage_manifest(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_student_privacy_deletion(uuid, uuid) to service_role;
grant execute on function public.renew_student_privacy_deletion_lease(uuid, uuid) to service_role;
grant execute on function public.claim_next_student_privacy_deletion(uuid) to service_role;
grant execute on function public.record_student_privacy_storage_manifest(uuid, integer) to service_role;
