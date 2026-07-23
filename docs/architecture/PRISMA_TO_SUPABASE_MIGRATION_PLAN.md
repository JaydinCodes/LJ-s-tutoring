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

### Status: ✅ Supabase schema + RLS + RPC layer LANDED (schema-only; unused pending repoint)

The Supabase-native `sessions` layer is now built in `docs/supabase/schema.sql` and locked by `tests/frontend/sessions-migration.test.cjs` (wired into `test:rls`). What landed:

- **Tables:** `public.sessions` (org-scoped from birth, `organization_id NOT NULL`, `tutor_student_allocation_id` replacing Prisma's `assignment_id`) and append-only `public.session_history` (mirrors the `audit_log` immutability pattern). `public.session_status` enum (`draft/submitted/approved/rejected`, lowercase per this schema's convention).
- **Org derivation:** a **dedicated** `fill_session_organization_id()` before-insert trigger that derives a session's org from its **student** (`students.organization_id`) — deliberately NOT the generic multi-org `fill_organization_id()` fallback chain, which could misfile a session created by an admin or multi-org tutor.
- **RLS:** no direct writes for anyone (`with check (false)`/`using (false)`), admin + own-tutor SELECT only, students have zero direct policies (read only via `get_student_sessions()`), following the `assignment_submissions` precedent.
- **RPC business-logic layer (all `SECURITY DEFINER`, identity resolved internally via `current_tutor_id()`/`is_platform_admin()`):** `create_session`, `update_session`, `submit_session_report`, `submit_session`, `approve_session`, `reject_session`, the student read `get_student_sessions()`, and the locked-down internal `insert_session_history()` helper — porting Fastify's window/overlap/duration validation and the full `DRAFT→SUBMITTED→APPROVED/REJECTED` state machine with distinct error codes.

