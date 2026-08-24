begin;

-- AUTH-01 pending migration preflight
-- AUTH-01: make student/tutor operational authorization status-aware.
--
-- Identity helpers are intentionally separate from operational helpers:
-- pending tutors still need the onboarding/application flow, while all
-- operational student/tutor access must require an active principal.

-- ---------------------------------------------------------------------------
-- 1. Identity helpers (ownership only; NOT sufficient for operational access)
-- ---------------------------------------------------------------------------
create or replace function public.current_student_identity_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.students s
  join public.profile_identities pi on pi.profile_id = s.profile_id
  where pi.auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.current_tutor_identity_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id
  from public.tutors t
  join public.profile_identities pi on pi.profile_id = t.profile_id
  where pi.auth_user_id = auth.uid()
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- 2. Authoritative operational helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_active_student_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.students s
  join public.profile_identities pi on pi.profile_id = s.profile_id
  where pi.auth_user_id = auth.uid()
    and s.status = 'active'::public.record_status
  limit 1
$$;

create or replace function public.current_approved_active_tutor_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id
  from public.tutors t
  join public.profile_identities pi on pi.profile_id = t.profile_id
  where pi.auth_user_id = auth.uid()
    and t.status = 'active'::public.record_status
    and t.approval_status = 'approved'
  limit 1
$$;

-- Pending/reviewing tutors may still complete onboarding, but inactive or
-- suspended tutors must not retain this exception.
create or replace function public.current_tutor_onboarding_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id
  from public.tutors t
  join public.profile_identities pi on pi.profile_id = t.profile_id
  where pi.auth_user_id = auth.uid()
    and t.status in ('pending'::public.record_status, 'active'::public.record_status)
  limit 1
$$;

-- Existing operational policies/RPCs already call current_student_id() /
-- current_tutor_id(). Make those names fail closed by delegating to the new
-- authoritative helpers. Tutor onboarding is moved to identity helpers below.
create or replace function public.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_active_student_id()
$$;

create or replace function public.current_tutor_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_approved_active_tutor_id()
$$;

revoke all on function public.current_student_identity_id() from public, anon;
revoke all on function public.current_tutor_identity_id() from public, anon;
revoke all on function public.current_active_student_id() from public, anon;
revoke all on function public.current_approved_active_tutor_id() from public, anon;
revoke all on function public.current_tutor_onboarding_id() from public, anon;
revoke all on function public.current_student_id() from public, anon;
revoke all on function public.current_tutor_id() from public, anon;

grant execute on function public.current_student_identity_id() to authenticated, service_role;
grant execute on function public.current_tutor_identity_id() to authenticated, service_role;
grant execute on function public.current_active_student_id() to authenticated, service_role;
grant execute on function public.current_approved_active_tutor_id() to authenticated, service_role;
grant execute on function public.current_tutor_onboarding_id() to authenticated, service_role;
grant execute on function public.current_student_id() to authenticated, service_role;
grant execute on function public.current_tutor_id() to authenticated, service_role;

comment on function public.current_student_identity_id() is
  'Identity-only student lookup. Do not use for operational authorization.';
comment on function public.current_tutor_identity_id() is
  'Identity-only tutor lookup. Intended for tutor onboarding/application ownership only.';
comment on function public.current_active_student_id() is
  'Authoritative operational student identity; returns an id only when students.status = active.';
comment on function public.current_approved_active_tutor_id() is
  'Authoritative operational tutor identity; requires status = active and approval_status = approved.';
comment on function public.current_tutor_onboarding_id() is
  'Tutor onboarding identity; permits pending/active tutors but denies inactive/suspended tutors.';

-- ---------------------------------------------------------------------------
-- Org helpers must not bypass operational principal status.
-- ---------------------------------------------------------------------------

create or replace function public.current_student_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.organization_id
  from public.students s
  join public.profile_identities pi on pi.profile_id = s.profile_id
  where pi.auth_user_id = auth.uid()
    and s.status = 'active'::public.record_status
  limit 1
$$;

create or replace function public.current_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select om.organization_id
  from public.organization_members om
  join public.profile_identities pi on pi.profile_id = om.profile_id
  where pi.auth_user_id = auth.uid()
    and om.status = 'active'::public.record_status
    and (
      pi.role not in (
        'student'::public.user_role,
        'tutor'::public.user_role
      )
      or (
        pi.role = 'student'::public.user_role
        and exists (
          select 1
          from public.students s
          where s.profile_id = pi.profile_id
            and s.status = 'active'::public.record_status
        )
      )
      or (
        pi.role = 'tutor'::public.user_role
        and exists (
          select 1
          from public.tutors t
          where t.profile_id = pi.profile_id
            and t.status = 'active'::public.record_status
            and t.approval_status = 'approved'
        )
      )
    )
$$;

create or replace function public.current_org_role(org uuid)
returns public.org_member_role
language sql
stable
security definer
set search_path = ''
as $$
  select om.org_role
  from public.organization_members om
  join public.profile_identities pi on pi.profile_id = om.profile_id
  where pi.auth_user_id = auth.uid()
    and om.organization_id = org
    and om.status = 'active'::public.record_status
    and (
      pi.role not in (
        'student'::public.user_role,
        'tutor'::public.user_role
      )
      or (
        pi.role = 'student'::public.user_role
        and exists (
          select 1
          from public.students s
          where s.profile_id = pi.profile_id
            and s.status = 'active'::public.record_status
        )
      )
      or (
        pi.role = 'tutor'::public.user_role
        and exists (
          select 1
          from public.tutors t
          where t.profile_id = pi.profile_id
            and t.status = 'active'::public.record_status
            and t.approval_status = 'approved'
        )
      )
    )
  order by case om.org_role
    when 'coordinator' then 0
    else 1
  end
  limit 1
$$;
-- ---------------------------------------------------------------------------
-- 3. Keep pending/reviewing tutors able to complete onboarding
-- ---------------------------------------------------------------------------
drop policy if exists "tutors_select_own_application" on public.tutor_applications;
create policy "tutors_select_own_application"
on public.tutor_applications for select
using (tutor_id = public.current_tutor_onboarding_id());

drop policy if exists "tutors_select_own_documents" on public.tutor_documents;
create policy "tutors_select_own_documents"
on public.tutor_documents for select
using (tutor_id = public.current_tutor_onboarding_id());

drop policy if exists "tutors_select_own_availability_slots" on public.tutor_availability_slots;
create policy "tutors_select_own_availability_slots"
on public.tutor_availability_slots for select
using (tutor_id = public.current_tutor_onboarding_id());

drop policy if exists "tutors_upload_own_tutor_documents" on storage.objects;
create policy "tutors_upload_own_tutor_documents"
on storage.objects for insert
with check (
  bucket_id = 'tutor-documents'
  and public.current_profile_role() = 'tutor'
  and array_length(storage.foldername(name), 1) = 1
  and (storage.foldername(name))[1] = public.current_tutor_onboarding_id()::text
);

drop policy if exists "tutors_read_own_tutor_documents_or_admin" on storage.objects;
create policy "tutors_read_own_tutor_documents_or_admin"
on storage.objects for select
using (
  bucket_id = 'tutor-documents'
  and (
    public.is_platform_admin()
    or (storage.foldername(name))[1] = public.current_tutor_onboarding_id()::text
  )
);

create or replace function public.upsert_tutor_application(
  p_personal_details jsonb,
  p_subjects jsonb,
  p_grades jsonb,
  p_teaching_preferences jsonb,
  p_experience text,
  p_availability_notes text
)
returns public.tutor_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := public.current_tutor_onboarding_id();
  v_row public.tutor_applications;
begin
  if v_tutor_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.tutor_applications
    (tutor_id, personal_details_json, subjects_json, grades_json, teaching_preferences_json, experience, availability_notes)
  values
    (v_tutor_id,
     coalesce(p_personal_details, '{}'::jsonb),
     coalesce(p_subjects, '[]'::jsonb),
     coalesce(p_grades, '[]'::jsonb),
     coalesce(p_teaching_preferences, '[]'::jsonb),
     p_experience,
     p_availability_notes)
  on conflict (tutor_id) do update set
    personal_details_json = excluded.personal_details_json,
    subjects_json = excluded.subjects_json,
    grades_json = excluded.grades_json,
    teaching_preferences_json = excluded.teaching_preferences_json,
    experience = excluded.experience,
    availability_notes = excluded.availability_notes,
    status = case when tutor_applications.status = 'approved' then 'changes_requested' else tutor_applications.status end,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.submit_tutor_application()
returns public.tutor_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := public.current_tutor_onboarding_id();
  v_row public.tutor_applications;
