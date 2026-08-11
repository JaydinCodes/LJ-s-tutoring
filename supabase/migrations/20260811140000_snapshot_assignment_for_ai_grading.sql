-- REL-07: AI grading must use the assignment context visible at submission
-- time, even if an admin later edits the rubric or instructions.

alter table public.assignment_submissions
  add column if not exists ai_assignment_snapshot_json jsonb not null default '{}'::jsonb;

create or replace function private.capture_assignment_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_assignment public.assignments%rowtype;
begin
  if new.ai_assignment_snapshot_json is not null
     and new.ai_assignment_snapshot_json <> '{}'::jsonb then
    return new;
  end if;

  select * into v_assignment
  from public.assignments
  where id = new.assignment_id;

  if found then
    new.ai_assignment_snapshot_json := jsonb_build_object(
      'assignment_id', v_assignment.id,
      'title', v_assignment.title,
      'description', v_assignment.description,
      'grade', v_assignment.grade,
      'rubric_json', v_assignment.rubric_json,
      'captured_at', coalesce(new.submitted_at, now())
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_capture_assignment_snapshot on public.assignment_submissions;
create trigger trg_capture_assignment_snapshot
before insert on public.assignment_submissions
for each row execute function private.capture_assignment_snapshot();

revoke all on function private.capture_assignment_snapshot() from public, anon, authenticated;
