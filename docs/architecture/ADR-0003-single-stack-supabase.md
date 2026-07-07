# ADR-0003: Consolidate on a Single Supabase Stack (retire Prisma/Fastify)

## Status

**Accepted 2026-07-08.** Extends [ADR-0001](ADR-0001-supabase-first.md). Execution is a phased migration (Roadmap Phase A).

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

## What lms-api still does today (accurate inventory)

The React dashboards are **already Supabase-first for their core data** — `adminDashboardRepository` / `studentDashboardRepository` etc. read students, assignments, submissions, marks, progress, classes, allocations, payments directly via `supabase.from(...)` / `supabase.rpc(...)`. lms-api is **not** where the dashboards live. But it still carries real work, in two tiers:

**Tier 1 — optional/legacy enrichment (degrades gracefully today).** Called via `optionalApiGet(path, fallback)` which returns an empty fallback on 404/unreachable, so the dashboard renders without it: `/admin/dashboard`, `/student/assignments`, `/student/results`. → Drop once the equivalent Supabase read exists (some already duplicate it).

**Tier 2 — hard dependencies (would break if lms-api vanished today), with their destination:**

| Route (still called from `src/`) | What it does | Where it goes |
|---|---|---|
| `/supabase/admin/users/invite` | Admin user invite — **holds the service-role key** | **Edge Function** (must stay server-side) |
| `/reports/generate` | PDF report generation | **Edge Function** |
| `/odie-careers/overview`, `/odie-careers/profile` | Odie AI (holds OpenRouter key) | **Edge Function** |
| `/admin/payroll/generate-week` | Payroll computation | RPC or Edge Function |
| `/admin/privacy-requests`, `/admin/retention/summary` | POPIA ops | RPC + scheduled Edge Function |
| `/admin/tutors`, `/community/rooms` | Admin/community reads | Direct Supabase read + RLS |

The point: retiring Fastify means **relocating this work, not deleting it** — mostly to Edge Functions (secret-holding / compute) plus a few RLS/RPC moves. The dashboards keep working throughout because (a) their core data is already on Supabase and (b) each route is rebuilt and repointed before its Fastify handler is removed.

## Migration approach (high level; detailed plan is a Phase-A task)

1. **Freeze** new feature work on the Fastify stack; new work is Supabase-first.
2. **Inventory** every Fastify route → classify: (a) already duplicated in Supabase (delete), (b) browser data/authz (move to RLS/RPC), (c) trusted backend (move to Edge Function).
3. **Migrate the AI proxy + email + jobs** to Edge Functions first (self-contained, high value, removes secret-key handling from a second service).
4. **Retire legacy auth routes** — the `/auth/admin/login` MFA-bypass Critical is closed by removing the second auth authority.
5. **Reconcile duplicated tables** — pick the Supabase version, migrate any needed data, drop the Prisma duplicates.
6. **Payroll/invoicing** last.
7. Decommission `lms-api/` when empty; update `ARCHITECTURE.md` and ADR-0001's "transitional Fastify" language.

## Deployment & hosting consequences

**DigitalOcean:** `.do/app.yaml` deploys two components — the `lms-api` Fastify service (Docker, `basic-xxs`) and the `website` static React site — with ingress routing `/api/*` → Fastify and everything else → the static site. Retiring Fastify:
- The **static site stays on DigitalOcean unchanged** — nothing breaks there.
- The `lms-api` **service component is removed**, and the `/api/*` ingress rules are repointed: most browser calls go direct to Supabase; the trusted ones (AI proxy, email, jobs) go to **Supabase Edge Function** URLs (`https://<project>.supabase.co/functions/v1/...`), which live on Supabase, not DO.
- Sequence to avoid downtime: **Edge Functions live → frontend repointed → then remove the Fastify service + its `/api` ingress rules.** DO's role shrinks to static hosting (could later move to Cloudflare Pages/Netlify if desired, but not required).

**Supabase tier:** the Edge Functions migration works on the **free** tier (500K invocations/month — ample at current scale). **Stay on free while building.** Move to **Pro ($25/mo) before onboarding any real external cohort with real learner data**, because the free tier has **no database backups** and **pauses projects after 7 days of inactivity** — both unacceptable for a production system holding minors' PII under POPIA. Pro adds daily backups (7-day retention), no pausing, and larger DB/storage. This upgrade is a **POPIA/reliability gate, tied to Roadmap Phase A→B**, not a scaling nicety.

## Related

- [ADR-0001](ADR-0001-supabase-first.md) — Supabase-first (this ADR completes its intent by removing the transitional second stack).
- [MULTI_ORG_MODEL_PLAN.md](MULTI_ORG_MODEL_PLAN.md) — ADR-0002; org isolation in RLS.
- `../../AUDIT.md` — the findings motivating this (schema divergence, split audit trail, admin-MFA bypass).
- `../product/ROADMAP.md` — Phase A (harden the foundation) includes this migration.
