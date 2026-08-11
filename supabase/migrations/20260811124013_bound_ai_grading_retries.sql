-- Bound AI grading recovery. Human marks remain independent; AI is optional,
-- and a provider outage must not create an unbounded retry backlog.

alter table public.assignment_submissions
  drop constraint if exists assignment_submissions_ai_grading_status_check;
alter table public.assignment_submissions
  add constraint assignment_submissions_ai_grading_status_check
  check (ai_grading_status in ('pending', 'in_progress', 'completed', 'failed', 'skipped', 'dead_lettered'));

create or replace function private.ai_grading_max_attempts()
returns integer
language sql
immutable
strict
set search_path = 'pg_catalog'
as $$
  select 8;
$$;

create or replace function private.ai_grading_retry_delay_minutes(p_attempts integer)
returns integer
language sql
immutable
strict
set search_path = 'pg_catalog'
as $$
  select case greatest(coalesce(p_attempts, 1), 1)
    when 1 then 5
    when 2 then 10
    when 3 then 20
    when 4 then 40
    when 5 then 80
    when 6 then 160
    else 320
  end;
$$;

create index if not exists idx_assignment_submissions_ai_dead_letters
  on public.assignment_submissions (ai_job_attempts desc, ai_job_claimed_at desc)
  where ai_grading_status = 'dead_lettered';

