-- PRIV-01: trusted, resumable learner privacy deletion workflow.
--
-- Cross-service deletion (Postgres + Auth + Storage) cannot be one ACID
-- transaction. This migration implements a fail-closed saga:
--   queued -> locked -> auth_banned -> storage_deleted -> db_erased
--          -> auth_deleted -> completed
-- A request is only marked approved after the final completion stage.

-- ---------------------------------------------------------------------------
-- 1. Fail closed: browser callers must never run the old deletion primitive.
-- ---------------------------------------------------------------------------
revoke all on function public.anonymize_student(uuid)
from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Profiles must survive Auth deletion when retained financial/session rows
--    still reference the learner through public.students.
-- ---------------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_auth_user_id_fkey;

alter table public.profiles
  alter column auth_user_id drop not null;

alter table public.profiles
  add constraint profiles_auth_user_id_fkey
  foreign key (auth_user_id)
  references auth.users(id)
  on delete set null;

-- The identity shadow trigger must tolerate an erased/detached Auth identity.
create or replace function public.sync_profile_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.profile_identities
    where profile_id = old.id;
    return old;
  end if;

  if new.auth_user_id is null then
    delete from public.profile_identities
    where profile_id = new.id;
    return new;
  end if;

  insert into public.profile_identities (auth_user_id, profile_id, role)
  values (new.auth_user_id, new.id, new.role)
  on conflict (auth_user_id) do update set
    profile_id = excluded.profile_id,
    role = excluded.role;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Privacy workflow state. subject_auth_user_id is deliberately transient:
--    it exists only while the workflow is incomplete and is nulled at finish.
-- ---------------------------------------------------------------------------
alter table public.privacy_requests
  add column if not exists processing_state text not null default 'queued',
  add column if not exists processing_subject_auth_user_id uuid,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_completed_at timestamptz,
  add column if not exists storage_files_removed integer not null default 0,
  add column if not exists last_error text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'privacy_requests_processing_state_check'
  ) then
    alter table public.privacy_requests
      add constraint privacy_requests_processing_state_check
      check (
        processing_state in (
          'queued',
          'locked',
          'auth_banned',
          'storage_deleted',
          'db_erased',
          'auth_deleted',
          'completed'
        )
      );
  end if;
end
$$;

-- Existing access/correction requests that were genuinely finished can remain
-- complete. Historical deletion requests must be reopened because the old flow
-- marked them approved before Auth/Storage completion was guaranteed.
update public.privacy_requests
set processing_state = 'completed',
    processing_completed_at = coalesce(processing_completed_at, updated_at)
where status = 'approved'
  and request_type <> 'deletion';

update public.privacy_requests
set status = 'pending',
    processing_state = 'queued',
    processing_completed_at = null,
    result = jsonb_build_object('legacy_reprocessing_required', true),
    last_error = null
where request_type = 'deletion'
  and status = 'approved';

-- ---------------------------------------------------------------------------
-- 4. PII-free immutable compliance receipt.
-- ---------------------------------------------------------------------------
create table if not exists public.privacy_deletion_receipts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique
    references public.privacy_requests(id) on delete restrict,
  manifest_version text not null,
  financial_hold boolean not null,
  storage_files_removed integer not null default 0,
  db_erasure_counts jsonb not null default '{}'::jsonb,
  auth_account_deleted boolean not null,
  completed_at timestamptz not null default now(),
  constraint privacy_deletion_receipts_auth_deleted_check
    check (auth_account_deleted = true),
  constraint privacy_deletion_receipts_counts_object_check
    check (jsonb_typeof(db_erasure_counts) = 'object')
);

alter table public.privacy_deletion_receipts enable row level security;

drop policy if exists "privacy_deletion_receipts_admin_select"
  on public.privacy_deletion_receipts;
create policy "privacy_deletion_receipts_admin_select"
on public.privacy_deletion_receipts
for select
to authenticated
using (public.is_platform_admin());

revoke all on table public.privacy_deletion_receipts
from public, anon, authenticated;
grant select on table public.privacy_deletion_receipts to authenticated;

create or replace function public.prevent_privacy_deletion_receipt_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'privacy_deletion_receipt_is_immutable'
    using errcode = '42501';
end;
$$;

drop trigger if exists trg_privacy_deletion_receipts_immutable
  on public.privacy_deletion_receipts;
