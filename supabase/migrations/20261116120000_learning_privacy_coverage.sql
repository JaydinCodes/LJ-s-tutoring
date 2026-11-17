create or replace function private.student_learning_privacy_manifest()
returns table(table_name text, subject_filter text, activity_column text)
language sql immutable set search_path = '' as $$
  values
    ('topic_mastery_evaluation_evidence', 'topic_mastery_evaluation_id in (select id from public.topic_mastery_evaluations where student_id = $1)', null),
    ('topic_mastery_evaluation_skill_evidence', 'topic_mastery_evaluation_id in (select id from public.topic_mastery_evaluations where student_id = $1)', null),
    ('topic_mastery_evaluations', 'student_id = $1', 'created_at'),
    ('learning_assessment_reassessment_authorizations', 'student_id = $1', 'authorised_at'),
    ('learning_assessment_session_extensions', 'learning_assessment_session_id in (select id from public.learning_assessment_sessions where student_id = $1)', 'authorised_at'),
    ('learning_assessment_session_question_results', 'learning_assessment_session_id in (select id from public.learning_assessment_sessions where student_id = $1)', 'created_at'),
    ('learning_assessment_session_answers', 'learning_assessment_session_question_id in (select question.id from public.learning_assessment_session_questions question join public.learning_assessment_sessions session on session.id = question.learning_assessment_session_id where session.student_id = $1)', 'updated_at'),
    ('learning_assessment_session_answer_events', 'learning_assessment_session_id in (select id from public.learning_assessment_sessions where student_id = $1)', 'created_at'),
    ('learning_assessment_session_questions', 'learning_assessment_session_id in (select id from public.learning_assessment_sessions where student_id = $1)', null),
    ('learning_assessment_sessions', 'student_id = $1', 'greatest(created_at, started_at, expires_at, submitted_at, finalised_at)'),
    ('qualifying_assignment_mastery_evidence', 'student_id = $1', 'greatest(created_at, qualified_at)'),
    ('learning_retention_check_events', 'retention_check_id in (select id from public.learning_retention_checks where student_id = $1)', 'occurred_at'),
    ('learning_retention_checks', 'student_id = $1', 'greatest(created_at, due_at, completed_at)'),
    ('intervention_outcomes', 'tutor_intervention_id in (select id from public.tutor_interventions where student_id = $1)', 'recorded_at'),
    ('tutor_interventions', 'student_id = $1', 'greatest(created_at, planned_at, delivered_at)'),
    ('learning_recommendation_reasons', 'recommendation_id in (select id from public.grade9_learning_recommendations where student_id = $1)', null),
    ('grade9_learning_recommendations', 'student_id = $1', 'greatest(created_at, closed_at)'),
    ('skill_mastery_evaluation_evidence', 'mastery_evaluation_id in (select id from public.skill_mastery_evaluations where student_id = $1)', null),
    ('skill_mastery_evaluations', 'student_id = $1', 'greatest(created_at, determined_at)'),
    ('learner_misconception_evidence', 'learner_misconception_id in (select id from public.learner_misconceptions where student_id = $1)', 'created_at'),
    ('learner_misconceptions', 'student_id = $1', 'greatest(created_at, determined_at)'),
    ('learning_attempt_reviews', 'learning_attempt_id in (select id from public.learning_attempts where student_id = $1)', 'greatest(created_at, reviewed_at)'),
    ('learning_attempt_skill_evidence', 'learning_attempt_id in (select id from public.learning_attempts where student_id = $1)', 'recorded_at'),
    ('learning_attempt_hint_events', 'learning_attempt_id in (select id from public.learning_attempts where student_id = $1)', 'opened_at'),
    ('learning_attempts', 'student_id = $1', 'greatest(created_at, occurred_at, evaluated_at)'),
    ('learner_activity_progress', 'student_id = $1', 'greatest(started_at, completed_at)'),
    ('student_learning_journey_context', 'student_id = $1', 'updated_at');
$$;

revoke all on function private.student_learning_privacy_manifest() from public, anon, authenticated, service_role;

