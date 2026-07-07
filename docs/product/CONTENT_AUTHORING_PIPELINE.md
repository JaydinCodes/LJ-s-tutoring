# Content Authoring Pipeline

**Status:** Living spec. Defines how a piece of learning content goes from nothing → published to learners, with the mandatory teacher-review gate.
**Decisions this implements:** AI-drafted + qualified-teacher-reviewed · English first · own item bank · depth-first Maths (see [CONTENT_AND_PRODUCT_STRATEGY.md](CONTENT_AND_PRODUCT_STRATEGY.md) §4).
**Content spine:** [MATHS_CURRICULUM_MAP.md](MATHS_CURRICULUM_MAP.md) — every content item attaches to a `concept` slug.

---

## 1. Core principle

> **No AI-drafted content ever reaches a learner without a qualified teacher approving it.** The AI writes a first draft; a human teacher owns correctness, CAPS alignment, and age-appropriateness. This gate is the accuracy *and* liability boundary — non-negotiable because our learners are minors.

Only content in the **`published`** state is ever visible to a learner. Everything else lives behind the pipeline.

---

## 2. What we produce (per concept)

For each `concept` in the curriculum map, the target content set (from the strategy doc):

| Object type | What it is |
|---|---|
| `lesson` | Core explanation of the concept |
| `study_guide` | Condensed, printable/offline revision summary |
| `study_tip` | Exam technique / common-mistake note |
| `worked_example` | Step-by-step model solution |
| `practice_item` | A question with answer + solution (the **item bank**) |
| `diagnostic_item` | A question that assigns a concept-level mastery signal |

`practice_item` and `diagnostic_item` are the **own-built item bank** — same pipeline, with an extra correctness-verification step (§5).

---

## 3. Lifecycle states

```
          ┌─────────── request_changes ───────────┐
          ▼                                        │
[ draft ] ──submit──▶ [ in_review ] ──approve──▶ [ approved ] ──publish──▶ [ published ]
   ▲  (AI)                  │                                                    │
   │                       reject                                            supersede/
   └── (regenerate)          ▼                                               retire
                        [ rejected ]                                     [ archived ]
```

| State | Meaning | Learner-visible? |
|---|---|---|
| `draft` | AI-generated (or human-written) first draft | ❌ |
| `in_review` | Assigned to a teacher-reviewer | ❌ |
| `approved` | Reviewer signed off; ready to publish | ❌ |
| `published` | Live to learners | ✅ |
| `rejected` | Reviewer rejected; terminal (or regenerate a new draft) | ❌ |
| `archived` | Retired/superseded by a newer version | ❌ |

**Rule:** exactly one `published` version per (concept, object_type, language) at a time. Publishing a new version archives the previous one.

---

## 4. Roles

| Role | Does | Who |
|---|---|---|
| **Initiator** | Triggers an AI draft for a concept + object type | Platform admin or lead tutor |
| **Reviewer** | Reviews for correctness/CAPS/age-appropriateness; approve / request changes / reject | **Qualified/verified teacher** (a flagged tutor or lead) |
| **Publisher** | Flips `approved → published` | Lead/admin (may be same person as reviewer) |
| **Platform admin** | Oversight; can retire/re-review any item | Odysseus staff |

The reviewer **must** be a verified teacher — enforced in the RPC, not just the UI. A draft's initiator cannot be its sole reviewer (no self-approval) once the team is large enough; while the team is 5 people, at minimum record initiator ≠ reviewer where possible.

---

## 5. The AI-draft step (guardrails)

**Input to the model:** concept slug + grade + topic + CAPS strand + object type + a fixed system prompt.

**System-prompt guardrails (fixed, server-side — never learner- or client-supplied):**
- Align strictly to **CAPS** for the given grade/topic/concept; do not introduce out-of-scope content.
- **Plain, encouraging English** at the learner's grade reading level; short sentences; South African context and examples (Rands, local scenarios).
- **Mathematical correctness is mandatory** — every worked example and every practice/diagnostic answer must be correct and fully worked. If unsure, say so rather than fabricate.
- **Confidence-building tone** — explain, don't judge; normalise mistakes.
- **Data-light** — text-first; no heavy media; describe any diagram in text so it degrades gracefully.
- Output structured content (markdown body + metadata), tagged with the concept slug.

**Hard rules:**
- The AI draft is **never** shown to a learner. It always enters at `draft` and must pass review.
- Every AI-generated item records `ai_generated = true` and the `model_used` (transparency + auditability).
- The AI is a drafting aid only — it has **no** ability to publish, and its output is never executed or used to build a query.

---

## 6. The review gate (checklist)

