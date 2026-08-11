-- REL-08: serialize every session mutation with payroll close for the weeks
-- that the row can affect. A trigger makes the invariant apply to all current
-- and future write paths rather than relying on each RPC to remember the lock.
create or replace function private.lock_session_payroll_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_week date;
  v_new_week date;
begin
  if tg_op <> 'INSERT' then
    v_old_week := public.payroll_week_start(old.date);
  end if;
  if tg_op <> 'DELETE' then
    v_new_week := public.payroll_week_start(new.date);
  end if;

  -- A move between weeks must always lock in chronological order so two
  -- opposing moves cannot deadlock each other.
  if v_old_week is not null
     and v_new_week is not null
     and v_old_week is distinct from v_new_week
  then
    perform public.lock_payroll_week_mutation(least(v_old_week, v_new_week));
    perform public.lock_payroll_week_mutation(greatest(v_old_week, v_new_week));
  else
    perform public.lock_payroll_week_mutation(coalesce(v_new_week, v_old_week));
  end if;

  -- These checks deliberately happen after the advisory lock. If payroll won
  -- the race, its transaction has committed by the time this code resumes.
  if tg_op <> 'INSERT' then
    if public.session_date_pay_period_locked(old.date) then
      raise exception 'pay_period_locked' using errcode = '42501';
    end if;
  end if;
  if tg_op <> 'DELETE' and v_new_week is distinct from v_old_week then
    if public.session_date_pay_period_locked(new.date) then
      raise exception 'pay_period_locked' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.lock_session_payroll_mutation()
from public, anon, authenticated, service_role;

drop trigger if exists trg_lock_session_payroll_mutation on public.sessions;
create trigger trg_lock_session_payroll_mutation
before insert or update or delete on public.sessions
for each row execute function private.lock_session_payroll_mutation();

-- REL-04 / REL-05: make stale assignment and marking writes detectable.
alter table public.assignments
  add column if not exists revision integer not null default 1;
alter table public.assignment_submissions
  add column if not exists revision integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.assignments'::regclass
      and conname = 'assignments_revision_positive'
  ) then
    alter table public.assignments
      add constraint assignments_revision_positive check (revision > 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.assignment_submissions'::regclass
      and conname = 'assignment_submissions_revision_positive'
  ) then
    alter table public.assignment_submissions
      add constraint assignment_submissions_revision_positive check (revision > 0);
  end if;
end;
$$;

-- Replace the old signature with one endpoint whose revision parameter is
-- optional only for wire compatibility. An old client resolves the RPC but
-- receives submission_revision_required before any write can occur.
drop function public.mark_assignment_submission(
  uuid, numeric, text, public.submission_status, jsonb, boolean, boolean
);

create or replace function public.mark_assignment_submission(
  p_submission_id uuid,
  p_marks_awarded numeric,
  p_feedback text,
  p_status public.submission_status,
  p_rubric_scores jsonb default '{}'::jsonb,
  p_marks_released boolean default false,
  p_feedback_released boolean default false,
  p_expected_revision integer default null
)
returns setof public.assignment_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous public.assignment_submissions%rowtype;
  v_submission public.assignment_submissions%rowtype;
