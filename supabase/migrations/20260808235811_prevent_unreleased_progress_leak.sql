-- DATA-01 — prevent unreleased assignment marks leaking through student_progress
--
-- Strategy:
--   * Track which progress rows are derived from assignment submissions.
--   * Conservatively classify legacy rows that match the old writer fingerprint.
--   * Remove any derived progress whose source mark is not currently released.
--   * Rebuild missing derived progress for released/marked submissions only.
--   * Maintain the invariant with an assignment_submissions trigger.
--   * Remove the old unconditional student_progress insert from
--     mark_assignment_submission().
--
-- Invariant after this migration:
--   A student_progress row with source_submission_id IS NOT NULL exists iff the
--   source submission is status='marked', marks_released=true, and has a mark.

alter table public.student_progress
  add column if not exists source_submission_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_progress_source_submission_fkey'
      and conrelid = 'public.student_progress'::regclass
  ) then
    alter table public.student_progress
      add constraint student_progress_source_submission_fkey
      foreign key (source_submission_id)
      references public.assignment_submissions(id)
      on delete cascade;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Legacy classification
--
-- The previous writer produced:
--   student_id = submission.student_id
--   subject_id = assignment.subject_id
--   topic      = assignment.title (or "Marked assignment")
--   score      = submission.marks_awarded
--
-- Treat matching rows as submission-derived. This is intentionally conservative:
-- a rare manually-entered row with the exact same student/subject/topic/score may
-- become release-gated rather than risk preserving an unreleased-mark leak.
-- ---------------------------------------------------------------------------
update public.student_progress sp
set source_submission_id = (
  select sub.id
  from public.assignment_submissions sub
  join public.assignments a on a.id = sub.assignment_id
  where sub.student_id = sp.student_id
    and a.subject_id is not distinct from sp.subject_id
    and coalesce(a.title, 'Marked assignment') = sp.topic
    and sub.marks_awarded is not null
    and sub.marks_awarded = sp.score
  order by
    abs(
      extract(
        epoch from (
          sp.recorded_at - coalesce(sub.released_at, sub.submitted_at)
        )
      )
    ) asc,
    sub.submitted_at desc,
    sub.id
  limit 1
)
where sp.source_submission_id is null
  and exists (
    select 1
    from public.assignment_submissions sub
    join public.assignments a on a.id = sub.assignment_id
    where sub.student_id = sp.student_id
      and a.subject_id is not distinct from sp.subject_id
      and coalesce(a.title, 'Marked assignment') = sp.topic
      and sub.marks_awarded is not null
      and sub.marks_awarded = sp.score
  );

-- Identify learners whose previously-generated derived progress was based on a
-- mark that is not currently released. Persisted weekly/risk snapshots can
-- otherwise retain the leaked score even after the live progress row is removed.
create temporary table data01_tainted_students (
  student_id uuid primary key
) on commit drop;

insert into data01_tainted_students (student_id)
select distinct sp.student_id
from public.student_progress sp
join public.assignment_submissions sub
  on sub.id = sp.source_submission_id
where not (
  sub.status = 'marked'
  and sub.marks_released is true
  and sub.marks_awarded is not null
);

-- Any legacy assignment-derived progress for an unreleased/non-marked source is
-- unsafe and must disappear immediately.
delete from public.student_progress sp
using public.assignment_submissions sub
where sp.source_submission_id = sub.id
  and not (
    sub.status = 'marked'
    and sub.marks_released is true
    and sub.marks_awarded is not null
  );

-- Invalidate persisted derivatives that may have copied the leaked progress
-- score. Both domains are regenerable; deleting uncertain historical snapshots
-- is safer than trying to infer which JSON field came from which old progress row.
delete from public.weekly_reports wr
using data01_tainted_students t
where wr.student_id = t.student_id;

delete from public.student_score_snapshots ss
using data01_tainted_students t
where ss.student_id = t.student_id;

-- The old marking RPC could append a new progress row every time the submission
-- was edited. Keep one derived row per submission before adding uniqueness.
with ranked as (
  select
    id,
    row_number() over (
      partition by source_submission_id
      order by recorded_at desc, id desc
    ) as rn
  from public.student_progress
  where source_submission_id is not null
)
delete from public.student_progress sp
using ranked r
where sp.id = r.id
  and r.rn > 1;

