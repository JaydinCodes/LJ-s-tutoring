-- Sprint 4 closure: durations match the independently sampled formal forms.
-- Existing approved/published definitions are immutable and are not touched.

update public.learning_assessment_definitions
set duration_minutes = case
  when assessment_type = 'topic_baseline' then 15
  when assessment_type in ('endline', 'mastery_challenge') then 25
  else duration_minutes
end,
updated_at = now()
where code like 'G9-T1-%'
  and review_status in ('draft', 'rejected');

create or replace function public.get_grade9_term1_assessment_publication_matrix()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform public.content_admin_required();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'definitionId', definition.id, 'definitionCode', definition.code,
      'assessmentType', definition.assessment_type, 'durationMinutes', definition.duration_minutes,
      'policyVersion', policy.version, 'questionCount', count(link.question_version_id),
      'reasoningEvidenceCount', count(link.question_version_id) filter (where version.reasoning_classification='mathematical_reasoning'),
      'criticalSkillCounts', coalesce((select jsonb_object_agg(skill.skill_code, stats.question_count)
        from public.topic_mastery_policy_skills policy_skill
        join public.curriculum_skills skill on skill.id=policy_skill.skill_id
        left join lateral (select count(distinct link2.question_version_id)::integer as question_count
          from public.learning_assessment_definition_questions link2
          join public.question_version_skill_links skill_link on skill_link.question_version_id=link2.question_version_id and skill_link.relationship_type='primary'
          where link2.learning_assessment_definition_id=definition.id and skill_link.skill_id=policy_skill.skill_id) stats on true
        where policy_skill.topic_mastery_policy_id=policy.id and policy_skill.is_critical), '{}'::jsonb),
      'invalidQuestionCount', count(link.question_version_id) filter (where version.id is null or version.review_status<>'approved' or cardinality(public.validate_learning_answer_config(version.answer_config))>0),
      'publicationValidation', public.get_learning_assessment_publication_validation(definition.id)
    ) order by definition.code)
    from public.learning_assessment_definitions definition
    left join public.topic_mastery_policies policy on policy.id=definition.topic_mastery_policy_id
    left join public.learning_assessment_definition_questions link on link.learning_assessment_definition_id=definition.id
    left join public.question_versions version on version.id=link.question_version_id
    where definition.code like 'G9-T1-%'
    group by definition.id, policy.id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_grade9_term1_assessment_publication_matrix() from public;
grant execute on function public.get_grade9_term1_assessment_publication_matrix() to authenticated;
