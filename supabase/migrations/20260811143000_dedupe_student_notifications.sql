-- REL-10: notifications are a secondary effect and must be idempotent when a
-- session/report transaction is retried after an uncertain response.

alter table public.student_notifications
  add column if not exists dedupe_key text;

create unique index if not exists idx_student_notifications_dedupe_key
  on public.student_notifications (dedupe_key)
  where dedupe_key is not null;

create or replace function public.create_student_notification(
  p_student_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_dedupe_key text := case
    when p_entity_id is null then null
    else left(
      coalesce(nullif(btrim(p_type), ''), 'notification') || ':' ||
      coalesce(nullif(btrim(p_entity_type), ''), 'entity') || ':' ||
      p_entity_id::text,
      240
    )
  end;
begin
  insert into public.student_notifications (
    student_id, type, title, body, link, entity_type, entity_id,
    metadata_json, dedupe_key, created_by
  )
  values (
    p_student_id, p_type, p_title, p_body, p_link, p_entity_type, p_entity_id,
    coalesce(p_metadata, '{}'::jsonb), v_dedupe_key, public.current_profile_id()
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;

  if v_id is null and v_dedupe_key is not null then
    select id into v_id
    from public.student_notifications
    where dedupe_key = v_dedupe_key;
  end if;
  return v_id;
end;
$$;

grant execute on function public.create_student_notification(uuid, text, text, text, text, text, uuid, jsonb)
  to service_role;
