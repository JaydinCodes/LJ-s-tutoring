-- Extend the initial allocation gate to active classes and prevent a vetting
-- record from being downgraded while the tutor remains actively placed.
create or replace function public.record_tutor_vetting(
  p_tutor_id uuid,
  p_status text,
  p_reviewed_at timestamptz,
  p_expires_at timestamptz default null,
  p_evidence_reference text default null
)
returns public.tutor_vetting_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_record public.tutor_vetting_records;
  v_reviewer uuid := public.current_profile_id();
  v_evidence_reference text := nullif(btrim(coalesce(p_evidence_reference, '')), '');
begin
  if not public.is_platform_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_tutor_id is null or not exists (select 1 from public.tutors where id = p_tutor_id) then
    raise exception 'tutor_not_found' using errcode = 'P0002';
  end if;

  if v_status not in ('pending', 'approved', 'rejected', 'expired') then
    raise exception 'tutor_vetting_status_invalid' using errcode = '22023';
  end if;

  if v_status <> 'approved' and (
    exists (
      select 1 from public.tutor_student_allocations
      where tutor_id = p_tutor_id and status = 'active'::public.record_status
    )
    or exists (
      select 1 from public.classes
      where tutor_id = p_tutor_id and status = 'active'::public.record_status
    )
  ) then
    raise exception 'tutor_vetting_required_for_active_placement' using errcode = '42501';
  end if;

  if v_status = 'approved' then
    if p_reviewed_at is null or p_expires_at is null or p_expires_at <= now() then
      raise exception 'tutor_vetting_expiry_required' using errcode = '22023';
    end if;
    if v_evidence_reference is null then
      raise exception 'tutor_vetting_evidence_reference_required' using errcode = '22023';
    end if;
  end if;

  insert into public.tutor_vetting_records (
    tutor_id, status, reviewed_at, expires_at, reviewed_by_profile_id,
    evidence_reference, updated_at
  )
  values (
    p_tutor_id,
    v_status,
    p_reviewed_at,
    case when v_status = 'approved' then p_expires_at else null end,
    v_reviewer,
    case when v_status = 'approved' then v_evidence_reference else null end,
    now()
  )
  on conflict (tutor_id) do update
    set status = excluded.status,
        reviewed_at = excluded.reviewed_at,
        expires_at = excluded.expires_at,
        reviewed_by_profile_id = excluded.reviewed_by_profile_id,
        evidence_reference = excluded.evidence_reference,
        updated_at = now()
  returning * into v_record;

  perform public.log_audit_event(
    'tutor.vetting_recorded',
    'tutor',
    p_tutor_id::text,
    jsonb_build_object('status', v_status, 'expires_at', v_record.expires_at)
  );

  return v_record;
end;
$$;

drop trigger if exists enforce_active_class_tutor_vetting on public.classes;
create trigger enforce_active_class_tutor_vetting
before insert or update of tutor_id, status on public.classes
for each row execute function public.enforce_active_allocation_tutor_vetting();
