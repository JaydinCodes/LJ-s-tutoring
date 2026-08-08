-- SEC-01: split retention cleanup into explicitly authorized entry points.
--
-- 1. The existing admin RPC remains available to authenticated callers, but
--    performs a server-side platform-admin + AAL2 check before reaching the
--    destructive worker.
-- 2. Scheduled apply runs use a separate no-argument RPC that is executable
--    only by service_role and also validates the signed JWT role claim.
-- 3. The shared worker lives in a non-exposed schema and is not executable by
--    any API role.
--
-- Revoke first so an interrupted/partial deployment fails closed.
revoke all on function public.run_retention_cleanup(boolean)
from public, anon, authenticated, service_role;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

create or replace function private.execute_retention_cleanup(p_apply boolean)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_submissions_years int := 3;
  v_progress_years    int := 3;
  v_audit_years       int := 5;
  v_financial_years   int := 7;
  v_now  timestamptz := now();
  v_sub_cut  timestamptz := v_now - make_interval(years => v_submissions_years);
  v_prog_cut timestamptz := v_now - make_interval(years => v_progress_years);
  v_aud_cut  timestamptz := v_now - make_interval(years => v_audit_years);
  v_fin_cut  timestamptz := v_now - make_interval(years => v_financial_years);
  v_submissions int;
  v_progress int;
  v_audit int;
  v_payments int;
  v_tutor_payments int;
  v_files int := 0;
begin
  select count(*) into v_submissions
  from public.assignment_submissions
  where submitted_at < v_sub_cut;

  select count(*) into v_progress
  from public.student_progress
  where recorded_at < v_prog_cut;

  select count(*) into v_audit
  from public.audit_log
  where created_at < v_aud_cut;

  select count(*) into v_payments
  from public.payments
  where paid_at is not null
    and paid_at < v_fin_cut;

  select count(*) into v_tutor_payments
  from public.tutor_payments
  where paid_at is not null
    and paid_at < v_fin_cut;

  if p_apply then
    begin
      delete from storage.objects o
      where o.bucket_id = 'assignment-submissions'
        and exists (
          select 1
          from public.assignment_submissions s
          where s.submitted_at < v_sub_cut
            and (storage.foldername(o.name))[1] = s.student_id::text
            and (storage.foldername(o.name))[3] = s.id::text
        );
      get diagnostics v_files = row_count;
    exception
      when insufficient_privilege then
        v_files := -1;
    end;

    delete from public.assignment_submissions where submitted_at < v_sub_cut;
    delete from public.student_progress where recorded_at < v_prog_cut;
    delete from public.payments where paid_at is not null and paid_at < v_fin_cut;
    delete from public.tutor_payments where paid_at is not null and paid_at < v_fin_cut;
    delete from public.audit_log where created_at < v_aud_cut;

    perform public.log_audit_event(
      'retention.cleanup_applied',
      'system',
      null,
      jsonb_build_object(
        'submissions', v_submissions,
        'progress', v_progress,
        'payments', v_payments,
        'tutor_payments', v_tutor_payments,
        'audit', v_audit,
        'files', v_files
      )
    );
  end if;

  return jsonb_build_object(
    'applied', p_apply,
    'as_of', v_now,
    'windows_years', jsonb_build_object(
      'submissions', v_submissions_years,
      'progress', v_progress_years,
      'audit', v_audit_years,
      'financial', v_financial_years
    ),
    'eligible', jsonb_build_object(
      'submissions', v_submissions,
      'progress', v_progress,
      'payments', v_payments,
      'tutor_payments', v_tutor_payments,
      'audit', v_audit
    ),
    'files_removed', case when p_apply then v_files else null end
  );
end;
$$;

revoke all on function private.execute_retention_cleanup(boolean)
from public, anon, authenticated, service_role;

-- Browser/admin entry point. Keeping this signature avoids a frontend API
-- change while removing the unsafe auth.uid() IS NULL trust shortcut.
create or replace function public.run_retention_cleanup(p_apply boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return private.execute_retention_cleanup(p_apply);
end;
$$;

revoke all on function public.run_retention_cleanup(boolean)
from public, anon, authenticated, service_role;
grant execute on function public.run_retention_cleanup(boolean) to authenticated;

-- Scheduler entry point. It always applies cleanup and requires both the
-- service_role database grant and the signed service_role JWT claim.
create or replace function public.run_retention_cleanup_scheduled()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role_jwt_required' using errcode = '42501';
  end if;

  return private.execute_retention_cleanup(true);
end;
$$;

revoke all on function public.run_retention_cleanup_scheduled()
from public, anon, authenticated, service_role;
grant execute on function public.run_retention_cleanup_scheduled() to service_role;

comment on function public.run_retention_cleanup(boolean) is
  'Admin-only retention dry-run/apply RPC. Requires platform admin authorization with AAL2.';

comment on function public.run_retention_cleanup_scheduled() is
  'Service-role-only scheduled retention apply RPC. Requires a signed JWT role claim of service_role.';
