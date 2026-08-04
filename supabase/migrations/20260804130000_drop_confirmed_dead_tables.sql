-- Drops 45 tables + 2 materialized views confirmed dead (Jaydin, 2026-08-04):
-- none of these are defined in docs/supabase/schema.sql (the current source of
-- truth), none are referenced by any live FK/function/view/RLS policy, none
-- are queried by src/ or supabase/functions/, and all are empty except
-- tutor_profiles (1 placeholder seed row, "Tutor User") and schema_migrations
-- (31 rows of old Fastify/Prisma migration-tracking history) -- both
-- verified to have zero live dependents before this migration was written.
-- CASCADE is safe here because dependency checks already confirmed nothing
-- outside this set references any of these objects; it only resolves the
-- cross-references *within* the set (e.g. tutor_student_map/
-- impersonation_sessions/learning_assignments -> tutor_profiles) so no
-- manual drop ordering is required.

-- Arcade/gamification (dead feature, no longer pursued)
drop materialized view if exists public.arcade_ad_analytics_daily cascade;
drop materialized view if exists public.arcade_gameplay_analytics_daily cascade;
drop table if exists public.arcade_ad_blocklist cascade;
drop table if exists public.arcade_ad_events cascade;
drop table if exists public.arcade_ad_impressions cascade;
drop table if exists public.arcade_ad_providers cascade;
drop table if exists public.arcade_ad_rules cascade;
drop table if exists public.arcade_gameplay_events cascade;
drop table if exists public.arcade_games cascade;
drop table if exists public.arcade_players cascade;
drop table if exists public.arcade_reconciliation_reports cascade;
drop table if exists public.arcade_score_quarantine cascade;
drop table if exists public.arcade_score_validations cascade;
drop table if exists public.arcade_scores cascade;
drop table if exists public.arcade_session_tokens cascade;
drop table if exists public.arcade_sessions cascade;

-- Superseded duplicate-domain tables (replaced by tutors/sessions/
-- tutor_student_allocations/community_* equivalents)
drop table if exists public.tutor_profiles cascade;
drop table if exists public.tutor_student_assignments cascade;
drop table if exists public.tutor_student_map cascade;
drop table if exists public.tutoring_session_current cascade;
drop table if exists public.tutoring_session_log cascade;
drop table if exists public.tutoring_sessions cascade;
drop table if exists public.answers cascade;
drop table if exists public.questions cascade;
drop table if exists public.challenges cascade;
drop table if exists public.challenge_submissions cascade;

-- First-generation Community tables (replaced by the community_* schema
-- shipped in the 2026-06-06 baseline)
drop table if exists public.study_rooms cascade;
drop table if exists public.study_room_members cascade;
drop table if exists public.study_room_messages cascade;
drop table if exists public.study_room_pinned_resources cascade;
drop table if exists public.study_streaks cascade;
drop table if exists public.study_activity_events cascade;
drop table if exists public.community_blocks cascade;
drop table if exists public.community_profiles cascade;
drop table if exists public.community_reports cascade;
drop table if exists public.career_goal_selections cascade;

-- Retired Odie chat persistence (current odie-careers-chat-stream Edge
-- Function is deliberately stateless -- see its own source comment)
drop table if exists public.odie_conversations cascade;
drop table if exists public.odie_messages cascade;

-- Legacy Fastify-era auth/infra tables (retired with lms-api)
drop table if exists public.auth_event_log cascade;
drop table if exists public.auth_sessions cascade;
drop table if exists public.email_otp_tokens cascade;
drop table if exists public.impersonation_sessions cascade;
drop table if exists public.job_queue cascade;
drop table if exists public.learning_assignments cascade;
drop table if exists public.magic_link_tokens cascade;
drop table if exists public.retention_events cascade;
drop table if exists public.schema_migrations cascade;
