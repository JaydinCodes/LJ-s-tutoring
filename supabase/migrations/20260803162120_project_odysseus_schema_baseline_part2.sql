-- Raw join into public.profiles here would recurse (see the "Identity lookup
-- shadow table" comment near current_profile_role()); rewritten to use
-- current_profile_id()/current_profile_role() (public.profile_identities)
-- instead. Same semantics: only a tutor viewing submissions for assignments
-- they themselves created.
drop policy if exists "tutors_select_own_assignment_submissions" on public.assignment_submissions;
create policy "tutors_select_own_assignment_submissions"
on public.assignment_submissions for select
using (
  public.current_profile_role() = 'tutor'
  and assignment_id in (
    select a.id from public.assignments a
    where a.created_by = public.current_profile_id()
  )
);

-- Raw join into public.profiles here would recurse (see the "Identity lookup
-- shadow table" comment near current_profile_role()); current_student_id()
-- now resolves via public.profile_identities instead of public.profiles directly.
drop policy if exists "student_progress_self_or_admin" on public.student_progress;
create policy "student_progress_self_or_admin"
on public.student_progress for select
using (
  public.is_platform_admin()
  or student_id = public.current_student_id()
);

drop policy if exists "admin_manage_progress" on public.student_progress;
create policy "admin_manage_progress"
on public.student_progress for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "progress_insert_via_marking_rpc_only" on public.student_progress;
create policy "progress_insert_via_marking_rpc_only"
on public.student_progress for insert
with check (false);

drop policy if exists "admin_finance_access" on public.payments;
create policy "admin_finance_access"
on public.payments for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "admin_tutor_payment_access" on public.tutor_payments;
create policy "admin_tutor_payment_access"
on public.tutor_payments for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "classes_read_authenticated" on public.classes;

drop policy if exists "classes_select_scoped" on public.classes;
create policy "classes_select_scoped"
on public.classes for select
using (
  public.is_platform_admin()
  or tutor_id = public.current_tutor_id()
  or id in (
    select ce.class_id
    from public.class_enrollments ce
    where ce.student_id = public.current_student_id()
      and ce.status = 'active'
  )
);

drop policy if exists "admin_manage_classes" on public.classes;
create policy "admin_manage_classes"
on public.classes for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "class_enrollments_read_authenticated" on public.class_enrollments;

drop policy if exists "class_enrollments_select_scoped" on public.class_enrollments;
create policy "class_enrollments_select_scoped"
on public.class_enrollments for select
using (
  public.is_platform_admin()
  or student_id = public.current_student_id()
  or class_id in (
    select c.id
    from public.classes c
    where c.tutor_id = public.current_tutor_id()
  )
);

drop policy if exists "admin_manage_class_enrollments" on public.class_enrollments;
create policy "admin_manage_class_enrollments"
on public.class_enrollments for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "tutor_student_allocations_select_scoped" on public.tutor_student_allocations;
create policy "tutor_student_allocations_select_scoped"
on public.tutor_student_allocations for select
using (
  public.is_platform_admin()
  or (
    status = 'active'
    and (
      tutor_id = public.current_tutor_id()
      or student_id = public.current_student_id()
    )
  )
);

drop policy if exists "admin_manage_tutor_student_allocations" on public.tutor_student_allocations;
create policy "admin_manage_tutor_student_allocations"
on public.tutor_student_allocations for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

insert into storage.buckets (id, name, public)
values
  ('assignment-files', 'assignment-files', false),
  ('assignment-submissions', 'assignment-submissions', false)
on conflict (id) do nothing;

drop policy if exists "admin_tutor_upload_assignment_files" on storage.objects;
create policy "admin_tutor_upload_assignment_files"
on storage.objects for insert
with check (
  bucket_id = 'assignment-files'
  and (
    public.is_platform_admin()
    or (
      public.current_profile_role() = 'tutor'
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
      public.current_profile_role() = 'tutor'
      and exists (
        select 1 from public.assignments a
        where a.id::text = (storage.foldername(name))[1]
          and a.created_by = public.current_profile_id()
      )
    )
    or (
      public.current_profile_role() = 'student'
      and exists (
        select 1 from public.assignments a
        where a.id::text = (storage.foldername(name))[1]
          and a.status = 'published'
      )
    )
  )
);

drop policy if exists "students_upload_own_submission_files" on storage.objects;
create policy "students_upload_own_submission_files"
on storage.objects for insert
with check (
  bucket_id = 'assignment-submissions'
  and public.current_profile_role() = 'student'
  and array_length(storage.foldername(name), 1) = 4
  and (storage.foldername(name))[1] = public.current_student_id()::text
  and (storage.foldername(name))[2] in (
    select a.id::text from public.assignments a
    where a.status = 'published'
  )
);

drop policy if exists "students_update_own_submission_files" on storage.objects;
create policy "students_update_own_submission_files"
on storage.objects for update
using (
  bucket_id = 'assignment-submissions'
  and public.current_profile_role() = 'student'
  and array_length(storage.foldername(name), 1) = 4
  and (storage.foldername(name))[1] = public.current_student_id()::text
  and (storage.foldername(name))[2] in (
    select a.id::text from public.assignments a
    where a.status = 'published'
  )
)
with check (
  bucket_id = 'assignment-submissions'
  and public.current_profile_role() = 'student'
  and array_length(storage.foldername(name), 1) = 4
  and (storage.foldername(name))[1] = public.current_student_id()::text
  and (storage.foldername(name))[2] in (
    select a.id::text from public.assignments a
    where a.status = 'published'
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
      public.current_profile_role() = 'tutor'
      and (storage.foldername(name))[2] in (
        select a.id::text from public.assignments a
        where a.created_by = public.current_profile_id()
      )
    )
    or (storage.foldername(name))[1] = public.current_student_id()::text
  )
);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'privacy_request_type') then
    create type public.privacy_request_type as enum ('access', 'correction', 'deletion');
  end if;
