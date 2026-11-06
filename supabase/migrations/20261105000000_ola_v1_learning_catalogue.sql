-- OLA v1 learner catalogue.  This is intentionally additive: question
-- versions remain the question bank, activity templates remain the runner's
-- delivery unit, and mastery/recommendation history remains append-only.

create table public.learning_skill_content (
  id uuid primary key default gen_random_uuid(),
  curriculum_skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  explanation text not null check (char_length(btrim(explanation)) between 1 and 8000),
  worked_example text not null check (char_length(btrim(worked_example)) between 1 and 8000),
  video_url text,
  worksheet_url text,
  worksheet_permission_note text,
  source_tier public.curriculum_source_tier not null default 'Odysseus_authored',
  review_status public.question_review_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_skill_id),
  check (video_url is null or video_url ~ '^https://(www\\.)?(youtube\\.com/watch\\?v=|youtu\\.be/)[A-Za-z0-9_-]{6,}'),
  check (worksheet_url is null or worksheet_url ~ '^https://'),
  check (worksheet_url is null or nullif(btrim(worksheet_permission_note), '') is not null),
  check (review_status <> 'approved' or (reviewed_by is not null and reviewed_at is not null))
);

create index learning_skill_content_learner_idx on public.learning_skill_content(curriculum_skill_id, review_status);
alter table public.learning_skill_content enable row level security;
create policy "learning_skill_content_tutor_admin_read" on public.learning_skill_content for select to authenticated using (public.current_profile_role() in ('tutor', 'admin'));

