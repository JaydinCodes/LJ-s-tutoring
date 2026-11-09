-- Sprint 2 final quality closure: assignment evidence becomes an explicit,
-- conservative input to per-skill mastery. Formal overall achievement remains
-- wholly formal-assessment based.

alter table public.topic_mastery_policies
  add column if not exists assignment_evidence_maximum_question_equivalents smallint not null default 2
    check (assignment_evidence_maximum_question_equivalents between 0 and 40),
  add column if not exists assignment_evidence_combination_version text not null default 'skill-weighted-v1'
    check (assignment_evidence_combination_version = 'skill-weighted-v1');

alter table public.qualifying_assignment_mastery_evidence
  add column if not exists independent_evidence_count smallint not null default 1
    check (independent_evidence_count between 1 and 40),
  add column if not exists evidence_basis text not null default 'skill_aggregate'
    check (evidence_basis in ('item_level', 'skill_aggregate')),
  add column if not exists source_snapshot jsonb not null default '{"provenance":"legacy-qualified-skill-aggregate"}'::jsonb
    check (jsonb_typeof(source_snapshot) = 'object');

alter table public.topic_mastery_evaluation_skill_evidence
  add column if not exists assignment_evidence_count smallint not null default 0
    check (assignment_evidence_count >= 0),
  add column if not exists assignment_equivalent_correct_count smallint not null default 0
    check (assignment_equivalent_correct_count >= 0 and assignment_equivalent_correct_count <= assignment_evidence_count),
  add column if not exists total_independent_evidence_count smallint not null default 0
    check (total_independent_evidence_count >= formal_question_count),
  add column if not exists evidence_provenance jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence_provenance) = 'array');

-- A qualification is one traceable decision and, once consumed, may not make
-- a second topic decision look stronger. The evaluator also uses a student /
-- topic advisory lock to make this rule safe under concurrent finalisation.
create unique index if not exists topic_mastery_assignment_evidence_consumed_once_idx
  on public.topic_mastery_evaluation_evidence(qualifying_assignment_mastery_evidence_id)
  where qualifying_assignment_mastery_evidence_id is not null;
create unique index if not exists topic_mastery_evaluations_session_once_idx
  on public.topic_mastery_evaluations(assessment_session_id)
  where assessment_session_id is not null;

create or replace function public.prevent_qualifying_assignment_evidence_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'qualified_assignment_evidence_is_immutable_create_new_evidence' using errcode = '55000';
end;
$$;
drop trigger if exists trg_prevent_qualifying_assignment_evidence_mutation on public.qualifying_assignment_mastery_evidence;
create trigger trg_prevent_qualifying_assignment_evidence_mutation
before update or delete on public.qualifying_assignment_mastery_evidence
for each row execute function public.prevent_qualifying_assignment_evidence_mutation();

