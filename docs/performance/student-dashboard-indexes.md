# Student Dashboard Query Indexes

This documents the dashboard query indexes added or intentionally reused for `BE-PERF-01`.

## Index Map

| Ticket index | Actual table/index | Status |
| --- | --- | --- |
| `idx_assignments_student_due` on `student_assignments(student_id, due_date)` | `learning_assignments_student_idx` on `learning_assignments(student_id, due_date, created_at desc)` | Reused; no duplicate added. |
| `idx_submissions_student_assignment` on `assignment_submissions(student_id, assignment_id)` | `assignment_submissions_student_assignment_idx` | Added. |
| `idx_results_student_marked` on `student_results(student_id, marked_at desc)` | `baseline_assessments_student_idx` on `baseline_assessments(student_id, completed_at desc)` | Reused; `completed_at` is the marked/result timestamp. |
| `idx_mastery_student_topic` on `student_topic_mastery(student_id, subject, topic)` | Derived from `sessions`, `learning_goals`, and `baseline_assessments.topic_breakdown_json` | No physical table exists yet; add when `student_topic_mastery` is introduced. |
| `idx_quiz_attempts_student_created` on `quiz_attempts(student_id, created_at desc)` | `recommendedQuiz` is currently derived, no `quiz_attempts` table exists yet | Add when persisted quiz attempts are introduced. |

Additional dashboard indexes:

- `sessions_student_date_start_idx` for attendance/recent-session cards.
- `study_streaks_user_updated_idx` for streak lookup.
- `student_notifications_student_unread_idx` for notification list and unread count.

## Supabase Query Plan Checks

Run these in Supabase SQL editor after migration deploy. They should show index scans or bitmap index scans, not full table scans, for normal dashboard cardinality.

```sql
explain analyze
select id, title, subject, due_date, status
from learning_assignments
where student_id = '00000000-0000-0000-0000-000000000000'
order by due_date asc nulls last, created_at desc
limit 24;

explain analyze
select id, assignment_id, status, submitted_at
from assignment_submissions
where student_id = '00000000-0000-0000-0000-000000000000'
  and assignment_id = '00000000-0000-0000-0000-000000000000';

explain analyze
select id, subject, percentage, completed_at
from baseline_assessments
where student_id = '00000000-0000-0000-0000-000000000000'
order by completed_at desc
limit 24;

explain analyze
select id, date, start_time, attendance_status
from sessions
where student_id = '00000000-0000-0000-0000-000000000000'
order by date desc, start_time desc
limit 10;

explain analyze
select id, title, read_at, created_at
from student_notifications
where student_id = '00000000-0000-0000-0000-000000000000'
order by created_at desc
limit 8;
```

Slow SQL is logged by the API pool as `db.query.slow`. Tune with `SLOW_QUERY_MS`; default is `250`.
