# Project Odysseus — North Star & Roadmap

**Status:** Living anchor document. This is the "where we are and where we're heading" reference — start here.
**Audience:** the core team (currently 2 people, moving fast).
**Companions:** [CONTENT_AND_PRODUCT_STRATEGY.md](CONTENT_AND_PRODUCT_STRATEGY.md) · [MATHS_CURRICULUM_MAP.md](MATHS_CURRICULUM_MAP.md) · [TUTOR_AND_VOLUNTEER_MODEL.md](TUTOR_AND_VOLUNTEER_MODEL.md) · [../architecture/MULTI_ORG_MODEL_PLAN.md](../architecture/MULTI_ORG_MODEL_PLAN.md) (ADR-0002) · [../architecture/ADR-0001-supabase-first.md](../architecture/ADR-0001-supabase-first.md) · `../../AUDIT.md`

---

## 1. North Star

**Give every South African learner — regardless of what they can pay — structured, confidence-building CAPS support that actually meets them where they are.**

We start with Grade 8–12 Mathematics, delivered through private tutoring, schools, NGOs, and volunteer community outreach, on a platform designed for the most data- and device-constrained learner first.

**What we will not compromise on:**
- **Child safety** — everyone who touches a minor is vetted (see [TUTOR_AND_VOLUNTEER_MODEL.md](TUTOR_AND_VOLUNTEER_MODEL.md)).
- **Data protection** — POPIA-grade isolation between organisations; minors' data minimised and access-scoped.
- **Confidence over judgement** — the product rebuilds a learner's belief, it doesn't rank or shame them.
- **Inclusion as a design constraint** — build for the shared, cheap Android phone on prepaid data, and everyone above is served for free.

---

## 2. Who we serve (the four delivery strands)

All four run on **one platform, one content spine, one security model** — they differ only in who pays, who coordinates, and how learners are reached. Each is an `organisation` in the data model ([ADR-0002](../architecture/MULTI_ORG_MODEL_PLAN.md)).

| Strand | Org type | Who pays | How reached | Notes |
|---|---|---|---|---|
| **Private tutoring** | `direct` | Parents/guardians | 1:1 or small group | Today's business; funds the rest. Gets the full value-add (Odie AI, careers, progress). |
| **Schools** | `school` | School / parents | Classes at the school | Coordinator manages cohorts; scoped to their school only. |
| **NGO partners** | `ngo` | NGO / funders | Sponsored cohorts | Funder sees **aggregate, de-identified** cohort reports only. |
| **Community outreach** | `community` | Free to learners | Volunteer-led classes at churches, mosques, community venues in under-privileged areas | Volunteer tutors; the mission strand. |

**The strategic link:** the school/NGO/community strands *are* the access route for learners who can't self-serve on a phone at home. The business (private) and the mission (outreach) are the same platform, and the paid strands sustain the free one.

---

## 3. Where we are today (honest baseline)

- **Live:** Supabase-first React LMS — public site, auth, student/tutor/admin dashboards, assignment submission/marking via RPC, admin MFA, audit logging, Odie AI assistant (OpenRouter-backed), careers.
- **Partial:** an informal NGO concept (`ngo_partners` + `ngo_partner_id`) but **no real organisation isolation yet**; parent and NGO dashboards not built; volunteer logging exists in the legacy Fastify API.
- **Known debt (from `AUDIT.md`):** 4 Critical issues — admin-MFA bypass via the legacy API login, an RLS policy that lets students bypass the submission RPC, no POPIA erasure path for Supabase data, and a process-crash handler that doesn't exit. Plus two parallel backend stacks (Supabase + Prisma) modelling the same entities.
- **Content:** flat model, no taxonomy. The CAPS Maths Gr 8–12 spine is now **mapped** ([MATHS_CURRICULUM_MAP.md](MATHS_CURRICULUM_MAP.md)) but **not yet built as tables or authored**.

---

## 4. Where we're heading (the pathway)

Phases are ordered by dependency and risk, not calendar dates (small team, ASAP cadence — we pull the next item when the previous is verified). **Rule: security-foundational work precedes anything that onboards a new organisation or a real learner cohort.**

### Phase A — Harden the foundation *(must precede external onboarding)*
- Fix the 4 Critical `AUDIT.md` findings (admin-MFA server-side enforcement, submission-RPC bypass, POPIA erasure path, process-exit handler).
- **Consolidate onto a single Supabase stack** and retire Prisma/Fastify ([ADR-0003](../architecture/ADR-0003-single-stack-supabase.md)) — move the trusted backend jobs (Odie AI proxy, email, scheduled jobs) to Supabase Edge Functions, strangler-fig style. This alone closes the admin-MFA-bypass and split-audit-trail bug classes.
- **Exit criteria:** no open Critical/High security findings on the paths a new org would touch; one auth authority, one audit trail.

