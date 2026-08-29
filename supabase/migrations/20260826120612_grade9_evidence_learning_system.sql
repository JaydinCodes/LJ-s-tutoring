-- Project Odysseus Grade 9 Mathematics evidence-learning pilot.
--
-- This is intentionally separate from assignments, assignment_submissions and
-- competency_evidence. Those remain the formal assessment/released-rubric
-- record. The tables below record formative, item-level learning evidence and
-- derive auditable mastery through versioned deterministic rules.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'curriculum_source_tier') then
    create type public.curriculum_source_tier as enum ('DBE', 'approved_external', 'Odysseus_authored', 'AI_draft');
  end if;
  if not exists (select 1 from pg_type where typname = 'math_representation') then
    create type public.math_representation as enum ('symbolic', 'graphical', 'tabular', 'verbal', 'diagrammatic');
  end if;
  if not exists (select 1 from pg_type where typname = 'caps_cognitive_level') then
    create type public.caps_cognitive_level as enum ('knowledge', 'routine', 'complex', 'problem_solving');
  end if;
  if not exists (select 1 from pg_type where typname = 'question_activity_type') then
    create type public.question_activity_type as enum (
      'retrieval', 'diagnostic', 'worked_example', 'faded_example', 'guided_practice',
      'independent_practice', 'error_analysis', 'representation_translation',
      'interleaved_review', 'investigation', 'caps_assessment', 'delayed_retention'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'question_review_status') then
    create type public.question_review_status as enum ('draft', 'in_review', 'approved', 'rejected', 'retired');
  end if;
  if not exists (select 1 from pg_type where typname = 'calculator_policy') then
    create type public.calculator_policy as enum ('not_applicable', 'not_allowed', 'allowed', 'required');
  end if;
  if not exists (select 1 from pg_type where typname = 'evidence_context') then
    create type public.evidence_context as enum ('formative', 'formal_caps_assessment');
  end if;
  if not exists (select 1 from pg_type where typname = 'attempt_status') then
    create type public.attempt_status as enum ('submitted', 'evaluated', 'voided');
  end if;
  if not exists (select 1 from pg_type where typname = 'attempt_independence') then
    create type public.attempt_independence as enum ('independent', 'assisted');
  end if;
  if not exists (select 1 from pg_type where typname = 'mastery_state') then
    create type public.mastery_state as enum ('unassessed', 'emerging', 'developing', 'secure', 'retained');
  end if;
  if not exists (select 1 from pg_type where typname = 'misconception_state') then
    create type public.misconception_state as enum ('suspected', 'confirmed', 'resolved');
  end if;
  if not exists (select 1 from pg_type where typname = 'recommendation_status') then
    create type public.recommendation_status as enum ('open', 'accepted', 'modified', 'rejected', 'completed', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'recommendation_decision') then
    create type public.recommendation_decision as enum ('accepted', 'modified', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'intervention_type') then
    create type public.intervention_type as enum (
      'worked_example', 'faded_example', 'contrasting_examples', 'guided_practice',
      'error_analysis', 'prerequisite_remediation', 'interleaved_practice',
      'retrieval_practice', 'representation_translation'
    );
  end if;
end
$$;

-- Curriculum: the existing public.subjects table is the stable subject
-- identity. Curriculum versions own areas, topics and skills, so a later
-- CAPS revision never mutates the meaning of a skill with learner evidence.
create table public.curriculum_versions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  code text not null unique check (code ~ '^[A-Z0-9-]+$'),
  grade text not null check (char_length(btrim(grade)) between 1 and 20),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  valid_from date not null,
  valid_until date,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from),
  unique (subject_id, grade, code)
);

create table public.curriculum_sources (
  id uuid primary key default gen_random_uuid(),
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete restrict,
  source_tier public.curriculum_source_tier not null,
  title text not null,
  reference_uri text,
  source_version text,
  notes text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (curriculum_version_id, title)
);

create table public.curriculum_areas (
  id uuid primary key default gen_random_uuid(),
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9._-]+$'),
  name text not null,
  description text,
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_version_id, code)
);

create table public.curriculum_topics (
  id uuid primary key default gen_random_uuid(),
  curriculum_area_id uuid not null references public.curriculum_areas(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9._-]+$'),
  name text not null,
  description text,
  term smallint check (term between 1 and 4),
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_area_id, code)
);

-- Grade 9 keeps version/topic/parent metadata in a narrowly scoped extension;
-- curriculum_skills remains the sole skill identity used by learning data.
create table public.grade9_skill_metadata (
  curriculum_skill_id uuid primary key references public.curriculum_skills(id) on delete cascade,
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete restrict,
  curriculum_topic_id uuid not null references public.curriculum_topics(id) on delete restrict,
  parent_curriculum_skill_id uuid references public.curriculum_skills(id) on delete restrict,
  term smallint check (term between 1 and 4),
  valid_from date not null,
  valid_until date,
  display_order integer not null default 0 check (display_order >= 0),
  check (valid_until is null or valid_until >= valid_from),
  check (parent_curriculum_skill_id is null or parent_curriculum_skill_id <> curriculum_skill_id),
  unique (curriculum_version_id, curriculum_skill_id)
);

create table public.skill_representations (
  skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  representation public.math_representation not null,
  primary key (skill_id, representation)
);

create table public.skill_cognitive_levels (
  skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  cognitive_level public.caps_cognitive_level not null,
  primary key (skill_id, cognitive_level)
);

create table public.misconceptions (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9._-]+$'),
  name text not null,
  description text not null,
  diagnostic_notes text,
  default_intervention_type public.intervention_type,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (skill_id, code)
);

-- Item-bank identity and immutable versions. Answer configuration stays behind
-- privileged RLS and is never returned to a student-facing client.
create table public.question_items (
  id uuid primary key default gen_random_uuid(),
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete restrict,
  item_code text not null check (item_code ~ '^[A-Z0-9._-]+$'),
  source_tier public.curriculum_source_tier not null default 'Odysseus_authored',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  retired_by uuid references public.profiles(id) on delete set null,
  unique (curriculum_version_id, item_code)
);

create table public.question_versions (
  id uuid primary key default gen_random_uuid(),
  question_item_id uuid not null references public.question_items(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  review_status public.question_review_status not null default 'draft',
  activity_type public.question_activity_type not null,
  cognitive_level public.caps_cognitive_level not null,
  representation public.math_representation not null,
  difficulty smallint check (difficulty between 1 and 5),
  calculator_policy public.calculator_policy not null default 'not_applicable',
  prompt text not null,
  answer_config jsonb not null default '{}'::jsonb,
  solution text,
  marks numeric(6,2) not null check (marks > 0),
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  material_change_note text,
  created_at timestamptz not null default now(),
  unique (question_item_id, version_number),
  check (review_status <> 'approved' or (reviewed_by is not null and reviewed_at is not null))
);

create table public.question_version_skill_links (
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  relationship_type text not null check (relationship_type in ('primary', 'supporting')),
  primary key (question_version_id, skill_id)
);

create unique index question_version_primary_skill_idx
  on public.question_version_skill_links(question_version_id)
  where relationship_type = 'primary';

create or replace function public.validate_question_version_skill_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.question_versions version
    join public.question_items item on item.id = version.question_item_id
    join public.curriculum_skills skill on skill.id = new.skill_id
    join public.curriculum_versions curriculum on curriculum.id = (
      select item.curriculum_version_id from public.question_versions version
      join public.question_items item on item.id = version.question_item_id
      where version.id = new.question_version_id
    )
    where version.id = new.question_version_id
      and skill.subject_id = curriculum.subject_id
      and skill.grade = curriculum.grade
  ) then
    raise exception 'question_skill_must_share_curriculum_version' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger trg_validate_question_version_skill_link
before insert or update on public.question_version_skill_links
for each row execute function public.validate_question_version_skill_link();

create table public.question_version_misconceptions (
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  misconception_id uuid not null references public.misconceptions(id) on delete restrict,
  primary key (question_version_id, misconception_id)
);

create or replace function public.validate_question_version_misconception_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.question_versions version
    join public.question_items item on item.id = version.question_item_id
    join public.misconceptions misconception on misconception.id = new.misconception_id
    join public.curriculum_skills skill on skill.id = misconception.skill_id
    join public.curriculum_versions curriculum on curriculum.id = (
      select item.curriculum_version_id from public.question_versions version
      join public.question_items item on item.id = version.question_item_id
      where version.id = new.question_version_id
    )
    where version.id = new.question_version_id
      and skill.subject_id = curriculum.subject_id
      and skill.grade = curriculum.grade
  ) then
    raise exception 'question_misconception_must_share_curriculum_version' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger trg_validate_question_version_misconception_link
before insert or update on public.question_version_misconceptions
for each row execute function public.validate_question_version_misconception_link();

create table public.question_hints (
  id uuid primary key default gen_random_uuid(),
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  hint_level smallint not null check (hint_level between 1 and 5),
  prompt text not null,
  created_at timestamptz not null default now(),
  unique (question_version_id, hint_level)
);

