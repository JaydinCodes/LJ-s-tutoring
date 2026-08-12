


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."adjustment_status" AS ENUM (
    'draft',
    'approved'
);


ALTER TYPE "public"."adjustment_status" OWNER TO "postgres";


CREATE TYPE "public"."adjustment_type" AS ENUM (
    'bonus',
    'correction',
    'penalty'
);


ALTER TYPE "public"."adjustment_type" OWNER TO "postgres";


CREATE TYPE "public"."assignment_status" AS ENUM (
    'draft',
    'published',
    'closed',
    'archived'
);


ALTER TYPE "public"."assignment_status" OWNER TO "postgres";


CREATE TYPE "public"."baseline_source_type" AS ENUM (
    'manual',
    'uploaded',
    'generated',
    'diagnostic'
);


ALTER TYPE "public"."baseline_source_type" OWNER TO "postgres";


CREATE TYPE "public"."community_moderation_state" AS ENUM (
    'visible',
    'flagged'
);


ALTER TYPE "public"."community_moderation_state" OWNER TO "postgres";


CREATE TYPE "public"."community_question_status" AS ENUM (
    'open',
    'resolved',
    'closed'
);


ALTER TYPE "public"."community_question_status" OWNER TO "postgres";


CREATE TYPE "public"."invoice_line_type" AS ENUM (
    'session',
    'adjustment'
);


ALTER TYPE "public"."invoice_line_type" OWNER TO "postgres";


CREATE TYPE "public"."invoice_status" AS ENUM (
    'draft',
    'issued',
    'paid'
);


ALTER TYPE "public"."invoice_status" OWNER TO "postgres";


CREATE TYPE "public"."learning_goal_category" AS ENUM (
    'academic',
    'attendance',
    'assignment',
    'career',
    'intervention'
);


ALTER TYPE "public"."learning_goal_category" OWNER TO "postgres";


CREATE TYPE "public"."learning_goal_status" AS ENUM (
    'active',
    'completed',
    'paused',
    'cancelled'
);


ALTER TYPE "public"."learning_goal_status" OWNER TO "postgres";


CREATE TYPE "public"."org_member_role" AS ENUM (
    'coordinator',
    'tutor',
    'student',
    'parent',
    'partner_viewer'
);


ALTER TYPE "public"."org_member_role" OWNER TO "postgres";


CREATE TYPE "public"."organization_type" AS ENUM (
    'direct',
    'ngo',
    'school',
    'community'
);


ALTER TYPE "public"."organization_type" OWNER TO "postgres";


CREATE TYPE "public"."pay_period_status" AS ENUM (
    'open',
    'locked'
);


ALTER TYPE "public"."pay_period_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'paid',
    'overdue',
    'voided'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."privacy_request_outcome" AS ENUM (
    'FULFILLED',
    'REJECTED',
    'ANONYMIZED',
    'DELETED',
    'CORRECTED'
);


ALTER TYPE "public"."privacy_request_outcome" OWNER TO "postgres";


CREATE TYPE "public"."privacy_request_type" AS ENUM (
    'access',
    'correction',
    'deletion'
);


ALTER TYPE "public"."privacy_request_type" OWNER TO "postgres";


CREATE TYPE "public"."privacy_subject_type" AS ENUM (
    'TUTOR',
    'STUDENT'
);


ALTER TYPE "public"."privacy_subject_type" OWNER TO "postgres";


CREATE TYPE "public"."record_status" AS ENUM (
    'active',
    'inactive',
    'pending',
    'approved',
    'suspended'
);


ALTER TYPE "public"."record_status" OWNER TO "postgres";


CREATE TYPE "public"."session_status" AS ENUM (
    'draft',
    'submitted',
    'approved',
    'rejected'
);


ALTER TYPE "public"."session_status" OWNER TO "postgres";


CREATE TYPE "public"."submission_status" AS ENUM (
    'not_submitted',
    'submitted',
    'marked',
    'returned'
);


ALTER TYPE "public"."submission_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'student',
    'tutor',
    'admin',
    'parent',
    'ngo_partner'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."volunteer_event_status" AS ENUM (
    'planned',
    'cancelled',
    'completed'
);


ALTER TYPE "public"."volunteer_event_status" OWNER TO "postgres";


CREATE TYPE "public"."volunteer_log_status" AS ENUM (
    'signed_up',
    'submitted',
    'verified',
    'rejected'
);


ALTER TYPE "public"."volunteer_log_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."anonymize_student"("p_student_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."anonymize_student"("p_student_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "assignment_id" "uuid",
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "duration_minutes" integer NOT NULL,
    "mode" "text" NOT NULL,
    "location" "text",
    "notes" "text",
    "status" "public"."session_status" DEFAULT 'draft'::"public"."session_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "submitted_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "sync_key" "text",
    "attendance_status" "text",
    "topics_covered" "text",
    "learner_struggles" "text",
    "homework_assigned" "text",
    "tutor_private_notes" "text",
    "student_summary" "text",
    "report_review_note" "text",
    "payout_override" boolean DEFAULT false NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "tutor_student_allocation_id" "uuid" NOT NULL,
    CONSTRAINT "sessions_duration_positive" CHECK (("duration_minutes" > 0)),
    CONSTRAINT "sessions_end_after_start" CHECK (("end_time" > "start_time"))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_session"("p_session_id" "uuid") RETURNS "public"."sessions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_current public.sessions%rowtype;
  v_updated public.sessions%rowtype;
  v_subject text;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_current
  from public.sessions
  where id = p_session_id;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.tutors t where t.id = v_current.tutor_id and t.status = 'active' and t.approval_status = 'approved') then
    raise exception 'tutor_not_active' using errcode = '42501';
  end if;

  if public.session_date_pay_period_locked(v_current.date) then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  if v_current.status <> 'submitted' then
    raise exception 'only_submitted_approvable';
  end if;

  update public.sessions set
    status = 'approved',
    approved_at = now(),
    approved_by = public.current_profile_id()
  where id = p_session_id
  returning * into v_updated;

  select subj.name into v_subject
  from public.tutor_student_allocations alloc
  left join public.subjects subj on subj.id = alloc.subject_id
  where alloc.id = v_current.tutor_student_allocation_id;
  perform public.create_student_notification(
    v_current.student_id,
    'session_approved',
    'Session approved',
    coalesce(v_subject, 'Your session') || ' on ' || v_current.date::text || ' was approved.',
    '/dashboard/',
    'session',
    p_session_id,
    '{}'::jsonb
  );
  perform public.insert_session_history(p_session_id, 'approve', to_jsonb(v_current), to_jsonb(v_updated));
  return v_updated;
end;
$$;


