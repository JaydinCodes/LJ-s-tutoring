create index if not exists assignment_submissions_student_assignment_idx
  on assignment_submissions(student_id, assignment_id);

create index if not exists sessions_student_date_start_idx
  on sessions(student_id, date desc, start_time desc);

create index if not exists study_streaks_user_updated_idx
  on study_streaks(user_id, updated_at desc);

create index if not exists student_notifications_student_unread_idx
  on student_notifications(student_id, read_at, created_at desc);

comment on index learning_assignments_student_idx is
  'BE-PERF-01 equivalent for student_assignments(student_id, due_date); existing non-duplicate index also covers created_at desc.';

comment on index assignment_submissions_student_assignment_idx is
  'BE-PERF-01 index for dashboard submission lookups by student and assignment.';

comment on index baseline_assessments_student_idx is
  'BE-PERF-01 equivalent for student_results(student_id, marked_at desc); baseline_assessments.completed_at is the marked/result timestamp.';

comment on index sessions_student_date_start_idx is
  'Supports student dashboard attendance and recent-session queries ordered by date/start time.';

comment on index student_notifications_student_unread_idx is
  'Supports dashboard notification list and unread-count queries scoped to one student.';
