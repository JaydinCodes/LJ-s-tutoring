# Grade 9 Term 1 Learning Foundation

**Status:** Sprint 1 implementation contract. The curriculum taxonomy, topic policies, and assessment forms added by this sprint are all review-gated. No new learner-facing questions, activities, or assessments are published by this work.

## Scope and sources

The mapped ATP sequence is:

1. Whole numbers
2. Integers
3. Exponents
4. Numeric and geometric patterns

The supplied Grade 8 material is a targeted bridge, not a mandatory Grade 8 restart. The uploaded resource register’s conceptual prerequisite labels were mapped to the repository’s existing skill codes; they were not used as database IDs. Candidate Siyavula and video resources remain external, optional, and unverified. They provide no mastery evidence.

## Curriculum map and prerequisite graph

| Topic | Essential Grade 9 skills | Targeted Grade 8 bridge |
| --- | --- | --- |
| Whole numbers | `G9-NUM-REAL-IRRATIONAL` (critical, reasoning), `G9-NUM-WHOLE-HCF-LCM` (critical), `G9-NUM-DIRECT-INVERSE-PROPORTION` | `G8-NUM-WHOLE-PROPERTIES`, plus fraction/decimal operations for proportion |
| Integers | `G9-NUM-INTEGERS-OPERATIONS` (critical), `G9-NUM-INTEGERS-POWERS-ROOTS` (critical) | `G8-NUM-INTEGERS-OPERATIONS` |
| Exponents | `G9-EXP-LAWS-EXTENDED` (critical), `G9-EXP-NEGATIVE-SCI` (critical); `G9-EXP-SCI-NOTATION-EXTENSION` is supplementary | `G8-EXP-LAWS-SCI` and integer operations |
| Numeric and geometric patterns | `G9-PAT-NUMERIC-STRUCTURE` (critical, reasoning), `G9-PAT-GENERAL-RULE` (critical, reasoning), `G9-PAT-GEOMETRIC-VISUAL` (critical, reasoning) | `G8-PAT-REPRESENT-RULE` |

The `skill_prerequisites` graph contains only directional teaching dependencies. It is not a fixed course path. In particular:

- unknown prerequisite evidence produces an optional diagnostic recommendation;
- known insecure evidence produces targeted remediation for the nearest skill;
- a learner may start another unrelated self-paced topic; and
- a Grade 8 bridge is only surfaced when there is a reason to investigate or remediate it.

The migration uses the existing `CAPS-MATH-G9-2026` curriculum version, existing Grade 8 bridge skills, `grade9_skill_metadata`, and `skill_prerequisites`. It does not create another curriculum or learning engine.

## Topic mastery policy

`topic_mastery_policies` is a versioned, admin-only configuration. Its child `topic_mastery_policy_skills` identifies essential skills, critical skills, and skills that require mathematical-reasoning evidence. An approved policy is immutable except for retirement; a new policy version is required for a material change.

The seeded values are draft pilot values, not a universal research claim:

- at least 80% overall achievement;
- 100% critical-skill coverage;
- at least one independent mathematical-reasoning item at 80% or better;
- a 90% strong-baseline threshold; and
- a mastery challenge when the approved policy requires it.

The pure contracts in [grade9Term1FoundationContracts.ts](../../src/features/learning/grade9Term1FoundationContracts.ts) return `evidence_incomplete` when evidence is unknown or missing. They return `not_yet_mastered` only for known shortfalls. This distinction is central: absence of evidence is not a failed prerequisite or failed skill.

## Assessment and progression contract

`learning_assessment_definitions` provides four formal assessment types:

| Type | Purpose | Default draft duration |
| --- | --- | --- |
| Entry baseline | Broad Term 1 diagnostic | 20 minutes |
| Topic baseline | Topic-specific starting evidence | 12 minutes |
| Endline | Independent coverage check following study/remediation | 20 minutes |
| Mastery challenge | Independent challenge across critical skills and reasoning | 15 minutes |

All definitions are draft-only and contain no questions in Sprint 1. Each formal assessment is constrained to exactly one scored answer per question. The topic policy explicitly fixes practice to three attempts per question. Durations are fields on the review-gated assessment definition, so a content administrator—not the learner client—controls them.

Progression is evaluated as follows:

1. A learner with no or unknown prerequisite evidence may take the entry/topic baseline; an optional prerequisite diagnostic is offered, not enforced as a failure.
2. A known prerequisite gap offers focused Grade 8 remediation and a later topic baseline. It does not impose a global sequence lock.
3. A strong topic baseline with secure critical skills and reasoning evidence makes the mastery challenge available immediately.
4. A weaker baseline supplies the skill-level focus for remediation, practice, then an endline.
5. Only demonstrated topic mastery makes the next dependent topic ready. Unrelated topics remain self-paced.

## Question specification

The existing immutable `question_versions` bank remains canonical. For `multiple_choice`, the approval validator now requires:

- exactly four distinct options, keyed `A` through `D`;
- exactly one correct option;
- a non-empty explanation for each and only each incorrect option;
- existing primary skill mapping and 1–5 difficulty; and
- a reasoning classification (`procedural` or `mathematical_reasoning`).

Answer keys and distractor explanations remain in privileged `answer_config`. The learner display RPC continues to expose option labels only. The Admin Learning Content form now captures difficulty, reasoning classification, the four options, and distractor explanations before a draft can be saved.

## Assignments boundary

Learning Journey and Assignments remain separate. The sprint does not modify the student Assignments experience or reinterpret ordinary assignment marks as mastery.

`qualifying_assignment_mastery_evidence` is an explicit opt-in bridge. It can be created only through an admin-controlled RPC when all of the following are true:

- the topic policy is approved and explicitly allows qualifying assignment evidence;
- the submission is the learner’s latest, marked, released submission;
- the chosen skill is an essential skill in that policy;
- the mapped achievement meets the policy’s configured qualification threshold; and
- a reviewer supplies a rationale.

The record is append-only and keeps the original assignment/submission evidence intact. Sprint 2 may consume only these qualified records when it persists topic-level mastery decisions; it must never read generic assignment scores as automatic mastery evidence.

## Security and review gates

The new tables have RLS enabled. Direct reads are platform-admin scoped; writes occur only through security-definer functions that require the existing content-admin authorization boundary. Functions revoke `public` access and grant only authenticated execution, where the function rechecks administrator access. No existing student identity boundary, assignment RLS policy, learning-attempt history, mastery history, or question-answer-key boundary was changed.

## Sprint 2 handover

Sprint 2 should:

1. Obtain mathematical/CAPS review for each mapped skill, policy, question family, and external resource before approving any record.
2. Author parallel, reviewed question forms and link only approved immutable question versions to the assessment definitions.
3. Build the assessment delivery/session layer on the existing secure attempt/evaluation path, enforcing the configured duration server-side and preserving all attempts.
4. Persist append-only topic-level decisions that cite assessment attempts and, only when explicitly selected, `qualifying_assignment_mastery_evidence`.
5. Expose learner-facing recommendations using the established sanitized RPC pattern; do not expose answer keys, distractor rationales, draft content, or internal policy notes.
6. Validate the future ATP before a live roll-out and retain the current resource register as a review queue, not publishing material automatically.

## Known limitations

- No Grade 9 Term 1 questions, activities, assessment sessions, or learner UI are released in Sprint 1.
- The proposed thresholds are configurable pilot defaults; they require educator review and outcome monitoring.
- The supplied candidate video catalog was not human-verified for suitability, coverage, access conditions, or exact duration.
- Scientific notation is represented as a supplementary extension because the supplied notes flag its Term 1 ATP scope as uncertain.