end
$$;

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  subject_student_id uuid references public.students(id) on delete set null,
  subject_profile_id uuid references public.profiles(id) on delete set null,
  request_type public.privacy_request_type not null,
  status public.record_status not null default 'pending',
  requested_by uuid references public.profiles(id),
  notes text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.privacy_requests add column if not exists subject_student_id uuid references public.students(id) on delete set null;
alter table public.privacy_requests add column if not exists subject_profile_id uuid references public.profiles(id) on delete set null;
alter table public.privacy_requests add column if not exists requested_by uuid references public.profiles(id);
alter table public.privacy_requests add column if not exists notes text;
alter table public.privacy_requests add column if not exists result jsonb not null default '{}'::jsonb;
alter table public.privacy_requests add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_privacy_requests_subject_student
  on public.privacy_requests(subject_student_id);
create index if not exists idx_privacy_requests_status
  on public.privacy_requests(status);

alter table public.privacy_requests enable row level security;

drop policy if exists "privacy_requests_admin_all" on public.privacy_requests;
create policy "privacy_requests_admin_all"
on public.privacy_requests for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

create or replace function public.export_student_data(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select profile_id into v_profile_id from public.students where id = p_student_id;
  if v_profile_id is null then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'student', (select to_jsonb(s) from public.students s where s.id = p_student_id),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = v_profile_id),
    'guardians', (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb)
                  from public.guardians g
                  join public.student_guardians sg on sg.guardian_id = g.id
                  where sg.student_id = p_student_id),
    'career_profile', (select to_jsonb(c) from public.student_career_profiles c
                       where c.student_id = p_student_id),
    'submissions', (select coalesce(jsonb_agg(to_jsonb(sub)), '[]'::jsonb)
                    from public.assignment_submissions sub where sub.student_id = p_student_id),
    'progress', (select coalesce(jsonb_agg(to_jsonb(pr)), '[]'::jsonb)
                 from public.student_progress pr where pr.student_id = p_student_id),
    'enrollments', (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
                    from public.class_enrollments e where e.student_id = p_student_id),
    'allocations', (select coalesce(jsonb_agg(to_jsonb(al)), '[]'::jsonb)
                    from public.tutor_student_allocations al where al.student_id = p_student_id),
    'payments', (select coalesce(jsonb_agg(to_jsonb(pay)), '[]'::jsonb)
                 from public.payments pay where pay.student_id = p_student_id)
  ) into v_result;

  perform public.log_audit_event('privacy.data_exported', 'student', p_student_id::text,
    jsonb_build_object('subject_profile_id', v_profile_id));

  return v_result;
end;
$$;

