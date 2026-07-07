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

## 5. Retention (Supabase) — to implement

The existing retention job covers **only** Prisma tables. Supabase tables currently have **no retention mechanism**. Proposed policy (mirror the existing env-driven windows where sensible):

| Data | Retention | On expiry |
|---|---|---|
| `assignment_submissions` + storage files | While enrolled + N years (e.g. 3) | Delete files; anonymise/aggregate marks |
| `student_progress` | While enrolled + N years | Anonymise (keep aggregate, drop identity) |
| `profiles` / `students` / `guardians` | While active + grace period after leaving | Anonymise on account closure |
| `odie_conversations` / `odie_messages` | Short (e.g. 12 months) | Delete — closes AUDIT.md gap |
| `audit_log` | 5 years (compliance) | Retain then purge |
| `payments` / `tutor_payments` | 7 years (financial/tax) | Retain then purge |

Implement as a **scheduled Supabase Edge Function** (per ADR-0003), not the Prisma cron.

---

## 6. Erasure / data-subject requests (Supabase) — to implement *(closes audit Critical)*

Currently there is **no way to export or erase a learner's Supabase data** on request. Required:

- A **`SECURITY DEFINER` erasure/anonymisation RPC** for the Supabase tables (parallels the existing Prisma `privacy.ts` flow), that either deletes or anonymises a subject across `profiles`, `students`, `guardians`, `assignment_submissions` (+ storage), `student_progress`, career profiles, and Odie chat history — respecting financial-retention holds (anonymise instead of delete where a payment must be kept).
- An **access/export RPC** returning all of a subject's data as JSON.
- A **`privacy_requests` table (or reuse) in Supabase** linking a request to the subject's auth/profile id, with status and audit trail.
- Every erasure/export/correction writes to `audit_log`.

Request types (POPIA): **ACCESS** (export), **CORRECTION** (update), **DELETION** (delete or anonymise under retention holds). Guardian authority required for a minor.

---

## 7. Open items

1. **Implement §5 retention + §6 erasure for Supabase** (Phase A/B — closes the audit Critical). Highest compliance priority.
2. **Document OpenRouter transfer basis** + pin a zero-retention model for PII-bearing calls.
3. **Remove `students.parent_name`/`parent_contact` duplication** (data minimisation).
4. **Reconcile/retire** the two legacy compliance docs once the Prisma stack is gone (ADR-0003).
5. **Legal review** of this map, the transfer bases, and the minors'-consent artefacts.
6. **Written parental-consent record** (currently informal — see safeguarding §12).
