-- Sprint 2 closure: formal-attempt integrity, durable timeouts, and
-- skill-level mastery evidence.  This migration is additive: existing forms,
-- sessions and evaluations remain historical records.

alter table public.topic_mastery_policies
  add column if not exists critical_skill_achievement_threshold numeric(5,2) not null default 75
    check (critical_skill_achievement_threshold between 0 and 100),
  add column if not exists minimum_questions_per_critical_skill smallint not null default 4
    check (minimum_questions_per_critical_skill between 1 and 40);

alter table public.learning_assessment_definitions
  add column if not exists assessment_route text not null default 'standard'
    check (assessment_route in ('standard', 'reassessment')),
  add column if not exists reassessment_of_definition_id uuid references public.learning_assessment_definitions(id) on delete restrict;

alter table public.learning_assessment_definitions
  drop constraint if exists learning_assessment_definitions_reassessment_route_check;
alter table public.learning_assessment_definitions
  add constraint learning_assessment_definitions_reassessment_route_check check (
    (assessment_route = 'standard' and reassessment_of_definition_id is null)
    or (assessment_route = 'reassessment' and reassessment_of_definition_id is not null and reassessment_of_definition_id <> id)
  );

alter table public.learning_assessment_sessions
  add column if not exists attempt_number smallint not null default 1 check (attempt_number > 0),
  add column if not exists reassessment_reason text;

create table if not exists public.learning_assessment_reassessment_authorizations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  prior_session_id uuid not null references public.learning_assessment_sessions(id) on delete restrict,
  reassessment_definition_id uuid not null references public.learning_assessment_definitions(id) on delete restrict,
  reason text not null check (nullif(btrim(reason), '') is not null),
  authorised_by uuid not null references public.profiles(id) on delete restrict,
  authorised_at timestamptz not null default now(),
  expires_at timestamptz,
  used_by_session_id uuid unique references public.learning_assessment_sessions(id) on delete restrict,
  used_at timestamptz,
  check ((used_by_session_id is null) = (used_at is null))
);
create unique index if not exists learning_assessment_reassessment_authorizations_one_open_idx
  on public.learning_assessment_reassessment_authorizations(student_id, reassessment_definition_id)
  where used_by_session_id is null;

create table if not exists public.topic_mastery_evaluation_skill_evidence (
  id uuid primary key default gen_random_uuid(),
  topic_mastery_evaluation_id uuid not null references public.topic_mastery_evaluations(id) on delete restrict,
  skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  is_critical boolean not null,
  formal_question_count smallint not null check (formal_question_count >= 0),
  formal_correct_count smallint not null check (formal_correct_count >= 0 and formal_correct_count <= formal_question_count),
  achievement numeric(5,2),
  evidence_state text not null check (evidence_state in ('sufficient', 'insufficient', 'below_threshold')),
  unique (topic_mastery_evaluation_id, skill_id)
);

alter table public.learning_assessment_reassessment_authorizations enable row level security;
alter table public.topic_mastery_evaluation_skill_evidence enable row level security;
revoke all on table public.learning_assessment_reassessment_authorizations, public.topic_mastery_evaluation_skill_evidence from anon, authenticated;
grant select on table public.learning_assessment_reassessment_authorizations, public.topic_mastery_evaluation_skill_evidence to authenticated;
create policy "learning_assessment_reassessment_authorizations_admin_read" on public.learning_assessment_reassessment_authorizations for select to authenticated using (public.is_platform_admin());
create policy "topic_mastery_evaluation_skill_evidence_admin_read" on public.topic_mastery_evaluation_skill_evidence for select to authenticated using (public.is_platform_admin());

