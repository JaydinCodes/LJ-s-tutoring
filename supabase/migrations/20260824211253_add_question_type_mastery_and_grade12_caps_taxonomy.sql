-- Question-type evidence sits below a curriculum skill. A learner can be
-- secure with a probability formula yet need help interpreting a tree diagram;
-- these are intentionally different evidence streams.
create table public.curriculum_question_types (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.curriculum_skills(id) on delete cascade,
  question_type_code text not null unique,
  title text not null,
  description text not null,
  representation text not null check (representation in ('symbolic', 'numeric', 'table', 'graph', 'diagram', 'word_problem', 'proof', 'mixed')),
  cognitive_demand text not null check (cognitive_demand in ('recall', 'procedure', 'application', 'reasoning')),
  source_reference text not null,
  review_status text not null default 'teacher_review'
    check (review_status in ('draft', 'teacher_review', 'approved', 'published', 'retired')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(question_type_code) <> '' and btrim(title) <> '' and btrim(description) <> '' and btrim(source_reference) <> '')
);

create index curriculum_question_types_skill_idx
  on public.curriculum_question_types(skill_id, cognitive_demand)
  where is_active;

alter table public.learning_evidence
  add column question_type_id uuid references public.curriculum_question_types(id) on delete restrict;
create index learning_evidence_student_question_type_recent_idx
  on public.learning_evidence(student_id, question_type_id, observed_at desc)
  where question_type_id is not null;

create table public.learner_question_type_state (
  student_id uuid not null references public.students(id) on delete cascade,
  question_type_id uuid not null references public.curriculum_question_types(id) on delete restrict,
  instructional_state text not null check (instructional_state in ('insufficient_evidence', 'rebuild', 'practice', 'consolidate', 'extend')),
  internal_score numeric(5,2),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  evidence_count integer not null check (evidence_count >= 0),
  recent_trend numeric(5,2),
  calculation_version text not null default 'v2-question-type',
  computed_at timestamptz not null default now(),
  primary key (student_id, question_type_id)
);

alter table public.curriculum_question_types enable row level security;
alter table public.learner_question_type_state enable row level security;
revoke all on table public.curriculum_question_types, public.learner_question_type_state from anon, authenticated;
grant select on table public.curriculum_question_types, public.learner_question_type_state to authenticated;
create policy "adaptive_admin_manage_question_types" on public.curriculum_question_types for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "adaptive_admin_read_question_type_states" on public.learner_question_type_state for select to authenticated using (public.is_platform_admin());
create policy "adaptive_tutor_read_allocated_question_type_states" on public.learner_question_type_state for select to authenticated using (
  exists (
    select 1 from public.curriculum_question_types question_type
    join public.curriculum_skills skill on skill.id = question_type.skill_id
    join public.tutor_student_allocations allocation on allocation.student_id = learner_question_type_state.student_id
    where question_type.id = learner_question_type_state.question_type_id
      and allocation.tutor_id = public.current_tutor_id() and allocation.status = 'active'
  )
);

create or replace function public.recompute_learner_question_type_state(
  p_student_id uuid,
  p_question_type_id uuid
)
returns public.learner_question_type_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_score numeric;
  v_trend numeric;
  v_state text;
  v_record public.learner_question_type_state;
