# ADR-0003: Consolidate on a Single Supabase Stack (retire Prisma/Fastify)

## Status

**Accepted 2026-07-08. Execution complete 2026-07-24.** Extends [ADR-0001](ADR-0001-supabase-first.md). `lms-api/` (Fastify + Prisma) is fully deleted from the repo, removed from the live DigitalOcean app spec, and its CI/CD is retired. See [PRISMA_TO_SUPABASE_MIGRATION_PLAN.md §6](PRISMA_TO_SUPABASE_MIGRATION_PLAN.md) for the accurate current per-domain status — the sections below describe the plan as it stood when this ADR was accepted and are kept for historical context.

## Context

The platform currently runs **two backend stacks** for the same product:

- **Supabase** (Postgres + Auth + RLS + RPC + Storage) — the current source of truth for browser-facing data (ADR-0001).
- **Fastify + Prisma + a separate Postgres** — a large transitional API (`lms-api/`, ~10k lines across `admin.ts`, `academic.ts`, `phase3.ts`, `tutor.ts`, `auth.ts`) handling legacy cookie auth, the Odie AI proxy, email, jobs, exports, payroll/invoicing, and older admin/academic routes.

`AUDIT.md` showed the concrete cost of running both:

- The **same entities are modelled twice** with **different security models** — `students`, `assignments`, `audit_log`, `student_career_profiles` exist in both schemas with divergent rules.
- The **audit trail is split** — actions via the Supabase path never appear in the Prisma audit log and vice versa; a POPIA/incident investigation scoped to one misses the other.
- **Two auth authorities** created a **Critical** finding: the legacy `/auth/admin/login` issues an admin session with no server-side MFA, bypassing the Supabase MFA gate.
- More hosting cost (two services, two DB pools) and doubled maintenance/attack surface.

For a 5-person team moving fast, maintaining two stacks is the wrong use of effort and a recurring source of security bugs.

## Decision

**Consolidate on Supabase as the single stack. Retire the Prisma/Fastify second stack.**