create trigger trg_privacy_deletion_receipts_immutable
before update or delete on public.privacy_deletion_receipts
for each row execute function public.prevent_privacy_deletion_receipt_mutation();

-- ---------------------------------------------------------------------------
-- 5. Stage 1: lock the subject out of application authorization immediately.
--    This neutralizes already-issued JWTs at the database authorization layer
--    while the Edge Function coordinates Auth and Storage.
-- ---------------------------------------------------------------------------
create or replace function public.begin_student_privacy_deletion(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.privacy_requests%rowtype;
  v_profile_id uuid;
  v_auth_user_id uuid;
  v_has_financial boolean;
begin
  select *
  into v_req
  from public.privacy_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'privacy_request_not_found' using errcode = 'P0002';
  end if;

  if v_req.request_type <> 'deletion' then
    raise exception 'privacy_request_is_not_deletion' using errcode = '23514';
  end if;

  if v_req.processing_state = 'completed' then
    return jsonb_build_object(
      'already_completed', true,
      'processing_state', 'completed'
    );
  end if;

  if v_req.subject_student_id is null then
    raise exception 'privacy_request_subject_required' using errcode = '23514';
  end if;

  select s.profile_id
  into v_profile_id
  from public.students s
  where s.id = v_req.subject_student_id;

  if v_profile_id is null then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;

  select p.auth_user_id
  into v_auth_user_id
  from public.profiles p
  where p.id = v_profile_id;

  v_auth_user_id := coalesce(
    v_req.processing_subject_auth_user_id,
    v_auth_user_id
  );

  -- Operational authorization fails closed before any external API call.
  update public.students
  set status = 'inactive'
  where id = v_req.subject_student_id;

  delete from public.profile_identities
  where profile_id = v_profile_id;

  select exists (
    select 1
    from public.payments pay
    where pay.student_id = v_req.subject_student_id
  )
  into v_has_financial;

  update public.privacy_requests
  set subject_profile_id = coalesce(subject_profile_id, v_profile_id),
      processing_subject_auth_user_id = coalesce(
        processing_subject_auth_user_id,
        v_auth_user_id
      ),
      processing_state = case
        when processing_state = 'queued' then 'locked'
        else processing_state
      end,
      processing_started_at = coalesce(processing_started_at, now()),
      last_error = null,
      updated_at = now()
  where id = p_request_id;

  perform public.log_audit_event(
    'privacy.deletion_locked',
    'privacy_request',
    p_request_id::text,
    jsonb_build_object('stage', 'locked')
  );

  return jsonb_build_object(
    'already_completed', false,
    'request_id', p_request_id,
    'student_id', v_req.subject_student_id,
    'profile_id', v_profile_id,
    'auth_user_id', v_auth_user_id,
    'financial_hold', v_has_financial,
    'processing_state', (
      select pr.processing_state
      from public.privacy_requests pr
      where pr.id = p_request_id
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Read-only Storage manifest. Deletion itself MUST happen through Storage
--    API remove(), never by deleting storage.objects rows in SQL.
--
--    Include both known learner submission paths and any object owned by the
--    target Auth user, which also catches future buckets using normal ownership.
-- ---------------------------------------------------------------------------
create or replace function public.get_student_privacy_storage_manifest(
  p_request_id uuid
)
returns table(bucket_id text, object_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_auth_user_id uuid;
begin
  select pr.subject_student_id, pr.processing_subject_auth_user_id
  into v_student_id, v_auth_user_id
  from public.privacy_requests pr
  where pr.id = p_request_id
    and pr.request_type = 'deletion';

  if v_student_id is null then
    raise exception 'privacy_request_subject_required' using errcode = '23514';
  end if;

  return query
  select distinct o.bucket_id::text, o.name::text
  from storage.objects o
  where (
      v_auth_user_id is not null
      and o.owner_id = v_auth_user_id::text
    )
    or (
      o.bucket_id = 'assignment-submissions'
      and (storage.foldername(o.name))[1] = v_student_id::text
    )
  order by 1, 2;
end;
$$;

create or replace function public.mark_student_privacy_auth_banned(
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state text;
begin
  select processing_state
  into v_state
  from public.privacy_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'privacy_request_not_found' using errcode = 'P0002';
  end if;

  if v_state not in ('locked', 'auth_banned') then
    raise exception 'invalid_privacy_deletion_stage:%', v_state
      using errcode = '23514';
  end if;

  update public.privacy_requests
  set processing_state = 'auth_banned',
      last_error = null,
      updated_at = now()
  where id = p_request_id;
end;
$$;

create or replace function public.mark_student_privacy_storage_deleted(
  p_request_id uuid,
  p_files_removed integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state text;
begin
  if p_files_removed < 0 then
    raise exception 'invalid_storage_files_removed' using errcode = '23514';
  end if;

  select processing_state
  into v_state
  from public.privacy_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'privacy_request_not_found' using errcode = 'P0002';
  end if;

  if v_state not in ('auth_banned', 'storage_deleted') then
    raise exception 'invalid_privacy_deletion_stage:%', v_state
      using errcode = '23514';
  end if;

  update public.privacy_requests
  set processing_state = 'storage_deleted',
      storage_files_removed = greatest(storage_files_removed, p_files_removed),
      last_error = null,
      updated_at = now()
  where id = p_request_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Application-data erasure/anonymization manifest.
-- ---------------------------------------------------------------------------
create or replace function public.erase_student_privacy_data(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.privacy_requests%rowtype;
  v_student_id uuid;
  v_profile_id uuid;
  v_auth_user_id uuid;
  v_financial_hold boolean;
  v_count integer;
  v_counts jsonb := '{}'::jsonb;
  v_snapshot_keys text[] := array[
    'location',
    'notes',
    'topics_covered',
    'learner_struggles',
    'homework_assigned',
    'tutor_private_notes',
    'student_summary',
    'report_review_note',
    'sync_key'
  ]::text[];
begin
  select *
  into v_req
  from public.privacy_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'privacy_request_not_found' using errcode = 'P0002';
  end if;

  if v_req.request_type <> 'deletion' then
    raise exception 'privacy_request_is_not_deletion' using errcode = '23514';
  end if;

  if v_req.processing_state = 'db_erased' then
    return coalesce(v_req.result -> 'db_erasure_counts', '{}'::jsonb);
  end if;

  if v_req.processing_state <> 'storage_deleted' then
    raise exception 'invalid_privacy_deletion_stage:%', v_req.processing_state
      using errcode = '23514';
  end if;

  v_student_id := v_req.subject_student_id;
  v_profile_id := v_req.subject_profile_id;
  v_auth_user_id := v_req.processing_subject_auth_user_id;

  if v_student_id is null or v_profile_id is null then
    raise exception 'privacy_request_subject_required' using errcode = '23514';
  end if;

  select exists (
    select 1 from public.payments p where p.student_id = v_student_id
  ) into v_financial_hold;

  delete from public.student_career_profiles where student_id = v_student_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('student_career_profiles_deleted', v_count);

  delete from public.assignment_submissions where student_id = v_student_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('assignment_submissions_deleted', v_count);

  delete from public.student_progress where student_id = v_student_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('student_progress_deleted', v_count);

  delete from public.weekly_reports where student_id = v_student_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('weekly_reports_deleted', v_count);

  delete from public.student_notifications where student_id = v_student_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('student_notifications_deleted', v_count);

  delete from public.baseline_assessments where student_id = v_student_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('baseline_assessments_deleted', v_count);

  delete from public.learning_goals where student_id = v_student_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('learning_goals_deleted', v_count);

  delete from public.student_exam_events where student_id = v_student_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('student_exam_events_deleted', v_count);

  delete from public.student_score_snapshots where student_id = v_student_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('student_score_snapshots_deleted', v_count);

  delete from public.career_progress_snapshots where student_id = v_student_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('career_progress_snapshots_deleted', v_count);

  delete from public.class_enrollments where student_id = v_student_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('class_enrollments_deleted', v_count);

  -- Retain allocation rows referenced by sessions, but strip learner-specific
  -- free text/config and make them non-operational.
  update public.tutor_student_allocations
  set status = 'inactive',
      focus_notes = null,
      allowed_days_json = null,
      allowed_time_ranges_json = null,
      updated_at = now()
  where student_id = v_student_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('allocations_anonymized', v_count);

  -- Retained statutory/financial rows keep only non-free-text accounting data.
  update public.payments
  set notes = null
  where student_id = v_student_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('payments_anonymized', v_count);

  update public.sessions
  set location = null,
      notes = null,
      topics_covered = null,
      learner_struggles = null,
      homework_assigned = null,
      tutor_private_notes = null,
      student_summary = null,
      report_review_note = null,
      sync_key = null
  where student_id = v_student_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('sessions_anonymized', v_count);

  -- Historical snapshots can otherwise resurrect the free text removed above.
  update public.session_history h
  set before_json = case
        when h.before_json is null then null
        else h.before_json - v_snapshot_keys
      end,
      after_json = case
        when h.after_json is null then null
        else h.after_json - v_snapshot_keys
      end
  where exists (
    select 1
    from public.sessions s
    where s.id = h.session_id
      and s.student_id = v_student_id
  );
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('session_history_anonymized', v_count);

  -- Guardians are detached; orphan non-platform guardian records are removed.
  delete from public.student_guardians where student_id = v_student_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('student_guardian_links_deleted', v_count);

  delete from public.guardians g
  where g.profile_id is null
    and not exists (
      select 1
      from public.student_guardians sg
      where sg.guardian_id = g.id
    );
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('orphan_guardians_deleted', v_count);

  -- Newer community product domains.
  delete from public.community_room_members where profile_id = v_profile_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('community_memberships_deleted', v_count);

  delete from public.community_room_messages where profile_id = v_profile_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('community_messages_deleted', v_count);

  delete from public.community_challenge_submissions where profile_id = v_profile_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('community_challenge_submissions_deleted', v_count);

  delete from public.community_answers where profile_id = v_profile_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('community_answers_deleted', v_count);

  -- Preserve other users' answers to a learner-authored question while removing
  -- the learner's authored free text.
  update public.community_questions
  set title = '[removed]',
      body = '[removed by privacy deletion]',
      moderation_flags = '[]'::jsonb
  where profile_id = v_profile_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('community_questions_anonymized', v_count);

  delete from public.organization_members where profile_id = v_profile_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('organization_memberships_deleted', v_count);

  -- Historical privacy exports/results can themselves contain complete PII.
  update public.privacy_requests
  set subject_student_id = null,
      subject_profile_id = null,
      notes = null,
      result = jsonb_build_object('redacted_by_deletion', true),
      updated_at = now()
  where id <> p_request_id
    and (
      subject_student_id = v_student_id
      or subject_profile_id = v_profile_id
    );
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('historical_privacy_requests_redacted', v_count);

  update public.privacy_requests
  set notes = null
  where id = p_request_id;

  -- Audit rows remain as non-PII compliance/security evidence. Strip identifiers
  -- and metadata from entries attributable to or explicitly referencing subject.
  update public.audit_log a
  set actor_user_id = case
        when a.actor_user_id = v_auth_user_id then null
        else a.actor_user_id
      end,
      entity_id = case
        when a.entity_id in (
          v_student_id::text,
          v_profile_id::text,
          coalesce(v_auth_user_id::text, '')
        ) then null
        else a.entity_id
      end,
      metadata = '{}'::jsonb
  where a.actor_user_id = v_auth_user_id
     or a.entity_id in (
       v_student_id::text,
       v_profile_id::text,
       coalesce(v_auth_user_id::text, '')
     )
     or a.metadata @> jsonb_build_object('student_id', v_student_id)
     or a.metadata @> jsonb_build_object('profile_id', v_profile_id)
     or a.metadata @> jsonb_build_object('subject_profile_id', v_profile_id)
     or (
       v_auth_user_id is not null
       and a.metadata @> jsonb_build_object('auth_user_id', v_auth_user_id)
     );
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('audit_rows_anonymized', v_count);

  -- Core learner PII.
  update public.students
  set grade = null,
      school = null,
      parent_name = null,
      parent_contact = null,
      ngo_partner_id = null,
      status = 'inactive'
  where id = v_student_id;

  -- Production has carried legacy student PII columns not present in every
  -- clean schema. Clear them when present without making this migration depend
  -- on those drift-only columns.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'full_name'
  ) then
    execute 'update public.students set full_name = null where id = $1'
      using v_student_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'guardian_name'
  ) then
    execute 'update public.students set guardian_name = null where id = $1'
      using v_student_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'guardian_phone'
  ) then
    execute 'update public.students set guardian_phone = null where id = $1'
      using v_student_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'guardian_relationship'
  ) then
    execute 'update public.students set guardian_relationship = null where id = $1'
      using v_student_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'guardian_email'
  ) then
    execute 'update public.students set guardian_email = null where id = $1'
      using v_student_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'guardian_address'
  ) then
    execute 'update public.students set guardian_address = null where id = $1'
      using v_student_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'notes'
  ) then
    execute 'update public.students set notes = null where id = $1'
      using v_student_id;
  end if;

  if exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'students'
    and column_name = 'subjects_json'
) then
  -- Production legacy column is JSONB NOT NULL.
  -- Empty it instead of setting it to NULL.
  execute 'update public.students
           set subjects_json = ''[]''::jsonb
           where id = $1'
    using v_student_id;
