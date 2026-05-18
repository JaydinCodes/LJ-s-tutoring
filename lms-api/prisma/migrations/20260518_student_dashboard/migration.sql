alter table students
  add column if not exists school text,
  add column if not exists subjects_json jsonb not null default '[]'::jsonb,
  add column if not exists guardian_relationship text,
  add column if not exists guardian_email text,
  add column if not exists guardian_address text,
  add column if not exists partner_affiliation text;

create table if not exists baseline_assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  subject text not null,
  grade text,
  score numeric(8,2) not null,
  total numeric(8,2) not null,
  percentage numeric(5,2) not null,
  level_band text,
  cognitive_breakdown_json jsonb not null default '{}'::jsonb,
  topic_breakdown_json jsonb not null default '{}'::jsonb,
  recommended_next_steps_json jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null,
  created_by_user_id uuid references users(id),
  source_type text not null default 'manual',
  created_at timestamptz not null default now(),
  constraint baseline_assessments_score_check check (score >= 0 and total > 0 and score <= total),
  constraint baseline_assessments_percentage_check check (percentage >= 0 and percentage <= 100)
);

create index if not exists baseline_assessments_student_idx on baseline_assessments(student_id, completed_at desc);
create index if not exists baseline_assessments_subject_idx on baseline_assessments(subject, grade, completed_at desc);

create table if not exists learning_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'academic',
  subject text,
  target_value numeric(10,2),
  current_value numeric(10,2),
  due_date date,
  status text not null default 'active',
  created_by_user_id uuid references users(id),
  visible_to_student boolean not null default true,
  visible_to_tutor boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_goals_category_check check (category in ('academic','attendance','assignment','career','intervention')),
  constraint learning_goals_status_check check (status in ('active','completed','paused','cancelled'))
);

create index if not exists learning_goals_student_idx on learning_goals(student_id, status, due_date);
create index if not exists learning_goals_category_idx on learning_goals(category, status);
