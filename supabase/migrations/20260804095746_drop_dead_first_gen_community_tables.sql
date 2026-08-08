-- First-generation Community tables, replaced by the community_* schema
-- shipped in the 2026-06-06 baseline. Confirmed empty, unreferenced --
-- see 20260804130000_drop_confirmed_dead_tables.sql for full context.
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
;
