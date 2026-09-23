-- Sprint 2: this boundary is executable only by the trusted Edge Function.
-- It deliberately accepts no learner-selected correctness or answer key.
create or replace function public.apply_automatic_learning_evaluation(
  p_learning_attempt_id uuid,
  p_is_correct boolean,
  p_marks_awarded numeric,
  p_misconception_codes text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.learning_attempts;
  v_hint_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_attempt from public.learning_attempts where id = p_learning_attempt_id for update;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if v_attempt.status = 'evaluated' then return; end if;
  if v_attempt.status <> 'submitted' then raise exception 'attempt_not_evaluable' using errcode = '23514'; end if;
  if p_marks_awarded < 0 or p_marks_awarded > (select marks from public.question_versions where id = v_attempt.question_version_id) then raise exception 'marks_out_of_range' using errcode = '23514'; end if;

  update public.learning_attempts
  set status = 'evaluated', is_correct = p_is_correct, marks_awarded = p_marks_awarded, evaluated_at = now(), tutor_observation = 'Automatically evaluated by deterministic learning evaluator.'
  where id = v_attempt.id;

  select count(*) into v_hint_count from public.learning_attempt_hint_events where learning_attempt_id = v_attempt.id;
  insert into public.learning_attempt_skill_evidence (learning_attempt_id, skill_id, independence, is_target_skill, cognitive_level, correct, marks_awarded, marks_possible)
  select v_attempt.id, link.skill_id,
    case when v_hint_count = 0 then 'independent'::public.attempt_independence else 'assisted'::public.attempt_independence end,
    link.relationship_type = 'primary', version.cognitive_level, p_is_correct, p_marks_awarded, version.marks
  from public.question_version_skill_links link join public.question_versions version on version.id = link.question_version_id
  where link.question_version_id = v_attempt.question_version_id
  on conflict (learning_attempt_id, skill_id) do nothing;

  with inserted as (
    insert into public.learner_misconceptions (student_id, misconception_id, state, reason)
    select v_attempt.student_id, misconception.id, 'suspected'::public.misconception_state,
      'Observed deterministic response pattern; this is evidence, not a diagnosis.'
    from public.misconceptions misconception
    join public.question_version_misconceptions link on link.misconception_id = misconception.id and link.question_version_id = v_attempt.question_version_id
    where misconception.code = any(coalesce(p_misconception_codes, '{}'))
    returning id
  )
  insert into public.learner_misconception_evidence (learner_misconception_id, learning_attempt_id)
  select id, v_attempt.id from inserted;

  perform public.log_audit_event('learning_attempt.auto_evaluated', 'learning_attempt', v_attempt.id::text,
    jsonb_build_object('student_id', v_attempt.student_id, 'correct', p_is_correct, 'automated', true));
end;
$$;

revoke all on function public.apply_automatic_learning_evaluation(uuid, boolean, numeric, text[]) from public;
grant execute on function public.apply_automatic_learning_evaluation(uuid, boolean, numeric, text[]) to service_role;

-- A service-only, append-only decision writer. The evidence fingerprint makes
-- retries no-ops while allowing a later, materially different evidence set to
-- create a new historical decision.
alter table public.skill_mastery_evaluations add column if not exists automatic_evidence_fingerprint text;
create unique index if not exists skill_mastery_automatic_fingerprint_idx
  on public.skill_mastery_evaluations(student_id, skill_id, rule_set_id, automatic_evidence_fingerprint)
  where automatic_evidence_fingerprint is not null;

create or replace function public.persist_automatic_learning_decision(
  p_student_id uuid, p_skill_id uuid, p_mastery_rule_set_id uuid, p_state public.mastery_state,
  p_reason text, p_reason_codes text[], p_evidence_ids uuid[], p_fingerprint text,
  p_recommendation_rule_set_id uuid default null, p_recommendation_type public.intervention_type default null,
  p_recommended_sequence text[] default '{}', p_recommendation_reason text default null, p_recommendation_reason_codes text[] default '{}',
  p_recommendation_skill_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_mastery_id uuid; v_recommendation_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'not_authorized' using errcode = '42501'; end if;
  insert into public.skill_mastery_evaluations (student_id, skill_id, rule_set_id, state, reason, reason_codes, automatic_evidence_fingerprint)
  values (p_student_id, p_skill_id, p_mastery_rule_set_id, p_state, p_reason, coalesce(p_reason_codes, '{}'), p_fingerprint)
  on conflict (student_id, skill_id, rule_set_id, automatic_evidence_fingerprint) where automatic_evidence_fingerprint is not null
  do update set id = public.skill_mastery_evaluations.id returning id into v_mastery_id;
  insert into public.skill_mastery_evaluation_evidence (mastery_evaluation_id, learning_attempt_skill_evidence_id)
  select v_mastery_id, id from unnest(coalesce(p_evidence_ids, '{}')) id on conflict do nothing;
  if p_recommendation_rule_set_id is not null and p_recommendation_type is not null then
    select id into v_recommendation_id from public.grade9_learning_recommendations r
    where r.student_id=p_student_id and r.skill_id=coalesce(p_recommendation_skill_id,p_skill_id) and r.status='open' and r.rule_set_id=p_recommendation_rule_set_id
      and r.recommendation_type=p_recommendation_type and r.reason=p_recommendation_reason limit 1;
    if v_recommendation_id is null then
      insert into public.grade9_learning_recommendations (student_id,skill_id,mastery_evaluation_id,rule_set_id,recommendation_type,recommended_sequence,reason)
      values (p_student_id,coalesce(p_recommendation_skill_id,p_skill_id),v_mastery_id,p_recommendation_rule_set_id,p_recommendation_type,coalesce(p_recommended_sequence,'{}'),p_recommendation_reason) returning id into v_recommendation_id;
      insert into public.learning_recommendation_reasons(recommendation_id,reason_code)
      select v_recommendation_id, code from unnest(coalesce(p_recommendation_reason_codes,'{}')) code on conflict do nothing;
    end if;
  end if;
  perform public.log_audit_event('learning_decision.automatic', 'skill_mastery_evaluation', v_mastery_id::text, jsonb_build_object('student_id',p_student_id,'skill_id',p_skill_id));
  return v_mastery_id;
end; $$;
revoke all on function public.persist_automatic_learning_decision(uuid,uuid,uuid,public.mastery_state,text,text[],uuid[],text,uuid,public.intervention_type,text[],text,text[],uuid) from public;
grant execute on function public.persist_automatic_learning_decision(uuid,uuid,uuid,public.mastery_state,text,text[],uuid[],text,uuid,public.intervention_type,text[],text,text[],uuid) to service_role;
