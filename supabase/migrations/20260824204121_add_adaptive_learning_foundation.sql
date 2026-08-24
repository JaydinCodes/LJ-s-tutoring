-- Grade 12 Mathematics adaptive-learning foundation.
--
-- This stores atomic skill evidence and an internal instructional state used
-- only to sequence tutor-approved next actions. It does not create learner
-- levels, ranking, placement, or an automated decision path.

create table public.curriculum_skills (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  grade text not null,
  curriculum text not null default 'CAPS',
  strand text not null,
  topic text not null,
  skill_code text not null unique,
  title text not null,
  description text,
  cognitive_level text,
  review_status text not null default 'draft'
    check (review_status in ('draft', 'teacher_review', 'approved', 'published', 'retired')),
  is_active boolean not null default true,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(skill_code) <> '' and btrim(title) <> '' and btrim(strand) <> '' and btrim(topic) <> ''),
  check ((review_status in ('approved', 'published') and reviewed_at is not null) or review_status not in ('approved', 'published'))
);

create index curriculum_skills_subject_grade_topic_idx
  on public.curriculum_skills(subject_id, grade, strand, topic)
  where is_active;

create table public.skill_prerequisites (
  skill_id uuid not null references public.curriculum_skills(id) on delete cascade,
  prerequisite_skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  strength numeric(3,2) not null default 1 check (strength > 0 and strength <= 1),
  created_at timestamptz not null default now(),
  primary key (skill_id, prerequisite_skill_id),
  check (skill_id <> prerequisite_skill_id)
);

create table public.learning_activities (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  grade text not null,
  title text not null,
  summary text,
  activity_type text not null check (activity_type in ('diagnostic', 'reteach', 'guided_practice', 'mixed_practice', 'extension')),
  estimated_minutes integer not null check (estimated_minutes between 5 and 120),
  content_reference text not null,
  accessibility_notes text,
  review_status text not null default 'draft'
    check (review_status in ('draft', 'teacher_review', 'approved', 'published', 'retired')),
  is_active boolean not null default true,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(title) <> '' and btrim(content_reference) <> ''),
  check ((review_status in ('approved', 'published') and reviewed_at is not null) or review_status not in ('approved', 'published'))
);

create index learning_activities_subject_grade_type_idx
  on public.learning_activities(subject_id, grade, activity_type)
  where is_active and review_status in ('approved', 'published');

create table public.activity_skill_targets (
  activity_id uuid not null references public.learning_activities(id) on delete cascade,
  skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  target_role text not null default 'primary' check (target_role in ('primary', 'supporting')),
  cognitive_level text,
  evidence_weight numeric(3,2) not null default 1 check (evidence_weight > 0 and evidence_weight <= 1),
  primary key (activity_id, skill_id)
);

create index activity_skill_targets_skill_idx on public.activity_skill_targets(skill_id, target_role);

create table public.learning_evidence (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  score numeric(5,2) not null check (score between 0 and 100),
  evidence_type text not null check (evidence_type in ('rubric', 'diagnostic', 'tutor_observation', 'assignment')),
  source_reference text not null,
  source_submission_id uuid references public.assignment_submissions(id) on delete set null,
  observed_at timestamptz not null default now(),
  reviewed_at timestamptz not null default now(),
  learner_visible boolean not null default false,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (btrim(source_reference) <> '')
);

create index learning_evidence_student_skill_recent_idx
  on public.learning_evidence(student_id, skill_id, observed_at desc);

create table public.learner_skill_state (
  student_id uuid not null references public.students(id) on delete cascade,
  skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  instructional_state text not null check (instructional_state in ('insufficient_evidence', 'rebuild', 'practice', 'consolidate', 'extend')),
  internal_score numeric(5,2),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  evidence_count integer not null check (evidence_count >= 0),
  recent_trend numeric(5,2),
  calculation_version text not null default 'v1',
  evidence_window_start timestamptz,
  evidence_window_end timestamptz,
  computed_at timestamptz not null default now(),
  primary key (student_id, skill_id)
);