-- Direct writes are intentionally absent. This keeps a privileged browser
-- from changing a review status or substituting a resource after review.
create or replace function public.save_learning_skill_content_draft(p_content_id uuid, p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_skill uuid;
begin
  perform public.content_admin_required();
  v_skill:=nullif(p_payload->>'skillId','')::uuid;
  if v_skill is null or nullif(btrim(p_payload->>'title'),'') is null or nullif(btrim(p_payload->>'explanation'),'') is null or nullif(btrim(p_payload->>'workedExample'),'') is null then raise exception 'learning_skill_content_invalid_draft' using errcode='23514'; end if;
  if p_content_id is null then
    insert into public.learning_skill_content(curriculum_skill_id,title,explanation,worked_example,video_url,worksheet_url,worksheet_permission_note,source_tier,review_status,created_by)
    values(v_skill,p_payload->>'title',p_payload->>'explanation',p_payload->>'workedExample',nullif(p_payload->>'videoUrl',''),nullif(p_payload->>'worksheetUrl',''),nullif(p_payload->>'worksheetPermissionNote',''),coalesce((p_payload->>'sourceTier')::public.curriculum_source_tier,'Odysseus_authored'),'draft',public.current_profile_id()) returning id into v_id;
  else
    select id into v_id from public.learning_skill_content where id=p_content_id and review_status in ('draft','rejected') for update;
    if not found then raise exception 'learning_skill_content_not_editable' using errcode='55000'; end if;
    update public.learning_skill_content set curriculum_skill_id=v_skill,title=p_payload->>'title',explanation=p_payload->>'explanation',worked_example=p_payload->>'workedExample',video_url=nullif(p_payload->>'videoUrl',''),worksheet_url=nullif(p_payload->>'worksheetUrl',''),worksheet_permission_note=nullif(p_payload->>'worksheetPermissionNote',''),source_tier=coalesce((p_payload->>'sourceTier')::public.curriculum_source_tier,'Odysseus_authored'),review_status='draft',updated_at=now() where id=v_id;
  end if;
  perform public.log_audit_event('learning_skill_content.draft_saved','learning_skill_content',v_id::text,jsonb_build_object('skill_id',v_skill));
  return v_id;
end; $$;

create or replace function public.validate_learning_skill_content_for_approval(p_content_id uuid)
returns text[] language plpgsql security definer set search_path='' as $$
declare v_errors text[] := '{}';
begin
  if not exists (
    select 1 from public.learning_skill_content content
    join public.curriculum_skills skill on skill.id=content.curriculum_skill_id and skill.is_active
    join public.grade9_skill_metadata metadata on metadata.curriculum_skill_id=skill.id and metadata.valid_until is null
    join public.curriculum_versions curriculum on curriculum.id=metadata.curriculum_version_id and curriculum.is_active
    where content.id=p_content_id
  ) then v_errors:=array_append(v_errors,'INACTIVE_OR_MISSING_GRADE9_SKILL'); end if;
  if exists (select 1 from public.learning_skill_content where id=p_content_id and worksheet_url is not null and nullif(btrim(worksheet_permission_note),'') is null) then v_errors:=array_append(v_errors,'WORKSHEET_PERMISSION_REQUIRED'); end if;
  if exists (select 1 from public.learning_skill_content where id=p_content_id and video_url is not null and video_url !~ '^https://(www\\.)?(youtube\\.com/watch\\?v=|youtu\\.be/)[A-Za-z0-9_-]{6,}') then v_errors:=array_append(v_errors,'VIDEO_URL_NOT_CURATED_YOUTUBE'); end if;
  return v_errors;
end; $$;

create or replace function public.review_learning_skill_content_action(p_content_id uuid, p_action text, p_notes text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_from public.question_review_status; v_to public.question_review_status; v_errors text[];
begin
  perform public.content_admin_required();
  select review_status into v_from from public.learning_skill_content where id=p_content_id for update;
  if not found then raise exception 'learning_skill_content_not_found' using errcode='P0002'; end if;
  v_to:=case p_action
    when 'submit_for_review' then 'in_review'::public.question_review_status
    when 'approve' then 'approved'::public.question_review_status
    when 'reject' then 'rejected'::public.question_review_status
    when 'return_for_revision' then 'draft'::public.question_review_status
    when 'retire' then 'retired'::public.question_review_status else null end;
  if v_to is null then raise exception 'invalid_review_action' using errcode='22023'; end if;
  if p_action='approve' and v_from<>'in_review' then raise exception 'invalid_review_transition' using errcode='23514'; end if;
  if p_action in ('reject','return_for_revision','retire') and nullif(btrim(p_notes),'') is null then raise exception 'review_notes_required' using errcode='23514'; end if;
  if p_action='approve' then
    v_errors:=public.validate_learning_skill_content_for_approval(p_content_id);
    if cardinality(v_errors)>0 then raise exception 'learning_skill_content_validation_failed:%',array_to_string(v_errors,',') using errcode='23514'; end if;
  end if;
  update public.learning_skill_content set review_status=v_to,reviewed_by=public.current_profile_id(),reviewed_at=now(),review_notes=p_notes,updated_at=now() where id=p_content_id;
  perform public.log_audit_event('learning_skill_content.reviewed','learning_skill_content',p_content_id::text,jsonb_build_object('action',p_action,'from_status',v_from,'to_status',v_to));
end; $$;

create or replace function public.get_learning_skill_content_catalog()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform public.content_admin_required();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id',content.id,'skillCode',skill.skill_code,'skillName',skill.title,'title',content.title,'status',content.review_status,'hasVideo',content.video_url is not null,'hasWorksheet',content.worksheet_url is not null,'reviewNotes',content.review_notes) order by content.created_at desc)
    from public.learning_skill_content content join public.curriculum_skills skill on skill.id=content.curriculum_skill_id
  ),'[]'::jsonb);
end;
$$;

-- Learners read this catalogue only through a narrow, approved-only RPC. It
-- deliberately returns no drafts, answer configurations, tutor notes or
-- recommendation records.
create or replace function public.get_my_grade9_learning_catalogue()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if public.current_profile_role()<>'student' then raise exception 'not_authorized' using errcode='42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'topicCode',topic.code,'topicName',topic.name,'topicDescription',topic.description,
      'areaName',area.name,'skills',coalesce((select jsonb_agg(jsonb_build_object(
        'skillCode',skill.skill_code,'skillName',skill.title,'skillDescription',skill.description,
        'activityCode',activity.code,'hasExplanation',content.id is not null
      ) order by metadata.display_order,skill.skill_code)
      from public.grade9_skill_metadata metadata
      join public.curriculum_skills skill on skill.id=metadata.curriculum_skill_id and skill.is_active
      left join lateral (
        select template.code from public.learning_activity_templates template
        where template.target_skill_id=skill.id and template.review_status='approved'
          and not exists (select 1 from public.learning_activity_stage_questions link join public.learning_activity_stages stage on stage.id=link.learning_activity_stage_id join public.question_versions version on version.id=link.question_version_id join public.question_items item on item.id=version.question_item_id where stage.learning_activity_template_id=template.id and (version.review_status<>'approved' or item.retired_at is not null))
        order by template.code limit 1
      ) activity on true
      left join public.learning_skill_content content on content.curriculum_skill_id=skill.id and content.review_status='approved'
      where metadata.curriculum_topic_id=topic.id and metadata.valid_until is null and (activity.code is not null or content.id is not null)
      ),'[]'::jsonb)
    ) order by area.display_order,topic.display_order)
    from public.curriculum_versions curriculum
    join public.curriculum_areas area on area.curriculum_version_id=curriculum.id and area.is_active
    join public.curriculum_topics topic on topic.curriculum_area_id=area.id and topic.is_active
    where curriculum.code='CAPS-MATH-G9-2026' and curriculum.is_active
  ),'[]'::jsonb);