create or replace function public.anonymize_student(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_has_financial boolean;
  v_mode text;
  v_submissions_removed integer := 0;
  v_files_removed integer := 0;
begin
  if not public.is_platform_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select profile_id into v_profile_id from public.students where id = p_student_id;
  if v_profile_id is null then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;

  select exists(select 1 from public.payments where student_id = p_student_id)
    into v_has_financial;
  v_mode := case when v_has_financial then 'anonymized_financial_hold' else 'anonymized' end;

  delete from public.student_career_profiles where student_id = p_student_id;

  begin
    delete from storage.objects
     where bucket_id = 'assignment-submissions'
       and (storage.foldername(name))[1] = p_student_id::text;
    get diagnostics v_files_removed = row_count;
  exception
    when insufficient_privilege then v_files_removed := -1;
  end;

  delete from public.assignment_submissions where student_id = p_student_id;
  get diagnostics v_submissions_removed = row_count;
  delete from public.student_progress where student_id = p_student_id;

  delete from public.weekly_reports where student_id = p_student_id;
  delete from public.student_notifications where student_id = p_student_id;
  delete from public.baseline_assessments where student_id = p_student_id;
  delete from public.learning_goals where student_id = p_student_id;
  delete from public.student_exam_events where student_id = p_student_id;
  delete from public.student_score_snapshots where student_id = p_student_id;
  delete from public.career_progress_snapshots where student_id = p_student_id;

  update public.sessions
     set notes = null,
         topics_covered = null,
         learner_struggles = null,
         homework_assigned = null,
         tutor_private_notes = null,
         student_summary = null,
         report_review_note = null
   where student_id = p_student_id;

  delete from public.student_guardians where student_id = p_student_id;
  delete from public.guardians g
   where g.profile_id is null
     and not exists (select 1 from public.student_guardians sg where sg.guardian_id = g.id);

  update public.students
     set parent_name = null,
         parent_contact = null,
         school = null,
         status = 'inactive'
   where id = p_student_id;

  update public.profiles
     set full_name = 'Redacted Learner',
         email = 'redacted+' || v_profile_id::text || '@removed.invalid',
         phone = null
   where id = v_profile_id;

  perform public.log_audit_event('privacy.subject_anonymized', 'student', p_student_id::text,
    jsonb_build_object('mode', v_mode,
                       'submissions_removed', v_submissions_removed,
                       'files_removed', v_files_removed));

  return jsonb_build_object(
    'student_id', p_student_id,
    'mode', v_mode,
    'submissions_removed', v_submissions_removed,
    'files_removed', v_files_removed
  );
end;
$$;

create or replace function public.process_privacy_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.privacy_requests;
  v_result jsonb;
  v_status public.record_status;
begin
  if not public.is_platform_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_req from public.privacy_requests where id = p_request_id;
  if v_req.id is null then
    raise exception 'privacy_request_not_found' using errcode = 'P0002';
  end if;
  if v_req.subject_student_id is null then
    raise exception 'privacy_request_subject_required' using errcode = '23514';
  end if;

  if v_req.request_type = 'access' then
    v_result := public.export_student_data(v_req.subject_student_id);
    v_status := 'approved';
  elsif v_req.request_type = 'deletion' then
    v_result := public.anonymize_student(v_req.subject_student_id);
    v_status := 'approved';
  else
    v_result := jsonb_build_object('note', 'correction applied via admin update');
    v_status := 'approved';
  end if;

  update public.privacy_requests
     set status = v_status, result = v_result, updated_at = now()
   where id = p_request_id;

  perform public.log_audit_event('privacy.request_processed', 'privacy_request', p_request_id::text,
    jsonb_build_object('request_type', v_req.request_type, 'status', v_status));

  return v_result;
end;
$$;

grant execute on function public.export_student_data(uuid) to authenticated;
grant execute on function public.anonymize_student(uuid) to authenticated;
grant execute on function public.process_privacy_request(uuid) to authenticated;

create or replace function public.run_retention_cleanup(p_apply boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submissions_years int := 3;
  v_progress_years    int := 3;
  v_audit_years       int := 5;
  v_financial_years   int := 7;
  v_now  timestamptz := now();
  v_sub_cut  timestamptz := v_now - make_interval(years => v_submissions_years);
  v_prog_cut timestamptz := v_now - make_interval(years => v_progress_years);
  v_aud_cut  timestamptz := v_now - make_interval(years => v_audit_years);
  v_fin_cut  timestamptz := v_now - make_interval(years => v_financial_years);
  v_submissions int; v_progress int; v_audit int; v_payments int; v_tutor_payments int;
  v_files int := 0;
begin
  if not (public.is_platform_admin() or auth.uid() is null) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select count(*) into v_submissions    from public.assignment_submissions where submitted_at < v_sub_cut;
  select count(*) into v_progress       from public.student_progress       where recorded_at  < v_prog_cut;
  select count(*) into v_audit          from public.audit_log              where created_at   < v_aud_cut;
  select count(*) into v_payments       from public.payments               where paid_at is not null and paid_at < v_fin_cut;
  select count(*) into v_tutor_payments from public.tutor_payments         where paid_at is not null and paid_at < v_fin_cut;

  if p_apply then
    begin
      delete from storage.objects o
       where o.bucket_id = 'assignment-submissions'
         and exists (
           select 1 from public.assignment_submissions s
           where s.submitted_at < v_sub_cut
             and (storage.foldername(o.name))[1] = s.student_id::text
             and (storage.foldername(o.name))[3] = s.id::text
         );
      get diagnostics v_files = row_count;
    exception when insufficient_privilege then v_files := -1;
    end;

    delete from public.assignment_submissions where submitted_at < v_sub_cut;
    delete from public.student_progress       where recorded_at  < v_prog_cut;
    delete from public.payments               where paid_at is not null and paid_at < v_fin_cut;
    delete from public.tutor_payments         where paid_at is not null and paid_at < v_fin_cut;
    delete from public.audit_log              where created_at   < v_aud_cut;

    perform public.log_audit_event('retention.cleanup_applied', 'system', null,
      jsonb_build_object('submissions', v_submissions, 'progress', v_progress,
                         'payments', v_payments, 'tutor_payments', v_tutor_payments,
                         'audit', v_audit, 'files', v_files));
  end if;

  return jsonb_build_object(
    'applied', p_apply,
    'as_of', v_now,
    'windows_years', jsonb_build_object('submissions', v_submissions_years, 'progress', v_progress_years,
                                        'audit', v_audit_years, 'financial', v_financial_years),
    'eligible', jsonb_build_object('submissions', v_submissions, 'progress', v_progress,
                                   'payments', v_payments, 'tutor_payments', v_tutor_payments, 'audit', v_audit),
    'files_removed', case when p_apply then v_files else null end
  );
end;
$$;

grant execute on function public.run_retention_cleanup(boolean) to authenticated;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'organization_type') then
    create type public.organization_type as enum ('direct', 'ngo', 'school', 'community');
  end if;
  if not exists (select 1 from pg_type where typname = 'org_member_role') then
    create type public.org_member_role as enum ('coordinator', 'tutor', 'student', 'parent', 'partner_viewer');
  end if;
end
$$;

create table if not exists public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  type          public.organization_type not null,
  contact_person text,
  contact_email text,
  contact_phone text,
  location      text,
  notes         text,
  status        public.record_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  org_role        public.org_member_role not null,
  status          public.record_status not null default 'active',
  created_at      timestamptz not null default now(),
  unique (organization_id, profile_id, org_role)
);