create table public.learning_recommendations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  activity_id uuid not null references public.learning_activities(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'approved', 'deferred', 'dismissed', 'completed', 'expired')),
  learner_copy text not null,
  rationale_json jsonb not null default '{}'::jsonb check (jsonb_typeof(rationale_json) = 'object'),
  calculation_version text not null default 'v1',
  proposed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  decided_by_profile_id uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  check (btrim(learner_copy) <> ''),
  check (expires_at > proposed_at)
);

create unique index learning_recommendations_one_open_per_skill_idx
  on public.learning_recommendations(student_id, skill_id)
  where status in ('draft', 'approved', 'deferred');
create index learning_recommendations_student_status_idx
  on public.learning_recommendations(student_id, status, expires_at);

create table public.recommendation_decisions (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.learning_recommendations(id) on delete cascade,
  decision text not null check (decision in ('approved', 'deferred', 'dismissed', 'replaced')),
  activity_id uuid references public.learning_activities(id) on delete restrict,
  note text,
  decided_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  decided_at timestamptz not null default now()
);

create index recommendation_decisions_recommendation_idx
  on public.recommendation_decisions(recommendation_id, decided_at desc);

-- Direct client mutations are forbidden. Admin taxonomy authors use AAL2 RLS;
-- evidence and recommendation changes flow through the RPCs below.
alter table public.curriculum_skills enable row level security;
alter table public.skill_prerequisites enable row level security;
alter table public.learning_activities enable row level security;
alter table public.activity_skill_targets enable row level security;
alter table public.learning_evidence enable row level security;
alter table public.learner_skill_state enable row level security;
alter table public.learning_recommendations enable row level security;
alter table public.recommendation_decisions enable row level security;

revoke all on table public.curriculum_skills, public.skill_prerequisites,
  public.learning_activities, public.activity_skill_targets, public.learning_evidence,
  public.learner_skill_state, public.learning_recommendations, public.recommendation_decisions
from anon, authenticated;
grant select on table public.curriculum_skills, public.skill_prerequisites,
  public.learning_activities, public.activity_skill_targets, public.learning_evidence,
  public.learner_skill_state, public.learning_recommendations, public.recommendation_decisions
to authenticated;

create policy "adaptive_admin_manage_curriculum_skills" on public.curriculum_skills for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "adaptive_admin_manage_skill_prerequisites" on public.skill_prerequisites for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "adaptive_admin_manage_learning_activities" on public.learning_activities for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "adaptive_admin_manage_activity_skill_targets" on public.activity_skill_targets for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "adaptive_admin_read_learning_evidence" on public.learning_evidence for select to authenticated using (public.is_platform_admin());
create policy "adaptive_tutor_read_allocated_learning_evidence" on public.learning_evidence for select to authenticated using (
  exists (select 1 from public.tutor_student_allocations allocation where allocation.student_id = learning_evidence.student_id and allocation.tutor_id = public.current_tutor_id() and allocation.status = 'active')
);
create policy "adaptive_admin_read_skill_states" on public.learner_skill_state for select to authenticated using (public.is_platform_admin());
create policy "adaptive_tutor_read_allocated_skill_states" on public.learner_skill_state for select to authenticated using (
  exists (select 1 from public.tutor_student_allocations allocation where allocation.student_id = learner_skill_state.student_id and allocation.tutor_id = public.current_tutor_id() and allocation.status = 'active')
);
create policy "adaptive_admin_read_recommendations" on public.learning_recommendations for select to authenticated using (public.is_platform_admin());
create policy "adaptive_tutor_read_allocated_recommendations" on public.learning_recommendations for select to authenticated using (
  exists (select 1 from public.tutor_student_allocations allocation where allocation.student_id = learning_recommendations.student_id and allocation.tutor_id = public.current_tutor_id() and allocation.status = 'active')
);
create policy "adaptive_admin_read_recommendation_decisions" on public.recommendation_decisions for select to authenticated using (public.is_platform_admin());
create policy "adaptive_tutor_read_allocated_recommendation_decisions" on public.recommendation_decisions for select to authenticated using (
  exists (
    select 1 from public.learning_recommendations recommendation
    join public.tutor_student_allocations allocation on allocation.student_id = recommendation.student_id
    where recommendation.id = recommendation_decisions.recommendation_id
      and allocation.tutor_id = public.current_tutor_id()
      and allocation.status = 'active'
  )
);

