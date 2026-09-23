-- Sprint 4: controlled admin authoring over the existing immutable item bank.
alter table public.question_items add column if not exists source_notes text;
create index if not exists question_items_code_search_idx on public.question_items (item_code);
create index if not exists question_versions_review_created_idx on public.question_versions (review_status, created_at desc);

create or replace function public.validate_learning_answer_config(p_config jsonb)
returns text[] language plpgsql immutable set search_path='' as $$
declare v_type text; v_accepted jsonb; v_errors text[] := '{}';
begin
  if p_config is null or jsonb_typeof(p_config) <> 'object' then return array['INVALID_ANSWER_CONFIG']; end if;
  v_type := p_config->>'type'; v_accepted := coalesce(p_config->'accepted', p_config->'accepted_answers');
  if v_type is null then
    if jsonb_typeof(v_accepted) <> 'array' or jsonb_array_length(v_accepted)=0 then v_errors:=array_append(v_errors,'MISSING_DETERMINISTIC_EXPECTED_ANSWER'); end if;
    return v_errors;
  end if;
  if v_type not in ('numeric','fraction','multiple_choice','coordinate','linear_equation_solution','algebraic_expression','factorised_expression') then return array['UNSUPPORTED_QUESTION_TYPE']; end if;
  if v_type='multiple_choice' then
    if nullif(btrim(coalesce(p_config->>'correct_option','')),'') is null then v_errors:=array_append(v_errors,'MISSING_CORRECT_OPTION'); end if;
  elsif jsonb_typeof(v_accepted) <> 'array' or jsonb_array_length(v_accepted)=0 then
    v_errors:=array_append(v_errors,'MISSING_DETERMINISTIC_EXPECTED_ANSWER');
  end if;
  if v_type='numeric' and p_config ? 'tolerance' and (p_config->>'tolerance') !~ '^[0-9]+(\\.[0-9]+)?$' then v_errors:=array_append(v_errors,'INVALID_NUMERIC_TOLERANCE'); end if;
  if v_type='factorised_expression' and coalesce(p_config->>'required_form','') <> 'factorised' then v_errors:=array_append(v_errors,'FACTORISED_FORM_REQUIRED'); end if;
  return v_errors;
end; $$;

-- Keep the established approval checks, but make the canonical validator
-- understand Sprint 1's structured deterministic answer contract.
create or replace function public.validate_question_version_for_approval(p_question_version_id uuid)
returns text[] language plpgsql security definer set search_path='' as $$
declare v_errors text[]:='{}'; v_answer jsonb; v_solution text; v_marks numeric; v_type public.question_activity_type; v_prompt text;
begin
 select version.answer_config,version.solution,version.marks,version.activity_type,version.prompt into v_answer,v_solution,v_marks,v_type,v_prompt from public.question_versions version join public.question_items item on item.id=version.question_item_id join public.curriculum_versions curriculum on curriculum.id=item.curriculum_version_id where version.id=p_question_version_id and curriculum.is_active and curriculum.valid_from<=current_date and (curriculum.valid_until is null or curriculum.valid_until>=current_date) and item.retired_at is null;
 if not found then return array['INACTIVE_OR_MISSING_CURRICULUM_VERSION']; end if;
 if not exists(select 1 from public.question_version_skill_links link join public.curriculum_skills skill on skill.id=link.skill_id where link.question_version_id=p_question_version_id and link.relationship_type='primary' and skill.is_active) then v_errors:=array_append(v_errors,'MISSING_OR_RETIRED_PRIMARY_SKILL'); end if;
 v_errors:=v_errors||public.validate_learning_answer_config(v_answer);
 if nullif(btrim(coalesce(v_solution,'')),'') is null then v_errors:=array_append(v_errors,'MISSING_SOLUTION'); end if;
 if coalesce(v_marks,0)<=0 then v_errors:=array_append(v_errors,'INVALID_MARKS'); end if;
 if v_type='error_analysis' and coalesce(v_prompt,'') !~* '(error|incorrect|wrong|says|claims)' then v_errors:=array_append(v_errors,'ERROR_ANALYSIS_MISSING_ERROR_STIMULUS'); end if;
 if v_type='worked_example' and length(coalesce(v_solution,''))<20 then v_errors:=array_append(v_errors,'WORKED_EXAMPLE_REQUIRES_MODEL_SOLUTION'); end if;
 if v_type='faded_example' and coalesce(v_prompt,'') !~ '(_{2,}|\\[blank\\]|\\.{3,})' then v_errors:=array_append(v_errors,'FADED_EXAMPLE_MISSING_LEARNER_STEP'); end if;
 if exists(select 1 from public.question_hints hint where hint.question_version_id=p_question_version_id group by hint.question_version_id having min(hint.hint_level)<>1 or max(hint.hint_level)>5 or count(*)<>max(hint.hint_level) or count(*)<>count(distinct hint.hint_level)) then v_errors:=array_append(v_errors,'INVALID_HINT_LADDER'); end if;
 return coalesce((select array_agg(distinct error_code) from unnest(v_errors) error_code), '{}'::text[]);
