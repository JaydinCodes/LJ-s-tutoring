-- Fixes a real bug: RETURNS TABLE auto-declares room_id/profile_id as
-- PL/pgSQL variables matching the output columns, which collided with the
-- unqualified room_id/profile_id column references in the membership
-- pre-check, causing "column reference is ambiguous" (42702) on every call.
-- Confirmed via direct functional testing against local Supabase.
create or replace function public.get_room_messages(p_room_id uuid)
returns table (
  id uuid, room_id uuid, profile_id uuid, content text,
  moderation_state public.community_moderation_state, created_at timestamptz,
  sender_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_role public.user_role := public.current_profile_role();
begin
  if v_profile_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.community_room_members crm
    where crm.room_id = p_room_id and crm.profile_id = v_profile_id
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select m.id, m.room_id, m.profile_id, m.content, m.moderation_state, m.created_at,
           p.full_name as sender_name
    from public.community_room_messages m
    join public.profiles p on p.id = m.profile_id
    where m.room_id = p_room_id
      and (m.moderation_state = 'visible' or v_role in ('admin', 'tutor'))
    order by m.created_at desc;
end;
$$;
;
