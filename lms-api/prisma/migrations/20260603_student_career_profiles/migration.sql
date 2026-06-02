create table if not exists student_career_profiles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  interests_json jsonb not null default '[]'::jsonb,
  preferred_subjects_json jsonb not null default '[]'::jsonb,
  target_careers_json jsonb not null default '[]'::jsonb,
  aps_target integer,
  saved_careers_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_career_profiles_student_unique unique(student_id),
  constraint student_career_profiles_aps_check check (aps_target is null or (aps_target >= 0 and aps_target <= 60))
);

create index if not exists student_career_profiles_student_updated_idx
  on student_career_profiles(student_id, updated_at desc);

alter table student_career_profiles enable row level security;

drop policy if exists student_career_profiles_student_own_select on student_career_profiles;
create policy student_career_profiles_student_own_select
on student_career_profiles
for select
using (
  student_id::text = current_setting('app.current_student_id', true)
);

drop policy if exists student_career_profiles_student_own_write on student_career_profiles;
create policy student_career_profiles_student_own_write
on student_career_profiles
for all
using (
  student_id::text = current_setting('app.current_student_id', true)
)
with check (
  student_id::text = current_setting('app.current_student_id', true)
);
