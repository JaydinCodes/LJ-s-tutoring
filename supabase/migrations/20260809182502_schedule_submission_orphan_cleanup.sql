-- REL-01: delete abandoned client-uploaded submission objects through the
-- Storage API once they have been unreferenced for 24 hours. Reuse the
-- existing service-role Vault secret; no credential is stored in this file.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $migration$
begin
  if exists (select 1 from vault.secrets where name = 'ai_grading_service_role_key') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'cleanup-orphaned-assignment-submission-assets';

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
  else
    raise notice 'Submission orphan cleanup not scheduled locally: Vault secret ai_grading_service_role_key is absent';
  end if;
end
$migration$;
