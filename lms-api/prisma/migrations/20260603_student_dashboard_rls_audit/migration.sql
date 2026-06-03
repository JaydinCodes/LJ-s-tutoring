alter table learning_assignments enable row level security;
alter table assignment_submissions enable row level security;
alter table learning_goals enable row level security;
alter table student_exam_events enable row level security;
alter table sessions enable row level security;
alter table study_streaks enable row level security;
alter table study_activity_events enable row level security;
alter table weekly_reports enable row level security;
alter table student_score_snapshots enable row level security;
alter table student_notifications enable row level security;

drop policy if exists learning_assignments_student_own_select on learning_assignments;
create policy learning_assignments_student_own_select
on learning_assignments
for select
using (student_id::text = current_setting('app.current_student_id', true));

drop policy if exists learning_assignments_staff_access on learning_assignments;
create policy learning_assignments_staff_access
on learning_assignments
for all
using (current_setting('app.current_role', true) in ('ADMIN', 'TUTOR'))
with check (current_setting('app.current_role', true) in ('ADMIN', 'TUTOR'));

drop policy if exists assignment_submissions_student_own_select on assignment_submissions;
create policy assignment_submissions_student_own_select
on assignment_submissions
for select
using (student_id::text = current_setting('app.current_student_id', true));

drop policy if exists assignment_submissions_student_own_insert on assignment_submissions;
create policy assignment_submissions_student_own_insert
on assignment_submissions
for insert
with check (student_id::text = current_setting('app.current_student_id', true));

drop policy if exists assignment_submissions_staff_access on assignment_submissions;
create policy assignment_submissions_staff_access
on assignment_submissions
for all
using (current_setting('app.current_role', true) in ('ADMIN', 'TUTOR'))
with check (current_setting('app.current_role', true) in ('ADMIN', 'TUTOR'));

drop policy if exists learning_goals_student_own_select on learning_goals;
create policy learning_goals_student_own_select
on learning_goals
for select
using (
  visible_to_student = true
  and student_id::text = current_setting('app.current_student_id', true)
);

drop policy if exists learning_goals_staff_access on learning_goals;
create policy learning_goals_staff_access
on learning_goals
for all
using (current_setting('app.current_role', true) in ('ADMIN', 'TUTOR'))
with check (current_setting('app.current_role', true) in ('ADMIN', 'TUTOR'));

drop policy if exists student_exam_events_student_own_select on student_exam_events;
create policy student_exam_events_student_own_select
on student_exam_events
for select
using (student_id::text = current_setting('app.current_student_id', true));

drop policy if exists student_exam_events_staff_access on student_exam_events;
create policy student_exam_events_staff_access
on student_exam_events
for all
using (current_setting('app.current_role', true) in ('ADMIN', 'TUTOR'))
with check (current_setting('app.current_role', true) in ('ADMIN', 'TUTOR'));

drop policy if exists sessions_student_own_select on sessions;
create policy sessions_student_own_select
on sessions
for select
using (student_id::text = current_setting('app.current_student_id', true));

drop policy if exists sessions_staff_access on sessions;
create policy sessions_staff_access
on sessions
for all
using (current_setting('app.current_role', true) in ('ADMIN', 'TUTOR'))
with check (current_setting('app.current_role', true) in ('ADMIN', 'TUTOR'));

drop policy if exists study_streaks_student_own_select on study_streaks;
create policy study_streaks_student_own_select
on study_streaks
for select
using (user_id::text = current_setting('app.current_user_id', true));

drop policy if exists study_streaks_staff_access on study_streaks;
create policy study_streaks_staff_access
on study_streaks
for all
using (current_setting('app.current_role', true) in ('ADMIN', 'TUTOR'))
with check (current_setting('app.current_role', true) in ('ADMIN', 'TUTOR'));

drop policy if exists study_activity_events_student_own_select on study_activity_events;
create policy study_activity_events_student_own_select
on study_activity_events
for select
using (user_id::text = current_setting('app.current_user_id', true));

drop policy if exists study_activity_events_staff_access on study_activity_events;
create policy study_activity_events_staff_access
on study_activity_events
for all
using (current_setting('app.current_role', true) in ('ADMIN', 'TUTOR'))
with check (current_setting('app.current_role', true) in ('ADMIN', 'TUTOR'));

drop policy if exists weekly_reports_student_own_select on weekly_reports;
create policy weekly_reports_student_own_select
on weekly_reports
for select
using (user_id::text = current_setting('app.current_user_id', true));

drop policy if exists weekly_reports_staff_access on weekly_reports;
create policy weekly_reports_staff_access
on weekly_reports
for all
using (current_setting('app.current_role', true) in ('ADMIN', 'TUTOR'))
with check (current_setting('app.current_role', true) in ('ADMIN', 'TUTOR'));

drop policy if exists student_score_snapshots_student_own_select on student_score_snapshots;
create policy student_score_snapshots_student_own_select
on student_score_snapshots
for select
using (user_id::text = current_setting('app.current_user_id', true));

drop policy if exists student_score_snapshots_staff_access on student_score_snapshots;
create policy student_score_snapshots_staff_access
on student_score_snapshots
for all
using (current_setting('app.current_role', true) in ('ADMIN', 'TUTOR'))
with check (current_setting('app.current_role', true) in ('ADMIN', 'TUTOR'));

drop policy if exists student_notifications_student_own_select on student_notifications;
create policy student_notifications_student_own_select
on student_notifications
for select
using (student_id::text = current_setting('app.current_student_id', true));

drop policy if exists student_notifications_staff_access on student_notifications;
create policy student_notifications_staff_access
on student_notifications
for all
using (current_setting('app.current_role', true) in ('ADMIN', 'TUTOR'))
with check (current_setting('app.current_role', true) in ('ADMIN', 'TUTOR'));
