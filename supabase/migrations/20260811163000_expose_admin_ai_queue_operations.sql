-- REL-06: give AAL2 platform administrators a bounded operational view and a
-- controlled dead-letter requeue path without exposing queue tables directly.

create function public.get_admin_ai_grading_queue(p_limit integer default 100)
returns table (
  submission_id uuid, assignment_id uuid, status text, attempts integer,
  available_at timestamptz, lease_expires_at timestamptz, last_error text
)
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'admin_mfa_required' using errcode = '42501';
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

create function public.requeue_admin_ai_grading_job(p_submission_id uuid, p_reason text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare v_actor uuid := public.current_profile_id();
begin
  if not public.is_platform_admin() or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'admin_mfa_required' using errcode = '42501';
  end if;
  update public.assignment_submissions
  set ai_grading_status = 'pending', ai_job_attempts = 0,
      ai_job_available_at = now(), ai_job_claim_token = null,
      ai_job_claimed_at = null, ai_job_lease_expires_at = null,
      ai_job_last_error = null
  where id = p_submission_id and ai_grading_status = 'dead_lettered';
  if not found then return false; end if;
  perform public.log_audit_event('ai_grading.requeued_by_admin', 'assignment_submission', p_submission_id::text,
    jsonb_build_object('reason', left(coalesce(nullif(btrim(p_reason), ''), 'manual operator requeue'), 240), 'actor_profile_id', v_actor));
  return true;
end;
$$;

revoke all on function public.get_admin_ai_grading_queue(integer) from public, anon;
revoke all on function public.requeue_admin_ai_grading_job(uuid, text) from public, anon;
grant execute on function public.get_admin_ai_grading_queue(integer) to authenticated;
grant execute on function public.requeue_admin_ai_grading_job(uuid, text) to authenticated;
