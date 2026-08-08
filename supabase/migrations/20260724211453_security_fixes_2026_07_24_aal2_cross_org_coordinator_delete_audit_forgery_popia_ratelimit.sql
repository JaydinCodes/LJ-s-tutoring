-- === is_platform_admin (from line 530) ===
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() = 'admin'
    and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

-- === can_mark_submission (from line 577) ===
create or replace function public.can_mark_submission(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_platform_admin()
    or exists (
      select 1
      from public.assignment_submissions sub
      join public.assignments a on a.id = sub.assignment_id
      where sub.id = p_submission_id
        and a.created_by = public.current_profile_id()
        and public.current_profile_role() = 'tutor'
    ),
    false
  )
$$;

-- === record_audit_event (from line 643) ===
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

  -- Security fix (2026-07-24): this used to trust p_entity_id as-is, letting
  -- any tutor forge an assignment.* audit entry for an assignment they don't
  -- own (arbitrary free-text id, never checked against the actual row).
  if v_role = 'tutor'
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

-- === submit_assignment_submission (final, from line 2715) ===
create or replace function public.submit_assignment_submission(
  p_assignment_id uuid,
  p_submission_id uuid,
  p_storage_key text,
  p_file_url text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint,
  p_text_answer text
)
returns table (submission_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := public.current_student_id();
  v_assignment public.assignments%rowtype;
  v_submission_id uuid := coalesce(p_submission_id, gen_random_uuid());
  v_next_version integer;
  v_text_answer text := nullif(btrim(coalesce(p_text_answer, '')), '');
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then
    raise exception 'only_students_can_submit' using errcode = '42501';
  end if;

  select * into v_assignment
  from public.assignments
  where id = p_assignment_id;

  if not found then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;

  -- Security fix (2026-07-24): the read-side policy
  -- "assignments_student_read_published_own_org" requires published + own
  -- org (section 7.4), but this write path never got the same org check
  -- when that fix landed -- any student could submit to any other
  -- organization's assignment by guessing/knowing its id. Same error as the
  -- unpublished case so cross-org existence isn't disclosed via a distinct
  -- message.
  if v_assignment.status <> 'published' or v_assignment.organization_id <> public.current_student_org_id() then
    raise exception 'assignment_not_open_for_submission' using errcode = '42501';
  end if;

  if v_text_answer is null and nullif(p_storage_key, '') is null then
    raise exception 'submission_content_required' using errcode = '23514';
  end if;

  if nullif(p_storage_key, '') is not null and p_storage_key !~ ('^' || v_student_id::text || '/' || p_assignment_id::text || '/' || v_submission_id::text || '/submission\.[A-Za-z0-9]+$') then
    raise exception 'invalid_submission_storage_path' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_assignment_id::text || ':' || v_student_id::text));

  select coalesce(max(version_number), 0) + 1
  into v_next_version
  from public.assignment_submissions
  where assignment_id = p_assignment_id
    and student_id = v_student_id;

  update public.assignment_submissions
  set is_latest = false
  where assignment_id = p_assignment_id
    and student_id = v_student_id
    and is_latest = true;

  insert into public.assignment_submissions (
    id,
    assignment_id,
    student_id,
    storage_key,
    file_url,
    original_filename,
    mime_type,
    size_bytes,
    text_answer,
    submitted_at,
    status,
    version_number,
    is_latest,
    marks_awarded,
    feedback
  )
  values (
    v_submission_id,
    p_assignment_id,
    v_student_id,
    nullif(p_storage_key, ''),
    nullif(p_file_url, ''),
    nullif(p_original_filename, ''),
    nullif(p_mime_type, ''),
    p_size_bytes,
    v_text_answer,
    now(),
    'submitted',
    v_next_version,
    true,
    null,
    null
  );

  perform public.log_audit_event(
    'assignment_submission.created',
    'assignment_submission',
    v_submission_id::text,
    jsonb_build_object(
      'assignment_id', p_assignment_id,
      'student_id', v_student_id,
      'version_number', v_next_version,
      'file_uploaded', nullif(p_storage_key, '') is not null,
      'text_answer_provided', v_text_answer is not null
    )
  );

  if v_next_version > 1 and nullif(p_storage_key, '') is not null then
    perform public.log_audit_event(
      'assignment_submission.file_replaced',
      'assignment_submission',
      v_submission_id::text,
      jsonb_build_object(
        'assignment_id', p_assignment_id,
        'student_id', v_student_id,
        'version_number', v_next_version
      )
    );
  end if;

  return query select v_submission_id;
