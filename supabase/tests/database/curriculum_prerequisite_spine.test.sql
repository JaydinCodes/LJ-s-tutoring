begin;

select plan(11);

select is(
  (select count(*) from public.subjects where name = 'Mathematics' and curriculum = 'CAPS' and grade in ('Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12')),
  5::bigint,
  'the Mathematics taxonomy has one CAPS subject record for every Grade 8–12 year'
);

select is(
  (select count(*) from public.curriculum_skills where grade = 'Grade 8' and skill_code like 'G8-%'),
  18::bigint,
  'Grade 8 has atomic Mathematics question families'
);

select is(
  (select count(*) from public.curriculum_skills where grade = 'Grade 9' and skill_code like 'G9-%'),
  15::bigint,
  'Grade 9 has atomic Mathematics question families'
);

select is(
  (select count(*) from public.curriculum_skills where grade = 'Grade 10' and skill_code like 'G10-%'),
  24::bigint,
  'Grade 10 has atomic Mathematics question families'
);

select is(
  (select count(*) from public.curriculum_skills where grade = 'Grade 11' and skill_code like 'G11-%'),
  24::bigint,
  'Grade 11 has atomic Mathematics question families'
);

select is(
  (select count(*) from public.curriculum_question_types question_type
   join public.curriculum_skills skill on skill.id = question_type.skill_id
   where skill.skill_code ~ '^G(8|9|10|11)-'),
  81::bigint,
  'every new Grade 8–11 skill has its own question-type evidence stream'
);

select is(
  (select count(*) from public.curriculum_skills where skill_code ~ '^G(8|9|10|11)-' and review_status = 'teacher_review'),
  81::bigint,
  'the new source-derived taxonomy remains review-only until a curriculum owner approves it'
);

select ok(
  exists (
    select 1
    from public.skill_prerequisites link
    join public.curriculum_skills skill on skill.id = link.skill_id
    join public.curriculum_skills prerequisite on prerequisite.id = link.prerequisite_skill_id
    where skill.skill_code = 'G11-PROB-TREE-CONTINGENCY'
      and prerequisite.skill_code = 'G9-PROB-TREE-RELATIVE-FREQ'
  ),
  'a Grade 11 tree/contingency weakness can trace to its Grade 9 tree-diagram foundation'
);

select ok(
  exists (
    select 1
    from public.skill_prerequisites link
    join public.curriculum_skills skill on skill.id = link.skill_id
    join public.curriculum_skills prerequisite on prerequisite.id = link.prerequisite_skill_id
    where skill.skill_code = 'G12-TRIG-EQUATIONS'
      and prerequisite.skill_code = 'G11-TRIG-GENERAL-SOLUTIONS'
  ),
  'Grade 12 trigonometric equations trace to Grade 11 general-solution fluency'
);

select ok(
  exists (
    select 1
    from public.skill_prerequisites link
    join public.curriculum_skills skill on skill.id = link.skill_id
    join public.curriculum_skills prerequisite on prerequisite.id = link.prerequisite_skill_id
    where skill.skill_code = 'G12-PROB-CONTINGENCY'
      and prerequisite.skill_code = 'G11-PROB-TREE-CONTINGENCY'
  ),
  'Grade 12 contingency probability traces to the Grade 11 compound-probability family'
);

select ok(
  not exists (
    with recursive paths(root_id, current_id, visited_ids) as (
      select link.skill_id, link.prerequisite_skill_id, array[link.skill_id, link.prerequisite_skill_id]
      from public.skill_prerequisites link
      union all
      select paths.root_id, link.prerequisite_skill_id, paths.visited_ids || link.prerequisite_skill_id
      from paths
      join public.skill_prerequisites link on link.skill_id = paths.current_id
      where not link.prerequisite_skill_id = any(paths.visited_ids)
    )
    select 1
    from paths
    join public.skill_prerequisites link on link.skill_id = paths.current_id
    where link.prerequisite_skill_id = any(paths.visited_ids)
  ),
  'the prerequisite graph has no circular teaching dependency'
);

select * from finish();
rollback;
