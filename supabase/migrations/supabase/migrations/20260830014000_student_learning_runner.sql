-- Student-facing diagnostic runner contract.
--
-- This migration does not evaluate mathematics, derive mastery, or create
-- recommendations. It only exposes approved diagnostic availability/state and
-- provides a retry-safe learner submission boundary.
--
-- Student identity is always derived from auth. The browser never supplies a
-- student_id.

create or replace function public.get_my_available_learning_diagnostics()
returns table (
  diagnostic_code text,
  diagnostic_name text,
  diagnostic_description text,
  total_questions bigint,
  completed_questions bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
begin
  if public.current_profile_role() <> 'student' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  v_student_id := public.current_student_id();

  if v_student_id is null then
    raise exception 'student_profile_not_found' using errcode = '42501';
  end if;

  return query
  select
    blueprint.code,
    blueprint.name,
    blueprint.description,
    count(question.question_version_id)::bigint,
    count(progress.completed)::bigint
  from public.diagnostic_blueprints blueprint
  join public.curriculum_versions curriculum
    on curriculum.id = blueprint.curriculum_version_id
  join public.diagnostic_blueprint_questions question
    on question.diagnostic_blueprint_id = blueprint.id

  left join lateral (
    select 1 as completed
    from public.learning_attempts attempt
    where attempt.student_id = v_student_id
      and attempt.question_version_id = question.question_version_id
    order by attempt.attempt_number desc
    limit 1
  ) progress on true

  where blueprint.review_status = 'approved'
    and curriculum.is_active
    and curriculum.valid_from <= current_date
    and (
      curriculum.valid_until is null
      or curriculum.valid_until >= current_date
    )

    -- A diagnostic is unavailable unless every linked question is still
    -- approved and active.
    and not exists (
      select 1
      from public.diagnostic_blueprint_questions all_question
      join public.question_versions all_version
        on all_version.id = all_question.question_version_id
      join public.question_items all_item
        on all_item.id = all_version.question_item_id
      where all_question.diagnostic_blueprint_id = blueprint.id
        and (
          all_version.review_status <> 'approved'
          or all_item.retired_at is not null
        )
    )

  group by
    blueprint.id,
    blueprint.code,
    blueprint.name,
    blueprint.description

  order by blueprint.name;
end;
$$;


create or replace function public.get_my_approved_diagnostic_state(
  p_code text
)
returns table (
  question_version_id uuid,
  sequence_number smallint,
  purpose text,
  attempt_id uuid,
  attempt_status public.attempt_status,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
begin
  if public.current_profile_role() <> 'student' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  v_student_id := public.current_student_id();

  if v_student_id is null then
    raise exception 'student_profile_not_found' using errcode = '42501';
  end if;

  return query
  select
    blueprint_item.question_version_id,
    blueprint_item.sequence_number,
    blueprint_item.purpose,
    latest_attempt.id,
    latest_attempt.status,
    latest_attempt.occurred_at
  from public.get_approved_diagnostic_blueprint(p_code) blueprint_item

  left join lateral (
    select
      attempt.id,
      attempt.status,
      attempt.occurred_at
    from public.learning_attempts attempt
    where attempt.student_id = v_student_id
      and attempt.question_version_id = blueprint_item.question_version_id
    order by
      attempt.attempt_number desc,
      attempt.occurred_at desc
    limit 1
  ) latest_attempt on true

  order by blueprint_item.sequence_number;
end;
$$;


create or replace function public.submit_my_learning_attempt(
  p_diagnostic_code text,
  p_question_version_id uuid,
  p_response jsonb,
  p_confidence smallint default null,
  p_time_spent_seconds integer default null,
  p_idempotency_key uuid default null,
  p_hint_ids uuid[] default '{}'
)
returns table (
  attempt_id uuid,
  attempt_status public.attempt_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_attempt_id uuid;
begin
  if public.current_profile_role() <> 'student' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  v_student_id := public.current_student_id();

  if v_student_id is null then
    raise exception 'student_profile_not_found' using errcode = '42501';
  end if;

  if p_idempotency_key is null then
    raise exception 'idempotency_key_required' using errcode = '23514';
  end if;

  if p_response is null
     or jsonb_typeof(p_response) <> 'object'
     or nullif(btrim(coalesce(p_response ->> 'answer', '')), '') is null
  then
    raise exception 'invalid_response' using errcode = '23514';
  end if;

  if p_confidence is not null
     and (p_confidence < 1 or p_confidence > 4)
  then
    raise exception 'invalid_confidence' using errcode = '23514';
  end if;

  if p_time_spent_seconds is not null
     and p_time_spent_seconds < 0
  then
    raise exception 'invalid_time_spent' using errcode = '23514';
  end if;

  -- The supplied question must actually belong to this currently approved
  -- diagnostic. Arbitrary approved question ids are not accepted here.
  if not exists (
    select 1
    from public.get_approved_diagnostic_blueprint(p_diagnostic_code) item
    where item.question_version_id = p_question_version_id
  ) then
    raise exception 'question_not_in_approved_diagnostic'
      using errcode = '23514';
  end if;

  -- Reuse the learner-safe availability boundary. This also protects against
  -- inactive/retired skills or content becoming unavailable after the
  -- blueprint was loaded.
  if not exists (
    select 1
    from public.get_learning_question(p_question_version_id)
  ) then
    raise exception 'question_version_not_available'
      using errcode = '23514';
  end if;

  if coalesce(cardinality(p_hint_ids), 0) <> (
    select count(distinct requested.hint_id)
    from unnest(coalesce(p_hint_ids, '{}'::uuid[]))
      as requested(hint_id)
  ) then
    raise exception 'duplicate_hint_ids'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_hint_ids, '{}'::uuid[]))
      as requested(hint_id)
    left join public.question_hints hint
      on hint.id = requested.hint_id
     and hint.question_version_id = p_question_version_id
    where hint.id is null
  ) then
    raise exception 'hint_not_for_question'
      using errcode = '23514';
  end if;

  -- Existing record_learning_attempt already owns the retry-safe attempt
  -- contract and verifies the current student.
  v_attempt_id := public.record_learning_attempt(
    p_student_id => v_student_id,
    p_question_version_id => p_question_version_id,
    p_response => p_response,
    p_confidence => p_confidence,
    p_time_spent_seconds => p_time_spent_seconds,
    p_session_id => null,
    p_source_submission_id => null,
    p_evidence_context => 'formative'::public.evidence_context,
    p_idempotency_key => p_idempotency_key
  );

  -- Hints are persisted in the same transaction as the logical answer.
  --
  -- This means:
  -- 1. an attempt cannot be committed without its supplied hint evidence;
  -- 2. a network retry using the same idempotency key cannot inflate attempt
  --    count;
  -- 3. learners cannot forge hint ids from another question.
  insert into public.learning_attempt_hint_events (
    learning_attempt_id,
    question_hint_id,
    opened_order
  )
  select
    v_attempt_id,
    requested.hint_id,
    requested.ordinality::integer
  from unnest(coalesce(p_hint_ids, '{}'::uuid[]))
    with ordinality as requested(hint_id, ordinality)
  on conflict (learning_attempt_id, question_hint_id) do nothing;

  return query
  select
    attempt.id,
    attempt.status
  from public.learning_attempts attempt
  where attempt.id = v_attempt_id;
end;
$$;


revoke all on function
  public.get_my_available_learning_diagnostics()
from public;

revoke all on function
  public.get_my_approved_diagnostic_state(text)
from public;

revoke all on function
  public.submit_my_learning_attempt(
    text,
    uuid,
    jsonb,
    smallint,
    integer,
    uuid,
    uuid[]
  )
from public;


grant execute on function
  public.get_my_available_learning_diagnostics()
to authenticated;

grant execute on function
  public.get_my_approved_diagnostic_state(text)
to authenticated;

grant execute on function
  public.submit_my_learning_attempt(
    text,
    uuid,
    jsonb,
    smallint,
    integer,
    uuid,
    uuid[]
  )
to authenticated;