end; $$;

create or replace function public.get_my_grade9_learning_topic(p_topic_code text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if public.current_profile_role()<>'student' then raise exception 'not_authorized' using errcode='42501'; end if;
  return (
    select jsonb_build_object(
      'topicCode',topic.code,'topicName',topic.name,'topicDescription',topic.description,'areaName',area.name,
      'skills',coalesce((select jsonb_agg(jsonb_build_object(
        'skillCode',skill.skill_code,'skillName',skill.title,'skillDescription',skill.description,
        'activityCode',activity.code,'activityName',activity.title,
        'content',case when content.id is null then null else jsonb_build_object('title',content.title,'explanation',content.explanation,'workedExample',content.worked_example,'videoUrl',content.video_url,'worksheetUrl',content.worksheet_url,'worksheetPermissionNote',content.worksheet_permission_note) end
      ) order by metadata.display_order,skill.skill_code)
      from public.grade9_skill_metadata metadata
      join public.curriculum_skills skill on skill.id=metadata.curriculum_skill_id and skill.is_active
      left join lateral (select template.code,template.title from public.learning_activity_templates template where template.target_skill_id=skill.id and template.review_status='approved' and not exists (select 1 from public.learning_activity_stage_questions link join public.learning_activity_stages stage on stage.id=link.learning_activity_stage_id join public.question_versions version on version.id=link.question_version_id join public.question_items item on item.id=version.question_item_id where stage.learning_activity_template_id=template.id and (version.review_status<>'approved' or item.retired_at is not null)) order by template.code limit 1) activity on true
      left join public.learning_skill_content content on content.curriculum_skill_id=skill.id and content.review_status='approved'
      where metadata.curriculum_topic_id=topic.id and metadata.valid_until is null and (activity.code is not null or content.id is not null)
      ),'[]'::jsonb)
    )
    from public.curriculum_topics topic join public.curriculum_areas area on area.id=topic.curriculum_area_id join public.curriculum_versions curriculum on curriculum.id=area.curriculum_version_id
    where topic.code=p_topic_code and curriculum.code='CAPS-MATH-G9-2026' and curriculum.is_active and topic.is_active
  );
end; $$;

-- Seed only a draft. A migration cannot impersonate the designated maths
-- reviewer; the learner RPCs will expose this vertical only after review.
insert into public.learning_skill_content(curriculum_skill_id,title,explanation,worked_example,review_status,source_tier,review_notes)
select skill.id,'Difference of Two Squares','A difference of two squares has two perfect-square terms joined by subtraction. Write each term as a square, then use a² − b² = (a − b)(a + b). This rule does not apply to a sum of squares.','Example: x² − 25 = x² − 5² = (x − 5)(x + 5). Check by expanding: x² + 5x − 5x − 25 = x² − 25.','draft','Odysseus_authored','Mathematics reviewer must verify the learner wording, worked example and any optional resource before approval.'
from public.curriculum_skills skill where skill.skill_code='G9.ALG.FACTOR.DOTS'
on conflict (curriculum_skill_id) do nothing;

revoke all on function public.validate_learning_skill_content_for_approval(uuid) from public;
revoke all on function public.save_learning_skill_content_draft(uuid,jsonb) from public;
revoke all on function public.review_learning_skill_content_action(uuid,text,text) from public;
revoke all on function public.get_my_grade9_learning_catalogue() from public;
revoke all on function public.get_my_grade9_learning_topic(text) from public;
revoke all on function public.get_learning_skill_content_catalog() from public;
grant execute on function public.review_learning_skill_content_action(uuid,text,text) to authenticated;
grant execute on function public.save_learning_skill_content_draft(uuid,jsonb) to authenticated;
grant execute on function public.get_my_grade9_learning_catalogue() to authenticated;
grant execute on function public.get_my_grade9_learning_topic(text) to authenticated;
grant execute on function public.get_learning_skill_content_catalog() to authenticated;
