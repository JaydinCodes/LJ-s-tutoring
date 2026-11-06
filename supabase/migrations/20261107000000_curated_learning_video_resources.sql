-- Curated external-video catalogue. Candidate links are never learner-visible
-- until a reviewer verifies availability, instructional fit and narration.
create table public.learning_video_resources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9._-]+$'),
  youtube_video_id text not null unique check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null check (char_length(btrim(title)) between 1 and 240),
  channel_name text not null check (char_length(btrim(channel_name)) between 1 and 160),
  description text not null check (char_length(btrim(description)) between 1 and 2000),
  duration_seconds integer check (duration_seconds > 0),
  display_order integer not null default 0 check (display_order >= 0),
  availability_status text not null default 'unverified' check (availability_status in ('unverified','available','unavailable','restricted')),
  review_status public.question_review_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  availability_verified_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (review_status <> 'approved' or (reviewed_by is not null and reviewed_at is not null and availability_status='available' and availability_verified_at is not null))
);
create table public.learning_video_resource_skills (
  learning_video_resource_id uuid not null references public.learning_video_resources(id) on delete restrict,
  curriculum_skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  primary key(learning_video_resource_id,curriculum_skill_id)
);
create index learning_video_resource_skills_skill_idx on public.learning_video_resource_skills(curriculum_skill_id);
alter table public.learning_video_resources enable row level security;
alter table public.learning_video_resource_skills enable row level security;
create policy "learning_video_resources_tutor_admin_read" on public.learning_video_resources for select to authenticated using(public.current_profile_role() in ('tutor','admin'));
create policy "learning_video_resource_skills_tutor_admin_read" on public.learning_video_resource_skills for select to authenticated using(public.current_profile_role() in ('tutor','admin'));

