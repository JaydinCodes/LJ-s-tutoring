alter table learning_assignments
  drop constraint if exists learning_assignments_status_check;

update learning_assignments
set status = 'archived'
where status = 'cancelled';

alter table learning_assignments
  add constraint learning_assignments_status_check
  check (status in ('draft','published','submitted','reviewed','closed','archived','marked'));

alter table assignment_submissions
  add column if not exists version_number integer,
  add column if not exists is_latest boolean,
  add column if not exists marked_at timestamptz;

with numbered as (
  select id,
         row_number() over (
           partition by assignment_id, student_id
           order by submitted_at asc, id asc
         )::integer as version_number,
         row_number() over (
           partition by assignment_id, student_id
           order by submitted_at desc, id desc
         ) = 1 as is_latest
  from assignment_submissions
)
update assignment_submissions s
set version_number = numbered.version_number,
    is_latest = numbered.is_latest
from numbered
where numbered.id = s.id;

alter table assignment_submissions
  alter column version_number set default 1,
  alter column version_number set not null,
  alter column is_latest set default true,
  alter column is_latest set not null;

create unique index if not exists assignment_submissions_assignment_student_version_uidx
  on assignment_submissions(assignment_id, student_id, version_number);

create unique index if not exists assignment_submissions_latest_assignment_student_uidx
  on assignment_submissions(assignment_id, student_id)
  where is_latest;

create index if not exists assignment_submissions_assignment_student_latest_idx
  on assignment_submissions(assignment_id, student_id, is_latest, submitted_at desc);