-- Returns publish blockers as data so the administrator can correct a draft
-- without trial-and-error SQL exceptions.  The publisher repeats these checks.
create or replace function public.get_learning_assessment_publication_validation(p_assessment_definition_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_definition public.learning_assessment_definitions; v_errors text[] := '{}'; v_missing integer; v_reasoning integer;
begin
  perform public.content_admin_required();
  select * into v_definition from public.learning_assessment_definitions where id = p_assessment_definition_id;
  if not found then return jsonb_build_object('valid', false, 'errors', jsonb_build_array('ASSESSMENT_NOT_FOUND')); end if;
  if v_definition.review_status <> 'approved' then v_errors := array_append(v_errors, 'ASSESSMENT_DEFINITION_NOT_APPROVED'); end if;
  if not exists (select 1 from public.learning_assessment_definition_questions where learning_assessment_definition_id = v_definition.id) then v_errors := array_append(v_errors, 'NO_QUESTIONS'); end if;
  if exists (select 1 from public.learning_assessment_definition_questions q join public.question_versions v on v.id=q.question_version_id join public.question_items i on i.id=v.question_item_id where q.learning_assessment_definition_id=v_definition.id and (v.review_status <> 'approved' or i.retired_at is not null or v.answer_config->>'type' <> 'multiple_choice' or cardinality(public.validate_learning_answer_config(v.answer_config)) > 0)) then v_errors := array_append(v_errors, 'QUESTION_NOT_APPROVED_OR_INVALID'); end if;
  if v_definition.topic_mastery_policy_id is not null then
    if not exists (select 1 from public.topic_mastery_policies p where p.id=v_definition.topic_mastery_policy_id and p.review_status='approved') then v_errors := array_append(v_errors, 'POLICY_NOT_APPROVED'); end if;
    select count(*) into v_reasoning from public.learning_assessment_definition_questions q join public.question_versions v on v.id=q.question_version_id where q.learning_assessment_definition_id=v_definition.id and v.reasoning_classification='mathematical_reasoning';
    if v_reasoning < (select minimum_reasoning_evidence_count from public.topic_mastery_policies where id=v_definition.topic_mastery_policy_id) then v_errors := array_append(v_errors, 'INSUFFICIENT_REASONING_QUESTIONS'); end if;
    if v_definition.assessment_type in ('endline','mastery_challenge') then
      select count(*) into v_missing from public.topic_mastery_policy_skills ps where ps.topic_mastery_policy_id=v_definition.topic_mastery_policy_id and ps.is_critical and (select count(distinct q.question_version_id) from public.learning_assessment_definition_questions q join public.question_version_skill_links l on l.question_version_id=q.question_version_id and l.relationship_type='primary' where q.learning_assessment_definition_id=v_definition.id and l.skill_id=ps.skill_id) < (select minimum_questions_per_critical_skill from public.topic_mastery_policies where id=v_definition.topic_mastery_policy_id);
      if v_missing > 0 then v_errors := array_append(v_errors, 'INSUFFICIENT_CRITICAL_SKILL_SAMPLING'); end if;
    end if;
  end if;
  return jsonb_build_object('valid', cardinality(v_errors)=0, 'errors', to_jsonb(v_errors));
end;
$$;

create or replace function public.publish_learning_assessment_form(p_assessment_definition_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_definition public.learning_assessment_definitions; v_form_id uuid; v_next integer; v_count integer; v_validation jsonb;
begin
  perform public.content_admin_required();
  v_validation:=public.get_learning_assessment_publication_validation(p_assessment_definition_id);
  if not coalesce((v_validation->>'valid')::boolean,false) then raise exception 'learning_assessment_publication_invalid:%',v_validation->'errors' using errcode='23514'; end if;
  select * into v_definition from public.learning_assessment_definitions where id=p_assessment_definition_id for update;
  select count(*) into v_count from public.learning_assessment_definition_questions where learning_assessment_definition_id=v_definition.id;
  if exists(select 1 from public.learning_assessment_form_versions f join public.learning_assessment_form_questions fq on fq.learning_assessment_form_version_id=f.id where f.review_status='approved' and f.retired_at is null and f.learning_assessment_definition_id<>v_definition.id group by f.id having count(*) filter(where fq.question_version_id in(select question_version_id from public.learning_assessment_definition_questions where learning_assessment_definition_id=v_definition.id))*2 > least(count(*),v_count)) then raise exception 'learning_assessment_form_not_sufficiently_independent' using errcode='23514'; end if;
  select coalesce(max(form_version),0)+1 into v_next from public.learning_assessment_form_versions where learning_assessment_definition_id=v_definition.id;
  insert into public.learning_assessment_form_versions(learning_assessment_definition_id,topic_mastery_policy_id,form_version,review_status,duration_minutes,question_order_mode,solution_release_policy,blueprint_snapshot,published_by,published_at) values(v_definition.id,v_definition.topic_mastery_policy_id,v_next,'approved',v_definition.duration_minutes,v_definition.question_order_mode,v_definition.solution_release_policy,jsonb_build_object('questionCount',v_count,'assessmentType',v_definition.assessment_type,'assessmentRoute',v_definition.assessment_route,'durationMinutes',v_definition.duration_minutes),public.current_profile_id(),now()) returning id into v_form_id;
  insert into public.learning_assessment_form_questions(learning_assessment_form_version_id,question_version_id,primary_skill_id,sequence_number,prompt_snapshot,options_snapshot,marks_snapshot,reasoning_classification) select v_form_id,q.question_version_id,l.skill_id,q.display_order,v.prompt,v.answer_config->'options',v.marks,v.reasoning_classification from public.learning_assessment_definition_questions q join public.question_versions v on v.id=q.question_version_id join public.question_version_skill_links l on l.question_version_id=v.id and l.relationship_type='primary' where q.learning_assessment_definition_id=v_definition.id order by q.display_order;
  perform public.log_audit_event('learning_assessment.form_published','learning_assessment_form_version',v_form_id::text,jsonb_build_object('assessment_definition_id',v_definition.id,'form_version',v_next));
  return v_form_id;
end;
$$;

create or replace function public.authorize_learning_assessment_reassessment(
  p_prior_session_id uuid, p_reassessment_definition_id uuid, p_reason text, p_expires_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_prior public.learning_assessment_sessions; v_target public.learning_assessment_definitions; v_id uuid;
begin
  perform public.content_admin_required();
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reassessment_reason_required' using errcode='23514'; end if;
  select * into v_prior from public.learning_assessment_sessions where id=p_prior_session_id for update;
  if not found or v_prior.status not in ('submitted','timed_out') then raise exception 'completed_prior_assessment_required' using errcode='23514'; end if;
  select * into v_target from public.learning_assessment_definitions where id=p_reassessment_definition_id and assessment_route='reassessment' and review_status='approved';
  if not found or v_target.reassessment_of_definition_id <> v_prior.learning_assessment_definition_id then raise exception 'independent_reassessment_definition_required' using errcode='23514'; end if;
  if exists (select 1 from public.topic_mastery_evaluations e where e.student_id=v_prior.student_id and e.curriculum_topic_id=v_prior.curriculum_topic_id and e.status='mastered') then raise exception 'mastered_student_does_not_require_reassessment' using errcode='23514'; end if;
  if not exists (select 1 from public.learning_assessment_form_versions f where f.learning_assessment_definition_id=v_target.id and f.review_status='approved' and f.retired_at is null) then raise exception 'reassessment_form_not_published' using errcode='23514'; end if;
  if exists (select 1 from public.learning_assessment_form_questions old_q join public.learning_assessment_form_questions new_q on new_q.question_version_id=old_q.question_version_id join public.learning_assessment_form_versions new_f on new_f.id=new_q.learning_assessment_form_version_id where old_q.learning_assessment_form_version_id=v_prior.learning_assessment_form_version_id and new_f.learning_assessment_definition_id=v_target.id and new_f.review_status='approved' and new_f.retired_at is null group by new_f.id having count(*) * 2 >= least((select count(*) from public.learning_assessment_form_questions where learning_assessment_form_version_id=v_prior.learning_assessment_form_version_id),(select count(*) from public.learning_assessment_form_questions where learning_assessment_form_version_id=new_f.id))) then raise exception 'reassessment_form_not_sufficiently_independent' using errcode='23514'; end if;
  insert into public.learning_assessment_reassessment_authorizations(student_id,prior_session_id,reassessment_definition_id,reason,authorised_by,expires_at) values(v_prior.student_id,v_prior.id,v_target.id,p_reason,public.current_profile_id(),p_expires_at) returning id into v_id;
  perform public.log_audit_event('learning_assessment.reassessment_authorized','learning_assessment_reassessment_authorization',v_id::text,jsonb_build_object('prior_session_id',p_prior_session_id,'reassessment_definition_id',p_reassessment_definition_id));
  return v_id;
end;
$$;

-- Completed standard forms never re-open.  An explicit authorisation can only
-- unlock a different definition whose independently published form was checked
-- above.  Idempotency returns the original session, never a new attempt.
create or replace function public.learning_assessment_eligibility(p_student_id uuid, p_assessment_definition_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_definition public.learning_assessment_definitions; v_baseline_next_step text;
begin
  select * into v_definition from public.learning_assessment_definitions where id=p_assessment_definition_id;
  if not found then return jsonb_build_object('eligible',false,'reasonCode','ASSESSMENT_UNAVAILABLE'); end if;
  if exists (select 1 from public.learning_assessment_sessions s where s.student_id=p_student_id and s.learning_assessment_definition_id=v_definition.id and s.status='in_progress') then return jsonb_build_object('eligible',true,'reasonCode','RESUME_ACTIVE_SESSION'); end if;
  if v_definition.assessment_route='standard' and exists (select 1 from public.learning_assessment_sessions s where s.student_id=p_student_id and s.learning_assessment_definition_id=v_definition.id and s.status in ('submitted','timed_out')) then return jsonb_build_object('eligible',false,'reasonCode','FORM_ALREADY_COMPLETED'); end if;
  if v_definition.assessment_route='reassessment' then
    return jsonb_build_object('eligible',exists(select 1 from public.learning_assessment_reassessment_authorizations a where a.student_id=p_student_id and a.reassessment_definition_id=v_definition.id and a.used_by_session_id is null and (a.expires_at is null or a.expires_at>now())),'reasonCode',case when exists(select 1 from public.learning_assessment_reassessment_authorizations a where a.student_id=p_student_id and a.reassessment_definition_id=v_definition.id and a.used_by_session_id is null and (a.expires_at is null or a.expires_at>now())) then 'AUTHORIZED_REASSESSMENT_AVAILABLE' else 'REASSESSMENT_AUTHORIZATION_REQUIRED' end);
  end if;
  if v_definition.assessment_type in ('entry_baseline','topic_baseline') then return jsonb_build_object('eligible',true,'reasonCode','BASELINE_AVAILABLE'); end if;
  if exists(select 1 from public.topic_mastery_evaluations e where e.student_id=p_student_id and e.curriculum_topic_id=v_definition.curriculum_topic_id and e.status='mastered') then return jsonb_build_object('eligible',false,'reasonCode','TOPIC_ALREADY_MASTERED'); end if;
  select s.learner_recommendation->>'nextStep' into v_baseline_next_step from public.topic_mastery_evaluations e join public.learning_assessment_sessions s on s.id=e.assessment_session_id where e.student_id=p_student_id and e.curriculum_topic_id=v_definition.curriculum_topic_id and e.assessment_type='topic_baseline' order by e.determined_at desc limit 1;
  if v_definition.assessment_type='endline' then return jsonb_build_object('eligible',v_baseline_next_step is not null,'reasonCode',case when v_baseline_next_step is null then 'TOPIC_BASELINE_REQUIRED' else 'BASELINE_COMPLETE' end); end if;
  return jsonb_build_object('eligible',v_baseline_next_step='offer_mastery_challenge','reasonCode',case when v_baseline_next_step='offer_mastery_challenge' then 'STRONG_BASELINE_CHALLENGE_AVAILABLE' else 'STRONG_BASELINE_REQUIRED' end);
end;
$$;

-- Durable expiry: this returns successfully after the scorer commits.  The
-- next GET exposes timed_out; no exception can roll back finalisation.
create or replace function public.save_my_learning_assessment_answer(p_session_id uuid,p_session_question_id uuid,p_selected_option text,p_idempotency_key uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_session public.learning_assessment_sessions; v_event public.learning_assessment_session_answer_events; v_event_id uuid:=gen_random_uuid();
begin
  v_session:=public.assert_learning_assessment_session_owner(p_session_id);
  if p_selected_option not in ('A','B','C','D') then raise exception 'assessment_answer_must_be_a_to_d' using errcode='22023'; end if;
  if v_session.status <> 'in_progress' then raise exception 'assessment_session_not_in_progress' using errcode='23514'; end if;
  if now() >= v_session.expires_at then perform public.finalize_learning_assessment_session(p_session_id,'timed_out'); return; end if;
  if not exists(select 1 from public.learning_assessment_session_questions where id=p_session_question_id and learning_assessment_session_id=p_session_id) then raise exception 'assessment_question_not_found' using errcode='P0002'; end if;
  select * into v_event from public.learning_assessment_session_answer_events where learning_assessment_session_id=p_session_id and idempotency_key=p_idempotency_key;
  if found then if v_event.learning_assessment_session_question_id <> p_session_question_id or v_event.selected_option <> p_selected_option then raise exception 'assessment_answer_idempotency_key_reused_with_different_payload' using errcode='23505'; end if; return; end if;
  insert into public.learning_assessment_session_answer_events(id,learning_assessment_session_id,learning_assessment_session_question_id,selected_option,idempotency_key) values(v_event_id,p_session_id,p_session_question_id,p_selected_option,p_idempotency_key);
  insert into public.learning_assessment_session_answers(learning_assessment_session_question_id,selected_option,revision_number,last_event_id) values(p_session_question_id,p_selected_option,1,v_event_id) on conflict(learning_assessment_session_question_id) do update set selected_option=excluded.selected_option,revision_number=public.learning_assessment_session_answers.revision_number+1,last_event_id=excluded.last_event_id,updated_at=now();
end;
$$;

revoke all on function public.get_learning_assessment_publication_validation(uuid), public.authorize_learning_assessment_reassessment(uuid,uuid,text,timestamptz) from public;
grant execute on function public.get_learning_assessment_publication_validation(uuid), public.authorize_learning_assessment_reassessment(uuid,uuid,text,timestamptz) to authenticated;

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
  if v_definition.assessment_route='reassessment' then
    select * into v_authorization from public.learning_assessment_reassessment_authorizations where student_id=v_student_id and reassessment_definition_id=v_definition.id and used_by_session_id is null and (expires_at is null or expires_at>now()) order by authorised_at for update skip locked limit 1;
    if not found then raise exception 'reassessment_authorization_required' using errcode='23514'; end if;
  end if;
  select * into v_form from public.learning_assessment_form_versions where learning_assessment_definition_id=v_definition.id and review_status='approved' and retired_at is null order by form_version desc limit 1;
  if not found then raise exception 'learning_assessment_has_no_published_form' using errcode='23514'; end if;
  if v_form.topic_mastery_policy_id is not null then
    select jsonb_build_object('policyId',p.id,'version',p.version,'overallAchievementThreshold',p.overall_achievement_threshold,'criticalSkillAchievementThreshold',p.critical_skill_achievement_threshold,'minimumQuestionsPerCriticalSkill',p.minimum_questions_per_critical_skill,'minimumReasoningEvidenceCount',p.minimum_reasoning_evidence_count,'minimumReasoningAchievementThreshold',p.minimum_reasoning_achievement_threshold,'strongBaselineThreshold',p.strong_baseline_threshold,'requiresMasteryChallenge',p.requires_mastery_challenge,'allowQualifyingAssignmentEvidence',p.allow_qualifying_assignment_evidence,'qualifyingAssignmentMinimumAchievement',p.qualifying_assignment_minimum_achievement,'skills',coalesce((select jsonb_agg(jsonb_build_object('skillId',s.skill_id,'isEssential',s.is_essential,'isCritical',s.is_critical,'requiresReasoningEvidence',s.requires_reasoning_evidence) order by s.skill_id) from public.topic_mastery_policy_skills s where s.topic_mastery_policy_id=p.id),'[]'::jsonb)) into v_policy_snapshot from public.topic_mastery_policies p where p.id=v_form.topic_mastery_policy_id;
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
declare v_session public.learning_assessment_sessions; v_eval uuid; v_overall numeric(5,2); v_critical_total integer:=0; v_critical_pass integer:=0; v_reasoning_total integer:=0; v_reasoning_correct integer:=0; v_reasoning_achievement numeric(5,2); v_critical_coverage numeric(5,2); v_min_q integer; v_critical_threshold numeric; v_overall_threshold numeric; v_reasoning_min integer; v_reasoning_threshold numeric; v_status text; v_codes text[]:='{}'; v_missing_critical boolean:=false; v_weak_critical boolean:=false; v_focus text;
begin
  select * into v_session from public.learning_assessment_sessions where id=p_session_id;
  if not found or v_session.curriculum_topic_id is null or v_session.topic_mastery_policy_id is null then return null; end if;
  if exists(select 1 from public.topic_mastery_evaluations where assessment_session_id=p_session_id) then return (select id from public.topic_mastery_evaluations where assessment_session_id=p_session_id); end if;
  v_overall:=coalesce(v_session.percentage,0);
  v_min_q:=coalesce(nullif(v_session.policy_snapshot->>'minimumQuestionsPerCriticalSkill','')::integer,1);
  v_critical_threshold:=coalesce(nullif(v_session.policy_snapshot->>'criticalSkillAchievementThreshold','')::numeric,75);
  v_overall_threshold:=coalesce(nullif(v_session.policy_snapshot->>'overallAchievementThreshold','')::numeric,80);
  v_reasoning_min:=coalesce(nullif(v_session.policy_snapshot->>'minimumReasoningEvidenceCount','')::integer,0);
  v_reasoning_threshold:=coalesce(nullif(v_session.policy_snapshot->>'minimumReasoningAchievementThreshold','')::numeric,80);
  select count(*),count(*) filter(where r.is_correct) into v_reasoning_total,v_reasoning_correct from public.learning_assessment_session_question_results r where r.learning_assessment_session_id=p_session_id and r.reasoning_classification='mathematical_reasoning';
  v_reasoning_achievement:=case when v_reasoning_total=0 then null else round(100*v_reasoning_correct::numeric/v_reasoning_total,2) end;
  if v_session.assessment_type='topic_baseline' then v_status:='evidence_incomplete'; v_codes:=array['BASELINE_PLACEMENT_EVIDENCE_ONLY']; else
    if v_overall<v_overall_threshold then v_codes:=array_append(v_codes,'OVERALL_ACHIEVEMENT_BELOW_THRESHOLD'); end if;
    if v_reasoning_total<v_reasoning_min then v_codes:=array_append(v_codes,'MISSING_MATHEMATICAL_REASONING_EVIDENCE'); end if;
    if v_reasoning_achievement is null or v_reasoning_achievement<v_reasoning_threshold then v_codes:=array_append(v_codes,'MATHEMATICAL_REASONING_ACHIEVEMENT_BELOW_THRESHOLD'); end if;
  end if;
  select count(*),count(*) filter(where stats.total>=v_min_q and round(100*stats.correct::numeric/nullif(stats.total,0),2)>=v_critical_threshold),coalesce(bool_or(stats.total<v_min_q),false),coalesce(bool_or(stats.total>=v_min_q and round(100*stats.correct::numeric/nullif(stats.total,0),2)<v_critical_threshold),false) into v_critical_total,v_critical_pass,v_missing_critical,v_weak_critical from jsonb_array_elements(coalesce(v_session.policy_snapshot->'skills','[]'::jsonb)) skill join lateral(select count(distinct q.question_version_id)::smallint total,count(*) filter(where r.is_correct)::smallint correct from public.learning_assessment_session_question_results r join public.learning_assessment_session_questions q on q.id=r.learning_assessment_session_question_id where r.learning_assessment_session_id=p_session_id and r.skill_id=(skill->>'skillId')::uuid) stats on true where coalesce((skill->>'isCritical')::boolean,false);
  v_critical_coverage:=case when v_critical_total=0 then 100 else round(100*v_critical_pass::numeric/v_critical_total,2) end;
  if v_session.assessment_type <> 'topic_baseline' then if v_missing_critical then v_codes:=array_append(v_codes,'INSUFFICIENT_CRITICAL_SKILL_EVIDENCE'); end if; if v_weak_critical then v_codes:=array_append(v_codes,'CRITICAL_SKILL_ACHIEVEMENT_BELOW_THRESHOLD'); end if; v_status:=case when cardinality(v_codes)=0 then 'mastered' else 'not_yet_mastered' end; end if;
  v_codes:=coalesce((select array_agg(distinct x order by x) from unnest(v_codes) x),'{}');
  insert into public.topic_mastery_evaluations(student_id,curriculum_topic_id,curriculum_version_id,topic_mastery_policy_id,policy_version,assessment_session_id,assessment_type,overall_achievement,critical_skill_coverage,reasoning_achievement,reasoning_evidence_count,status,reason_codes,evaluation_algorithm_version) values(v_session.student_id,v_session.curriculum_topic_id,v_session.curriculum_version_id,v_session.topic_mastery_policy_id,coalesce((v_session.policy_snapshot->>'version')::integer,1),v_session.id,v_session.assessment_type,v_overall,v_critical_coverage,v_reasoning_achievement,v_reasoning_total,v_status,v_codes,'grade9-term1-assessment-v2') returning id into v_eval;
  insert into public.topic_mastery_evaluation_skill_evidence(topic_mastery_evaluation_id,skill_id,is_critical,formal_question_count,formal_correct_count,achievement,evidence_state)
  select v_eval,(skill->>'skillId')::uuid,coalesce((skill->>'isCritical')::boolean,false),coalesce(stats.total,0),coalesce(stats.correct,0),case when coalesce(stats.total,0)=0 then null else round(100*stats.correct::numeric/stats.total,2) end,case when coalesce(stats.total,0)<v_min_q then 'insufficient' when round(100*stats.correct::numeric/nullif(stats.total,0),2)<v_critical_threshold then 'below_threshold' else 'sufficient' end from jsonb_array_elements(coalesce(v_session.policy_snapshot->'skills','[]'::jsonb)) skill left join lateral(select count(distinct q.question_version_id)::smallint total,count(*) filter(where r.is_correct)::smallint correct from public.learning_assessment_session_question_results r join public.learning_assessment_session_questions q on q.id=r.learning_assessment_session_question_id where r.learning_assessment_session_id=p_session_id and r.skill_id=(skill->>'skillId')::uuid) stats on true;
  insert into public.topic_mastery_evaluation_evidence(topic_mastery_evaluation_id,learning_assessment_session_question_result_id) select v_eval,id from public.learning_assessment_session_question_results where learning_assessment_session_id=p_session_id;
  insert into public.topic_mastery_evaluation_evidence(topic_mastery_evaluation_id,qualifying_assignment_mastery_evidence_id) select v_eval,a.id from public.qualifying_assignment_mastery_evidence a where a.topic_mastery_policy_id=v_session.topic_mastery_policy_id and a.student_id=v_session.student_id and a.skill_id in(select (s->>'skillId')::uuid from jsonb_array_elements(coalesce(v_session.policy_snapshot->'skills','[]'::jsonb)) s) and not exists(select 1 from public.topic_mastery_evaluation_evidence e where e.qualifying_assignment_mastery_evidence_id=a.id) on conflict do nothing;
  select s.skill_code into v_focus from public.topic_mastery_evaluation_skill_evidence e join public.curriculum_skills s on s.id=e.skill_id where e.topic_mastery_evaluation_id=v_eval and e.is_critical and e.evidence_state <> 'sufficient' order by e.evidence_state desc,e.achievement nulls first,s.skill_code limit 1;
  update public.learning_assessment_sessions set learner_recommendation=jsonb_build_object('nextStep',case when v_status='mastered' then 'advance_to_dependent_topic' when v_session.assessment_type='topic_baseline' and v_overall>=coalesce(nullif(v_session.policy_snapshot->>'strongBaselineThreshold','')::numeric,90) and v_critical_coverage=100 and v_reasoning_total>=v_reasoning_min and coalesce(v_reasoning_achievement,0)>=v_reasoning_threshold then 'offer_mastery_challenge' when v_reasoning_total<v_reasoning_min or coalesce(v_reasoning_achievement,0)<v_reasoning_threshold then 'targeted_mathematical_reasoning_practice' else 'targeted_remediation' end,'focusSkillCode',v_focus,'reasonCodes',to_jsonb(v_codes)) where id=p_session_id;
  return v_eval;
end;
$$;

create or replace function public.save_topic_mastery_policy_evidence_requirements(
  p_policy_id uuid, p_critical_skill_achievement_threshold numeric, p_minimum_questions_per_critical_skill smallint
) returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.content_admin_required();
  if p_critical_skill_achievement_threshold is null or p_critical_skill_achievement_threshold < 0 or p_critical_skill_achievement_threshold > 100 or p_minimum_questions_per_critical_skill is null or p_minimum_questions_per_critical_skill < 1 then raise exception 'invalid_mastery_evidence_requirements' using errcode='22023'; end if;
  update public.topic_mastery_policies set critical_skill_achievement_threshold=p_critical_skill_achievement_threshold,minimum_questions_per_critical_skill=p_minimum_questions_per_critical_skill,updated_at=now() where id=p_policy_id and review_status in ('draft','rejected');
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
  insert into public.topic_mastery_policies(curriculum_topic_id,code,version,name,overall_achievement_threshold,critical_skill_achievement_threshold,minimum_questions_per_critical_skill,critical_skill_coverage_threshold,minimum_reasoning_evidence_count,minimum_reasoning_achievement_threshold,strong_baseline_threshold,requires_mastery_challenge,formal_scored_attempts_per_question,practice_attempts_per_question,allow_qualifying_assignment_evidence,qualifying_assignment_minimum_achievement,created_by) values(v_source.curriculum_topic_id,v_source.code,v_next,coalesce(nullif(btrim(p_name),''),v_source.name||' v'||v_next),v_source.overall_achievement_threshold,v_source.critical_skill_achievement_threshold,v_source.minimum_questions_per_critical_skill,v_source.critical_skill_coverage_threshold,v_source.minimum_reasoning_evidence_count,v_source.minimum_reasoning_achievement_threshold,v_source.strong_baseline_threshold,v_source.requires_mastery_challenge,1,3,v_source.allow_qualifying_assignment_evidence,v_source.qualifying_assignment_minimum_achievement,public.current_profile_id()) returning id into v_id;
  insert into public.topic_mastery_policy_skills(topic_mastery_policy_id,skill_id,is_essential,is_critical,requires_reasoning_evidence) select v_id,skill_id,is_essential,is_critical,requires_reasoning_evidence from public.topic_mastery_policy_skills where topic_mastery_policy_id=v_source.id;
  perform public.log_audit_event('learning_configuration.topic_mastery_policy_revision_created','topic_mastery_policy',v_id::text,jsonb_build_object('source_policy_id',v_source.id)); return v_id;
end;
$$;

create or replace function public.create_learning_assessment_revision(p_assessment_definition_id uuid,p_code text,p_form_code text,p_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_source public.learning_assessment_definitions; v_id uuid;
begin
  perform public.content_admin_required();
  if nullif(btrim(coalesce(p_code,'')),'') is null or nullif(btrim(coalesce(p_form_code,'')),'') is null or nullif(btrim(coalesce(p_name,'')),'') is null then raise exception 'assessment_revision_code_form_code_and_name_required' using errcode='23514'; end if;
  select * into v_source from public.learning_assessment_definitions where id=p_assessment_definition_id for share; if not found then raise exception 'learning_assessment_not_found' using errcode='P0002'; end if;
  insert into public.learning_assessment_definitions(curriculum_version_id,curriculum_topic_id,topic_mastery_policy_id,code,form_code,name,assessment_type,assessment_route,reassessment_of_definition_id,description,duration_minutes,scored_attempts_per_question,question_order_mode,solution_release_policy,created_by) values(v_source.curriculum_version_id,v_source.curriculum_topic_id,v_source.topic_mastery_policy_id,p_code,p_form_code,p_name,v_source.assessment_type,v_source.assessment_route,v_source.reassessment_of_definition_id,v_source.description,v_source.duration_minutes,1,v_source.question_order_mode,v_source.solution_release_policy,public.current_profile_id()) returning id into v_id;
  insert into public.learning_assessment_definition_questions(learning_assessment_definition_id,question_version_id,display_order) select v_id,question_version_id,display_order from public.learning_assessment_definition_questions where learning_assessment_definition_id=v_source.id order by display_order;
  perform public.log_audit_event('learning_configuration.assessment_revision_created','learning_assessment_definition',v_id::text,jsonb_build_object('source_assessment_definition_id',v_source.id)); return v_id;
end;
$$;

revoke all on function public.save_topic_mastery_policy_evidence_requirements(uuid,numeric,smallint) from public;
grant execute on function public.save_topic_mastery_policy_evidence_requirements(uuid,numeric,smallint) to authenticated;

create or replace function public.get_learning_assessment_management_catalog()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform public.content_admin_required();
  return jsonb_build_object(
    'definitions',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'code',d.code,'formCode',d.form_code,'name',d.name,'description',d.description,'curriculumVersionId',d.curriculum_version_id,'topicId',d.curriculum_topic_id,'topicName',t.name,'topicMasteryPolicyId',d.topic_mastery_policy_id,'assessmentType',d.assessment_type,'assessmentRoute',d.assessment_route,'reassessmentOfDefinitionId',d.reassessment_of_definition_id,'durationMinutes',d.duration_minutes,'questionOrderMode',d.question_order_mode,'solutionReleasePolicy',d.solution_release_policy,'reviewStatus',d.review_status,'questionVersionIds',coalesce((select jsonb_agg(q.question_version_id order by q.display_order) from public.learning_assessment_definition_questions q where q.learning_assessment_definition_id=d.id),'[]'::jsonb),'questionCount',(select count(*) from public.learning_assessment_definition_questions q where q.learning_assessment_definition_id=d.id),'publishedFormVersion',(select f.form_version from public.learning_assessment_form_versions f where f.learning_assessment_definition_id=d.id and f.review_status='approved' and f.retired_at is null order by f.form_version desc limit 1),'publicationValidation',public.get_learning_assessment_publication_validation(d.id)) order by d.updated_at desc) from public.learning_assessment_definitions d left join public.curriculum_topics t on t.id=d.curriculum_topic_id),'[]'::jsonb),
    'policies',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'curriculumTopicId',p.curriculum_topic_id,'code',p.code,'name',p.name,'version',p.version,'reviewStatus',p.review_status,'overallAchievementThreshold',p.overall_achievement_threshold,'criticalSkillAchievementThreshold',p.critical_skill_achievement_threshold,'minimumQuestionsPerCriticalSkill',p.minimum_questions_per_critical_skill,'criticalSkillCoverageThreshold',p.critical_skill_coverage_threshold,'minimumReasoningEvidenceCount',p.minimum_reasoning_evidence_count,'minimumReasoningAchievementThreshold',p.minimum_reasoning_achievement_threshold,'strongBaselineThreshold',p.strong_baseline_threshold,'requiresMasteryChallenge',p.requires_mastery_challenge,'allowQualifyingAssignmentEvidence',p.allow_qualifying_assignment_evidence,'qualifyingAssignmentMinimumAchievement',p.qualifying_assignment_minimum_achievement,'skills',coalesce((select jsonb_agg(jsonb_build_object('skillId',ps.skill_id,'skillCode',s.skill_code,'isEssential',ps.is_essential,'isCritical',ps.is_critical,'requiresReasoningEvidence',ps.requires_reasoning_evidence) order by s.skill_code) from public.topic_mastery_policy_skills ps join public.curriculum_skills s on s.id=ps.skill_id where ps.topic_mastery_policy_id=p.id),'[]'::jsonb)) order by p.code,p.version) from public.topic_mastery_policies p),'[]'::jsonb),
    'questions',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'itemCode',i.item_code,'prompt',v.prompt,'skillCode',s.skill_code,'difficulty',v.difficulty,'reasoningClassification',v.reasoning_classification) order by i.item_code) from public.question_versions v join public.question_items i on i.id=v.question_item_id join public.question_version_skill_links l on l.question_version_id=v.id and l.relationship_type='primary' join public.curriculum_skills s on s.id=l.skill_id where v.review_status='approved' and i.retired_at is null),'[]'::jsonb),
    'recentSessions',coalesce((select jsonb_agg(x.payload order by x.created_at desc) from (select ss.created_at,jsonb_build_object('id',ss.id,'status',ss.status,'percentage',ss.percentage,'assessmentType',ss.assessment_type,'submittedAt',ss.submitted_at,'studentId',ss.student_id,'topicName',t.name,'formVersion',f.form_version,'attemptNumber',ss.attempt_number,'reassessmentReason',ss.reassessment_reason,'topicMasteryStatus',e.status,'criticalSkillCoverage',e.critical_skill_coverage,'reasoningAchievement',e.reasoning_achievement) payload from public.learning_assessment_sessions ss join public.learning_assessment_form_versions f on f.id=ss.learning_assessment_form_version_id left join public.curriculum_topics t on t.id=ss.curriculum_topic_id left join public.topic_mastery_evaluations e on e.assessment_session_id=ss.id order by ss.created_at desc limit 50) x),'[]'::jsonb)
  );
end;
$$;