create or replace function private.export_student_learning_data(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_entry record;
  v_rows jsonb;
  v_result jsonb := '{}'::jsonb;
begin
  for v_entry in select * from private.student_learning_privacy_manifest() loop
    execute format('select coalesce(jsonb_agg(to_jsonb(subject_row)), ''[]''::jsonb) from public.%I subject_row where %s', v_entry.table_name, v_entry.subject_filter)
      into v_rows using p_student_id;
    v_result := v_result || jsonb_build_object(v_entry.table_name, v_rows);
  end loop;
  return v_result;
end;
$$;

revoke all on function private.export_student_learning_data(uuid) from public, anon, authenticated, service_role;

create or replace function private.erase_student_learning_data(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_entry record;
  v_count integer;
  v_counts jsonb := '{}'::jsonb;
begin
  for v_entry in select * from private.student_learning_privacy_manifest() loop
    execute format('delete from public.%I where %s', v_entry.table_name, v_entry.subject_filter)
      using p_student_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object(v_entry.table_name || '_deleted', v_count);
  end loop;
  return v_counts;
end;
$$;

revoke all on function private.erase_student_learning_data(uuid) from public, anon, authenticated, service_role;

alter function public.export_student_data(uuid) rename to export_student_data_before_learning;
alter function public.export_student_data_before_learning(uuid) set schema private;
revoke all on function private.export_student_data_before_learning(uuid) from public, anon, authenticated, service_role;

create function public.export_student_data(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return private.export_student_data_before_learning(p_student_id)
    || jsonb_build_object('learning_records', private.export_student_learning_data(p_student_id));
end;
$$;

revoke all on function public.export_student_data(uuid) from public, anon, authenticated, service_role;
grant execute on function public.export_student_data(uuid) to authenticated;

alter function public.erase_student_privacy_data(uuid) rename to erase_student_privacy_data_before_learning;
alter function public.erase_student_privacy_data_before_learning(uuid) set schema private;
revoke all on function private.erase_student_privacy_data_before_learning(uuid) from public, anon, authenticated, service_role;

create function public.erase_student_privacy_data(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_request public.privacy_requests%rowtype;
  v_learning_counts jsonb;
  v_counts jsonb;
begin
  select * into v_request from public.privacy_requests where id = p_request_id for update;
  if not found then raise exception 'privacy_request_not_found' using errcode = 'P0002'; end if;
  if v_request.request_type <> 'deletion' then
    raise exception 'privacy_request_is_not_deletion' using errcode = '23514';
  end if;
  if v_request.processing_state = 'db_erased' then
    return coalesce(v_request.result -> 'db_erasure_counts', '{}'::jsonb);
  end if;
  if v_request.processing_state <> 'storage_deleted' then
    raise exception 'invalid_privacy_deletion_stage:%', v_request.processing_state using errcode = '23514';
  end if;
  if v_request.subject_student_id is null or v_request.subject_profile_id is null then
    raise exception 'privacy_request_subject_required' using errcode = '23514';
  end if;
  perform 1 from public.students where id = v_request.subject_student_id for update;
  v_learning_counts := private.erase_student_learning_data(v_request.subject_student_id);
  v_counts := private.erase_student_privacy_data_before_learning(p_request_id) || v_learning_counts;
  update public.privacy_requests
    set result = result || jsonb_build_object('manifest_version', 'PRIV-02-learning-v1', 'db_erasure_counts', v_counts)
    where id = p_request_id;
  return v_counts;
end;
$$;

revoke all on function public.erase_student_privacy_data(uuid) from public, anon, authenticated, service_role;
grant execute on function public.erase_student_privacy_data(uuid) to service_role;

alter function public.anonymize_student(uuid) rename to anonymize_student_before_learning;
alter function public.anonymize_student_before_learning(uuid) set schema private;
revoke all on function private.anonymize_student_before_learning(uuid) from public, anon, authenticated, service_role;

create function public.anonymize_student(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_counts jsonb;
begin
  if not public.is_platform_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  v_counts := private.erase_student_learning_data(p_student_id);
  return private.anonymize_student_before_learning(p_student_id) || jsonb_build_object('learning_erasure_counts', v_counts);
end;
$$;

revoke all on function public.anonymize_student(uuid) from public, anon, authenticated, service_role;

create or replace function private.execute_retention_cleanup(p_apply boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := now();
  v_academic_cut timestamptz := now() - interval '3 years';
  v_audit_cut timestamptz := now() - interval '5 years';
  v_financial_cut timestamptz := now() - interval '7 years';
  v_student record;
  v_entry record;
  v_latest timestamptz;
  v_activity timestamptz;
  v_eligible_students uuid[] := '{}';
  v_learning_counts jsonb := '{}'::jsonb;
  v_counts jsonb;
  v_count integer;
  v_submissions integer;
  v_progress integer;
  v_audit integer;
  v_payments integer;
  v_tutor_payments integer;
  v_files integer := 0;
begin
  for v_student in select id from public.students order by id for update loop
    v_latest := null;
    for v_entry in select * from private.student_learning_privacy_manifest() where activity_column is not null loop
      execute format('select max(%s) from public.%I where %s', v_entry.activity_column, v_entry.table_name, v_entry.subject_filter)
        into v_activity using v_student.id;
      v_latest := greatest(v_latest, v_activity);
    end loop;
    if v_latest < v_academic_cut then
      v_eligible_students := array_append(v_eligible_students, v_student.id);
      for v_entry in select * from private.student_learning_privacy_manifest() loop
        execute format('select count(*) from public.%I where %s', v_entry.table_name, v_entry.subject_filter)
          into v_count using v_student.id;
        v_learning_counts := jsonb_set(v_learning_counts, array[v_entry.table_name], to_jsonb(coalesce((v_learning_counts ->> v_entry.table_name)::integer, 0) + v_count));
      end loop;
    end if;
  end loop;

  select count(*) into v_submissions from public.assignment_submissions submission
    where submitted_at < v_academic_cut and not exists (
      select 1 from public.qualifying_assignment_mastery_evidence evidence
      where evidence.assignment_submission_id = submission.id and not (evidence.student_id = any(v_eligible_students))
    );
  select count(*) into v_progress from public.student_progress where recorded_at < v_academic_cut;
  select count(*) into v_audit from public.audit_log where created_at < v_audit_cut;
  select count(*) into v_payments from public.payments where paid_at < v_financial_cut;
  select count(*) into v_tutor_payments from public.tutor_payments where paid_at < v_financial_cut;

  if p_apply then
    for v_student in select unnest(v_eligible_students) as id loop
      perform private.erase_student_learning_data(v_student.id);
    end loop;
    begin
      delete from storage.objects object where object.bucket_id = 'assignment-submissions'
        and exists (select 1 from public.assignment_submissions submission
          where submission.submitted_at < v_academic_cut
            and (storage.foldername(object.name))[1] = submission.student_id::text
            and (storage.foldername(object.name))[3] = submission.id::text
            and not exists (select 1 from public.qualifying_assignment_mastery_evidence evidence where evidence.assignment_submission_id = submission.id));
      get diagnostics v_files = row_count;
    exception when insufficient_privilege then v_files := -1;
    end;
    delete from public.assignment_submissions submission where submitted_at < v_academic_cut
      and not exists (select 1 from public.qualifying_assignment_mastery_evidence evidence where evidence.assignment_submission_id = submission.id);
    delete from public.student_progress where recorded_at < v_academic_cut;
    delete from public.payments where paid_at < v_financial_cut;
    delete from public.tutor_payments where paid_at < v_financial_cut;
    delete from public.audit_log where created_at < v_audit_cut;
  end if;

  v_counts := jsonb_build_object(
    'submissions', v_submissions, 'progress', v_progress, 'audit', v_audit,
    'payments', v_payments, 'tutor_payments', v_tutor_payments,
    'learning_students', cardinality(v_eligible_students), 'learning_records', v_learning_counts
  );
  if p_apply then
    perform public.log_audit_event('retention.cleanup_applied', 'system', null, v_counts || jsonb_build_object('files', v_files));
  end if;
  return jsonb_build_object(
    'applied', p_apply, 'as_of', v_now,
    'windows_years', jsonb_build_object('submissions', 3, 'progress', 3, 'learning_inactivity', 3, 'audit', 5, 'financial', 7),
    'eligible', v_counts, 'files_removed', case when p_apply then v_files else null end
  );
end;
$$;

revoke all on function private.execute_retention_cleanup(boolean) from public, anon, authenticated, service_role;
