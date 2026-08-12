-- Tutors may create individual work only for learners actively allocated to
-- them. Platform administrators retain cross-organization target management.
create or replace function public.set_assignment_targets(
  p_assignment_id uuid,
  p_class_ids uuid[] default '{}'::uuid[],
  p_student_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.assignments%rowtype;
  v_profile_id uuid := public.current_profile_id();
  v_tutor_id uuid := public.current_approved_active_tutor_id();
  v_class_ids uuid[] := coalesce(p_class_ids, '{}'::uuid[]);
  v_student_ids uuid[] := coalesce(p_student_ids, '{}'::uuid[]);
begin
  select a.* into v_assignment from public.assignments a where a.id = p_assignment_id for update;
  if not found then raise exception 'assignment_not_found' using errcode = 'P0002'; end if;

  if not public.is_platform_admin() and (
    v_tutor_id is null or v_assignment.created_by <> v_profile_id
  ) then raise exception 'assignment_organization_forbidden' using errcode = '42501'; end if;

  if not public.is_platform_admin() and cardinality(v_class_ids) > 0 then
    raise exception 'tutors_cannot_assign_to_classes' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(v_student_ids) target_id
    left join public.students s on s.id = target_id and s.organization_id = v_assignment.organization_id
    where s.id is null
  ) then raise exception 'assignment_target_organization_forbidden' using errcode = '42501'; end if;
  if not public.is_platform_admin() and exists (
    select 1 from unnest(v_student_ids) target_id
    where not exists (
      select 1 from public.tutor_student_allocations tsa
      where tsa.tutor_id = v_tutor_id and tsa.student_id = target_id and tsa.status = 'active'::public.record_status
    )
  ) then raise exception 'assignment_target_not_allocated_to_tutor' using errcode = '42501'; end if;

  delete from public.assignment_class_targets where assignment_id = p_assignment_id;
  delete from public.assignment_student_targets where assignment_id = p_assignment_id;
  insert into public.assignment_class_targets (assignment_id, class_id)
  select distinct p_assignment_id, target_id from unnest(v_class_ids) target_id;
  insert into public.assignment_student_targets (assignment_id, student_id)
  select distinct p_assignment_id, target_id from unnest(v_student_ids) target_id;
  perform public.log_audit_event('assignment.targets_replaced', 'assignment', p_assignment_id::text,
    jsonb_build_object('class_target_count', cardinality(v_class_ids), 'student_target_count', cardinality(v_student_ids)));
end;
$$;
