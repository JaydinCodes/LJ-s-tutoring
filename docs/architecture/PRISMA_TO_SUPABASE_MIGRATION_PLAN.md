# Prisma → Supabase Data Migration Plan

**Status:** Draft for decisions. This is the plan that unblocks the rest of the
single-stack migration ([ADR-0003](ADR-0003-single-stack-supabase.md)).
**Depends on / coordinates with:** [ADR-0002 multi-org model](MULTI_ORG_MODEL_PLAN.md) — every table that moves to Supabase must be designed with `organization_id` from day one, not retrofitted.
**Owner decisions required:** yes — §3D and §6 (keep/cut per feature domain).

---

## 1. The core insight: this is a triage, not a lift-and-shift

The legacy Fastify database has **46 Prisma models**; Supabase currently has **18 tables**. The migration's job is **not** to copy all 46 into Supabase. It is to decide, per model:

- **Retire** (already in Supabase, or dies with the Fastify auth stack), or
- **Migrate** (genuinely-needed operational data with no Supabase home yet), or
- **Decide keep-or-cut** (a feature whose priority is questionable against the roadmap).

Doing this triage first means we migrate ~15 tables, retire ~13, and consciously choose on ~12 — instead of blindly porting 46. **The migration is also the moment to prune features the product no longer wants.** Given the roadmap (content-first Maths, NGO/schools, confidence-building — see business direction), some legacy community/gamification features are candidates to cut rather than carry forward.

---

## 2. The linchpin: `sessions`

The Prisma `Session` model (tutor + student + assignment, date/times, attendance, notes, payout override, `DRAFT→submitted→approved` status) is the **operational core**. Attendance, weekly reports, and payroll all derive from it (`Session → InvoiceLine → Invoice`; `Session → attendance → WeeklyReport`). **Nothing operational migrates cleanly until `sessions` is in Supabase.** It is the first migration target and the dependency root for the whole finance/reporting chain.

---

## 3. Full model triage

### A. Retire — already represented in Supabase (delete Prisma copy after cutover)
| Prisma model | Supabase home | Note |
|---|---|---|
| `Student` | `students` | Keep Supabase; reconcile guardian PII (audit finding). |
| `StudentCareerProfile` | `student_career_profiles` | **Already cut over** — frontend reads/writes Supabase (step 1b). |
| `TutorProfile` | `tutors` | Supabase minimal; migrate the richer approval/qualification fields (→ §3C tutor-onboarding). |
| `AuditLog` | `audit_log` | Divergent shapes; unify on the Supabase append-only table. |
| `PrivacyRequest` | `privacy_requests` | Supabase table exists (Phase A); migrate open requests' data. |
| `Assignment` | `assignments` | ⚠️ **Divergent concept** — Prisma `Assignment` = a tutor-student *engagement/contract*; Supabase `assignments` = *homework*. These are different entities sharing a name. The engagement concept likely becomes part of `tutor_student_allocations` / `sessions`; decide explicitly. |

### B. Retire with the Fastify stack — no Supabase table needed
These die when legacy cookie-auth / backend infra is removed (ADR-0003):
`User` (→ Supabase Auth + `profiles`), `MagicLinkToken`, `EmailOtpToken`, `ImpersonationSession`, `AuthEventLog`, `RetentionEvent` (Supabase now has `run_retention_cleanup`), `JobQueue` (→ Supabase scheduled functions / pg_cron).

### C. Migrate — operational data with no Supabase home (the real work)
Grouped by domain (see §4 for keep/cut and target shapes):
- **Sessions & attendance:** `Session`, `SessionHistory`
- **Finance / payroll:** `Invoice`, `InvoiceLine`, `PayPeriod`, `Adjustment`
- **Reports & notifications:** `WeeklyReport`, (student notifications)
- **Tutor onboarding:** `TutorApplication`, `TutorDocument`, `TutorAvailabilitySlot`
- **Tutor↔student mapping:** `TutorStudentMap` → ⚠️ **duplicates** Supabase `tutor_student_allocations`; reconcile into one.
- **Academic extras:** `LearningAssignment`, `BaselineAssessment`, `LearningGoal`, `StudentExamEvent`
- **Volunteering:** `VolunteerEvent`, `VolunteerLog` (ties to the tutor/volunteer model)
- **Gamification:** `StudyActivityEvent`, `StudyStreak`

