-- Core Learning Closure Migration
-- Adds a display-focused question RPC without changing the return type of the
-- established get_learning_question(uuid) contract. PostgreSQL does not allow
-- CREATE OR REPLACE FUNCTION to change a function's OUT parameters.

create function public.get_learning_question_display(p_question_version_id uuid)
returns table (
  question_version_id uuid, 
  activity_type public.question_activity_type,
  cognitive_level public.caps_cognitive_level, 
  representation public.math_representation,
  calculator_policy public.calculator_policy, 
  prompt text, 
  marks numeric, 
  hints jsonb,
  question_type text,
  options jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_profile_role() not in ('student', 'tutor', 'admin') then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
  select qv.id, qv.activity_type, qv.cognitive_level, qv.representation, qv.calculator_policy, qv.prompt, qv.marks,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('id', h.id, 'hint_level', h.hint_level, 'prompt', h.prompt) order by h.hint_level)
        from public.question_hints h
        where h.question_version_id = qv.id
      ), 
      '[]'::jsonb
    ),
    (qv.answer_config->>'type')::text,
    case
      when (qv.answer_config->>'type') = 'multiple_choice' then
        coalesce(
          (
            select jsonb_agg(jsonb_build_object('value', kv.key, 'label', kv.value) order by kv.key)
            from jsonb_each_text(qv.answer_config->'options') kv
          ),
          '[]'::jsonb
        )
      else null
    end
  from public.question_versions qv
  join public.question_items item on item.id = qv.question_item_id and item.retired_at is null
  join public.curriculum_versions curriculum
  on curriculum.id = item.curriculum_version_id
  and curriculum.is_active
  and curriculum.valid_from <= current_date
  and (
    curriculum.valid_until is null
    or curriculum.valid_until >= current_date
  )
  where qv.id = p_question_version_id
    and qv.review_status = 'approved'
    and exists (
      select 1
      from public.question_version_skill_links link
      join public.curriculum_skills skill on skill.id = link.skill_id
      where link.question_version_id = qv.id
        and link.relationship_type = 'primary'
        and skill.is_active
    );
end;
$$;

revoke all on function public.get_learning_question_display(uuid) from public;
grant execute on function public.get_learning_question_display(uuid) to authenticated;