drop function if exists public.qualify_assignment_mastery_evidence(uuid, uuid, uuid, numeric, boolean, text);
create function public.qualify_assignment_mastery_evidence(
  p_topic_mastery_policy_id uuid,
  p_assignment_submission_id uuid,
  p_skill_id uuid,
  p_achievement numeric,
  p_is_mathematical_reasoning_evidence boolean,
  p_qualification_rationale text,
  p_independent_evidence_count smallint default 1,
  p_evidence_basis text default 'skill_aggregate',
  p_source_snapshot jsonb default '{"provenance":"admin-qualified-skill-aggregate"}'::jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_student_id uuid; v_evidence_id uuid; v_minimum numeric;
begin
  perform public.content_admin_required();
  select submission.student_id into v_student_id
  from public.assignment_submissions submission
  where submission.id = p_assignment_submission_id
    and submission.is_latest
    and submission.status = 'marked'
    and submission.marks_awarded is not null
    and submission.marks_released;
  if v_student_id is null then raise exception 'assignment_submission_must_be_latest_marked_and_released' using errcode = '23514'; end if;
  select qualifying_assignment_minimum_achievement into v_minimum
  from public.topic_mastery_policies
  where id = p_topic_mastery_policy_id and review_status = 'approved' and allow_qualifying_assignment_evidence;
  if v_minimum is null then raise exception 'topic_policy_does_not_allow_qualifying_assignment_evidence' using errcode = '23514'; end if;
  if p_achievement is null or p_achievement < v_minimum or p_achievement > 100 then raise exception 'assignment_evidence_below_configured_qualification_threshold' using errcode = '23514'; end if;
  if p_independent_evidence_count is null or p_independent_evidence_count < 1 or p_independent_evidence_count > 40 then raise exception 'invalid_assignment_independent_evidence_count' using errcode = '22023'; end if;
  if coalesce(p_evidence_basis, '') not in ('item_level', 'skill_aggregate') then raise exception 'invalid_assignment_evidence_basis' using errcode = '22023'; end if;
  if p_evidence_basis = 'skill_aggregate' and p_independent_evidence_count <> 1 then raise exception 'aggregate_assignment_evidence_counts_as_one_independent_observation' using errcode = '23514'; end if;
  if p_source_snapshot is null or jsonb_typeof(p_source_snapshot) <> 'object' or nullif(btrim(coalesce(p_source_snapshot->>'provenance','')), '') is null then raise exception 'assignment_evidence_provenance_required' using errcode = '23514'; end if;
  if not exists (select 1 from public.topic_mastery_policy_skills where topic_mastery_policy_id = p_topic_mastery_policy_id and skill_id = p_skill_id and is_essential) then raise exception 'assignment_evidence_skill_not_in_topic_policy' using errcode = '23514'; end if;
  insert into public.qualifying_assignment_mastery_evidence(topic_mastery_policy_id, assignment_submission_id, student_id, skill_id, achievement, is_mathematical_reasoning_evidence, qualification_rationale, qualified_by, independent_evidence_count, evidence_basis, source_snapshot)
  values(p_topic_mastery_policy_id, p_assignment_submission_id, v_student_id, p_skill_id, p_achievement, coalesce(p_is_mathematical_reasoning_evidence, false), p_qualification_rationale, public.current_profile_id(), p_independent_evidence_count, p_evidence_basis, p_source_snapshot)
  returning id into v_evidence_id;
  perform public.log_audit_event('learning_configuration.assignment_evidence_qualified','qualifying_assignment_mastery_evidence',v_evidence_id::text,jsonb_build_object('student_id',v_student_id,'skill_id',p_skill_id,'policy_id',p_topic_mastery_policy_id,'basis',p_evidence_basis,'independent_evidence_count',p_independent_evidence_count));
  return v_evidence_id;
end;
$$;

create or replace function public.assignment_evidence_for_mastery_session(
  p_session_id uuid, p_skill_id uuid, p_reasoning_only boolean default false
)
returns table(evidence_id uuid, contribution_count smallint, equivalent_correct_count smallint, achievement numeric, evidence_basis text, source_snapshot jsonb)
language sql security definer set search_path = '' stable as $$
  with session_policy as (
    select session.id, session.student_id, session.topic_mastery_policy_id, session.assessment_type,
      coalesce((session.policy_snapshot->>'allowQualifyingAssignmentEvidence')::boolean, false) as enabled,
      coalesce(nullif(session.policy_snapshot->>'assignmentEvidenceMaximumQuestionEquivalents','')::smallint, 0) as cap
    from public.learning_assessment_sessions session where session.id = p_session_id
  ), candidates as (
    select evidence.*, policy.cap,
      coalesce(sum(evidence.independent_evidence_count) over (order by evidence.qualified_at, evidence.id rows between unbounded preceding and 1 preceding), 0) as prior_count
    from public.qualifying_assignment_mastery_evidence evidence
    join session_policy policy on policy.student_id = evidence.student_id and policy.topic_mastery_policy_id = evidence.topic_mastery_policy_id
    where policy.enabled and policy.assessment_type <> 'topic_baseline' and evidence.skill_id = p_skill_id
      and (not p_reasoning_only or evidence.is_mathematical_reasoning_evidence)
      and not exists (select 1 from public.topic_mastery_evaluation_evidence used where used.qualifying_assignment_mastery_evidence_id = evidence.id)
  ), capped as (
    select *, least(independent_evidence_count, greatest(0, cap - prior_count))::smallint as selected_count
    from candidates
  )
  select id, selected_count, floor(selected_count * achievement / 100)::smallint, achievement, evidence_basis, source_snapshot
  from capped where selected_count > 0;
$$;

-- New sessions persist the policy combination cap/version. Historical session
-- snapshots retain their original policy and default to zero assignment weight.
create or replace function public.start_my_learning_assessment(p_assessment_definition_id uuid, p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_student_id uuid:=public.current_student_id(); v_existing uuid; v_definition public.learning_assessment_definitions; v_form public.learning_assessment_form_versions; v_session_id uuid; v_policy_snapshot jsonb:='{}'::jsonb; v_authorization public.learning_assessment_reassessment_authorizations; v_attempt smallint;
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then raise exception 'not_authorized' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_student_id::text||':'||p_assessment_definition_id::text,0));
  select id into v_existing from public.learning_assessment_sessions where student_id=v_student_id and start_idempotency_key=p_idempotency_key;
  if v_existing is not null then if exists(select 1 from public.learning_assessment_sessions where id=v_existing and learning_assessment_definition_id=p_assessment_definition_id) then return v_existing; end if; raise exception 'assessment_start_idempotency_key_reused_with_different_definition' using errcode='23505'; end if;
  select id into v_existing from public.learning_assessment_sessions where student_id=v_student_id and learning_assessment_definition_id=p_assessment_definition_id and status='in_progress' for update;
  if v_existing is not null then return v_existing; end if;
  select * into v_definition from public.learning_assessment_definitions where id=p_assessment_definition_id and review_status='approved';
  if not found then raise exception 'learning_assessment_unavailable' using errcode='P0002'; end if;
  if not coalesce((public.learning_assessment_eligibility(v_student_id,v_definition.id)->>'eligible')::boolean,false) then raise exception 'learning_assessment_not_eligible:%',public.learning_assessment_eligibility(v_student_id,v_definition.id)->>'reasonCode' using errcode='23514'; end if;
  if v_definition.assessment_route='reassessment' then select * into v_authorization from public.learning_assessment_reassessment_authorizations where student_id=v_student_id and reassessment_definition_id=v_definition.id and used_by_session_id is null and (expires_at is null or expires_at>now()) order by authorised_at for update skip locked limit 1; if not found then raise exception 'reassessment_authorization_required' using errcode='23514'; end if; end if;
  select * into v_form from public.learning_assessment_form_versions where learning_assessment_definition_id=v_definition.id and review_status='approved' and retired_at is null order by form_version desc limit 1;
  if not found then raise exception 'learning_assessment_has_no_published_form' using errcode='23514'; end if;
  if v_form.topic_mastery_policy_id is not null then
    select jsonb_build_object('policyId',p.id,'version',p.version,'overallAchievementThreshold',p.overall_achievement_threshold,'criticalSkillAchievementThreshold',p.critical_skill_achievement_threshold,'minimumQuestionsPerCriticalSkill',p.minimum_questions_per_critical_skill,'minimumReasoningEvidenceCount',p.minimum_reasoning_evidence_count,'minimumReasoningAchievementThreshold',p.minimum_reasoning_achievement_threshold,'strongBaselineThreshold',p.strong_baseline_threshold,'requiresMasteryChallenge',p.requires_mastery_challenge,'allowQualifyingAssignmentEvidence',p.allow_qualifying_assignment_evidence,'qualifyingAssignmentMinimumAchievement',p.qualifying_assignment_minimum_achievement,'assignmentEvidenceMaximumQuestionEquivalents',p.assignment_evidence_maximum_question_equivalents,'assignmentEvidenceCombinationVersion',p.assignment_evidence_combination_version,'skills',coalesce((select jsonb_agg(jsonb_build_object('skillId',s.skill_id,'isEssential',s.is_essential,'isCritical',s.is_critical,'requiresReasoningEvidence',s.requires_reasoning_evidence) order by s.skill_id) from public.topic_mastery_policy_skills s where s.topic_mastery_policy_id=p.id),'[]'::jsonb)) into v_policy_snapshot from public.topic_mastery_policies p where p.id=v_form.topic_mastery_policy_id;
    if v_policy_snapshot is null then raise exception 'learning_assessment_form_policy_missing' using errcode='23514'; end if;
  end if;
  select least(32767,1+count(*))::smallint into v_attempt from public.learning_assessment_sessions s where s.student_id=v_student_id and s.assessment_type=v_definition.assessment_type and s.curriculum_topic_id is not distinct from v_definition.curriculum_topic_id and s.status in ('submitted','timed_out');
  insert into public.learning_assessment_sessions(student_id,learning_assessment_definition_id,learning_assessment_form_version_id,curriculum_version_id,curriculum_topic_id,topic_mastery_policy_id,policy_snapshot,assessment_type,start_idempotency_key,started_at,expires_at,original_expires_at,attempt_number,reassessment_reason) values(v_student_id,v_definition.id,v_form.id,v_definition.curriculum_version_id,v_definition.curriculum_topic_id,v_form.topic_mastery_policy_id,v_policy_snapshot,v_definition.assessment_type,p_idempotency_key,now(),now()+make_interval(mins=>v_form.duration_minutes),now()+make_interval(mins=>v_form.duration_minutes),v_attempt,v_authorization.reason) returning id into v_session_id;
  if v_authorization.id is not null then update public.learning_assessment_reassessment_authorizations set used_by_session_id=v_session_id,used_at=now() where id=v_authorization.id and used_by_session_id is null; if not found then raise exception 'reassessment_authorization_already_used' using errcode='40001'; end if; end if;
  insert into public.learning_assessment_session_questions(learning_assessment_session_id,question_version_id,primary_skill_id,sequence_number,prompt_snapshot,options_snapshot,marks_snapshot,reasoning_classification) select v_session_id,q.question_version_id,q.primary_skill_id,case when v_form.question_order_mode='session_shuffle' then row_number() over(order by md5(v_session_id::text||q.question_version_id::text)) else q.sequence_number end,q.prompt_snapshot,q.options_snapshot,q.marks_snapshot,q.reasoning_classification from public.learning_assessment_form_questions q where q.learning_assessment_form_version_id=v_form.id;
  perform public.log_audit_event('learning_assessment.session_started','learning_assessment_session',v_session_id::text,jsonb_build_object('assessment_definition_id',v_definition.id,'attempt_number',v_attempt,'authorization_id',v_authorization.id));
  return v_session_id;