### D. Decide keep-or-cut — question priority against the roadmap ⚠️ owner call
| Prisma model(s) | Feature | Recommendation |
|---|---|---|
| `StudyRoom`, `StudyRoomMember`, `StudyRoomMessage`, `StudyRoomPinnedResource`, `CommunityProfile` | Community study rooms | **Defer or cut** for v1 — not core to content-first Maths; heavy to migrate + moderate. |
| `Challenge`, `ChallengeSubmission` | Weekly challenges (gamification) | Defer or cut. |
| `Question`, `Answer` | Community Q&A | Defer or cut. |
| `CommunityReport`, `CommunityBlock` | Community moderation | Only if community stays. |
| `StudentScoreSnapshot`, `CareerProgressSnapshot` | Predictive scores / risk | Keep if the tutor risk view is used; else cut. |
| `CareerGoalSelection` | Career goal picks | Likely fold into `student_career_profiles`. |

---

## 4. Per-domain target design (high level)

Every migrated table gets `organization_id` (ADR-0002) and RLS from the start.

- **`sessions`** — tutor/student/assignment FKs, date/times, attendance, notes (private notes admin/owning-tutor only via RLS), status, org. RLS: tutor sees own sessions, admin all, student sees a safe subset. *First to migrate.*
- **`session_history`** — append-only change log for sessions (mirror audit-immutability pattern).
- **Finance** (`pay_periods`, `invoices`, `invoice_lines`, `adjustments`) — admin-only RLS; org-scoped; derived from `sessions`. Migrate after sessions. Preserve the 7-year financial retention (already in `run_retention_cleanup`).
- **`weekly_reports`** — per-student report payload (jsonb) + week range; RLS: student/guardian read released, tutor/admin manage. Rebuild `buildWeeklyReportPayload` against Supabase (`sessions`, `student_progress`, `assignment_submissions`).
- **`notifications`** — per-user notifications; RLS owner-read.
- **Tutor onboarding** (`tutor_applications`, `tutor_documents`, `tutor_availability`) — ties into the vetting gate (tutor/volunteer model). Documents → private Storage bucket.
- **Reconcile** `TutorStudentMap` ↔ `tutor_student_allocations` into the single Supabase table.
- **Academic extras / volunteering / gamification** — migrate only the ones that survive §3D triage.

---

## 5. Migration mechanics (per table, strangler-fig)

For each table, in order:
1. **Schema first** — add the table + RLS to `docs/supabase/schema.sql` (with `organization_id`), validate against Postgres 16 (the loop-clean check we already use).
2. **Backfill data** — export existing rows from the Prisma DB, transform (map columns, assign `organization_id` = the `direct` org), import into Supabase. One-off script per table; verify row counts.
3. **Repoint reads** — move the frontend/repository read to Supabase (like step 1).
4. **Repoint writes** — move mutations to RPC (privileged) or direct RLS-scoped writes.
5. **Verify** — typecheck + tests + a functional check; run the cross-org isolation tests.
6. **Retire** — delete the Fastify route + Prisma model once nothing reads it.

**No table is cut over until its Supabase version is backfilled and verified.** Dual-run (Fastify still available) until each domain is proven.

---

## 6. Sequencing (recommended)

1. **Reconcile the duplicates first** (§3A) — cheapest wins; removes confusion (esp. `TutorStudentMap` vs `tutor_student_allocations`, and the `Assignment` concept clash).
2. **Sessions & attendance** — the linchpin; unblocks everything operational.
3. **Finance / payroll** — depends on sessions.
4. **Weekly reports + notifications** — depend on sessions.
5. **Tutor onboarding** — ties to the vetting gate; needed before hiring beyond family/friends.
6. **Decide §3D (community/gamification)** — then migrate survivors or delete.
7. **Retire the Fastify stack** (§3B) and decommission `lms-api`.

Coordinate with **ADR-0002**: ideally the multi-org model lands *around* the sessions/finance migration so those tables are born org-scoped rather than retrofitted.

---

## 7. Decisions for the owner

1. **Keep or cut the community suite** (study rooms, challenges, Q&A, moderation)? Biggest single scope lever — recommend **defer/cut for v1**.
2. **Keep the predictive-score / tutor-risk feature** (`StudentScoreSnapshot`, `CareerProgressSnapshot`)?
3. **`Assignment` concept clash** — confirm the Prisma "engagement/contract" concept folds into `tutor_student_allocations`/`sessions` (vs. Supabase `assignments` = homework).
4. **Reconcile `TutorStudentMap` → `tutor_student_allocations`** (confirm one canonical mapping table).
5. **Sequencing vs. multi-org** — do the multi-org model (ADR-0002) *before or alongside* the sessions/finance migration so migrated tables are org-scoped from day one? (Recommended: yes.)

## 8. Honest scope note

This is the **largest** piece of the single-stack migration — multiple domains, real data movement, and RLS on money and minors' operational data. It is genuinely multi-session work. The triage above is what keeps it tractable: retire ~13, migrate ~15, and cut what the roadmap doesn't need rather than carrying 46 models across.
