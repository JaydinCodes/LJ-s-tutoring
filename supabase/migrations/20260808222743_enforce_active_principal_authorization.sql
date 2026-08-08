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