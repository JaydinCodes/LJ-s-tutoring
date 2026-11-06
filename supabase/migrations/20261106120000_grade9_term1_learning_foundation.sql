-- Project Odysseus Sprint 1: Grade 9 Term 1 learning foundation.
--
-- This extends the existing Grade 9 evidence-learning model. It deliberately
-- creates no learner-visible content: all new policies and assessment forms
-- are drafts, and existing question/activity approval remains the only route
-- to learner delivery.

-- Complete the existing Grade 9 curriculum version with the four supplied
-- Term 1 strands. Existing Grade 8 bridge skills and partial Grade 9 Term 1
-- skills are reused; no conceptual placeholder from the resource register is
-- treated as a database identifier.
insert into public.curriculum_areas (curriculum_version_id, code, name, description, display_order)
select id, 'NUMBERS-OPERATIONS', 'Numbers and operations', 'Grade 9 Term 1 number foundations.', 0
from public.curriculum_versions
where code = 'CAPS-MATH-G9-2026'
on conflict (curriculum_version_id, code) do update
set name = excluded.name, description = excluded.description, display_order = excluded.display_order, updated_at = now();

insert into public.curriculum_topics (curriculum_area_id, code, name, description, term, display_order)
select area.id, seed.code, seed.name, seed.description, 1, seed.display_order
from public.curriculum_areas area
join public.curriculum_versions version on version.id = area.curriculum_version_id
join (values
  ('NUMBERS-OPERATIONS', 'WHOLE-NUMBERS', 'Whole numbers', 'Classify real numbers and use factor, multiple and proportional relationships.', 1),
  ('NUMBERS-OPERATIONS', 'INTEGERS', 'Integers', 'Operate with signed integers, powers and integer roots.', 2),
  ('NUMBERS-OPERATIONS', 'EXPONENTS', 'Exponents', 'Extend exponent laws to zero and negative powers.', 3),
  ('PATTERNS-ALGEBRA', 'NUMERIC-GEOMETRIC-PATTERNS', 'Numeric and geometric patterns', 'Describe, extend and justify rules from numeric, tabular and diagrammatic patterns.', 4)
) as seed(area_code, code, name, description, display_order) on seed.area_code = area.code
where version.code = 'CAPS-MATH-G9-2026'
on conflict (curriculum_area_id, code) do update
set name = excluded.name, description = excluded.description, term = excluded.term, display_order = excluded.display_order, updated_at = now();

-- The Grade 8 bridge already contains the target foundation skills. Add only
-- the missing Grade 9 atomic skills, and refine the two existing broad seeds
-- so that zero/negative exponents and a general pattern rule are separately
-- assessable. All remain teacher-review taxonomy, never published content.
with term1_skills(skill_code, strand, topic, title, description, cognitive_level) as (
  values
    ('G9-NUM-WHOLE-HCF-LCM', 'Numbers', 'Whole numbers', 'Use prime factorisation, HCF and LCM', 'Apply factors, multiples and prime factorisation to determine HCF and LCM in a stated context.', 'procedure'),
    ('G9-NUM-DIRECT-INVERSE-PROPORTION', 'Numbers', 'Whole numbers', 'Reason with direct and inverse proportion', 'Identify the relationship, calculate an unknown value and justify whether a direct or inverse model fits.', 'application'),
    ('G9-NUM-INTEGERS-OPERATIONS', 'Numbers', 'Integers', 'Operate with signed integers', 'Apply order of operations when adding, subtracting, multiplying and dividing signed integers.', 'procedure'),
    ('G9-NUM-INTEGERS-POWERS-ROOTS', 'Numbers', 'Integers', 'Use integer powers and roots', 'Evaluate squares, cubes, square roots and cube roots of integers, including their sign implications.', 'procedure'),
    ('G9-EXP-LAWS-EXTENDED', 'Numbers', 'Exponents', 'Apply extended exponent laws', 'Use product, quotient and power laws with integer bases and exponents before introducing zero or negative exponents.', 'procedure'),
    ('G9-EXP-SCI-NOTATION-EXTENSION', 'Numbers', 'Exponents', 'Use scientific notation as an extension', 'Represent and compare quantities in scientific notation; this is supplementary until a curriculum owner confirms local ATP scope.', 'application'),
    ('G9-PAT-NUMERIC-STRUCTURE', 'Patterns', 'Numeric and geometric patterns', 'Analyse numeric pattern structure', 'Use terms and first differences to describe how a linear numeric pattern grows.', 'reasoning'),
    ('G9-PAT-GEOMETRIC-VISUAL', 'Patterns', 'Numeric and geometric patterns', 'Analyse a visual geometric pattern', 'Connect a growing diagram to a table and explain the structure represented by a rule.', 'reasoning')
), inserted as (
  insert into public.curriculum_skills (subject_id, grade, curriculum, strand, topic, skill_code, title, description, cognitive_level, review_status)
  select subject.id, 'Grade 9', 'CAPS', term1_skills.strand, term1_skills.topic, term1_skills.skill_code,
    term1_skills.title, term1_skills.description, term1_skills.cognitive_level, 'teacher_review'
  from term1_skills
  join public.subjects subject on subject.name = 'Mathematics' and subject.grade = 'Grade 9' and subject.curriculum = 'CAPS'
  on conflict (skill_code) do update set
    strand = excluded.strand,
    topic = excluded.topic,
    title = excluded.title,
    description = excluded.description,
    cognitive_level = excluded.cognitive_level,
    updated_at = now()
  returning id, skill_code, title, description, cognitive_level
)
insert into public.curriculum_question_types (skill_id, question_type_code, title, description, representation, cognitive_demand, source_reference, review_status)
select inserted.id, inserted.skill_code || '-FORM', inserted.title || ' question family', inserted.description,
  case when inserted.cognitive_level = 'reasoning' then 'diagram' when inserted.cognitive_level = 'application' then 'word_problem' else 'numeric' end,
  case when inserted.cognitive_level = 'reasoning' then 'reasoning' when inserted.cognitive_level = 'application' then 'application' else 'procedure' end,
  'Project Odysseus Grade 9 Term 1 curriculum foundation; teacher verification required.', 'teacher_review'
from inserted
on conflict (question_type_code) do update set
  title = excluded.title,
  description = excluded.description,
  representation = excluded.representation,
  cognitive_demand = excluded.cognitive_demand,
  source_reference = excluded.source_reference,
  updated_at = now();

update public.curriculum_skills
set title = 'Use zero and negative exponents',
    description = 'Apply exponent laws to simplify expressions containing zero and negative integer exponents.',
    cognitive_level = 'procedure',
    updated_at = now()
where skill_code = 'G9-EXP-NEGATIVE-SCI'
  and review_status = 'teacher_review';

update public.curriculum_skills
set title = 'Justify a general linear pattern rule',
    description = 'Describe and justify a linear nth-term rule from numeric, tabular or diagrammatic representations.',
    cognitive_level = 'reasoning',
    updated_at = now()
where skill_code = 'G9-PAT-GENERAL-RULE'
  and review_status = 'teacher_review';

