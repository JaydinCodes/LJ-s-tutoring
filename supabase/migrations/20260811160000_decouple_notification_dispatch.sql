-- REL-10: enqueue learner notifications inside the source transaction, then
-- deliver them from an independently retried worker. A dispatcher crash after
-- the notification insert is harmless because the outbox event ID is unique.

create table public.notification_outbox_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  student_id uuid not null references public.students(id) on delete cascade,
  payload_json jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'dispatched', 'dead_lettered')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  claim_token uuid,
  lease_expires_at timestamptz,
  last_error text,
  dispatched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_outbox_events_due_idx
  on public.notification_outbox_events (available_at, created_at)
  where status in ('pending', 'processing');

alter table public.notification_outbox_events enable row level security;
revoke all on table public.notification_outbox_events from anon, authenticated;
grant select, insert, update, delete on table public.notification_outbox_events to service_role;

alter table public.student_notifications
  add column if not exists outbox_event_id uuid unique;

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
set search_path = ''
as $$
declare
  v_id uuid;
  v_event_key text := left(
    coalesce(nullif(btrim(p_type), ''), 'notification') || ':' ||
    coalesce(nullif(btrim(p_entity_type), ''), 'entity') || ':' ||
    coalesce(p_entity_id::text, encode(extensions.digest(convert_to(
      coalesce(p_student_id::text, '') || ':' || coalesce(p_title, '') || ':' || coalesce(p_body, ''), 'UTF8'
    ), 'sha256'), 'hex')),
    240
  );
begin
  insert into public.notification_outbox_events (event_key, student_id, payload_json)
  values (
    v_event_key,
    p_student_id,
    jsonb_build_object(
      'student_id', p_student_id,
      'type', p_type,
      'title', p_title,
      'body', p_body,
      'link', p_link,
      'entity_type', p_entity_type,
      'entity_id', p_entity_id,
      'metadata_json', coalesce(p_metadata, '{}'::jsonb),
      'created_by', public.current_profile_id()
    )
  )
  on conflict (event_key) do update
    set updated_at = public.notification_outbox_events.updated_at
  returning id into v_id;
  return v_id;
end;
$$;

create function public.claim_next_notification_outbox_event()
returns table (id uuid, claim_token uuid, payload_json jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.notification_outbox_events%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  with candidate as (
    select queued.id
    from public.notification_outbox_events queued
    where (queued.status = 'pending' and queued.available_at <= now())
       or (queued.status = 'processing' and queued.lease_expires_at <= now())
    order by queued.available_at, queued.created_at
    limit 1
    for update skip locked
  )
  update public.notification_outbox_events event
  set status = 'processing',
      attempt_count = event.attempt_count + 1,
      claim_token = gen_random_uuid(),
      lease_expires_at = now() + interval '5 minutes',
      updated_at = now()
  from candidate
  where event.id = candidate.id
  returning event.* into v_event;

  if not found then return; end if;
  return query select v_event.id, v_event.claim_token, v_event.payload_json;
end;
$$;

create function public.dispatch_notification_outbox_event(p_event_id uuid, p_claim_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.notification_outbox_events%rowtype;
  v_notification_id uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  select * into v_event
  from public.notification_outbox_events
  where id = p_event_id and claim_token = p_claim_token and status = 'processing'
  for update;
  if not found then raise exception 'notification_outbox_claim_lost' using errcode = '40001'; end if;

  insert into public.student_notifications (
    outbox_event_id, student_id, type, title, body, link, entity_type,
    entity_id, metadata_json, dedupe_key, created_by
  ) values (
    v_event.id,
    (v_event.payload_json ->> 'student_id')::uuid,
    v_event.payload_json ->> 'type',
    v_event.payload_json ->> 'title',
    v_event.payload_json ->> 'body',
    v_event.payload_json ->> 'link',
    v_event.payload_json ->> 'entity_type',
    nullif(v_event.payload_json ->> 'entity_id', '')::uuid,
    coalesce(v_event.payload_json -> 'metadata_json', '{}'::jsonb),
    v_event.event_key,
    nullif(v_event.payload_json ->> 'created_by', '')::uuid
  ) on conflict (outbox_event_id) do update
    set outbox_event_id = excluded.outbox_event_id
  returning id into v_notification_id;

  update public.notification_outbox_events
  set status = 'dispatched', dispatched_at = now(), lease_expires_at = null,
      claim_token = null, last_error = null, updated_at = now()
  where id = v_event.id and claim_token = p_claim_token;
  return v_notification_id;
end;
$$;

create function public.fail_notification_outbox_event(p_event_id uuid, p_claim_token uuid, p_error_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_attempt integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  update public.notification_outbox_events
  set status = case when attempt_count >= 12 then 'dead_lettered' else 'pending' end,
      available_at = now() + make_interval(secs => least(3600, 30 * (2 ^ least(attempt_count, 7))::integer)),
      lease_expires_at = null, claim_token = null,
      last_error = left(coalesce(nullif(btrim(p_error_code), ''), 'worker_failed'), 120), updated_at = now()
  where id = p_event_id and claim_token = p_claim_token and status = 'processing'
  returning attempt_count into v_attempt;
  if not found then raise exception 'notification_outbox_claim_lost' using errcode = '40001'; end if;
end;
$$;

revoke all on function public.claim_next_notification_outbox_event() from public, anon, authenticated;
revoke all on function public.dispatch_notification_outbox_event(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fail_notification_outbox_event(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_next_notification_outbox_event() to service_role;
grant execute on function public.dispatch_notification_outbox_event(uuid, uuid) to service_role;
grant execute on function public.fail_notification_outbox_event(uuid, uuid, text) to service_role;

create or replace function private.ensure_notification_outbox_schedule()
returns void language plpgsql security definer
set search_path = public, extensions, pg_catalog
as $$
begin
  if not exists (select 1 from vault.secrets where name = 'ai_grading_service_role_key') then
    raise exception 'recovery_schedule_secret_missing';
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'notification-outbox-dispatcher';
  perform cron.schedule('notification-outbox-dispatcher', '* * * * *', $job$
    select net.http_post(
      url := 'https://jscrgpwyniphagitliuz.supabase.co/functions/v1/dispatch-notification-outbox',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'ai_grading_service_role_key'
      )), body := jsonb_build_object('maxJobs', 25), timeout_milliseconds := 120000
    );
  $job$);
  if not exists (select 1 from cron.job where jobname = 'notification-outbox-dispatcher') then
    raise exception 'notification_outbox_schedule_install_failed';
  end if;
end;
$$;

create or replace function private.assert_notification_outbox_schedule_ready()
returns void language plpgsql security definer stable
set search_path = public, extensions, pg_catalog
as $$
begin
  if not exists (select 1 from cron.job where jobname = 'notification-outbox-dispatcher') then
    raise exception 'notification_outbox_schedule_missing';
  end if;
end;
$$;

revoke all on function private.ensure_notification_outbox_schedule() from public, anon, authenticated;
revoke all on function private.assert_notification_outbox_schedule_ready() from public, anon, authenticated;