create or replace function public.prevent_question_version_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.review_status = 'approved' and (
    new.review_status <> 'retired'
    or (to_jsonb(new) - array['review_status', 'reviewed_by', 'reviewed_at', 'review_notes'])
       is distinct from
       (to_jsonb(old) - array['review_status', 'reviewed_by', 'reviewed_at', 'review_notes'])
  ) then
    raise exception 'approved_question_versions_are_immutable_create_a_new_version' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_question_version_mutation
before update on public.question_versions
for each row execute function public.prevent_question_version_mutation();

-- Learning attempts deliberately capture raw response and context separately
-- from evaluator results. Time is retained for analytics only; no rule uses it.
create table public.learning_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  session_id uuid references public.sessions(id) on delete set null,
  source_submission_id uuid references public.assignment_submissions(id) on delete set null,
  evidence_context public.evidence_context not null default 'formative',
  attempt_number integer not null check (attempt_number > 0),
  response jsonb not null default '{}'::jsonb,
  confidence smallint check (confidence between 1 and 4),
  time_spent_seconds integer check (time_spent_seconds is null or time_spent_seconds >= 0),
  status public.attempt_status not null default 'submitted',
  is_correct boolean,
  marks_awarded numeric(6,2),
  evaluated_by uuid references public.profiles(id) on delete set null,
  evaluated_at timestamptz,
  tutor_observation text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check ((status = 'evaluated') = (is_correct is not null and evaluated_at is not null)),
  check (marks_awarded is null or marks_awarded >= 0),
  unique (student_id, question_version_id, attempt_number)
);

create table public.learning_attempt_hint_events (
  id uuid primary key default gen_random_uuid(),
  learning_attempt_id uuid not null references public.learning_attempts(id) on delete cascade,
  question_hint_id uuid not null references public.question_hints(id) on delete restrict,
  opened_order integer not null check (opened_order > 0),
  opened_at timestamptz not null default now(),
  unique (learning_attempt_id, question_hint_id),
  unique (learning_attempt_id, opened_order)
);

create table public.learning_attempt_skill_evidence (
  id uuid primary key default gen_random_uuid(),
  learning_attempt_id uuid not null references public.learning_attempts(id) on delete restrict,
  skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  independence public.attempt_independence not null,
  is_target_skill boolean not null,
  cognitive_level public.caps_cognitive_level not null,
  correct boolean not null,
  marks_awarded numeric(6,2),
  marks_possible numeric(6,2),
  recorded_at timestamptz not null default now(),
  unique (learning_attempt_id, skill_id),
  check (marks_awarded is null or marks_awarded >= 0),
  check (marks_possible is null or marks_possible > 0),
  check (marks_awarded is null or marks_possible is null or marks_awarded <= marks_possible)
);

create table public.learner_misconceptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  misconception_id uuid not null references public.misconceptions(id) on delete restrict,
  state public.misconception_state not null,
  determined_at timestamptz not null default now(),
  determined_by uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  unique (student_id, misconception_id, determined_at)
);

create table public.learner_misconception_evidence (
  id uuid primary key default gen_random_uuid(),
  learner_misconception_id uuid not null references public.learner_misconceptions(id) on delete cascade,
  learning_attempt_id uuid not null references public.learning_attempts(id) on delete restrict,
  created_at timestamptz not null default now()
);
create unique index learner_misconception_evidence_attempt_idx
  on public.learner_misconception_evidence(learner_misconception_id, learning_attempt_id)
  where learning_attempt_id is not null;

create table public.mastery_rule_sets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9._-]+$'),
  version integer not null check (version > 0),
  name text not null,
  configuration jsonb not null,
  is_active boolean not null default false,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from),
  unique (code, version)
);

create unique index mastery_rule_sets_one_active_per_code_idx on public.mastery_rule_sets(code) where is_active;

create table public.skill_mastery_evaluations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  rule_set_id uuid not null references public.mastery_rule_sets(id) on delete restrict,
  state public.mastery_state not null,
  determined_at timestamptz not null default now(),
  reason text not null,
  reason_codes text[] not null default '{}',
  determined_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.skill_mastery_evaluation_evidence (
  id uuid primary key default gen_random_uuid(),
  mastery_evaluation_id uuid not null references public.skill_mastery_evaluations(id) on delete restrict,
  learning_attempt_skill_evidence_id uuid references public.learning_attempt_skill_evidence(id) on delete restrict,
  learner_misconception_id uuid references public.learner_misconceptions(id) on delete restrict,
  check (learning_attempt_skill_evidence_id is not null or learner_misconception_id is not null)
);
create unique index mastery_evaluation_attempt_evidence_idx
  on public.skill_mastery_evaluation_evidence(mastery_evaluation_id, learning_attempt_skill_evidence_id)
  where learning_attempt_skill_evidence_id is not null;
create unique index mastery_evaluation_misconception_evidence_idx
  on public.skill_mastery_evaluation_evidence(mastery_evaluation_id, learner_misconception_id)
  where learner_misconception_id is not null;

create table public.recommendation_rule_sets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9._-]+$'),
  version integer not null check (version > 0),
  name text not null,
  configuration jsonb not null,
  is_active boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (code, version)
);

create unique index recommendation_rule_sets_one_active_per_code_idx on public.recommendation_rule_sets(code) where is_active;

create table public.grade9_learning_recommendations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  mastery_evaluation_id uuid references public.skill_mastery_evaluations(id) on delete restrict,
  rule_set_id uuid not null references public.recommendation_rule_sets(id) on delete restrict,
  recommendation_type public.intervention_type not null,
  recommended_sequence text[] not null default '{}',
  status public.recommendation_status not null default 'open',
  reason text not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.learning_recommendation_reasons (
  recommendation_id uuid not null references public.grade9_learning_recommendations(id) on delete restrict,
  reason_code text not null check (reason_code ~ '^[A-Z0-9._-]+$'),
  primary key (recommendation_id, reason_code)
);

create table public.tutor_recommendation_decisions (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.learning_recommendations(id) on delete restrict,
  tutor_id uuid not null references public.tutors(id) on delete restrict,
  decision public.recommendation_decision not null,
  reason text not null,
  modified_sequence text[],
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.intervention_catalogue (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9._-]+$'),
  intervention_type public.intervention_type not null,
  name text not null,
  description text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.tutor_interventions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  tutor_id uuid not null references public.tutors(id) on delete restrict,
  skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  intervention_catalogue_id uuid not null references public.intervention_catalogue(id) on delete restrict,
  session_id uuid references public.sessions(id) on delete set null,
  recommendation_id uuid references public.grade9_learning_recommendations(id) on delete set null,
  planned_at timestamptz,
  delivered_at timestamptz,
  learner_response text,
  structured_observation jsonb not null default '{}'::jsonb,
  tutor_notes text,
  follow_up_action text,
  created_at timestamptz not null default now()
);

create table public.intervention_outcomes (
  id uuid primary key default gen_random_uuid(),
  tutor_intervention_id uuid not null references public.tutor_interventions(id) on delete restrict,
  outcome_stage text not null check (outcome_stage in ('immediate', 'delayed')),
  learning_attempt_skill_evidence_id uuid references public.learning_attempt_skill_evidence(id) on delete restrict,
  mastery_evaluation_id uuid references public.skill_mastery_evaluations(id) on delete restrict,
  outcome_note text,
  recorded_at timestamptz not null default now(),
  check (learning_attempt_skill_evidence_id is not null or mastery_evaluation_id is not null),
  unique (tutor_intervention_id, outcome_stage, learning_attempt_skill_evidence_id)
);

-- Query indexes: mastery evaluation, a learner's evidence timeline, tutor work,
-- and aggregate intervention effectiveness are the pilot's main read paths.
create index curriculum_topics_area_order_idx on public.curriculum_topics(curriculum_area_id, display_order);
create index grade9_skill_metadata_version_topic_idx on public.grade9_skill_metadata(curriculum_version_id, curriculum_topic_id, display_order);
create index skill_prerequisites_prerequisite_idx on public.skill_prerequisites(prerequisite_skill_id);
create index question_versions_item_status_idx on public.question_versions(question_item_id, review_status, version_number desc);
create index question_version_skill_links_skill_idx on public.question_version_skill_links(skill_id);
create index learning_attempts_student_time_idx on public.learning_attempts(student_id, occurred_at desc);
create index learning_attempts_question_idx on public.learning_attempts(question_version_id, occurred_at desc);
create index learning_attempt_skill_evidence_skill_idx on public.learning_attempt_skill_evidence(skill_id, recorded_at desc);
create index learner_misconceptions_student_idx on public.learner_misconceptions(student_id, determined_at desc);
create index skill_mastery_evaluations_student_skill_idx on public.skill_mastery_evaluations(student_id, skill_id, determined_at desc);
create index grade9_learning_recommendations_student_status_idx on public.grade9_learning_recommendations(student_id, status, created_at desc);
create index tutor_interventions_student_skill_idx on public.tutor_interventions(student_id, skill_id, delivered_at desc);

