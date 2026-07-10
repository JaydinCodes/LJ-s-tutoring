# POPIA Data Map — Supabase (current source of truth)

**Status:** Living document. This is the **accurate** data map for the live **Supabase** schema (`docs/supabase/schema.sql`).
**⚠️ Supersedes for the Supabase model:** [POPIA_DATA_CLASSIFICATION.md](POPIA_DATA_CLASSIFICATION.md) and [DATA_RETENTION_AND_DELETION.md](DATA_RETENTION_AND_DELETION.md) describe the **legacy Prisma/Fastify** schema (`students.full_name`, `students.guardian_name`, `sessions`, `invoices`) — those columns/tables are **not** the current browser source of truth. Those docs remain valid *only* for the Prisma retention job that still runs, and will be reconciled when the stack consolidates ([ADR-0003](../architecture/ADR-0003-single-stack-supabase.md)).
**⚠️ Legal review required** before relying on this for compliance.
**Closes:** AUDIT.md Critical — "no POPIA erasure/retention path for Supabase data."

---

## 1. Why this exists

We process the personal information of **minors**. POPIA requires us to know exactly what personal data we hold, where, who can see it, where it flows (including outside South Africa), how long we keep it, and how we delete it on request. The previous compliance docs mapped the wrong (legacy) schema, so this is the corrected map for the system that actually holds the data today.

---

## 2. Data inventory (Supabase tables)

Sensitivity: **High** = minors' PII / academic records / financial; **Medium** = operational records tied to a person; **Low** = reference data.

| Table | Personal data it holds | Sensitivity | Who can access (via RLS) |
|---|---|---|---|
| `profiles` | Full name, email, phone, role — **for every user incl. minors** | High | Self; platform admin |
| `students` | Grade, school, `parent_name`, `parent_contact`, org link | High | Self (student); assigned tutor; admin |
| `guardians` | Guardian full name, email, phone, notes | High | Scoped guardian/admin policies |
| `student_guardians` | Student↔guardian relationships, report permissions | High | Scoped |
| `tutors` | Tutor operational profile | Medium | Self; admin |
| `student_career_profiles` | Interests, target careers, APS goals | Medium | Owning student; admin |
| `assignments` | Titles, instructions, rubric | Low–Medium | Org-scoped (per ADR-0002) |
| `assignment_submissions` | **Uploaded learner work, marks, feedback** | High | Owning student; assignment's tutor; admin |
| `student_progress` | Per-concept scores/history | High | Owning student; tutor; admin |
| `payments` | Student billing records | High | Admin (student-scoped read) |
| `tutor_payments` | Tutor payouts | High | Admin |
| `classes`, `class_enrollments` | Enrolment | Medium | Org-scoped |
| `tutor_student_allocations` | Tutor↔student assignment | Medium | Scoped |
| `audit_log` | Actor id/role, action, metadata | High | **Admin only** |
| **Storage** `assignment-submissions` | **Learner uploaded files** | High | Owning student; assignment's tutor; admin |
| **Storage** `assignment-files` | Tutor/admin assignment resources | Medium | Authenticated (to be scoped — AUDIT.md) |

**Also (legacy Fastify side, to migrate):** `odie_conversations` / `odie_messages` hold learner chat history containing academic PII. These are currently in **neither** the retention job nor any erasure path (AUDIT.md finding) — must be covered (§5–6).

---

## 3. Third-party processors & cross-border transfers

POPIA requires documented safeguards for operators (processors) and for personal information leaving South Africa.

| Processor | Data it receives | Location | Notes |
|---|---|---|---|
| **Supabase** (Auth, DB, Storage) | All platform data | Region `fra` (EU/Frankfurt per `.do/app.yaml`) | Primary sub-processor. Cross-border (outside SA) → needs a documented transfer basis. |
| **OpenRouter** (Odie AI) | **Learner grade, subjects, assignment content, recent assessment results** (per `academic.ts` Odie chat) | US-based aggregator | **The most sensitive external flow.** Currently undocumented (AUDIT.md). Free-tier model retention is uncertain — pin a zero-retention model for PII (see AUDIT.md). |
| **DigitalOcean** | Static site hosting (no DB PII) | Region `fra` | Hosts frontend + (currently) the Fastify service. |
| **Email provider** | Recipient email addresses | — | Magic links / notifications. |
| **Sentry** (optional) | Error diagnostics — **configured to exclude PII** | — | `sendDefaultPii: false`; breadcrumb scrubbing gap noted in AUDIT.md. |
| **Formspree** (public site) | Enquiry: name, email, grade, message | — | Public enquiry form; not learner-account data. |

**Action:** each row above needs a documented processing basis and, for cross-border ones (OpenRouter, Supabase, etc.), a POPIA transfer safeguard. OpenRouter is the priority.

