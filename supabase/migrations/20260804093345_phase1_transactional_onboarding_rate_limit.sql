-- Phase 1: make student/tutor onboarding atomic and move Edge Function rate
-- limiting behind a concurrency-safe, service-role-only RPC.

-- These policies previously let authenticated callers bypass the onboarding
-- UI/RPC, including supplying profile email and tutor hourly_rate directly.
drop policy if exists "profiles_insert_self_student_or_tutor" on public.profiles;
drop policy if exists "students_insert_self" on public.students;
drop policy if exists "tutors_insert_self_pending" on public.tutors;

create or replace function public.onboard_current_user(
  p_role text,
  p_full_name text,
  p_phone text default null,
  p_grade text default null,
  p_school text default null,
  p_parent_name text default null,
  p_parent_contact text default null,
  p_subjects text[] default null,
  p_grades text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_email text;
  v_email_confirmed_at timestamptz;
  v_invited_at timestamptz;
  v_authorized_role text;
  v_full_name text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_requested_role public.user_role;
  v_profile public.profiles%rowtype;
  v_student public.students%rowtype;
  v_tutor public.tutors%rowtype;
  v_subjects text[];
  v_grades text[];
begin
  if v_auth_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_role is null or p_role not in ('student', 'tutor') then
    raise exception 'invalid_onboarding_role' using errcode = '22023';
  end if;
  v_requested_role := p_role::public.user_role;

  perform pg_advisory_xact_lock(hashtextextended('onboarding:' || v_auth_user_id::text, 0));

  select p.* into v_profile
  from public.profiles p
  where p.auth_user_id = v_auth_user_id;

  if found and v_profile.role <> v_requested_role then
    raise exception 'onboarding_role_conflict' using errcode = '23505';
  end if;

  if found and v_requested_role = 'student' then
    select s.* into v_student
    from public.students s
    where s.profile_id = v_profile.id;

    if found then
      return jsonb_build_object(
        'profile', to_jsonb(v_profile),
        'student', to_jsonb(v_student),
        'tutor', null
      );
    end if;
  elsif found and v_requested_role = 'tutor' then
    select t.* into v_tutor
    from public.tutors t
    where t.profile_id = v_profile.id;

    if found then
      return jsonb_build_object(
        'profile', to_jsonb(v_profile),
        'student', null,
        'tutor', to_jsonb(v_tutor)
      );
    end if;
  end if;

  if v_full_name is null then
    raise exception 'full_name_required' using errcode = '23514';
  end if;

  select
    nullif(btrim(coalesce(u.email, '')), ''),
    u.email_confirmed_at,
    u.invited_at,
    nullif(btrim(coalesce(u.raw_app_meta_data ->> 'onboarding_role', '')), '')
  into v_email, v_email_confirmed_at, v_invited_at, v_authorized_role
  from auth.users u
  where u.id = v_auth_user_id;

  if v_email is null or v_email_confirmed_at is null then
    raise exception 'verified_email_required' using errcode = '23514';
  end if;
  if v_invited_at is null then
    raise exception 'onboarding_invitation_required' using errcode = '42501';
  end if;
  if v_authorized_role is null or v_authorized_role not in ('student', 'tutor') then
    raise exception 'onboarding_invitation_role_required' using errcode = '42501';
  end if;
  if v_authorized_role <> p_role then
    raise exception 'onboarding_invitation_role_mismatch' using errcode = '42501';
  end if;

  if v_requested_role = 'student' then
    if nullif(btrim(coalesce(p_grade, '')), '') is null then
      raise exception 'grade_required' using errcode = '23514';
    end if;
  else
    select coalesce(array_agg(item order by item), '{}'::text[])
    into v_subjects
    from (
      select distinct btrim(entry) as item
      from unnest(coalesce(p_subjects, '{}'::text[])) as supplied(entry)
      where nullif(btrim(entry), '') is not null
    ) normalized_subjects;

    select coalesce(array_agg(item order by item), '{}'::text[])
    into v_grades
    from (
      select distinct btrim(entry) as item
      from unnest(coalesce(p_grades, '{}'::text[])) as supplied(entry)
      where nullif(btrim(entry), '') is not null
    ) normalized_grades;

    if cardinality(v_subjects) = 0 then
      raise exception 'subjects_required' using errcode = '23514';
    end if;
    if cardinality(v_grades) = 0 then
      raise exception 'grades_required' using errcode = '23514';
    end if;
  end if;

  if v_profile.id is null then
    insert into public.profiles (auth_user_id, full_name, email, phone, role)
    values (v_auth_user_id, v_full_name, v_email, v_phone, v_requested_role)
    returning * into v_profile;
  else
    update public.profiles
    set full_name = v_full_name,
        email = v_email,
        phone = v_phone,
        updated_at = now()
    where id = v_profile.id
    returning * into v_profile;
  end if;

  if v_requested_role = 'student' then
    insert into public.students (
      profile_id,
      grade,
      school,
      parent_name,
      parent_contact,
      status
    )
    values (
      v_profile.id,
      btrim(p_grade),
      nullif(btrim(coalesce(p_school, '')), ''),
      nullif(btrim(coalesce(p_parent_name, '')), ''),
      nullif(btrim(coalesce(p_parent_contact, '')), ''),
      'active'
    )
    returning * into v_student;

    perform public.log_audit_event(
      'onboarding.completed',
      'student',
      v_student.id::text,
      jsonb_build_object('role', 'student')
    );

    return jsonb_build_object(
      'profile', to_jsonb(v_profile),
      'student', to_jsonb(v_student),
      'tutor', null
    );
  end if;

  insert into public.tutors (
    profile_id,
    subjects,
    grades,
    hourly_rate,
    status,
    approval_status
  )
  values (
    v_profile.id,
    v_subjects,
    v_grades,
    null,
    'pending',
    'pending'
  )
  returning * into v_tutor;

  perform public.log_audit_event(
    'onboarding.completed',
    'tutor',
    v_tutor.id::text,
    jsonb_build_object('role', 'tutor')
  );

  return jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'student', null,
    'tutor', to_jsonb(v_tutor)
  );
