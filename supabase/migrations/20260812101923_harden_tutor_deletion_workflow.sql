-- TUT-DEL-01 hardening for the initial tutor-deletion workflow. The initial
-- migration is already deployed, so this migration only adds/replaces state.

alter table public.tutor_deletion_requests
  add column if not exists processing_subject_auth_user_id uuid,
  add column if not exists processing_claim_token uuid,
  add column if not exists processing_lease_expires_at timestamptz,
  add column if not exists db_erasure_counts jsonb not null default '{}'::jsonb;

alter table public.tutor_deletion_requests
  drop constraint if exists tutor_deletion_requests_processing_state_check;
alter table public.tutor_deletion_requests
  add constraint tutor_deletion_requests_processing_state_check
  check (processing_state in (
    'queued', 'locked', 'auth_banned', 'storage_deleted',
    'database_erased', 'auth_deleted', 'completed', 'failed'
  ));

alter table public.tutor_deletion_requests
  drop constraint if exists tutor_deletion_requests_storage_files_expected_check;
alter table public.tutor_deletion_requests
  add constraint tutor_deletion_requests_storage_files_expected_check
  check (storage_files_expected >= 0);

alter table public.tutor_deletion_requests
  drop constraint if exists tutor_deletion_requests_storage_files_removed_check;
alter table public.tutor_deletion_requests
  add constraint tutor_deletion_requests_storage_files_removed_check
  check (storage_files_removed >= 0);

alter table public.tutor_deletion_requests
  drop constraint if exists tutor_deletion_requests_db_erasure_counts_check;
alter table public.tutor_deletion_requests
  add constraint tutor_deletion_requests_db_erasure_counts_check
  check (jsonb_typeof(db_erasure_counts) = 'object');

create unique index if not exists tutor_deletion_requests_one_open_request_per_tutor
  on public.tutor_deletion_requests (tutor_id)
  where processing_state <> 'completed';

create index if not exists tutor_deletion_requests_resume_queue
  on public.tutor_deletion_requests (processing_lease_expires_at)
  where processing_state <> 'completed';

drop policy if exists "tutor_deletion_requests_admin_select" on public.tutor_deletion_requests;
create policy "tutor_deletion_requests_admin_select"
on public.tutor_deletion_requests for select to authenticated
using (public.is_platform_admin());

create table if not exists public.tutor_deletion_receipts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.tutor_deletion_requests(id) on delete restrict,
  manifest_version text not null,
  storage_files_removed integer not null default 0 check (storage_files_removed >= 0),
  db_erasure_counts jsonb not null default '{}'::jsonb check (jsonb_typeof(db_erasure_counts) = 'object'),
  auth_account_deleted boolean not null check (auth_account_deleted = true),
  completed_at timestamptz not null default now()
);

alter table public.tutor_deletion_receipts enable row level security;
drop policy if exists "tutor_deletion_receipts_admin_select" on public.tutor_deletion_receipts;
create policy "tutor_deletion_receipts_admin_select"
on public.tutor_deletion_receipts for select to authenticated
using (public.is_platform_admin());
revoke all on table public.tutor_deletion_receipts from public, anon, authenticated;
grant select on table public.tutor_deletion_receipts to authenticated;

create or replace function public.prevent_tutor_deletion_receipt_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'tutor_deletion_receipt_is_immutable' using errcode = '42501';
end;
$$;

drop trigger if exists trg_tutor_deletion_receipts_immutable on public.tutor_deletion_receipts;
create trigger trg_tutor_deletion_receipts_immutable
before update or delete on public.tutor_deletion_receipts
for each row execute function public.prevent_tutor_deletion_receipt_mutation();

