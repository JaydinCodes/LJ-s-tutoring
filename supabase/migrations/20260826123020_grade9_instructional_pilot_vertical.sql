-- Grade 9 instructional pilot vertical. This migration extends the evidence
-- learning model; it does not alter formal assignments or released marks.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'learning_activity_stage_type') then
    create type public.learning_activity_stage_type as enum (
      'retrieval_warm_up', 'entry_probe', 'prerequisite_check', 'worked_example', 'faded_example',
      'guided_practice', 'independent_practice', 'error_analysis',
      'interleaved_review', 'exit_check', 'delayed_retrieval'
    );
  end if;
end
$$;

-- A reusable composed learning sequence. The question item/version remains
-- the evidence-producing unit; activities only arrange approved versions.
create table public.learning_activity_templates (
  id uuid primary key default gen_random_uuid(),
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete restrict,
  target_skill_id uuid not null references public.curriculum_skills(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9._-]+$'),
  title text not null,
  description text not null,
  source_tier public.curriculum_source_tier not null default 'Odysseus_authored',
  review_status public.question_review_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  unique (curriculum_version_id, code),
  check (review_status <> 'approved' or (reviewed_by is not null and reviewed_at is not null))
);

create table public.learning_activity_stages (
  id uuid primary key default gen_random_uuid(),
  learning_activity_template_id uuid not null references public.learning_activity_templates(id) on delete restrict,
  stage_type public.learning_activity_stage_type not null,
  sequence_number smallint not null check (sequence_number > 0),
  learner_instruction text not null,
  tutor_instruction text,
  created_at timestamptz not null default now(),
  unique (learning_activity_template_id, sequence_number)
);

create table public.learning_activity_stage_questions (
  learning_activity_stage_id uuid not null references public.learning_activity_stages(id) on delete restrict,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  display_order smallint not null default 1 check (display_order > 0),
  primary key (learning_activity_stage_id, question_version_id),
  unique (learning_activity_stage_id, display_order)
);

-- A diagnostic blueprint is deliberately short. Routing is performed by the
-- pure diagnostic engine from item-level evidence and the prerequisite graph.
create table public.diagnostic_blueprints (
  id uuid primary key default gen_random_uuid(),
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9._-]+$'),
  name text not null,
  description text not null,
  minimum_item_count smallint not null check (minimum_item_count > 0),
  maximum_item_count smallint not null check (maximum_item_count >= minimum_item_count),
  review_status public.question_review_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  unique (curriculum_version_id, code),
  check (review_status <> 'approved' or (reviewed_by is not null and reviewed_at is not null))
);

create table public.diagnostic_blueprint_questions (
  diagnostic_blueprint_id uuid not null references public.diagnostic_blueprints(id) on delete restrict,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  sequence_number smallint not null check (sequence_number > 0),
  purpose text not null check (purpose in ('entry', 'prerequisite_check', 'target_probe', 'misconception_probe', 'extension')),
  primary key (diagnostic_blueprint_id, question_version_id),
  unique (diagnostic_blueprint_id, sequence_number)
);

create index learning_activity_templates_target_skill_idx on public.learning_activity_templates(target_skill_id, review_status);
create index learning_activity_stages_template_idx on public.learning_activity_stages(learning_activity_template_id, sequence_number);
create index diagnostic_blueprint_questions_blueprint_idx on public.diagnostic_blueprint_questions(diagnostic_blueprint_id, sequence_number);

alter table public.learning_activity_templates enable row level security;
alter table public.learning_activity_stages enable row level security;
alter table public.learning_activity_stage_questions enable row level security;
alter table public.diagnostic_blueprints enable row level security;
alter table public.diagnostic_blueprint_questions enable row level security;

create policy "learning_activity_templates_tutor_admin_read" on public.learning_activity_templates for select to authenticated using (public.current_profile_role() in ('tutor', 'admin'));
create policy "learning_activity_templates_admin_insert" on public.learning_activity_templates for insert to authenticated with check (public.is_platform_admin());
create policy "learning_activity_templates_admin_update" on public.learning_activity_templates for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "learning_activity_templates_admin_delete" on public.learning_activity_templates for delete to authenticated using (public.is_platform_admin());
create policy "learning_activity_stages_tutor_admin_read" on public.learning_activity_stages for select to authenticated using (public.current_profile_role() in ('tutor', 'admin'));
create policy "learning_activity_stages_admin_insert" on public.learning_activity_stages for insert to authenticated with check (public.is_platform_admin());
create policy "learning_activity_stages_admin_update" on public.learning_activity_stages for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "learning_activity_stages_admin_delete" on public.learning_activity_stages for delete to authenticated using (public.is_platform_admin());
create policy "learning_activity_stage_questions_tutor_admin_read" on public.learning_activity_stage_questions for select to authenticated using (public.current_profile_role() in ('tutor', 'admin'));
create policy "learning_activity_stage_questions_admin_insert" on public.learning_activity_stage_questions for insert to authenticated with check (public.is_platform_admin());
create policy "learning_activity_stage_questions_admin_update" on public.learning_activity_stage_questions for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "learning_activity_stage_questions_admin_delete" on public.learning_activity_stage_questions for delete to authenticated using (public.is_platform_admin());
create policy "diagnostic_blueprints_tutor_admin_read" on public.diagnostic_blueprints for select to authenticated using (public.current_profile_role() in ('tutor', 'admin'));
create policy "diagnostic_blueprints_admin_insert" on public.diagnostic_blueprints for insert to authenticated with check (public.is_platform_admin());
create policy "diagnostic_blueprints_admin_update" on public.diagnostic_blueprints for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "diagnostic_blueprints_admin_delete" on public.diagnostic_blueprints for delete to authenticated using (public.is_platform_admin());
create policy "diagnostic_blueprint_questions_tutor_admin_read" on public.diagnostic_blueprint_questions for select to authenticated using (public.current_profile_role() in ('tutor', 'admin'));
create policy "diagnostic_blueprint_questions_admin_insert" on public.diagnostic_blueprint_questions for insert to authenticated with check (public.is_platform_admin());
create policy "diagnostic_blueprint_questions_admin_update" on public.diagnostic_blueprint_questions for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "diagnostic_blueprint_questions_admin_delete" on public.diagnostic_blueprint_questions for delete to authenticated using (public.is_platform_admin());

