-- Grades 8–11 Mathematics prerequisite spine.
--
-- These atomic, question-family skills are distilled from the supplied CAPS
-- ATPs and learner textbooks. They deliberately remain in teacher_review:
-- taxonomy can be safely mapped now, but no learner activity is released and
-- no evidence may be recorded until a designated curriculum owner approves it.

insert into public.subjects (name, grade, curriculum)
values
  ('Mathematics', 'Grade 8', 'CAPS'),
  ('Mathematics', 'Grade 9', 'CAPS'),
  ('Mathematics', 'Grade 10', 'CAPS'),
  ('Mathematics', 'Grade 11', 'CAPS')
on conflict (name, grade, curriculum) do nothing;

with skills(grade, skill_code, strand, topic, title, description, cognitive_level, source_reference) as (
  values
    -- Grade 8: secure the numerical, algebraic and graphical language that
    -- makes later secondary Mathematics accessible.
    ('Grade 8','G8-NUM-WHOLE-PROPERTIES','Numbers','Whole numbers','Use whole-number properties and factors','Apply properties, prime factorisation, HCF and LCM in calculations.','procedure','Grade 8 ATP 2026 Term 1: Whole numbers'),
    ('Grade 8','G8-NUM-INTEGERS-OPERATIONS','Numbers','Integers','Calculate with integers and roots','Use all four operations, squares, cubes, square roots and cube roots of integers.','procedure','Grade 8 ATP 2026 Term 1: Integers'),
    ('Grade 8','G8-NUM-FRACTIONS-OPERATIONS','Numbers','Common fractions','Calculate with common fractions','Work accurately with mixed numbers, fraction operations and roots.','procedure','Grade 8 ATP 2026 Term 1: Common fractions'),
    ('Grade 8','G8-NUM-DECIMALS-OPERATIONS','Numbers','Decimal fractions','Calculate with decimal fractions','Order, round, multiply, divide and use powers and roots of decimals.','procedure','Grade 8 ATP 2026 Term 1: Decimal fractions'),
    ('Grade 8','G8-EXP-LAWS-SCI','Algebra','Exponents','Use introductory exponent laws and scientific notation','Represent integers and positive powers in exponential and scientific notation, then apply the specified laws.','procedure','Grade 8 ATP 2026 Term 2: Exponents'),
    ('Grade 8','G8-PAT-REPRESENT-RULE','Patterns','Numeric and geometric patterns','Represent a pattern and state its rule','Move between a diagram, table and algebraic rule for a non-trivial pattern.','reasoning','Grade 8 ATP 2026 Term 1: Numeric and geometric patterns'),
    ('Grade 8','G8-ALG-LANGUAGE-TERMS','Algebra','Algebraic expressions','Interpret algebraic language and terms','Identify variables, constants, coefficients, exponents, and like or unlike terms.','recall','Grade 8 ATP 2026 Term 2: Algebraic expressions'),
    ('Grade 8','G8-ALG-SIMPLIFY-LIKE-TERMS','Algebra','Algebraic expressions','Simplify like terms','Use algebra conventions and combine like terms without changing meaning.','procedure','Grade 8 learner textbook A: Chapter 6'),
    ('Grade 8','G8-EQ-LINEAR-INVERSES','Algebra','Algebraic equations','Solve a one-step or simple linear equation','Model a situation and solve using additive and multiplicative inverses.','procedure','Grade 8 ATP 2026 Term 2: Algebraic equations'),
    ('Grade 8','G8-FUNC-INPUT-OUTPUT','Functions','Functions and relationships','Find input, output or a rule','Use flow diagrams, tables, formulae and equations to complete a relationship.','procedure','Grade 8 ATP 2026 Term 2: Functions and relationships'),
    ('Grade 8','G8-GRAPH-GLOBAL-FEATURES','Functions','Graphs','Interpret global graph features','Identify linear or non-linear, constant, increasing, decreasing, maximum/minimum, discrete and continuous features.','reasoning','Grade 8 ATP 2026 Term 2: Graphs'),
    ('Grade 8','G8-GRAPH-PLOT-ORDERED-PAIRS','Functions','Graphs','Plot ordered pairs on the Cartesian plane','Use a table of values to draw and read a graph accurately.','procedure','Grade 8 ATP 2026 Term 2: Graphs'),
    ('Grade 8','G8-GEOM-LINE-ANGLES','Geometry','Geometry of straight lines','Solve angle relationships on lines','Use relationships formed by perpendicular, intersecting and parallel lines.','procedure','Grade 8 ATP 2026 Term 3: Geometry of straight lines'),
    ('Grade 8','G8-GEOM-TRIANGLE-PROPERTIES','Geometry','Geometry of 2D shapes','Classify triangles and use their angle properties','Use side/angle definitions, interior-angle sum, equilateral and isosceles properties.','reasoning','Grade 8 ATP 2026 Term 3: Geometry of 2D shapes'),
    ('Grade 8','G8-MEAS-AREA-VOLUME-SCALE','Measurement','Measurement','Calculate measurement and scale quantities','Apply appropriate perimeter, area, volume and conversion formulae in context.','application','Grade 8 learner textbook B: Measurement chapters'),
    ('Grade 8','G8-DATA-COLLECT-SAMPLE','Statistics','Data handling','Design a data collection and select a sample','Distinguish a population from a sample and choose a sensible collection method.','reasoning','Grade 8 ATP 2026 Term 3: Data handling'),
    ('Grade 8','G8-DATA-CENTRAL-TENDENCY','Statistics','Data handling','Organise data and calculate centre','Use tally tables, stem-and-leaf displays, intervals, mean, median and mode.','procedure','Grade 8 ATP 2026 Term 3: Data handling'),
    ('Grade 8','G8-PROB-SIMPLE-OUTCOMES','Probability','Probability','Calculate simple equally likely probabilities','Identify a sample space and determine probabilities for simple events.','application','Grade 8 learner textbook B: Probability chapters'),

    -- Grade 9: move from arithmetic structure to algebraic factorisation,
    -- linear graphs and compound probability representations.
    ('Grade 9','G9-NUM-REAL-IRRATIONAL','Numbers','Real number system','Classify real and irrational numbers','Distinguish natural, whole, integer, rational and irrational numbers.','reasoning','Grade 9 ATP 2026 Term 1: Whole numbers'),
    ('Grade 9','G9-EXP-NEGATIVE-SCI','Algebra','Exponents','Use negative exponents and scientific notation','Apply exponent laws including negative powers and scientific notation.','procedure','Grade 9 ATP 2026 Term 1: Exponents'),
    ('Grade 9','G9-PAT-GENERAL-RULE','Patterns','Numeric and geometric patterns','Justify a general pattern rule','Describe and justify a rule from diagrams, tables or algebraic representations.','reasoning','Grade 9 ATP 2026 Term 1: Patterns'),
    ('Grade 9','G9-FUNC-EQUIVALENT-FORMS','Functions','Functions and relationships','Match equivalent representations of a relationship','Move between verbal rules, tables, formulae, equations and Cartesian graphs.','reasoning','Grade 9 ATP 2026 Term 1: Functions and relationships'),
    ('Grade 9','G9-ALG-EXPAND-SIMPLIFY','Algebra','Algebraic expressions','Expand and simplify algebraic expressions','Distribute, combine terms, divide permitted algebraic forms and substitute values.','procedure','Grade 9 ATP 2026 Term 2: Algebraic expressions'),
    ('Grade 9','G9-ALG-FACTORISE-COMMON','Algebra','Algebraic expressions','Factorise by a common factor','Reverse expansion to expose a common numerical or algebraic factor.','procedure','Grade 9 ATP 2026 Term 2: Algebraic expressions'),
    ('Grade 9','G9-EQ-PRODUCT-ZERO','Algebra','Algebraic equations','Solve a factorised equation using the zero-product principle','Factorise where needed and solve equations in product form.','procedure','Grade 9 ATP 2026 Term 2: Algebraic equations'),
    ('Grade 9','G9-GRAPH-LINEAR-FEATURES','Functions','Graphs','Interpret intercepts and gradient','Read x- and y-intercepts and gradient from a linear graph.','reasoning','Grade 9 ATP 2026 Term 2: Graphs'),
    ('Grade 9','G9-GRAPH-LINEAR-DRAW','Functions','Graphs','Draw a linear graph from an equation or table','Choose values, plot accurately and show the linear relationship.','procedure','Grade 9 ATP 2026 Term 2: Graphs'),
    ('Grade 9','G9-GEOM-LINES-REASONS','Geometry','Geometry of straight lines','Use line-angle relationships with reasons','Solve line-angle problems and state the geometric reason.','reasoning','Grade 9 ATP 2026 Term 2: Geometry of straight lines'),
    ('Grade 9','G9-GEOM-TRIANGLE-EXTERIOR','Geometry','Geometry of 2D shapes','Use triangle interior and exterior angles','Use the exterior-angle relationship and triangle properties in diagrams.','procedure','Grade 9 ATP 2026 Term 3: Geometry of 2D shapes'),
    ('Grade 9','G9-MEAS-POLYGON-CIRCLE-SCALE','Measurement','Area and perimeter','Calculate polygon and circle measurement with scale','Select formulae, convert SI units and reason about scaled dimensions.','application','Grade 9 ATP 2026 Term 3: Area and perimeter'),
    ('Grade 9','G9-DATA-DISPERSION-OUTLIERS','Statistics','Data handling','Summarise spread and identify outliers','Use centre, extremes, outliers and an appropriate organisation of data.','reasoning','Grade 9 ATP 2026 Term 3: Data handling'),
    ('Grade 9','G9-PROB-TWO-WAY-TABLE','Probability','Probability','Solve compound probability using a two-way table','Populate a two-way table and determine event probabilities.','application','Grade 9 ATP 2026 Term 3: Probability'),
    ('Grade 9','G9-PROB-TREE-RELATIVE-FREQ','Probability','Probability','Use a tree diagram and compare relative frequency','Represent compound outcomes, calculate probability and explain experimental variation.','application','Grade 9 ATP 2026 Term 3: Probability'),

    -- Grade 10: first FET year; separate the different algebra, function,
    -- trigonometry and probability families rather than treating each topic as one mark.
    ('Grade 10','G10-ALG-REAL-SURDS','Algebra','Algebraic expressions','Classify real numbers and estimate surds','Work with rational/irrational values, rounding and surd estimates.','procedure','Grade 10 learner textbook: 1.1–1.4'),
    ('Grade 10','G10-ALG-EXPAND-PRODUCTS','Algebra','Algebraic expressions','Expand algebraic products','Multiply monomials, binomials and trinomials accurately.','procedure','Grade 10 ATP Term 1: Algebraic expressions'),
    ('Grade 10','G10-ALG-FACTORISE-QUADRATIC','Algebra','Algebraic expressions','Factorise quadratic and cubic forms','Use common factors, grouping, trinomials and sum/difference of cubes.','procedure','Grade 10 ATP Term 1: Algebraic expressions'),
    ('Grade 10','G10-ALG-FRACTIONS','Algebra','Algebraic expressions','Simplify algebraic fractions','Factorise and cancel only valid common factors.','procedure','Grade 10 learner textbook: 1.7'),
    ('Grade 10','G10-EQ-LINEAR-LITERAL-INEQ','Algebra','Equations and inequalities','Solve linear, literal and inequality problems','Rearrange equations and represent linear-inequality solutions correctly.','procedure','Grade 10 ATP Term 1: Equations and inequalities'),
    ('Grade 10','G10-EQ-QUADRATIC','Algebra','Equations and inequalities','Solve a quadratic equation','Use factorisation, the quadratic formula or a suitable graph.','procedure','Grade 10 ATP Term 1: Equations and inequalities'),
    ('Grade 10','G10-EQ-SIMULTANEOUS','Algebra','Equations and inequalities','Solve simultaneous equations','Find the intersection of two linear equations or a linear and quadratic pair.','application','Grade 10 ATP Term 1: Equations and inequalities'),
    ('Grade 10','G10-EXP-RATIONAL-EXPONENTIAL','Algebra','Exponents','Use rational exponents and solve exponential equations','Apply exponent laws to simplify and solve exponential forms.','procedure','Grade 10 learner textbook: Chapter 3'),
    ('Grade 10','G10-PAT-LINEAR-GENERAL','Patterns','Number patterns','Model a linear number pattern','Describe terms and derive a general linear term.','procedure','Grade 10 ATP Term 4: Number patterns'),
    ('Grade 10','G10-FUNC-LINEAR','Functions','Functions','Analyse a linear function','Interpret gradient, intercepts, domain/range and transformations.','application','Grade 10 learner textbook: 5.2'),
    ('Grade 10','G10-FUNC-QUADRATIC','Functions','Functions','Analyse a quadratic function','Use roots, turning point, axis, sign and transformations.','application','Grade 10 learner textbook: 5.3'),
    ('Grade 10','G10-FUNC-HYPERBOLIC','Functions','Functions','Analyse a hyperbolic function','Interpret asymptotes, branches, intercepts and transformations.','application','Grade 10 learner textbook: 5.4'),
    ('Grade 10','G10-FUNC-EXPONENTIAL','Functions','Functions','Analyse an exponential function','Interpret base, intercept, asymptote and transformations.','application','Grade 10 learner textbook: 5.5'),
    ('Grade 10','G10-FUNC-TRIG-GRAPHS','Functions','Functions','Analyse trigonometric graphs','Interpret period, amplitude, intercepts and transformations of sine, cosine and tangent.','application','Grade 10 ATP Term 2: Functions'),
    ('Grade 10','G10-FIN-SIMPLE-COMPOUND','Finance','Finance and growth','Calculate simple and compound interest','Model growth using the appropriate interest formula and interpret a financial context.','application','Grade 10 ATP Term 3: Finance, growth and decay'),
    ('Grade 10','G10-TRIG-RATIOS-SPECIAL','Trigonometry','Trigonometry','Use trig ratios and exact special-angle values','Select a ratio in a right triangle and use exact values in the Cartesian plane.','procedure','Grade 10 ATP Term 1: Trigonometry'),
    ('Grade 10','G10-TRIG-EQUATIONS-2D','Trigonometry','Trigonometry','Solve simple trigonometric equations and 2D problems','Find valid angle solutions and model a right-triangle context.','application','Grade 10 ATP Term 3: Trigonometry'),
    ('Grade 10','G10-ANALYTIC-DIST-GRAD-MID','Analytical geometry','Analytical geometry','Use distance, gradient and midpoint','Calculate coordinate-geometry line measures accurately.','procedure','Grade 10 ATP Term 2: Analytical geometry'),
    ('Grade 10','G10-STATS-GROUPED-DISPERSION','Statistics','Statistics','Summarise grouped data and dispersion','Use grouped displays, centre, range and other appropriate spread measures.','procedure','Grade 10 ATP Term 3: Statistics'),
    ('Grade 10','G10-PROB-VENN-NOTATION','Probability','Probability','Represent events with Venn diagrams and notation','Use union, intersection, complement and mutually exclusive event language.','procedure','Grade 10 learner textbook: 10.3–10.6'),
    ('Grade 10','G10-PROB-IDENTITIES','Probability','Probability','Apply basic probability identities','Use complement and addition reasoning to calculate event probabilities.','application','Grade 10 learner textbook: 10.5–10.7'),
    ('Grade 10','G10-EUCLID-QUADS-PROOF','Euclidean geometry','Euclidean geometry','Prove properties of quadrilaterals','Use definitions and known properties to structure a valid proof.','reasoning','Grade 10 ATP Term 2: Euclidean geometry'),
    ('Grade 10','G10-EUCLID-MIDPOINT','Euclidean geometry','Euclidean geometry','Apply the midpoint theorem','Recognise and use the midpoint theorem in an appropriate triangle configuration.','reasoning','Grade 10 learner textbook: 11.2'),
    ('Grade 10','G10-MEAS-2D-3D-SCALE','Measurement','Measurement','Solve 2D, 3D and scale measurement problems','Select correct area, surface-area or volume formulae and reason about a scale factor.','application','Grade 10 learner textbook: Chapter 12'),

    -- Grade 11: the direct prerequisite bridge into Grade 12.
    ('Grade 11','G11-EXP-SURDS-RATIONAL','Algebra','Exponents and surds','Simplify surds and use rational exponents','Apply exponent laws to rational powers and simplify valid surd forms.','procedure','Grade 11 ATP Term 1: Exponents and surds'),
    ('Grade 11','G11-EXP-SURD-EQUATIONS','Algebra','Exponents and surds','Solve equations involving surds','Isolate a surd, solve and reject invalid roots.','procedure','Grade 11 learner textbook: Chapter 1'),
    ('Grade 11','G11-EQ-COMPLETE-SQUARE','Algebra','Equations and inequalities','Complete the square for a quadratic','Rewrite a quadratic to reveal turning-point form or solve it.','procedure','Grade 11 ATP Term 1: Equations and inequalities'),
    ('Grade 11','G11-EQ-NATURE-ROOTS','Algebra','Equations and inequalities','Determine the nature of quadratic roots','Use discriminant reasoning to classify the roots.','reasoning','Grade 11 ATP Term 1: Equations and inequalities'),
    ('Grade 11','G11-EQ-QUAD-INEQUALITIES','Algebra','Equations and inequalities','Solve a quadratic inequality','Use roots and sign regions to state a valid interval solution.','application','Grade 11 ATP Term 1: Equations and inequalities'),
    ('Grade 11','G11-EQ-SIMULTANEOUS-LINQUAD','Algebra','Equations and inequalities','Solve simultaneous linear–quadratic equations','Substitute or graph to find and interpret intersections.','application','Grade 11 ATP Term 1: Equations and inequalities'),
    ('Grade 11','G11-PAT-QUADRATIC-SEQUENCE','Patterns','Number patterns','Model a quadratic sequence','Use first and second differences to determine a quadratic term rule.','procedure','Grade 11 ATP Term 4: Number patterns'),
    ('Grade 11','G11-FUNC-QUADRATIC-TRANSFORM','Functions','Functions','Transform and analyse quadratic functions','Relate algebraic parameters to roots, turning point, axis and graph movement.','application','Grade 11 ATP Term 2: Functions'),
    ('Grade 11','G11-FUNC-HYPERBOLIC-EXP','Functions','Functions','Transform hyperbolic and exponential functions','Use asymptotes, intercepts, base and transformations to analyse each family.','application','Grade 11 ATP Term 2: Functions'),
    ('Grade 11','G11-FUNC-TRIG-TRANSFORM','Functions','Functions','Transform trigonometric functions','Analyse period, amplitude, shifts, intercepts and graph shape.','application','Grade 11 ATP Term 2: Functions'),
    ('Grade 11','G11-TRIG-IDENTITIES-REDUCTION','Trigonometry','Trigonometry','Use identities and reduction formulae','Simplify expressions with core identities, special angles and reduction.','procedure','Grade 11 ATP Term 1: Trigonometry'),
    ('Grade 11','G11-TRIG-GENERAL-SOLUTIONS','Trigonometry','Trigonometry','Solve trigonometric equations with general solutions','Find all valid solutions in a stated interval or general form.','application','Grade 11 ATP Term 1: Trigonometry'),
    ('Grade 11','G11-TRIG-SINE-COS-AREA','Trigonometry','Trigonometry','Use sine rule, cosine rule and area rule','Model a non-right triangle and choose the valid rule.','application','Grade 11 ATP Term 3: Trigonometry'),
    ('Grade 11','G11-FIN-GROWTH-DECAY','Finance','Finance, growth and decay','Model financial growth and decay','Use simple/compound growth, depreciation and timelines accurately.','application','Grade 11 ATP Term 3: Finance, growth and decay'),
    ('Grade 11','G11-FIN-NOMINAL-EFFECTIVE','Finance','Finance, growth and decay','Compare nominal and effective rates','Align compounding periods and interpret nominal/effective interest.','application','Grade 11 ATP Term 3: Finance, growth and decay'),
    ('Grade 11','G11-ANALYTIC-LINE-INCLINATION','Analytical geometry','Analytical geometry','Find line equations and inclination','Use gradient, inclination, parallel and perpendicular relationships.','application','Grade 11 ATP Term 2: Analytical geometry'),
    ('Grade 11','G11-EUCLID-CIRCLE-THEOREMS','Euclidean geometry','Euclidean geometry','Apply circle theorems with reasons','Select valid circle theorems and state sufficient geometric reasons.','reasoning','Grade 11 ATP Term 2: Euclidean geometry'),
    ('Grade 11','G11-EUCLID-CIRCLE-PROOFS','Euclidean geometry','Euclidean geometry','Structure a circle-geometry proof','Build a coherent theorem-based proof from a diagram.','reasoning','Grade 11 learner textbook: Chapter 8'),
    ('Grade 11','G11-MEAS-SURFACE-VOLUME-SCALE','Measurement','Measurement','Solve surface area, volume and scale problems','Model composite solids and dimension changes using correct units.','application','Grade 11 ATP Term 4: Measurement'),
    ('Grade 11','G11-STATS-HIST-OGIVE','Statistics','Statistics','Interpret histograms and ogives','Read and compare grouped distributions from histograms and cumulative-frequency graphs.','reasoning','Grade 11 ATP Term 3: Statistics'),
    ('Grade 11','G11-STATS-VARIANCE-SKEW','Statistics','Statistics','Calculate variance and interpret skewness','Use measures of spread, shape and outliers to justify a conclusion.','reasoning','Grade 11 ATP Term 3: Statistics'),
    ('Grade 11','G11-PROB-VENN-INDEPENDENCE','Probability','Probability','Use Venn diagrams and test independence','Allocate events in a Venn diagram and distinguish independent/dependent events.','application','Grade 11 ATP Term 3: Probability'),
    ('Grade 11','G11-PROB-TREE-CONTINGENCY','Probability','Probability','Solve tree and contingency-table questions','Use conditional branches and two-way frequencies accurately.','application','Grade 11 ATP Term 3: Probability'),
    ('Grade 11','G11-LP-CONSTRAINTS','Applications','Linear programming','Model constraints and optimise a linear-programming problem','Translate a context into inequalities, feasible region and an objective decision.','application','Grade 11 learner textbook: Chapter 12')
), inserted as (
  insert into public.curriculum_skills (subject_id, grade, curriculum, strand, topic, skill_code, title, description, cognitive_level, review_status)
  select subject.id, skills.grade, 'CAPS', skills.strand, skills.topic, skills.skill_code, skills.title, skills.description, skills.cognitive_level, 'teacher_review'
  from skills
  join public.subjects subject on subject.name = 'Mathematics' and subject.grade = skills.grade and subject.curriculum = 'CAPS'
  on conflict (skill_code) do update set
    strand = excluded.strand,
    topic = excluded.topic,
    title = excluded.title,
    description = excluded.description,
    cognitive_level = excluded.cognitive_level,
    updated_at = now()
  returning id, skill_code, title, description, cognitive_level
)
insert into public.curriculum_question_types (skill_id, question_type_code, title, description, representation, cognitive_demand, source_reference)
select inserted.id, inserted.skill_code || '-FORM', inserted.title || ' question family', inserted.description,
  case inserted.cognitive_level
    when 'reasoning' then 'proof'
    when 'application' then 'word_problem'
    when 'recall' then 'numeric'
    else 'symbolic'
  end,
  case inserted.cognitive_level
    when 'reasoning' then 'reasoning'
    when 'application' then 'application'
    when 'procedure' then 'procedure'
    else 'recall'
  end,
  skills.source_reference