begin
  if not public.can_manage_learning_for_student(p_student_id) then
    raise exception 'question_type_state_not_authorized' using errcode = '42501';
  end if;
  if p_question_type_id is null or not exists (
    select 1 from public.curriculum_question_types
    where id = p_question_type_id and is_active and review_status in ('approved', 'published')
  ) then
    raise exception 'curriculum_question_type_not_available' using errcode = 'P0002';
  end if;

  with weighted as (
    select score,
      case evidence_type when 'rubric' then 1.00 when 'diagnostic' then 0.95 when 'tutor_observation' then 0.70 else 0.55 end
      * exp(-greatest(0, extract(epoch from (now() - observed_at)) / 86400) / 90.0) as weight,
      row_number() over (order by observed_at desc, created_at desc) as sequence
    from public.learning_evidence
    where student_id = p_student_id and question_type_id = p_question_type_id and reviewed_at is not null
  )
  select count(*),
    case when sum(weight) > 0 then round(sum(score * weight) / sum(weight), 2) end,
    case when count(*) >= 2 then round(max(score) filter (where sequence = 1) - max(score) filter (where sequence = 2), 2) end
  into v_count, v_score, v_trend from weighted;

  v_state := case when coalesce(v_count, 0) < 2 then 'insufficient_evidence'
    when v_score < 55 then 'rebuild' when v_score < 70 then 'practice'
    when v_score < 85 then 'consolidate' else 'extend' end;
  insert into public.learner_question_type_state (
    student_id, question_type_id, instructional_state, internal_score, confidence, evidence_count, recent_trend
  ) values (
    p_student_id, p_question_type_id, v_state, v_score,
    least(1::numeric, coalesce(v_count, 0)::numeric / 4), coalesce(v_count, 0), v_trend
  ) on conflict (student_id, question_type_id) do update set
    instructional_state = excluded.instructional_state, internal_score = excluded.internal_score,
    confidence = excluded.confidence, evidence_count = excluded.evidence_count,
    recent_trend = excluded.recent_trend, computed_at = now()
  returning * into v_record;
  return v_record;
end;
$$;

-- Extend the existing evidence boundary without breaking its existing callers.
drop function public.record_learning_evidence(uuid, uuid, numeric, text, text, timestamptz, uuid, boolean);
create function public.record_learning_evidence(
  p_student_id uuid, p_skill_id uuid, p_score numeric, p_evidence_type text,
  p_source_reference text, p_observed_at timestamptz default now(),
  p_source_submission_id uuid default null, p_learner_visible boolean default false,
  p_question_type_id uuid default null
)
returns public.learning_evidence
language plpgsql security definer set search_path = ''
as $$
declare v_evidence public.learning_evidence; v_type text := lower(btrim(coalesce(p_evidence_type, '')));
begin
  if not public.can_manage_learning_for_student(p_student_id) then raise exception 'learning_evidence_not_authorized' using errcode = '42501'; end if;
  if p_skill_id is null or not exists (select 1 from public.curriculum_skills where id = p_skill_id and is_active and review_status in ('approved', 'published')) then raise exception 'curriculum_skill_not_available' using errcode = 'P0002'; end if;
  if p_question_type_id is not null and not exists (
    select 1 from public.curriculum_question_types where id = p_question_type_id and skill_id = p_skill_id and is_active and review_status in ('approved', 'published')
  ) then raise exception 'curriculum_question_type_not_available' using errcode = 'P0002'; end if;
  if p_score is null or p_score < 0 or p_score > 100 then raise exception 'learning_evidence_score_invalid' using errcode = '22023'; end if;
  if v_type not in ('rubric', 'diagnostic', 'tutor_observation', 'assignment') then raise exception 'learning_evidence_type_invalid' using errcode = '22023'; end if;
  if nullif(btrim(coalesce(p_source_reference, '')), '') is null then raise exception 'learning_evidence_source_required' using errcode = '22023'; end if;
  if p_observed_at is null or p_observed_at > now() + interval '5 minutes' then raise exception 'learning_evidence_observed_at_invalid' using errcode = '22023'; end if;
  insert into public.learning_evidence (student_id, skill_id, question_type_id, score, evidence_type, source_reference, source_submission_id, observed_at, reviewed_at, learner_visible, created_by_profile_id)
  values (p_student_id, p_skill_id, p_question_type_id, p_score, v_type, btrim(p_source_reference), p_source_submission_id, p_observed_at, now(), coalesce(p_learner_visible, false), public.current_profile_id()) returning * into v_evidence;
  perform public.recompute_learner_skill_state(p_student_id, p_skill_id);
  if p_question_type_id is not null then perform public.recompute_learner_question_type_state(p_student_id, p_question_type_id); end if;
  perform public.log_audit_event('learning.evidence_recorded', 'learning_evidence', v_evidence.id::text, jsonb_build_object('student_id', p_student_id, 'skill_id', p_skill_id, 'question_type_id', p_question_type_id, 'evidence_type', v_type));
  return v_evidence;
