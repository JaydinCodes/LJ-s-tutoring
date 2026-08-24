-- Safeguarding boundary: an active learner allocation may only be created for
-- a tutor whose vetting is explicitly approved and still in date.  Evidence is
-- kept as a controlled reference, never as a scan of an identity/checking
-- document in the application database.
create table public.tutor_vetting_records (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null unique references public.tutors(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'expired')),
  reviewed_at timestamptz,
  expires_at timestamptz,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  evidence_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'approved' and reviewed_at is not null and expires_at is not null
      and evidence_reference is not null and btrim(evidence_reference) <> '')
    or status <> 'approved'
  ),
  check (expires_at is null or reviewed_at is null or expires_at > reviewed_at)
);

comment on table public.tutor_vetting_records is
  'Safeguarding verification status. Store only a case/reference identifier; source documents remain in the approved restricted system.';
comment on column public.tutor_vetting_records.evidence_reference is
  'Restricted-system case or register reference, not a document URL or identity-check content.';

-- Existing tutors are deliberately not treated as approved. They must be
-- reconciled by an AAL2 platform admin before a new active allocation can be
-- made. Existing allocations are left intact to avoid silently disrupting
-- learners; their review is an explicit production-readiness task.
insert into public.tutor_vetting_records (tutor_id, status)
select id, 'pending'
from public.tutors
on conflict (tutor_id) do nothing;

alter table public.tutor_vetting_records enable row level security;

create policy "admin_select_tutor_vetting_records"
on public.tutor_vetting_records
for select
using (public.is_platform_admin());

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

revoke execute on function public.record_tutor_vetting(uuid, text, timestamptz, timestamptz, text) from public;
revoke execute on function public.record_tutor_vetting(uuid, text, timestamptz, timestamptz, text) from anon;
grant execute on function public.record_tutor_vetting(uuid, text, timestamptz, timestamptz, text) to authenticated;

create or replace function public.enforce_active_allocation_tutor_vetting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active'::public.record_status and not exists (
    select 1
    from public.tutor_vetting_records vetting
    where vetting.tutor_id = new.tutor_id
      and vetting.status = 'approved'
      and vetting.expires_at > now()
  ) then
    raise exception 'tutor_vetting_required' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_active_allocation_tutor_vetting on public.tutor_student_allocations;
create trigger enforce_active_allocation_tutor_vetting
before insert or update of tutor_id, status on public.tutor_student_allocations
for each row execute function public.enforce_active_allocation_tutor_vetting();
