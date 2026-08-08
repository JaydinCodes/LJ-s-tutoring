-- Fix (2026-07-25): 5 orphaned Prisma-era NOT NULL columns (no default, no
-- trigger) are silently breaking the RPCs that insert into their tables --
-- the RPC bodies never set them because schema.sql's design replaced them
-- (adjustments.created_by/approved_by/voided_by replace *_user_id;
-- tutor_student_allocation_id replaces sessions.assignment_id; weekly_reports
-- and the score-snapshot tables use created_by/student_id, never had a real
-- user_id concept in the new design). Verified via pg_get_functiondef that
-- create_adjustment, generate_weekly_report, create_session,
-- recompute_student_risk_snapshot, and recompute_career_progress_snapshot
-- never set these columns, and via information_schema.triggers that no
-- trigger fills them either (unlike organization_id, which genuinely has a
-- fill trigger on sessions/career_progress_snapshots/student_score_snapshots).
-- Every real INSERT through these RPCs has been failing since inception.

alter table public.adjustments alter column created_by_user_id drop not null;
alter table public.weekly_reports alter column user_id drop not null;
alter table public.sessions alter column assignment_id drop not null;
alter table public.student_score_snapshots alter column user_id drop not null;
alter table public.career_progress_snapshots alter column user_id drop not null;

-- Fix (2026-07-25): public.student_results_class_analytics_anonymous is a
-- SECURITY DEFINER view (bypasses RLS on baseline_assessments/students) that
-- was directly SELECT-granted to anon -- unauthenticated internet access to
-- platform-wide aggregate assessment data, with no org scoping despite the
-- multi-org model. Revoking anon; authenticated/service_role access is left
-- intact pending a separate decision on org-scoping for logged-in staff/students.
revoke all on public.student_results_class_analytics_anonymous from anon;;