begin
  if not public.can_mark_submission(p_submission_id) then
    raise exception 'submission_marking_not_allowed' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'submission_revision_required'
      using errcode = '40001',
            hint = 'Reload the submission and retry with its current revision.';
  end if;
  if p_status not in ('submitted', 'marked', 'returned') then
    raise exception 'invalid_submission_status' using errcode = '23514';
  end if;
  if p_marks_awarded is not null
     and (p_marks_awarded < 0 or p_marks_awarded > 100)
  then
    raise exception 'marks_out_of_range' using errcode = '23514';
  end if;
  if jsonb_typeof(coalesce(p_rubric_scores, '{}'::jsonb)) <> 'object' then
    raise exception 'invalid_rubric_scores' using errcode = '23514';
  end if;

  select * into v_previous
  from public.assignment_submissions
  where id = p_submission_id
  for update;
  if not found then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;
  if v_previous.revision <> p_expected_revision then
    raise exception 'submission_revision_conflict'
      using errcode = '40001',
            detail = jsonb_build_object(
              'expected_revision', p_expected_revision,
              'current_revision', v_previous.revision
            )::text,
            hint = 'Reload or compare the current review before saving again.';
  end if;

  update public.assignment_submissions
  set marks_awarded = p_marks_awarded,
      feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
      status = p_status,
      rubric_scores_json = coalesce(p_rubric_scores, '{}'::jsonb),
      marks_released = coalesce(p_marks_released, false),
      feedback_released = coalesce(p_feedback_released, false),
      released_at = case
        when coalesce(p_marks_released, false)
          or coalesce(p_feedback_released, false)
        then coalesce(released_at, now())
        else null
      end,
      revision = revision + 1
  where id = p_submission_id
    and revision = p_expected_revision
  returning * into v_submission;
  if not found then
    raise exception 'submission_revision_conflict' using errcode = '40001';
  end if;

  perform public.log_audit_event(
    'submission.marked',
    'assignment_submission',
    v_submission.id::text,
    jsonb_build_object(
      'assignment_id', v_submission.assignment_id,
      'student_id', v_submission.student_id,
      'previous_status', v_previous.status,
      'new_status', v_submission.status,
      'previous_marks_awarded', v_previous.marks_awarded,
      'new_marks_awarded', v_submission.marks_awarded,
      'previous_revision', v_previous.revision,
      'new_revision', v_submission.revision
    )
  );

  if v_previous.feedback is distinct from v_submission.feedback
     or v_previous.rubric_scores_json is distinct from v_submission.rubric_scores_json
  then
    perform public.log_audit_event(
      'feedback.updated',
      'assignment_submission',
      v_submission.id::text,
      jsonb_build_object(
        'assignment_id', v_submission.assignment_id,
        'student_id', v_submission.student_id,
        'feedback_present', v_submission.feedback is not null,
        'rubric_scores_present', v_submission.rubric_scores_json <> '{}'::jsonb
      )
    );
  end if;

  if (
    not coalesce(v_previous.marks_released, false)
    and coalesce(v_submission.marks_released, false)
  ) or (
    not coalesce(v_previous.feedback_released, false)
    and coalesce(v_submission.feedback_released, false)
  ) then
    perform public.log_audit_event(
      'result.released',
      'assignment_submission',
      v_submission.id::text,
      jsonb_build_object(
        'assignment_id', v_submission.assignment_id,
        'student_id', v_submission.student_id,
        'marks_released', v_submission.marks_released,
        'feedback_released', v_submission.feedback_released,
        'released_at', v_submission.released_at
      )
    );
  end if;

  if (
    coalesce(v_previous.marks_released, false)
    and not coalesce(v_submission.marks_released, false)
  ) or (
    coalesce(v_previous.feedback_released, false)
    and not coalesce(v_submission.feedback_released, false)
  ) then
    perform public.log_audit_event(
      'result.unreleased',
      'assignment_submission',
      v_submission.id::text,
      jsonb_build_object(
        'assignment_id', v_submission.assignment_id,
        'student_id', v_submission.student_id,
        'marks_released', v_submission.marks_released,
        'feedback_released', v_submission.feedback_released
      )
    );
  end if;

  return next v_submission;
  return;
end;
$$;

-- Preserve old-client routing through a defaulted parameter, but fail closed
-- when that client omits the assignment revision.
drop function public.finalize_assignment_publication(
  uuid, text, text, uuid, text, timestamptz, public.assignment_status,
  text, text, jsonb
);

create or replace function public.finalize_assignment_publication(
  p_assignment_id uuid,
  p_title text,
  p_description text,
  p_subject_id uuid,
  p_grade text,
  p_due_date timestamptz,
  p_status public.assignment_status,
  p_attachment_url text,
  p_memo_url text,
  p_rubric_json jsonb default '[]'::jsonb,
  p_expected_revision integer default null
)
returns public.assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_assignment public.assignments%rowtype;
  v_previous_status public.assignment_status;
  v_previous_attachment_url text;
  v_is_new_attachment boolean;
  v_action text;
