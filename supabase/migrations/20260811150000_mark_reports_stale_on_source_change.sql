-- REL-11: persisted reports are snapshots. Mark them stale when a source row
-- changes, and clear the marker only when the report is regenerated.

alter table public.weekly_reports
  add column if not exists is_stale boolean not null default false,
  add column if not exists stale_since timestamptz,
  add column if not exists source_watermark timestamptz not null default now();

create index if not exists idx_weekly_reports_stale
  on public.weekly_reports (is_stale, stale_since desc)
  where is_stale = true;

create or replace function private.clear_weekly_report_stale_marker()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.is_stale := false;
  new.stale_since := null;
  new.source_watermark := now();
  return new;
end;
$$;

drop trigger if exists trg_clear_weekly_report_stale_marker on public.weekly_reports;
create trigger trg_clear_weekly_report_stale_marker
before insert or update of payload_json on public.weekly_reports
for each row execute function private.clear_weekly_report_stale_marker();

create or replace function private.mark_weekly_reports_stale(
  p_student_id uuid,
  p_source_date date
)
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  update public.weekly_reports
  set is_stale = true,
      stale_since = coalesce(stale_since, now())
  where student_id = p_student_id
    and week_start <= p_source_date
    and week_end >= p_source_date;
$$;

create or replace function private.mark_weekly_reports_stale_from_submission()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'INSERT'
     or old.marks_awarded is distinct from new.marks_awarded
     or old.feedback is distinct from new.feedback
     or old.marks_released is distinct from new.marks_released
     or old.feedback_released is distinct from new.feedback_released
     or old.status is distinct from new.status then
    perform private.mark_weekly_reports_stale(new.student_id, new.submitted_at::date);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mark_weekly_reports_stale_submission on public.assignment_submissions;
create trigger trg_mark_weekly_reports_stale_submission
after insert or update of marks_awarded, feedback, marks_released, feedback_released, status
on public.assignment_submissions
for each row execute function private.mark_weekly_reports_stale_from_submission();

create or replace function private.mark_weekly_reports_stale_from_session()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'INSERT'
     or old.status is distinct from new.status
     or old.date is distinct from new.date
     or old.duration_minutes is distinct from new.duration_minutes then
    perform private.mark_weekly_reports_stale(new.student_id, new.date);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mark_weekly_reports_stale_session on public.sessions;
create trigger trg_mark_weekly_reports_stale_session
after insert or update of status, date, duration_minutes
on public.sessions
for each row execute function private.mark_weekly_reports_stale_from_session();

revoke all on function private.clear_weekly_report_stale_marker() from public, anon, authenticated;
revoke all on function private.mark_weekly_reports_stale(uuid, date) from public, anon, authenticated;
revoke all on function private.mark_weekly_reports_stale_from_submission() from public, anon, authenticated;
revoke all on function private.mark_weekly_reports_stale_from_session() from public, anon, authenticated;
