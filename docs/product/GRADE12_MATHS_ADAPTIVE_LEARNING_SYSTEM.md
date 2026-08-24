# Grade 12 Mathematics adaptive learning system

## Purpose

Project Odysseus should use learning evidence to help a tutor choose the next
best activity for a learner. It must not label learners by a fixed "level",
rank them, determine placement, or make a high-stakes decision without a tutor.

The learner experience is deliberately simple:

- **Next focus:** a concrete skill, such as *simplify algebraic fractions*.
- **Why this now:** short evidence-based wording, such as *recent work suggests
  this will make the next functions activity easier*.
- **Next activity:** one bounded, tutor-approved activity with a clear finish.

The internal instructional state drives sequencing only. It is not shown as a
score, band, or permanent characteristic in learner or guardian interfaces.

## Product boundaries

1. Start with teacher-reviewed Grade 12 CAPS Mathematics content only.
2. Treat marks, rubric criteria, tutor observations, and diagnostic checks as
   evidence; do not infer mastery from time spent, clicks, demographics, or
   protected characteristics.
3. Use only released assessment evidence for learner/guardian-facing results.
   Tutors may use their own unreleased observations in their private workspace.
4. Require tutor approval before a generated recommendation reaches a learner.
   A tutor can edit, defer, dismiss, or replace it and records the reason.
5. Never use the model for admission, payment, safeguarding, disciplinary, or
   automated learner-placement decisions.

## Learning model

The model is a small directed graph, not a list of chapters.

```text
CAPS subject -> strand -> topic -> skill -> prerequisite skill
                                      |
                                      +-> learning activities
                                      +-> assessment/rubric criteria
                                      +-> learner evidence -> instructional state -> recommendation
```

Example (illustrative only; final taxonomy requires Mathematics educator review):

```text
Functions
  -> Algebraic functions
    -> simplify algebraic fractions
      -> factorise expressions (prerequisite)
      -> identify excluded values (prerequisite)
      -> simplify a rational expression (skill)
```

Every activity and every assessable rubric criterion maps to one or more skills.
An assignment-level percentage is retained as a result, but is never treated as
proof that every skill in that assignment is secure.

## Internal instructional state

For each learner and skill, the backend derives a state from verified evidence.
The persisted state is a compact internal code:

| Code | Meaning for sequencing | Learner-visible wording |
| --- | --- | --- |
| `insufficient_evidence` | collect a short diagnostic or tutor observation | "Let’s check this step together." |
| `rebuild` | revisit prerequisite or core method | "Strengthen this foundation next." |
| `practice` | complete guided and independent practice | "Build confidence with a few targeted questions." |
| `consolidate` | space and mix practice to make the skill reliable | "Keep this method ready for different question types." |
| `extend` | attempt unfamiliar/exam-style applications | "Try a more challenging application." |

Codes are not surfaced to learners or guardians. A tutor may inspect the
underlying evidence and recommendation rationale, not a black-box label.

### Deterministic scoring, version one

Use an explainable score from 0–100 only internally. It is an instructional
signal, not an official mark.

1. Accept only evidence linked to a taxonomy skill and marked as reviewed,
   released, or tutor-observed.
2. Weight each observation by evidence quality (rubric/diagnostic > tutor
   observation > broad assignment mark) and recency.
3. Require a minimum evidence count before returning anything other than
   `insufficient_evidence`.
4. Calculate a trend from the recent evidence window; do not punish a learner
   permanently for an old weak result.
5. Cap certainty when evidence is sparse or only broad assignment evidence is
   available.

The first version should use reviewed SQL/RPC rules. Machine learning is not a
launch requirement and must not replace this auditable baseline.

## Data architecture to implement

