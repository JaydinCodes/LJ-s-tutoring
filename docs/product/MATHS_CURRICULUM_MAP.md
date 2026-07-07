# CAPS Mathematics Curriculum Map — Grades 8 to 12

**Status:** Living reference. This is the content spine for Project Odysseus Mathematics.
**Source of truth:** Aligned to the South African DBE **Curriculum and Assessment Policy Statement (CAPS)** and the **2026 Annual Teaching Plans (ATPs)** for Mathematics (Senior Phase Gr 8–9, FET Gr 10–12). Term ordering follows the 2026 national ATP; the CAPS content areas are the stable backbone even when a province re-sequences terms.
**Purpose:** Seed data for the `subject → topic → concept` taxonomy (see [CONTENT_AND_PRODUCT_STRATEGY.md](CONTENT_AND_PRODUCT_STRATEGY.md)). Every `concept` below is the atomic unit a study guide, study tip, worked example, practice set, and diagnostic question hangs off. Slugs are stable IDs — do not rename once content is authored against them.

## How to read this

```
Grade → Term → Topic (slug) → Concepts
```

- **Topic** = a CAPS teachable unit (maps to `topics` table row).
- **Concept** = the smallest assessable idea (maps to `concepts` table row; content objects attach here).
- **CAPS content area** tags let us report progress by strand (e.g. "Algebra", "Trigonometry") across grades, which is how we show a learner their trajectory, not just this term.
- Where the 2026 ATP is term-level only, concept granularity is filled from the CAPS subject statement.

**CAPS content areas used as cross-grade strands:**
`numbers-operations` · `patterns-algebra` · `functions-graphs` · `space-shape-geometry` · `measurement` · `trigonometry` · `analytical-geometry` · `finance` · `calculus` · `data-handling` · `probability`

---

# Senior Phase

## Grade 8

### Term 1
- **Whole Numbers & the Real Number System** (`g8.t1.real-number-system`) · *numbers-operations*
  - Natural, whole, integer, rational, and irrational numbers; classifying numbers
  - Multiples and factors; prime numbers
  - Prime factorisation; LCM and HCF
  - Order of operations; properties (commutative, associative, distributive)
- **Integers** (`g8.t1.integers`) · *numbers-operations*
  - Adding, subtracting, multiplying, dividing integers
  - Squares, cubes, square roots, cube roots of integers
- **Exponents** (`g8.t1.exponents`) · *numbers-operations*
  - Exponential notation; base, exponent
  - Laws of exponents (product, quotient, power of a power)
- **Scientific Notation** (`g8.t1.scientific-notation`) · *numbers-operations*
  - Writing large and small numbers in scientific notation

### Term 2
- **Algebraic Expressions** (`g8.t2.algebraic-expressions`) · *patterns-algebra*
  - Algebraic conventions and vocabulary; variables, coefficients, constants
  - Like and unlike terms; monomials, binomials, trinomials
  - Adding/subtracting like terms; the distributive law
  - Expanding and simplifying single-bracket expressions
- **Algebraic Equations** (`g8.t2.algebraic-equations`) · *patterns-algebra*
  - Solving linear equations by inspection and substitution
  - Additive and multiplicative inverses to isolate the variable
  - Equations involving rational numbers (fractions and decimals)
- **Functions, Relationships & Graphs** (`g8.t2.functions-graphs`) · *functions-graphs*
  - Input/output using flow diagrams, tables, and rules
  - Ordered pairs and the Cartesian plane
  - Drawing linear graphs from a table of values

### Term 3
- **Geometry of Straight Lines** (`g8.t3.straight-lines`) · *space-shape-geometry*
  - Angle relationships on perpendicular and intersecting lines
  - Parallel lines cut by a transversal (corresponding, alternate, co-interior angles)
- **Geometry of 2D Shapes** (`g8.t3.2d-shapes`) · *space-shape-geometry*
  - Classifying and defining quadrilaterals (parallelogram, rectangle, square, rhombus, trapezium, kite)
  - Triangle types; interior and exterior angle relationships
- **Theorem of Pythagoras** (`g8.t3.pythagoras`) · *measurement*
  - Investigating the theorem
  - Calculating missing sides in right-angled triangles

### Term 4
- **Surface Area & Volume of 3D Objects** (`g8.t4.surface-area-volume`) · *measurement*
  - Surface area of rectangular prisms and cylinders
  - Volume and capacity of rectangular prisms and cylinders