create or replace function public.audit_learning_system_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_entity_id text;
begin
  v_entity_id := coalesce(new.id::text, old.id::text);
  perform public.log_audit_event(
    'learning_system.' || lower(TG_TABLE_NAME) || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    v_entity_id,
    jsonb_build_object('operation', TG_OP)
  );
  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger trg_audit_curriculum_versions after insert or update or delete on public.curriculum_versions for each row execute function public.audit_learning_system_change();
create trigger trg_audit_curriculum_areas after insert or update or delete on public.curriculum_areas for each row execute function public.audit_learning_system_change();
create trigger trg_audit_curriculum_topics after insert or update or delete on public.curriculum_topics for each row execute function public.audit_learning_system_change();
create trigger trg_audit_curriculum_skills after insert or update or delete on public.curriculum_skills for each row execute function public.audit_learning_system_change();
create trigger trg_audit_question_versions after insert or update or delete on public.question_versions for each row execute function public.audit_learning_system_change();
create trigger trg_audit_mastery_evaluations after insert or update or delete on public.skill_mastery_evaluations for each row execute function public.audit_learning_system_change();
create trigger trg_audit_grade9_recommendations after insert or update or delete on public.grade9_learning_recommendations for each row execute function public.audit_learning_system_change();
create trigger trg_audit_tutor_decisions after insert or update or delete on public.tutor_recommendation_decisions for each row execute function public.audit_learning_system_change();
create trigger trg_audit_tutor_interventions after insert or update or delete on public.tutor_interventions for each row execute function public.audit_learning_system_change();
create trigger trg_audit_intervention_outcomes after insert or update or delete on public.intervention_outcomes for each row execute function public.audit_learning_system_change();

-- RLS helpers. These rely on the project's existing allocation table and do
-- not touch safeguarding or risk tables.
create or replace function public.can_access_learning_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or p_student_id = public.current_student_id()
    or exists (
      select 1 from public.tutor_student_allocations allocation
      where allocation.student_id = p_student_id
        and allocation.tutor_id = public.current_tutor_id()
        and allocation.status = 'active'
    )
$$;

revoke all on function public.can_access_learning_student(uuid) from public;
grant execute on function public.can_access_learning_student(uuid) to authenticated;

alter table public.curriculum_versions enable row level security;
alter table public.curriculum_sources enable row level security;
alter table public.curriculum_areas enable row level security;
alter table public.curriculum_topics enable row level security;
alter table public.curriculum_skills enable row level security;
alter table public.skill_representations enable row level security;
alter table public.skill_cognitive_levels enable row level security;
alter table public.skill_prerequisites enable row level security;
alter table public.misconceptions enable row level security;
alter table public.question_items enable row level security;
alter table public.question_versions enable row level security;
alter table public.question_version_skill_links enable row level security;
alter table public.question_version_misconceptions enable row level security;
alter table public.question_hints enable row level security;
alter table public.learning_attempts enable row level security;
alter table public.learning_attempt_hint_events enable row level security;
alter table public.learning_attempt_skill_evidence enable row level security;
alter table public.learner_misconceptions enable row level security;
alter table public.learner_misconception_evidence enable row level security;
alter table public.mastery_rule_sets enable row level security;
alter table public.skill_mastery_evaluations enable row level security;
alter table public.skill_mastery_evaluation_evidence enable row level security;
alter table public.recommendation_rule_sets enable row level security;
alter table public.grade9_learning_recommendations enable row level security;
alter table public.learning_recommendation_reasons enable row level security;
alter table public.tutor_recommendation_decisions enable row level security;
alter table public.intervention_catalogue enable row level security;
alter table public.tutor_interventions enable row level security;
alter table public.intervention_outcomes enable row level security;

-- Approved curriculum is readable to authenticated users. Administrative
-- changes remain admin-only. Draft question content is tutor/admin-only, and
-- students obtain sanitised prompts through an RPC below.
create policy "curriculum_read_authenticated" on public.curriculum_versions for select to authenticated using (is_active or public.is_platform_admin());
create policy "curriculum_versions_admin_manage" on public.curriculum_versions for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "curriculum_sources_read_authenticated" on public.curriculum_sources for select to authenticated using (true);
create policy "curriculum_sources_admin_manage" on public.curriculum_sources for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "curriculum_areas_read_authenticated" on public.curriculum_areas for select to authenticated using (is_active or public.is_platform_admin());
create policy "curriculum_areas_admin_manage" on public.curriculum_areas for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "curriculum_topics_read_authenticated" on public.curriculum_topics for select to authenticated using (is_active or public.is_platform_admin());
create policy "curriculum_topics_admin_manage" on public.curriculum_topics for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "grade9_curriculum_skills_read_authenticated" on public.curriculum_skills for select to authenticated using (is_active or public.is_platform_admin());
create policy "grade9_curriculum_skills_admin_manage" on public.curriculum_skills for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "skill_representations_read_authenticated" on public.skill_representations for select to authenticated using (true);
create policy "skill_representations_admin_manage" on public.skill_representations for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "skill_cognitive_levels_read_authenticated" on public.skill_cognitive_levels for select to authenticated using (true);
create policy "skill_cognitive_levels_admin_manage" on public.skill_cognitive_levels for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "skill_prerequisites_read_authenticated" on public.skill_prerequisites for select to authenticated using (true);
create policy "skill_prerequisites_admin_manage" on public.skill_prerequisites for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "misconceptions_tutor_admin_read" on public.misconceptions for select to authenticated using (public.current_profile_role() in ('tutor', 'admin'));
create policy "misconceptions_admin_manage" on public.misconceptions for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "question_items_tutor_admin_read" on public.question_items for select to authenticated using (public.current_profile_role() in ('tutor', 'admin'));
create policy "question_items_tutor_draft" on public.question_items for insert to authenticated with check (public.current_profile_role() = 'tutor' and created_by = public.current_profile_id());
create policy "question_items_admin_manage" on public.question_items for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "question_versions_tutor_admin_read" on public.question_versions for select to authenticated using (public.current_profile_role() in ('tutor', 'admin'));
create policy "question_versions_tutor_draft" on public.question_versions for insert to authenticated with check (public.current_profile_role() = 'tutor' and created_by = public.current_profile_id() and review_status = 'draft');
create policy "question_versions_admin_manage" on public.question_versions for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "question_links_tutor_admin_read" on public.question_version_skill_links for select to authenticated using (public.current_profile_role() in ('tutor', 'admin'));
create policy "question_links_tutor_draft" on public.question_version_skill_links for insert to authenticated with check (public.current_profile_role() = 'tutor');
create policy "question_links_admin_manage" on public.question_version_skill_links for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "question_misconceptions_tutor_admin_read" on public.question_version_misconceptions for select to authenticated using (public.current_profile_role() in ('tutor', 'admin'));
create policy "question_misconceptions_tutor_draft" on public.question_version_misconceptions for insert to authenticated with check (public.current_profile_role() = 'tutor');
create policy "question_misconceptions_admin_manage" on public.question_version_misconceptions for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "question_hints_tutor_admin_read" on public.question_hints for select to authenticated using (public.current_profile_role() in ('tutor', 'admin'));
create policy "question_hints_tutor_draft" on public.question_hints for insert to authenticated with check (public.current_profile_role() = 'tutor');
create policy "question_hints_admin_manage" on public.question_hints for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "learning_attempts_scoped_read" on public.learning_attempts for select to authenticated using (public.can_access_learning_student(student_id));
create policy "learning_attempt_hint_events_scoped_read" on public.learning_attempt_hint_events for select to authenticated using (exists (select 1 from public.learning_attempts a where a.id = learning_attempt_id and public.can_access_learning_student(a.student_id)));
create policy "attempt_skill_evidence_scoped_read" on public.learning_attempt_skill_evidence for select to authenticated using (exists (select 1 from public.learning_attempts a where a.id = learning_attempt_id and public.can_access_learning_student(a.student_id)));
create policy "learner_misconceptions_tutor_admin_read" on public.learner_misconceptions for select to authenticated using (public.current_profile_role() in ('tutor', 'admin') and public.can_access_learning_student(student_id));
create policy "learner_misconception_evidence_tutor_admin_read" on public.learner_misconception_evidence for select to authenticated using (exists (select 1 from public.learner_misconceptions lm where lm.id = learner_misconception_id and public.current_profile_role() in ('tutor', 'admin') and public.can_access_learning_student(lm.student_id)));
create policy "mastery_rules_read_authenticated" on public.mastery_rule_sets for select to authenticated using (true);
create policy "mastery_rules_admin_manage" on public.mastery_rule_sets for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "mastery_evaluations_scoped_read" on public.skill_mastery_evaluations for select to authenticated using (public.can_access_learning_student(student_id));
create policy "mastery_evaluation_evidence_tutor_admin_read" on public.skill_mastery_evaluation_evidence for select to authenticated using (exists (select 1 from public.skill_mastery_evaluations evaluation where evaluation.id = mastery_evaluation_id and public.current_profile_role() in ('tutor', 'admin') and public.can_access_learning_student(evaluation.student_id)));
create policy "recommendation_rules_tutor_admin_read" on public.recommendation_rule_sets for select to authenticated using (public.current_profile_role() in ('tutor', 'admin'));
create policy "recommendation_rules_admin_manage" on public.recommendation_rule_sets for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "grade9_recommendations_tutor_admin_read" on public.grade9_learning_recommendations for select to authenticated using (public.current_profile_role() in ('tutor', 'admin') and public.can_access_learning_student(student_id));
create policy "grade9_recommendation_reasons_tutor_admin_read" on public.learning_recommendation_reasons for select to authenticated using (exists (select 1 from public.grade9_learning_recommendations r where r.id = recommendation_id and public.current_profile_role() in ('tutor', 'admin') and public.can_access_learning_student(r.student_id)));
create policy "tutor_decisions_tutor_admin_read" on public.tutor_recommendation_decisions for select to authenticated using (public.current_profile_role() in ('tutor', 'admin'));
create policy "intervention_catalogue_tutor_admin_read" on public.intervention_catalogue for select to authenticated using (public.current_profile_role() in ('tutor', 'admin'));
create policy "intervention_catalogue_admin_manage" on public.intervention_catalogue for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "tutor_interventions_scoped_read" on public.tutor_interventions for select to authenticated using (public.current_profile_role() in ('tutor', 'admin') and public.can_access_learning_student(student_id));
create policy "intervention_outcomes_scoped_read" on public.intervention_outcomes for select to authenticated using (exists (select 1 from public.tutor_interventions intervention where intervention.id = tutor_intervention_id and public.current_profile_role() in ('tutor', 'admin') and public.can_access_learning_student(intervention.student_id)));

