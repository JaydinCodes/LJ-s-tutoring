begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- AUTH-02 linked transactional preflight.
-- Pending migration is inserted at this marker:
-- AUTH02_PENDING_MIGRATION

select no_plan();

-- ---------------------------------------------------------------------------
-- Community RPC execution is disabled for browser roles.
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege(
    'anon',
    'public.get_community_rooms()',
    'EXECUTE'
  ),
  'anon cannot execute get_community_rooms'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_community_rooms()',
    'EXECUTE'
  ),
  'authenticated cannot execute get_community_rooms'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_study_room(text,text)',
    'EXECUTE'
  ),
  'authenticated cannot create study rooms'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.join_study_room(uuid)',
    'EXECUTE'
  ),
  'authenticated cannot join study rooms'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.post_room_message(uuid,text)',
    'EXECUTE'
  ),
  'authenticated cannot post room messages'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_room_messages(uuid)',
    'EXECUTE'
  ),
  'authenticated cannot read room messages'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_community_challenges()',
    'EXECUTE'
  ),
  'authenticated cannot read community challenges'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_community_questions()',
    'EXECUTE'
  ),
  'authenticated cannot read community questions'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.moderate_community_text(text)',
    'EXECUTE'
  ),
  'authenticated cannot invoke Community helper functions'
);

-- PUBLIC is a pseudo-role, so inspect the function ACL directly rather than
-- passing it to has_function_privilege().
select ok(
  not exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) acl
    where p.oid = 'public.get_community_rooms()'::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute Community read RPCs'
);

-- Trusted maintenance context is intentionally preserved.
select ok(
  has_function_privilege(
    'service_role',
    'public.get_community_rooms()',
    'EXECUTE'
  ),
  'service_role retains trusted Community RPC access'
);

-- ---------------------------------------------------------------------------
-- Direct base-table access is disabled for browser roles.
-- ---------------------------------------------------------------------------

select ok(
  not has_table_privilege(
    'anon',
    'public.community_study_rooms',
    'SELECT'
  ),
  'anon has no direct Community room read privilege'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.community_study_rooms',
    'SELECT'
  ),
  'authenticated has no direct Community room read privilege'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.community_room_members',
    'SELECT'
  ),
  'authenticated has no direct Community membership read privilege'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.community_room_messages',
    'SELECT'
  ),
  'authenticated has no direct Community message read privilege'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.community_challenges',
    'SELECT'
  ),
  'authenticated has no direct Community challenge read privilege'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.community_challenge_submissions',
    'SELECT'
  ),
  'authenticated has no direct Community challenge-submission read privilege'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.community_questions',
    'SELECT'
  ),
  'authenticated has no direct Community question read privilege'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.community_answers',
    'SELECT'
  ),
  'authenticated has no direct Community answer read privilege'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.community_room_messages',
    'INSERT'
  ),
  'authenticated has no direct Community message write privilege'
);

select ok(
  has_table_privilege(
    'service_role',
    'public.community_study_rooms',
    'SELECT'
  ),
  'service_role retains trusted Community table access'
);

-- ---------------------------------------------------------------------------
-- RLS defense-in-depth: all Community SELECT policies are deny-all.
-- ---------------------------------------------------------------------------

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'community_study_rooms',
        'community_room_members',
        'community_room_messages',
        'community_challenges',
        'community_challenge_submissions',
        'community_questions',
        'community_answers'
      )
      and cmd = 'SELECT'
      and qual <> 'false'
  ),
  0::bigint,
  'all Community SELECT policies are deny-all'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'community_study_rooms',
        'community_room_members',
        'community_room_messages',
        'community_challenges',
        'community_challenge_submissions',
        'community_questions',
        'community_answers'
      )
      and cmd = 'SELECT'
      and qual = 'false'
  ),
  7::bigint,
  'each Community table has exactly one deny-all SELECT policy'
);

select * from finish();

rollback;