alter table public.students add column if not exists organization_id uuid references public.organizations(id);
alter table public.classes add column if not exists organization_id uuid references public.organizations(id);
alter table public.assignments add column if not exists organization_id uuid references public.organizations(id);

create index if not exists idx_organization_members_profile on public.organization_members(profile_id, status);
create index if not exists idx_organization_members_org_role on public.organization_members(organization_id, org_role);
create index if not exists idx_students_organization on public.students(organization_id);
create index if not exists idx_classes_organization on public.classes(organization_id);
create index if not exists idx_assignments_organization on public.assignments(organization_id);

insert into public.organizations (name, type, status)
select 'Project Odysseus — Direct', 'direct'::public.organization_type, 'active'::public.record_status
where not exists (select 1 from public.organizations where type = 'direct');

insert into public.organizations (
  id, name, type, contact_person, contact_email, contact_phone, location, notes, status, created_at
)
select
  np.id,
  np.name,
  'ngo'::public.organization_type,
  np.contact_person,
  np.contact_email,
  np.contact_phone,
  np.location,
  np.notes,
  'active'::public.record_status,
  np.created_at
from public.ngo_partners np
where not exists (select 1 from public.organizations o where o.id = np.id);

update public.students s
set organization_id = s.ngo_partner_id
where s.ngo_partner_id is not null
  and s.organization_id is distinct from s.ngo_partner_id;

