alter table public.tutors
  add column if not exists qualification_band text,
  add column if not exists qualified_subjects_json jsonb,
  add column if not exists approval_status text not null default 'approved',
  add column if not exists approval_reviewed_by uuid references public.profiles(id),
  add column if not exists approval_reviewed_at timestamptz,
  add column if not exists approval_note text,
  add column if not exists teaching_preferences_json jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tutors_approval_status_check'
  ) then
    alter table public.tutors
      add constraint tutors_approval_status_check
      check (approval_status in ('pending', 'under_review', 'approved', 'rejected', 'changes_requested'));
  end if;
end
$$;;