end;
$$;

-- === export_student_data (from line 1678) ===
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

-- === anonymize_student (from line 1728) ===
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

  -- Financial records carry a statutory retention hold: keep the rows, strip identity.
  select exists(select 1 from public.payments where student_id = p_student_id)
    into v_has_financial;
  v_mode := case when v_has_financial then 'anonymized_financial_hold' else 'anonymized' end;

  -- Remove self-service / free-text personal content.
  delete from public.student_career_profiles where student_id = p_student_id;

  -- Remove uploaded submission files from Storage (scoped to the learner's folder).
  -- Wrapped so a storage-privilege error reports rather than aborting the erasure;
  -- -1 signals "remove via the service-role storage client as a follow-up".
  begin
    delete from storage.objects
     where bucket_id = 'assignment-submissions'
       and (storage.foldername(name))[1] = p_student_id::text;
    get diagnostics v_files_removed = row_count;
  exception
    when insufficient_privilege then v_files_removed := -1;
  end;

  -- Remove identifiable academic records.
  delete from public.assignment_submissions where student_id = p_student_id;
  get diagnostics v_submissions_removed = row_count;
  delete from public.student_progress where student_id = p_student_id;

  -- Security/POPIA fix (2026-07-24): this function was written before these
  -- tables existed and was never extended as the schema grew, so an erasure
  -- request left real PII behind. weekly_reports in particular bakes the
  -- student's name and grade into a stored JSON payload as literal text at
  -- generation time (generate_weekly_report()) -- that copy survives the
  -- full_name redaction below untouched unless the row itself is removed.
  -- The rest are identifiable academic/notification/analytics records in the
  -- same category as assignment_submissions/student_progress above.
  delete from public.weekly_reports where student_id = p_student_id;
  delete from public.student_notifications where student_id = p_student_id;
  delete from public.baseline_assessments where student_id = p_student_id;
  delete from public.learning_goals where student_id = p_student_id;
  delete from public.student_exam_events where student_id = p_student_id;
  delete from public.student_score_snapshots where student_id = p_student_id;
  delete from public.career_progress_snapshots where student_id = p_student_id;

  -- sessions rows are kept (not deleted) -- they're needed for payroll
  -- reconciliation via invoice_lines.session_id, same statutory-hold
  -- reasoning as payments below -- but the free-text fields are exactly the
  -- kind of identifiable "tutor case notes about the learner" an erasure
  -- request should remove. session_history is left untouched: it's an
  -- append-only audit trail (admin-only, mirrors audit_log's immutability),
  -- which is legitimately exempt from anonymization the same way audit_log
  -- itself is, below.
  update public.sessions
     set notes = null,
         topics_covered = null,
         learner_struggles = null,
         homework_assigned = null,
         tutor_private_notes = null,
         student_summary = null,
         report_review_note = null
   where student_id = p_student_id;

  -- Detach guardians; delete guardian rows no longer linked to anyone and not
  -- themselves platform users.
  delete from public.student_guardians where student_id = p_student_id;
  delete from public.guardians g
   where g.profile_id is null
     and not exists (select 1 from public.student_guardians sg where sg.guardian_id = g.id);

  -- Strip inline PII on the learner row.
  update public.students
     set parent_name = null,
         parent_contact = null,
         school = null,
         status = 'inactive'
   where id = p_student_id;

  -- Strip identity on the profile (email is unique/not-null → unique placeholder).
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

-- === process_privacy_request (from line 1848) ===
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
    -- correction is applied via normal admin UPDATEs; just record acknowledgement.
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

-- === run_retention_cleanup (from line 1916) ===
create or replace function public.run_retention_cleanup(p_apply boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submissions_years int := 3;   -- academic submissions + uploaded files
  v_progress_years    int := 3;   -- per-concept score history
  v_audit_years       int := 5;   -- audit trail (compliance)
  v_financial_years   int := 7;   -- settled payments (tax/financial retention)
  v_now  timestamptz := now();
  v_sub_cut  timestamptz := v_now - make_interval(years => v_submissions_years);
  v_prog_cut timestamptz := v_now - make_interval(years => v_progress_years);
  v_aud_cut  timestamptz := v_now - make_interval(years => v_audit_years);
  v_fin_cut  timestamptz := v_now - make_interval(years => v_financial_years);
  v_submissions int; v_progress int; v_audit int; v_payments int; v_tutor_payments int;
  v_files int := 0;
begin
  -- Allow admins (manual runs) and trusted server contexts with no browser JWT
  -- (pg_cron / service_role / scheduled Edge Function), where auth.uid() is null.
  -- Regular signed-in non-admins are blocked; anon has no EXECUTE grant at all.
  if not (public.is_platform_admin() or auth.uid() is null) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select count(*) into v_submissions    from public.assignment_submissions where submitted_at < v_sub_cut;
  select count(*) into v_progress       from public.student_progress       where recorded_at  < v_prog_cut;
  select count(*) into v_audit          from public.audit_log              where created_at   < v_aud_cut;
  select count(*) into v_payments       from public.payments               where paid_at is not null and paid_at < v_fin_cut;
  select count(*) into v_tutor_payments from public.tutor_payments         where paid_at is not null and paid_at < v_fin_cut;

  if p_apply then
    -- Remove submission files from Storage first (path: student/assignment/submission/file).
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

-- policy: profiles_select_self_or_admin
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles for select
using (auth_user_id = auth.uid() or public.is_platform_admin());

-- policy: admin_full_access_profiles
drop policy if exists "admin_full_access_profiles" on public.profiles;
create policy "admin_full_access_profiles"
on public.profiles for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- policy: admin_select_audit_log
drop policy if exists "admin_select_audit_log" on public.audit_log;
create policy "admin_select_audit_log"
on public.audit_log for select
using (public.is_platform_admin());

-- policy: students_select_self_or_admin
drop policy if exists "students_select_self_or_admin" on public.students;
create policy "students_select_self_or_admin"
on public.students for select
using (
  public.is_platform_admin()
  or profile_id = public.current_profile_id()
  or id in (
    select tsa.student_id
    from public.tutor_student_allocations tsa
    where tsa.tutor_id = public.current_tutor_id()
      and tsa.status = 'active'
  )
);

-- policy: admin_full_access_students
drop policy if exists "admin_full_access_students" on public.students;
create policy "admin_full_access_students"
on public.students for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- policy: guardians_select_scoped
drop policy if exists "guardians_select_scoped" on public.guardians;
create policy "guardians_select_scoped"
on public.guardians for select
using (
  public.is_platform_admin()
  or profile_id = public.current_profile_id()
);

-- policy: admin_manage_guardians
drop policy if exists "admin_manage_guardians" on public.guardians;
create policy "admin_manage_guardians"
on public.guardians for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- policy: student_guardians_select_scoped
drop policy if exists "student_guardians_select_scoped" on public.student_guardians;
create policy "student_guardians_select_scoped"
on public.student_guardians for select
using (
  public.is_platform_admin()
  or guardian_id in (
    select g.id
    from public.guardians g
    where g.profile_id = public.current_profile_id()
  )
);

-- policy: admin_manage_student_guardians
drop policy if exists "admin_manage_student_guardians" on public.student_guardians;
create policy "admin_manage_student_guardians"
on public.student_guardians for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- policy: tutors_select_self_or_admin
drop policy if exists "tutors_select_self_or_admin" on public.tutors;
create policy "tutors_select_self_or_admin"
on public.tutors for select
using (
  public.is_platform_admin()
  or profile_id = public.current_profile_id()
  or id in (
    select tsa.tutor_id
    from public.tutor_student_allocations tsa
    where tsa.student_id = public.current_student_id()
      and tsa.status = 'active'
  )
);

-- policy: admin_full_access_tutors
drop policy if exists "admin_full_access_tutors" on public.tutors;
create policy "admin_full_access_tutors"
on public.tutors for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- policy: admin_manage_subjects
drop policy if exists "admin_manage_subjects" on public.subjects;
create policy "admin_manage_subjects"
on public.subjects for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- policy: admin_manage_assignments
drop policy if exists "admin_manage_assignments" on public.assignments;
create policy "admin_manage_assignments"
on public.assignments for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- policy: submissions_student_self_or_admin
drop policy if exists "submissions_student_self_or_admin" on public.assignment_submissions;
create policy "submissions_student_self_or_admin"
on public.assignment_submissions for select
using (
  public.is_platform_admin()
);

-- policy: admin_manage_submissions
drop policy if exists "admin_manage_submissions" on public.assignment_submissions;
create policy "admin_manage_submissions"
on public.assignment_submissions for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- policy: student_progress_self_or_admin
drop policy if exists "student_progress_self_or_admin" on public.student_progress;
create policy "student_progress_self_or_admin"
on public.student_progress for select
using (
  public.is_platform_admin()
  or student_id = public.current_student_id()
);

-- policy: admin_manage_progress
drop policy if exists "admin_manage_progress" on public.student_progress;
create policy "admin_manage_progress"
on public.student_progress for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- policy: admin_finance_access
drop policy if exists "admin_finance_access" on public.payments;
create policy "admin_finance_access"
on public.payments for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- policy: admin_tutor_payment_access
drop policy if exists "admin_tutor_payment_access" on public.tutor_payments;
create policy "admin_tutor_payment_access"
on public.tutor_payments for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- policy: classes_select_scoped
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

-- policy: admin_manage_classes
drop policy if exists "admin_manage_classes" on public.classes;
create policy "admin_manage_classes"
on public.classes for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- policy: class_enrollments_select_scoped
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

-- policy: admin_manage_class_enrollments
drop policy if exists "admin_manage_class_enrollments" on public.class_enrollments;
create policy "admin_manage_class_enrollments"
on public.class_enrollments for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- policy: tutor_student_allocations_select_scoped
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

-- policy: admin_manage_tutor_student_allocations
drop policy if exists "admin_manage_tutor_student_allocations" on public.tutor_student_allocations;
create policy "admin_manage_tutor_student_allocations"
on public.tutor_student_allocations for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- policy: admin_tutor_upload_assignment_files
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

-- policy: authenticated_read_assignment_files
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
          and a.organization_id = public.current_student_org_id()
      )
    )
  )
);

