-- Arcade/gamification (dead feature, no longer pursued). All confirmed
-- empty and unreferenced by any live FK/function/view/frontend code -- see
-- 20260804130000_drop_confirmed_dead_tables.sql for the full verification
-- context; this is a per-category split of that same file to apply safely.
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
;
