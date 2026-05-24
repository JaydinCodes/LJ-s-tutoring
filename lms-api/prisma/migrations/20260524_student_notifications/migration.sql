create table if not exists student_notifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  link text,
  entity_type text,
  entity_id uuid,
  metadata_json jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_notifications_student_created_idx
  on student_notifications (student_id, created_at desc);

create index if not exists student_notifications_student_read_idx
  on student_notifications (student_id, is_read, created_at desc);
