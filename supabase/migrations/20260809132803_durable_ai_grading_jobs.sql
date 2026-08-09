-- Durable AI grading jobs.
--
-- Browser submissions only enqueue work. The grading worker claims a row
-- atomically, holds a lease while it talks to Gemini, and then finalises or
-- retries the job with an explicit claim token. That prevents stale workers
-- from overwriting a newer claim.

alter table public.assignment_submissions
  add column if not exists ai_job_attempts integer not null default 0,
  add column if not exists ai_job_available_at timestamptz not null default now(),
  add column if not exists ai_job_lease_expires_at timestamptz,
  add column if not exists ai_job_claim_token uuid,
  add column if not exists ai_job_claimed_at timestamptz,
  add column if not exists ai_job_last_error text;

create index if not exists idx_assignment_submissions_ai_jobs
  on public.assignment_submissions (ai_grading_status, ai_job_available_at)
  where ai_grading_status in ('pending', 'failed', 'in_progress');

create or replace function public.enqueue_ai_grading(p_submission_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := public.current_active_student_id();
  v_updated boolean := false;
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
     and (
       ai_grading_status in ('pending', 'failed', 'skipped')
       or (
         ai_grading_status = 'in_progress'
         and ai_job_lease_expires_at is not null
         and ai_job_lease_expires_at < now()
       )
     );

  if found then
    return true;
  end if;

  if exists (
    select 1
    from public.assignment_submissions
    where id = p_submission_id
      and student_id = v_student_id
  ) then
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
     set ai_grading_status = 'in_progress',
         ai_job_attempts = ai_job_attempts + 1,
         ai_job_lease_expires_at = now() + interval '20 minutes',
         ai_job_claim_token = gen_random_uuid(),
         ai_job_claimed_at = now(),
         ai_job_last_error = null
   where id = p_submission_id
     and (
       (ai_grading_status in ('pending', 'failed') and ai_job_available_at <= now())
       or (
         ai_grading_status = 'in_progress'
         and ai_job_lease_expires_at is not null
         and ai_job_lease_expires_at < now()
       )
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

  with candidate as (
    select id
    from public.assignment_submissions
    where (
      (ai_grading_status in ('pending', 'failed') and ai_job_available_at <= now())
      or (
        ai_grading_status = 'in_progress'
        and ai_job_lease_expires_at is not null
        and ai_job_lease_expires_at < now()
      )
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

create or replace function public.complete_ai_grading_job(
  p_submission_id uuid,
  p_claim_token uuid,
  p_ai_marks_awarded numeric,
  p_ai_feedback text,
  p_ai_rubric_scores_json jsonb,
  p_ai_confidence numeric,
  p_ai_graded_at timestamptz default now()
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
     set ai_marks_awarded = p_ai_marks_awarded,
         ai_feedback = p_ai_feedback,
         ai_rubric_scores_json = p_ai_rubric_scores_json,
         ai_confidence = p_ai_confidence,
         ai_graded_at = p_ai_graded_at,
         ai_grading_status = 'completed',
         ai_job_lease_expires_at = null,
         ai_job_claim_token = null,
         ai_job_claimed_at = null,
         ai_job_last_error = null,
         ai_job_available_at = now()
   where id = p_submission_id
     and ai_grading_status = 'in_progress'
     and ai_job_claim_token = p_claim_token
     and ai_job_lease_expires_at is not null
     and ai_job_lease_expires_at > now();

  return found;
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
  v_retry_minutes integer := greatest(1, least(coalesce(p_retry_after_minutes, 5), 120));
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  update public.assignment_submissions
     set ai_grading_status = 'failed',
         ai_job_available_at = now() + make_interval(mins => v_retry_minutes),
         ai_job_lease_expires_at = null,
         ai_job_claim_token = null,
         ai_job_claimed_at = null,
         ai_job_last_error = left(coalesce(nullif(btrim(p_error), ''), 'ai_grading_failed'), 4000)
   where id = p_submission_id
     and ai_grading_status = 'in_progress'
     and ai_job_claim_token = p_claim_token;

  return found;
end;
$$;

revoke all on function public.enqueue_ai_grading(uuid) from public, anon, authenticated, service_role;
grant execute on function public.enqueue_ai_grading(uuid) to authenticated;
revoke all on function public.claim_ai_grading_job(uuid) from public, anon, authenticated, service_role;
grant execute on function public.claim_ai_grading_job(uuid) to service_role;
revoke all on function public.claim_next_ai_grading_job() from public, anon, authenticated, service_role;
grant execute on function public.claim_next_ai_grading_job() to service_role;
revoke all on function public.complete_ai_grading_job(uuid, uuid, numeric, text, jsonb, numeric, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.complete_ai_grading_job(uuid, uuid, numeric, text, jsonb, numeric, timestamptz) to service_role;
revoke all on function public.fail_ai_grading_job(uuid, uuid, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.fail_ai_grading_job(uuid, uuid, text, integer) to service_role;
