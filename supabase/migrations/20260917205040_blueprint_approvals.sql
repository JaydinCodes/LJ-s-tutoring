-- Approve diagnostic blueprints and learning activity templates.
--
-- A diagnostic blueprint can only be approved when every linked
-- question version is approved and every linked question item is active.

create or replace function public.approve_diagnostic_blueprint(
  p_blueprint_id uuid,
  p_reviewer_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The reviewer must be a platform admin.
  if not public.is_platform_admin() then
    raise exception 'not_authorized'
      using errcode = '42501';
end if;

  -- Ensure the blueprint exists.
  if not exists (
    select 1
    from public.diagnostic_blueprints
    where id = p_blueprint_id
  ) then
    raise exception 'diagnostic_blueprint_not_found'
      using errcode = 'P0002';
end if;

  -- Every question version linked to the blueprint must be approved.
  if exists (
    select 1
    from public.diagnostic_blueprint_questions blueprint_question
    join public.question_versions version
      on version.id = blueprint_question.question_version_id
    join public.question_items item
      on item.id = version.question_item_id
    where blueprint_question.diagnostic_blueprint_id = p_blueprint_id
      and (
        version.review_status <> 'approved'
        or item.retired_at is not null
      )
  ) then
    raise exception
      'cannot_approve_diagnostic_blueprint: all linked question versions must be approved and active'
      using errcode = '23514';
end if;

  -- Prevent approving an empty blueprint.
  if not exists (
    select 1
    from public.diagnostic_blueprint_questions
    where diagnostic_blueprint_id = p_blueprint_id
  ) then
    raise exception
      'cannot_approve_diagnostic_blueprint: blueprint has no linked questions'
      using errcode = '23514';
end if;

update public.diagnostic_blueprints
set
  review_status = 'approved',
  reviewed_by = p_reviewer_id,
  reviewed_at = now()
where id = p_blueprint_id;
end;
$$;


create or replace function public.approve_learning_activity_template(
  p_template_id uuid,
  p_reviewer_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The reviewer must be a platform admin.
  if not public.is_platform_admin() then
    raise exception 'not_authorized'
      using errcode = '42501';
end if;

  -- Ensure the template exists.
  if not exists (
    select 1
    from public.learning_activity_templates
    where id = p_template_id
  ) then
    raise exception 'learning_activity_template_not_found'
      using errcode = 'P0002';
end if;

update public.learning_activity_templates
set
  review_status = 'approved',
  reviewed_by = p_reviewer_id,
  reviewed_at = now()
where id = p_template_id;
end;
$$;


revoke all on function public.approve_diagnostic_blueprint(uuid, uuid) from public;
revoke all on function public.approve_learning_activity_template(uuid, uuid) from public;

grant execute on function public.approve_diagnostic_blueprint(uuid, uuid) to authenticated;
grant execute on function public.approve_learning_activity_template(uuid, uuid) to authenticated;