-- Approval checks are executable, reused by the review RPC, and intentionally
-- do not return answer_config to learners.
create or replace function public.validate_question_version_for_approval(p_question_version_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare v_errors text[] := '{}'; v_type public.question_activity_type; v_answer jsonb;
begin
  select version.activity_type, version.answer_config into v_type, v_answer
  from public.question_versions version
  join public.question_items item on item.id = version.question_item_id
  join public.curriculum_versions curriculum on curriculum.id = item.curriculum_version_id
  where version.id = p_question_version_id
    and curriculum.is_active is true
    and item.retired_at is null;
  if not found then return array['INACTIVE_OR_MISSING_CURRICULUM_VERSION']; end if;
  if not exists (select 1 from public.question_version_skill_links where question_version_id = p_question_version_id and relationship_type = 'primary') then v_errors := array_append(v_errors, 'MISSING_PRIMARY_SKILL'); end if;
  if not exists (select 1 from public.question_versions where id = p_question_version_id and nullif(btrim(solution), '') is not null) then v_errors := array_append(v_errors, 'MISSING_SOLUTION'); end if;
  if v_type = 'diagnostic' and (v_answer ? 'accepted_answers') is not true then v_errors := array_append(v_errors, 'DIAGNOSTIC_REQUIRES_DETERMINISTIC_SCORING'); end if;
  if exists (
    select 1 from public.question_hints hint
    where hint.question_version_id = p_question_version_id
    group by hint.question_version_id
    having min(hint.hint_level) <> 1 or max(hint.hint_level) > 5 or count(*) <> count(distinct hint.hint_level)
  ) then v_errors := array_append(v_errors, 'INVALID_HINT_LADDER'); end if;
  return v_errors;
end;
$$;

create or replace function public.review_question_version(p_question_version_id uuid, p_status public.question_review_status, p_review_notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_errors text[];
begin
  if not public.is_platform_admin() or p_status not in ('in_review', 'approved', 'rejected', 'retired') then raise exception 'not_authorized_or_invalid_review_transition' using errcode = '42501'; end if;
  if p_status = 'approved' then
    v_errors := public.validate_question_version_for_approval(p_question_version_id);
    if cardinality(v_errors) > 0 then raise exception 'question_version_content_validation_failed:%', array_to_string(v_errors, ',') using errcode = '23514'; end if;
  end if;
  update public.question_versions
    set review_status = p_status, reviewed_by = public.current_profile_id(), reviewed_at = now(), review_notes = p_review_notes
  where id = p_question_version_id and review_status <> 'approved';
  if not found then raise exception 'question_version_not_reviewable' using errcode = '55000'; end if;
  perform public.log_audit_event('question_version.reviewed', 'question_version', p_question_version_id::text, jsonb_build_object('review_status', p_status));
end;
$$;

-- Concise pilot quality reporting for operations; this exposes no answers and
-- does not blend safeguarding/risk data with academic analytics.
create or replace function public.get_grade9_learning_pilot_report()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'diagnostic_completion_count', (select count(distinct attempt.student_id) from public.learning_attempts attempt join public.question_versions version on version.id = attempt.question_version_id where version.activity_type = 'diagnostic' and attempt.status = 'evaluated'),
    'mastery_state_distribution_by_skill', coalesce((select jsonb_agg(row_to_json(bucket)) from (select skill.skill_code, evaluation.state, count(*) as learner_count from public.skill_mastery_evaluations evaluation join public.curriculum_skills skill on skill.id = evaluation.skill_id where skill.skill_code like 'G9.%' group by skill.skill_code, evaluation.state) bucket), '[]'::jsonb),
    'most_common_misconceptions', coalesce((select jsonb_agg(row_to_json(bucket)) from (select misconception.code, count(*) as evidence_count from public.learner_misconceptions learner join public.misconceptions misconception on misconception.id = learner.misconception_id group by misconception.code order by count(*) desc limit 10) bucket), '[]'::jsonb),
    'recommendation_counts', coalesce((select jsonb_agg(row_to_json(bucket)) from (select status, count(*) as count from public.grade9_learning_recommendations group by status) bucket), '[]'::jsonb),
    'tutor_decision_rates', coalesce((select jsonb_agg(row_to_json(bucket)) from (select decision, count(*) as count from public.tutor_recommendation_decisions group by decision) bucket), '[]'::jsonb),
    'intervention_completion_count', (select count(*) from public.tutor_interventions where delivered_at is not null),
    'immediate_outcome_count', (select count(*) from public.intervention_outcomes where outcome_stage = 'immediate'),
    'delayed_outcome_count', (select count(*) from public.intervention_outcomes where outcome_stage = 'delayed')
  );
end;
$$;

revoke all on function public.validate_question_version_for_approval(uuid) from public;
revoke all on function public.review_question_version(uuid, public.question_review_status, text) from public;
revoke all on function public.get_grade9_learning_pilot_report() from public;
grant execute on function public.review_question_version(uuid, public.question_review_status, text) to authenticated;
grant execute on function public.get_grade9_learning_pilot_report() to authenticated;

-- Canonical fine-grained skills. Earlier broad pilot rows remain historical;
-- where there is an exact semantic replacement the broad row is softly
-- retired instead of being renamed underneath historic evidence.
insert into public.curriculum_skills (subject_id, grade, curriculum, strand, topic, skill_code, title, description, cognitive_level)
select version.subject_id, version.grade, 'CAPS', area.name, topic.name, seed.code, seed.name, seed.description, 'routine'
from public.curriculum_versions version
join (values
  ('ALGEBRAIC-EXPRESSIONS','G9.ALG.LANGUAGE.VARIABLES','Variables in algebraic expressions','Identify variables and their role in an algebraic expression.',2::smallint,1,'G9.ALG.LANGUAGE'),
  ('ALGEBRAIC-EXPRESSIONS','G9.ALG.LANGUAGE.COEFFICIENTS','Coefficients in algebraic expressions','Identify the numerical coefficient of a term.',2::smallint,2,'G9.ALG.LANGUAGE'),
  ('ALGEBRAIC-EXPRESSIONS','G9.ALG.LANGUAGE.TERMS','Terms in algebraic expressions','Identify terms, constants and unlike terms.',2::smallint,3,'G9.ALG.LANGUAGE'),
  ('ALGEBRAIC-EXPRESSIONS','G9.ALG.SUBSTITUTION','Substitution','Substitute values into algebraic expressions.',2::smallint,5,null),
  ('ALGEBRAIC-EXPRESSIONS','G9.ALG.EXPAND.BINOMIAL_SQUARE','Square of a binomial','Expand and simplify the square of a binomial.',2::smallint,11,null),
  ('ALGEBRAIC-EQUATIONS','G9.EQN.ONE_STEP','One-step equations','Solve one-step linear equations using inverse operations.',2::smallint,1,null),
  ('ALGEBRAIC-EQUATIONS','G9.EQN.MULTI_STEP','Multi-step equations','Solve multi-step linear equations while preserving equality.',2::smallint,2,null),
  ('ALGEBRAIC-EQUATIONS','G9.EQN.SUBSTITUTION_CHECK','Substitution check for equations','Check a proposed equation solution by substitution.',2::smallint,6,null),
  ('LINEAR-GRAPHS','G9.GRAPH.CARTESIAN_PLANE','Cartesian plane','Recognise axes, origin and scale on the Cartesian plane.',3::smallint,1,null),
  ('LINEAR-GRAPHS','G9.GRAPH.TABLE_FROM_RULE','Table from rule','Generate a table of values from a linear rule.',3::smallint,3,null),
  ('LINEAR-GRAPHS','G9.GRAPH.RULE_FROM_TABLE','Rule from table','Determine a linear rule from a table of values.',3::smallint,4,null),
  ('LINEAR-GRAPHS','G9.GRAPH.PLOT_POINTS','Plot points','Plot ordered pairs accurately on Cartesian axes.',3::smallint,5,null),
  ('LINEAR-GRAPHS','G9.GRAPH.LINEAR_DRAW','Draw a linear graph','Draw a linear graph from a table or equation.',3::smallint,6,null),
  ('LINEAR-GRAPHS','G9.GRAPH.EQUATION_FROM_GRAPH','Equation from graph','Determine a linear equation from a graph.',3::smallint,10,null),
  ('LINEAR-GRAPHS','G9.GRAPH.COMPARE_RELATIONSHIPS','Compare linear relationships','Compare linear relationships using more than one representation.',3::smallint,11,null),
  ('LINEAR-GRAPHS','G9.GRAPH.REPRESENTATION_TRANSLATE','Translate linear representations','Translate between verbal, tabular, graphical and symbolic linear representations.',3::smallint,12,null)
) as seed(topic_code, code, name, description, term, display_order, parent_code) on true
join public.curriculum_topics topic on topic.code = seed.topic_code
join public.curriculum_areas area on area.id = topic.curriculum_area_id and area.curriculum_version_id = version.id
left join public.curriculum_skills parent on parent.skill_code = seed.parent_code
where version.code = 'CAPS-MATH-G9-2026'
on conflict (skill_code) do nothing;

update public.curriculum_skills set is_active = false
where skill_code in ('G9.ALG.SQUARE.BINOMIAL','G9.ALG.SUBSTITUTE','G9.EQN.LINEAR','G9.GRAPH.CARTESIAN','G9.GRAPH.TABLE_EQUATION','G9.GRAPH.DRAW_LINEAR','G9.GRAPH.COMPARE_LINEAR');

insert into public.skill_prerequisites (skill_id, prerequisite_skill_id)
select dependent.id, prerequisite.id
from public.curriculum_skills dependent
join public.curriculum_skills prerequisite on prerequisite.subject_id = dependent.subject_id and prerequisite.grade = dependent.grade
join (values
 ('G9.ALG.LANGUAGE.COEFFICIENTS','G9.ALG.LANGUAGE.VARIABLES'), ('G9.ALG.LANGUAGE.TERMS','G9.ALG.LANGUAGE.VARIABLES'),
 ('G9.ALG.LIKE_TERMS','G9.ALG.LANGUAGE.TERMS'), ('G9.ALG.SUBSTITUTION','G9.ALG.LANGUAGE.VARIABLES'),
 ('G9.ALG.DISTRIBUTIVE','G9.ALG.LIKE_TERMS'), ('G9.ALG.EXPAND.MONOMIAL','G9.ALG.DISTRIBUTIVE'),
 ('G9.ALG.EXPAND.BINOMIAL','G9.ALG.EXPAND.MONOMIAL'), ('G9.ALG.EXPAND.BINOMIAL_SQUARE','G9.ALG.EXPAND.BINOMIAL'),
 ('G9.ALG.FACTOR.COMMON','G9.ALG.LIKE_TERMS'), ('G9.ALG.FACTOR.DOTS','G9.ALG.EXPAND.BINOMIAL'),
 ('G9.ALG.FACTOR.TRINOMIAL','G9.ALG.EXPAND.BINOMIAL'), ('G9.ALG.FRACTIONS.SIMPLIFY','G9.ALG.FACTOR.COMMON'),
 ('G9.EQN.ONE_STEP','G9.ALG.LIKE_TERMS'), ('G9.EQN.MULTI_STEP','G9.EQN.ONE_STEP'),
 ('G9.EQN.BRACKETS','G9.EQN.MULTI_STEP'), ('G9.EQN.BRACKETS','G9.ALG.DISTRIBUTIVE'),
 ('G9.EQN.FRACTIONS','G9.EQN.MULTI_STEP'), ('G9.EQN.ZERO_PRODUCT','G9.ALG.FACTOR.COMMON'),
 ('G9.EQN.FACTORISED','G9.EQN.ZERO_PRODUCT'), ('G9.EQN.FACTORISED','G9.ALG.FACTOR.DOTS'),
 ('G9.EQN.SUBSTITUTION_CHECK','G9.ALG.SUBSTITUTION'), ('G9.EQN.SUBSTITUTION_CHECK','G9.EQN.MULTI_STEP'),
 ('G9.GRAPH.ORDERED_PAIRS','G9.GRAPH.CARTESIAN_PLANE'), ('G9.GRAPH.TABLE_FROM_RULE','G9.ALG.SUBSTITUTION'),
 ('G9.GRAPH.RULE_FROM_TABLE','G9.GRAPH.TABLE_FROM_RULE'), ('G9.GRAPH.PLOT_POINTS','G9.GRAPH.ORDERED_PAIRS'),
 ('G9.GRAPH.LINEAR_DRAW','G9.GRAPH.PLOT_POINTS'), ('G9.GRAPH.LINEAR_DRAW','G9.GRAPH.TABLE_FROM_RULE'),
 ('G9.GRAPH.GRADIENT','G9.GRAPH.CARTESIAN_PLANE'), ('G9.GRAPH.Y_INTERCEPT','G9.GRAPH.CARTESIAN_PLANE'),
 ('G9.GRAPH.X_INTERCEPT','G9.GRAPH.CARTESIAN_PLANE'), ('G9.GRAPH.EQUATION_FROM_GRAPH','G9.GRAPH.GRADIENT'),
 ('G9.GRAPH.EQUATION_FROM_GRAPH','G9.GRAPH.Y_INTERCEPT'), ('G9.GRAPH.COMPARE_RELATIONSHIPS','G9.GRAPH.EQUATION_FROM_GRAPH'),
 ('G9.GRAPH.REPRESENTATION_TRANSLATE','G9.GRAPH.RULE_FROM_TABLE'), ('G9.GRAPH.REPRESENTATION_TRANSLATE','G9.GRAPH.LINEAR_DRAW')
) as edge(dependent_code, prerequisite_code) on edge.dependent_code = dependent.skill_code and edge.prerequisite_code = prerequisite.skill_code
where dependent.is_active and prerequisite.is_active
on conflict do nothing;

insert into public.misconceptions (skill_id, code, name, description, diagnostic_notes, default_intervention_type)
select skill.id, seed.code, seed.name, seed.description, seed.notes, seed.intervention::public.intervention_type
from public.curriculum_skills skill
join (values
 ('G9.ALG.LIKE_TERMS','ALG_COMBINE_UNLIKE_TERMS','Combining unlike terms','Unlike terms are combined as though their variable parts match.','Example: 3x + 2 becomes 5x.','error_analysis'),
 ('G9.ALG.DISTRIBUTIVE','ALG_DISTRIBUTIVE_PARTIAL','Partial distribution','A factor is distributed to only one term inside a bracket.','Example: 3(x + 4) becomes 3x + 4.','worked_example'),
 ('G9.ALG.DISTRIBUTIVE','ALG_SIGN_DISTRIBUTION','Sign distribution error','A negative sign is not distributed to every term in a bracket.','Example: -(x - 4) becomes -x - 4.','contrasting_examples'),
 ('G9.ALG.FACTOR.DOTS','ALG_DOTS_AS_BINOMIAL_SQUARE','Difference of squares treated as binomial square','A difference of squares is factorised as the square of a difference.','Example: x² - 25 becomes (x - 5)².','contrasting_examples'),
 ('G9.ALG.FACTOR.DOTS','ALG_DOTS_INCORRECT_ROOT','Incorrect roots in difference of squares','The constant itself is used instead of its square root.','Example: x² - 25 becomes (x - 25)(x + 25).','worked_example'),
 ('G9.ALG.FACTOR.TRINOMIAL','ALG_TRINOMIAL_SIGN_ERROR','Trinomial sign error','A selected factor pair does not reconstruct the middle term.','Ask the learner to expand the proposed factors.','error_analysis'),
 ('G9.EQN.MULTI_STEP','EQN_MOVE_TERM_SIGN_RULE','Unjustified transposition sign rule','A term is moved with a sign change but the resulting equality is not preserved.','Require inverse operations on both sides.','guided_practice'),
 ('G9.EQN.ONE_STEP','EQN_DIVIDE_ONE_SIDE_ONLY','Divide one side only','An operation is performed on only one side of an equation.','Use a balance representation.','guided_practice'),
 ('G9.EQN.ZERO_PRODUCT','EQN_ZERO_PRODUCT_NOT_APPLIED','Zero product not applied','The learner does not split zero-product factors into alternatives.','Prompt: if ab = 0, which factor can be zero?','worked_example'),
 ('G9.GRAPH.ORDERED_PAIRS','GRAPH_XY_REVERSED','Coordinates reversed','An ordered pair is read as (y, x).','Use horizontal then vertical movement explicitly.','representation_translation'),
 ('G9.GRAPH.GRADIENT','GRAPH_GRADIENT_RECIPROCAL','Gradient reciprocal','Run over rise is calculated instead of rise over run.','Label Δy and Δx on a slope triangle.','guided_practice'),
 ('G9.GRAPH.X_INTERCEPT','GRAPH_INTERCEPT_CONFUSION','Intercept confusion','x- and y-intercepts are confused.','Ask which coordinate equals zero.','representation_translation'),
 ('G9.GRAPH.EQUATION_FROM_GRAPH','GRAPH_GRADIENT_AS_INTERCEPT','Gradient and intercept roles confused','The coefficient and constant in y = mx + c are swapped.','Compare graph features with equation parts.','contrasting_examples')
) as seed(skill_code, code, name, description, notes, intervention) on seed.skill_code = skill.skill_code
on conflict (skill_id, code) do nothing;

-- 52 intentionally bounded authored item versions. They are drafts: the
-- existing human review RPC is the only route to learner-facing approval.
insert into public.question_items (curriculum_version_id, item_code, source_tier)
select curriculum.id, seed.item_code, 'Odysseus_authored'
from public.curriculum_versions curriculum
cross join (values
 ('Q.G9.DIAG.01'),('Q.G9.DIAG.02'),('Q.G9.DIAG.03'),('Q.G9.DIAG.04'),('Q.G9.DIAG.05'),('Q.G9.DIAG.06'),('Q.G9.DIAG.07'),('Q.G9.DIAG.08'),('Q.G9.DIAG.09'),('Q.G9.DIAG.10'),('Q.G9.DIAG.11'),('Q.G9.DIAG.12'),('Q.G9.DIAG.13'),('Q.G9.DIAG.14'),('Q.G9.DIAG.15'),('Q.G9.DIAG.16'),('Q.G9.DIAG.17'),('Q.G9.DIAG.18'),
 ('Q.G9.DOTS.01'),('Q.G9.DOTS.02'),('Q.G9.DOTS.03'),('Q.G9.DOTS.04'),('Q.G9.DOTS.05'),('Q.G9.DOTS.06'),('Q.G9.DOTS.07'),('Q.G9.DOTS.08'),('Q.G9.DOTS.09'),('Q.G9.DOTS.10'),('Q.G9.DOTS.11'),('Q.G9.DOTS.12'),('Q.G9.DOTS.13'),('Q.G9.DOTS.14'),('Q.G9.DOTS.15'),('Q.G9.DOTS.16'),('Q.G9.DOTS.17'),('Q.G9.DOTS.18'),
 ('Q.G9.VERTICAL.01'),('Q.G9.VERTICAL.02'),('Q.G9.VERTICAL.03'),('Q.G9.VERTICAL.04'),('Q.G9.VERTICAL.05'),('Q.G9.VERTICAL.06'),('Q.G9.VERTICAL.07'),('Q.G9.VERTICAL.08'),('Q.G9.VERTICAL.09'),('Q.G9.VERTICAL.10'),('Q.G9.VERTICAL.11'),('Q.G9.VERTICAL.12'),('Q.G9.VERTICAL.13'),('Q.G9.VERTICAL.14'),('Q.G9.VERTICAL.15'),('Q.G9.VERTICAL.16')
) as seed(item_code)
where curriculum.code = 'CAPS-MATH-G9-2026'
on conflict (curriculum_version_id, item_code) do nothing;

insert into public.question_versions (question_item_id, version_number, activity_type, cognitive_level, representation, difficulty, calculator_policy, prompt, answer_config, solution, marks, review_status, material_change_note)
select item.id, 1, seed.activity_type::public.question_activity_type, seed.cognitive_level::public.caps_cognitive_level, seed.representation::public.math_representation, seed.difficulty, 'not_allowed', seed.prompt, jsonb_build_object('accepted_answers', array[seed.answer]), seed.solution, seed.marks, 'draft', 'Grade 9 instructional pilot: authored draft requiring independent human mathematical/CAPS review.'
from public.question_items item
join (values
 -- Short diagnostic: algebra language, operations, factorisation, equations and graph prerequisites.
 ('Q.G9.DIAG.01','diagnostic','knowledge','symbolic',1,'In 7x - 3, identify the variable.','x','The letter that can vary is x.',1::numeric,'G9.ALG.LANGUAGE.VARIABLES',null),
 ('Q.G9.DIAG.02','diagnostic','knowledge','symbolic',1,'In -5y, identify the coefficient.','-5','The coefficient is the number multiplying y: -5.',1::numeric,'G9.ALG.LANGUAGE.COEFFICIENTS',null),
 ('Q.G9.DIAG.03','diagnostic','routine','symbolic',1,'Simplify: 4x + 3x - 2.','7x - 2','4x and 3x are like terms, so 4x + 3x = 7x.',2::numeric,'G9.ALG.LIKE_TERMS','ALG_COMBINE_UNLIKE_TERMS'),
 ('Q.G9.DIAG.04','diagnostic','routine','symbolic',1,'If x = 3, find 2x + 5.','11','Substitute x = 3: 2(3) + 5 = 11.',2::numeric,'G9.ALG.SUBSTITUTION',null),
 ('Q.G9.DIAG.05','diagnostic','routine','symbolic',2,'Expand: 3(x + 4).','3x + 12','Multiply 3 by x and by 4.',2::numeric,'G9.ALG.DISTRIBUTIVE','ALG_DISTRIBUTIVE_PARTIAL'),
 ('Q.G9.DIAG.06','diagnostic','routine','symbolic',2,'Factorise fully: 6x + 18.','6(x + 3)','The greatest common factor is 6.',2::numeric,'G9.ALG.FACTOR.COMMON',null),
 ('Q.G9.DIAG.07','diagnostic','complex','symbolic',3,'Factorise: x² - 25.','(x - 5)(x + 5)','Recognise x² - 5² and use a² - b² = (a-b)(a+b).',2::numeric,'G9.ALG.FACTOR.DOTS','ALG_DOTS_AS_BINOMIAL_SQUARE'),
 ('Q.G9.DIAG.08','diagnostic','routine','symbolic',1,'Solve: x + 4 = 7.','x = 3','Subtract 4 from both sides.',1::numeric,'G9.EQN.ONE_STEP',null),
 ('Q.G9.DIAG.09','diagnostic','routine','symbolic',2,'Solve: 3x + 12 = 21.','x = 3','Subtract 12, then divide by 3.',2::numeric,'G9.EQN.MULTI_STEP','EQN_DIVIDE_ONE_SIDE_ONLY'),
 ('Q.G9.DIAG.10','diagnostic','routine','symbolic',2,'Solve: 2(x + 3) = 14.','x = 4','Divide by 2, then subtract 3.',2::numeric,'G9.EQN.BRACKETS','EQN_MOVE_TERM_SIGN_RULE'),
 ('Q.G9.DIAG.11','diagnostic','routine','symbolic',2,'Solve: (x - 2)(x + 3) = 0.','x = 2 or x = -3','Set each factor equal to zero.',2::numeric,'G9.EQN.ZERO_PRODUCT','EQN_ZERO_PRODUCT_NOT_APPLIED'),
 ('Q.G9.DIAG.12','diagnostic','knowledge','graphical',1,'Which point is (2, -1): move 2 across and 1 down from the origin.','(2, -1)','Read an ordered pair as horizontal coordinate then vertical coordinate.',1::numeric,'G9.GRAPH.ORDERED_PAIRS','GRAPH_XY_REVERSED'),
 ('Q.G9.DIAG.13','diagnostic','routine','tabular',2,'Complete y = 2x + 1 when x = 3.','7','Substitute x = 3 into y = 2x + 1.',1::numeric,'G9.GRAPH.TABLE_FROM_RULE',null),
 ('Q.G9.DIAG.14','diagnostic','routine','tabular',2,'A table has x: 0, 1, 2 and y: -1, 1, 3. Give the rule.','y = 2x - 1','y increases by 2 and y = -1 when x = 0.',2::numeric,'G9.GRAPH.RULE_FROM_TABLE','GRAPH_GRADIENT_AS_INTERCEPT'),
 ('Q.G9.DIAG.15','diagnostic','routine','graphical',2,'Find the gradient through (1, 2) and (3, 6).','2','Rise is 4 and run is 2, so gradient is 2.',2::numeric,'G9.GRAPH.GRADIENT','GRAPH_GRADIENT_RECIPROCAL'),
 ('Q.G9.DIAG.16','diagnostic','routine','graphical',1,'For y = 2x - 3, state the y-intercept.','-3','At x = 0, y = -3.',1::numeric,'G9.GRAPH.Y_INTERCEPT','GRAPH_INTERCEPT_CONFUSION'),
 ('Q.G9.DIAG.17','diagnostic','routine','symbolic',2,'Expand: (x + 2)(x + 3).','x² + 5x + 6','Multiply each term in the first bracket by each term in the second.',2::numeric,'G9.ALG.EXPAND.BINOMIAL',null),
 ('Q.G9.DIAG.18','diagnostic','complex','symbolic',3,'Factorise: x² + 5x + 6.','(x + 2)(x + 3)','Find two numbers with product 6 and sum 5.',2::numeric,'G9.ALG.FACTOR.TRINOMIAL','ALG_TRINOMIAL_SIGN_ERROR'),
 -- Difference-of-two-squares reference activity.
 ('Q.G9.DOTS.01','retrieval','knowledge','symbolic',1,'Which of 25, 36, 49 and 81 are perfect squares?','25, 36, 49, 81','5² = 25, 6² = 36, 7² = 49 and 9² = 81.',2::numeric,'G9.ALG.FACTOR.DOTS',null),
 ('Q.G9.DOTS.02','diagnostic','routine','symbolic',2,'Expand: (x - 5)(x + 5).','x² - 25','The middle terms cancel: x² + 5x - 5x - 25.',2::numeric,'G9.ALG.EXPAND.BINOMIAL',null),
 ('Q.G9.DOTS.03','worked_example','routine','symbolic',2,'Factorise: x² - 25.','(x - 5)(x + 5)','x² - 25 = x² - 5² = (x-5)(x+5).',2::numeric,'G9.ALG.FACTOR.DOTS','ALG_DOTS_AS_BINOMIAL_SQUARE'),
 ('Q.G9.DOTS.04','faded_example','routine','symbolic',2,'Complete: y² - 49 = (y - 7)(y + __ ).','7','49 = 7², so both factors use 7.',1::numeric,'G9.ALG.FACTOR.DOTS','ALG_DOTS_INCORRECT_ROOT'),
 ('Q.G9.DOTS.05','guided_practice','routine','symbolic',2,'Factorise: a² - 16.','(a - 4)(a + 4)','16 = 4².',2::numeric,'G9.ALG.FACTOR.DOTS',null),
 ('Q.G9.DOTS.06','guided_practice','routine','symbolic',2,'Factorise: m² - 81.','(m - 9)(m + 9)','81 = 9².',2::numeric,'G9.ALG.FACTOR.DOTS',null),
 ('Q.G9.DOTS.07','guided_practice','routine','symbolic',3,'Factorise: 4p² - 25.','(2p - 5)(2p + 5)','4p² = (2p)² and 25 = 5².',2::numeric,'G9.ALG.FACTOR.DOTS',null),
 ('Q.G9.DOTS.08','guided_practice','complex','symbolic',3,'Factorise: 9q² - r².','(3q - r)(3q + r)','9q² = (3q)² and r² is a square.',2::numeric,'G9.ALG.FACTOR.DOTS',null),
 ('Q.G9.DOTS.09','error_analysis','complex','symbolic',3,'A learner says x² - 64 = (x - 8)². Explain and correct the factorisation.','(x - 8)(x + 8)','(x - 8)² expands to x² - 16x + 64, not x² - 64.',3::numeric,'G9.ALG.FACTOR.DOTS','ALG_DOTS_AS_BINOMIAL_SQUARE'),
 ('Q.G9.DOTS.10','independent_practice','routine','symbolic',2,'Factorise: t² - 36.','(t - 6)(t + 6)','36 = 6².',2::numeric,'G9.ALG.FACTOR.DOTS',null),
 ('Q.G9.DOTS.11','independent_practice','routine','symbolic',2,'Factorise: 16x² - 1.','(4x - 1)(4x + 1)','16x² = (4x)² and 1 = 1².',2::numeric,'G9.ALG.FACTOR.DOTS',null),
 ('Q.G9.DOTS.12','independent_practice','complex','symbolic',3,'Factorise fully: 3x² - 75.','3(x - 5)(x + 5)','First factor out 3, then factor x² - 25.',3::numeric,'G9.ALG.FACTOR.DOTS',null),
 ('Q.G9.DOTS.13','interleaved_review','complex','symbolic',3,'Choose the method and factorise: 6x + 18.','6(x + 3)','This uses a common factor, not a difference of squares.',2::numeric,'G9.ALG.FACTOR.COMMON',null),
 ('Q.G9.DOTS.14','interleaved_review','complex','symbolic',3,'Choose the method and factorise: x² - 9.','(x - 3)(x + 3)','This is a difference of squares.',2::numeric,'G9.ALG.FACTOR.DOTS',null),
 ('Q.G9.DOTS.15','interleaved_review','complex','symbolic',3,'Choose the method and factorise: x² + 7x + 12.','(x + 3)(x + 4)','This is a trinomial; 3 × 4 = 12 and 3 + 4 = 7.',2::numeric,'G9.ALG.FACTOR.TRINOMIAL',null),
 ('Q.G9.DOTS.16','independent_practice','routine','symbolic',2,'Factorise: z² - 121.','(z - 11)(z + 11)','121 = 11².',2::numeric,'G9.ALG.FACTOR.DOTS',null),
 ('Q.G9.DOTS.17','independent_practice','complex','symbolic',3,'Factorise: 25a² - 4b².','(5a - 2b)(5a + 2b)','Both terms are perfect squares.',2::numeric,'G9.ALG.FACTOR.DOTS',null),
 ('Q.G9.DOTS.18','delayed_retention','routine','symbolic',2,'Factorise: n² - 144.','(n - 12)(n + 12)','144 = 12².',2::numeric,'G9.ALG.FACTOR.DOTS',null),
 -- Remaining vertical coverage and representation translation.
 ('Q.G9.VERTICAL.01','retrieval','routine','symbolic',2,'Simplify: 5a - 2a + 3.','3a + 3','Combine like terms only.',2::numeric,'G9.ALG.LIKE_TERMS','ALG_COMBINE_UNLIKE_TERMS'),
 ('Q.G9.VERTICAL.02','guided_practice','routine','symbolic',2,'Expand: -(x - 4).','-x + 4','Multiply both terms by -1.',2::numeric,'G9.ALG.DISTRIBUTIVE','ALG_SIGN_DISTRIBUTION'),
 ('Q.G9.VERTICAL.03','independent_practice','routine','symbolic',2,'Expand: 2x(x + 3).','2x² + 6x','Multiply 2x by both terms.',2::numeric,'G9.ALG.EXPAND.MONOMIAL',null),
 ('Q.G9.VERTICAL.04','independent_practice','routine','symbolic',3,'Expand: (x - 4)².','x² - 8x + 16','(x - 4)(x - 4) gives two -4x terms.',2::numeric,'G9.ALG.EXPAND.BINOMIAL_SQUARE',null),
 ('Q.G9.VERTICAL.05','independent_practice','complex','symbolic',3,'Simplify: (x² - 9)/(x - 3).','x + 3','Factor x² - 9 as (x-3)(x+3), then cancel x-3 where defined.',3::numeric,'G9.ALG.FRACTIONS.SIMPLIFY',null),
 ('Q.G9.VERTICAL.06','independent_practice','routine','symbolic',2,'Solve: 5x - 6 = 14.','x = 4','Add 6, then divide by 5.',2::numeric,'G9.EQN.MULTI_STEP','EQN_DIVIDE_ONE_SIDE_ONLY'),
 ('Q.G9.VERTICAL.07','independent_practice','complex','symbolic',3,'Solve: (x - 4)(x + 1) = 0.','x = 4 or x = -1','Apply zero product to each factor.',2::numeric,'G9.EQN.FACTORISED','EQN_ZERO_PRODUCT_NOT_APPLIED'),
 ('Q.G9.VERTICAL.08','guided_practice','routine','symbolic',2,'Check whether x = 3 solves 2x + 1 = 7.','yes','Substitute: 2(3) + 1 = 7.',1::numeric,'G9.EQN.SUBSTITUTION_CHECK',null),
 ('Q.G9.VERTICAL.09','representation_translation','knowledge','graphical',1,'State the coordinates of the origin.','(0, 0)','Both coordinates are zero at the origin.',1::numeric,'G9.GRAPH.CARTESIAN_PLANE',null),
 ('Q.G9.VERTICAL.10','representation_translation','routine','graphical',2,'Plot the point (-2, 3). Write its ordered pair.','(-2, 3)','Move 2 left then 3 up.',1::numeric,'G9.GRAPH.PLOT_POINTS','GRAPH_XY_REVERSED'),
 ('Q.G9.VERTICAL.11','representation_translation','routine','tabular',2,'For y = -x + 4, find y when x = 2.','2','Substitute x = 2.',1::numeric,'G9.GRAPH.TABLE_FROM_RULE',null),
 ('Q.G9.VERTICAL.12','representation_translation','complex','tabular',3,'A table has x: 0, 1, 2 and y: 3, 5, 7. Write the rule.','y = 2x + 3','The gradient is 2 and the y-intercept is 3.',2::numeric,'G9.GRAPH.RULE_FROM_TABLE','GRAPH_GRADIENT_AS_INTERCEPT'),
 ('Q.G9.VERTICAL.13','guided_practice','routine','graphical',2,'A line passes through (0, 1) and (2, 5). Find its gradient.','2','Rise 4 divided by run 2 is 2.',2::numeric,'G9.GRAPH.GRADIENT','GRAPH_GRADIENT_RECIPROCAL'),
 ('Q.G9.VERTICAL.14','representation_translation','routine','symbolic',2,'For y = 3x - 6, state the x-intercept.','2','Set y = 0: 0 = 3x - 6, so x = 2.',2::numeric,'G9.GRAPH.X_INTERCEPT','GRAPH_INTERCEPT_CONFUSION'),
 ('Q.G9.VERTICAL.15','representation_translation','complex','graphical',3,'A line has gradient -2 and y-intercept 5. Write its equation.','y = -2x + 5','Use y = mx + c.',2::numeric,'G9.GRAPH.EQUATION_FROM_GRAPH','GRAPH_GRADIENT_AS_INTERCEPT'),
 ('Q.G9.VERTICAL.16','investigation','problem_solving','verbal',3,'Taxi A costs R10 plus R2 per kilometre. Taxi B costs R4 plus R3 per kilometre. Which has the lower fixed cost?','Taxi B','The fixed cost is the value at zero kilometres: R10 versus R4.',2::numeric,'G9.GRAPH.COMPARE_RELATIONSHIPS',null)
) as seed(item_code, activity_type, cognitive_level, representation, difficulty, prompt, answer, solution, marks, skill_code, misconception_code) on seed.item_code = item.item_code
on conflict (question_item_id, version_number) do nothing;

insert into public.question_version_skill_links (question_version_id, skill_id, relationship_type)
select version.id, skill.id, 'primary'
from public.question_versions version
join public.question_items item on item.id = version.question_item_id
join (values
 ('Q.G9.DIAG.01','G9.ALG.LANGUAGE.VARIABLES'),('Q.G9.DIAG.02','G9.ALG.LANGUAGE.COEFFICIENTS'),('Q.G9.DIAG.03','G9.ALG.LIKE_TERMS'),('Q.G9.DIAG.04','G9.ALG.SUBSTITUTION'),('Q.G9.DIAG.05','G9.ALG.DISTRIBUTIVE'),('Q.G9.DIAG.06','G9.ALG.FACTOR.COMMON'),('Q.G9.DIAG.07','G9.ALG.FACTOR.DOTS'),('Q.G9.DIAG.08','G9.EQN.ONE_STEP'),('Q.G9.DIAG.09','G9.EQN.MULTI_STEP'),('Q.G9.DIAG.10','G9.EQN.BRACKETS'),('Q.G9.DIAG.11','G9.EQN.ZERO_PRODUCT'),('Q.G9.DIAG.12','G9.GRAPH.ORDERED_PAIRS'),('Q.G9.DIAG.13','G9.GRAPH.TABLE_FROM_RULE'),('Q.G9.DIAG.14','G9.GRAPH.RULE_FROM_TABLE'),('Q.G9.DIAG.15','G9.GRAPH.GRADIENT'),('Q.G9.DIAG.16','G9.GRAPH.Y_INTERCEPT'),('Q.G9.DIAG.17','G9.ALG.EXPAND.BINOMIAL'),('Q.G9.DIAG.18','G9.ALG.FACTOR.TRINOMIAL'),
 ('Q.G9.DOTS.01','G9.ALG.FACTOR.DOTS'),('Q.G9.DOTS.02','G9.ALG.EXPAND.BINOMIAL'),('Q.G9.DOTS.03','G9.ALG.FACTOR.DOTS'),('Q.G9.DOTS.04','G9.ALG.FACTOR.DOTS'),('Q.G9.DOTS.05','G9.ALG.FACTOR.DOTS'),('Q.G9.DOTS.06','G9.ALG.FACTOR.DOTS'),('Q.G9.DOTS.07','G9.ALG.FACTOR.DOTS'),('Q.G9.DOTS.08','G9.ALG.FACTOR.DOTS'),('Q.G9.DOTS.09','G9.ALG.FACTOR.DOTS'),('Q.G9.DOTS.10','G9.ALG.FACTOR.DOTS'),('Q.G9.DOTS.11','G9.ALG.FACTOR.DOTS'),('Q.G9.DOTS.12','G9.ALG.FACTOR.DOTS'),('Q.G9.DOTS.13','G9.ALG.FACTOR.COMMON'),('Q.G9.DOTS.14','G9.ALG.FACTOR.DOTS'),('Q.G9.DOTS.15','G9.ALG.FACTOR.TRINOMIAL'),('Q.G9.DOTS.16','G9.ALG.FACTOR.DOTS'),('Q.G9.DOTS.17','G9.ALG.FACTOR.DOTS'),('Q.G9.DOTS.18','G9.ALG.FACTOR.DOTS'),
 ('Q.G9.VERTICAL.01','G9.ALG.LIKE_TERMS'),('Q.G9.VERTICAL.02','G9.ALG.DISTRIBUTIVE'),('Q.G9.VERTICAL.03','G9.ALG.EXPAND.MONOMIAL'),('Q.G9.VERTICAL.04','G9.ALG.EXPAND.BINOMIAL_SQUARE'),('Q.G9.VERTICAL.05','G9.ALG.FRACTIONS.SIMPLIFY'),('Q.G9.VERTICAL.06','G9.EQN.MULTI_STEP'),('Q.G9.VERTICAL.07','G9.EQN.FACTORISED'),('Q.G9.VERTICAL.08','G9.EQN.SUBSTITUTION_CHECK'),('Q.G9.VERTICAL.09','G9.GRAPH.CARTESIAN_PLANE'),('Q.G9.VERTICAL.10','G9.GRAPH.PLOT_POINTS'),('Q.G9.VERTICAL.11','G9.GRAPH.TABLE_FROM_RULE'),('Q.G9.VERTICAL.12','G9.GRAPH.RULE_FROM_TABLE'),('Q.G9.VERTICAL.13','G9.GRAPH.GRADIENT'),('Q.G9.VERTICAL.14','G9.GRAPH.X_INTERCEPT'),('Q.G9.VERTICAL.15','G9.GRAPH.EQUATION_FROM_GRAPH'),('Q.G9.VERTICAL.16','G9.GRAPH.COMPARE_RELATIONSHIPS')
) as seed(item_code, skill_code) on seed.item_code = item.item_code
join public.curriculum_skills skill on skill.skill_code = seed.skill_code
on conflict do nothing;

insert into public.question_version_misconceptions (question_version_id, misconception_id)
select version.id, misconception.id
from public.question_versions version
join public.question_items item on item.id = version.question_item_id
join (values
 ('Q.G9.DIAG.03','ALG_COMBINE_UNLIKE_TERMS'),('Q.G9.DIAG.05','ALG_DISTRIBUTIVE_PARTIAL'),('Q.G9.DIAG.07','ALG_DOTS_AS_BINOMIAL_SQUARE'),('Q.G9.DIAG.09','EQN_DIVIDE_ONE_SIDE_ONLY'),('Q.G9.DIAG.10','EQN_MOVE_TERM_SIGN_RULE'),('Q.G9.DIAG.11','EQN_ZERO_PRODUCT_NOT_APPLIED'),('Q.G9.DIAG.12','GRAPH_XY_REVERSED'),('Q.G9.DIAG.14','GRAPH_GRADIENT_AS_INTERCEPT'),('Q.G9.DIAG.15','GRAPH_GRADIENT_RECIPROCAL'),('Q.G9.DIAG.16','GRAPH_INTERCEPT_CONFUSION'),('Q.G9.DIAG.18','ALG_TRINOMIAL_SIGN_ERROR'),('Q.G9.DOTS.03','ALG_DOTS_AS_BINOMIAL_SQUARE'),('Q.G9.DOTS.04','ALG_DOTS_INCORRECT_ROOT'),('Q.G9.DOTS.09','ALG_DOTS_AS_BINOMIAL_SQUARE'),('Q.G9.VERTICAL.01','ALG_COMBINE_UNLIKE_TERMS'),('Q.G9.VERTICAL.02','ALG_SIGN_DISTRIBUTION'),('Q.G9.VERTICAL.06','EQN_DIVIDE_ONE_SIDE_ONLY'),('Q.G9.VERTICAL.07','EQN_ZERO_PRODUCT_NOT_APPLIED'),('Q.G9.VERTICAL.10','GRAPH_XY_REVERSED'),('Q.G9.VERTICAL.12','GRAPH_GRADIENT_AS_INTERCEPT'),('Q.G9.VERTICAL.13','GRAPH_GRADIENT_RECIPROCAL'),('Q.G9.VERTICAL.14','GRAPH_INTERCEPT_CONFUSION'),('Q.G9.VERTICAL.15','GRAPH_GRADIENT_AS_INTERCEPT')
) as seed(item_code, misconception_code) on seed.item_code = item.item_code
join public.misconceptions misconception on misconception.code = seed.misconception_code
on conflict do nothing;

-- Skill metadata remains relational so instructional search can distinguish
-- representation and CAPS cognitive demand from question difficulty.
insert into public.skill_representations (skill_id, representation)
select skill.id, seed.representation::public.math_representation
from public.curriculum_skills skill
join (values
  ('G9.ALG.%', 'symbolic'), ('G9.EQN.%', 'symbolic'),
  ('G9.GRAPH.CARTESIAN_PLANE', 'graphical'), ('G9.GRAPH.ORDERED_PAIRS', 'graphical'),
  ('G9.GRAPH.PLOT_POINTS', 'graphical'), ('G9.GRAPH.LINEAR_DRAW', 'graphical'),
  ('G9.GRAPH.GRADIENT', 'graphical'), ('G9.GRAPH.X_INTERCEPT', 'graphical'),
  ('G9.GRAPH.Y_INTERCEPT', 'graphical'), ('G9.GRAPH.EQUATION_FROM_GRAPH', 'graphical'),
  ('G9.GRAPH.TABLE_FROM_RULE', 'tabular'), ('G9.GRAPH.RULE_FROM_TABLE', 'tabular'),
  ('G9.GRAPH.COMPARE_RELATIONSHIPS', 'verbal'), ('G9.GRAPH.REPRESENTATION_TRANSLATE', 'tabular')
) as seed(code_pattern, representation) on skill.skill_code like seed.code_pattern
where skill.is_active
on conflict do nothing;

insert into public.skill_cognitive_levels (skill_id, cognitive_level)
select skill.id, level.cognitive_level
from public.curriculum_skills skill
cross join (values ('knowledge'::public.caps_cognitive_level), ('routine'::public.caps_cognitive_level)) as level(cognitive_level)
where skill.is_active and skill.skill_code like 'G9.%'
on conflict do nothing;

insert into public.skill_cognitive_levels (skill_id, cognitive_level)
select skill.id, 'complex'::public.caps_cognitive_level
from public.curriculum_skills skill
where skill.skill_code in ('G9.ALG.FACTOR.DOTS', 'G9.ALG.FACTOR.TRINOMIAL', 'G9.ALG.FRACTIONS.SIMPLIFY', 'G9.EQN.FACTORISED', 'G9.GRAPH.EQUATION_FROM_GRAPH', 'G9.GRAPH.COMPARE_RELATIONSHIPS')
  and skill.is_active
on conflict do nothing;

-- Supporting links expose prerequisite knowledge without diluting the single
-- primary-skill evidence designation on every item.
insert into public.question_version_skill_links (question_version_id, skill_id, relationship_type)
select version.id, skill.id, 'supporting'
from public.question_versions version
join public.question_items item on item.id = version.question_item_id
join (values
  ('Q.G9.DIAG.07', 'G9.ALG.EXPAND.BINOMIAL'),
  ('Q.G9.DIAG.10', 'G9.ALG.DISTRIBUTIVE'),
  ('Q.G9.DIAG.11', 'G9.EQN.FACTORISED'),
  ('Q.G9.DOTS.02', 'G9.ALG.FACTOR.DOTS'),
  ('Q.G9.DOTS.03', 'G9.ALG.EXPAND.BINOMIAL'),
  ('Q.G9.DOTS.09', 'G9.ALG.EXPAND.BINOMIAL'),
  ('Q.G9.VERTICAL.05', 'G9.ALG.FACTOR.DOTS'),
  ('Q.G9.VERTICAL.07', 'G9.EQN.ZERO_PRODUCT'),
  ('Q.G9.VERTICAL.12', 'G9.GRAPH.GRADIENT'),
  ('Q.G9.VERTICAL.15', 'G9.GRAPH.GRADIENT')
) as seed(item_code, skill_code) on seed.item_code = item.item_code
join public.curriculum_skills skill on skill.skill_code = seed.skill_code
on conflict do nothing;

-- Hints are opt-in and ordered. Their use is recorded as evidence; the
-- mastery engine distinguishes assisted from independent success.
insert into public.question_hints (question_version_id, hint_level, prompt)
select version.id, seed.hint_level, seed.prompt
from public.question_versions version
join public.question_items item on item.id = version.question_item_id
join (values
  ('Q.G9.DOTS.03', 1::smallint, 'Look at both terms. Are they perfect squares?'),
  ('Q.G9.DOTS.03', 2::smallint, 'Recall: a² - b² = (a - b)(a + b).'),
  ('Q.G9.DOTS.03', 3::smallint, 'x² = x² and 49 = 7².'),
  ('Q.G9.DOTS.03', 4::smallint, 'Complete: (x - 7)(x + ___).'),
  ('Q.G9.DOTS.03', 5::smallint, 'x² - 49 = (x - 7)(x + 7).'),
  ('Q.G9.DOTS.04', 1::smallint, 'First express 25 as a perfect square.'),
  ('Q.G9.DOTS.04', 2::smallint, 'Use the difference-of-two-squares structure.'),
  ('Q.G9.DOTS.04', 3::smallint, '25 = 5².'),
  ('Q.G9.DOTS.04', 4::smallint, 'Complete: (y - 5)(y + ___).'),
  ('Q.G9.DOTS.04', 5::smallint, 'y² - 25 = (y - 5)(y + 5).'),
  ('Q.G9.DOTS.09', 1::smallint, 'A difference of squares is not a binomial square.'),
  ('Q.G9.DOTS.09', 2::smallint, 'Compare a² - b² with (a - b)².'),
  ('Q.G9.DOTS.09', 3::smallint, '64 = 8².'),
  ('Q.G9.DOTS.09', 4::smallint, 'Complete: (x - 8)(x + ___).'),
  ('Q.G9.DOTS.09', 5::smallint, 'x² - 64 = (x - 8)(x + 8).')
) as seed(item_code, hint_level, prompt) on seed.item_code = item.item_code
on conflict do nothing;

-- The reference activity is deliberately composed rather than a hard-coded
-- lesson. It remains draft until an authorised reviewer approves both it and
-- its constituent question versions.
insert into public.learning_activity_templates (curriculum_version_id, target_skill_id, code, title, description, source_tier, review_notes)
select curriculum.id, skill.id, 'ACT.G9.ALG.FACTOR.DOTS.FOUNDATIONS', 'Difference of Two Squares Foundations', 'A staged prerequisite check, worked-to-independent sequence, error analysis and delayed retrieval for difference of two squares.', 'Odysseus_authored', 'Requires designated mathematics reviewer approval before learner release.'
from public.curriculum_versions curriculum
join public.curriculum_skills skill on skill.subject_id = curriculum.subject_id and skill.skill_code = 'G9.ALG.FACTOR.DOTS'
where curriculum.code = 'CAPS-MATH-G9-2026'
on conflict (curriculum_version_id, code) do nothing;

insert into public.learning_activity_stages (learning_activity_template_id, stage_type, sequence_number, learner_instruction, tutor_instruction)
select activity.id, seed.stage_type::public.learning_activity_stage_type, seed.sequence_number, seed.learner_instruction, seed.tutor_instruction
from public.learning_activity_templates activity
join (values
  ('retrieval_warm_up', 1::smallint, 'Identify 25, 36, 49 and 81 as perfect squares.', 'Listen for whether the learner identifies both a base and a square.'),
  ('prerequisite_check', 2::smallint, 'Expand (x - 5)(x + 5).', 'Use this to distinguish expansion from factorisation difficulty.'),
  ('worked_example', 3::smallint, 'Study the worked factorisation of x² - 25.', 'Name the structure before naming the rule.'),
  ('faded_example', 4::smallint, 'Complete the missing factor in y² - 25.', 'Pause before supplying the next step.'),
  ('guided_practice', 5::smallint, 'Factorise each expression with support when you choose to request it.', 'Record the highest hint opened; do not give unrecorded hints.'),
  ('error_analysis', 6::smallint, 'Explain why x² - 64 = (x - 8)² is incorrect, then correct it.', 'Look for the binomial-square misconception, not just the final answer.'),
  ('independent_practice', 7::smallint, 'Factorise fresh difference-of-two-squares expressions independently.', 'Do not offer hints unless the learner requests one.'),
  ('interleaved_review', 8::smallint, 'Choose an appropriate factorisation method for each expression.', 'Ask the learner to justify the chosen method.'),
  ('exit_check', 9::smallint, 'Complete two fresh factorisations independently.', 'Use as target-level formative evidence.'),
  ('delayed_retrieval', 10::smallint, 'Later, factorise an equivalent expression without help.', 'Schedule only after secure independent evidence; use as retention evidence.')
) as seed(stage_type, sequence_number, learner_instruction, tutor_instruction) on true
where activity.code = 'ACT.G9.ALG.FACTOR.DOTS.FOUNDATIONS'
on conflict (learning_activity_template_id, sequence_number) do nothing;

insert into public.learning_activity_stage_questions (learning_activity_stage_id, question_version_id, display_order)
select stage.id, version.id, seed.display_order
from public.learning_activity_templates activity
join public.learning_activity_stages stage on stage.learning_activity_template_id = activity.id
join public.question_items item on true
join public.question_versions version on version.question_item_id = item.id
join (values
  (1::smallint, 'Q.G9.DOTS.01', 1::smallint),
  (2::smallint, 'Q.G9.DOTS.02', 1::smallint), (3::smallint, 'Q.G9.DOTS.03', 1::smallint),
  (4::smallint, 'Q.G9.DOTS.04', 1::smallint),
  (5::smallint, 'Q.G9.DOTS.05', 1::smallint), (5::smallint, 'Q.G9.DOTS.06', 2::smallint), (5::smallint, 'Q.G9.DOTS.07', 3::smallint), (5::smallint, 'Q.G9.DOTS.08', 4::smallint),
  (6::smallint, 'Q.G9.DOTS.09', 1::smallint),
  (7::smallint, 'Q.G9.DOTS.10', 1::smallint), (7::smallint, 'Q.G9.DOTS.11', 2::smallint), (7::smallint, 'Q.G9.DOTS.12', 3::smallint),
  (8::smallint, 'Q.G9.DOTS.13', 1::smallint), (8::smallint, 'Q.G9.DOTS.14', 2::smallint), (8::smallint, 'Q.G9.DOTS.15', 3::smallint),
  (9::smallint, 'Q.G9.DOTS.16', 1::smallint), (9::smallint, 'Q.G9.DOTS.17', 2::smallint),
  (10::smallint, 'Q.G9.DOTS.18', 1::smallint)
) as seed(stage_sequence, item_code, display_order) on seed.stage_sequence = stage.sequence_number and seed.item_code = item.item_code
where activity.code = 'ACT.G9.ALG.FACTOR.DOTS.FOUNDATIONS'
on conflict do nothing;

insert into public.diagnostic_blueprints (curriculum_version_id, code, name, description, minimum_item_count, maximum_item_count, review_notes)
select curriculum.id, 'DIAG.G9.MATH.VERTICAL.V1', 'Grade 9 Mathematics vertical diagnostic', 'An 18-item deterministic entry diagnostic for algebraic expressions, equations and linear graphs. Routing is based on item-level prerequisite and target evidence, not a composite ability score.', 15::smallint, 22::smallint, 'Requires designated mathematics reviewer approval before learner release.'
from public.curriculum_versions curriculum
where curriculum.code = 'CAPS-MATH-G9-2026'
on conflict (curriculum_version_id, code) do nothing;

insert into public.diagnostic_blueprint_questions (diagnostic_blueprint_id, question_version_id, sequence_number, purpose)
select blueprint.id, version.id, seed.sequence_number, seed.purpose
from public.diagnostic_blueprints blueprint
join public.question_items item on true
join public.question_versions version on version.question_item_id = item.id
join (values
  ('Q.G9.DIAG.01', 1::smallint, 'entry'), ('Q.G9.DIAG.02', 2::smallint, 'entry'), ('Q.G9.DIAG.03', 3::smallint, 'prerequisite_check'), ('Q.G9.DIAG.04', 4::smallint, 'prerequisite_check'),
  ('Q.G9.DIAG.05', 5::smallint, 'prerequisite_check'), ('Q.G9.DIAG.06', 6::smallint, 'prerequisite_check'), ('Q.G9.DIAG.07', 7::smallint, 'misconception_probe'),
  ('Q.G9.DIAG.08', 8::smallint, 'target_probe'), ('Q.G9.DIAG.09', 9::smallint, 'target_probe'), ('Q.G9.DIAG.10', 10::smallint, 'target_probe'), ('Q.G9.DIAG.11', 11::smallint, 'target_probe'),
  ('Q.G9.DIAG.12', 12::smallint, 'prerequisite_check'), ('Q.G9.DIAG.13', 13::smallint, 'target_probe'), ('Q.G9.DIAG.14', 14::smallint, 'target_probe'),
  ('Q.G9.DIAG.15', 15::smallint, 'target_probe'), ('Q.G9.DIAG.16', 16::smallint, 'target_probe'), ('Q.G9.DIAG.17', 17::smallint, 'extension'), ('Q.G9.DIAG.18', 18::smallint, 'extension')
) as seed(item_code, sequence_number, purpose) on seed.item_code = item.item_code
where blueprint.code = 'DIAG.G9.MATH.VERTICAL.V1'
on conflict do nothing;