- **Data + authorization:** Supabase Postgres, RLS, and RPC only (already the direction per ADR-0001).
- **Backend-only / trusted-execution work** (things that genuinely can't run in the browser) moves to **Supabase Edge Functions**:
  - the **Odie AI proxy** (holds the OpenRouter secret key server-side),
  - **email** sending,
  - **scheduled jobs** (retention cleanup, score recompute) via Supabase scheduled functions / cron,
  - **exports** and **admin service-role operations**.
- **One audit trail** — the Supabase `audit_log`, written by SECURITY DEFINER functions.
- **One auth authority** — Supabase Auth (removes the MFA-bypass class of bug).

## Consequences

- **This is a real migration, not a switch.** The Fastify route files are large and handle live features; they get retired **piece by piece** (strangler-fig): each capability is rebuilt as an Edge Function or RPC, verified, then the corresponding Fastify route is deleted. Nothing is dropped before its replacement is proven.
- **Payroll/invoicing** (the most Prisma-specific domain) is migrated last, or explicitly kept as a clearly-isolated backend module if a strong reason emerges — but the default is: move it too, so there's one source of truth.
- Reduces hosting cost, maintenance, and — most importantly — **collapses the two-auth-authority and split-audit-trail bug classes**.
- Fits the multi-org model (ADR-0002): org isolation lives entirely in RLS, with no second stack to re-implement it in.

## What lms-api did, and where each piece actually ended up (2026-07-24)

`lms-api/` is now fully deleted. This table replaces the original "still does today" inventory with what actually happened to each Tier-2 hard dependency:

| Route (was called from `src/`) | What it did | What actually happened |
|---|---|---|
| `/supabase/admin/users/invite` | Admin user invite — held the service-role key | **Done.** Edge Function `admin-invite-user`, deployed and live; `AdminUsersRoute.tsx` calls it via `supabase.functions.invoke`. |
| `/reports/generate` | PDF report generation | **Not rebuilt.** No PDF-download UI exists anywhere in `src/` — flagged as an open question (deliberate cut vs. unnoticed regression), not resolved either way. |
| `/odie-careers/overview`, `/odie-careers/profile` | Odie AI (held OpenRouter key) | **Redesigned, simpler than planned.** Overview/profile turned out not to need a server proxy at all — static bundled JSON (`src/data/odie-careers/`) + direct `student_career_profiles` reads. Only the actual chat (`/assistant/careers-chat/stream`) needed an Edge Function: `odie-careers-chat-stream`, deployed and live, Groq-backed (switched from OpenRouter after persistent free-tier rate limiting) rather than OpenRouter as originally planned. |
| `/admin/payroll/generate-week` | Payroll computation | **Done as an RPC** — `generate_payroll_week` in `schema.sql`, called from `adminPayrollRepository.ts`. |
| `/admin/privacy-requests`, `/admin/retention/summary` | POPIA ops | **Partially done.** Reads/RPC calls repointed (`loadPrivacyRequests`, `run_retention_cleanup(p_apply: false)`). The "scheduled Edge Function" half was never built — see the retention/DR gap noted in the migration plan §6 step 7. |
| `/admin/tutors`, `/community/rooms` | Admin/community reads | **Done** — direct Supabase reads + RLS, including the community suite (study rooms/challenges/Q&A), which was originally cut from scope and later un-cut and shipped natively. |

## Migration approach (historical — all steps below are now complete or explicitly closed)

1. ~~**Freeze** new feature work on the Fastify stack~~ — moot; the stack is deleted.
2. ~~**Inventory** every Fastify route~~ — superseded by the table above.
3. **Migrate the AI proxy + email + jobs to Edge Functions** — AI proxy: done (see table above). Email: never migrated (no email-sending Edge Function exists; not confirmed whether anything still needs it). Scheduled jobs (retention, score recompute): not done — no `pg_cron` schedule exists for `run_retention_cleanup()` or the risk-score recompute RPCs.
4. **Retire legacy auth routes** — done as a side effect of deleting `lms-api/` entirely; the `/auth/admin/login` MFA-bypass route no longer exists anywhere.
5. **Reconcile duplicated tables** — done per the migration plan's own table-by-table triage.
6. **Payroll/invoicing** — done for the core RPCs (see table above); invoice PDF rendering was never built.
7. **Decommission `lms-api/`** — ✅ done 2026-07-24. `ARCHITECTURE.md` still needs its "transitional Fastify" language updated to match (tracked separately).

## Deployment & hosting consequences

**DigitalOcean:** ✅ Done. `.do/app.yaml` now has only the `website` static site component — the `lms-api` service and its `/api/*` ingress rules are removed, applied to the live app, and browser-verified clean across all 4 domains (no failed requests, no console errors). Trusted work (AI proxy, admin invite) runs on **Supabase Edge Functions** (`https://<project>.supabase.co/functions/v1/...`), not DO.

**Supabase tier:** the Edge Functions migration works on the **free** tier (500K invocations/month — ample at current scale). **Stay on free while building.** Move to **Pro ($25/mo) before onboarding any real external cohort with real learner data**, because the free tier has **no database backups** and **pauses projects after 7 days of inactivity** — both unacceptable for a production system holding minors' PII under POPIA. Pro adds daily backups (7-day retention), no pausing, and larger DB/storage. This upgrade is a **POPIA/reliability gate, tied to Roadmap Phase A→B**, not a scaling nicety.

## Related

- [ADR-0001](ADR-0001-supabase-first.md) — Supabase-first (this ADR completes its intent by removing the transitional second stack).
- [MULTI_ORG_MODEL_PLAN.md](MULTI_ORG_MODEL_PLAN.md) — ADR-0002; org isolation in RLS.
- `../../AUDIT.md` — the findings motivating this (schema divergence, split audit trail, admin-MFA bypass).
- `../product/ROADMAP.md` — Phase A (harden the foundation) includes this migration.