ALTER FUNCTION "public"."approve_session"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."begin_student_privacy_deletion"("p_request_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."begin_student_privacy_deletion"("p_request_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."begin_student_privacy_deletion"("p_request_id" "uuid") IS 'PRIV-01 server-only stage: fail-closed authorization lock and deletion context.';



CREATE OR REPLACE FUNCTION "public"."block_audit_log_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'audit_log is immutable';
  end if;

  if tg_op = 'DELETE' then
    if coalesce(current_setting('app.retention_cleanup', true), 'off') <> 'on' then
      raise exception 'audit_log delete blocked outside retention cleanup';
    end if;
  end if;

  return old;
end;
$$;


ALTER FUNCTION "public"."block_audit_log_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."block_session_history_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'session_history is immutable';
  end if;

  if tg_op = 'DELETE' then
    if coalesce(current_setting('app.retention_cleanup', true), 'off') <> 'on' then
      raise exception 'session_history delete blocked outside retention cleanup';
    end if;
  end if;

  return old;
end;
$$;


ALTER FUNCTION "public"."block_session_history_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_mark_submission"("p_submission_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    public.is_platform_admin()
    or (
      public.current_approved_active_tutor_id() is not null
      and exists (
        select 1
        from public.assignment_submissions sub
        join public.assignments a on a.id = sub.assignment_id
        where sub.id = p_submission_id
          and a.created_by = public.current_profile_id()
      )
    ),
    false
  )
$$;


ALTER FUNCTION "public"."can_mark_submission"("p_submission_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_write_uncommitted_assignment_submission_storage"("p_storage_key" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_student_id uuid := public.current_student_id();
  v_path_parts text[] := string_to_array(p_storage_key, '/');
  v_submission_id uuid;
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then
    return false;
  end if;
  if array_length(v_path_parts, 1) <> 4
     or v_path_parts[1] <> v_student_id::text
     or v_path_parts[4] !~ '^submission\.[A-Za-z0-9]+$'
  then
    return false;
  end if;

  begin
    v_submission_id := v_path_parts[3]::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  -- This is intentionally the exact lock namespace used by both submission
  -- RPCs. A Storage write that starts first completes before submit can commit;
  -- a submit that starts first commits before this function checks the row.
  perform pg_advisory_xact_lock(
    hashtextextended('assignment-submission-id:' || v_submission_id::text, 0)
  );

  return not exists (
    select 1
    from public.assignment_submissions s
    where s.id = v_submission_id
      and s.student_id = v_student_id
  );
end;
$_$;


ALTER FUNCTION "public"."can_write_uncommitted_assignment_submission_storage"("p_storage_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_and_record_edge_function_rate_limit"("p_subject_id" "uuid", "p_function_name" "text", "p_limit" integer, "p_window_seconds" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."check_and_record_edge_function_rate_limit"("p_subject_id" "uuid", "p_function_name" "text", "p_limit" integer, "p_window_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_assignment_submission_attempt"("p_assignment_id" "uuid", "p_submission_id" "uuid", "p_storage_key" "text", "p_file_url" "text", "p_original_filename" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_text_answer" "text") RETURNS TABLE("submission_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_student_id uuid := public.current_student_id();
  v_existing_submission public.assignment_submissions%rowtype;
  v_storage_key text := nullif(btrim(coalesce(p_storage_key, '')), '');
  v_file_url text := nullif(btrim(coalesce(p_file_url, '')), '');
  v_original_filename text := nullif(btrim(coalesce(p_original_filename, '')), '');
  v_mime_type text := nullif(btrim(coalesce(p_mime_type, '')), '');
  v_text_answer text := nullif(btrim(coalesce(p_text_answer, '')), '');
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then
    raise exception 'only_students_can_confirm_submission' using errcode = '42501';
  end if;
  if p_submission_id is null then
    raise exception 'submission_id_required' using errcode = '23502';
  end if;
  if v_text_answer is null and v_storage_key is null then
    raise exception 'submission_content_required' using errcode = '23514';
  end if;
  if v_storage_key is distinct from v_file_url then
    raise exception 'invalid_submission_file_reference' using errcode = '23514';
  end if;
  if v_storage_key is null
     and (v_original_filename is not null or v_mime_type is not null or p_size_bytes is not null)
  then
    raise exception 'invalid_submission_file_metadata' using errcode = '23514';
  end if;
  if p_size_bytes is not null and p_size_bytes < 0 then
    raise exception 'invalid_submission_file_size' using errcode = '23514';
  end if;
  if v_storage_key is not null
     and v_storage_key !~ ('^' || v_student_id::text || '/' || p_assignment_id::text || '/' || p_submission_id::text || '/submission\.[A-Za-z0-9]+$')
  then
    raise exception 'invalid_submission_storage_path' using errcode = '42501';
  end if;

  -- Wait for an in-flight submit using this UUID. After the lock is acquired,
  -- the row is either durably committed (return it) or absent (the caller may
  -- safely retry the same Storage upload and submit RPC).
  perform pg_advisory_xact_lock(
    hashtextextended('assignment-submission-id:' || p_submission_id::text, 0)
  );

  select s.* into v_existing_submission
  from public.assignment_submissions s
  where s.id = p_submission_id;

  if not found then
    return;
  end if;

  if v_existing_submission.assignment_id <> p_assignment_id
     or v_existing_submission.student_id <> v_student_id
  then
    raise exception 'submission_id_conflict' using errcode = '23505';
  end if;

  if v_existing_submission.storage_key is distinct from v_storage_key
     or v_existing_submission.file_url is distinct from v_file_url
     or v_existing_submission.original_filename is distinct from v_original_filename
     or v_existing_submission.mime_type is distinct from v_mime_type
     or v_existing_submission.size_bytes is distinct from p_size_bytes
     or v_existing_submission.text_answer is distinct from v_text_answer
  then
    raise exception 'submission_retry_payload_mismatch' using errcode = '23505';
  end if;

  return query select v_existing_submission.id;
end;
$_$;


ALTER FUNCTION "public"."confirm_assignment_submission_attempt"("p_assignment_id" "uuid", "p_submission_id" "uuid", "p_storage_key" "text", "p_file_url" "text", "p_original_filename" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_text_answer" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "pay_period_id" "uuid" NOT NULL,
    "type" "public"."adjustment_type" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "reason" "text" NOT NULL,
    "status" "public"."adjustment_status" DEFAULT 'approved'::"public"."adjustment_status" NOT NULL,
    "created_by_user_id" "uuid",
    "approved_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approved_at" timestamp with time zone,
    "voided_at" timestamp with time zone,
    "voided_by_user_id" "uuid",
    "void_reason" "text",
    "related_session_id" "uuid",
    "approved_by" "uuid",
    "voided_by" "uuid",
    "created_by" "uuid" NOT NULL
);


ALTER TABLE "public"."adjustments" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_adjustment"("p_tutor_id" "uuid", "p_type" "public"."adjustment_type", "p_amount" numeric, "p_reason" "text", "p_related_session_id" "uuid", "p_week_start" "date") RETURNS "public"."adjustments"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_period public.pay_periods;
  v_adj public.adjustments;
  v_profile uuid := public.current_profile_id();
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.tutors where id = p_tutor_id) then
    raise exception 'tutor_not_found' using errcode = 'P0002';
  end if;

  if p_related_session_id is not null then
    if not exists (
      select 1 from public.sessions
      where id = p_related_session_id
        and tutor_id = p_tutor_id
        and date between p_week_start and p_week_start + 6
    ) then
      raise exception 'related_session_invalid' using errcode = '23514';
    end if;
  end if;

  v_period := public.get_or_create_pay_period(p_week_start);

  insert into public.adjustments
    (tutor_id, pay_period_id, type, amount, reason, status, created_by, approved_by, approved_at, related_session_id)
  values
    (p_tutor_id, v_period.id, p_type, p_amount, p_reason, 'approved', v_profile, v_profile, now(), p_related_session_id)
  returning * into v_adj;

  return v_adj;
end;
$$;


ALTER FUNCTION "public"."create_adjustment"("p_tutor_id" "uuid", "p_type" "public"."adjustment_type", "p_amount" numeric, "p_reason" "text", "p_related_session_id" "uuid", "p_week_start" "date") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_exam_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "subject" "text" NOT NULL,
    "title" "text" NOT NULL,
    "exam_date" "date" NOT NULL,
    "created_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."student_exam_events" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_exam_event"("p_student_id" "uuid", "p_subject" "text", "p_title" "text", "p_exam_date" "date") RETURNS "public"."student_exam_events"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.student_exam_events;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.student_exam_events (student_id, subject, title, exam_date, created_by)
  values (p_student_id, p_subject, p_title, p_exam_date, public.current_profile_id())
  returning * into v_row;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."create_exam_event"("p_student_id" "uuid", "p_subject" "text", "p_title" "text", "p_exam_date" "date") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learning_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'academic'::"text" NOT NULL,
    "subject" "text",
    "target_value" numeric(10,2),
    "current_value" numeric(10,2),
    "due_date" "date",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_by_user_id" "uuid",
    "visible_to_student" boolean DEFAULT true NOT NULL,
    "visible_to_tutor" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "learning_goals_category_check" CHECK (("category" = ANY (ARRAY['academic'::"text", 'attendance'::"text", 'assignment'::"text", 'career'::"text", 'intervention'::"text"]))),
    CONSTRAINT "learning_goals_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'paused'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."learning_goals" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_learning_goal"("p_student_id" "uuid", "p_title" "text", "p_description" "text" DEFAULT NULL::"text", "p_category" "public"."learning_goal_category" DEFAULT 'academic'::"public"."learning_goal_category", "p_subject" "text" DEFAULT NULL::"text", "p_target_value" numeric DEFAULT NULL::numeric, "p_current_value" numeric DEFAULT NULL::numeric, "p_due_date" "date" DEFAULT NULL::"date", "p_status" "public"."learning_goal_status" DEFAULT 'active'::"public"."learning_goal_status", "p_visible_to_student" boolean DEFAULT true, "p_visible_to_tutor" boolean DEFAULT true) RETURNS "public"."learning_goals"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.learning_goals;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.learning_goals
    (student_id, title, description, category, subject, target_value, current_value,
     due_date, status, created_by, visible_to_student, visible_to_tutor)
  values
    (p_student_id, p_title, p_description, p_category, p_subject, p_target_value, p_current_value,
     p_due_date, p_status, public.current_profile_id(), p_visible_to_student, p_visible_to_tutor)
  returning * into v_row;

  if v_row.visible_to_student then
    perform public.create_student_notification(
      p_student_id,
      'learning_goal_created',
      'New goal added',
      v_row.title || ' has been added to your study plan.',
      '/dashboard/',
      'learning_goal',
      v_row.id,
      '{}'::jsonb
    );
  end if;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."create_learning_goal"("p_student_id" "uuid", "p_title" "text", "p_description" "text", "p_category" "public"."learning_goal_category", "p_subject" "text", "p_target_value" numeric, "p_current_value" numeric, "p_due_date" "date", "p_status" "public"."learning_goal_status", "p_visible_to_student" boolean, "p_visible_to_tutor" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_session"("p_tutor_student_allocation_id" "uuid", "p_student_id" "uuid", "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_mode" "text", "p_location" "text", "p_notes" "text", "p_idempotency_key" "text") RETURNS "public"."sessions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tutor_id uuid := public.current_tutor_id();
  v_alloc public.tutor_student_allocations%rowtype;
  v_minutes int;
  v_mode text := btrim(coalesce(p_mode, ''));
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_existing public.sessions%rowtype;
  v_session public.sessions%rowtype;
begin
  if v_tutor_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.tutors t where t.id = v_tutor_id and t.status = 'active' and t.approval_status = 'approved') then
    raise exception 'tutor_not_active' using errcode = '42501';
  end if;

  if char_length(v_mode) < 1 or char_length(v_mode) > 40 then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  select * into v_alloc
  from public.tutor_student_allocations
  where id = p_tutor_student_allocation_id;
  if not found then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;

  if v_alloc.tutor_id <> v_tutor_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_alloc.student_id <> p_student_id then
    raise exception 'student_mismatch' using errcode = '23514';
  end if;

  if v_alloc.status <> 'active' then
    raise exception 'assignment_inactive' using errcode = '42501';
  end if;

  if public.session_date_pay_period_locked(p_date) then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  if not public.session_within_allocation_window(
       p_date, p_start_time, p_end_time,
       v_alloc.start_date, v_alloc.end_date,
       v_alloc.allowed_days_json, v_alloc.allowed_time_ranges_json) then
    raise exception 'outside_assignment_window' using errcode = '23514';
  end if;

  v_minutes := (extract(epoch from (p_end_time - p_start_time)) / 60)::int;
  if v_minutes <= 0 then
    raise exception 'invalid_duration_minutes' using errcode = '23514';
  end if;

  if v_key is not null then
    select * into v_existing
    from public.sessions
    where tutor_id = v_tutor_id and sync_key = v_key
    limit 1;
    if found then
      return v_existing;
    end if;
  end if;

  if exists (
    select 1 from public.sessions
    where tutor_id = v_tutor_id
      and date = p_date
      and not (end_time <= p_start_time or start_time >= p_end_time)
  ) then
    raise exception 'overlapping_session' using errcode = '23505';
  end if;

  insert into public.sessions (
    tutor_id, student_id, tutor_student_allocation_id, date, start_time, end_time,
    duration_minutes, mode, location, notes, status, sync_key
  )
  values (
    v_tutor_id, p_student_id, p_tutor_student_allocation_id, p_date, p_start_time, p_end_time,
    v_minutes, v_mode, nullif(btrim(coalesce(p_location, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''), 'draft', v_key
  )
  returning * into v_session;

  perform public.insert_session_history(v_session.id, 'create', null, to_jsonb(v_session));
  return v_session;
end;
$$;


ALTER FUNCTION "public"."create_session"("p_tutor_student_allocation_id" "uuid", "p_student_id" "uuid", "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_mode" "text", "p_location" "text", "p_notes" "text", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_student_notification"("p_student_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_link" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_metadata" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
begin
  insert into public.student_notifications (
    student_id, type, title, body, link, entity_type, entity_id, metadata_json, created_by
  )
  values (
    p_student_id, p_type, p_title, p_body, p_link, p_entity_type, p_entity_id,
    coalesce(p_metadata, '{}'::jsonb), public.current_profile_id()
  )
  returning id into v_id;
  return v_id;
end;
$$;


ALTER FUNCTION "public"."create_student_notification"("p_student_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_link" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_study_rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subject" "text" NOT NULL,
    "grade" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."community_study_rooms" OWNER TO "postgres";


COMMENT ON TABLE "public"."community_study_rooms" IS 'AUTH-02 containment: Community disabled for browser roles pending tenant scoping, pseudonyms, reporting/blocking, moderation review, and runtime role/org tests.';



CREATE OR REPLACE FUNCTION "public"."create_study_room"("p_subject" "text", "p_grade" "text" DEFAULT NULL::"text") RETURNS "public"."community_study_rooms"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_role public.user_role := public.current_profile_role();
  v_room public.community_study_rooms;
begin
  if v_profile_id is null
     or not (
       v_role = 'admin'
       or (v_role = 'student' and public.current_active_student_id() is not null)
       or (v_role = 'tutor' and public.current_approved_active_tutor_id() is not null)
     )
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.community_study_rooms (subject, grade, created_by)
  values (p_subject, p_grade, v_profile_id)
  returning * into v_room;

  insert into public.community_room_members (room_id, profile_id)
  values (v_room.id, v_profile_id)
  on conflict do nothing;

  return v_room;
end;
$$;


ALTER FUNCTION "public"."create_study_room"("p_subject" "text", "p_grade" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."volunteer_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "event_date" "date",
    "start_time" time without time zone,
    "end_time" time without time zone,
    "location" "text",
    "mode" "text" DEFAULT 'in-person'::"text" NOT NULL,
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "created_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "volunteer_events_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'cancelled'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."volunteer_events" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_volunteer_event"("p_title" "text", "p_description" "text" DEFAULT NULL::"text", "p_event_date" "date" DEFAULT NULL::"date", "p_start_time" time without time zone DEFAULT NULL::time without time zone, "p_end_time" time without time zone DEFAULT NULL::time without time zone, "p_location" "text" DEFAULT NULL::"text", "p_mode" "text" DEFAULT 'in-person'::"text", "p_status" "public"."volunteer_event_status" DEFAULT 'planned'::"public"."volunteer_event_status") RETURNS "public"."volunteer_events"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.volunteer_events;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_mode, ''))) = 0 or char_length(p_mode) > 40 then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  insert into public.volunteer_events
    (title, description, event_date, start_time, end_time, location, mode, status, created_by)
  values
    (p_title, p_description, p_event_date, p_start_time, p_end_time, p_location, p_mode, p_status, public.current_profile_id())
  returning * into v_row;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."create_volunteer_event"("p_title" "text", "p_description" "text", "p_event_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_location" "text", "p_mode" "text", "p_status" "public"."volunteer_event_status") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."volunteer_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "status" "text" DEFAULT 'signed_up'::"text" NOT NULL,
    "hours" numeric(8,2),
    "volunteered_on" "date",
    "notes" "text",
    "evidence_document_id" "uuid",
    "submitted_at" timestamp with time zone,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "admin_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "volunteer_logs_hours_check" CHECK ((("hours" IS NULL) OR ("hours" >= (0)::numeric))),
    CONSTRAINT "volunteer_logs_status_check" CHECK (("status" = ANY (ARRAY['signed_up'::"text", 'submitted'::"text", 'verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."volunteer_logs" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_volunteer_log"("p_event_id" "uuid" DEFAULT NULL::"uuid", "p_hours" numeric DEFAULT NULL::numeric, "p_volunteered_on" "date" DEFAULT NULL::"date", "p_notes" "text" DEFAULT NULL::"text", "p_evidence_document_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."volunteer_logs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tutor_id uuid := public.current_tutor_id();
  v_status public.volunteer_log_status;
  v_row public.volunteer_logs;
begin
  if v_tutor_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_evidence_document_id is not null and not exists (
    select 1 from public.tutor_documents
    where id = p_evidence_document_id and tutor_id = v_tutor_id
  ) then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  v_status := case when p_hours is not null then 'submitted' else 'signed_up' end;

  insert into public.volunteer_logs
    (tutor_id, event_id, status, hours, volunteered_on, notes, evidence_document_id, submitted_at)
  values
    (v_tutor_id, p_event_id, v_status, p_hours, p_volunteered_on, p_notes, p_evidence_document_id,
     case when v_status = 'submitted' then now() else null end)
  returning * into v_row;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."create_volunteer_log"("p_event_id" "uuid", "p_hours" numeric, "p_volunteered_on" "date", "p_notes" "text", "p_evidence_document_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_active_student_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select s.id
  from public.students s
  join public.profile_identities pi on pi.profile_id = s.profile_id
  where pi.auth_user_id = auth.uid()
    and s.status = 'active'::public.record_status
  limit 1
$$;


ALTER FUNCTION "public"."current_active_student_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."current_active_student_id"() IS 'Authoritative operational student identity; returns an id only when students.status = active.';



CREATE OR REPLACE FUNCTION "public"."current_approved_active_tutor_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select t.id
  from public.tutors t
  join public.profile_identities pi on pi.profile_id = t.profile_id
  where pi.auth_user_id = auth.uid()
    and t.status = 'active'::public.record_status
    and t.approval_status = 'approved'
  limit 1
$$;


ALTER FUNCTION "public"."current_approved_active_tutor_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."current_approved_active_tutor_id"() IS 'Authoritative operational tutor identity; requires status = active and approval_status = approved.';



CREATE OR REPLACE FUNCTION "public"."current_org_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select om.organization_id
  from public.organization_members om
  join public.profile_identities pi on pi.profile_id = om.profile_id
  where pi.auth_user_id = auth.uid()
    and om.status = 'active'::public.record_status
    and (
      pi.role not in (
        'student'::public.user_role,
        'tutor'::public.user_role
      )
      or (
        pi.role = 'student'::public.user_role
        and exists (
          select 1
          from public.students s
          where s.profile_id = pi.profile_id
            and s.status = 'active'::public.record_status
        )
      )
      or (
        pi.role = 'tutor'::public.user_role
        and exists (
          select 1
          from public.tutors t
          where t.profile_id = pi.profile_id
            and t.status = 'active'::public.record_status
            and t.approval_status = 'approved'
        )
      )
    )
$$;


ALTER FUNCTION "public"."current_org_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_org_role"("org" "uuid") RETURNS "public"."org_member_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select om.org_role
  from public.organization_members om
  join public.profile_identities pi on pi.profile_id = om.profile_id
  where pi.auth_user_id = auth.uid()
    and om.organization_id = org
    and om.status = 'active'::public.record_status
    and (
      pi.role not in (
        'student'::public.user_role,
        'tutor'::public.user_role
      )
      or (
        pi.role = 'student'::public.user_role
        and exists (
          select 1
          from public.students s
          where s.profile_id = pi.profile_id
            and s.status = 'active'::public.record_status
        )
      )
      or (
        pi.role = 'tutor'::public.user_role
        and exists (
          select 1
          from public.tutors t
          where t.profile_id = pi.profile_id
            and t.status = 'active'::public.record_status
            and t.approval_status = 'approved'
        )
      )
    )
  order by case om.org_role
    when 'coordinator' then 0
    else 1
  end
  limit 1
$$;


ALTER FUNCTION "public"."current_org_role"("org" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_profile_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select profile_id from public.profile_identities where auth_user_id = auth.uid()
$$;


ALTER FUNCTION "public"."current_profile_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_profile_role"() RETURNS "public"."user_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select role from public.profile_identities where auth_user_id = auth.uid()
$$;


ALTER FUNCTION "public"."current_profile_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_student_class_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select ce.class_id
  from public.class_enrollments ce
  where ce.student_id = public.current_student_id()
    and ce.status = 'active'
$$;


ALTER FUNCTION "public"."current_student_class_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_student_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.current_active_student_id()
$$;


ALTER FUNCTION "public"."current_student_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_student_identity_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select s.id
  from public.students s
  join public.profile_identities pi on pi.profile_id = s.profile_id
  where pi.auth_user_id = auth.uid()
  limit 1
$$;


ALTER FUNCTION "public"."current_student_identity_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."current_student_identity_id"() IS 'Identity-only student lookup. Do not use for operational authorization.';



CREATE OR REPLACE FUNCTION "public"."current_student_org_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select s.organization_id
  from public.students s
  join public.profile_identities pi on pi.profile_id = s.profile_id
  where pi.auth_user_id = auth.uid()
    and s.status = 'active'::public.record_status
  limit 1
$$;


ALTER FUNCTION "public"."current_student_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_tutor_class_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select c.id
  from public.classes c
  where c.tutor_id = public.current_tutor_id()
$$;


ALTER FUNCTION "public"."current_tutor_class_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_tutor_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.current_approved_active_tutor_id()
$$;


ALTER FUNCTION "public"."current_tutor_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_tutor_identity_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select t.id
  from public.tutors t
  join public.profile_identities pi on pi.profile_id = t.profile_id
  where pi.auth_user_id = auth.uid()
  limit 1
$$;


ALTER FUNCTION "public"."current_tutor_identity_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."current_tutor_identity_id"() IS 'Identity-only tutor lookup. Intended for tutor onboarding/application ownership only.';



CREATE OR REPLACE FUNCTION "public"."current_tutor_onboarding_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select t.id
  from public.tutors t
  join public.profile_identities pi on pi.profile_id = t.profile_id
  where pi.auth_user_id = auth.uid()
    and t.status in ('pending'::public.record_status, 'active'::public.record_status)
  limit 1
$$;


ALTER FUNCTION "public"."current_tutor_onboarding_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."current_tutor_onboarding_id"() IS 'Tutor onboarding identity; permits pending/active tutors but denies inactive/suspended tutors.';



CREATE TABLE IF NOT EXISTS "public"."tutor_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "personal_details_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "subjects_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "grades_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "teaching_preferences_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "experience" "text",
    "availability_notes" "text",
    "submitted_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tutor_applications_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'under_review'::"text", 'approved'::"text", 'rejected'::"text", 'changes_requested'::"text"])))
);


ALTER TABLE "public"."tutor_applications" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decide_tutor_application"("p_application_id" "uuid", "p_status" "text", "p_note" "text") RETURNS "public"."tutor_applications"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."decide_tutor_application"("p_application_id" "uuid", "p_status" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."erase_student_privacy_data"("p_request_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
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
$_$;


ALTER FUNCTION "public"."erase_student_privacy_data"("p_request_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."erase_student_privacy_data"("p_request_id" "uuid") IS 'PRIV-01 server-only application erasure/anonymization manifest.';



CREATE OR REPLACE FUNCTION "public"."export_student_data"("p_student_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."export_student_data"("p_student_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fill_organization_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."fill_organization_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fill_session_organization_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
    raise exception 'session_org_unresolved' using errcode = '23502';
  end if;

  new.organization_id := v_org;
  return new;
end;
$$;


ALTER FUNCTION "public"."fill_session_organization_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fill_student_scoped_organization_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."fill_student_scoped_organization_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_student_privacy_deletion"("p_request_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."finalize_student_privacy_deletion"("p_request_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."finalize_student_privacy_deletion"("p_request_id" "uuid") IS 'PRIV-01 server-only finalizer; only stage allowed to mark deletion approved/completed.';



CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "invoice_number" "text" NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "status" "public"."invoice_status" DEFAULT 'draft'::"public"."invoice_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_payroll_week"("p_week_start" "date") RETURNS SETOF "public"."invoices"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_week_end date := p_week_start + 6;
  v_period public.pay_periods;
  v_tutor record;
  v_line record;
  v_adj record;
  v_invoice public.invoices;
  v_invoice_number text;
  v_total numeric(12, 2);
  v_amount numeric(12, 2);
  v_signed numeric(12, 2);
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if exists (select 1 from public.invoices where period_start = p_week_start) then
    raise exception 'invoices_already_generated' using errcode = '23505';
  end if;

  v_period := public.get_or_create_pay_period(p_week_start);
  if v_period.status = 'locked' then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  for v_tutor in
    select distinct t.id as tutor_id, t.hourly_rate
    from public.tutors t
    where exists (
      select 1 from public.sessions s
      where s.tutor_id = t.id
        and s.status = 'approved'
        and s.date between p_week_start and v_week_end
    )
    or exists (
      select 1 from public.adjustments a
      where a.tutor_id = t.id
        and a.pay_period_id = v_period.id
        and a.status = 'approved'
        and a.voided_at is null
    )
  loop
    v_total := 0;
    v_invoice_number := 'INV-' || replace(p_week_start::text, '-', '') || '-' || substr(v_tutor.tutor_id::text, 1, 8);

    insert into public.invoices (tutor_id, period_start, period_end, invoice_number, total_amount, status)
    values (v_tutor.tutor_id, p_week_start, v_week_end, v_invoice_number, 0, 'issued')
    returning * into v_invoice;

    for v_line in
      select s.id as session_id,
             s.duration_minutes,
             s.date,
             s.start_time,
             s.end_time,
             coalesce(alloc.rate_override, v_tutor.hourly_rate) as rate,
             pr.full_name as student_name,
             subj.name as subject_name
      from public.sessions s
      join public.tutor_student_allocations alloc on alloc.id = s.tutor_student_allocation_id
      join public.students st on st.id = s.student_id
      join public.profiles pr on pr.id = st.profile_id
      left join public.subjects subj on subj.id = alloc.subject_id
      where s.tutor_id = v_tutor.tutor_id
        and s.status = 'approved'
        and s.date between p_week_start and v_week_end
      order by s.date asc, s.start_time asc
    loop
      v_amount := (v_line.duration_minutes / 60.0) * v_line.rate;
      v_total := v_total + v_amount;
      insert into public.invoice_lines
        (invoice_id, session_id, adjustment_id, line_type, description, minutes, rate, amount)
      values (
        v_invoice.id, v_line.session_id, null, 'session',
        coalesce(v_line.subject_name, 'Session') || ' - ' || coalesce(v_line.student_name, 'Student')
          || ' (' || v_line.date::text || ' ' || v_line.start_time::text || '-' || v_line.end_time::text || ')',
        v_line.duration_minutes, v_line.rate, v_amount
      );
    end loop;

    for v_adj in
      select a.id, a.type, a.amount, a.reason
      from public.adjustments a
      where a.tutor_id = v_tutor.tutor_id
        and a.pay_period_id = v_period.id
        and a.status = 'approved'
        and a.voided_at is null
      order by a.created_at asc
    loop
      v_signed := case when v_adj.type = 'penalty' then -abs(v_adj.amount) else abs(v_adj.amount) end;
      v_total := v_total + v_signed;
      insert into public.invoice_lines
        (invoice_id, session_id, adjustment_id, line_type, description, minutes, rate, amount)
      values (
        v_invoice.id, null, v_adj.id, 'adjustment',
        'Adjustment (' || v_adj.type::text || '): ' || v_adj.reason,
        0, 0, v_signed
      );
    end loop;

    update public.invoices set total_amount = v_total where id = v_invoice.id;
    v_invoice.total_amount := v_total;
    return next v_invoice;
  end loop;

  return;
end;
$$;


ALTER FUNCTION "public"."generate_payroll_week"("p_week_start" "date") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "week_start" "date" NOT NULL,
    "week_end" "date" NOT NULL,
    "payload_json" "jsonb" NOT NULL,
    "created_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "student_id" "uuid" NOT NULL,
    CONSTRAINT "weekly_reports_week_order" CHECK (("week_end" >= "week_start"))
);


ALTER TABLE "public"."weekly_reports" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_weekly_report"("p_student_id" "uuid", "p_week_start" "date") RETURNS "public"."weekly_reports"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_week_start date := date_trunc('week', p_week_start::timestamp)::date;
  v_week_end date := date_trunc('week', p_week_start::timestamp)::date + 6;
  v_student_name text;
  v_student_grade text;
  v_attended int;
  v_minutes int;
  v_notes_summary jsonb;
  v_topic_progress jsonb;
  v_weak_topic text;
  v_weak_completion int;
  v_goals jsonb;
  v_payload jsonb;
  v_report public.weekly_reports;
begin
  if not coalesce(
    public.is_platform_admin()
    or public.current_student_id() = p_student_id
    or exists (
      select 1 from public.tutor_student_allocations tsa
      where tsa.tutor_id = public.current_tutor_id()
        and tsa.student_id = p_student_id
        and tsa.status = 'active'
    ),
    false
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select pr.full_name, st.grade
    into v_student_name, v_student_grade
  from public.students st
  join public.profiles pr on pr.id = st.profile_id
  where st.id = p_student_id;
  if not found then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;

  select
    coalesce(count(*) filter (where status = 'approved'), 0)::int,
    coalesce(sum(duration_minutes) filter (where status = 'approved'), 0)::int
    into v_attended, v_minutes
  from public.sessions
  where student_id = p_student_id
    and date between v_week_start and v_week_end;

  select coalesce(jsonb_agg(sub.line order by sub.rn), '[]'::jsonb)
    into v_notes_summary
  from (
    select left(btrim(s.student_summary), 120) as line,
           row_number() over (order by s.date desc, s.start_time desc, s.id) as rn
    from public.sessions s
    where s.student_id = p_student_id
      and s.date between v_week_start and v_week_end
      and s.status = 'approved'
      and nullif(btrim(coalesce(s.student_summary, '')), '') is not null
  ) sub
  where sub.rn <= 3;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('subject', t.subject, 'topic', t.topic, 'completion', t.completion)
      order by t.completion asc, t.topic asc
    ),
    '[]'::jsonb
  )
    into v_topic_progress
  from (
    select coalesce(subj.name, 'General') as subject,
           sp.topic,
           greatest(0, least(100, round(avg(sp.score))))::int as completion
    from public.student_progress sp
    left join public.subjects subj on subj.id = sp.subject_id
    where sp.student_id = p_student_id
    group by coalesce(subj.name, 'General'), sp.topic
  ) t;

  select t.topic, t.completion
    into v_weak_topic, v_weak_completion
  from (
    select sp.topic,
           greatest(0, least(100, round(avg(sp.score))))::int as completion
    from public.student_progress sp
    left join public.subjects subj on subj.id = sp.subject_id
    where sp.student_id = p_student_id
    group by coalesce(subj.name, 'General'), sp.topic
  ) t
  order by t.completion asc, t.topic asc
  limit 1;

  if v_weak_topic is not null then
    v_goals := jsonb_build_array(
      'Lift ' || v_weak_topic || ' to at least ' || least(100, v_weak_completion + 15)::text || '% mastery.'
    );
  else
    v_goals := jsonb_build_array('Complete at least one focused practice session.');
  end if;

  v_payload := jsonb_build_object(
    'student', jsonb_build_object('id', p_student_id, 'name', v_student_name, 'grade', v_student_grade),
    'week', jsonb_build_object('start', v_week_start::text, 'end', v_week_end::text),
    'metrics', jsonb_build_object('sessionsAttended', v_attended, 'timeStudiedMinutes', v_minutes),
    'topicProgress', v_topic_progress,
    'tutorNotesSummary', v_notes_summary,
    'goalsNextWeek', v_goals
  );

  insert into public.weekly_reports (student_id, week_start, week_end, payload_json, created_by)
  values (p_student_id, v_week_start, v_week_end, v_payload, public.current_profile_id())
  on conflict (student_id, week_start, week_end)
  do update set payload_json = excluded.payload_json,
                created_by = excluded.created_by,
                created_at = now()
  returning * into v_report;

  perform public.create_student_notification(
    p_student_id,
    'weekly_report_ready',
    'Weekly report ready',
    'Your report for ' || v_week_start::text || ' to ' || v_week_end::text || ' is now available.',
    '/reports/',
    'weekly_report',
    v_report.id,
    '{}'::jsonb
  );

  return v_report;
end;
$$;


ALTER FUNCTION "public"."generate_weekly_report"("p_student_id" "uuid", "p_week_start" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_community_challenges"() RETURNS TABLE("id" "uuid", "title" "text", "subject" "text", "grade" "text", "week_start" "date", "week_end" "date", "xp_reward" integer, "created_by" "uuid", "created_at" timestamp with time zone, "has_submitted" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_profile_id uuid := public.current_profile_id();
begin
  if v_profile_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select c.id, c.title, c.subject, c.grade, c.week_start, c.week_end, c.xp_reward, c.created_by, c.created_at,
           exists (
             select 1 from public.community_challenge_submissions cs
             where cs.challenge_id = c.id and cs.profile_id = v_profile_id
           ) as has_submitted
    from public.community_challenges c
    order by c.week_start desc, c.created_at desc;
end;
$$;


ALTER FUNCTION "public"."get_community_challenges"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_community_questions"() RETURNS TABLE("id" "uuid", "profile_id" "uuid", "subject" "text", "topic" "text", "title" "text", "body" "text", "status" "public"."community_question_status", "moderation_state" "public"."community_moderation_state", "created_at" timestamp with time zone, "asker_name" "text", "answer_count" integer, "verified_answer_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_role public.user_role := public.current_profile_role();
begin
  if v_profile_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select q.id, q.profile_id, q.subject, q.topic, q.title, q.body, q.status, q.moderation_state,
           q.created_at, p.full_name as asker_name,
           (select count(*)::int from public.community_answers a where a.question_id = q.id and a.moderation_state = 'visible') as answer_count,
           (select a2.id from public.community_answers a2 where a2.question_id = q.id and a2.is_verified = true order by a2.created_at asc limit 1) as verified_answer_id
    from public.community_questions q
    join public.profiles p on p.id = q.profile_id
    where q.moderation_state = 'visible' or q.profile_id = v_profile_id or v_role in ('admin', 'tutor')
    order by q.created_at desc;
end;
$$;


ALTER FUNCTION "public"."get_community_questions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_community_rooms"() RETURNS TABLE("id" "uuid", "subject" "text", "grade" "text", "created_by" "uuid", "created_at" timestamp with time zone, "member_count" integer, "is_member" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_profile_id uuid := public.current_profile_id();
begin
  if v_profile_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select r.id, r.subject, r.grade, r.created_by, r.created_at,
           (select count(*)::int from public.community_room_members m where m.room_id = r.id) as member_count,
           exists (
             select 1 from public.community_room_members own
             where own.room_id = r.id and own.profile_id = v_profile_id
           ) as is_member
    from public.community_study_rooms r
    order by r.created_at desc;
end;
$$;


ALTER FUNCTION "public"."get_community_rooms"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_community_rooms"() IS 'AUTH-02 containment: service_role only until Community safeguarding redesign is complete.';



CREATE TABLE IF NOT EXISTS "public"."pay_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "period_start_date" "date" NOT NULL,
    "period_end_date" "date" NOT NULL,
    "status" "public"."pay_period_status" DEFAULT 'open'::"public"."pay_period_status" NOT NULL,
    "locked_at" timestamp with time zone,
    "locked_by_user_id" "uuid",
    "notes" "text",
    "locked_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pay_periods" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_pay_period"("p_period_start_date" "date") RETURNS "public"."pay_periods"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_period public.pay_periods;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.pay_periods (period_start_date, period_end_date, status)
  values (p_period_start_date, p_period_start_date + 6, 'open')
  on conflict (period_start_date) do nothing;

  select * into v_period
  from public.pay_periods
  where period_start_date = p_period_start_date;

  return v_period;
end;
$$;


ALTER FUNCTION "public"."get_or_create_pay_period"("p_period_start_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_org_cohort_report"("p_org_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_org_cohort_report"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_parent_progress_reports"() RETURNS TABLE("student_id" "uuid", "student_name" "text", "grade" "text", "school" "text", "assignment_title" "text", "marks_awarded" numeric, "feedback" "text", "released_at" timestamp with time zone, "topic" "text", "topic_score" numeric)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    s.id as student_id,
    p.full_name as student_name,
    s.grade,
    s.school,
    a.title as assignment_title,
    sub.marks_awarded,
    case when sub.feedback_released then sub.feedback else null end as feedback,
    sub.released_at,
    sp.topic,
    sp.score as topic_score
  from public.guardians g
  join public.student_guardians sg on sg.guardian_id = g.id
  join public.students s on s.id = sg.student_id
  join public.profiles p on p.id = s.profile_id
  left join public.assignment_submissions sub
    on sub.student_id = s.id
    and sub.marks_released = true
    and sub.marks_awarded is not null
  left join public.assignments a on a.id = sub.assignment_id
  left join lateral (
    select progress.topic, progress.score
    from public.student_progress progress
    where progress.student_id = s.id
    order by progress.recorded_at desc
    limit 1
  ) sp on true
  where public.current_profile_role() = 'parent'
    and g.profile_id = public.current_profile_id()
    and g.status = 'active'
    and sg.status = 'active'
    and sg.can_receive_reports = true
  order by p.full_name, sub.released_at desc nulls last;
$$;


ALTER FUNCTION "public"."get_parent_progress_reports"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pay_period_integrity"("p_week_start" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_week_end date := p_week_start + 6;
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'payPeriod', (
      select coalesce(
        (select jsonb_build_object('id', id, 'status', status) from public.pay_periods where period_start_date = p_week_start),
        jsonb_build_object('status', 'open')
      )
    ),
    'overlaps', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'session_id', s1.id, 'tutor_id', s1.tutor_id, 'student_id', s1.student_id,
        'date', s1.date, 'start_time', s1.start_time, 'end_time', s1.end_time,
        'overlap_id', s2.id
      )), '[]'::jsonb)
      from public.sessions s1
      join public.sessions s2
        on s1.tutor_id = s2.tutor_id
       and s1.id < s2.id
       and s1.date = s2.date
       and not (s1.end_time <= s2.start_time or s1.start_time >= s2.end_time)
      where s1.date between p_week_start and v_week_end
    ),
    'outsideAssignmentWindow', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'tutor_id', s.tutor_id, 'student_id', s.student_id,
        'date', s.date, 'start_time', s.start_time, 'end_time', s.end_time
      )), '[]'::jsonb)
      from public.sessions s
      join public.tutor_student_allocations a on a.id = s.tutor_student_allocation_id
      where s.date between p_week_start and v_week_end
        and not public.session_within_allocation_window(
          s.date, s.start_time, s.end_time,
          a.start_date, a.end_date, a.allowed_days_json, a.allowed_time_ranges_json
        )
    ),
    'missingInvoiceLines', (
      select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'tutor_id', s.tutor_id, 'date', s.date)), '[]'::jsonb)
      from public.sessions s
      left join public.invoice_lines l on l.session_id = s.id and l.line_type = 'session'
      where s.status = 'approved'
        and s.date between p_week_start and v_week_end
        and l.id is null
    ),
    'invoiceTotalMismatches', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'invoice_number', m.invoice_number, 'total_amount', m.total_amount, 'line_total', m.line_total
      )), '[]'::jsonb)
      from (
        select i.id, i.invoice_number, i.total_amount, coalesce(sum(l.amount), 0) as line_total
        from public.invoices i
        left join public.invoice_lines l on l.invoice_id = i.id
        where i.period_start = p_week_start
        group by i.id
        having i.total_amount <> coalesce(sum(l.amount), 0)
      ) m
    ),
    'pendingSubmissions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tutor_id', p.tutor_id, 'tutor_name', p.tutor_name, 'pending', p.pending
      ) order by p.tutor_name asc), '[]'::jsonb)
      from (
        select s.tutor_id, pr.full_name as tutor_name, count(*) as pending
        from public.sessions s
        join public.tutors t on t.id = s.tutor_id
        join public.profiles pr on pr.id = t.profile_id
        where s.status = 'submitted'
          and s.date between p_week_start and v_week_end
        group by s.tutor_id, pr.full_name
      ) p
    ),
    'duplicateSessions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tutor_id', d.tutor_id, 'student_id', d.student_id, 'date', d.date,
        'start_time', d.start_time, 'end_time', d.end_time, 'count', d.cnt
      ) order by d.date asc), '[]'::jsonb)
      from (
        select tutor_id, student_id, date, start_time, end_time, count(*) as cnt
        from public.sessions
        where date between p_week_start and v_week_end
        group by tutor_id, student_id, date, start_time, end_time
        having count(*) > 1
      ) d
    )
  ) into v_result;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."get_pay_period_integrity"("p_week_start" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_room_messages"("p_room_id" "uuid") RETURNS TABLE("id" "uuid", "room_id" "uuid", "profile_id" "uuid", "content" "text", "moderation_state" "public"."community_moderation_state", "created_at" timestamp with time zone, "sender_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_role public.user_role := public.current_profile_role();
begin
  if v_profile_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.community_room_members crm
    where crm.room_id = p_room_id and crm.profile_id = v_profile_id
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select m.id, m.room_id, m.profile_id, m.content, m.moderation_state, m.created_at,
           p.full_name as sender_name
    from public.community_room_messages m
    join public.profiles p on p.id = m.profile_id
    where m.room_id = p_room_id
      and (m.moderation_state = 'visible' or v_role in ('admin', 'tutor'))
    order by m.created_at desc;
end;
$$;


ALTER FUNCTION "public"."get_room_messages"("p_room_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_student_assigned_tutors"() RETURNS TABLE("id" "uuid", "full_name" "text", "email" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_student_id uuid := public.current_student_id();
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then
    raise exception 'only_students_can_view_assigned_tutors' using errcode = '42501';
  end if;

  return query
  select t.id, p.full_name, p.email
  from public.tutor_student_allocations tsa
  join public.tutors t on t.id = tsa.tutor_id
  join public.profiles p on p.id = t.profile_id
  where tsa.student_id = v_student_id
    and tsa.status = 'active'
  order by p.full_name, t.id;
end;
$$;


ALTER FUNCTION "public"."get_student_assigned_tutors"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_student_assignment_submissions"() RETURNS TABLE("id" "uuid", "assignment_id" "uuid", "student_id" "uuid", "storage_key" "text", "file_url" "text", "original_filename" "text", "mime_type" "text", "size_bytes" bigint, "text_answer" "text", "submitted_at" timestamp with time zone, "status" "public"."submission_status", "version_number" integer, "is_latest" boolean, "marks_awarded" numeric, "feedback" "text", "rubric_scores_json" "jsonb", "marks_released" boolean, "feedback_released" boolean, "released_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    sub.id,
    sub.assignment_id,
    sub.student_id,
    sub.storage_key,
    sub.file_url,
    sub.original_filename,
    sub.mime_type,
    sub.size_bytes,
    sub.text_answer,
    sub.submitted_at,
    sub.status,
    sub.version_number,
    sub.is_latest,
    case when sub.marks_released then sub.marks_awarded else null end as marks_awarded,
    case when sub.feedback_released then sub.feedback else null end as feedback,
    case when sub.feedback_released then sub.rubric_scores_json else '{}'::jsonb end as rubric_scores_json,
    sub.marks_released,
    sub.feedback_released,
    sub.released_at
  from public.assignment_submissions sub
  where sub.student_id = public.current_student_id()
    order by sub.submitted_at desc;
$$;


ALTER FUNCTION "public"."get_student_assignment_submissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_student_privacy_storage_manifest"("p_request_id" "uuid") RETURNS TABLE("bucket_id" "text", "object_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."get_student_privacy_storage_manifest"("p_request_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_student_privacy_storage_manifest"("p_request_id" "uuid") IS 'PRIV-01 server-only read manifest; objects must be removed through Storage API.';



CREATE OR REPLACE FUNCTION "public"."get_student_sessions"() RETURNS TABLE("id" "uuid", "date" "date", "start_time" time without time zone, "end_time" time without time zone, "mode" "text", "location" "text", "attendance_status" "text", "topics_covered" "text", "homework_assigned" "text", "student_summary" "text", "status" "public"."session_status")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    s.id,
    s.date,
    s.start_time,
    s.end_time,
    s.mode,
    s.location,
    s.attendance_status,
    s.topics_covered,
    s.homework_assigned,
    s.student_summary,
    s.status
  from public.sessions s
  where s.student_id = public.current_student_id()
  order by s.date desc, s.start_time desc;
$$;


ALTER FUNCTION "public"."get_student_sessions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tutor_allocated_students"() RETURNS TABLE("student_id" "uuid", "full_name" "text", "email" "text", "grade" "text", "school" "text", "status" "public"."record_status")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_tutor_id uuid := public.current_tutor_id();
begin
  if public.current_profile_role() <> 'tutor' or v_tutor_id is null then
    raise exception 'only_tutors_can_view_allocated_students' using errcode = '42501';
  end if;

  return query
  select s.id, p.full_name, p.email, s.grade, s.school, s.status
  from public.tutor_student_allocations tsa
  join public.students s on s.id = tsa.student_id
  join public.profiles p on p.id = s.profile_id
  where tsa.tutor_id = v_tutor_id
    and tsa.status = 'active'
  order by p.full_name, s.id;
end;
$$;


ALTER FUNCTION "public"."get_tutor_allocated_students"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_session_history"("p_session_id" "uuid", "p_change_type" "text", "p_before_json" "jsonb", "p_after_json" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
begin
  insert into public.session_history (
    session_id, changed_by_profile_id, change_type, before_json, after_json
  )
  values (
    p_session_id, public.current_profile_id(), p_change_type, p_before_json, p_after_json
  )
  returning id into v_id;
  return v_id;
end;
$$;


ALTER FUNCTION "public"."insert_session_history"("p_session_id" "uuid", "p_change_type" "text", "p_before_json" "jsonb", "p_after_json" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_platform_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.current_profile_role() = 'admin'
    and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;


ALTER FUNCTION "public"."is_platform_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_study_room"("p_room_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_role public.user_role := public.current_profile_role();
begin
  if v_profile_id is null
     or not (
       v_role = 'admin'
       or (v_role = 'student' and public.current_active_student_id() is not null)
       or (v_role = 'tutor' and public.current_approved_active_tutor_id() is not null)
     )
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.community_study_rooms where id = p_room_id) then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;

  insert into public.community_room_members (room_id, profile_id)
  values (p_room_id, v_profile_id)
  on conflict do nothing;
end;
$$;


ALTER FUNCTION "public"."join_study_room"("p_room_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lock_pay_period"("p_week_start" "date") RETURNS "public"."pay_periods"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_period public.pay_periods;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_period := public.get_or_create_pay_period(p_week_start);

  if v_period.status = 'locked' then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.sessions
    where status = 'submitted'
      and date between p_week_start and p_week_start + 6
  ) then
    raise exception 'pending_sessions' using errcode = '42501';
  end if;

  if not exists (select 1 from public.invoices where period_start = p_week_start) then
    perform public.generate_payroll_week(p_week_start);
  end if;

  update public.pay_periods
  set status = 'locked', locked_at = now(), locked_by = public.current_profile_id()
  where period_start_date = p_week_start
  returning * into v_period;

  return v_period;
end;
$$;


ALTER FUNCTION "public"."lock_pay_period"("p_week_start" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_audit_event"("p_action" "text", "p_entity_type" "text", "p_entity_id" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_audit_id uuid;
  v_actor_role public.user_role := public.current_profile_role();
begin
  if nullif(btrim(coalesce(p_action, '')), '') is null then
    raise exception 'audit_action_required' using errcode = '23514';
  end if;

  if nullif(btrim(coalesce(p_entity_type, '')), '') is null then
    raise exception 'audit_entity_type_required' using errcode = '23514';
  end if;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    auth.uid(),
    v_actor_role,
    btrim(p_action),
    btrim(p_entity_type),
    nullif(btrim(coalesce(p_entity_id, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_audit_id;

  return v_audit_id;
end;
$$;


ALTER FUNCTION "public"."log_audit_event"("p_action" "text", "p_entity_type" "text", "p_entity_id" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_all_notifications_read"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_count int;
begin
  with updated as (
    update public.student_notifications
    set is_read = true,
        read_at = coalesce(read_at, now()),
        updated_at = now()
    where student_id = public.current_student_id()
      and is_read = false
    returning 1
  )
  select count(*)::int into v_count from updated;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."mark_all_notifications_read"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignment_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "file_url" "text",
    "text_answer" "text",
    "submitted_at" timestamp with time zone,
    "status" "public"."submission_status" DEFAULT 'not_submitted'::"public"."submission_status" NOT NULL,
    "marks_awarded" numeric(8,2),
    "feedback" "text",
    "version_number" integer DEFAULT 1 NOT NULL,
    "is_latest" boolean DEFAULT true NOT NULL,
    "marked_at" timestamp with time zone,
    "storage_key" "text",
    "original_filename" "text",
    "mime_type" "text",
    "size_bytes" bigint,
    "rubric_scores_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "marks_released" boolean DEFAULT false NOT NULL,
    "feedback_released" boolean DEFAULT false NOT NULL,
    "released_at" timestamp with time zone,
    "ai_marks_awarded" numeric(8,2),
    "ai_feedback" "text",
    "ai_rubric_scores_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ai_confidence" numeric(5,2),
    "ai_graded_at" timestamp with time zone,
    "ai_grading_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    CONSTRAINT "assignment_submissions_ai_confidence_check" CHECK ((("ai_confidence" IS NULL) OR (("ai_confidence" >= (0)::numeric) AND ("ai_confidence" <= (100)::numeric)))),
    CONSTRAINT "assignment_submissions_ai_grading_status_check" CHECK (("ai_grading_status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'failed'::"text", 'skipped'::"text"]))),
    CONSTRAINT "assignment_submissions_ai_marks_awarded_check" CHECK ((("ai_marks_awarded" IS NULL) OR (("ai_marks_awarded" >= (0)::numeric) AND ("ai_marks_awarded" <= (100)::numeric)))),
    CONSTRAINT "assignment_submissions_ai_rubric_scores_json_check" CHECK ((("jsonb_typeof"("ai_rubric_scores_json") = 'object'::"text") AND ("octet_length"(("ai_rubric_scores_json")::"text") < 65536))),
    CONSTRAINT "assignment_submissions_marks_range" CHECK ((("marks_awarded" IS NULL) OR (("marks_awarded" >= (0)::numeric) AND ("marks_awarded" <= (100)::numeric)))),
    CONSTRAINT "assignment_submissions_rubric_scores_object" CHECK (("jsonb_typeof"("rubric_scores_json") = 'object'::"text")),
    CONSTRAINT "assignment_submissions_rubric_scores_size" CHECK (("octet_length"(("rubric_scores_json")::"text") < 65536))
);


ALTER TABLE "public"."assignment_submissions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_assignment_submission"("p_submission_id" "uuid", "p_marks_awarded" numeric, "p_feedback" "text", "p_status" "public"."submission_status", "p_rubric_scores" "jsonb" DEFAULT '{}'::"jsonb", "p_marks_released" boolean DEFAULT false, "p_feedback_released" boolean DEFAULT false) RETURNS SETOF "public"."assignment_submissions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_previous public.assignment_submissions%rowtype;
  v_submission public.assignment_submissions%rowtype;
begin
  if not public.can_mark_submission(p_submission_id) then
    raise exception 'submission_marking_not_allowed' using errcode = '42501';
  end if;

  if p_status not in ('submitted', 'marked', 'returned') then
    raise exception 'invalid_submission_status' using errcode = '23514';
  end if;

  if p_marks_awarded is not null
     and (p_marks_awarded < 0 or p_marks_awarded > 100)
  then
    raise exception 'marks_out_of_range' using errcode = '23514';
  end if;

  if jsonb_typeof(coalesce(p_rubric_scores, '{}'::jsonb)) <> 'object' then
    raise exception 'invalid_rubric_scores' using errcode = '23514';
  end if;

  select *
    into v_previous
  from public.assignment_submissions
  where id = p_submission_id;

  if not found then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;

  update public.assignment_submissions
  set marks_awarded = p_marks_awarded,
      feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
      status = p_status,
      rubric_scores_json = coalesce(p_rubric_scores, '{}'::jsonb),
      marks_released = coalesce(p_marks_released, false),
      feedback_released = coalesce(p_feedback_released, false),
      released_at = case
        when coalesce(p_marks_released, false)
          or coalesce(p_feedback_released, false)
        then coalesce(released_at, now())
        else null
      end
  where id = p_submission_id
  returning * into v_submission;

  if not found then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;

  perform public.log_audit_event(
    'submission.marked',
    'assignment_submission',
    v_submission.id::text,
    jsonb_build_object(
      'assignment_id', v_submission.assignment_id,
      'student_id', v_submission.student_id,
      'previous_status', v_previous.status,
      'new_status', v_submission.status,
      'previous_marks_awarded', v_previous.marks_awarded,
      'new_marks_awarded', v_submission.marks_awarded
    )
  );

  if v_previous.feedback is distinct from v_submission.feedback
     or v_previous.rubric_scores_json is distinct from v_submission.rubric_scores_json
  then
    perform public.log_audit_event(
      'feedback.updated',
      'assignment_submission',
      v_submission.id::text,
      jsonb_build_object(
        'assignment_id', v_submission.assignment_id,
        'student_id', v_submission.student_id,
        'feedback_present', v_submission.feedback is not null,
        'rubric_scores_present', v_submission.rubric_scores_json <> '{}'::jsonb
      )
    );
  end if;

  if (
    not coalesce(v_previous.marks_released, false)
    and coalesce(v_submission.marks_released, false)
  ) or (
    not coalesce(v_previous.feedback_released, false)
    and coalesce(v_submission.feedback_released, false)
  ) then
    perform public.log_audit_event(
      'result.released',
      'assignment_submission',
      v_submission.id::text,
      jsonb_build_object(
        'assignment_id', v_submission.assignment_id,
        'student_id', v_submission.student_id,
        'marks_released', v_submission.marks_released,
        'feedback_released', v_submission.feedback_released,
        'released_at', v_submission.released_at
      )
    );
  end if;

  if (
    coalesce(v_previous.marks_released, false)
    and not coalesce(v_submission.marks_released, false)
  ) or (
    coalesce(v_previous.feedback_released, false)
    and not coalesce(v_submission.feedback_released, false)
  ) then
    perform public.log_audit_event(
      'result.unreleased',
      'assignment_submission',
      v_submission.id::text,
      jsonb_build_object(
        'assignment_id', v_submission.assignment_id,
        'student_id', v_submission.student_id,
        'marks_released', v_submission.marks_released,
        'feedback_released', v_submission.feedback_released
      )
    );
  end if;

  return next v_submission;
  return;
end;
$$;


ALTER FUNCTION "public"."mark_assignment_submission"("p_submission_id" "uuid", "p_marks_awarded" numeric, "p_feedback" "text", "p_status" "public"."submission_status", "p_rubric_scores" "jsonb", "p_marks_released" boolean, "p_feedback_released" boolean) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "link" "text",
    "entity_type" "text",
    "entity_id" "uuid",
    "metadata_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "read_at" timestamp with time zone,
    "created_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."student_notifications" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") RETURNS "public"."student_notifications"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.student_notifications;
begin
  update public.student_notifications
  set is_read = true,
      read_at = coalesce(read_at, now()),
      updated_at = now()
  where id = p_notification_id
    and student_id = public.current_student_id()
  returning * into v_row;
  if not found then
    raise exception 'notification_not_found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;


ALTER FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_student_privacy_auth_banned"("p_request_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."mark_student_privacy_auth_banned"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_student_privacy_auth_deleted"("p_request_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."mark_student_privacy_auth_deleted"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_student_privacy_storage_deleted"("p_request_id" "uuid", "p_files_removed" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."mark_student_privacy_storage_deleted"("p_request_id" "uuid", "p_files_removed" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."moderate_community_text"("p_content" "text") RETURNS TABLE("state" "public"."community_moderation_state", "flags" "jsonb")
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_text text := trim(coalesce(p_content, ''));
  v_normalized text := lower(v_text);
  v_flags text[] := '{}';
  v_profanity text[] := array['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'slut', 'dick'];
  v_term text;
begin
  if v_text = '' then
    v_flags := array_append(v_flags, 'empty_content');
  end if;

  foreach v_term in array v_profanity loop
    if position(v_term in v_normalized) > 0 then
      v_flags := array_append(v_flags, 'profanity');
      exit;
    end if;
  end loop;

  if v_text ~* '(https?://\S+).*(https?://\S+)'
     or v_text ~ '(.)\1{8,}'
     or v_text ~* '\y(buy now|free money|click here)\y' then
    v_flags := array_append(v_flags, 'spam_heuristic');
  end if;

  if length(v_text) > 1800 then
    v_flags := array_append(v_flags, 'too_long');
  end if;

  return query select
    (case when array_length(v_flags, 1) > 0 then 'flagged' else 'visible' end)::public.community_moderation_state,
    to_jsonb(v_flags);
end;
$$;


ALTER FUNCTION "public"."moderate_community_text"("p_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."onboard_current_user"("p_role" "text", "p_full_name" "text", "p_phone" "text" DEFAULT NULL::"text", "p_grade" "text" DEFAULT NULL::"text", "p_school" "text" DEFAULT NULL::"text", "p_parent_name" "text" DEFAULT NULL::"text", "p_parent_contact" "text" DEFAULT NULL::"text", "p_subjects" "text"[] DEFAULT NULL::"text"[], "p_grades" "text"[] DEFAULT NULL::"text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."onboard_current_user"("p_role" "text", "p_full_name" "text", "p_phone" "text", "p_grade" "text", "p_school" "text", "p_parent_name" "text", "p_parent_contact" "text", "p_subjects" "text"[], "p_grades" "text"[]) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_room_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "moderation_state" "public"."community_moderation_state" DEFAULT 'visible'::"public"."community_moderation_state" NOT NULL,
    "moderation_flags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."community_room_messages" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_room_message"("p_room_id" "uuid", "p_content" "text") RETURNS "public"."community_room_messages"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_role public.user_role := public.current_profile_role();
  v_moderation record;
  v_message public.community_room_messages;
begin
  if v_profile_id is null
     or not (
       v_role = 'admin'
       or (v_role = 'student' and public.current_active_student_id() is not null)
       or (v_role = 'tutor' and public.current_approved_active_tutor_id() is not null)
     )
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.community_room_members
    where room_id = p_room_id and profile_id = v_profile_id
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_content, '')), '') is null then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  select * into v_moderation from public.moderate_community_text(p_content);

  insert into public.community_room_messages (room_id, profile_id, content, moderation_state, moderation_flags)
  values (p_room_id, v_profile_id, p_content, v_moderation.state, v_moderation.flags)
  returning * into v_message;

  return v_message;
end;
$$;


ALTER FUNCTION "public"."post_room_message"("p_room_id" "uuid", "p_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_privacy_deletion_receipt_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  raise exception 'privacy_deletion_receipt_is_immutable'
    using errcode = '42501';
end;
$$;


ALTER FUNCTION "public"."prevent_privacy_deletion_receipt_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_privacy_request"("p_request_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."process_privacy_request"("p_request_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."career_progress_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "goal_id" "text" NOT NULL,
    "alignment_score" integer NOT NULL,
    "reasons_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "metrics_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    CONSTRAINT "career_progress_snapshots_alignment_score_check" CHECK ((("alignment_score" >= 0) AND ("alignment_score" <= 100)))
);


ALTER TABLE "public"."career_progress_snapshots" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_career_progress_snapshot"("p_student_id" "uuid", "p_goal_id" "text", "p_recommended_subjects" "text"[]) RETURNS "public"."career_progress_snapshots"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_window_start date := current_date - 13;
  v_student_grade text;
  v_report_id uuid;
  v_topics jsonb;
  v_subject_match_count int := 0;
  v_subject_total int := coalesce(array_length(p_recommended_subjects, 1), 0);
  v_subject_coverage int := 0;
  v_average_completion int := 0;
  v_approved_sessions_14 int := 0;
  v_attendance_score int := 0;
  v_due_count int := 0;
  v_missing_count int := 0;
  v_missing_assignment_id uuid;
  v_completion_score int := 0;
  v_alignment_score int;
  v_reasons jsonb;
  v_metrics jsonb;
  v_snapshot public.career_progress_snapshots;
begin
  if public.current_student_id() is null or public.current_student_id() <> p_student_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_goal_id is null or btrim(p_goal_id) = '' then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  select grade into v_student_grade from public.students where id = p_student_id;
  if not found then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;

  select id, payload_json -> 'topicProgress'
    into v_report_id, v_topics
  from public.weekly_reports
  where student_id = p_student_id
  order by week_end desc
  limit 1;

  if v_topics is null then
    v_topics := '[]'::jsonb;
  end if;

  if v_subject_total > 0 then
    select count(*) into v_subject_match_count
    from unnest(p_recommended_subjects) as subject
    where exists (
      select 1
      from jsonb_array_elements(v_topics) as t
      where lower(t ->> 'topic') like '%' || lower(split_part(subject, ' ', 1)) || '%'
    );
    v_subject_coverage := round(100.0 * v_subject_match_count / v_subject_total)::int;
  end if;

  select coalesce(round(avg((t ->> 'completion')::numeric)), 0)::int
    into v_average_completion
  from jsonb_array_elements(v_topics) as t;

  select count(*) filter (where status = 'approved')
    into v_approved_sessions_14
  from public.sessions
  where student_id = p_student_id
    and date between v_window_start and current_date;
  v_attendance_score := least(100, v_approved_sessions_14 * 10);

  select
    count(*)::int,
    count(*) filter (where sub.id is null)::int
    into v_due_count, v_missing_count
  from public.assignments a
  left join public.assignment_submissions sub
    on sub.assignment_id = a.id and sub.student_id = p_student_id and sub.is_latest
  where a.status = 'published'
    and a.grade = v_student_grade
    and a.due_date is not null
    and a.due_date::date between v_window_start and current_date;

  select a.id into v_missing_assignment_id
  from public.assignments a
  left join public.assignment_submissions sub
    on sub.assignment_id = a.id and sub.student_id = p_student_id and sub.is_latest
  where a.status = 'published'
    and a.grade = v_student_grade
    and a.due_date is not null
    and a.due_date::date between v_window_start and current_date
    and sub.id is null
  order by a.due_date asc
  limit 1;

  v_completion_score := case when v_due_count > 0
    then round(100.0 * (v_due_count - v_missing_count) / v_due_count)::int
    else 100 end;

  v_alignment_score := greatest(0, least(100, round(
    v_subject_coverage * 0.35
    + v_average_completion * 0.30
    + v_attendance_score * 0.20
    + v_completion_score * 0.15
  )))::int;

  v_reasons := jsonb_build_array(
    jsonb_build_object(
      'key', 'subject_coverage',
      'label', 'Subject coverage across goal requirements',
      'value', v_subject_coverage,
      'detail', 'Subject coverage across goal requirements: ' || v_subject_coverage || '%.',
      'source_type', case when v_report_id is not null then 'weekly_report' else null end,
      'source_id', v_report_id
    ),
    jsonb_build_object(
      'key', 'topic_completion',
      'label', 'Average topic completion',
      'value', v_average_completion,
      'detail', 'Average topic completion from weekly report: ' || v_average_completion || '%.',
      'source_type', case when v_report_id is not null then 'weekly_report' else null end,
      'source_id', v_report_id
    ),
    jsonb_build_object(
      'key', 'session_attendance',
      'label', 'Recent session attendance',
      'value', v_attendance_score,
      'detail', v_approved_sessions_14 || ' attended session(s) in the last 14 days.',
      'source_type', null,
      'source_id', null
    ),
    jsonb_build_object(
      'key', 'assignment_completion',
      'label', 'Assignment completion vs goal subjects',
      'value', v_completion_score,
      'detail', case when v_missing_count > 0
        then v_missing_count || ' of ' || v_due_count || ' published assignment(s) due in the last 14 days have no submission.'
        else 'All published assignments due in the last 14 days have a submission.' end,
      'source_type', case when v_missing_assignment_id is not null then 'assignment' else null end,
      'source_id', v_missing_assignment_id
    )
  );

  v_metrics := jsonb_build_object(
    'subjectCoverage', v_subject_coverage,
    'averageCompletion', v_average_completion,
    'attendanceScore', v_attendance_score,
    'completionScore', v_completion_score,
    'assignmentsDue14', v_due_count,
    'assignmentsMissing14', v_missing_count
  );

  insert into public.career_progress_snapshots (student_id, goal_id, alignment_score, reasons_json, metrics_json)
  values (p_student_id, p_goal_id, v_alignment_score, v_reasons, v_metrics)
  returning * into v_snapshot;

  return v_snapshot;
end;
$$;


ALTER FUNCTION "public"."recompute_career_progress_snapshot"("p_student_id" "uuid", "p_goal_id" "text", "p_recommended_subjects" "text"[]) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_score_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "score_date" "date" NOT NULL,
    "risk_score" integer NOT NULL,
    "momentum_score" integer NOT NULL,
    "reasons_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "metrics_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "recommended_actions_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    CONSTRAINT "student_score_snapshots_momentum_score_check" CHECK ((("momentum_score" >= 0) AND ("momentum_score" <= 100))),
    CONSTRAINT "student_score_snapshots_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "public"."student_score_snapshots" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_student_risk_snapshot"("p_student_id" "uuid", "p_score_date" "date" DEFAULT CURRENT_DATE) RETURNS "public"."student_score_snapshots"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_window_start date := p_score_date - 13;
  v_student_grade text;
  v_approved_sessions int := 0;
  v_rejected_sessions int := 0;
  v_flagged_session_id uuid;
  v_due_count int := 0;
  v_missing_count int := 0;
  v_missing_assignment_id uuid;
  v_missing_assignment_title text;
  v_recent_marks_avg numeric;
  v_prior_marks_avg numeric;
  v_low_submission_id uuid;
  v_weak_progress_id uuid;
  v_weak_topic text;
  v_weak_score numeric;
  v_previous_risk int;
  v_previous_momentum int;
  v_attendance_risk int := 0;
  v_completion_risk int := 0;
  v_marks_risk int := 0;
  v_topic_risk int := 0;
  v_risk_score int;
  v_momentum_score int;
  v_reasons jsonb := '[]'::jsonb;
  v_recommended_actions jsonb := '[]'::jsonb;
  v_metrics jsonb;
  v_snapshot public.student_score_snapshots;
begin
  if not coalesce(public.is_platform_admin() or public.current_student_id() = p_student_id, false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select grade into v_student_grade from public.students where id = p_student_id;
  if not found then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;

  select
    count(*) filter (where status = 'approved'),
    count(*) filter (where status = 'rejected')
    into v_approved_sessions, v_rejected_sessions
  from public.sessions
  where student_id = p_student_id
    and date between v_window_start and p_score_date;

  select id into v_flagged_session_id
  from public.sessions
  where student_id = p_student_id
    and status = 'rejected'
    and date between v_window_start and p_score_date
  order by date desc
  limit 1;

  select
    count(*)::int,
    count(*) filter (where sub.id is null)::int
    into v_due_count, v_missing_count
  from public.assignments a
  left join public.assignment_submissions sub
    on sub.assignment_id = a.id and sub.student_id = p_student_id and sub.is_latest
  where a.status = 'published'
    and a.grade = v_student_grade
    and a.due_date is not null
    and a.due_date::date between v_window_start and p_score_date;

  select a.id, a.title
    into v_missing_assignment_id, v_missing_assignment_title
  from public.assignments a
  left join public.assignment_submissions sub
    on sub.assignment_id = a.id and sub.student_id = p_student_id and sub.is_latest
  where a.status = 'published'
    and a.grade = v_student_grade
    and a.due_date is not null
    and a.due_date::date between v_window_start and p_score_date
    and sub.id is null
  order by a.due_date asc
  limit 1;

  with recent_marks as (
    select id, marks_awarded,
           row_number() over (order by submitted_at desc) as rn
    from public.assignment_submissions
    where student_id = p_student_id
      and marks_released = true
      and marks_awarded is not null
  )
  select
    avg(marks_awarded) filter (where rn <= 3),
    avg(marks_awarded) filter (where rn between 4 and 6)
    into v_recent_marks_avg, v_prior_marks_avg
  from recent_marks;

  select id into v_low_submission_id
  from (
    select id, marks_awarded,
           row_number() over (order by submitted_at desc) as rn
    from public.assignment_submissions
    where student_id = p_student_id
      and marks_released = true
      and marks_awarded is not null
  ) recent
  where rn <= 6
  order by marks_awarded asc
  limit 1;

  select id, topic, score
    into v_weak_progress_id, v_weak_topic, v_weak_score
  from public.student_progress
  where student_id = p_student_id
    and recorded_at >= (p_score_date::timestamptz - interval '60 day')
  order by score asc, topic asc
  limit 1;

  select risk_score, momentum_score
    into v_previous_risk, v_previous_momentum
  from public.student_score_snapshots
  where student_id = p_student_id
    and score_date < p_score_date
  order by score_date desc
  limit 1;

  v_attendance_risk := case when (v_approved_sessions + v_rejected_sessions) > 0
    then round(100.0 * v_rejected_sessions / (v_approved_sessions + v_rejected_sessions))
    else 0 end;

  v_completion_risk := case when v_due_count > 0
    then round(100.0 * v_missing_count / v_due_count)
    else 0 end;

  v_marks_risk := case when v_recent_marks_avg is not null
    then greatest(0, least(100, round(100 - v_recent_marks_avg)))
    else 0 end;

  v_topic_risk := case when v_weak_score is not null
    then greatest(0, least(100, round(100 - v_weak_score)))
    else 0 end;

  v_risk_score := greatest(0, least(100, round(
    v_attendance_risk * 0.30
    + v_completion_risk * 0.30
    + v_marks_risk * 0.20
    + v_topic_risk * 0.20
  )))::int;

  v_momentum_score := greatest(0, least(100, round(
    (100 - v_attendance_risk) * 0.30
    + (100 - v_completion_risk) * 0.30
    + coalesce(v_recent_marks_avg, 70) * 0.20
    + coalesce(100 - v_weak_score, 70) * 0.20
  )))::int;

  if v_previous_risk is not null then
    v_risk_score := greatest(0, least(100, round(0.34 * v_risk_score + 0.66 * v_previous_risk)))::int;
  end if;
  if v_previous_momentum is not null then
    v_momentum_score := greatest(0, least(100, round(0.34 * v_momentum_score + 0.66 * v_previous_momentum)))::int;
  end if;

  if v_rejected_sessions > 0 and v_attendance_risk >= 40 then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'key', 'attendance',
      'label', 'Attendance risk elevated',
      'impact', case when v_attendance_risk >= 60 then 'HIGH' else 'MEDIUM' end,
      'value', v_attendance_risk,
      'detail', v_rejected_sessions || ' missed/cancelled session(s) in the last 14 days.',
      'source_type', 'session',
      'source_id', v_flagged_session_id
    ));
  end if;

  if v_missing_count > 0 then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'key', 'assignment_completion',
      'label', 'Assignment(s) not yet submitted',
      'impact', case when v_completion_risk >= 50 then 'HIGH' else 'MEDIUM' end,
      'value', v_completion_risk,
      'detail', v_missing_count || ' of ' || v_due_count || ' published assignment(s) due in the last 14 days have no submission'
        || case when v_missing_assignment_title is not null then ' (earliest: "' || v_missing_assignment_title || '")' else '' end || '.',
      'source_type', 'assignment',
      'source_id', v_missing_assignment_id
    ));
    v_recommended_actions := v_recommended_actions || jsonb_build_array(jsonb_build_object(
      'label', 'Follow up on the missing assignment' || case when v_missing_assignment_title is not null then ' "' || v_missing_assignment_title || '"' else '' end,
      'href', '/dashboard/'
    ));
  end if;

  if v_recent_marks_avg is not null and v_marks_risk >= 40 then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'key', 'marks_trend',
      'label', 'Recent marks are low',
      'impact', case when v_marks_risk >= 60 then 'HIGH' else 'MEDIUM' end,
      'value', round(v_recent_marks_avg),
      'detail', 'Average of the most recent released mark(s) is ' || round(v_recent_marks_avg) || '%.',
      'source_type', 'assignment_submission',
      'source_id', v_low_submission_id
    ));
  end if;

  if v_weak_score is not null and v_topic_risk >= 40 then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'key', 'topic_weakness',
      'label', 'Weak topic identified',
      'impact', case when v_topic_risk >= 60 then 'HIGH' else 'MEDIUM' end,
      'value', v_weak_score,
      'detail', '"' || v_weak_topic || '" scored ' || v_weak_score || '% in the last 60 days.',
      'source_type', 'student_progress',
      'source_id', v_weak_progress_id
    ));
    v_recommended_actions := v_recommended_actions || jsonb_build_array(jsonb_build_object(
      'label', 'Review "' || v_weak_topic || '" with your tutor',
      'href', '/dashboard/'
    ));
  end if;

  if v_attendance_risk >= 40 then
    v_recommended_actions := v_recommended_actions || jsonb_build_array(jsonb_build_object(
      'label', 'Book/confirm the next tutoring session',
      'href', '/dashboard/'
    ));
  end if;

  if v_due_count > 0 and v_missing_count = 0 and v_recent_marks_avg is not null and v_marks_risk < 40
     and (v_weak_score is null or v_topic_risk < 40) then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'key', 'momentum_positive',
      'label', 'Strong momentum signal',
      'impact', 'POSITIVE',
      'value', v_momentum_score,
      'detail', 'All recent assignments submitted and released marks are trending well.',
      'source_type', null,
      'source_id', null
    ));
  end if;

  if jsonb_array_length(v_reasons) = 0 then
    v_reasons := jsonb_build_array(jsonb_build_object(
      'key', 'stable',
      'label', 'Stable learning pattern',
      'impact', 'LOW',
      'value', v_momentum_score,
      'detail', 'No major negative shifts detected in this period.',
      'source_type', null,
      'source_id', null
    ));
  end if;

  if jsonb_array_length(v_recommended_actions) = 0 then
    v_recommended_actions := jsonb_build_array(jsonb_build_object(
      'label', 'Keep up the current routine',
      'href', '/dashboard/'
    ));
  end if;

  v_metrics := jsonb_build_object(
    'approvedSessions14', v_approved_sessions,
    'rejectedSessions14', v_rejected_sessions,
    'assignmentsDue14', v_due_count,
    'assignmentsMissing14', v_missing_count,
    'recentMarksAverage', v_recent_marks_avg,
    'priorMarksAverage', v_prior_marks_avg,
    'weakestTopicScore', v_weak_score
  );

  insert into public.student_score_snapshots
    (student_id, score_date, risk_score, momentum_score, reasons_json, metrics_json, recommended_actions_json)
  values
    (p_student_id, p_score_date, v_risk_score, v_momentum_score, v_reasons, v_metrics, v_recommended_actions)
  on conflict (student_id, score_date)
  do update set
    risk_score = excluded.risk_score,
    momentum_score = excluded.momentum_score,
    reasons_json = excluded.reasons_json,
    metrics_json = excluded.metrics_json,
    recommended_actions_json = excluded.recommended_actions_json,
    created_at = now()
  returning * into v_snapshot;

  return v_snapshot;
end;
$$;


ALTER FUNCTION "public"."recompute_student_risk_snapshot"("p_student_id" "uuid", "p_score_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_audit_event"("p_action" "text", "p_entity_type" "text", "p_entity_id" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_role public.user_role := public.current_profile_role();
begin
  if v_role is null then
    raise exception 'audit_actor_required' using errcode = '42501';
  end if;

  if v_role = 'admin' then
    return public.log_audit_event(p_action, p_entity_type, p_entity_id, p_metadata);
  end if;

  if v_role = 'tutor'
     and public.current_approved_active_tutor_id() is not null
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


ALTER FUNCTION "public"."record_audit_event"("p_action" "text", "p_entity_type" "text", "p_entity_id" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."baseline_assessments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "subject" "text" NOT NULL,
    "grade" "text",
    "score" numeric(8,2) NOT NULL,
    "total" numeric(8,2) NOT NULL,
    "percentage" numeric(5,2) NOT NULL,
    "level_band" "text",
    "cognitive_breakdown_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "topic_breakdown_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "recommended_next_steps_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "completed_at" timestamp with time zone NOT NULL,
    "created_by_user_id" "uuid",
    "source_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "baseline_assessments_percentage_check" CHECK ((("percentage" >= (0)::numeric) AND ("percentage" <= (100)::numeric))),
    CONSTRAINT "baseline_assessments_score_check" CHECK ((("score" >= (0)::numeric) AND ("total" > (0)::numeric) AND ("score" <= "total")))
);


ALTER TABLE "public"."baseline_assessments" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_baseline_assessment"("p_student_id" "uuid", "p_subject" "text", "p_score" numeric, "p_total" numeric, "p_grade" "text" DEFAULT NULL::"text", "p_level_band" "text" DEFAULT NULL::"text", "p_cognitive_breakdown" "jsonb" DEFAULT '{}'::"jsonb", "p_topic_breakdown" "jsonb" DEFAULT '{}'::"jsonb", "p_recommended_next_steps" "jsonb" DEFAULT '[]'::"jsonb", "p_completed_at" timestamp with time zone DEFAULT "now"(), "p_source_type" "public"."baseline_source_type" DEFAULT 'manual'::"public"."baseline_source_type") RETURNS "public"."baseline_assessments"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_percentage numeric;
  v_row public.baseline_assessments;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_score < 0 or p_score > 100000 or p_total <= 0 or p_total > 100000 then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  v_percentage := round((p_score / p_total) * 100, 2);

  insert into public.baseline_assessments
    (student_id, subject, grade, score, total, percentage, level_band,
     cognitive_breakdown_json, topic_breakdown_json, recommended_next_steps_json,
     completed_at, created_by, source_type)
  values
    (p_student_id, p_subject, p_grade, p_score, p_total, v_percentage, p_level_band,
     p_cognitive_breakdown, p_topic_breakdown, p_recommended_next_steps,
     p_completed_at, public.current_profile_id(), p_source_type)
  returning * into v_row;

  perform public.create_student_notification(
    p_student_id,
    'baseline_assessment_created',
    'Baseline assessment ready',
    p_subject || ' baseline assessment has been recorded.',
    '/dashboard/',
    'baseline_assessment',
    v_row.id,
    '{}'::jsonb
  );

  return v_row;
end;
$$;


ALTER FUNCTION "public"."record_baseline_assessment"("p_student_id" "uuid", "p_subject" "text", "p_score" numeric, "p_total" numeric, "p_grade" "text", "p_level_band" "text", "p_cognitive_breakdown" "jsonb", "p_topic_breakdown" "jsonb", "p_recommended_next_steps" "jsonb", "p_completed_at" timestamp with time zone, "p_source_type" "public"."baseline_source_type") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_student_privacy_deletion_error"("p_request_id" "uuid", "p_stage" "text", "p_error" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."record_student_privacy_deletion_error"("p_request_id" "uuid", "p_stage" "text", "p_error" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tutor_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "storage_key" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "file_size_bytes" integer NOT NULL,
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "verification_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "notes" "text",
    CONSTRAINT "tutor_documents_status_check" CHECK (("verification_status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text"]))),
    CONSTRAINT "tutor_documents_type_check" CHECK (("document_type" = ANY (ARRAY['identity'::"text", 'cv'::"text", 'qualification'::"text", 'additional'::"text"])))
);