-- The browser can only queue a request. It cannot call a destructive stage.
create or replace function public.request_tutor_deletion(
  p_tutor_id uuid,
  p_reason text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'admin_mfa_required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tutors where id = p_tutor_id) then
    raise exception 'tutor_not_found' using errcode = 'P0002';
  end if;

  insert into public.tutor_deletion_requests (tutor_id, requested_by, reason)
  values (p_tutor_id, public.current_profile_id(), nullif(btrim(p_reason), ''))
  returning id into v_request_id;

  perform public.log_audit_event(
    'tutor.deletion_requested', 'tutor_deletion_request', v_request_id::text,
    jsonb_build_object('tutor_id', p_tutor_id)
  );
  return v_request_id;
exception when unique_violation then
  raise exception 'tutor_deletion_already_in_progress' using errcode = '23505';
end;
$$;

-- Claiming prevents two workers from deleting the same account concurrently.
create or replace function public.claim_tutor_deletion(
  p_request_id uuid,
  p_claim_token uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_request public.tutor_deletion_requests%rowtype;
  v_profile_id uuid;
  v_auth_user_id uuid;
begin
  if p_claim_token is null then
    raise exception 'tutor_deletion_claim_required' using errcode = '23514';
  end if;
  select * into v_request from public.tutor_deletion_requests where id = p_request_id for update;
  if not found then raise exception 'tutor_deletion_request_not_found' using errcode = 'P0002'; end if;
  if v_request.processing_state = 'completed' then
    return jsonb_build_object('already_completed', true, 'processing_state', 'completed');
  end if;
  if v_request.processing_claim_token is not null
     and v_request.processing_claim_token <> p_claim_token
     and v_request.processing_lease_expires_at > now() then
    raise exception 'tutor_deletion_busy' using errcode = '55P03';
  end if;

  update public.tutor_deletion_requests
  set processing_claim_token = p_claim_token,
      processing_lease_expires_at = now() + interval '30 minutes'
  where id = p_request_id;

  if v_request.processing_state in ('queued', 'failed') then
    select t.profile_id, p.auth_user_id into v_profile_id, v_auth_user_id
    from public.tutors t join public.profiles p on p.id = t.profile_id
    where t.id = v_request.tutor_id for update of t, p;
    if not found then raise exception 'tutor_not_found' using errcode = 'P0002'; end if;

    -- Immediately make existing application JWTs unable to resolve a profile.
    delete from public.profile_identities where profile_id = v_profile_id;
    update public.profiles set auth_user_id = null, updated_at = now() where id = v_profile_id;
    update public.tutors
    set status = 'inactive', approval_status = 'rejected',
        approval_note = 'Account deletion in progress', hourly_rate = null,
        subjects = '{}'::text[], grades = '{}'::text[], qualification_band = null,
        qualified_subjects_json = null, teaching_preferences_json = null
    where id = v_request.tutor_id;
    update public.tutor_student_allocations
    set status = 'inactive', end_date = coalesce(end_date, current_date), updated_at = now()
    where tutor_id = v_request.tutor_id and status = 'active';
    update public.classes set status = 'inactive', updated_at = now()
    where tutor_id = v_request.tutor_id and status = 'active';
    update public.organization_members set status = 'inactive'
    where profile_id = v_profile_id and status = 'active';
    update public.tutor_deletion_requests
    set processing_subject_auth_user_id = v_auth_user_id,
        auth_user_id = v_auth_user_id,
        processing_state = 'locked',
        processing_started_at = coalesce(processing_started_at, now()),
        last_error = null
    where id = p_request_id;
    perform public.log_audit_event('tutor.deletion_locked', 'tutor_deletion_request', p_request_id::text, jsonb_build_object('stage', 'locked'));
    return jsonb_build_object('tutor_id', v_request.tutor_id, 'auth_user_id', v_auth_user_id, 'processing_state', 'locked');
  end if;

  return jsonb_build_object(
    'tutor_id', v_request.tutor_id,
    'auth_user_id', v_request.processing_subject_auth_user_id,
    'processing_state', v_request.processing_state
  );
end;
$$;

create or replace function public.renew_tutor_deletion_lease(
  p_request_id uuid,
  p_claim_token uuid
)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.tutor_deletion_requests
  set processing_lease_expires_at = now() + interval '30 minutes'
  where id = p_request_id and processing_state <> 'completed' and processing_claim_token = p_claim_token;
  if not found then raise exception 'tutor_deletion_lease_lost' using errcode = '55P03'; end if;
  return true;
end;
$$;

create or replace function public.mark_tutor_deletion_auth_banned(p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_state text;
begin
  select processing_state into v_state from public.tutor_deletion_requests where id = p_request_id for update;
  if not found then raise exception 'tutor_deletion_request_not_found' using errcode = 'P0002'; end if;
  if v_state not in ('locked', 'auth_banned') then raise exception 'invalid_tutor_deletion_stage:%', v_state using errcode = '23514'; end if;
  update public.tutor_deletion_requests set processing_state = 'auth_banned', last_error = null where id = p_request_id;
end;
$$;

create or replace function public.get_tutor_deletion_storage_manifest(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tutor_id uuid; v_state text;
begin
  select tutor_id, processing_state into v_tutor_id, v_state from public.tutor_deletion_requests where id = p_request_id;
  if not found then raise exception 'tutor_deletion_request_not_found' using errcode = 'P0002'; end if;
  if v_state not in ('auth_banned', 'storage_deleted') then raise exception 'invalid_tutor_deletion_stage:%', v_state using errcode = '23514'; end if;
  return coalesce((select jsonb_agg(storage_key order by storage_key) from public.tutor_documents where tutor_id = v_tutor_id), '[]'::jsonb);
end;
$$;

create or replace function public.record_tutor_deletion_storage_manifest(p_request_id uuid, p_files_expected integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_files_expected < 0 then raise exception 'invalid_storage_files_expected' using errcode = '23514'; end if;
  update public.tutor_deletion_requests
  set storage_files_expected = greatest(storage_files_expected, p_files_expected)
  where id = p_request_id and processing_state in ('auth_banned', 'storage_deleted');
  if not found then raise exception 'invalid_tutor_deletion_stage' using errcode = '23514'; end if;
end;
$$;

create or replace function public.mark_tutor_deletion_storage_deleted(p_request_id uuid, p_files_removed integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_state text; v_expected integer;
begin
  if p_files_removed < 0 then raise exception 'invalid_storage_files_removed' using errcode = '23514'; end if;
  select processing_state, storage_files_expected into v_state, v_expected from public.tutor_deletion_requests where id = p_request_id for update;
  if not found then raise exception 'tutor_deletion_request_not_found' using errcode = 'P0002'; end if;
  if v_state not in ('auth_banned', 'storage_deleted') then raise exception 'invalid_tutor_deletion_stage:%', v_state using errcode = '23514'; end if;
  if p_files_removed < v_expected then raise exception 'tutor_storage_delete_count_mismatch' using errcode = '23514'; end if;
  update public.tutor_deletion_requests
  set processing_state = 'storage_deleted', storage_files_removed = greatest(storage_files_removed, p_files_removed), last_error = null
  where id = p_request_id;
end;
$$;

create or replace function public.erase_tutor_data(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_request public.tutor_deletion_requests%rowtype;
  v_profile_id uuid;
  v_counts jsonb := '{}'::jsonb;
  v_count integer;
begin
  select * into v_request from public.tutor_deletion_requests where id = p_request_id for update;
  if not found then raise exception 'tutor_deletion_request_not_found' using errcode = 'P0002'; end if;
  if v_request.processing_state = 'database_erased' then return v_request.db_erasure_counts; end if;
  if v_request.processing_state <> 'storage_deleted' then raise exception 'invalid_tutor_deletion_stage:%', v_request.processing_state using errcode = '23514'; end if;
  if v_request.storage_files_removed < v_request.storage_files_expected then raise exception 'tutor_storage_delete_count_mismatch' using errcode = '23514'; end if;
  select profile_id into v_profile_id from public.tutors where id = v_request.tutor_id for update;
  if not found then raise exception 'tutor_not_found' using errcode = 'P0002'; end if;

  delete from public.tutor_documents where tutor_id = v_request.tutor_id; get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('tutor_documents_deleted', v_count);
  delete from public.tutor_availability_slots where tutor_id = v_request.tutor_id; get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('availability_slots_deleted', v_count);
  delete from public.tutor_applications where tutor_id = v_request.tutor_id; get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('applications_deleted', v_count);
  delete from public.volunteer_logs where tutor_id = v_request.tutor_id; get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('volunteer_logs_deleted', v_count);
  delete from public.community_answers where profile_id = v_profile_id;
  delete from public.community_challenge_submissions where profile_id = v_profile_id;
  delete from public.community_questions where profile_id = v_profile_id;
  delete from public.community_room_messages where profile_id = v_profile_id;
  delete from public.community_room_members where profile_id = v_profile_id;

  -- Tutor, class, allocation, session, payroll, and audit rows are retained as
  -- non-operational history. This avoids cascading deletion of tutor payments.
  update public.tutors
  set status = 'inactive', approval_status = 'rejected', approval_note = 'Deleted tutor account',
      hourly_rate = null, subjects = '{}'::text[], grades = '{}'::text[], qualification_band = null,
      qualified_subjects_json = null, teaching_preferences_json = null
  where id = v_request.tutor_id;
  delete from public.profile_identities where profile_id = v_profile_id;
  update public.profiles
  set auth_user_id = null, full_name = 'Deleted tutor',
      email = 'deleted-tutor+' || v_profile_id::text || '@removed.invalid',
      phone = null, updated_at = now()
  where id = v_profile_id;
  select count(*) into v_count from public.tutor_payments where tutor_id = v_request.tutor_id;
  v_counts := v_counts || jsonb_build_object('profile_anonymized', 1, 'tutor_tombstoned', 1, 'tutor_payments_retained', v_count);
  update public.tutor_deletion_requests
  set processing_state = 'database_erased', db_erasure_counts = v_counts, last_error = null
  where id = p_request_id;
  perform public.log_audit_event('tutor.deletion_database_erased', 'tutor_deletion_request', p_request_id::text, jsonb_build_object('stage', 'database_erased'));
  return v_counts;
end;
$$;

create or replace function public.mark_tutor_deletion_auth_deleted(p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_state text;
begin
  select processing_state into v_state from public.tutor_deletion_requests where id = p_request_id for update;
  if not found then raise exception 'tutor_deletion_request_not_found' using errcode = 'P0002'; end if;
  if v_state not in ('database_erased', 'auth_deleted') then raise exception 'invalid_tutor_deletion_stage:%', v_state using errcode = '23514'; end if;
  update public.tutor_deletion_requests set processing_state = 'auth_deleted', last_error = null where id = p_request_id;
end;
$$;

create or replace function public.finalize_tutor_deletion(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_request public.tutor_deletion_requests%rowtype; v_receipt public.tutor_deletion_receipts%rowtype;
begin
  select * into v_request from public.tutor_deletion_requests where id = p_request_id for update;
  if not found then raise exception 'tutor_deletion_request_not_found' using errcode = 'P0002'; end if;
  if v_request.processing_state = 'completed' then
    select * into v_receipt from public.tutor_deletion_receipts where request_id = p_request_id;
    return jsonb_build_object('completed', true, 'receipt_id', v_receipt.id, 'completed_at', v_receipt.completed_at);
  end if;
  if v_request.processing_state <> 'auth_deleted' then raise exception 'invalid_tutor_deletion_stage:%', v_request.processing_state using errcode = '23514'; end if;
  insert into public.tutor_deletion_receipts (request_id, manifest_version, storage_files_removed, db_erasure_counts, auth_account_deleted)
  values (p_request_id, 'TUT-DEL-01-v1', greatest(v_request.storage_files_removed, v_request.storage_files_expected), v_request.db_erasure_counts, true)
  on conflict (request_id) do nothing;
  select * into v_receipt from public.tutor_deletion_receipts where request_id = p_request_id;
  update public.tutor_deletion_requests
  set status = 'approved', processing_state = 'completed', processing_subject_auth_user_id = null,
      auth_user_id = null, processing_claim_token = null, processing_lease_expires_at = null,
      reason = null, processing_completed_at = v_receipt.completed_at, last_error = null
  where id = p_request_id;
  perform public.log_audit_event('tutor.deletion_completed', 'tutor_deletion_request', p_request_id::text, jsonb_build_object('stage', 'completed', 'receipt_id', v_receipt.id));
  return jsonb_build_object('completed', true, 'receipt_id', v_receipt.id, 'completed_at', v_receipt.completed_at);
end;
$$;

create or replace function public.record_tutor_deletion_error(p_request_id uuid, p_stage text, p_error text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.tutor_deletion_requests
  set last_error = left(coalesce(nullif(btrim(p_stage), ''), 'unknown') || ': ' || coalesce(nullif(regexp_replace(btrim(p_error), '[^A-Za-z0-9_.:-]', '_', 'g'), ''), 'worker_failed'), 240),
      processing_claim_token = null, processing_lease_expires_at = null
  where id = p_request_id and processing_state <> 'completed';
  perform public.log_audit_event('tutor.deletion_failed', 'tutor_deletion_request', p_request_id::text, jsonb_build_object('stage', coalesce(nullif(btrim(p_stage), ''), 'unknown')));
end;
$$;

revoke all on function public.request_tutor_deletion(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.request_tutor_deletion(uuid, text) to authenticated;
revoke all on function public.claim_tutor_deletion(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.renew_tutor_deletion_lease(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.mark_tutor_deletion_auth_banned(uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_tutor_deletion_storage_manifest(uuid) from public, anon, authenticated, service_role;
revoke all on function public.record_tutor_deletion_storage_manifest(uuid, integer) from public, anon, authenticated, service_role;
revoke all on function public.mark_tutor_deletion_storage_deleted(uuid, integer) from public, anon, authenticated, service_role;
revoke all on function public.erase_tutor_data(uuid) from public, anon, authenticated, service_role;
revoke all on function public.mark_tutor_deletion_auth_deleted(uuid) from public, anon, authenticated, service_role;
revoke all on function public.finalize_tutor_deletion(uuid) from public, anon, authenticated, service_role;
revoke all on function public.record_tutor_deletion_error(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.claim_tutor_deletion(uuid, uuid) to service_role;
grant execute on function public.renew_tutor_deletion_lease(uuid, uuid) to service_role;
grant execute on function public.mark_tutor_deletion_auth_banned(uuid) to service_role;
grant execute on function public.get_tutor_deletion_storage_manifest(uuid) to service_role;
grant execute on function public.record_tutor_deletion_storage_manifest(uuid, integer) to service_role;
grant execute on function public.mark_tutor_deletion_storage_deleted(uuid, integer) to service_role;
grant execute on function public.erase_tutor_data(uuid) to service_role;
grant execute on function public.mark_tutor_deletion_auth_deleted(uuid) to service_role;
grant execute on function public.finalize_tutor_deletion(uuid) to service_role;
grant execute on function public.record_tutor_deletion_error(uuid, text, text) to service_role;