begin
  if v_tutor_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.tutor_applications
  set status = 'submitted',
      submitted_at = coalesce(submitted_at, now()),
      updated_at = now()
  where tutor_id = v_tutor_id
    and status in ('draft', 'changes_requested', 'rejected', 'submitted')
  returning * into v_row;

  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

create or replace function public.record_tutor_document(
  p_document_type text,
  p_storage_key text,
  p_original_filename text,
  p_mime_type text,
  p_file_size_bytes int
)
returns public.tutor_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := public.current_tutor_onboarding_id();
  v_row public.tutor_documents;
begin
  if v_tutor_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_document_type not in ('identity', 'cv', 'qualification', 'additional') then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  if p_mime_type not in ('application/pdf', 'image/jpeg', 'image/png') then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  if not starts_with(coalesce(p_storage_key, ''), v_tutor_id::text || '/') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.tutor_documents
    (tutor_id, document_type, storage_key, original_filename, mime_type, file_size_bytes)
  values
    (v_tutor_id, p_document_type, p_storage_key, p_original_filename, p_mime_type, p_file_size_bytes)
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.replace_tutor_availability(p_slots jsonb)
returns setof public.tutor_availability_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := public.current_tutor_onboarding_id();
  v_slot jsonb;
  v_day int;
  v_start time;
  v_end time;
  v_mode text;
  v_notes text;
begin
  if v_tutor_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_slots is null or jsonb_typeof(p_slots) <> 'array' then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  if jsonb_array_length(p_slots) > 42 then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  delete from public.tutor_availability_slots where tutor_id = v_tutor_id;

  for v_slot in select * from jsonb_array_elements(p_slots)
  loop
    v_day := (v_slot->>'dayOfWeek')::int;
    v_start := (v_slot->>'startTime')::time;
    v_end := (v_slot->>'endTime')::time;
    v_mode := btrim(coalesce(v_slot->>'mode', 'online'));
    if v_mode = '' then
      v_mode := 'online';
    end if;
    v_notes := nullif(btrim(coalesce(v_slot->>'notes', '')), '');

    if v_day < 0 or v_day > 6 then
      raise exception 'invalid_request' using errcode = '23514';
    end if;
    if v_end <= v_start then
      raise exception 'invalid_request' using errcode = '23514';
    end if;
    if char_length(v_mode) < 1 or char_length(v_mode) > 40 then
      raise exception 'invalid_request' using errcode = '23514';
    end if;
    if v_notes is not null and char_length(v_notes) > 500 then
      raise exception 'invalid_request' using errcode = '23514';
    end if;

    insert into public.tutor_availability_slots
      (tutor_id, day_of_week, start_time, end_time, mode, notes)
    values
      (v_tutor_id, v_day, v_start, v_end, v_mode, v_notes);
  end loop;

  return query
    select *
    from public.tutor_availability_slots
    where tutor_id = v_tutor_id
    order by day_of_week asc, start_time asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Close tutor authorization paths that checked role/ownership only
-- ---------------------------------------------------------------------------
create or replace function public.can_mark_submission(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_platform_admin()
    or (
      public.current_approved_active_tutor_id() is not null
      and exists (
        select 1
        from public.assignment_submissions sub
        join public.assignments a on a.id = sub.assignment_id
        where sub.id = p_submission_id
          and a.created_by = public.current_profile_id()
      )
    ),
    false
  )
$$;

create or replace function public.record_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role := public.current_profile_role();
begin
  if v_role is null then
    raise exception 'audit_actor_required' using errcode = '42501';
  end if;

  if v_role = 'admin' then
    return public.log_audit_event(p_action, p_entity_type, p_entity_id, p_metadata);
  end if;

  if v_role = 'tutor'
     and public.current_approved_active_tutor_id() is not null
     and p_action in ('assignment.created', 'assignment.updated', 'assignment.attachment_replaced')
     and exists (
       select 1 from public.assignments a
       where a.id::text = p_entity_id
         and a.created_by = public.current_profile_id()
     )
  then
    return public.log_audit_event(p_action, p_entity_type, p_entity_id, p_metadata);
  end if;

  raise exception 'audit_action_not_allowed' using errcode = '42501';
end;
$$;

drop policy if exists "tutors_insert_subjects" on public.subjects;
create policy "tutors_insert_subjects"
on public.subjects for insert
with check (public.current_approved_active_tutor_id() is not null);

drop policy if exists "tutors_manage_own_assignments" on public.assignments;
create policy "tutors_manage_own_assignments"
on public.assignments for all
using (
  public.current_approved_active_tutor_id() is not null
  and created_by = public.current_profile_id()
)
with check (
  public.current_approved_active_tutor_id() is not null
  and created_by = public.current_profile_id()
);

drop policy if exists "tutors_select_own_assignment_submissions" on public.assignment_submissions;
create policy "tutors_select_own_assignment_submissions"
on public.assignment_submissions for select
using (
  public.current_approved_active_tutor_id() is not null
  and assignment_id in (
    select a.id from public.assignments a
    where a.created_by = public.current_profile_id()
  )
);

drop policy if exists "admin_tutor_upload_assignment_files" on storage.objects;
create policy "admin_tutor_upload_assignment_files"
on storage.objects for insert
with check (
  bucket_id = 'assignment-files'
  and (
    public.is_platform_admin()
    or (
      public.current_approved_active_tutor_id() is not null
      and exists (
        select 1 from public.assignments a
        where a.id::text = (storage.foldername(name))[1]
          and a.created_by = public.current_profile_id()
      )
    )
  )
);

drop policy if exists "authenticated_read_assignment_files" on storage.objects;
create policy "authenticated_read_assignment_files"
on storage.objects for select
using (
  bucket_id = 'assignment-files'
  and (
    public.is_platform_admin()
    or (
      public.current_approved_active_tutor_id() is not null
      and exists (
        select 1 from public.assignments a
        where a.id::text = (storage.foldername(name))[1]
          and a.created_by = public.current_profile_id()
      )
    )
    or (
      public.current_active_student_id() is not null
      and exists (
        select 1 from public.assignments a
        where a.id::text = (storage.foldername(name))[1]
          and a.status = 'published'
          and a.organization_id = public.current_student_org_id()
      )
    )
  )
);

drop policy if exists "students_read_own_submission_files_or_admin" on storage.objects;
create policy "students_read_own_submission_files_or_admin"
on storage.objects for select
using (
  bucket_id = 'assignment-submissions'
  and (
    public.is_platform_admin()
    or (
      public.current_approved_active_tutor_id() is not null
      and (storage.foldername(name))[2] in (
        select a.id::text from public.assignments a
        where a.created_by = public.current_profile_id()
      )
    )
    or (
      public.current_active_student_id() is not null
      and (storage.foldername(name))[1] = public.current_active_student_id()::text
    )
  )
);

drop policy if exists "admin_tutor_upload_assignment_memos" on storage.objects;
create policy "admin_tutor_upload_assignment_memos"
on storage.objects for insert
with check (
  bucket_id = 'assignment-memos'
  and (
    public.is_platform_admin()
    or (
      public.current_approved_active_tutor_id() is not null
      and exists (
        select 1 from public.assignments a
        where a.id::text = (storage.foldername(name))[1]
          and a.created_by = public.current_profile_id()
      )
    )
  )
);

drop policy if exists "admin_tutor_read_assignment_memos" on storage.objects;
create policy "admin_tutor_read_assignment_memos"
on storage.objects for select
using (
  bucket_id = 'assignment-memos'
  and (
    public.is_platform_admin()
    or (
      public.current_approved_active_tutor_id() is not null
      and exists (
        select 1 from public.assignments a
        where a.id::text = (storage.foldername(name))[1]
          and a.created_by = public.current_profile_id()
      )
    )
  )
);

-- ---------------------------------------------------------------------------
-- 5. Community operational access must also respect student/tutor status
-- ---------------------------------------------------------------------------
drop policy if exists "community_room_messages_select_member" on public.community_room_messages;
create policy "community_room_messages_select_member"
on public.community_room_messages for select
using (
  (
    public.current_profile_role() = 'admin'
    or public.current_active_student_id() is not null
    or public.current_approved_active_tutor_id() is not null
  )
  and exists (
    select 1 from public.community_room_members m
    where m.room_id = community_room_messages.room_id
      and m.profile_id = public.current_profile_id()
  )
  and (
    moderation_state = 'visible'
    or public.current_profile_role() = 'admin'
    or public.current_approved_active_tutor_id() is not null
  )
);