-- All learner-evidence and decision writes use audited RPCs. This means a
-- student cannot forge a correct result, alter mastery, approve content, or
-- inspect answer keys by writing tables through the Data API.
create or replace function public.get_learning_question(p_question_version_id uuid)
returns table (
  question_version_id uuid, activity_type public.question_activity_type,
  cognitive_level public.caps_cognitive_level, representation public.math_representation,
  calculator_policy public.calculator_policy, prompt text, marks numeric, hints jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_profile_role() not in ('student', 'tutor', 'admin') then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
  select qv.id, qv.activity_type, qv.cognitive_level, qv.representation, qv.calculator_policy, qv.prompt, qv.marks,
    coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'hint_level', h.hint_level, 'prompt', h.prompt) order by h.hint_level) filter (where h.id is not null), '[]'::jsonb)
  from public.question_versions qv
  left join public.question_hints h on h.question_version_id = qv.id
  where qv.id = p_question_version_id and qv.review_status = 'approved'
  group by qv.id;
end;
$$;

create or replace function public.record_learning_attempt(
  p_student_id uuid, p_question_version_id uuid, p_response jsonb,
  p_confidence smallint default null, p_time_spent_seconds integer default null,
  p_session_id uuid default null, p_source_submission_id uuid default null,
  p_evidence_context public.evidence_context default 'formative'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_attempt_id uuid; v_attempt_number integer; v_role public.user_role;
begin
  v_role := public.current_profile_role();
  if v_role not in ('student', 'tutor', 'admin') or not public.can_access_learning_student(p_student_id) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if v_role = 'student' and p_student_id <> public.current_student_id() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.question_versions where id = p_question_version_id and review_status = 'approved') then raise exception 'question_version_not_available' using errcode = '23514'; end if;
  if p_session_id is not null and not exists (select 1 from public.sessions where id = p_session_id and student_id = p_student_id) then raise exception 'session_not_for_student' using errcode = '23514'; end if;
  if p_source_submission_id is not null and not exists (select 1 from public.assignment_submissions where id = p_source_submission_id and student_id = p_student_id) then raise exception 'submission_not_for_student' using errcode = '23514'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_student_id::text || p_question_version_id::text, 0));
  select coalesce(max(attempt_number), 0) + 1 into v_attempt_number from public.learning_attempts where student_id = p_student_id and question_version_id = p_question_version_id;
  insert into public.learning_attempts (student_id, question_version_id, session_id, source_submission_id, evidence_context, attempt_number, response, confidence, time_spent_seconds)
  values (p_student_id, p_question_version_id, p_session_id, p_source_submission_id, p_evidence_context, v_attempt_number, coalesce(p_response, '{}'::jsonb), p_confidence, p_time_spent_seconds)
  returning id into v_attempt_id;
  perform public.log_audit_event('learning_attempt.recorded', 'learning_attempt', v_attempt_id::text, jsonb_build_object('student_id', p_student_id, 'question_version_id', p_question_version_id, 'evidence_context', p_evidence_context));
  return v_attempt_id;
end;
$$;

