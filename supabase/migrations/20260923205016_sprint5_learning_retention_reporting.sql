-- Sprint 5: server-authoritative delayed retrieval.  The schedule collects
-- evidence; it never assigns mastery states itself.
create table public.learning_retention_rule_sets (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version integer not null,
  short_delay_days integer not null check (short_delay_days > 0),
  medium_delay_days integer not null check (medium_delay_days > short_delay_days),
  long_delay_days integer not null check (long_delay_days > medium_delay_days),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (code, version)
);
create unique index learning_retention_active_rule_set_idx on public.learning_retention_rule_sets ((is_active)) where is_active;

insert into public.learning_retention_rule_sets(code, version, short_delay_days, medium_delay_days, long_delay_days, is_active)
values ('grade9_default', 1, 7, 21, 60, true)
on conflict (code, version) do nothing;

create table public.learning_retention_checks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  source_mastery_evaluation_id uuid not null references public.skill_mastery_evaluations(id) on delete restrict,
  rule_set_id uuid not null references public.learning_retention_rule_sets(id) on delete restrict,
  stage text not null check (stage in ('short_delay', 'medium_delay', 'long_delay')),
  due_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'due', 'completed', 'superseded')),
  outcome text check (outcome in ('passed', 'assisted', 'failed')),
  activity_template_id uuid references public.learning_activity_templates(id) on delete set null,
  learning_attempt_id uuid references public.learning_attempts(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'completed') = (completed_at is not null)),
  unique (student_id, skill_id, source_mastery_evaluation_id, stage)
);
create index learning_retention_due_idx on public.learning_retention_checks(status, due_at) where status in ('scheduled', 'due');
create index learning_retention_student_skill_idx on public.learning_retention_checks(student_id, skill_id, created_at desc);