end; $$;

create or replace function public.content_admin_required() returns void
language plpgsql security definer set search_path='' as $$
begin if not public.is_platform_admin() then raise exception 'not_authorized' using errcode='42501'; end if; end; $$;

create or replace function public.get_learning_content_catalog(p_search text default null, p_status public.question_review_status default null, p_page integer default 1, p_page_size integer default 25)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_offset integer := greatest(coalesce(p_page,1)-1,0)*least(greatest(coalesce(p_page_size,25),1),100);
begin perform public.content_admin_required();
 return jsonb_build_object('items',coalesce((select jsonb_agg(row_to_json(row)) from (
  select version.id, item.item_code, version.version_number, version.review_status, version.prompt, version.marks, version.activity_type,
   curriculum.grade, subject.name as subject_name, coalesce(primary_skill.skill_code,'') as primary_skill_code, item.source_tier, version.created_at
  from public.question_versions version join public.question_items item on item.id=version.question_item_id
  join public.curriculum_versions curriculum on curriculum.id=item.curriculum_version_id join public.subjects subject on subject.id=curriculum.subject_id
  left join public.question_version_skill_links primary_link on primary_link.question_version_id=version.id and primary_link.relationship_type='primary'
  left join public.curriculum_skills primary_skill on primary_skill.id=primary_link.skill_id
  where (p_status is null or version.review_status=p_status) and (nullif(btrim(coalesce(p_search,'')),'') is null or item.item_code ilike '%'||p_search||'%' or version.prompt ilike '%'||p_search||'%' or primary_skill.skill_code ilike '%'||p_search||'%')
  order by version.created_at desc, version.version_number desc offset v_offset limit least(greatest(coalesce(p_page_size,25),1),100)
 ) row),'[]'::jsonb),'total', (select count(*) from public.question_versions version join public.question_items item on item.id=version.question_item_id left join public.question_version_skill_links link on link.question_version_id=version.id and link.relationship_type='primary' left join public.curriculum_skills skill on skill.id=link.skill_id where (p_status is null or version.review_status=p_status) and (nullif(btrim(coalesce(p_search,'')),'') is null or item.item_code ilike '%'||p_search||'%' or version.prompt ilike '%'||p_search||'%' or skill.skill_code ilike '%'||p_search||'%')),
 'skills',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',skill_code,'name',title) order by skill_code),'[]'::jsonb) from public.curriculum_skills where is_active),
 'misconceptions',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'skillId',skill_id) order by code),'[]'::jsonb) from public.misconceptions where is_active));
end; $$;

