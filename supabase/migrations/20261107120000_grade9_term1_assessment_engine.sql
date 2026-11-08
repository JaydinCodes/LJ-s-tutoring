-- Project Odysseus Sprint 2: secure Grade 9 formal assessment delivery.
--
-- The tables below are deliberately an assessment-session layer over the
-- canonical question bank. They do not duplicate question content, learner
-- identity, assignments, or the existing skill-mastery engine.

alter table public.learning_assessment_definitions
  add column if not exists question_order_mode text not null default 'fixed'
    check (question_order_mode in ('fixed', 'session_shuffle')),
  add column if not exists solution_release_policy text not null default 'after_submission'
    check (solution_release_policy in ('after_submission', 'manual', 'never'));

create table public.learning_assessment_form_versions (
  id uuid primary key default gen_random_uuid(),
  learning_assessment_definition_id uuid not null references public.learning_assessment_definitions(id) on delete restrict,
  topic_mastery_policy_id uuid references public.topic_mastery_policies(id) on delete restrict,
  form_version integer not null check (form_version > 0),
  review_status public.question_review_status not null default 'draft',
  duration_minutes smallint not null check (duration_minutes between 1 and 180),
  question_order_mode text not null check (question_order_mode in ('fixed', 'session_shuffle')),
  solution_release_policy text not null check (solution_release_policy in ('after_submission', 'manual', 'never')),
  blueprint_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(blueprint_snapshot) = 'object'),
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  retired_by uuid references public.profiles(id) on delete set null,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  unique (learning_assessment_definition_id, form_version),
  check ((review_status = 'approved') = (published_by is not null and published_at is not null)),
  check (retired_at is null or review_status = 'retired')
);

create unique index learning_assessment_form_versions_one_live_idx
  on public.learning_assessment_form_versions(learning_assessment_definition_id)
  where review_status = 'approved' and retired_at is null;

create table public.learning_assessment_form_questions (
  learning_assessment_form_version_id uuid not null references public.learning_assessment_form_versions(id) on delete restrict,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  primary_skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  sequence_number smallint not null check (sequence_number > 0),
  prompt_snapshot text not null,
  options_snapshot jsonb not null check (jsonb_typeof(options_snapshot) = 'object'),
  marks_snapshot numeric(6,2) not null check (marks_snapshot > 0),
  reasoning_classification text not null check (reasoning_classification in ('procedural', 'mathematical_reasoning')),
  primary key (learning_assessment_form_version_id, question_version_id),
  unique (learning_assessment_form_version_id, sequence_number)
);

create table public.learning_assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  learning_assessment_definition_id uuid not null references public.learning_assessment_definitions(id) on delete restrict,
  learning_assessment_form_version_id uuid not null references public.learning_assessment_form_versions(id) on delete restrict,
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete restrict,
  curriculum_topic_id uuid references public.curriculum_topics(id) on delete restrict,
  topic_mastery_policy_id uuid references public.topic_mastery_policies(id) on delete restrict,
  -- The referenced policy is immutable once approved. This snapshot makes the
  -- policy inputs explicit even if a later policy version supersedes it.
  policy_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(policy_snapshot) = 'object'),
  assessment_type text not null check (assessment_type in ('entry_baseline', 'topic_baseline', 'endline', 'mastery_challenge')),
  status text not null default 'in_progress' check (status in ('available', 'in_progress', 'submitted', 'timed_out', 'cancelled', 'invalidated')),
  start_idempotency_key uuid not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  original_expires_at timestamptz not null,
  submitted_at timestamptz,
  finalised_at timestamptz,
  raw_score numeric(8,2),
  total_marks numeric(8,2),
  percentage numeric(5,2),
  learner_recommendation jsonb not null default '{}'::jsonb check (jsonb_typeof(learner_recommendation) = 'object'),
  created_at timestamptz not null default now(),
  check (expires_at >= started_at),
  check ((status in ('submitted', 'timed_out', 'cancelled', 'invalidated')) = (finalised_at is not null)),
  unique (student_id, start_idempotency_key)
);

create unique index learning_assessment_sessions_one_in_progress_idx
  on public.learning_assessment_sessions(student_id, learning_assessment_definition_id)
  where status = 'in_progress';
create index learning_assessment_sessions_student_idx
  on public.learning_assessment_sessions(student_id, created_at desc);
create index learning_assessment_sessions_expiry_idx
  on public.learning_assessment_sessions(status, expires_at)
  where status = 'in_progress';

-- Extensions are authorised operational exceptions. They preserve both the
-- original deadline and each prior extension for audit and support review.
create table public.learning_assessment_session_extensions (
  id uuid primary key default gen_random_uuid(),
  learning_assessment_session_id uuid not null references public.learning_assessment_sessions(id) on delete restrict,
  previous_expires_at timestamptz not null,
  extended_expires_at timestamptz not null,
  added_minutes smallint not null check (added_minutes between 1 and 180),
  reason text not null check (nullif(btrim(reason), '') is not null),
  authorised_by uuid not null references public.profiles(id) on delete restrict,
  authorised_at timestamptz not null default now(),
  check (extended_expires_at > previous_expires_at)
);

create index learning_assessment_session_extensions_session_idx
  on public.learning_assessment_session_extensions(learning_assessment_session_id, authorised_at);

-- A manual solution-release policy is satisfied only by this separately
-- audited record; it never changes the immutable form snapshot itself.
create table public.learning_assessment_form_solution_releases (
  learning_assessment_form_version_id uuid primary key references public.learning_assessment_form_versions(id) on delete restrict,
  released_by uuid not null references public.profiles(id) on delete restrict,
  released_at timestamptz not null default now(),
  reason text not null check (nullif(btrim(reason), '') is not null)
);

create table public.learning_assessment_session_questions (
  id uuid primary key default gen_random_uuid(),
  learning_assessment_session_id uuid not null references public.learning_assessment_sessions(id) on delete cascade,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  primary_skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  sequence_number smallint not null check (sequence_number > 0),
  prompt_snapshot text not null,
  options_snapshot jsonb not null check (jsonb_typeof(options_snapshot) = 'object'),
  marks_snapshot numeric(6,2) not null check (marks_snapshot > 0),
  reasoning_classification text not null check (reasoning_classification in ('procedural', 'mathematical_reasoning')),
  unique (learning_assessment_session_id, question_version_id),
  unique (learning_assessment_session_id, sequence_number)
);

create table public.learning_assessment_session_answers (
  learning_assessment_session_question_id uuid primary key references public.learning_assessment_session_questions(id) on delete cascade,
  selected_option text not null check (selected_option in ('A', 'B', 'C', 'D')),
  revision_number integer not null default 1 check (revision_number > 0),
  last_event_id uuid not null,
  updated_at timestamptz not null default now()
);

create table public.learning_assessment_session_answer_events (
  id uuid primary key default gen_random_uuid(),
  learning_assessment_session_id uuid not null references public.learning_assessment_sessions(id) on delete cascade,
  learning_assessment_session_question_id uuid not null references public.learning_assessment_session_questions(id) on delete cascade,
  selected_option text not null check (selected_option in ('A', 'B', 'C', 'D')),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (learning_assessment_session_id, idempotency_key)
);

create table public.learning_assessment_session_question_results (
  id uuid primary key default gen_random_uuid(),
  learning_assessment_session_id uuid not null references public.learning_assessment_sessions(id) on delete restrict,
  learning_assessment_session_question_id uuid not null references public.learning_assessment_session_questions(id) on delete restrict,
  skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  reasoning_classification text not null check (reasoning_classification in ('procedural', 'mathematical_reasoning')),
  selected_option text check (selected_option in ('A', 'B', 'C', 'D')),
  is_correct boolean not null,
  marks_awarded numeric(6,2) not null check (marks_awarded >= 0),
  marks_available numeric(6,2) not null check (marks_available > 0),
  created_at timestamptz not null default now(),
  unique (learning_assessment_session_question_id),
  check (marks_awarded <= marks_available)
);

create index learning_assessment_question_results_session_skill_idx
  on public.learning_assessment_session_question_results(learning_assessment_session_id, skill_id);

