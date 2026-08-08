create table if not exists public.tutor_applications (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null unique references public.tutors(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'changes_requested')),
  personal_details_json jsonb not null default '{}'::jsonb,
  subjects_json jsonb not null default '[]'::jsonb,
  grades_json jsonb not null default '[]'::jsonb,
  teaching_preferences_json jsonb not null default '[]'::jsonb,
  experience text,
  availability_notes text,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tutor_documents (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  document_type text not null check (document_type in ('identity', 'cv', 'qualification', 'additional')),
  storage_key text not null,
  original_filename text not null,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size_bytes int not null,
  uploaded_at timestamptz not null default now(),
  verification_status text not null default 'pending' check (verification_status in ('pending', 'accepted', 'rejected')),
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  notes text
);

create index if not exists idx_tutor_documents_tutor_uploaded on public.tutor_documents(tutor_id, uploaded_at desc);

create table if not exists public.tutor_availability_slots (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  mode text not null default 'online',
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tutor_availability_tutor_day_start on public.tutor_availability_slots(tutor_id, day_of_week, start_time);

alter table public.tutor_applications enable row level security;
alter table public.tutor_documents enable row level security;
alter table public.tutor_availability_slots enable row level security;

drop policy if exists "admin_select_all_tutor_applications" on public.tutor_applications;
create policy "admin_select_all_tutor_applications"
on public.tutor_applications for select
using (public.is_platform_admin());

drop policy if exists "tutors_select_own_application" on public.tutor_applications;
create policy "tutors_select_own_application"
on public.tutor_applications for select
using (tutor_id = public.current_tutor_id());

drop policy if exists "tutor_applications_no_direct_insert" on public.tutor_applications;
create policy "tutor_applications_no_direct_insert"
on public.tutor_applications for insert
with check (false);

drop policy if exists "tutor_applications_no_direct_update" on public.tutor_applications;
create policy "tutor_applications_no_direct_update"
on public.tutor_applications for update
using (false)
with check (false);

drop policy if exists "tutor_applications_no_direct_delete" on public.tutor_applications;
create policy "tutor_applications_no_direct_delete"
on public.tutor_applications for delete
using (false);

drop policy if exists "admin_select_all_tutor_documents" on public.tutor_documents;
create policy "admin_select_all_tutor_documents"
on public.tutor_documents for select
using (public.is_platform_admin());

drop policy if exists "tutors_select_own_documents" on public.tutor_documents;
create policy "tutors_select_own_documents"
on public.tutor_documents for select
using (tutor_id = public.current_tutor_id());

drop policy if exists "tutor_documents_no_direct_insert" on public.tutor_documents;
create policy "tutor_documents_no_direct_insert"
on public.tutor_documents for insert
with check (false);

drop policy if exists "tutor_documents_no_direct_update" on public.tutor_documents;
create policy "tutor_documents_no_direct_update"
on public.tutor_documents for update
using (false)
with check (false);

drop policy if exists "tutor_documents_no_direct_delete" on public.tutor_documents;
create policy "tutor_documents_no_direct_delete"
on public.tutor_documents for delete
using (false);

drop policy if exists "admin_select_all_tutor_availability_slots" on public.tutor_availability_slots;
create policy "admin_select_all_tutor_availability_slots"
on public.tutor_availability_slots for select
using (public.is_platform_admin());

drop policy if exists "tutors_select_own_availability_slots" on public.tutor_availability_slots;
create policy "tutors_select_own_availability_slots"
on public.tutor_availability_slots for select
using (tutor_id = public.current_tutor_id());

drop policy if exists "tutor_availability_slots_no_direct_insert" on public.tutor_availability_slots;
create policy "tutor_availability_slots_no_direct_insert"
on public.tutor_availability_slots for insert
with check (false);

drop policy if exists "tutor_availability_slots_no_direct_update" on public.tutor_availability_slots;
create policy "tutor_availability_slots_no_direct_update"
on public.tutor_availability_slots for update
using (false)
with check (false);

drop policy if exists "tutor_availability_slots_no_direct_delete" on public.tutor_availability_slots;
create policy "tutor_availability_slots_no_direct_delete"
on public.tutor_availability_slots for delete
using (false);

insert into storage.buckets (id, name, public)
values ('tutor-documents', 'tutor-documents', false)
on conflict (id) do nothing;

drop policy if exists "tutors_upload_own_tutor_documents" on storage.objects;
create policy "tutors_upload_own_tutor_documents"
on storage.objects for insert
with check (
  bucket_id = 'tutor-documents'
  and public.current_profile_role() = 'tutor'
  and array_length(storage.foldername(name), 1) = 1
  and (storage.foldername(name))[1] = public.current_tutor_id()::text
);

drop policy if exists "tutors_read_own_tutor_documents_or_admin" on storage.objects;
create policy "tutors_read_own_tutor_documents_or_admin"
on storage.objects for select
using (
  bucket_id = 'tutor-documents'
  and (
    public.is_platform_admin()
    or (storage.foldername(name))[1] = public.current_tutor_id()::text
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
  v_tutor_id uuid := public.current_tutor_id();
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
  v_tutor_id uuid := public.current_tutor_id();
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

create or replace function public.decide_tutor_application(
  p_application_id uuid,
  p_status text,
  p_note text
)
returns public.tutor_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.current_profile_id();
  v_row public.tutor_applications;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_status not in ('under_review', 'approved', 'rejected', 'changes_requested') then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  update public.tutor_applications
  set status = p_status,
      reviewed_by = v_admin,
      reviewed_at = now(),
      review_note = p_note,
      updated_at = now()
  where id = p_application_id
  returning * into v_row;

  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;

  if p_status = 'approved' then
    update public.tutors
    set approval_status = 'approved',
        approval_reviewed_by = v_admin,
        approval_reviewed_at = now(),
        approval_note = p_note,
        qualification_band = coalesce(qualification_band, 'BOTH'),
        qualified_subjects_json = v_row.subjects_json,
        teaching_preferences_json = v_row.teaching_preferences_json,
        status = 'active'
    where id = v_row.tutor_id;
  else
    update public.tutors
    set approval_status = p_status,
        approval_reviewed_by = v_admin,
        approval_reviewed_at = now(),
        approval_note = p_note
    where id = v_row.tutor_id;
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
  v_tutor_id uuid := public.current_tutor_id();
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

create or replace function public.verify_tutor_document(
  p_document_id uuid,
  p_status text,
  p_notes text
)
returns public.tutor_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.tutor_documents;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_status not in ('accepted', 'rejected') then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  update public.tutor_documents
  set verification_status = p_status,
      notes = p_notes,
      verified_by = public.current_profile_id(),
      verified_at = now()
  where id = p_document_id
  returning * into v_row;

  if not found then
    raise exception 'document_not_found' using errcode = 'P0002';
  end if;

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
  v_tutor_id uuid := public.current_tutor_id();
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

grant execute on function public.upsert_tutor_application(jsonb, jsonb, jsonb, jsonb, text, text) to authenticated;
grant execute on function public.submit_tutor_application() to authenticated;
grant execute on function public.decide_tutor_application(uuid, text, text) to authenticated;
grant execute on function public.record_tutor_document(text, text, text, text, int) to authenticated;
grant execute on function public.verify_tutor_document(uuid, text, text) to authenticated;
grant execute on function public.replace_tutor_availability(jsonb) to authenticated;

create table if not exists public.student_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  student_id uuid not null references public.students(id) on delete cascade,
  score_date date not null,
  risk_score int not null check (risk_score between 0 and 100),
  momentum_score int not null check (momentum_score between 0 and 100),
  reasons_json jsonb not null default '[]'::jsonb,
  metrics_json jsonb not null default '{}'::jsonb,
  recommended_actions_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint student_score_snapshots_reasons_array check (jsonb_typeof(reasons_json) = 'array'),
  constraint student_score_snapshots_metrics_object check (jsonb_typeof(metrics_json) = 'object'),
  constraint student_score_snapshots_actions_array check (jsonb_typeof(recommended_actions_json) = 'array'),
  unique (student_id, score_date)
);

alter table public.student_score_snapshots add column if not exists organization_id uuid not null references public.organizations(id);
alter table public.student_score_snapshots add column if not exists student_id uuid not null references public.students(id) on delete cascade;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'student_score_snapshots_student_id_score_date_key') then
    alter table public.student_score_snapshots add constraint student_score_snapshots_student_id_score_date_key unique (student_id, score_date);
  end if;
end
$$;

create index if not exists idx_student_score_snapshots_student_date on public.student_score_snapshots(student_id, score_date desc);
create index if not exists idx_student_score_snapshots_organization on public.student_score_snapshots(organization_id);

create table if not exists public.career_progress_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  student_id uuid not null references public.students(id) on delete cascade,
  goal_id text not null,
  alignment_score int not null check (alignment_score between 0 and 100),
  reasons_json jsonb not null default '[]'::jsonb,
  metrics_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint career_progress_snapshots_reasons_array check (jsonb_typeof(reasons_json) = 'array'),
  constraint career_progress_snapshots_metrics_object check (jsonb_typeof(metrics_json) = 'object')
);

