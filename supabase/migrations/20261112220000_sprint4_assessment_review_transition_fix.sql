-- Sprint 4 release-gate correction.  Match the policy review transition
-- invariant: only an approved assessment definition carries approval
-- metadata.  This restores the existing administrator submit/approve
-- workflow without bypassing validation or directly publishing a form.

create or replace function public.review_learning_assessment_action(
  p_assessment_id uuid,
  p_action text,
  p_notes text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_from public.question_review_status;
  v_to public.question_review_status;
begin
  perform public.content_admin_required();
  select review_status into v_from
  from public.learning_assessment_definitions
  where id = p_assessment_id
  for update;

  if not found then
    raise exception 'learning_assessment_not_found' using errcode = 'P0002';
  end if;

  if p_action = 'submit_for_review' and v_from in ('draft', 'rejected') then
    v_to := 'in_review';
  elsif p_action = 'approve' and v_from = 'in_review' then
    if not exists (
      select 1 from public.learning_assessment_definition_questions
      where learning_assessment_definition_id = p_assessment_id
    ) then
      raise exception 'learning_assessment_requires_question' using errcode = '23514';
    end if;
    if exists (
      select 1
      from public.learning_assessment_definition_questions link
      join public.question_versions version on version.id = link.question_version_id
      join public.question_items item on item.id = version.question_item_id
      where link.learning_assessment_definition_id = p_assessment_id
        and (version.review_status <> 'approved' or item.retired_at is not null)
    ) then
      raise exception 'learning_assessment_requires_approved_active_questions' using errcode = '23514';
    end if;
    v_to := 'approved';
  elsif p_action = 'reject' and v_from = 'in_review' then
    v_to := 'rejected';
  elsif p_action = 'return_for_revision' and v_from = 'in_review' then
    v_to := 'draft';
  elsif p_action = 'retire' and v_from = 'approved' then
    v_to := 'retired';
  else
    raise exception 'invalid_learning_assessment_review_transition' using errcode = '23514';
  end if;

  if p_action in ('reject', 'return_for_revision', 'retire')
    and nullif(btrim(coalesce(p_notes, '')), '') is null then
    raise exception 'review_notes_required' using errcode = '23514';
  end if;

  update public.learning_assessment_definitions
  set review_status = v_to,
      reviewed_by = case when v_to = 'approved' then public.current_profile_id() else null end,
      reviewed_at = case when v_to = 'approved' then now() else null end,
      review_notes = p_notes,
      updated_at = now()
  where id = p_assessment_id;

  perform public.log_audit_event(
    'learning_configuration.assessment_reviewed',
    'learning_assessment_definition',
    p_assessment_id::text,
    jsonb_build_object('action', p_action, 'from_status', v_from, 'to_status', v_to)
  );
end;
$$;
