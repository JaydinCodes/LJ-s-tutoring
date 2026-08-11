-- REL-04: a lost draft-create response must be replayable without creating a
-- second invisible assignment. Bind a caller-owned request UUID to the
-- authenticated creator and to the canonical creation payload.

alter table public.assignments
  add column if not exists client_request_id uuid,
  add column if not exists create_request_fingerprint text;

create unique index if not exists assignments_created_by_client_request_id_key
  on public.assignments (created_by, client_request_id)
  where client_request_id is not null;

-- The previous seven-argument endpoint is intentionally retired. A browser
-- that has not deployed the request-ID protocol receives a safe compatibility
-- failure instead of silently losing idempotency.
drop function public.create_assignment_draft(
  uuid, text, text, uuid, text, timestamptz, jsonb
);

create function public.create_assignment_draft(
  p_organization_id uuid,
  p_title text,
  p_description text,
  p_subject_id uuid,
  p_grade text,
  p_due_date timestamptz,
  p_rubric_json jsonb,
  p_client_request_id uuid
)
returns public.assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_assignment public.assignments%rowtype;
  v_org_ids uuid[];
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_grade text := nullif(btrim(coalesce(p_grade, '')), '');
  v_rubric_json jsonb := coalesce(p_rubric_json, '[]'::jsonb);
  v_fingerprint text;
begin
  if v_profile_id is null then
    raise exception 'assignment_actor_required' using errcode = '42501';
  end if;
  if p_client_request_id is null then
    raise exception 'assignment_create_request_id_required'
      using errcode = '22023',
            hint = 'Reload after maintenance and retry the assignment creation.';
  end if;
  if v_title is null or v_grade is null then
    raise exception 'assignment_title_and_grade_required' using errcode = '22023';
  end if;

  if p_organization_id is null then
    if public.is_platform_admin() then
      select array_agg(id order by id) into v_org_ids
      from public.organizations
      where type = 'direct' and status = 'active';
    else
      select array_agg(om.organization_id order by om.organization_id) into v_org_ids
      from public.organization_members om
      where om.profile_id = v_profile_id
        and om.org_role = 'tutor'
        and om.status in ('active', 'approved');
    end if;

    if coalesce(cardinality(v_org_ids), 0) <> 1 then
      raise exception 'assignment_organization_required' using errcode = '22023';
    end if;
    p_organization_id := v_org_ids[1];
  end if;

  if not public.is_platform_admin() then
    if public.current_approved_active_tutor_id() is null then
      raise exception 'only_approved_active_tutors_can_manage_assignments' using errcode = '42501';
    end if;
    if not exists (
      select 1
      from public.organization_members om
      where om.organization_id = p_organization_id
        and om.profile_id = v_profile_id
        and om.org_role = 'tutor'
        and om.status in ('active', 'approved')
    ) then
      raise exception 'assignment_organization_forbidden' using errcode = '42501';
    end if;
  end if;

  v_fingerprint := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'organization_id', p_organization_id,
          'title', v_title,
          'description', v_description,
          'subject_id', p_subject_id,
          'grade', v_grade,
          'due_date', p_due_date,
          'rubric_json', v_rubric_json
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  -- Serialize only identical creator/request pairs. This closes the
  -- select-then-insert race while keeping unrelated draft creation concurrent.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'assignment-create:' || v_profile_id::text || ':' || p_client_request_id::text,
      0
    )
  );

  select * into v_assignment
  from public.assignments
  where created_by = v_profile_id
    and client_request_id = p_client_request_id
  for update;

  if found then
    if v_assignment.create_request_fingerprint is distinct from v_fingerprint then
      raise exception 'assignment_create_retry_payload_mismatch'
        using errcode = '23505',
              hint = 'Start a new assignment creation instead of reusing this request.';
    end if;
    return v_assignment;
  end if;

  insert into public.assignments (
    organization_id, title, description, subject_id, grade, due_date,
    created_by, status, attachment_url, memo_url, rubric_json,
    client_request_id, create_request_fingerprint
  ) values (
    p_organization_id, v_title, v_description, p_subject_id, v_grade,
    p_due_date, v_profile_id, 'draft', null, null, v_rubric_json,
    p_client_request_id, v_fingerprint
  ) returning * into v_assignment;

  perform public.log_audit_event(
    'assignment.draft_created',
    'assignment',
    v_assignment.id::text,
    jsonb_build_object(
      'organization_id', v_assignment.organization_id,
      'grade', v_assignment.grade,
      'client_request_id', p_client_request_id
    )
  );

  return v_assignment;
end;
$$;

revoke all on function public.create_assignment_draft(
  uuid, text, text, uuid, text, timestamptz, jsonb, uuid
) from public, anon;
grant execute on function public.create_assignment_draft(
  uuid, text, text, uuid, text, timestamptz, jsonb, uuid
) to authenticated, service_role;