create or replace function public.can_manage_learning_for_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.is_platform_admin() or exists (
      select 1 from public.tutor_student_allocations allocation
      where allocation.student_id = p_student_id
        and allocation.tutor_id = public.current_tutor_id()
        and allocation.status = 'active'
    ), false
  )
$$;

create or replace function public.record_learning_evidence(
  p_student_id uuid,
  p_skill_id uuid,
  p_score numeric,
  p_evidence_type text,
  p_source_reference text,
  p_observed_at timestamptz default now(),
  p_source_submission_id uuid default null,
  p_learner_visible boolean default false
)
returns public.learning_evidence
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evidence public.learning_evidence;
  v_type text := lower(btrim(coalesce(p_evidence_type, '')));
begin
  if not public.can_manage_learning_for_student(p_student_id) then
    raise exception 'learning_evidence_not_authorized' using errcode = '42501';
  end if;
  if p_skill_id is null or not exists (select 1 from public.curriculum_skills where id = p_skill_id and is_active and review_status in ('approved', 'published')) then
    raise exception 'curriculum_skill_not_available' using errcode = 'P0002';
  end if;
  if p_score is null or p_score < 0 or p_score > 100 then
    raise exception 'learning_evidence_score_invalid' using errcode = '22023';
  end if;
  if v_type not in ('rubric', 'diagnostic', 'tutor_observation', 'assignment') then
    raise exception 'learning_evidence_type_invalid' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_source_reference, '')), '') is null then
    raise exception 'learning_evidence_source_required' using errcode = '22023';
  end if;
  if p_observed_at is null or p_observed_at > now() + interval '5 minutes' then
    raise exception 'learning_evidence_observed_at_invalid' using errcode = '22023';
  end if;

  insert into public.learning_evidence (
    student_id, skill_id, score, evidence_type, source_reference,
    source_submission_id, observed_at, reviewed_at, learner_visible, created_by_profile_id
  ) values (
    p_student_id, p_skill_id, p_score, v_type, btrim(p_source_reference),
    p_source_submission_id, p_observed_at, now(), coalesce(p_learner_visible, false), public.current_profile_id()
  ) returning * into v_evidence;

  perform public.log_audit_event('learning.evidence_recorded', 'learning_evidence', v_evidence.id::text,
    jsonb_build_object('student_id', p_student_id, 'skill_id', p_skill_id, 'evidence_type', v_type));
  return v_evidence;
end;
$$;

create or replace function public.recompute_learner_skill_state(
  p_student_id uuid,
  p_skill_id uuid
)
returns public.learner_skill_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_score numeric;
  v_trend numeric;
  v_state text;
  v_record public.learner_skill_state;
