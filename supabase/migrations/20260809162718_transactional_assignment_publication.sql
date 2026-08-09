-- FUNC-02: Assignment publishing used to be a browser-side chain: publish the
-- row, upload one or two objects, update their paths, then issue separate audit
-- calls. A broken upload could therefore expose an incomplete assignment and a
-- broken audit call could report a successful write as a failure.
--
-- The browser now creates an invisible draft, uploads candidate assets below
-- that draft's controlled staging path, and calls one finalise RPC. This RPC
-- validates the paths, changes visibility, replaces old objects, and appends
-- the audit trail in one Postgres transaction.

create or replace function public.create_assignment_draft(
  p_organization_id uuid,
  p_title text,
  p_description text,
  p_subject_id uuid,
  p_grade text,
  p_due_date timestamptz,
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

  if nullif(btrim(coalesce(p_title, '')), '') is null
     or nullif(btrim(coalesce(p_grade, '')), '') is null then
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

  insert into public.assignments (
    organization_id, title, description, subject_id, grade, due_date,
    created_by, status, attachment_url, memo_url, rubric_json
  ) values (
    p_organization_id, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''),
    p_subject_id, btrim(p_grade), p_due_date, v_profile_id, 'draft', null, null,
    coalesce(p_rubric_json, '[]'::jsonb)
  ) returning * into v_assignment;

  perform public.log_audit_event(
    'assignment.draft_created',
    'assignment',
    v_assignment.id::text,
    jsonb_build_object('organization_id', v_assignment.organization_id, 'grade', v_assignment.grade)
  );

  return v_assignment;
end;
$$;