alter table public.career_progress_snapshots add column if not exists organization_id uuid not null references public.organizations(id);
alter table public.career_progress_snapshots add column if not exists student_id uuid not null references public.students(id) on delete cascade;

create index if not exists idx_career_progress_snapshots_student_goal on public.career_progress_snapshots(student_id, goal_id, created_at desc);
create index if not exists idx_career_progress_snapshots_organization on public.career_progress_snapshots(organization_id);

alter table public.student_score_snapshots enable row level security;
alter table public.career_progress_snapshots enable row level security;

create or replace function public.fill_student_scoped_organization_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if new.organization_id is not null then
    return new;
  end if;

  select organization_id into v_org
  from public.students
  where id = new.student_id;

  if v_org is null then
    raise exception 'student_scoped_org_unresolved' using errcode = '23502';
  end if;

  new.organization_id := v_org;
  return new;
end;
$$;

drop trigger if exists trg_fill_student_score_snapshot_org on public.student_score_snapshots;
create trigger trg_fill_student_score_snapshot_org
  before insert on public.student_score_snapshots
  for each row execute function public.fill_student_scoped_organization_id();

drop trigger if exists trg_fill_career_progress_snapshot_org on public.career_progress_snapshots;
create trigger trg_fill_career_progress_snapshot_org
  before insert on public.career_progress_snapshots
  for each row execute function public.fill_student_scoped_organization_id();