### Phase B — Multi-organisation model *(unblocks schools/NGO/community)*
- Implement [ADR-0002](../architecture/MULTI_ORG_MODEL_PLAN.md): `organizations`, `organization_members`, org-scoped RLS, aggregate-only partner reporting, small-cohort suppression.
- Phased zero-break migration (add → backfill → enforce → clean up).
- **Move Supabase to Pro ($25/mo)** before onboarding any real external cohort — free tier has no backups and pauses after 7 days' inactivity, both unacceptable for minors' PII under POPIA ([ADR-0003](../architecture/ADR-0003-single-stack-supabase.md) hosting note).
- **Exit criteria:** the cross-org isolation test suite is green — a coordinator/tutor/viewer of Org A can read zero rows from Org B; production DB has automated backups.

### Phase C — Content taxonomy + Maths authoring *(the learner value)*
- Build `subjects → topics → concepts → content objects` tables; seed from the Maths curriculum map.
- Stand up the content pipeline: `draft (AI) → teacher_review → approved → published` (teacher-review gate is non-negotiable).
- Author **depth-first**: Grade 12 Paper-1 topics first, then outward.
- Build our own **practice/diagnostic item bank** mapped to concept slugs.
- **Exit criteria:** a learner can work a full Grade 12 Paper-1 topic end to end (lesson → practice → diagnostic → progress signal).

### Phase D — People: tutor hiring + volunteer onboarding
- Recruitment funnel and **safeguarding/vetting** gate ([TUTOR_AND_VOLUNTEER_MODEL.md](TUTOR_AND_VOLUNTEER_MODEL.md)).
- Paid vs volunteer engagement tracking; volunteer-hour logging for the community strand.
- **Exit criteria:** a new tutor/volunteer can't be assigned to a learner until vetting is recorded as passed.

### Phase E — User-centric dashboard + data-light mode
- Redesign the student landing around the two questions ("what do I do next?" / "am I okay?") with progressive disclosure, on the existing brand.
- Ship **data-light mode**; consolidate the duplicate `academy.*` design tokens into `brand.*`.
- Coordinator and partner-viewer dashboards (aggregate-only for viewers).
- **Exit criteria:** first-load data weight under budget on a low-end device; each role sees a focused, role-appropriate surface.

### Phase F — Reach & scale
- Full offline PWA (beyond data-light), isiXhosa/Afrikaans content layer, more subjects, more community sites.

**Dependency spine:** A → B → C are strictly ordered. D and E can overlap C once B is done. F is later.

---

## 5. How the pieces connect (so we don't lose the thread)

```
North Star (this doc)
├── WHO we serve ......... 4 strands → organisations (ADR-0002 multi-org model)
├── WHAT we teach ........ CAPS taxonomy (Maths map) → content pipeline
├── WHO delivers ......... tutors (paid) + volunteers → safeguarding (Tutor/Volunteer model)
├── HOW it's built safe .. Supabase-first + RLS (ADR-0001) + audit fixes (AUDIT.md)
└── HOW it feels ......... user-centric dashboard, brand kept, data-light, inclusion-first
```

Every strand of work traces back to a line in the North Star. If a proposed feature doesn't, question it.

---

## 6. Guardrails we keep checking against

1. **Does it work for the constrained learner?** (cheap phone, prepaid data, load-shedding, shared device.)
2. **Is a minor safe?** (vetting, scoped access, no cross-learner exposure.)
3. **Is org data isolated?** (no cross-org leakage; aggregate-only for funders.)
4. **Does content pass teacher review before a learner sees it?**
5. **Are we adding cognitive load or removing it?**
6. **Does the paid side still sustain the free side?**

---

## 7. Open threads to work through next (documentation backlog)

We're deliberately front-loading documentation so the build is solid.

**Done:** Safeguarding & child-protection policy (legal review pending) · Content authoring pipeline spec · Two-stack decision (ADR-0003) · Multi-org model (ADR-0002) · Coordinator & onboarding flows · POPIA data-map for the Supabase schema (retention + erasure design, closes an AUDIT.md Critical).

**Still to draft:**
- **Data-light / offline strategy spec** (budgets, caching, sync) — deferred until we know our resources.

The strategic/foundational documentation set is now complete end to end (North Star → strands → curriculum → content pipeline → people/safeguarding → data model → onboarding → compliance). Next effort shifts from documenting to **building Phase A** (harden the foundation).
