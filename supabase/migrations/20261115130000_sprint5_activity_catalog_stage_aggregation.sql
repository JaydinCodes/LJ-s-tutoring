create or replace function public.get_learning_activity_content_catalog()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.content_admin_required();
  return jsonb_build_object('activities', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', activity.id,
      'code', activity.code,
      'title', activity.title,
      'description', activity.description,
      'status', activity.review_status,
      'reviewNotes', activity.review_notes,
      'targetSkillCode', skill.skill_code,
      'stages', coalesce((
        select jsonb_agg(stage_data.node order by stage_data.sequence_number)
        from (
          select stage.sequence_number, jsonb_build_object(
            'sequence', stage.sequence_number,
            'type', stage.stage_type,
            'instruction', stage.learner_instruction,
            'questionCount', count(question_link.question_version_id),
            'questions', coalesce(jsonb_agg(jsonb_build_object(
              'itemCode', item.item_code,
              'reviewStatus', version.review_status,
              'retired', item.retired_at is not null
            ) order by question_link.display_order) filter (where question_link.question_version_id is not null), '[]'::jsonb)
          ) as node
          from public.learning_activity_stages stage
          left join public.learning_activity_stage_questions question_link
            on question_link.learning_activity_stage_id = stage.id
          left join public.question_versions version on version.id = question_link.question_version_id
          left join public.question_items item on item.id = version.question_item_id
          where stage.learning_activity_template_id = activity.id
          group by stage.id, stage.sequence_number, stage.stage_type, stage.learner_instruction
        ) stage_data
      ), '[]'::jsonb),
      'approvalBlockers', to_jsonb(array_remove(array[
        case when not exists (
          select 1 from public.learning_activity_stages stage
          where stage.learning_activity_template_id = activity.id
        ) then 'Add at least one activity stage.' end,
        case when exists (
          select 1
          from public.learning_activity_stages stage
          left join public.learning_activity_stage_questions question_link
            on question_link.learning_activity_stage_id = stage.id
          where stage.learning_activity_template_id = activity.id
            and stage.stage_type <> 'worked_example'
          group by stage.id
          having count(question_link.question_version_id) = 0
        ) then 'Add a reviewed question to every practice stage.' end,
        case when exists (
          select 1
          from public.learning_activity_stage_questions question_link
          join public.learning_activity_stages stage
            on stage.id = question_link.learning_activity_stage_id
          join public.question_versions version on version.id = question_link.question_version_id
          where stage.learning_activity_template_id = activity.id
            and version.review_status <> 'approved'
        ) then 'Approve every linked question version before approving this activity.' end,
        case when exists (
          select 1
          from public.learning_activity_stage_questions question_link
          join public.learning_activity_stages stage
            on stage.id = question_link.learning_activity_stage_id
          join public.question_versions version on version.id = question_link.question_version_id
          join public.question_items item on item.id = version.question_item_id
          where stage.learning_activity_template_id = activity.id
            and item.retired_at is not null
        ) then 'Replace links to retired question items.' end
      ], null))
    ) order by activity.created_at desc)
    from public.learning_activity_templates activity
    join public.curriculum_skills skill on skill.id = activity.target_skill_id
  ), '[]'::jsonb));
end;
$$;

revoke all on function public.get_learning_activity_content_catalog() from public, anon;
grant execute on function public.get_learning_activity_content_catalog() to authenticated;