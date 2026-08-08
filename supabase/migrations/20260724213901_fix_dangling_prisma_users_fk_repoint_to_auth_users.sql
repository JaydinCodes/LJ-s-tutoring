-- Fix (2026-07-24): 49 FKs across the schema pointed at public.users, a dead
-- leftover Prisma-era table (0 rows, no sync mechanism with auth.users).
-- Every SECURITY DEFINER function that logs an actor (log_audit_event and
-- friends) inserts auth.uid(), which only ever exists in auth.users. This
-- silently broke audit logging (and therefore submit_assignment_submission,
-- the POPIA privacy RPCs, etc.) for every real user. Repoint to auth.users(id),
-- matching how the rest of the Supabase-native schema already works
-- (e.g. profiles.auth_user_id references auth.users(id)), preserving each
-- column's existing ON DELETE behavior exactly.

alter table public.adjustments drop constraint adjustments_approved_by_user_id_fkey;
alter table public.adjustments add constraint adjustments_approved_by_user_id_fkey foreign key (approved_by_user_id) references auth.users(id) on delete set null;

alter table public.adjustments drop constraint adjustments_created_by_user_id_fkey;
alter table public.adjustments add constraint adjustments_created_by_user_id_fkey foreign key (created_by_user_id) references auth.users(id) on delete restrict;

alter table public.adjustments drop constraint adjustments_voided_by_user_id_fkey;
alter table public.adjustments add constraint adjustments_voided_by_user_id_fkey foreign key (voided_by_user_id) references auth.users(id) on delete set null;

alter table public.answers drop constraint answers_user_id_fkey;
alter table public.answers add constraint answers_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.answers drop constraint answers_verified_by_fkey;
alter table public.answers add constraint answers_verified_by_fkey foreign key (verified_by) references auth.users(id) on delete set null;

alter table public.audit_log drop constraint audit_log_actor_user_id_fkey;
alter table public.audit_log add constraint audit_log_actor_user_id_fkey foreign key (actor_user_id) references auth.users(id) on delete set null;

alter table public.auth_event_log drop constraint auth_event_log_user_id_fkey;
alter table public.auth_event_log add constraint auth_event_log_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;

alter table public.auth_sessions drop constraint auth_sessions_user_id_fkey;
alter table public.auth_sessions add constraint auth_sessions_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.baseline_assessments drop constraint baseline_assessments_created_by_user_id_fkey;
alter table public.baseline_assessments add constraint baseline_assessments_created_by_user_id_fkey foreign key (created_by_user_id) references auth.users(id);

alter table public.career_goal_selections drop constraint career_goal_selections_user_id_fkey;
alter table public.career_goal_selections add constraint career_goal_selections_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.career_progress_snapshots drop constraint career_progress_snapshots_user_id_fkey;
alter table public.career_progress_snapshots add constraint career_progress_snapshots_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.challenge_submissions drop constraint challenge_submissions_user_id_fkey;
alter table public.challenge_submissions add constraint challenge_submissions_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.challenges drop constraint challenges_created_by_fkey;
alter table public.challenges add constraint challenges_created_by_fkey foreign key (created_by) references auth.users(id) on delete restrict;

alter table public.community_blocks drop constraint community_blocks_blocked_user_id_fkey;
alter table public.community_blocks add constraint community_blocks_blocked_user_id_fkey foreign key (blocked_user_id) references auth.users(id) on delete cascade;

alter table public.community_blocks drop constraint community_blocks_blocker_user_id_fkey;
alter table public.community_blocks add constraint community_blocks_blocker_user_id_fkey foreign key (blocker_user_id) references auth.users(id) on delete cascade;

alter table public.community_profiles drop constraint community_profiles_user_id_fkey;
alter table public.community_profiles add constraint community_profiles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.community_reports drop constraint community_reports_reporter_id_fkey;
alter table public.community_reports add constraint community_reports_reporter_id_fkey foreign key (reporter_id) references auth.users(id) on delete cascade;

alter table public.email_otp_tokens drop constraint email_otp_tokens_user_id_fkey;
alter table public.email_otp_tokens add constraint email_otp_tokens_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.impersonation_sessions drop constraint impersonation_sessions_admin_user_id_fkey;
alter table public.impersonation_sessions add constraint impersonation_sessions_admin_user_id_fkey foreign key (admin_user_id) references auth.users(id) on delete cascade;

alter table public.impersonation_sessions drop constraint impersonation_sessions_revoked_by_user_id_fkey;
alter table public.impersonation_sessions add constraint impersonation_sessions_revoked_by_user_id_fkey foreign key (revoked_by_user_id) references auth.users(id) on delete set null;

alter table public.impersonation_sessions drop constraint impersonation_sessions_tutor_user_id_fkey;
alter table public.impersonation_sessions add constraint impersonation_sessions_tutor_user_id_fkey foreign key (tutor_user_id) references auth.users(id) on delete cascade;

alter table public.learning_assignments drop constraint learning_assignments_created_by_admin_id_fkey;
alter table public.learning_assignments add constraint learning_assignments_created_by_admin_id_fkey foreign key (created_by_admin_id) references auth.users(id);

