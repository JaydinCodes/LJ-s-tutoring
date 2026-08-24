-- ATP alignment supplements the textbook map with explicitly scheduled and
-- assessed question forms. These remain teacher_review until a content owner
-- is appointed.
with subject_row as (
  select id from public.subjects where name = 'Mathematics' and grade = 'Grade 12' and curriculum = 'CAPS' limit 1
), skills(skill_code, strand, topic, title, description, cognitive_level, source_reference) as (
  values
  ('G12-FUNC-FORMAL-DEFINITION','Functions','Functions and relations','Use the formal definition of a function','Identify one output for each permitted input from notation, mappings and graphs.','reasoning','ATP Term 1 Functions item 1'),
  ('G12-FUNC-AVERAGE-GRADIENT','Functions','Function characteristics','Determine average gradient','Calculate and interpret average rate of change between two points on a function.','application','ATP Term 1 Functions item 3'),
  ('G12-FUNC-LOG-GRAPH-BASE','Functions','Logarithmic functions','Compare logarithm graphs by base','Distinguish 0 < b < 1 from b > 1 using monotonicity, domain and asymptotes.','reasoning','ATP Term 1 Functions item 6'),
  ('G12-FIN-SIMPLE-GROWTH-DECAY','Finance','Growth and decay','Model simple growth and decay','Use A = P(1 plus/minus in), including straight-line depreciation.','application','ATP Term 3 Finance item 1'),
  ('G12-FIN-COMPOUND-GROWTH-DECAY','Finance','Growth and decay','Model compound growth and decay','Use A = P(1 plus/minus i)^n, including reducing-balance depreciation.','application','ATP Term 3 Finance item 1'),
  ('G12-TRIG-SINE-COS-AREA-PROOF','Trigonometry','Sine, cosine and area rules','Prove or select trigonometric rules','Use the sine, cosine and area rules with valid diagram reasoning.','reasoning','ATP Term 1 Trigonometry item 2'),
  ('G12-TRIG-2D-3D-MODELLING','Trigonometry','Applications','Solve two- and three-dimensional trigonometry problems','Represent a 3D configuration correctly before applying trigonometric rules.','application','ATP Term 1 Trigonometry item 3'),
  ('G12-ANALYTIC-INCLINATION','Analytical geometry','Lines','Use line inclination','Relate gradient m = tan(theta) to the correct angle in 0 to 180 degrees.','application','ATP Term 2 Analytical geometry item 1'),
  ('G12-CALC-MOTION-RATES','Differential calculus','Applications','Solve motion and rate-of-change problems','Use derivatives and units to interpret velocity, acceleration or changing quantities.','application','ATP Term 2 Calculus item 9'),
  ('G12-EUCLID-PARALLEL-PROP','Euclidean geometry','Similarity','Prove proportional division by a parallel line','Use the parallel-line theorem and its converse/midpoint special case.','reasoning','ATP Term 2 Euclidean geometry item 2'),
  ('G12-EUCLID-SIMILAR-TESTS','Euclidean geometry','Similarity','Prove triangle similarity from conditions','Use equiangular or proportional-side conditions with correspondence.','reasoning','ATP Term 2 Euclidean geometry item 2'),
  ('G12-EUCLID-PYTHAG-PROOF','Euclidean geometry','Pythagorean theorem','Prove Pythagoras using similarity','Structure a similarity proof of the Pythagorean theorem.','reasoning','ATP Term 2 Euclidean geometry item 2'),
  ('G12-STATS-DISPLAYS','Statistics','Data displays','Interpret histograms, frequency polygons and ogives','Extract and compare distribution information from each display type.','reasoning','ATP Term 3 Statistics item 1'),
  ('G12-STATS-SKEW-OUTLIERS','Statistics','Distribution','Interpret skewness and outliers','Use summary statistics and graphs to justify a context-aware conclusion.','reasoning','ATP Term 3 Statistics item 1-2'),
  ('G12-PROB-THREE-EVENT-VENN','Probability','Venn diagrams','Solve three-event Venn problems','Allocate all regions and apply inclusion-exclusion in a sample space.','application','ATP Term 3 Probability item 1'),
  ('G12-PROB-CONTINGENCY','Probability','Contingency tables','Solve two-way contingency-table probability','Use marginal, joint and conditional frequencies/probabilities.','application','ATP Term 3 Probability item 3')
), inserted as (
  insert into public.curriculum_skills (subject_id, grade, curriculum, strand, topic, skill_code, title, description, cognitive_level, review_status)
  select subject_row.id, 'Grade 12', 'CAPS', strand, topic, skill_code, title, description, cognitive_level, 'teacher_review' from skills cross join subject_row
  on conflict (skill_code) do update set strand = excluded.strand, topic = excluded.topic, title = excluded.title, description = excluded.description, cognitive_level = excluded.cognitive_level, updated_at = now()
  returning id, skill_code, title, description, cognitive_level
)
insert into public.curriculum_question_types (skill_id, question_type_code, title, description, representation, cognitive_demand, source_reference)
select inserted.id, inserted.skill_code || '-FORM', inserted.title || ' question family', inserted.description,
  case when inserted.cognitive_level = 'reasoning' then 'proof' when inserted.cognitive_level = 'application' then 'word_problem' else 'symbolic' end,
  case inserted.cognitive_level when 'reasoning' then 'reasoning' when 'application' then 'application' when 'procedure' then 'procedure' else 'recall' end,
  skills.source_reference
from inserted join skills using (skill_code)
on conflict (question_type_code) do update set title = excluded.title, description = excluded.description, representation = excluded.representation, cognitive_demand = excluded.cognitive_demand, source_reference = excluded.source_reference, updated_at = now();