begin
  if not public.can_manage_learning_for_student(p_student_id) then
    raise exception 'learning_state_not_authorized' using errcode = '42501';
  end if;
  if p_skill_id is null or not exists (select 1 from public.curriculum_skills where id = p_skill_id and is_active and review_status in ('approved', 'published')) then
    raise exception 'curriculum_skill_not_available' using errcode = 'P0002';
  end if;

  with weighted as (
    select score,
      case evidence_type when 'rubric' then 1.00 when 'diagnostic' then 0.95 when 'tutor_observation' then 0.70 else 0.55 end
      * exp(-greatest(0, extract(epoch from (now() - observed_at)) / 86400) / 90.0) as weight,
      row_number() over (order by observed_at desc, created_at desc) as sequence
    from public.learning_evidence
    where student_id = p_student_id and skill_id = p_skill_id and reviewed_at is not null
  )
  select count(*),
    case when sum(weight) > 0 then round(sum(score * weight) / sum(weight), 2) end,
    case when count(*) >= 2 then round(max(score) filter (where sequence = 1) - max(score) filter (where sequence = 2), 2) end
  into v_count, v_score, v_trend
  from weighted;

  v_state := case
    when coalesce(v_count, 0) < 2 then 'insufficient_evidence'
    when v_score < 55 then 'rebuild'
    when v_score < 70 then 'practice'
    when v_score < 85 then 'consolidate'
    else 'extend'
  end;

  insert into public.learner_skill_state (
    student_id, skill_id, instructional_state, internal_score, confidence,
    evidence_count, recent_trend, calculation_version, evidence_window_start,
    evidence_window_end, computed_at
  ) values (
    p_student_id, p_skill_id, v_state, v_score,
    least(1::numeric, coalesce(v_count, 0)::numeric / 4), coalesce(v_count, 0),
    v_trend, 'v1', now() - interval '180 days', now(), now()
  ) on conflict (student_id, skill_id) do update set
    instructional_state = excluded.instructional_state,
    internal_score = excluded.internal_score,
    confidence = excluded.confidence,
    evidence_count = excluded.evidence_count,
    recent_trend = excluded.recent_trend,
    calculation_version = excluded.calculation_version,
    evidence_window_start = excluded.evidence_window_start,
    evidence_window_end = excluded.evidence_window_end,
    computed_at = now()
  returning * into v_record;

  return v_record;
end;
$$;

create or replace function public.refresh_learning_recommendation(
  p_student_id uuid,
  p_skill_id uuid
)
returns public.learning_recommendations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.learner_skill_state;
  v_existing public.learning_recommendations;
  v_activity public.learning_activities;
  v_recommendation public.learning_recommendations;
  v_activity_type text;
  v_copy text;
begin
  if not public.can_manage_learning_for_student(p_student_id) then
    raise exception 'learning_recommendation_not_authorized' using errcode = '42501';
  end if;
  v_state := public.recompute_learner_skill_state(p_student_id, p_skill_id);

  select * into v_existing from public.learning_recommendations
  where student_id = p_student_id and skill_id = p_skill_id
    and status in ('draft', 'approved', 'deferred')
  order by proposed_at desc
  limit 1;
  if found then
    return v_existing;
  end if;

  v_activity_type := case v_state.instructional_state
    when 'insufficient_evidence' then 'diagnostic'
    when 'rebuild' then 'reteach'
    when 'practice' then 'guided_practice'
    when 'consolidate' then 'mixed_practice'
    else 'extension'
  end;

  select activity.* into v_activity
  from public.learning_activities activity
  join public.activity_skill_targets target on target.activity_id = activity.id
  where target.skill_id = p_skill_id
    and target.target_role = 'primary'
    and activity.is_active
    and activity.review_status in ('approved', 'published')
    and activity.activity_type = v_activity_type
  order by activity.estimated_minutes asc, activity.created_at asc
  limit 1;
  if not found then
    raise exception 'learning_activity_not_available' using errcode = 'P0002';
  end if;

  v_copy := case v_state.instructional_state
    when 'insufficient_evidence' then 'Try this short check so your tutor can choose the most useful next practice.'
    when 'rebuild' then 'Strengthen this foundation next; it will make the following Mathematics questions easier.'
    when 'practice' then 'Build confidence with a few focused questions on this method.'
    when 'consolidate' then 'Keep this method ready by practising it in a mixed set of questions.'
    else 'Try a more challenging application of this method.'
  end;

  insert into public.learning_recommendations (
    student_id, skill_id, activity_id, status, learner_copy, rationale_json, calculation_version
  ) values (
    p_student_id, p_skill_id, v_activity.id, 'draft', v_copy,
    jsonb_build_object('reason_code', v_state.instructional_state, 'evidence_count', v_state.evidence_count,
      'internal_score', v_state.internal_score, 'recent_trend', v_state.recent_trend),
    v_state.calculation_version
  ) returning * into v_recommendation;

  perform public.log_audit_event('learning.recommendation_drafted', 'learning_recommendation', v_recommendation.id::text,
    jsonb_build_object('student_id', p_student_id, 'skill_id', p_skill_id, 'activity_id', v_activity.id));
  return v_recommendation;
end;
$$;