end;
$$;

create or replace function public.evaluate_topic_mastery_from_assessment_session(p_session_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_session public.learning_assessment_sessions; v_eval uuid; v_overall numeric(5,2);
  v_critical_total integer:=0; v_critical_pass integer:=0; v_reasoning_total integer:=0; v_reasoning_correct integer:=0;
  v_reasoning_achievement numeric(5,2); v_critical_coverage numeric(5,2); v_min_q integer;
  v_critical_threshold numeric; v_overall_threshold numeric; v_reasoning_min integer; v_reasoning_threshold numeric;
  v_status text; v_codes text[]:='{}'; v_missing_critical boolean:=false; v_weak_critical boolean:=false; v_focus text;
begin
  select * into v_session from public.learning_assessment_sessions where id=p_session_id for update;
  if not found or v_session.curriculum_topic_id is null or v_session.topic_mastery_policy_id is null then return null; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_session.student_id::text||':'||v_session.curriculum_topic_id::text,0));
  if exists(select 1 from public.topic_mastery_evaluations where assessment_session_id=p_session_id) then return (select id from public.topic_mastery_evaluations where assessment_session_id=p_session_id); end if;
  v_overall:=coalesce(v_session.percentage,0);
  v_min_q:=coalesce(nullif(v_session.policy_snapshot->>'minimumQuestionsPerCriticalSkill','')::integer,1);
  v_critical_threshold:=coalesce(nullif(v_session.policy_snapshot->>'criticalSkillAchievementThreshold','')::numeric,75);
  v_overall_threshold:=coalesce(nullif(v_session.policy_snapshot->>'overallAchievementThreshold','')::numeric,80);
  v_reasoning_min:=coalesce(nullif(v_session.policy_snapshot->>'minimumReasoningEvidenceCount','')::integer,0);
  v_reasoning_threshold:=coalesce(nullif(v_session.policy_snapshot->>'minimumReasoningAchievementThreshold','')::numeric,80);

  select count(*),count(*) filter(where result.is_correct) into v_reasoning_total,v_reasoning_correct
  from public.learning_assessment_session_question_results result
  where result.learning_assessment_session_id=p_session_id and result.reasoning_classification='mathematical_reasoning';
  select v_reasoning_total + coalesce(sum(assignment.contribution_count),0), v_reasoning_correct + coalesce(sum(assignment.equivalent_correct_count),0)
  into v_reasoning_total,v_reasoning_correct
  from jsonb_array_elements(coalesce(v_session.policy_snapshot->'skills','[]'::jsonb)) skill
  cross join lateral public.assignment_evidence_for_mastery_session(p_session_id,(skill->>'skillId')::uuid,true) assignment;
  v_reasoning_achievement:=case when v_reasoning_total=0 then null else round(100*v_reasoning_correct::numeric/v_reasoning_total,2) end;

  if v_session.assessment_type='topic_baseline' then
    v_status:='evidence_incomplete'; v_codes:=array['BASELINE_PLACEMENT_EVIDENCE_ONLY'];
  else
    if v_overall<v_overall_threshold then v_codes:=array_append(v_codes,'OVERALL_ACHIEVEMENT_BELOW_THRESHOLD'); end if;
    if v_reasoning_total<v_reasoning_min then v_codes:=array_append(v_codes,'MISSING_MATHEMATICAL_REASONING_EVIDENCE'); end if;
    if v_reasoning_achievement is null or v_reasoning_achievement<v_reasoning_threshold then v_codes:=array_append(v_codes,'MATHEMATICAL_REASONING_ACHIEVEMENT_BELOW_THRESHOLD'); end if;
  end if;

  select count(*), count(*) filter(where (formal.total + assignment.total) >= v_min_q and round(100*(formal.correct + assignment.correct)::numeric/nullif(formal.total + assignment.total,0),2) >= v_critical_threshold),
    coalesce(bool_or((formal.total + assignment.total)<v_min_q),false),
    coalesce(bool_or((formal.total + assignment.total)>=v_min_q and round(100*(formal.correct + assignment.correct)::numeric/nullif(formal.total + assignment.total,0),2)<v_critical_threshold),false)
  into v_critical_total,v_critical_pass,v_missing_critical,v_weak_critical
  from jsonb_array_elements(coalesce(v_session.policy_snapshot->'skills','[]'::jsonb)) skill
  cross join lateral (
    select count(distinct question.question_version_id)::integer total,count(*) filter(where result.is_correct)::integer correct
    from public.learning_assessment_session_question_results result
    join public.learning_assessment_session_questions question on question.id=result.learning_assessment_session_question_id
    where result.learning_assessment_session_id=p_session_id and result.skill_id=(skill->>'skillId')::uuid
  ) formal
  cross join lateral (
    select coalesce(sum(contribution_count),0)::integer total,coalesce(sum(equivalent_correct_count),0)::integer correct
    from public.assignment_evidence_for_mastery_session(p_session_id,(skill->>'skillId')::uuid,false)
  ) assignment
  where coalesce((skill->>'isCritical')::boolean,false);
  v_critical_coverage:=case when v_critical_total=0 then 100 else round(100*v_critical_pass::numeric/v_critical_total,2) end;
  if v_session.assessment_type <> 'topic_baseline' then
    if v_missing_critical then v_codes:=array_append(v_codes,'INSUFFICIENT_CRITICAL_SKILL_EVIDENCE'); end if;
    if v_weak_critical then v_codes:=array_append(v_codes,'CRITICAL_SKILL_ACHIEVEMENT_BELOW_THRESHOLD'); end if;
    v_status:=case when cardinality(v_codes)=0 then 'mastered' else 'not_yet_mastered' end;
  end if;
  v_codes:=coalesce((select array_agg(distinct code order by code) from unnest(v_codes) code),'{}');

  insert into public.topic_mastery_evaluations(student_id,curriculum_topic_id,curriculum_version_id,topic_mastery_policy_id,policy_version,assessment_session_id,assessment_type,overall_achievement,critical_skill_coverage,reasoning_achievement,reasoning_evidence_count,status,reason_codes,evaluation_algorithm_version)
  values(v_session.student_id,v_session.curriculum_topic_id,v_session.curriculum_version_id,v_session.topic_mastery_policy_id,coalesce((v_session.policy_snapshot->>'version')::integer,1),v_session.id,v_session.assessment_type,v_overall,v_critical_coverage,v_reasoning_achievement,v_reasoning_total,v_status,v_codes,'grade9-term1-assessment-v3-assignment-skill-weighted') returning id into v_eval;

  insert into public.topic_mastery_evaluation_skill_evidence(topic_mastery_evaluation_id,skill_id,is_critical,formal_question_count,formal_correct_count,assignment_evidence_count,assignment_equivalent_correct_count,total_independent_evidence_count,achievement,evidence_state,evidence_provenance)
  select v_eval,(skill->>'skillId')::uuid,coalesce((skill->>'isCritical')::boolean,false),formal.total,formal.correct,assignment.total,assignment.correct,formal.total+assignment.total,
    case when formal.total+assignment.total=0 then null else round(100*(formal.correct+assignment.correct)::numeric/(formal.total+assignment.total),2) end,
    case when formal.total+assignment.total<v_min_q then 'insufficient' when round(100*(formal.correct+assignment.correct)::numeric/nullif(formal.total+assignment.total,0),2)<v_critical_threshold then 'below_threshold' else 'sufficient' end,
    assignment.provenance
  from jsonb_array_elements(coalesce(v_session.policy_snapshot->'skills','[]'::jsonb)) skill
  cross join lateral (
    select count(distinct question.question_version_id)::smallint total,count(*) filter(where result.is_correct)::smallint correct
    from public.learning_assessment_session_question_results result join public.learning_assessment_session_questions question on question.id=result.learning_assessment_session_question_id
    where result.learning_assessment_session_id=p_session_id and result.skill_id=(skill->>'skillId')::uuid
  ) formal
  cross join lateral (
    select coalesce(sum(contribution_count),0)::smallint total,coalesce(sum(equivalent_correct_count),0)::smallint correct,
      coalesce(jsonb_agg(jsonb_build_object('evidenceId',evidence_id,'basis',evidence_basis,'sourceSnapshot',source_snapshot,'independentCount',contribution_count,'equivalentCorrectCount',equivalent_correct_count,'achievement',achievement) order by evidence_id),'[]'::jsonb) provenance
    from public.assignment_evidence_for_mastery_session(p_session_id,(skill->>'skillId')::uuid,false)
  ) assignment;

  insert into public.topic_mastery_evaluation_evidence(topic_mastery_evaluation_id,learning_assessment_session_question_result_id)
  select v_eval,id from public.learning_assessment_session_question_results where learning_assessment_session_id=p_session_id;
  insert into public.topic_mastery_evaluation_evidence(topic_mastery_evaluation_id,qualifying_assignment_mastery_evidence_id)
  select v_eval,assignment.evidence_id
  from jsonb_array_elements(coalesce(v_session.policy_snapshot->'skills','[]'::jsonb)) skill
  cross join lateral public.assignment_evidence_for_mastery_session(p_session_id,(skill->>'skillId')::uuid,false) assignment
  on conflict do nothing;

  select skill.skill_code into v_focus from public.topic_mastery_evaluation_skill_evidence evidence
  join public.curriculum_skills skill on skill.id=evidence.skill_id
  where evidence.topic_mastery_evaluation_id=v_eval and evidence.is_critical and evidence.evidence_state<>'sufficient'
  order by case evidence.evidence_state when 'below_threshold' then 0 else 1 end,evidence.achievement nulls first,skill.skill_code limit 1;
  update public.learning_assessment_sessions set learner_recommendation=jsonb_build_object('nextStep',case when v_status='mastered' then 'advance_to_dependent_topic' when v_session.assessment_type='topic_baseline' and v_overall>=coalesce(nullif(v_session.policy_snapshot->>'strongBaselineThreshold','')::numeric,90) and v_critical_coverage=100 and v_reasoning_total>=v_reasoning_min and coalesce(v_reasoning_achievement,0)>=v_reasoning_threshold then 'offer_mastery_challenge' when v_reasoning_total<v_reasoning_min or coalesce(v_reasoning_achievement,0)<v_reasoning_threshold then 'targeted_mathematical_reasoning_practice' else 'targeted_remediation' end,'focusSkillCode',v_focus,'reasonCodes',to_jsonb(v_codes)) where id=p_session_id;
  return v_eval;