ALTER TABLE "public"."tutor_documents" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_tutor_document"("p_document_type" "text", "p_storage_key" "text", "p_original_filename" "text", "p_mime_type" "text", "p_file_size_bytes" integer) RETURNS "public"."tutor_documents"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tutor_id uuid := public.current_tutor_onboarding_id();
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


ALTER FUNCTION "public"."record_tutor_document"("p_document_type" "text", "p_storage_key" "text", "p_original_filename" "text", "p_mime_type" "text", "p_file_size_bytes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_session"("p_session_id" "uuid", "p_reason" "text") RETURNS "public"."sessions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_current public.sessions%rowtype;
  v_updated public.sessions%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_subject text;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  select * into v_current
  from public.sessions
  where id = p_session_id;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;

  if public.session_date_pay_period_locked(v_current.date) then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  if v_current.status <> 'submitted' then
    raise exception 'only_submitted_rejectable';
  end if;

  update public.sessions set
    status = 'rejected'
  where id = p_session_id
  returning * into v_updated;

  select subj.name into v_subject
  from public.tutor_student_allocations alloc
  left join public.subjects subj on subj.id = alloc.subject_id
  where alloc.id = v_current.tutor_student_allocation_id;
  perform public.create_student_notification(
    v_current.student_id,
    'session_rejected',
    'Session rejected',
    coalesce(v_subject, 'Your session') || ' on ' || v_current.date::text || ' was rejected.',
    '/dashboard/',
    'session',
    p_session_id,
    '{}'::jsonb
  );
  perform public.insert_session_history(
    p_session_id, 'reject', to_jsonb(v_current),
    to_jsonb(v_updated) || jsonb_build_object('reject_reason', v_reason)
  );
  return v_updated;
end;
$$;


ALTER FUNCTION "public"."reject_session"("p_session_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tutor_availability_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "mode" "text" DEFAULT 'online'::"text" NOT NULL,
    "notes" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tutor_availability_slots_check" CHECK (("end_time" > "start_time")),
    CONSTRAINT "tutor_availability_slots_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."tutor_availability_slots" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_tutor_availability"("p_slots" "jsonb") RETURNS SETOF "public"."tutor_availability_slots"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tutor_id uuid := public.current_tutor_onboarding_id();
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


ALTER FUNCTION "public"."replace_tutor_availability"("p_slots" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_retention_cleanup"("p_apply" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_authorized'
      using errcode = '42501';
  end if;

  return private.execute_retention_cleanup(p_apply);
end;
$$;


ALTER FUNCTION "public"."run_retention_cleanup"("p_apply" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."run_retention_cleanup"("p_apply" boolean) IS 'Platform-admin-only retention dry-run/apply RPC. Requires AAL2.';



CREATE OR REPLACE FUNCTION "public"."run_retention_cleanup_scheduled"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role_jwt_required'
      using errcode = '42501';
  end if;

  return private.execute_retention_cleanup(true);
end;
$$;


ALTER FUNCTION "public"."run_retention_cleanup_scheduled"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."run_retention_cleanup_scheduled"() IS 'Service-role-only scheduled retention apply RPC.';



CREATE OR REPLACE FUNCTION "public"."session_date_pay_period_locked"("p_date" "date") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_locked boolean;
begin
  select (p.status = 'locked') into v_locked
  from public.pay_periods p
  where p.period_start_date = date_trunc('week', p_date::timestamp)::date;
  return coalesce(v_locked, false);
end;
$$;


ALTER FUNCTION "public"."session_date_pay_period_locked"("p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."session_within_allocation_window"("p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_start_date" "date", "p_end_date" "date", "p_allowed_days" "jsonb", "p_allowed_time_ranges" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_day int;
  v_in_range boolean;
begin
  if p_end_time <= p_start_time then
    return false;
  end if;

  if p_start_date is not null and p_date < p_start_date then
    return false;
  end if;

  if p_end_date is not null and p_date > p_end_date then
    return false;
  end if;

  v_day := extract(dow from p_date)::int;

  if p_allowed_days is not null
     and jsonb_typeof(p_allowed_days) = 'array'
     and jsonb_array_length(p_allowed_days) > 0 then
    if not exists (
      select 1 from jsonb_array_elements(p_allowed_days) elem
      where (elem#>>'{}')::int = v_day
    ) then
      return false;
    end if;
  end if;

  if p_allowed_time_ranges is not null
     and jsonb_typeof(p_allowed_time_ranges) = 'array'
     and jsonb_array_length(p_allowed_time_ranges) > 0 then
    select exists (
      select 1 from jsonb_array_elements(p_allowed_time_ranges) r
      where p_start_time >= (r->>'start')::time
        and p_end_time <= (r->>'end')::time
    ) into v_in_range;
    if not v_in_range then
      return false;
    end if;
  end if;

  return true;
end;
$$;


ALTER FUNCTION "public"."session_within_allocation_window"("p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_start_date" "date", "p_end_date" "date", "p_allowed_days" "jsonb", "p_allowed_time_ranges" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_assignment_submission"("p_assignment_id" "uuid", "p_submission_id" "uuid", "p_storage_key" "text", "p_file_url" "text", "p_original_filename" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_text_answer" "text") RETURNS TABLE("submission_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_student_id uuid := public.current_student_id();
  v_assignment public.assignments%rowtype;
  v_existing_submission public.assignment_submissions%rowtype;
  v_submission_id uuid := p_submission_id;
  v_next_version integer;
  v_storage_key text := nullif(btrim(coalesce(p_storage_key, '')), '');
  v_file_url text := nullif(btrim(coalesce(p_file_url, '')), '');
  v_original_filename text := nullif(btrim(coalesce(p_original_filename, '')), '');
  v_mime_type text := nullif(btrim(coalesce(p_mime_type, '')), '');
  v_text_answer text := nullif(btrim(coalesce(p_text_answer, '')), '');
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then
    raise exception 'only_students_can_submit' using errcode = '42501';
  end if;
  if v_submission_id is null then
    raise exception 'submission_id_required' using errcode = '23502';
  end if;
  if v_text_answer is null and v_storage_key is null then
    raise exception 'submission_content_required' using errcode = '23514';
  end if;
  if v_storage_key is distinct from v_file_url then
    raise exception 'invalid_submission_file_reference' using errcode = '23514';
  end if;
  if v_storage_key is null
     and (v_original_filename is not null or v_mime_type is not null or p_size_bytes is not null)
  then
    raise exception 'invalid_submission_file_metadata' using errcode = '23514';
  end if;
  if p_size_bytes is not null and p_size_bytes < 0 then
    raise exception 'invalid_submission_file_size' using errcode = '23514';
  end if;
  if v_storage_key is not null
     and v_storage_key !~ ('^' || v_student_id::text || '/' || p_assignment_id::text || '/' || v_submission_id::text || '/submission\.[A-Za-z0-9]+$')
  then
    raise exception 'invalid_submission_storage_path' using errcode = '42501';
  end if;

  -- Serialize both UUID replays and version allocation. The UUID lock protects
  -- against the same attempt being raced across identities/assignments; the
  -- student-assignment lock preserves the one-latest-version invariant.
  perform pg_advisory_xact_lock(
    hashtextextended('assignment-submission-id:' || v_submission_id::text, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('assignment-submission-version:' || p_assignment_id::text || ':' || v_student_id::text, 0)
  );

  select s.* into v_existing_submission
  from public.assignment_submissions s
  where s.id = v_submission_id;

  if found then
    if v_existing_submission.assignment_id <> p_assignment_id
       or v_existing_submission.student_id <> v_student_id
    then
      raise exception 'submission_id_conflict' using errcode = '23505';
    end if;

    if v_existing_submission.storage_key is distinct from v_storage_key
       or v_existing_submission.file_url is distinct from v_file_url
       or v_existing_submission.original_filename is distinct from v_original_filename
       or v_existing_submission.mime_type is distinct from v_mime_type
       or v_existing_submission.size_bytes is distinct from p_size_bytes
       or v_existing_submission.text_answer is distinct from v_text_answer
    then
      raise exception 'submission_retry_payload_mismatch' using errcode = '23505';
    end if;

    -- A prior transaction committed and only its response was lost. Return the
    -- original row without creating a version or duplicating audit events.
    return query select v_existing_submission.id;
    return;
  end if;

  select a.* into v_assignment
  from public.assignments a
  where a.id = p_assignment_id;

  if not found then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;
  if v_assignment.status <> 'published'
     or v_assignment.organization_id is distinct from public.current_student_org_id()
  then
    raise exception 'assignment_not_open_for_submission' using errcode = '42501';
  end if;

  select coalesce(max(s.version_number), 0) + 1
  into v_next_version
  from public.assignment_submissions s
  where s.assignment_id = p_assignment_id
    and s.student_id = v_student_id;

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
    v_storage_key,
    v_file_url,
    v_original_filename,
    v_mime_type,
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
      'file_uploaded', v_storage_key is not null,
      'text_answer_provided', v_text_answer is not null
    )
  );

  if v_next_version > 1 and v_storage_key is not null then
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
$_$;


ALTER FUNCTION "public"."submit_assignment_submission"("p_assignment_id" "uuid", "p_submission_id" "uuid", "p_storage_key" "text", "p_file_url" "text", "p_original_filename" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_text_answer" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_session"("p_session_id" "uuid") RETURNS "public"."sessions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tutor_id uuid := public.current_tutor_id();
  v_current public.sessions%rowtype;
  v_updated public.sessions%rowtype;
begin
  if v_tutor_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.tutors t where t.id = v_tutor_id and t.status = 'active' and t.approval_status = 'approved') then
    raise exception 'tutor_not_active' using errcode = '42501';
  end if;

  select * into v_current
  from public.sessions
  where id = p_session_id and tutor_id = v_tutor_id;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;

  if v_current.status <> 'draft' then
    raise exception 'only_draft_submittable';
  end if;

  if public.session_date_pay_period_locked(v_current.date) then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  update public.sessions set
    status = 'submitted',
    submitted_at = now()
  where id = p_session_id
  returning * into v_updated;

  perform public.create_student_notification(
    v_current.student_id,
    'session_report_submitted',
    'Session notes submitted',
    'Your tutor submitted the latest session summary for review.',
    '/dashboard/',
    'session',
    p_session_id,
    '{}'::jsonb
  );
  perform public.insert_session_history(p_session_id, 'submit', to_jsonb(v_current), to_jsonb(v_updated));
  return v_updated;
end;
$$;


ALTER FUNCTION "public"."submit_session"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_session_report"("p_session_id" "uuid", "p_attendance_status" "text", "p_topics_covered" "text", "p_learner_struggles" "text", "p_homework_assigned" "text", "p_tutor_private_notes" "text", "p_student_summary" "text") RETURNS "public"."sessions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tutor_id uuid := public.current_tutor_id();
  v_current public.sessions%rowtype;
  v_updated public.sessions%rowtype;
  v_attendance text := nullif(btrim(coalesce(p_attendance_status, '')), '');
  v_summary text := nullif(btrim(coalesce(p_student_summary, '')), '');
begin
  if v_tutor_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.tutors t where t.id = v_tutor_id and t.status = 'active' and t.approval_status = 'approved') then
    raise exception 'tutor_not_active' using errcode = '42501';
  end if;

  select * into v_current
  from public.sessions
  where id = p_session_id and tutor_id = v_tutor_id;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;

  if v_current.status <> 'draft' then
    raise exception 'only_draft_editable';
  end if;

  if v_attendance is not null and v_attendance not in ('present', 'absent', 'late', 'excused') then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  update public.sessions set
    attendance_status = v_attendance,
    topics_covered = nullif(btrim(coalesce(p_topics_covered, '')), ''),
    learner_struggles = nullif(btrim(coalesce(p_learner_struggles, '')), ''),
    homework_assigned = nullif(btrim(coalesce(p_homework_assigned, '')), ''),
    tutor_private_notes = nullif(btrim(coalesce(p_tutor_private_notes, '')), ''),
    student_summary = v_summary,
    notes = coalesce(v_summary, notes)
  where id = p_session_id and tutor_id = v_tutor_id
  returning * into v_updated;

  perform public.create_student_notification(
    v_current.student_id,
    'session_report_updated',
    'Session summary updated',
    'Your tutor added notes and learning feedback for the latest session.',
    '/dashboard/',
    'session',
    p_session_id,
    '{}'::jsonb
  );
  perform public.insert_session_history(p_session_id, 'report_update', to_jsonb(v_current), to_jsonb(v_updated));
  return v_updated;
end;
$$;


ALTER FUNCTION "public"."submit_session_report"("p_session_id" "uuid", "p_attendance_status" "text", "p_topics_covered" "text", "p_learner_struggles" "text", "p_homework_assigned" "text", "p_tutor_private_notes" "text", "p_student_summary" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_tutor_application"() RETURNS "public"."tutor_applications"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tutor_id uuid := public.current_tutor_onboarding_id();
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


ALTER FUNCTION "public"."submit_tutor_application"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_profile_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."sync_profile_identity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_released_submission_progress"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_subject_id uuid;
  v_title text;
begin
  -- Remove the old derived row first. This makes mark edits, status changes, and
  -- unrelease operations atomic from the perspective of student_progress.
  delete from public.student_progress
  where source_submission_id = new.id;

  if new.status = 'marked'
     and new.marks_released is true
     and new.marks_awarded is not null
  then
    select a.subject_id, coalesce(a.title, 'Marked assignment')
      into v_subject_id, v_title
    from public.assignments a
    where a.id = new.assignment_id;

    if not found then
      raise exception 'assignment_not_found'
        using errcode = 'P0002';
    end if;

    insert into public.student_progress (
      student_id,
      subject_id,
      topic,
      score,
      cognitive_level,
      recorded_at,
      source_submission_id
    )
    values (
      new.student_id,
      v_subject_id,
      v_title,
      new.marks_awarded,
      null,
      coalesce(new.released_at, now()),
      new.id
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_released_submission_progress"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_released_submission_progress"() IS 'DATA-01 authoritative release gate for assignment-derived student progress.';



CREATE OR REPLACE FUNCTION "public"."update_learning_goal"("p_goal_id" "uuid", "p_title" "text" DEFAULT NULL::"text", "p_description" "text" DEFAULT NULL::"text", "p_category" "public"."learning_goal_category" DEFAULT NULL::"public"."learning_goal_category", "p_subject" "text" DEFAULT NULL::"text", "p_target_value" numeric DEFAULT NULL::numeric, "p_current_value" numeric DEFAULT NULL::numeric, "p_due_date" "date" DEFAULT NULL::"date", "p_status" "public"."learning_goal_status" DEFAULT NULL::"public"."learning_goal_status", "p_visible_to_student" boolean DEFAULT NULL::boolean, "p_visible_to_tutor" boolean DEFAULT NULL::boolean) RETURNS "public"."learning_goals"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_current public.learning_goals;
  v_row public.learning_goals;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_current from public.learning_goals where id = p_goal_id;
  if not found then
    raise exception 'goal_not_found' using errcode = 'P0002';
  end if;

  update public.learning_goals
  set title = coalesce(p_title, title),
      description = coalesce(p_description, description),
      category = coalesce(p_category, category),
      subject = coalesce(p_subject, subject),
      target_value = coalesce(p_target_value, target_value),
      current_value = coalesce(p_current_value, current_value),
      due_date = coalesce(p_due_date, due_date),
      status = coalesce(p_status, status),
      visible_to_student = coalesce(p_visible_to_student, visible_to_student),
      visible_to_tutor = coalesce(p_visible_to_tutor, visible_to_tutor),
      updated_at = now()
  where id = p_goal_id
  returning * into v_row;

  if v_row.visible_to_student then
    perform public.create_student_notification(
      v_current.student_id,
      case when p_status = 'completed' then 'learning_goal_completed' else 'learning_goal_updated' end,
      case when p_status = 'completed' then 'Goal completed' else 'Goal updated' end,
      case when p_status = 'completed'
        then v_row.title || ' is now marked as completed.'
        else v_row.title || ' has been updated.' end,
      '/dashboard/',
      'learning_goal',
      v_row.id,
      '{}'::jsonb
    );
  end if;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."update_learning_goal"("p_goal_id" "uuid", "p_title" "text", "p_description" "text", "p_category" "public"."learning_goal_category", "p_subject" "text", "p_target_value" numeric, "p_current_value" numeric, "p_due_date" "date", "p_status" "public"."learning_goal_status", "p_visible_to_student" boolean, "p_visible_to_tutor" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_session"("p_session_id" "uuid", "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_mode" "text", "p_location" "text", "p_notes" "text") RETURNS "public"."sessions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tutor_id uuid := public.current_tutor_id();
  v_current public.sessions%rowtype;
  v_alloc public.tutor_student_allocations%rowtype;
  v_date date;
  v_start time;
  v_end time;
  v_mode text;
  v_minutes int;
  v_updated public.sessions%rowtype;
begin
  if v_tutor_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.tutors t where t.id = v_tutor_id and t.status = 'active' and t.approval_status = 'approved') then
    raise exception 'tutor_not_active' using errcode = '42501';
  end if;

  select * into v_current
  from public.sessions
  where id = p_session_id and tutor_id = v_tutor_id;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;

  if v_current.status <> 'draft' then
    raise exception 'only_draft_editable';
  end if;

  v_date := coalesce(p_date, v_current.date);
  v_start := coalesce(p_start_time, v_current.start_time);
  v_end := coalesce(p_end_time, v_current.end_time);
  v_mode := coalesce(nullif(btrim(coalesce(p_mode, '')), ''), v_current.mode);

  if char_length(v_mode) < 1 or char_length(v_mode) > 40 then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  v_minutes := (extract(epoch from (v_end - v_start)) / 60)::int;
  if v_minutes <= 0 then
    raise exception 'invalid_duration_minutes' using errcode = '23514';
  end if;

  if public.session_date_pay_period_locked(v_date) then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  select * into v_alloc
  from public.tutor_student_allocations
  where id = v_current.tutor_student_allocation_id;
  if not found then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;

  if v_alloc.status <> 'active' then
    raise exception 'assignment_inactive' using errcode = '42501';
  end if;

  if not public.session_within_allocation_window(
       v_date, v_start, v_end,
       v_alloc.start_date, v_alloc.end_date,
       v_alloc.allowed_days_json, v_alloc.allowed_time_ranges_json) then
    raise exception 'outside_assignment_window' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.sessions
    where tutor_id = v_tutor_id
      and date = v_date
      and id <> p_session_id
      and not (end_time <= v_start or start_time >= v_end)
  ) then
    raise exception 'overlapping_session' using errcode = '23505';
  end if;

  update public.sessions set
    date = v_date,
    start_time = v_start,
    end_time = v_end,
    duration_minutes = v_minutes,
    mode = v_mode,
    location = coalesce(nullif(btrim(coalesce(p_location, '')), ''), v_current.location),
    notes = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), v_current.notes)
  where id = p_session_id
  returning * into v_updated;

  perform public.insert_session_history(p_session_id, 'edit', to_jsonb(v_current), to_jsonb(v_updated));
  return v_updated;
end;
$$;


ALTER FUNCTION "public"."update_session"("p_session_id" "uuid", "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_mode" "text", "p_location" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_tutor_application"("p_personal_details" "jsonb", "p_subjects" "jsonb", "p_grades" "jsonb", "p_teaching_preferences" "jsonb", "p_experience" "text", "p_availability_notes" "text") RETURNS "public"."tutor_applications"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tutor_id uuid := public.current_tutor_onboarding_id();
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


ALTER FUNCTION "public"."upsert_tutor_application"("p_personal_details" "jsonb", "p_subjects" "jsonb", "p_grades" "jsonb", "p_teaching_preferences" "jsonb", "p_experience" "text", "p_availability_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_tutor_document"("p_document_id" "uuid", "p_status" "text", "p_notes" "text") RETURNS "public"."tutor_documents"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."verify_tutor_document"("p_document_id" "uuid", "p_status" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_volunteer_log"("p_log_id" "uuid", "p_status" "public"."volunteer_log_status", "p_admin_note" "text" DEFAULT NULL::"text") RETURNS "public"."volunteer_logs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.volunteer_logs;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_status not in ('verified', 'rejected') then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  update public.volunteer_logs
  set status = p_status,
      admin_note = p_admin_note,
      verified_by = public.current_profile_id(),
      verified_at = now(),
      updated_at = now()
  where id = p_log_id
    and status in ('submitted', 'signed_up', 'rejected')
  returning * into v_row;

  if not found then
    raise exception 'volunteer_log_not_found' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."verify_volunteer_log"("p_log_id" "uuid", "p_status" "public"."volunteer_log_status", "p_admin_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."void_adjustment"("p_adjustment_id" "uuid", "p_reason" "text") RETURNS "public"."adjustments"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_adj public.adjustments;
  v_period_status public.pay_period_status;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_adj from public.adjustments where id = p_adjustment_id;
  if not found then
    raise exception 'adjustment_not_found' using errcode = 'P0002';
  end if;

  select status into v_period_status from public.pay_periods where id = v_adj.pay_period_id;
  if v_period_status = 'locked' then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  if v_adj.voided_at is not null then
    raise exception 'adjustment_already_voided' using errcode = '42501';
  end if;

  update public.adjustments
  set voided_at = now(),
      voided_by = public.current_profile_id(),
      void_reason = coalesce(p_reason, 'deleted_by_admin')
  where id = p_adjustment_id
  returning * into v_adj;

  return v_adj;
end;
$$;


ALTER FUNCTION "public"."void_adjustment"("p_adjustment_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "subject_id" "uuid",
    "grade" "text",
    "due_date" timestamp with time zone,
    "created_by" "uuid",
    "status" "public"."assignment_status" DEFAULT 'draft'::"public"."assignment_status" NOT NULL,
    "attachment_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rubric_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "memo_url" "text",
    CONSTRAINT "assignments_rubric_json_array" CHECK (("jsonb_typeof"("rubric_json") = 'array'::"text")),
    CONSTRAINT "assignments_rubric_json_size" CHECK (("octet_length"(("rubric_json")::"text") < 65536))
);


ALTER TABLE "public"."assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "actor_role" "text",
    "action" "text" NOT NULL,
    "entity_type" "text",
    "entity_id" "text",
    "meta_json" "jsonb",
    "ip" "text",
    "user_agent" "text",
    "correlation_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "status" "public"."record_status" DEFAULT 'active'::"public"."record_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."class_enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "subject_id" "uuid",
    "grade" "text",
    "location" "text",
    "day_of_week" "text",
    "start_time" time without time zone,
    "end_time" time without time zone,
    "ngo_partner_id" "uuid",
    "name" "text" DEFAULT 'Class'::"text" NOT NULL,
    "status" "public"."record_status" DEFAULT 'active'::"public"."record_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "classes_time_range" CHECK ((("end_time" IS NULL) OR ("start_time" IS NULL) OR ("end_time" > "start_time")))
);


ALTER TABLE "public"."classes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "is_verified" boolean DEFAULT false NOT NULL,
    "moderation_state" "public"."community_moderation_state" DEFAULT 'visible'::"public"."community_moderation_state" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."community_answers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_challenge_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "challenge_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."community_challenge_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "grade" "text",
    "week_start" "date" NOT NULL,
    "week_end" "date" NOT NULL,
    "xp_reward" integer NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."community_challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "subject" "text" NOT NULL,
    "topic" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "status" "public"."community_question_status" DEFAULT 'open'::"public"."community_question_status" NOT NULL,
    "moderation_state" "public"."community_moderation_state" DEFAULT 'visible'::"public"."community_moderation_state" NOT NULL,
    "moderation_flags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."community_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_room_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."community_room_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."edge_function_rate_limit_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "function_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."edge_function_rate_limit_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guardians" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "full_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "communication_preference" "text" DEFAULT 'email'::"text" NOT NULL,
    "notes" "text",
    "status" "public"."record_status" DEFAULT 'active'::"public"."record_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."guardians" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "description" "text" NOT NULL,
    "minutes" integer NOT NULL,
    "rate" numeric(10,2) NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "line_type" "public"."invoice_line_type" DEFAULT 'session'::"public"."invoice_line_type" NOT NULL,
    "adjustment_id" "uuid",
    CONSTRAINT "invoice_lines_type_ref_check" CHECK (((("line_type" = 'session'::"public"."invoice_line_type") AND ("session_id" IS NOT NULL) AND ("adjustment_id" IS NULL)) OR (("line_type" = 'adjustment'::"public"."invoice_line_type") AND ("adjustment_id" IS NOT NULL) AND ("session_id" IS NULL))))
);


ALTER TABLE "public"."invoice_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ngo_partners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "contact_person" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "location" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ngo_partners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "org_role" "public"."org_member_role" NOT NULL,
    "status" "public"."record_status" DEFAULT 'active'::"public"."record_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organization_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."organization_type" NOT NULL,
    "contact_person" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "location" "text",
    "notes" "text",
    "status" "public"."record_status" DEFAULT 'active'::"public"."record_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "payment_type" "text" NOT NULL,
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "due_date" "date",
    "paid_at" timestamp with time zone,
    "notes" "text",
    CONSTRAINT "payments_amount_check" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."privacy_deletion_receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "manifest_version" "text" NOT NULL,
    "financial_hold" boolean NOT NULL,
    "storage_files_removed" integer DEFAULT 0 NOT NULL,
    "db_erasure_counts" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "auth_account_deleted" boolean NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "privacy_deletion_receipts_auth_deleted_check" CHECK (("auth_account_deleted" = true)),
    CONSTRAINT "privacy_deletion_receipts_counts_object_check" CHECK (("jsonb_typeof"("db_erasure_counts") = 'object'::"text"))
);


ALTER TABLE "public"."privacy_deletion_receipts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."privacy_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_type" "public"."privacy_request_type" NOT NULL,
    "subject_type" "public"."privacy_subject_type",
    "subject_id" "uuid",
    "reason" "text",
    "status" "public"."record_status" DEFAULT 'pending'::"public"."record_status" NOT NULL,
    "outcome" "public"."privacy_request_outcome",
    "created_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    "closed_by_user_id" "uuid",
    "close_note" "text",
    "subject_student_id" "uuid",
    "subject_profile_id" "uuid",
    "requested_by" "uuid",
    "notes" "text",
    "result" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processing_state" "text" DEFAULT 'queued'::"text" NOT NULL,
    "processing_subject_auth_user_id" "uuid",
    "processing_started_at" timestamp with time zone,
    "processing_completed_at" timestamp with time zone,
    "storage_files_removed" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    CONSTRAINT "privacy_requests_processing_state_check" CHECK (("processing_state" = ANY (ARRAY['queued'::"text", 'locked'::"text", 'auth_banned'::"text", 'storage_deleted'::"text", 'db_erased'::"text", 'auth_deleted'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."privacy_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_identities" (
    "auth_user_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "role" "public"."user_role" NOT NULL
);


ALTER TABLE "public"."profile_identities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid",
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "role" "public"."user_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "changed_by_user_id" "uuid",
    "change_type" "text" NOT NULL,
    "before_json" "jsonb",
    "after_json" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "changed_by_profile_id" "uuid"
);


ALTER TABLE "public"."session_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_career_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "interests_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "preferred_subjects_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "target_careers_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "aps_target" integer,
    "saved_careers_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "student_career_profiles_aps_check" CHECK ((("aps_target" IS NULL) OR (("aps_target" >= 0) AND ("aps_target" <= 60))))
);


ALTER TABLE "public"."student_career_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_guardians" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "guardian_id" "uuid" NOT NULL,
    "relationship_type" "text" DEFAULT 'guardian'::"text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "can_receive_reports" boolean DEFAULT true NOT NULL,
    "status" "public"."record_status" DEFAULT 'active'::"public"."record_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."student_guardians" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "subject_id" "uuid",
    "topic" "text" NOT NULL,
    "score" numeric(5,2) NOT NULL,
    "cognitive_level" "text",
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assignment_submission_id" "uuid",
    "source_submission_id" "uuid",
    CONSTRAINT "student_progress_score_check" CHECK ((("score" >= (0)::numeric) AND ("score" <= (100)::numeric)))
);


ALTER TABLE "public"."student_progress" OWNER TO "postgres";


COMMENT ON COLUMN "public"."student_progress"."source_submission_id" IS 'DATA-01 provenance. Non-null rows are assignment-derived and exist only while the source mark is released.';



CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "grade" "text",
    "school" "text",
    "parent_name" "text",
    "parent_contact" "text",
    "ngo_partner_id" "uuid",
    "status" "public"."record_status" DEFAULT 'pending'::"public"."record_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "full_name" "text",
    "guardian_name" "text",
    "guardian_phone" "text",
    "notes" "text",
    "subjects_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "guardian_relationship" "text",
    "guardian_email" "text",
    "guardian_address" "text",
    "partner_affiliation" "text",
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."students" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."student_results_class_analytics_anonymous" AS
 SELECT COALESCE("b"."grade", "s"."grade") AS "grade",
    "b"."subject",
    "round"("avg"("b"."percentage"), 2) AS "class_average",
    "max"("b"."percentage") AS "highest_score",
    "min"("b"."percentage") AS "lowest_score",
    "round"(((("count"(*) FILTER (WHERE ("b"."percentage" >= (50)::numeric)))::numeric / (NULLIF("count"(*), 0))::numeric) * (100)::numeric), 2) AS "pass_rate",
    ("count"(DISTINCT "b"."student_id"))::integer AS "number_of_learners",
    ("count"(*))::integer AS "assessment_count"
   FROM ("public"."baseline_assessments" "b"
     JOIN "public"."students" "s" ON (("s"."id" = "b"."student_id")))
  GROUP BY COALESCE("b"."grade", "s"."grade"), "b"."subject"
 HAVING ("count"(DISTINCT "b"."student_id") >= 3);


ALTER VIEW "public"."student_results_class_analytics_anonymous" OWNER TO "postgres";


COMMENT ON VIEW "public"."student_results_class_analytics_anonymous" IS 'Anonymous class-level results aggregates only; no student identifiers, names, or rankings are exposed.';



CREATE TABLE IF NOT EXISTS "public"."subjects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "grade" "text",
    "curriculum" "text"
);


ALTER TABLE "public"."subjects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tutor_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "payment_period" "text" NOT NULL,
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "paid_at" timestamp with time zone,
    "notes" "text",
    CONSTRAINT "tutor_payments_amount_check" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."tutor_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tutor_student_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "status" "public"."record_status" DEFAULT 'active'::"public"."record_status" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "focus_notes" "text",
    "subject_id" "uuid",
    "rate_override" numeric(12,2),
    "allowed_days_json" "jsonb",
    "allowed_time_ranges_json" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tutor_student_allocations_allowed_days_size" CHECK ((("allowed_days_json" IS NULL) OR ("octet_length"(("allowed_days_json")::"text") < 65536))),
    CONSTRAINT "tutor_student_allocations_allowed_time_ranges_size" CHECK ((("allowed_time_ranges_json" IS NULL) OR ("octet_length"(("allowed_time_ranges_json")::"text") < 65536)))
);


ALTER TABLE "public"."tutor_student_allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tutors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "subjects" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "grades" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "hourly_rate" numeric(12,2),
    "status" "public"."record_status" DEFAULT 'pending'::"public"."record_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "qualification_band" "text",
    "qualified_subjects_json" "jsonb",
    "approval_status" "text" DEFAULT 'approved'::"text" NOT NULL,
    "approval_reviewed_by" "uuid",
    "approval_reviewed_at" timestamp with time zone,
    "approval_note" "text",
    "teaching_preferences_json" "jsonb",
    CONSTRAINT "tutors_approval_status_check" CHECK (("approval_status" = ANY (ARRAY['pending'::"text", 'under_review'::"text", 'approved'::"text", 'rejected'::"text", 'changes_requested'::"text"])))
);


ALTER TABLE "public"."tutors" OWNER TO "postgres";


ALTER TABLE ONLY "public"."adjustments"
    ADD CONSTRAINT "adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_assignment_id_student_id_key" UNIQUE ("assignment_id", "student_id");



ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."baseline_assessments"
    ADD CONSTRAINT "baseline_assessments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."career_progress_snapshots"
    ADD CONSTRAINT "career_progress_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_enrollments"
    ADD CONSTRAINT "class_enrollments_class_id_student_id_key" UNIQUE ("class_id", "student_id");



ALTER TABLE ONLY "public"."class_enrollments"
    ADD CONSTRAINT "class_enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_answers"
    ADD CONSTRAINT "community_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_challenge_submissions"
    ADD CONSTRAINT "community_challenge_submissions_challenge_id_profile_id_key" UNIQUE ("challenge_id", "profile_id");



ALTER TABLE ONLY "public"."community_challenge_submissions"
    ADD CONSTRAINT "community_challenge_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_challenges"
    ADD CONSTRAINT "community_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_questions"
    ADD CONSTRAINT "community_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_room_members"
    ADD CONSTRAINT "community_room_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_room_members"
    ADD CONSTRAINT "community_room_members_room_id_profile_id_key" UNIQUE ("room_id", "profile_id");



ALTER TABLE ONLY "public"."community_room_messages"
    ADD CONSTRAINT "community_room_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_study_rooms"
    ADD CONSTRAINT "community_study_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."edge_function_rate_limit_events"
    ADD CONSTRAINT "edge_function_rate_limit_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guardians"
    ADD CONSTRAINT "guardians_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."guardians"
    ADD CONSTRAINT "guardians_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_lines"
    ADD CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learning_goals"
    ADD CONSTRAINT "learning_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ngo_partners"
    ADD CONSTRAINT "ngo_partners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_profile_id_org_role_key" UNIQUE ("organization_id", "profile_id", "org_role");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pay_periods"
    ADD CONSTRAINT "pay_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."privacy_deletion_receipts"
    ADD CONSTRAINT "privacy_deletion_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."privacy_deletion_receipts"
    ADD CONSTRAINT "privacy_deletion_receipts_request_id_key" UNIQUE ("request_id");



ALTER TABLE ONLY "public"."privacy_requests"
    ADD CONSTRAINT "privacy_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_identities"
    ADD CONSTRAINT "profile_identities_pkey" PRIMARY KEY ("auth_user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_history"
    ADD CONSTRAINT "session_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_no_overlap_per_tutor" EXCLUDE USING "gist" ("tutor_id" WITH =, "tsrange"(("date" + "start_time"), ("date" + "end_time"), '[)'::"text") WITH &&);



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_career_profiles"
    ADD CONSTRAINT "student_career_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_career_profiles"
    ADD CONSTRAINT "student_career_profiles_student_unique" UNIQUE ("student_id");



ALTER TABLE ONLY "public"."student_exam_events"
    ADD CONSTRAINT "student_exam_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_guardians"
    ADD CONSTRAINT "student_guardians_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_guardians"
    ADD CONSTRAINT "student_guardians_student_id_guardian_id_key" UNIQUE ("student_id", "guardian_id");



ALTER TABLE ONLY "public"."student_notifications"
    ADD CONSTRAINT "student_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_progress"
    ADD CONSTRAINT "student_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_score_snapshots"
    ADD CONSTRAINT "student_score_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_score_snapshots"
    ADD CONSTRAINT "student_score_snapshots_student_id_score_date_key" UNIQUE ("student_id", "score_date");



ALTER TABLE ONLY "public"."student_score_snapshots"
    ADD CONSTRAINT "student_score_snapshots_user_id_score_date_key" UNIQUE ("user_id", "score_date");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_name_grade_curriculum_key" UNIQUE ("name", "grade", "curriculum");



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tutor_applications"
    ADD CONSTRAINT "tutor_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tutor_applications"
    ADD CONSTRAINT "tutor_applications_tutor_id_key" UNIQUE ("tutor_id");



ALTER TABLE ONLY "public"."tutor_availability_slots"
    ADD CONSTRAINT "tutor_availability_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tutor_documents"
    ADD CONSTRAINT "tutor_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tutor_payments"
    ADD CONSTRAINT "tutor_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tutor_student_allocations"
    ADD CONSTRAINT "tutor_student_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tutor_student_allocations"
    ADD CONSTRAINT "tutor_student_allocations_tutor_id_student_id_key" UNIQUE ("tutor_id", "student_id");



ALTER TABLE ONLY "public"."tutors"
    ADD CONSTRAINT "tutors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tutors"
    ADD CONSTRAINT "tutors_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."volunteer_events"
    ADD CONSTRAINT "volunteer_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."volunteer_logs"
    ADD CONSTRAINT "volunteer_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_reports"
    ADD CONSTRAINT "weekly_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_reports"
    ADD CONSTRAINT "weekly_reports_student_id_week_start_week_end_key" UNIQUE ("student_id", "week_start", "week_end");



CREATE INDEX "assignment_submissions_assignment_idx" ON "public"."assignment_submissions" USING "btree" ("assignment_id", "submitted_at" DESC);



CREATE INDEX "assignment_submissions_assignment_student_latest_idx" ON "public"."assignment_submissions" USING "btree" ("assignment_id", "student_id", "is_latest", "submitted_at" DESC);



CREATE UNIQUE INDEX "assignment_submissions_assignment_student_version_uidx" ON "public"."assignment_submissions" USING "btree" ("assignment_id", "student_id", "version_number");



CREATE UNIQUE INDEX "assignment_submissions_latest_assignment_student_uidx" ON "public"."assignment_submissions" USING "btree" ("assignment_id", "student_id") WHERE "is_latest";



CREATE INDEX "assignment_submissions_student_assignment_idx" ON "public"."assignment_submissions" USING "btree" ("student_id", "assignment_id");



COMMENT ON INDEX "public"."assignment_submissions_student_assignment_idx" IS 'BE-PERF-01 index for dashboard submission lookups by student and assignment.';



CREATE INDEX "assignment_submissions_student_idx" ON "public"."assignment_submissions" USING "btree" ("student_id", "submitted_at" DESC);



CREATE INDEX "baseline_assessments_student_completed_subject_idx" ON "public"."baseline_assessments" USING "btree" ("student_id", "completed_at" DESC, "subject");



CREATE INDEX "baseline_assessments_student_idx" ON "public"."baseline_assessments" USING "btree" ("student_id", "completed_at" DESC);



COMMENT ON INDEX "public"."baseline_assessments_student_idx" IS 'BE-PERF-01 equivalent for student_results(student_id, marked_at desc); baseline_assessments.completed_at is the marked/result timestamp.';



CREATE INDEX "baseline_assessments_subject_grade_student_completed_idx" ON "public"."baseline_assessments" USING "btree" ("subject", "grade", "student_id", "completed_at" DESC);



CREATE INDEX "baseline_assessments_subject_idx" ON "public"."baseline_assessments" USING "btree" ("subject", "grade", "completed_at" DESC);



CREATE INDEX "career_progress_snapshots_user_goal_created_idx" ON "public"."career_progress_snapshots" USING "btree" ("user_id", "goal_id", "created_at" DESC);



CREATE INDEX "idx_adjustments_pay_period" ON "public"."adjustments" USING "btree" ("pay_period_id");



CREATE INDEX "idx_adjustments_period" ON "public"."adjustments" USING "btree" ("pay_period_id");



CREATE INDEX "idx_adjustments_tutor_pay_period" ON "public"."adjustments" USING "btree" ("tutor_id", "pay_period_id");



CREATE INDEX "idx_adjustments_tutor_period" ON "public"."adjustments" USING "btree" ("tutor_id", "pay_period_id");



CREATE INDEX "idx_adjustments_voided" ON "public"."adjustments" USING "btree" ("voided_at");



CREATE INDEX "idx_assignment_submissions_storage_key" ON "public"."assignment_submissions" USING "btree" ("storage_key") WHERE ("storage_key" IS NOT NULL);



CREATE INDEX "idx_assignments_created_by" ON "public"."assignments" USING "btree" ("created_by");



CREATE INDEX "idx_assignments_due_date" ON "public"."assignments" USING "btree" ("due_date");



CREATE INDEX "idx_assignments_organization" ON "public"."assignments" USING "btree" ("organization_id");



CREATE INDEX "idx_audit_log_action" ON "public"."audit_log" USING "btree" ("action");



CREATE INDEX "idx_audit_log_actor" ON "public"."audit_log" USING "btree" ("actor_user_id", "created_at" DESC);



CREATE INDEX "idx_audit_log_created_at" ON "public"."audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_log_entity" ON "public"."audit_log" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_baseline_assessments_organization" ON "public"."baseline_assessments" USING "btree" ("organization_id");



CREATE INDEX "idx_baseline_assessments_student_completed" ON "public"."baseline_assessments" USING "btree" ("student_id", "completed_at" DESC);



CREATE INDEX "idx_baseline_assessments_subject_grade" ON "public"."baseline_assessments" USING "btree" ("subject", "grade", "completed_at" DESC);



CREATE INDEX "idx_career_progress_snapshots_organization" ON "public"."career_progress_snapshots" USING "btree" ("organization_id");



CREATE INDEX "idx_career_progress_snapshots_student_goal" ON "public"."career_progress_snapshots" USING "btree" ("student_id", "goal_id", "created_at" DESC);



CREATE INDEX "idx_class_enrollments_class_status" ON "public"."class_enrollments" USING "btree" ("class_id", "status");



CREATE INDEX "idx_class_enrollments_student" ON "public"."class_enrollments" USING "btree" ("student_id");



CREATE INDEX "idx_classes_organization" ON "public"."classes" USING "btree" ("organization_id");



CREATE INDEX "idx_classes_status" ON "public"."classes" USING "btree" ("status");



CREATE INDEX "idx_classes_tutor" ON "public"."classes" USING "btree" ("tutor_id");



CREATE INDEX "idx_community_answers_question" ON "public"."community_answers" USING "btree" ("question_id");



CREATE INDEX "idx_community_challenge_submissions_profile" ON "public"."community_challenge_submissions" USING "btree" ("profile_id");



CREATE INDEX "idx_community_questions_created" ON "public"."community_questions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_community_room_members_profile" ON "public"."community_room_members" USING "btree" ("profile_id");



CREATE INDEX "idx_community_room_members_room" ON "public"."community_room_members" USING "btree" ("room_id");



CREATE INDEX "idx_community_room_messages_room_created" ON "public"."community_room_messages" USING "btree" ("room_id", "created_at" DESC);



CREATE INDEX "idx_edge_function_rate_limit_events_created_at" ON "public"."edge_function_rate_limit_events" USING "btree" ("created_at");



CREATE INDEX "idx_edge_function_rate_limit_events_lookup" ON "public"."edge_function_rate_limit_events" USING "btree" ("function_name", "subject_id", "created_at" DESC);



CREATE INDEX "idx_guardians_profile" ON "public"."guardians" USING "btree" ("profile_id");



CREATE INDEX "idx_invoice_lines_adjustment" ON "public"."invoice_lines" USING "btree" ("adjustment_id");



CREATE INDEX "idx_invoice_lines_invoice" ON "public"."invoice_lines" USING "btree" ("invoice_id");



CREATE INDEX "idx_invoice_lines_session" ON "public"."invoice_lines" USING "btree" ("session_id");



CREATE UNIQUE INDEX "idx_invoices_number" ON "public"."invoices" USING "btree" ("invoice_number");



CREATE INDEX "idx_invoices_tutor_period" ON "public"."invoices" USING "btree" ("tutor_id", "period_start");



CREATE INDEX "idx_invoices_tutor_period_start" ON "public"."invoices" USING "btree" ("tutor_id", "period_start");



CREATE INDEX "idx_learning_goals_category_status" ON "public"."learning_goals" USING "btree" ("category", "status");



CREATE INDEX "idx_learning_goals_organization" ON "public"."learning_goals" USING "btree" ("organization_id");



CREATE INDEX "idx_learning_goals_student_status_due" ON "public"."learning_goals" USING "btree" ("student_id", "status", "due_date");



CREATE INDEX "idx_organization_members_org_role" ON "public"."organization_members" USING "btree" ("organization_id", "org_role");



CREATE INDEX "idx_organization_members_profile" ON "public"."organization_members" USING "btree" ("profile_id", "status");



CREATE INDEX "idx_organization_members_profile_org_status" ON "public"."organization_members" USING "btree" ("profile_id", "organization_id", "status");



CREATE UNIQUE INDEX "idx_pay_periods_period_start" ON "public"."pay_periods" USING "btree" ("period_start_date");



CREATE INDEX "idx_payments_student_status" ON "public"."payments" USING "btree" ("student_id", "status");



CREATE INDEX "idx_privacy_requests_status" ON "public"."privacy_requests" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_privacy_requests_subject" ON "public"."privacy_requests" USING "btree" ("subject_type", "subject_id");



CREATE INDEX "idx_privacy_requests_subject_student" ON "public"."privacy_requests" USING "btree" ("subject_student_id");



CREATE UNIQUE INDEX "idx_profile_identities_profile" ON "public"."profile_identities" USING "btree" ("profile_id");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_progress_student_recorded" ON "public"."student_progress" USING "btree" ("student_id", "recorded_at" DESC);



CREATE INDEX "idx_session_history_session" ON "public"."session_history" USING "btree" ("session_id");



CREATE INDEX "idx_sessions_organization" ON "public"."sessions" USING "btree" ("organization_id");



CREATE INDEX "idx_sessions_student_date" ON "public"."sessions" USING "btree" ("student_id", "date" DESC, "start_time" DESC);



CREATE INDEX "idx_sessions_tutor_date" ON "public"."sessions" USING "btree" ("tutor_id", "date");



CREATE UNIQUE INDEX "idx_sessions_tutor_sync_key" ON "public"."sessions" USING "btree" ("tutor_id", "sync_key") WHERE ("sync_key" IS NOT NULL);



CREATE INDEX "idx_student_career_profiles_student_updated" ON "public"."student_career_profiles" USING "btree" ("student_id", "updated_at" DESC);



CREATE INDEX "idx_student_exam_events_organization" ON "public"."student_exam_events" USING "btree" ("organization_id");



CREATE INDEX "idx_student_exam_events_student_date" ON "public"."student_exam_events" USING "btree" ("student_id", "exam_date");



CREATE INDEX "idx_student_guardians_guardian" ON "public"."student_guardians" USING "btree" ("guardian_id", "status");



CREATE INDEX "idx_student_guardians_student" ON "public"."student_guardians" USING "btree" ("student_id", "status");



CREATE INDEX "idx_student_notifications_student_created" ON "public"."student_notifications" USING "btree" ("student_id", "created_at" DESC);



CREATE INDEX "idx_student_notifications_student_read" ON "public"."student_notifications" USING "btree" ("student_id", "is_read", "created_at" DESC);



CREATE UNIQUE INDEX "idx_student_progress_source_submission" ON "public"."student_progress" USING "btree" ("source_submission_id") WHERE ("source_submission_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_student_progress_submission_unique" ON "public"."student_progress" USING "btree" ("assignment_submission_id") WHERE ("assignment_submission_id" IS NOT NULL);



CREATE INDEX "idx_student_score_snapshots_organization" ON "public"."student_score_snapshots" USING "btree" ("organization_id");



CREATE INDEX "idx_student_score_snapshots_student_date" ON "public"."student_score_snapshots" USING "btree" ("student_id", "score_date" DESC);



CREATE INDEX "idx_students_ngo_partner" ON "public"."students" USING "btree" ("ngo_partner_id");



CREATE INDEX "idx_students_organization" ON "public"."students" USING "btree" ("organization_id");



CREATE INDEX "idx_submissions_assignment_status" ON "public"."assignment_submissions" USING "btree" ("assignment_id", "status");



CREATE INDEX "idx_submissions_assignment_versions" ON "public"."assignment_submissions" USING "btree" ("assignment_id", "student_id", "version_number" DESC);



CREATE UNIQUE INDEX "idx_submissions_latest_assignment_student" ON "public"."assignment_submissions" USING "btree" ("assignment_id", "student_id") WHERE "is_latest";



CREATE INDEX "idx_submissions_student" ON "public"."assignment_submissions" USING "btree" ("student_id");



CREATE INDEX "idx_submissions_student_assignment" ON "public"."assignment_submissions" USING "btree" ("student_id", "assignment_id");



CREATE INDEX "idx_tutor_availability_tutor_day_start" ON "public"."tutor_availability_slots" USING "btree" ("tutor_id", "day_of_week", "start_time");



CREATE INDEX "idx_tutor_documents_tutor_uploaded" ON "public"."tutor_documents" USING "btree" ("tutor_id", "uploaded_at" DESC);



CREATE INDEX "idx_tutor_student_allocations_student" ON "public"."tutor_student_allocations" USING "btree" ("student_id", "status");



CREATE INDEX "idx_tutor_student_allocations_tutor" ON "public"."tutor_student_allocations" USING "btree" ("tutor_id", "status");



CREATE INDEX "idx_volunteer_events_date" ON "public"."volunteer_events" USING "btree" ("event_date" DESC NULLS LAST, "created_at" DESC);



CREATE INDEX "idx_volunteer_logs_event" ON "public"."volunteer_logs" USING "btree" ("event_id");



CREATE INDEX "idx_volunteer_logs_tutor_created" ON "public"."volunteer_logs" USING "btree" ("tutor_id", "created_at" DESC);



CREATE INDEX "idx_weekly_reports_student_created" ON "public"."weekly_reports" USING "btree" ("student_id", "created_at" DESC);



CREATE INDEX "learning_goals_category_idx" ON "public"."learning_goals" USING "btree" ("category", "status");



CREATE INDEX "learning_goals_student_idx" ON "public"."learning_goals" USING "btree" ("student_id", "status", "due_date");



CREATE INDEX "sessions_student_date_start_idx" ON "public"."sessions" USING "btree" ("student_id", "date" DESC, "start_time" DESC);



COMMENT ON INDEX "public"."sessions_student_date_start_idx" IS 'Supports student dashboard attendance and recent-session queries ordered by date/start time.';



CREATE INDEX "student_career_profiles_student_updated_idx" ON "public"."student_career_profiles" USING "btree" ("student_id", "updated_at" DESC);



CREATE INDEX "student_exam_events_student_date_idx" ON "public"."student_exam_events" USING "btree" ("student_id", "exam_date");



CREATE INDEX "student_notifications_student_created_idx" ON "public"."student_notifications" USING "btree" ("student_id", "created_at" DESC);



CREATE INDEX "student_notifications_student_read_idx" ON "public"."student_notifications" USING "btree" ("student_id", "is_read", "created_at" DESC);



CREATE INDEX "student_notifications_student_unread_idx" ON "public"."student_notifications" USING "btree" ("student_id", "read_at", "created_at" DESC);



COMMENT ON INDEX "public"."student_notifications_student_unread_idx" IS 'Supports dashboard notification list and unread-count queries scoped to one student.';



CREATE INDEX "student_score_snapshots_user_date_idx" ON "public"."student_score_snapshots" USING "btree" ("user_id", "score_date" DESC);



CREATE INDEX "tutor_availability_slots_tutor_idx" ON "public"."tutor_availability_slots" USING "btree" ("tutor_id", "day_of_week", "start_time");



CREATE INDEX "tutor_documents_tutor_idx" ON "public"."tutor_documents" USING "btree" ("tutor_id", "uploaded_at" DESC);



CREATE INDEX "volunteer_logs_event_idx" ON "public"."volunteer_logs" USING "btree" ("event_id");



CREATE INDEX "volunteer_logs_tutor_idx" ON "public"."volunteer_logs" USING "btree" ("tutor_id", "created_at" DESC);



CREATE INDEX "weekly_reports_user_created_idx" ON "public"."weekly_reports" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "weekly_reports_user_week_unique" ON "public"."weekly_reports" USING "btree" ("user_id", "week_start", "week_end");



CREATE OR REPLACE TRIGGER "trg_block_audit_log_mutation" BEFORE DELETE OR UPDATE ON "public"."audit_log" FOR EACH ROW EXECUTE FUNCTION "public"."block_audit_log_mutation"();



CREATE OR REPLACE TRIGGER "trg_block_session_history_mutation" BEFORE DELETE OR UPDATE ON "public"."session_history" FOR EACH ROW EXECUTE FUNCTION "public"."block_session_history_mutation"();



CREATE OR REPLACE TRIGGER "trg_fill_baseline_assessment_org" BEFORE INSERT ON "public"."baseline_assessments" FOR EACH ROW EXECUTE FUNCTION "public"."fill_student_scoped_organization_id"();



CREATE OR REPLACE TRIGGER "trg_fill_career_progress_snapshot_org" BEFORE INSERT ON "public"."career_progress_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."fill_student_scoped_organization_id"();



CREATE OR REPLACE TRIGGER "trg_fill_learning_goal_org" BEFORE INSERT ON "public"."learning_goals" FOR EACH ROW EXECUTE FUNCTION "public"."fill_student_scoped_organization_id"();



CREATE OR REPLACE TRIGGER "trg_fill_organization_id" BEFORE INSERT ON "public"."assignments" FOR EACH ROW EXECUTE FUNCTION "public"."fill_organization_id"();



CREATE OR REPLACE TRIGGER "trg_fill_organization_id" BEFORE INSERT ON "public"."classes" FOR EACH ROW EXECUTE FUNCTION "public"."fill_organization_id"();



CREATE OR REPLACE TRIGGER "trg_fill_organization_id" BEFORE INSERT ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "public"."fill_organization_id"();



CREATE OR REPLACE TRIGGER "trg_fill_session_organization_id" BEFORE INSERT ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."fill_session_organization_id"();



CREATE OR REPLACE TRIGGER "trg_fill_student_exam_event_org" BEFORE INSERT ON "public"."student_exam_events" FOR EACH ROW EXECUTE FUNCTION "public"."fill_student_scoped_organization_id"();



CREATE OR REPLACE TRIGGER "trg_fill_student_score_snapshot_org" BEFORE INSERT ON "public"."student_score_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."fill_student_scoped_organization_id"();



CREATE OR REPLACE TRIGGER "trg_privacy_deletion_receipts_immutable" BEFORE DELETE OR UPDATE ON "public"."privacy_deletion_receipts" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_privacy_deletion_receipt_mutation"();



CREATE OR REPLACE TRIGGER "trg_sync_profile_identity" AFTER INSERT OR DELETE OR UPDATE OF "auth_user_id", "role" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_identity"();



CREATE OR REPLACE TRIGGER "trg_sync_released_submission_progress" AFTER INSERT OR UPDATE OF "assignment_id", "student_id", "status", "marks_awarded", "marks_released", "released_at" ON "public"."assignment_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."sync_released_submission_progress"();



ALTER TABLE ONLY "public"."adjustments"
    ADD CONSTRAINT "adjustments_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."adjustments"
    ADD CONSTRAINT "adjustments_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."adjustments"
    ADD CONSTRAINT "adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."adjustments"
    ADD CONSTRAINT "adjustments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."adjustments"
    ADD CONSTRAINT "adjustments_pay_period_id_fkey" FOREIGN KEY ("pay_period_id") REFERENCES "public"."pay_periods"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."adjustments"
    ADD CONSTRAINT "adjustments_related_session_id_fkey" FOREIGN KEY ("related_session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."adjustments"
    ADD CONSTRAINT "adjustments_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id");



ALTER TABLE ONLY "public"."adjustments"
    ADD CONSTRAINT "adjustments_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."adjustments"
    ADD CONSTRAINT "adjustments_voided_by_user_id_fkey" FOREIGN KEY ("voided_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."baseline_assessments"
    ADD CONSTRAINT "baseline_assessments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."baseline_assessments"
    ADD CONSTRAINT "baseline_assessments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."baseline_assessments"
    ADD CONSTRAINT "baseline_assessments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."baseline_assessments"
    ADD CONSTRAINT "baseline_assessments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."career_progress_snapshots"
    ADD CONSTRAINT "career_progress_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."career_progress_snapshots"
    ADD CONSTRAINT "career_progress_snapshots_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."career_progress_snapshots"
    ADD CONSTRAINT "career_progress_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_enrollments"
    ADD CONSTRAINT "class_enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_enrollments"
    ADD CONSTRAINT "class_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_ngo_partner_id_fkey" FOREIGN KEY ("ngo_partner_id") REFERENCES "public"."ngo_partners"("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_answers"
    ADD CONSTRAINT "community_answers_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_answers"
    ADD CONSTRAINT "community_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."community_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_challenge_submissions"
    ADD CONSTRAINT "community_challenge_submissions_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."community_challenges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_challenge_submissions"
    ADD CONSTRAINT "community_challenge_submissions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_challenges"
    ADD CONSTRAINT "community_challenges_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."community_questions"
    ADD CONSTRAINT "community_questions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_room_members"
    ADD CONSTRAINT "community_room_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_room_members"
    ADD CONSTRAINT "community_room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."community_study_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_room_messages"
    ADD CONSTRAINT "community_room_messages_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_room_messages"
    ADD CONSTRAINT "community_room_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."community_study_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_study_rooms"
    ADD CONSTRAINT "community_study_rooms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."guardians"
    ADD CONSTRAINT "guardians_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoice_lines"
    ADD CONSTRAINT "invoice_lines_adjustment_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "public"."adjustments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoice_lines"
    ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_lines"
    ADD CONSTRAINT "invoice_lines_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id");



ALTER TABLE ONLY "public"."learning_goals"
    ADD CONSTRAINT "learning_goals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."learning_goals"
    ADD CONSTRAINT "learning_goals_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."learning_goals"
    ADD CONSTRAINT "learning_goals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."learning_goals"
    ADD CONSTRAINT "learning_goals_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pay_periods"
    ADD CONSTRAINT "pay_periods_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."pay_periods"
    ADD CONSTRAINT "pay_periods_locked_by_user_id_fkey" FOREIGN KEY ("locked_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."privacy_deletion_receipts"
    ADD CONSTRAINT "privacy_deletion_receipts_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."privacy_requests"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."privacy_requests"
    ADD CONSTRAINT "privacy_requests_closed_by_user_id_fkey" FOREIGN KEY ("closed_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."privacy_requests"
    ADD CONSTRAINT "privacy_requests_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."privacy_requests"
    ADD CONSTRAINT "privacy_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."privacy_requests"
    ADD CONSTRAINT "privacy_requests_subject_profile_id_fkey" FOREIGN KEY ("subject_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."privacy_requests"
    ADD CONSTRAINT "privacy_requests_subject_student_id_fkey" FOREIGN KEY ("subject_student_id") REFERENCES "public"."students"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile_identities"
    ADD CONSTRAINT "profile_identities_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_identities"
    ADD CONSTRAINT "profile_identities_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_history"
    ADD CONSTRAINT "session_history_changed_by_profile_id_fkey" FOREIGN KEY ("changed_by_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."session_history"
    ADD CONSTRAINT "session_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_history"
    ADD CONSTRAINT "session_history_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_tutor_student_allocation_id_fkey" FOREIGN KEY ("tutor_student_allocation_id") REFERENCES "public"."tutor_student_allocations"("id");



ALTER TABLE ONLY "public"."student_career_profiles"
    ADD CONSTRAINT "student_career_profiles_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_exam_events"
    ADD CONSTRAINT "student_exam_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."student_exam_events"
    ADD CONSTRAINT "student_exam_events_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_exam_events"
    ADD CONSTRAINT "student_exam_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."student_exam_events"
    ADD CONSTRAINT "student_exam_events_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_guardians"
    ADD CONSTRAINT "student_guardians_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardians"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_guardians"
    ADD CONSTRAINT "student_guardians_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_notifications"
    ADD CONSTRAINT "student_notifications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."student_notifications"
    ADD CONSTRAINT "student_notifications_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_notifications"
    ADD CONSTRAINT "student_notifications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_progress"
    ADD CONSTRAINT "student_progress_assignment_submission_id_fkey" FOREIGN KEY ("assignment_submission_id") REFERENCES "public"."assignment_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_progress"
    ADD CONSTRAINT "student_progress_source_submission_fkey" FOREIGN KEY ("source_submission_id") REFERENCES "public"."assignment_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_progress"
    ADD CONSTRAINT "student_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_progress"
    ADD CONSTRAINT "student_progress_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id");



ALTER TABLE ONLY "public"."student_score_snapshots"
    ADD CONSTRAINT "student_score_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."student_score_snapshots"
    ADD CONSTRAINT "student_score_snapshots_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_score_snapshots"
    ADD CONSTRAINT "student_score_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_ngo_partner_id_fkey" FOREIGN KEY ("ngo_partner_id") REFERENCES "public"."ngo_partners"("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tutor_applications"
    ADD CONSTRAINT "tutor_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tutor_applications"
    ADD CONSTRAINT "tutor_applications_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tutor_availability_slots"
    ADD CONSTRAINT "tutor_availability_slots_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tutor_documents"
    ADD CONSTRAINT "tutor_documents_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tutor_documents"
    ADD CONSTRAINT "tutor_documents_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tutor_payments"
    ADD CONSTRAINT "tutor_payments_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tutor_student_allocations"
    ADD CONSTRAINT "tutor_student_allocations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tutor_student_allocations"
    ADD CONSTRAINT "tutor_student_allocations_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id");



ALTER TABLE ONLY "public"."tutor_student_allocations"
    ADD CONSTRAINT "tutor_student_allocations_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tutors"
    ADD CONSTRAINT "tutors_approval_reviewed_by_fkey" FOREIGN KEY ("approval_reviewed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tutors"
    ADD CONSTRAINT "tutors_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."volunteer_events"
    ADD CONSTRAINT "volunteer_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."volunteer_events"
    ADD CONSTRAINT "volunteer_events_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."volunteer_logs"
    ADD CONSTRAINT "volunteer_logs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."volunteer_events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."volunteer_logs"
    ADD CONSTRAINT "volunteer_logs_evidence_document_id_fkey" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."tutor_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."volunteer_logs"
    ADD CONSTRAINT "volunteer_logs_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."volunteer_logs"
    ADD CONSTRAINT "volunteer_logs_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."weekly_reports"
    ADD CONSTRAINT "weekly_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."weekly_reports"
    ADD CONSTRAINT "weekly_reports_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."weekly_reports"
    ADD CONSTRAINT "weekly_reports_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_reports"
    ADD CONSTRAINT "weekly_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."adjustments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "adjustments_no_direct_delete" ON "public"."adjustments" FOR DELETE USING (false);



CREATE POLICY "adjustments_no_direct_insert" ON "public"."adjustments" FOR INSERT WITH CHECK (false);



CREATE POLICY "adjustments_no_direct_update" ON "public"."adjustments" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "admin_finance_access" ON "public"."payments" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "admin_full_access_profiles" ON "public"."profiles" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "admin_full_access_students" ON "public"."students" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "admin_full_access_tutors" ON "public"."tutors" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "admin_manage_assignments" ON "public"."assignments" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "admin_manage_class_enrollments" ON "public"."class_enrollments" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "admin_manage_classes" ON "public"."classes" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "admin_manage_guardians" ON "public"."guardians" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "admin_manage_organization_members" ON "public"."organization_members" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "admin_manage_organizations" ON "public"."organizations" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "admin_manage_progress" ON "public"."student_progress" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "admin_manage_student_guardians" ON "public"."student_guardians" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "admin_manage_subjects" ON "public"."subjects" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "admin_manage_submissions" ON "public"."assignment_submissions" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "admin_manage_tutor_student_allocations" ON "public"."tutor_student_allocations" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "admin_select_all_adjustments" ON "public"."adjustments" FOR SELECT USING ("public"."is_platform_admin"());



CREATE POLICY "admin_select_all_invoice_lines" ON "public"."invoice_lines" FOR SELECT USING ("public"."is_platform_admin"());



CREATE POLICY "admin_select_all_invoices" ON "public"."invoices" FOR SELECT USING ("public"."is_platform_admin"());



CREATE POLICY "admin_select_all_sessions" ON "public"."sessions" FOR SELECT USING ("public"."is_platform_admin"());



CREATE POLICY "admin_select_all_tutor_applications" ON "public"."tutor_applications" FOR SELECT USING ("public"."is_platform_admin"());



CREATE POLICY "admin_select_all_tutor_availability_slots" ON "public"."tutor_availability_slots" FOR SELECT USING ("public"."is_platform_admin"());



CREATE POLICY "admin_select_all_tutor_documents" ON "public"."tutor_documents" FOR SELECT USING ("public"."is_platform_admin"());



CREATE POLICY "admin_select_all_weekly_reports" ON "public"."weekly_reports" FOR SELECT USING ("public"."is_platform_admin"());



CREATE POLICY "admin_select_audit_log" ON "public"."audit_log" FOR SELECT USING ("public"."is_platform_admin"());



CREATE POLICY "admin_select_pay_periods" ON "public"."pay_periods" FOR SELECT USING ("public"."is_platform_admin"());



CREATE POLICY "admin_select_session_history" ON "public"."session_history" FOR SELECT USING ("public"."is_platform_admin"());



CREATE POLICY "admin_tutor_payment_access" ON "public"."tutor_payments" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



ALTER TABLE "public"."assignment_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "assignment_submissions_staff_access" ON "public"."assignment_submissions" USING (("current_setting"('app.current_role'::"text", true) = ANY (ARRAY['ADMIN'::"text", 'TUTOR'::"text"]))) WITH CHECK (("current_setting"('app.current_role'::"text", true) = ANY (ARRAY['ADMIN'::"text", 'TUTOR'::"text"])));



CREATE POLICY "assignment_submissions_student_own_insert" ON "public"."assignment_submissions" FOR INSERT WITH CHECK ((("student_id")::"text" = "current_setting"('app.current_student_id'::"text", true)));



CREATE POLICY "assignment_submissions_student_own_select" ON "public"."assignment_submissions" FOR SELECT USING ((("student_id")::"text" = "current_setting"('app.current_student_id'::"text", true)));



ALTER TABLE "public"."assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "assignments_coordinator_manage" ON "public"."assignments" USING (("public"."is_platform_admin"() OR ("public"."current_org_role"("organization_id") = 'coordinator'::"public"."org_member_role"))) WITH CHECK (("public"."is_platform_admin"() OR ("public"."current_org_role"("organization_id") = 'coordinator'::"public"."org_member_role")));



CREATE POLICY "assignments_org_scoped_read" ON "public"."assignments" FOR SELECT USING (("public"."is_platform_admin"() OR ("organization_id" IN ( SELECT "public"."current_org_ids"() AS "current_org_ids"))));



CREATE POLICY "assignments_student_read_published_own_org" ON "public"."assignments" FOR SELECT USING ((("status" = 'published'::"public"."assignment_status") AND ("organization_id" = "public"."current_student_org_id"())));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."baseline_assessments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "baseline_assessments_no_direct_delete" ON "public"."baseline_assessments" FOR DELETE USING (false);



CREATE POLICY "baseline_assessments_no_direct_insert" ON "public"."baseline_assessments" FOR INSERT WITH CHECK (false);



CREATE POLICY "baseline_assessments_no_direct_update" ON "public"."baseline_assessments" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "baseline_assessments_select" ON "public"."baseline_assessments" FOR SELECT USING (("public"."is_platform_admin"() OR ("student_id" = "public"."current_student_id"()) OR (EXISTS ( SELECT 1
   FROM "public"."tutor_student_allocations" "tsa"
  WHERE (("tsa"."student_id" = "baseline_assessments"."student_id") AND ("tsa"."tutor_id" = "public"."current_tutor_id"()) AND ("tsa"."status" = 'active'::"public"."record_status"))))));



CREATE POLICY "baseline_assessments_staff_select" ON "public"."baseline_assessments" FOR SELECT USING (("current_setting"('app.current_role'::"text", true) = ANY (ARRAY['ADMIN'::"text", 'TUTOR'::"text"])));



CREATE POLICY "baseline_assessments_student_own_select" ON "public"."baseline_assessments" FOR SELECT USING ((("student_id")::"text" = "current_setting"('app.current_student_id'::"text", true)));



ALTER TABLE "public"."career_progress_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "career_progress_snapshots_no_direct_delete" ON "public"."career_progress_snapshots" FOR DELETE USING (false);



CREATE POLICY "career_progress_snapshots_no_direct_insert" ON "public"."career_progress_snapshots" FOR INSERT WITH CHECK (false);



CREATE POLICY "career_progress_snapshots_no_direct_update" ON "public"."career_progress_snapshots" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "career_progress_snapshots_select" ON "public"."career_progress_snapshots" FOR SELECT USING (("public"."is_platform_admin"() OR ("student_id" = "public"."current_student_id"()) OR (EXISTS ( SELECT 1
   FROM "public"."tutor_student_allocations" "tsa"
  WHERE (("tsa"."student_id" = "career_progress_snapshots"."student_id") AND ("tsa"."tutor_id" = "public"."current_tutor_id"()) AND ("tsa"."status" = 'active'::"public"."record_status"))))));



ALTER TABLE "public"."class_enrollments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "class_enrollments_select_scoped" ON "public"."class_enrollments" FOR SELECT USING (("public"."is_platform_admin"() OR ("student_id" = "public"."current_student_id"()) OR ("class_id" IN ( SELECT "public"."current_tutor_class_ids"() AS "current_tutor_class_ids"))));



ALTER TABLE "public"."classes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "classes_coordinator_manage" ON "public"."classes" USING (("public"."is_platform_admin"() OR ("public"."current_org_role"("organization_id") = 'coordinator'::"public"."org_member_role"))) WITH CHECK (("public"."is_platform_admin"() OR ("public"."current_org_role"("organization_id") = 'coordinator'::"public"."org_member_role")));



CREATE POLICY "classes_org_scoped_read" ON "public"."classes" FOR SELECT USING (("public"."is_platform_admin"() OR ("organization_id" IN ( SELECT "public"."current_org_ids"() AS "current_org_ids"))));



CREATE POLICY "classes_select_scoped" ON "public"."classes" FOR SELECT USING (("public"."is_platform_admin"() OR ("tutor_id" = "public"."current_tutor_id"()) OR ("id" IN ( SELECT "public"."current_student_class_ids"() AS "current_student_class_ids"))));



ALTER TABLE "public"."community_answers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "community_answers_disabled_select" ON "public"."community_answers" FOR SELECT USING (false);



CREATE POLICY "community_answers_no_direct_delete" ON "public"."community_answers" FOR DELETE USING (false);



CREATE POLICY "community_answers_no_direct_insert" ON "public"."community_answers" FOR INSERT WITH CHECK (false);



CREATE POLICY "community_answers_no_direct_update" ON "public"."community_answers" FOR UPDATE USING (false);



ALTER TABLE "public"."community_challenge_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "community_challenge_submissions_disabled_select" ON "public"."community_challenge_submissions" FOR SELECT USING (false);



CREATE POLICY "community_challenge_submissions_no_direct_delete" ON "public"."community_challenge_submissions" FOR DELETE USING (false);



CREATE POLICY "community_challenge_submissions_no_direct_insert" ON "public"."community_challenge_submissions" FOR INSERT WITH CHECK (false);



CREATE POLICY "community_challenge_submissions_no_direct_update" ON "public"."community_challenge_submissions" FOR UPDATE USING (false);



ALTER TABLE "public"."community_challenges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "community_challenges_disabled_select" ON "public"."community_challenges" FOR SELECT USING (false);



CREATE POLICY "community_challenges_no_direct_delete" ON "public"."community_challenges" FOR DELETE USING (false);



CREATE POLICY "community_challenges_no_direct_insert" ON "public"."community_challenges" FOR INSERT WITH CHECK (false);



CREATE POLICY "community_challenges_no_direct_update" ON "public"."community_challenges" FOR UPDATE USING (false);



ALTER TABLE "public"."community_questions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "community_questions_disabled_select" ON "public"."community_questions" FOR SELECT USING (false);



CREATE POLICY "community_questions_no_direct_delete" ON "public"."community_questions" FOR DELETE USING (false);



CREATE POLICY "community_questions_no_direct_insert" ON "public"."community_questions" FOR INSERT WITH CHECK (false);



CREATE POLICY "community_questions_no_direct_update" ON "public"."community_questions" FOR UPDATE USING (false);



ALTER TABLE "public"."community_room_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "community_room_members_disabled_select" ON "public"."community_room_members" FOR SELECT USING (false);



CREATE POLICY "community_room_members_no_direct_delete" ON "public"."community_room_members" FOR DELETE USING (false);



CREATE POLICY "community_room_members_no_direct_insert" ON "public"."community_room_members" FOR INSERT WITH CHECK (false);



CREATE POLICY "community_room_members_no_direct_update" ON "public"."community_room_members" FOR UPDATE USING (false);



ALTER TABLE "public"."community_room_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "community_room_messages_disabled_select" ON "public"."community_room_messages" FOR SELECT USING (false);



CREATE POLICY "community_room_messages_no_direct_delete" ON "public"."community_room_messages" FOR DELETE USING (false);



CREATE POLICY "community_room_messages_no_direct_insert" ON "public"."community_room_messages" FOR INSERT WITH CHECK (false);



CREATE POLICY "community_room_messages_no_direct_update" ON "public"."community_room_messages" FOR UPDATE USING (false);



CREATE POLICY "community_rooms_disabled_select" ON "public"."community_study_rooms" FOR SELECT USING (false);



CREATE POLICY "community_rooms_no_direct_delete" ON "public"."community_study_rooms" FOR DELETE USING (false);



CREATE POLICY "community_rooms_no_direct_insert" ON "public"."community_study_rooms" FOR INSERT WITH CHECK (false);



CREATE POLICY "community_rooms_no_direct_update" ON "public"."community_study_rooms" FOR UPDATE USING (false);



ALTER TABLE "public"."community_study_rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."edge_function_rate_limit_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guardian_select_reportable_weekly_reports" ON "public"."weekly_reports" FOR SELECT USING ((("public"."current_profile_role"() = 'parent'::"public"."user_role") AND (EXISTS ( SELECT 1
   FROM ("public"."guardians" "g"
     JOIN "public"."student_guardians" "sg" ON (("sg"."guardian_id" = "g"."id")))
  WHERE (("sg"."student_id" = "weekly_reports"."student_id") AND ("g"."profile_id" = "public"."current_profile_id"()) AND ("g"."status" = 'active'::"public"."record_status") AND ("sg"."status" = 'active'::"public"."record_status") AND ("sg"."can_receive_reports" = true))))));



ALTER TABLE "public"."guardians" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guardians_select_scoped" ON "public"."guardians" FOR SELECT USING (("public"."is_platform_admin"() OR ("profile_id" = "public"."current_profile_id"())));



ALTER TABLE "public"."invoice_lines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_lines_no_direct_delete" ON "public"."invoice_lines" FOR DELETE USING (false);



CREATE POLICY "invoice_lines_no_direct_insert" ON "public"."invoice_lines" FOR INSERT WITH CHECK (false);



CREATE POLICY "invoice_lines_no_direct_update" ON "public"."invoice_lines" FOR UPDATE USING (false) WITH CHECK (false);



ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_no_direct_delete" ON "public"."invoices" FOR DELETE USING (false);



CREATE POLICY "invoices_no_direct_insert" ON "public"."invoices" FOR INSERT WITH CHECK (false);



CREATE POLICY "invoices_no_direct_update" ON "public"."invoices" FOR UPDATE USING (false) WITH CHECK (false);



ALTER TABLE "public"."learning_goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "learning_goals_no_direct_delete" ON "public"."learning_goals" FOR DELETE USING (false);



CREATE POLICY "learning_goals_no_direct_insert" ON "public"."learning_goals" FOR INSERT WITH CHECK (false);



CREATE POLICY "learning_goals_no_direct_update" ON "public"."learning_goals" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "learning_goals_select" ON "public"."learning_goals" FOR SELECT USING (("public"."is_platform_admin"() OR (("student_id" = "public"."current_student_id"()) AND ("visible_to_student" = true)) OR (("visible_to_tutor" = true) AND (EXISTS ( SELECT 1
   FROM "public"."tutor_student_allocations" "tsa"
  WHERE (("tsa"."student_id" = "learning_goals"."student_id") AND ("tsa"."tutor_id" = "public"."current_tutor_id"()) AND ("tsa"."status" = 'active'::"public"."record_status")))))));



CREATE POLICY "learning_goals_staff_access" ON "public"."learning_goals" USING (("current_setting"('app.current_role'::"text", true) = ANY (ARRAY['ADMIN'::"text", 'TUTOR'::"text"]))) WITH CHECK (("current_setting"('app.current_role'::"text", true) = ANY (ARRAY['ADMIN'::"text", 'TUTOR'::"text"])));



CREATE POLICY "learning_goals_student_own_select" ON "public"."learning_goals" FOR SELECT USING ((("visible_to_student" = true) AND (("student_id")::"text" = "current_setting"('app.current_student_id'::"text", true))));



ALTER TABLE "public"."ngo_partners" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "no_direct_audit_log_delete" ON "public"."audit_log" FOR DELETE USING (false);



CREATE POLICY "no_direct_audit_log_insert" ON "public"."audit_log" FOR INSERT WITH CHECK (false);



CREATE POLICY "no_direct_audit_log_update" ON "public"."audit_log" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "no_direct_session_history_delete" ON "public"."session_history" FOR DELETE USING (false);



CREATE POLICY "no_direct_session_history_insert" ON "public"."session_history" FOR INSERT WITH CHECK (false);



CREATE POLICY "no_direct_session_history_update" ON "public"."session_history" FOR UPDATE USING (false) WITH CHECK (false);



ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organization_members_coordinator_manage" ON "public"."organization_members" USING (("public"."is_platform_admin"() OR (("public"."current_org_role"("organization_id") = 'coordinator'::"public"."org_member_role") AND ("org_role" <> 'coordinator'::"public"."org_member_role")))) WITH CHECK (("public"."is_platform_admin"() OR (("public"."current_org_role"("organization_id") = 'coordinator'::"public"."org_member_role") AND ("org_role" <> 'coordinator'::"public"."org_member_role"))));



CREATE POLICY "organization_members_select_scoped" ON "public"."organization_members" FOR SELECT USING (("public"."is_platform_admin"() OR ("profile_id" = "public"."current_profile_id"()) OR ("organization_id" IN ( SELECT "public"."current_org_ids"() AS "current_org_ids"))));



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_select_member_or_admin" ON "public"."organizations" FOR SELECT USING (("public"."is_platform_admin"() OR ("id" IN ( SELECT "public"."current_org_ids"() AS "current_org_ids"))));



ALTER TABLE "public"."pay_periods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pay_periods_no_direct_delete" ON "public"."pay_periods" FOR DELETE USING (false);



CREATE POLICY "pay_periods_no_direct_insert" ON "public"."pay_periods" FOR INSERT WITH CHECK (false);



CREATE POLICY "pay_periods_no_direct_update" ON "public"."pay_periods" FOR UPDATE USING (false) WITH CHECK (false);



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."privacy_deletion_receipts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "privacy_deletion_receipts_admin_select" ON "public"."privacy_deletion_receipts" FOR SELECT TO "authenticated" USING ("public"."is_platform_admin"());



ALTER TABLE "public"."privacy_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "privacy_requests_admin_all" ON "public"."privacy_requests" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



ALTER TABLE "public"."profile_identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_self_or_admin" ON "public"."profiles" FOR SELECT USING ((("auth_user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "progress_insert_via_marking_rpc_only" ON "public"."student_progress" FOR INSERT WITH CHECK (false);



ALTER TABLE "public"."session_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sessions_no_direct_delete" ON "public"."sessions" FOR DELETE USING (false);



CREATE POLICY "sessions_no_direct_insert" ON "public"."sessions" FOR INSERT WITH CHECK (false);



CREATE POLICY "sessions_no_direct_update" ON "public"."sessions" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "sessions_staff_access" ON "public"."sessions" USING (("current_setting"('app.current_role'::"text", true) = ANY (ARRAY['ADMIN'::"text", 'TUTOR'::"text"]))) WITH CHECK (("current_setting"('app.current_role'::"text", true) = ANY (ARRAY['ADMIN'::"text", 'TUTOR'::"text"])));



CREATE POLICY "sessions_student_own_select" ON "public"."sessions" FOR SELECT USING ((("student_id")::"text" = "current_setting"('app.current_student_id'::"text", true)));



ALTER TABLE "public"."student_career_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_career_profiles_student_own_select" ON "public"."student_career_profiles" FOR SELECT USING ((("student_id")::"text" = "current_setting"('app.current_student_id'::"text", true)));



CREATE POLICY "student_career_profiles_student_own_write" ON "public"."student_career_profiles" USING ((("student_id")::"text" = "current_setting"('app.current_student_id'::"text", true))) WITH CHECK ((("student_id")::"text" = "current_setting"('app.current_student_id'::"text", true)));



ALTER TABLE "public"."student_exam_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_exam_events_no_direct_delete" ON "public"."student_exam_events" FOR DELETE USING (false);



CREATE POLICY "student_exam_events_no_direct_insert" ON "public"."student_exam_events" FOR INSERT WITH CHECK (false);



CREATE POLICY "student_exam_events_no_direct_update" ON "public"."student_exam_events" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "student_exam_events_select" ON "public"."student_exam_events" FOR SELECT USING (("public"."is_platform_admin"() OR ("student_id" = "public"."current_student_id"()) OR (EXISTS ( SELECT 1
   FROM "public"."tutor_student_allocations" "tsa"
  WHERE (("tsa"."student_id" = "student_exam_events"."student_id") AND ("tsa"."tutor_id" = "public"."current_tutor_id"()) AND ("tsa"."status" = 'active'::"public"."record_status"))))));



CREATE POLICY "student_exam_events_staff_access" ON "public"."student_exam_events" USING (("current_setting"('app.current_role'::"text", true) = ANY (ARRAY['ADMIN'::"text", 'TUTOR'::"text"]))) WITH CHECK (("current_setting"('app.current_role'::"text", true) = ANY (ARRAY['ADMIN'::"text", 'TUTOR'::"text"])));



CREATE POLICY "student_exam_events_student_own_select" ON "public"."student_exam_events" FOR SELECT USING ((("student_id")::"text" = "current_setting"('app.current_student_id'::"text", true)));



ALTER TABLE "public"."student_guardians" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_guardians_select_scoped" ON "public"."student_guardians" FOR SELECT USING (("public"."is_platform_admin"() OR ("guardian_id" IN ( SELECT "g"."id"
   FROM "public"."guardians" "g"
  WHERE ("g"."profile_id" = "public"."current_profile_id"())))));



ALTER TABLE "public"."student_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_notifications_no_direct_delete" ON "public"."student_notifications" FOR DELETE USING (false);



CREATE POLICY "student_notifications_no_direct_insert" ON "public"."student_notifications" FOR INSERT WITH CHECK (false);



CREATE POLICY "student_notifications_no_direct_update" ON "public"."student_notifications" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "student_notifications_staff_access" ON "public"."student_notifications" USING (("current_setting"('app.current_role'::"text", true) = ANY (ARRAY['ADMIN'::"text", 'TUTOR'::"text"]))) WITH CHECK (("current_setting"('app.current_role'::"text", true) = ANY (ARRAY['ADMIN'::"text", 'TUTOR'::"text"])));



CREATE POLICY "student_notifications_student_own_select" ON "public"."student_notifications" FOR SELECT USING ((("student_id")::"text" = "current_setting"('app.current_student_id'::"text", true)));



ALTER TABLE "public"."student_progress" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_progress_self_or_admin" ON "public"."student_progress" FOR SELECT USING (("public"."is_platform_admin"() OR ("student_id" = "public"."current_student_id"())));



ALTER TABLE "public"."student_score_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_score_snapshots_no_direct_delete" ON "public"."student_score_snapshots" FOR DELETE USING (false);



CREATE POLICY "student_score_snapshots_no_direct_insert" ON "public"."student_score_snapshots" FOR INSERT WITH CHECK (false);



CREATE POLICY "student_score_snapshots_no_direct_update" ON "public"."student_score_snapshots" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "student_score_snapshots_select" ON "public"."student_score_snapshots" FOR SELECT USING (("public"."is_platform_admin"() OR ("student_id" = "public"."current_student_id"()) OR (EXISTS ( SELECT 1
   FROM "public"."tutor_student_allocations" "tsa"
  WHERE (("tsa"."student_id" = "student_score_snapshots"."student_id") AND ("tsa"."tutor_id" = "public"."current_tutor_id"()) AND ("tsa"."status" = 'active'::"public"."record_status"))))));



CREATE POLICY "student_score_snapshots_staff_access" ON "public"."student_score_snapshots" USING (("current_setting"('app.current_role'::"text", true) = ANY (ARRAY['ADMIN'::"text", 'TUTOR'::"text"]))) WITH CHECK (("current_setting"('app.current_role'::"text", true) = ANY (ARRAY['ADMIN'::"text", 'TUTOR'::"text"])));



CREATE POLICY "student_score_snapshots_student_own_select" ON "public"."student_score_snapshots" FOR SELECT USING ((("user_id")::"text" = "current_setting"('app.current_user_id'::"text", true)));



CREATE POLICY "student_select_own_notifications" ON "public"."student_notifications" FOR SELECT USING (("student_id" = "public"."current_student_id"()));



CREATE POLICY "student_select_own_weekly_reports" ON "public"."weekly_reports" FOR SELECT USING (("student_id" = "public"."current_student_id"()));



ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "students_select_own_career_profile" ON "public"."student_career_profiles" FOR SELECT USING (("student_id" = "public"."current_student_id"()));



CREATE POLICY "students_select_self_or_admin" ON "public"."students" FOR SELECT USING (("public"."is_platform_admin"() OR ("profile_id" = "public"."current_profile_id"())));



CREATE POLICY "students_upsert_own_career_profile" ON "public"."student_career_profiles" USING (("student_id" = "public"."current_student_id"())) WITH CHECK (("student_id" = "public"."current_student_id"()));



ALTER TABLE "public"."subjects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subjects_read_authenticated" ON "public"."subjects" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "submissions_no_direct_student_update" ON "public"."assignment_submissions" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "submissions_student_insert_via_rpc_guard" ON "public"."assignment_submissions" FOR INSERT WITH CHECK (false);



CREATE POLICY "submissions_student_self_or_admin" ON "public"."assignment_submissions" FOR SELECT USING ("public"."is_platform_admin"());



CREATE POLICY "submissions_tutor_mark_via_rpc_only" ON "public"."assignment_submissions" FOR UPDATE USING (false) WITH CHECK (false);



ALTER TABLE "public"."tutor_applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tutor_applications_no_direct_delete" ON "public"."tutor_applications" FOR DELETE USING (false);



CREATE POLICY "tutor_applications_no_direct_insert" ON "public"."tutor_applications" FOR INSERT WITH CHECK (false);



CREATE POLICY "tutor_applications_no_direct_update" ON "public"."tutor_applications" FOR UPDATE USING (false) WITH CHECK (false);



ALTER TABLE "public"."tutor_availability_slots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tutor_availability_slots_no_direct_delete" ON "public"."tutor_availability_slots" FOR DELETE USING (false);



CREATE POLICY "tutor_availability_slots_no_direct_insert" ON "public"."tutor_availability_slots" FOR INSERT WITH CHECK (false);



CREATE POLICY "tutor_availability_slots_no_direct_update" ON "public"."tutor_availability_slots" FOR UPDATE USING (false) WITH CHECK (false);



ALTER TABLE "public"."tutor_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tutor_documents_no_direct_delete" ON "public"."tutor_documents" FOR DELETE USING (false);



CREATE POLICY "tutor_documents_no_direct_insert" ON "public"."tutor_documents" FOR INSERT WITH CHECK (false);



CREATE POLICY "tutor_documents_no_direct_update" ON "public"."tutor_documents" FOR UPDATE USING (false) WITH CHECK (false);



ALTER TABLE "public"."tutor_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tutor_select_allocated_weekly_reports" ON "public"."weekly_reports" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."tutor_student_allocations" "tsa"
  WHERE (("tsa"."student_id" = "weekly_reports"."student_id") AND ("tsa"."tutor_id" = "public"."current_tutor_id"()) AND ("tsa"."status" = 'active'::"public"."record_status")))));



ALTER TABLE "public"."tutor_student_allocations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tutor_student_allocations_select_scoped" ON "public"."tutor_student_allocations" FOR SELECT USING (("public"."is_platform_admin"() OR (("status" = 'active'::"public"."record_status") AND ("tutor_id" = "public"."current_tutor_id"()))));



ALTER TABLE "public"."tutors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tutors_insert_subjects" ON "public"."subjects" FOR INSERT WITH CHECK (("public"."current_approved_active_tutor_id"() IS NOT NULL));



CREATE POLICY "tutors_manage_own_assignments" ON "public"."assignments" USING ((("public"."current_approved_active_tutor_id"() IS NOT NULL) AND ("created_by" = "public"."current_profile_id"()))) WITH CHECK ((("public"."current_approved_active_tutor_id"() IS NOT NULL) AND ("created_by" = "public"."current_profile_id"())));



CREATE POLICY "tutors_select_own_adjustments" ON "public"."adjustments" FOR SELECT USING (("tutor_id" = "public"."current_tutor_id"()));



CREATE POLICY "tutors_select_own_application" ON "public"."tutor_applications" FOR SELECT USING (("tutor_id" = "public"."current_tutor_onboarding_id"()));



CREATE POLICY "tutors_select_own_assignment_submissions" ON "public"."assignment_submissions" FOR SELECT USING ((("public"."current_approved_active_tutor_id"() IS NOT NULL) AND ("assignment_id" IN ( SELECT "a"."id"
   FROM "public"."assignments" "a"
  WHERE ("a"."created_by" = "public"."current_profile_id"())))));



CREATE POLICY "tutors_select_own_availability_slots" ON "public"."tutor_availability_slots" FOR SELECT USING (("tutor_id" = "public"."current_tutor_onboarding_id"()));



CREATE POLICY "tutors_select_own_documents" ON "public"."tutor_documents" FOR SELECT USING (("tutor_id" = "public"."current_tutor_onboarding_id"()));



CREATE POLICY "tutors_select_own_invoice_lines" ON "public"."invoice_lines" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "invoice_lines"."invoice_id") AND ("i"."tutor_id" = "public"."current_tutor_id"())))));



