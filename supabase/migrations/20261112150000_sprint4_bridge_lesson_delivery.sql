-- Sprint 4 bridge delivery. Grade 8 support uses the same review-gated
-- lesson model as Grade 9; it is only offered from an evidence-based
-- prerequisite recommendation and never treats unknown evidence as failure.

create or replace function public.validate_learning_skill_content_for_approval(p_content_id uuid)
returns text[] language plpgsql security definer set search_path='' as $$
declare v_errors text[] := '{}';
begin
  if not exists (
    select 1 from public.learning_skill_content content
    join public.curriculum_skills skill on skill.id=content.curriculum_skill_id and skill.is_active
    join public.curriculum_versions curriculum on curriculum.subject_id=skill.subject_id and curriculum.grade=skill.grade and curriculum.is_active
    where content.id=p_content_id and skill.grade in ('Grade 8','Grade 9')
  ) then v_errors:=array_append(v_errors,'INACTIVE_OR_UNSUPPORTED_CURRICULUM_SKILL'); end if;
  if exists (select 1 from public.learning_skill_content where id=p_content_id and nullif(btrim(coalesce(learning_objective,'')),'') is null) then v_errors:=array_append(v_errors,'LEARNING_OBJECTIVE_REQUIRED'); end if;
  if exists (select 1 from public.learning_skill_content where id=p_content_id and nullif(btrim(coalesce(common_misconception,'')),'') is null) then v_errors:=array_append(v_errors,'COMMON_MISCONCEPTION_REQUIRED'); end if;
  if exists (select 1 from public.learning_skill_content where id=p_content_id and worksheet_url is not null and nullif(btrim(worksheet_permission_note),'') is null) then v_errors:=array_append(v_errors,'WORKSHEET_PERMISSION_REQUIRED'); end if;
  if exists (select 1 from public.learning_skill_content where id=p_content_id and video_url is not null and video_url !~ '^https://(www\.)?(youtube\.com/watch\?v=|youtu\.be/)[A-Za-z0-9_-]{6,}') then v_errors:=array_append(v_errors,'VIDEO_URL_NOT_CURATED_YOUTUBE'); end if;
  return v_errors;
end; $$;