create table public.learning_retention_check_events (
  id uuid primary key default gen_random_uuid(),
  retention_check_id uuid not null references public.learning_retention_checks(id) on delete cascade,
  event_type text not null check (event_type in ('scheduled', 'due', 'completed', 'superseded')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index learning_retention_events_check_idx on public.learning_retention_check_events(retention_check_id, occurred_at);

alter table public.learning_retention_rule_sets enable row level security;
alter table public.learning_retention_checks enable row level security;
alter table public.learning_retention_check_events enable row level security;
create policy "learning_retention_checks_student_read" on public.learning_retention_checks for select to authenticated using (student_id = public.current_student_id());
create policy "learning_retention_checks_tutor_read" on public.learning_retention_checks for select to authenticated using (public.current_profile_role() in ('tutor','admin') and public.can_access_learning_student(student_id));
create policy "learning_retention_events_student_read" on public.learning_retention_check_events for select to authenticated using (exists (select 1 from public.learning_retention_checks check_row where check_row.id=retention_check_id and check_row.student_id=public.current_student_id()));
create policy "learning_retention_events_tutor_read" on public.learning_retention_check_events for select to authenticated using (exists (select 1 from public.learning_retention_checks check_row where check_row.id=retention_check_id and public.current_profile_role() in ('tutor','admin') and public.can_access_learning_student(check_row.student_id)));

-- Intended for a service-role cron/Edge invocation. It is safe to run more
-- than once: the unique source/stage key turns retries into no-ops.
create or replace function public.materialize_learning_retention_checks(p_as_of timestamptz default now())
returns integer language plpgsql security definer set search_path='' as $$
declare v_rule public.learning_retention_rule_sets; v_created integer := 0;
begin
  if auth.role() <> 'service_role' then raise exception 'not_authorized' using errcode='42501'; end if;
  select * into v_rule from public.learning_retention_rule_sets where is_active order by version desc limit 1;
  if v_rule.id is null then raise exception 'retention_rule_set_not_configured'; end if;
  update public.learning_retention_checks set status='due'
  where status='scheduled' and due_at <= p_as_of;
  insert into public.learning_retention_check_events(retention_check_id,event_type,occurred_at)
  select id,'due',p_as_of from public.learning_retention_checks check_row
  where check_row.status='due' and check_row.due_at <= p_as_of
    and not exists (select 1 from public.learning_retention_check_events event where event.retention_check_id=check_row.id and event.event_type='due');
  insert into public.learning_retention_checks(student_id,skill_id,source_mastery_evaluation_id,rule_set_id,stage,due_at)
  select latest.student_id, latest.skill_id, latest.id, v_rule.id, 'short_delay', latest.determined_at + make_interval(days=>v_rule.short_delay_days)
  from (
    select distinct on (student_id,skill_id) id,student_id,skill_id,state,determined_at
    from public.skill_mastery_evaluations order by student_id,skill_id,determined_at desc,id desc
  ) latest
  where latest.state='secure'
    and not exists (select 1 from public.learning_retention_checks check_row where check_row.student_id=latest.student_id and check_row.skill_id=latest.skill_id and check_row.status in ('scheduled','due'))
  on conflict (student_id,skill_id,source_mastery_evaluation_id,stage) do nothing;
  get diagnostics v_created = row_count;
  insert into public.learning_retention_check_events(retention_check_id,event_type)
  select check_row.id,'scheduled' from public.learning_retention_checks check_row
  where not exists (select 1 from public.learning_retention_check_events event where event.retention_check_id=check_row.id and event.event_type='scheduled');
  return v_created;
end; $$;

create or replace function public.get_my_due_learning_retention_step()
returns jsonb language sql stable security definer set search_path='' as $$
  with due_check as (
    select check_row.*, skill.skill_code, skill.title as skill_name
    from public.learning_retention_checks check_row
    join public.curriculum_skills skill on skill.id=check_row.skill_id
    where check_row.student_id=public.current_student_id() and check_row.status='due'
    order by check_row.due_at, check_row.created_at limit 1
  ), activity as (
    select due_check.id as check_id, template.code, template.title as name, template.description
    from due_check join lateral (
      select template.* from public.learning_activity_templates template
      where template.review_status='approved' and template.target_skill_id=due_check.skill_id
        and exists (select 1 from public.learning_activity_stages stage where stage.learning_activity_template_id=template.id and stage.stage_type='delayed_retrieval')
        and not exists (select 1 from public.learning_activity_stages stage join public.learning_activity_stage_questions link on link.learning_activity_stage_id=stage.id join public.question_versions version on version.id=link.question_version_id join public.question_items item on item.id=version.question_item_id where stage.learning_activity_template_id=template.id and (version.review_status<>'approved' or item.retired_at is not null))
      order by template.code limit 1
    ) template on true
  ) select coalesce((select jsonb_build_object('retentionCheckId',activity.check_id,'activityCode',activity.code,'name',activity.name,'description',activity.description,'targetSkillCode',due_check.skill_code,'targetSkillName',due_check.skill_name,'estimatedMinutes',5,'learnerReason','Let''s check that this skill is still fresh.') from activity join due_check on true), 'null'::jsonb);
$$;

-- Completing a check uses already persisted, server-evaluated evidence. Hints
-- are represented as assisted, never silently promoted to independent success.
create or replace function public.complete_my_learning_retention_check(p_retention_check_id uuid, p_activity_code text)
returns text language plpgsql security definer set search_path='' as $$
declare v_check public.learning_retention_checks; v_attempt uuid; v_independent boolean; v_correct boolean; v_outcome text; v_next_stage text; v_next_days integer; v_rule public.learning_retention_rule_sets;
begin
  if public.current_profile_role()<>'student' then raise exception 'not_authorized' using errcode='42501'; end if;
  select * into v_check from public.learning_retention_checks where id=p_retention_check_id and student_id=public.current_student_id() and status in ('scheduled','due') for update;
  if not found then raise exception 'retention_check_not_available' using errcode='P0002'; end if;
  select rule.* into v_rule from public.learning_retention_rule_sets rule where rule.id=v_check.rule_set_id;
  select evidence.learning_attempt_id, evidence.independence='independent', evidence.correct into v_attempt,v_independent,v_correct
  from public.learning_attempt_skill_evidence evidence join public.learning_attempts attempt on attempt.id=evidence.learning_attempt_id
  join public.learning_activity_stages stage on true join public.learning_activity_templates template on template.id=stage.learning_activity_template_id
  join public.learning_activity_stage_questions link on link.learning_activity_stage_id=stage.id and link.question_version_id=attempt.question_version_id
  where attempt.student_id=v_check.student_id and evidence.skill_id=v_check.skill_id and template.code=p_activity_code and template.review_status='approved'
    and stage.stage_type='delayed_retrieval' and attempt.evaluated_at>=v_check.created_at
  order by attempt.evaluated_at desc limit 1;
  if v_attempt is null then raise exception 'retention_evidence_not_available' using errcode='23514'; end if;
  v_outcome:=case when v_correct and v_independent then 'passed' when v_correct then 'assisted' else 'failed' end;
  update public.learning_retention_checks set status='completed',outcome=v_outcome,learning_attempt_id=v_attempt,completed_at=now() where id=v_check.id;
  insert into public.learning_retention_check_events(retention_check_id,event_type,metadata) values(v_check.id,'completed',jsonb_build_object('outcome',v_outcome));
  if v_outcome='passed' then
    v_next_stage:=case v_check.stage when 'short_delay' then 'medium_delay' when 'medium_delay' then 'long_delay' else null end;
    v_next_days:=case v_check.stage when 'short_delay' then v_rule.medium_delay_days when 'medium_delay' then v_rule.long_delay_days else null end;
    if v_next_stage is not null then
      insert into public.learning_retention_checks(student_id,skill_id,source_mastery_evaluation_id,rule_set_id,stage,due_at)
      values(v_check.student_id,v_check.skill_id,v_check.source_mastery_evaluation_id,v_check.rule_set_id,v_next_stage,now()+make_interval(days=>v_next_days))
      on conflict(student_id,skill_id,source_mastery_evaluation_id,stage) do nothing;
    end if;
  elsif v_outcome='failed' then
    update public.learning_retention_checks set status='superseded' where student_id=v_check.student_id and skill_id=v_check.skill_id and status in ('scheduled','due');
  end if;
  perform public.log_audit_event('learning_retention.completed','learning_retention_check',v_check.id::text,jsonb_build_object('outcome',v_outcome));
  return v_outcome;
end; $$;

create or replace function public.get_my_learning_progress_summary()
returns jsonb language sql stable security definer set search_path='' as $$
 with latest as (select distinct on (evaluation.skill_id) evaluation.skill_id,evaluation.state,evaluation.determined_at from public.skill_mastery_evaluations evaluation where evaluation.student_id=public.current_student_id() order by evaluation.skill_id,evaluation.determined_at desc,evaluation.id desc), history as (select evaluation.skill_id,evaluation.state,evaluation.determined_at,lag(evaluation.state) over(partition by evaluation.skill_id order by evaluation.determined_at,evaluation.id) previous_state from public.skill_mastery_evaluations evaluation where evaluation.student_id=public.current_student_id())
 select jsonb_build_object('skills',coalesce((select jsonb_agg(jsonb_build_object('skillCode',skill.skill_code,'skillName',skill.title,'state',latest.state,'determinedAt',latest.determined_at,'retentionStatus',(select check_row.status from public.learning_retention_checks check_row where check_row.student_id=public.current_student_id() and check_row.skill_id=skill.id and check_row.status in ('scheduled','due') order by check_row.due_at limit 1)) order by skill.title) from latest join public.curriculum_skills skill on skill.id=latest.skill_id),'[]'::jsonb),'recentProgress',coalesce((select jsonb_agg(jsonb_build_object('skillName',skill.title,'state',history.state,'previousState',history.previous_state,'occurredAt',history.determined_at) order by history.determined_at desc) from history join public.curriculum_skills skill on skill.id=history.skill_id where history.previous_state is distinct from history.state limit 8),'[]'::jsonb));
$$;

create or replace function public.get_parent_learning_progress_summary()
returns jsonb language sql stable security definer set search_path='' as $$
 with linked as (select student.id,coalesce(profile.full_name,'Learner') student_name from public.guardians guardian join public.student_guardians link on link.guardian_id=guardian.id and link.status='active' and link.can_receive_reports join public.students student on student.id=link.student_id join public.profiles profile on profile.id=student.profile_id where guardian.profile_id=public.current_profile_id() and public.current_profile_role()='parent'), latest as (select distinct on(evaluation.student_id,evaluation.skill_id) evaluation.student_id,evaluation.skill_id,evaluation.state,evaluation.determined_at from public.skill_mastery_evaluations evaluation join linked on linked.id=evaluation.student_id order by evaluation.student_id,evaluation.skill_id,evaluation.determined_at desc,evaluation.id desc)
 select coalesce(jsonb_agg(jsonb_build_object('studentId',linked.id,'studentName',linked.student_name,'skills',coalesce((select jsonb_agg(jsonb_build_object('skillName',skill.title,'state',latest.state,'determinedAt',latest.determined_at) order by skill.title) from latest join public.curriculum_skills skill on skill.id=latest.skill_id where latest.student_id=linked.id),'[]'::jsonb),'completedActivities',(select count(*) from public.learner_activity_progress progress where progress.student_id=linked.id and progress.status='completed')) order by linked.student_name),'[]'::jsonb) from linked;
$$;

create or replace function public.get_admin_learning_aggregate(p_from timestamptz default null,p_to timestamptz default null)
returns jsonb language sql stable security definer set search_path='' as $$
 with latest as (select distinct on(evaluation.student_id,evaluation.skill_id) evaluation.student_id,evaluation.skill_id,evaluation.state from public.skill_mastery_evaluations evaluation order by evaluation.student_id,evaluation.skill_id,evaluation.determined_at desc,evaluation.id desc)
 select case when public.current_profile_role()='admin' then jsonb_build_object('masteryDistribution',coalesce((select jsonb_object_agg(state,count) from (select state,count(*) from latest group by state) grouped),'{}'::jsonb),'activitiesCompleted',(select count(*) from public.learner_activity_progress where status='completed' and (p_from is null or completed_at>=p_from) and (p_to is null or completed_at<p_to)),'manualReviewsPending',(select count(*) from public.learning_attempt_reviews where status='pending'),'retention',jsonb_build_object('due',(select count(*) from public.learning_retention_checks where status='due'),'completed',(select count(*) from public.learning_retention_checks where status='completed'),'passed',(select count(*) from public.learning_retention_checks where outcome='passed'),'failed',(select count(*) from public.learning_retention_checks where outcome='failed'))) else '{}'::jsonb end;
$$;

revoke all on function public.materialize_learning_retention_checks(timestamptz) from public;
revoke all on function public.complete_my_learning_retention_check(uuid,text) from public;
revoke all on function public.get_my_due_learning_retention_step() from public;
revoke all on function public.get_my_learning_progress_summary() from public;
revoke all on function public.get_parent_learning_progress_summary() from public;
revoke all on function public.get_admin_learning_aggregate(timestamptz,timestamptz) from public;
grant execute on function public.materialize_learning_retention_checks(timestamptz) to service_role;
grant execute on function public.complete_my_learning_retention_check(uuid,text) to authenticated;
grant execute on function public.get_my_due_learning_retention_step() to authenticated;
grant execute on function public.get_my_learning_progress_summary() to authenticated;
grant execute on function public.get_parent_learning_progress_summary() to authenticated;
grant execute on function public.get_admin_learning_aggregate(timestamptz,timestamptz) to authenticated;

-- The job is deliberately server-side. Local projects without the deployment
-- secret remain valid; production release setup installs the same schedule.
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $schedule$
begin
  if exists (select 1 from vault.secrets where name='ai_grading_service_role_key') then
    perform cron.unschedule(jobid) from cron.job where jobname='materialize-learning-retention';
    perform cron.schedule('materialize-learning-retention','5 2 * * *',$job$
      select net.http_post(
        url := 'https://jscrgpwyniphagitliuz.supabase.co/functions/v1/materialize-learning-retention',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='ai_grading_service_role_key')),
        body := '{}'::jsonb, timeout_milliseconds := 120000
      );
    $job$);
  else
    raise notice 'Learning retention scheduler not installed locally: service role secret is absent';
  end if;
end
$schedule$;