update public.students s
set organization_id = (select o.id from public.organizations o where o.type = 'direct' limit 1)
where s.ngo_partner_id is null
  and s.organization_id is null;

update public.classes c
set organization_id = c.ngo_partner_id
where c.ngo_partner_id is not null
  and c.organization_id is distinct from c.ngo_partner_id;

update public.classes c
set organization_id = (select o.id from public.organizations o where o.type = 'direct' limit 1)
where c.ngo_partner_id is null
  and c.organization_id is null;

update public.assignments a
set organization_id = (select o.id from public.organizations o where o.type = 'direct' limit 1)
where a.organization_id is null;

insert into public.organization_members (organization_id, profile_id, org_role, status)
select distinct c.organization_id, t.profile_id, 'tutor'::public.org_member_role, 'active'::public.record_status
from public.classes c
join public.tutors t on t.id = c.tutor_id
where c.organization_id is not null
on conflict (organization_id, profile_id, org_role) do nothing;

insert into public.organization_members (organization_id, profile_id, org_role, status)
select distinct s.organization_id, t.profile_id, 'tutor'::public.org_member_role, 'active'::public.record_status
from public.tutor_student_allocations tsa
join public.tutors t on t.id = tsa.tutor_id
join public.students s on s.id = tsa.student_id
where tsa.status = 'active'
  and s.organization_id is not null
on conflict (organization_id, profile_id, org_role) do nothing;

create or replace function public.current_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select om.organization_id
  from public.organization_members om
  join public.profile_identities pi on pi.profile_id = om.profile_id
  where pi.auth_user_id = auth.uid()
    and om.status = 'active'
$$;

create or replace function public.current_student_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.organization_id
  from public.students s
  join public.profile_identities pi on pi.profile_id = s.profile_id
  where pi.auth_user_id = auth.uid()
$$;

create or replace function public.current_org_role(org uuid)
returns public.org_member_role
language sql
stable
security definer
set search_path = public
as $$
  select om.org_role
  from public.organization_members om
  join public.profile_identities pi on pi.profile_id = om.profile_id
  where pi.auth_user_id = auth.uid()
    and om.organization_id = org
    and om.status = 'active'
  order by case om.org_role when 'coordinator' then 0 else 1 end
  limit 1
$$;

create index if not exists idx_organization_members_profile_org_status
  on public.organization_members(profile_id, organization_id, status);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

drop policy if exists "organizations_select_member_or_admin" on public.organizations;
create policy "organizations_select_member_or_admin"
on public.organizations for select
using (
  public.is_platform_admin()
  or id in (select public.current_org_ids())
);

drop policy if exists "admin_manage_organizations" on public.organizations;
create policy "admin_manage_organizations"
on public.organizations for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "organization_members_select_scoped" on public.organization_members;
create policy "organization_members_select_scoped"
on public.organization_members for select
using (
  public.is_platform_admin()
  or profile_id = public.current_profile_id()
  or organization_id in (select public.current_org_ids())
);

drop policy if exists "organization_members_coordinator_manage" on public.organization_members;
create policy "organization_members_coordinator_manage"
on public.organization_members for all
using (
  public.is_platform_admin()
  or (
    public.current_org_role(organization_id) = 'coordinator'
    and org_role <> 'coordinator'
  )
)
with check (
  public.is_platform_admin()
  or (
    public.current_org_role(organization_id) = 'coordinator'
    and org_role <> 'coordinator'
  )
);

drop policy if exists "admin_manage_organization_members" on public.organization_members;
create policy "admin_manage_organization_members"
on public.organization_members for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "students_coordinator_org_manage" on public.students;
drop policy if exists "students_coordinator_org_select" on public.students;
create policy "students_coordinator_org_select"
on public.students for select
using (
  public.is_platform_admin()
  or public.current_org_role(organization_id) = 'coordinator'
);

drop policy if exists "students_coordinator_org_insert" on public.students;
create policy "students_coordinator_org_insert"
on public.students for insert
with check (
  public.is_platform_admin()
  or public.current_org_role(organization_id) = 'coordinator'
);

