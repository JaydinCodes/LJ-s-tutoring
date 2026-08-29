-- Grade 9 pilot validation workflow. This is additive: it makes the existing
-- review states, approved-only delivery boundary and retry-safe evidence path
-- operational without changing historic curriculum or learner evidence.

create table public.question_review_events (
  id uuid primary key default gen_random_uuid(),
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  action text not null check (action in ('submitted_for_review', 'approved', 'rejected', 'returned_for_revision', 'retired')),
  from_status public.question_review_status not null,
  to_status public.question_review_status not null,
  reviewer_id uuid references public.profiles(id) on delete set null,
  review_notes text,
  created_at timestamptz not null default now()
);
create index question_review_events_version_created_idx on public.question_review_events(question_version_id, created_at desc);
alter table public.question_review_events enable row level security;
create policy "question_review_events_admin_read" on public.question_review_events for select to authenticated using (public.is_platform_admin());

-- A client request key turns mobile/network retries into one logical attempt.
-- Null remains supported for already-integrated internal callers, while the
-- learner runner must always provide a key.
alter table public.learning_attempts add column idempotency_key uuid;
create unique index learning_attempts_student_question_idempotency_key_idx
  on public.learning_attempts(student_id, question_version_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.validate_question_version_for_approval(p_question_version_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_errors text[] := '{}';
  v_type public.question_activity_type;
  v_answer jsonb;
  v_prompt text;
  v_solution text;
  v_marks numeric;
begin
  select version.activity_type, version.answer_config, version.prompt, version.solution, version.marks
    into v_type, v_answer, v_prompt, v_solution, v_marks
  from public.question_versions version
  join public.question_items item on item.id = version.question_item_id
  join public.curriculum_versions curriculum on curriculum.id = item.curriculum_version_id
  where version.id = p_question_version_id
  and curriculum.is_active is true
  and curriculum.valid_from <= current_date
  and (
    curriculum.valid_until is null
    or curriculum.valid_until >= current_date
  )
  and item.retired_at is null;

  if not found then return array['INACTIVE_OR_MISSING_CURRICULUM_VERSION']; end if;
  if not exists (
    select 1
    from public.question_version_skill_links link
    join public.curriculum_skills skill on skill.id = link.skill_id
    where link.question_version_id = p_question_version_id
      and link.relationship_type = 'primary'
      and skill.is_active
      
  ) then v_errors := array_append(v_errors, 'MISSING_OR_RETIRED_PRIMARY_SKILL'); end if;
  if jsonb_typeof(v_answer -> 'accepted_answers') <> 'array' or jsonb_array_length(coalesce(v_answer -> 'accepted_answers', '[]'::jsonb)) = 0 then
    v_errors := array_append(v_errors, 'MISSING_DETERMINISTIC_EXPECTED_ANSWER');
  end if;
  if nullif(btrim(coalesce(v_solution, '')), '') is null then v_errors := array_append(v_errors, 'MISSING_SOLUTION'); end if;
  if coalesce(v_marks, 0) <= 0 then v_errors := array_append(v_errors, 'INVALID_MARKS'); end if;
  if v_type = 'diagnostic' and jsonb_typeof(v_answer -> 'accepted_answers') <> 'array' then v_errors := array_append(v_errors, 'DIAGNOSTIC_REQUIRES_DETERMINISTIC_SCORING'); end if;
  if v_type = 'error_analysis' and coalesce(v_prompt, '') !~* '(error|incorrect|wrong|says|claims)' then v_errors := array_append(v_errors, 'ERROR_ANALYSIS_MISSING_ERROR_STIMULUS'); end if;
  if v_type = 'worked_example' and length(coalesce(v_solution, '')) < 20 then v_errors := array_append(v_errors, 'WORKED_EXAMPLE_REQUIRES_MODEL_SOLUTION'); end if;
  if v_type = 'faded_example' and coalesce(v_prompt, '') !~ '(_{2,}|\[blank\]|\.{3,})' then v_errors := array_append(v_errors, 'FADED_EXAMPLE_MISSING_LEARNER_STEP'); end if;
  if v_type = 'delayed_retention' and not exists (
    select 1 from public.question_version_skill_links link
    join public.skill_prerequisites edge on edge.skill_id = link.skill_id
    where link.question_version_id = p_question_version_id
  ) then v_errors := array_append(v_errors, 'DELAYED_RETRIEVAL_SKILL_NOT_IN_INSTRUCTIONAL_GRAPH'); end if;
  if exists (
    select 1 from public.question_hints hint
    where hint.question_version_id = p_question_version_id
    group by hint.question_version_id
    having min(hint.hint_level) <> 1
       or max(hint.hint_level) > 5
       or count(*) <> max(hint.hint_level)
       or count(*) <> count(distinct hint.hint_level)
  ) then v_errors := array_append(v_errors, 'INVALID_HINT_LADDER'); end if;
  return v_errors;
end;
$$;

create or replace function public.review_question_version_action(
  p_question_version_id uuid,
  p_action text,
  p_review_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from public.question_review_status;
  v_to public.question_review_status;
  v_errors text[];
begin
  if not public.is_platform_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select review_status into v_from from public.question_versions where id = p_question_version_id for update;
  if not found then raise exception 'question_version_not_found' using errcode = 'P0002'; end if;

  case p_action
    when 'submit_for_review' then
      if v_from not in ('draft', 'rejected') then raise exception 'invalid_review_transition:%->in_review', v_from using errcode = '23514'; end if;
      v_to := 'in_review';
    when 'approve' then
      if v_from <> 'in_review' then raise exception 'invalid_review_transition:%->approved', v_from using errcode = '23514'; end if;
      v_errors := public.validate_question_version_for_approval(p_question_version_id);
      if cardinality(v_errors) > 0 then raise exception 'question_version_content_validation_failed:%', array_to_string(v_errors, ',') using errcode = '23514'; end if;
      v_to := 'approved';
    when 'reject' then
      if v_from <> 'in_review' then raise exception 'invalid_review_transition:%->rejected', v_from using errcode = '23514'; end if;
      v_to := 'rejected';
    when 'return_for_revision' then
      if v_from <> 'in_review' then raise exception 'invalid_review_transition:%->draft', v_from using errcode = '23514'; end if;
      v_to := 'draft';
    when 'retire' then
      if v_from <> 'approved' then raise exception 'invalid_review_transition:%->retired', v_from using errcode = '23514'; end if;
      v_to := 'retired';
    else raise exception 'invalid_review_action' using errcode = '23514';
  end case;

  update public.question_versions
  set review_status = v_to,
      reviewed_by = public.current_profile_id(),
      reviewed_at = now(),
      review_notes = p_review_notes
  where id = p_question_version_id;

  insert into public.question_review_events (question_version_id, action, from_status, to_status, reviewer_id, review_notes)
  values (
    p_question_version_id,
    case p_action
      when 'submit_for_review' then 'submitted_for_review'
      when 'approve' then 'approved'
      when 'reject' then 'rejected'
      when 'return_for_revision' then 'returned_for_revision'
      else 'retired'
    end,
    v_from, v_to, public.current_profile_id(), p_review_notes
  );
  perform public.log_audit_event('question_version.reviewed', 'question_version', p_question_version_id::text, jsonb_build_object('action', p_action, 'from_status', v_from, 'to_status', v_to));
end;
$$;

-- Keep the established RPC name as a safe compatibility adapter. New reviewer
-- clients use the action RPC to express a return-for-revision decision.
create or replace function public.review_question_version(p_question_version_id uuid, p_status public.question_review_status, p_review_notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'not_authorized_or_invalid_review_transition' using errcode = '42501'; end if;
  case p_status
    when 'in_review' then perform public.review_question_version_action(p_question_version_id, 'submit_for_review', p_review_notes);
    when 'approved' then perform public.review_question_version_action(p_question_version_id, 'approve', p_review_notes);
    when 'rejected' then perform public.review_question_version_action(p_question_version_id, 'reject', p_review_notes);
    when 'retired' then perform public.review_question_version_action(p_question_version_id, 'retire', p_review_notes);
    else raise exception 'use_review_question_version_action_for_return_for_revision' using errcode = '23514';
  end case;
end;
$$;

-- The learner payload deliberately excludes answers and memos, and cannot
-- retrieve content that has been retired or disconnected from active CAPS.
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
  join public.question_items item on item.id = qv.question_item_id and item.retired_at is null
  join public.curriculum_versions curriculum
  on curriculum.id = item.curriculum_version_id
  and curriculum.is_active
  and curriculum.valid_from <= current_date
  and (
    curriculum.valid_until is null
    or curriculum.valid_until >= current_date
  )
  left join public.question_hints h on h.question_version_id = qv.id
  where qv.id = p_question_version_id
    and qv.review_status = 'approved'
    and exists (
  select 1
  from public.question_version_skill_links link
  join public.curriculum_skills skill on skill.id = link.skill_id
  where link.question_version_id = qv.id
    and link.relationship_type = 'primary'
    and skill.is_active
)
  group by qv.id;
end;
$$;

-- Replace the original RPC with a compatible optional request id. A repeated
-- request id returns the original logical attempt and cannot inflate mastery.
drop function public.record_learning_attempt(uuid, uuid, jsonb, smallint, integer, uuid, uuid, public.evidence_context);
create function public.record_learning_attempt(
  p_student_id uuid, p_question_version_id uuid, p_response jsonb,
  p_confidence smallint default null, p_time_spent_seconds integer default null,
  p_session_id uuid default null, p_source_submission_id uuid default null,
  p_evidence_context public.evidence_context default 'formative',
  p_idempotency_key uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt_id uuid;
  v_attempt_number integer;
  v_role public.user_role;
  v_existing_response jsonb;
begin
  v_role := public.current_profile_role();
  if v_role not in ('student', 'tutor', 'admin') or not public.can_access_learning_student(p_student_id) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if v_role = 'student' and p_student_id <> public.current_student_id() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if not exists (
    select 1
    from public.question_versions version
    join public.question_items item on item.id = version.question_item_id and item.retired_at is null
    join public.curriculum_versions curriculum on curriculum.id = item.curriculum_version_id and curriculum.is_active
    where version.id = p_question_version_id and version.review_status = 'approved'
  ) then raise exception 'question_version_not_available' using errcode = '23514'; end if;
  if p_session_id is not null and not exists (select 1 from public.sessions where id = p_session_id and student_id = p_student_id) then raise exception 'session_not_for_student' using errcode = '23514'; end if;
  if p_source_submission_id is not null and not exists (select 1 from public.assignment_submissions where id = p_source_submission_id and student_id = p_student_id) then raise exception 'submission_not_for_student' using errcode = '23514'; end if;

  if p_idempotency_key is not null then
    select id, response into v_attempt_id, v_existing_response
    from public.learning_attempts
    where student_id = p_student_id and question_version_id = p_question_version_id and idempotency_key = p_idempotency_key;
    if found then
      if v_existing_response is distinct from coalesce(p_response, '{}'::jsonb) then raise exception 'idempotency_key_reused_with_different_response' using errcode = '23514'; end if;
      return v_attempt_id;
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_student_id::text || p_question_version_id::text, 0));
  if p_idempotency_key is not null then
    select id, response into v_attempt_id, v_existing_response
    from public.learning_attempts
    where student_id = p_student_id and question_version_id = p_question_version_id and idempotency_key = p_idempotency_key;
    if found then
      if v_existing_response is distinct from coalesce(p_response, '{}'::jsonb) then raise exception 'idempotency_key_reused_with_different_response' using errcode = '23514'; end if;
      return v_attempt_id;
    end if;
  end if;

  select coalesce(max(attempt_number), 0) + 1 into v_attempt_number
  from public.learning_attempts where student_id = p_student_id and question_version_id = p_question_version_id;
  insert into public.learning_attempts (student_id, question_version_id, session_id, source_submission_id, evidence_context, attempt_number, response, confidence, time_spent_seconds, idempotency_key)
  values (p_student_id, p_question_version_id, p_session_id, p_source_submission_id, p_evidence_context, v_attempt_number, coalesce(p_response, '{}'::jsonb), p_confidence, p_time_spent_seconds, p_idempotency_key)
  returning id into v_attempt_id;
  perform public.log_audit_event('learning_attempt.recorded', 'learning_attempt', v_attempt_id::text, jsonb_build_object('student_id', p_student_id, 'question_version_id', p_question_version_id, 'evidence_context', p_evidence_context, 'idempotency_key_present', p_idempotency_key is not null));
  return v_attempt_id;
end;
$$;

create or replace function public.get_question_version_review_bundle(
  p_question_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return (
    select jsonb_build_object(
      'id', version.id,
      'itemCode', item.item_code,
      'curriculumVersion', curriculum.code,
      'sourceTier', item.source_tier,
      'reviewStatus', version.review_status,
      'prompt', version.prompt,
      'answerConfig', version.answer_config,
      'solution', version.solution,
      'marks', version.marks,
      'activityType', version.activity_type,
      'cognitiveLevel', version.cognitive_level,
      'representation', version.representation,
      'calculatorPolicy', version.calculator_policy,
      'difficulty', version.difficulty,

      'primarySkill',
      (
        select skill.skill_code
        from public.question_version_skill_links link
        join public.curriculum_skills skill
          on skill.id = link.skill_id
        where link.question_version_id = version.id
          and link.relationship_type = 'primary'
      ),

      'supportingSkills',
      coalesce(
        (
          select jsonb_agg(
            skill.skill_code
            order by skill.skill_code
          )
          from public.question_version_skill_links link
          join public.curriculum_skills skill
            on skill.id = link.skill_id
          where link.question_version_id = version.id
            and link.relationship_type = 'supporting'
        ),
        '[]'::jsonb
      ),

      'misconceptions',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'code', misconception.code,
              'name', misconception.name
            )
            order by misconception.code
          )
          from public.question_version_misconceptions link
          join public.misconceptions misconception
            on misconception.id = link.misconception_id
          where link.question_version_id = version.id
        ),
        '[]'::jsonb
      ),

      'hints',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'level', hint.hint_level,
              'prompt', hint.prompt
            )
            order by hint.hint_level
          )
          from public.question_hints hint
          where hint.question_version_id = version.id
        ),
        '[]'::jsonb
      ),

      'reviewHistory',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'action', event.action,
              'fromStatus', event.from_status,
              'toStatus', event.to_status,
              'reviewerId', event.reviewer_id,
              'notes', event.review_notes,
              'at', event.created_at
            )
            order by event.created_at
          )
          from public.question_review_events event
          where event.question_version_id = version.id
        ),
        '[]'::jsonb
      )
    )
    from public.question_versions version
    join public.question_items item
      on item.id = version.question_item_id
    join public.curriculum_versions curriculum
      on curriculum.id = item.curriculum_version_id
    where version.id = p_question_version_id
  );
