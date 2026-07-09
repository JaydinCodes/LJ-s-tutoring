# Project Odysseus — Product & Content Strategy

**Status:** Living document. Captures the product direction discussed by the owner (Jaydin) and the reasoning behind it. Update this as decisions are made rather than re-deciding in chat.
**Companion:** [MATHS_CURRICULUM_MAP.md](MATHS_CURRICULUM_MAP.md) — the CAPS Grade 8–12 Maths content spine this strategy builds on.
**Related:** `docs/architecture/ADR-0001-supabase-first.md`, `AUDIT.md` (multi-tenant / POPIA findings).

---

## 1. What this business is (and is becoming)

Project Odysseus is **not** meant to stay a single-tutor 1:1 tool. The roadmap:

- **Grow into NGO partnerships and tutoring classes at primary and high schools** — multi-organisation, multi-cohort/classroom delivery.
- **Give private tutoring clients more than they pay for** — the Odie AI assistant, careers guidance, community/study features, and structured progress tracking are deliberate value-adds and differentiators, not scope creep.

This reframes the breadth of the platform (RBAC, NGO reporting, parent portals, AI, community) as *justified by the plan*. The real risk is **execution debt** (two backend stacks, two design systems — see AUDIT.md), not feature ambition.

---

## 2. The design frame: socioeconomic inclusion is a boundary condition, not a feature

South Africa's digital divide is the single most important design constraint. **Design for the most-constrained learner and everyone above them is served for free.** That learner is on:

- a **cheap Android phone**, often shared, not a laptop;
- **prepaid data where every MB costs money** — so content is **text-first**, images are compressed, and video is optional/opt-in, never default;
- **intermittent power and connectivity** (load-shedding) — which argues for an **offline-capable PWA** that caches lessons/guides and syncs progress later;
- possibly **no home device at all** — reached through the **school/NGO class** on a shared or tutor-led device.

**Key insight:** the NGO + schools roadmap *is* the access strategy for low-income learners who cannot self-serve on a phone at home. The business direction and the inclusion goal are the same lever — build for the classroom-delivered, data-poor learner and the private suburban learner is trivially covered too.

**Design rules that follow:**
1. Low-end Android is the primary target device; desktop is secondary.
2. Every content screen has a **data-weight budget**; measure it.
3. Ship a **data-light mode** first, evolve toward **full offline PWA**.
4. Text/worked-example content before video.
5. Plain-language English first; plan for **isiXhosa / Afrikaans** as an inclusion layer (Western Cape base).

---

## 3. Content architecture: a CAPS-aligned taxonomy spine

**Problem today:** the content model is flat. `subjects` is `(name, grade, curriculum)`; `student_progress.topic` is a **free-text string** a tutor types (`docs/supabase/schema.sql:68,169`). There are no `topics`, `concepts`, `lessons`, `study_guides`, or `resources` tables. "Cater for every subject, topic, and concept" has no structural home.

**Target model:**

```
organisation (see §6)
subject → topic → concept → [content objects]
                              ├── lesson
                              ├── study_guide
                              ├── study_tip
                              ├── worked_example
                              ├── practice_set / practice_item
                              └── diagnostic_item
```

- `concept` is the atomic unit. Content, diagnostics, and progress all key off it.
- Migrate `student_progress.topic` (free text) → **FK into `concepts`**, so "weak on quadratic factorising" becomes a structured, queryable signal instead of a string.
- Tag every topic with a **CAPS content strand** (Algebra, Trigonometry, etc.) so we can show a learner their trajectory *across grades*, not just this term.

The Maths Grade 8–12 spine (~70 topics, ~250+ concepts) is already mapped in [MATHS_CURRICULUM_MAP.md](MATHS_CURRICULUM_MAP.md). That document is the seed spec for these tables.

**Once the spine exists**, study guides, study tips, diagnostics, and the AI tutor become *queries against structure* rather than bespoke one-offs — content that appears **because the diagnostic found a gap**, not a library the learner must go browse.

---

## 4. Content sourcing (DECIDED — 2026-07-08)

Authoring CAPS content for every concept across every subject is the biggest single undertaking. **Locked decisions:**
- **AI-drafted + qualified-teacher-reviewed**, with a **mandatory review/approval gate before any content reaches a learner** (non-negotiable for minors — we own accuracy and liability).
- **English plain-language first**; isiXhosa/Afrikaans as a later inclusion layer.
- **Data-light mode** added (before investing in full offline PWA).
- **Depth-first on Maths** (Gr 12 Paper-1 topics first — highest-stakes cohort), then expand outward and to other subjects.
- **Build our own practice/diagnostic item bank** (not licensed) — owns the IP and lets items map exactly to our concept taxonomy.

