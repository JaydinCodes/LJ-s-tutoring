# POPIA Data Map — Current Supabase Platform

**Status:** maintained implementation map, verified against
`docs/supabase/schema.sql` and the active React/Edge Function code on 2026-08-09.
The retired Fastify/Prisma stack holds no current platform data. This map still
requires review by a South African privacy professional before production
onboarding; it is technical evidence, not legal advice.

## Scope and purpose

The platform processes minors' identity, academic work, progress, guardian
relationships, and tutor information. This document records where that data is
held, who processes it, and which automated retention/erasure controls actually
exist. Historical Prisma-era compliance runbooks are not current controls.

## Supabase data inventory

Sensitivity: **High** means minor/guardian identity, academic records, private
communications, vetting documents, or financial records. **Medium** is
person-linked operational data. **Low** is reference/content data.

| Domain | Main tables or Storage | Data | Sensitivity and boundary |
|---|---|---|---|
| Identity and roles | Supabase Auth, `profiles`, `profile_identities` | Email, name, phone, role, auth identity | High; self/scoped admin, with Auth owned by Supabase |
| Learners and guardians | `students`, `guardians`, `student_guardians` | Grade, school, guardian contact and permissions | High; learner/guardian/allocation/admin and org-scoped policies |
| Organisations | `organizations`, `organization_members`, `ngo_partners` | Membership, role, partner identity | Medium–High; organisation-scoped RLS |
| Teaching operations | `tutors`, `classes`, `class_enrollments`, `tutor_student_allocations`, `sessions`, `session_history` | Tutor profile, enrolment, attendance, notes, allocations | High; role/allocation/org-scoped RLS and secured RPCs |
| Assignments | `assignments`, `assignment_submissions`, `student_progress`; private `assignment-files`, `assignment-submissions`, and legacy `assignment-memos` buckets | Instructions, learner work, marks, feedback, files, legacy private tutor memos, AI draft outputs | High for learner records; ownership/marker/admin policies and RPC-controlled mutations |
| Reports and outcomes | `weekly_reports`, `student_notifications`, score/career snapshots, assessments, goals, exam events | Progress payloads, notices, risk and career signals | High; owning learner, permitted guardian/tutor/admin policies as applicable |
| Careers | `student_career_profiles` | Interests, target careers, APS context | High; owning learner/admin boundary |
| Tutor onboarding | `tutor_applications`, `tutor_documents`, `tutor_availability_slots`; private `tutor-documents` bucket | Qualifications, application details, evidence files, availability | High; self/admin and private Storage policies |
| Finance | `payments`, `tutor_payments`, `pay_periods`, `adjustments`, `invoices`, `invoice_lines` | Billing and payout records | High; tightly scoped role/RPC access |
| Privacy and audit | `privacy_requests`, `audit_log` | Request details, actor/action metadata | High; platform-admin controls |
| Volunteering | `volunteer_events`, `volunteer_logs` | Event participation, hours, evidence reference | Medium–High; tutor-own/admin access |
| Rate limiting | `edge_function_rate_limit_events` | Hashed caller key, function name, time bucket/count | Medium; service-maintained operational security data |
| Community | `community_*` tables | Rooms, messages, questions, answers and submissions | High if enabled for minors; **not release-approved and explicitly deferred** |

The careers-chat Edge Function is stateless from the application's perspective:
there is no active Odie conversation/message table. The browser sends the
learner's current question, up to eight preceding chat messages, and the
careers-profile fields displayed in Odie: interests, preferred subjects, saved
careers, and APS target. The Edge Function forwards that payload to Groq.

## Operators and cross-border processing

