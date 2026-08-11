-- Production recovery jobs must be installed after the Vault secret exists.
-- The original schedule migrations intentionally skip local installs without
-- the secret; this idempotent bootstrap is called by the release workflow so
-- adding the secret later cannot leave durable recovery silently absent.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function private.ensure_recovery_schedules()
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'ai_grading_service_role_key'
  ) then
    raise exception 'recovery_schedule_secret_missing';
  end if;

  perform cron.unschedule(jobid)
    from cron.job
   where jobname in (
     'ai-grading-worker',
     'cleanup-orphaned-assignment-submission-assets',
     'privacy-deletion-resumer'
   );

  perform cron.schedule(
    'ai-grading-worker',
    '* * * * *',
    $job$
      select net.http_post(
        url := 'https://jscrgpwyniphagitliuz.supabase.co/functions/v1/grade-submission',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'ai_grading_service_role_key'
          )
        ),
        body := jsonb_build_object('maxJobs', 1),
        timeout_milliseconds := 120000
      );
    $job$
  );

  perform cron.schedule(
    'cleanup-orphaned-assignment-submission-assets',
    '23 * * * *',
    $job$
      select net.http_post(
        url := 'https://jscrgpwyniphagitliuz.supabase.co/functions/v1/cleanup-submission-assets',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'ai_grading_service_role_key'
          )
        ),
        body := jsonb_build_object('limit', 500),
        timeout_milliseconds := 60000
      );
    $job$
  );

  perform cron.schedule(
    'privacy-deletion-resumer',
    '*/5 * * * *',
    $job$
      select net.http_post(
        url := 'https://jscrgpwyniphagitliuz.supabase.co/functions/v1/process-privacy-deletion',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'ai_grading_service_role_key'
          )
        ),
        body := jsonb_build_object('resume', true),
        timeout_milliseconds := 120000
      );
    $job$
  );

  if not exists (
    select 1 from cron.job
    where jobname = 'ai-grading-worker'
  ) or not exists (
    select 1 from cron.job
    where jobname = 'cleanup-orphaned-assignment-submission-assets'
  ) or not exists (
    select 1 from cron.job
    where jobname = 'privacy-deletion-resumer'
  ) then
    raise exception 'recovery_schedule_install_failed';
  end if;
end;
$$;

create or replace function private.assert_recovery_schedules_ready()
returns void
language plpgsql
security definer
stable
set search_path = public, extensions, pg_catalog
as $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'ai_grading_service_role_key'
  ) then
    raise exception 'recovery_schedule_secret_missing';
  end if;
  if not exists (select 1 from cron.job where jobname = 'ai-grading-worker') then
    raise exception 'ai_grading_worker_schedule_missing';
  end if;
  if not exists (
    select 1 from cron.job
    where jobname = 'cleanup-orphaned-assignment-submission-assets'
  ) or not exists (
    select 1 from cron.job
    where jobname = 'privacy-deletion-resumer'
  ) then
    raise exception 'submission_orphan_schedule_missing';
  end if;
end;
$$;

revoke all on function private.ensure_recovery_schedules() from public, anon, authenticated;
revoke all on function private.assert_recovery_schedules_ready() from public, anon, authenticated;