create or replace function public.review_question_version(p_question_version_id uuid, p_status public.question_review_status, p_review_notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() or p_status not in ('in_review', 'approved', 'rejected', 'retired') then raise exception 'not_authorized_or_invalid_review_transition' using errcode = '42501'; end if;
  update public.question_versions
    set review_status = p_status, reviewed_by = public.current_profile_id(), reviewed_at = now(), review_notes = p_review_notes
  where id = p_question_version_id and review_status <> 'approved';
  if not found then raise exception 'question_version_not_reviewable' using errcode = '55000'; end if;
  perform public.log_audit_event('question_version.reviewed', 'question_version', p_question_version_id::text, jsonb_build_object('review_status', p_status));
end;
$$;

create or replace function public.record_learner_misconception(
  p_student_id uuid, p_misconception_id uuid, p_state public.misconception_state,
  p_reason text, p_learning_attempt_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if public.current_profile_role() not in ('tutor', 'admin') or not public.can_access_learning_student(p_student_id) then raise exception 'not_authorized' using errcode = '42501'; end if;
  insert into public.learner_misconceptions (student_id, misconception_id, state, determined_by, reason)
  values (p_student_id, p_misconception_id, p_state, public.current_profile_id(), p_reason) returning id into v_id;
  insert into public.learner_misconception_evidence (learner_misconception_id, learning_attempt_id)
  select v_id, attempt_id from unnest(coalesce(p_learning_attempt_ids, '{}'::uuid[])) as attempt_id
  where exists (select 1 from public.learning_attempts where id = attempt_id and student_id = p_student_id);
  perform public.log_audit_event('learner_misconception.recorded', 'learner_misconception', v_id::text, jsonb_build_object('student_id', p_student_id, 'state', p_state));
  return v_id;
end;
$$;

create or replace function public.record_skill_mastery_evaluation(
  p_student_id uuid, p_skill_id uuid, p_rule_set_id uuid, p_state public.mastery_state,
  p_reason text, p_reason_codes text[], p_attempt_evidence_ids uuid[] default '{}',
  p_misconception_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not public.is_platform_admin() or not public.can_access_learning_student(p_student_id) then raise exception 'not_authorized' using errcode = '42501'; end if;
  insert into public.skill_mastery_evaluations (student_id, skill_id, rule_set_id, state, reason, reason_codes, determined_by)
  values (p_student_id, p_skill_id, p_rule_set_id, p_state, p_reason, coalesce(p_reason_codes, '{}'), public.current_profile_id()) returning id into v_id;
  insert into public.skill_mastery_evaluation_evidence (mastery_evaluation_id, learning_attempt_skill_evidence_id)
  select v_id, evidence_id from unnest(coalesce(p_attempt_evidence_ids, '{}'::uuid[])) as evidence_id
  where exists (select 1 from public.learning_attempt_skill_evidence evidence join public.learning_attempts attempt on attempt.id = evidence.learning_attempt_id where evidence.id = evidence_id and attempt.student_id = p_student_id and evidence.skill_id = p_skill_id);
  insert into public.skill_mastery_evaluation_evidence (mastery_evaluation_id, learner_misconception_id)
  select v_id, misconception_id from unnest(coalesce(p_misconception_ids, '{}'::uuid[])) as misconception_id
  where exists (select 1 from public.learner_misconceptions misconception where misconception.id = misconception_id and misconception.student_id = p_student_id);
  perform public.log_audit_event('skill_mastery_evaluation.recorded', 'skill_mastery_evaluation', v_id::text, jsonb_build_object('student_id', p_student_id, 'skill_id', p_skill_id, 'state', p_state, 'rule_set_id', p_rule_set_id));
  return v_id;
end;
$$;

create or replace function public.create_learning_recommendation(
  p_student_id uuid, p_skill_id uuid, p_mastery_evaluation_id uuid, p_rule_set_id uuid,
  p_recommendation_type public.intervention_type, p_recommended_sequence text[],
  p_reason text, p_reason_codes text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not public.is_platform_admin() or not public.can_access_learning_student(p_student_id) then raise exception 'not_authorized' using errcode = '42501'; end if;
  insert into public.grade9_learning_recommendations (student_id, skill_id, mastery_evaluation_id, rule_set_id, recommendation_type, recommended_sequence, reason)
  values (p_student_id, p_skill_id, p_mastery_evaluation_id, p_rule_set_id, p_recommendation_type, coalesce(p_recommended_sequence, '{}'), p_reason) returning id into v_id;
  insert into public.learning_recommendation_reasons (recommendation_id, reason_code)
  select v_id, code from unnest(coalesce(p_reason_codes, '{}')) as code;
  perform public.log_audit_event('learning_recommendation.created', 'learning_recommendation', v_id::text, jsonb_build_object('student_id', p_student_id, 'skill_id', p_skill_id, 'rule_set_id', p_rule_set_id));
  return v_id;
end;
$$;

create or replace function public.record_tutor_intervention(
  p_student_id uuid, p_skill_id uuid, p_intervention_catalogue_id uuid,
  p_recommendation_id uuid default null, p_session_id uuid default null,
  p_delivered_at timestamptz default now(), p_structured_observation jsonb default '{}',
  p_learner_response text default null, p_tutor_notes text default null, p_follow_up_action text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_tutor_id uuid; v_id uuid;
begin
  select public.current_tutor_id() into v_tutor_id;
  if public.current_profile_role() <> 'tutor' or v_tutor_id is null or not public.can_access_learning_student(p_student_id) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_session_id is not null and not exists (select 1 from public.sessions where id = p_session_id and student_id = p_student_id and tutor_id = v_tutor_id) then raise exception 'session_not_for_tutor_student' using errcode = '23514'; end if;
  if p_recommendation_id is not null and not exists (select 1 from public.grade9_learning_recommendations where id = p_recommendation_id and student_id = p_student_id and skill_id = p_skill_id) then raise exception 'recommendation_not_for_student_skill' using errcode = '23514'; end if;
  insert into public.tutor_interventions (student_id, tutor_id, skill_id, intervention_catalogue_id, recommendation_id, session_id, delivered_at, structured_observation, learner_response, tutor_notes, follow_up_action)
  values (p_student_id, v_tutor_id, p_skill_id, p_intervention_catalogue_id, p_recommendation_id, p_session_id, p_delivered_at, coalesce(p_structured_observation, '{}'::jsonb), p_learner_response, p_tutor_notes, p_follow_up_action) returning id into v_id;
  perform public.log_audit_event('tutor_intervention.recorded', 'tutor_intervention', v_id::text, jsonb_build_object('student_id', p_student_id, 'skill_id', p_skill_id));
  return v_id;
end;
$$;

create or replace function public.record_intervention_outcome(
  p_tutor_intervention_id uuid, p_outcome_stage text,
  p_learning_attempt_skill_evidence_id uuid default null, p_mastery_evaluation_id uuid default null,
  p_outcome_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_intervention public.tutor_interventions; v_id uuid;
begin
  select * into v_intervention from public.tutor_interventions where id = p_tutor_intervention_id;
  if not found or public.current_profile_role() <> 'tutor' or v_intervention.tutor_id <> public.current_tutor_id() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_learning_attempt_skill_evidence_id is not null and not exists (select 1 from public.learning_attempt_skill_evidence e join public.learning_attempts a on a.id = e.learning_attempt_id where e.id = p_learning_attempt_skill_evidence_id and a.student_id = v_intervention.student_id and e.skill_id = v_intervention.skill_id) then raise exception 'evidence_not_for_intervention' using errcode = '23514'; end if;
  if p_mastery_evaluation_id is not null and not exists (select 1 from public.skill_mastery_evaluations e where e.id = p_mastery_evaluation_id and e.student_id = v_intervention.student_id and e.skill_id = v_intervention.skill_id) then raise exception 'mastery_not_for_intervention' using errcode = '23514'; end if;
  insert into public.intervention_outcomes (tutor_intervention_id, outcome_stage, learning_attempt_skill_evidence_id, mastery_evaluation_id, outcome_note)
  values (p_tutor_intervention_id, p_outcome_stage, p_learning_attempt_skill_evidence_id, p_mastery_evaluation_id, p_outcome_note) returning id into v_id;
  perform public.log_audit_event('intervention_outcome.recorded', 'intervention_outcome', v_id::text, jsonb_build_object('tutor_intervention_id', p_tutor_intervention_id, 'outcome_stage', p_outcome_stage));
  return v_id;
end;
$$;

create or replace function public.record_learning_attempt_hint_open(p_learning_attempt_id uuid, p_question_hint_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_student_id uuid; v_question_version_id uuid; v_opened_order integer;
begin
  select student_id, question_version_id into v_student_id, v_question_version_id from public.learning_attempts where id = p_learning_attempt_id and status = 'submitted';
  if v_student_id is null or public.current_profile_role() <> 'student' or v_student_id <> public.current_student_id() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.question_hints where id = p_question_hint_id and question_version_id = v_question_version_id) then raise exception 'hint_not_for_attempt_question' using errcode = '23514'; end if;
  select coalesce(max(opened_order), 0) + 1 into v_opened_order from public.learning_attempt_hint_events where learning_attempt_id = p_learning_attempt_id;
  insert into public.learning_attempt_hint_events (learning_attempt_id, question_hint_id, opened_order) values (p_learning_attempt_id, p_question_hint_id, v_opened_order);
end;
$$;

create or replace function public.evaluate_learning_attempt(
  p_learning_attempt_id uuid, p_is_correct boolean, p_marks_awarded numeric,
  p_tutor_observation text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_attempt public.learning_attempts; v_profile_id uuid; v_hint_count integer;
begin
  select * into v_attempt from public.learning_attempts where id = p_learning_attempt_id and status = 'submitted' for update;
  if not found or public.current_profile_role() not in ('tutor', 'admin') or not public.can_access_learning_student(v_attempt.student_id) then raise exception 'not_authorized' using errcode = '42501'; end if;
  select public.current_profile_id() into v_profile_id;
  if p_marks_awarded < 0 or p_marks_awarded > (select marks from public.question_versions where id = v_attempt.question_version_id) then raise exception 'marks_out_of_range' using errcode = '23514'; end if;
  update public.learning_attempts set status = 'evaluated', is_correct = p_is_correct, marks_awarded = p_marks_awarded, evaluated_by = v_profile_id, evaluated_at = now(), tutor_observation = p_tutor_observation where id = v_attempt.id;
  select count(*) into v_hint_count from public.learning_attempt_hint_events where learning_attempt_id = v_attempt.id;
  insert into public.learning_attempt_skill_evidence (learning_attempt_id, skill_id, independence, is_target_skill, cognitive_level, correct, marks_awarded, marks_possible)
  select v_attempt.id, link.skill_id, case when v_hint_count = 0 then 'independent'::public.attempt_independence else 'assisted'::public.attempt_independence end,
    link.relationship_type = 'primary', qv.cognitive_level, p_is_correct, p_marks_awarded, qv.marks
  from public.question_version_skill_links link join public.question_versions qv on qv.id = link.question_version_id
  where link.question_version_id = v_attempt.question_version_id;
  perform public.log_audit_event('learning_attempt.evaluated', 'learning_attempt', v_attempt.id::text, jsonb_build_object('student_id', v_attempt.student_id, 'is_correct', p_is_correct));
end;
$$;

create or replace function public.decide_learning_recommendation(
  p_recommendation_id uuid, p_decision public.recommendation_decision,
  p_reason text, p_modified_sequence text[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_recommendation public.grade9_learning_recommendations; v_tutor_id uuid; v_decision_id uuid;
begin
  select * into v_recommendation from public.grade9_learning_recommendations where id = p_recommendation_id for update;
  select public.current_tutor_id() into v_tutor_id;
  if not found or public.current_profile_role() <> 'tutor' or v_tutor_id is null or not public.can_access_learning_student(v_recommendation.student_id) then raise exception 'not_authorized' using errcode = '42501'; end if;
  insert into public.tutor_recommendation_decisions (recommendation_id, tutor_id, decision, reason, modified_sequence) values (p_recommendation_id, v_tutor_id, p_decision, p_reason, p_modified_sequence) returning id into v_decision_id;
  update public.grade9_learning_recommendations set status = case p_decision when 'accepted' then 'accepted'::public.recommendation_status when 'modified' then 'modified'::public.recommendation_status else 'rejected'::public.recommendation_status end, closed_at = case when p_decision = 'rejected' then now() else null end where id = p_recommendation_id;
  perform public.log_audit_event('learning_recommendation.decided', 'learning_recommendation', p_recommendation_id::text, jsonb_build_object('decision', p_decision, 'decision_id', v_decision_id));
  return v_decision_id;
end;
$$;

revoke all on function public.get_learning_question(uuid) from public;
revoke all on function public.record_learning_attempt(uuid, uuid, jsonb, smallint, integer, uuid, uuid, public.evidence_context) from public;
revoke all on function public.record_learning_attempt_hint_open(uuid, uuid) from public;
revoke all on function public.evaluate_learning_attempt(uuid, boolean, numeric, text) from public;
revoke all on function public.decide_learning_recommendation(uuid, public.recommendation_decision, text, text[]) from public;
revoke all on function public.review_question_version(uuid, public.question_review_status, text) from public;
revoke all on function public.record_learner_misconception(uuid, uuid, public.misconception_state, text, uuid[]) from public;
revoke all on function public.record_skill_mastery_evaluation(uuid, uuid, uuid, public.mastery_state, text, text[], uuid[], uuid[]) from public;
revoke all on function public.create_learning_recommendation(uuid, uuid, uuid, uuid, public.intervention_type, text[], text, text[]) from public;
revoke all on function public.record_tutor_intervention(uuid, uuid, uuid, uuid, uuid, timestamptz, jsonb, text, text, text) from public;
revoke all on function public.record_intervention_outcome(uuid, text, uuid, uuid, text) from public;
grant execute on function public.get_learning_question(uuid) to authenticated;
grant execute on function public.record_learning_attempt(uuid, uuid, jsonb, smallint, integer, uuid, uuid, public.evidence_context) to authenticated;
grant execute on function public.record_learning_attempt_hint_open(uuid, uuid) to authenticated;
grant execute on function public.evaluate_learning_attempt(uuid, boolean, numeric, text) to authenticated;
grant execute on function public.decide_learning_recommendation(uuid, public.recommendation_decision, text, text[]) to authenticated;
grant execute on function public.review_question_version(uuid, public.question_review_status, text) to authenticated;
grant execute on function public.record_learner_misconception(uuid, uuid, public.misconception_state, text, uuid[]) to authenticated;
grant execute on function public.record_skill_mastery_evaluation(uuid, uuid, uuid, public.mastery_state, text, text[], uuid[], uuid[]) to authenticated;
grant execute on function public.create_learning_recommendation(uuid, uuid, uuid, uuid, public.intervention_type, text[], text, text[]) to authenticated;
grant execute on function public.record_tutor_intervention(uuid, uuid, uuid, uuid, uuid, timestamptz, jsonb, text, text, text) to authenticated;
grant execute on function public.record_intervention_outcome(uuid, text, uuid, uuid, text) to authenticated;

-- Pilot seeds. The skill names are short identifiers derived from the existing
-- project CAPS/2026 ATP map; they intentionally do not quote or invent DBE
-- wording. Draft questions are deliberately not learner-facing.
insert into public.subjects (name, grade, curriculum)
values ('Mathematics', 'Grade 9', 'CAPS')
on conflict (name, grade, curriculum) do nothing;

insert into public.curriculum_versions (subject_id, code, grade, name, valid_from, is_active)
select id, 'CAPS-MATH-G9-2026', 'Grade 9', 'CAPS Mathematics Grade 9 2026 pilot', date '2026-01-01', true
from public.subjects where name = 'Mathematics' and grade = 'Grade 9' and curriculum = 'CAPS'
on conflict (code) do nothing;

insert into public.curriculum_sources (curriculum_version_id, source_tier, title, reference_uri, source_version, notes)
select id, 'DBE', 'Grade 9 CAPS Mathematics and 2026 ATP mapping used by Project Odysseus', 'docs/product/MATHS_CURRICULUM_MAP.md', '2026', 'Seed labels are paraphrased from the existing project curriculum map; verify future changes against the underlying DBE source.'
from public.curriculum_versions where code = 'CAPS-MATH-G9-2026'
on conflict (curriculum_version_id, title) do nothing;

insert into public.curriculum_areas (curriculum_version_id, code, name, display_order)
select id, 'PATTERNS-ALGEBRA', 'Patterns, Functions and Algebra', 1 from public.curriculum_versions where code = 'CAPS-MATH-G9-2026'
on conflict (curriculum_version_id, code) do nothing;
insert into public.curriculum_areas (curriculum_version_id, code, name, display_order)
select id, 'FUNCTIONS-GRAPHS', 'Functions and Graphs', 2 from public.curriculum_versions where code = 'CAPS-MATH-G9-2026'
on conflict (curriculum_version_id, code) do nothing;

insert into public.curriculum_topics (curriculum_area_id, code, name, term, display_order)
select area.id, seed.code, seed.name, seed.term, seed.display_order
from public.curriculum_areas area
join public.curriculum_versions version on version.id = area.curriculum_version_id and version.code = 'CAPS-MATH-G9-2026'
join (values
  ('PATTERNS-ALGEBRA', 'ALGEBRAIC-EXPRESSIONS', 'Algebraic Expressions', 2::smallint, 1),
  ('PATTERNS-ALGEBRA', 'ALGEBRAIC-EQUATIONS', 'Algebraic Equations', 2::smallint, 2),
  ('FUNCTIONS-GRAPHS', 'LINEAR-GRAPHS', 'Graphs', 3::smallint, 1)
) as seed(area_code, code, name, term, display_order) on seed.area_code = area.code
on conflict (curriculum_area_id, code) do nothing;

insert into public.curriculum_skills (subject_id, grade, curriculum, strand, topic, skill_code, title, description, cognitive_level)
select version.subject_id, version.grade, 'CAPS',
  case when seed.topic_code = 'GRAPH' then 'Functions and Graphs' else 'Patterns, Functions and Algebra' end,
  topic.name, seed.code, seed.name, seed.description, 'routine'
from public.curriculum_versions version
join (values
  ('ALG', 'G9.ALG.LANGUAGE', 'Algebraic language', 'Use terms, coefficients, constants and variables accurately.', 2::smallint, 1),
  ('ALG', 'G9.ALG.LIKE_TERMS', 'Like terms', 'Identify and simplify like terms.', 2::smallint, 2),
  ('ALG', 'G9.ALG.SUBSTITUTE', 'Substitution', 'Substitute values into algebraic expressions.', 2::smallint, 3),
  ('ALG', 'G9.ALG.DISTRIBUTIVE', 'Distributive property', 'Expand a factor across a bracket.', 2::smallint, 4),
  ('ALG', 'G9.ALG.EXPAND.MONOMIAL', 'Monomial × polynomial', 'Expand and simplify a monomial multiplied by a polynomial.', 2::smallint, 5),
  ('ALG', 'G9.ALG.EXPAND.BINOMIAL', 'Binomial × binomial', 'Expand and simplify products of two binomials.', 2::smallint, 6),
  ('ALG', 'G9.ALG.SQUARE.BINOMIAL', 'Square of a binomial', 'Expand the square of a binomial.', 2::smallint, 7),
  ('ALG', 'G9.ALG.FACTOR.COMMON', 'Common factorisation', 'Factorise expressions by a common factor.', 2::smallint, 8),
  ('ALG', 'G9.ALG.FACTOR.DOTS', 'Difference of two squares', 'Factorise a difference of two squares.', 2::smallint, 9),
  ('ALG', 'G9.ALG.FACTOR.TRINOMIAL', 'Trinomial factorisation', 'Factorise suitable trinomials.', 2::smallint, 10),
  ('ALG', 'G9.ALG.FRACTIONS.SIMPLIFY', 'Simplifying algebraic fractions', 'Simplify algebraic fractions through factorisation.', 2::smallint, 11),
  ('EQN', 'G9.EQN.LINEAR', 'Linear equations', 'Solve linear equations.', 2::smallint, 1),
  ('EQN', 'G9.EQN.BRACKETS', 'Equations involving brackets', 'Solve linear equations containing brackets.', 2::smallint, 2),
  ('EQN', 'G9.EQN.FRACTIONS', 'Equations involving fractions', 'Solve applicable linear equations containing fractions.', 2::smallint, 3),
  ('EQN', 'G9.EQN.ZERO_PRODUCT', 'Zero-product principle', 'Use the zero-product principle.', 2::smallint, 4),
  ('EQN', 'G9.EQN.FACTORISED', 'Factorised equations', 'Solve equations by factorisation.', 2::smallint, 5),
  ('GRAPH', 'G9.GRAPH.CARTESIAN', 'Cartesian plane', 'Locate and interpret points on the Cartesian plane.', 3::smallint, 1),
  ('GRAPH', 'G9.GRAPH.ORDERED_PAIRS', 'Ordered pairs', 'Read and plot ordered pairs.', 3::smallint, 2),
  ('GRAPH', 'G9.GRAPH.TABLE_EQUATION', 'Table ↔ equation', 'Translate between a table and a linear equation.', 3::smallint, 3),
  ('GRAPH', 'G9.GRAPH.GRADIENT', 'Gradient', 'Determine and interpret gradient.', 3::smallint, 4),
  ('GRAPH', 'G9.GRAPH.X_INTERCEPT', 'x-intercept', 'Determine and interpret the x-intercept.', 3::smallint, 5),
  ('GRAPH', 'G9.GRAPH.Y_INTERCEPT', 'y-intercept', 'Determine and interpret the y-intercept.', 3::smallint, 6),
  ('GRAPH', 'G9.GRAPH.DRAW_LINEAR', 'Draw linear graph', 'Draw a linear graph from an equation or table.', 3::smallint, 7),
  ('GRAPH', 'G9.GRAPH.EQUATION_FROM_GRAPH', 'Equation from graph', 'Determine a linear equation from a graph.', 3::smallint, 8),
  ('GRAPH', 'G9.GRAPH.COMPARE_LINEAR', 'Compare linear relationships', 'Compare linear relationships using representations.', 3::smallint, 9)
) as seed(topic_code, code, name, description, term, display_order) on true
join public.curriculum_topics topic on topic.code = (case when seed.topic_code = 'ALG' then 'ALGEBRAIC-EXPRESSIONS' when seed.topic_code = 'EQN' then 'ALGEBRAIC-EQUATIONS' else 'LINEAR-GRAPHS' end)
join public.curriculum_areas area on area.id = topic.curriculum_area_id and area.curriculum_version_id = version.id
where version.code = 'CAPS-MATH-G9-2026'
on conflict (skill_code) do nothing;

insert into public.grade9_skill_metadata (curriculum_skill_id, curriculum_version_id, curriculum_topic_id, term, valid_from, display_order)
select skill.id, version.id, topic.id, seed.term, date '2026-01-01', seed.display_order
from public.curriculum_versions version
join public.curriculum_topics topic on topic.curriculum_area_id in (select id from public.curriculum_areas where curriculum_version_id = version.id)
join (values
  ('ALGEBRAIC-EXPRESSIONS', 'G9.ALG.LANGUAGE', 2::smallint, 1), ('ALGEBRAIC-EXPRESSIONS', 'G9.ALG.LIKE_TERMS', 2::smallint, 2), ('ALGEBRAIC-EXPRESSIONS', 'G9.ALG.SUBSTITUTE', 2::smallint, 3), ('ALGEBRAIC-EXPRESSIONS', 'G9.ALG.DISTRIBUTIVE', 2::smallint, 4), ('ALGEBRAIC-EXPRESSIONS', 'G9.ALG.EXPAND.MONOMIAL', 2::smallint, 5), ('ALGEBRAIC-EXPRESSIONS', 'G9.ALG.EXPAND.BINOMIAL', 2::smallint, 6), ('ALGEBRAIC-EXPRESSIONS', 'G9.ALG.SQUARE.BINOMIAL', 2::smallint, 7), ('ALGEBRAIC-EXPRESSIONS', 'G9.ALG.FACTOR.COMMON', 2::smallint, 8), ('ALGEBRAIC-EXPRESSIONS', 'G9.ALG.FACTOR.DOTS', 2::smallint, 9), ('ALGEBRAIC-EXPRESSIONS', 'G9.ALG.FACTOR.TRINOMIAL', 2::smallint, 10), ('ALGEBRAIC-EXPRESSIONS', 'G9.ALG.FRACTIONS.SIMPLIFY', 2::smallint, 11), ('ALGEBRAIC-EQUATIONS', 'G9.EQN.LINEAR', 2::smallint, 1), ('ALGEBRAIC-EQUATIONS', 'G9.EQN.BRACKETS', 2::smallint, 2), ('ALGEBRAIC-EQUATIONS', 'G9.EQN.FRACTIONS', 2::smallint, 3), ('ALGEBRAIC-EQUATIONS', 'G9.EQN.ZERO_PRODUCT', 2::smallint, 4), ('ALGEBRAIC-EQUATIONS', 'G9.EQN.FACTORISED', 2::smallint, 5), ('LINEAR-GRAPHS', 'G9.GRAPH.CARTESIAN', 3::smallint, 1), ('LINEAR-GRAPHS', 'G9.GRAPH.ORDERED_PAIRS', 3::smallint, 2), ('LINEAR-GRAPHS', 'G9.GRAPH.TABLE_EQUATION', 3::smallint, 3), ('LINEAR-GRAPHS', 'G9.GRAPH.GRADIENT', 3::smallint, 4), ('LINEAR-GRAPHS', 'G9.GRAPH.X_INTERCEPT', 3::smallint, 5), ('LINEAR-GRAPHS', 'G9.GRAPH.Y_INTERCEPT', 3::smallint, 6), ('LINEAR-GRAPHS', 'G9.GRAPH.DRAW_LINEAR', 3::smallint, 7), ('LINEAR-GRAPHS', 'G9.GRAPH.EQUATION_FROM_GRAPH', 3::smallint, 8), ('LINEAR-GRAPHS', 'G9.GRAPH.COMPARE_LINEAR', 3::smallint, 9)
) as seed(topic_code, skill_code, term, display_order) on seed.topic_code = topic.code
join public.curriculum_skills skill on skill.skill_code = seed.skill_code
where version.code = 'CAPS-MATH-G9-2026'
on conflict (curriculum_version_id, curriculum_skill_id) do nothing;

insert into public.skill_prerequisites (skill_id, prerequisite_skill_id)
select target.id, prerequisite.id
from public.curriculum_skills target
join public.curriculum_skills prerequisite on prerequisite.subject_id = target.subject_id and prerequisite.grade = target.grade
join (values
  ('G9.ALG.LIKE_TERMS', 'G9.ALG.LANGUAGE'), ('G9.ALG.DISTRIBUTIVE', 'G9.ALG.LIKE_TERMS'),
  ('G9.ALG.EXPAND.MONOMIAL', 'G9.ALG.DISTRIBUTIVE'), ('G9.ALG.EXPAND.BINOMIAL', 'G9.ALG.EXPAND.MONOMIAL'),
  ('G9.ALG.SQUARE.BINOMIAL', 'G9.ALG.EXPAND.BINOMIAL'), ('G9.ALG.FACTOR.COMMON', 'G9.ALG.LIKE_TERMS'),
  ('G9.ALG.FACTOR.DOTS', 'G9.ALG.FACTOR.COMMON'), ('G9.ALG.FACTOR.TRINOMIAL', 'G9.ALG.EXPAND.BINOMIAL'),
  ('G9.ALG.FRACTIONS.SIMPLIFY', 'G9.ALG.FACTOR.COMMON'), ('G9.EQN.LINEAR', 'G9.ALG.LIKE_TERMS'),
  ('G9.EQN.BRACKETS', 'G9.EQN.LINEAR'), ('G9.EQN.BRACKETS', 'G9.ALG.DISTRIBUTIVE'),
  ('G9.EQN.FRACTIONS', 'G9.EQN.LINEAR'), ('G9.EQN.ZERO_PRODUCT', 'G9.ALG.FACTOR.COMMON'),
  ('G9.EQN.FACTORISED', 'G9.EQN.ZERO_PRODUCT'), ('G9.EQN.FACTORISED', 'G9.ALG.FACTOR.DOTS'),
  ('G9.GRAPH.ORDERED_PAIRS', 'G9.GRAPH.CARTESIAN'), ('G9.GRAPH.TABLE_EQUATION', 'G9.GRAPH.ORDERED_PAIRS'),
  ('G9.GRAPH.GRADIENT', 'G9.GRAPH.ORDERED_PAIRS'), ('G9.GRAPH.X_INTERCEPT', 'G9.GRAPH.GRADIENT'),
  ('G9.GRAPH.Y_INTERCEPT', 'G9.GRAPH.GRADIENT'), ('G9.GRAPH.DRAW_LINEAR', 'G9.GRAPH.TABLE_EQUATION'),
  ('G9.GRAPH.DRAW_LINEAR', 'G9.GRAPH.GRADIENT'), ('G9.GRAPH.EQUATION_FROM_GRAPH', 'G9.GRAPH.DRAW_LINEAR'),
  ('G9.GRAPH.COMPARE_LINEAR', 'G9.GRAPH.EQUATION_FROM_GRAPH')
) as seed(skill_code, prerequisite_code) on seed.skill_code = target.skill_code and seed.prerequisite_code = prerequisite.skill_code
on conflict (skill_id, prerequisite_skill_id) do nothing;

insert into public.misconceptions (skill_id, code, name, description, diagnostic_notes, default_intervention_type)
select skill.id, seed.code, seed.name, seed.description, seed.notes, seed.intervention::public.intervention_type
from public.curriculum_skills skill
join (values
  ('G9.ALG.DISTRIBUTIVE', 'DISTRIBUTIVE_PARTIAL_MULTIPLICATION', 'Partial distribution', 'A factor is multiplied by only one term inside a bracket.', 'Look for a retained addend after a bracket expansion.', 'worked_example'),
  ('G9.ALG.EXPAND.BINOMIAL', 'BINOMIAL_MISSING_CROSS_TERM', 'Missing cross term', 'One product term is omitted when expanding two binomials.', 'Use area-model or FOIL contrast.', 'contrasting_examples'),
  ('G9.ALG.FACTOR.DOTS', 'DOTS_AS_SQUARE_OF_DIFFERENCE', 'Difference treated as a square', 'A difference of squares is interpreted as the square of a difference.', 'Contrast a²-b² with (a-b)².', 'contrasting_examples'),
  ('G9.ALG.FACTOR.TRINOMIAL', 'TRINOMIAL_SIGN_ERROR', 'Trinomial sign error', 'Factor pair signs do not reconstruct the middle term.', 'Ask learner to expand proposed factors.', 'error_analysis'),
  ('G9.EQN.LINEAR', 'EQUATION_OPERATION_ONE_SIDE', 'Operation applied to one side only', 'An equation operation is not balanced across both sides.', 'Use balance representation.', 'guided_practice'),
  ('G9.EQN.ZERO_PRODUCT', 'ZERO_PRODUCT_WITHOUT_ZERO', 'Zero-product used without zero side', 'Zero-product principle is applied before the equation is equal to zero.', 'Require rewrite to zero before factor reasoning.', 'worked_example'),
  ('G9.GRAPH.GRADIENT', 'GRADIENT_RISE_OVER_RUN_REVERSED', 'Gradient ratio reversed', 'Run over rise is used instead of rise over run.', 'Use two labelled points and a slope triangle.', 'guided_practice'),
  ('G9.GRAPH.X_INTERCEPT', 'X_INTERCEPT_READ_AS_Y_VALUE', 'x-intercept axis confusion', 'The y-axis intercept is reported as the x-intercept.', 'Ask which coordinate is zero at each intercept.', 'representation_translation')
) as seed(skill_code, code, name, description, notes, intervention) on seed.skill_code = skill.skill_code
on conflict (skill_id, code) do nothing;

insert into public.mastery_rule_sets (code, version, name, configuration, is_active)
values ('PILOT-MASTERY', 1, 'Grade 9 pilot deterministic mastery thresholds', '{"pilot":true,"emerging":{"minimum_independent_attempts":1,"maximum_independent_accuracy":0.59},"developing":{"minimum_independent_attempts":2,"minimum_independent_accuracy":0.60},"secure":{"minimum_independent_attempts":4,"minimum_independent_accuracy":0.80,"minimum_distinct_occasions":2,"requires_target_level_evidence":true,"blocks_on_unresolved_critical_misconception":true},"retained":{"requires_prior_secure":true,"minimum_delayed_days":14,"minimum_independent_accuracy":0.80}}'::jsonb, true)
on conflict (code, version) do nothing;
insert into public.recommendation_rule_sets (code, version, name, configuration, is_active)
values ('PILOT-RECOMMENDATIONS', 1, 'Grade 9 pilot deterministic recommendation rules', '{"pilot":true,"rules":["REPEATED_MISCONCEPTION","LOW_COMPLEX_ACCURACY","HINT_DEPENDENCY","FAILED_DELAYED_RETRIEVAL","PREREQUISITES_SECURE"]}'::jsonb, true)
on conflict (code, version) do nothing;
insert into public.intervention_catalogue (code, intervention_type, name, description) values
  ('INT.CONTRASTING.EXAMPLES', 'contrasting_examples', 'Contrasting worked examples', 'Compare near-miss examples to surface a misconception.'),
  ('INT.FADED.EXAMPLE', 'faded_example', 'Faded example', 'Remove steps progressively before independent practice.'),
  ('INT.ERROR.ANALYSIS', 'error_analysis', 'Error analysis', 'Identify, explain and correct an incorrect solution.'),
  ('INT.RETRIEVAL', 'retrieval_practice', 'Delayed retrieval', 'Retrieve the skill after a planned delay.')
on conflict (code) do nothing;

-- Six examples exercise types/cognitive levels. They remain drafts until an
-- authenticated administrator reviews them through the content process.
insert into public.question_items (curriculum_version_id, item_code, source_tier)
select version.id, seed.item_code, 'Odysseus_authored'
from public.curriculum_versions version
cross join (values ('Q.G9.ALG.DISTRIBUTIVE.001'), ('Q.G9.ALG.DOTS.001'), ('Q.G9.EQN.LINEAR.001'), ('Q.G9.EQN.ZERO_PRODUCT.001'), ('Q.G9.GRAPH.GRADIENT.001'), ('Q.G9.GRAPH.EQN_FROM_GRAPH.001')) as seed(item_code)
where version.code = 'CAPS-MATH-G9-2026'
on conflict (curriculum_version_id, item_code) do nothing;

insert into public.question_versions (question_item_id, version_number, activity_type, cognitive_level, representation, difficulty, calculator_policy, prompt, answer_config, solution, marks, review_status, material_change_note)
select item.id, 1, seed.activity_type::public.question_activity_type, seed.cognitive_level::public.caps_cognitive_level, seed.representation::public.math_representation, seed.difficulty, 'not_allowed', seed.prompt, seed.answer_config::jsonb, seed.solution, seed.marks, 'draft', 'Initial pilot draft; human mathematical and CAPS review required before learner delivery.'
from public.question_items item
join (values
  ('Q.G9.ALG.DISTRIBUTIVE.001', 'guided_practice', 'routine', 'symbolic', 2, 'Expand and simplify: 3(x + 4).', '{"accepted_answers":["3x + 12"]}', 'Multiply 3 by each term in the bracket.', 2::numeric),
  ('Q.G9.ALG.DOTS.001', 'error_analysis', 'complex', 'symbolic', 3, 'A learner writes a² - 25 = (a - 5)². Explain the error and give the correct factorisation.', '{"accepted_answers":["(a - 5)(a + 5)"]}', 'Contrast a² - b² with (a - b)².', 3::numeric),
  ('Q.G9.EQN.LINEAR.001', 'independent_practice', 'routine', 'symbolic', 2, 'Solve: 4x - 7 = 13.', '{"accepted_answers":["x = 5"]}', 'Add 7 to both sides, then divide both sides by 4.', 2::numeric),
  ('Q.G9.EQN.ZERO_PRODUCT.001', 'worked_example', 'routine', 'symbolic', 3, 'Solve: (x - 3)(x + 2) = 0.', '{"accepted_answers":["x = 3 or x = -2"]}', 'Set each factor equal to zero.', 2::numeric),
  ('Q.G9.GRAPH.GRADIENT.001', 'representation_translation', 'routine', 'tabular', 2, 'For points (1, 3) and (3, 7), determine the gradient.', '{"accepted_answers":["2"]}', 'Rise is 4 and run is 2.', 2::numeric),
  ('Q.G9.GRAPH.EQN_FROM_GRAPH.001', 'delayed_retention', 'complex', 'graphical', 3, 'A line has gradient 2 and crosses the y-axis at -1. Write its equation.', '{"accepted_answers":["y = 2x - 1"]}', 'Use y = mx + c.', 2::numeric)
) as seed(item_code, activity_type, cognitive_level, representation, difficulty, prompt, answer_config, solution, marks) on seed.item_code = item.item_code
on conflict (question_item_id, version_number) do nothing;

insert into public.question_version_skill_links (question_version_id, skill_id, relationship_type)
select question.id, skill.id, 'primary'
from public.question_versions question
join public.question_items item on item.id = question.question_item_id
join (values
 ('Q.G9.ALG.DISTRIBUTIVE.001', 'G9.ALG.DISTRIBUTIVE'), ('Q.G9.ALG.DOTS.001', 'G9.ALG.FACTOR.DOTS'),
 ('Q.G9.EQN.LINEAR.001', 'G9.EQN.LINEAR'), ('Q.G9.EQN.ZERO_PRODUCT.001', 'G9.EQN.ZERO_PRODUCT'),
 ('Q.G9.GRAPH.GRADIENT.001', 'G9.GRAPH.GRADIENT'), ('Q.G9.GRAPH.EQN_FROM_GRAPH.001', 'G9.GRAPH.EQUATION_FROM_GRAPH')
) as seed(item_code, skill_code) on seed.item_code = item.item_code
join public.curriculum_skills skill on skill.skill_code = seed.skill_code
on conflict do nothing;

insert into public.question_version_misconceptions (question_version_id, misconception_id)
select question.id, misconception.id
from public.question_versions question
join public.question_items item on item.id = question.question_item_id and item.item_code = 'Q.G9.ALG.DOTS.001'
join public.misconceptions misconception on misconception.code = 'DOTS_AS_SQUARE_OF_DIFFERENCE'
on conflict do nothing;

comment on table public.learning_attempts is 'Formative/formal item attempt record. Time is contextual analytics only and must not directly reduce mastery.';
comment on table public.skill_mastery_evaluations is 'Append-only deterministic mastery history. Never overwrite a prior mastery decision.';
comment on table public.grade9_learning_recommendations is 'Explainable deterministic Grade 9 recommendation record; tutor decisions are retained separately.';
comment on table public.tutor_interventions is 'Academic intervention delivery only. Safeguarding is deliberately not represented in this domain.';
