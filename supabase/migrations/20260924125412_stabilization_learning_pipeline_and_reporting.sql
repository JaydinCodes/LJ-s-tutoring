-- Final learning-loop stabilisation. All decisions remain append-only and
-- service-authoritative; this migration does not rewrite historical evidence.
create table public.learning_misconception_rule_sets (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version integer not null,
  minimum_independent_correct_attempts integer not null check (minimum_independent_correct_attempts > 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique(code, version)
);
create unique index learning_misconception_rules_active_idx on public.learning_misconception_rule_sets ((is_active)) where is_active;
alter table public.learning_misconception_rule_sets enable row level security;
insert into public.learning_misconception_rule_sets(code,version,minimum_independent_correct_attempts,is_active)
values ('grade9_default',1,2,true) on conflict(code,version) do nothing;

-- A resolution is a new historical state, never an update/delete of the
-- original observation. Corrective attempts must be independent and occur
-- after the most recent independent linked error.
create or replace function public.reconcile_automatic_learner_misconceptions(p_student_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_rule public.learning_misconception_rule_sets; v_inserted integer:=0;
begin
  if auth.role() <> 'service_role' then raise exception 'not_authorized' using errcode='42501'; end if;
  select * into v_rule from public.learning_misconception_rule_sets where is_active limit 1;
  if v_rule.id is null then raise exception 'misconception_rule_set_not_configured'; end if;
  with latest as (
    select distinct on (learner.misconception_id) learner.id,learner.misconception_id,learner.state
    from public.learner_misconceptions learner where learner.student_id=p_student_id
    order by learner.misconception_id,learner.determined_at desc,learner.id desc
  ), last_error as (
    select latest.misconception_id,max(attempt.occurred_at) as occurred_at
    from latest join public.learner_misconception_evidence linked on linked.learner_misconception_id=latest.id
    join public.learning_attempts attempt on attempt.id=linked.learning_attempt_id
    join public.learning_attempt_skill_evidence evidence on evidence.learning_attempt_id=attempt.id
    where latest.state in ('suspected','confirmed') and evidence.independence='independent' and not evidence.correct
    group by latest.misconception_id
  ), corrective as (
    select latest.misconception_id,array_agg(distinct evidence.learning_attempt_id) as attempt_ids
    from latest join last_error on last_error.misconception_id=latest.misconception_id
    join public.question_version_misconceptions mapping on mapping.misconception_id=latest.misconception_id
    join public.learning_attempts attempt on attempt.student_id=p_student_id and attempt.question_version_id=mapping.question_version_id and attempt.occurred_at>last_error.occurred_at
    join public.learning_attempt_skill_evidence evidence on evidence.learning_attempt_id=attempt.id
    where latest.state in ('suspected','confirmed') and evidence.independence='independent' and evidence.correct
    group by latest.misconception_id having count(distinct evidence.learning_attempt_id)>=v_rule.minimum_independent_correct_attempts
  ), inserted as (
    insert into public.learner_misconceptions(student_id,misconception_id,state,reason)
    select p_student_id,corrective.misconception_id,'resolved'::public.misconception_state,
      'Automatically resolved after configured independent corrective evidence.'
    from corrective returning id,misconception_id
  )
  insert into public.learner_misconception_evidence(learner_misconception_id,learning_attempt_id)
  select inserted.id,attempt_id from inserted join corrective using(misconception_id) cross join lateral unnest(corrective.attempt_ids) attempt_id;
  get diagnostics v_inserted=row_count;
  if v_inserted>0 then perform public.log_audit_event('learning_misconception.automatically_resolved','student',p_student_id::text,jsonb_build_object('corrective_evidence_links',v_inserted)); end if;
  return v_inserted;
end; $$;

-- The server-side counterpart of activityResolver.ts. Recommendations decide
-- *what* support is needed; required stage combinations decide eligibility.
create or replace function public.get_my_next_learning_step()
returns jsonb language sql stable security definer set search_path='' as $$
  with recommendation as (
    select r.*,coalesce(array_agg(reason.reason_code) filter(where reason.reason_code is not null),'{}') reason_codes
    from public.grade9_learning_recommendations r
    left join public.learning_recommendation_reasons reason on reason.recommendation_id=r.id
    where r.student_id=public.current_student_id() and r.status='open'
    group by r.id order by r.created_at desc limit 1
  ), target as (
    select recommendation.*,skill.skill_code,skill.title skill_name
    from recommendation join public.curriculum_skills skill on skill.id=recommendation.skill_id
  ), candidates as (
    select target.skill_id,target.skill_code,target.skill_name,target.reason_codes,target.recommendation_type,
      activity.id activity_id,activity.code,activity.title,activity.description,
      array_agg(stage.stage_type::text) stage_types,count(distinct link.question_version_id) question_count
    from target join public.learning_activity_templates activity on activity.target_skill_id=target.skill_id and activity.review_status='approved'
    join public.learning_activity_stages stage on stage.learning_activity_template_id=activity.id
    left join public.learning_activity_stage_questions link on link.learning_activity_stage_id=stage.id
    where not exists (select 1 from public.learning_activity_stage_questions broken join public.learning_activity_stages broken_stage on broken_stage.id=broken.learning_activity_stage_id join public.question_versions version on version.id=broken.question_version_id join public.question_items item on item.id=version.question_item_id where broken_stage.learning_activity_template_id=activity.id and (version.review_status<>'approved' or item.retired_at is not null))
    group by target.skill_id,target.skill_code,target.skill_name,target.reason_codes,target.recommendation_type,activity.id
  ), selected as (
    select * from candidates where
      case when 'REPEATED_MISCONCEPTION'=any(reason_codes) then stage_types @> array['error_analysis','guided_practice']
           when 'HINT_DEPENDENCY'=any(reason_codes) then stage_types @> array['faded_example','independent_practice']
           when recommendation_type='retrieval_practice' then stage_types @> array['retrieval_warm_up']
           when recommendation_type='prerequisite_remediation' then stage_types @> array['prerequisite_check','guided_practice']
           else stage_types @> array['guided_practice'] end
    order by code limit 1
  ) select coalesce((select jsonb_build_object('activityCode',code,'name',title,'description',description,'targetSkillCode',skill_code,'targetSkillName',skill_name,'estimatedMinutes',greatest(5,least(30,question_count*3)),'learnerReason',case when 'REPEATED_MISCONCEPTION'=any(reason_codes) then 'Let''s compare two similar ideas and practise choosing the right one.' when 'PREREQUISITE_NOT_SECURE'=any(reason_codes) then 'We''re strengthening an earlier skill that will make the next topic easier.' when 'HINT_DEPENDENCY'=any(reason_codes) then 'Let''s gradually reduce support as you practise.' else 'We noticed this skill would benefit from more focused practice.' end) from selected),'null'::jsonb);
$$;

-- Retrieval is evidence at a delay, so it cannot be completed early merely by
-- opening its activity. Due/overdue checks are the only eligible checks.
create or replace function public.complete_my_learning_retention_check(p_retention_check_id uuid, p_activity_code text)
returns text language plpgsql security definer set search_path='' as $$
declare v_check public.learning_retention_checks; v_attempt uuid; v_independent boolean; v_correct boolean; v_outcome text; v_next_stage text; v_next_days integer; v_rule public.learning_retention_rule_sets;
begin
  if public.current_profile_role()<>'student' then raise exception 'not_authorized' using errcode='42501'; end if;
  select * into v_check from public.learning_retention_checks where id=p_retention_check_id and student_id=public.current_student_id() and status='due' and due_at<=now() for update;
  if not found then raise exception 'retention_check_not_due' using errcode='23514'; end if;
  select rule.* into v_rule from public.learning_retention_rule_sets rule where rule.id=v_check.rule_set_id;
  select evidence.learning_attempt_id,evidence.independence='independent',evidence.correct into v_attempt,v_independent,v_correct
  from public.learning_attempt_skill_evidence evidence join public.learning_attempts attempt on attempt.id=evidence.learning_attempt_id join public.learning_activity_stage_questions link on link.question_version_id=attempt.question_version_id join public.learning_activity_stages stage on stage.id=link.learning_activity_stage_id join public.learning_activity_templates template on template.id=stage.learning_activity_template_id
  where attempt.student_id=v_check.student_id and evidence.skill_id=v_check.skill_id and template.code=p_activity_code and template.review_status='approved' and stage.stage_type='delayed_retrieval' and attempt.evaluated_at>=v_check.due_at order by attempt.evaluated_at desc limit 1;
  if v_attempt is null then raise exception 'retention_evidence_not_available' using errcode='23514'; end if;
  v_outcome:=case when v_correct and v_independent then 'passed' when v_correct then 'assisted' else 'failed' end;
  update public.learning_retention_checks set status='completed',outcome=v_outcome,learning_attempt_id=v_attempt,completed_at=now() where id=v_check.id;
  insert into public.learning_retention_check_events(retention_check_id,event_type,metadata) values(v_check.id,'completed',jsonb_build_object('outcome',v_outcome));
  if v_outcome='passed' then v_next_stage:=case v_check.stage when 'short_delay' then 'medium_delay' when 'medium_delay' then 'long_delay' else null end; v_next_days:=case v_check.stage when 'short_delay' then v_rule.medium_delay_days when 'medium_delay' then v_rule.long_delay_days else null end; if v_next_stage is not null then insert into public.learning_retention_checks(student_id,skill_id,source_mastery_evaluation_id,rule_set_id,stage,due_at) values(v_check.student_id,v_check.skill_id,v_check.source_mastery_evaluation_id,v_check.rule_set_id,v_next_stage,now()+make_interval(days=>v_next_days)) on conflict(student_id,skill_id,source_mastery_evaluation_id,stage) do nothing; end if;
  elsif v_outcome='failed' then update public.learning_retention_checks set status='superseded' where student_id=v_check.student_id and skill_id=v_check.skill_id and status in ('scheduled','due'); end if;
  perform public.log_audit_event('learning_retention.completed','learning_retention_check',v_check.id::text,jsonb_build_object('outcome',v_outcome)); return v_outcome;
end; $$;

revoke all on function public.reconcile_automatic_learner_misconceptions(uuid) from public;
grant execute on function public.reconcile_automatic_learner_misconceptions(uuid) to service_role;