- **Transformation Geometry** (`g8.t4.transformations`) · *space-shape-geometry*
  - Reflection, translation, and rotation
  - Transforming points and figures on the Cartesian plane
- **Data Handling** (`g8.t4.data-handling`) · *data-handling*
  - Collecting and organising data; frequency tables
  - Measures of central tendency (mean, median, mode)
  - Bar graphs, pie charts, and interpreting data
- **Probability** (`g8.t4.probability`) · *probability*
  - Single-event probability; relative frequency

## Grade 9

### Term 1
- **Whole Numbers, Integers & Roots** (`g9.t1.numbers`) · *numbers-operations*
  - Properties of rational, irrational, natural numbers and integers
  - Operations with integers; squares, cubes, and roots
  - Prime factorisation for LCM and HCF
- **Exponents** (`g9.t1.exponents`) · *numbers-operations*
  - Laws of exponents extended to negative and zero exponents
  - Scientific notation revisited
- **Numeric & Geometric Patterns** (`g9.t1.patterns`) · *patterns-algebra*
  - Extending and describing patterns
  - Finding the general rule (nth term) of a linear pattern
  - Representing patterns in tables, diagrams, and algebraically

### Term 2
- **Algebraic Expressions** (`g9.t2.algebraic-expressions`) · *patterns-algebra*
  - Expansion and simplification using exponent laws
  - Factorisation: common factor, difference of two squares, trinomials
  - Simplifying algebraic fractions
- **Algebraic Equations** (`g9.t2.algebraic-equations`) · *patterns-algebra*
  - Solving linear equations (incl. fractions)
  - Solving equations by factorisation
- **Functions & Relationships** (`g9.t2.functions`) · *functions-graphs*
  - Input/output using flow diagrams, tables, and formulae
  - Equivalence of different representations of a relationship

### Term 3
- **Graphs** (`g9.t3.graphs`) · *functions-graphs*
  - Interpreting linear graphs: x- and y-intercepts, gradient
  - Drawing linear graphs from equations, and finding equations from graphs
- **Geometry of Straight Lines** (`g9.t3.straight-lines`) · *space-shape-geometry*
  - Angle relationships with parallel, perpendicular, and intersecting lines
- **Geometry of 2D Shapes** (`g9.t3.2d-shapes`) · *space-shape-geometry*
  - Classifying triangles and quadrilaterals
  - Congruency and similarity investigations
  - Solving for unknown sides and angles

### Term 4
- **Transformation Geometry** (`g9.t4.transformations`) · *space-shape-geometry*
  - Reflections (x-axis, y-axis, line y = x) and translations
  - Enlargements and reductions (scale factor)
- **Area & Perimeter of 2D Shapes** (`g9.t4.area-perimeter`) · *measurement*
  - Polygons and circles
  - Theorem of Pythagoras applied to missing lengths
- **Surface Area & Volume of 3D Objects** (`g9.t4.surface-area-volume`) · *measurement*
  - Rectangular prisms, triangular prisms, and cylinders
- **Data Handling & Probability** (`g9.t4.data-probability`) · *data-handling* / *probability*
  - Central tendency and spread; interpreting data displays
  - Probability of single and compound events; relative frequency

---

# FET Phase

## Grade 10

### Term 1
- **Algebraic Expressions** (`g10.t1.algebraic-expressions`) · *patterns-algebra*
  - Products and factorisation (common factor, grouping, difference of squares, trinomials, sum/difference of cubes)
  - Simplifying algebraic fractions with factorisation
- **Exponents** (`g10.t1.exponents`) · *patterns-algebra*
  - Laws of exponents with rational exponents; simplifying
- **Equations & Inequalities** (`g10.t1.equations-inequalities`) · *patterns-algebra*
  - Linear, quadratic (factorisation), and simultaneous linear equations
  - Literal equations; linear inequalities; word problems
- **Trigonometry (Ratios)** (`g10.t1.trig-ratios`) · *trigonometry*
  - Definitions of sin, cos, tan in right-angled triangles
  - Solving right-angled triangles; special angles

### Term 2
- **Euclidean Geometry** (`g10.t2.euclidean-geometry`) · *space-shape-geometry*
  - Lines, angles, triangles, and congruency
  - Properties of quadrilaterals; the mid-point theorem
