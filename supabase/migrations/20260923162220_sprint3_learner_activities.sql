create or replace function public.get_my_learning_activity(p_activity_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_student_id uuid;
begin
  if public.current_profile_role() <> 'student' then raise exception 'not_authorized' using errcode = '42501'; end if;
  v_student_id := public.current_student_id();
  if v_student_id is null then raise exception 'student_profile_not_found' using errcode = '42501'; end if;
  return (
    select jsonb_build_object('activityCode', activity.code, 'name', activity.title, 'description', activity.description,
      'targetSkillCode', skill.skill_code, 'stages', coalesce((select jsonb_agg(jsonb_build_object(
        'id',stage.id,'sequence',stage.sequence_number,'type',stage.stage_type,'instruction',stage.learner_instruction,
        'questionVersionIds',(select coalesce(jsonb_agg(link.question_version_id order by link.display_order),'[]'::jsonb) from public.learning_activity_stage_questions link where link.learning_activity_stage_id=stage.id)) order by stage.sequence_number)
      from public.learning_activity_stages stage where stage.learning_activity_template_id=activity.id),'[]'::jsonb))
    from public.learning_activity_templates activity join public.curriculum_skills skill on skill.id=activity.target_skill_id
    where activity.code=p_activity_code and activity.review_status='approved'
      and not exists (select 1 from public.learning_activity_stage_questions link join public.learning_activity_stages stage on stage.id=link.learning_activity_stage_id join public.question_versions version on version.id=link.question_version_id join public.question_items item on item.id=version.question_item_id where stage.learning_activity_template_id=activity.id and (version.review_status <> 'approved' or item.retired_at is not null))
  );
end; $$;
revoke all on function public.get_my_learning_activity(text) from public;
grant execute on function public.get_my_learning_activity(text) to authenticated;

create or replace function public.get_my_next_learning_step()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_student_id uuid;
begin
  if public.current_profile_role() <> 'student' then raise exception 'not_authorized' using errcode='42501'; end if;
  v_student_id := public.current_student_id();
  return (
    select jsonb_build_object(
      'activityCode', activity.code, 'name', activity.title, 'description', activity.description,
      'targetSkillCode', skill.skill_code, 'targetSkillName', skill.title,
      'estimatedMinutes', greatest(5, least(30, count(distinct link.question_version_id) * 3)),
      'learnerReason', case
        when 'REPEATED_MISCONCEPTION'=any(recommendation.reason_codes) then 'Let''s compare two similar ideas and practise choosing the right one.'
        when 'PREREQUISITE_NOT_SECURE'=any(recommendation.reason_codes) then 'We''re strengthening an earlier skill that will make the next topic easier.'
        when 'HINT_DEPENDENCY'=any(recommendation.reason_codes) then 'Let''s gradually reduce support as you practise.'
        else 'We noticed this skill would benefit from more focused practice.' end
    )
    from (
      select r.*, coalesce(array_agg(reason.reason_code) filter(where reason.reason_code is not null),'{}') reason_codes
      from public.grade9_learning_recommendations r
      left join public.learning_recommendation_reasons reason on reason.recommendation_id=r.id
      where r.student_id=v_student_id and r.status='open'
      group by r.id order by r.created_at desc limit 1
    ) recommendation
    join public.curriculum_skills skill on skill.id=recommendation.skill_id
    join public.learning_activity_templates activity on activity.target_skill_id=skill.id and activity.review_status='approved'
    join public.learning_activity_stages stage on stage.learning_activity_template_id=activity.id
    join public.learning_activity_stage_questions link on link.learning_activity_stage_id=stage.id
    where not exists (
      select 1 from public.learning_activity_stage_questions broken
      join public.learning_activity_stages broken_stage on broken_stage.id=broken.learning_activity_stage_id
      join public.question_versions version on version.id=broken.question_version_id
      join public.question_items item on item.id=version.question_item_id
      where broken_stage.learning_activity_template_id=activity.id and (version.review_status<>'approved' or item.retired_at is not null)
    )
    group by activity.id,skill.id,recommendation.reason_codes order by activity.code limit 1
  );
end; $$;

create or replace function public.get_my_learning_mastery_summary()
returns table(skill_code text, skill_name text, state public.mastery_state, determined_at timestamptz)
language sql stable security definer set search_path='' as $$
  select distinct on (evaluation.skill_id) skill.skill_code, skill.title, evaluation.state, evaluation.determined_at
  from public.skill_mastery_evaluations evaluation join public.curriculum_skills skill on skill.id=evaluation.skill_id
  where evaluation.student_id=public.current_student_id() and public.current_profile_role()='student'
  order by evaluation.skill_id,evaluation.determined_at desc;
$$;

revoke all on function public.get_my_next_learning_step() from public;
revoke all on function public.get_my_learning_mastery_summary() from public;
grant execute on function public.get_my_next_learning_step() to authenticated;
grant execute on function public.get_my_learning_mastery_summary() to authenticated;