create or replace function public.get_my_grade9_learning_topic(p_topic_code text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if public.current_profile_role()<>'student' then raise exception 'not_authorized' using errcode='42501'; end if;
  return (
    select jsonb_build_object(
      'topicCode',topic.code,'topicName',topic.name,'topicDescription',topic.description,'areaName',area.name,
      'skills',coalesce((select jsonb_agg(jsonb_build_object(
        'skillCode',skill.skill_code,'skillName',skill.title,'skillDescription',skill.description,
        'activityCode',activity.code,'activityName',activity.title,
        'content',case when content.id is null then null else jsonb_build_object(
          'title',content.title,'learningObjective',content.learning_objective,'explanation',content.explanation,
          'workedExample',content.worked_example,'commonMisconception',content.common_misconception,
          'videoUrl',content.video_url,'worksheetUrl',content.worksheet_url,'worksheetPermissionNote',content.worksheet_permission_note) end
      ) order by metadata.display_order,skill.skill_code)
      from public.grade9_skill_metadata metadata
      join public.curriculum_skills skill on skill.id=metadata.curriculum_skill_id and skill.is_active
      left join lateral (select template.code,template.title from public.learning_activity_templates template where template.target_skill_id=skill.id and template.review_status='approved' and not exists (select 1 from public.learning_activity_stage_questions link join public.learning_activity_stages stage on stage.id=link.learning_activity_stage_id join public.question_versions version on version.id=link.question_version_id join public.question_items item on item.id=version.question_item_id where stage.learning_activity_template_id=template.id and (version.review_status<>'approved' or item.retired_at is not null)) order by template.code limit 1) activity on true
      left join public.learning_skill_content content on content.curriculum_skill_id=skill.id and content.review_status='approved'
      where metadata.curriculum_topic_id=topic.id and metadata.valid_until is null and (activity.code is not null or content.id is not null)
      ),'[]'::jsonb)
    )
    from public.curriculum_topics topic join public.curriculum_areas area on area.id=topic.curriculum_area_id join public.curriculum_versions curriculum on curriculum.id=area.curriculum_version_id
    where topic.code=p_topic_code and curriculum.code='CAPS-MATH-G9-2026' and curriculum.is_active and topic.is_active
  );
end; $$;

create or replace function public.get_my_grade8_learning_bridge(p_skill_code text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if public.current_profile_role()<>'student' then raise exception 'not_authorized' using errcode='42501'; end if;
  return (
    select jsonb_build_object(
      'skillCode',skill.skill_code,'skillName',skill.title,'skillDescription',skill.description,
      'content',jsonb_build_object('title',content.title,'learningObjective',content.learning_objective,'explanation',content.explanation,'workedExample',content.worked_example,'commonMisconception',content.common_misconception),
      'activityCode',activity.code,'activityName',activity.title
    )
    from public.curriculum_skills skill
    join public.learning_skill_content content on content.curriculum_skill_id=skill.id and content.review_status='approved'
    left join lateral (
      select template.code,template.title from public.learning_activity_templates template
      where template.target_skill_id=skill.id and template.review_status='approved'
      and not exists (select 1 from public.learning_activity_stage_questions link join public.learning_activity_stages stage on stage.id=link.learning_activity_stage_id join public.question_versions version on version.id=link.question_version_id join public.question_items item on item.id=version.question_item_id where stage.learning_activity_template_id=template.id and (version.review_status<>'approved' or item.retired_at is not null))
      order by template.code limit 1
    ) activity on true
    where skill.skill_code=p_skill_code and skill.grade='Grade 8' and skill.is_active
  );
end; $$;

create or replace function public.get_learning_skill_content_catalog()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform public.content_admin_required();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',content.id,'skillCode',skill.skill_code,'skillName',skill.title,'grade',skill.grade,
      'title',content.title,'objective',content.learning_objective,'explanation',content.explanation,
      'workedExample',content.worked_example,'commonMisconception',content.common_misconception,
      'status',content.review_status,'hasVideo',content.video_url is not null,'hasWorksheet',content.worksheet_url is not null,'reviewNotes',content.review_notes
    ) order by skill.grade,skill.skill_code)
    from public.learning_skill_content content join public.curriculum_skills skill on skill.id=content.curriculum_skill_id
  ),'[]'::jsonb);
end; $$;

create or replace function public.get_grade9_term1_sprint4_content_qa()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform public.content_admin_required();
  return jsonb_build_object(
    'lessons', coalesce((select jsonb_agg(jsonb_build_object('skillCode',skill.skill_code,'status',content.review_status,'hasObjective',nullif(btrim(coalesce(content.learning_objective,'')),'') is not null,'hasMisconception',nullif(btrim(coalesce(content.common_misconception,'')),'') is not null) order by skill.grade,skill.skill_code) from public.learning_skill_content content join public.curriculum_skills skill on skill.id=content.curriculum_skill_id where skill.skill_code like 'G9-%' or skill.skill_code in ('G8-NUM-WHOLE-PROPERTIES','G8-NUM-FRACTIONS-OPERATIONS','G8-NUM-DECIMALS-OPERATIONS','G8-NUM-INTEGERS-OPERATIONS','G8-EXP-LAWS-SCI','G8-PAT-REPRESENT-RULE')),'[]'::jsonb),
    'practice', coalesce((select jsonb_agg(jsonb_build_object('activityCode',activity.code,'status',activity.review_status,'questionCount',(select count(*) from public.learning_activity_stage_questions link join public.learning_activity_stages stage on stage.id=link.learning_activity_stage_id where stage.learning_activity_template_id=activity.id),'unapprovedQuestionCount',(select count(*) from public.learning_activity_stage_questions link join public.learning_activity_stages stage on stage.id=link.learning_activity_stage_id join public.question_versions version on version.id=link.question_version_id where stage.learning_activity_template_id=activity.id and version.review_status<>'approved')) order by activity.code) from public.learning_activity_templates activity where activity.code like 'A.G9.S4.%' or activity.code like 'A.G8.S4.%'),'[]'::jsonb)
  );
end; $$;

revoke all on function public.get_my_grade8_learning_bridge(text) from public;
revoke all on function public.get_grade9_term1_sprint4_content_qa() from public;
grant execute on function public.get_my_grade8_learning_bridge(text) to authenticated;
grant execute on function public.get_grade9_term1_sprint4_content_qa() to authenticated;
