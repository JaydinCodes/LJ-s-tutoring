create table public.learner_activity_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  learning_activity_template_id uuid not null references public.learning_activity_templates(id) on delete restrict,
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  started_at timestamptz not null default now(), completed_at timestamptz,
  unique(student_id, learning_activity_template_id)
);
alter table public.learner_activity_progress enable row level security;
create policy "learner_activity_progress_student_read" on public.learner_activity_progress for select to authenticated using (student_id=public.current_student_id());
create policy "learner_activity_progress_tutor_read" on public.learner_activity_progress for select to authenticated using (public.current_profile_role() in ('tutor','admin') and public.can_access_learning_student(student_id));
create or replace function public.start_my_learning_activity(p_activity_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_student uuid; v_template uuid; v_progress uuid;
begin
 if public.current_profile_role()<>'student' then raise exception 'not_authorized' using errcode='42501'; end if;
 v_student:=public.current_student_id();
 select id into v_template from public.learning_activity_templates where code=p_activity_code and review_status='approved';
 if v_template is null then raise exception 'activity_not_available' using errcode='23514'; end if;
 insert into public.learner_activity_progress(student_id,learning_activity_template_id) values(v_student,v_template) on conflict(student_id,learning_activity_template_id) do update set status=public.learner_activity_progress.status returning id into v_progress;
 return v_progress;
end; $$;
revoke all on function public.start_my_learning_activity(text) from public;
grant execute on function public.start_my_learning_activity(text) to authenticated;

create or replace function public.complete_my_learning_activity(p_activity_code text) returns void
language plpgsql security definer set search_path='' as $$
declare v_student uuid; v_template uuid;
begin
  if public.current_profile_role()<>'student' then raise exception 'not_authorized' using errcode='42501'; end if;
  v_student:=public.current_student_id();
  select id into v_template from public.learning_activity_templates where code=p_activity_code and review_status='approved';
  if v_template is null then raise exception 'activity_not_available' using errcode='23514'; end if;
  if exists (
    select 1 from public.learning_activity_stage_questions link
    join public.learning_activity_stages stage on stage.id=link.learning_activity_stage_id
    where stage.learning_activity_template_id=v_template and not exists (
      select 1 from public.learning_attempts attempt where attempt.student_id=v_student and attempt.question_version_id=link.question_version_id
    )
  ) then raise exception 'activity_not_complete' using errcode='23514'; end if;
  update public.learner_activity_progress set status='completed',completed_at=coalesce(completed_at,now())
  where student_id=v_student and learning_activity_template_id=v_template;
  perform public.log_audit_event('learning_activity.completed','learning_activity_template',v_template::text,jsonb_build_object('student_id',v_student));
end; $$;
revoke all on function public.complete_my_learning_activity(text) from public;
grant execute on function public.complete_my_learning_activity(text) to authenticated;

create table public.learning_attempt_reviews (
  id uuid primary key default gen_random_uuid(),
  learning_attempt_id uuid not null unique references public.learning_attempts(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'reviewed')),
  explanation_code text not null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  feedback_note text,
  created_at timestamptz not null default now(),
  check ((status = 'reviewed') = (reviewed_by is not null and reviewed_at is not null))
);

alter table public.learning_attempt_reviews enable row level security;
create policy "learning_attempt_reviews_tutor_admin_read" on public.learning_attempt_reviews
for select to authenticated using (
  exists (
    select 1 from public.learning_attempts attempt
    where attempt.id = learning_attempt_id
      and public.current_profile_role() in ('tutor', 'admin')
      and public.can_access_learning_student(attempt.student_id)
  )
);

