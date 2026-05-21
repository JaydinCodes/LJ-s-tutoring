alter table learning_assignments
  drop constraint if exists learning_assignments_status_check;

alter table learning_assignments
  add column if not exists description text,
  add column if not exists attachment_key text,
  add column if not exists attachment_url text,
  add column if not exists attachment_original_filename text,
  add column if not exists attachment_mime_type text,
  add column if not exists attachment_size_bytes bigint,
  add column if not exists published_at timestamptz,
  add column if not exists created_by_admin_id uuid references users(id);

update learning_assignments
set status = 'published',
    published_at = coalesce(published_at, created_at)
where status = 'assigned';

alter table learning_assignments
  alter column status set default 'published';

alter table learning_assignments
  add constraint learning_assignments_status_check
  check (status in ('draft','published','submitted','reviewed','cancelled'));

create index if not exists learning_assignments_status_due_idx
  on learning_assignments(status, due_date, created_at desc);

create table if not exists assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references learning_assignments(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  file_key text not null,
  file_url text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  status text not null default 'submitted',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignment_submissions_status_check check (status in ('submitted','late','reviewed')),
  constraint assignment_submissions_file_type_check check (mime_type in ('application/pdf','image/jpeg','image/png')),
  constraint assignment_submissions_size_check check (size_bytes > 0 and size_bytes <= 10485760)
);

create index if not exists assignment_submissions_assignment_idx
  on assignment_submissions(assignment_id, submitted_at desc);

create index if not exists assignment_submissions_student_idx
  on assignment_submissions(student_id, submitted_at desc);

create table if not exists odie_conversations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  subject text,
  assignment_id uuid references learning_assignments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists odie_conversations_student_idx
  on odie_conversations(student_id, updated_at desc);

create table if not exists odie_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references odie_conversations(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists odie_messages_conversation_idx
  on odie_messages(conversation_id, created_at asc);
