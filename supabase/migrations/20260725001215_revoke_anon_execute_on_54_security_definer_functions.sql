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

-- Use schema-wide revocation rather than naming a production-only function
-- signature. A clean schema legitimately lacks several retired functions.
revoke execute on all functions in schema public from anon;

-- These helpers are deliberately called by RLS policies for anonymous
-- requests and therefore remain available to anon.
grant execute on function public.current_profile_id() to anon;
grant execute on function public.current_profile_role() to anon;
grant execute on function public.current_student_id() to anon;
grant execute on function public.current_tutor_id() to anon;
grant execute on function public.current_org_ids() to anon;
grant execute on function public.current_org_role(uuid) to anon;
grant execute on function public.current_student_org_id() to anon;
grant execute on function public.is_platform_admin() to anon;
