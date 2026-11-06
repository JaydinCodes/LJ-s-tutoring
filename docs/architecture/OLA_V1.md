# Odysseus Learning Algorithm v1

OLA v1 is a deterministic delivery selector for Grade 9 Mathematics. It does
not calculate mastery, mark responses, create question content, or replace a
tutor decision. Those responsibilities remain with the existing versioned
mastery rules, evaluation Edge Function, immutable question versions, and
tutor recommendation workflow.

## Inputs and boundaries

The selector accepts a learner's requested Grade 9 Mathematics topic and
optional skill, the current versioned mastery snapshot, independent/assisted
attempt evidence, prerequisite snapshots, open misconception evidence,
unfinished activity state, due retention state, and approved content.

Only reviewed activity templates with approved, non-retired question versions
are candidates. Tutor-approval-required content is not made independently
actionable. A missing prerequisite mastery evaluation is `unassessed`, not a
failure. Time spent, video viewing, confidence and assignment marks are not
mastery inputs.

## Precedence

Within the learner's chosen topic, OLA uses this fixed order:

1. Resume an unfinished approved activity.
2. Offer a due retrieval activity for the selected skill.
3. With no target evidence, offer an optional short approved diagnostic when
   one exists. It never blocks the explanation or other approved practice.
4. Remediate the first deterministically ordered *evidenced* prerequisite gap
   (`emerging` or `developing`), if suitable approved content exists.
5. For repeated open misconception evidence, select an approved activity with
   worked-example/error-analysis and guided-practice support.
6. For developing/emerging evidence, select approved targeted practice.
7. For secure/retained evidence, select an approved independent challenge or
   appropriate later retrieval activity.
8. Return `NO_APPROVED_CONTENT` with a safe learner message when no eligible
   content exists.

All code-based ties sort lexically. Each result contains learner-safe reason
codes; no tutor notes, internal recommendation records or answer configuration
is returned to the browser.

## Content release

`learning_skill_content` stores a short explanation, reviewed worked example,
and optional resources for a curriculum skill. Its review RPC requires a
content administrator. A video must be an HTTPS YouTube watch/short URL; it is
an ordinary link (never autoplayed). A worksheet must have an HTTPS link and a
permission note before it can be approved.

The migration seeds the Difference of Two Squares explanation as **draft**.
It is intentionally not released merely because it is useful. A designated
mathematics reviewer must check and approve it, and the linked activity and
all referenced question versions must also be approved before learners see the
complete vertical.

## Optional curated video resources

Video is supporting material, never evidence of mastery and never a
prerequisite for practice. The learner application renders only resources that
are both `approved` and verified `available`, as simple external **Watch on
YouTube** links. It does not embed or autoplay third-party players.

The initial Grade 8 bridge and Grade 9 candidate catalogue is deliberately
seeded as `draft`/`unverified`. A content administrator must check each link's
public access, sign-in/age restriction, title/channel, duration, CAPS fit,
instructional quality, narration and permitted use before submitting and
approving it. Replacing a YouTube ID returns the resource to draft and clears
its availability verification. The review action and metadata changes are
audited. If video retrieval fails, the reviewed text lesson and approved
practice remain available.

One supplied candidate (`VID.G8.EQN.001`) contained a 12-character value
where a YouTube video ID must contain 11 characters. Its stored 11-character
prefix is still `draft`/`unverified`; the original supplied value is in the
review note, and staff must confirm the actual video before it can proceed.

## Current scope

The catalogue reads the existing Grade 9 CAPS taxonomy, so Algebraic
Equations and Linear Graphs can appear when reviewed learner content exists.
OLA v1 releases no fabricated availability and adds no competing question bank
or mastery score.
