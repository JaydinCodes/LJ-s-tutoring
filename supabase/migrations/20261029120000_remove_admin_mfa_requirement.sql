-- Administrators are authorized by their application role. Supabase Auth MFA
-- remains available at the provider level, but it is no longer required to use
-- the admin portal or its server-side operations.

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_profile_role() = 'admin', false)
$$;

-- These operational functions previously made an additional direct AAL2
-- check, so redefining is_platform_admin alone is not enough for them.
create or replace function public.get_admin_ai_grading_queue(p_limit integer default 100)
returns table (
  submission_id uuid, assignment_id uuid, status text, attempts integer,
  available_at timestamptz, lease_expires_at timestamptz, last_error text
)
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  return query
  select s.id, s.assignment_id, s.ai_grading_status, s.ai_job_attempts,
    s.ai_job_available_at, s.ai_job_lease_expires_at, s.ai_job_last_error
  from public.assignment_submissions s
  where s.ai_grading_status in ('pending', 'in_progress', 'failed', 'dead_lettered')
  order by (s.ai_grading_status = 'dead_lettered') desc,
    s.ai_job_available_at nulls last, s.submitted_at asc
  limit least(greatest(coalesce(p_limit, 100), 1), 250);
end;
$$;

create or replace function public.requeue_admin_ai_grading_job(p_submission_id uuid, p_reason text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare v_actor uuid := public.current_profile_id();
begin
  if not public.is_platform_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  update public.assignment_submissions
  set ai_grading_status = 'pending', ai_job_attempts = 0,
      ai_job_available_at = now(), ai_job_claim_token = null,
      ai_job_claimed_at = null, ai_job_lease_expires_at = null,
      ai_job_last_error = null
  where id = p_submission_id and ai_grading_status = 'dead_lettered';

  if not found then return false; end if;

  perform public.log_audit_event(
    'ai_grading.requeued_by_admin',
    'assignment_submission',
    p_submission_id::text,
    jsonb_build_object(
      'reason', left(coalesce(nullif(btrim(p_reason), ''), 'manual operator requeue'), 240),
      'actor_profile_id', v_actor
    )
  );
  return true;
end;
$$;
