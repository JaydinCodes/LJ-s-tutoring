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

do $$
declare
  target record;
begin
  for target in
    select * from (values
      ('adjustments', 'created_by_user_id'),
      ('weekly_reports', 'user_id'),
      ('sessions', 'assignment_id'),
      ('student_score_snapshots', 'user_id'),
      ('career_progress_snapshots', 'user_id')
    ) as targets(table_name, column_name)
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = target.table_name
        and column_name = target.column_name
        and is_nullable = 'NO'
    ) then
      execute format('alter table public.%I alter column %I drop not null', target.table_name, target.column_name);
    end if;
  end loop;
end
$$;

-- Fix (2026-07-25): public.student_results_class_analytics_anonymous is a
-- SECURITY DEFINER view (bypasses RLS on baseline_assessments/students) that
-- was directly SELECT-granted to anon -- unauthenticated internet access to
-- platform-wide aggregate assessment data, with no org scoping despite the
-- multi-org model. Revoking anon; authenticated/service_role access is left
-- intact pending a separate decision on org-scoping for logged-in staff/students.
do $$
begin
  if to_regclass('public.student_results_class_analytics_anonymous') is not null then
    revoke all on public.student_results_class_analytics_anonymous from anon;
  end if;
end
$$;