**Explicitly deferred (NOT done in this step, by design):**
- **(a) Real data backfill** from the Prisma `sessions`/`session_history` tables — this step is schema-only, no rows moved.
- **(b) Frontend repoint** — tutor/admin/student UIs still call the Fastify `lms-api` session routes; `src/` and `lms-api/` are untouched.
- **(c) Pay-period-lock wiring** — ✅ **now wired up.** `session_date_pay_period_locked()` was a stub returning `false`; the finance/payroll step (§6 step 3, below) landed `pay_periods` and un-stubbed it to the real lock lookup (resolves the date's Monday week-start via `date_trunc('week', …)` and returns `true` iff a `pay_periods` row exists with `status = 'locked'`). The call sites in the session RPCs were already in place, so no session-RPC change was needed.
- **(d) Student-notification dispatch** — ✅ **now wired up.** The `createStudentNotification` side effects on report-update/submit/approve/reject were skipped pending the notifications table. The weekly-reports/notifications step (§4B / §6 step 4, below) landed `student_notifications` + the `create_student_notification()` helper and amended `submit_session_report` / `submit_session` / `approve_session` / `reject_session` to dispatch the `session_report_updated` / `session_report_submitted` / `session_approved` / `session_rejected` notifications (loop closed).
- **(e) Retirement of the Fastify session routes** — happens at §6 step 7.
- Also using `tutors.status = 'active'` as the best-available `ensureTutorActive` equivalent until the richer tutor-onboarding approval model migrates (§6 step 6). ✅ **Now upgraded** — the tutor-onboarding step (§4C, §6 step 6) added `approval_status` to `tutors` and amended all five checks to require `status = 'active' and approval_status = 'approved'` (full Fastify parity — the third and final deferred-loop closure in this series).

---

## 3. Full model triage

### A. Retire — already represented in Supabase (delete Prisma copy after cutover)
| Prisma model | Supabase home | Note |
|---|---|---|
| `Student` | `students` | Keep Supabase; reconcile guardian PII (audit finding). |
| `StudentCareerProfile` | `student_career_profiles` | **Already cut over** — frontend reads/writes Supabase (step 1b). |
| `TutorProfile` | `tutors` | ✅ **Schema landed (§4C).** Supabase `tutors` now carries the richer approval/qualification fields (`qualification_band`, `qualified_subjects_json`, `approval_status`, `approval_reviewed_by`/`approval_reviewed_at`/`approval_note`, `teaching_preferences_json`); identity fields stay on `profiles`, `active` folds into `status`. |
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
- **Academic extras:** `LearningAssignment` (⚠️ **CUT during this step, see §7 decision 6** — not migrated), `BaselineAssessment`, `LearningGoal`, `StudentExamEvent` — ✅ **Schema landed (the three kept models) — see §4E below.**
- **Volunteering:** `VolunteerEvent`, `VolunteerLog` (ties to the tutor/volunteer model) — ✅ **Schema landed — see §4E below.**
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
- **Finance** (`pay_periods`, `invoices`, `invoice_lines`, `adjustments`) — admin-only RLS; org-scoped; derived from `sessions`. Migrate after sessions. Preserve the 7-year financial retention (already in `run_retention_cleanup`). ✅ **Schema landed — see §4A below.**

### 4A. Finance / payroll — Status: ✅ Supabase schema + RLS + payroll RPC layer LANDED (schema-only; unused pending repoint)

The Supabase-native finance layer is now built in `docs/supabase/schema.sql` and locked by `tests/frontend/finance-payroll-migration.test.cjs` (wired into `test:rls`). What landed:

- **Enums:** `pay_period_status` (`open/locked`), `invoice_status` (`draft/issued/paid`), `adjustment_type` (`bonus/correction/penalty`), `adjustment_status` (`draft/approved`), `invoice_line_type` (`session/adjustment`) — all lowercase per this schema's convention (Prisma's were uppercase).
- **Tables:** `public.pay_periods` (unique `period_start_date`, `locked_by → profiles`), `public.adjustments` (positive-magnitude `amount` with `check (amount > 0)`; sign applied at read/generation time), `public.invoices` (unique `invoice_number`), `public.invoice_lines` (session/adjustment lines). **No `organization_id` on any of them** — deliberate per `MULTI_ORG_MODEL_PLAN.md` §9, which defers finance-table org-scoping as backend-only follow-on work. Prisma's vestigial nullable `Invoice.userId` was intentionally not replicated.
- **RLS:** no direct writes for anyone (`with check (false)`/`using (false)`, following the `sessions` precedent so every write goes through the RPCs and their precondition checks); admin SELECT all on every table; `adjustments`/`invoices`/`invoice_lines` also allow a **tutor to SELECT their own** (unredacted — the line fields are exactly what a tutor should see about their own pay); `pay_periods` is admin-only end to end; no student policy anywhere (students never see tutor pay).
- **RPC business-logic layer (all `SECURITY DEFINER`, admin-gated via `is_platform_admin()`):** `get_or_create_pay_period`, `generate_payroll_week` (the core algorithm — session-lines at `duration/60 * coalesce(allocation.rate_override, tutor.hourly_rate)` + signed adjustment-lines, `INV-<weekStart>-<tutorId[:8]>` numbering, `issued` invoices), `lock_pay_period` (refuses on pending `submitted` sessions, generates first if needed, then locks), `create_adjustment` (admin-created-and-approved-in-one-step), `void_adjustment` (soft-void, refused when the period is locked) — porting Fastify's `payroll/internal.ts` + `payroll/service.ts` with distinct Fastify-parity error codes.
- **Loop closed:** the sessions-migration `session_date_pay_period_locked()` stub is now the real `pay_periods` lock lookup.

**Explicitly deferred (NOT done in this step, by design):**
- **(a) Real data backfill** from the Prisma `pay_periods`/`adjustments`/`invoices`/`invoice_lines` tables — schema-only, no rows moved.
- **(b) Frontend repoint** — `src/features/admin/AdminPayrollRoute.tsx`, `AdminPaymentsRoute.tsx`, `adminPayrollRepository.ts`, and the tutor invoice-viewing routes still call the Fastify `lms-api` payroll routes; `src/` and `lms-api/` are untouched.
- **(c) Invoice PDF/HTML rendering** — `lms-api/src/lib/invoices.js`'s `buildInvoicePdf`/`renderInvoiceHtml` stay untouched and unreplicated (presentation logic for a later frontend-repoint pass).
- **(d) Retirement of the Fastify payroll routes** — happens at §6 step 7.
- **`weekly_reports`** — per-student report payload (jsonb) + week range; RLS: student/guardian read released, tutor/admin manage. Rebuild `buildWeeklyReportPayload` against Supabase (`sessions`, `student_progress`, `assignment_submissions`). ✅ **Schema landed — see §4B.**
- **`notifications`** — per-user notifications; RLS owner-read. ✅ **Schema landed as `student_notifications` — see §4B.**

