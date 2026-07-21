# Multi-Organisation Data Model — Design & Implementation Plan

**Status:** **Accepted 2026-07-08.** Serves as **ADR-0002**. Open questions resolved (§11).
**Owner decision needed:** resolved (see §11).
**Depends on / relates to:** `docs/architecture/ADR-0001-supabase-first.md`, `docs/product/CONTENT_AND_PRODUCT_STRATEGY.md` (§6), `AUDIT.md` (Critical RLS findings).
**Scope:** Supabase browser-facing schema (`docs/supabase/schema.sql`). Prisma/Fastify finance tables are a follow-on (§9).

---

## 1. Objective

Introduce a first-class **organisation** boundary so Project Odysseus can safely serve, side by side:

- **Direct** private tutoring clients (today's business),
- **NGO** partners running sponsored cohorts,
- **Schools** running classes at primary and high-school level,
- **Community** outreach programmes — volunteer-led classes hosted at churches, mosques, and community venues in under-privileged areas (see `docs/product/ROADMAP.md` and `TUTOR_AND_VOLUNTEER_MODEL.md`),

**without any organisation's learner data being visible to another.** An NGO coordinator seeing another NGO's cohort, or a school seeing another school's learners, is a **POPIA breach** — so isolation must be enforced in the database (RLS), not just the UI.

### Why now
The current model has **no organisation concept** — isolation is per-individual-row only (`AUDIT.md`, Phase 1/3). Retrofitting an org boundary after NGO/school data already exists is far more dangerous than adding it before. This is the foundational step in the strategy doc's sequence (§7).

### Non-goal (v1)
A learner belonging to **two** organisations at once (e.g. a school pupil who also buys private tutoring). We model **one primary organisation per student** in v1 and revisit multi-org students later (§11).

---

## 2. What already exists (build on, don't reinvent)

From `docs/supabase/schema.sql`:

- `ngo_partners` (`:23`) — a partial org concept already exists for NGOs.
- `students.ngo_partner_id` (`:41`) and `classes.ngo_partner_id` (`:210`) — students and classes can already point at an NGO.
- `classes` (`:200`) + `class_enrollments` (`:221`) — cohort/class structure exists.
- `tutor_student_allocations` (`:230`) — tutor↔student links exist.
- `user_role` enum (`:6`) = `student, tutor, admin, parent, ngo_partner` — flat, not org-scoped.

**Plan:** generalise `ngo_partners` into `organizations`, and promote the informal `ngo_partner_id` links into a proper `organization_id` everywhere, keeping NGO as one org *type*.

---

## 3. Proposed data model

### 3.1 New enum
```sql
create type public.organization_type as enum ('direct', 'ngo', 'school', 'community');
create type public.org_member_role as enum ('coordinator', 'tutor', 'student', 'parent', 'partner_viewer');
```
- `community` = volunteer-led outreach cohorts hosted at a church/mosque/community venue. Modelled as an org so its classes and (aggregate) reporting isolate exactly like any other; the host venue is captured in `organizations.location`. Learners are usually free; tutors are usually volunteers (see `TUTOR_AND_VOLUNTEER_MODEL.md`).
- `coordinator` = an org-scoped admin (school coordinator, NGO programme manager). NOT a platform admin.
- `partner_viewer` = NGO/funder who may see **aggregate, de-identified** cohort reporting only (no learner PII).
- Platform staff (Odysseus team) keep the existing `profiles.role = 'admin'` and are **cross-org operators** (§4).

### 3.2 `organizations` (generalises `ngo_partners`)
```sql
create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  type          public.organization_type not null,
  contact_person text,
  contact_email text,
  contact_phone text,
  location      text,
  notes         text,
  status        public.record_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```
A single seeded **`direct` org** ("Project Odysseus — Direct") is the home for all existing private clients.

### 3.3 `organization_members` (staff can span multiple orgs)
```sql
create table public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  org_role        public.org_member_role not null,
  status          public.record_status not null default 'active',
  created_at      timestamptz not null default now(),
  unique (organization_id, profile_id, org_role)
);
```
- A **tutor** can be a member of several orgs (private + an NGO cohort + a school).
- A **coordinator** / **partner_viewer** is a member of exactly the org(s) they manage/fund.
- **Students** get their org from `students.organization_id` (below), not from this table — a student has exactly one home org, which is simpler and safer to reason about in RLS.

### 3.4 Org column added to org-owned tables
```sql
alter table public.students add column organization_id uuid references public.organizations(id);
alter table public.classes  add column organization_id uuid references public.organizations(id);
alter table public.assignments add column organization_id uuid references public.organizations(id);
-- (added nullable first, backfilled, then set NOT NULL — see §7)
```
`assignment_submissions`, `student_progress`, `payments`, `class_enrollments` **inherit** their org via their parent (`student_id` / `class_id` / `assignment_id`), so they do **not** need their own column — RLS derives org through the join. This keeps the column footprint minimal and avoids org-mismatch bugs.

### 3.5 Content taxonomy is global, not org-scoped
The CAPS content spine (`subjects → topics → concepts → lessons/guides/items`, per the curriculum map) is **platform-owned and shared across all orgs** — the curriculum is national. Only **assignments** (a tutor/coordinator handing specific work to a cohort) are org-scoped. This is why `assignments` gets an `organization_id` but `concepts`/`lessons` do not.

### 3.6 Relationship sketch
```
organizations (direct | ngo | school)
   ├─ organization_members ── profiles        (staff: coordinator/tutor/partner_viewer)
   ├─ students (organization_id)              (one home org per learner)
   │     ├─ class_enrollments ── classes (organization_id)
   │     ├─ assignment_submissions ── assignments (organization_id)
   │     └─ student_progress ── concepts (GLOBAL)
   └─ classes (organization_id) ── tutors
```

---

## 4. Role & trust hierarchy

| Actor | Scope | Access |
|---|---|---|
| **Platform admin** (`profiles.role='admin'`, Odysseus staff) | Cross-org | Operator/responsible party; full operational access across orgs, MFA-gated. |
| **Coordinator** (`org_member_role='coordinator'`) | Their org only | Manage that org's classes, enrolments, tutors, learners; org-level reports. |
| **Tutor** (`org_member_role='tutor'`) | Their org(s), their assigned learners/classes | Existing tutor rights, now filtered by org membership. |
| **Student** (`students.organization_id`) | Self | Own dashboard/data (unchanged). |
| **Parent** (via `student_guardians`) | Linked learners' released data | Unchanged; naturally org-scoped through the student link. |
| **Partner viewer** (`org_member_role='partner_viewer'`) | Their org, **aggregate only** | **No direct PII access** — aggregate cohort reports via RPC only (§5). |

Platform admin remains cross-org because Odysseus is the **responsible party/operator** under POPIA. Coordinators and partner viewers are **separate parties** and must be hard-scoped to their own org.

---

## 5. RLS strategy

### 5.1 New helper functions (SECURITY DEFINER, `set search_path = public`)
```sql
-- orgs the current user is an active member of (staff)
create function public.current_org_ids() returns setof uuid ...
-- the org a student profile belongs to
create function public.current_student_org_id() returns uuid ...
-- role check within a specific org
create function public.current_org_role(org uuid) returns public.org_member_role ...
-- platform staff
create function public.is_platform_admin() returns boolean ...   -- profiles.role = 'admin'
```
These mirror the existing `current_profile_id()` / `current_student_id()` helpers and must be **indexed-backed** (see §8) because they run on every row check.

### 5.2 Policy pattern (example: `classes`)
```sql
create policy classes_org_scoped_read on public.classes for select
using (
  public.is_platform_admin()
  or organization_id in (select public.current_org_ids())   -- coordinator/tutor in that org
);

create policy classes_coordinator_manage on public.classes for all
using (
  public.is_platform_admin()
  or public.current_org_role(organization_id) = 'coordinator'
)
with check (
  public.is_platform_admin()
  or public.current_org_role(organization_id) = 'coordinator'
);
```
Every existing student/tutor ownership policy gains an **`AND organization_id`-derived-org membership** clause. Ownership *and* org must both hold — defence in depth, so an org-scoping bug can't alone leak cross-org, and an ownership bug can't alone leak cross-org.

### 5.3 Partner-viewer aggregate access (POPIA-critical)
`partner_viewer` gets **no SELECT policy** on `students`, `assignment_submissions`, `student_progress`, or `guardians`. Their only path is a `SECURITY DEFINER` reporting RPC, e.g. `get_org_cohort_report(org_id)`, that:
- verifies the caller is an active `partner_viewer` of `org_id`,
- returns **aggregates only** (counts, averages, distributions), **no learner names, IDs, guardian contacts, or individual feedback**.
This matches the existing NGO-aggregate reporting intent in the schema and closes the audit's concern about cross-party PII exposure.

---

## 6. Interaction with existing AUDIT.md findings

We are reworking the RLS surface org-wide, so this is the moment to fix the RLS Criticals **in the same pass** rather than layering org logic over known holes:

- **Submission-insert RPC bypass** (`schema.sql:1048`, AUDIT.md Critical) — the new org-scoped submission policies must replace, not sit beside, the permissive `submissions_student_rpc_insert_shape` policy.
- **Draft-assignment over-exposure** (`schema.sql:990`, High) — fold the `status='published'` scoping into the new org-scoped assignment read policy.
- **`ngo_partners` had RLS on but zero policies** (Medium) — resolved naturally: the table becomes `organizations` with real policies.

**Sequencing rule:** do not ship org isolation on top of an already-bypassable submission policy. Fix the bypass as part of Phase 2.

---

## 7. Migration plan (zero-break, phased)

**Phase 0 — Prep**
- Add `organization_type` / `org_member_role` enums.
- Create `organizations`; seed one `direct` org.

**Phase 1 — Backfill (additive, nothing enforced yet)**
- Migrate `ngo_partners` rows → `organizations` (type `ngo`), preserving IDs where possible.
- Add nullable `organization_id` to `students`, `classes`, `assignments`.
- Backfill: NGO-linked students/classes → their NGO org; everyone else → the `direct` org.
- Create `organization_members` from existing tutors (member of the orgs their classes/allocations touch) and coordinators (manually assigned for pilot orgs).

**Phase 2 — Enforce**
- Add `current_org_*` helpers + indexes.
- Add org-scoped RLS policies **alongside** existing ones; run the full RLS/IDOR test suite (§8).
- Fix the submission-insert bypass and draft-assignment exposure in the same migration.
- Once tests pass, set `organization_id` `NOT NULL` and remove the superseded permissive policies.

**Phase 3 — Cleanup**
- Drop `students.ngo_partner_id` / `classes.ngo_partner_id` (now `organization_id`).
- Deprecate direct `ngo_partners` references in `lms-api` and frontend.
- Update `docs/supabase/schema.sql` (canonical) and regenerate the local migration mirror.

Each phase is a separate reviewable migration. **No phase drops or tightens anything until the additive version is verified in tests.**

---

## 8. Testing & indexes

**Indexes** (RLS helpers run per row — these are not optional):
- `organization_members(profile_id, status)`, `organization_members(organization_id, org_role)`
- `students(organization_id)`, `classes(organization_id)`, `assignments(organization_id)`

**Tests** (extend the existing `test:rls` + `lms-api` RBAC suites):
1. **Cross-org isolation (the headline test):** a coordinator/tutor/partner_viewer of Org A cannot read *any* row belonging to Org B — students, classes, submissions, progress, reports.
2. **Partner-viewer PII denial:** a `partner_viewer` gets zero rows from `students`/`submissions` directly, and the aggregate RPC returns no names/IDs.
3. **Platform admin cross-org:** confirmed still works (operator access), MFA-gated.
4. **Backfill correctness:** every existing student/class/assignment lands in exactly one org; no NULLs after Phase 2.
5. **Regression:** existing student/tutor/parent flows unchanged for the `direct` org.

Cross-org isolation is the test that must exist before a single real NGO/school is onboarded.

---

## 9. Follow-on (out of scope for v1)

- **Finance tables** (Prisma: `Invoice`, `PayPeriod`, etc.) will likely need an `organization_id` when billing differs per org (school invoiced vs. private parent). Backend-only; can follow once the browser-facing model is stable.
- **Multi-org students** (a learner in a school *and* private tutoring) — needs a student↔org join instead of a single column; defer until there's real demand.
- **Org-level branding/config** (a school's name/logo on their cohort's dashboard) — natural extension once `organizations` exists.

---

## 10. Milestones

1. Accept this plan → promote to ADR-0002. **✅ Done (2026-07-08).**
2. **Phase 0–1 migration (orgs + backfill) behind no behaviour change. ✅ Landed 2026-07-21.**
   `docs/supabase/schema.sql`: added the `organization_type` / `org_member_role` enums, the
   `organizations` table (generalises `ngo_partners`, which stays in place until Phase 3),
   `organization_members`, and nullable `organization_id` on `students` / `classes` /
   `assignments`. Seeded the `direct` org and backfilled: NGO-linked students/classes → their
   NGO org (via a preserved-ID copy of `ngo_partners` into `organizations`), everyone else →
   `direct`; assignments (no NGO signal in the current schema) all land in `direct` for now;
   `organization_members` backfilled for tutors from their classes and active
   `tutor_student_allocations`. Coordinators are **not** backfilled — nothing in the current
   schema marks a profile as a coordinator, so pilot-org coordinators still need manual
   platform-admin assignment (§11.2). `organization_id` remains nullable and no RLS policy
   references it yet — this phase is intentionally inert. `npm run test:rls` and
   `npm run typecheck` both green after the change.
3. Phase 2 migration (RLS enforcement + audit-fix) with the cross-org test suite green. **Not started** — `current_org_*` helpers, org-scoped policies, `organization_id` `NOT NULL`, and the submission-insert/draft-assignment audit fixes (§6) are all still to do.
4. Coordinator + partner-viewer dashboards (frontend) — scoped, aggregate-only for viewers. **Not started**, depends on 3.
5. Phase 3 cleanup + docs (drop `ngo_partner_id` columns, retire direct `ngo_partners` references). **Not started**, depends on 3.

---

## 11. Resolved decisions (2026-07-08)

1. **Platform admin scope** — ✅ Platform admin (Odysseus staff) has **full control across every organisation** (operator/responsible party), MFA-gated. Coordinators and partner viewers remain hard-scoped to their own org.
2. **Coordinator provisioning** — ✅ Platform-admin-only to start (same trusted path as admin provisioning today); an invite flow can come later.
3. **One org per student** — ✅ Yes for v1. A learner belonging to two orgs at once is deferred (§9).
4. **Partner-viewer granularity** — ✅ Per-cohort aggregates only (not per-class), to minimise re-identification risk.
5. **School hierarchy depth** — ✅ Flat `organization → class` for v1 (no `school → grade → class` tree).
6. **Small-cohort suppression** — ✅ Yes. Aggregate reports **suppress stats for cohorts below a threshold (default N < 5 learners)** to prevent re-identification — a concrete POPIA safeguard. Threshold is a config value.