| Operator | Data received | Current use and action |
|---|---|---|
| Supabase | Auth identities, database rows, private files, Edge Function requests | Primary platform. Confirm the actual project region and contractual transfer safeguards in the Supabase dashboard/contract; do not infer it from DigitalOcean's region. |
| Groq | Current careers-chat question, up to eight preceding messages, and Odie careers-profile context (interests, preferred subjects, saved careers, APS target) | Edge Function AI processor. Public notice names Groq and the actual fields sent; legal/vendor review must confirm retention, sub-processors, location, and POPIA section 72 transfer basis. Avoid including names/contact details in prompts. |
| Google Gemini | Assignment submission files or text answers and rubric JSON | AI marking processor for draft marks and feedback. Legacy private tutor memos are not sent. The tutor still reviews and saves the final mark manually; confirm retention, region, sub-processors, and transfer basis before launch. |
| DigitalOcean | Static site assets and public browser configuration | Static frontend only; no Fastify/API service and no platform database. Region is configured as `fra` in `.do/app.yaml`. |
| Sentry (optional) | Browser error events and deliberately limited pseudonymous context | Disabled without explicit public config; `sendDefaultPii: false` and application context scrubbing are implemented. Validate production sampling and captured breadcrumbs before enabling for learners. |
| Auth email/SMTP provider | Recipient address and authentication/invitation email content | Confirm the configured Supabase Auth SMTP provider and contract before launch. Public enquiries are composed in the visitor's own email or WhatsApp app. |

Maintain processor agreements, security measures, retention terms, breach
contacts, and cross-border transfer bases outside this technical map.

## Minors and data minimisation

- Record competent-person/guardian authority before processing a minor's data or
  granting a guardian report link.
- `students.parent_name` and `parent_contact` duplicate structured guardian data;
  stop populating and remove these compatibility fields through a reviewed
  migration when all callers are repointed.
- NGO-partner output must remain aggregate-only with small-cohort suppression.
- Gemini grading drafts use the learner submission and rubric only; private
  legacy tutor memos are not sent. The result stays a draft until a tutor or
  admin explicitly saves it.
- Never expose one learner's work, marks, session notes, contact details, or
  guardian data through another learner/tutor/organisation context.
- Community remains an onboarding blocker while its safety/isolation work is
  deferred; hiding navigation alone is not an authorization control.

## Retention controls implemented today

`run_retention_cleanup(p_apply boolean default false)` is admin-only, requires
the authoritative platform-admin check (including AAL2), and defaults to a dry
run. Scheduled apply runs use `run_retention_cleanup_scheduled()`, which is
granted only to `service_role` and validates the signed JWT role claim. The
shared destructive worker is private and has no API-role `EXECUTE` grants. With
`p_apply => true` the cleanup currently covers:

| Data | Window | Behavior |
|---|---|---|
| Assignment submissions and corresponding private files | 3 years | Delete eligible rows; Storage privilege failure is reported for service-role follow-up |
| Student progress | 3 years | Delete eligible rows |
| Audit log | 5 years | Delete eligible rows |
| Settled student/tutor payments | 7 years | Delete rows with old non-null `paid_at`; pending records are retained |

The repository does **not** yet contain evidence of a production scheduler for
this RPC. Sessions/history, weekly reports, notifications, onboarding documents,
volunteer records, rate-limit events, and other tables require explicit reviewed
retention decisions or separate cleanup mechanisms. Do not claim the dry-run RPC
alone is a complete retention programme.

## Access, correction, and erasure controls

Admin-gated RPCs implement the current workflow:

- `export_student_data(student_id)` returns the core learner/profile/guardian,
  careers, submission, progress, enrolment, allocation, and payment records.
- `anonymize_student(student_id)` removes major academic/career/reporting rows,
  clears session free text, detaches guardian links, removes/anonymizes identity,
  and preserves financial/audit history where required.
- `process_privacy_request(request_id)` records and dispatches access/deletion
  requests; corrections use reviewed admin updates.

Important completion work remains:

1. Extend and regression-test the access export whenever the schema gains a new
   learner-linked table; the current export does not automatically discover new
   domains.
2. If SQL cannot remove Storage objects, complete the reported follow-up with a
   service-role Storage client.
3. Delete/disable the corresponding `auth.users` identity with the Supabase Admin
   Auth API after the approved retention/identity decision.
4. Define handling for financial/session/audit records that are retained after
   anonymisation and document the lawful basis.
5. Keep evidence of requester/guardian authority, approval, execution, and any
   exception or legal hold.

## Release blockers and owners to assign

- Legal review of minors' consent, processor terms, and cross-border bases.
- Production scheduler plus dry-run/apply evidence for approved retention jobs.
- Vendor review for Google Gemini retention, transfer basis, and sub-processors
  before relying on AI grading in production.
- Named privacy request owner and service-role completion procedure.
- Removal of duplicate inline guardian fields.
- Explicit enable/disable enforcement and safety review for Community before any
  real-user access.