Content lifecycle: `draft (AI) → teacher_review → approved → published`. Only `published` is ever shown to a learner. Track author, reviewer, and approval timestamp for auditability.

---

## 5. User-centric dashboard without cognitive overload

Every user's need differs — but the trap is turning that into an over-configurable, overwhelming UI. **Reduce extraneous cognitive load** (the effort we impose that isn't the actual learning).

**Mechanism:** one simple signal set — **the learner's goal (set at onboarding) + role + grade + progress state + connectivity** — shapes the surface. Not fifty toggles.

The student landing view answers just two questions, in order:
1. **"What do I do next?"** — the *one* next task/step, with a clear action. Not a grid of everything.
2. **"Am I okay?"** — one calm progress signal. Critical for a learner rebuilding confidence: the first screen must **not** read like a report card full of red.

Everything else (full results history, careers, community, reports) is **one tap deeper** (progressive disclosure). Same features, calmer surface. **Keep the existing Greek/Odysseus brand palette** — this is an interaction-density change, not a rebrand.

### Learner-need segments (emphasis shifts, platform stays the same)
| User | Core question | What the surface emphasises |
|---|---|---|
| Learner rebuilding confidence | "Can I do this?" | One next step, small wins, encouragement, no wall of red |
| Distinction-chaser | "How do I push higher?" | Stretch problems, past-paper drills, depth |
| Data-poor learner | "Can I even load this?" | Data-light mode default, downloadable/offline content first |
| Parent / guardian | "Is my child okay?" | Reassurance, released reports only, nothing overwhelming |
| Tutor | "Who needs me and what do I mark?" | Fast marking queue, at-risk flags |
| NGO / school coordinator | "How is my cohort doing?" | Aggregate, anonymised cohort progress (no individual PII) |

---

## 6. Multi-organisation model (roadmap-critical)

AUDIT.md flagged there is **no `tenant_id` / organisation concept** — isolation is per-individual-row only. For a single tutor that was fine. **For NGOs + multiple schools it is not:** an NGO coordinator seeing another NGO's cohort, or a school seeing another school's learners, is a **POPIA breach**, not a bug.

Before the data model calcifies, introduce an `organisation` (and `cohort`/`class`) concept:
- an NGO admin scoped to their partner's cohorts;
- a school coordinator scoped to their school's classes;
- private clients in a "direct" organisation;
- RLS scopes by **organisation *and* role**, not ownership alone.

This is cheap now and brutal to retrofit later. Every downstream feature (NGO reporting, class management, parent portal, cohort content assignment) inherits clean partitioning for free. **This should be designed as a plan before any schema is written**, because it touches RLS — exactly where the existing Critical bugs live.

---

## 7. Sequenced next steps

1. **Design the multi-org / cohort data model** (plan first, then schema + RLS). Foundational; unblocks NGO/schools and closes the biggest forward-looking POPIA gap.
2. **Build the content taxonomy tables** (`subjects → topics → concepts → content objects`) and **seed Maths Gr 8–12** from the curriculum map.
3. **Student dashboard redesign** — the "two questions" + progressive disclosure pass, on the existing brand.
4. **Design-system consolidation** — fold the duplicate `academy.*` tokens into `brand.*` (mechanical, low-risk, makes everything after it consistent).
5. **Content authoring pipeline** — the `draft → review → approved → published` workflow with the teacher-review gate.

---

## 8. Decisions (locked 2026-07-08)

1. **Content sourcing** — ✅ AI-drafted + qualified-teacher-reviewed.
2. **Language scope** — ✅ English plain-language first; isiXhosa/Afrikaans later.
3. **Offline depth** — ✅ data-light mode first; full offline PWA later.
4. **Rollout shape** — ✅ depth-first on Maths (Gr 12 Paper 1 first).
5. **Practice/diagnostic bank** — ✅ build our own item bank.
6. **Non-negotiables** — ✅ teacher-review gate on all learner-facing content; organisation-level data isolation before any NGO/school onboarding (see [MULTI_ORG_MODEL_PLAN](../architecture/MULTI_ORG_MODEL_PLAN.md)).
