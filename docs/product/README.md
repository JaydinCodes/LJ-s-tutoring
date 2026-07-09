# Product Documentation — Index

The product/strategy source of truth for Project Odysseus. **Start with the Roadmap**, then drill into the specific area.

## Read in this order

1. **[ROADMAP.md](ROADMAP.md)** — North Star, the four delivery strands, where we are vs. where we're heading, phased pathway. The anchor doc.
2. **[CONTENT_AND_PRODUCT_STRATEGY.md](CONTENT_AND_PRODUCT_STRATEGY.md)** — socioeconomic design frame, content taxonomy spine, locked build decisions, user-centric dashboard model.
3. **[MATHS_CURRICULUM_MAP.md](MATHS_CURRICULUM_MAP.md)** — CAPS Grade 8–12 Maths taxonomy (~70 topics / ~250+ concepts), the content seed spec.
4. **[CONTENT_AUTHORING_PIPELINE.md](CONTENT_AUTHORING_PIPELINE.md)** — how content goes AI-draft → teacher-review → published; states, roles, data model, AI guardrails.
5. **[TUTOR_AND_VOLUNTEER_MODEL.md](TUTOR_AND_VOLUNTEER_MODEL.md)** — recruitment, paid vs volunteer, and the safeguarding/vetting gate for anyone working with minors.
6. **[COORDINATOR_AND_ONBOARDING_FLOWS.md](COORDINATOR_AND_ONBOARDING_FLOWS.md)** — how each org type is set up, the coordinator role, and learner onboarding with parental consent.

## Related (compliance, architecture & audit)

- **[../compliance/SAFEGUARDING_AND_CHILD_PROTECTION.md](../compliance/SAFEGUARDING_AND_CHILD_PROTECTION.md)** — child-protection policy, vetting standard, code of conduct, incident reporting. (Legal review pending.)
- **[../compliance/POPIA_DATA_MAP.md](../compliance/POPIA_DATA_MAP.md)** — accurate data map for the live Supabase schema; third-party/cross-border flows; retention + erasure (closes an audit Critical).
- **[../architecture/MULTI_ORG_MODEL_PLAN.md](../architecture/MULTI_ORG_MODEL_PLAN.md)** — ADR-0002, the organisation/cohort data model + RLS isolation.
- **[../architecture/ADR-0003-single-stack-supabase.md](../architecture/ADR-0003-single-stack-supabase.md)** — consolidate on Supabase, retire Prisma/Fastify.
- **[../architecture/ADR-0001-supabase-first.md](../architecture/ADR-0001-supabase-first.md)** — the Supabase-first trust boundary.
- **[../architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md)** — current implementation map.
- **`../../AUDIT.md`** — security/quality audit; the Phase-A hardening backlog.

## Status of key decisions (all locked 2026-07-08 unless noted)

- Content: AI-drafted + **teacher-review gate**, English first, data-light mode, depth-first Maths, own item bank.
- Delivery strands: private (`direct`), schools, NGO, community outreach — all as isolated `organizations`.
- Multi-org: platform admin cross-org; one org per student (v1); partner viewers see per-cohort aggregates only; flat `org → class`; small-cohort suppression (N<5).
- Brand: keep the Greek/Odysseus palette; reduce dashboard cognitive load; don't change photos.
- Stack: single Supabase stack, retire Prisma/Fastify (ADR-0003).
- People: tutors currently family/friends (informal); formal vetting gate switches on for hires/volunteers beyond the known network; re-vet every 2 yrs; volunteering mandatory 6–10 hrs/month when available; one adult per session OK.

## Documentation backlog (not yet written)

See [ROADMAP.md](ROADMAP.md) §7. Remaining: **data-light/offline spec** (deferred until we know our resources). Everything else in the initial backlog is now drafted — the foundation is documented end to end.