drop policy if exists "community_questions_select" on public.community_questions;
create policy "community_questions_select"
on public.community_questions for select
using (
  (
    public.current_profile_role() = 'admin'
    or public.current_active_student_id() is not null
    or public.current_approved_active_tutor_id() is not null
  )
  and (
    moderation_state = 'visible'
    or profile_id = public.current_profile_id()
    or public.current_profile_role() = 'admin'
    or public.current_approved_active_tutor_id() is not null
  )
);

drop policy if exists "community_answers_select" on public.community_answers;
create policy "community_answers_select"
on public.community_answers for select
using (
  (
    public.current_profile_role() = 'admin'
    or public.current_active_student_id() is not null
    or public.current_approved_active_tutor_id() is not null
  )
  and (
    moderation_state = 'visible'
    or profile_id = public.current_profile_id()
    or public.current_profile_role() = 'admin'
    or public.current_approved_active_tutor_id() is not null
  )
);

create or replace function public.create_study_room(p_subject text, p_grade text default null)
returns public.community_study_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_role public.user_role := public.current_profile_role();
  v_room public.community_study_rooms;
begin
  if v_profile_id is null
     or not (
       v_role = 'admin'
       or (v_role = 'student' and public.current_active_student_id() is not null)
       or (v_role = 'tutor' and public.current_approved_active_tutor_id() is not null)
     )
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.community_study_rooms (subject, grade, created_by)
  values (p_subject, p_grade, v_profile_id)
  returning * into v_room;

  insert into public.community_room_members (room_id, profile_id)
  values (v_room.id, v_profile_id)
  on conflict do nothing;

  return v_room;
end;
$$;

create or replace function public.join_study_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_role public.user_role := public.current_profile_role();
begin
  if v_profile_id is null
     or not (
       v_role = 'admin'
       or (v_role = 'student' and public.current_active_student_id() is not null)
       or (v_role = 'tutor' and public.current_approved_active_tutor_id() is not null)
     )
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.community_study_rooms where id = p_room_id) then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;

  insert into public.community_room_members (room_id, profile_id)
  values (p_room_id, v_profile_id)
  on conflict do nothing;
end;
$$;

create or replace function public.post_room_message(p_room_id uuid, p_content text)
returns public.community_room_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_role public.user_role := public.current_profile_role();
  v_moderation record;
  v_message public.community_room_messages;
begin
  if v_profile_id is null
     or not (
       v_role = 'admin'
       or (v_role = 'student' and public.current_active_student_id() is not null)
       or (v_role = 'tutor' and public.current_approved_active_tutor_id() is not null)
     )
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.community_room_members
    where room_id = p_room_id and profile_id = v_profile_id
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_content, '')), '') is null then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  select * into v_moderation from public.moderate_community_text(p_content);

  insert into public.community_room_messages (room_id, profile_id, content, moderation_state, moderation_flags)
  values (p_room_id, v_profile_id, p_content, v_moderation.state, v_moderation.flags)
  returning * into v_message;

  return v_message;
end;
$$;


select no_plan();

-- Keep role simulation local to this transaction. Supabase's auth.uid() and
-- auth.jwt() helpers read these request settings exactly as PostgREST does.
create function pg_temp.authenticate_as(p_user_id uuid, p_aal text default 'aal1')
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_user_id::text,
      'role', 'authenticated',
      'aal', p_aal
    )::text,
    true
  );
end;
$$;

-- SECURITY INVOKER helper used to count rows affected by an authenticated
-- Storage UPDATE. PostgreSQL only permits a data-modifying CTE at statement
-- top level, so wrapping UPDATE + ROW_COUNT keeps the pgTAP assertion scalar
-- while preserving the caller's RLS context.
create function pg_temp.update_storage_object_metadata(p_name text, p_metadata jsonb)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_rows bigint;
begin
  update storage.objects
  set metadata = p_metadata
  where bucket_id = 'assignment-submissions'
    and name = p_name;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- Stable fixture identities.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  seed.id::uuid,
  'authenticated',
  'authenticated',
  seed.email,
  '',
  now(),
  case when seed.is_invited then now() else null end,
  '{"provider":"email","providers":["email"]}'::jsonb
    || case
      when seed.onboarding_role is null then '{}'::jsonb
      else jsonb_build_object('onboarding_role', seed.onboarding_role)
    end,
  case
    when seed.user_metadata_role is null then '{}'::jsonb
    else jsonb_build_object('role', seed.user_metadata_role)
  end,
  now(),
  now(),
  seed.id,
  '',
  seed.id,
  seed.id
from (values
  ('00000000-0000-0000-0000-000000000001', 'rls-admin@example.test', null, null, false),
  ('00000000-0000-0000-0000-000000000002', 'rls-student-a@example.test', null, null, false),
  ('00000000-0000-0000-0000-000000000003', 'rls-tutor-a@example.test', null, null, false),
  ('00000000-0000-0000-0000-000000000004', 'rls-parent-a@example.test', null, null, false),
  ('00000000-0000-0000-0000-000000000005', 'rls-ngo-a@example.test', null, null, false),
  ('00000000-0000-0000-0000-000000000006', 'rls-student-b@example.test', null, null, false),
  ('00000000-0000-0000-0000-000000000007', 'rls-tutor-b@example.test', null, null, false),
  ('00000000-0000-0000-0000-000000000008', 'rls-parent-b@example.test', null, null, false),
  ('00000000-0000-0000-0000-000000000009', 'rls-uninvited@example.test', 'student', 'student', false),
  ('00000000-0000-0000-0000-000000000010', 'rls-invited-student@example.test', 'student', 'tutor', true),
  ('00000000-0000-0000-0000-000000000011', 'rls-invited-no-role@example.test', null, 'student', true)
) as seed(id, email, onboarding_role, user_metadata_role, is_invited);

insert into public.organizations (id, name, type, status)
values
  ('a0000000-0000-0000-0000-000000000001', 'RLS NGO Alpha', 'ngo', 'active'),
  ('a0000000-0000-0000-0000-000000000002', 'RLS School Beta', 'school', 'active');

insert into public.profiles (id, auth_user_id, full_name, email, role)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'RLS Admin', 'rls-admin@example.test', 'admin'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Student Alpha', 'rls-student-a@example.test', 'student'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'Tutor Alpha', 'rls-tutor-a@example.test', 'tutor'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'Parent Alpha', 'rls-parent-a@example.test', 'parent'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005', 'NGO Alpha Viewer', 'rls-ngo-a@example.test', 'ngo_partner'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000006', 'Student Beta', 'rls-student-b@example.test', 'student'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000007', 'Tutor Beta', 'rls-tutor-b@example.test', 'tutor'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000008', 'Parent Beta', 'rls-parent-b@example.test', 'parent');

insert into public.students (id, profile_id, grade, school, status, organization_id)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Grade 11', 'Alpha School', 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000006', 'Grade 11', 'Beta School', 'active', 'a0000000-0000-0000-0000-000000000002');

insert into public.tutors (id, profile_id, subjects, grades, status, approval_status)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', array['Mathematics'], array['Grade 11'], 'active', 'approved'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007', array['Mathematics'], array['Grade 11'], 'active', 'approved');

insert into public.tutor_vetting_records (
  tutor_id, status, reviewed_at, expires_at, reviewed_by_profile_id, evidence_reference
)
values
  ('30000000-0000-0000-0000-000000000001', 'approved', now() - interval '1 day', now() + interval '1 year', '10000000-0000-0000-0000-000000000001', 'fixture-register-001'),
  ('30000000-0000-0000-0000-000000000002', 'approved', now() - interval '1 day', now() + interval '1 year', '10000000-0000-0000-0000-000000000001', 'fixture-register-002')
on conflict (tutor_id) do update
set status = excluded.status,
    reviewed_at = excluded.reviewed_at,
    expires_at = excluded.expires_at,
    reviewed_by_profile_id = excluded.reviewed_by_profile_id,
    evidence_reference = excluded.evidence_reference,
    updated_at = now();

insert into public.organization_members (organization_id, profile_id, org_role, status)
values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'tutor', 'active'),
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'partner_viewer', 'active'),
  ('a0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007', 'tutor', 'active');

insert into public.guardians (id, profile_id, full_name, email, status)
values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'Parent Alpha', 'rls-parent-a@example.test', 'active'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000008', 'Parent Beta', 'rls-parent-b@example.test', 'active');

