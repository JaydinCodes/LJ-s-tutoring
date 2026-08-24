# Project Odysseus Production-Readiness Register

This is a fail-closed register for work that source code cannot truthfully mark
complete. A release lead must record evidence in the approved change/incident
system before enabling external onboarding, a learner pilot, or non-essential
dashboard work.

| Gate | Required evidence | Status in repository | Release decision owner |
| --- | --- | --- | --- |
| Production deployment configuration | `production` environment contains the seven named provider secrets plus `CLOUDFLARE_ORIGIN_URL`; each credential can read its declared target | Remote configuration query found **0 GitHub Actions secrets** and no `CLOUDFLARE_ORIGIN_URL`; workflow now validates every value before any provider write | Repository administrator + release lead |
| External onboarding | `EXTERNAL_ONBOARDING_ENABLED=true` explicitly approved only after the gates below; recovery/resend remains available | Edge Function defaults fail-closed and returns `external_onboarding_frozen` for new users | Product + release lead |
| Cloudflare deployment credential | Token owned by the correct account with Workers Scripts write permission; successful production deploy and headers probe | Blocked by the last failed deployment; workflow now preflights the credential | Platform/release lead |
| Partial-release reconciliation | DigitalOcean, Supabase migrations/Functions, Cloudflare Worker, and live probes reconciled to one SHA; rollback plan tested | Requires production access and a supervised run | Release lead |
| Backup and restore | Managed Supabase backup/PITR capability recorded; isolated database + Storage drill evidence meeting RPO/RTO | Runbook present; no drill evidence in source control | Recovery lead |
| Safeguarding | Named safeguarding lead, written escalation process, processor/data agreements, and a restricted vetting register | Database denies new active allocations without dated verification; people/legal evidence remains external | Safeguarding lead |
| Tutor reconciliation | Every currently active tutor verified, expiry monitored, and existing active allocations reviewed | Migration deliberately creates `pending` records; it never fabricates approval | Safeguarding lead + operations |
| Production auth/RLS | Independent test users demonstrate all role and cross-organisation boundaries in production | Local pgTAP coverage passes; `profile_identities` is now RLS-enabled with no direct client policy or grant; production evidence required | Security/release lead |
| Grade 12 Maths content | Licensed/owned CAPS-aligned content, teacher review, answer/rubric QA, and accessible delivery acceptance | No content or educator sign-off is represented by code | Curriculum owner |
| Pilot cohort | Consent/guardian process, support rota, success measures, incident route, and an approved limited cohort | Requires product/operations decisions | Product owner |

Community remains excluded from production until it has a separate safeguarding,
moderation, and incident-response approval. The dependency spine is therefore:
production proof → multi-organisation production test → Grade 12 Maths content
and review → limited pilot cohort.
