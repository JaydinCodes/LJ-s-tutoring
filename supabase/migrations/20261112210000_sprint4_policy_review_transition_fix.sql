-- Sprint 4 release-gate correction.  The original policy-review RPC recorded
-- reviewer metadata while moving a policy into `in_review`.  The table's
-- durable invariant intentionally permits reviewer metadata only on an
-- approved policy, so the first legitimate admin transition failed its check
-- constraint.  Preserve the invariant and use the existing admin workflow:
-- draft/rejected -> in_review has no approval metadata; approval records it.

create or replace function public.review_topic_mastery_policy_action(
  p_policy_id uuid,
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
  from public.topic_mastery_policies
  where id = p_policy_id
  for update;

  if not found then
    raise exception 'topic_mastery_policy_not_found' using errcode = 'P0002';
  end if;

  if p_action = 'submit_for_review' and v_from in ('draft', 'rejected') then
    v_to := 'in_review';
  elsif p_action = 'approve' and v_from = 'in_review' then
    if not exists (
      select 1 from public.topic_mastery_policy_skills
      where topic_mastery_policy_id = p_policy_id and is_essential
    ) then
      raise exception 'topic_mastery_policy_requires_essential_skill' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.topic_mastery_policy_skills
      where topic_mastery_policy_id = p_policy_id and is_critical
    ) then
      raise exception 'topic_mastery_policy_requires_critical_skill' using errcode = '23514';
    end if;
    v_to := 'approved';
  elsif p_action = 'reject' and v_from = 'in_review' then
    v_to := 'rejected';
  elsif p_action = 'return_for_revision' and v_from = 'in_review' then
    v_to := 'draft';
  elsif p_action = 'retire' and v_from = 'approved' then
    v_to := 'retired';
  else
    raise exception 'invalid_topic_mastery_policy_review_transition' using errcode = '23514';
  end if;

  if p_action in ('reject', 'return_for_revision', 'retire')
    and nullif(btrim(coalesce(p_notes, '')), '') is null then
    raise exception 'review_notes_required' using errcode = '23514';
  end if;

  update public.topic_mastery_policies
  set review_status = v_to,
      reviewed_by = case when v_to = 'approved' then public.current_profile_id() else null end,
      reviewed_at = case when v_to = 'approved' then now() else null end,
      review_notes = p_notes,
      updated_at = now()
  where id = p_policy_id;

  perform public.log_audit_event(
    'learning_configuration.topic_mastery_policy_reviewed',
    'topic_mastery_policy',
    p_policy_id::text,
    jsonb_build_object('action', p_action, 'from_status', v_from, 'to_status', v_to)
  );
end;
$$;
