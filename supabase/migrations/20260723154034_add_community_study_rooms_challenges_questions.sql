-- Community: study rooms, challenges, questions (student peer-support
-- features). Faithful-but-scoped port of lms-api/src/routes/phase3.ts's
-- /community/* routes (~24 endpoints in Fastify). Only the slice the actual
-- React frontend uses is built here: room list/create/join, message list/
-- post, and read-only challenge/question listings (with has_submitted /
-- answer_count computed the same way Fastify does). Submission, leaderboard,
-- answer-posting, verification, and moderation (report/block/hide/delete)
-- have NO existing frontend anywhere in this codebase -- same reasoning as
-- tutor-onboarding/academic-extras earlier in this migration: the tables
-- exist (so has_submitted/answer_count queries are correct and the schema is
-- ready), but building UI for them is a product decision, not this repoint.
--
-- Note: this project's Postgres already has Prisma-era tables named
-- study_rooms/study_room_members/study_room_messages/challenges/
-- challenge_submissions/questions/answers (confirmed via list_tables) --
-- these are the tables lms-api's Fastify routes still read/write directly.
-- Everything here is deliberately named community_* to avoid colliding with
-- them, matching this migration's established pattern of new, cleanly-RLS'd
-- tables living alongside the untouched legacy ones until final cutover.
--
-- Nicknames: Fastify's community_profiles/buildDefaultNickname system has no
-- UI either (no "set a community nickname" screen exists); profiles.full_name
-- is used directly instead, matching how every other student-facing display
-- name in this schema already works.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'community_moderation_state') then
    create type public.community_moderation_state as enum ('visible', 'flagged');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'community_question_status') then
    create type public.community_question_status as enum ('open', 'resolved', 'closed');
  end if;
end
$$;

create table if not exists public.community_study_rooms (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  grade text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.community_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.community_study_rooms(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (room_id, profile_id)
);

create table if not exists public.community_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.community_study_rooms(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  moderation_state public.community_moderation_state not null default 'visible',
  moderation_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- created_by/xp_reward etc. are read-only from the frontend's perspective
-- today (no create-challenge UI), but kept faithful to Fastify's model so a
-- future admin/tutor challenge-creation screen needs no schema changes.
create table if not exists public.community_challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  grade text,
  week_start date not null,
  week_end date not null,
  xp_reward int not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.community_challenge_submissions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.community_challenges(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  unique (challenge_id, profile_id)
);

create table if not exists public.community_questions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  topic text not null,
  title text not null,
  body text not null,
  status public.community_question_status not null default 'open',
  moderation_state public.community_moderation_state not null default 'visible',
  moderation_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.community_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.community_questions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  is_verified boolean not null default false,
  moderation_state public.community_moderation_state not null default 'visible',
  created_at timestamptz not null default now()
);

create index if not exists idx_community_room_members_room on public.community_room_members(room_id);
create index if not exists idx_community_room_members_profile on public.community_room_members(profile_id);
create index if not exists idx_community_room_messages_room_created on public.community_room_messages(room_id, created_at desc);
create index if not exists idx_community_challenge_submissions_profile on public.community_challenge_submissions(profile_id);
create index if not exists idx_community_questions_created on public.community_questions(created_at desc);
create index if not exists idx_community_answers_question on public.community_answers(question_id);

alter table public.community_study_rooms enable row level security;
alter table public.community_room_members enable row level security;
alter table public.community_room_messages enable row level security;
alter table public.community_challenges enable row level security;
alter table public.community_challenge_submissions enable row level security;
alter table public.community_questions enable row level security;
alter table public.community_answers enable row level security;

drop policy if exists "community_rooms_read_authenticated" on public.community_study_rooms;
create policy "community_rooms_read_authenticated"
on public.community_study_rooms for select
using (auth.uid() is not null);

drop policy if exists "community_rooms_no_direct_insert" on public.community_study_rooms;
create policy "community_rooms_no_direct_insert"
on public.community_study_rooms for insert
with check (false);

drop policy if exists "community_rooms_no_direct_update" on public.community_study_rooms;
create policy "community_rooms_no_direct_update"
on public.community_study_rooms for update
using (false);

drop policy if exists "community_rooms_no_direct_delete" on public.community_study_rooms;
create policy "community_rooms_no_direct_delete"
on public.community_study_rooms for delete
using (false);

drop policy if exists "community_room_members_select_own" on public.community_room_members;
create policy "community_room_members_select_own"
on public.community_room_members for select
using (profile_id = public.current_profile_id());

drop policy if exists "community_room_members_no_direct_insert" on public.community_room_members;
create policy "community_room_members_no_direct_insert"
on public.community_room_members for insert
with check (false);

drop policy if exists "community_room_members_no_direct_update" on public.community_room_members;
create policy "community_room_members_no_direct_update"
on public.community_room_members for update
using (false);

drop policy if exists "community_room_members_no_direct_delete" on public.community_room_members;
create policy "community_room_members_no_direct_delete"
on public.community_room_members for delete
using (false);

drop policy if exists "community_room_messages_select_member" on public.community_room_messages;
create policy "community_room_messages_select_member"
on public.community_room_messages for select
using (
  exists (
    select 1 from public.community_room_members m
    where m.room_id = community_room_messages.room_id
      and m.profile_id = public.current_profile_id()
  )
  and (moderation_state = 'visible' or public.current_profile_role() in ('admin', 'tutor'))
);

drop policy if exists "community_room_messages_no_direct_insert" on public.community_room_messages;
create policy "community_room_messages_no_direct_insert"
on public.community_room_messages for insert
with check (false);

drop policy if exists "community_room_messages_no_direct_update" on public.community_room_messages;
create policy "community_room_messages_no_direct_update"
on public.community_room_messages for update
using (false);

drop policy if exists "community_room_messages_no_direct_delete" on public.community_room_messages;
create policy "community_room_messages_no_direct_delete"
on public.community_room_messages for delete
using (false);

drop policy if exists "community_challenges_read_authenticated" on public.community_challenges;
create policy "community_challenges_read_authenticated"
on public.community_challenges for select
using (auth.uid() is not null);

drop policy if exists "community_challenges_no_direct_insert" on public.community_challenges;
create policy "community_challenges_no_direct_insert"
on public.community_challenges for insert
with check (false);

drop policy if exists "community_challenges_no_direct_update" on public.community_challenges;
create policy "community_challenges_no_direct_update"
on public.community_challenges for update
using (false);

drop policy if exists "community_challenges_no_direct_delete" on public.community_challenges;
create policy "community_challenges_no_direct_delete"
on public.community_challenges for delete
using (false);

drop policy if exists "community_challenge_submissions_select_own" on public.community_challenge_submissions;
create policy "community_challenge_submissions_select_own"
on public.community_challenge_submissions for select
using (profile_id = public.current_profile_id());

drop policy if exists "community_challenge_submissions_no_direct_insert" on public.community_challenge_submissions;
create policy "community_challenge_submissions_no_direct_insert"
on public.community_challenge_submissions for insert
with check (false);

drop policy if exists "community_challenge_submissions_no_direct_update" on public.community_challenge_submissions;
create policy "community_challenge_submissions_no_direct_update"
on public.community_challenge_submissions for update
using (false);

drop policy if exists "community_challenge_submissions_no_direct_delete" on public.community_challenge_submissions;
create policy "community_challenge_submissions_no_direct_delete"
on public.community_challenge_submissions for delete
using (false);

drop policy if exists "community_questions_select" on public.community_questions;
create policy "community_questions_select"
on public.community_questions for select
using (
  moderation_state = 'visible'
  or profile_id = public.current_profile_id()
  or public.current_profile_role() in ('admin', 'tutor')
);

drop policy if exists "community_questions_no_direct_insert" on public.community_questions;
create policy "community_questions_no_direct_insert"
on public.community_questions for insert
with check (false);

drop policy if exists "community_questions_no_direct_update" on public.community_questions;
create policy "community_questions_no_direct_update"
on public.community_questions for update
using (false);

drop policy if exists "community_questions_no_direct_delete" on public.community_questions;
create policy "community_questions_no_direct_delete"
on public.community_questions for delete
using (false);

drop policy if exists "community_answers_select" on public.community_answers;
create policy "community_answers_select"
on public.community_answers for select
using (
  moderation_state = 'visible'
  or profile_id = public.current_profile_id()
  or public.current_profile_role() in ('admin', 'tutor')
);

drop policy if exists "community_answers_no_direct_insert" on public.community_answers;
create policy "community_answers_no_direct_insert"
on public.community_answers for insert
with check (false);

drop policy if exists "community_answers_no_direct_update" on public.community_answers;
create policy "community_answers_no_direct_update"
on public.community_answers for update
using (false);

drop policy if exists "community_answers_no_direct_delete" on public.community_answers;
create policy "community_answers_no_direct_delete"
on public.community_answers for delete
using (false);

create or replace function public.moderate_community_text(p_content text)
returns table (state public.community_moderation_state, flags jsonb)
language plpgsql
immutable
set search_path = public
as $$
declare
  v_text text := trim(coalesce(p_content, ''));
  v_normalized text := lower(v_text);
  v_flags text[] := '{}';
  v_profanity text[] := array['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'slut', 'dick'];
  v_term text;
begin
  if v_text = '' then
    v_flags := array_append(v_flags, 'empty_content');
  end if;

  foreach v_term in array v_profanity loop
    if position(v_term in v_normalized) > 0 then
      v_flags := array_append(v_flags, 'profanity');
      exit;
    end if;
  end loop;

  if v_text ~* '(https?://\S+).*(https?://\S+)'
     or v_text ~ '(.)\1{8,}'
     or v_text ~* '\y(buy now|free money|click here)\y' then
    v_flags := array_append(v_flags, 'spam_heuristic');
  end if;

  if length(v_text) > 1800 then
    v_flags := array_append(v_flags, 'too_long');
  end if;

  return query select
    (case when array_length(v_flags, 1) > 0 then 'flagged' else 'visible' end)::public.community_moderation_state,
    to_jsonb(v_flags);
end;
$$;

create or replace function public.create_study_room(p_subject text, p_grade text default null)
returns public.community_study_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_room public.community_study_rooms;
begin
  if v_profile_id is null or public.current_profile_role() not in ('student', 'tutor', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.community_study_rooms (subject, grade, created_by)
  values (p_subject, p_grade, v_profile_id)
  returning * into v_room;

  insert into public.community_room_members (room_id, profile_id)
  values (v_room.id, v_profile_id)
  on conflict do nothing;

  return v_room;
end;
$$;

create or replace function public.join_study_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
begin
  if v_profile_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.community_study_rooms where id = p_room_id) then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;

  insert into public.community_room_members (room_id, profile_id)
  values (p_room_id, v_profile_id)
  on conflict do nothing;
end;
$$;

create or replace function public.post_room_message(p_room_id uuid, p_content text)
returns public.community_room_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_role public.user_role := public.current_profile_role();
  v_moderation record;
  v_message public.community_room_messages;
begin
  if v_profile_id is null or v_role not in ('student', 'tutor', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.community_room_members
    where room_id = p_room_id and profile_id = v_profile_id
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_content, '')), '') is null then
    raise exception 'invalid_request' using errcode = '23514';
  end if;

  select * into v_moderation from public.moderate_community_text(p_content);

  insert into public.community_room_messages (room_id, profile_id, content, moderation_state, moderation_flags)
  values (p_room_id, v_profile_id, p_content, v_moderation.state, v_moderation.flags)
  returning * into v_message;

  return v_message;
end;
$$;

create or replace function public.get_community_rooms()
returns table (
  id uuid, subject text, grade text, created_by uuid, created_at timestamptz,
  member_count int, is_member boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
begin
  if v_profile_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select r.id, r.subject, r.grade, r.created_by, r.created_at,
           (select count(*)::int from public.community_room_members m where m.room_id = r.id) as member_count,
           exists (
             select 1 from public.community_room_members own
             where own.room_id = r.id and own.profile_id = v_profile_id
           ) as is_member
    from public.community_study_rooms r
    order by r.created_at desc;
end;
$$;

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
    select 1 from public.community_room_members
    where room_id = p_room_id and profile_id = v_profile_id
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

create or replace function public.get_community_challenges()
returns table (
  id uuid, title text, subject text, grade text, week_start date, week_end date,
  xp_reward int, created_by uuid, created_at timestamptz, has_submitted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
begin
  if v_profile_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select c.id, c.title, c.subject, c.grade, c.week_start, c.week_end, c.xp_reward, c.created_by, c.created_at,
           exists (
             select 1 from public.community_challenge_submissions cs
             where cs.challenge_id = c.id and cs.profile_id = v_profile_id
           ) as has_submitted
    from public.community_challenges c
    order by c.week_start desc, c.created_at desc;
end;
$$;

create or replace function public.get_community_questions()
returns table (
  id uuid, profile_id uuid, subject text, topic text, title text, body text,
  status public.community_question_status, moderation_state public.community_moderation_state,
  created_at timestamptz, asker_name text, answer_count int, verified_answer_id uuid
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

  return query
    select q.id, q.profile_id, q.subject, q.topic, q.title, q.body, q.status, q.moderation_state,
           q.created_at, p.full_name as asker_name,
           (select count(*)::int from public.community_answers a where a.question_id = q.id and a.moderation_state = 'visible') as answer_count,
           (select a2.id from public.community_answers a2 where a2.question_id = q.id and a2.is_verified = true order by a2.created_at asc limit 1) as verified_answer_id
    from public.community_questions q
    join public.profiles p on p.id = q.profile_id
    where q.moderation_state = 'visible' or q.profile_id = v_profile_id or v_role in ('admin', 'tutor')
    order by q.created_at desc;
end;
$$;

grant execute on function public.create_study_room(text, text) to authenticated;
grant execute on function public.join_study_room(uuid) to authenticated;
grant execute on function public.post_room_message(uuid, text) to authenticated;
grant execute on function public.get_community_rooms() to authenticated;
grant execute on function public.get_room_messages(uuid) to authenticated;
grant execute on function public.get_community_challenges() to authenticated;
grant execute on function public.get_community_questions() to authenticated;
;
