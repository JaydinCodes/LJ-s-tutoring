-- Correction (2026-07-25): the immediately-prior migration
-- (revoke_anon_execute_on_54_security_definer_functions) used
-- `revoke execute ... from anon`, which was a silent no-op -- these 54
-- functions never had an anon-SPECIFIC grant. Postgres automatically grants
-- EXECUTE to the PUBLIC pseudo-role on function creation unless explicitly
-- revoked, and PUBLIC access applies unconditionally to every role
-- including anon (confirmed via information_schema.routine_privileges:
-- grantee was 'PUBLIC', not 'anon', on all 54). `authenticated`, `postgres`,
-- and `service_role` each hold their OWN independent explicit EXECUTE grant
-- on every one of these functions (confirmed), so revoking PUBLIC removes
-- anon's (and any other unlisted role's) access without affecting them.

-- A clean schema legitimately lacks a few production-only function
-- signatures, so revoke the inherited PUBLIC grant without naming them.
revoke execute on all functions in schema public from public;

/* Historical explicit list retained for audit context:
revoke execute on function public.anonymize_student(uuid) from public;
revoke execute on function public.approve_session(uuid) from public;
revoke execute on function public.can_mark_submission(uuid) from public;
revoke execute on function public.create_adjustment(uuid,adjustment_type,numeric,text,uuid,date) from public;
revoke execute on function public.create_exam_event(uuid,text,text,date) from public;
revoke execute on function public.create_learning_goal(uuid,text,text,learning_goal_category,text,numeric,numeric,date,learning_goal_status,boolean,boolean) from public;
revoke execute on function public.create_session(uuid,uuid,date,time without time zone,time without time zone,text,text,text,text) from public;
revoke execute on function public.create_study_room(text,text) from public;
revoke execute on function public.create_volunteer_event(text,text,date,time without time zone,time without time zone,text,text,volunteer_event_status) from public;
revoke execute on function public.create_volunteer_log(uuid,numeric,date,text,uuid) from public;
revoke execute on function public.decide_tutor_application(uuid,text,text) from public;
revoke execute on function public.export_student_data(uuid) from public;
revoke execute on function public.fill_organization_id() from public;
revoke execute on function public.fill_session_organization_id() from public;
revoke execute on function public.fill_student_scoped_organization_id() from public;
revoke execute on function public.generate_payroll_week(date) from public;
revoke execute on function public.generate_weekly_report(uuid,date) from public;
revoke execute on function public.get_community_challenges() from public;
revoke execute on function public.get_community_questions() from public;
revoke execute on function public.get_community_rooms() from public;
revoke execute on function public.get_or_create_pay_period(date) from public;
revoke execute on function public.get_org_cohort_report(uuid) from public;
revoke execute on function public.get_parent_progress_reports() from public;
revoke execute on function public.get_pay_period_integrity(date) from public;
revoke execute on function public.get_room_messages(uuid) from public;
revoke execute on function public.get_student_assignment_submissions() from public;
revoke execute on function public.get_student_sessions() from public;
revoke execute on function public.join_study_room(uuid) from public;
revoke execute on function public.lock_pay_period(date) from public;
revoke execute on function public.mark_all_notifications_read() from public;
revoke execute on function public.mark_assignment_submission(uuid,numeric,text,submission_status,jsonb,boolean,boolean) from public;
revoke execute on function public.mark_notification_read(uuid) from public;
revoke execute on function public.post_room_message(uuid,text) from public;
revoke execute on function public.process_privacy_request(uuid) from public;
revoke execute on function public.recompute_career_progress_snapshot(uuid,text,text[]) from public;
revoke execute on function public.recompute_student_risk_snapshot(uuid,date) from public;
revoke execute on function public.record_audit_event(text,text,text,jsonb) from public;
revoke execute on function public.record_baseline_assessment(uuid,text,numeric,numeric,text,text,jsonb,jsonb,jsonb,timestamp with time zone,baseline_source_type) from public;
revoke execute on function public.record_tutor_document(text,text,text,text,integer) from public;
revoke execute on function public.reject_session(uuid,text) from public;
revoke execute on function public.replace_tutor_availability(jsonb) from public;
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.run_retention_cleanup(boolean) from public;
revoke execute on function public.submit_assignment_submission(uuid,uuid,text,text,text,text,bigint,text) from public;
revoke execute on function public.submit_session(uuid) from public;
revoke execute on function public.submit_session_report(uuid,text,text,text,text,text,text) from public;
revoke execute on function public.submit_tutor_application() from public;
revoke execute on function public.sync_profile_identity() from public;
revoke execute on function public.update_learning_goal(uuid,text,text,learning_goal_category,text,numeric,numeric,date,learning_goal_status,boolean,boolean) from public;
revoke execute on function public.update_session(uuid,date,time without time zone,time without time zone,text,text,text) from public;
revoke execute on function public.upsert_tutor_application(jsonb,jsonb,jsonb,jsonb,text,text) from public;
revoke execute on function public.verify_tutor_document(uuid,text,text) from public;
revoke execute on function public.verify_volunteer_log(uuid,volunteer_log_status,text) from public;
revoke execute on function public.void_adjustment(uuid,text) from public;
*/