from inserted
join skills using (skill_code)
on conflict (question_type_code) do update set
  title = excluded.title,
  description = excluded.description,
  representation = excluded.representation,
  cognitive_demand = excluded.cognitive_demand,
  source_reference = excluded.source_reference,
  updated_at = now();

-- A prerequisite is intentionally a directional teaching dependency. These
-- links let a weak high-grade question family point to the most specific
-- foundation, without showing learners any fixed "level" label.
with links(skill_code, prerequisite_skill_code, strength) as (
  values
    ('G9-EXP-NEGATIVE-SCI','G8-EXP-LAWS-SCI',1.00),
    ('G9-PAT-GENERAL-RULE','G8-PAT-REPRESENT-RULE',0.90),
    ('G9-FUNC-EQUIVALENT-FORMS','G8-FUNC-INPUT-OUTPUT',1.00),
    ('G9-ALG-EXPAND-SIMPLIFY','G8-ALG-SIMPLIFY-LIKE-TERMS',1.00),
    ('G9-ALG-FACTORISE-COMMON','G8-ALG-SIMPLIFY-LIKE-TERMS',0.90),
    ('G9-EQ-PRODUCT-ZERO','G8-EQ-LINEAR-INVERSES',0.85),
    ('G9-GRAPH-LINEAR-FEATURES','G8-GRAPH-GLOBAL-FEATURES',0.85),
    ('G9-GRAPH-LINEAR-DRAW','G8-GRAPH-PLOT-ORDERED-PAIRS',1.00),
    ('G9-GEOM-LINES-REASONS','G8-GEOM-LINE-ANGLES',1.00),
    ('G9-GEOM-TRIANGLE-EXTERIOR','G8-GEOM-TRIANGLE-PROPERTIES',1.00),
    ('G9-DATA-DISPERSION-OUTLIERS','G8-DATA-CENTRAL-TENDENCY',0.90),
    ('G9-PROB-TWO-WAY-TABLE','G8-PROB-SIMPLE-OUTCOMES',0.85),
    ('G9-PROB-TREE-RELATIVE-FREQ','G8-PROB-SIMPLE-OUTCOMES',0.85),

    ('G10-ALG-REAL-SURDS','G9-NUM-REAL-IRRATIONAL',1.00),
    ('G10-ALG-EXPAND-PRODUCTS','G9-ALG-EXPAND-SIMPLIFY',1.00),
    ('G10-ALG-FACTORISE-QUADRATIC','G9-ALG-FACTORISE-COMMON',1.00),
    ('G10-ALG-FRACTIONS','G10-ALG-FACTORISE-QUADRATIC',0.95),
    ('G10-EQ-LINEAR-LITERAL-INEQ','G8-EQ-LINEAR-INVERSES',1.00),
    ('G10-EQ-QUADRATIC','G9-EQ-PRODUCT-ZERO',1.00),
    ('G10-EQ-SIMULTANEOUS','G10-EQ-QUADRATIC',0.90),
    ('G10-EXP-RATIONAL-EXPONENTIAL','G9-EXP-NEGATIVE-SCI',1.00),
    ('G10-PAT-LINEAR-GENERAL','G9-PAT-GENERAL-RULE',0.90),
    ('G10-FUNC-LINEAR','G9-GRAPH-LINEAR-FEATURES',1.00),
    ('G10-FUNC-QUADRATIC','G10-EQ-QUADRATIC',0.90),
    ('G10-FUNC-HYPERBOLIC','G9-FUNC-EQUIVALENT-FORMS',0.80),
    ('G10-FUNC-EXPONENTIAL','G10-EXP-RATIONAL-EXPONENTIAL',0.90),
    ('G10-FUNC-TRIG-GRAPHS','G10-TRIG-RATIOS-SPECIAL',0.80),
    ('G10-TRIG-RATIOS-SPECIAL','G9-GEOM-TRIANGLE-EXTERIOR',0.70),
    ('G10-TRIG-EQUATIONS-2D','G10-TRIG-RATIOS-SPECIAL',1.00),
    ('G10-ANALYTIC-DIST-GRAD-MID','G9-GRAPH-LINEAR-DRAW',0.85),
    ('G10-STATS-GROUPED-DISPERSION','G9-DATA-DISPERSION-OUTLIERS',0.90),
    ('G10-PROB-VENN-NOTATION','G9-PROB-TWO-WAY-TABLE',0.85),
    ('G10-PROB-IDENTITIES','G10-PROB-VENN-NOTATION',1.00),
    ('G10-EUCLID-QUADS-PROOF','G9-GEOM-LINES-REASONS',0.90),
    ('G10-EUCLID-MIDPOINT','G9-GEOM-TRIANGLE-EXTERIOR',0.85),
    ('G10-MEAS-2D-3D-SCALE','G9-MEAS-POLYGON-CIRCLE-SCALE',0.90),

    ('G11-EXP-SURDS-RATIONAL','G10-EXP-RATIONAL-EXPONENTIAL',1.00),
    ('G11-EXP-SURD-EQUATIONS','G11-EXP-SURDS-RATIONAL',1.00),
    ('G11-EQ-COMPLETE-SQUARE','G10-EQ-QUADRATIC',1.00),
    ('G11-EQ-NATURE-ROOTS','G10-EQ-QUADRATIC',1.00),
    ('G11-EQ-QUAD-INEQUALITIES','G10-EQ-QUADRATIC',1.00),
    ('G11-EQ-SIMULTANEOUS-LINQUAD','G10-EQ-SIMULTANEOUS',1.00),
    ('G11-PAT-QUADRATIC-SEQUENCE','G10-PAT-LINEAR-GENERAL',0.80),
    ('G11-FUNC-QUADRATIC-TRANSFORM','G10-FUNC-QUADRATIC',1.00),
    ('G11-FUNC-HYPERBOLIC-EXP','G10-FUNC-HYPERBOLIC',0.85),
    ('G11-FUNC-HYPERBOLIC-EXP','G10-FUNC-EXPONENTIAL',0.90),
    ('G11-FUNC-TRIG-TRANSFORM','G10-FUNC-TRIG-GRAPHS',1.00),
    ('G11-TRIG-IDENTITIES-REDUCTION','G10-TRIG-RATIOS-SPECIAL',1.00),
    ('G11-TRIG-GENERAL-SOLUTIONS','G10-TRIG-EQUATIONS-2D',1.00),
    ('G11-TRIG-SINE-COS-AREA','G10-TRIG-EQUATIONS-2D',0.90),
    ('G11-FIN-GROWTH-DECAY','G10-FIN-SIMPLE-COMPOUND',1.00),
    ('G11-FIN-NOMINAL-EFFECTIVE','G11-FIN-GROWTH-DECAY',1.00),
    ('G11-ANALYTIC-LINE-INCLINATION','G10-ANALYTIC-DIST-GRAD-MID',1.00),
    ('G11-EUCLID-CIRCLE-THEOREMS','G10-EUCLID-QUADS-PROOF',0.80),
    ('G11-EUCLID-CIRCLE-PROOFS','G11-EUCLID-CIRCLE-THEOREMS',1.00),
    ('G11-MEAS-SURFACE-VOLUME-SCALE','G10-MEAS-2D-3D-SCALE',1.00),
    ('G11-STATS-HIST-OGIVE','G10-STATS-GROUPED-DISPERSION',1.00),
    ('G11-STATS-VARIANCE-SKEW','G10-STATS-GROUPED-DISPERSION',1.00),
    ('G11-PROB-VENN-INDEPENDENCE','G10-PROB-IDENTITIES',0.90),
    ('G11-PROB-TREE-CONTINGENCY','G9-PROB-TREE-RELATIVE-FREQ',1.00),

    ('G12-SEQ-QUAD-DIFF','G11-PAT-QUADRATIC-SEQUENCE',1.00),
    ('G12-SEQ-QUAD-NTERM','G11-PAT-QUADRATIC-SEQUENCE',1.00),
    ('G12-FUNC-QUAD-FEATURES','G11-FUNC-QUADRATIC-TRANSFORM',1.00),
    ('G12-FUNC-EXP-GRAPH','G11-FUNC-HYPERBOLIC-EXP',0.90),
    ('G12-FUNC-LINEAR-FEATURES','G10-FUNC-LINEAR',1.00),
    ('G12-POLY-QUAD-REVISION','G10-ALG-FACTORISE-QUADRATIC',1.00),
    ('G12-POLY-CUBIC-SOLVE','G10-EQ-QUADRATIC',0.90),
    ('G12-CALC-RULES','G11-FUNC-QUADRATIC-TRANSFORM',0.80),
    ('G12-CALC-TANGENT-NORMAL','G11-ANALYTIC-LINE-INCLINATION',1.00),
    ('G12-TRIG-IDENTITIES-CORE','G11-TRIG-IDENTITIES-REDUCTION',1.00),
    ('G12-TRIG-EQUATIONS','G11-TRIG-GENERAL-SOLUTIONS',1.00),
    ('G12-TRIG-SINE-COS-AREA-PROOF','G11-TRIG-SINE-COS-AREA',1.00),
    ('G12-FIN-COMPOUND-GROWTH-DECAY','G11-FIN-GROWTH-DECAY',1.00),
    ('G12-FIN-RATE-PERIOD','G11-FIN-NOMINAL-EFFECTIVE',1.00),
    ('G12-ANALYTIC-LINE','G11-ANALYTIC-LINE-INCLINATION',1.00),
    ('G12-ANALYTIC-INCLINATION','G11-ANALYTIC-LINE-INCLINATION',1.00),
    ('G12-EUCLID-THEOREMS','G11-EUCLID-CIRCLE-THEOREMS',0.90),
    ('G12-EUCLID-SIMILARITY','G10-EUCLID-MIDPOINT',0.80),
    ('G12-STATS-DESCRIBE','G11-STATS-HIST-OGIVE',1.00),
    ('G12-STATS-SKEW-OUTLIERS','G11-STATS-VARIANCE-SKEW',1.00),
    ('G12-PROB-VENN','G11-PROB-VENN-INDEPENDENCE',1.00),
    ('G12-PROB-TREE','G11-PROB-TREE-CONTINGENCY',1.00),
    ('G12-PROB-CONTINGENCY','G11-PROB-TREE-CONTINGENCY',1.00)
)
insert into public.skill_prerequisites (skill_id, prerequisite_skill_id, strength)
select skill.id, prerequisite.id, links.strength
from links
join public.curriculum_skills skill on skill.skill_code = links.skill_code
join public.curriculum_skills prerequisite on prerequisite.skill_code = links.prerequisite_skill_code
on conflict (skill_id, prerequisite_skill_id) do update set strength = excluded.strength;
