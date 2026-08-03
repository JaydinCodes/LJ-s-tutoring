-- Phase 4: student tutor-directory boundary.
--
-- RLS controls rows, not columns. The former student branches on tutors,
-- tutor_student_allocations, and profiles therefore exposed full base rows,
-- including hourly/rate overrides, approval notes, auth_user_id, and phone.
-- Students now receive only the three tutor fields required by their dashboard
-- via one caller-scoped SECURITY DEFINER RPC. The reciprocal tutor -> student
-- base-row path is removed too: it exposed guardian/parent fields, so tutors
-- receive a separate six-field learner directory RPC.

drop policy if exists "profiles_select_allocated_learning_relationship" on public.profiles;

drop policy if exists "students_select_self_or_admin" on public.students;
create policy "students_select_self_or_admin"
on public.students for select
using (
  public.is_platform_admin()
  or profile_id = public.current_profile_id()
);

drop policy if exists "tutors_select_self_or_admin" on public.tutors;
create policy "tutors_select_self_or_admin"
on public.tutors for select
using (
  public.is_platform_admin()
  or profile_id = public.current_profile_id()
);

drop policy if exists "tutor_student_allocations_select_scoped" on public.tutor_student_allocations;
create policy "tutor_student_allocations_select_scoped"
on public.tutor_student_allocations for select
using (
  public.is_platform_admin()
  or (
    status = 'active'
    and tutor_id = public.current_tutor_id()
  )
);

create or replace function public.get_student_assigned_tutors()
returns table (
  id uuid,
  full_name text,
  email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := public.current_student_id();
begin
  if public.current_profile_role() <> 'student' or v_student_id is null then
    raise exception 'only_students_can_view_assigned_tutors' using errcode = '42501';
  end if;

  return query
  select t.id, p.full_name, p.email
  from public.tutor_student_allocations tsa
  join public.tutors t on t.id = tsa.tutor_id
  join public.profiles p on p.id = t.profile_id
  where tsa.student_id = v_student_id
    and tsa.status = 'active'
  order by p.full_name, t.id;
end;
$$;

revoke execute on function public.get_student_assigned_tutors() from public;
revoke execute on function public.get_student_assigned_tutors() from anon;
grant execute on function public.get_student_assigned_tutors() to authenticated;

create or replace function public.get_tutor_allocated_students()
returns table (
  student_id uuid,
  full_name text,
  email text,
  grade text,
  school text,
  status public.record_status
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tutor_id uuid := public.current_tutor_id();
begin
  if public.current_profile_role() <> 'tutor' or v_tutor_id is null then
    raise exception 'only_tutors_can_view_allocated_students' using errcode = '42501';
  end if;

  return query
  select s.id, p.full_name, p.email, s.grade, s.school, s.status
  from public.tutor_student_allocations tsa
  join public.students s on s.id = tsa.student_id
  join public.profiles p on p.id = s.profile_id
  where tsa.tutor_id = v_tutor_id
    and tsa.status = 'active'
  order by p.full_name, s.id;
end;
$$;

revoke execute on function public.get_tutor_allocated_students() from public;
revoke execute on function public.get_tutor_allocated_students() from anon;
grant execute on function public.get_tutor_allocated_students() to authenticated;