insert into public.grade9_skill_metadata (curriculum_skill_id, curriculum_version_id, curriculum_topic_id, term, valid_from, display_order)
select skill.id, version.id, topic.id, 1, date '2026-01-01', seed.display_order
from public.curriculum_versions version
join public.curriculum_areas area on area.curriculum_version_id = version.id
join public.curriculum_topics topic on topic.curriculum_area_id = area.id
join (values
  ('WHOLE-NUMBERS', 'G9-NUM-REAL-IRRATIONAL', 1),
  ('WHOLE-NUMBERS', 'G9-NUM-WHOLE-HCF-LCM', 2),
  ('WHOLE-NUMBERS', 'G9-NUM-DIRECT-INVERSE-PROPORTION', 3),
  ('INTEGERS', 'G9-NUM-INTEGERS-OPERATIONS', 1),
  ('INTEGERS', 'G9-NUM-INTEGERS-POWERS-ROOTS', 2),
  ('EXPONENTS', 'G9-EXP-LAWS-EXTENDED', 1),
  ('EXPONENTS', 'G9-EXP-NEGATIVE-SCI', 2),
  ('EXPONENTS', 'G9-EXP-SCI-NOTATION-EXTENSION', 3),
  ('NUMERIC-GEOMETRIC-PATTERNS', 'G9-PAT-NUMERIC-STRUCTURE', 1),
  ('NUMERIC-GEOMETRIC-PATTERNS', 'G9-PAT-GENERAL-RULE', 2),
  ('NUMERIC-GEOMETRIC-PATTERNS', 'G9-PAT-GEOMETRIC-VISUAL', 3)
) as seed(topic_code, skill_code, display_order) on seed.topic_code = topic.code
join public.curriculum_skills skill on skill.skill_code = seed.skill_code
where version.code = 'CAPS-MATH-G9-2026'
on conflict (curriculum_version_id, curriculum_skill_id) do update
set curriculum_topic_id = excluded.curriculum_topic_id,
    term = excluded.term,
    display_order = excluded.display_order;

with links(skill_code, prerequisite_skill_code, strength) as (
  values
    ('G9-NUM-WHOLE-HCF-LCM', 'G8-NUM-WHOLE-PROPERTIES', 1.00::numeric),
    ('G9-NUM-DIRECT-INVERSE-PROPORTION', 'G8-NUM-WHOLE-PROPERTIES', 0.90::numeric),
    ('G9-NUM-DIRECT-INVERSE-PROPORTION', 'G8-NUM-FRACTIONS-OPERATIONS', 0.90::numeric),
    ('G9-NUM-DIRECT-INVERSE-PROPORTION', 'G8-NUM-DECIMALS-OPERATIONS', 0.90::numeric),
    ('G9-NUM-INTEGERS-OPERATIONS', 'G8-NUM-INTEGERS-OPERATIONS', 1.00::numeric),
    ('G9-NUM-INTEGERS-POWERS-ROOTS', 'G8-NUM-INTEGERS-OPERATIONS', 1.00::numeric),
    ('G9-EXP-LAWS-EXTENDED', 'G8-EXP-LAWS-SCI', 1.00::numeric),
    ('G9-EXP-LAWS-EXTENDED', 'G9-NUM-INTEGERS-OPERATIONS', 0.85::numeric),
    ('G9-EXP-NEGATIVE-SCI', 'G9-EXP-LAWS-EXTENDED', 1.00::numeric),
    ('G9-EXP-SCI-NOTATION-EXTENSION', 'G9-EXP-NEGATIVE-SCI', 0.85::numeric),
    ('G9-PAT-NUMERIC-STRUCTURE', 'G8-PAT-REPRESENT-RULE', 0.90::numeric),
    ('G9-PAT-GENERAL-RULE', 'G9-PAT-NUMERIC-STRUCTURE', 1.00::numeric),
    ('G9-PAT-GEOMETRIC-VISUAL', 'G8-PAT-REPRESENT-RULE', 0.90::numeric),
    ('G9-PAT-GEOMETRIC-VISUAL', 'G9-PAT-NUMERIC-STRUCTURE', 0.85::numeric)
)
insert into public.skill_prerequisites (skill_id, prerequisite_skill_id, strength)
select skill.id, prerequisite.id, links.strength
from links
join public.curriculum_skills skill on skill.skill_code = links.skill_code
join public.curriculum_skills prerequisite on prerequisite.skill_code = links.prerequisite_skill_code
on conflict (skill_id, prerequisite_skill_id) do update set strength = excluded.strength;

-- Versioned topic policy and formal assessment configuration. Thresholds are
-- proposed operating values, not a claim of universal validated cut-offs.
create table public.topic_mastery_policies (
  id uuid primary key default gen_random_uuid(),
  curriculum_topic_id uuid not null references public.curriculum_topics(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9._-]+$'),
  version integer not null check (version > 0),
  name text not null check (nullif(btrim(name), '') is not null),
  overall_achievement_threshold numeric(5,2) not null check (overall_achievement_threshold between 0 and 100),
  critical_skill_coverage_threshold numeric(5,2) not null check (critical_skill_coverage_threshold between 0 and 100),
  minimum_reasoning_evidence_count smallint not null check (minimum_reasoning_evidence_count >= 0),
  minimum_reasoning_achievement_threshold numeric(5,2) not null check (minimum_reasoning_achievement_threshold between 0 and 100),
  strong_baseline_threshold numeric(5,2) not null check (strong_baseline_threshold between 0 and 100),
  requires_mastery_challenge boolean not null default true,
  formal_scored_attempts_per_question smallint not null default 1 check (formal_scored_attempts_per_question = 1),
  practice_attempts_per_question smallint not null default 3 check (practice_attempts_per_question = 3),
  allow_qualifying_assignment_evidence boolean not null default false,
  qualifying_assignment_minimum_achievement numeric(5,2) not null default 80 check (qualifying_assignment_minimum_achievement between 0 and 100),
  review_status public.question_review_status not null default 'draft',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_topic_id, code, version),
  check (strong_baseline_threshold >= overall_achievement_threshold),
  check ((review_status = 'approved') = (reviewed_by is not null and reviewed_at is not null))
);

create unique index topic_mastery_policies_one_approved_topic_idx
  on public.topic_mastery_policies(curriculum_topic_id)
  where review_status = 'approved';

create table public.topic_mastery_policy_skills (
  topic_mastery_policy_id uuid not null references public.topic_mastery_policies(id) on delete cascade,
  skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  is_essential boolean not null default true,
  is_critical boolean not null default false,
  requires_reasoning_evidence boolean not null default false,
  primary key (topic_mastery_policy_id, skill_id),
  check (not is_critical or is_essential)
);

