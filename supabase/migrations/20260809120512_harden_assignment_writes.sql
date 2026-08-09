-- AUTH-03: Assignment ownership is an organization boundary.  Do not trust a
-- caller-supplied organization_id or allow the Data API to write assignments.
-- The two RPCs below are the sole browser write surface.

drop policy if exists "admin_manage_assignments" on public.assignments;
create policy "admin_manage_assignments"
on public.assignments for select
using (public.is_platform_admin());

drop policy if exists "tutors_manage_own_assignments" on public.assignments;
create policy "tutors_manage_own_assignments"
on public.assignments for select
using (
  public.current_approved_active_tutor_id() is not null
  and created_by = public.current_profile_id()
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id = assignments.organization_id
      and om.profile_id = public.current_profile_id()
      and om.org_role = 'tutor'
      and om.status in ('active', 'approved')
  )
);

drop policy if exists "assignments_no_direct_insert" on public.assignments;
create policy "assignments_no_direct_insert"
on public.assignments for insert
to authenticated
with check (false);

drop policy if exists "assignments_no_direct_update" on public.assignments;
create policy "assignments_no_direct_update"
on public.assignments for update
to authenticated
using (false)
with check (false);

drop policy if exists "assignments_no_direct_delete" on public.assignments;
create policy "assignments_no_direct_delete"
on public.assignments for delete
to authenticated
using (false);

create or replace function public.create_assignment(
  p_organization_id uuid,
  p_title text,
  p_description text,
  p_subject_id uuid,
  p_grade text,
  p_due_date timestamptz,
  p_status public.assignment_status,
  p_attachment_url text default null,
  p_memo_url text default null,
  p_rubric_json jsonb default '[]'::jsonb
)
returns public.assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_assignment public.assignments;
  v_org_ids uuid[];
begin
  if v_profile_id is null then
    raise exception 'assignment_actor_required' using errcode = '42501';
  end if;

  if p_organization_id is null then
    -- Preserve today's one-organization flow without LIMIT 1. A multi-org
    -- tutor must select explicitly; choosing an arbitrary active membership
    -- would recreate AUTH-03 under a less obvious name.
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

  if not public.is_platform_admin() and not exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id
      and om.profile_id = v_profile_id
      and om.org_role = 'tutor'
      and om.status in ('active', 'approved')
  ) then
    raise exception 'assignment_organization_forbidden' using errcode = '42501';
  end if;

  if not public.is_platform_admin()
     and public.current_approved_active_tutor_id() is null then
    raise exception 'only_approved_active_tutors_can_manage_assignments' using errcode = '42501';
  end if;

  insert into public.assignments (
    organization_id, title, description, subject_id, grade, due_date,
    created_by, status, attachment_url, memo_url, rubric_json
  ) values (
    p_organization_id, p_title, p_description, p_subject_id, p_grade, p_due_date,
    v_profile_id, p_status, p_attachment_url, p_memo_url, p_rubric_json
  ) returning * into v_assignment;

  return v_assignment;
end;
$$;

create or replace function public.update_assignment(
  p_assignment_id uuid,
  p_title text,
  p_description text,
  p_subject_id uuid,
  p_grade text,
  p_due_date timestamptz,
  p_status public.assignment_status,
  p_attachment_url text,
  p_memo_url text,
  p_rubric_json jsonb
)
returns public.assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_assignment public.assignments;
begin
  select * into v_assignment from public.assignments where id = p_assignment_id;
  if not found then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;

  if v_profile_id is null then
    raise exception 'assignment_actor_required' using errcode = '42501';
  end if;

  if not public.is_platform_admin() then
    if public.current_approved_active_tutor_id() is null then
      raise exception 'only_approved_active_tutors_can_manage_assignments' using errcode = '42501';
    end if;
    if v_assignment.created_by <> v_profile_id or not exists (
      select 1 from public.organization_members om
      where om.organization_id = v_assignment.organization_id
        and om.profile_id = v_profile_id
        and om.org_role = 'tutor'
        and om.status in ('active', 'approved')
    ) then
      raise exception 'assignment_organization_forbidden' using errcode = '42501';
    end if;
  end if;

  update public.assignments
  set title = p_title, description = p_description, subject_id = p_subject_id,
      grade = p_grade, due_date = p_due_date, status = p_status,
      attachment_url = p_attachment_url, memo_url = p_memo_url,
      rubric_json = p_rubric_json
  where id = p_assignment_id
  returning * into v_assignment;

  return v_assignment;
end;
$$;

revoke all on function public.create_assignment(uuid, text, text, uuid, text, timestamptz, public.assignment_status, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.update_assignment(uuid, text, text, uuid, text, timestamptz, public.assignment_status, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_assignment(uuid, text, text, uuid, text, timestamptz, public.assignment_status, text, text, jsonb) to authenticated;
grant execute on function public.update_assignment(uuid, text, text, uuid, text, timestamptz, public.assignment_status, text, text, jsonb) to authenticated;