create or replace function public.finalize_assignment_publication(
  p_assignment_id uuid,
  p_title text,
  p_description text,
  p_subject_id uuid,
  p_grade text,
  p_due_date timestamptz,
  p_status public.assignment_status,
  p_attachment_url text,
  p_memo_url text,
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
  v_previous_status public.assignment_status;
  v_previous_attachment_url text;
  v_previous_memo_url text;
  v_is_new_attachment boolean;
  v_is_new_memo boolean;
  v_action text;
begin
  select * into v_assignment
  from public.assignments
  where id = p_assignment_id
  for update;

  if not found then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;
  if v_profile_id is null then
    raise exception 'assignment_actor_required' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null
     or nullif(btrim(coalesce(p_grade, '')), '') is null then
    raise exception 'assignment_title_and_grade_required' using errcode = '22023';
  end if;

  if not public.is_platform_admin() then
    if public.current_approved_active_tutor_id() is null
       or v_assignment.created_by <> v_profile_id
       or not exists (
         select 1
         from public.organization_members om
         where om.organization_id = v_assignment.organization_id
           and om.profile_id = v_profile_id
           and om.org_role = 'tutor'
           and om.status in ('active', 'approved')
       ) then
      raise exception 'assignment_organization_forbidden' using errcode = '42501';
    end if;
  end if;

  -- Existing legacy paths may remain in place. Every *new* path must be an
  -- object uploaded under this assignment's staging namespace.
  if p_attachment_url is not null and p_attachment_url is distinct from v_assignment.attachment_url then
    if p_attachment_url !~ ('^' || v_assignment.id::text || '/staging/[0-9a-fA-F-]{36}/[^/]+$')
       or not exists (
         select 1 from storage.objects o
         where o.bucket_id = 'assignment-files' and o.name = p_attachment_url
       ) then
      raise exception 'assignment_attachment_staging_asset_invalid' using errcode = '22023';
    end if;
  end if;

  if p_memo_url is not null and p_memo_url is distinct from v_assignment.memo_url then
    if p_memo_url !~ ('^' || v_assignment.id::text || '/staging/[0-9a-fA-F-]{36}/[^/]+$')
       or not exists (
         select 1 from storage.objects o
         where o.bucket_id = 'assignment-memos' and o.name = p_memo_url
       ) then
      raise exception 'assignment_memo_staging_asset_invalid' using errcode = '22023';
    end if;
  end if;

  v_previous_attachment_url := v_assignment.attachment_url;
  v_previous_memo_url := v_assignment.memo_url;
  v_previous_status := v_assignment.status;
  v_is_new_attachment := p_attachment_url is distinct from v_previous_attachment_url;
  v_is_new_memo := p_memo_url is distinct from v_previous_memo_url;

  update public.assignments
  set title = btrim(p_title),
      description = nullif(btrim(coalesce(p_description, '')), ''),
      subject_id = p_subject_id,
      grade = btrim(p_grade),
      due_date = p_due_date,
      status = p_status,
      attachment_url = p_attachment_url,
      memo_url = p_memo_url,
      rubric_json = coalesce(p_rubric_json, '[]'::jsonb)
  where id = v_assignment.id
  returning * into v_assignment;

  -- The database update, replacement deletion, and audit rows are one
  -- transaction. A later audit failure rolls all three back rather than
  -- leaving a browser-facing partial success.
  if v_is_new_attachment and v_previous_attachment_url is not null then
    delete from storage.objects o
    where o.bucket_id = 'assignment-files'
      and o.name = v_previous_attachment_url
      and not exists (
        select 1 from public.assignments a
        where a.id <> v_assignment.id
          and a.attachment_url = v_previous_attachment_url
      );
  end if;
  if v_is_new_memo and v_previous_memo_url is not null then
    delete from storage.objects o
    where o.bucket_id = 'assignment-memos'
      and o.name = v_previous_memo_url
      and not exists (
        select 1 from public.assignments a
        where a.id <> v_assignment.id
          and a.memo_url = v_previous_memo_url
      );
  end if;

  v_action := case
    when v_assignment.status = 'published' and v_previous_status is distinct from 'published' then 'assignment.published'
    else 'assignment.updated'
  end;
  perform public.log_audit_event(
    v_action,
    'assignment',
    v_assignment.id::text,
    jsonb_build_object(
      'status', v_assignment.status,
      'grade', v_assignment.grade,
      'subject_id', v_assignment.subject_id,
      'attachment_replaced', v_is_new_attachment,
      'memo_replaced', v_is_new_memo
    )
  );
  if v_is_new_attachment then
    perform public.log_audit_event(
      'assignment.attachment_replaced', 'assignment', v_assignment.id::text,
      jsonb_build_object('previous_attachment_url', v_previous_attachment_url, 'new_attachment_url', p_attachment_url)
    );
  end if;
  if v_is_new_memo then
    perform public.log_audit_event(
      'assignment.memo_replaced', 'assignment', v_assignment.id::text,
      jsonb_build_object('previous_memo_url', v_previous_memo_url, 'new_memo_url', p_memo_url)
    );
  end if;

  return v_assignment;
end;
$$;

create or replace function public.discard_assignment_staged_assets(
  p_assignment_id uuid,
  p_attachment_url text default null,
  p_memo_url text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.assignments;
  v_deleted integer := 0;
  v_removed integer := 0;
begin
  select * into v_assignment from public.assignments where id = p_assignment_id;
  if not found then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;
  if not public.is_platform_admin() and (
    public.current_approved_active_tutor_id() is null
    or v_assignment.created_by <> public.current_profile_id()
  ) then
    raise exception 'assignment_organization_forbidden' using errcode = '42501';
  end if;

  if p_attachment_url is not null
     and p_attachment_url ~ ('^' || v_assignment.id::text || '/staging/[0-9a-fA-F-]{36}/[^/]+$')
     and p_attachment_url is distinct from v_assignment.attachment_url then
    delete from storage.objects where bucket_id = 'assignment-files' and name = p_attachment_url;
    get diagnostics v_removed = row_count;
    v_deleted := v_deleted + v_removed;
  end if;
  if p_memo_url is not null
     and p_memo_url ~ ('^' || v_assignment.id::text || '/staging/[0-9a-fA-F-]{36}/[^/]+$')
     and p_memo_url is distinct from v_assignment.memo_url then
    delete from storage.objects where bucket_id = 'assignment-memos' and name = p_memo_url;
    get diagnostics v_removed = row_count;
    v_deleted := v_deleted + v_removed;
  end if;

  if v_deleted > 0 then
    perform public.log_audit_event(
      'assignment.staged_assets_discarded', 'assignment', v_assignment.id::text,
      jsonb_build_object('asset_count', v_deleted)
    );
  end if;
  return v_deleted;
end;
$$;

create or replace function public.cleanup_orphaned_assignment_assets()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  -- Only the service-role worker or pg_cron can call this function. pg_cron
  -- has no JWT; the execute grant below prevents an anonymous browser call.
  if auth.uid() is not null and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  with deleted as (
    delete from storage.objects o
    where o.bucket_id in ('assignment-files', 'assignment-memos')
      and o.created_at < now() - interval '24 hours'
      and o.name ~ '^[0-9a-fA-F-]{36}/(staging/)?'
      and not exists (
        select 1
        from public.assignments a
        where (o.bucket_id = 'assignment-files' and a.attachment_url = o.name)
           or (o.bucket_id = 'assignment-memos' and a.memo_url = o.name)
      )
    returning 1
  )
  select count(*) into v_deleted from deleted;

  if v_deleted > 0 then
    perform public.log_audit_event(
      'assignment.orphaned_assets_cleaned', 'system', null,
      jsonb_build_object('asset_count', v_deleted)
    );
  end if;
  return v_deleted;
end;
$$;

revoke all on function public.create_assignment(uuid, text, text, uuid, text, timestamptz, public.assignment_status, text, text, jsonb) from authenticated;
revoke all on function public.update_assignment(uuid, text, text, uuid, text, timestamptz, public.assignment_status, text, text, jsonb) from authenticated;
revoke all on function public.create_assignment_draft(uuid, text, text, uuid, text, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.finalize_assignment_publication(uuid, text, text, uuid, text, timestamptz, public.assignment_status, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.discard_assignment_staged_assets(uuid, text, text) from public, anon, authenticated;
revoke all on function public.cleanup_orphaned_assignment_assets() from public, anon, authenticated;
grant execute on function public.create_assignment_draft(uuid, text, text, uuid, text, timestamptz, jsonb) to authenticated;
grant execute on function public.finalize_assignment_publication(uuid, text, text, uuid, text, timestamptz, public.assignment_status, text, text, jsonb) to authenticated;
grant execute on function public.discard_assignment_staged_assets(uuid, text, text) to authenticated;
grant execute on function public.cleanup_orphaned_assignment_assets() to service_role;

-- Keep retries and abandoned tabs from accumulating private objects forever.
select cron.unschedule(jobid)
from cron.job
where jobname = 'cleanup-orphaned-assignment-assets';

select cron.schedule(
  'cleanup-orphaned-assignment-assets',
  '17 3 * * *',
  'select public.cleanup_orphaned_assignment_assets()'
);