create or replace function public.submit_my_activity_attempt(
  p_activity_code text, p_question_version_id uuid, p_response jsonb,
  p_confidence smallint default null, p_time_spent_seconds integer default null,
  p_idempotency_key uuid default null, p_hint_ids uuid[] default '{}'
) returns table(attempt_id uuid, attempt_status public.attempt_status)
language plpgsql security definer set search_path = '' as $$
declare v_student_id uuid; v_attempt_id uuid;
begin
  if public.current_profile_role() <> 'student' then raise exception 'not_authorized' using errcode = '42501'; end if;
  v_student_id := public.current_student_id();
  if v_student_id is null then raise exception 'student_profile_not_found' using errcode = '42501'; end if;
  if p_idempotency_key is null then raise exception 'idempotency_key_required' using errcode = '23514'; end if;
  if not exists (
    select 1 from public.learning_activity_templates activity
    join public.learning_activity_stages stage on stage.learning_activity_template_id = activity.id
    join public.learning_activity_stage_questions link on link.learning_activity_stage_id = stage.id
    join public.question_versions version on version.id = link.question_version_id
    join public.question_items item on item.id = version.question_item_id
    where activity.code = p_activity_code and activity.review_status = 'approved'
      and link.question_version_id = p_question_version_id
      and version.review_status = 'approved' and item.retired_at is null
      and not exists (
        select 1 from public.learning_activity_stage_questions all_link
        join public.learning_activity_stages all_stage on all_stage.id = all_link.learning_activity_stage_id
        join public.question_versions all_version on all_version.id = all_link.question_version_id
        join public.question_items all_item on all_item.id = all_version.question_item_id
        where all_stage.learning_activity_template_id = activity.id
          and (all_version.review_status <> 'approved' or all_item.retired_at is not null)
      )
  ) then raise exception 'question_not_in_approved_activity' using errcode = '23514'; end if;
  v_attempt_id := public.record_learning_attempt(v_student_id, p_question_version_id, p_response, p_confidence,
    p_time_spent_seconds, null, null, 'formative'::public.evidence_context, p_idempotency_key);
  insert into public.learning_attempt_hint_events(learning_attempt_id, question_hint_id, opened_order)
  select v_attempt_id, requested.hint_id, requested.ordinality::integer
  from unnest(coalesce(p_hint_ids, '{}'::uuid[])) with ordinality requested(hint_id, ordinality)
  join public.question_hints hint on hint.id = requested.hint_id and hint.question_version_id = p_question_version_id
  on conflict(learning_attempt_id, question_hint_id) do nothing;
  return query select attempt.id, attempt.status from public.learning_attempts attempt where attempt.id = v_attempt_id;
end; $$;

