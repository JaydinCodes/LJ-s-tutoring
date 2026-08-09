-- RLS policies execute helper functions as the requesting database role. The
-- migration chain revoked PUBLIC execution while hardening SECURITY DEFINER
-- functions, but omitted these two authenticated-only policy helpers. Without
-- these grants every policy that references either helper fails at runtime.
revoke execute on function public.current_profile_id() from public, anon;
revoke execute on function public.current_profile_role() from public, anon;
revoke execute on function public.is_platform_admin() from public, anon;
revoke execute on function public.current_org_ids() from public, anon;
revoke execute on function public.current_org_role(uuid) from public, anon;
revoke execute on function public.current_student_org_id() from public, anon;

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.current_org_ids() to authenticated;
grant execute on function public.current_org_role(uuid) to authenticated;
grant execute on function public.current_student_org_id() to authenticated;