insert into public.student_guardians (student_id, guardian_id, relationship_type, is_primary, can_receive_reports, status)
values
  ('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'parent', true, true, 'active'),
  ('20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'parent', true, true, 'active');

insert into public.subjects (id, name, grade, curriculum)
values ('90000000-0000-0000-0000-000000000001', 'AUTH01 RLS Fixture Mathematics 20260808', 'Grade 11', 'CAPS');

insert into public.assignments (id, title, subject_id, grade, created_by, status, organization_id)
values
  ('50000000-0000-0000-0000-000000000001', 'Alpha Published One', '90000000-0000-0000-0000-000000000001', 'Grade 11', '10000000-0000-0000-0000-000000000003', 'published', 'a0000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000002', 'Alpha Published Two', '90000000-0000-0000-0000-000000000001', 'Grade 11', '10000000-0000-0000-0000-000000000003', 'published', 'a0000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000003', 'Alpha Draft', '90000000-0000-0000-0000-000000000001', 'Grade 11', '10000000-0000-0000-0000-000000000003', 'draft', 'a0000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000004', 'Beta Published', '90000000-0000-0000-0000-000000000001', 'Grade 11', '10000000-0000-0000-0000-000000000007', 'published', 'a0000000-0000-0000-0000-000000000002');

insert into public.classes (id, name, tutor_id, subject_id, grade, status, organization_id)
values
  ('c0000000-0000-0000-0000-000000000001', 'Alpha Mathematics', '30000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'Grade 11', 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002', 'Beta Mathematics', '30000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', 'Grade 11', 'active', 'a0000000-0000-0000-0000-000000000002');

insert into public.class_enrollments (id, class_id, student_id, status)
values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'active'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'active');

insert into public.tutor_student_allocations (
  id,
  tutor_id,
  student_id,
  status,
  focus_notes,
  subject_id,
  rate_override,
  allowed_days_json,
  allowed_time_ranges_json
)
values
  (
    'e0000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'active',
    'Internal Alpha focus notes',
    '90000000-0000-0000-0000-000000000001',
    777.77,
    '["monday"]'::jsonb,
    '[{"start":"15:00","end":"17:00"}]'::jsonb
  ),
  (
    'e0000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'active',
    'Internal Beta focus notes',
    '90000000-0000-0000-0000-000000000001',
    888.88,
    '["tuesday"]'::jsonb,
    '[{"start":"14:00","end":"16:00"}]'::jsonb
  );

insert into public.assignment_submissions (
  id,
  assignment_id,
  student_id,
  text_answer,
  status,
  marks_awarded,
  feedback,
  marks_released,
  feedback_released,
  released_at
)
values
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Alpha answer one', 'marked', 61, 'Not released', false, false, null),
  ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Alpha answer two', 'marked', 88, 'Released feedback', true, true, now()),
  ('60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'Beta answer', 'marked', 73, 'Beta feedback', true, true, now());

insert into public.student_notifications (id, student_id, type, title, body)
values
  ('80000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'GRADE_RELEASED', 'Alpha result', 'Your Alpha result is ready.'),
  ('80000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'GRADE_RELEASED', 'Beta result', 'Your Beta result is ready.');

insert into storage.objects (bucket_id, name, owner, metadata)
values
  ('assignment-files', '50000000-0000-0000-0000-000000000001/brief.pdf', '00000000-0000-0000-0000-000000000003', '{}'::jsonb),
  ('assignment-files', '50000000-0000-0000-0000-000000000002/brief.pdf', '00000000-0000-0000-0000-000000000003', '{}'::jsonb),
  ('assignment-files', '50000000-0000-0000-0000-000000000003/draft.pdf', '00000000-0000-0000-0000-000000000003', '{}'::jsonb),
  ('assignment-files', '50000000-0000-0000-0000-000000000004/brief.pdf', '00000000-0000-0000-0000-000000000007', '{}'::jsonb),
  ('assignment-submissions', '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/60000000-0000-0000-0000-000000000001/submission.pdf', '00000000-0000-0000-0000-000000000002', '{}'::jsonb),
  ('assignment-submissions', '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000002/60000000-0000-0000-0000-000000000002/submission.pdf', '00000000-0000-0000-0000-000000000002', '{}'::jsonb),
  ('assignment-submissions', '20000000-0000-0000-0000-000000000002/50000000-0000-0000-0000-000000000004/60000000-0000-0000-0000-000000000003/submission.pdf', '00000000-0000-0000-0000-000000000006', '{}'::jsonb);

-- Edge Function limiter: service-role-only execution, threshold behavior,
-- retention, and a real database failure that must propagate to the caller.
-- The Edge Functions translate that RPC error into a fail-closed 503.
insert into public.edge_function_rate_limit_events (id, subject_id, function_name, created_at)
values (
  'f0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000010',
  'pgTAP-stale-cleanup',
  now() - interval '25 hours'
);

create function pg_temp.force_rate_limit_insert_failure()
returns trigger
language plpgsql
as $$
begin
  if new.function_name = 'pgTAP-forced-insert-failure' then
    raise exception 'forced_rate_limit_insert_failure' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger pg_tap_force_rate_limit_insert_failure
before insert on public.edge_function_rate_limit_events
for each row execute function pg_temp.force_rate_limit_insert_failure();

-- Retention cleanup privileges are split between an authenticated admin RPC and
-- a service-role-only scheduler RPC. The private worker is unreachable to API
-- roles even if a caller knows its name.
select ok(
  not has_function_privilege('anon', 'public.run_retention_cleanup(boolean)', 'execute'),
  'anon has no EXECUTE privilege on the admin retention RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.run_retention_cleanup(boolean)', 'execute'),
  'authenticated can reach the admin RPC so its authoritative admin check can run'
);
select ok(
  not has_function_privilege('service_role', 'public.run_retention_cleanup(boolean)', 'execute'),
  'service_role cannot use the browser/admin retention RPC'
);
select ok(
  not has_function_privilege('anon', 'public.run_retention_cleanup_scheduled()', 'execute'),
  'anon has no EXECUTE privilege on the scheduler retention RPC'
);
select ok(
  not has_function_privilege('authenticated', 'public.run_retention_cleanup_scheduled()', 'execute'),
  'authenticated has no EXECUTE privilege on the scheduler retention RPC'
);
select ok(
  has_function_privilege('service_role', 'public.run_retention_cleanup_scheduled()', 'execute'),
  'service_role has EXECUTE privilege on the scheduler retention RPC'
);
select ok(
  not has_function_privilege('anon', 'private.execute_retention_cleanup(boolean)', 'execute'),
  'anon cannot execute the private retention worker'
);
select ok(
  not has_function_privilege('authenticated', 'private.execute_retention_cleanup(boolean)', 'execute'),
  'authenticated cannot execute the private retention worker'
);
select ok(
  not has_function_privilege('service_role', 'private.execute_retention_cleanup(boolean)', 'execute'),
  'service_role cannot bypass the scheduler wrapper to execute the private worker'
);

set local role service_role;

select throws_ok(
  $$select public.run_retention_cleanup_scheduled()$$,
  '42501',
  'service_role_jwt_required',
  'database role alone is insufficient without a signed service_role JWT claim'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'service_role')::text,
  true
);
select is(
  (public.run_retention_cleanup_scheduled() ->> 'applied')::boolean,
  true,
  'service-role scheduler applies cleanup when both grant and JWT role are valid'
);

select is(
  public.check_and_record_edge_function_rate_limit(
    'f0000000-0000-0000-0000-000000000011',
    'pgTAP-threshold',
    2,
    60
  ),
  true,
  'service-role limiter allows the first request'
);
select is(
  public.check_and_record_edge_function_rate_limit(
    'f0000000-0000-0000-0000-000000000011',
    'pgTAP-threshold',
    2,
    60
  ),
  true,
  'service-role limiter allows the request at the configured threshold'
);
select is(
  public.check_and_record_edge_function_rate_limit(
    'f0000000-0000-0000-0000-000000000011',
    'pgTAP-threshold',
    2,
    60
  ),
  false,
  'service-role limiter denies requests beyond the threshold'
);
select is(
  public.check_and_record_edge_function_rate_limit(
    'f0000000-0000-0000-0000-000000000010',
    'pgTAP-stale-cleanup',
    5,
    60
  ),
  true,
  'limiter records a request after stale-event cleanup'
);
select throws_ok(
  $$
    select public.check_and_record_edge_function_rate_limit(
      'f0000000-0000-0000-0000-000000000012',
      'pgTAP-forced-insert-failure',
      2,
      60
    )
  $$,
  'P0001',
  'forced_rate_limit_insert_failure',
  'limiter propagates a real insert failure instead of failing open'
);

reset role;

select is(
  (select count(*) from public.edge_function_rate_limit_events where id = 'f0000000-0000-0000-0000-000000000001'),
  0::bigint,
  'limiter deletes events older than 24 hours'
);
select is(
  (
    select count(*)
    from public.edge_function_rate_limit_events
    where subject_id = 'f0000000-0000-0000-0000-000000000011'
      and function_name = 'pgTAP-threshold'
  ),
  2::bigint,
  'denied limiter request does not create an event'
);

select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000002');
set local role authenticated;

select throws_ok(
  $$
    select public.check_and_record_edge_function_rate_limit(
      'f0000000-0000-0000-0000-000000000011',
      'pgTAP-authenticated-denial',
      2,
      60
    )
  $$,
  '42501',
  'permission denied for function check_and_record_edge_function_rate_limit',
  'authenticated browser role cannot execute the service-role limiter'
);

reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'anon')::text,
  true
);
set local role anon;

