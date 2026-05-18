alter table tutor_profiles
  add column if not exists approval_status text not null default 'approved',
  add column if not exists approval_reviewed_by uuid references users(id),
  add column if not exists approval_reviewed_at timestamptz,
  add column if not exists approval_note text,
  add column if not exists teaching_preferences_json jsonb not null default '[]'::jsonb;

alter table sessions
  add column if not exists attendance_status text,
  add column if not exists topics_covered text,
  add column if not exists learner_struggles text,
  add column if not exists homework_assigned text,
  add column if not exists tutor_private_notes text,
  add column if not exists student_summary text,
  add column if not exists report_review_note text,
  add column if not exists payout_override boolean not null default false;

create table if not exists tutor_applications (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null unique references tutor_profiles(id) on delete cascade,
  status text not null default 'draft',
  personal_details_json jsonb not null default '{}'::jsonb,
  subjects_json jsonb not null default '[]'::jsonb,
  grades_json jsonb not null default '[]'::jsonb,
  teaching_preferences_json jsonb not null default '[]'::jsonb,
  experience text,
  availability_notes text,
  submitted_at timestamptz,
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tutor_applications_status_check check (status in ('draft','submitted','under_review','approved','rejected','changes_requested'))
);

create table if not exists tutor_documents (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutor_profiles(id) on delete cascade,
  document_type text not null,
  storage_key text not null,
  original_filename text not null,
  mime_type text not null,
  file_size_bytes integer not null,
  uploaded_at timestamptz not null default now(),
  verification_status text not null default 'pending',
  verified_by uuid references users(id),
  verified_at timestamptz,
  notes text,
  constraint tutor_documents_type_check check (document_type in ('identity','cv','qualification','additional')),
  constraint tutor_documents_status_check check (verification_status in ('pending','accepted','rejected'))
);

create index if not exists tutor_documents_tutor_idx on tutor_documents(tutor_id, uploaded_at desc);

create table if not exists tutor_availability_slots (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutor_profiles(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  mode text not null default 'online',
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists tutor_availability_slots_tutor_idx on tutor_availability_slots(tutor_id, day_of_week, start_time);

create table if not exists learning_assignments (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutor_profiles(id),
  student_id uuid not null references students(id),
  teaching_assignment_id uuid references assignments(id),
  subject text not null,
  title text not null,
  instructions text,
  due_date date,
  status text not null default 'assigned',
  created_by_user_id uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_assignments_status_check check (status in ('assigned','submitted','reviewed','cancelled'))
);

create index if not exists learning_assignments_tutor_idx on learning_assignments(tutor_id, created_at desc);
create index if not exists learning_assignments_student_idx on learning_assignments(student_id, due_date, created_at desc);

create table if not exists volunteer_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date,
  start_time time,
  end_time time,
  location text,
  mode text not null default 'in-person',
  status text not null default 'planned',
  created_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint volunteer_events_status_check check (status in ('planned','cancelled','completed'))
);

create table if not exists volunteer_logs (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutor_profiles(id) on delete cascade,
  event_id uuid references volunteer_events(id) on delete set null,
  status text not null default 'signed_up',
  hours numeric(8,2),
  volunteered_on date,
  notes text,
  evidence_document_id uuid references tutor_documents(id) on delete set null,
  submitted_at timestamptz,
  verified_by uuid references users(id),
  verified_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint volunteer_logs_status_check check (status in ('signed_up','submitted','verified','rejected')),
  constraint volunteer_logs_hours_check check (hours is null or hours >= 0)
);

create index if not exists volunteer_logs_tutor_idx on volunteer_logs(tutor_id, created_at desc);
create index if not exists volunteer_logs_event_idx on volunteer_logs(event_id);