### 4B. Weekly reports + notifications — Status: ✅ Supabase schema + RLS + RPC layer LANDED (schema-only; unused pending repoint)

The Supabase-native weekly-reports + student-notifications layer is now built in `docs/supabase/schema.sql` and locked by `tests/frontend/weekly-reports-notifications-migration.test.cjs` (wired into `test:rls`). Sequenced after sessions + finance because the report payload derives from APPROVED sessions and the notifications wire into the already-landed session RPCs. What landed:

- **Tables:** `public.weekly_reports` (per-student `payload_json` + Monday–Sunday week range, unique `(student_id, week_start, week_end)`; **`student_id` replaces Prisma's polymorphic `user_id`** — a weekly report only ever belongs to a student; `created_by → profiles`) and `public.student_notifications` (faithful port of the raw `20260524_student_notifications` migration — the only shape source, it was never in `schema.prisma` — with `created_by_user_id → created_by` per this schema's actor-column convention). **No `organization_id` on either** — matching the task's explicit design and the finance-table precedent (org derives from the student; direct org-scoping of these two is not required now).
- **RLS:** `weekly_reports` — admin (all) / owning-student / active-`tutor_student_allocations`-tutor / report-enabled-guardian SELECT; **no direct writes for anyone** (generation is real business logic → RPC-only, following the sessions/finance precedent, so the plan's "tutor/admin manage" is realised as manage-via-RPC). `student_notifications` — student-own SELECT only (there is **no** admin notifications-viewing route in Fastify, so no broader visibility was invented); no direct writes.
- **RPC layer (all `SECURITY DEFINER`, `set search_path = public`):** `generate_weekly_report` (ported `userCanAccessStudent` gate — admin / self-student / active-allocation tutor — + `buildWeeklyReportPayload` rebuilt against `sessions`/`student_progress`, Monday week math via `date_trunc('week', …)`, upsert-on-conflict, then a `weekly_report_ready` notification), `mark_notification_read`, `mark_all_notifications_read`, and the locked-down internal `create_student_notification` helper (`execute` revoked from `public`/`anon`/`authenticated` exactly like `insert_session_history` — only other `SECURITY DEFINER` functions call it).
- **Loop closed (the sessions migration's deferred gap 2):** `submit_session_report` / `submit_session` / `approve_session` / `reject_session` now dispatch their student notifications — the `-- Notification dispatch deferred to the notifications migration (gap 2)` comments are replaced with real `create_student_notification` calls (`session_report_updated` / `session_report_submitted` / `session_approved` / `session_rejected`). Approve/reject resolve the subject name via the session's allocation → `subject_id` → `subjects.name`, with the same `'Your session'` fallback as Fastify.

**Deliberate design choices (not bugs):**
- **Streak/xp OMITTED from the payload.** Fastify's `buildWeeklyReportPayload` pulls a streak summary (current/longest streak, xp) from a `study_streaks` table. Gamification (`StudyActivityEvent` / `StudyStreak`) was **cut from scope by the locked plan** (§3C's draft "Gamification" migrate-bullet was replaced with "Growth monitoring / risk … KEEP"; §3D cuts the rest). So the Supabase payload omits `metrics.streak/longestStreak/xp` entirely and **no `study_streaks` table exists or should be created**. A test asserts `study_streaks` is never referenced inside `generate_weekly_report`, so nobody "fixes" the omission later by re-adding a table that was deliberately dropped.
- **Guardian read is a forward-design addition, not a literal Fastify port.** The current Fastify `/reports` routes have no guardian branch; the guardian SELECT policy implements the plan §4 "student/guardian read released" target by reusing `get_parent_progress_reports()`'s exact gating (`parent` role + active guardian link with `can_receive_reports = true`).

**Explicitly deferred (NOT done in this step, by design):**
- **(a) Real data backfill** from the Prisma `weekly_reports` / `student_notifications` tables — schema-only, no rows moved.
- **(b) Frontend repoint** — the student dashboard / reports UI and the tutor/admin report triggers still call the Fastify `lms-api` routes; `src/` and `lms-api/` are untouched.
- **(c) Retirement of the Fastify report/notification routes** — happens at §6 step 7.

### 4C. Tutor onboarding / vetting — Status: ✅ Supabase schema + RLS + RPC layer + Storage bucket LANDED (schema-only; unused pending repoint)

The Supabase-native tutor-onboarding/vetting layer is now built in `docs/supabase/schema.sql` and locked by `tests/frontend/tutor-onboarding-migration.test.cjs` (wired into `test:rls`). This is the trust/safety gate needed before hiring beyond family/friends. What landed:

- **`public.tutors` gains the richer approval/qualification columns** Prisma's `TutorProfile` carried that Supabase's minimal table lacked (§3A): `qualification_band`, `qualified_subjects_json`, `approval_status` (default `'approved'`, matching Prisma — today's family/friends tutors are pre-approved; check-constrained to the union of both Fastify write paths' vocabularies), `approval_reviewed_by`/`approval_reviewed_at`/`approval_note`, `teaching_preferences_json`. Identity fields (`full_name`/`phone`) are **not** duplicated — they already live on `profiles`. Prisma's separate `active` boolean is **not** re-added — it folds into the existing `status` (`record_status`) enum.
- **Tables:** `public.tutor_applications` (one per tutor, `status` state machine `draft → submitted → under_review/approved/rejected/changes_requested`), `public.tutor_documents` (metadata only — see Storage below), `public.tutor_availability_slots` (day/time slots, full-replace semantics).
- **RLS:** all three — admin SELECT all + tutor SELECT own; **no direct writes for anyone**, every write (the approved→changes_requested revert rule, the submit gate, the admin decision cascade, document verification, availability replace) goes through a `SECURITY DEFINER` RPC, following the sessions/finance/notifications precedent. No student/parent access anywhere in this domain.
- **Storage:** a new **private** `tutor-documents` bucket replaces Fastify's local-disk uploads (`uploads/tutor-documents/…`) — identity/qualification documents are high-sensitivity. Path convention `{tutor_id}/{document_id}.{ext}`; a tutor may INSERT/SELECT only their own folder, admin may SELECT any (verification review), no UPDATE/DELETE (documents are re-uploaded as new rows, never edited). The `tutor_documents` DB row carries metadata only — bytes live in Storage, recorded via `record_tutor_document()` after the client uploads directly (mirrors the existing split between Storage upload and RPC-recorded metadata used for assignment submissions).
- **RPC layer (all `SECURITY DEFINER`):** `upsert_tutor_application` (ported `PATCH /tutor/application`, including the exact approved→changes_requested revert rule — an approved tutor editing their application forces re-review), `submit_tutor_application`, `decide_tutor_application` (admin-only; on approval, cascades `approval_status='approved'`, `qualification_band = coalesce(qualification_band, 'BOTH')` — never overwrites an existing band — `qualified_subjects_json`/`teaching_preferences_json` copied from the application, and flips the tutor operational via `status = 'active'`; any other decision only touches the approval-review fields), `record_tutor_document` (validates enums + storage-key ownership as defense in depth), `verify_tutor_document`, `replace_tutor_availability` (delete-all-then-insert, Zod-bound validation ported to SQL checks).
- **Third deferred-loop closed:** `create_session`/`update_session`/`submit_session_report`/`submit_session`/`approve_session` (from the sessions migration) checked only `tutors.status = 'active'` as "the best-available equivalent," with a comment noting the richer check would land here. It now also requires `approval_status = 'approved'` — full Fastify `ensureTutorActive` parity — closing the last of the three deferred loops opened across this migration series (pay-period-lock, notification dispatch, tutor-active richness).

**Security finding raised and fixed during review (not a design decision, a real gap):** adding these columns to `public.tutors` meant the existing `tutors_select_self_or_admin` policy's third arm — an allocated student reading their tutor's row — would expose `approval_note` (a reviewer's internal commentary about the tutor) and the other vetting fields to that student. Postgres RLS is row-level, not column-level, so the policy itself cannot exclude just the new columns for that arm. The fix is at the query layer: `src/features/students/studentDashboardRepository.ts` is the only student-facing reader of `tutors`, and its query was narrowed from `select('*')` to the exact pre-migration-safe column list (`id, profile_id, subjects, grades, hourly_rate, status, created_at`), so none of the seven new columns reach a student response. This is a per-query discipline, not a table-wide guarantee — flagged in a schema comment so a future second student-facing reader of `tutors` doesn't reintroduce the leak.

**Explicitly deferred (NOT done in this step, by design):**
- **(a) Real data backfill** from the Prisma `tutor_applications`/`tutor_documents`/`tutor_availability_slots` tables — schema-only, no rows moved, and no actual document *files* moved into Storage.
- **(b) Frontend repoint** — the tutor/admin onboarding UIs still call the Fastify `lms-api` routes; a later phase wires the frontend to call `supabase.storage.from('tutor-documents').upload(...)` then `record_tutor_document()`.
- **(c) Retirement of the Fastify tutor-onboarding routes** — happens at §6 step 7.

### 4D. Growth monitoring / risk — Status: ✅ Supabase schema + RLS + RPC layer LANDED (schema-only; unused pending repoint)

The Supabase-native growth/risk layer is now built in `docs/supabase/schema.sql` and locked by `tests/frontend/growth-risk-monitoring-migration.test.cjs` (wired into `test:rls`). **This is a redesign, not a literal port** — Fastify's `computeStudentMetrics`/`computeScoreSnapshot` (`lms-api/src/lib/predictive-scoring.ts` + `routes/phase3.ts`) is built almost entirely from gamification signals (`study_streaks`, `study_activity_events`) that §3D cut from scope (the same cut that dropped the streak/xp block from the weekly-reports payload). Porting that formula verbatim was therefore impossible, and per the owner's explicit requirement (§7 decision 2) also wrong: the migrated score must be traceable to the specific rows that drove it, not a black-box number. What landed:

- **Tables:** `public.student_score_snapshots` (`risk_score`/`momentum_score` 0–100, `reasons_json`/`metrics_json`/`recommended_actions_json`, unique `(student_id, score_date)`) and `public.career_progress_snapshots` (`alignment_score` 0–100, `goal_id` a plain string — the static career-goal catalog is content, not a DB table, matching Prisma's own `goalId`). **Explicitly org-scoped** (unlike finance/weekly_reports, which deliberately are not) — plan §4 calls this domain out as "org-scoped", so both tables carry `organization_id` via a **shared** `fill_student_scoped_organization_id()` before-insert trigger that derives the org strictly from the row's `student_id` (mirroring `fill_session_organization_id`'s "never the caller's own org" reasoning, since these rows are written by a RPC acting on behalf of the student, not freshly created by a coordinator).
- **RLS:** both tables — admin SELECT all + owning-student SELECT own + active-allocation-tutor SELECT own students' (plan §4: "owning student + tutor(s) + admin", matching Fastify's `GET /tutor/scores` and `GET /tutor/students/:studentId/career`); **no direct writes for anyone** — every row is written by the two RPCs below, following the sessions/finance/notifications/tutor-onboarding precedent.
- **Redesigned scoring signals (`recompute_student_risk_snapshot`)**, each carrying `source_type`/`source_id` in `reasons_json` so a tutor/admin can click through to the specific row that triggered the signal — the traceability requirement made concrete rather than left as a comment:
  - **Session attendance** (`public.sessions`, already migrated) — same 14-day approved/rejected window Fastify used.
  - **Assignment completion** (`public.assignments`/`public.assignment_submissions`) — published assignments due for the student's grade in the last 14 days vs. whether the student actually submitted; the reason carries the *specific* oldest still-missing `assignment_id`, not just a count.
  - **Marks trend** (`assignment_submissions.marks_awarded`) — **RELEASED marks only** (`marks_released = true`). This is a deliberate exposure guard, not an oversight: the snapshot row is read directly by the owning student (no redacting read-RPC like `get_student_assignment_submissions()`), so a signal built from unreleased marks would leak their existence/size to the student they belong to before release.
  - **Topic weakness** (`public.student_progress`) — lowest-scoring topic in a 60-day window, the same weakest-topic selection `studentDashboardRepository.ts` already does client-side, reused here so the signal and the dashboard's "recommended next" agree.
  - EMA smoothing against the previous day's snapshot (same alpha Fastify used) is kept — a generically useful technique, not gamification-specific.
- **`recompute_career_progress_snapshot`** keeps Fastify's exact 0.35/0.30/0.20/0.15 weight split. `subjectCoverage`/`averageCompletion` are rebuilt from the student's most recent `public.weekly_reports` row (already migrated, §4B — same source data Fastify used, now Supabase-native); the cut `streakScore`/`practiceScore` terms are replaced by real session-attendance/assignment-completion signals (same shapes, non-gamification sources, and the completion term is traceable to a specific assignment when incomplete). Self-service only, matching Fastify exactly — `POST /career/goals` has no admin/tutor path, so none is invented here (same discipline already applied to `student_notifications`' RLS).
- **`CareerGoalSelection` is not migrated as its own table** — per plan §7 decision 4 it folds into `public.student_career_profiles.target_careers_json`. The goal catalog itself (`lms-api/data/career-goals.v1.json` today) is static content, not operational data, and stays outside the DB; `recompute_career_progress_snapshot` takes the goal's recommended subjects as a parameter rather than looking them up server-side.

**Explicitly deferred (NOT done in this step, by design):**
- **(a) Real data backfill** from the Prisma `student_score_snapshots`/`career_progress_snapshots` tables — schema-only, no rows moved.
- **(b) Frontend repoint** — the student `/scores`/`/career` UI and the tutor "students needing attention" view still call the Fastify `lms-api` routes; `src/` and `lms-api/` are untouched.
- **(c) Retirement of the Fastify predictive-score/career routes** — happens at §6 step 7.

### 4E. Academic extras + volunteering — Status: ✅ Supabase schema + RLS + RPC layer LANDED (schema-only; unused pending repoint)

The Supabase-native layer for the remaining "academic extras" + volunteering models is now built in `docs/supabase/schema.sql` and locked by `tests/frontend/academic-extras-volunteering-migration.test.cjs` (wired into `test:rls`). What landed:

- **`LearningAssignment` was CUT during this step** (§7 decision 6) — discovered while researching that it's a *separate* tutor-assigns-one-student system with its own raw-SQL `assignment_submissions` table (FK'd to `learning_assignments`, a different shape than Supabase's), distinct from and name-colliding with the `assignments`/`assignment_submissions` broadcast-homework tables the current frontend already uses. Zero `src/` references exist for it. Owner chose to cut rather than build a confusingly-named second submissions table for a dead feature.
- **Tables:** `public.baseline_assessments` (score/total/percentage computed server-side, cognitive/topic breakdown jsonb, `source_type` enum), `public.learning_goals` (`category`/`status` enums, `visible_to_student`/`visible_to_tutor` flags), `public.student_exam_events` (feeds the `examCalendar` slot already reserved in `StudentDashboardView` but currently unpopulated by `loadFromSupabase`), `public.volunteer_events` + `public.volunteer_logs` (the latter's `evidence_document_id` FKs to `tutor_documents`, landed by the tutor-onboarding migration — §4C). Five new small enum types (`baseline_source_type`, `learning_goal_category`, `learning_goal_status`, `volunteer_event_status`, `volunteer_log_status`) follow the finance migration's dedicated-enum-per-status-vocab convention.
- **Org derivation:** `baseline_assessments`/`learning_goals`/`student_exam_events` reuse the growth/risk migration's shared `fill_student_scoped_organization_id()` trigger (§4D) rather than a third copy of the same logic. `volunteer_events`/`volunteer_logs` are **deliberately NOT org-scoped** — Prisma's own models carry no org/partner concept at all, matching the finance-table precedent (`MULTI_ORG_MODEL_PLAN.md` §9).
- **RLS:** `baseline_assessments`/`student_exam_events` — admin + owning-student + active-allocation-tutor SELECT (matching `/tutor/students/:id/summary` and the dashboard's exam-calendar read). `learning_goals` — same three arms, but the student/tutor arms are additionally gated on `visible_to_student`/`visible_to_tutor` (Fastify's own query-time filter promoted to a hard RLS boundary; admin sees every goal regardless). `volunteer_events` — admin + **any** tutor SELECT (platform-wide listing, not allocation-scoped). `volunteer_logs` — admin + **own-tutor-only** SELECT (no cross-tutor visibility, matching Fastify's `where tutor_id = $1`). No direct writes anywhere — RPC-only, per every prior domain's precedent.
- **RPC layer (all `SECURITY DEFINER`):** `record_baseline_assessment` (admin-only; computes `percentage` server-side; fires `baseline_assessment_created`), `create_learning_goal`/`update_learning_goal` (admin-only; the update RPC ports Fastify's exact `data.field ?? current.field` coalesce-partial-update pattern, including its pre-existing inability to explicitly null a field back out; fires `learning_goal_created`/`_completed`/`_updated` gated on `visible_to_student`, matching Fastify's own conditional), `create_exam_event` (admin-only, no notification — Fastify has none), `create_volunteer_event` (admin-only), `create_volunteer_log` (tutor self-service; status derives from whether `hours` was supplied, exactly like Fastify), `verify_volunteer_log` (admin-only, same allowed-from-status set Fastify enforced).
- **One deliberate hardening beyond Fastify:** `create_volunteer_log` verifies `p_evidence_document_id`, when supplied, actually belongs to the calling tutor — Fastify's own Zod schema never checked this. Same defense-in-depth discipline as the tutor-onboarding migration's `storage_key` ownership check.

**Explicitly deferred (NOT done in this step, by design):**
- **(a) Real data backfill** from the Prisma tables — schema-only, no rows moved.
- **(b) Frontend repoint** — none of these five have any `src/` usage today; `baseline_assessments`/`learning_goals`/`student_exam_events` have dashboard-shaped slots already reserved in `StudentDashboardView` but unpopulated by `loadFromSupabase`; volunteering has no frontend surface at all.
- **(c) Retirement of the Fastify academic-extras/volunteer routes** — happens at §6 step 7.

- **Tutor onboarding** (`tutor_applications`, `tutor_documents`, `tutor_availability`) — ties into the vetting gate (tutor/volunteer model). Documents → private Storage bucket. ✅ **Schema landed** — see §4C above.
- **Reconcile** `TutorStudentMap` ↔ `tutor_student_allocations` into the single Supabase table (also absorbs the Prisma `Assignment` engagement/contract fields per §3A). ✅ **Schema landed** — contract columns (`subject_id`, `rate_override`, `allowed_days_json`, `allowed_time_ranges_json`) added; student-dashboard read narrowed to exclude `rate_override`. Prisma-side retirement deferred to §6 step 7 (Fastify-stack removal).
- **Growth monitoring / risk** (`student_score_snapshots`, `career_progress_snapshots`) — org-scoped; RLS: owning student + tutor(s) + admin. **Design requirement (owner-specified):** snapshots must be traceable to the specific `assignments`/`assignment_submissions`/`student_progress` rows that drove them, so a tutor/admin can see not just "this student is struggling" but *which assignment/topic* triggered the signal. Don't build this as a black-box score. ✅ **Schema landed — see §4D below.**
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
2. **Sessions & attendance** — the linchpin; unblocks everything operational. ✅ **Supabase schema + RLS + RPC layer landed** (see §2 "Status") — schema-only; real-data backfill, frontend repoint, and Fastify-route retirement still pending.
3. **Finance / payroll** — depends on sessions. ✅ **Supabase schema + RLS + payroll RPC layer landed** (see §4A "Status") — schema-only. The `session_date_pay_period_locked()` stub is now wired to the real `pay_periods` table (loop closed). Still deferred: real-data backfill, frontend repoint, invoice PDF/HTML rendering, and Fastify-route retirement.
4. **Weekly reports + notifications** — depend on sessions. ✅ **Supabase schema + RLS + RPC layer landed** (see §4B "Status") — schema-only. The deferred student-notification dispatch is now wired into `submit_session_report`/`submit_session`/`approve_session`/`reject_session` (Fastify's `createStudentNotification` side effects — loop closed). Still deferred: real-data backfill, frontend repoint, and Fastify-route retirement.
5. **Growth monitoring / risk** (`student_score_snapshots`, `career_progress_snapshots`) — depends on sessions + assignments + progress being in Supabase, since traceability to specific assignments is a hard requirement. ✅ **Supabase schema + RLS + RPC layer landed** (see §4D "Status") — schema-only, and a redesign (not a literal port) since the gamification tables the Fastify formula depended on were cut from scope. Still deferred: real-data backfill, frontend repoint, and Fastify-route retirement.
6. **Tutor onboarding** — ties to the vetting gate; needed before hiring beyond family/friends. ✅ **Supabase schema + RLS + RPC layer + Storage bucket landed** (see §4C "Status") — schema-only. The `tutors.status = 'active'`-only check in `create_session`/`update_session`/`submit_session_report`/`submit_session`/`approve_session` is now upgraded to also require `approval_status = 'approved'` (loop closed — full Fastify `ensureTutorActive` parity). Still deferred: real-data backfill (including document files), frontend repoint, and Fastify-route retirement.
6a. **Academic extras + volunteering** (`baseline_assessments`, `learning_goals`, `student_exam_events`, `volunteer_events`, `volunteer_logs`) — ✅ **Supabase schema + RLS + RPC layer landed** (see §4E "Status") — schema-only. `LearningAssignment` was CUT during this step (§7 decision 6), not migrated. Still deferred: real-data backfill, frontend repoint, and Fastify-route retirement.
7. **Retire the Fastify stack** (§3B) and decommission `lms-api`. Community suite (§3D) stays parked in Prisma / out of scope — revisit later. ⚠️ **Note:** community (study rooms, challenges, Q&A) was subsequently un-cut and shipped natively on Supabase (see `docs/supabase/schema.sql`'s Community section) — this table's "CUT for now" framing is stale for that piece. ✅ **Partial progress on decommissioning:** confirmed (by grepping `src/` and checking `.do/app.yaml`'s ingress + `scripts/build-static.js`) that the live React dashboards had exactly one remaining Fastify dependency — a dead `loadAuditEntries` fallback that never actually fired since Supabase is always configured in production — which is now removed. `legacy/static/` (unreachable in production; no ingress rule ever routed to it) and `tests/e2e-web/` (its only test consumer) are retired, along with the `playwright-e2e` CI job and the `lms-api` service + `/api` ingress rules in `.do/app.yaml`. Still open: `lms-api/`'s own CI jobs (`contracts`/`unit-tests`/`e2e` in `app-ci.yml`) and the `lms-api/` directory itself remain, since the Fastify routes stay registered until this full step is complete.

---

## 7. Decisions (locked by owner)

1. **Community suite** (study rooms, challenges, Q&A, moderation) — ✅ **Cut for now.** Not migrated; parked in Prisma for possible later revival.
2. **Predictive-score / tutor-risk feature** (`StudentScoreSnapshot`, `CareerProgressSnapshot`) — ✅ **Keep, migrate.** Purpose: monitor student growth over time and identify where a student is failing *in relation to the specific assignments given to them* — the migrated design must preserve that assignment-level traceability (see §4).
3. **`Assignment` concept clash** — ✅ **Go with the recommendation:** the Prisma engagement/contract concept folds into `tutor_student_allocations`/`sessions`; Supabase `assignments` stays homework-only.
4. **`TutorStudentMap` → `tutor_student_allocations`** — ✅ **Go with the recommendation:** reconcile into one canonical mapping table.
5. **Sequencing vs. multi-org** — ✅ **Multi-org (ADR-0002) lands alongside/before** the sessions/finance migration, as the owner explicitly wants. Reflected in §6 step 0.
6. **`LearningAssignment` (+ its own raw-SQL `assignment_submissions`)** — ✅ **Cut, not migrated.** Discovered during the academic-extras step (not part of the original triage) that this is a *separate* tutor-assigns-one-student system, distinct from and colliding by name with the `assignments`/`assignment_submissions` broadcast-homework tables already live in Supabase — and it has zero references anywhere in `src/` today. Owner chose to cut it rather than build a confusingly-named second submissions table for a feature with no current frontend surface (see §4E).

## 8. Honest scope note

This is still the **largest** piece of the single-stack migration — multiple domains, real data movement, and RLS on money and minors' operational data, now combined with standing up the multi-org model at the same time (per the locked sequencing). It is genuinely multi-session work. The triage keeps it tractable: cutting the community suite removes ~9 models from scope entirely, leaving a focused set (sessions, finance, reports, tutor onboarding, growth/risk) to migrate — all born org-scoped from the start.