- **Functions** (`g10.t2.functions`) · *functions-graphs*
  - Linear, quadratic (parabola), hyperbola, and exponential functions
  - Effects of parameters a, q, p; domain, range, intercepts, asymptotes, axes of symmetry

### Term 3
- **Trigonometric Functions** (`g10.t3.trig-functions`) · *trigonometry*
  - Graphs of sine, cosine, and tangent; effects of a and q
- **Trigonometry (2D Applications)** (`g10.t3.trig-2d`) · *trigonometry*
  - Angles of elevation and depression; 2D problems
- **Analytical Geometry** (`g10.t3.analytical-geometry`) · *analytical-geometry*
  - Distance, midpoint, and gradient of a line segment
- **Finance & Growth** (`g10.t3.finance`) · *finance*
  - Simple and compound interest; hire purchase
  - Inflation, population growth, currency conversion
- **Statistics** (`g10.t3.statistics`) · *data-handling*
  - Measures of central tendency and dispersion
  - Five-number summary and box-and-whisker plots
- **Probability** (`g10.t3.probability`) · *probability*
  - Venn diagrams; relative frequency; mutually exclusive and complementary events

### Term 4
- **Measurement** (`g10.t4.measurement`) · *measurement*
  - Area, surface area, and volume of right prisms, cylinders, and combinations
  - Effect of multiplying dimensions by a scale factor
- **Revision & Examinations** (`g10.t4.revision`) · *revision*
  - Consolidation across Algebra, Patterns, Trigonometry, Geometry, Functions

## Grade 11

### Term 1
- **Exponents & Surds** (`g11.t1.exponents-surds`) · *patterns-algebra*
  - Rational exponents; simplifying surds; rationalising denominators
- **Equations & Inequalities** (`g11.t1.equations-inequalities`) · *patterns-algebra*
  - Quadratic equations (factorisation, quadratic formula, completing the square)
  - Nature of roots (discriminant); simultaneous and quadratic inequalities
- **Number Patterns** (`g11.t1.number-patterns`) · *patterns-algebra*
  - Quadratic sequences; second differences; general term
- **Trigonometry (Identities & Equations)** (`g11.t1.trig-identities`) · *trigonometry*
  - Fundamental identities; proving identities
  - Reduction formulae; general solution; solving equations on an interval

### Term 2
- **Functions & Graphs** (`g11.t2.functions`) · *functions-graphs*
  - Parabola (incl. finding the equation), hyperbola, exponential; effects of a, p, q
  - Finding equations from graphs; interpreting intersections
- **Trigonometric Functions** (`g11.t2.trig-functions`) · *trigonometry*
  - Graphs of sin, cos, tan with effects of a, p, k; period and amplitude
- **Euclidean Geometry (Circle Geometry)** (`g11.t2.circle-geometry`) · *space-shape-geometry*
  - Theorems on chords, tangents, and cyclic quadrilaterals
  - Riders combining multiple theorems
- **Analytical Geometry** (`g11.t2.analytical-geometry`) · *analytical-geometry*
  - Distance, midpoint, gradient; angle of inclination (m = tan θ)
  - Parallel and perpendicular lines; equation of a straight line

### Term 3
- **Trigonometry (Sine, Cosine & Area Rules)** (`g11.t3.trig-rules`) · *trigonometry*
  - Sine rule, cosine rule, area rule; 2D and 3D problems
- **Statistics** (`g11.t3.statistics`) · *data-handling*
  - Histograms, frequency polygons, ogives (cumulative frequency)
  - Variance and standard deviation; identifying outliers
- **Probability** (`g11.t3.probability`) · *probability*
  - Dependent and independent events; tree diagrams
  - Contingency (two-way) tables; Venn diagrams
- **Finance, Growth & Decay** (`g11.t3.finance`) · *finance*
  - Compound growth and decay; nominal and effective interest rates; timelines
- **Measurement** (`g11.t3.measurement`) · *measurement*
  - Surface area and volume incl. effect of scale factor (right pyramids, cones, spheres)

### Term 4
- **Revision & Examinations** (`g11.t4.revision`) · *revision*

## Grade 12

### Term 1
- **Patterns, Sequences & Series** (`g12.t1.sequences-series`) · *patterns-algebra*
  - Arithmetic and geometric sequences and series
  - Sigma notation; sum to infinity and convergence