| Record | Responsibility | Client access |
| --- | --- | --- |
| `curriculum_skills` | teacher-reviewed subject, grade, strand, topic, skill, cognitive level, active status | learner reads only released activity context; tutor/admin read scoped taxonomy |
| `skill_prerequisites` | directed prerequisite graph and optional strength | no direct learner write |
| `learning_activities` | reviewed activity metadata, format, estimated minutes, answer/rubric reference, status | learners read only assigned/released activities |
| `activity_skill_targets` | activity-to-skill mapping, assessment weight, cognitive demand | no direct learner write |
| `learning_evidence` | immutable atomic evidence for one learner/skill/source | student own released rows; tutor allocated learners; admin scoped |
| `learner_skill_state` | derived current instructional state, score, certainty, calculation version, evidence window | private backend/tutor read; learner consumes approved recommendation only |
| `learning_recommendations` | proposed next action, rationale, state, expiry, calculation version | learner reads only tutor-approved/released rows |
| `recommendation_decisions` | tutor approve/edit/defer/dismiss action and rationale | tutor/admin audit only |

The existing `assignment_submissions`, `student_progress`, `baseline_assessments`,
and `weekly_reports` remain the system of record for their present purposes.
They feed atomic `learning_evidence`; they are not replaced or silently
rewritten.

## Recommendation policy

The recommendation engine chooses from teacher-reviewed activities linked to
the learner’s allocated subject and grade.

Priority order:

1. A weak prerequisite that blocks an assigned/current target skill.
2. A skill with low certainty: recommend a short diagnostic rather than more
   practice.
3. A weak, recently evidenced target skill: recommend guided reteach then
   practice.
4. A rising but inconsistent skill: recommend spaced mixed practice.
5. A secure skill with enough evidence: recommend exam-style extension.

Every recommendation stores structured rationale, for example:

```json
{
  "skill": "simplify algebraic fractions",
  "evidence_window": 3,
  "recent_scores": [42, 48, 58],
  "prerequisite": "factorise expressions",
  "reason_code": "weak_prerequisite",
  "learner_copy": "Strengthen factorising first; it will make the next functions questions easier."
}
```

The client receives the learner copy and next action, never the internal score,
state code, cohort comparison, or speculative prediction.

## Tutor workflow

1. Tutor reviews the learner’s evidence and the proposed next action.
2. Tutor approves, edits, replaces, defers, or dismisses it.
3. The learner receives only an approved action with a clear objective and
   estimated duration.
4. Completion, a diagnostic result, or tutor review creates new evidence.
5. The engine recalculates and proposes the next action; it does not overwrite
   an in-progress approved recommendation.

## Delivery sequence

### Phase 1 — curriculum and data foundation

- Author and educator-review the Grade 12 Mathematics taxonomy and activity
  inventory.
- Add the tables above, RLS, immutable evidence ingestion RPCs, and pgTAP
  allow/deny coverage.
- Map one small pilot slice first: Algebraic Functions and its prerequisites.

### Phase 2 — scoring and tutor queue

- Add a deterministic calculation RPC with an explicit algorithm version.
- Generate draft recommendations only for the pilot skills.
- Build the tutor approval queue and audit trail; do not expose learner-facing
  recommendations yet.

### Phase 3 — learner experience

- Add a quiet "Next focus" card to the student dashboard.
- Link to one approved activity and show learner-friendly rationale.
- Add completion/reflection capture without using engagement metrics as mastery.

### Phase 4 — pilot evaluation

- Compare tutor decisions with engine proposals, override rate, time-to-help,
  diagnostic improvement, and learner understanding of next steps.
- Review false positives, stale recommendations, accessibility, and fairness by
  evidence availability before expanding subject coverage.

## Non-negotiable acceptance criteria

- A learner can never read another learner’s evidence, state, or recommendation.
- A learner cannot create or alter evidence, state, recommendation, or tutor
  decision rows.
- A recommendation cannot reach a learner before a tutor approves it.
- Every score/state/recommendation records algorithm version and input evidence
  references.
- Recalculation is idempotent and cannot overwrite tutor decisions or an
  in-progress learner action.
- No learner UI contains a fixed ability/level label, rank, or cohort comparison.
- All taxonomy and activity content used in the pilot has educator review,
  curriculum provenance, and accessibility acceptance.