create table public.topic_mastery_evaluations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  curriculum_topic_id uuid not null references public.curriculum_topics(id) on delete restrict,
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete restrict,
  topic_mastery_policy_id uuid not null references public.topic_mastery_policies(id) on delete restrict,
  policy_version integer not null check (policy_version > 0),
  assessment_session_id uuid references public.learning_assessment_sessions(id) on delete restrict,
  assessment_type text check (assessment_type in ('topic_baseline', 'endline', 'mastery_challenge')),
  overall_achievement numeric(5,2),
  critical_skill_coverage numeric(5,2),
  reasoning_achievement numeric(5,2),
  reasoning_evidence_count smallint not null default 0 check (reasoning_evidence_count >= 0),
  status text not null check (status in ('not_assessed', 'evidence_incomplete', 'not_yet_mastered', 'mastered')),
  reason_codes text[] not null default '{}',
  evaluation_algorithm_version text not null default 'grade9-term1-assessment-v1',
  determined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (assessment_session_id is not null or status = 'not_assessed')
);

create index topic_mastery_evaluations_student_topic_idx
  on public.topic_mastery_evaluations(student_id, curriculum_topic_id, determined_at desc);

create table public.topic_mastery_evaluation_evidence (
  id uuid primary key default gen_random_uuid(),
  topic_mastery_evaluation_id uuid not null references public.topic_mastery_evaluations(id) on delete restrict,
  learning_assessment_session_question_result_id uuid references public.learning_assessment_session_question_results(id) on delete restrict,
  qualifying_assignment_mastery_evidence_id uuid references public.qualifying_assignment_mastery_evidence(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((learning_assessment_session_question_result_id is not null)::integer + (qualifying_assignment_mastery_evidence_id is not null)::integer = 1)
);

create unique index topic_mastery_evaluation_session_result_evidence_idx
  on public.topic_mastery_evaluation_evidence(topic_mastery_evaluation_id, learning_assessment_session_question_result_id)
  where learning_assessment_session_question_result_id is not null;
create unique index topic_mastery_evaluation_assignment_evidence_idx
  on public.topic_mastery_evaluation_evidence(topic_mastery_evaluation_id, qualifying_assignment_mastery_evidence_id)
  where qualifying_assignment_mastery_evidence_id is not null;

-- Service operations only insert snapshots and append evidence. These guards
-- prevent a future RPC from silently mutating a published form, recorded
-- result, or historical topic decision.
create or replace function public.prevent_learning_assessment_form_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'published_learning_assessment_forms_are_immutable_create_a_revision' using errcode = '55000';
end;
$$;

create trigger trg_prevent_learning_assessment_form_version_mutation
before update or delete on public.learning_assessment_form_versions
for each row execute function public.prevent_learning_assessment_form_mutation();
create trigger trg_prevent_learning_assessment_form_question_mutation
before update or delete on public.learning_assessment_form_questions
for each row execute function public.prevent_learning_assessment_form_mutation();

create or replace function public.prevent_learning_assessment_result_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'learning_assessment_results_and_topic_evaluations_are_append_only' using errcode = '55000';
end;
$$;

create trigger trg_prevent_learning_assessment_question_result_mutation
before update on public.learning_assessment_session_question_results
for each row execute function public.prevent_learning_assessment_result_mutation();
create trigger trg_prevent_topic_mastery_evaluation_mutation
before update on public.topic_mastery_evaluations
for each row execute function public.prevent_learning_assessment_result_mutation();
create trigger trg_prevent_topic_mastery_evaluation_evidence_mutation
before update on public.topic_mastery_evaluation_evidence
for each row execute function public.prevent_learning_assessment_result_mutation();

create or replace function public.prevent_learning_assessment_session_snapshot_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.student_id is distinct from old.student_id
    or new.learning_assessment_definition_id is distinct from old.learning_assessment_definition_id
    or new.learning_assessment_form_version_id is distinct from old.learning_assessment_form_version_id
    or new.curriculum_version_id is distinct from old.curriculum_version_id
    or new.curriculum_topic_id is distinct from old.curriculum_topic_id
    or new.topic_mastery_policy_id is distinct from old.topic_mastery_policy_id
    or new.policy_snapshot is distinct from old.policy_snapshot
    or new.assessment_type is distinct from old.assessment_type
    or new.started_at is distinct from old.started_at
    or new.original_expires_at is distinct from old.original_expires_at
    or new.start_idempotency_key is distinct from old.start_idempotency_key then
    raise exception 'learning_assessment_session_snapshot_is_immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_learning_assessment_session_snapshot_mutation
before update on public.learning_assessment_sessions
for each row execute function public.prevent_learning_assessment_session_snapshot_mutation();

alter table public.learning_assessment_form_versions enable row level security;
alter table public.learning_assessment_form_questions enable row level security;
alter table public.learning_assessment_sessions enable row level security;
alter table public.learning_assessment_session_extensions enable row level security;
alter table public.learning_assessment_form_solution_releases enable row level security;
alter table public.learning_assessment_session_questions enable row level security;
alter table public.learning_assessment_session_answers enable row level security;
alter table public.learning_assessment_session_answer_events enable row level security;
alter table public.learning_assessment_session_question_results enable row level security;
alter table public.topic_mastery_evaluations enable row level security;
alter table public.topic_mastery_evaluation_evidence enable row level security;

revoke all on table public.learning_assessment_form_versions, public.learning_assessment_form_questions,
  public.learning_assessment_sessions, public.learning_assessment_session_extensions, public.learning_assessment_form_solution_releases, public.learning_assessment_session_questions,
  public.learning_assessment_session_answers, public.learning_assessment_session_answer_events,
  public.learning_assessment_session_question_results, public.topic_mastery_evaluations,
  public.topic_mastery_evaluation_evidence from anon, authenticated;
-- Learners consume a deliberately redacted session/result payload through the
-- owner-checked RPC. Direct table reads would leak policy snapshots or
-- question-level correctness when a form's release policy withholds them.

create policy "learning_assessment_sessions_student_or_admin_read" on public.learning_assessment_sessions for select to authenticated using (
  student_id = public.current_student_id() or public.is_platform_admin()
);
create policy "learning_assessment_session_extensions_admin_read" on public.learning_assessment_session_extensions for select to authenticated using (public.is_platform_admin());
create policy "learning_assessment_form_solution_releases_admin_read" on public.learning_assessment_form_solution_releases for select to authenticated using (public.is_platform_admin());
create policy "learning_assessment_session_questions_student_or_admin_read" on public.learning_assessment_session_questions for select to authenticated using (
  exists (select 1 from public.learning_assessment_sessions session where session.id = learning_assessment_session_id and (session.student_id = public.current_student_id() or public.is_platform_admin()))
);
create policy "learning_assessment_session_answers_student_or_admin_read" on public.learning_assessment_session_answers for select to authenticated using (
  exists (select 1 from public.learning_assessment_session_questions question join public.learning_assessment_sessions session on session.id = question.learning_assessment_session_id where question.id = learning_assessment_session_question_id and (session.student_id = public.current_student_id() or public.is_platform_admin()))
);
create policy "learning_assessment_session_question_results_student_or_admin_read" on public.learning_assessment_session_question_results for select to authenticated using (
  exists (select 1 from public.learning_assessment_sessions session where session.id = learning_assessment_session_id and (session.student_id = public.current_student_id() or public.is_platform_admin()))
);
create policy "topic_mastery_evaluations_student_or_admin_read" on public.topic_mastery_evaluations for select to authenticated using (
  student_id = public.current_student_id() or public.is_platform_admin()
);
create policy "learning_assessment_forms_admin_read" on public.learning_assessment_form_versions for select to authenticated using (public.is_platform_admin());
create policy "learning_assessment_form_questions_admin_read" on public.learning_assessment_form_questions for select to authenticated using (public.is_platform_admin());
create policy "learning_assessment_answer_events_admin_read" on public.learning_assessment_session_answer_events for select to authenticated using (public.is_platform_admin());
create policy "topic_mastery_evaluation_evidence_admin_read" on public.topic_mastery_evaluation_evidence for select to authenticated using (public.is_platform_admin());

create or replace function public.assert_learning_assessment_session_owner(p_session_id uuid)
returns public.learning_assessment_sessions language plpgsql security definer set search_path = '' as $$
declare v_session public.learning_assessment_sessions;
begin
  if public.current_profile_role() <> 'student' then raise exception 'only_students_can_use_learning_assessments' using errcode = '42501'; end if;
  select * into v_session from public.learning_assessment_sessions where id = p_session_id and student_id = public.current_student_id() for update;
  if not found then raise exception 'learning_assessment_session_not_found' using errcode = 'P0002'; end if;
  return v_session;
end;
$$;

create or replace function public.finalize_learning_assessment_session(
  p_session_id uuid,
  p_final_status text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_session public.learning_assessment_sessions;
  v_status text;
  v_score numeric(8,2);
  v_total numeric(8,2);
begin
  select * into v_session from public.learning_assessment_sessions where id = p_session_id for update;
  if not found then raise exception 'learning_assessment_session_not_found' using errcode = 'P0002'; end if;
  if v_session.status in ('submitted', 'timed_out', 'cancelled', 'invalidated') then return v_session.id; end if;
  if v_session.status <> 'in_progress' then raise exception 'learning_assessment_session_not_finalisable' using errcode = '23514'; end if;
  v_status := case when now() >= v_session.expires_at then 'timed_out' else coalesce(p_final_status, 'submitted') end;
  if v_status not in ('submitted', 'timed_out') then raise exception 'invalid_learning_assessment_final_status' using errcode = '22023'; end if;

  insert into public.learning_assessment_session_question_results (
    learning_assessment_session_id, learning_assessment_session_question_id, skill_id,
    reasoning_classification, selected_option, is_correct, marks_awarded, marks_available
  )
  select question.learning_assessment_session_id, question.id, question.primary_skill_id,
    question.reasoning_classification, answer.selected_option,
    coalesce(answer.selected_option = (version.answer_config->>'correct_option'), false),
    case when coalesce(answer.selected_option = (version.answer_config->>'correct_option'), false) then question.marks_snapshot else 0 end,
    question.marks_snapshot
  from public.learning_assessment_session_questions question
  join public.question_versions version on version.id = question.question_version_id
  left join public.learning_assessment_session_answers answer on answer.learning_assessment_session_question_id = question.id
  where question.learning_assessment_session_id = v_session.id
  on conflict (learning_assessment_session_question_id) do nothing;

  select coalesce(sum(marks_awarded), 0), coalesce(sum(marks_available), 0)
  into v_score, v_total
  from public.learning_assessment_session_question_results
  where learning_assessment_session_id = v_session.id;

  update public.learning_assessment_sessions set
    status = v_status,
    submitted_at = now(),
    finalised_at = now(),
    raw_score = v_score,
    total_marks = v_total,
    percentage = case when v_total > 0 then round((v_score / v_total) * 100, 2) else 0 end
  where id = v_session.id;

  perform public.evaluate_topic_mastery_from_assessment_session(v_session.id);
  perform public.log_audit_event('learning_assessment.session_finalised', 'learning_assessment_session', v_session.id::text, jsonb_build_object('status', v_status, 'assessment_definition_id', v_session.learning_assessment_definition_id));
  return v_session.id;
end;
$$;

create or replace function public.evaluate_topic_mastery_from_assessment_session(p_session_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_session public.learning_assessment_sessions;
  v_policy public.topic_mastery_policies;
  v_evaluation_id uuid;
  v_critical_total integer;
  v_critical_secure integer;
  v_reasoning_total integer;
  v_reasoning_correct integer;
  v_assignment_reasoning integer;
  v_overall numeric(5,2);
  v_critical_coverage numeric(5,2);
  v_reasoning_achievement numeric(5,2);
  v_reasoning_count integer;
  v_status text;
  v_reason_codes text[] := '{}';
  v_focus_skill text;
begin
  select * into v_session from public.learning_assessment_sessions where id = p_session_id;
  if not found or v_session.curriculum_topic_id is null or v_session.topic_mastery_policy_id is null then return null; end if;
  if exists (select 1 from public.topic_mastery_evaluations where assessment_session_id = p_session_id) then
    return (select id from public.topic_mastery_evaluations where assessment_session_id = p_session_id);
  end if;
  select * into v_policy from public.topic_mastery_policies where id = v_session.topic_mastery_policy_id;
  if not found then raise exception 'assessment_session_policy_missing' using errcode = '23514'; end if;
  v_overall := coalesce(v_session.percentage, 0);

  select count(*) into v_critical_total from public.topic_mastery_policy_skills where topic_mastery_policy_id = v_policy.id and is_critical;
  select count(*) into v_critical_secure
  from public.topic_mastery_policy_skills policy_skill
  where policy_skill.topic_mastery_policy_id = v_policy.id and policy_skill.is_critical
    and (
      exists (select 1 from public.learning_assessment_session_question_results result where result.learning_assessment_session_id = p_session_id and result.skill_id = policy_skill.skill_id and result.is_correct)
      or (v_policy.allow_qualifying_assignment_evidence and exists (select 1 from public.qualifying_assignment_mastery_evidence assignment_evidence where assignment_evidence.topic_mastery_policy_id = v_policy.id and assignment_evidence.student_id = v_session.student_id and assignment_evidence.skill_id = policy_skill.skill_id and assignment_evidence.achievement >= v_policy.qualifying_assignment_minimum_achievement))
    );
  v_critical_coverage := case when v_critical_total = 0 then 100 else round((v_critical_secure::numeric / v_critical_total) * 100, 2) end;

  select count(*), count(*) filter (where is_correct) into v_reasoning_total, v_reasoning_correct
  from public.learning_assessment_session_question_results
  where learning_assessment_session_id = p_session_id and reasoning_classification = 'mathematical_reasoning';
  select count(*) into v_assignment_reasoning from public.qualifying_assignment_mastery_evidence
  where topic_mastery_policy_id = v_policy.id and student_id = v_session.student_id
    and is_mathematical_reasoning_evidence and achievement >= v_policy.qualifying_assignment_minimum_achievement
    and v_policy.allow_qualifying_assignment_evidence;
  v_reasoning_count := v_reasoning_correct + v_assignment_reasoning;
  v_reasoning_achievement := case when v_reasoning_total + v_assignment_reasoning = 0 then null else round(((v_reasoning_correct + v_assignment_reasoning)::numeric / (v_reasoning_total + v_assignment_reasoning)) * 100, 2) end;

  if v_session.assessment_type = 'topic_baseline' then
    v_status := 'evidence_incomplete';
    v_reason_codes := array['BASELINE_PLACEMENT_EVIDENCE_ONLY'];
  else
    if v_overall < v_policy.overall_achievement_threshold then v_reason_codes := array_append(v_reason_codes, 'OVERALL_ACHIEVEMENT_BELOW_THRESHOLD'); end if;
    if v_critical_coverage < v_policy.critical_skill_coverage_threshold then v_reason_codes := array_append(v_reason_codes, 'CRITICAL_SKILL_COVERAGE_BELOW_THRESHOLD'); end if;
    if v_reasoning_count < v_policy.minimum_reasoning_evidence_count then v_reason_codes := array_append(v_reason_codes, 'MISSING_MATHEMATICAL_REASONING_EVIDENCE'); end if;
    if v_reasoning_achievement is null or v_reasoning_achievement < v_policy.minimum_reasoning_achievement_threshold then v_reason_codes := array_append(v_reason_codes, 'MATHEMATICAL_REASONING_ACHIEVEMENT_BELOW_THRESHOLD'); end if;
    v_status := case when cardinality(v_reason_codes) = 0 then 'mastered' else 'not_yet_mastered' end;
  end if;

  insert into public.topic_mastery_evaluations (
    student_id, curriculum_topic_id, curriculum_version_id, topic_mastery_policy_id, policy_version,
    assessment_session_id, assessment_type, overall_achievement, critical_skill_coverage,
    reasoning_achievement, reasoning_evidence_count, status, reason_codes
  ) values (
    v_session.student_id, v_session.curriculum_topic_id, v_session.curriculum_version_id, v_policy.id, v_policy.version,
    v_session.id, v_session.assessment_type, v_overall, v_critical_coverage,
    v_reasoning_achievement, v_reasoning_count, v_status, v_reason_codes
  ) returning id into v_evaluation_id;

  insert into public.topic_mastery_evaluation_evidence(topic_mastery_evaluation_id, learning_assessment_session_question_result_id)
  select v_evaluation_id, id from public.learning_assessment_session_question_results where learning_assessment_session_id = p_session_id;
  insert into public.topic_mastery_evaluation_evidence(topic_mastery_evaluation_id, qualifying_assignment_mastery_evidence_id)
  select v_evaluation_id, assignment_evidence.id from public.qualifying_assignment_mastery_evidence assignment_evidence
  where assignment_evidence.topic_mastery_policy_id = v_policy.id and assignment_evidence.student_id = v_session.student_id and v_policy.allow_qualifying_assignment_evidence;

  select skill.skill_code into v_focus_skill
  from public.topic_mastery_policy_skills policy_skill
  join public.curriculum_skills skill on skill.id = policy_skill.skill_id
  where policy_skill.topic_mastery_policy_id = v_policy.id and policy_skill.is_critical
    and not exists (select 1 from public.learning_assessment_session_question_results result where result.learning_assessment_session_id = p_session_id and result.skill_id = policy_skill.skill_id and result.is_correct)
  order by skill.skill_code limit 1;

  update public.learning_assessment_sessions set learner_recommendation = jsonb_build_object(
    'nextStep', case
      when v_status = 'mastered' then 'advance_to_dependent_topic'
      when v_session.assessment_type = 'topic_baseline' and v_overall >= v_policy.strong_baseline_threshold and v_critical_coverage >= v_policy.critical_skill_coverage_threshold and v_reasoning_count >= v_policy.minimum_reasoning_evidence_count and coalesce(v_reasoning_achievement, 0) >= v_policy.minimum_reasoning_achievement_threshold then 'offer_mastery_challenge'
      when v_reasoning_count < v_policy.minimum_reasoning_evidence_count or coalesce(v_reasoning_achievement, 0) < v_policy.minimum_reasoning_achievement_threshold then 'targeted_mathematical_reasoning_practice'
      else 'targeted_remediation'
    end,
    'focusSkillCode', v_focus_skill,
    'reasonCodes', to_jsonb(v_reason_codes)
  ) where id = p_session_id;
  return v_evaluation_id;
end;
$$;

-- A definition remains the editable draft. Publishing captures every learner-safe
-- field into a new immutable form version, so later edits cannot change a live
-- or historical session.
create or replace function public.publish_learning_assessment_form(p_assessment_definition_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_definition public.learning_assessment_definitions;
  v_form_id uuid;
  v_next_version integer;
  v_question_count integer;
  v_reasoning_count integer;
  v_required_reasoning integer;
  v_missing_critical integer;
begin
  perform public.content_admin_required();
  select * into v_definition from public.learning_assessment_definitions where id = p_assessment_definition_id for update;
  if not found then raise exception 'learning_assessment_definition_not_found' using errcode = 'P0002'; end if;
  if v_definition.review_status <> 'approved' then raise exception 'learning_assessment_definition_must_be_approved_before_publish' using errcode = '23514'; end if;
  if v_definition.topic_mastery_policy_id is not null and not exists (
    select 1 from public.topic_mastery_policies policy where policy.id = v_definition.topic_mastery_policy_id and policy.review_status = 'approved'
  ) then raise exception 'learning_assessment_requires_approved_topic_mastery_policy' using errcode = '23514'; end if;
  select count(*) into v_question_count from public.learning_assessment_definition_questions where learning_assessment_definition_id = v_definition.id;
  if v_question_count = 0 then raise exception 'learning_assessment_requires_question' using errcode = '23514'; end if;
  if exists (
    select 1 from public.learning_assessment_definition_questions link
    join public.question_versions version on version.id = link.question_version_id
    join public.question_items item on item.id = version.question_item_id
    where link.learning_assessment_definition_id = v_definition.id
      and (version.review_status <> 'approved' or item.retired_at is not null or version.answer_config->>'type' <> 'multiple_choice' or cardinality(public.validate_learning_answer_config(version.answer_config)) > 0)
  ) then raise exception 'learning_assessment_requires_approved_valid_multiple_choice_questions' using errcode = '23514'; end if;
  if v_definition.topic_mastery_policy_id is not null then
    select minimum_reasoning_evidence_count into v_required_reasoning from public.topic_mastery_policies where id = v_definition.topic_mastery_policy_id;
    select count(*) into v_reasoning_count from public.learning_assessment_definition_questions link join public.question_versions version on version.id = link.question_version_id where link.learning_assessment_definition_id = v_definition.id and version.reasoning_classification = 'mathematical_reasoning';
    if v_reasoning_count < v_required_reasoning then raise exception 'learning_assessment_missing_required_reasoning_coverage' using errcode = '23514'; end if;
    select count(*) into v_missing_critical from public.topic_mastery_policy_skills policy_skill
    where policy_skill.topic_mastery_policy_id = v_definition.topic_mastery_policy_id and policy_skill.is_critical
      and not exists (select 1 from public.learning_assessment_definition_questions link join public.question_version_skill_links skill_link on skill_link.question_version_id = link.question_version_id and skill_link.relationship_type = 'primary' where link.learning_assessment_definition_id = v_definition.id and skill_link.skill_id = policy_skill.skill_id);
    if v_missing_critical > 0 then raise exception 'learning_assessment_missing_critical_skill_coverage' using errcode = '23514'; end if;
  end if;
  if exists (
    select 1 from public.learning_assessment_form_versions form
    join public.learning_assessment_form_questions form_question on form_question.learning_assessment_form_version_id = form.id
    where form.review_status = 'approved' and form.retired_at is null and form.learning_assessment_definition_id <> v_definition.id
    group by form.id
    having count(*) filter (where form_question.question_version_id in (select question_version_id from public.learning_assessment_definition_questions where learning_assessment_definition_id = v_definition.id)) * 2 > least(count(*), v_question_count)
  ) then raise exception 'learning_assessment_form_not_sufficiently_independent' using errcode = '23514'; end if;
  select coalesce(max(form_version), 0) + 1 into v_next_version from public.learning_assessment_form_versions where learning_assessment_definition_id = v_definition.id;
  insert into public.learning_assessment_form_versions(learning_assessment_definition_id, topic_mastery_policy_id, form_version, review_status, duration_minutes, question_order_mode, solution_release_policy, blueprint_snapshot, published_by, published_at)
  values (v_definition.id, v_definition.topic_mastery_policy_id, v_next_version, 'approved', v_definition.duration_minutes, v_definition.question_order_mode, v_definition.solution_release_policy, jsonb_build_object('questionCount', v_question_count, 'assessmentType', v_definition.assessment_type, 'durationMinutes', v_definition.duration_minutes), public.current_profile_id(), now()) returning id into v_form_id;
  insert into public.learning_assessment_form_questions(learning_assessment_form_version_id, question_version_id, primary_skill_id, sequence_number, prompt_snapshot, options_snapshot, marks_snapshot, reasoning_classification)
  select v_form_id, link.question_version_id, skill_link.skill_id, link.display_order, version.prompt, version.answer_config->'options', version.marks, version.reasoning_classification
  from public.learning_assessment_definition_questions link
  join public.question_versions version on version.id = link.question_version_id
  join public.question_version_skill_links skill_link on skill_link.question_version_id = version.id and skill_link.relationship_type = 'primary'
  where link.learning_assessment_definition_id = v_definition.id order by link.display_order;
  perform public.log_audit_event('learning_assessment.form_published', 'learning_assessment_form_version', v_form_id::text, jsonb_build_object('assessment_definition_id', v_definition.id, 'form_version', v_next_version));
  return v_form_id;
end;
$$;

-- A published form cannot be edited in place. This clones its editable
-- definition and question selection into a new review-gated draft while all
-- historical sessions continue to reference the original immutable form.
create or replace function public.create_learning_assessment_revision(
  p_assessment_definition_id uuid,
  p_code text,
  p_form_code text,
  p_name text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_source public.learning_assessment_definitions; v_revision_id uuid;
begin
  perform public.content_admin_required();
  if nullif(btrim(coalesce(p_code, '')), '') is null or nullif(btrim(coalesce(p_form_code, '')), '') is null or nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'assessment_revision_code_form_code_and_name_required' using errcode = '23514';
  end if;
  select * into v_source from public.learning_assessment_definitions where id = p_assessment_definition_id for share;
  if not found then raise exception 'learning_assessment_not_found' using errcode = 'P0002'; end if;
  insert into public.learning_assessment_definitions(
    curriculum_version_id, curriculum_topic_id, topic_mastery_policy_id, code, form_code, name,
    assessment_type, description, duration_minutes, scored_attempts_per_question,
    question_order_mode, solution_release_policy, created_by
  ) values (
    v_source.curriculum_version_id, v_source.curriculum_topic_id, v_source.topic_mastery_policy_id,
    p_code, p_form_code, p_name, v_source.assessment_type, v_source.description,
    v_source.duration_minutes, 1, v_source.question_order_mode, v_source.solution_release_policy,
    public.current_profile_id()
  ) returning id into v_revision_id;
  insert into public.learning_assessment_definition_questions(learning_assessment_definition_id, question_version_id, display_order)
  select v_revision_id, question_version_id, display_order
  from public.learning_assessment_definition_questions
  where learning_assessment_definition_id = v_source.id
  order by display_order;
  perform public.log_audit_event('learning_configuration.assessment_revision_created', 'learning_assessment_definition', v_revision_id::text, jsonb_build_object('source_assessment_definition_id', v_source.id));
  return v_revision_id;
end;
$$;

-- Policies follow the same immutable-version rule. The replacement approval
-- retires the old active version atomically, leaving all session snapshots and
-- evaluation history intact.
create or replace function public.create_topic_mastery_policy_revision(p_policy_id uuid, p_name text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_source public.topic_mastery_policies; v_revision_id uuid; v_next_version integer;
begin
  perform public.content_admin_required();
  select * into v_source from public.topic_mastery_policies where id = p_policy_id for share;
  if not found then raise exception 'topic_mastery_policy_not_found' using errcode = 'P0002'; end if;
  select coalesce(max(version), 0) + 1 into v_next_version from public.topic_mastery_policies where curriculum_topic_id = v_source.curriculum_topic_id and code = v_source.code;
  insert into public.topic_mastery_policies(
    curriculum_topic_id, code, version, name, overall_achievement_threshold,
    critical_skill_coverage_threshold, minimum_reasoning_evidence_count,
    minimum_reasoning_achievement_threshold, strong_baseline_threshold,
    requires_mastery_challenge, formal_scored_attempts_per_question,
    practice_attempts_per_question, allow_qualifying_assignment_evidence,
    qualifying_assignment_minimum_achievement, created_by
  ) values (
    v_source.curriculum_topic_id, v_source.code, v_next_version,
    coalesce(nullif(btrim(p_name), ''), v_source.name || ' v' || v_next_version),
    v_source.overall_achievement_threshold, v_source.critical_skill_coverage_threshold,
    v_source.minimum_reasoning_evidence_count, v_source.minimum_reasoning_achievement_threshold,
    v_source.strong_baseline_threshold, v_source.requires_mastery_challenge, 1, 3,
    v_source.allow_qualifying_assignment_evidence, v_source.qualifying_assignment_minimum_achievement,
    public.current_profile_id()
  ) returning id into v_revision_id;
  insert into public.topic_mastery_policy_skills(topic_mastery_policy_id, skill_id, is_essential, is_critical, requires_reasoning_evidence)
  select v_revision_id, skill_id, is_essential, is_critical, requires_reasoning_evidence
  from public.topic_mastery_policy_skills where topic_mastery_policy_id = v_source.id;
  perform public.log_audit_event('learning_configuration.topic_mastery_policy_revision_created', 'topic_mastery_policy', v_revision_id::text, jsonb_build_object('source_policy_id', v_source.id));
  return v_revision_id;
end;
$$;

create or replace function public.approve_topic_mastery_policy_revision(p_policy_id uuid, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_candidate public.topic_mastery_policies; v_current_id uuid;
begin
  perform public.content_admin_required();
  select * into v_candidate from public.topic_mastery_policies where id = p_policy_id for update;
  if not found then raise exception 'topic_mastery_policy_not_found' using errcode = 'P0002'; end if;
  if v_candidate.review_status <> 'in_review' then raise exception 'topic_mastery_policy_revision_must_be_in_review' using errcode = '23514'; end if;
  if not exists (select 1 from public.topic_mastery_policy_skills where topic_mastery_policy_id = p_policy_id and is_essential) then raise exception 'topic_mastery_policy_requires_essential_skill' using errcode = '23514'; end if;
  if not exists (select 1 from public.topic_mastery_policy_skills where topic_mastery_policy_id = p_policy_id and is_critical) then raise exception 'topic_mastery_policy_requires_critical_skill' using errcode = '23514'; end if;
  select id into v_current_id from public.topic_mastery_policies where curriculum_topic_id = v_candidate.curriculum_topic_id and review_status = 'approved' for update;
  if v_current_id is not null then
    update public.topic_mastery_policies set review_status = 'retired', reviewed_by = public.current_profile_id(), reviewed_at = now(), review_notes = coalesce(nullif(btrim(p_notes), ''), 'Superseded by policy revision ' || v_candidate.version), updated_at = now() where id = v_current_id;
  end if;
  update public.topic_mastery_policies set review_status = 'approved', reviewed_by = public.current_profile_id(), reviewed_at = now(), review_notes = p_notes, updated_at = now() where id = p_policy_id;
  perform public.log_audit_event('learning_configuration.topic_mastery_policy_revision_approved', 'topic_mastery_policy', p_policy_id::text, jsonb_build_object('retired_policy_id', v_current_id));
end;
$$;

create or replace function public.extend_learning_assessment_session(
  p_session_id uuid,
  p_added_minutes smallint,
  p_reason text
)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_session public.learning_assessment_sessions; v_new_expiry timestamptz;
begin
  perform public.content_admin_required();
  if p_added_minutes is null or p_added_minutes not between 1 and 180 or nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'assessment_extension_minutes_and_reason_required' using errcode = '23514';
  end if;
  select * into v_session from public.learning_assessment_sessions where id = p_session_id for update;
  if not found then raise exception 'learning_assessment_session_not_found' using errcode = 'P0002'; end if;
  if v_session.status <> 'in_progress' or now() >= v_session.expires_at then raise exception 'only_active_unexpired_assessment_sessions_may_be_extended' using errcode = '23514'; end if;
  v_new_expiry := v_session.expires_at + make_interval(mins => p_added_minutes);
  update public.learning_assessment_sessions set expires_at = v_new_expiry where id = v_session.id;
  insert into public.learning_assessment_session_extensions(learning_assessment_session_id, previous_expires_at, extended_expires_at, added_minutes, reason, authorised_by)
  values (v_session.id, v_session.expires_at, v_new_expiry, p_added_minutes, p_reason, public.current_profile_id());
  perform public.log_audit_event('learning_assessment.session_extended', 'learning_assessment_session', v_session.id::text, jsonb_build_object('added_minutes', p_added_minutes, 'reason', p_reason, 'previous_expires_at', v_session.expires_at, 'extended_expires_at', v_new_expiry));
  return v_new_expiry;
end;
$$;

create or replace function public.release_learning_assessment_form_solutions(
  p_learning_assessment_form_version_id uuid,
  p_reason text
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_policy text;
begin
  perform public.content_admin_required();
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'assessment_solution_release_reason_required' using errcode = '23514'; end if;
  select solution_release_policy into v_policy from public.learning_assessment_form_versions where id = p_learning_assessment_form_version_id;
  if not found then raise exception 'learning_assessment_form_not_found' using errcode = 'P0002'; end if;
  if v_policy <> 'manual' then raise exception 'assessment_form_does_not_use_manual_solution_release' using errcode = '23514'; end if;
  insert into public.learning_assessment_form_solution_releases(learning_assessment_form_version_id, released_by, reason)
  values (p_learning_assessment_form_version_id, public.current_profile_id(), p_reason)
  on conflict (learning_assessment_form_version_id) do nothing;
  perform public.log_audit_event('learning_assessment.form_solutions_released', 'learning_assessment_form_version', p_learning_assessment_form_version_id::text, jsonb_build_object('reason', p_reason));
end;
$$;

-- Eligibility deliberately treats absent prerequisite evidence as unknown, not
-- as a failed prerequisite. A learner may always establish a topic baseline;
-- an endline follows that baseline and a challenge follows strong baseline
-- evidence. A mastered topic is not offered another mastery route.
create or replace function public.learning_assessment_eligibility(
  p_student_id uuid,
  p_assessment_definition_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_definition public.learning_assessment_definitions;
  v_baseline_next_step text;
begin
  select * into v_definition from public.learning_assessment_definitions where id = p_assessment_definition_id;
  if not found then return jsonb_build_object('eligible', false, 'reasonCode', 'ASSESSMENT_UNAVAILABLE'); end if;
  if v_definition.assessment_type in ('entry_baseline', 'topic_baseline') then
    return jsonb_build_object('eligible', true, 'reasonCode', 'BASELINE_AVAILABLE');
  end if;
  if exists (
    select 1 from public.topic_mastery_evaluations evaluation
    where evaluation.student_id = p_student_id and evaluation.curriculum_topic_id = v_definition.curriculum_topic_id and evaluation.status = 'mastered'
  ) then return jsonb_build_object('eligible', false, 'reasonCode', 'TOPIC_ALREADY_MASTERED'); end if;
  select session.learner_recommendation->>'nextStep' into v_baseline_next_step
  from public.topic_mastery_evaluations evaluation
  join public.learning_assessment_sessions session on session.id = evaluation.assessment_session_id
  where evaluation.student_id = p_student_id
    and evaluation.curriculum_topic_id = v_definition.curriculum_topic_id
    and evaluation.topic_mastery_policy_id = v_definition.topic_mastery_policy_id
    and evaluation.assessment_type = 'topic_baseline'
  order by evaluation.determined_at desc
  limit 1;
  if v_definition.assessment_type = 'endline' then
    return jsonb_build_object('eligible', v_baseline_next_step is not null, 'reasonCode', case when v_baseline_next_step is null then 'TOPIC_BASELINE_REQUIRED' else 'BASELINE_COMPLETE' end);
  end if;
  return jsonb_build_object('eligible', v_baseline_next_step = 'offer_mastery_challenge', 'reasonCode', case when v_baseline_next_step = 'offer_mastery_challenge' then 'STRONG_BASELINE_CHALLENGE_AVAILABLE' else 'STRONG_BASELINE_REQUIRED' end);
end;
$$;

create or replace function public.get_my_available_learning_assessments()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if public.current_profile_role() <> 'student' or public.current_student_id() is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'definitionId', definition.id, 'formVersionId', form.id, 'name', definition.name,
      'assessmentType', definition.assessment_type, 'topicCode', topic.code, 'topicName', topic.name,
      'durationMinutes', form.duration_minutes, 'questionCount', form.blueprint_snapshot->>'questionCount',
      'eligibilityReason', eligibility.payload->>'reasonCode'
    ) order by topic.display_order nulls first, definition.name)
    from public.learning_assessment_form_versions form
    join public.learning_assessment_definitions definition on definition.id = form.learning_assessment_definition_id
    left join public.curriculum_topics topic on topic.id = definition.curriculum_topic_id
    cross join lateral (select public.learning_assessment_eligibility(public.current_student_id(), definition.id) as payload) eligibility
    where form.review_status = 'approved' and form.retired_at is null and definition.review_status = 'approved'
      and (form.topic_mastery_policy_id is null or exists (select 1 from public.topic_mastery_policies policy where policy.id = form.topic_mastery_policy_id and policy.review_status = 'approved'))
      and coalesce((eligibility.payload->>'eligible')::boolean, false)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.start_my_learning_assessment(p_assessment_definition_id uuid, p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_student_id uuid := public.current_student_id();
  v_existing uuid;
  v_definition public.learning_assessment_definitions;
  v_form public.learning_assessment_form_versions;
  v_session_id uuid;
  v_policy_snapshot jsonb := '{}'::jsonb;
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_student_id::text || ':' || p_assessment_definition_id::text, 0));
  select id into v_existing from public.learning_assessment_sessions where student_id = v_student_id and start_idempotency_key = p_idempotency_key;
  if v_existing is not null then
    if exists (select 1 from public.learning_assessment_sessions where id = v_existing and learning_assessment_definition_id = p_assessment_definition_id) then return v_existing; end if;
    raise exception 'assessment_start_idempotency_key_reused_with_different_definition' using errcode = '23505';
  end if;
  select id into v_existing from public.learning_assessment_sessions where student_id = v_student_id and learning_assessment_definition_id = p_assessment_definition_id and status = 'in_progress' for update;
  if v_existing is not null then return v_existing; end if;
  select * into v_definition from public.learning_assessment_definitions where id = p_assessment_definition_id and review_status = 'approved';
  if not found then raise exception 'learning_assessment_unavailable' using errcode = 'P0002'; end if;
  if not coalesce((public.learning_assessment_eligibility(v_student_id, v_definition.id)->>'eligible')::boolean, false) then
    raise exception 'learning_assessment_not_eligible:%', public.learning_assessment_eligibility(v_student_id, v_definition.id)->>'reasonCode' using errcode = '23514';
  end if;
  select * into v_form from public.learning_assessment_form_versions where learning_assessment_definition_id = v_definition.id and review_status = 'approved' and retired_at is null order by form_version desc limit 1;
  if not found then raise exception 'learning_assessment_has_no_published_form' using errcode = '23514'; end if;
  if v_form.topic_mastery_policy_id is not null and not exists (select 1 from public.topic_mastery_policies policy where policy.id = v_form.topic_mastery_policy_id and policy.review_status = 'approved') then
    raise exception 'learning_assessment_policy_has_been_superseded' using errcode = '23514';
  end if;
  if v_form.topic_mastery_policy_id is not null then
    select jsonb_build_object(
      'policyId', policy.id, 'version', policy.version,
      'overallAchievementThreshold', policy.overall_achievement_threshold,
      'criticalSkillCoverageThreshold', policy.critical_skill_coverage_threshold,
      'minimumReasoningEvidenceCount', policy.minimum_reasoning_evidence_count,
      'minimumReasoningAchievementThreshold', policy.minimum_reasoning_achievement_threshold,
      'strongBaselineThreshold', policy.strong_baseline_threshold,
      'requiresMasteryChallenge', policy.requires_mastery_challenge,
      'allowQualifyingAssignmentEvidence', policy.allow_qualifying_assignment_evidence,
      'qualifyingAssignmentMinimumAchievement', policy.qualifying_assignment_minimum_achievement,
      'skills', coalesce((select jsonb_agg(jsonb_build_object('skillId', policy_skill.skill_id, 'isEssential', policy_skill.is_essential, 'isCritical', policy_skill.is_critical, 'requiresReasoningEvidence', policy_skill.requires_reasoning_evidence) order by policy_skill.skill_id)
                           from public.topic_mastery_policy_skills policy_skill where policy_skill.topic_mastery_policy_id = policy.id), '[]'::jsonb)
    ) into v_policy_snapshot
    from public.topic_mastery_policies policy
    where policy.id = v_form.topic_mastery_policy_id;
    if v_policy_snapshot is null then raise exception 'learning_assessment_form_policy_missing' using errcode = '23514'; end if;
  end if;
  insert into public.learning_assessment_sessions(student_id, learning_assessment_definition_id, learning_assessment_form_version_id, curriculum_version_id, curriculum_topic_id, topic_mastery_policy_id, policy_snapshot, assessment_type, start_idempotency_key, started_at, expires_at, original_expires_at)
  values (v_student_id, v_definition.id, v_form.id, v_definition.curriculum_version_id, v_definition.curriculum_topic_id, v_form.topic_mastery_policy_id, v_policy_snapshot, v_definition.assessment_type, p_idempotency_key, now(), now() + make_interval(mins => v_form.duration_minutes), now() + make_interval(mins => v_form.duration_minutes)) returning id into v_session_id;
  insert into public.learning_assessment_session_questions(learning_assessment_session_id, question_version_id, primary_skill_id, sequence_number, prompt_snapshot, options_snapshot, marks_snapshot, reasoning_classification)
  select v_session_id, question.question_version_id, question.primary_skill_id,
    case when v_form.question_order_mode = 'session_shuffle' then row_number() over (order by md5(v_session_id::text || question.question_version_id::text)) else question.sequence_number end,
    question.prompt_snapshot, question.options_snapshot, question.marks_snapshot, question.reasoning_classification
  from public.learning_assessment_form_questions question where question.learning_assessment_form_version_id = v_form.id;
  perform public.log_audit_event('learning_assessment.session_started', 'learning_assessment_session', v_session_id::text, jsonb_build_object('assessment_definition_id', v_definition.id));
  return v_session_id;
end;
$$;

create or replace function public.save_my_learning_assessment_answer(
  p_session_id uuid,
  p_session_question_id uuid,
  p_selected_option text,
  p_idempotency_key uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_session public.learning_assessment_sessions;
  v_event public.learning_assessment_session_answer_events;
  v_event_id uuid := gen_random_uuid();
begin
  v_session := public.assert_learning_assessment_session_owner(p_session_id);
  if p_selected_option not in ('A', 'B', 'C', 'D') then raise exception 'assessment_answer_must_be_a_to_d' using errcode = '22023'; end if;
  if v_session.status <> 'in_progress' then raise exception 'assessment_session_not_in_progress' using errcode = '23514'; end if;
  if now() >= v_session.expires_at then
    perform public.finalize_learning_assessment_session(p_session_id, 'timed_out');
    raise exception 'assessment_session_expired' using errcode = '55000';
  end if;
  if not exists (select 1 from public.learning_assessment_session_questions where id = p_session_question_id and learning_assessment_session_id = p_session_id) then raise exception 'assessment_question_not_found' using errcode = 'P0002'; end if;
  select * into v_event from public.learning_assessment_session_answer_events where learning_assessment_session_id = p_session_id and idempotency_key = p_idempotency_key;
  if found then
    if v_event.learning_assessment_session_question_id <> p_session_question_id or v_event.selected_option <> p_selected_option then raise exception 'assessment_answer_idempotency_key_reused_with_different_payload' using errcode = '23505'; end if;
    return;
  end if;
  insert into public.learning_assessment_session_answer_events(id, learning_assessment_session_id, learning_assessment_session_question_id, selected_option, idempotency_key) values (v_event_id, p_session_id, p_session_question_id, p_selected_option, p_idempotency_key);
  insert into public.learning_assessment_session_answers(learning_assessment_session_question_id, selected_option, revision_number, last_event_id)
  values (p_session_question_id, p_selected_option, 1, v_event_id)
  on conflict (learning_assessment_session_question_id) do update set selected_option = excluded.selected_option, revision_number = public.learning_assessment_session_answers.revision_number + 1, last_event_id = excluded.last_event_id, updated_at = now();
end;
$$;

create or replace function public.submit_my_learning_assessment(p_session_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_session public.learning_assessment_sessions;
begin
  v_session := public.assert_learning_assessment_session_owner(p_session_id);
  if v_session.status in ('submitted', 'timed_out') then return v_session.id; end if;
  if v_session.status <> 'in_progress' then raise exception 'assessment_session_not_submittable' using errcode = '23514'; end if;
  return public.finalize_learning_assessment_session(p_session_id, 'submitted');
end;
$$;

create or replace function public.get_my_learning_assessment_session(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_session public.learning_assessment_sessions;
begin
  v_session := public.assert_learning_assessment_session_owner(p_session_id);
  if v_session.status = 'in_progress' and now() >= v_session.expires_at then
    perform public.finalize_learning_assessment_session(p_session_id, 'timed_out');
    select * into v_session from public.learning_assessment_sessions where id = p_session_id;
  end if;
  return jsonb_build_object(
    'sessionId', v_session.id,
    'status', v_session.status,
    'startedAt', v_session.started_at,
    'expiresAt', v_session.expires_at,
    'serverNow', now(),
    'assessment', (select jsonb_build_object('name', definition.name, 'assessmentType', definition.assessment_type, 'topicCode', topic.code, 'topicName', topic.name, 'durationMinutes', form.duration_minutes) from public.learning_assessment_definitions definition join public.learning_assessment_form_versions form on form.id = v_session.learning_assessment_form_version_id left join public.curriculum_topics topic on topic.id = definition.curriculum_topic_id where definition.id = v_session.learning_assessment_definition_id),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('sessionQuestionId', question.id, 'sequenceNumber', question.sequence_number, 'prompt', question.prompt_snapshot, 'options', question.options_snapshot, 'selectedOption', answer.selected_option) order by question.sequence_number) from public.learning_assessment_session_questions question left join public.learning_assessment_session_answers answer on answer.learning_assessment_session_question_id = question.id where question.learning_assessment_session_id = v_session.id), '[]'::jsonb),
    'result', case when v_session.status in ('submitted', 'timed_out') then jsonb_build_object(
      'rawScore', v_session.raw_score, 'totalMarks', v_session.total_marks, 'percentage', v_session.percentage,
      'recommendation', v_session.learner_recommendation,
      'topicMastery', (select jsonb_build_object('status', evaluation.status, 'reasonCodes', evaluation.reason_codes, 'criticalSkillCoverage', evaluation.critical_skill_coverage, 'reasoningAchievement', evaluation.reasoning_achievement, 'reasoningEvidenceCount', evaluation.reasoning_evidence_count) from public.topic_mastery_evaluations evaluation where evaluation.assessment_session_id = v_session.id),
      'skillBreakdown', coalesce((select jsonb_agg(jsonb_build_object('skillCode', skill.skill_code, 'skillName', skill.title, 'correct', result.is_correct_count, 'total', result.question_count, 'percentage', round((result.is_correct_count::numeric / nullif(result.question_count, 0)) * 100, 2)) order by skill.skill_code)
        from (
          select skill_id, count(*) filter (where is_correct) as is_correct_count, count(*) as question_count
          from public.learning_assessment_session_question_results where learning_assessment_session_id = v_session.id group by skill_id
        ) result join public.curriculum_skills skill on skill.id = result.skill_id), '[]'::jsonb),
      'questionFeedback', case when (select form.solution_release_policy from public.learning_assessment_form_versions form where form.id = v_session.learning_assessment_form_version_id) = 'after_submission'
        or exists (select 1 from public.learning_assessment_form_solution_releases release where release.learning_assessment_form_version_id = v_session.learning_assessment_form_version_id) then coalesce((
        select jsonb_agg(jsonb_build_object(
          'sessionQuestionId', result.learning_assessment_session_question_id,
          'selectedOption', result.selected_option,
          'isCorrect', result.is_correct,
          'correctOption', version.answer_config->>'correct_option',
          'distractorExplanation', case when result.is_correct then null else version.answer_config->'distractor_explanations'->>result.selected_option end,
          'workedSolution', version.solution
        ) order by question.sequence_number)
        from public.learning_assessment_session_question_results result
        join public.learning_assessment_session_questions question on question.id = result.learning_assessment_session_question_id
        join public.question_versions version on version.id = question.question_version_id
        where result.learning_assessment_session_id = v_session.id
      ), '[]'::jsonb) else '[]'::jsonb end
    ) else null end
  );
end;
$$;

create or replace function public.get_learning_assessment_management_catalog()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.content_admin_required();
  return jsonb_build_object(
    'definitions', coalesce((select jsonb_agg(jsonb_build_object('id', definition.id, 'code', definition.code, 'formCode', definition.form_code, 'name', definition.name, 'description', definition.description, 'curriculumVersionId', definition.curriculum_version_id, 'topicId', definition.curriculum_topic_id, 'topicName', topic.name, 'topicMasteryPolicyId', definition.topic_mastery_policy_id, 'assessmentType', definition.assessment_type, 'durationMinutes', definition.duration_minutes, 'questionOrderMode', definition.question_order_mode, 'solutionReleasePolicy', definition.solution_release_policy, 'reviewStatus', definition.review_status, 'questionVersionIds', coalesce((select jsonb_agg(question.question_version_id order by question.display_order) from public.learning_assessment_definition_questions question where question.learning_assessment_definition_id = definition.id), '[]'::jsonb), 'questionCount', (select count(*) from public.learning_assessment_definition_questions question where question.learning_assessment_definition_id = definition.id), 'publishedFormVersion', (select form.form_version from public.learning_assessment_form_versions form where form.learning_assessment_definition_id = definition.id and form.review_status = 'approved' and form.retired_at is null order by form.form_version desc limit 1)) order by definition.updated_at desc) from public.learning_assessment_definitions definition left join public.curriculum_topics topic on topic.id = definition.curriculum_topic_id), '[]'::jsonb),
    'policies', coalesce((select jsonb_agg(jsonb_build_object('id', policy.id, 'curriculumTopicId', policy.curriculum_topic_id, 'code', policy.code, 'name', policy.name, 'version', policy.version, 'reviewStatus', policy.review_status, 'overallAchievementThreshold', policy.overall_achievement_threshold, 'criticalSkillCoverageThreshold', policy.critical_skill_coverage_threshold, 'minimumReasoningEvidenceCount', policy.minimum_reasoning_evidence_count, 'minimumReasoningAchievementThreshold', policy.minimum_reasoning_achievement_threshold, 'strongBaselineThreshold', policy.strong_baseline_threshold, 'requiresMasteryChallenge', policy.requires_mastery_challenge, 'allowQualifyingAssignmentEvidence', policy.allow_qualifying_assignment_evidence, 'qualifyingAssignmentMinimumAchievement', policy.qualifying_assignment_minimum_achievement, 'skills', coalesce((select jsonb_agg(jsonb_build_object('skillId', policy_skill.skill_id, 'skillCode', skill.skill_code, 'isEssential', policy_skill.is_essential, 'isCritical', policy_skill.is_critical, 'requiresReasoningEvidence', policy_skill.requires_reasoning_evidence) order by skill.skill_code) from public.topic_mastery_policy_skills policy_skill join public.curriculum_skills skill on skill.id = policy_skill.skill_id where policy_skill.topic_mastery_policy_id = policy.id), '[]'::jsonb)) order by policy.code, policy.version) from public.topic_mastery_policies policy), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', version.id, 'itemCode', item.item_code, 'prompt', version.prompt, 'skillCode', skill.skill_code, 'difficulty', version.difficulty, 'reasoningClassification', version.reasoning_classification) order by item.item_code) from public.question_versions version join public.question_items item on item.id = version.question_item_id join public.question_version_skill_links link on link.question_version_id = version.id and link.relationship_type = 'primary' join public.curriculum_skills skill on skill.id = link.skill_id where version.review_status = 'approved' and item.retired_at is null), '[]'::jsonb),
    'recentSessions', coalesce((select jsonb_agg(recent.payload order by recent.created_at desc) from (
      select session.created_at, jsonb_build_object('id', session.id, 'status', session.status, 'percentage', session.percentage, 'assessmentType', session.assessment_type, 'submittedAt', session.submitted_at, 'studentId', session.student_id, 'topicName', topic.name, 'formVersion', form.form_version, 'topicMasteryStatus', evaluation.status, 'criticalSkillCoverage', evaluation.critical_skill_coverage, 'reasoningAchievement', evaluation.reasoning_achievement) as payload
      from public.learning_assessment_sessions session
      join public.learning_assessment_form_versions form on form.id = session.learning_assessment_form_version_id
      left join public.curriculum_topics topic on topic.id = session.curriculum_topic_id
      left join public.topic_mastery_evaluations evaluation on evaluation.assessment_session_id = session.id
      order by session.created_at desc limit 50
    ) recent), '[]'::jsonb)
  );
end;
$$;

-- Carry the two Sprint 2 delivery settings through the existing admin-only
-- draft RPC rather than adding a second authoring pathway.
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
      assessment_type, description, duration_minutes, scored_attempts_per_question,
      question_order_mode, solution_release_policy, created_by
    ) values (
      (p_payload->>'curriculumVersionId')::uuid, nullif(p_payload->>'curriculumTopicId', '')::uuid,
      nullif(p_payload->>'topicMasteryPolicyId', '')::uuid, p_payload->>'code', p_payload->>'formCode',
      p_payload->>'name', p_payload->>'assessmentType', nullif(p_payload->>'description', ''),
      (p_payload->>'durationMinutes')::smallint, 1,
      coalesce(nullif(p_payload->>'questionOrderMode', ''), 'fixed'),
      coalesce(nullif(p_payload->>'solutionReleasePolicy', ''), 'after_submission'), public.current_profile_id()
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
      duration_minutes = (p_payload->>'durationMinutes')::smallint, scored_attempts_per_question = 1,
      question_order_mode = coalesce(nullif(p_payload->>'questionOrderMode', ''), 'fixed'),
      solution_release_policy = coalesce(nullif(p_payload->>'solutionReleasePolicy', ''), 'after_submission'),
      updated_at = now()
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

revoke all on function public.assert_learning_assessment_session_owner(uuid) from public, anon, authenticated;
revoke all on function public.finalize_learning_assessment_session(uuid, text) from public, anon, authenticated;
revoke all on function public.evaluate_topic_mastery_from_assessment_session(uuid) from public, anon, authenticated;
revoke all on function public.learning_assessment_eligibility(uuid, uuid) from public, anon, authenticated;
revoke all on function public.publish_learning_assessment_form(uuid) from public;
revoke all on function public.create_learning_assessment_revision(uuid, text, text, text) from public;
revoke all on function public.create_topic_mastery_policy_revision(uuid, text) from public;
revoke all on function public.approve_topic_mastery_policy_revision(uuid, text) from public;
revoke all on function public.extend_learning_assessment_session(uuid, smallint, text) from public;
revoke all on function public.release_learning_assessment_form_solutions(uuid, text) from public;
revoke all on function public.get_my_available_learning_assessments() from public;
revoke all on function public.start_my_learning_assessment(uuid, uuid) from public;
revoke all on function public.save_my_learning_assessment_answer(uuid, uuid, text, uuid) from public;
revoke all on function public.submit_my_learning_assessment(uuid) from public;
revoke all on function public.get_my_learning_assessment_session(uuid) from public;
revoke all on function public.get_learning_assessment_management_catalog() from public;
grant execute on function public.publish_learning_assessment_form(uuid) to authenticated;
grant execute on function public.create_learning_assessment_revision(uuid, text, text, text) to authenticated;
grant execute on function public.create_topic_mastery_policy_revision(uuid, text) to authenticated;
grant execute on function public.approve_topic_mastery_policy_revision(uuid, text) to authenticated;
grant execute on function public.extend_learning_assessment_session(uuid, smallint, text) to authenticated;
grant execute on function public.release_learning_assessment_form_solutions(uuid, text) to authenticated;
grant execute on function public.get_my_available_learning_assessments() to authenticated;
grant execute on function public.start_my_learning_assessment(uuid, uuid) to authenticated;
grant execute on function public.save_my_learning_assessment_answer(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.submit_my_learning_assessment(uuid) to authenticated;
grant execute on function public.get_my_learning_assessment_session(uuid) to authenticated;
grant execute on function public.get_learning_assessment_management_catalog() to authenticated;

comment on table public.learning_assessment_sessions is 'Server-authoritative, timed formal-assessment sessions. The browser never supplies marks or expiry.';
comment on table public.topic_mastery_evaluations is 'Append-only topic-level decisions with cited formal-session and explicitly qualified assignment evidence.';
