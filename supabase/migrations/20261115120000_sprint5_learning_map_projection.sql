-- Sprint 5: a learner-scoped projection for the visual topic map.  This is a
-- read model over existing review-gated content, activity progress, skill
-- evidence, and formal assessment records.  It deliberately does not write
-- progress, change OLA recommendations, or make unpublished material visible.

create or replace function public.get_my_grade9_term1_topic_learning_map(p_topic_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_student_id uuid := public.current_student_id();
  v_topic public.curriculum_topics;
  v_available_assessments jsonb := '[]'::jsonb;
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select topic.* into v_topic
  from public.curriculum_topics topic
  join public.grade9_skill_metadata metadata
    on metadata.curriculum_topic_id = topic.id
   and metadata.term = 1
   and metadata.valid_until is null
  where topic.code = p_topic_code
    and topic.is_active
  limit 1;

  if v_topic.id is null then
    raise exception 'grade9_term1_topic_not_found' using errcode = 'P0002';
  end if;

  -- This existing eligibility function remains authoritative for whether a
  -- learner can enter a formal form.  The projection only labels that result.
  v_available_assessments := public.get_my_available_learning_assessments();

  return jsonb_build_object(
    'topicCode', v_topic.code,
    'topicName', v_topic.name,
    'skills', coalesce((
      select jsonb_agg(jsonb_build_object(
        'skillCode', skill.skill_code,
        'skillName', skill.title,
        'skillDescription', skill.description,
        'lessonAvailable', content.id is not null,
        'activityCode', activity.code,
        'practiceStatus', coalesce(progress.status, 'not_started'),
        'practiceAttempted', exists (
          select 1
          from public.learning_attempts attempt
          join public.learning_activity_stage_questions question_link
            on question_link.question_version_id = attempt.question_version_id
          join public.learning_activity_stages stage
            on stage.id = question_link.learning_activity_stage_id
          where attempt.student_id = v_student_id
            and stage.learning_activity_template_id = activity.id
        ),
        'skillEvidenceState', mastery.state,
        'skillEvidenceAt', mastery.determined_at
      ) order by metadata.display_order, skill.skill_code)
      from public.grade9_skill_metadata metadata
      join public.curriculum_skills skill on skill.id = metadata.curriculum_skill_id
      left join public.learning_skill_content content
        on content.curriculum_skill_id = skill.id
       and content.review_status = 'approved'
      left join lateral (
        select template.id, template.code
        from public.learning_activity_templates template
        where template.target_skill_id = skill.id
          and template.review_status = 'approved'
          and not exists (
            select 1
            from public.learning_activity_stage_questions question_link
            join public.learning_activity_stages stage
              on stage.id = question_link.learning_activity_stage_id
            join public.question_versions version
              on version.id = question_link.question_version_id
            join public.question_items item on item.id = version.question_item_id
            where stage.learning_activity_template_id = template.id
              and (version.review_status <> 'approved' or item.retired_at is not null)
          )
        order by template.code
        limit 1
      ) activity on true
      left join public.learner_activity_progress progress
        on progress.learning_activity_template_id = activity.id
       and progress.student_id = v_student_id
      left join lateral (
        select evaluation.state, evaluation.determined_at
        from public.skill_mastery_evaluations evaluation
        where evaluation.student_id = v_student_id
          and evaluation.skill_id = skill.id
        order by evaluation.determined_at desc, evaluation.id desc
        limit 1
      ) mastery on true
      where metadata.curriculum_topic_id = v_topic.id
        and metadata.term = 1
        and metadata.valid_until is null
    ), '[]'::jsonb),
    'baseline', jsonb_build_object(
      'status', case
        when exists (
          select 1 from public.learning_assessment_sessions session
          where session.student_id = v_student_id
            and session.curriculum_topic_id = v_topic.id
            and session.assessment_type = 'topic_baseline'
            and session.status = 'in_progress'
        ) then 'in_progress'
        when exists (
          select 1 from public.learning_assessment_sessions session
          where session.student_id = v_student_id
            and session.curriculum_topic_id = v_topic.id
            and session.assessment_type = 'topic_baseline'
            and session.status in ('submitted', 'timed_out')
        ) then 'completed'
        when exists (
          select 1 from jsonb_array_elements(v_available_assessments) assessment
          where assessment->>'topicCode' = v_topic.code
            and assessment->>'assessmentType' = 'topic_baseline'
        ) then 'available'
        else 'unavailable'
      end
    ),
    'endline', jsonb_build_object(
      'status', case
        when exists (
          select 1 from public.learning_assessment_sessions session
          where session.student_id = v_student_id
            and session.curriculum_topic_id = v_topic.id
            and session.assessment_type = 'endline'
            and session.status = 'in_progress'
        ) then 'in_progress'
        when exists (
          select 1 from public.learning_assessment_sessions session
          where session.student_id = v_student_id
            and session.curriculum_topic_id = v_topic.id
            and session.assessment_type = 'endline'
            and session.status in ('submitted', 'timed_out')
        ) then 'completed'
        when exists (
          select 1 from jsonb_array_elements(v_available_assessments) assessment
          where assessment->>'topicCode' = v_topic.code
            and assessment->>'assessmentType' = 'endline'
        ) then 'available'
        else 'unavailable'
      end
    )
  );
end;
$$;

revoke all on function public.get_my_grade9_term1_topic_learning_map(text) from public, anon;
grant execute on function public.get_my_grade9_term1_topic_learning_map(text) to authenticated;

-- The existing activity review RPC is intentionally retained.  This expanded
-- read model gives content administrators its validation reasons before they
-- try an approval transition, instead of asking them to decode a database
-- error after the fact.
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
        select jsonb_agg(jsonb_build_object(
          'sequence', stage.sequence_number,
          'type', stage.stage_type,
          'instruction', stage.learner_instruction,
          'questionCount', count(question_link.question_version_id),
          'questions', coalesce(jsonb_agg(jsonb_build_object(
            'itemCode', item.item_code,
            'reviewStatus', version.review_status,
            'retired', item.retired_at is not null
          ) order by question_link.display_order) filter (where question_link.question_version_id is not null), '[]'::jsonb)
        ) order by stage.sequence_number)
        from public.learning_activity_stages stage
        left join public.learning_activity_stage_questions question_link
          on question_link.learning_activity_stage_id = stage.id
        left join public.question_versions version on version.id = question_link.question_version_id
        left join public.question_items item on item.id = version.question_item_id
        where stage.learning_activity_template_id = activity.id
        group by stage.id, stage.sequence_number, stage.stage_type, stage.learner_instruction
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
          join public.question_items item on item.id = version.question_item_id
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