drop policy if exists "students_coordinator_org_update" on public.students;
create policy "students_coordinator_org_update"
on public.students for update
using (
  public.is_platform_admin()
  or public.current_org_role(organization_id) = 'coordinator'
)
with check (
  public.is_platform_admin()
  or public.current_org_role(organization_id) = 'coordinator'
);

drop policy if exists "classes_org_scoped_read" on public.classes;
create policy "classes_org_scoped_read"
on public.classes for select
using (
  public.is_platform_admin()
  or organization_id in (select public.current_org_ids())
);

drop policy if exists "classes_coordinator_manage" on public.classes;
create policy "classes_coordinator_manage"
on public.classes for all
using (
  public.is_platform_admin()
  or public.current_org_role(organization_id) = 'coordinator'
)
with check (
  public.is_platform_admin()
  or public.current_org_role(organization_id) = 'coordinator'
);

drop policy if exists "assignments_org_scoped_read" on public.assignments;
create policy "assignments_org_scoped_read"
on public.assignments for select
using (
  public.is_platform_admin()
  or organization_id in (select public.current_org_ids())
);

drop policy if exists "assignments_coordinator_manage" on public.assignments;
create policy "assignments_coordinator_manage"
on public.assignments for all
using (
  public.is_platform_admin()
  or public.current_org_role(organization_id) = 'coordinator'
)
with check (
  public.is_platform_admin()
  or public.current_org_role(organization_id) = 'coordinator'
);

create or replace function public.get_org_cohort_report(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min_cohort_size constant int := 5;
  v_learner_count int;
  v_avg_progress_score numeric;
  v_submission_count int;
  v_marked_submission_count int;
  v_progress_distribution jsonb;
begin
  if not exists (
    select 1
    from public.organization_members om
    join public.profiles p on p.id = om.profile_id
    where p.auth_user_id = auth.uid()
      and om.organization_id = p_org_id
      and om.org_role = 'partner_viewer'
      and om.status = 'active'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select count(*) into v_learner_count
  from public.students s
  where s.organization_id = p_org_id;

  if v_learner_count < v_min_cohort_size then
    return jsonb_build_object(
      'organization_id', p_org_id,
      'learner_count', v_learner_count,
      'suppressed', true,
      'suppression_reason', format('cohort below minimum reporting size (fewer than %s learners)', v_min_cohort_size)
    );
  end if;

  select avg(sp.score) into v_avg_progress_score
  from public.student_progress sp
  join public.students s on s.id = sp.student_id
  where s.organization_id = p_org_id;

  select count(*) into v_submission_count
  from public.assignment_submissions sub
  join public.students s on s.id = sub.student_id
  where s.organization_id = p_org_id;

  select count(*) into v_marked_submission_count
  from public.assignment_submissions sub
  join public.students s on s.id = sub.student_id
  where s.organization_id = p_org_id
    and sub.status = 'marked';

  select coalesce(jsonb_agg(jsonb_build_object('cognitive_level', bucket.cognitive_level, 'count', bucket.learner_count)), '[]'::jsonb)
  into v_progress_distribution
  from (
    select sp.cognitive_level, count(*) as learner_count
    from public.student_progress sp
    join public.students s on s.id = sp.student_id
    where s.organization_id = p_org_id
    group by sp.cognitive_level
  ) bucket;

  return jsonb_build_object(
    'organization_id', p_org_id,
    'learner_count', v_learner_count,
    'suppressed', false,
    'average_progress_score', round(coalesce(v_avg_progress_score, 0), 2),
    'submission_count', v_submission_count,
    'marked_submission_count', v_marked_submission_count,
    'progress_distribution_by_cognitive_level', v_progress_distribution
  );
end;
$$;

grant execute on function public.get_org_cohort_report(uuid) to authenticated;

create or replace function public.fill_organization_id()
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

  if tg_table_name in ('students', 'classes') then
    if new.ngo_partner_id is not null then
      new.organization_id := new.ngo_partner_id;
      return new;
    end if;
  end if;

  select om.organization_id into v_org
  from public.organization_members om
  join public.profiles p on p.id = om.profile_id
  where p.auth_user_id = auth.uid()
    and om.status = 'active'
  limit 1;

  if v_org is not null then
    new.organization_id := v_org;
    return new;
  end if;

  select id into v_org
  from public.organizations
  where type = 'direct'
  limit 1;

  new.organization_id := v_org;
  return new;
end;
$$;;
