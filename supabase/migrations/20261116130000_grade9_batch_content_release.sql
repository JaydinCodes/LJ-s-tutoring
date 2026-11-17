create or replace function public.release_grade9_term1_content(
  p_apply boolean default false,
  p_expected_fingerprint text default null,
  p_review_reference text default null,
  p_include_formal boolean default false,
  p_formal_review_reference text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_manifest jsonb;
  v_fingerprint text;
  v_entry jsonb;
  v_group text;
  v_rpc text;
  v_note text;
  v_status text;
  v_published integer := 0;
begin
  perform public.content_admin_required();
  if p_apply is null or p_include_formal is null then raise exception 'release_options_required' using errcode = '23514'; end if;
  perform pg_advisory_xact_lock(hashtextextended('grade9-term1-content-release', 0));
  if p_apply then
    lock table public.question_items, public.question_versions, public.question_version_skill_links,
      public.question_hints, public.learning_skill_content, public.learning_activity_templates,
      public.learning_activity_stages, public.learning_activity_stage_questions,
      public.topic_mastery_policies, public.topic_mastery_policy_skills,
      public.learning_assessment_definitions, public.learning_assessment_definition_questions
      in share row exclusive mode;
  end if;

  with activities as (
    select activity.* from public.learning_activity_templates activity
    where activity.code ~ '^A\.G[89]\.S4\.'
  ), practice as (
    select version.* from public.question_versions version
    join public.question_items item on item.id = version.question_item_id and item.retired_at is null
    where item.item_code ~ '^Q\.G[89]\.S4\.PRACTICE\.' and version.version_number = 3
      and version.answer_config ->> 'feedback_source' = 'explicitly_authored_v3'
  ), definitions as (
    select definition.* from public.learning_assessment_definitions definition
    where p_include_formal and definition.code like 'G9-T1-%'
  ), formal_questions as (
    select distinct version.* from public.question_versions version
    join public.learning_assessment_definition_questions link on link.question_version_id = version.id
    join definitions definition on definition.id = link.learning_assessment_definition_id
  )
  select jsonb_build_object(
    'questions', coalesce((select jsonb_agg(to_jsonb(question) order by question.id) from (select * from practice union select * from formal_questions) question), '[]'::jsonb),
    'lessons', coalesce((select jsonb_agg(to_jsonb(lesson) order by lesson.id) from public.learning_skill_content lesson where lesson.curriculum_skill_id in (select target_skill_id from activities)), '[]'::jsonb),
    'activities', coalesce((select jsonb_agg(to_jsonb(activity) order by activity.id) from activities activity), '[]'::jsonb),
    'policies', coalesce((select jsonb_agg(to_jsonb(policy) order by policy.id) from public.topic_mastery_policies policy where policy.id in (select topic_mastery_policy_id from definitions)), '[]'::jsonb),
    'definitions', coalesce((select jsonb_agg(to_jsonb(definition) order by definition.id) from definitions definition), '[]'::jsonb),
    'assessment_links', coalesce((select jsonb_agg(to_jsonb(link) order by link.learning_assessment_definition_id, link.display_order) from public.learning_assessment_definition_questions link where link.learning_assessment_definition_id in (select id from definitions)), '[]'::jsonb),
    'activity_stages', coalesce((select jsonb_agg(to_jsonb(stage) order by stage.id) from public.learning_activity_stages stage where stage.learning_activity_template_id in (select id from activities)), '[]'::jsonb),
    'activity_links', coalesce((select jsonb_agg(to_jsonb(link) order by link.learning_activity_stage_id, link.question_version_id) from public.learning_activity_stage_questions link join public.learning_activity_stages stage on stage.id = link.learning_activity_stage_id where stage.learning_activity_template_id in (select id from activities)), '[]'::jsonb)
  ) into v_manifest;

  if jsonb_array_length(v_manifest -> 'lessons') <> 19
    or jsonb_array_length(v_manifest -> 'activities') <> 19
    or jsonb_array_length(v_manifest -> 'questions') <> (case when p_include_formal then 334 else 76 end)
    or (p_include_formal and (jsonb_array_length(v_manifest -> 'definitions') <> 17 or jsonb_array_length(v_manifest -> 'policies') <> 4)) then
    raise exception 'grade9_release_pack_incomplete_or_changed' using errcode = '23514';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_manifest -> 'activity_links') link
    where not exists (select 1 from jsonb_array_elements(v_manifest -> 'questions') question where question ->> 'id' = link ->> 'question_version_id' and (question ->> 'version_number')::integer = 3)
  ) then raise exception 'grade9_release_requires_v3_activity_links' using errcode = '23514'; end if;

  v_fingerprint := md5(v_manifest::text);
  if not p_apply then
    return jsonb_build_object('applied', false, 'fingerprint', v_fingerprint,
      'lessons', 19, 'practice_questions', 76, 'activities', 19,
      'formal_questions', case when p_include_formal then 258 else 0 end,
      'formal_forms', case when p_include_formal then 17 else 0 end);
  end if;
  if p_expected_fingerprint is distinct from v_fingerprint then
    raise exception 'grade9_release_preview_stale' using errcode = '40001';
  end if;
  if nullif(btrim(p_review_reference), '') is null then
    raise exception 'academic_review_reference_required' using errcode = '23514';
  end if;
  if p_include_formal and nullif(btrim(p_formal_review_reference), '') is null then
    raise exception 'formal_academic_signoff_reference_required' using errcode = '23514';
  end if;

  foreach v_group in array array['questions', 'lessons', 'activities', 'policies', 'definitions'] loop
    v_rpc := case v_group
      when 'questions' then 'review_question_version_action'
      when 'lessons' then 'review_learning_skill_content_action'
      when 'activities' then 'review_learning_activity_action'
      when 'policies' then 'review_topic_mastery_policy_action'
      when 'definitions' then 'review_learning_assessment_action'
    end;
    v_note := 'Batch release; instructional review: ' || p_review_reference
      || case when p_include_formal then '; formal review: ' || p_formal_review_reference else '' end;
    for v_entry in select * from jsonb_array_elements(v_manifest -> v_group) loop
      v_status := v_entry ->> 'review_status';
      if v_status = 'approved' then continue; end if;
      if v_status not in ('draft', 'in_review') then
        raise exception 'grade9_release_requires_resolved_review:%:%', v_group, v_entry ->> 'id' using errcode = '23514';
      end if;
      if v_status = 'draft' then
        execute format('select public.%I($1, $2, $3)', v_rpc)
          using (v_entry ->> 'id')::uuid, 'submit_for_review'::text, v_note;
      end if;
      execute format('select public.%I($1, $2, $3)', v_rpc)
        using (v_entry ->> 'id')::uuid, 'approve'::text, v_note;
    end loop;
  end loop;

  if p_include_formal then
    for v_entry in select * from jsonb_array_elements(v_manifest -> 'definitions') loop
      if not exists (select 1 from public.learning_assessment_form_versions
        where learning_assessment_definition_id = (v_entry ->> 'id')::uuid and review_status = 'approved' and retired_at is null) then
        perform public.publish_learning_assessment_form((v_entry ->> 'id')::uuid);
        v_published := v_published + 1;
      end if;
    end loop;
  end if;

  perform public.log_audit_event('learning_content.batch_released', 'grade9_term1', null,
    jsonb_build_object('fingerprint', v_fingerprint, 'instructional_review_reference', p_review_reference,
      'formal_review_reference', p_formal_review_reference, 'include_formal', p_include_formal, 'forms_published', v_published));
  return jsonb_build_object('applied', true, 'fingerprint', v_fingerprint,
    'lessons', 19, 'practice_questions', 76, 'activities', 19, 'forms_published', v_published);
end;
$$;

revoke all on function public.release_grade9_term1_content(boolean,text,text,boolean,text) from public, anon, authenticated, service_role;
grant execute on function public.release_grade9_term1_content(boolean,text,text,boolean,text) to authenticated;
