# POPIA Data Classification

This classification applies to the current Supabase platform. The detailed,
table-level inventory and processor map lives in
[POPIA_DATA_MAP.md](POPIA_DATA_MAP.md); if this summary conflicts with it, update
both rather than relying on a retired API-era schema.

| Class | Examples | Required handling |
|---|---|---|
| **Restricted — minors/guardians** | Learner and guardian identity/contact data, uploaded work, marks, feedback, session notes, reports, risk/career signals | RLS/RPC ownership and organisation isolation, private Storage, minimum collection, audited privileged access, approved erasure/retention workflow |
| **Restricted — workforce/finance** | Tutor identity/qualification documents, applications, invoices, payments, adjustments, payroll records | Tutor-own or admin-only access as appropriate, private Storage, audited mutations, financial retention decisions |
| **Confidential — operations** | Organisation membership, allocations, enrolment, availability, volunteer records, audit/rate-limit metadata | Role/org-scoped access, no public exposure, reviewed retention |
| **Internal/reference** | Subjects, approved content metadata, assignment templates with no learner response | Authenticated/org scope where required; verify no embedded personal information before broader use |
| **Public** | Marketing copy, public guides, contact channels, browser anon key | May be published intentionally; never treat a public client key as authorization |

Bank account details are not intentionally stored by the current application.
Free text and uploaded files must be treated at the highest plausible sensitivity
because users can include unexpected personal information.

This is a technical classification aid and requires legal/operational review
before onboarding minors.