end;
$$;

revoke execute on function public.onboard_current_user(text, text, text, text, text, text, text, text[], text[]) from public;
revoke execute on function public.onboard_current_user(text, text, text, text, text, text, text, text[], text[]) from anon;
grant execute on function public.onboard_current_user(text, text, text, text, text, text, text, text[], text[]) to authenticated;

create index if not exists idx_edge_function_rate_limit_events_created_at
  on public.edge_function_rate_limit_events(created_at);

create or replace function public.check_and_record_edge_function_rate_limit(
  p_subject_id uuid,
  p_function_name text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_function_name text := nullif(btrim(coalesce(p_function_name, '')), '');
  v_recent_count bigint;
begin
  if p_subject_id is null then
    raise exception 'rate_limit_subject_required' using errcode = '22023';
  end if;
  if v_function_name is null or char_length(v_function_name) > 128 then
    raise exception 'invalid_rate_limit_function_name' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'invalid_rate_limit' using errcode = '22023';
  end if;
  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid_rate_limit_window' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_subject_id::text || ':' || v_function_name, 0)
  );

  delete from public.edge_function_rate_limit_events
  where created_at < now() - interval '24 hours';

  select count(*) into v_recent_count
  from public.edge_function_rate_limit_events e
  where e.subject_id = p_subject_id
    and e.function_name = v_function_name
    and e.created_at >= now() - make_interval(secs => p_window_seconds);

  if v_recent_count >= p_limit then
    return false;
  end if;

  insert into public.edge_function_rate_limit_events (subject_id, function_name)
  values (p_subject_id, v_function_name);

  return true;
end;
$$;

revoke execute on function public.check_and_record_edge_function_rate_limit(uuid, text, integer, integer) from public;
revoke execute on function public.check_and_record_edge_function_rate_limit(uuid, text, integer, integer) from anon;
revoke execute on function public.check_and_record_edge_function_rate_limit(uuid, text, integer, integer) from authenticated;
grant execute on function public.check_and_record_edge_function_rate_limit(uuid, text, integer, integer) to service_role;;
