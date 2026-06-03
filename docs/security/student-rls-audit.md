# Student Data RLS Audit

This audit covers `BE-SEC-01` for dashboard-facing student data.

## Policy Summary

| Data | Student access | Write access |
| --- | --- | --- |
| `learning_assignments` | Own rows by `app.current_student_id` | Staff only. |
| `assignment_submissions` | Own rows by `app.current_student_id` | Student insert only for own rows; tutor/admin manage review fields. |
| `baseline_assessments` | Own rows by `app.current_student_id` | Staff only; students cannot edit marks or feedback. |
| `learning_goals` | Own visible rows only | Staff only. |
| `student_exam_events` | Own rows only | Staff only. |
| `sessions` | Own rows only | Staff only. |
| `study_streaks`, `study_activity_events`, `weekly_reports`, `student_score_snapshots` | Own user rows by `app.current_user_id` | Staff only. |
| `student_notifications` | Own rows only | Staff only for writes. |
| `student_career_profiles` | Own rows only | Own profile write, bounded by schema validation. |

Anonymous class stats are exposed through `student_results_class_analytics_anonymous`, which requires `count(distinct student_id) >= 3`.

## Guardrails

- Students cannot update assignment review fields because no student update policy exists on `assignment_submissions`.
- Students cannot edit marks or feedback because `baseline_assessments` has no student write policy.
- Tutor/admin access remains role-based through `app.current_role in ('ADMIN', 'TUTOR')`.
- Storage upload policies remain scoped to the student assignment folder in `docs/supabase/schema.sql`.

## API Context Required

When using RLS-enforced direct SQL clients, set these per transaction:

```sql
select set_config('app.current_user_id', '<user uuid>', true);
select set_config('app.current_student_id', '<student uuid>', true);
select set_config('app.current_role', 'STUDENT', true);
```

For staff:

```sql
select set_config('app.current_user_id', '<user uuid>', true);
select set_config('app.current_role', 'TUTOR', true);
```
