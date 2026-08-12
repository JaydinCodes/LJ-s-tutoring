-- Forward-only correction for environments that applied an earlier draft of
-- the tutor-deletion functions before their definitions were hardened.
alter function public.begin_tutor_deletion(uuid) set search_path = '';
alter function public.erase_tutor_data(uuid, integer) set search_path = '';
alter function public.request_tutor_deletion(uuid, text) set search_path = '';
alter function public.claim_tutor_deletion(uuid, uuid) set search_path = '';
alter function public.renew_tutor_deletion_lease(uuid, uuid) set search_path = '';
alter function public.mark_tutor_deletion_auth_banned(uuid) set search_path = '';
alter function public.get_tutor_deletion_storage_manifest(uuid) set search_path = '';
alter function public.record_tutor_deletion_storage_manifest(uuid, integer) set search_path = '';
alter function public.mark_tutor_deletion_storage_deleted(uuid, integer) set search_path = '';
alter function public.erase_tutor_data(uuid) set search_path = '';
alter function public.mark_tutor_deletion_auth_deleted(uuid) set search_path = '';
alter function public.finalize_tutor_deletion(uuid) set search_path = '';
alter function public.record_tutor_deletion_error(uuid, text, text) set search_path = '';