create or replace function public.enqueue_ai_grading(p_submission_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := public.current_active_student_id();
begin
  if v_student_id is null then
    raise exception 'only_students_can_queue_ai_grading' using errcode = '42501';
  end if;

  update public.assignment_submissions
     set ai_grading_status = 'pending',
         ai_job_available_at = now(),
         ai_job_lease_expires_at = null,
         ai_job_claim_token = null,
         ai_job_claimed_at = null,
         ai_job_last_error = null
   where id = p_submission_id
     and student_id = v_student_id
     and ai_grading_status in ('pending', 'failed', 'skipped');

  if found then
    return true;
  end if;
  if exists (select 1 from public.assignment_submissions where id = p_submission_id and student_id = v_student_id) then
    return true;
  end if;
  raise exception 'submission_not_found' using errcode = 'P0002';
end;
$$;

create or replace function public.claim_ai_grading_job(p_submission_id uuid)
returns public.assignment_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.assignment_submissions;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  update public.assignment_submissions
     set ai_grading_status = 'dead_lettered',
         ai_job_lease_expires_at = null,
         ai_job_claim_token = null,
         ai_job_claimed_at = null,
         ai_job_last_error = left(coalesce(nullif(ai_job_last_error, ''), 'ai_grading_max_attempts_exceeded'), 4000)
   where id = p_submission_id
     and ai_grading_status = 'in_progress'
     and ai_job_attempts >= private.ai_grading_max_attempts()
     and ai_job_lease_expires_at is not null
     and ai_job_lease_expires_at < now();

  update public.assignment_submissions
     set ai_grading_status = 'in_progress',
         ai_job_attempts = ai_job_attempts + 1,
         ai_job_lease_expires_at = now() + interval '20 minutes',
         ai_job_claim_token = gen_random_uuid(),
         ai_job_claimed_at = now(),
         ai_job_last_error = null
   where id = p_submission_id
     and ai_job_attempts < private.ai_grading_max_attempts()
     and (
       (ai_grading_status in ('pending', 'failed') and ai_job_available_at <= now())
       or (ai_grading_status = 'in_progress' and ai_job_lease_expires_at < now())
     )
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.claim_next_ai_grading_job()
returns public.assignment_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.assignment_submissions;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  update public.assignment_submissions
     set ai_grading_status = 'dead_lettered',
         ai_job_lease_expires_at = null,
         ai_job_claim_token = null,
         ai_job_claimed_at = null,
         ai_job_last_error = left(coalesce(nullif(ai_job_last_error, ''), 'ai_grading_max_attempts_exceeded'), 4000)
   where ai_grading_status = 'in_progress'
     and ai_job_attempts >= private.ai_grading_max_attempts()
     and ai_job_lease_expires_at is not null
     and ai_job_lease_expires_at < now();

  with candidate as (
    select id
    from public.assignment_submissions
    where ai_job_attempts < private.ai_grading_max_attempts()
      and (
        (ai_grading_status in ('pending', 'failed') and ai_job_available_at <= now())
        or (ai_grading_status = 'in_progress' and ai_job_lease_expires_at < now())
      )
    order by ai_job_available_at asc, submitted_at asc, id asc
    limit 1
    for update skip locked
  )
  update public.assignment_submissions s
     set ai_grading_status = 'in_progress',
         ai_job_attempts = ai_job_attempts + 1,
         ai_job_lease_expires_at = now() + interval '20 minutes',
         ai_job_claim_token = gen_random_uuid(),
         ai_job_claimed_at = now(),
         ai_job_last_error = null
    from candidate
   where s.id = candidate.id
  returning s.* into v_row;
  return v_row;
end;
$$;

create or replace function public.fail_ai_grading_job(
  p_submission_id uuid,
  p_claim_token uuid,
  p_error text,
  p_retry_after_minutes integer default 5
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
  v_status text;
  v_dead_lettered boolean := false;
  v_updated boolean := false;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  select ai_job_attempts, ai_grading_status
    into v_attempts, v_status
    from public.assignment_submissions
   where id = p_submission_id
     and ai_grading_status = 'in_progress'
     and ai_job_claim_token = p_claim_token
   for update;
  if not found then
    return false;
  end if;

  v_dead_lettered := v_attempts >= private.ai_grading_max_attempts();
  update public.assignment_submissions
     set ai_grading_status = case when v_dead_lettered then 'dead_lettered' else 'failed' end,
         ai_job_available_at = case
           when v_dead_lettered then now()
           else now() + make_interval(mins => private.ai_grading_retry_delay_minutes(v_attempts))
         end,
         ai_job_lease_expires_at = null,
         ai_job_claim_token = null,
         ai_job_claimed_at = null,
         ai_job_last_error = left(coalesce(nullif(btrim(p_error), ''), 'ai_grading_failed'), 4000)
   where id = p_submission_id
     and ai_grading_status = 'in_progress'
     and ai_job_claim_token = p_claim_token
  returning true into v_updated;

  if v_dead_lettered and v_updated then
    perform public.log_audit_event(
      'ai_grading.dead_lettered',
      'assignment_submission',
      p_submission_id::text,
      jsonb_build_object('attempts', v_attempts, 'error', left(coalesce(p_error, 'ai_grading_failed'), 500))
    );
  end if;
  return coalesce(v_updated, false);
end;
$$;

create or replace function public.requeue_ai_grading_job(
  p_submission_id uuid,
  p_reason text default 'manual_requeue'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  update public.assignment_submissions
     set ai_grading_status = 'pending',
         ai_job_attempts = 0,
         ai_job_available_at = now(),
         ai_job_lease_expires_at = null,
         ai_job_claim_token = null,
         ai_job_claimed_at = null,
         ai_job_last_error = left(coalesce(nullif(btrim(p_reason), ''), 'manual_requeue'), 4000)
   where id = p_submission_id
     and ai_grading_status = 'dead_lettered';
  return found;
end;
$$;

create or replace function public.get_ai_grading_queue_metrics()
returns table (status text, job_count bigint, oldest_available_at timestamptz, ready_count bigint)
language sql
security definer
stable
set search_path = public
as $$
  select
    ai_grading_status,
    count(*)::bigint,
    min(ai_job_available_at),
    count(*) filter (where ai_job_available_at <= now())::bigint
  from public.assignment_submissions
  where ai_grading_status in ('pending', 'in_progress', 'failed', 'dead_lettered')
  group by ai_grading_status
  order by ai_grading_status;
$$;

revoke all on function public.requeue_ai_grading_job(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.requeue_ai_grading_job(uuid, text) to service_role;
revoke all on function public.get_ai_grading_queue_metrics() from public, anon, authenticated, service_role;
grant execute on function public.get_ai_grading_queue_metrics() to service_role;