-- Ensure every already-released marked submission has its derived progress row.
insert into public.student_progress (
  student_id,
  subject_id,
  topic,
  score,
  cognitive_level,
  recorded_at,
  source_submission_id
)
select
  sub.student_id,
  a.subject_id,
  coalesce(a.title, 'Marked assignment'),
  sub.marks_awarded,
  null,
  coalesce(sub.released_at, sub.submitted_at, now()),
  sub.id
from public.assignment_submissions sub
join public.assignments a on a.id = sub.assignment_id
where sub.status = 'marked'
  and sub.marks_released is true
  and sub.marks_awarded is not null
  and not exists (
    select 1
    from public.student_progress sp
    where sp.source_submission_id = sub.id
  );

create unique index if not exists idx_student_progress_source_submission
  on public.student_progress(source_submission_id)
  where source_submission_id is not null;

-- ---------------------------------------------------------------------------
-- Authoritative synchronization trigger
-- ---------------------------------------------------------------------------
create or replace function public.sync_released_submission_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject_id uuid;
  v_title text;
begin
  -- Remove the old derived row first. This makes mark edits, status changes, and
  -- unrelease operations atomic from the perspective of student_progress.
  delete from public.student_progress
  where source_submission_id = new.id;

  if new.status = 'marked'
     and new.marks_released is true
     and new.marks_awarded is not null
  then
    select a.subject_id, coalesce(a.title, 'Marked assignment')
      into v_subject_id, v_title
    from public.assignments a
    where a.id = new.assignment_id;

    if not found then
      raise exception 'assignment_not_found'
        using errcode = 'P0002';
    end if;

    insert into public.student_progress (
      student_id,
      subject_id,
      topic,
      score,
      cognitive_level,
      recorded_at,
      source_submission_id
    )
    values (
      new.student_id,
      v_subject_id,
      v_title,
      new.marks_awarded,
      null,
      coalesce(new.released_at, now()),
      new.id
    );
  end if;

  return new;
end;
$$;

revoke all on function public.sync_released_submission_progress()
from public, anon, authenticated, service_role;

drop trigger if exists trg_sync_released_submission_progress
  on public.assignment_submissions;

create trigger trg_sync_released_submission_progress
after insert or update of
  assignment_id,
  student_id,
  status,
  marks_awarded,
  marks_released,
  released_at
on public.assignment_submissions
for each row
execute function public.sync_released_submission_progress();

-- ---------------------------------------------------------------------------
-- Replace the marking RPC.
--
-- The old function appended student_progress whenever p_status='marked',
-- regardless of marks_released. The trigger above is now the single authoritative
-- writer for submission-derived progress.
-- ---------------------------------------------------------------------------
create or replace function public.mark_assignment_submission(
  p_submission_id uuid,
  p_marks_awarded numeric,
  p_feedback text,
  p_status public.submission_status,
  p_rubric_scores jsonb default '{}'::jsonb,
  p_marks_released boolean default false,
  p_feedback_released boolean default false
)
returns setof public.assignment_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous public.assignment_submissions%rowtype;
  v_submission public.assignment_submissions%rowtype;
begin
  if not public.can_mark_submission(p_submission_id) then
    raise exception 'submission_marking_not_allowed' using errcode = '42501';
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

  select *
    into v_previous
  from public.assignment_submissions
  where id = p_submission_id;

  if not found then
    raise exception 'submission_not_found' using errcode = 'P0002';
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
      end
  where id = p_submission_id
  returning * into v_submission;

  if not found then
    raise exception 'submission_not_found' using errcode = 'P0002';
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
      'new_marks_awarded', v_submission.marks_awarded
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

-- Existing execute grant on mark_assignment_submission is retained by
-- CREATE OR REPLACE, but state it explicitly for migration readability.
grant execute on function public.mark_assignment_submission(
  uuid,
  numeric,
  text,
  public.submission_status,
  jsonb,
  boolean,
  boolean
) to authenticated;

comment on column public.student_progress.source_submission_id is
  'DATA-01 provenance. Non-null rows are assignment-derived and exist only while the source mark is released.';

comment on function public.sync_released_submission_progress() is
  'DATA-01 authoritative release gate for assignment-derived student progress.';