end;
$$;
revoke all on function public.recompute_learner_question_type_state(uuid, uuid) from public, anon;
revoke all on function public.record_learning_evidence(uuid, uuid, numeric, text, text, timestamptz, uuid, boolean, uuid) from public, anon;
grant execute on function public.recompute_learner_question_type_state(uuid, uuid) to authenticated;
grant execute on function public.record_learning_evidence(uuid, uuid, numeric, text, text, timestamptz, uuid, boolean, uuid) to authenticated;

-- Textbook map: atomic skills are deliberately method/question-family specific.
-- It is imported as teacher_review: content and wording must be signed off by
-- a Grade 12 Mathematics educator before it can drive recommendations.
insert into public.subjects (name, grade, curriculum) values ('Mathematics', 'Grade 12', 'CAPS') on conflict (name, grade, curriculum) do nothing;
with subject_row as (
  select id from public.subjects where name = 'Mathematics' and grade = 'Grade 12' and curriculum = 'CAPS' limit 1
), skills(skill_code, strand, topic, title, description, cognitive_level, source_reference) as (
  values
  ('G12-SEQ-ARITH-IDENTIFY','Sequences and series','Arithmetic sequences','Identify arithmetic structure','Recognise a constant first difference, including algebraic and fractional terms.','reasoning','Textbook 1.1'),
  ('G12-SEQ-ARITH-NTERM','Sequences and series','Arithmetic sequences','Find an arithmetic general term','Model Tn = a + (n - 1)d from terms or conditions.','procedure','Textbook 1.1'),
  ('G12-SEQ-ARITH-TERM-INDEX','Sequences and series','Arithmetic sequences','Find a term or its position','Solve forward and reverse nth-term questions.','application','Textbook 1.1'),
  ('G12-SEQ-QUAD-DIFF','Sequences and series','Quadratic sequences','Classify by first and second differences','Distinguish linear, quadratic and non-pattern sequences.','reasoning','Textbook 1.1'),
  ('G12-SEQ-QUAD-NTERM','Sequences and series','Quadratic sequences','Derive a quadratic general term','Use terms or difference tables to determine an^2 + bn + c.','procedure','Textbook 1.1'),
  ('G12-SEQ-GEO-IDENTIFY','Sequences and series','Geometric sequences','Identify a geometric ratio','Recognise a constant ratio, including negative and fractional ratios.','reasoning','Textbook 1.2'),
  ('G12-SEQ-GEO-NTERM','Sequences and series','Geometric sequences','Find a geometric general term','Model Tn = ar^(n - 1).','procedure','Textbook 1.2'),
  ('G12-SEQ-GEO-TERM-INDEX','Sequences and series','Geometric sequences','Find a geometric term or its position','Solve forward and reverse geometric-term questions.','application','Textbook 1.2'),
  ('G12-SEQ-SERIES-NOTATION','Sequences and series','Series','Translate sequence and sigma notation','Move accurately between expanded sums and summation notation.','procedure','Textbook 1.3'),
  ('G12-SEQ-ARITH-SUM','Sequences and series','Finite arithmetic series','Calculate finite arithmetic sums','Select and apply Sn formulas, including contextual sums.','application','Textbook 1.4'),
  ('G12-SEQ-GEO-SUM','Sequences and series','Finite geometric series','Calculate finite geometric sums','Select and apply the finite geometric-sum formula.','application','Textbook 1.5'),
  ('G12-SEQ-INF-CONVERGE','Sequences and series','Infinite series','Test convergence of an infinite geometric series','Decide whether -1 < r < 1 before summing.','reasoning','Textbook 1.6'),
  ('G12-SEQ-INF-SUM','Sequences and series','Infinite series','Calculate an infinite geometric sum','Use S-infinity = a/(1-r) only when convergence is valid.','procedure','Textbook 1.6'),
  ('G12-FUNC-DOMAIN-RANGE','Functions','Functions and relations','Determine domain and range','Read restrictions and output sets from formulae, graphs and mappings.','reasoning','Textbook 2.2'),
  ('G12-FUNC-RELATION','Functions','Functions and relations','Distinguish functions from relations','Use mapping and vertical-line reasoning to classify relations.','reasoning','Textbook 2.2'),
  ('G12-FUNC-EVALUATE','Functions','Functions and relations','Evaluate and compose function values','Substitute accurately, including notation and composite functions.','procedure','Textbook 2.2'),
  ('G12-FUNC-INVERSE-ALG','Functions','Inverse functions','Determine an inverse algebraically','Swap variables, solve, and state domain restrictions.','procedure','Textbook 2.3'),
  ('G12-FUNC-INVERSE-GRAPH','Functions','Inverse functions','Interpret inverse graphs','Use reflection in y=x and one-to-one restrictions.','reasoning','Textbook 2.3'),
  ('G12-FUNC-LINEAR-FEATURES','Functions','Linear functions','Analyse a linear function','Determine intercepts, gradient, domain/range and transformations.','application','Textbook 2.4'),
  ('G12-FUNC-QUAD-FEATURES','Functions','Quadratic functions','Analyse a quadratic function','Use turning point, roots, axis, sign and transformations.','application','Textbook 2.5'),
  ('G12-FUNC-QUAD-INVERSE','Functions','Quadratic functions','Restrict and invert a quadratic relation','Select the valid branch before finding the inverse.','reasoning','Textbook 2.5'),
  ('G12-FUNC-EXP-GRAPH','Functions','Exponential functions','Analyse exponential graphs','Interpret base, asymptote, intercept and transformations.','application','Textbook 2.6'),
  ('G12-FUNC-LOG-LAWS','Functions','Logarithms','Apply logarithm laws','Expand, condense and simplify logarithmic expressions.','procedure','Textbook 2.6-2.8'),
  ('G12-FUNC-LOG-SOLVE','Functions','Logarithms','Solve logarithmic and exponential equations','Convert forms, use valid domains and calculator/change-of-base methods.','application','Textbook 2.6-2.8'),
  ('G12-FIN-COMPOUND-PERIOD','Finance','Compound growth','Calculate an investment period','Rearrange compound-growth formulae using logarithms.','application','Textbook 3.1'),
  ('G12-FIN-RATE-PERIOD','Finance','Interest conventions','Align rate and compounding periods','Convert nominal rates and number of periods consistently.','procedure','Textbook 3.1-3.4'),
  ('G12-FIN-FV-ANNUITY','Finance','Future-value annuities','Calculate future value of deposits','Model regular deposits, timing and compounding.','application','Textbook 3.3'),
  ('G12-FIN-PV-ANNUITY','Finance','Present-value annuities','Calculate loan or annuity present value','Model repayments, timing and compounding.','application','Textbook 3.4'),
  ('G12-FIN-COMPARE','Finance','Investment and loan options','Compare financial options','Interpret assumptions, total cost and value in context.','reasoning','Textbook 3.5'),
  ('G12-TRIG-IDENTITIES-CORE','Trigonometry','Revision identities','Use fundamental and reduction identities','Select exact values, co-functions and reduction formulae.','procedure','Textbook 4.1'),
  ('G12-TRIG-PROVE','Trigonometry','Identities','Prove a trigonometric identity','Transform one side with valid identities without circular reasoning.','reasoning','Textbook 4.1-4.3'),
  ('G12-TRIG-COMPOUND','Trigonometry','Compound angles','Apply compound-angle identities','Expand or evaluate sin(a plus/minus b), cos and tan forms.','procedure','Textbook 4.2'),
  ('G12-TRIG-DOUBLE','Trigonometry','Double angles','Apply double-angle identities','Choose an equivalent double-angle form strategically.','procedure','Textbook 4.3'),
  ('G12-TRIG-EQUATIONS','Trigonometry','Equations','Solve trigonometric equations in intervals','Find all valid solutions and respect the stated interval.','application','Textbook 4.4'),
  ('G12-TRIG-APPLICATIONS','Trigonometry','Applications','Model trigonometric applications','Translate geometry/context into equations and interpret results.','application','Textbook 4.5'),
  ('G12-POLY-QUAD-REVISION','Polynomials','Revision','Factorise and solve quadratic expressions','Choose factorisation or quadratic-formula methods and validate roots.','procedure','Textbook 5.1'),
  ('G12-POLY-CUBIC-FORM','Polynomials','Cubic polynomials','Represent and analyse cubic polynomials','Connect factors, roots, degree and graph behaviour.','reasoning','Textbook 5.2'),
  ('G12-POLY-DIVISION','Polynomials','Cubic polynomials','Divide polynomials','Use long/synthetic division accurately.','procedure','Textbook 5.2'),
  ('G12-POLY-REMAINDER','Polynomials','Remainder theorem','Apply the remainder theorem','Evaluate P(a) to find a remainder or unknown parameter.','application','Textbook 5.3'),
  ('G12-POLY-FACTOR','Polynomials','Factor theorem','Use the factor theorem','Establish or use a linear factor from a zero.','reasoning','Textbook 5.4'),
  ('G12-POLY-CUBIC-SOLVE','Polynomials','Solving cubic equations','Solve a cubic equation','Find a rational root, factorise, then solve the remaining quadratic.','application','Textbook 5.5'),
  ('G12-CALC-LIMIT-NUMERIC','Differential calculus','Limits','Evaluate limits from tables or graphs','Reason about values approaching a point.','reasoning','Textbook 6.1'),
  ('G12-CALC-LIMIT-ALG','Differential calculus','Limits','Evaluate algebraic limits','Simplify removable forms before substitution.','procedure','Textbook 6.1'),
  ('G12-CALC-FIRST-PRINCIPLES','Differential calculus','First principles','Differentiate from first principles','Expand, simplify and take the h tends to zero limit.','procedure','Textbook 6.2'),
  ('G12-CALC-RULES','Differential calculus','Rules for differentiation','Differentiate polynomial functions','Apply power, sum and constant rules accurately.','procedure','Textbook 6.3'),
  ('G12-CALC-TANGENT-NORMAL','Differential calculus','Tangents and normals','Find tangent or normal equations','Use derivative gradient and point-gradient form.','application','Textbook 6.4'),
  ('G12-CALC-SECOND-DERIV','Differential calculus','Second derivative','Use the second derivative','Classify concavity and stationary-point behaviour.','reasoning','Textbook 6.5'),
  ('G12-CALC-SKETCH','Differential calculus','Sketching graphs','Sketch from derivatives and intercepts','Combine roots, stationary points, asymptotes and end behaviour.','application','Textbook 6.6'),
  ('G12-CALC-OPTIMISE','Differential calculus','Applications','Optimise a contextual quantity','Model, differentiate, test candidates and interpret units.','application','Textbook 6.7'),
  ('G12-ANALYTIC-LINE','Analytical geometry','Revision','Use coordinate-geometry line tools','Calculate distance, midpoint, gradient and line equations.','procedure','Textbook 7.1'),
  ('G12-ANALYTIC-LINE-REL','Analytical geometry','Revision','Prove line relationships','Use gradients to establish parallel, perpendicular or angle claims.','reasoning','Textbook 7.1'),
  ('G12-ANALYTIC-CIRCLE-FORM','Analytical geometry','Equation of a circle','Determine a circle equation','Use centre-radius or general-form information.','procedure','Textbook 7.2'),
  ('G12-ANALYTIC-CIRCLE-INTERSECT','Analytical geometry','Equation of a circle','Solve line-circle intersections','Substitute and interpret zero, one or two intersection points.','application','Textbook 7.2'),
  ('G12-ANALYTIC-CIRCLE-TANGENT','Analytical geometry','Tangent to a circle','Determine a circle tangent','Use radius-tangent perpendicularity or discriminant conditions.','application','Textbook 7.3'),
  ('G12-EUCLID-THEOREMS','Euclidean geometry','Revision','Select and justify geometry theorems','Name valid angle, cyclic, parallel-line and congruency reasons.','reasoning','Textbook 8.1'),
  ('G12-EUCLID-RATIO','Euclidean geometry','Ratio and proportion','Solve ratio and proportion geometry','Translate proportions and section relationships accurately.','application','Textbook 8.2'),
  ('G12-EUCLID-POLYGONS','Euclidean geometry','Polygons','Apply polygon angle properties','Use interior/exterior angle sums and regular-polygon reasoning.','procedure','Textbook 8.3'),
  ('G12-EUCLID-TRIANGLES','Euclidean geometry','Triangles','Use triangle area and angle relationships','Link lengths, angles and area in diagrams.','application','Textbook 8.4'),
  ('G12-EUCLID-SIMILARITY','Euclidean geometry','Similarity','Prove and use similarity','Establish correspondence, then apply proportional sides.','reasoning','Textbook 8.5'),
  ('G12-EUCLID-PYTHAG','Euclidean geometry','Pythagorean theorem','Apply Pythagoras in composite diagrams','Identify the correct right triangle and interpret lengths.','application','Textbook 8.6'),
  ('G12-STATS-DESCRIBE','Statistics','Revision','Describe and interpret data displays','Read distributions, quartiles, spread and outliers.','reasoning','Textbook 9.1'),
  ('G12-STATS-SUMMARY','Statistics','Revision','Calculate summary statistics','Use appropriate mean, median, standard deviation and quartile calculations.','procedure','Textbook 9.1'),
  ('G12-STATS-REGRESSION','Statistics','Curve fitting','Fit and use a regression line','Calculate or interpret y-hat = a + bx and make bounded predictions.','application','Textbook 9.2'),
  ('G12-STATS-CORRELATION','Statistics','Correlation','Interpret correlation','Describe direction, strength, outliers and limits of correlation.','reasoning','Textbook 9.3'),
  ('G12-PROB-NOTATION','Probability','Revision','Use event notation','Translate union, intersection, complement and mutually-exclusive language.','procedure','Textbook 10.1'),
  ('G12-PROB-IDENTITIES','Probability','Identities','Apply probability identities','Use addition, complement and inclusion-exclusion identities.','application','Textbook 10.2'),
  ('G12-PROB-VENN','Probability','Tools and techniques','Solve Venn-diagram probability questions','Populate regions, use totals and interpret overlapping events.','application','Textbook 10.3'),
  ('G12-PROB-TREE','Probability','Tools and techniques','Solve tree-diagram probability questions','Follow paths, update branches and combine event probabilities.','application','Textbook 10.3'),
  ('G12-PROB-DEPENDENCE','Probability','Tools and techniques','Distinguish independent and dependent events','Decide whether a previous event changes the next probability.','reasoning','Textbook 10.2-10.3'),
  ('G12-PROB-COUNTING-PRINCIPLE','Probability','Fundamental counting principle','Apply the fundamental counting principle','Represent sequential choices as a product of valid options.','application','Textbook 10.4'),
  ('G12-PROB-FACTORIAL','Probability','Factorial notation','Use factorial notation','Simplify factorial expressions with valid cancellation.','procedure','Textbook 10.5'),
  ('G12-PROB-ARRANGEMENTS','Probability','Counting problems','Count arrangements with restrictions','Model ordering, repetition and restrictions before calculating.','application','Textbook 10.6'),
  ('G12-PROB-COUNT-PROB','Probability','Probability problems','Use counting to calculate probability','Form favourable/total counts and account for complement cases.','application','Textbook 10.7')
), inserted as (
  insert into public.curriculum_skills (subject_id, grade, curriculum, strand, topic, skill_code, title, description, cognitive_level, review_status)
  select subject_row.id, 'Grade 12', 'CAPS', strand, topic, skill_code, title, description, cognitive_level, 'teacher_review' from skills cross join subject_row
  on conflict (skill_code) do update set strand = excluded.strand, topic = excluded.topic, title = excluded.title, description = excluded.description, cognitive_level = excluded.cognitive_level, updated_at = now()
  returning id, skill_code, title, description, cognitive_level
)
insert into public.curriculum_question_types (skill_id, question_type_code, title, description, representation, cognitive_demand, source_reference)
select id, skill_code || '-FORM', title || ' question family', description,
  case when cognitive_level = 'reasoning' then 'proof' when cognitive_level = 'application' then 'word_problem' else 'symbolic' end,
  case cognitive_level when 'reasoning' then 'reasoning' when 'application' then 'application' when 'procedure' then 'procedure' else 'recall' end,
  'Everything Maths Grade 12 CAPS: ' || split_part(skill_code, '-', 2)
from inserted
on conflict (question_type_code) do update set title = excluded.title, description = excluded.description, representation = excluded.representation, cognitive_demand = excluded.cognitive_demand, updated_at = now();
