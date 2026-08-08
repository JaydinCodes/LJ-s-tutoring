-- Fix (2026-07-25): 62 SECURITY DEFINER functions in public had EXECUTE
-- granted to anon (unauthenticated PostgREST callers, no login required).
-- Audited each individually (read the actual function body, not just the
-- name) -- 8 are low-level identity-resolution helpers (current_profile_id,
-- current_profile_role, current_student_id, current_tutor_id,
-- current_org_ids, current_org_role, current_student_org_id,
-- is_platform_admin) that Postgres RLS POLICIES themselves invoke during
-- query evaluation for every role including anon; revoking those would break
-- RLS entirely for anon queries, so they correctly keep the grant. The other
-- 54 are real application RPCs, trigger-only functions, or an event-trigger
-- function -- none have a legitimate unauthenticated use case, and several
-- rely solely on an internal auth check as their only barrier (the same
-- single-point-of-failure pattern that has already caused real bugs in this
-- codebase, e.g. the null-coalescing auth bypass already fixed once in
-- recompute_student_risk_snapshot). Most severe of these:
-- run_retention_cleanup's own code comment claims safety because "anon has
-- no EXECUTE grant at all" -- that premise was FALSE in production, and
-- auth.uid() is null for anon callers same as for service-role/pg_cron, so
-- anyone holding the public anon key could call
-- run_retention_cleanup(p_apply => true) and trigger real destructive
-- deletes. Revoking EXECUTE from anon on all 54 forces every real caller
-- through Supabase Auth first, where each function's existing internal
-- checks then apply as originally intended.

revoke execute on function public.anonymize_student(uuid) from anon;
revoke execute on function public.approve_session(uuid) from anon;
revoke execute on function public.can_mark_submission(uuid) from anon;
revoke execute on function public.create_adjustment(uuid,adjustment_type,numeric,text,uuid,date) from anon;
revoke execute on function public.create_exam_event(uuid,text,text,date) from anon;
revoke execute on function public.create_learning_goal(uuid,text,text,learning_goal_category,text,numeric,numeric,date,learning_goal_status,boolean,boolean) from anon;
revoke execute on function public.create_session(uuid,uuid,date,time without time zone,time without time zone,text,text,text,text) from anon;
revoke execute on function public.create_study_room(text,text) from anon;
revoke execute on function public.create_volunteer_event(text,text,date,time without time zone,time without time zone,text,text,volunteer_event_status) from anon;
revoke execute on function public.create_volunteer_log(uuid,numeric,date,text,uuid) from anon;
revoke execute on function public.decide_tutor_application(uuid,text,text) from anon;
revoke execute on function public.export_student_data(uuid) from anon;
revoke execute on function public.fill_organization_id() from anon;
revoke execute on function public.fill_session_organization_id() from anon;
revoke execute on function public.fill_student_scoped_organization_id() from anon;
revoke execute on function public.generate_payroll_week(date) from anon;
revoke execute on function public.generate_weekly_report(uuid,date) from anon;
revoke execute on function public.get_community_challenges() from anon;
revoke execute on function public.get_community_questions() from anon;
revoke execute on function public.get_community_rooms() from anon;
revoke execute on function public.get_or_create_pay_period(date) from anon;
revoke execute on function public.get_org_cohort_report(uuid) from anon;
revoke execute on function public.get_parent_progress_reports() from anon;
revoke execute on function public.get_pay_period_integrity(date) from anon;
revoke execute on function public.get_room_messages(uuid) from anon;
revoke execute on function public.get_student_assignment_submissions() from anon;
revoke execute on function public.get_student_sessions() from anon;
revoke execute on function public.join_study_room(uuid) from anon;
revoke execute on function public.lock_pay_period(date) from anon;
revoke execute on function public.mark_all_notifications_read() from anon;
revoke execute on function public.mark_assignment_submission(uuid,numeric,text,submission_status,jsonb,boolean,boolean) from anon;
revoke execute on function public.mark_notification_read(uuid) from anon;
revoke execute on function public.post_room_message(uuid,text) from anon;
revoke execute on function public.process_privacy_request(uuid) from anon;
revoke execute on function public.recompute_career_progress_snapshot(uuid,text,text[]) from anon;
revoke execute on function public.recompute_student_risk_snapshot(uuid,date) from anon;
revoke execute on function public.record_audit_event(text,text,text,jsonb) from anon;
revoke execute on function public.record_baseline_assessment(uuid,text,numeric,numeric,text,text,jsonb,jsonb,jsonb,timestamp with time zone,baseline_source_type) from anon;
revoke execute on function public.record_tutor_document(text,text,text,text,integer) from anon;
revoke execute on function public.reject_session(uuid,text) from anon;
revoke execute on function public.replace_tutor_availability(jsonb) from anon;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.run_retention_cleanup(boolean) from anon;
revoke execute on function public.submit_assignment_submission(uuid,uuid,text,text,text,text,bigint,text) from anon;
revoke execute on function public.submit_session(uuid) from anon;
revoke execute on function public.submit_session_report(uuid,text,text,text,text,text,text) from anon;
revoke execute on function public.submit_tutor_application() from anon;
revoke execute on function public.sync_profile_identity() from anon;
revoke execute on function public.update_learning_goal(uuid,text,text,learning_goal_category,text,numeric,numeric,date,learning_goal_status,boolean,boolean) from anon;
revoke execute on function public.update_session(uuid,date,time without time zone,time without time zone,text,text,text) from anon;
revoke execute on function public.upsert_tutor_application(jsonb,jsonb,jsonb,jsonb,text,text) from anon;
revoke execute on function public.verify_tutor_document(uuid,text,text) from anon;
revoke execute on function public.verify_volunteer_log(uuid,volunteer_log_status,text) from anon;
revoke execute on function public.void_adjustment(uuid,text) from anon;;
