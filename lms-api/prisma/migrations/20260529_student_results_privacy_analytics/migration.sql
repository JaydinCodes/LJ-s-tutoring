alter table baseline_assessments enable row level security;

drop policy if exists baseline_assessments_student_own_select on baseline_assessments;
create policy baseline_assessments_student_own_select
on baseline_assessments
for select
using (
  student_id::text = current_setting('app.current_student_id', true)
);

drop policy if exists baseline_assessments_staff_select on baseline_assessments;
create policy baseline_assessments_staff_select
on baseline_assessments
for select
using (
  current_setting('app.current_role', true) in ('ADMIN', 'TUTOR')
);

create or replace view student_results_class_analytics_anonymous as
select
  coalesce(b.grade, s.grade) as grade,
  b.subject,
  round(avg(b.percentage)::numeric, 2) as class_average,
  max(b.percentage) as highest_score,
  min(b.percentage) as lowest_score,
  round((count(*) filter (where b.percentage >= 50)::numeric / nullif(count(*), 0)) * 100, 2) as pass_rate,
  count(distinct b.student_id)::int as number_of_learners,
  count(*)::int as assessment_count
from baseline_assessments b
join students s on s.id = b.student_id
group by coalesce(b.grade, s.grade), b.subject
having count(distinct b.student_id) >= 3;

comment on view student_results_class_analytics_anonymous is
  'Anonymous class-level results aggregates only; no student identifiers, names, or rankings are exposed.';