end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'partner_affiliation'
  ) then
    execute 'update public.students set partner_affiliation = null where id = $1'
      using v_student_id;
  end if;

  -- Break the Auth <-> application identity mapping before Auth hard deletion.
  delete from public.profile_identities where profile_id = v_profile_id;

  update public.profiles
  set auth_user_id = null,
      full_name = 'Redacted Learner',
      email = 'redacted+' || gen_random_uuid()::text || '@removed.invalid',
      phone = null,
      updated_at = now()
  where id = v_profile_id;

  v_counts := v_counts || jsonb_build_object(
    'profile_anonymized', 1,
    'student_anonymized', 1
  );

  update public.privacy_requests
  set processing_state = 'db_erased',
      result = jsonb_build_object(
        'manifest_version', 'PRIV-01-v1',
        'financial_hold', v_financial_hold,
        'db_erasure_counts', v_counts
      ),
      last_error = null,
      updated_at = now()
  where id = p_request_id;

  perform public.log_audit_event(
    'privacy.deletion_database_erased',
    'privacy_request',
    p_request_id::text,
    jsonb_build_object(
      'stage', 'db_erased',
      'manifest_version', 'PRIV-01-v1'
    )
  );

  return v_counts;
end;
$$;

create or replace function public.mark_student_privacy_auth_deleted(
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state text;
begin
  select processing_state
  into v_state
  from public.privacy_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'privacy_request_not_found' using errcode = 'P0002';
  end if;

  if v_state not in ('db_erased', 'auth_deleted') then
    raise exception 'invalid_privacy_deletion_stage:%', v_state
      using errcode = '23514';
  end if;

  update public.privacy_requests
  set processing_state = 'auth_deleted',
      last_error = null,
      updated_at = now()
  where id = p_request_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Finalization is the ONLY place a deletion request becomes approved.
-- ---------------------------------------------------------------------------
create or replace function public.finalize_student_privacy_deletion(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.privacy_requests%rowtype;
  v_receipt public.privacy_deletion_receipts%rowtype;
  v_financial_hold boolean;
  v_counts jsonb;
begin
  select *
  into v_req
  from public.privacy_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'privacy_request_not_found' using errcode = 'P0002';
  end if;

  if v_req.processing_state = 'completed' then
    select *
    into v_receipt
    from public.privacy_deletion_receipts
    where request_id = p_request_id;

    return jsonb_build_object(
      'completed', true,
      'receipt_id', v_receipt.id,
      'completed_at', v_receipt.completed_at
    );
  end if;

  if v_req.processing_state <> 'auth_deleted' then
    raise exception 'invalid_privacy_deletion_stage:%', v_req.processing_state
      using errcode = '23514';
  end if;

  v_financial_hold := coalesce((v_req.result ->> 'financial_hold')::boolean, false);
  v_counts := coalesce(v_req.result -> 'db_erasure_counts', '{}'::jsonb);

  insert into public.privacy_deletion_receipts (
    request_id,
    manifest_version,
    financial_hold,
    storage_files_removed,
    db_erasure_counts,
    auth_account_deleted
  )
  values (
    p_request_id,
    coalesce(v_req.result ->> 'manifest_version', 'PRIV-01-v1'),
    v_financial_hold,
    v_req.storage_files_removed,
    v_counts,
    true
  )
  on conflict (request_id) do nothing;

  select *
  into v_receipt
  from public.privacy_deletion_receipts
  where request_id = p_request_id;

  update public.privacy_requests
  set status = 'approved',
      processing_state = 'completed',
      subject_student_id = null,
      subject_profile_id = null,
      processing_subject_auth_user_id = null,
      notes = null,
      result = jsonb_build_object(
        'completed', true,
        'manifest_version', v_receipt.manifest_version,
        'receipt_id', v_receipt.id,
        'completed_at', v_receipt.completed_at
      ),
      processing_completed_at = v_receipt.completed_at,
      last_error = null,
      updated_at = now()
  where id = p_request_id;

  perform public.log_audit_event(
    'privacy.deletion_completed',
    'privacy_request',
    p_request_id::text,
    jsonb_build_object(
      'stage', 'completed',
      'manifest_version', v_receipt.manifest_version,
      'receipt_id', v_receipt.id
    )
  );

  return jsonb_build_object(
    'completed', true,
    'receipt_id', v_receipt.id,
    'completed_at', v_receipt.completed_at
  );
end;
$$;

create or replace function public.record_student_privacy_deletion_error(
  p_request_id uuid,
  p_stage text,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.privacy_requests
  set last_error = left(
        coalesce(nullif(btrim(p_stage), ''), 'unknown')
        || ': '
        || coalesce(
          nullif(regexp_replace(btrim(p_error), '[^A-Za-z0-9_.:-]', '_', 'g'), ''),
          'worker_failed'
        ),
        240
      ),
      updated_at = now()
  where id = p_request_id
    and processing_state <> 'completed';

  perform public.log_audit_event(
    'privacy.deletion_failed',
    'privacy_request',
    p_request_id::text,
    jsonb_build_object(
      'stage', coalesce(nullif(btrim(p_stage), ''), 'unknown')
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Browser-facing wrapper can still process access/correction requests, but
--    deletion must go through the trusted Edge Function.
-- ---------------------------------------------------------------------------
create or replace function public.process_privacy_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.privacy_requests%rowtype;
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select *
  into v_req
  from public.privacy_requests
  where id = p_request_id;

  if not found then
    raise exception 'privacy_request_not_found' using errcode = 'P0002';
  end if;

  if v_req.subject_student_id is null then
    raise exception 'privacy_request_subject_required' using errcode = '23514';
  end if;

  if v_req.request_type = 'deletion' then
    raise exception 'privacy_deletion_requires_trusted_worker'
      using errcode = '42501';
  elsif v_req.request_type = 'access' then
    v_result := public.export_student_data(v_req.subject_student_id);
  else
    v_result := jsonb_build_object('note', 'correction applied via admin update');
  end if;

  update public.privacy_requests
  set status = 'approved',
      processing_state = 'completed',
      processing_completed_at = now(),
      result = v_result,
      last_error = null,
      updated_at = now()
  where id = p_request_id;

  perform public.log_audit_event(
    'privacy.request_processed',
    'privacy_request',
    p_request_id::text,
    jsonb_build_object(
      'request_type', v_req.request_type,
      'status', 'approved'
    )
  );

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Privileges: deletion-stage RPCs are server-only.
-- ---------------------------------------------------------------------------
revoke all on function public.begin_student_privacy_deletion(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.get_student_privacy_storage_manifest(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.mark_student_privacy_auth_banned(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.mark_student_privacy_storage_deleted(uuid, integer)
from public, anon, authenticated, service_role;
revoke all on function public.erase_student_privacy_data(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.mark_student_privacy_auth_deleted(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.finalize_student_privacy_deletion(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.record_student_privacy_deletion_error(uuid, text, text)
from public, anon, authenticated, service_role;

grant execute on function public.begin_student_privacy_deletion(uuid)
to service_role;
grant execute on function public.get_student_privacy_storage_manifest(uuid)
to service_role;
grant execute on function public.mark_student_privacy_auth_banned(uuid)
to service_role;
grant execute on function public.mark_student_privacy_storage_deleted(uuid, integer)
to service_role;
grant execute on function public.erase_student_privacy_data(uuid)
to service_role;
grant execute on function public.mark_student_privacy_auth_deleted(uuid)
to service_role;
grant execute on function public.finalize_student_privacy_deletion(uuid)
to service_role;
grant execute on function public.record_student_privacy_deletion_error(uuid, text, text)
to service_role;

-- Keep browser access to the non-deletion wrapper, protected internally by
-- platform-admin + AAL2 authorization.
revoke all on function public.process_privacy_request(uuid)
from public, anon, authenticated;
grant execute on function public.process_privacy_request(uuid)
to authenticated;

comment on function public.begin_student_privacy_deletion(uuid) is
  'PRIV-01 server-only stage: fail-closed authorization lock and deletion context.';
comment on function public.get_student_privacy_storage_manifest(uuid) is
  'PRIV-01 server-only read manifest; objects must be removed through Storage API.';
comment on function public.erase_student_privacy_data(uuid) is
  'PRIV-01 server-only application erasure/anonymization manifest.';
comment on function public.finalize_student_privacy_deletion(uuid) is
  'PRIV-01 server-only finalizer; only stage allowed to mark deletion approved/completed.';