select throws_ok(
  $$select public.run_retention_cleanup(false)$$,
  '42501',
  'permission denied for function run_retention_cleanup',
  'anonymous callers cannot execute the admin retention RPC'
);
select throws_ok(
  $$select public.run_retention_cleanup_scheduled()$$,
  '42501',
  'permission denied for function run_retention_cleanup_scheduled',
  'anonymous callers cannot execute the scheduler retention RPC'
);

reset role;

-- Student Alpha: published own-org learning data only; results are redacted
-- through the RPC and notifications/storage remain owner scoped.
select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000002');
set local role authenticated;

select throws_ok(
  $$select public.run_retention_cleanup(false)$$,
  '42501',
  'not_authorized',
  'student cannot run retention cleanup'
);
select throws_ok(
  $$select public.run_retention_cleanup_scheduled()$$,
  '42501',
  'permission denied for function run_retention_cleanup_scheduled',
  'student cannot execute the scheduler retention RPC'
);

select is((select count(*) from public.assignments), 0::bigint, 'student cannot read raw assignment rows or internal fields');
select is((select count(*) from public.get_student_accessible_assignments()), 2::bigint, 'student safe assignment RPC returns eligible published own-org work');
select is((select count(*) from public.assignment_submissions), 0::bigint, 'student cannot read raw submission/result rows');
select is((select count(*) from public.get_student_assignment_submissions()), 2::bigint, 'student result RPC returns only own submissions');
select ok((select marks_awarded is null from public.get_student_assignment_submissions() where assignment_id = '50000000-0000-0000-0000-000000000001'), 'student RPC redacts unreleased marks');
select is((select marks_awarded from public.get_student_assignment_submissions() where assignment_id = '50000000-0000-0000-0000-000000000002'), 88::numeric, 'student RPC exposes released marks');
select is((select count(*) from public.student_notifications), 1::bigint, 'student sees only own notifications');
select is((select count(*) from public.guardians), 0::bigint, 'student cannot read guardian records');
select is((select count(*) from public.tutors), 0::bigint, 'student cannot read tutor base rows or hourly/approval fields');
select is((select count(*) from public.tutor_student_allocations), 0::bigint, 'student cannot read allocation base rows or rate overrides');
select is((select count(*) from public.profiles where id = '10000000-0000-0000-0000-000000000003'), 0::bigint, 'student cannot read the allocated tutor base profile');
select is((select count(*) from public.get_student_assigned_tutors()), 1::bigint, 'student safe RPC returns one actively assigned tutor');
select is((select full_name from public.get_student_assigned_tutors()), 'Tutor Alpha', 'student safe RPC returns the assigned tutor display name');
select is((select email from public.get_student_assigned_tutors()), 'rls-tutor-a@example.test', 'student safe RPC returns the assigned tutor email');
select is((select count(*) from jsonb_object_keys((select to_jsonb(t) from public.get_student_assigned_tutors() t))), 3::bigint, 'student safe RPC exposes exactly id, full_name, and email');
select throws_ok(
  $$select * from public.get_tutor_allocated_students()$$,
  '42501',
  'only_tutors_can_view_allocated_students',
  'student cannot call the tutor-only learner directory RPC'
);
select is((select count(*) from public.classes), 1::bigint, 'student sees only an enrolled own-organization class without recursive RLS');
select is((select count(*) from public.class_enrollments), 1::bigint, 'student sees only their own class enrollment');
select is((select count(*) from public.classes where organization_id = 'a0000000-0000-0000-0000-000000000002'), 0::bigint, 'student cannot see a cross-organization class');
select is((select count(*) from storage.objects where bucket_id = 'assignment-files'), 0::bigint, 'student cannot enumerate assignment Storage objects directly');
select is((select count(*) from storage.objects where bucket_id = 'assignment-submissions'), 2::bigint, 'student sees only own submission files');

reset role;

-- Tutor Alpha: organization/member and creator ownership both apply.
select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000003');
set local role authenticated;

select throws_ok(
  $$select public.run_retention_cleanup(false)$$,
  '42501',
  'not_authorized',
  'tutor cannot run retention cleanup'
);
select throws_ok(
  $$select public.run_retention_cleanup_scheduled()$$,
  '42501',
  'permission denied for function run_retention_cleanup_scheduled',
  'tutor cannot execute the scheduler retention RPC'
);

select is((select count(*) from public.assignments), 3::bigint, 'tutor sees own organization assignments including drafts');
select is((select count(*) from public.assignments where organization_id = 'a0000000-0000-0000-0000-000000000002'), 0::bigint, 'tutor cannot see cross-organization assignments');
select is((select count(*) from public.assignment_submissions), 2::bigint, 'tutor sees submissions only for assignments they created');
select is((select count(*) from public.student_notifications), 0::bigint, 'tutor cannot read student notifications');
select is((select count(*) from public.guardians), 0::bigint, 'tutor cannot read guardian records');
select is((select count(*) from public.tutors), 1::bigint, 'tutor retains access to their own tutor base row');
select is((select count(*) from public.tutor_student_allocations), 1::bigint, 'tutor retains access to their own active allocation');
select is((select count(*) from public.students), 0::bigint, 'tutor cannot read learner base rows or guardian/parent fields');
select is((select count(*) from public.profiles where id = '10000000-0000-0000-0000-000000000002'), 0::bigint, 'tutor cannot read the allocated learner base profile');
select is((select count(*) from public.get_tutor_allocated_students()), 1::bigint, 'tutor safe RPC returns one actively allocated learner');
select is((select full_name from public.get_tutor_allocated_students()), 'Student Alpha', 'tutor safe RPC returns the allocated learner display name');
select is((select email from public.get_tutor_allocated_students()), 'rls-student-a@example.test', 'tutor safe RPC returns the allocated learner email');
select is((select grade from public.get_tutor_allocated_students()), 'Grade 11', 'tutor safe RPC returns the allocated learner grade');
select is((select school from public.get_tutor_allocated_students()), 'Alpha School', 'tutor safe RPC returns the allocated learner school');
select is((select count(*) from public.get_tutor_allocated_students() where student_id = '20000000-0000-0000-0000-000000000002'), 0::bigint, 'tutor safe RPC excludes cross-organization learners');
select is((select count(*) from jsonb_object_keys((select to_jsonb(s) from public.get_tutor_allocated_students() s))), 6::bigint, 'tutor safe RPC exposes exactly the six approved learner fields');
select throws_ok(
  $$select * from public.get_student_assigned_tutors()$$,
  '42501',
  'only_students_can_view_assigned_tutors',
  'tutor cannot call the student-only tutor directory RPC'
);
select is((select count(*) from public.classes), 1::bigint, 'tutor sees their own class without recursive RLS');
select is((select count(*) from public.class_enrollments), 1::bigint, 'tutor sees enrollments only for their own class without recursive RLS');
select is((select count(*) from public.class_enrollments where class_id = 'c0000000-0000-0000-0000-000000000002'), 0::bigint, 'tutor cannot see cross-organization class enrollments');
select is((select count(*) from storage.objects where bucket_id = 'assignment-files'), 3::bigint, 'tutor sees files only for assignments they created');
select is((select count(*) from storage.objects where bucket_id = 'assignment-submissions'), 2::bigint, 'tutor sees submission files only for assignments they created');

reset role;

-- Parent Alpha: no raw learner tables; the linked, release-aware report RPC is
-- the only results path.
select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000004');
set local role authenticated;

select throws_ok(
  $$select public.run_retention_cleanup(false)$$,
  '42501',
  'not_authorized',
  'parent cannot run retention cleanup'
);
select throws_ok(
  $$select public.run_retention_cleanup_scheduled()$$,
  '42501',
  'permission denied for function run_retention_cleanup_scheduled',
  'parent cannot execute the scheduler retention RPC'
);

