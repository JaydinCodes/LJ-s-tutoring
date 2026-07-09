# Project Odysseus — Engineering & Security Audit

**Scope:** Full monorepo — Supabase-first React/Vite LMS frontend (`src/`), transitional Fastify + Prisma backend (`lms-api/`), Supabase schema/RLS/RPC (`docs/supabase/schema.sql`), Odie AI assistant, legacy static assets, docs, CI/CD.
**Method:** Direct file reads across all layers (not filename inference), cross-checked against `docs/architecture/ARCHITECTURE.md` and `docs/architecture/ADR-0001-supabase-first.md`, spot-verified against source for the two Critical findings below.

> **Correction to audit brief:** This is not a multi-tenant-org SaaS product (no `tenant_id` anywhere in either schema). It is a single-organization tutoring LMS with role-based row ownership (`student` / `tutor` / `admin` / `parent` / `ngo_partner`), enforced two different ways depending on era: legacy Fastify JWT+cookie route checks, and the current Supabase RLS/RPC model. "Tenant isolation" below is read as "can user A read/write user B's records, or a role they don't hold." The frontend is Vite + React Router, **not Next.js**.

---

## Executive Summary

- **Admin MFA can be bypassed entirely via the API.** `POST /auth/admin/login` ([lms-api/src/routes/auth.ts:546](lms-api/src/routes/auth.ts#L546)) issues a full ADMIN session cookie from email+password alone — MFA (AAL2) is enforced only client-side by the React `AdminMfaGate`. A direct API call (curl/Postman) gets an authenticated admin session with no second factor.
- **A live RLS policy lets students bypass the submission RPC's safety checks.** `submissions_student_rpc_insert_shape` ([docs/supabase/schema.sql:1048](docs/supabase/schema.sql#L1048)) permits direct `INSERT` into `assignment_submissions` via PostgREST, skipping `submit_assignment_submission()`'s storage-path validation, version locking, and audit logging.
- **No POPIA erasure/retention path covers the primary Supabase data store.** `students`, `guardians`, `profiles`, `assignment_submissions`, `student_progress`, and Odie chat history (`odie_conversations`/`odie_messages`) have no deletion/anonymization mechanism — the existing retention job only touches legacy Prisma tables.
- **Admin OTP codes are logged in plaintext** when the email provider is unconfigured ([lms-api/src/lib/email.ts:60](lms-api/src/lib/email.ts#L60)) — a full admin-takeover vector via log access in a misconfigured environment.
- **Student academic PII (grades, assignment content, weak-topic assessment data) is sent to a free-tier third-party LLM (OpenRouter)** with zero POPIA documentation of the processor relationship or cross-border transfer ([lms-api/src/routes/academic.ts:650](lms-api/src/routes/academic.ts#L650), `docs/compliance/`).

---

## Remediation status (updated 2026-07-08)

Phase-A hardening progress on the 4 Criticals. Code changes are verified by TypeScript compile (API) and a full schema load against Postgres 16 (Supabase SQL); **the vitest API suite and live Supabase `test:rls` still need to run in an environment with the test DB before deploy.**

| # | Critical | Status | Fix |
|---|----------|--------|-----|
| 1 | Admin-MFA bypass via legacy login | ✅ Fixed | Retired `/auth/admin/login` (410) **and** blocked ADMIN role from the shared password helper (closes `/auth/login` too); test updated. `auth.ts` |
| 2 | RLS submission-RPC bypass | ✅ Fixed | Dropped `submissions_student_rpc_insert_shape` (with explicit `drop policy if exists` for existing DBs); deny-guard remains. `schema.sql` |
| 3 | No POPIA erasure path (Supabase) | ✅ Fixed | Added `export_student_data` / `anonymize_student` / `process_privacy_request` + `privacy_requests` table. Two service-role follow-ups remain (storage-file purge, `auth.users` deletion) — see `docs/compliance/POPIA_DATA_MAP.md` §6. |
| 4 | `uncaughtException` doesn't exit | ✅ Fixed | Flush then `process.exit(1)`. `app.ts` |

The **email-OTP plaintext logging (High)** and **OpenRouter transfer documentation (High)** remain open; OpenRouter is now documented in `POPIA_DATA_MAP.md` §3 but still needs a transfer basis + zero-retention model.

---

## Phase 1: Architecture Map

### Request lifecycle

Two parallel, architecturally distinct paths coexist:

**A. Supabase-first path (current, primary — student/tutor/admin dashboards)**
`src/app/App.tsx` route → `ProtectedRoute` (role check from `profiles` row) → `AdminMfaGate` (admin only, AAL2) → feature component calls `src/lib/supabase` client directly (`select`/`update`) *or* an RPC (`supabase.rpc('submit_assignment_submission', …)`) → Postgres RLS policy evaluated on every row → RPC (if used) runs `SECURITY DEFINER` validation logic → response.

**B. Legacy Fastify path (transitional — jobs, AI, email, exports, legacy auth)**
`src/lib/api/` helper (forwards Supabase bearer token or legacy cookie) → Fastify route (`routes/{admin,tutor,academic,phase3,auth,assistant,odie-careers,supabase-admin}.ts`) → router-level `preHandler` (`app.authenticate` → `requireAuth` → `requireRole(...)`) → domain service (`domains/**/service.ts`) or inline SQL via `pg` `Pool` → Prisma-modeled Postgres (separate DB from Supabase) → response.

Both paths are real and active simultaneously; there is no single lifecycle diagram that covers the whole app. This dual-stack state is itself flagged below (Schema Divergence).

### Fastify plugin/route inventory (`lms-api/src/`)

| File | Owns | Auth model |
|---|---|---|
| `plugins/auth.ts` | `@fastify/jwt` registration, `app.authenticate` decorator (cookie → JWT verify → `auth_sessions` revocation check), tutor impersonation cookie handling | — |
| `routes/auth.ts` (1053 lines) | Magic-link login, password login (student/admin), Google OAuth callbacks, session introspection, logout(-all), dev login bypass, `register-admin` bootstrap | Legacy JWT+cookie |
| `routes/admin.ts` (2660 lines) | All `/admin/*`: tutor/student CRUD, applications, privacy requests, impersonation, audit log, payroll, session approval, assessments, learning goals, exam events, analytics | Router-level `requireRole('ADMIN')` |
| `routes/tutor.ts` (1157 lines) | All `/tutor/*`: profile, documents, availability, assignments, students, sessions, invoices (HTML/PDF), payroll weeks, volunteer logs | Router-level `requireRole('TUTOR')` |
| `routes/academic.ts` (2207 lines) | Odie chat (student), results/analytics, dashboard, notifications, attendance, learning assignments/submissions, weekly reports | Per-route `preHandler` |
| `routes/phase3.ts` (1889 lines) | Predictive scores, community study rooms/messages, weekly challenges, Q&A, moderation, block-list, career goals, daily cron score job | Per-route `preHandler` + shared-secret cron header |
| `routes/assistant.ts` (556 lines) | Odie AI proxy: public chat, careers chat, authenticated chat/document analysis | Mixed: public, Supabase bearer, legacy cookie, or access-key fallback |
| `routes/odie-careers.ts` (224 lines) | Student career catalogue/readiness/eligibility | `requireRole('STUDENT')`, dev-bypass gated |
| `routes/supabase-admin.ts` (298 lines) | Admin user invite via Supabase Admin Auth (service-role key) | Validates caller's Supabase bearer + admin role + AAL2 |

### Isolation model / cross-user leak risk

No org-level tenancy; isolation is per-row ownership. See Phase 3 for the concrete RLS/IDOR findings. Summary of the model:

- **Supabase side:** RLS policies scope by `current_profile_id()` / `current_student_id()` / `current_tutor_id()`, with privileged mutations (marking, release, role changes) pushed into `SECURITY DEFINER` RPCs.
- **Fastify side:** Route handlers manually filter queries by `req.user.studentId`/`tutorId`; `IdParamSchema` (zod UUID) validates path params before use in parameterized SQL.

### External integrations

| Integration | Where | Notes |
|---|---|---|
| Supabase (Auth, Postgres, RLS, Storage, RPC) | `src/lib/supabase/`, `docs/supabase/schema.sql` | Primary data/auth store for the browser app |
| Legacy Postgres (Prisma) | `lms-api/prisma/schema.prisma`, `lms-api/src/db/` | Backend-only store for jobs/payroll/legacy auth |
| OpenRouter (AI) | `lms-api/src/domains/assistant/providers/openrouter.ts` | Odie's LLM provider (replaced Groq, commit `4a2b4c0`) |
| Nodemailer / email provider | `lms-api/src/lib/email.ts` | Magic links, OTP (now disabled), notifications |
| PDFKit | `lms-api/src/lib/invoices.ts` | Tutor invoice PDF generation |
| Google OAuth | `lms-api/src/routes/auth.ts` | Legacy sign-in for admin/tutor/student |
| DigitalOcean App Platform | `.do/app.yaml` | Deployment target, CORS/env config |
| Sentry | `src/lib/monitoring/errorReporting.ts`, `lms-api/src/lib/error-monitor.ts` (hand-rolled, no `@sentry/node`) | Error monitoring, frontend + backend |
| Formspree | `src/app/routes/PublicRoutes.tsx` | Public enquiry form submission |

---

## Phase 2: Code Quality

**[Medium]** [lms-api/src/routes/admin.ts](lms-api/src/routes/admin.ts) (2660 lines), [academic.ts](lms-api/src/routes/academic.ts) (2207 lines), [phase3.ts](lms-api/src/routes/phase3.ts) (1889 lines), [tutor.ts](lms-api/src/routes/tutor.ts) (1157 lines), [auth.ts](lms-api/src/routes/auth.ts) (1053 lines) — God files mixing route registration, business logic, and raw SQL across unrelated feature domains. → Extract remaining inline-SQL handlers (baseline assessments, learning goals, exam events, volunteer tracking) into `domains/*/service.ts`, matching the pattern already used for payroll/approvals.

**[Low]** Repeated `catch (err: any) { captureException(...); reply.code(500)... }` block appears in nearly every handler across `admin.ts`, `tutor.ts`, `academic.ts`, `phase3.ts` (~59 `: any` occurrences) despite a global `setErrorHandler` already existing at [lms-api/src/app.ts:326](lms-api/src/app.ts#L326). → Let route handlers re-throw and rely on the global handler, or add a `withErrorHandling()` wrapper.

**[Low]** [lms-api/src/routes/auth.ts:789-910](lms-api/src/routes/auth.ts#L789) and [:913-1028](lms-api/src/routes/auth.ts#L913) — `/auth/dev/login-as` and `/test/login-as` are ~120-line near-duplicates. → Share one implementation.

**[Low]** ~133 non-null assertions (`req.user!.userId`) across `academic.ts`/`admin.ts`/`phase3.ts`/`tutor.ts`; safe today because `preHandler` guarantees population, but bypasses compile-time protection if a route's hook order is ever changed. → Add a typed `getAuthedUser(req)` helper that throws/narrows instead of asserting.

**[Medium]** [src/hooks/useAsyncResource.ts](src/hooks/useAsyncResource.ts) (hand-rolled, no caching, used in 20 admin/tutor/parent/NGO files) coexists with a full `@tanstack/react-query` setup (`src/lib/query/client.ts`) that only the student feature area uses. → Standardize on one data-fetching approach.

**[Low]** [src/app/routes/PublicRoutes.tsx](src/app/routes/PublicRoutes.tsx) (1191 lines) and [src/features/students/StudentDashboardComponents.tsx](src/features/students/StudentDashboardComponents.tsx) (983 lines, ~24 components) — God files mixing multiple concerns (marketing + form validation + throttling; dashboard cards + upload validation). → Split by concern.

**[Low]** `date-fns` and `recharts` are declared as dependencies in `package.json` with zero imports found anywhere in `src/`. → Remove, or confirm near-term use.

**[Low]** `sonner`'s `toast` is used in exactly one file; ~30 other route files use local `message`/`error` state instead, despite `<Toaster/>` being mounted globally in `App.tsx`. → Pick one feedback pattern.

**[Info/Good]** No `any`/`as any` usage found anywhere in `src/` — solid TypeScript discipline on the frontend. Fastify validation is broadly consistent: Zod schemas (`lms-api/src/lib/schemas.ts`, 557 lines) applied on nearly every route; a few admin GET-list endpoints (`admin.ts:1530,1601,1783`) build filters from raw `req.query` without a schema (Low — inconsistency, not injection risk, since all values are parameterized).

**Schema divergence (Prisma vs. Supabase)** — real architecture debt, detailed in Phase 3, is also a code-quality finding: `students`, `assignments`, `audit_log`, and `student_career_profiles` exist under identical names in both `lms-api/prisma/schema.prisma` and `docs/supabase/schema.sql` with different or overlapping semantics.

---

## Phase 3: Security & POPIA Compliance

### Auth / IDOR

**[Critical]** [lms-api/src/routes/auth.ts:546-589](lms-api/src/routes/auth.ts#L546) — `POST /auth/admin/login` issues a full `ADMIN` session cookie (`issueTrackedSessionJwt`) from email+password only. The code comment at line 572-573 acknowledges "Browser admin access is Supabase-first and must pass the React Supabase MFA gate" — but that gate is a **client-side React component only**; nothing prevents a direct API caller from obtaining an authenticated admin session with no MFA. → Retire this endpoint for anything beyond bootstrap, or enforce Supabase AAL2 server-side before issuing the cookie.

**[Medium]** [lms-api/src/routes/phase3.ts:1619-1675](lms-api/src/routes/phase3.ts#L1619) — Community moderation (`hide`/`delete`) checks only `isModerator(role)` — any TUTOR account can hide/delete any content system-wide, not just content in rooms they moderate. → Scope to rooms/threads the tutor is assigned to, unless system-wide moderation is an intentional design choice.

**[Low]** [lms-api/src/routes/phase3.ts:628-644](lms-api/src/routes/phase3.ts#L628) — Cron token comparison uses `!==` instead of a constant-time comparison. → Use `crypto.timingSafeEqual`.

**[Low]** [lms-api/src/routes/admin.ts:2196](lms-api/src/routes/admin.ts#L2196), [:2262](lms-api/src/routes/admin.ts#L2262) — `sessionRows.rowCount ?? 0 > 0` parses as `rowCount ?? (0 > 0)`; works today only because `0` is falsy. → Parenthesize: `(rowCount ?? 0) > 0`.

**[Info/Good]** IDOR ownership checks are otherwise consistent: `userCanAccessStudent()` ([academic.ts:376-402](lms-api/src/routes/academic.ts#L376)) is applied everywhere a studentId could be client-supplied; tutor routes filter by `tutor_id = req.user.tutorId`; `IdParamSchema` validates every `:id` before use. Confirmed by tests in `lms-api/tests/student-dashboard-features.test.ts:183-242` (student blocked from another student's profile/results by ID swap) and `tutor-portal-features.test.ts:68-90` (tutor document ownership).

### Row-Level Security / RPC (Supabase)

**[Critical]** [docs/supabase/schema.sql:1024-1066](docs/supabase/schema.sql#L1024) — `assignment_submissions` INSERT is governed by two permissive policies combined with OR: `submissions_student_insert_via_rpc_guard` (`with check (false)`, effectively dead) and `submissions_student_rpc_insert_shape`, which actually permits direct-table INSERT via PostgREST as long as basic shape conditions hold. This bypasses `submit_assignment_submission()`'s storage-path regex validation, advisory-lock version sequencing, and `log_audit_event` call — submissions created this way are invisible to the audit trail. **Verified in source.** → Drop the permissive shape-insert policy (force all inserts through the RPC) or extend it to fully replicate the RPC's validation and audit write.

**[High]** [docs/supabase/schema.sql:990-994](docs/supabase/schema.sql#L990) — `assignments_read_authenticated` uses `using (auth.uid() is not null)` — any authenticated user, including students not in the target cohort, can read **draft** assignments containing `rubric_json` (potential answer-key content) before a tutor publishes them. → Scope to `status = 'published'` for non-staff roles.

**[High]** [docs/supabase/schema.sql:34-44](docs/supabase/schema.sql#L34) vs. [:895-900](docs/supabase/schema.sql#L895) — `students.parent_name`/`parent_contact` duplicate guardian PII outside the properly-scoped `guardians`/`student_guardians` tables, and are exposed to any tutor with an active allocation via `students_select_self_or_admin`. This contradicts `docs/supabase/PRODUCTION_RLS_REVIEW.md:54`, which states tutors should not get guardian contact access by default. → Remove the duplicate columns from `students` (canonical data already lives in `guardians`).

**[Medium]** [docs/supabase/schema.sql:1184-1189](docs/supabase/schema.sql#L1184) — `authenticated_read_assignment_files` storage policy has no scoping by assignment status/enrollment — any authenticated user can download any assignment attachment, including drafts. → Join to `assignments` and require `status = 'published'`.

**[Medium]** [docs/supabase/schema.sql:400-428](docs/supabase/schema.sql#L400) (grants at `:813`) — `record_audit_event()` lets any tutor write an audit entry for `assignment.*` actions **without verifying they own the target `entity_id`** — a compromised tutor account can forge audit history for another tutor's/admin's assignment. → Verify `assignments.created_by = current_profile_id()` before writing.

**[Medium]** [docs/supabase/schema.sql:276](docs/supabase/schema.sql#L276) — `ngo_partners` has RLS enabled but **zero `create policy` statements exist for it**, so it default-denies all access via the anon/authenticated key. → Add an admin-manage policy matching the pattern used elsewhere.

**[Low]** [docs/supabase/schema.sql:1208-1229](docs/supabase/schema.sql#L1208) — Storage UPDATE policy for submissions doesn't re-check assignment status (unlike the INSERT policy) — a student could overwrite a file under a closed/archived assignment. → Mirror the insert policy's status check.

**[Info/Good]** All RPCs (`submit_assignment_submission`, `mark_assignment_submission`, `can_mark_submission`, `get_student_assignment_submissions`, `get_parent_progress_reports`, `log_audit_event`) are `SECURITY DEFINER` with `set search_path = public`, parameterized, and correctly gate role/ownership before mutating — no SQL injection found. `log_audit_event` is correctly `REVOKE`d from `public`/`anon`/`authenticated`.

### Secrets

**[Info/Good]** No hardcoded secrets found in tracked source; `.env`/`.env.local` are gitignored; `SUPABASE_SERVICE_ROLE_KEY` is confirmed reachable only from server-side `routes/supabase-admin.ts`, never sent to browser code.

**[Low]** [.do/app.yaml](.do/app.yaml) still provisions `GROQ_API_KEY`/`GROQ_MODEL` and a `GATEWAY_SHARED_KEY`, plus [docker-compose.yml:47](docker-compose.yml#L47) and [.github/workflows/app-ci.yml:179,263](.github/workflows/app-ci.yml) still reference Groq — dead config left from the OpenRouter migration (commit `4a2b4c0`), no code in `lms-api/src` reads `GROQ_*` anymore. → Remove.

**[Low]** [lms-api/src/plugins/auth.ts:32](lms-api/src/plugins/auth.ts#L32) — `JWT_SECRET` falls back to `COOKIE_SECRET` if unset, reducing secret separation. → Require both independently in production.

### PII handling / logging

**[High]** [lms-api/src/lib/email.ts:60](lms-api/src/lib/email.ts#L60) — `sendOtpEmail` logs the raw OTP code and recipient email to stdout whenever `EMAIL_PROVIDER_KEY` is unset. If this fallback ever fires in a misconfigured production/staging environment, it's a full admin-account-takeover path via log access. (Note: the OTP-verify endpoint itself is currently disabled — `auth.ts:591-595` returns `410 mfa_disabled` — but the logging code path remains live and would fire again if OTP is re-enabled without removing this line.) → Never log the raw code; redact as the adjacent `sendMagicLink` fallback already does.

**[Low]** [lms-api/src/lib/email.ts:22](lms-api/src/lib/email.ts#L22) — magic-link recipient email logged in the redacted fallback path.

**[High]** [lms-api/src/routes/academic.ts:650-668](lms-api/src/routes/academic.ts#L650) — `/student/odie/chat` sends student grade, subjects, current assignment content, and the 3 most recent baseline assessment results (scores, weak topics) to OpenRouter as part of the chat context. Legitimate feature, but real academic PII crossing to a third-party US-based LLM aggregator with no corresponding compliance documentation (see below).

**[High]** `docs/compliance/POPIA_DATA_CLASSIFICATION.md` and `docs/compliance/DATA_RETENTION_AND_DELETION.md` contain **zero references** to OpenRouter, "AI," "assistant," "sub-processor," or "cross-border transfer" — an undocumented third-party processor relationship and cross-border data transfer under POPIA. → Add an AI/third-party processors section naming OpenRouter, the data categories sent, and the legal basis for transfer.

**[Medium]** `.env.example` / `.do/app.yaml` default `OPENROUTER_MODEL` to `google/gemma-4-31b-it:free` — a free-tier OpenRouter model, which typically carries weaker/undocumented data-retention guarantees than paid zero-retention options. → Pin a model/provider with a contracted zero-retention policy for any endpoint carrying student PII, or explicitly document the accepted risk.

**[High]** `odie_conversations`/`odie_messages` (written at [lms-api/src/routes/academic.ts:602-678](lms-api/src/routes/academic.ts#L602)) are never touched by `retention-cleanup.ts` and never included in `privacy.ts`'s export/anonymize/delete pipeline — a POPIA access or deletion request against a student will not surface or purge their Odie chat history, even though it contains the same academic PII sent to OpenRouter. → Add these tables to the retention and privacy pipelines.

**[Critical]** No retention/deletion/anonymization mechanism exists anywhere in `docs/supabase/schema.sql` for **any** Supabase table. `lms-api/src/lib/retention.ts`'s cleanup job operates exclusively on Prisma-modeled tables (`sessions`, `invoices`, `pay_periods`, `magic_link_tokens`, Prisma's own `audit_log`) — confirmed via grep, no reference to `students`, `guardians`, or `profiles`. Minors' names, guardian contacts, marks, and feedback stored in Supabase have **no documented or implemented erasure path**. → Add a `SECURITY DEFINER` erasure/anonymization RPC for Supabase tables and extend the `privacy_requests` workflow to cover them.

**[Medium]** [src/lib/monitoring/errorReporting.ts:35-46](src/lib/monitoring/errorReporting.ts#L35) — Sentry `beforeSend` sanitizes `event.contexts`/`event.extra` but not `event.breadcrumbs` or exception messages/stack traces — a thrown `Error.message` built from Supabase row data or an app string could leak PII into Sentry unfiltered. → Scrub breadcrumb `data`/`message` and pass exception messages through the same sanitizer.

### Input validation / sanitization

**[Info/Good]** PDF/invoice generation (`lms-api/src/lib/invoices.ts`) HTML-escapes all interpolated fields; `pdfkit`'s `doc.text()` doesn't interpret HTML — no injection risk. File uploads use server-generated storage names (never client filenames) with MIME/extension allow-lists and size caps.

**[Medium]** [lms-api/src/routes/assistant.ts:14-19](lms-api/src/routes/assistant.ts#L14) (`ChatSchema`) and [domains/assistant/service.ts:158,232](lms-api/src/domains/assistant/service.ts) — `/assistant/chat` and `/assistant/document` accept a client-supplied `systemPrompt` (≤4000 chars) that **fully replaces** Odie's persona-restricted system prompt. Any authenticated user can turn the backend into a generic LLM proxy against the paid OpenRouter key, bypassing all tutoring guardrails and enabling budget abuse. → Remove the free-form override or restrict to the existing `personaVariant` enum.

### Rate limiting / abuse protection

**[Info/Good]** `@fastify/rate-limit` is genuinely registered (not just installed): global 120/min default ([lms-api/src/app.ts:185](lms-api/src/app.ts#L185)), with tighter overrides on `/auth/*` login endpoints, admin bulk actions, payroll, and public/careers chat (20/min).

**[Medium]** [lms-api/src/routes/assistant.ts:499](lms-api/src/routes/assistant.ts#L499), [:527](lms-api/src/routes/assistant.ts#L527), and [academic.ts:580](lms-api/src/routes/academic.ts#L580) — `/assistant/chat`, `/assistant/document`, `/student/odie/chat` have no per-route rate-limit override, inheriting only the 120/min global default despite being the most expensive calls (document endpoint accepts up to 500KB, calls a paid LLM). → Add explicit lower limits matching the 20/min pattern used elsewhere.

**[Low]** [lms-api/src/routes/auth.ts:270-297](lms-api/src/routes/auth.ts#L270) — in-memory sliding-window limiters are never pruned (unbounded `Map` growth over process lifetime) and provide no protection if the API is ever scaled beyond 1 instance.

### CORS

**[Info/Good]** [lms-api/src/app.ts:126-184](lms-api/src/app.ts#L126) — genuine allow-list (not wildcard/reflected-origin), rejects no-Origin requests, restricted to `CORS_ORIGIN` in production; matches `.do/app.yaml`'s configured production domains. Layered with a same-origin/CSRF check (`ENFORCE_SAME_ORIGIN`) for cookie-carrying mutating requests. No regression found from the prior subdomain issue (commit `184a3da` cleanly removed dead `api.` subdomain references).

---

## Phase 4: Testing & Reliability

### Coverage by module

| Area | Coverage |
|---|---|
| Auth/RBAC | Strong — `lms-api/tests/auth-and-rbac.test.ts` (~24 tests): magic-link, cookie/role gating, expired JWT rejection, CSRF, OAuth flows |
| IDOR | Present and verified — `student-dashboard-features.test.ts:183-242`, `tutor-portal-features.test.ts:68-90` |
| Payroll/invoicing | Strong — `admin-routes.test.ts`, `pay-period-locking.test.ts`, `adjustments.test.ts`, `lms-api/tests/e2e/money-flow.test.ts` (full session→payroll→CSV flow) |
| Audit immutability | Strong — `audit-immutability.test.ts` proves DB-level append-only enforcement |
| RLS/RPC | Present but shallow — `tests/frontend/supabase-schema-policy.test.cjs` and `assignment-versioning-locking.test.cjs` are source/regex assertions against the schema file, not live-Supabase integration tests |
| Odie/assistant | **Gap** — unit-level only (persona injection, provider fallback); no `app.inject()` route tests for `/assistant/*` auth branching, rate limits, or the dev-bypass flags |
| Admin MFA | **Gap** — the only "MFA test" (`tests/frontend/admin-mfa.test.cjs:12-48`) regex-matches source code for expected strings; nothing renders the gate or exercises actual block/unblock behavior |
| Payments/Payroll UI (frontend) | **Gap** — no test file references `AdminPaymentsRoute`/`AdminPayrollRoute` at unit or e2e level |
| Tutor-vs-tutor payroll isolation | **Gap** — only admin-role gating tested; no test that Tutor A can't read Tutor B's payroll/adjustment records |

### Reliability

**[Critical]** [lms-api/src/app.ts:350-353](lms-api/src/app.ts#L350) — `uncaughtException` handler logs but never calls `process.exit(1)`, leaving the process running in an undefined state after an uncaught exception. → Flush the error monitor, then exit non-zero.

**[Medium]** `buildApp()` is called 76+ times across `lms-api/tests/`, each re-registering `process.on('unhandledRejection'/'uncaughtException')` with no `removeListener` on close — will trip `MaxListenersExceededWarning` and duplicate-report every process-level error N times in a real test run. → Guard registration with a module-level flag or register once outside `buildApp()`.

**[Medium]** [src/app/main.tsx:26-30](src/app/main.tsx#L26) — exactly one `ErrorBoundary` wraps the entire app; a crash in any single dashboard widget unmounts the whole SPA to a generic fallback. → Add a second layer of boundaries per route/section.

**[Info/Good]** No floating (`.then()` without `.catch()`) promises found in `lms-api/src`; global `setErrorHandler` and `unhandledRejection`/`uncaughtException` hooks exist (just don't exit, see above).

---

## Phase 5: Performance

**[Medium]** [lms-api/src/routes/academic.ts:978-1181](lms-api/src/routes/academic.ts#L978) (`GET /dashboard`) — ~13 sequential `await pool.query()` calls instead of `Promise.all`, on the single most-hit endpoint in the app. → Parallelize independent queries.

**[Low]** [lms-api/src/routes/phase3.ts:586-626](lms-api/src/routes/phase3.ts#L586) — `POST /admin/scores/recompute` loops sequentially over every student when no `userId` filter is given, holding a DB connection for the duration. → Batch or move to the existing job-queue pattern.

**[Medium]** [docs/supabase/schema.sql:76-88](docs/supabase/schema.sql#L76) — `assignments.created_by` has no index despite being the scoping predicate in RLS policies evaluated on every tutor-facing row check (`:1001-1010`, `:1073-1082`). → `create index idx_assignments_created_by on public.assignments(created_by);`

**[Low]** `tutor_payments.tutor_id` has no index (unlike `payments.student_id`); low-risk today since RLS on that table is admin-only, but worth adding for consistency and future scoped tutor views.

**[Medium]** [src/features/admin/AdminStudentsRoute.tsx:26-45](src/features/admin/AdminStudentsRoute.tsx#L26) — the full student roster renders twice (once via `DataTable`, once as a full grid of `StudentRecordCard`, each with ~15 `useState` hooks and its own edit form) with no pagination/virtualization; `linkedGuardians` is recomputed unmemoized on every render. → Paginate and memoize.

**[Low]** Only 13 of ~97 `src/` files use `useMemo`/`useCallback`; equivalent list-filtering logic elsewhere is unmemoized inline. Compounds with the above.

**[Info/Good]** No N+1 loop-query patterns found in Fastify hot paths (JOINs/lateral subqueries used instead); Prisma schema has sensible composite indexes matching actual query patterns; `lucide-react` icons are consistently tree-shaken named imports.

---

## Phase 6: Documentation

**[High]** README.md's [Quick Start](README.md#L25) (`npm install` → `cp .env.example .env` → `npm run build` → `npm run start`) does **not** get a new dev running: no Postgres is started (Docker instructions live 70 lines further down, unreferenced from Quick Start), migrations are never run, and Supabase is never bootstrapped even though it's the documented system of record. → Fold Docker Postgres + migrate + `supabase:start`/`supabase:reset` steps into the literal Quick Start block, or replace it with an explicit multi-terminal checklist linking `docs/supabase/LOCAL_DEVELOPMENT.md` from step 1.

**[Medium]** [README.md:202](README.md#L202) — still instructs devs to set `GROQ_API_KEY`, which commit `4a2b4c0` removed from the active assistant provider (now `OPENROUTER_API_KEY`); a new dev following this configures a dead variable. → Update.

**[Medium]** `ADMIN_BOOTSTRAP_TOKEN` in `.env.example` has no explanatory comment and no documentation page; only discoverable by grepping `lms-api/src/routes/auth.ts:1036`. → Document purpose/usage.

**[High]** `docs/security/FUTURE_LMS_SECURITY_BLUEPRINT.md:20-27` describes, in present tense, a purely Fastify-cookie-session auth model with **no mention of Supabase Auth/RLS or ADR-0001** — directly contradicts the actual current architecture and is linked as an active doc from `docs/README.md:25`, not archived. Would mislead a security reviewer doing a walkthrough. → Archive or add a "superseded by ADR-0001" banner.

**[Medium]** `docs/MIGRATION_AUDIT.md` describes the pre-Supabase-migration state as current ("Supabase Auth is not yet wired into the frontend") but sits in the active docs section rather than `docs/archive/`. → Move or annotate as historical.

**[Info/Good]** `docs/supabase/LOCAL_DEVELOPMENT.md` itself is clear and complete; `docs/archive/` is cleanly separated from active docs; env vars are mostly documented inline in `.env.example` and cross-referenced in the README.

---

## Phase 7: Portfolio/Interview Readiness

### Verified, quantifiable achievements

1. **Migrated the live authorization boundary from a custom Fastify JWT+cookie model to Supabase Auth + Row-Level Security**, documented as an accepted ADR ([docs/architecture/ADR-0001-supabase-first.md](docs/architecture/ADR-0001-supabase-first.md)), spanning 17 RLS-enabled tables and 49 `create policy` statements across a 1,251-line schema, including 11 `SECURITY DEFINER` RPC functions gating privileged mutations (marking, result release, submission versioning).
2. **Built a ~290-assertion automated test suite**: 135 `it()` blocks across the Fastify API (unit/contract/e2e), 154 `test()` blocks across 54 frontend source-contract tests, plus 5 Playwright browser e2e specs exercising real role-based auth and a full payroll money-flow journey end-to-end.
3. **Implemented tamper-evident, database-enforced audit logging** — `audit_log`/`session_history` reject direct `UPDATE`/`DELETE` at the RLS level unless an explicit retention-bypass flag is set, verified by a dedicated immutability test.
4. **Shipped admin TOTP MFA via Supabase Auth AAL2**, with a dev-only bypass flag that is statically eliminated from production bundles by Vite (`import.meta.env.PROD`), not just runtime-gated.
5. **Hand-built a Sentry-compatible error monitor from scratch** (no `@sentry/node` dependency) — DSN parsing and envelope delivery over raw Node `https`, wired into a global Fastify error handler and process-level crash hooks.
6. **Operationalized an 11-workflow CI/CD pipeline** — dependency review, Gitleaks secret scanning, CodeQL SAST, scheduled DB maintenance and disaster-recovery restore verification, and a DigitalOcean deploy workflow that was live-debugged and fixed after a routing regression (commit `184a3da`).
7. **Executed a live production AI-provider migration (Groq → OpenRouter)** with regression tests asserting the old provider key is no longer required, evidencing a verified cutover rather than an untested swap.

### Would look bad in a live demo/walkthrough

- README still tells a new dev to set `GROQ_API_KEY` (dead variable) — see Phase 6.
- Dead Groq scaffolding lingers in `.do/app.yaml`, `docker-compose.yml`, and `.github/workflows/app-ci.yml` after the OpenRouter cutover — a reviewer grepping for it will find loose ends.
- `docs/security/FUTURE_LMS_SECURITY_BLUEPRINT.md` describes a superseded auth model as current — would actively contradict you in a security-focused interview if presented unknowingly.
- [lms-api/src/lib/email.ts:54-62](lms-api/src/lib/email.ts#L54) (`sendOtpEmail`) is dead code — imported but never called since OTP verification returns `410` unconditionally. A reviewer will ask "where's this called from?"
- Test file `lms-api/tests/tutor-loggin.test.ts` has a typo in its filename.
- `/auth/admin/login`'s MFA gap (Critical, above) is the kind of thing that would end a live security walkthrough badly if a reviewer thought to test it directly rather than through the UI.

---

## Findings Index by Severity

**Critical (4):** admin MFA bypass via API (`lms-api/src/routes/auth.ts:546`); RLS submission-RPC bypass (`docs/supabase/schema.sql:1024`); no POPIA erasure path for Supabase PII; `uncaughtException` doesn't exit process (`lms-api/src/app.ts:350`).

**High (8):** OTP plaintext logging; draft-assignment RLS over-exposure; duplicated/unscoped guardian PII on `students`; OpenRouter PII exposure undocumented for POPIA; Odie chat history excluded from privacy pipeline; README quick-start incomplete; stale security blueprint doc contradicts ADR-0001.

**Medium (~18):** see Phases 2–6 above for full list (moderation over-scope, audit-log forgery, `ngo_partners` policy gap, assistant `systemPrompt` override, missing rate limits on LLM routes, dashboard N+1 sequential queries, missing RLS-critical index, unpaginated admin roster, Sentry breadcrumb scrubbing gap, dead Groq config, schema divergence, stale docs, etc.)

**Low (~15):** see Phases 2–6 above (timing-safe comparison, non-null assertion density, duplicated dev-login code, dead dependencies, inconsistent toast usage, minor index gaps, storage-policy asymmetry, unbounded in-memory rate-limit maps, etc.)