end;
$$;

-- This is the first review packet, intentionally not an approval action.
create or replace function public.get_grade9_gold_standard_review_set()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(public.get_question_version_review_bundle(version.id) order by item.item_code)
    from public.question_versions version
    join public.question_items item on item.id = version.question_item_id
    where item.item_code in (
      'Q.G9.DIAG.03', 'Q.G9.DIAG.04', 'Q.G9.DIAG.05', 'Q.G9.DIAG.07', 'Q.G9.DIAG.09', 'Q.G9.DIAG.12', 'Q.G9.DIAG.15',
      'Q.G9.DOTS.01', 'Q.G9.DOTS.02', 'Q.G9.DOTS.03', 'Q.G9.DOTS.04', 'Q.G9.DOTS.09', 'Q.G9.DOTS.10', 'Q.G9.DOTS.13', 'Q.G9.DOTS.18',
      'Q.G9.VERTICAL.01', 'Q.G9.VERTICAL.02', 'Q.G9.VERTICAL.05', 'Q.G9.VERTICAL.07', 'Q.G9.VERTICAL.10', 'Q.G9.VERTICAL.12', 'Q.G9.VERTICAL.16'
    )
  ), '[]'::jsonb);
end;
$$;

-- A runner starts only from an approved diagnostic and gets opaque question
-- version ids. Each question still passes through get_learning_question,
-- which prevents answer-config and unreviewed-content leakage.
create or replace function public.get_approved_diagnostic_blueprint(p_code text)
returns table (question_version_id uuid, sequence_number smallint, purpose text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_profile_role() not in ('student', 'tutor', 'admin') then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
  select question.question_version_id, question.sequence_number, question.purpose
  from public.diagnostic_blueprints blueprint
  join public.curriculum_versions curriculum on curriculum.id = blueprint.curriculum_version_id and curriculum.is_active
  join public.diagnostic_blueprint_questions question on question.diagnostic_blueprint_id = blueprint.id
  join public.question_versions version on version.id = question.question_version_id and version.review_status = 'approved'
  join public.question_items item on item.id = version.question_item_id and item.retired_at is null
  where blueprint.code = p_code
    and blueprint.review_status = 'approved'
    and not exists (
      select 1
      from public.diagnostic_blueprint_questions all_question
      join public.question_versions all_version on all_version.id = all_question.question_version_id
      join public.question_items all_item on all_item.id = all_version.question_item_id
      where all_question.diagnostic_blueprint_id = blueprint.id
        and (all_version.review_status <> 'approved' or all_item.retired_at is not null)
    )
  order by question.sequence_number;
end;
$$;

create or replace function public.get_grade9_learning_pilot_report()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'content', jsonb_build_object(
      'review_status_counts', coalesce((select jsonb_agg(row_to_json(bucket)) from (select version.review_status, count(*) as count from public.question_versions version join public.question_items item on item.id = version.question_item_id where item.item_code like 'Q.G9.%' group by version.review_status) bucket), '[]'::jsonb),
      'coverage_by_skill', coalesce((select jsonb_agg(row_to_json(bucket)) from (select skill.skill_code, count(*) as item_count from public.question_version_skill_links link join public.curriculum_skills skill on skill.id = link.skill_id where link.relationship_type = 'primary' and skill.skill_code like 'G9.%' group by skill.skill_code order by skill.skill_code) bucket), '[]'::jsonb),
      'coverage_by_cognitive_level', coalesce((select jsonb_agg(row_to_json(bucket)) from (select cognitive_level, count(*) as item_count from public.question_versions group by cognitive_level) bucket), '[]'::jsonb),
      'coverage_by_activity_type', coalesce((select jsonb_agg(row_to_json(bucket)) from (select activity_type, count(*) as item_count from public.question_versions group by activity_type) bucket), '[]'::jsonb)
    ),
    'diagnostic_completion_count', (select count(distinct attempt.student_id) from public.learning_attempts attempt join public.question_versions version on version.id = attempt.question_version_id where version.activity_type = 'diagnostic' and attempt.status = 'evaluated'),
    'mastery_state_distribution_by_skill', coalesce((select jsonb_agg(row_to_json(bucket)) from (select skill.skill_code, evaluation.state, count(*) as learner_count from public.skill_mastery_evaluations evaluation join public.curriculum_skills skill on skill.id = evaluation.skill_id where skill.skill_code like 'G9.%' group by skill.skill_code, evaluation.state) bucket), '[]'::jsonb),
    'most_common_misconceptions', coalesce((select jsonb_agg(row_to_json(bucket)) from (select misconception.code, count(*) as evidence_count from public.learner_misconceptions learner join public.misconceptions misconception on misconception.id = learner.misconception_id group by misconception.code order by count(*) desc limit 10) bucket), '[]'::jsonb),
    'recommendation_counts', coalesce((select jsonb_agg(row_to_json(bucket)) from (select status, count(*) as count from public.grade9_learning_recommendations group by status) bucket), '[]'::jsonb),
    'tutor_decision_rates', coalesce((select jsonb_agg(row_to_json(bucket)) from (select decision, count(*) as count from public.tutor_recommendation_decisions group by decision) bucket), '[]'::jsonb),
    'intervention_completion_count', (select count(*) from public.tutor_interventions where delivered_at is not null),
    'immediate_outcome_count', (select count(*) from public.intervention_outcomes where outcome_stage = 'immediate'),
    'delayed_outcome_count', (select count(*) from public.intervention_outcomes where outcome_stage = 'delayed')
  );
end;
$$;

revoke all on function public.record_learning_attempt(uuid, uuid, jsonb, smallint, integer, uuid, uuid, public.evidence_context, uuid) from public;
revoke all on function public.review_question_version_action(uuid, text, text) from public;
revoke all on function public.get_question_version_review_bundle(uuid) from public;
revoke all on function public.get_grade9_gold_standard_review_set() from public;
revoke all on function public.get_approved_diagnostic_blueprint(text) from public;
revoke all on function public.get_grade9_learning_pilot_report() from public;
grant execute on function public.record_learning_attempt(uuid, uuid, jsonb, smallint, integer, uuid, uuid, public.evidence_context, uuid) to authenticated;
grant execute on function public.review_question_version_action(uuid, text, text) to authenticated;
grant execute on function public.get_question_version_review_bundle(uuid) to authenticated;
grant execute on function public.get_grade9_gold_standard_review_set() to authenticated;
grant execute on function public.get_approved_diagnostic_blueprint(text) to authenticated;
grant execute on function public.get_grade9_learning_pilot_report() to authenticated;