select is((select count(*) from public.assignments), 0::bigint, 'parent cannot read assignments directly');
select is((select count(*) from public.assignment_submissions), 0::bigint, 'parent cannot read raw submissions/results');
select is((select count(*) from public.get_parent_progress_reports()), 1::bigint, 'parent sees released results for linked learner');
select is((select count(*) from public.get_parent_progress_reports() where student_id = '20000000-0000-0000-0000-000000000002'), 0::bigint, 'parent cannot see another organization learner report');
select is((select count(*) from public.guardians), 1::bigint, 'parent sees only own guardian record');
select is((select count(*) from public.student_guardians), 1::bigint, 'parent sees only own learner link');
select is((select count(*) from public.student_notifications), 0::bigint, 'parent cannot read student notifications');
select is((select count(*) from storage.objects where bucket_id in ('assignment-files', 'assignment-submissions')), 0::bigint, 'parent cannot read assignment storage');

reset role;

-- NGO partner viewer: organization identity and aggregate RPC only; no raw
-- learner, guardian, result, notification, or Storage access.
select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000005');
set local role authenticated;

select throws_ok(
  $$select public.run_retention_cleanup(false)$$,
  '42501',
  'not_authorized',
  'NGO user cannot run retention cleanup'
);
select throws_ok(
  $$select public.run_retention_cleanup_scheduled()$$,
  '42501',
  'permission denied for function run_retention_cleanup_scheduled',
  'NGO user cannot execute the scheduler retention RPC'
);

select is((select count(*) from public.organizations), 1::bigint, 'NGO viewer sees only own organization');
select is((select count(*) from public.organizations where id = 'a0000000-0000-0000-0000-000000000002'), 0::bigint, 'NGO viewer cannot see another organization');
select is((select count(*) from public.students), 0::bigint, 'NGO viewer cannot read raw learner records');
select is((select count(*) from public.assignment_submissions), 0::bigint, 'NGO viewer cannot read raw submissions/results');
select is((select count(*) from public.guardians), 0::bigint, 'NGO viewer cannot read guardian records');
select is((select count(*) from public.student_notifications), 0::bigint, 'NGO viewer cannot read notifications');
select is((select count(*) from storage.objects where bucket_id in ('assignment-files', 'assignment-submissions')), 0::bigint, 'NGO viewer cannot read assignment storage');
select ok((public.get_org_cohort_report('a0000000-0000-0000-0000-000000000001')->>'suppressed')::boolean, 'NGO viewer can call own-org privacy-suppressed aggregate');
select throws_ok(
  $$select public.get_org_cohort_report('a0000000-0000-0000-0000-000000000002')$$,
  '42501',
  'not_authorized',
  'NGO viewer cannot call another organization aggregate'
);

reset role;

-- Admin policy is gated by authoritative AAL2, not the frontend MFA screen.
select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000001', 'aal1');
set local role authenticated;

select ok(not public.is_platform_admin(), 'AAL1 admin session is not platform-admin authorized');
select throws_ok(
  $$select public.run_retention_cleanup(false)$$,
  '42501',
  'not_authorized',
  'AAL1 admin cannot run retention cleanup'
);
select is((select count(*) from public.profiles), 1::bigint, 'AAL1 admin sees only their ordinary self profile');
select is((select count(*) from public.assignments), 0::bigint, 'AAL1 admin cannot use admin assignment access');
select is((select count(*) from public.assignment_submissions), 0::bigint, 'AAL1 admin cannot use admin result access');
select is((select count(*) from public.classes), 0::bigint, 'AAL1 admin cannot use admin class access');
select is((select count(*) from public.class_enrollments), 0::bigint, 'AAL1 admin cannot use admin enrollment access');
select is((select count(*) from storage.objects where bucket_id in ('assignment-files', 'assignment-submissions')), 0::bigint, 'AAL1 admin cannot use admin storage access');

reset role;

select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000001', 'aal2');
set local role authenticated;