The reviewer works through a fixed checklist before approving:

1. **Mathematically correct?** (worked examples and item answers verified — re-solve, don't trust.)
2. **CAPS-aligned?** (right grade, topic, concept; nothing out of scope.)
3. **Age-appropriate + plain language?** (reading level, tone, no jargon.)
4. **Confidence-building, not judgemental?**
5. **Complete?** (no missing steps; a learner could follow it unaided.)
6. **Data-light?** (no unnecessary heavy media.)
7. **For items:** difficulty tagged correctly; single unambiguous correct answer; distractors (if MCQ) are plausible.

Reviewer actions: **approve** · **request changes** (back to `draft` with comments) · **reject** (terminal). Every decision records reviewer id, timestamp, and comments, and writes to the `audit_log`.

---

## 7. Data model (Supabase; canonical in `docs/supabase/schema.sql`)

```sql
create type public.content_state as enum
  ('draft','in_review','approved','published','rejected','archived');
create type public.content_object_type as enum
  ('lesson','study_guide','study_tip','worked_example','practice_item','diagnostic_item');

create table public.content_items (
  id            uuid primary key default gen_random_uuid(),
  concept_id    uuid not null references public.concepts(id),
  object_type   public.content_object_type not null,
  language      text not null default 'en',
  title         text not null,
  body          text,                       -- markdown; text-first
  metadata      jsonb not null default '{}'::jsonb,  -- difficulty, est_minutes, data_weight, etc.
  state         public.content_state not null default 'draft',
  version       integer not null default 1,
  ai_generated  boolean not null default false,
  model_used    text,
  created_by    uuid references public.profiles(id),
  reviewed_by   uuid references public.profiles(id),
  approved_at   timestamptz,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- item-bank specifics (practice_item / diagnostic_item)
create table public.content_item_questions (
  id             uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  prompt         text not null,
  answer         text not null,
  solution       text,               -- worked solution
  options_json   jsonb,              -- for MCQ; null for free-response
  difficulty     text,               -- easy | medium | hard
  marks          integer
);

create table public.content_reviews (
  id             uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  reviewer_id    uuid not null references public.profiles(id),
  decision       text not null,      -- approved | changes_requested | rejected
  comments       text,
  created_at     timestamptz not null default now()
);
```

**State transitions go through SECURITY DEFINER RPCs** (`submit_for_review`, `review_content`, `publish_content`) that enforce role (reviewer must be a verified teacher), legal transitions, and write `audit_log`. Content is **global** (not org-scoped) — the curriculum is national (ADR-0002 §3.5).

**RLS:** learners can read only `state = 'published'`. Reviewers/leads/admins can read the full pipeline. Only the RPCs can transition state (no direct client `update` of `state`).

---

## 8. Learner-facing delivery (why the pipeline matters)

Because progress keys off `concepts` (from the curriculum map), published content can be surfaced **because a diagnostic found a gap** — e.g. a learner weak on `g12.t2.calculus` is shown that concept's `lesson` → `worked_example` → `practice_item` set. Content appears *when needed*, not as a library to browse. This is the payoff of the concept taxonomy + pipeline together.

---

## 9. Governance

- **Every state transition is audited** (`audit_log`), giving a full provenance trail: who drafted (AI + model), who reviewed, who published, when.
- **Re-review triggers:** a reported error, or a CAPS/ATP curriculum update.
- **Versioning:** editing published content creates a new version through the pipeline; the live version is only replaced on `publish`.
- **Transparency:** `ai_generated` + `model_used` are retained so we can always say what was AI-drafted and who approved it.

---

## 10. Build order (aligns with depth-first Maths)

1. Taxonomy tables (`subjects → topics → concepts`) seeded from the Maths map.
2. `content_items` + `content_reviews` + transition RPCs + RLS.
3. Minimal review UI (queue → checklist → approve/reject).
4. AI-draft function (Edge Function, per ADR-0003) with the §5 guardrails.
5. Author **Grade 12 Paper-1 concepts first**: lesson → worked_example → practice_item → diagnostic_item, each through the gate.
6. Expand outward (Gr 12 Paper 2 → Gr 11 → … → Gr 8).

## 11. Decisions (2026-07-08)

1. **Reviewer** — ✅ **Jaydin** is the initial qualified maths-teacher reviewer. The gate is satisfied from day one.
2. **Self-approval** — ✅ Allowed now (initiator = reviewer permitted while there is a single qualified reviewer). **Require initiator ≠ reviewer separation once a second qualified reviewer exists.**
3. **Diagnostic scoring** — ✅ Start simple: per-concept correct/incorrect. Weighted mastery can come later.