-- policy: students_upload_own_submission_files
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
      and a.organization_id = public.current_student_org_id()
  )
);

-- policy: students_update_own_submission_files
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
      and a.organization_id = public.current_student_org_id()
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
      and a.organization_id = public.current_student_org_id()
  )
);

-- policy: students_read_own_submission_files_or_admin
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

-- policy: privacy_requests_admin_all
drop policy if exists "privacy_requests_admin_all" on public.privacy_requests;
create policy "privacy_requests_admin_all"
on public.privacy_requests for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- policy: tutors_read_own_tutor_documents_or_admin
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

-- Coordinator policy split (replaces students_coordinator_org_manage)
drop policy if exists "students_coordinator_org_manage" on public.students;
drop policy if exists "students_coordinator_org_select" on public.students;
drop policy if exists "students_coordinator_org_insert" on public.students;
drop policy if exists "students_coordinator_org_update" on public.students;

create policy "students_coordinator_org_select"
on public.students for select
using (
  public.is_platform_admin()
  or public.current_org_role(organization_id) = 'coordinator'
);

create policy "students_coordinator_org_insert"
on public.students for insert
with check (
  public.is_platform_admin()
  or public.current_org_role(organization_id) = 'coordinator'
);

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

create table if not exists public.edge_function_rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null,
  function_name text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_edge_function_rate_limit_events_lookup
  on public.edge_function_rate_limit_events(function_name, subject_id, created_at desc);
alter table public.edge_function_rate_limit_events enable row level security;
;
