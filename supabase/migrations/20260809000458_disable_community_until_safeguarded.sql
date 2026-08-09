-- AUTH-02 — disable Community until tenant scoping + safeguarding are complete
--
-- Containment goal:
--   * no browser role can read or mutate Community base tables;
--   * no browser role can execute Community RPCs;
--   * service_role remains available only for trusted maintenance/migration work;
--   * RLS also denies reads as defense-in-depth in case table grants are
--     accidentally restored later.
--
-- The React student route is already intentionally disabled and renders an
-- unavailable state instead of calling studentCommunityRepository.ts.

-- ---------------------------------------------------------------------------
-- 1. Deny all direct browser reads through RLS
-- ---------------------------------------------------------------------------

drop policy if exists "community_rooms_read_authenticated"
  on public.community_study_rooms;
drop policy if exists "community_rooms_disabled_select"
  on public.community_study_rooms;
create policy "community_rooms_disabled_select"
on public.community_study_rooms
for select
using (false);

drop policy if exists "community_room_members_select_own"
  on public.community_room_members;
drop policy if exists "community_room_members_disabled_select"
  on public.community_room_members;
create policy "community_room_members_disabled_select"
on public.community_room_members
for select
using (false);

drop policy if exists "community_room_messages_select_member"
  on public.community_room_messages;
drop policy if exists "community_room_messages_disabled_select"
  on public.community_room_messages;
create policy "community_room_messages_disabled_select"
on public.community_room_messages
for select
using (false);

drop policy if exists "community_challenges_read_authenticated"
  on public.community_challenges;
drop policy if exists "community_challenges_disabled_select"
  on public.community_challenges;
create policy "community_challenges_disabled_select"
on public.community_challenges
for select
using (false);

drop policy if exists "community_challenge_submissions_select_own"
  on public.community_challenge_submissions;
drop policy if exists "community_challenge_submissions_disabled_select"
  on public.community_challenge_submissions;
create policy "community_challenge_submissions_disabled_select"
on public.community_challenge_submissions
for select
using (false);

drop policy if exists "community_questions_select"
  on public.community_questions;
drop policy if exists "community_questions_disabled_select"
  on public.community_questions;
create policy "community_questions_disabled_select"
on public.community_questions
for select
using (false);

drop policy if exists "community_answers_select"
  on public.community_answers;
drop policy if exists "community_answers_disabled_select"
  on public.community_answers;
create policy "community_answers_disabled_select"
on public.community_answers
for select
using (false);

-- Existing INSERT/UPDATE/DELETE policies on these tables already use
-- false checks. Keep them, and additionally remove ordinary table privileges
-- from all browser-facing roles.

revoke all privileges on table public.community_study_rooms
  from public, anon, authenticated;
revoke all privileges on table public.community_room_members
  from public, anon, authenticated;
revoke all privileges on table public.community_room_messages
  from public, anon, authenticated;
revoke all privileges on table public.community_challenges
  from public, anon, authenticated;
revoke all privileges on table public.community_challenge_submissions
  from public, anon, authenticated;
revoke all privileges on table public.community_questions
  from public, anon, authenticated;
revoke all privileges on table public.community_answers
  from public, anon, authenticated;

-- service_role is the only role intentionally left with Community table access.
grant select, insert, update, delete
  on table public.community_study_rooms,
           public.community_room_members,
           public.community_room_messages,
           public.community_challenges,
           public.community_challenge_submissions,
           public.community_questions,
           public.community_answers
  to service_role;

-- ---------------------------------------------------------------------------
-- 2. Revoke every Community RPC from browser roles
-- ---------------------------------------------------------------------------

revoke all on function public.moderate_community_text(text)
  from public, anon, authenticated;
revoke all on function public.create_study_room(text, text)
  from public, anon, authenticated;
revoke all on function public.join_study_room(uuid)
  from public, anon, authenticated;
revoke all on function public.post_room_message(uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_community_rooms()
  from public, anon, authenticated;
revoke all on function public.get_room_messages(uuid)
  from public, anon, authenticated;
revoke all on function public.get_community_challenges()
  from public, anon, authenticated;
revoke all on function public.get_community_questions()
  from public, anon, authenticated;

grant execute on function public.moderate_community_text(text)
  to service_role;
grant execute on function public.create_study_room(text, text)
  to service_role;
grant execute on function public.join_study_room(uuid)
  to service_role;
grant execute on function public.post_room_message(uuid, text)
  to service_role;
grant execute on function public.get_community_rooms()
  to service_role;
grant execute on function public.get_room_messages(uuid)
  to service_role;
grant execute on function public.get_community_challenges()
  to service_role;
grant execute on function public.get_community_questions()
  to service_role;

comment on table public.community_study_rooms is
  'AUTH-02 containment: Community disabled for browser roles pending tenant scoping, pseudonyms, reporting/blocking, moderation review, and runtime role/org tests.';

comment on function public.get_community_rooms() is
  'AUTH-02 containment: service_role only until Community safeguarding redesign is complete.';