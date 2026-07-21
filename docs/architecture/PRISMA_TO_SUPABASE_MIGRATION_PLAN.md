# Prisma → Supabase Data Migration Plan

**Status:** Decisions locked (§7). This is the plan that unblocks the rest of the
single-stack migration ([ADR-0003](ADR-0003-single-stack-supabase.md)).
**Depends on / coordinates with:** [ADR-0002 multi-org model](MULTI_ORG_MODEL_PLAN.md) — every table that moves to Supabase must be designed with `organization_id` from day one, not retrofitted. **The owner has confirmed the multi-org model lands alongside/before the sessions migration** (see §7.5) — treat ADR-0002 as in scope for this phase, not a later add-on.

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
| `Assignment` | `assignments` | ⚠️ **Divergent concept — RESOLVED, schema landed.** Prisma `Assignment` = a tutor-student *engagement/contract*; Supabase `assignments` = *homework*. **Decision: the engagement/contract concept folds into `tutor_student_allocations`/`sessions` (not into Supabase `assignments`, which stays homework-only).** ✅ **Schema landed (§6 step 1):** `tutor_student_allocations` now carries the genuinely-new contract fields — `subject_id` (FK to `subjects`, mapping Prisma's free-text `subject`), `rate_override numeric(12,2)`, `allowed_days_json jsonb`, `allowed_time_ranges_json jsonb` (all nullable/additive). `start_date`/`end_date`/tutor-student pairing were already present; `active` maps to the existing `status` (`record_status`) enum. `rate_override` is tutor/admin-only — the student dashboard read was narrowed to an explicit column list that excludes it. The Prisma `Assignment` model itself is retired later with the Fastify stack (§6 step 7). |

### B. Retire with the Fastify stack — no Supabase table needed
These die when legacy cookie-auth / backend infra is removed (ADR-0003):
`User` (→ Supabase Auth + `profiles`), `MagicLinkToken`, `EmailOtpToken`, `ImpersonationSession`, `AuthEventLog`, `RetentionEvent` (Supabase now has `run_retention_cleanup`), `JobQueue` (→ Supabase scheduled functions / pg_cron).

### C. Migrate — operational data with no Supabase home (the real work)
Grouped by domain (see §4 for keep/cut and target shapes):
- **Sessions & attendance:** `Session`, `SessionHistory`
- **Finance / payroll:** `Invoice`, `InvoiceLine`, `PayPeriod`, `Adjustment`
- **Reports & notifications:** `WeeklyReport`, (student notifications)
- **Tutor onboarding:** `TutorApplication`, `TutorDocument`, `TutorAvailabilitySlot`
- **Tutor↔student mapping:** `TutorStudentMap` → ⚠️ **duplicates** Supabase `tutor_student_allocations` — **RESOLVED, schema landed: reconcile into the single Supabase `tutor_student_allocations` table** (see §7.4); `TutorStudentMap` is retired, not migrated as a separate table. ✅ **`TutorStudentMap` has nothing left to migrate** — its `tutor_id`/`student_id`/`created_at` are already fully covered by `tutor_student_allocations`; it is retired (not table-migrated) once the Fastify stack goes away (§6 step 7). The engagement/contract fields from Prisma `Assignment` (§3A) have now landed on this table too.
- **Academic extras:** `LearningAssignment`, `BaselineAssessment`, `LearningGoal`, `StudentExamEvent`
- **Volunteering:** `VolunteerEvent`, `VolunteerLog` (ties to the tutor/volunteer model)
- **Growth monitoring / risk:** `StudentScoreSnapshot`, `CareerProgressSnapshot` — **KEEP** (see §3D).

### D. Keep-or-cut decisions — LOCKED

| Prisma model(s) | Feature | Decision |
|---|---|---|
| `StudyRoom`, `StudyRoomMember`, `StudyRoomMessage`, `StudyRoomPinnedResource`, `CommunityProfile` | Community study rooms | ✅ **CUT for now.** Deferred — revisit later, not part of this migration. |
| `Challenge`, `ChallengeSubmission` | Weekly challenges (gamification) | ✅ **CUT for now.** Deferred with the rest of the community suite. |
| `Question`, `Answer` | Community Q&A | ✅ **CUT for now.** Deferred with the rest of the community suite. |
| `CommunityReport`, `CommunityBlock` | Community moderation | ✅ **CUT for now.** Only needed if/when community is revived. |
| `StudentScoreSnapshot`, `CareerProgressSnapshot` | Predictive scores / risk | ✅ **KEEP — migrate.** Owner's explicit reason: track each student's growth over time and identify **where a student is failing, tied to the specific assignments they were given.** This means the scoring model should stay tightly joined to `assignments`/`assignment_submissions`/`student_progress` (topic- and assignment-level signal), not just a generic trend line — design the migrated table with that traceability in mind. |
| `CareerGoalSelection` | Career goal picks | Fold into `student_career_profiles` (unchanged from original recommendation — no objection raised). |

**Community suite is parked, not deleted from Prisma yet** — no urgency to actively drop those tables now; they simply do not get migrated to Supabase in this pass. Revisit "cut vs. revive" later per the roadmap.

---

## 4. Per-domain target design (high level)

Every migrated table gets `organization_id` (ADR-0002) and RLS from the start.

- **`sessions`** — tutor/student/assignment FKs, date/times, attendance, notes (private notes admin/owning-tutor only via RLS), status, org. RLS: tutor sees own sessions, admin all, student sees a safe subset. *First to migrate.*
- **`session_history`** — append-only change log for sessions (mirror audit-immutability pattern).
- **Finance** (`pay_periods`, `invoices`, `invoice_lines`, `adjustments`) — admin-only RLS; org-scoped; derived from `sessions`. Migrate after sessions. Preserve the 7-year financial retention (already in `run_retention_cleanup`).
- **`weekly_reports`** — per-student report payload (jsonb) + week range; RLS: student/guardian read released, tutor/admin manage. Rebuild `buildWeeklyReportPayload` against Supabase (`sessions`, `student_progress`, `assignment_submissions`).
- **`notifications`** — per-user notifications; RLS owner-read.
- **Tutor onboarding** (`tutor_applications`, `tutor_documents`, `tutor_availability`) — ties into the vetting gate (tutor/volunteer model). Documents → private Storage bucket.
- **Reconcile** `TutorStudentMap` ↔ `tutor_student_allocations` into the single Supabase table (also absorbs the Prisma `Assignment` engagement/contract fields per §3A). ✅ **Schema landed** — contract columns (`subject_id`, `rate_override`, `allowed_days_json`, `allowed_time_ranges_json`) added; student-dashboard read narrowed to exclude `rate_override`. Prisma-side retirement deferred to §6 step 7 (Fastify-stack removal).
- **Growth monitoring / risk** (`student_score_snapshots`, `career_progress_snapshots`) — org-scoped; RLS: owning student + tutor(s) + admin. **Design requirement (owner-specified):** snapshots must be traceable to the specific `assignments`/`assignment_submissions`/`student_progress` rows that drove them, so a tutor/admin can see not just "this student is struggling" but *which assignment/topic* triggered the signal. Don't build this as a black-box score.
- **Academic extras / volunteering** — migrate (`LearningAssignment`, `BaselineAssessment`, `LearningGoal`, `StudentExamEvent`, `VolunteerEvent`, `VolunteerLog`).
- **Community suite** — not migrated in this pass (§3D); remains parked in Prisma.

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

## 6. Sequencing (locked)

0. **Multi-org model (ADR-0002) lands alongside/before this work** — per §7.5, confirmed by the owner. Every table touched below is designed org-scoped from the start; do not retrofit `organization_id` later.
1. **Reconcile the duplicates first** (§3A/§3C) — `TutorStudentMap` + the `Assignment` engagement/contract fields fold into `tutor_student_allocations`. Cheapest win; removes confusion before anything else moves.
2. **Sessions & attendance** — the linchpin; unblocks everything operational.
3. **Finance / payroll** — depends on sessions.
4. **Weekly reports + notifications** — depend on sessions.
5. **Growth monitoring / risk** (`student_score_snapshots`, `career_progress_snapshots`) — depends on sessions + assignments + progress being in Supabase, since traceability to specific assignments is a hard requirement.
6. **Tutor onboarding** — ties to the vetting gate; needed before hiring beyond family/friends.
7. **Retire the Fastify stack** (§3B) and decommission `lms-api`. Community suite (§3D) stays parked in Prisma / out of scope — revisit later.

---

## 7. Decisions (locked by owner)

1. **Community suite** (study rooms, challenges, Q&A, moderation) — ✅ **Cut for now.** Not migrated; parked in Prisma for possible later revival.
2. **Predictive-score / tutor-risk feature** (`StudentScoreSnapshot`, `CareerProgressSnapshot`) — ✅ **Keep, migrate.** Purpose: monitor student growth over time and identify where a student is failing *in relation to the specific assignments given to them* — the migrated design must preserve that assignment-level traceability (see §4).
3. **`Assignment` concept clash** — ✅ **Go with the recommendation:** the Prisma engagement/contract concept folds into `tutor_student_allocations`/`sessions`; Supabase `assignments` stays homework-only.
4. **`TutorStudentMap` → `tutor_student_allocations`** — ✅ **Go with the recommendation:** reconcile into one canonical mapping table.
5. **Sequencing vs. multi-org** — ✅ **Multi-org (ADR-0002) lands alongside/before** the sessions/finance migration, as the owner explicitly wants. Reflected in §6 step 0.

## 8. Honest scope note

This is still the **largest** piece of the single-stack migration — multiple domains, real data movement, and RLS on money and minors' operational data, now combined with standing up the multi-org model at the same time (per the locked sequencing). It is genuinely multi-session work. The triage keeps it tractable: cutting the community suite removes ~9 models from scope entirely, leaving a focused set (sessions, finance, reports, tutor onboarding, growth/risk) to migrate — all born org-scoped from the start.
