-- Sprint 4 release-gate repair: PostgreSQL does not permit COUNT aggregates
-- inside JSONB_AGG at the same SELECT scope. Aggregate per assessment first,
-- then compose the JSON array from the grouped rows.
-- This is additive: no published questions, sessions, or learner evidence change.

create or replace function public.get_grade9_term1_assessment_content_qa()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.content_admin_required();

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'definitionId', grouped.definition_id,
        'code', grouped.definition_code,
        'questionCount', grouped.question_count,
        'reasoningQuestionCount', grouped.reasoning_question_count,
        'correctOptionDistribution', grouped.correct_option_distribution,
        'invalidQuestionCount', grouped.invalid_question_count,
        'publicationValidation', public.get_learning_assessment_publication_validation(grouped.definition_id)
      )
      order by grouped.definition_code
    )
    from (
      select
        definition.id as definition_id,
        definition.code as definition_code,
        count(link.question_version_id) as question_count,
        count(link.question_version_id) filter (
          where version.reasoning_classification = 'mathematical_reasoning'
        ) as reasoning_question_count,
        jsonb_build_object(
          'A', count(*) filter (where version.answer_config->>'correct_option' = 'A'),
          'B', count(*) filter (where version.answer_config->>'correct_option' = 'B'),
          'C', count(*) filter (where version.answer_config->>'correct_option' = 'C'),
          'D', count(*) filter (where version.answer_config->>'correct_option' = 'D')
        ) as correct_option_distribution,
        count(*) filter (
          where cardinality(public.validate_learning_answer_config(version.answer_config)) > 0
        ) as invalid_question_count
      from public.learning_assessment_definitions definition
      left join public.learning_assessment_definition_questions link
        on link.learning_assessment_definition_id = definition.id
      left join public.question_versions version
        on version.id = link.question_version_id
      where definition.code like 'G9-T1-%'
      group by definition.id, definition.code
    ) as grouped
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_grade9_term1_assessment_publication_matrix()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.content_admin_required();

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'definitionId', grouped.definition_id,
        'definitionCode', grouped.definition_code,
        'assessmentType', grouped.assessment_type,
        'durationMinutes', grouped.duration_minutes,
        'policyVersion', grouped.policy_version,
        'questionCount', grouped.question_count,
        'reasoningEvidenceCount', grouped.reasoning_evidence_count,
        'criticalSkillCounts', coalesce((
          select jsonb_object_agg(skill.skill_code, stats.question_count)
          from public.topic_mastery_policy_skills policy_skill
          join public.curriculum_skills skill
            on skill.id = policy_skill.skill_id
          left join lateral (
            select count(distinct link2.question_version_id)::integer as question_count
            from public.learning_assessment_definition_questions link2
            join public.question_version_skill_links skill_link
              on skill_link.question_version_id = link2.question_version_id
              and skill_link.relationship_type = 'primary'
            where link2.learning_assessment_definition_id = grouped.definition_id
              and skill_link.skill_id = policy_skill.skill_id
          ) stats on true
          where policy_skill.topic_mastery_policy_id = grouped.policy_id
            and policy_skill.is_critical
        ), '{}'::jsonb),
        'invalidQuestionCount', grouped.invalid_question_count,
        'publicationValidation', public.get_learning_assessment_publication_validation(grouped.definition_id)
      )
      order by grouped.definition_code
    )
    from (
      select
        definition.id as definition_id,
        definition.code as definition_code,
        definition.assessment_type,
        definition.duration_minutes,
        policy.id as policy_id,
        policy.version as policy_version,
        count(link.question_version_id) as question_count,
        count(link.question_version_id) filter (
          where version.reasoning_classification = 'mathematical_reasoning'
        ) as reasoning_evidence_count,
        count(link.question_version_id) filter (
          where version.id is null
            or version.review_status <> 'approved'
            or cardinality(public.validate_learning_answer_config(version.answer_config)) > 0
        ) as invalid_question_count
      from public.learning_assessment_definitions definition
      left join public.topic_mastery_policies policy
        on policy.id = definition.topic_mastery_policy_id
      left join public.learning_assessment_definition_questions link
        on link.learning_assessment_definition_id = definition.id
      left join public.question_versions version
        on version.id = link.question_version_id
      where definition.code like 'G9-T1-%'
      group by definition.id, policy.id
    ) as grouped
  ), '[]'::jsonb);
end;
$$;

-- Keep the existing SECURITY DEFINER access model: content admins only.
revoke all on function public.get_grade9_term1_assessment_content_qa() from public;
grant execute on function public.get_grade9_term1_assessment_content_qa() to authenticated;
revoke all on function public.get_grade9_term1_assessment_publication_matrix() from public;
grant execute on function public.get_grade9_term1_assessment_publication_matrix() to authenticated;
