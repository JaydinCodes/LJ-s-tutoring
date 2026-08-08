-- AI-assisted marking (v1): a new Edge Function (grade-submission) drafts a
-- mark/feedback the moment a student submits, so a tutor opens the review
-- screen to an already-graded draft instead of marking cold. The AI never
-- writes to the real marks_awarded/feedback/rubric_scores_json columns or the
-- release flags -- only a human explicitly saving through mark_submission()
-- does that, exactly as today. These are separate, additive ai_* columns the
-- review UI reads to prefill its form.
--
-- Grading needs something to check the student's answer against beyond the
-- rubric's criteria labels/max marks, so assignments gain an optional memo
-- (model answer). Unlike assignment-files (student-readable, see
-- authenticated_read_assignment_files), a memo must never reach a student --
-- it gets its own bucket with admin/owning-tutor-only read, no student branch.

alter table public.assignments add column if not exists memo_url text;

insert into storage.buckets (id, name, public)
values ('assignment-memos', 'assignment-memos', false)
on conflict (id) do nothing;

drop policy if exists "admin_tutor_upload_assignment_memos" on storage.objects;
create policy "admin_tutor_upload_assignment_memos"
on storage.objects for insert
with check (
  bucket_id = 'assignment-memos'
  and (
    public.is_platform_admin()
    or (
      public.current_profile_role() = 'tutor'
      and exists (
        select 1 from public.assignments a
        where a.id::text = (storage.foldername(name))[1]
          and a.created_by = public.current_profile_id()
      )
    )
  )
);

drop policy if exists "admin_tutor_read_assignment_memos" on storage.objects;
create policy "admin_tutor_read_assignment_memos"
on storage.objects for select
using (
  bucket_id = 'assignment-memos'
  and (
    public.is_platform_admin()
    or (
      public.current_profile_role() = 'tutor'
      and exists (
        select 1 from public.assignments a
        where a.id::text = (storage.foldername(name))[1]
          and a.created_by = public.current_profile_id()
      )
    )
  )
);

alter table public.assignment_submissions add column if not exists ai_marks_awarded numeric(8, 2);
alter table public.assignment_submissions add column if not exists ai_feedback text;
alter table public.assignment_submissions add column if not exists ai_rubric_scores_json jsonb not null default '{}'::jsonb;
alter table public.assignment_submissions add column if not exists ai_confidence numeric(5, 2);
alter table public.assignment_submissions add column if not exists ai_graded_at timestamptz;
alter table public.assignment_submissions add column if not exists ai_grading_status text not null default 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'assignment_submissions_ai_marks_awarded_check'
  ) then
    alter table public.assignment_submissions
      add constraint assignment_submissions_ai_marks_awarded_check
      check (ai_marks_awarded is null or (ai_marks_awarded >= 0 and ai_marks_awarded <= 100));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'assignment_submissions_ai_confidence_check'
  ) then
    alter table public.assignment_submissions
      add constraint assignment_submissions_ai_confidence_check
      check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 100));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'assignment_submissions_ai_rubric_scores_json_check'
  ) then
    alter table public.assignment_submissions
      add constraint assignment_submissions_ai_rubric_scores_json_check
      check (jsonb_typeof(ai_rubric_scores_json) = 'object' and octet_length(ai_rubric_scores_json::text) < 65536);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'assignment_submissions_ai_grading_status_check'
  ) then
    alter table public.assignment_submissions
      add constraint assignment_submissions_ai_grading_status_check
      check (ai_grading_status in ('pending', 'in_progress', 'completed', 'failed', 'skipped'));
  end if;
end $$;
;