create table public.learning_assessment_definitions (
  id uuid primary key default gen_random_uuid(),
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete restrict,
  curriculum_topic_id uuid references public.curriculum_topics(id) on delete restrict,
  topic_mastery_policy_id uuid references public.topic_mastery_policies(id) on delete restrict,
  code text not null unique check (code ~ '^[A-Z0-9._-]+$'),
  form_code text not null check (form_code ~ '^[A-Z0-9._-]+$'),
  name text not null check (nullif(btrim(name), '') is not null),
  assessment_type text not null check (assessment_type in ('entry_baseline', 'topic_baseline', 'endline', 'mastery_challenge')),
  description text,
  duration_minutes smallint not null check (duration_minutes between 1 and 180),
  scored_attempts_per_question smallint not null default 1 check (scored_attempts_per_question = 1),
  review_status public.question_review_status not null default 'draft',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((assessment_type = 'entry_baseline' and curriculum_topic_id is null and topic_mastery_policy_id is null)
      or (assessment_type <> 'entry_baseline' and curriculum_topic_id is not null and topic_mastery_policy_id is not null)),
  check ((review_status = 'approved') = (reviewed_by is not null and reviewed_at is not null))
);

create table public.learning_assessment_definition_questions (
  learning_assessment_definition_id uuid not null references public.learning_assessment_definitions(id) on delete cascade,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  display_order smallint not null check (display_order > 0),
  primary key (learning_assessment_definition_id, question_version_id),
  unique (learning_assessment_definition_id, display_order)
);

create index learning_assessment_definitions_topic_idx
  on public.learning_assessment_definitions(curriculum_topic_id, review_status, created_at desc);

-- Prevent a policy/form from silently crossing a curriculum-topic boundary.
-- These are configuration invariants, not an alternative learning engine.
create or replace function public.validate_topic_mastery_policy_skill()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1
    from public.topic_mastery_policies policy
    join public.grade9_skill_metadata metadata on metadata.curriculum_skill_id = new.skill_id
      and metadata.curriculum_topic_id = policy.curriculum_topic_id
    where policy.id = new.topic_mastery_policy_id
  ) then
    raise exception 'topic_mastery_policy_skill_must_belong_to_policy_topic' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_validate_topic_mastery_policy_skill
before insert or update on public.topic_mastery_policy_skills
for each row execute function public.validate_topic_mastery_policy_skill();

create or replace function public.validate_learning_assessment_definition_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assessment_type = 'entry_baseline' then
    if new.curriculum_topic_id is not null or new.topic_mastery_policy_id is not null then
      raise exception 'entry_baseline_cannot_target_a_topic_policy' using errcode = '23514';
    end if;
    return new;
  end if;
  if not exists (
    select 1
    from public.curriculum_topics topic
    join public.curriculum_areas area on area.id = topic.curriculum_area_id
    join public.topic_mastery_policies policy on policy.id = new.topic_mastery_policy_id
    where topic.id = new.curriculum_topic_id
      and area.curriculum_version_id = new.curriculum_version_id
      and policy.curriculum_topic_id = topic.id
  ) then
    raise exception 'assessment_topic_policy_must_match_curriculum_scope' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_validate_learning_assessment_definition_scope
before insert or update on public.learning_assessment_definitions
for each row execute function public.validate_learning_assessment_definition_scope();

create or replace function public.validate_learning_assessment_question_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1
    from public.learning_assessment_definitions assessment
    join public.question_versions version on version.id = new.question_version_id
    join public.question_items item on item.id = version.question_item_id
    where assessment.id = new.learning_assessment_definition_id
      and item.curriculum_version_id = assessment.curriculum_version_id
  ) then
    raise exception 'assessment_question_must_share_curriculum_version' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_validate_learning_assessment_question_scope
before insert or update on public.learning_assessment_definition_questions
for each row execute function public.validate_learning_assessment_question_scope();

-- Assignment evidence is deliberately not an assignment redesign. A marked,
-- released submission can contribute only through this explicit, reviewed
-- qualification record and only when the active topic policy opts in.
create table public.qualifying_assignment_mastery_evidence (
  id uuid primary key default gen_random_uuid(),
  topic_mastery_policy_id uuid not null references public.topic_mastery_policies(id) on delete restrict,
  assignment_submission_id uuid not null references public.assignment_submissions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete cascade,
  skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  achievement numeric(5,2) not null check (achievement between 0 and 100),
  is_mathematical_reasoning_evidence boolean not null default false,
  qualification_rationale text not null check (nullif(btrim(qualification_rationale), '') is not null),
  qualified_by uuid not null references public.profiles(id) on delete restrict,
  qualified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (topic_mastery_policy_id, assignment_submission_id, skill_id)
);

create index qualifying_assignment_mastery_evidence_student_skill_idx
  on public.qualifying_assignment_mastery_evidence(student_id, skill_id, qualified_at desc);

alter table public.topic_mastery_policies enable row level security;
alter table public.topic_mastery_policy_skills enable row level security;
alter table public.learning_assessment_definitions enable row level security;
alter table public.learning_assessment_definition_questions enable row level security;
alter table public.qualifying_assignment_mastery_evidence enable row level security;

revoke all on table public.topic_mastery_policies, public.topic_mastery_policy_skills,
  public.learning_assessment_definitions, public.learning_assessment_definition_questions,
  public.qualifying_assignment_mastery_evidence from anon, authenticated;
grant select on table public.topic_mastery_policies, public.topic_mastery_policy_skills,
  public.learning_assessment_definitions, public.learning_assessment_definition_questions,
  public.qualifying_assignment_mastery_evidence to authenticated;

create policy "topic_mastery_policies_admin_read" on public.topic_mastery_policies for select to authenticated using (public.is_platform_admin());
create policy "topic_mastery_policy_skills_admin_read" on public.topic_mastery_policy_skills for select to authenticated using (public.is_platform_admin());
create policy "learning_assessment_definitions_admin_read" on public.learning_assessment_definitions for select to authenticated using (public.is_platform_admin());
create policy "learning_assessment_definition_questions_admin_read" on public.learning_assessment_definition_questions for select to authenticated using (public.is_platform_admin());
create policy "qualifying_assignment_mastery_evidence_admin_read" on public.qualifying_assignment_mastery_evidence for select to authenticated using (public.is_platform_admin());

create or replace function public.prevent_approved_topic_mastery_policy_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.review_status = 'approved'
    and (new.review_status <> 'retired'
      or (to_jsonb(new) - array['review_status', 'reviewed_by', 'reviewed_at', 'review_notes', 'updated_at'])
         is distinct from
         (to_jsonb(old) - array['review_status', 'reviewed_by', 'reviewed_at', 'review_notes', 'updated_at'])) then
    raise exception 'approved_topic_mastery_policies_are_immutable_create_a_new_version' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_approved_topic_mastery_policy_mutation
before update on public.topic_mastery_policies
for each row execute function public.prevent_approved_topic_mastery_policy_mutation();

