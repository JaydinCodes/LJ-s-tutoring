# Grades 8–12 Mathematics prerequisite spine

The adaptive-learning engine uses one CAPS Mathematics pathway across Grades 8–12. It records evidence against an exact question family, not a subject mark or a learner-facing level.

## Current source-derived map

| Grade | Question families | Focus of the map |
| --- | ---: | --- |
| 8 | 18 | number fluency, introductory algebra, graphs, basic geometry, data and probability |
| 9 | 15 | factorisation, product-zero equations, linear graphs, measurement and compound-probability representations |
| 10 | 24 | FET algebra, functions, financial maths, trigonometry, analytical geometry, statistics and Euclidean geometry |
| 11 | 24 | direct Grade 12 foundations: surds, quadratics, transformations, trig general solutions, finance, circle geometry and conditional probability |
| 12 | 89 | existing textbook- and ATP-aligned question families |

All 81 newly added Grade 8–11 skills and their question types have `teacher_review` status. They are usable for curriculum planning and dependency checks, but cannot accept learner evidence or trigger a released activity until a curriculum owner approves both the skill and a matching activity.

## How a recommendation follows the spine

1. A tutor records reviewed evidence against the specific question family used in the marked work.
2. The system calculates a private instructional state from recency, evidence weight, sample size and trend. It never shows that state as a learner label.
3. A weak family may reveal its most specific prerequisite. For example, a Grade 12 contingency-table difficulty can lead through Grade 11 tree/contingency work to Grade 9 tree-diagram and relative-frequency foundations.
4. The engine drafts a recommendation only when there is a released matching activity. A tutor must approve, replace, defer or dismiss it.
5. The learner sees only the approved next practice, for example: “Strengthen this foundation next; it will make the following Mathematics questions easier.”

## Examples of deliberately separate question families

- Probability: simple outcomes, two-way tables, tree diagrams, Venn/event notation, identities, independence and contingency tables are separate evidence streams.
- Functions: linear, quadratic, hyperbolic, exponential and trigonometric graphs are separate evidence streams.
- Algebra: expanding, factorising, algebraic fractions, quadratic equations, simultaneous equations and quadratic inequalities are separate evidence streams.
- Trigonometry: ratios/special angles, equations, identities/reduction, general solutions and sine/cosine/area rules are separate evidence streams.

This keeps a learner who can calculate a probability from being incorrectly treated as ready for a tree, Venn or conditional-probability question. It also prevents a broad “Algebra: 60%” mark from hiding the exact thing that needs practice.

## Automated proof

`supabase/tests/database/curriculum_prerequisite_spine.test.sql` verifies the counts, review-only gate, per-family question type creation and cross-grade prerequisite links. The synthetic learner journey in `supabase/tests/database/rls_role_matrix.test.sql` separately proves that a tutor can create evidence and approve a next action, while a learner cannot read the private state or draft rationale.
