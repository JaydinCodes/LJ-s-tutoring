-- Superseded duplicate-domain tables (replaced by tutors/sessions/
-- tutor_student_allocations equivalents). Confirmed empty except
-- tutor_profiles (1 placeholder seed row, no live referencing rows) --
-- see 20260804130000_drop_confirmed_dead_tables.sql for full context.
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
;
