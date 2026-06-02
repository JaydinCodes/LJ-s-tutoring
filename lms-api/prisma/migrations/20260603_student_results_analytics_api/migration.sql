create index if not exists baseline_assessments_student_completed_subject_idx
  on baseline_assessments(student_id, completed_at desc, subject);

create index if not exists baseline_assessments_subject_grade_student_completed_idx
  on baseline_assessments(subject, grade, student_id, completed_at desc);