end;
$$;

create or replace function public.save_topic_mastery_policy_assignment_evidence_requirements(
  p_policy_id uuid, p_assignment_evidence_maximum_question_equivalents smallint
) returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.content_admin_required();
  if p_assignment_evidence_maximum_question_equivalents is null or p_assignment_evidence_maximum_question_equivalents < 0 or p_assignment_evidence_maximum_question_equivalents > 40 then raise exception 'invalid_assignment_evidence_cap' using errcode='22023'; end if;
  update public.topic_mastery_policies set assignment_evidence_maximum_question_equivalents=p_assignment_evidence_maximum_question_equivalents,updated_at=now() where id=p_policy_id and review_status in ('draft','rejected');
  if not found then raise exception 'approved_policy_is_immutable_create_a_revision' using errcode='55000'; end if;
end;
$$;

create or replace function public.create_topic_mastery_policy_revision(p_policy_id uuid,p_name text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_source public.topic_mastery_policies; v_id uuid; v_next integer;
begin
  perform public.content_admin_required(); select * into v_source from public.topic_mastery_policies where id=p_policy_id for share;
  if not found then raise exception 'topic_mastery_policy_not_found' using errcode='P0002'; end if;
  select coalesce(max(version),0)+1 into v_next from public.topic_mastery_policies where curriculum_topic_id=v_source.curriculum_topic_id and code=v_source.code;
  insert into public.topic_mastery_policies(curriculum_topic_id,code,version,name,overall_achievement_threshold,critical_skill_achievement_threshold,minimum_questions_per_critical_skill,critical_skill_coverage_threshold,minimum_reasoning_evidence_count,minimum_reasoning_achievement_threshold,strong_baseline_threshold,requires_mastery_challenge,formal_scored_attempts_per_question,practice_attempts_per_question,allow_qualifying_assignment_evidence,qualifying_assignment_minimum_achievement,assignment_evidence_maximum_question_equivalents,assignment_evidence_combination_version,created_by)
  values(v_source.curriculum_topic_id,v_source.code,v_next,coalesce(nullif(btrim(p_name),''),v_source.name||' v'||v_next),v_source.overall_achievement_threshold,v_source.critical_skill_achievement_threshold,v_source.minimum_questions_per_critical_skill,v_source.critical_skill_coverage_threshold,v_source.minimum_reasoning_evidence_count,v_source.minimum_reasoning_achievement_threshold,v_source.strong_baseline_threshold,v_source.requires_mastery_challenge,1,3,v_source.allow_qualifying_assignment_evidence,v_source.qualifying_assignment_minimum_achievement,v_source.assignment_evidence_maximum_question_equivalents,v_source.assignment_evidence_combination_version,public.current_profile_id()) returning id into v_id;
  insert into public.topic_mastery_policy_skills(topic_mastery_policy_id,skill_id,is_essential,is_critical,requires_reasoning_evidence) select v_id,skill_id,is_essential,is_critical,requires_reasoning_evidence from public.topic_mastery_policy_skills where topic_mastery_policy_id=v_source.id;
  perform public.log_audit_event('learning_configuration.topic_mastery_policy_revision_created','topic_mastery_policy',v_id::text,jsonb_build_object('source_policy_id',v_source.id)); return v_id;
end;
$$;

revoke all on function public.prevent_qualifying_assignment_evidence_mutation(), public.assignment_evidence_for_mastery_session(uuid,uuid,boolean), public.evaluate_topic_mastery_from_assessment_session(uuid), public.start_my_learning_assessment(uuid,uuid), public.save_topic_mastery_policy_assignment_evidence_requirements(uuid,smallint) from public;
grant execute on function public.qualify_assignment_mastery_evidence(uuid,uuid,uuid,numeric,boolean,text,smallint,text,jsonb), public.save_topic_mastery_policy_assignment_evidence_requirements(uuid,smallint) to authenticated;

create or replace function public.get_learning_assessment_management_catalog()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform public.content_admin_required();
  return jsonb_build_object(
    'definitions',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'code',d.code,'formCode',d.form_code,'name',d.name,'description',d.description,'curriculumVersionId',d.curriculum_version_id,'topicId',d.curriculum_topic_id,'topicName',t.name,'topicMasteryPolicyId',d.topic_mastery_policy_id,'assessmentType',d.assessment_type,'assessmentRoute',d.assessment_route,'reassessmentOfDefinitionId',d.reassessment_of_definition_id,'durationMinutes',d.duration_minutes,'questionOrderMode',d.question_order_mode,'solutionReleasePolicy',d.solution_release_policy,'reviewStatus',d.review_status,'questionVersionIds',coalesce((select jsonb_agg(q.question_version_id order by q.display_order) from public.learning_assessment_definition_questions q where q.learning_assessment_definition_id=d.id),'[]'::jsonb),'questionCount',(select count(*) from public.learning_assessment_definition_questions q where q.learning_assessment_definition_id=d.id),'publishedFormVersion',(select f.form_version from public.learning_assessment_form_versions f where f.learning_assessment_definition_id=d.id and f.review_status='approved' and f.retired_at is null order by f.form_version desc limit 1),'publicationValidation',public.get_learning_assessment_publication_validation(d.id)) order by d.updated_at desc) from public.learning_assessment_definitions d left join public.curriculum_topics t on t.id=d.curriculum_topic_id),'[]'::jsonb),
    'policies',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'curriculumTopicId',p.curriculum_topic_id,'code',p.code,'name',p.name,'version',p.version,'reviewStatus',p.review_status,'overallAchievementThreshold',p.overall_achievement_threshold,'criticalSkillAchievementThreshold',p.critical_skill_achievement_threshold,'minimumQuestionsPerCriticalSkill',p.minimum_questions_per_critical_skill,'criticalSkillCoverageThreshold',p.critical_skill_coverage_threshold,'minimumReasoningEvidenceCount',p.minimum_reasoning_evidence_count,'minimumReasoningAchievementThreshold',p.minimum_reasoning_achievement_threshold,'strongBaselineThreshold',p.strong_baseline_threshold,'requiresMasteryChallenge',p.requires_mastery_challenge,'allowQualifyingAssignmentEvidence',p.allow_qualifying_assignment_evidence,'qualifyingAssignmentMinimumAchievement',p.qualifying_assignment_minimum_achievement,'assignmentEvidenceMaximumQuestionEquivalents',p.assignment_evidence_maximum_question_equivalents,'assignmentEvidenceCombinationVersion',p.assignment_evidence_combination_version,'skills',coalesce((select jsonb_agg(jsonb_build_object('skillId',ps.skill_id,'skillCode',s.skill_code,'isEssential',ps.is_essential,'isCritical',ps.is_critical,'requiresReasoningEvidence',ps.requires_reasoning_evidence) order by s.skill_code) from public.topic_mastery_policy_skills ps join public.curriculum_skills s on s.id=ps.skill_id where ps.topic_mastery_policy_id=p.id),'[]'::jsonb)) order by p.code,p.version) from public.topic_mastery_policies p),'[]'::jsonb),
    'questions',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'itemCode',i.item_code,'prompt',v.prompt,'solution',v.solution,'answerConfig',v.answer_config,'skillCode',s.skill_code,'difficulty',v.difficulty,'reasoningClassification',v.reasoning_classification,'reviewStatus',v.review_status) order by i.item_code) from public.question_versions v join public.question_items i on i.id=v.question_item_id join public.question_version_skill_links l on l.question_version_id=v.id and l.relationship_type='primary' join public.curriculum_skills s on s.id=l.skill_id where i.retired_at is null),'[]'::jsonb),
    'contentQa',public.get_grade9_term1_assessment_content_qa(),
    'recentSessions',coalesce((select jsonb_agg(x.payload order by x.created_at desc) from (select ss.created_at,jsonb_build_object('id',ss.id,'status',ss.status,'percentage',ss.percentage,'assessmentType',ss.assessment_type,'submittedAt',ss.submitted_at,'studentId',ss.student_id,'topicName',t.name,'formVersion',f.form_version,'attemptNumber',ss.attempt_number,'reassessmentReason',ss.reassessment_reason,'topicMasteryStatus',e.status,'criticalSkillCoverage',e.critical_skill_coverage,'reasoningAchievement',e.reasoning_achievement) payload from public.learning_assessment_sessions ss join public.learning_assessment_form_versions f on f.id=ss.learning_assessment_form_version_id left join public.curriculum_topics t on t.id=ss.curriculum_topic_id left join public.topic_mastery_evaluations e on e.assessment_session_id=ss.id order by ss.created_at desc limit 50) x),'[]'::jsonb)
  );
end;
$$;

grant execute on function public.start_my_learning_assessment(uuid,uuid), public.get_learning_assessment_management_catalog(), public.get_grade9_term1_assessment_content_qa() to authenticated;
