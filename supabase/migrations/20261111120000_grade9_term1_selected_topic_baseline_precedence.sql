-- Sprint 3 visual-QA correction: a learner's explicit Grade 9 topic choice
-- must be honoured before the generic, cross-topic entry baseline. Keep the
-- original implementation as a private helper so no applied migration or
-- published assessment definition is rewritten.

create schema if not exists odyssey_internal;
revoke all on schema odyssey_internal from public;

alter function public.get_my_grade9_term1_learning_journey()
  set schema odyssey_internal;

revoke all on function odyssey_internal.get_my_grade9_term1_learning_journey() from public, anon, authenticated;

create function public.get_my_grade9_term1_learning_journey()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_journey jsonb;
  v_selected_topic_code text;
  v_selected_baseline jsonb;
begin
  v_journey := odyssey_internal.get_my_grade9_term1_learning_journey();
  v_selected_topic_code := nullif(v_journey #>> '{context,selectedTopicCode}', '');

  -- Resumable work always wins. This narrow correction applies only when the
  -- previous selector chose an entry baseline (which has no topic) and a
  -- selected topic has an independently eligible topic-baseline form.
  if v_selected_topic_code is null
    or v_journey #>> '{primary,action}' is distinct from 'start_baseline'
    or nullif(v_journey #>> '{primary,topicCode}', '') is not null then
    return v_journey;
  end if;

  select candidate
  into v_selected_baseline
  from jsonb_array_elements(coalesce(v_journey->'alternatives', '[]'::jsonb)) candidate
  where candidate->>'assessmentType' = 'topic_baseline'
    and candidate->>'topicCode' = v_selected_topic_code
  order by candidate->>'assessmentDefinitionId'
  limit 1;

  if v_selected_baseline is null then
    return v_journey;
  end if;

  v_journey := jsonb_set(
    v_journey,
    '{primary}',
    jsonb_build_object(
      'action', 'start_baseline',
      'topicCode', v_selected_baseline->>'topicCode',
      'assessmentDefinitionId', v_selected_baseline->>'assessmentDefinitionId',
      'title', 'Understand your starting point',
      'description', 'Take a short independent baseline so we can recommend the most useful next step.',
      'route', v_selected_baseline->>'route',
      'reasonCodes', jsonb_build_array(coalesce(v_selected_baseline->>'reasonCode', 'BASELINE_AVAILABLE'))
    ),
    true
  );

  return jsonb_set(
    v_journey,
    '{alternatives}',
    coalesce((
      select jsonb_agg(candidate order by candidate->>'assessmentType', candidate->>'topicCode')
      from jsonb_array_elements(coalesce(v_journey->'alternatives', '[]'::jsonb)) candidate
      where candidate->>'assessmentDefinitionId' is distinct from v_selected_baseline->>'assessmentDefinitionId'
    ), '[]'::jsonb),
    true
  );
end;
$$;

revoke all on function public.get_my_grade9_term1_learning_journey() from public, anon;
grant execute on function public.get_my_grade9_term1_learning_journey() to authenticated;
