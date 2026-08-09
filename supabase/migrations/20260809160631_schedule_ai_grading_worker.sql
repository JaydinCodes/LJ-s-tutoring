-- Process one due AI-grading job every minute. The worker itself atomically
-- claims each job and leases it, so an overlapping invocation cannot grade the
-- same submission twice. Keep the service credential in Vault: it never lives
-- in this migration, in a cron command, or in the client application.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $migration$
begin
  if exists (
    select 1
    from vault.secrets
    where name = 'ai_grading_service_role_key'
  ) then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'ai-grading-worker';

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
  else
    raise notice 'AI grading worker not scheduled locally: Vault secret ai_grading_service_role_key is absent';
  end if;
end
$migration$;
