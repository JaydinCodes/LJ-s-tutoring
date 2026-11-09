-- Sprint 3: a learner-safe orchestration read model. This deliberately
-- derives academic state from the existing OLA, activity, assessment and
-- mastery records; it does not create a second mastery or assessment system.

create table public.student_learning_journey_context (
  student_id uuid primary key references public.students(id) on delete cascade,
  selected_topic_id uuid references public.curriculum_topics(id) on delete set null,
  focus_skill_id uuid references public.curriculum_skills(id) on delete set null,
  origin_topic_id uuid references public.curriculum_topics(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.student_learning_journey_context enable row level security;

create policy "student_learning_journey_context_student_read"
on public.student_learning_journey_context for select to authenticated
using (student_id = public.current_student_id());

create or replace function public.set_my_grade9_term1_learning_context(
  p_topic_code text,
  p_focus_skill_code text default null,
  p_origin_topic_code text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_student_id uuid := public.current_student_id();
  v_topic_id uuid;
  v_focus_skill_id uuid;
  v_origin_topic_id uuid;
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select topic.id into v_topic_id
  from public.curriculum_topics topic
  join public.grade9_skill_metadata metadata on metadata.curriculum_topic_id = topic.id and metadata.term = 1 and metadata.valid_until is null
  where topic.code = p_topic_code
  limit 1;
  if v_topic_id is null then raise exception 'grade9_term1_topic_not_found' using errcode = 'P0002'; end if;

  if nullif(btrim(coalesce(p_focus_skill_code, '')), '') is not null then
    select skill.id into v_focus_skill_id from public.curriculum_skills skill where skill.skill_code = p_focus_skill_code;
    if v_focus_skill_id is null then raise exception 'learning_focus_skill_not_found' using errcode = 'P0002'; end if;
  end if;

  if nullif(btrim(coalesce(p_origin_topic_code, '')), '') is not null then
    select topic.id into v_origin_topic_id from public.curriculum_topics topic where topic.code = p_origin_topic_code;
    if v_origin_topic_id is null then raise exception 'learning_origin_topic_not_found' using errcode = 'P0002'; end if;
  end if;

  insert into public.student_learning_journey_context(student_id, selected_topic_id, focus_skill_id, origin_topic_id)
  values(v_student_id, v_topic_id, v_focus_skill_id, coalesce(v_origin_topic_id, v_topic_id))
  on conflict (student_id) do update set
    selected_topic_id = excluded.selected_topic_id,
    focus_skill_id = excluded.focus_skill_id,
    origin_topic_id = excluded.origin_topic_id,
    updated_at = now();
end;
$$;

create or replace function public.get_my_grade9_term1_learning_journey()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_student_id uuid := public.current_student_id();
  v_active_session record;
  v_active_activity record;
  v_selected_topic_code text;
  v_retention jsonb := 'null'::jsonb;
  v_assessments jsonb := '[]'::jsonb;
  v_ola jsonb := 'null'::jsonb;
  v_topics jsonb := '[]'::jsonb;
  v_context jsonb := '{}'::jsonb;
  v_recommendation_reason_codes jsonb := '[]'::jsonb;
  v_last_progress_at timestamptz;
  v_primary jsonb;
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select session.id, definition.id as definition_id, definition.assessment_type, topic.code as topic_code,
    topic.name as topic_name, session.learner_recommendation
  into v_active_session
  from public.learning_assessment_sessions session
  join public.learning_assessment_definitions definition on definition.id = session.learning_assessment_definition_id
  left join public.curriculum_topics topic on topic.id = session.curriculum_topic_id
  where session.student_id = v_student_id and session.status = 'in_progress'
  order by session.started_at desc
  limit 1;

  -- Activity progress is intentionally resumed before a new placement or
  -- endline. A Grade 8 bridge is valid resumed work when it was selected to
  -- support the current Grade 9 journey, so the existing activity model—not
  -- a second prerequisite-progress table—remains the source of truth.
  select activity.code, activity.title, activity.description, topic.code as topic_code
  into v_active_activity
  from public.learner_activity_progress progress
  join public.learning_activity_templates activity on activity.id = progress.learning_activity_template_id
  join public.curriculum_skills skill on skill.id = activity.target_skill_id
  left join public.grade9_skill_metadata metadata on metadata.curriculum_skill_id = skill.id
    and metadata.term = 1 and metadata.valid_until is null
  left join public.curriculum_topics topic on topic.id = metadata.curriculum_topic_id
  where progress.student_id = v_student_id and progress.status = 'in_progress'
    and activity.review_status = 'approved'
  order by case when metadata.curriculum_topic_id is null then 1 else 0 end, progress.started_at desc
  limit 1;

  select topic.code into v_selected_topic_code
  from public.student_learning_journey_context context
  join public.curriculum_topics topic on topic.id = context.selected_topic_id
  where context.student_id = v_student_id;

  v_retention := public.get_my_due_learning_retention_step();
  v_assessments := public.get_my_available_learning_assessments();
  v_ola := public.get_my_next_learning_step();
  select coalesce(to_jsonb(array_agg(distinct reason.reason_code order by reason.reason_code) filter (where reason.reason_code is not null)), '[]'::jsonb)
  into v_recommendation_reason_codes
  from public.grade9_learning_recommendations recommendation
  left join public.learning_recommendation_reasons reason on reason.recommendation_id = recommendation.id
  where recommendation.id = (
    select latest.id from public.grade9_learning_recommendations latest
    where latest.student_id = v_student_id and latest.status = 'open'
    order by latest.created_at desc, latest.id desc limit 1
  );

  if v_active_session.id is not null then
    v_primary := jsonb_build_object(
      'action', 'resume_assessment', 'topicCode', v_active_session.topic_code, 'assessmentDefinitionId', v_active_session.definition_id,
      'title', 'Resume your assessment',
      'description', 'Your saved answers and the server timer are waiting for you.',
      'route', '/dashboard/student/learning/assessment/session/' || v_active_session.id::text,
      'reasonCodes', jsonb_build_array('FORMAL_SESSION_IN_PROGRESS')
    );
  elsif v_active_activity.code is not null then
    v_primary := jsonb_build_object(
      'action', 'continue_learning', 'topicCode', coalesce(v_active_activity.topic_code, v_selected_topic_code), 'activityCode', v_active_activity.code,
      'title', coalesce(v_active_activity.title, 'Continue your activity'),
      'description', coalesce(v_active_activity.description, 'Pick up the reviewed activity where you left off.'),
      'route', '/dashboard/student/learning/activity/' || v_active_activity.code,
      'reasonCodes', jsonb_build_array('LEARNING_ACTIVITY_IN_PROGRESS')
    );
  elsif v_retention <> 'null'::jsonb and nullif(v_retention->>'activityCode', '') is not null then
    v_primary := jsonb_build_object(
      'action', 'retention_review', 'topicCode', null, 'activityCode', v_retention->>'activityCode',
      'title', coalesce(v_retention->>'name', 'Quick review'),
      'description', coalesce(v_retention->>'learnerReason', 'A short review can help keep this skill fresh.'),
      'route', '/dashboard/student/learning/activity/' || (v_retention->>'activityCode') || '?retentionCheck=' || (v_retention->>'retentionCheckId'),
      'reasonCodes', jsonb_build_array('RETRIEVAL_DUE')
    );
  -- Placement comes before remediation because unknown prerequisite evidence
  -- is not treated as a failure. A selected topic only breaks ties between
  -- equally eligible topic baselines; the entry baseline remains first.
  elsif exists (
    select 1 from jsonb_array_elements(v_assessments) item
    where item->>'assessmentType' in ('entry_baseline', 'topic_baseline')
  ) then
    select jsonb_build_object(
      'action', case item->>'assessmentType'
        when 'entry_baseline' then 'start_baseline'
        when 'topic_baseline' then 'start_baseline'
        when 'mastery_challenge' then 'start_mastery_challenge'
        else 'start_endline' end,
      'topicCode', item->>'topicCode', 'assessmentDefinitionId', item->>'definitionId',
      'title', case item->>'assessmentType'
        when 'entry_baseline' then 'Understand your Term 1 starting point'
        when 'topic_baseline' then 'Understand your starting point'
        when 'mastery_challenge' then 'Your mastery challenge is ready'
        else 'Show what you have learned' end,
      'description', case item->>'assessmentType'
        when 'entry_baseline' then 'Take a short independent entry baseline so we can recommend a useful Grade 9 Term 1 starting point.'
        when 'topic_baseline' then 'Take a short independent baseline so we can recommend the most useful next step.'
        when 'mastery_challenge' then 'Your strong baseline has opened an independent mastery challenge.'
        else 'You are ready for an independent endline assessment.' end,
      'route', '/dashboard/student/learning/assessment/' || (item->>'definitionId'),
      'reasonCodes', jsonb_build_array(coalesce(item->>'eligibilityReason', 'ASSESSMENT_AVAILABLE'))
    ) into v_primary
    from jsonb_array_elements(v_assessments) item
    where item->>'assessmentType' in ('entry_baseline', 'topic_baseline')
    order by case item->>'assessmentType' when 'entry_baseline' then 1 else 2 end,
      case when item->>'topicCode' = v_selected_topic_code then 0 else 1 end,
      item->>'topicCode'
    limit 1;
  elsif exists (
    select 1 from jsonb_array_elements(v_assessments) item
    where item->>'assessmentType' = 'mastery_challenge'
  ) then
    select jsonb_build_object(
      'action', 'start_mastery_challenge', 'topicCode', item->>'topicCode', 'assessmentDefinitionId', item->>'definitionId',
      'title', 'Your mastery challenge is ready',
      'description', 'Your strong baseline has opened an independent mastery challenge.',
      'route', '/dashboard/student/learning/assessment/' || (item->>'definitionId'),
      'reasonCodes', jsonb_build_array(coalesce(item->>'eligibilityReason', 'STRONG_BASELINE_CHALLENGE_AVAILABLE'))
    ) into v_primary
    from jsonb_array_elements(v_assessments) item
    where item->>'assessmentType' = 'mastery_challenge'
    order by case when item->>'topicCode' = v_selected_topic_code then 0 else 1 end, item->>'topicCode'
    limit 1;
  elsif v_ola <> 'null'::jsonb and nullif(v_ola->>'activityCode', '') is not null then
    v_primary := jsonb_build_object(
      'action', 'continue_learning', 'topicCode', v_selected_topic_code, 'activityCode', v_ola->>'activityCode',
      'title', coalesce(v_ola->>'name', 'Continue learning'),
      'description', coalesce(v_ola->>'learnerReason', 'A focused activity is ready for you.'),
      'route', '/dashboard/student/learning/activity/' || (v_ola->>'activityCode'),
      'reasonCodes', coalesce(nullif(v_recommendation_reason_codes, '[]'::jsonb), jsonb_build_array('OLA_RECOMMENDATION'))
    );
  elsif exists (
    select 1 from jsonb_array_elements(v_assessments) item
    where item->>'assessmentType' = 'endline'
  ) then
    select jsonb_build_object(
      'action', 'start_endline', 'topicCode', item->>'topicCode', 'assessmentDefinitionId', item->>'definitionId',
      'title', 'Show what you have learned',
      'description', 'You are ready for an independent endline assessment.',
      'route', '/dashboard/student/learning/assessment/' || (item->>'definitionId'),
      'reasonCodes', jsonb_build_array(coalesce(item->>'eligibilityReason', 'BASELINE_COMPLETE'))
    ) into v_primary
    from jsonb_array_elements(v_assessments) item
    where item->>'assessmentType' = 'endline'
    order by case when item->>'topicCode' = v_selected_topic_code then 0 else 1 end, item->>'topicCode'
    limit 1;
  else
    v_primary := jsonb_build_object(
      'action', 'explore_topic', 'topicCode', null,
      'title', 'Choose a Grade 9 topic',
      'description', 'Reviewed learning and assessments will appear here when they are available.',
      'route', '/dashboard/student/learning',
      'reasonCodes', jsonb_build_array('NO_APPROVED_CONTENT')
    );
  end if;

  v_topics := coalesce((
      with term_topics as (
        select distinct topic.id, topic.code, topic.name, topic.description, topic.display_order
        from public.curriculum_topics topic
        join public.grade9_skill_metadata metadata on metadata.curriculum_topic_id = topic.id and metadata.term = 1 and metadata.valid_until is null
      ), latest_evaluation as (
        select distinct on (evaluation.curriculum_topic_id) evaluation.curriculum_topic_id, evaluation.status, evaluation.reason_codes, evaluation.determined_at, session.learner_recommendation
        from public.topic_mastery_evaluations evaluation
        join public.learning_assessment_sessions session on session.id = evaluation.assessment_session_id
        where evaluation.student_id = v_student_id
        order by evaluation.curriculum_topic_id, evaluation.determined_at desc, evaluation.id desc
      ), content as (
        select metadata.curriculum_topic_id,
          bool_or(skill_content.id is not null or activity.id is not null) as available
        from public.grade9_skill_metadata metadata
        join public.curriculum_skills skill on skill.id = metadata.curriculum_skill_id
        left join public.learning_skill_content skill_content on skill_content.curriculum_skill_id = skill.id and skill_content.review_status = 'approved'
        left join public.learning_activity_templates activity on activity.target_skill_id = skill.id and activity.review_status = 'approved'
        where metadata.term = 1 and metadata.valid_until is null
        group by metadata.curriculum_topic_id
      ), available as (
        select item->>'topicCode' as topic_code, item->>'assessmentType' as assessment_type, item->>'definitionId' as definition_id
        from jsonb_array_elements(v_assessments) item
      )
      select jsonb_agg(jsonb_build_object(
        'topicCode', topic.code, 'topicName', topic.name, 'topicDescription', topic.description,
        'status', case
          when evaluation.status = 'mastered' then 'mastered'
          when exists (select 1 from public.learning_assessment_sessions session where session.student_id = v_student_id and session.curriculum_topic_id = topic.id and session.status = 'in_progress') then 'assessment_in_progress'
          when exists (select 1 from available where topic_code = topic.code and assessment_type = 'mastery_challenge') then 'mastery_challenge_available'
          when exists (select 1 from available where topic_code = topic.code and assessment_type = 'endline') then 'ready_for_endline'
          when exists (select 1 from available where topic_code = topic.code and assessment_type = 'topic_baseline') then 'baseline_available'
          when evaluation.status in ('evidence_incomplete', 'not_yet_mastered') then 'learning_in_progress'
          when exists (
            select 1 from public.learner_activity_progress progress
            join public.learning_activity_templates activity on activity.id = progress.learning_activity_template_id
            join public.grade9_skill_metadata activity_metadata on activity_metadata.curriculum_skill_id = activity.target_skill_id
              and activity_metadata.term = 1 and activity_metadata.valid_until is null
            where progress.student_id = v_student_id and progress.status = 'in_progress'
              and activity_metadata.curriculum_topic_id = topic.id
          ) then 'learning_in_progress'
          when coalesce(content.available, false) then 'not_started'
          else 'content_unavailable' end,
        'topicMasteryStatus', evaluation.status,
        'reasonCodes', coalesce(to_jsonb(evaluation.reason_codes), '[]'::jsonb),
        'lastUpdatedAt', evaluation.determined_at,
        'contentAvailable', coalesce(content.available, false),
        'availableAssessmentTypes', coalesce((select jsonb_agg(available.assessment_type order by available.assessment_type) from available where available.topic_code = topic.code), '[]'::jsonb),
        'focusSkillCode', evaluation.learner_recommendation->>'focusSkillCode'
      ) order by topic.display_order, topic.code)
      from term_topics topic
      left join latest_evaluation evaluation on evaluation.curriculum_topic_id = topic.id
      left join content on content.curriculum_topic_id = topic.id
    ), '[]'::jsonb);

  select coalesce(
    (select max(session.started_at) from public.learning_assessment_sessions session where session.student_id = v_student_id),
    (select max(progress.completed_at) from public.learner_activity_progress progress where progress.student_id = v_student_id),
    (select updated_at from public.student_learning_journey_context context where context.student_id = v_student_id)
  ) into v_last_progress_at;

  v_context := coalesce((
    select jsonb_build_object('selectedTopicCode', selected.code, 'focusSkillCode', skill.skill_code, 'originTopicCode', origin.code, 'updatedAt', context.updated_at)
    from public.student_learning_journey_context context
    left join public.curriculum_topics selected on selected.id = context.selected_topic_id
    left join public.curriculum_skills skill on skill.id = context.focus_skill_id
    left join public.curriculum_topics origin on origin.id = context.origin_topic_id
    where context.student_id = v_student_id
  ), '{}'::jsonb);

  return jsonb_build_object(
    'primary', v_primary,
    'topics', v_topics,
    'currentTopic', coalesce((
      select topic from jsonb_array_elements(v_topics) topic
      where topic->>'topicCode' = coalesce(v_primary->>'topicCode', v_context->>'selectedTopicCode')
      limit 1
    ), 'null'::jsonb),
    'alternatives', coalesce((
      select jsonb_agg(jsonb_build_object(
        'assessmentDefinitionId', item->>'definitionId', 'assessmentType', item->>'assessmentType',
        'topicCode', item->>'topicCode', 'name', item->>'name',
        'route', '/dashboard/student/learning/assessment/' || (item->>'definitionId'),
        'reasonCode', item->>'eligibilityReason'
      ) order by item->>'assessmentType', item->>'topicCode')
      from jsonb_array_elements(v_assessments) item
      where item->>'definitionId' is distinct from v_primary->>'assessmentDefinitionId'
    ), '[]'::jsonb),
    'prerequisiteRecommendation', case
      when v_ola <> 'null'::jsonb and v_recommendation_reason_codes ? 'PREREQUISITE_NOT_SECURE' then
        jsonb_build_object('activityCode', v_ola->>'activityCode', 'skillCode', v_ola->>'targetSkillCode',
          'reasonCodes', v_recommendation_reason_codes, 'originTopicCode', v_context->>'originTopicCode')
      else 'null'::jsonb end,
    'lastProgressAt', v_last_progress_at,
    'contentAvailable', exists (select 1 from jsonb_array_elements(v_topics) topic where coalesce((topic->>'contentAvailable')::boolean, false)),
    'context', v_context
  );
end;
$$;

revoke all on table public.student_learning_journey_context from public, anon;
revoke all on function public.set_my_grade9_term1_learning_context(text, text, text) from public, anon;
revoke all on function public.get_my_grade9_term1_learning_journey() from public, anon;
grant execute on function public.set_my_grade9_term1_learning_context(text, text, text) to authenticated;
grant execute on function public.get_my_grade9_term1_learning_journey() to authenticated;

-- A compact readiness report lets the existing content administrators see
-- exactly why a Grade 9 Term 1 roadmap is learner-empty. It exposes no
-- learner records and does not alter publication or review authority.
create or replace function public.get_grade9_term1_learning_journey_readiness()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.content_admin_required();
  return coalesce((
    with term_topics as (
      select distinct topic.id, topic.code, topic.name, topic.display_order
      from public.curriculum_topics topic
      join public.grade9_skill_metadata metadata on metadata.curriculum_topic_id = topic.id
        and metadata.term = 1 and metadata.valid_until is null
    ), readiness as (
      select topic.id, topic.code, topic.name, topic.display_order,
        (select count(distinct content.id) from public.grade9_skill_metadata metadata
          join public.learning_skill_content content on content.curriculum_skill_id = metadata.curriculum_skill_id
            and content.review_status = 'approved'
          where metadata.curriculum_topic_id = topic.id and metadata.term = 1 and metadata.valid_until is null) as approved_lesson_count,
        (select count(distinct activity.id) from public.grade9_skill_metadata metadata
          join public.learning_activity_templates activity on activity.target_skill_id = metadata.curriculum_skill_id
            and activity.review_status = 'approved'
          where metadata.curriculum_topic_id = topic.id and metadata.term = 1 and metadata.valid_until is null) as approved_activity_count,
        (select count(distinct definition.id) from public.learning_assessment_definitions definition
          join public.learning_assessment_form_versions form on form.learning_assessment_definition_id = definition.id
            and form.review_status = 'approved' and form.retired_at is null
          where definition.curriculum_topic_id = topic.id and definition.review_status = 'approved') as published_assessment_count,
        (select count(*) from public.learning_assessment_definitions definition
          where definition.curriculum_topic_id = topic.id and definition.review_status <> 'approved') as draft_assessment_count
      from term_topics topic
    )
    select jsonb_agg(jsonb_build_object(
      'topicCode', code, 'topicName', name,
      'approvedLessonCount', approved_lesson_count,
      'approvedActivityCount', approved_activity_count,
      'publishedAssessmentCount', published_assessment_count,
      'draftAssessmentCount', draft_assessment_count,
      'learnerContentReady', approved_lesson_count > 0 or approved_activity_count > 0,
      'assessmentReady', published_assessment_count > 0,
      'blockers', to_jsonb(array_remove(array[
        case when approved_lesson_count = 0 and approved_activity_count = 0 then 'NO_APPROVED_LESSON_OR_ACTIVITY' end,
        case when published_assessment_count = 0 then 'NO_PUBLISHED_ASSESSMENT_FORM' end
      ], null))
    ) order by display_order, code)
    from readiness
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_grade9_term1_learning_journey_readiness() from public, anon;
grant execute on function public.get_grade9_term1_learning_journey_readiness() to authenticated;