select ok(public.is_platform_admin(), 'AAL2 admin session is platform-admin authorized');
select is(
  (public.run_retention_cleanup(false) ->> 'applied')::boolean,
  false,
  'AAL2 admin can run a non-destructive retention dry run'
);
select is(
  (
    select count(*)
    from public.assignments
    where organization_id in (
      'a0000000-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000002'
    )
      and created_by in (
        '10000000-0000-0000-0000-000000000003',
        '10000000-0000-0000-0000-000000000007'
      )
  ),
  4::bigint,
  'AAL2 admin sees the assignment fixtures across organizations'
);
select is(
  (
    select count(*)
    from public.assignment_submissions
    where id in (
      '60000000-0000-0000-0000-000000000001',
      '60000000-0000-0000-0000-000000000002',
      '60000000-0000-0000-0000-000000000003'
    )
  ),
  3::bigint,
  'AAL2 admin sees submission fixtures across organizations'
);
select is((select count(*) from public.guardians where id in ('40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002')), 2::bigint, 'AAL2 admin sees guardian records across organizations');
select is((select count(*) from public.student_guardians where student_id in ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002') and guardian_id in ('40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002')), 2::bigint, 'AAL2 admin sees guardian links across organizations');
select is(
  (
    select count(*)
    from public.tutors
    where id in (
      '30000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000002'
    )
  ),
  2::bigint,
  'AAL2 admin sees the tutor fixtures across organizations'
);
select is((select count(*) from public.tutor_student_allocations where tutor_id in ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002') and student_id in ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002')), 2::bigint, 'AAL2 admin sees allocations across organizations');
select is((select count(*) from public.classes where id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')), 2::bigint, 'AAL2 admin sees classes across organizations');
select is((select count(*) from public.class_enrollments where class_id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002') and student_id in ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002')), 2::bigint, 'AAL2 admin sees class enrollments across organizations');
select is((select count(*) from public.organizations where id in ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002')), 2::bigint, 'AAL2 admin sees both organizations');
select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'assignment-files'
      and owner in (
        '00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000007'
      )
  ),
  4::bigint,
  'AAL2 admin sees the assignment-file fixtures across organizations'
);
select is((select count(*) from storage.objects where bucket_id = 'assignment-submissions' and owner in ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000006')), 3::bigint, 'AAL2 admin sees submission files across organizations');
select is((select count(*) from public.student_notifications), 0::bigint, 'even AAL2 admin cannot read student-only notifications');

reset role;

-- Storage write checks run last so the successful insert cannot affect the
-- read-count assertions above. The allowed key has 4 folders because
-- storage.foldername() excludes submission.pdf.
select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000002');
set local role authenticated;

select is(
  (
    select p.provolatile::text
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'can_write_uncommitted_assignment_submission_storage'
  ),
  'v',
  'Storage write guard is VOLATILE so its lock-and-check cannot be plan-folded'
);
select ok(
  pg_get_functiondef('public.can_write_uncommitted_assignment_submission_storage(text)'::regprocedure)
    like '%pg_advisory_xact_lock%',
  'Storage write guard takes the submission attempt advisory lock'
);
select ok(
  not public.can_write_uncommitted_assignment_submission_storage(
    '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf'
  ),
  'Storage guard rejects an attempt before its payload is reserved'
);
select lives_ok(
  $$
    select public.begin_assignment_submission_attempt(
      p_assignment_id => '50000000-0000-0000-0000-000000000001',
      p_submission_id => '70000000-0000-0000-0000-000000000001',
      p_storage_key => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_original_filename => 'retry.pdf',
      p_mime_type => 'application/pdf',
      p_size_bytes => 123,
      p_content_sha256 => repeat('a', 64),
      p_text_answer => 'Stable retry payload',
      p_text_answer_sha256 => '289500b9823eeccb6b55c65091f6c1b66d1d13661a3160455d44b49648ff7262'
    )
  $$,
  'student reserves one immutable payload before upload'
);
select ok(
  public.can_write_uncommitted_assignment_submission_storage(
    '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf'
  ),
  'locked Storage guard allows the matching reserved attempt'
);
select throws_ok(
  $$
    select public.begin_assignment_submission_attempt(
      p_assignment_id => '50000000-0000-0000-0000-000000000001',
      p_submission_id => '70000000-0000-0000-0000-000000000001',
      p_storage_key => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/submission.pdf',
      p_original_filename => 'retry.pdf',
      p_mime_type => 'application/pdf',
      p_size_bytes => 123,
      p_content_sha256 => repeat('b', 64),
      p_text_answer => 'Stable retry payload',
      p_text_answer_sha256 => '289500b9823eeccb6b55c65091f6c1b66d1d13661a3160455d44b49648ff7262'
    )
  $$,
  '23505',
  'submission_retry_payload_mismatch',
  'same UUID and metadata cannot be rebound to different file bytes'
);
select ok(
  not public.can_write_uncommitted_assignment_submission_storage(
    '20000000-0000-0000-0000-000000000002/50000000-0000-0000-0000-000000000004/60000000-0000-0000-0000-000000000003/submission.pdf'
  ),
  'Storage guard is not a cross-student committed-key oracle'
);
select ok(
  not public.can_write_uncommitted_assignment_submission_storage(
    '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/arbitrary.pdf'
  ),
  'Storage guard rejects filenames outside the submission.ext RPC contract'
);

select lives_ok(
  $$
    insert into storage.objects (bucket_id, name, owner, metadata, user_metadata)
    values (
      'assignment-submissions',
      '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      '00000000-0000-0000-0000-000000000002',
      '{"mimetype":"application/pdf","size":123}'::jsonb,
      '{"sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'::jsonb
    )
  $$,
  'student can upload a correctly-shaped own-org submission key'
);
select is(
  pg_temp.update_storage_object_metadata(
    '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
    '{"retry":true}'::jsonb
  ),
  0::bigint,
  'student cannot overwrite immutable submission evidence'
);

select lives_ok(
  $$
    select public.submit_assignment_submission(
      p_assignment_id => '50000000-0000-0000-0000-000000000001',
      p_submission_id => '70000000-0000-0000-0000-000000000001',
      p_storage_key => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_file_url => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_original_filename => 'retry.pdf',
      p_mime_type => 'application/pdf',
      p_size_bytes => 123,
      p_text_answer => 'Stable retry payload'
    )
  $$,
  'first stable submission attempt commits'
);
select is(
  (
    select submission_id
    from public.confirm_assignment_submission_attempt(
      p_assignment_id => '50000000-0000-0000-0000-000000000001',
      p_submission_id => '70000000-0000-0000-0000-000000000001',
      p_storage_key => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_file_url => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_original_filename => 'retry.pdf',
      p_mime_type => 'application/pdf',
      p_size_bytes => 123,
      p_text_answer => 'Stable retry payload'
    )
  ),
  '70000000-0000-0000-0000-000000000001'::uuid,
  'confirmed attempt returns before a retry upload'
);
select is(
  (
    select submission_id
    from public.confirm_assignment_submission_attempt_digest(
      p_assignment_id => '50000000-0000-0000-0000-000000000001',
      p_submission_id => '70000000-0000-0000-0000-000000000001',
      p_content_sha256 => repeat('a', 64),
      p_text_answer_sha256 => '289500b9823eeccb6b55c65091f6c1b66d1d13661a3160455d44b49648ff7262'
    )
  ),
  '70000000-0000-0000-0000-000000000001'::uuid,
  'reload recovery confirms a commit using fingerprints without persisted answer text'
);
select is(
  pg_temp.update_storage_object_metadata(
    '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
    '{"tampered":true}'::jsonb
  ),
  0::bigint,
  'committed submission evidence cannot be overwritten'
);
select is(
  (
    select metadata
    from storage.objects
    where bucket_id = 'assignment-submissions'
      and name = '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf'
  ),
  '{"mimetype":"application/pdf","size":123}'::jsonb,
  'post-commit overwrite attempt leaves the stored evidence unchanged'
);
select ok(
  not public.can_write_uncommitted_assignment_submission_storage(
    '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf'
  ),
  'locked Storage guard rejects the caller-owned key after commit'
);
select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner, metadata)
    values (
      'assignment-submissions',
      '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/submission.png',
      '00000000-0000-0000-0000-000000000002',
      '{}'::jsonb
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'committed attempt UUID cannot create alternate-extension orphan evidence'
);
select lives_ok(
  $$
    select public.submit_assignment_submission(
      p_assignment_id => '50000000-0000-0000-0000-000000000001',
      p_submission_id => '70000000-0000-0000-0000-000000000001',
      p_storage_key => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_file_url => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_original_filename => 'retry.pdf',
      p_mime_type => 'application/pdf',
      p_size_bytes => 123,
      p_text_answer => 'Stable retry payload'
    )
  $$,
  'unchanged submission retry returns the committed attempt'
);
select throws_ok(
  $$
    select public.submit_assignment_submission(
      p_assignment_id => '50000000-0000-0000-0000-000000000001',
      p_submission_id => '70000000-0000-0000-0000-000000000001',
      p_storage_key => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_file_url => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_original_filename => 'retry.pdf',
      p_mime_type => 'application/pdf',
      p_size_bytes => 123,
      p_text_answer => 'Edited after an ambiguous response'
    )
  $$,
  '23505',
  'submission_retry_payload_mismatch',
  'same attempt UUID cannot confirm a changed payload'
);
select throws_ok(
  $$
    select public.submit_assignment_submission(
      p_assignment_id => '50000000-0000-0000-0000-000000000002',
      p_submission_id => '70000000-0000-0000-0000-000000000001',
      p_storage_key => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_file_url => '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000001/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/submission.pdf',
      p_original_filename => 'retry.pdf',
      p_mime_type => 'application/pdf',
      p_size_bytes => 123,
      p_text_answer => 'Stable retry payload'
    )
  $$,
  '23505',
  'submission_id_conflict',
  'same attempt UUID cannot be replayed for another assignment'
);
select is(
  (select count(*) from public.get_student_assignment_submissions() where id = '70000000-0000-0000-0000-000000000001'),
  1::bigint,
  'idempotent replay creates one submission row'
);
select is(
  (select version_number from public.get_student_assignment_submissions() where id = '70000000-0000-0000-0000-000000000001'),
  2,
  'idempotent replay allocates one new version number'
);
select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner, metadata)
    values (
      'assignment-submissions',
      '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000004/70000000-0000-0000-0000-000000000002/submission.pdf',
      '00000000-0000-0000-0000-000000000002',
      '{}'::jsonb
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'student cannot upload a cross-organization submission key'
);

reset role;

select is(
  (
    select count(*)
    from public.audit_log
    where action = 'assignment_submission.created'
      and entity_id = '70000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'idempotent replay creates one audit event'
);

-- Onboarding is an invite-only transition. Existing, fully provisioned rows
-- remain safe retries, while uninvited, role-less, conflicting, and role-
-- escalation attempts are rejected before any profile is created.
select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000002');
set local role authenticated;

select lives_ok(
  $$select public.onboard_current_user('student', '')$$,
  'completed admin-provisioned student onboarding is an idempotent retry'
);
select throws_ok(
  $$select public.onboard_current_user('tutor', 'Student Alpha')$$,
  '23505',
  'onboarding_role_conflict',
  'completed student profile cannot be retried as tutor'
);

reset role;

select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000009');
set local role authenticated;

select throws_ok(
  $$select public.run_retention_cleanup(false)$$,
  '42501',
  'not_authorized',
  'ordinary authenticated user without a profile cannot run retention cleanup'
);
select throws_ok(
  $$select public.run_retention_cleanup_scheduled()$$,
  '42501',
  'permission denied for function run_retention_cleanup_scheduled',
  'ordinary authenticated user cannot execute the scheduler retention RPC'
);

select throws_ok(
  $$
    select public.onboard_current_user(
      p_role => 'student',
      p_full_name => 'Uninvited Student',
      p_grade => 'Grade 10'
    )
  $$,
  '42501',
  'onboarding_invitation_required',
  'confirmed but uninvited Auth identity cannot onboard'
);

reset role;

select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000011');
set local role authenticated;

select throws_ok(
  $$
    select public.onboard_current_user(
      p_role => 'student',
      p_full_name => 'Roleless Invite',
      p_grade => 'Grade 10'
    )
  $$,
  '42501',
  'onboarding_invitation_role_required',
  'invitation without a managed student or tutor role cannot onboard'
);

reset role;

select pg_temp.authenticate_as('00000000-0000-0000-0000-000000000010');
set local role authenticated;

select throws_ok(
  $$
    select public.onboard_current_user(
      p_role => 'tutor',
      p_full_name => 'Invited Student'
    )
  $$,
  '42501',
  'onboarding_invitation_role_mismatch',
  'student invitation cannot be escalated into a tutor account'
);
select lives_ok(
  $$
    select public.onboard_current_user(
      p_role => 'student',
      p_full_name => 'Invited Student',
      p_grade => 'Grade 10'
    )
  $$,
  'matching invited student can complete onboarding atomically'
);
select is(
  (select count(*) from public.profiles where auth_user_id = '00000000-0000-0000-0000-000000000010'),
  1::bigint,
  'successful invited onboarding creates exactly one profile'
);
select is(
  (
    select count(*)
    from public.students s
    join public.profiles p on p.id = s.profile_id
    where p.auth_user_id = '00000000-0000-0000-0000-000000000010'
  ),
  1::bigint,
  'successful invited onboarding creates exactly one student role row'
);

reset role;

-- ============================================================================
-- AUTH-01: inactive/suspended/pending student and tutor principals must lose
-- operational authorization even while their Supabase Auth session remains
-- valid.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Student status denial matrix
-- ---------------------------------------------------------------------------

reset role;

update public.students
set status = 'inactive'
where id = '20000000-0000-0000-0000-000000000001';

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-000000000002'
);
set local role authenticated;

select is(
  public.current_active_student_id(),
  null::uuid,
  'inactive student has no active operational student identity'
);

select is(
  public.current_student_id(),
  null::uuid,
  'legacy current_student_id fails closed for inactive student'
);

select is(
  public.current_student_org_id(),
  null::uuid,
  'inactive student has no operational organization identity'
);

select is(
  (select count(*) from public.get_student_accessible_assignments()),
  0::bigint,
  'inactive student cannot read assignments'
);

select is(
  (select count(*) from public.classes),
  0::bigint,
  'inactive student cannot read learner classes'
);

select is(
  (select count(*) from storage.objects
   where bucket_id = 'assignment-files'),
  0::bigint,
  'inactive student cannot read assignment files'
);

select is(
  (select count(*) from public.get_student_assignment_submissions()),
  0::bigint,
  'inactive student cannot read submission results through student RPC'
);

select throws_ok(
  $$
    select public.submit_assignment_submission(
      p_assignment_id =>
        '50000000-0000-0000-0000-000000000001',
      p_submission_id =>
        '71000000-0000-0000-0000-000000000001',
      p_storage_key => null,
      p_file_url => null,
      p_original_filename => null,
      p_mime_type => null,
      p_size_bytes => null,
      p_text_answer => 'Inactive learner attempt'
    )
  $$,
  '42501',
  'only_students_can_submit',
  'inactive student cannot submit assignment work'
);

reset role;


-- Suspended student
update public.students
set status = 'suspended'
where id = '20000000-0000-0000-0000-000000000001';

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-000000000002'
);
set local role authenticated;

select is(
  public.current_active_student_id(),
  null::uuid,
  'suspended student has no active operational student identity'
);

select is(
  (select count(*) from public.get_student_accessible_assignments()),
  0::bigint,
  'suspended student cannot read assignments'
);

select throws_ok(
  $$
    select public.submit_assignment_submission(
      p_assignment_id =>
        '50000000-0000-0000-0000-000000000001',
      p_submission_id =>
        '71000000-0000-0000-0000-000000000002',
      p_storage_key => null,
      p_file_url => null,
      p_original_filename => null,
      p_mime_type => null,
      p_size_bytes => null,
      p_text_answer => 'Suspended learner attempt'
    )
  $$,
  '42501',
  'only_students_can_submit',
  'suspended student cannot submit assignment work'
);

reset role;


-- Pending student
update public.students
set status = 'pending'
where id = '20000000-0000-0000-0000-000000000001';

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-000000000002'
);
set local role authenticated;