drop policy if exists "student_score_snapshots_select" on public.student_score_snapshots;
create policy student_score_snapshots_select on public.student_score_snapshots
for select
using (
  public.is_platform_admin()
  or student_id = public.current_student_id()
  or exists (
    select 1 from public.tutor_student_allocations tsa
    where tsa.student_id = public.student_score_snapshots.student_id
      and tsa.tutor_id = public.current_tutor_id()
      and tsa.status = 'active'
  )
);

drop policy if exists "student_score_snapshots_no_direct_insert" on public.student_score_snapshots;
create policy student_score_snapshots_no_direct_insert on public.student_score_snapshots
for insert
with check (false);

drop policy if exists "student_score_snapshots_no_direct_update" on public.student_score_snapshots;
create policy student_score_snapshots_no_direct_update on public.student_score_snapshots
for update
using (false)
with check (false);

drop policy if exists "student_score_snapshots_no_direct_delete" on public.student_score_snapshots;
create policy student_score_snapshots_no_direct_delete on public.student_score_snapshots
for delete
using (false);

drop policy if exists "career_progress_snapshots_select" on public.career_progress_snapshots;
create policy career_progress_snapshots_select on public.career_progress_snapshots
for select
using (
  public.is_platform_admin()
  or student_id = public.current_student_id()
  or exists (
    select 1 from public.tutor_student_allocations tsa
    where tsa.student_id = public.career_progress_snapshots.student_id
      and tsa.tutor_id = public.current_tutor_id()
      and tsa.status = 'active'
  )
);

drop policy if exists "career_progress_snapshots_no_direct_insert" on public.career_progress_snapshots;
create policy career_progress_snapshots_no_direct_insert on public.career_progress_snapshots
for insert
with check (false);

drop policy if exists "career_progress_snapshots_no_direct_update" on public.career_progress_snapshots;
create policy career_progress_snapshots_no_direct_update on public.career_progress_snapshots
for update
using (false)
with check (false);

drop policy if exists "career_progress_snapshots_no_direct_delete" on public.career_progress_snapshots;
create policy career_progress_snapshots_no_direct_delete on public.career_progress_snapshots
for delete
using (false);;