---

## 4. Minors' data

- Most learners are minors → processing requires **parental/guardian consent** (POPIA competent-person rule). This links to the [Safeguarding policy](SAFEGUARDING_AND_CHILD_PROTECTION.md) §8 (consent before contact).
- **Data minimisation:** collect only what tutoring needs. Flagged issue (AUDIT.md): `students.parent_name`/`parent_contact` **duplicate** guardian PII already in `guardians` — remove the duplication.
- Minors' academic PII (marks, feedback, uploaded work) must never cross learner/tutor/org boundaries — enforced by RLS (ADR-0002) and aggregate-only NGO reporting.

---

## 5. Retention (Supabase) — IMPLEMENTED

Implemented as **`run_retention_cleanup(p_apply boolean default false)`** in `docs/supabase/schema.sql` (verified: full schema loads clean against Postgres 16). It **defaults to a dry run** (counts only, deletes nothing); pass `true` to purge. Admin-gated, and also callable by a trusted no-JWT scheduler. Windows:

| Data | Window | Applied |
|---|---|---|
| `assignment_submissions` + storage files | 3 years (by `submitted_at`) | Delete rows + files |
| `student_progress` | 3 years (by `recorded_at`) | Delete |
| `audit_log` | 5 years (by `created_at`) | Delete |
| `payments` / `tutor_payments` | 7 years (by `paid_at`; **settled only**) | Delete |

**Schedule the real run** via pg_cron or a scheduled Edge Function: `select public.run_retention_cleanup(true);`

**Not yet covered (follow-ups):** account-level anonymisation of inactive `profiles`/`students`/`guardians` after a grace period (currently handled on-request via `anonymize_student`); and `odie_conversations`/`odie_messages`, which live in the legacy Prisma DB and are purged by the Fastify retention job.

---

## 6. Erasure / data-subject requests (Supabase) — IMPLEMENTED *(closes audit Critical)*

Implemented in `docs/supabase/schema.sql` (verified: full schema loads clean against Postgres 16). All functions are `SECURITY DEFINER` and **admin-gated internally**:

- **`export_student_data(p_student_id)`** — ACCESS: returns all of a learner's data (profile, student row, guardians, career profile, submissions, progress, enrolments, allocations, payments) as one JSON object.
- **`anonymize_student(p_student_id)`** — DELETION: removes identifiable academic content (career profile, submissions, progress, submission files) and strips identity on `students`/`profiles`; **anonymises rather than hard-deletes when a financial-retention hold applies** (rows in `payments`). Returns a summary.
- **`process_privacy_request(p_request_id)`** — workflow wrapper that dispatches a tracked request by type, stores the result, and closes it.
- **`privacy_requests`** table (admin-only RLS) tracks each request; every action writes to `audit_log`.

Request types (POPIA): **ACCESS** (export), **CORRECTION** (applied via normal admin RLS UPDATEs — no function needed), **DELETION** (anonymise/delete under retention holds). Guardian authority required for a minor.

**Two follow-ups needed for *complete* erasure (must run via the service-role, not this SQL):**
1. **Storage files** — the function deletes `storage.objects` rows for the learner's folder, but if the definer role lacks storage privilege it returns `files_removed = -1` as a signal to purge the files via the service-role storage client.
2. **Auth identity** — the function anonymises `profiles.email`, but the login identity in **`auth.users`** (a separate schema) must be deleted/disabled via the Supabase Admin Auth API (service-role). Until then the account credential still exists.

*(Odie chat history lives in the legacy Prisma DB, not Supabase — handled by the Fastify retention/privacy pipeline, out of scope here.)*

---

## 7. Open items

1. **§5 retention + §6 erasure/export — DONE** (functions in schema.sql). Remaining: **wire a scheduler** to `run_retention_cleanup(true)` (pg_cron/Edge Function), account-level anonymisation of inactive accounts, and the two service-role follow-ups in §6 (storage-file purge, `auth.users` deletion).
2. **OpenRouter** — ✅ now disclosed in the public privacy notice (Third-Party Services) and data map §3. Remaining: a documented cross-border transfer **basis** (POPIA §72) and pinning a **zero-data-retention** provider/model for PII-bearing calls (prod currently runs a `:free` model — see `.do/app.yaml` `OPENROUTER_MODEL`).
3. **Remove `students.parent_name`/`parent_contact` duplication** (data minimisation).
4. **Reconcile/retire** the two legacy compliance docs once the Prisma stack is gone (ADR-0003).
5. **Legal review** of this map, the transfer bases, and the minors'-consent artefacts.
6. **Written parental-consent record** (currently informal — see safeguarding §12).
