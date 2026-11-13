-- Sprint 4: an independently evidenced weak prerequisite may use a reviewed
-- Grade 8 bridge that contains guided + independent practice.
-- Retain the prerequisite-check requirement for other remediation activities.
-- Missing prerequisite evidence is never classified as a failed prerequisite.
-- The existing approved-only activity and question-version checks remain.
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
           when recommendation_type='prerequisite_remediation' then (
             stage_types @> array['prerequisite_check','guided_practice']
             or (
               'PREREQUISITE_NOT_SECURE'=any(reason_codes)
               and skill_code like 'G8-%'
               and stage_types @> array['guided_practice','independent_practice']
             )
           )
           else stage_types @> array['guided_practice'] end
    order by code limit 1
  ) select coalesce((select jsonb_build_object('activityCode',code,'name',title,'description',description,'targetSkillCode',skill_code,'targetSkillName',skill_name,'estimatedMinutes',greatest(5,least(30,question_count*3)),'learnerReason',case when 'REPEATED_MISCONCEPTION'=any(reason_codes) then 'Let''s compare two similar ideas and practise choosing the right one.' when 'PREREQUISITE_NOT_SECURE'=any(reason_codes) then 'We''re strengthening an earlier skill that will make the next topic easier.' when 'HINT_DEPENDENCY'=any(reason_codes) then 'Let''s gradually reduce support as you practise.' else 'We noticed this skill would benefit from more focused practice.' end) from selected),'null'::jsonb);
$$;