create or replace function public.review_learning_video_resource_action(p_resource_id uuid,p_action text,p_notes text default null,p_availability_status text default null,p_duration_seconds integer default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_from public.question_review_status; v_to public.question_review_status; v_availability text;
begin
  perform public.content_admin_required();
  select review_status,availability_status into v_from,v_availability from public.learning_video_resources where id=p_resource_id for update;
  if not found then raise exception 'learning_video_resource_not_found' using errcode='P0002'; end if;
  v_to:=case p_action when 'submit_for_review' then 'in_review'::public.question_review_status when 'approve' then 'approved'::public.question_review_status when 'reject' then 'rejected'::public.question_review_status when 'return_for_revision' then 'draft'::public.question_review_status when 'retire' then 'retired'::public.question_review_status else null end;
  if v_to is null then raise exception 'invalid_review_action' using errcode='22023'; end if;
  if p_action='approve' and v_from<>'in_review' then raise exception 'invalid_review_transition' using errcode='23514'; end if;
  if p_action in ('reject','return_for_revision','retire') and nullif(btrim(p_notes),'') is null then raise exception 'review_notes_required' using errcode='23514'; end if;
  if p_availability_status is not null and p_availability_status not in ('available','unavailable','restricted') then raise exception 'invalid_availability_status' using errcode='22023'; end if;
  if p_action='approve' and coalesce(p_availability_status,v_availability)<>'available' then raise exception 'video_must_be_verified_available_before_approval' using errcode='23514'; end if;
  update public.learning_video_resources set review_status=v_to,availability_status=coalesce(p_availability_status,availability_status),duration_seconds=coalesce(p_duration_seconds,duration_seconds),availability_verified_at=case when coalesce(p_availability_status,availability_status)='available' then now() else availability_verified_at end,reviewed_by=public.current_profile_id(),reviewed_at=now(),review_notes=p_notes,updated_at=now() where id=p_resource_id;
  perform public.log_audit_event('learning_video_resource.reviewed','learning_video_resource',p_resource_id::text,jsonb_build_object('action',p_action,'from_status',v_from,'to_status',v_to,'availability',coalesce(p_availability_status,v_availability)));
end; $$;

create or replace function public.get_my_approved_learning_video_resources()
returns table(resource_code text,skill_code text,title text,channel_name text,description text,youtube_url text,duration_seconds integer,display_order integer)
language sql stable security definer set search_path='' as $$
  select resource.code,skill.skill_code,resource.title,resource.channel_name,resource.description,'https://www.youtube.com/watch?v=' || resource.youtube_video_id,resource.duration_seconds,resource.display_order
  from public.learning_video_resources resource
  join public.learning_video_resource_skills linked on linked.learning_video_resource_id=resource.id
  join public.curriculum_skills skill on skill.id=linked.curriculum_skill_id
  where public.current_profile_role()='student' and resource.review_status='approved' and resource.availability_status='available'
  order by skill.skill_code,resource.display_order,resource.code;
$$;

create or replace function public.get_learning_video_resource_catalog()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform public.content_admin_required();
  return coalesce((select jsonb_agg(jsonb_build_object('id',resource.id,'code',resource.code,'title',resource.title,'channelName',resource.channel_name,'youtubeVideoId',resource.youtube_video_id,'status',resource.review_status,'availabilityStatus',resource.availability_status,'durationSeconds',resource.duration_seconds,'displayOrder',resource.display_order,'reviewNotes',resource.review_notes,'skills',coalesce((select jsonb_agg(skill.skill_code order by skill.skill_code) from public.learning_video_resource_skills linked join public.curriculum_skills skill on skill.id=linked.curriculum_skill_id where linked.learning_video_resource_id=resource.id),'[]'::jsonb)) order by resource.display_order,resource.code) from public.learning_video_resources resource),'[]'::jsonb);
end; $$;

-- A changed destination must be verified again. Ordering and skill mapping can be
-- corrected without publishing an unreviewed resource or exposing it to learners.
create or replace function public.update_learning_video_resource_metadata(
  p_resource_id uuid,
  p_youtube_video_id text default null,
  p_display_order integer default null,
  p_skill_codes text[] default null
)
returns void language plpgsql security definer set search_path='' as $$
declare v_previous_id text; v_changed_id boolean := false; v_known_skills integer;
begin
  perform public.content_admin_required();
  select youtube_video_id into v_previous_id from public.learning_video_resources where id=p_resource_id for update;
  if not found then raise exception 'learning_video_resource_not_found' using errcode='P0002'; end if;
  if p_youtube_video_id is not null and p_youtube_video_id !~ '^[A-Za-z0-9_-]{11}$' then raise exception 'invalid_youtube_video_id' using errcode='22023'; end if;
  if p_display_order is not null and p_display_order < 0 then raise exception 'invalid_display_order' using errcode='22023'; end if;
  v_changed_id := p_youtube_video_id is not null and p_youtube_video_id <> v_previous_id;
  if p_skill_codes is not null then
    if cardinality(p_skill_codes) = 0 then raise exception 'at_least_one_curriculum_skill_required' using errcode='22023'; end if;
    select count(*) into v_known_skills from public.curriculum_skills where skill_code = any(p_skill_codes);
    if v_known_skills <> cardinality(p_skill_codes) then raise exception 'unknown_curriculum_skill_code' using errcode='22023'; end if;
    delete from public.learning_video_resource_skills where learning_video_resource_id=p_resource_id;
    insert into public.learning_video_resource_skills(learning_video_resource_id,curriculum_skill_id)
    select p_resource_id,id from public.curriculum_skills where skill_code = any(p_skill_codes);
  end if;
  update public.learning_video_resources set
    youtube_video_id=coalesce(p_youtube_video_id,youtube_video_id),
    display_order=coalesce(p_display_order,display_order),
    review_status=case when v_changed_id then 'draft'::public.question_review_status else review_status end,
    availability_status=case when v_changed_id then 'unverified' else availability_status end,
    availability_verified_at=case when v_changed_id then null else availability_verified_at end,
    reviewed_by=case when v_changed_id then null else reviewed_by end,
    reviewed_at=case when v_changed_id then null else reviewed_at end,
    review_notes=case when v_changed_id then 'YouTube destination changed; verify public access, duration, lesson fit, narration and rights before approval.' else review_notes end,
    updated_at=now()
  where id=p_resource_id;
  perform public.log_audit_event('learning_video_resource.metadata_updated','learning_video_resource',p_resource_id::text,jsonb_build_object('youtube_id_changed',v_changed_id,'display_order',p_display_order,'skill_codes',p_skill_codes));
end; $$;

with candidates(code,youtube_video_id,title,channel_name,description,display_order,skill_codes) as (
  values
   ('VID.G8.INT.001','O6bRgxVRoZ4','How to Add, Subtract, Multiply, and Divide Integers','Math with Mr. J','Candidate bridge lesson for integer operations.',1,array['G8-NUM-INTEGERS-OPERATIONS']),
   ('VID.G8.ORDER.001','70cAYYCJBuQ','How to Use BODMAS (Order of Operations)','Cognito','Candidate bridge lesson for order of operations.',2,array['G8-NUM-WHOLE-PROPERTIES']),
   ('VID.G8.SUB.001','k-KiWkV81fQ','Intro to Evaluating Algebraic Expressions','Math with Mr. J','Candidate bridge lesson for substitution.',3,array['G8-ALG-LANGUAGE-TERMS']),
   ('VID.G8.EQN.001','L0_K89UJfJY','How to Solve One-Step Equations','Math with Mr. J','Candidate bridge lesson for simple linear equations.',4,array['G8-EQ-LINEAR-INVERSES']),
   ('VID.G8.FACT.001','B_Qzw8bpFfA','HCF and LCM','Maths Genie','Candidate bridge lesson for factors, HCF and LCM.',5,array['G8-NUM-WHOLE-PROPERTIES']),
   ('VID.G8.FRACT.001','h1HlYqeeJYw','Adding & Subtracting Common Fractions','Danemathics','Candidate bridge lesson for common fractions.',6,array['G8-NUM-FRACTIONS-OPERATIONS']),
   ('VID.G8.EXP.001','B4zejSI8zho','Math Antics – Exponents and Square Roots','Math Antics','Candidate bridge lesson for exponents and roots.',7,array['G8-EXP-LAWS-SCI','G8-NUM-INTEGERS-OPERATIONS']),
   ('VID.G9.ALG.LANGUAGE.001','ppr6RXu0kb4','Basics of Algebra: Expressions, Variables, Constants, Coefficients and Terms','Amazing Maths','Candidate Grade 9 lesson for algebraic language.',8,array['G9.ALG.LANGUAGE.VARIABLES','G9.ALG.LANGUAGE.COEFFICIENTS','G9.ALG.LANGUAGE.TERMS']),
   ('VID.G9.DIST.001','v-6MShC82ow','Algebra Basics: The Distributive Property','Math Antics','Candidate Grade 9 lesson for expanding brackets.',9,array['G9.ALG.DISTRIBUTIVE']),
   ('VID.G9.FACTOR.COMMON.001','IFsWbLvx6yI','Factorising Single Brackets','Maths Genie','Candidate Grade 9 lesson for common-factor factorisation.',10,array['G9.ALG.FACTOR.COMMON']),
   ('VID.G9.DOTS.001','IqN8Z1-nlsY','Difference Between Two Squares','Corbettmaths','Candidate Grade 9 lesson for Difference of Two Squares.',11,array['G9.ALG.FACTOR.DOTS']),
   ('VID.G9.EQN.FACTOR.001','wJ_tLEwEEi8','Solving Quadratics by Factorising','Corbettmaths','Candidate Grade 9 lesson for equations by factorisation.',12,array['G9.EQN.FACTORISED']),
   ('VID.G9.GRAPH.LINEAR.001','MXV65i9g1Xg','Basic Linear Functions','Math Antics','Candidate Grade 9 lesson for linear graphs.',13,array['G9.GRAPH.LINEAR_DRAW','G9.GRAPH.GRADIENT']),
   ('VID.G9.EXP.001','LkhPRz7Hocg','Algebra Basics: Laws of Exponents','Math Antics','Candidate Grade 9 lesson for exponent laws.',14,array['G9-EXP-NEGATIVE-SCI'])
), inserted as (
  insert into public.learning_video_resources(code,youtube_video_id,title,channel_name,description,display_order,availability_status,review_status,review_notes)
  select code,youtube_video_id,title,channel_name,description,display_order,'unverified','draft',case when code='VID.G8.EQN.001' then 'Candidate was supplied with a 12-character value (L0_K89UJfJYw). The stored 11-character prefix (L0_K89UJfJY) is unverified and must be checked on YouTube before it can be submitted or approved.' else 'Seeded candidate. Network verification was not possible in the implementation environment; reviewer must verify public accessibility, duration, grade/topic fit, narration and rights before approval.' end from candidates
  on conflict(code) do nothing returning id,code
)
insert into public.learning_video_resource_skills(learning_video_resource_id,curriculum_skill_id)
select resource.id,skill.id from inserted resource join candidates candidate on candidate.code=resource.code cross join lateral unnest(candidate.skill_codes) as supplied(skill_code) join public.curriculum_skills skill on skill.skill_code=supplied.skill_code
on conflict do nothing;

revoke all on function public.review_learning_video_resource_action(uuid,text,text,text,integer) from public;
revoke all on function public.get_my_approved_learning_video_resources() from public;
revoke all on function public.get_learning_video_resource_catalog() from public;
revoke all on function public.update_learning_video_resource_metadata(uuid,text,integer,text[]) from public;
grant execute on function public.review_learning_video_resource_action(uuid,text,text,text,integer) to authenticated;
grant execute on function public.get_my_approved_learning_video_resources() to authenticated;
grant execute on function public.get_learning_video_resource_catalog() to authenticated;
grant execute on function public.update_learning_video_resource_metadata(uuid,text,integer,text[]) to authenticated;