CREATE POLICY "tutors_select_own_invoices" ON "public"."invoices" FOR SELECT USING (("tutor_id" = "public"."current_tutor_id"()));



CREATE POLICY "tutors_select_own_sessions" ON "public"."sessions" FOR SELECT USING (("tutor_id" = "public"."current_tutor_id"()));



CREATE POLICY "tutors_select_self_or_admin" ON "public"."tutors" FOR SELECT USING (("public"."is_platform_admin"() OR ("profile_id" = "public"."current_profile_id"())));



ALTER TABLE "public"."volunteer_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "volunteer_events_no_direct_delete" ON "public"."volunteer_events" FOR DELETE USING (false);



CREATE POLICY "volunteer_events_no_direct_insert" ON "public"."volunteer_events" FOR INSERT WITH CHECK (false);



CREATE POLICY "volunteer_events_no_direct_update" ON "public"."volunteer_events" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "volunteer_events_select" ON "public"."volunteer_events" FOR SELECT USING (("public"."is_platform_admin"() OR ("public"."current_tutor_id"() IS NOT NULL)));



ALTER TABLE "public"."volunteer_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "volunteer_logs_no_direct_delete" ON "public"."volunteer_logs" FOR DELETE USING (false);



CREATE POLICY "volunteer_logs_no_direct_insert" ON "public"."volunteer_logs" FOR INSERT WITH CHECK (false);