select is(
  public.current_active_student_id(),
  null::uuid,
  'pending student has no active operational student identity'
);

select is(
  (select count(*) from public.assignments),
  0::bigint,
  'pending student cannot read assignments'
);

reset role;


-- Restore positive student state and prove access returns.
update public.students
set status = 'active'
where id = '20000000-0000-0000-0000-000000000001';

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-000000000002'
);
set local role authenticated;

select is(
  public.current_active_student_id(),
  '20000000-0000-0000-0000-000000000001'::uuid,
  'active student receives operational student identity'
);

select is(
  (select count(*) from public.get_student_accessible_assignments()),
  2::bigint,
  'active student regains published own-organization assignments'
);

reset role;


-- ---------------------------------------------------------------------------
-- Tutor status + approval denial matrix
-- ---------------------------------------------------------------------------

-- Pending tutor: onboarding remains available, operational access is denied.
update public.tutors
set
  status = 'pending',
  approval_status = 'pending'
where id = '30000000-0000-0000-0000-000000000001';

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-000000000003'
);
set local role authenticated;

select is(
  public.current_approved_active_tutor_id(),
  null::uuid,
  'pending tutor has no approved active operational identity'
);

select is(
  public.current_tutor_id(),
  null::uuid,
  'legacy current_tutor_id fails closed for pending tutor'
);

select is(
  public.current_tutor_onboarding_id(),
  '30000000-0000-0000-0000-000000000001'::uuid,
  'pending tutor retains onboarding identity'
);

select is(
  (select count(*) from public.assignments),
  0::bigint,
  'pending tutor cannot read operational assignments'
);

select is(
  (select count(*) from public.classes),
  0::bigint,
  'pending tutor cannot read organization classes'
);

select is(
  (select count(*) from public.assignment_submissions),
  0::bigint,
  'pending tutor cannot read learner submissions'
);

select throws_ok(
  $$select * from public.get_tutor_allocated_students()$$,
  '42501',
  'only_tutors_can_view_allocated_students',
  'pending tutor cannot use allocated learner directory'
);

select lives_ok(
  $$
    select public.upsert_tutor_application(
      '{}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      null,
      null
    )
  $$,
  'pending tutor can still update onboarding application'
);

reset role;


-- Active tutor whose approval is still under review.
update public.tutors
set
  status = 'active',
  approval_status = 'under_review'
where id = '30000000-0000-0000-0000-000000000001';

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-000000000003'
);
set local role authenticated;

select is(
  public.current_approved_active_tutor_id(),
  null::uuid,
  'under-review tutor has no operational tutor identity'
);

select is(
  (select count(*) from public.assignments),
  0::bigint,
  'under-review tutor cannot read operational assignments'
);

select is(
  public.current_tutor_onboarding_id(),
  '30000000-0000-0000-0000-000000000001'::uuid,
  'under-review active tutor retains onboarding access'
);

reset role;


-- Rejected tutor.
update public.tutors
set
  status = 'active',
  approval_status = 'rejected'
where id = '30000000-0000-0000-0000-000000000001';

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-000000000003'
);
set local role authenticated;

select is(
  public.current_approved_active_tutor_id(),
  null::uuid,
  'rejected tutor has no operational tutor identity'
);

select is(
  (select count(*) from public.assignments),
  0::bigint,
  'rejected tutor cannot read operational assignments'
);

reset role;


-- Inactive tutor must lose BOTH operational and onboarding access.
update public.tutors
set
  status = 'inactive',
  approval_status = 'approved'
where id = '30000000-0000-0000-0000-000000000001';

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-000000000003'
);
set local role authenticated;

select is(
  public.current_approved_active_tutor_id(),
  null::uuid,
  'inactive tutor has no operational tutor identity'
);

select is(
  public.current_tutor_onboarding_id(),
  null::uuid,
  'inactive tutor has no onboarding exception'
);

select is(
  (select count(*) from public.assignments),
  0::bigint,
  'inactive tutor cannot read assignments through organization membership'
);

select is(
  (select count(*) from public.classes),
  0::bigint,
  'inactive tutor cannot read classes through organization membership'
);

select is(
  (select count(*) from public.assignment_submissions),
  0::bigint,
  'inactive tutor cannot read learner submissions'
);

select is(
  (select count(*) from storage.objects
   where bucket_id = 'assignment-files'),
  0::bigint,
  'inactive tutor cannot read assignment files'
);

select throws_ok(
  $$
    select public.upsert_tutor_application(
      '{}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      null,
      null
    )
  $$,
  '42501',
  'forbidden',
  'inactive tutor cannot use onboarding application RPC'
);

reset role;


-- Suspended tutor must also lose both access classes.
update public.tutors
set
  status = 'suspended',
  approval_status = 'approved'
where id = '30000000-0000-0000-0000-000000000001';

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-000000000003'
);
set local role authenticated;

select is(
  public.current_approved_active_tutor_id(),
  null::uuid,
  'suspended tutor has no operational tutor identity'
);

select is(
  public.current_tutor_onboarding_id(),
  null::uuid,
  'suspended tutor has no onboarding exception'
);

select is(
  (select count(*) from public.assignments),
  0::bigint,
  'suspended tutor cannot read assignments'
);

select throws_ok(
  $$select * from public.get_tutor_allocated_students()$$,
  '42501',
  'only_tutors_can_view_allocated_students',
  'suspended tutor cannot use allocated learner directory'
);

reset role;


-- Restore approved active tutor and prove normal access still works.
update public.tutors
set
  status = 'active',
  approval_status = 'approved'
where id = '30000000-0000-0000-0000-000000000001';

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-000000000003'
);
set local role authenticated;

select is(
  public.current_approved_active_tutor_id(),
  '30000000-0000-0000-0000-000000000001'::uuid,
  'approved active tutor receives operational tutor identity'
);

select is(
  (select count(*) from public.assignments),
  3::bigint,
  'approved active tutor regains own-organization assignments'
);

select is(
  (select count(*) from public.get_tutor_allocated_students()),
  1::bigint,
  'approved active tutor regains allocated learner directory'
);

reset role;

select * from finish();
rollback;