create or replace function public.save_topic_mastery_policy_draft(
  p_payload jsonb,
  p_policy_id uuid default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_policy_id uuid;
  v_skill jsonb;
begin
  perform public.content_admin_required();
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_topic_mastery_policy_payload' using errcode = '23514';
  end if;

  if p_policy_id is null then
    insert into public.topic_mastery_policies (
      curriculum_topic_id, code, version, name, overall_achievement_threshold,
      critical_skill_coverage_threshold, minimum_reasoning_evidence_count,
      minimum_reasoning_achievement_threshold, strong_baseline_threshold,
      requires_mastery_challenge, formal_scored_attempts_per_question,
      practice_attempts_per_question, allow_qualifying_assignment_evidence,
      qualifying_assignment_minimum_achievement, created_by
    ) values (
      nullif(p_payload->>'curriculumTopicId', '')::uuid, p_payload->>'code',
      coalesce(nullif(p_payload->>'version', '')::integer, 1), p_payload->>'name',
      (p_payload->>'overallAchievementThreshold')::numeric,
      (p_payload->>'criticalSkillCoverageThreshold')::numeric,
      (p_payload->>'minimumReasoningEvidenceCount')::smallint,
      (p_payload->>'minimumReasoningAchievementThreshold')::numeric,
      (p_payload->>'strongBaselineThreshold')::numeric,
      coalesce((p_payload->>'requiresMasteryChallenge')::boolean, true), 1, 3,
      coalesce((p_payload->>'allowQualifyingAssignmentEvidence')::boolean, false),
      coalesce((p_payload->>'qualifyingAssignmentMinimumAchievement')::numeric, 80),
      public.current_profile_id()
    ) returning id into v_policy_id;
  else
    select id into v_policy_id from public.topic_mastery_policies
    where id = p_policy_id and review_status in ('draft', 'rejected') for update;
    if not found then raise exception 'topic_mastery_policy_not_editable_create_new_version' using errcode = '55000'; end if;
    update public.topic_mastery_policies set
      curriculum_topic_id = nullif(p_payload->>'curriculumTopicId', '')::uuid,
      code = p_payload->>'code', name = p_payload->>'name',
      overall_achievement_threshold = (p_payload->>'overallAchievementThreshold')::numeric,
      critical_skill_coverage_threshold = (p_payload->>'criticalSkillCoverageThreshold')::numeric,
      minimum_reasoning_evidence_count = (p_payload->>'minimumReasoningEvidenceCount')::smallint,
      minimum_reasoning_achievement_threshold = (p_payload->>'minimumReasoningAchievementThreshold')::numeric,
      strong_baseline_threshold = (p_payload->>'strongBaselineThreshold')::numeric,
      requires_mastery_challenge = coalesce((p_payload->>'requiresMasteryChallenge')::boolean, true),
      formal_scored_attempts_per_question = 1, practice_attempts_per_question = 3,
      allow_qualifying_assignment_evidence = coalesce((p_payload->>'allowQualifyingAssignmentEvidence')::boolean, false),
      qualifying_assignment_minimum_achievement = coalesce((p_payload->>'qualifyingAssignmentMinimumAchievement')::numeric, 80),
      updated_at = now()
    where id = v_policy_id;
    delete from public.topic_mastery_policy_skills where topic_mastery_policy_id = v_policy_id;
  end if;

  for v_skill in select value from jsonb_array_elements(coalesce(p_payload->'skills', '[]'::jsonb)) value loop
    insert into public.topic_mastery_policy_skills (
      topic_mastery_policy_id, skill_id, is_essential, is_critical, requires_reasoning_evidence
    ) values (
      v_policy_id, (v_skill->>'skillId')::uuid,
      coalesce((v_skill->>'isEssential')::boolean, true),
      coalesce((v_skill->>'isCritical')::boolean, false),
      coalesce((v_skill->>'requiresReasoningEvidence')::boolean, false)
    );
  end loop;
  perform public.log_audit_event('learning_configuration.topic_mastery_policy_draft_saved', 'topic_mastery_policy', v_policy_id::text, jsonb_build_object('code', p_payload->>'code'));
  return v_policy_id;
end;
$$;

create or replace function public.review_topic_mastery_policy_action(
  p_policy_id uuid,
  p_action text,
  p_notes text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_from public.question_review_status; v_to public.question_review_status;
begin
  perform public.content_admin_required();
  select review_status into v_from from public.topic_mastery_policies where id = p_policy_id for update;
  if not found then raise exception 'topic_mastery_policy_not_found' using errcode = 'P0002'; end if;
  if p_action = 'submit_for_review' and v_from in ('draft', 'rejected') then v_to := 'in_review';
  elsif p_action = 'approve' and v_from = 'in_review' then
    if not exists (select 1 from public.topic_mastery_policy_skills where topic_mastery_policy_id = p_policy_id and is_essential) then
      raise exception 'topic_mastery_policy_requires_essential_skill' using errcode = '23514';
    end if;
    if not exists (select 1 from public.topic_mastery_policy_skills where topic_mastery_policy_id = p_policy_id and is_critical) then
      raise exception 'topic_mastery_policy_requires_critical_skill' using errcode = '23514';
    end if;
    v_to := 'approved';
  elsif p_action = 'reject' and v_from = 'in_review' then v_to := 'rejected';
  elsif p_action = 'return_for_revision' and v_from = 'in_review' then v_to := 'draft';
  elsif p_action = 'retire' and v_from = 'approved' then v_to := 'retired';
  else raise exception 'invalid_topic_mastery_policy_review_transition' using errcode = '23514'; end if;
  if p_action in ('reject', 'return_for_revision', 'retire') and nullif(btrim(coalesce(p_notes, '')), '') is null then
    raise exception 'review_notes_required' using errcode = '23514';
  end if;
  update public.topic_mastery_policies set review_status = v_to, reviewed_by = public.current_profile_id(), reviewed_at = now(), review_notes = p_notes, updated_at = now() where id = p_policy_id;
  perform public.log_audit_event('learning_configuration.topic_mastery_policy_reviewed', 'topic_mastery_policy', p_policy_id::text, jsonb_build_object('action', p_action, 'from_status', v_from, 'to_status', v_to));
end;
$$;

create or replace function public.save_learning_assessment_draft(
  p_payload jsonb,
  p_assessment_id uuid default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_assessment_id uuid; v_question_id text;
begin
  perform public.content_admin_required();
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'invalid_learning_assessment_payload' using errcode = '23514'; end if;
  if p_assessment_id is null then
    insert into public.learning_assessment_definitions (
      curriculum_version_id, curriculum_topic_id, topic_mastery_policy_id, code, form_code, name,
      assessment_type, description, duration_minutes, scored_attempts_per_question, created_by
    ) values (
      (p_payload->>'curriculumVersionId')::uuid, nullif(p_payload->>'curriculumTopicId', '')::uuid,
      nullif(p_payload->>'topicMasteryPolicyId', '')::uuid, p_payload->>'code', p_payload->>'formCode',
      p_payload->>'name', p_payload->>'assessmentType', nullif(p_payload->>'description', ''),
      (p_payload->>'durationMinutes')::smallint, 1, public.current_profile_id()
    ) returning id into v_assessment_id;
  else
    select id into v_assessment_id from public.learning_assessment_definitions
    where id = p_assessment_id and review_status in ('draft', 'rejected') for update;
    if not found then raise exception 'learning_assessment_not_editable_create_new_form_or_draft' using errcode = '55000'; end if;
    update public.learning_assessment_definitions set
      curriculum_version_id = (p_payload->>'curriculumVersionId')::uuid,
      curriculum_topic_id = nullif(p_payload->>'curriculumTopicId', '')::uuid,
      topic_mastery_policy_id = nullif(p_payload->>'topicMasteryPolicyId', '')::uuid,
      code = p_payload->>'code', form_code = p_payload->>'formCode', name = p_payload->>'name',
      assessment_type = p_payload->>'assessmentType', description = nullif(p_payload->>'description', ''),
      duration_minutes = (p_payload->>'durationMinutes')::smallint,
      scored_attempts_per_question = 1, updated_at = now()
    where id = v_assessment_id;
    delete from public.learning_assessment_definition_questions where learning_assessment_definition_id = v_assessment_id;
  end if;
  for v_question_id in select value from jsonb_array_elements_text(coalesce(p_payload->'questionVersionIds', '[]'::jsonb)) value loop
    insert into public.learning_assessment_definition_questions (learning_assessment_definition_id, question_version_id, display_order)
    values (v_assessment_id, v_question_id::uuid, (select count(*) + 1 from public.learning_assessment_definition_questions where learning_assessment_definition_id = v_assessment_id));
  end loop;
  perform public.log_audit_event('learning_configuration.assessment_draft_saved', 'learning_assessment_definition', v_assessment_id::text, jsonb_build_object('code', p_payload->>'code'));
  return v_assessment_id;
end;
$$;

create or replace function public.review_learning_assessment_action(
  p_assessment_id uuid,
  p_action text,
  p_notes text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_from public.question_review_status; v_to public.question_review_status;
begin
  perform public.content_admin_required();
  select review_status into v_from from public.learning_assessment_definitions where id = p_assessment_id for update;
  if not found then raise exception 'learning_assessment_not_found' using errcode = 'P0002'; end if;
  if p_action = 'submit_for_review' and v_from in ('draft', 'rejected') then v_to := 'in_review';
  elsif p_action = 'approve' and v_from = 'in_review' then
    if not exists (select 1 from public.learning_assessment_definition_questions where learning_assessment_definition_id = p_assessment_id) then raise exception 'learning_assessment_requires_question' using errcode = '23514'; end if;
    if exists (
      select 1 from public.learning_assessment_definition_questions link
      join public.question_versions version on version.id = link.question_version_id
      join public.question_items item on item.id = version.question_item_id
      where link.learning_assessment_definition_id = p_assessment_id
        and (version.review_status <> 'approved' or item.retired_at is not null)
    ) then raise exception 'learning_assessment_requires_approved_active_questions' using errcode = '23514'; end if;
    v_to := 'approved';
  elsif p_action = 'reject' and v_from = 'in_review' then v_to := 'rejected';
  elsif p_action = 'return_for_revision' and v_from = 'in_review' then v_to := 'draft';
  elsif p_action = 'retire' and v_from = 'approved' then v_to := 'retired';
  else raise exception 'invalid_learning_assessment_review_transition' using errcode = '23514'; end if;
  if p_action in ('reject', 'return_for_revision', 'retire') and nullif(btrim(coalesce(p_notes, '')), '') is null then raise exception 'review_notes_required' using errcode = '23514'; end if;
  update public.learning_assessment_definitions set review_status = v_to, reviewed_by = public.current_profile_id(), reviewed_at = now(), review_notes = p_notes, updated_at = now() where id = p_assessment_id;
  perform public.log_audit_event('learning_configuration.assessment_reviewed', 'learning_assessment_definition', p_assessment_id::text, jsonb_build_object('action', p_action, 'from_status', v_from, 'to_status', v_to));
end;
$$;

create or replace function public.qualify_assignment_mastery_evidence(
  p_topic_mastery_policy_id uuid,
  p_assignment_submission_id uuid,
  p_skill_id uuid,
  p_achievement numeric,
  p_is_mathematical_reasoning_evidence boolean,
  p_qualification_rationale text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_student_id uuid; v_evidence_id uuid; v_minimum numeric;
begin
  perform public.content_admin_required();
  select submission.student_id into v_student_id
  from public.assignment_submissions submission
  where submission.id = p_assignment_submission_id
    and submission.is_latest
    and submission.marks_awarded is not null
    and submission.marks_released;
  if v_student_id is null then raise exception 'assignment_submission_must_be_latest_marked_and_released' using errcode = '23514'; end if;
  select qualifying_assignment_minimum_achievement into v_minimum
  from public.topic_mastery_policies
  where id = p_topic_mastery_policy_id
    and review_status = 'approved'
    and allow_qualifying_assignment_evidence;
  if v_minimum is null then raise exception 'topic_policy_does_not_allow_qualifying_assignment_evidence' using errcode = '23514'; end if;
  if p_achievement is null or p_achievement < v_minimum or p_achievement > 100 then raise exception 'assignment_evidence_below_configured_qualification_threshold' using errcode = '23514'; end if;
  if not exists (
    select 1 from public.topic_mastery_policy_skills
    where topic_mastery_policy_id = p_topic_mastery_policy_id and skill_id = p_skill_id and is_essential
  ) then raise exception 'assignment_evidence_skill_not_in_topic_policy' using errcode = '23514'; end if;
  insert into public.qualifying_assignment_mastery_evidence (
    topic_mastery_policy_id, assignment_submission_id, student_id, skill_id, achievement,
    is_mathematical_reasoning_evidence, qualification_rationale, qualified_by
  ) values (
    p_topic_mastery_policy_id, p_assignment_submission_id, v_student_id, p_skill_id, p_achievement,
    coalesce(p_is_mathematical_reasoning_evidence, false), p_qualification_rationale, public.current_profile_id()
  ) returning id into v_evidence_id;
  perform public.log_audit_event('learning_configuration.assignment_evidence_qualified', 'qualifying_assignment_mastery_evidence', v_evidence_id::text, jsonb_build_object('student_id', v_student_id, 'skill_id', p_skill_id, 'policy_id', p_topic_mastery_policy_id));
  return v_evidence_id;
end;
$$;

revoke all on function public.prevent_approved_topic_mastery_policy_mutation() from public, anon, authenticated;
revoke all on function public.validate_topic_mastery_policy_skill() from public, anon, authenticated;
revoke all on function public.validate_learning_assessment_definition_scope() from public, anon, authenticated;
revoke all on function public.validate_learning_assessment_question_scope() from public, anon, authenticated;
revoke all on function public.validate_learning_answer_config(jsonb) from public, anon, authenticated;
revoke all on function public.validate_question_version_for_approval(uuid) from public, anon, authenticated;
revoke all on function public.save_topic_mastery_policy_draft(jsonb, uuid) from public;
revoke all on function public.review_topic_mastery_policy_action(uuid, text, text) from public;
revoke all on function public.save_learning_assessment_draft(jsonb, uuid) from public;
revoke all on function public.review_learning_assessment_action(uuid, text, text) from public;
revoke all on function public.qualify_assignment_mastery_evidence(uuid, uuid, uuid, numeric, boolean, text) from public;
grant execute on function public.save_topic_mastery_policy_draft(jsonb, uuid) to authenticated;
grant execute on function public.review_topic_mastery_policy_action(uuid, text, text) to authenticated;
grant execute on function public.save_learning_assessment_draft(jsonb, uuid) to authenticated;
grant execute on function public.review_learning_assessment_action(uuid, text, text) to authenticated;
grant execute on function public.qualify_assignment_mastery_evidence(uuid, uuid, uuid, numeric, boolean, text) to authenticated;

-- Strengthen the existing reusable multiple-choice answer contract. Answer
-- keys remain stored only in the privileged question version; learner display
-- RPCs continue to expose labels without correct_option or explanations.
alter table public.question_versions
  add column if not exists reasoning_classification text not null default 'not_classified'
  check (reasoning_classification in ('not_classified', 'procedural', 'mathematical_reasoning'));

create or replace function public.validate_learning_answer_config(p_config jsonb)
returns text[] language plpgsql immutable set search_path = '' as $$
declare
  v_type text;
  v_accepted jsonb;
  v_options jsonb;
  v_distractors jsonb;
  v_correct text;
  v_option_keys text[];
  v_distractor_keys text[];
  v_expected_distractor_keys text[];
  v_errors text[] := '{}';
begin
  if p_config is null or jsonb_typeof(p_config) <> 'object' then return array['INVALID_ANSWER_CONFIG']; end if;
  v_type := p_config->>'type';
  v_accepted := coalesce(p_config->'accepted', p_config->'accepted_answers');
  if v_type is null then
    if jsonb_typeof(v_accepted) <> 'array' or jsonb_array_length(v_accepted) = 0 then v_errors := array_append(v_errors, 'MISSING_DETERMINISTIC_EXPECTED_ANSWER'); end if;
    return v_errors;
  end if;
  if v_type not in ('numeric', 'fraction', 'multiple_choice', 'coordinate', 'linear_equation_solution', 'algebraic_expression', 'factorised_expression') then return array['UNSUPPORTED_QUESTION_TYPE']; end if;
  if v_type = 'multiple_choice' then
    v_options := p_config->'options';
    v_correct := nullif(btrim(coalesce(p_config->>'correct_option', '')), '');
    v_distractors := p_config->'distractor_explanations';
    if jsonb_typeof(v_options) <> 'object' then
      v_errors := array_append(v_errors, 'MC_OPTIONS_MUST_BE_A_TO_D');
    else
      select coalesce(array_agg(key order by key), '{}'::text[]) into v_option_keys from jsonb_object_keys(v_options) key;
      if v_option_keys is distinct from array['A', 'B', 'C', 'D'] then v_errors := array_append(v_errors, 'MC_OPTIONS_MUST_BE_A_TO_D'); end if;
      if exists (select 1 from jsonb_each_text(v_options) option_row where nullif(btrim(option_row.value), '') is null) then v_errors := array_append(v_errors, 'MC_OPTION_TEXT_REQUIRED'); end if;
      if (select count(distinct option_row.value) from jsonb_each_text(v_options) option_row) <> 4 then v_errors := array_append(v_errors, 'MC_OPTIONS_MUST_BE_DISTINCT'); end if;
    end if;
    if v_correct is null or v_correct not in ('A', 'B', 'C', 'D') then
      v_errors := array_append(v_errors, 'MC_CORRECT_OPTION_REQUIRED');
    else
      v_expected_distractor_keys := array_remove(array['A', 'B', 'C', 'D'], v_correct);
      if jsonb_typeof(v_distractors) <> 'object' then
        v_errors := array_append(v_errors, 'MC_DISTRACTOR_EXPLANATIONS_MUST_MATCH_INCORRECT_OPTIONS');
      else
        select coalesce(array_agg(key order by key), '{}'::text[]) into v_distractor_keys from jsonb_object_keys(v_distractors) key;
        if v_distractor_keys is distinct from v_expected_distractor_keys then v_errors := array_append(v_errors, 'MC_DISTRACTOR_EXPLANATIONS_MUST_MATCH_INCORRECT_OPTIONS'); end if;
        if exists (select 1 from jsonb_each_text(v_distractors) explanation_row where nullif(btrim(explanation_row.value), '') is null) then v_errors := array_append(v_errors, 'MC_DISTRACTOR_EXPLANATION_REQUIRED'); end if;
      end if;
    end if;
  elsif jsonb_typeof(v_accepted) <> 'array' or jsonb_array_length(v_accepted) = 0 then
    v_errors := array_append(v_errors, 'MISSING_DETERMINISTIC_EXPECTED_ANSWER');
  end if;
  if v_type = 'numeric' and p_config ? 'tolerance' and (p_config->>'tolerance') !~ '^[0-9]+(\.[0-9]+)?$' then v_errors := array_append(v_errors, 'INVALID_NUMERIC_TOLERANCE'); end if;
  if v_type = 'factorised_expression' and coalesce(p_config->>'required_form', '') <> 'factorised' then v_errors := array_append(v_errors, 'FACTORISED_FORM_REQUIRED'); end if;
  return v_errors;
end;
$$;

create or replace function public.validate_question_version_for_approval(p_question_version_id uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare v_errors text[] := '{}'; v_answer jsonb; v_solution text; v_marks numeric; v_type public.question_activity_type; v_prompt text; v_reasoning text;
begin
  select version.answer_config, version.solution, version.marks, version.activity_type, version.prompt, version.reasoning_classification
  into v_answer, v_solution, v_marks, v_type, v_prompt, v_reasoning
  from public.question_versions version
  join public.question_items item on item.id = version.question_item_id
  join public.curriculum_versions curriculum on curriculum.id = item.curriculum_version_id
  where version.id = p_question_version_id and curriculum.is_active and curriculum.valid_from <= current_date and (curriculum.valid_until is null or curriculum.valid_until >= current_date) and item.retired_at is null;
  if not found then return array['INACTIVE_OR_MISSING_CURRICULUM_VERSION']; end if;
  if not exists (select 1 from public.question_version_skill_links link join public.curriculum_skills skill on skill.id = link.skill_id where link.question_version_id = p_question_version_id and link.relationship_type = 'primary' and skill.is_active) then v_errors := array_append(v_errors, 'MISSING_OR_RETIRED_PRIMARY_SKILL'); end if;
  v_errors := v_errors || public.validate_learning_answer_config(v_answer);
  if v_answer->>'type' = 'multiple_choice' and v_reasoning = 'not_classified' then v_errors := array_append(v_errors, 'MISSING_REASONING_CLASSIFICATION'); end if;
  if nullif(btrim(coalesce(v_solution, '')), '') is null then v_errors := array_append(v_errors, 'MISSING_SOLUTION'); end if;
  if coalesce(v_marks, 0) <= 0 then v_errors := array_append(v_errors, 'INVALID_MARKS'); end if;
  if v_type = 'error_analysis' and coalesce(v_prompt, '') !~* '(error|incorrect|wrong|says|claims)' then v_errors := array_append(v_errors, 'ERROR_ANALYSIS_MISSING_ERROR_STIMULUS'); end if;
  if v_type = 'worked_example' and length(coalesce(v_solution, '')) < 20 then v_errors := array_append(v_errors, 'WORKED_EXAMPLE_REQUIRES_MODEL_SOLUTION'); end if;
  if v_type = 'faded_example' and coalesce(v_prompt, '') !~ '(_{2,}|\[blank\]|\.{3,})' then v_errors := array_append(v_errors, 'FADED_EXAMPLE_MISSING_LEARNER_STEP'); end if;
  if exists (select 1 from public.question_hints hint where hint.question_version_id = p_question_version_id group by hint.question_version_id having min(hint.hint_level) <> 1 or max(hint.hint_level) > 5 or count(*) <> max(hint.hint_level) or count(*) <> count(distinct hint.hint_level)) then v_errors := array_append(v_errors, 'INVALID_HINT_LADDER'); end if;
  return coalesce((select array_agg(distinct error_code) from unnest(v_errors) error_code), '{}'::text[]);
end;
$$;

-- Preserve the existing authoring workflow while carrying difficulty and a
-- reasoning classification into immutable question versions.
create or replace function public.save_learning_question_draft(p_payload jsonb, p_question_version_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_item uuid; v_version uuid; v_curriculum uuid; v_next integer; v_primary uuid; v_errors text[]; v_hint jsonb; v_supporting uuid[]; v_misconceptions uuid[];
begin
 perform public.content_admin_required();
 if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'invalid_payload' using errcode = '23514'; end if;
 v_primary := nullif(p_payload->>'primarySkillId', '')::uuid;
 if v_primary is null then raise exception 'primary_skill_required' using errcode = '23514'; end if;
 v_errors := public.validate_learning_answer_config(coalesce(p_payload->'answerConfig', '{}'::jsonb)); if cardinality(v_errors) > 0 then raise exception 'invalid_answer_config:%', array_to_string(v_errors, ',') using errcode = '23514'; end if;
 if p_question_version_id is null then
   select curriculum.id into v_curriculum from public.curriculum_versions curriculum join public.curriculum_skills skill on skill.id = v_primary where curriculum.subject_id = skill.subject_id and curriculum.grade = skill.grade and curriculum.is_active order by curriculum.valid_from desc limit 1;
   if v_curriculum is null then raise exception 'no_active_curriculum_for_primary_skill' using errcode = '23514'; end if;
   insert into public.question_items(curriculum_version_id,item_code,source_tier,source_notes,created_by) values(v_curriculum,p_payload->>'itemCode',coalesce((p_payload->>'sourceTier')::public.curriculum_source_tier,'Odysseus_authored'),nullif(p_payload->>'sourceNotes',''),public.current_profile_id()) returning id into v_item;
   v_next := 1;
 else
   select version.question_item_id, version.version_number into v_item,v_next from public.question_versions version where version.id = p_question_version_id for update;
   if not found then raise exception 'question_version_not_found' using errcode = 'P0002'; end if;
   if (select review_status from public.question_versions where id = p_question_version_id) in ('approved','retired','in_review') then raise exception 'draft_not_editable_create_revision' using errcode = '55000'; end if;
 end if;
 if p_question_version_id is null then
   insert into public.question_versions(question_item_id,version_number,review_status,activity_type,cognitive_level,representation,difficulty,reasoning_classification,calculator_policy,prompt,answer_config,solution,marks,created_by,material_change_note)
   values(v_item,v_next,'draft',(p_payload->>'activityType')::public.question_activity_type,(p_payload->>'cognitiveLevel')::public.caps_cognitive_level,(p_payload->>'representation')::public.math_representation,nullif(p_payload->>'difficulty','')::smallint,coalesce(nullif(p_payload->>'reasoningClassification',''),'not_classified'), (p_payload->>'calculatorPolicy')::public.calculator_policy,p_payload->>'prompt',p_payload->'answerConfig',nullif(p_payload->>'solution',''),(p_payload->>'marks')::numeric,public.current_profile_id(),nullif(p_payload->>'materialChangeNote','')) returning id into v_version;
 else v_version := p_question_version_id; update public.question_versions set activity_type=(p_payload->>'activityType')::public.question_activity_type,cognitive_level=(p_payload->>'cognitiveLevel')::public.caps_cognitive_level,representation=(p_payload->>'representation')::public.math_representation,difficulty=nullif(p_payload->>'difficulty','')::smallint,reasoning_classification=coalesce(nullif(p_payload->>'reasoningClassification',''),'not_classified'),calculator_policy=(p_payload->>'calculatorPolicy')::public.calculator_policy,prompt=p_payload->>'prompt',answer_config=p_payload->'answerConfig',solution=nullif(p_payload->>'solution',''),marks=(p_payload->>'marks')::numeric,material_change_note=nullif(p_payload->>'materialChangeNote','') where id=v_version; delete from public.question_version_skill_links where question_version_id=v_version; delete from public.question_version_misconceptions where question_version_id=v_version; delete from public.question_hints where question_version_id=v_version; end if;
 insert into public.question_version_skill_links(question_version_id,skill_id,relationship_type) values(v_version,v_primary,'primary');
 for v_supporting in select array_agg(value::uuid) from jsonb_array_elements_text(coalesce(p_payload->'supportingSkillIds','[]'::jsonb)) value loop insert into public.question_version_skill_links(question_version_id,skill_id,relationship_type) select v_version, unnest(v_supporting),'supporting' on conflict do nothing; end loop;
 for v_misconceptions in select array_agg(value::uuid) from jsonb_array_elements_text(coalesce(p_payload->'misconceptionIds','[]'::jsonb)) value loop insert into public.question_version_misconceptions(question_version_id,misconception_id) select v_version,unnest(v_misconceptions) on conflict do nothing; end loop;
 for v_hint in select value from jsonb_array_elements(coalesce(p_payload->'hints','[]'::jsonb)) value loop insert into public.question_hints(question_version_id,hint_level,prompt) values(v_version,(v_hint->>'level')::smallint,v_hint->>'prompt'); end loop;
 perform public.log_audit_event(case when p_question_version_id is null then 'learning_content.question_created' else 'learning_content.question_updated' end,'question_version',v_version::text,jsonb_build_object('item_code',p_payload->>'itemCode'));
 return v_version;
end;
$$;

create or replace function public.create_learning_question_revision(p_question_version_id uuid, p_material_change_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_old public.question_versions; v_new uuid;
begin
 perform public.content_admin_required(); select * into v_old from public.question_versions where id = p_question_version_id; if not found then raise exception 'question_version_not_found' using errcode = 'P0002'; end if;
 insert into public.question_versions(question_item_id,version_number,review_status,activity_type,cognitive_level,representation,difficulty,reasoning_classification,calculator_policy,prompt,answer_config,solution,marks,created_by,material_change_note) values(v_old.question_item_id,v_old.version_number+1,'draft',v_old.activity_type,v_old.cognitive_level,v_old.representation,v_old.difficulty,v_old.reasoning_classification,v_old.calculator_policy,v_old.prompt,v_old.answer_config,v_old.solution,v_old.marks,public.current_profile_id(),coalesce(p_material_change_note,'Revision of approved version')) returning id into v_new;
 insert into public.question_version_skill_links select v_new,skill_id,relationship_type from public.question_version_skill_links where question_version_id=v_old.id;
 insert into public.question_version_misconceptions select v_new,misconception_id from public.question_version_misconceptions where question_version_id=v_old.id;
 insert into public.question_hints(question_version_id,hint_level,prompt) select v_new,hint_level,prompt from public.question_hints where question_version_id=v_old.id;
 perform public.log_audit_event('learning_content.question_revision_created','question_version',v_new::text,jsonb_build_object('previous_version_id',p_question_version_id)); return v_new;
end;
$$;

-- Proposed policies and the 13 planned formal assessment forms are drafts.
-- They cannot be served, scored, or used as mastery evidence until separately
-- reviewed and populated with approved question versions.
insert into public.topic_mastery_policies (
  curriculum_topic_id, code, version, name, overall_achievement_threshold,
  critical_skill_coverage_threshold, minimum_reasoning_evidence_count,
  minimum_reasoning_achievement_threshold, strong_baseline_threshold,
  requires_mastery_challenge, formal_scored_attempts_per_question,
  practice_attempts_per_question, allow_qualifying_assignment_evidence
)
select topic.id, seed.code, 1, seed.name, 80, 100, 1, 80, 90, true, 1, 3, false
from public.curriculum_topics topic
join public.curriculum_areas area on area.id = topic.curriculum_area_id
join public.curriculum_versions version on version.id = area.curriculum_version_id
join (values
  ('WHOLE-NUMBERS', 'G9-T1-WHOLE-MASTERY', 'Grade 9 Term 1 Whole numbers pilot policy'),
  ('INTEGERS', 'G9-T1-INTEGERS-MASTERY', 'Grade 9 Term 1 Integers pilot policy'),
  ('EXPONENTS', 'G9-T1-EXPONENTS-MASTERY', 'Grade 9 Term 1 Exponents pilot policy'),
  ('NUMERIC-GEOMETRIC-PATTERNS', 'G9-T1-PATTERNS-MASTERY', 'Grade 9 Term 1 Patterns pilot policy')
) as seed(topic_code, code, name) on seed.topic_code = topic.code
where version.code = 'CAPS-MATH-G9-2026'
on conflict (curriculum_topic_id, code, version) do nothing;

insert into public.topic_mastery_policy_skills (topic_mastery_policy_id, skill_id, is_essential, is_critical, requires_reasoning_evidence)
select policy.id, skill.id, seed.is_essential, seed.is_critical, seed.requires_reasoning_evidence
from public.topic_mastery_policies policy
join (values
  ('G9-T1-WHOLE-MASTERY', 'G9-NUM-REAL-IRRATIONAL', true, true, true),
  ('G9-T1-WHOLE-MASTERY', 'G9-NUM-WHOLE-HCF-LCM', true, true, false),
  ('G9-T1-WHOLE-MASTERY', 'G9-NUM-DIRECT-INVERSE-PROPORTION', true, false, true),
  ('G9-T1-INTEGERS-MASTERY', 'G9-NUM-INTEGERS-OPERATIONS', true, true, false),
  ('G9-T1-INTEGERS-MASTERY', 'G9-NUM-INTEGERS-POWERS-ROOTS', true, true, false),
  ('G9-T1-EXPONENTS-MASTERY', 'G9-EXP-LAWS-EXTENDED', true, true, false),
  ('G9-T1-EXPONENTS-MASTERY', 'G9-EXP-NEGATIVE-SCI', true, true, false),
  ('G9-T1-EXPONENTS-MASTERY', 'G9-EXP-SCI-NOTATION-EXTENSION', false, false, false),
  ('G9-T1-PATTERNS-MASTERY', 'G9-PAT-NUMERIC-STRUCTURE', true, true, true),
  ('G9-T1-PATTERNS-MASTERY', 'G9-PAT-GENERAL-RULE', true, true, true),
  ('G9-T1-PATTERNS-MASTERY', 'G9-PAT-GEOMETRIC-VISUAL', true, true, true)
) as seed(policy_code, skill_code, is_essential, is_critical, requires_reasoning_evidence) on seed.policy_code = policy.code
join public.curriculum_skills skill on skill.skill_code = seed.skill_code
on conflict (topic_mastery_policy_id, skill_id) do update set
  is_essential = excluded.is_essential,
  is_critical = excluded.is_critical,
  requires_reasoning_evidence = excluded.requires_reasoning_evidence;

insert into public.learning_assessment_definitions (
  curriculum_version_id, curriculum_topic_id, topic_mastery_policy_id, code, form_code,
  name, assessment_type, description, duration_minutes, scored_attempts_per_question
)
select version.id, null, null, 'G9-T1-ENTRY-BASELINE-A', 'A', 'Grade 9 Term 1 entry baseline — Form A', 'entry_baseline', 'Balanced diagnostic across the reviewed Term 1 skill map.', 20, 1
from public.curriculum_versions version where version.code = 'CAPS-MATH-G9-2026'
on conflict (code) do nothing;

insert into public.learning_assessment_definitions (
  curriculum_version_id, curriculum_topic_id, topic_mastery_policy_id, code, form_code,
  name, assessment_type, description, duration_minutes, scored_attempts_per_question
)
select version.id, topic.id, policy.id,
  policy.code || '-' || suffix.code, 'A', topic.name || ' — ' || suffix.name || ' Form A',
  suffix.assessment_type, suffix.description, suffix.duration_minutes, 1
from public.curriculum_versions version
join public.curriculum_areas area on area.curriculum_version_id = version.id
join public.curriculum_topics topic on topic.curriculum_area_id = area.id
join public.topic_mastery_policies policy on policy.curriculum_topic_id = topic.id
cross join (values
  ('TOPIC-BASELINE', 'topic baseline', 'topic_baseline', 'Short diagnostic before independent study or targeted support.', 12::smallint),
  ('ENDLINE', 'endline', 'endline', 'Independent coverage check after learning activity and remediation.', 20::smallint),
  ('MASTERY-CHALLENGE', 'mastery challenge', 'mastery_challenge', 'Independent challenge that samples critical skills and mathematical reasoning.', 15::smallint)
) as suffix(code, name, assessment_type, description, duration_minutes)
where version.code = 'CAPS-MATH-G9-2026'
  and policy.code in ('G9-T1-WHOLE-MASTERY', 'G9-T1-INTEGERS-MASTERY', 'G9-T1-EXPONENTS-MASTERY', 'G9-T1-PATTERNS-MASTERY')
on conflict (code) do nothing;

comment on table public.topic_mastery_policies is 'Versioned, review-gated topic policy. Unknown prerequisite evidence is not a failed prerequisite.';
comment on table public.learning_assessment_definitions is 'Formal assessment configuration. Each question permits exactly one scored answer; durations are administrator-controlled.';
comment on table public.qualifying_assignment_mastery_evidence is 'Optional bridge from released assignment evidence. Assignment rows never influence Learning Journey mastery unless explicitly qualified here.';
