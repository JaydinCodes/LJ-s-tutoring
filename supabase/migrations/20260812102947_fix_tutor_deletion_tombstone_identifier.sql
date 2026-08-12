-- Do not rely on an extension being in a SECURITY DEFINER function's search
-- path. The profile UUID is unique and sufficient for a non-deliverable email.
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