create or replace function public.save_learning_question_draft(p_payload jsonb, p_question_version_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_item uuid; v_version uuid; v_curriculum uuid; v_next integer; v_primary uuid; v_errors text[]; v_hint jsonb; v_supporting uuid[]; v_misconceptions uuid[];
begin
 perform public.content_admin_required();
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid_payload' using errcode='23514'; end if;
 v_primary := nullif(p_payload->>'primarySkillId','')::uuid;
 if v_primary is null then raise exception 'primary_skill_required' using errcode='23514'; end if;
 v_errors:=public.validate_learning_answer_config(coalesce(p_payload->'answerConfig','{}'::jsonb)); if cardinality(v_errors)>0 then raise exception 'invalid_answer_config:%',array_to_string(v_errors,',') using errcode='23514'; end if;
 if p_question_version_id is null then
   select curriculum.id into v_curriculum from public.curriculum_versions curriculum join public.curriculum_skills skill on skill.id=v_primary where curriculum.subject_id=skill.subject_id and curriculum.grade=skill.grade and curriculum.is_active order by curriculum.valid_from desc limit 1;
   if v_curriculum is null then raise exception 'no_active_curriculum_for_primary_skill' using errcode='23514'; end if;
   insert into public.question_items(curriculum_version_id,item_code,source_tier,source_notes,created_by) values(v_curriculum,p_payload->>'itemCode',coalesce((p_payload->>'sourceTier')::public.curriculum_source_tier,'Odysseus_authored'),nullif(p_payload->>'sourceNotes',''),public.current_profile_id()) returning id into v_item;
   v_next:=1;
 else
   select version.question_item_id, version.version_number into v_item,v_next from public.question_versions version where version.id=p_question_version_id for update;
   if not found then raise exception 'question_version_not_found' using errcode='P0002'; end if;
   if (select review_status from public.question_versions where id=p_question_version_id) in ('approved','retired','in_review') then raise exception 'draft_not_editable_create_revision' using errcode='55000'; end if;
 end if;
 if p_question_version_id is null then
   insert into public.question_versions(question_item_id,version_number,review_status,activity_type,cognitive_level,representation,difficulty,calculator_policy,prompt,answer_config,solution,marks,created_by,material_change_note)
   values(v_item,v_next,'draft',(p_payload->>'activityType')::public.question_activity_type,(p_payload->>'cognitiveLevel')::public.caps_cognitive_level,(p_payload->>'representation')::public.math_representation,nullif(p_payload->>'difficulty','')::smallint,(p_payload->>'calculatorPolicy')::public.calculator_policy,p_payload->>'prompt',p_payload->'answerConfig',nullif(p_payload->>'solution',''),(p_payload->>'marks')::numeric,public.current_profile_id(),nullif(p_payload->>'materialChangeNote','')) returning id into v_version;
 else v_version:=p_question_version_id; update public.question_versions set activity_type=(p_payload->>'activityType')::public.question_activity_type,cognitive_level=(p_payload->>'cognitiveLevel')::public.caps_cognitive_level,representation=(p_payload->>'representation')::public.math_representation,difficulty=nullif(p_payload->>'difficulty','')::smallint,calculator_policy=(p_payload->>'calculatorPolicy')::public.calculator_policy,prompt=p_payload->>'prompt',answer_config=p_payload->'answerConfig',solution=nullif(p_payload->>'solution',''),marks=(p_payload->>'marks')::numeric,material_change_note=nullif(p_payload->>'materialChangeNote','') where id=v_version; delete from public.question_version_skill_links where question_version_id=v_version; delete from public.question_version_misconceptions where question_version_id=v_version; delete from public.question_hints where question_version_id=v_version; end if;
 insert into public.question_version_skill_links(question_version_id,skill_id,relationship_type) values(v_version,v_primary,'primary');
 for v_supporting in select array_agg(value::uuid) from jsonb_array_elements_text(coalesce(p_payload->'supportingSkillIds','[]'::jsonb)) value loop insert into public.question_version_skill_links(question_version_id,skill_id,relationship_type) select v_version, unnest(v_supporting),'supporting' on conflict do nothing; end loop;
 for v_misconceptions in select array_agg(value::uuid) from jsonb_array_elements_text(coalesce(p_payload->'misconceptionIds','[]'::jsonb)) value loop insert into public.question_version_misconceptions(question_version_id,misconception_id) select v_version,unnest(v_misconceptions) on conflict do nothing; end loop;
 for v_hint in select value from jsonb_array_elements(coalesce(p_payload->'hints','[]'::jsonb)) value loop insert into public.question_hints(question_version_id,hint_level,prompt) values(v_version,(v_hint->>'level')::smallint,v_hint->>'prompt'); end loop;
 perform public.log_audit_event(case when p_question_version_id is null then 'learning_content.question_created' else 'learning_content.question_updated' end,'question_version',v_version::text,jsonb_build_object('item_code',p_payload->>'itemCode'));
 return v_version;
end; $$;

create or replace function public.create_learning_question_revision(p_question_version_id uuid, p_material_change_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_old public.question_versions; v_new uuid;
begin perform public.content_admin_required(); select * into v_old from public.question_versions where id=p_question_version_id; if not found then raise exception 'question_version_not_found' using errcode='P0002'; end if;
 insert into public.question_versions(question_item_id,version_number,review_status,activity_type,cognitive_level,representation,difficulty,calculator_policy,prompt,answer_config,solution,marks,created_by,material_change_note) values(v_old.question_item_id,v_old.version_number+1,'draft',v_old.activity_type,v_old.cognitive_level,v_old.representation,v_old.difficulty,v_old.calculator_policy,v_old.prompt,v_old.answer_config,v_old.solution,v_old.marks,public.current_profile_id(),coalesce(p_material_change_note,'Revision of approved version')) returning id into v_new;
 insert into public.question_version_skill_links select v_new,skill_id,relationship_type from public.question_version_skill_links where question_version_id=v_old.id;
 insert into public.question_version_misconceptions select v_new,misconception_id from public.question_version_misconceptions where question_version_id=v_old.id;
 insert into public.question_hints(question_version_id,hint_level,prompt) select v_new,hint_level,prompt from public.question_hints where question_version_id=v_old.id;
 perform public.log_audit_event('learning_content.question_revision_created','question_version',v_new::text,jsonb_build_object('previous_version_id',p_question_version_id)); return v_new;
end; $$;

create or replace function public.import_learning_question_drafts(p_records jsonb, p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_record jsonb; v_errors jsonb:='[]'::jsonb; v_created jsonb:='[]'::jsonb; v_index integer:=0; v_existing boolean;
begin perform public.content_admin_required(); if jsonb_typeof(p_records)<>'array' then raise exception 'import_records_must_be_array' using errcode='23514'; end if;
 for v_record in select value from jsonb_array_elements(p_records) value loop
  v_index:=v_index+1; select exists(select 1 from public.question_items where item_code=v_record->>'itemCode') into v_existing;
  if v_existing then v_errors:=v_errors||jsonb_build_array(jsonb_build_object('index',v_index,'code','DUPLICATE_ITEM_CODE')); elsif cardinality(public.validate_learning_answer_config(coalesce(v_record->'answerConfig','{}'::jsonb)))>0 then v_errors:=v_errors||jsonb_build_array(jsonb_build_object('index',v_index,'code','INVALID_ANSWER_CONFIG')); elsif not exists(select 1 from public.curriculum_skills where skill_code=v_record->>'skillCode' and is_active) then v_errors:=v_errors||jsonb_build_array(jsonb_build_object('index',v_index,'code','UNKNOWN_SKILL_CODE')); end if;
 end loop;
 if jsonb_array_length(v_errors)>0 or p_dry_run then return jsonb_build_object('dryRun',p_dry_run,'valid',jsonb_array_length(v_errors)=0,'errors',v_errors,'created',v_created); end if;
 for v_record in select value from jsonb_array_elements(p_records) value loop
  v_created:=v_created||jsonb_build_array(public.save_learning_question_draft(v_record || jsonb_build_object('primarySkillId',(select id from public.curriculum_skills where skill_code=v_record->>'skillCode')),null));
 end loop; perform public.log_audit_event('learning_content.bulk_imported','learning_content_import','drafts',jsonb_build_object('count',jsonb_array_length(v_created))); return jsonb_build_object('dryRun',false,'valid',true,'errors','[]'::jsonb,'created',v_created);
end; $$;

revoke all on function public.content_admin_required() from public;
revoke all on function public.get_learning_content_catalog(text,public.question_review_status,integer,integer) from public;
revoke all on function public.save_learning_question_draft(jsonb,uuid) from public;
revoke all on function public.create_learning_question_revision(uuid,text) from public;
revoke all on function public.import_learning_question_drafts(jsonb,boolean) from public;
grant execute on function public.get_learning_content_catalog(text,public.question_review_status,integer,integer) to authenticated;
grant execute on function public.save_learning_question_draft(jsonb,uuid) to authenticated;
grant execute on function public.create_learning_question_revision(uuid,text) to authenticated;
grant execute on function public.import_learning_question_drafts(jsonb,boolean) to authenticated;

create or replace function public.get_learning_activity_content_catalog()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('activities',coalesce(jsonb_agg(jsonb_build_object(
    'id',activity.id,'code',activity.code,'title',activity.title,'description',activity.description,
    'status',activity.review_status,'targetSkillCode',skill.skill_code,
    'stages',coalesce((select jsonb_agg(jsonb_build_object('sequence',stage.sequence_number,'type',stage.stage_type,'instruction',stage.learner_instruction,'questionCount',(select count(*) from public.learning_activity_stage_questions link where link.learning_activity_stage_id=stage.id)) order by stage.sequence_number) from public.learning_activity_stages stage where stage.learning_activity_template_id=activity.id),'[]'::jsonb)
  ) order by activity.created_at desc),'[]'::jsonb))
  from public.learning_activity_templates activity join public.curriculum_skills skill on skill.id=activity.target_skill_id
  where public.is_platform_admin();
$$;
revoke all on function public.get_learning_activity_content_catalog() from public;
grant execute on function public.get_learning_activity_content_catalog() to authenticated;

create or replace function public.save_learning_activity_draft(p_payload jsonb, p_activity_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_activity uuid; v_target uuid; v_curriculum uuid; v_stage jsonb; v_stage_id uuid; v_question text;
begin
 perform public.content_admin_required();
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid_activity_payload' using errcode='23514'; end if;
 v_target:=nullif(p_payload->>'targetSkillId','')::uuid;
 select curriculum.id into v_curriculum from public.curriculum_versions curriculum join public.curriculum_skills skill on skill.id=v_target where curriculum.subject_id=skill.subject_id and curriculum.grade=skill.grade and curriculum.is_active order by curriculum.valid_from desc limit 1;
 if v_curriculum is null then raise exception 'activity_target_skill_requires_active_curriculum' using errcode='23514'; end if;
 if p_activity_id is null then
  insert into public.learning_activity_templates(curriculum_version_id,target_skill_id,code,title,description,source_tier,created_by) values(v_curriculum,v_target,p_payload->>'code',p_payload->>'title',p_payload->>'description',coalesce((p_payload->>'sourceTier')::public.curriculum_source_tier,'Odysseus_authored'),public.current_profile_id()) returning id into v_activity;
 else
  select id into v_activity from public.learning_activity_templates where id=p_activity_id and review_status in ('draft','rejected') for update;
  if not found then raise exception 'activity_not_editable_create_new_draft' using errcode='55000'; end if;
  update public.learning_activity_templates set target_skill_id=v_target,code=p_payload->>'code',title=p_payload->>'title',description=p_payload->>'description',source_tier=coalesce((p_payload->>'sourceTier')::public.curriculum_source_tier,'Odysseus_authored') where id=v_activity;
  delete from public.learning_activity_stage_questions where learning_activity_stage_id in (select id from public.learning_activity_stages where learning_activity_template_id=v_activity);
  delete from public.learning_activity_stages where learning_activity_template_id=v_activity;
 end if;
 for v_stage in select value from jsonb_array_elements(coalesce(p_payload->'stages','[]'::jsonb)) value loop
  insert into public.learning_activity_stages(learning_activity_template_id,stage_type,sequence_number,learner_instruction,tutor_instruction) values(v_activity,(v_stage->>'type')::public.learning_activity_stage_type,(v_stage->>'sequence')::smallint,v_stage->>'instruction',nullif(v_stage->>'tutorInstruction','')) returning id into v_stage_id;
  for v_question in select value from jsonb_array_elements_text(coalesce(v_stage->'questionVersionIds','[]'::jsonb)) value loop insert into public.learning_activity_stage_questions(learning_activity_stage_id,question_version_id,display_order) values(v_stage_id,v_question::uuid,(select count(*)+1 from public.learning_activity_stage_questions where learning_activity_stage_id=v_stage_id)); end loop;
 end loop;
 perform public.log_audit_event('learning_content.activity_draft_saved','learning_activity_template',v_activity::text,jsonb_build_object('code',p_payload->>'code')); return v_activity;
end; $$;

create or replace function public.review_learning_activity_action(p_activity_id uuid, p_action text, p_notes text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_from public.question_review_status; v_to public.question_review_status;
begin
 perform public.content_admin_required(); select review_status into v_from from public.learning_activity_templates where id=p_activity_id for update; if not found then raise exception 'activity_not_found' using errcode='P0002'; end if;
 if p_action='submit_for_review' and v_from in ('draft','rejected') then v_to:='in_review';
 elsif p_action='approve' and v_from='in_review' then
  if not exists(select 1 from public.learning_activity_stages where learning_activity_template_id=p_activity_id) then raise exception 'activity_requires_stage' using errcode='23514'; end if;
  if exists(select 1 from public.learning_activity_stages stage left join public.learning_activity_stage_questions link on link.learning_activity_stage_id=stage.id where stage.learning_activity_template_id=p_activity_id group by stage.id having stage.stage_type not in ('worked_example') and count(link.question_version_id)=0) then raise exception 'assessed_activity_stage_requires_question' using errcode='23514'; end if;
  if exists(select 1 from public.learning_activity_stage_questions link join public.question_versions version on version.id=link.question_version_id join public.question_items item on item.id=version.question_item_id where link.learning_activity_stage_id in(select id from public.learning_activity_stages where learning_activity_template_id=p_activity_id) and (version.review_status<>'approved' or item.retired_at is not null)) then raise exception 'activity_requires_approved_active_questions' using errcode='23514'; end if;
  v_to:='approved';
 elsif p_action='reject' and v_from='in_review' then v_to:='rejected';
 elsif p_action='return_for_revision' and v_from='in_review' then v_to:='draft';
 elsif p_action='retire' and v_from='approved' then v_to:='retired';
 else raise exception 'invalid_activity_review_transition' using errcode='23514'; end if;
 if p_action in ('reject','return_for_revision','retire') and nullif(btrim(coalesce(p_notes,'')),'') is null then raise exception 'review_notes_required' using errcode='23514'; end if;
 update public.learning_activity_templates set review_status=v_to,reviewed_by=public.current_profile_id(),reviewed_at=now(),review_notes=p_notes where id=p_activity_id;
 perform public.log_audit_event('learning_content.activity_reviewed','learning_activity_template',p_activity_id::text,jsonb_build_object('action',p_action,'from_status',v_from,'to_status',v_to));
end; $$;
revoke all on function public.save_learning_activity_draft(jsonb,uuid) from public;
revoke all on function public.review_learning_activity_action(uuid,text,text) from public;
grant execute on function public.save_learning_activity_draft(jsonb,uuid) to authenticated;
grant execute on function public.review_learning_activity_action(uuid,text,text) to authenticated;