begin
  select * into v_assignment
  from public.assignments
  where id = p_assignment_id
  for update;
  if not found then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;
  if v_profile_id is null then
    raise exception 'assignment_actor_required' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'assignment_revision_required'
      using errcode = '40001',
            hint = 'Reload the assignment and retry with its current revision.';
  end if;
  if v_assignment.revision <> p_expected_revision then
    raise exception 'assignment_revision_conflict'
      using errcode = '40001',
            detail = jsonb_build_object(
              'expected_revision', p_expected_revision,
              'current_revision', v_assignment.revision
            )::text,
            hint = 'Reload or compare the current assignment before saving again.';
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null
     or nullif(btrim(coalesce(p_grade, '')), '') is null
  then
    raise exception 'assignment_title_and_grade_required' using errcode = '22023';
  end if;
  if p_memo_url is distinct from v_assignment.memo_url then
    raise exception 'assignment_memos_retired' using errcode = '22023';
  end if;
  if not public.is_platform_admin() and (
    public.current_approved_active_tutor_id() is null
    or v_assignment.created_by <> v_profile_id
    or not exists (
      select 1 from public.organization_members om
      where om.organization_id = v_assignment.organization_id
        and om.profile_id = v_profile_id
        and om.org_role = 'tutor'
        and om.status in ('active', 'approved')
    )
  ) then
    raise exception 'assignment_organization_forbidden' using errcode = '42501';
  end if;
  if p_attachment_url is not null
     and p_attachment_url is distinct from v_assignment.attachment_url
     and (
       p_attachment_url !~ ('^' || v_assignment.id::text || '/staging/[0-9a-fA-F-]{36}/[^/]+$')
       or not exists (
         select 1 from storage.objects o
         where o.bucket_id = 'assignment-files'
           and o.name = p_attachment_url
       )
     )
  then
    raise exception 'assignment_attachment_staging_asset_invalid' using errcode = '22023';
  end if;

  v_previous_attachment_url := v_assignment.attachment_url;
  v_previous_status := v_assignment.status;
  v_is_new_attachment := p_attachment_url is distinct from v_previous_attachment_url;

  update public.assignments
  set title = btrim(p_title),
      description = nullif(btrim(coalesce(p_description, '')), ''),
      subject_id = p_subject_id,
      grade = btrim(p_grade),
      due_date = p_due_date,
      status = p_status,
      attachment_url = p_attachment_url,
      rubric_json = coalesce(p_rubric_json, '[]'::jsonb),
      revision = revision + 1
  where id = v_assignment.id
    and revision = p_expected_revision
  returning * into v_assignment;
  if not found then
    raise exception 'assignment_revision_conflict' using errcode = '40001';
  end if;

  if v_is_new_attachment and v_previous_attachment_url is not null then
    delete from storage.objects o
    where o.bucket_id = 'assignment-files'
      and o.name = v_previous_attachment_url
      and not exists (
        select 1 from public.assignments a
        where a.id <> v_assignment.id
          and a.attachment_url = v_previous_attachment_url
      );
  end if;

  v_action := case
    when v_assignment.status = 'published'
      and v_previous_status is distinct from 'published'
    then 'assignment.published'
    else 'assignment.updated'
  end;
  perform public.log_audit_event(
    v_action,
    'assignment',
    v_assignment.id::text,
    jsonb_build_object(
      'status', v_assignment.status,
      'grade', v_assignment.grade,
      'subject_id', v_assignment.subject_id,
      'attachment_replaced', v_is_new_attachment,
      'memo_workflow', 'retired',
      'previous_revision', p_expected_revision,
      'new_revision', v_assignment.revision
    )
  );
  if v_is_new_attachment then
    perform public.log_audit_event(
      'assignment.attachment_replaced',
      'assignment',
      v_assignment.id::text,
      jsonb_build_object(
        'previous_attachment_url', v_previous_attachment_url,
        'new_attachment_url', p_attachment_url
      )
    );
  end if;
  return v_assignment;
end;
$$;

revoke all on function public.mark_assignment_submission(
  uuid, numeric, text, public.submission_status, jsonb, boolean, boolean, integer
) from public, anon;
grant execute on function public.mark_assignment_submission(
  uuid, numeric, text, public.submission_status, jsonb, boolean, boolean, integer
) to authenticated, service_role;

revoke all on function public.finalize_assignment_publication(
  uuid, text, text, uuid, text, timestamptz, public.assignment_status,
  text, text, jsonb, integer
) from public, anon;
grant execute on function public.finalize_assignment_publication(
  uuid, text, text, uuid, text, timestamptz, public.assignment_status,
  text, text, jsonb, integer
) to authenticated, service_role;