- **Functions & Inverses** (`g12.t1.functions-inverses`) · *functions-graphs*
  - Inverse function concept; restricting the domain
  - Exponential and logarithmic functions and their graphs
- **Finance, Growth & Decay** (`g12.t1.finance`) · *finance*
  - Future and present value annuities
  - Loan repayments and sinking funds; using logs to solve for n
- **Trigonometry** (`g12.t1.trigonometry`) · *trigonometry*
  - Compound and double angle identities
  - Trigonometric equations; 2D and 3D problems (sine, cosine, area rules)

### Term 2
- **Polynomials** (`g12.t2.polynomials`) · *patterns-algebra*
  - Remainder and factor theorems; factorising cubic polynomials
- **Differential Calculus** (`g12.t2.calculus`) · *calculus*
  - Limits; differentiation from first principles and by rules
  - Cubic graphs: intercepts, stationary points, points of inflection
  - Optimisation and rates of change
- **Analytical Geometry** (`g12.t2.analytical-geometry`) · *analytical-geometry*
  - Equation of a circle (centre origin and off-origin)
  - Equation of a tangent to a circle

### Term 3
- **Euclidean Geometry** (`g12.t3.euclidean-geometry`) · *space-shape-geometry*
  - Proportionality theorem; similarity of triangles
  - Pythagoras via similarity; proving riders
- **Statistics (Regression & Correlation)** (`g12.t3.statistics`) · *data-handling*
  - Bivariate data; scatter plots
  - Linear regression (least squares); correlation coefficient
  - The normal distribution (interpretation)
- **Counting & Probability** (`g12.t3.probability`) · *probability*
  - Fundamental counting principle; factorial notation
  - Arrangements incl. constraints; application to probability

### Term 4
- **Revision & NSC Final Examinations** (`g12.t4.revision`) · *revision*
  - Past-paper practice across Paper 1 and Paper 2

---

## Exam-paper mapping (Gr 12, for diagnostics & study planning)

**Paper 1** (Algebra & Calculus focus): Patterns & sequences (±25) · Functions & graphs (±35) · Algebra, equations & inequalities (±25) · Finance, growth & decay (±15) · Differential calculus (±35) · Counting & probability (±15).
**Paper 2** (Geometry, Trig & Stats focus): Statistics (±20) · Analytical geometry (±40) · Trigonometry (±40) · Euclidean geometry & measurement (±50).

This mapping lets the platform tell a Grade 12 learner *"you're weak on the topics worth ±35 marks in Paper 1"* — turning progress data into exam strategy.

---

## Content objects to author per concept

For each `concept` slug above, the target content set (see strategy doc for sourcing/review workflow) is:

| Object | Purpose | Data-weight target |
|---|---|---|
| `lesson` | Core explanation of the concept | Text-first, light |
| `study_guide` | Condensed revision summary (printable/offline) | Light |
| `study_tip` | Exam technique / common-mistake note | Very light |
| `worked_example` | Step-by-step model solution | Light |
| `practice_set` | Graded questions with answers | Light–medium |
| `diagnostic_item` | Question(s) that assign a concept-level mastery signal | Light |

**Authoring priority (depth-first on Maths):** Grade 12 Paper-1 topics → Grade 12 Paper-2 topics → Grade 11 → Grade 10 → Grade 9 → Grade 8. Rationale: matric learners are the highest-stakes, most time-sensitive cohort; earlier grades feed the same strands and can reuse foundational explanations.

## Counts (for taxonomy seeding)

- **5 grades**, **20 terms**, **~70 topics**, **~250+ concepts**.
- 11 cross-grade CAPS strands enable trajectory views (e.g. a learner's Trigonometry progress from Gr 10 ratios → Gr 12 compound angles).

## Open content decisions (tracked in strategy doc)

1. **Sourcing** — AI-drafted + qualified-teacher-reviewed is the proposed model; every object needs a review/approval gate before it reaches a learner (non-negotiable for minors).
2. **Language** — English plain-language first; isiXhosa / Afrikaans as a later inclusion layer for the Western Cape base.
3. **Practice item bank** — build our own vs. license; affects effort and IP.
4. **Diagnostics depth** — start with per-topic self-rating + a short quiz, evolve to adaptive concept-level mastery.
