create table if not exists student_exam_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  subject text not null,
  title text not null,
  exam_date date not null,
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_exam_events_student_date_idx
  on student_exam_events(student_id, exam_date);
