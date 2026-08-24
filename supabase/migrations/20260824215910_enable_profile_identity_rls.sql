-- profile_identities is an internal lookup table used by trusted helpers and
-- the profile-sync trigger. Browser roles have no table privileges and there
-- are deliberately no RLS policies: no direct client path is allowed.
-- Enabling RLS adds defence in depth and satisfies the public-schema posture
-- without reintroducing the recursion this table was created to avoid.
alter table public.profile_identities enable row level security;

revoke all on table public.profile_identities from anon, authenticated;