CREATE POLICY "volunteer_logs_no_direct_update" ON "public"."volunteer_logs" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "volunteer_logs_select" ON "public"."volunteer_logs" FOR SELECT USING (("public"."is_platform_admin"() OR ("tutor_id" = "public"."current_tutor_id"())));



ALTER TABLE "public"."weekly_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "weekly_reports_no_direct_delete" ON "public"."weekly_reports" FOR DELETE USING (false);



CREATE POLICY "weekly_reports_no_direct_insert" ON "public"."weekly_reports" FOR INSERT WITH CHECK (false);



CREATE POLICY "weekly_reports_no_direct_update" ON "public"."weekly_reports" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "weekly_reports_staff_access" ON "public"."weekly_reports" USING (("current_setting"('app.current_role'::"text", true) = ANY (ARRAY['ADMIN'::"text", 'TUTOR'::"text"]))) WITH CHECK (("current_setting"('app.current_role'::"text", true) = ANY (ARRAY['ADMIN'::"text", 'TUTOR'::"text"])));



CREATE POLICY "weekly_reports_student_own_select" ON "public"."weekly_reports" FOR SELECT USING ((("user_id")::"text" = "current_setting"('app.current_user_id'::"text", true)));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."anonymize_student"("p_student_id" "uuid") FROM PUBLIC;



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