alter table public.learning_assignments drop constraint learning_assignments_created_by_user_id_fkey;
alter table public.learning_assignments add constraint learning_assignments_created_by_user_id_fkey foreign key (created_by_user_id) references auth.users(id);

alter table public.learning_goals drop constraint learning_goals_created_by_user_id_fkey;
alter table public.learning_goals add constraint learning_goals_created_by_user_id_fkey foreign key (created_by_user_id) references auth.users(id);

alter table public.magic_link_tokens drop constraint magic_link_tokens_user_id_fkey;
alter table public.magic_link_tokens add constraint magic_link_tokens_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.pay_periods drop constraint pay_periods_locked_by_user_id_fkey;
alter table public.pay_periods add constraint pay_periods_locked_by_user_id_fkey foreign key (locked_by_user_id) references auth.users(id) on delete set null;

alter table public.privacy_requests drop constraint privacy_requests_closed_by_user_id_fkey;
alter table public.privacy_requests add constraint privacy_requests_closed_by_user_id_fkey foreign key (closed_by_user_id) references auth.users(id) on delete set null;

alter table public.privacy_requests drop constraint privacy_requests_created_by_user_id_fkey;
alter table public.privacy_requests add constraint privacy_requests_created_by_user_id_fkey foreign key (created_by_user_id) references auth.users(id) on delete set null;

alter table public.questions drop constraint questions_user_id_fkey;
alter table public.questions add constraint questions_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.session_history drop constraint session_history_changed_by_user_id_fkey;
alter table public.session_history add constraint session_history_changed_by_user_id_fkey foreign key (changed_by_user_id) references auth.users(id) on delete set null;

alter table public.sessions drop constraint sessions_approved_by_fkey;
alter table public.sessions add constraint sessions_approved_by_fkey foreign key (approved_by) references auth.users(id) on delete set null;

alter table public.student_exam_events drop constraint student_exam_events_created_by_user_id_fkey;
alter table public.student_exam_events add constraint student_exam_events_created_by_user_id_fkey foreign key (created_by_user_id) references auth.users(id) on delete set null;

alter table public.student_notifications drop constraint student_notifications_created_by_user_id_fkey;
alter table public.student_notifications add constraint student_notifications_created_by_user_id_fkey foreign key (created_by_user_id) references auth.users(id) on delete set null;

alter table public.student_score_snapshots drop constraint student_score_snapshots_user_id_fkey;
alter table public.student_score_snapshots add constraint student_score_snapshots_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.study_activity_events drop constraint study_activity_events_user_id_fkey;
alter table public.study_activity_events add constraint study_activity_events_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.study_room_members drop constraint study_room_members_user_id_fkey;
alter table public.study_room_members add constraint study_room_members_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.study_room_messages drop constraint study_room_messages_user_id_fkey;
alter table public.study_room_messages add constraint study_room_messages_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.study_room_pinned_resources drop constraint study_room_pinned_resources_created_by_fkey;
alter table public.study_room_pinned_resources add constraint study_room_pinned_resources_created_by_fkey foreign key (created_by) references auth.users(id) on delete restrict;

alter table public.study_rooms drop constraint study_rooms_created_by_fkey;
alter table public.study_rooms add constraint study_rooms_created_by_fkey foreign key (created_by) references auth.users(id) on delete restrict;

alter table public.study_streaks drop constraint study_streaks_user_id_fkey;
alter table public.study_streaks add constraint study_streaks_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.tutor_applications drop constraint tutor_applications_reviewed_by_fkey;
alter table public.tutor_applications add constraint tutor_applications_reviewed_by_fkey foreign key (reviewed_by) references auth.users(id);

alter table public.tutor_documents drop constraint tutor_documents_verified_by_fkey;
alter table public.tutor_documents add constraint tutor_documents_verified_by_fkey foreign key (verified_by) references auth.users(id);

alter table public.tutor_profiles drop constraint tutor_profiles_approval_reviewed_by_fkey;
alter table public.tutor_profiles add constraint tutor_profiles_approval_reviewed_by_fkey foreign key (approval_reviewed_by) references auth.users(id);

alter table public.tutoring_session_log drop constraint tutoring_session_log_created_by_user_id_fkey;
alter table public.tutoring_session_log add constraint tutoring_session_log_created_by_user_id_fkey foreign key (created_by_user_id) references auth.users(id) on delete set null;

alter table public.volunteer_events drop constraint volunteer_events_created_by_user_id_fkey;
alter table public.volunteer_events add constraint volunteer_events_created_by_user_id_fkey foreign key (created_by_user_id) references auth.users(id);

alter table public.volunteer_logs drop constraint volunteer_logs_verified_by_fkey;
alter table public.volunteer_logs add constraint volunteer_logs_verified_by_fkey foreign key (verified_by) references auth.users(id);

alter table public.weekly_reports drop constraint weekly_reports_created_by_user_id_fkey;
alter table public.weekly_reports add constraint weekly_reports_created_by_user_id_fkey foreign key (created_by_user_id) references auth.users(id) on delete set null;

alter table public.weekly_reports drop constraint weekly_reports_user_id_fkey;
alter table public.weekly_reports add constraint weekly_reports_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

-- Now fully unreferenced: drop the dead Prisma-era table itself.
drop table public.users;;
