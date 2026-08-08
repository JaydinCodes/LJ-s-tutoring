-- Retired Odie chat persistence (current odie-careers-chat-stream Edge
-- Function is deliberately stateless) plus legacy Fastify-era auth/infra
-- tables retired with lms-api. Confirmed empty except schema_migrations
-- (31 rows of old migration-tracking history, no live dependents) -- see
-- 20260804130000_drop_confirmed_dead_tables.sql for full context.
drop table if exists public.odie_conversations cascade;
drop table if exists public.odie_messages cascade;
drop table if exists public.auth_event_log cascade;
drop table if exists public.auth_sessions cascade;
drop table if exists public.email_otp_tokens cascade;
drop table if exists public.impersonation_sessions cascade;
drop table if exists public.job_queue cascade;
drop table if exists public.learning_assignments cascade;
drop table if exists public.magic_link_tokens cascade;
drop table if exists public.retention_events cascade;
drop table if exists public.schema_migrations cascade;
;