create or replace function public.decide_learning_recommendation(
  p_recommendation_id uuid,
  p_decision text,
  p_note text default null,
  p_activity_id uuid default null
)
returns public.learning_recommendations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recommendation public.learning_recommendations;
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_activity_id uuid;
begin
  select * into v_recommendation from public.learning_recommendations where id = p_recommendation_id for update;
  if not found then
    raise exception 'learning_recommendation_not_found' using errcode = 'P0002';
  end if;
  if not public.can_manage_learning_for_student(v_recommendation.student_id) then
    raise exception 'learning_recommendation_not_authorized' using errcode = '42501';
  end if;
  if v_recommendation.status not in ('draft', 'deferred') then
    raise exception 'learning_recommendation_not_actionable' using errcode = '23514';
  end if;
  if v_decision not in ('approved', 'deferred', 'dismissed', 'replaced') then
    raise exception 'learning_recommendation_decision_invalid' using errcode = '22023';
  end if;

  v_activity_id := coalesce(p_activity_id, v_recommendation.activity_id);
  if v_decision = 'replaced' then
    if p_activity_id is null or not exists (
      select 1 from public.learning_activities activity
      join public.activity_skill_targets target on target.activity_id = activity.id
      where activity.id = p_activity_id and target.skill_id = v_recommendation.skill_id
        and target.target_role = 'primary' and activity.is_active
        and activity.review_status in ('approved', 'published')
    ) then
      raise exception 'replacement_activity_not_eligible' using errcode = '22023';
    end if;
  end if;

  update public.learning_recommendations set
    activity_id = v_activity_id,
    status = case when v_decision in ('approved', 'replaced') then 'approved' else v_decision end,
    decided_by_profile_id = public.current_profile_id(),
    decided_at = now(),
    decision_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_recommendation_id
  returning * into v_recommendation;

  insert into public.recommendation_decisions (recommendation_id, decision, activity_id, note, decided_by_profile_id)
  values (v_recommendation.id, v_decision, v_activity_id, nullif(btrim(coalesce(p_note, '')), ''), public.current_profile_id());
  perform public.log_audit_event('learning.recommendation_decided', 'learning_recommendation', v_recommendation.id::text,
    jsonb_build_object('decision', v_decision, 'activity_id', v_activity_id));
  return v_recommendation;
end;
$$;

create or replace function public.get_my_learning_recommendations()
returns table (
  recommendation_id uuid,
  skill_title text,
  skill_topic text,
  activity_title text,
  activity_summary text,
  activity_reference text,
  estimated_minutes integer,
  learner_copy text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select recommendation.id, skill.title, skill.topic, activity.title,
    activity.summary, activity.content_reference, activity.estimated_minutes,
    recommendation.learner_copy, recommendation.expires_at
  from public.learning_recommendations recommendation
  join public.curriculum_skills skill on skill.id = recommendation.skill_id
  join public.learning_activities activity on activity.id = recommendation.activity_id
  where recommendation.student_id = public.current_student_id()
    and recommendation.status = 'approved'
    and recommendation.expires_at > now()
  order by recommendation.proposed_at desc
$$;

revoke all on function public.can_manage_learning_for_student(uuid) from public, anon, authenticated;
revoke all on function public.record_learning_evidence(uuid, uuid, numeric, text, text, timestamptz, uuid, boolean) from public, anon;
revoke all on function public.recompute_learner_skill_state(uuid, uuid) from public, anon;
revoke all on function public.refresh_learning_recommendation(uuid, uuid) from public, anon;
revoke all on function public.decide_learning_recommendation(uuid, text, text, uuid) from public, anon;
revoke all on function public.get_my_learning_recommendations() from public, anon;
grant execute on function public.record_learning_evidence(uuid, uuid, numeric, text, text, timestamptz, uuid, boolean) to authenticated;
grant execute on function public.recompute_learner_skill_state(uuid, uuid) to authenticated;
grant execute on function public.refresh_learning_recommendation(uuid, uuid) to authenticated;
grant execute on function public.decide_learning_recommendation(uuid, text, text, uuid) to authenticated;
grant execute on function public.get_my_learning_recommendations() to authenticated;
