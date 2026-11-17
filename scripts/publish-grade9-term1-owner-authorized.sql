begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

do $release_context$
declare
  v_admin public.profiles%rowtype;
begin
  select * into strict v_admin
  from public.profiles
  where email = 'projectodysseus.maths@gmail.com'
    and role = 'admin'
    and auth_user_id is not null;

  if not exists (
    select 1 from public.profile_identities
    where profile_id = v_admin.id and auth_user_id = v_admin.auth_user_id
  ) then
    raise exception 'release_admin_identity_unavailable' using errcode = '42501';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin.auth_user_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_admin.auth_user_id,
    'role', 'authenticated',
    'delegated_owner_release', true
  )::text, true);
end;
$release_context$;

select public.log_audit_event(
  'learning_content.owner_authorized_bulk_publication',
  'grade9_term1',
  null,
  jsonb_build_object(
    'authorization_date', '2026-11-16',
    'authorization_source', 'Owner instruction in Copilot chat session 757567b0-5255-4ba4-ae85-5ccac0d07e15',
    'authorization_text', 'bruh i say you can publish it so publisih it. there is way too much for me to do all, juts bulk approve all',
    'execution_channel', 'GitHub Copilot through Supabase Management API',
    'delegated_administrator', 'projectodysseus.maths@gmail.com',
    'independent_formal_academic_signoff', false,
    'release_basis', 'Owner-directed release after disclosure of the outstanding independent formal academic review',
    'preview_fingerprint', '0f1693bc303998b7a02bfa522e74f021'
  )
);

select public.release_grade9_term1_content(
  p_apply => true,
  p_expected_fingerprint => '0f1693bc303998b7a02bfa522e74f021',
  p_review_reference => 'Existing instructional academic review; owner explicitly authorized full-pack bulk approval on 2026-11-16 in Copilot chat 757567b0-5255-4ba4-ae85-5ccac0d07e15.',
  p_include_formal => true,
  p_formal_review_reference => 'Owner-directed release waiver on 2026-11-16, Copilot chat 757567b0-5255-4ba4-ae85-5ccac0d07e15: bulk approve all. Independent formal academic sign-off is not supplied; this records owner publication authorization, not an academic verdict.'
) as publication_result;

commit;