create or replace function public.queue_learning_attempt_review(p_learning_attempt_id uuid, p_explanation_code text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'not_authorized' using errcode = '42501'; end if;
  insert into public.learning_attempt_reviews(learning_attempt_id, explanation_code)
  values(p_learning_attempt_id, p_explanation_code) on conflict(learning_attempt_id) do nothing;
  perform public.log_audit_event('learning_attempt.review_queued', 'learning_attempt', p_learning_attempt_id::text,
    jsonb_build_object('explanation_code', p_explanation_code));
end; $$;

create or replace function public.get_my_learning_activity_state(p_activity_code text)
returns table(question_version_id uuid, stage_id uuid, stage_sequence smallint, stage_type public.learning_activity_stage_type,
  stage_instruction text, question_sequence smallint, attempt_id uuid, attempt_status public.attempt_status)
language plpgsql security definer set search_path = '' as $$
declare v_student_id uuid;
begin
  if public.current_profile_role() <> 'student' then raise exception 'not_authorized' using errcode = '42501'; end if;
  v_student_id := public.current_student_id();
  return query
  select link.question_version_id, stage.id, stage.sequence_number, stage.stage_type, stage.learner_instruction,
    link.display_order, latest.id, latest.status
  from public.learning_activity_templates activity
  join public.learning_activity_stages stage on stage.learning_activity_template_id = activity.id
  join public.learning_activity_stage_questions link on link.learning_activity_stage_id = stage.id
  left join lateral (
    select attempt.id, attempt.status from public.learning_attempts attempt
    where attempt.student_id = v_student_id and attempt.question_version_id = link.question_version_id
    order by attempt.attempt_number desc limit 1
  ) latest on true
  where activity.code = p_activity_code and activity.review_status = 'approved'
    and not exists (
      select 1 from public.learning_activity_stage_questions bad_link
      join public.learning_activity_stages bad_stage on bad_stage.id = bad_link.learning_activity_stage_id
      join public.question_versions bad_version on bad_version.id = bad_link.question_version_id
      join public.question_items bad_item on bad_item.id = bad_version.question_item_id
      where bad_stage.learning_activity_template_id = activity.id
        and (bad_version.review_status <> 'approved' or bad_item.retired_at is not null)
    )
  order by stage.sequence_number, link.display_order;
end; $$;

create or replace function public.get_tutor_learning_review_queue()
returns table(review_id uuid, attempt_id uuid, student_id uuid, student_name text, question_prompt text,
  learner_response jsonb, confidence smallint, time_spent_seconds integer, hint_count bigint,
  target_skill text, submitted_at timestamptz, explanation_code text)
language sql stable security definer set search_path = '' as $$
  select review.id, attempt.id, attempt.student_id, coalesce(profile.full_name, 'Learner'), version.prompt,
    attempt.response, attempt.confidence, attempt.time_spent_seconds,
    (select count(*) from public.learning_attempt_hint_events hint where hint.learning_attempt_id = attempt.id),
    skill.title, attempt.occurred_at, review.explanation_code
  from public.learning_attempt_reviews review
  join public.learning_attempts attempt on attempt.id = review.learning_attempt_id
  join public.students student on student.id = attempt.student_id
  join public.profiles profile on profile.id = student.profile_id
  join public.question_versions version on version.id = attempt.question_version_id
  left join public.question_version_skill_links link on link.question_version_id = version.id and link.relationship_type = 'primary'
  left join public.curriculum_skills skill on skill.id = link.skill_id
  where review.status = 'pending'
    and public.current_profile_role() in ('tutor', 'admin')
    and public.can_access_learning_student(attempt.student_id)
  order by attempt.occurred_at;
$$;

create or replace function public.review_learning_attempt(
  p_review_id uuid, p_outcome text, p_marks_awarded numeric, p_feedback_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_review public.learning_attempt_reviews; v_attempt public.learning_attempts; v_is_correct boolean; v_hint_count integer;
begin
  select * into v_review from public.learning_attempt_reviews where id = p_review_id and status = 'pending' for update;
  if not found then raise exception 'review_not_available' using errcode = 'P0002'; end if;
  select * into v_attempt from public.learning_attempts where id = v_review.learning_attempt_id for update;
  if public.current_profile_role() not in ('tutor', 'admin') or not public.can_access_learning_student(v_attempt.student_id)
  then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_outcome not in ('correct','partially_correct','incorrect') then raise exception 'invalid_review_outcome' using errcode = '23514'; end if;
  if p_marks_awarded < 0 or p_marks_awarded > (select marks from public.question_versions where id=v_attempt.question_version_id)
  then raise exception 'marks_out_of_range' using errcode = '23514'; end if;
  v_is_correct := p_outcome = 'correct';
  update public.learning_attempts set status='evaluated', is_correct=v_is_correct, marks_awarded=p_marks_awarded,
    evaluated_by=public.current_profile_id(), evaluated_at=now(), tutor_observation=p_feedback_note where id=v_attempt.id;
  select count(*) into v_hint_count from public.learning_attempt_hint_events where learning_attempt_id=v_attempt.id;
  insert into public.learning_attempt_skill_evidence(learning_attempt_id,skill_id,independence,is_target_skill,cognitive_level,correct,marks_awarded,marks_possible)
  select v_attempt.id,link.skill_id,case when v_hint_count=0 then 'independent'::public.attempt_independence else 'assisted'::public.attempt_independence end,
    link.relationship_type='primary',version.cognitive_level,v_is_correct,p_marks_awarded,version.marks
  from public.question_version_skill_links link join public.question_versions version on version.id=link.question_version_id
  where link.question_version_id=v_attempt.question_version_id on conflict(learning_attempt_id,skill_id) do nothing;
  update public.learning_attempt_reviews set status='reviewed',reviewed_by=public.current_profile_id(),reviewed_at=now(),feedback_note=p_feedback_note where id=v_review.id;
  perform public.log_audit_event('learning_attempt.manually_reviewed','learning_attempt',v_attempt.id::text,
    jsonb_build_object('review_id',v_review.id,'outcome',p_outcome));
  return v_attempt.id;
end; $$;

revoke all on function public.submit_my_activity_attempt(text,uuid,jsonb,smallint,integer,uuid,uuid[]) from public;
revoke all on function public.queue_learning_attempt_review(uuid,text) from public;
revoke all on function public.get_my_learning_activity_state(text) from public;
revoke all on function public.get_tutor_learning_review_queue() from public;
revoke all on function public.review_learning_attempt(uuid,text,numeric,text) from public;
grant execute on function public.submit_my_activity_attempt(text,uuid,jsonb,smallint,integer,uuid,uuid[]) to authenticated;
grant execute on function public.queue_learning_attempt_review(uuid,text) to service_role;
grant execute on function public.get_my_learning_activity_state(text) to authenticated;
grant execute on function public.get_tutor_learning_review_queue() to authenticated;
grant execute on function public.review_learning_attempt(uuid,text,numeric,text) to authenticated;