REVOKE ALL ON FUNCTION "public"."approve_session"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_session"("p_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_session"("p_session_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."begin_student_privacy_deletion"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."begin_student_privacy_deletion"("p_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."block_audit_log_mutation"() TO "anon";
GRANT ALL ON FUNCTION "public"."block_audit_log_mutation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."block_audit_log_mutation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."block_session_history_mutation"() TO "anon";
GRANT ALL ON FUNCTION "public"."block_session_history_mutation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."block_session_history_mutation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_mark_submission"("p_submission_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_mark_submission"("p_submission_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_mark_submission"("p_submission_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_write_uncommitted_assignment_submission_storage"("p_storage_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_write_uncommitted_assignment_submission_storage"("p_storage_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_write_uncommitted_assignment_submission_storage"("p_storage_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_and_record_edge_function_rate_limit"("p_subject_id" "uuid", "p_function_name" "text", "p_limit" integer, "p_window_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_and_record_edge_function_rate_limit"("p_subject_id" "uuid", "p_function_name" "text", "p_limit" integer, "p_window_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."confirm_assignment_submission_attempt"("p_assignment_id" "uuid", "p_submission_id" "uuid", "p_storage_key" "text", "p_file_url" "text", "p_original_filename" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_text_answer" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirm_assignment_submission_attempt"("p_assignment_id" "uuid", "p_submission_id" "uuid", "p_storage_key" "text", "p_file_url" "text", "p_original_filename" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_text_answer" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_assignment_submission_attempt"("p_assignment_id" "uuid", "p_submission_id" "uuid", "p_storage_key" "text", "p_file_url" "text", "p_original_filename" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_text_answer" "text") TO "service_role";



GRANT ALL ON TABLE "public"."adjustments" TO "anon";
GRANT ALL ON TABLE "public"."adjustments" TO "authenticated";
GRANT ALL ON TABLE "public"."adjustments" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_adjustment"("p_tutor_id" "uuid", "p_type" "public"."adjustment_type", "p_amount" numeric, "p_reason" "text", "p_related_session_id" "uuid", "p_week_start" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_adjustment"("p_tutor_id" "uuid", "p_type" "public"."adjustment_type", "p_amount" numeric, "p_reason" "text", "p_related_session_id" "uuid", "p_week_start" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_adjustment"("p_tutor_id" "uuid", "p_type" "public"."adjustment_type", "p_amount" numeric, "p_reason" "text", "p_related_session_id" "uuid", "p_week_start" "date") TO "service_role";



GRANT ALL ON TABLE "public"."student_exam_events" TO "anon";
GRANT ALL ON TABLE "public"."student_exam_events" TO "authenticated";
GRANT ALL ON TABLE "public"."student_exam_events" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_exam_event"("p_student_id" "uuid", "p_subject" "text", "p_title" "text", "p_exam_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_exam_event"("p_student_id" "uuid", "p_subject" "text", "p_title" "text", "p_exam_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_exam_event"("p_student_id" "uuid", "p_subject" "text", "p_title" "text", "p_exam_date" "date") TO "service_role";



GRANT ALL ON TABLE "public"."learning_goals" TO "anon";
GRANT ALL ON TABLE "public"."learning_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."learning_goals" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_learning_goal"("p_student_id" "uuid", "p_title" "text", "p_description" "text", "p_category" "public"."learning_goal_category", "p_subject" "text", "p_target_value" numeric, "p_current_value" numeric, "p_due_date" "date", "p_status" "public"."learning_goal_status", "p_visible_to_student" boolean, "p_visible_to_tutor" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_learning_goal"("p_student_id" "uuid", "p_title" "text", "p_description" "text", "p_category" "public"."learning_goal_category", "p_subject" "text", "p_target_value" numeric, "p_current_value" numeric, "p_due_date" "date", "p_status" "public"."learning_goal_status", "p_visible_to_student" boolean, "p_visible_to_tutor" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_learning_goal"("p_student_id" "uuid", "p_title" "text", "p_description" "text", "p_category" "public"."learning_goal_category", "p_subject" "text", "p_target_value" numeric, "p_current_value" numeric, "p_due_date" "date", "p_status" "public"."learning_goal_status", "p_visible_to_student" boolean, "p_visible_to_tutor" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_session"("p_tutor_student_allocation_id" "uuid", "p_student_id" "uuid", "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_mode" "text", "p_location" "text", "p_notes" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_session"("p_tutor_student_allocation_id" "uuid", "p_student_id" "uuid", "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_mode" "text", "p_location" "text", "p_notes" "text", "p_idempotency_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_session"("p_tutor_student_allocation_id" "uuid", "p_student_id" "uuid", "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_mode" "text", "p_location" "text", "p_notes" "text", "p_idempotency_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_student_notification"("p_student_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_link" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_student_notification"("p_student_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_link" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."community_study_rooms" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_study_room"("p_subject" "text", "p_grade" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_study_room"("p_subject" "text", "p_grade" "text") TO "service_role";



GRANT ALL ON TABLE "public"."volunteer_events" TO "anon";
GRANT ALL ON TABLE "public"."volunteer_events" TO "authenticated";
GRANT ALL ON TABLE "public"."volunteer_events" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_volunteer_event"("p_title" "text", "p_description" "text", "p_event_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_location" "text", "p_mode" "text", "p_status" "public"."volunteer_event_status") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_volunteer_event"("p_title" "text", "p_description" "text", "p_event_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_location" "text", "p_mode" "text", "p_status" "public"."volunteer_event_status") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_volunteer_event"("p_title" "text", "p_description" "text", "p_event_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_location" "text", "p_mode" "text", "p_status" "public"."volunteer_event_status") TO "service_role";



GRANT ALL ON TABLE "public"."volunteer_logs" TO "anon";
GRANT ALL ON TABLE "public"."volunteer_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."volunteer_logs" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_volunteer_log"("p_event_id" "uuid", "p_hours" numeric, "p_volunteered_on" "date", "p_notes" "text", "p_evidence_document_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_volunteer_log"("p_event_id" "uuid", "p_hours" numeric, "p_volunteered_on" "date", "p_notes" "text", "p_evidence_document_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_volunteer_log"("p_event_id" "uuid", "p_hours" numeric, "p_volunteered_on" "date", "p_notes" "text", "p_evidence_document_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_active_student_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_active_student_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_active_student_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_approved_active_tutor_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_approved_active_tutor_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_approved_active_tutor_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_org_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_org_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_org_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_org_role"("org" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."current_org_role"("org" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_org_role"("org" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_profile_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_profile_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_profile_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_profile_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_profile_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_profile_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_student_class_ids"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_student_class_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_student_class_ids"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_student_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_student_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_student_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_student_identity_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_student_identity_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_student_identity_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_student_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_student_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_student_org_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_tutor_class_ids"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_tutor_class_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_tutor_class_ids"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_tutor_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_tutor_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_tutor_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_tutor_identity_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_tutor_identity_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_tutor_identity_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_tutor_onboarding_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_tutor_onboarding_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_tutor_onboarding_id"() TO "service_role";



GRANT ALL ON TABLE "public"."tutor_applications" TO "anon";
GRANT ALL ON TABLE "public"."tutor_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."tutor_applications" TO "service_role";



REVOKE ALL ON FUNCTION "public"."decide_tutor_application"("p_application_id" "uuid", "p_status" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."decide_tutor_application"("p_application_id" "uuid", "p_status" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decide_tutor_application"("p_application_id" "uuid", "p_status" "text", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."erase_student_privacy_data"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."erase_student_privacy_data"("p_request_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."export_student_data"("p_student_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."export_student_data"("p_student_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_student_data"("p_student_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fill_organization_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fill_organization_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fill_organization_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fill_session_organization_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fill_session_organization_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fill_session_organization_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fill_student_scoped_organization_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fill_student_scoped_organization_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fill_student_scoped_organization_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalize_student_privacy_deletion"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_student_privacy_deletion"("p_request_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_payroll_week"("p_week_start" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_payroll_week"("p_week_start" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_payroll_week"("p_week_start" "date") TO "service_role";



GRANT ALL ON TABLE "public"."weekly_reports" TO "anon";
GRANT ALL ON TABLE "public"."weekly_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_reports" TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_weekly_report"("p_student_id" "uuid", "p_week_start" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_weekly_report"("p_student_id" "uuid", "p_week_start" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_weekly_report"("p_student_id" "uuid", "p_week_start" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_community_challenges"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_community_challenges"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_community_questions"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_community_questions"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_community_rooms"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_community_rooms"() TO "service_role";



GRANT ALL ON TABLE "public"."pay_periods" TO "anon";
GRANT ALL ON TABLE "public"."pay_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."pay_periods" TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_or_create_pay_period"("p_period_start_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_or_create_pay_period"("p_period_start_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_pay_period"("p_period_start_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_org_cohort_report"("p_org_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_org_cohort_report"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_org_cohort_report"("p_org_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_parent_progress_reports"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_parent_progress_reports"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_parent_progress_reports"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_pay_period_integrity"("p_week_start" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_pay_period_integrity"("p_week_start" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pay_period_integrity"("p_week_start" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_room_messages"("p_room_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_room_messages"("p_room_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_student_assigned_tutors"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_student_assigned_tutors"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_student_assigned_tutors"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_student_assignment_submissions"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_student_assignment_submissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_student_assignment_submissions"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_student_privacy_storage_manifest"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_student_privacy_storage_manifest"("p_request_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_student_sessions"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_student_sessions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_student_sessions"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_tutor_allocated_students"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_tutor_allocated_students"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tutor_allocated_students"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_session_history"("p_session_id" "uuid", "p_change_type" "text", "p_before_json" "jsonb", "p_after_json" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_session_history"("p_session_id" "uuid", "p_change_type" "text", "p_before_json" "jsonb", "p_after_json" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."join_study_room"("p_room_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."join_study_room"("p_room_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."lock_pay_period"("p_week_start" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lock_pay_period"("p_week_start" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lock_pay_period"("p_week_start" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_audit_event"("p_action" "text", "p_entity_type" "text", "p_entity_id" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_audit_event"("p_action" "text", "p_entity_type" "text", "p_entity_id" "text", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_all_notifications_read"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"() TO "service_role";



GRANT ALL ON TABLE "public"."assignment_submissions" TO "anon";
GRANT ALL ON TABLE "public"."assignment_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."assignment_submissions" TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_assignment_submission"("p_submission_id" "uuid", "p_marks_awarded" numeric, "p_feedback" "text", "p_status" "public"."submission_status", "p_rubric_scores" "jsonb", "p_marks_released" boolean, "p_feedback_released" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_assignment_submission"("p_submission_id" "uuid", "p_marks_awarded" numeric, "p_feedback" "text", "p_status" "public"."submission_status", "p_rubric_scores" "jsonb", "p_marks_released" boolean, "p_feedback_released" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_assignment_submission"("p_submission_id" "uuid", "p_marks_awarded" numeric, "p_feedback" "text", "p_status" "public"."submission_status", "p_rubric_scores" "jsonb", "p_marks_released" boolean, "p_feedback_released" boolean) TO "service_role";



GRANT ALL ON TABLE "public"."student_notifications" TO "anon";
GRANT ALL ON TABLE "public"."student_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."student_notifications" TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_student_privacy_auth_banned"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_student_privacy_auth_banned"("p_request_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_student_privacy_auth_deleted"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_student_privacy_auth_deleted"("p_request_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_student_privacy_storage_deleted"("p_request_id" "uuid", "p_files_removed" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_student_privacy_storage_deleted"("p_request_id" "uuid", "p_files_removed" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."moderate_community_text"("p_content" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."moderate_community_text"("p_content" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."onboard_current_user"("p_role" "text", "p_full_name" "text", "p_phone" "text", "p_grade" "text", "p_school" "text", "p_parent_name" "text", "p_parent_contact" "text", "p_subjects" "text"[], "p_grades" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."onboard_current_user"("p_role" "text", "p_full_name" "text", "p_phone" "text", "p_grade" "text", "p_school" "text", "p_parent_name" "text", "p_parent_contact" "text", "p_subjects" "text"[], "p_grades" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."onboard_current_user"("p_role" "text", "p_full_name" "text", "p_phone" "text", "p_grade" "text", "p_school" "text", "p_parent_name" "text", "p_parent_contact" "text", "p_subjects" "text"[], "p_grades" "text"[]) TO "service_role";



GRANT ALL ON TABLE "public"."community_room_messages" TO "service_role";



REVOKE ALL ON FUNCTION "public"."post_room_message"("p_room_id" "uuid", "p_content" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."post_room_message"("p_room_id" "uuid", "p_content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_privacy_deletion_receipt_mutation"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_privacy_deletion_receipt_mutation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_privacy_deletion_receipt_mutation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."process_privacy_request"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."process_privacy_request"("p_request_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."process_privacy_request"("p_request_id" "uuid") TO "authenticated";



GRANT ALL ON TABLE "public"."career_progress_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."career_progress_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."career_progress_snapshots" TO "service_role";



REVOKE ALL ON FUNCTION "public"."recompute_career_progress_snapshot"("p_student_id" "uuid", "p_goal_id" "text", "p_recommended_subjects" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recompute_career_progress_snapshot"("p_student_id" "uuid", "p_goal_id" "text", "p_recommended_subjects" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_career_progress_snapshot"("p_student_id" "uuid", "p_goal_id" "text", "p_recommended_subjects" "text"[]) TO "service_role";



GRANT ALL ON TABLE "public"."student_score_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."student_score_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."student_score_snapshots" TO "service_role";



REVOKE ALL ON FUNCTION "public"."recompute_student_risk_snapshot"("p_student_id" "uuid", "p_score_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recompute_student_risk_snapshot"("p_student_id" "uuid", "p_score_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_student_risk_snapshot"("p_student_id" "uuid", "p_score_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_audit_event"("p_action" "text", "p_entity_type" "text", "p_entity_id" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_audit_event"("p_action" "text", "p_entity_type" "text", "p_entity_id" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_audit_event"("p_action" "text", "p_entity_type" "text", "p_entity_id" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."baseline_assessments" TO "anon";
GRANT ALL ON TABLE "public"."baseline_assessments" TO "authenticated";
GRANT ALL ON TABLE "public"."baseline_assessments" TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_baseline_assessment"("p_student_id" "uuid", "p_subject" "text", "p_score" numeric, "p_total" numeric, "p_grade" "text", "p_level_band" "text", "p_cognitive_breakdown" "jsonb", "p_topic_breakdown" "jsonb", "p_recommended_next_steps" "jsonb", "p_completed_at" timestamp with time zone, "p_source_type" "public"."baseline_source_type") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_baseline_assessment"("p_student_id" "uuid", "p_subject" "text", "p_score" numeric, "p_total" numeric, "p_grade" "text", "p_level_band" "text", "p_cognitive_breakdown" "jsonb", "p_topic_breakdown" "jsonb", "p_recommended_next_steps" "jsonb", "p_completed_at" timestamp with time zone, "p_source_type" "public"."baseline_source_type") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_baseline_assessment"("p_student_id" "uuid", "p_subject" "text", "p_score" numeric, "p_total" numeric, "p_grade" "text", "p_level_band" "text", "p_cognitive_breakdown" "jsonb", "p_topic_breakdown" "jsonb", "p_recommended_next_steps" "jsonb", "p_completed_at" timestamp with time zone, "p_source_type" "public"."baseline_source_type") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_student_privacy_deletion_error"("p_request_id" "uuid", "p_stage" "text", "p_error" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_student_privacy_deletion_error"("p_request_id" "uuid", "p_stage" "text", "p_error" "text") TO "service_role";



GRANT ALL ON TABLE "public"."tutor_documents" TO "anon";
GRANT ALL ON TABLE "public"."tutor_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."tutor_documents" TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_tutor_document"("p_document_type" "text", "p_storage_key" "text", "p_original_filename" "text", "p_mime_type" "text", "p_file_size_bytes" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_tutor_document"("p_document_type" "text", "p_storage_key" "text", "p_original_filename" "text", "p_mime_type" "text", "p_file_size_bytes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_tutor_document"("p_document_type" "text", "p_storage_key" "text", "p_original_filename" "text", "p_mime_type" "text", "p_file_size_bytes" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reject_session"("p_session_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reject_session"("p_session_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_session"("p_session_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON TABLE "public"."tutor_availability_slots" TO "anon";
GRANT ALL ON TABLE "public"."tutor_availability_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."tutor_availability_slots" TO "service_role";



REVOKE ALL ON FUNCTION "public"."replace_tutor_availability"("p_slots" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replace_tutor_availability"("p_slots" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace_tutor_availability"("p_slots" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."run_retention_cleanup"("p_apply" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."run_retention_cleanup"("p_apply" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."run_retention_cleanup_scheduled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."run_retention_cleanup_scheduled"() TO "service_role";



GRANT ALL ON FUNCTION "public"."session_date_pay_period_locked"("p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."session_date_pay_period_locked"("p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."session_date_pay_period_locked"("p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."session_within_allocation_window"("p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_start_date" "date", "p_end_date" "date", "p_allowed_days" "jsonb", "p_allowed_time_ranges" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."session_within_allocation_window"("p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_start_date" "date", "p_end_date" "date", "p_allowed_days" "jsonb", "p_allowed_time_ranges" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."session_within_allocation_window"("p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_start_date" "date", "p_end_date" "date", "p_allowed_days" "jsonb", "p_allowed_time_ranges" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_assignment_submission"("p_assignment_id" "uuid", "p_submission_id" "uuid", "p_storage_key" "text", "p_file_url" "text", "p_original_filename" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_text_answer" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_assignment_submission"("p_assignment_id" "uuid", "p_submission_id" "uuid", "p_storage_key" "text", "p_file_url" "text", "p_original_filename" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_text_answer" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_assignment_submission"("p_assignment_id" "uuid", "p_submission_id" "uuid", "p_storage_key" "text", "p_file_url" "text", "p_original_filename" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_text_answer" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_session"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_session"("p_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_session"("p_session_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_session_report"("p_session_id" "uuid", "p_attendance_status" "text", "p_topics_covered" "text", "p_learner_struggles" "text", "p_homework_assigned" "text", "p_tutor_private_notes" "text", "p_student_summary" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_session_report"("p_session_id" "uuid", "p_attendance_status" "text", "p_topics_covered" "text", "p_learner_struggles" "text", "p_homework_assigned" "text", "p_tutor_private_notes" "text", "p_student_summary" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_session_report"("p_session_id" "uuid", "p_attendance_status" "text", "p_topics_covered" "text", "p_learner_struggles" "text", "p_homework_assigned" "text", "p_tutor_private_notes" "text", "p_student_summary" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_tutor_application"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_tutor_application"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_tutor_application"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_profile_identity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_profile_identity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_profile_identity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_released_submission_progress"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."update_learning_goal"("p_goal_id" "uuid", "p_title" "text", "p_description" "text", "p_category" "public"."learning_goal_category", "p_subject" "text", "p_target_value" numeric, "p_current_value" numeric, "p_due_date" "date", "p_status" "public"."learning_goal_status", "p_visible_to_student" boolean, "p_visible_to_tutor" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_learning_goal"("p_goal_id" "uuid", "p_title" "text", "p_description" "text", "p_category" "public"."learning_goal_category", "p_subject" "text", "p_target_value" numeric, "p_current_value" numeric, "p_due_date" "date", "p_status" "public"."learning_goal_status", "p_visible_to_student" boolean, "p_visible_to_tutor" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_learning_goal"("p_goal_id" "uuid", "p_title" "text", "p_description" "text", "p_category" "public"."learning_goal_category", "p_subject" "text", "p_target_value" numeric, "p_current_value" numeric, "p_due_date" "date", "p_status" "public"."learning_goal_status", "p_visible_to_student" boolean, "p_visible_to_tutor" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_session"("p_session_id" "uuid", "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_mode" "text", "p_location" "text", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_session"("p_session_id" "uuid", "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_mode" "text", "p_location" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_session"("p_session_id" "uuid", "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_mode" "text", "p_location" "text", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_tutor_application"("p_personal_details" "jsonb", "p_subjects" "jsonb", "p_grades" "jsonb", "p_teaching_preferences" "jsonb", "p_experience" "text", "p_availability_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_tutor_application"("p_personal_details" "jsonb", "p_subjects" "jsonb", "p_grades" "jsonb", "p_teaching_preferences" "jsonb", "p_experience" "text", "p_availability_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_tutor_application"("p_personal_details" "jsonb", "p_subjects" "jsonb", "p_grades" "jsonb", "p_teaching_preferences" "jsonb", "p_experience" "text", "p_availability_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."verify_tutor_document"("p_document_id" "uuid", "p_status" "text", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_tutor_document"("p_document_id" "uuid", "p_status" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_tutor_document"("p_document_id" "uuid", "p_status" "text", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."verify_volunteer_log"("p_log_id" "uuid", "p_status" "public"."volunteer_log_status", "p_admin_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_volunteer_log"("p_log_id" "uuid", "p_status" "public"."volunteer_log_status", "p_admin_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_volunteer_log"("p_log_id" "uuid", "p_status" "public"."volunteer_log_status", "p_admin_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."void_adjustment"("p_adjustment_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."void_adjustment"("p_adjustment_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."void_adjustment"("p_adjustment_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON TABLE "public"."assignments" TO "anon";
GRANT ALL ON TABLE "public"."assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."assignments" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."class_enrollments" TO "anon";
GRANT ALL ON TABLE "public"."class_enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."class_enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."classes" TO "anon";
GRANT ALL ON TABLE "public"."classes" TO "authenticated";
GRANT ALL ON TABLE "public"."classes" TO "service_role";



GRANT ALL ON TABLE "public"."community_answers" TO "service_role";



GRANT ALL ON TABLE "public"."community_challenge_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."community_challenges" TO "service_role";



GRANT ALL ON TABLE "public"."community_questions" TO "service_role";



GRANT ALL ON TABLE "public"."community_room_members" TO "service_role";



GRANT ALL ON TABLE "public"."edge_function_rate_limit_events" TO "anon";
GRANT ALL ON TABLE "public"."edge_function_rate_limit_events" TO "authenticated";
GRANT ALL ON TABLE "public"."edge_function_rate_limit_events" TO "service_role";



GRANT ALL ON TABLE "public"."guardians" TO "anon";
GRANT ALL ON TABLE "public"."guardians" TO "authenticated";
GRANT ALL ON TABLE "public"."guardians" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_lines" TO "anon";
GRANT ALL ON TABLE "public"."invoice_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_lines" TO "service_role";



GRANT ALL ON TABLE "public"."ngo_partners" TO "anon";
GRANT ALL ON TABLE "public"."ngo_partners" TO "authenticated";
GRANT ALL ON TABLE "public"."ngo_partners" TO "service_role";



GRANT ALL ON TABLE "public"."organization_members" TO "anon";
GRANT ALL ON TABLE "public"."organization_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_members" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."privacy_deletion_receipts" TO "service_role";
GRANT SELECT ON TABLE "public"."privacy_deletion_receipts" TO "authenticated";



GRANT ALL ON TABLE "public"."privacy_requests" TO "anon";
GRANT ALL ON TABLE "public"."privacy_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."privacy_requests" TO "service_role";



GRANT ALL ON TABLE "public"."profile_identities" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."session_history" TO "anon";
GRANT ALL ON TABLE "public"."session_history" TO "authenticated";
GRANT ALL ON TABLE "public"."session_history" TO "service_role";



GRANT ALL ON TABLE "public"."student_career_profiles" TO "anon";
GRANT ALL ON TABLE "public"."student_career_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."student_career_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."student_guardians" TO "anon";
GRANT ALL ON TABLE "public"."student_guardians" TO "authenticated";
GRANT ALL ON TABLE "public"."student_guardians" TO "service_role";



GRANT ALL ON TABLE "public"."student_progress" TO "anon";
GRANT ALL ON TABLE "public"."student_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."student_progress" TO "service_role";



GRANT ALL ON TABLE "public"."students" TO "anon";
GRANT ALL ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";



GRANT ALL ON TABLE "public"."student_results_class_analytics_anonymous" TO "authenticated";
GRANT ALL ON TABLE "public"."student_results_class_analytics_anonymous" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."student_results_class_analytics_anonymous" TO "anon";



GRANT ALL ON TABLE "public"."subjects" TO "anon";
GRANT ALL ON TABLE "public"."subjects" TO "authenticated";
GRANT ALL ON TABLE "public"."subjects" TO "service_role";



GRANT ALL ON TABLE "public"."tutor_payments" TO "anon";
GRANT ALL ON TABLE "public"."tutor_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."tutor_payments" TO "service_role";



GRANT ALL ON TABLE "public"."tutor_student_allocations" TO "anon";
GRANT ALL ON TABLE "public"."tutor_student_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."tutor_student_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."tutors" TO "anon";
GRANT ALL ON TABLE "public"."tutors" TO "authenticated";
GRANT ALL ON TABLE "public"."tutors" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







