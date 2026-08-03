# Audit Remediation And Release Readiness — 2026-08-03

This is the current repository-authority status for the 2026-08-02 audit. It
separates implemented code from owner/platform actions that cannot be completed
or proved by a source change. The maintained architecture and executable CI
configuration remain the technical sources of truth.

| Area | Repository status | External/manual status | Release position |
|---|---|---|---|
| Phase 0 visible breakages | Tailwind opacity/typo fixes, role-shell contrast coverage, Groq privacy copy, default tests, exact health contract, and strict high-severity production audit are implemented. | Rotate the audit-referenced hosted student credential and invalidate its active sessions if it was real or reused; repository work cannot prove this Supabase Auth action occurred. | Do not treat credential removal from source as credential rotation. |
| SEC-01 / Phase 3 Community | Owner explicitly skipped and deferred all Community remediation. No claim of isolation/safeguarding completion is made. | Decide disablement/enforcement at the deployed boundary or complete the full Phase 3 redesign before real users. | Community is not release-approved; it remains an onboarding blocker even if navigation is hidden. |
| Phase 1 database/delivery | Immutable migrations, clean local reset, pgTAP authorization matrix, lint, pinned QA, generated-type drift gate, and required real local-Supabase role journeys are wired into normal/release CI. | GitHub runners must have Docker capacity; final green evidence must come from the committed migration chain. | Required gates must remain fail-closed. Mock Playwright is supplemental only. |
| OPS-01 uptime | `/health.json` has an exact JSON/content-type contract; Supabase Auth and zero-row PostgREST probes are required and fail on missing config. | Set GitHub repository variables `HEALTHCHECK_URL`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`; confirm scheduled workflow evidence. | A workflow file alone does not prove the variables or scheduler are active. |
| Browser monitoring | Sentry is production-gated, strips default PII, filters sensitive metadata, tags releases/routes, and now distinguishes the React not-found route. Retired Fastify Prometheus assets are no longer treated as current evidence. | Configure the reviewed Sentry browser DSN/environment/release values in DigitalOcean, test sanitized delivery in staging, and confirm a named human receives alerts. | Source validation is not proof of deployed telemetry or acknowledgement. |
| Phase 2 web quality | Media optimization, constrained hero-video behavior, route splitting/budgets, accessibility semantics/modal focus, React not-found UI, CSP/form/Sentry alignment, and public copy cleanup are represented in code/tests. | DigitalOcean static-site catch-all cannot currently provide a true unknown-route `404` or arbitrary HSTS/security response headers through this app spec. An edge/proxy/platform capability change is required. | React marks not-found content, but HTTP 200 catch-all and response-header limitations remain documented hosting risks. |
| Dependencies | Non-breaking fixes landed; normal CI requires `npm audit --omit=dev --audit-level=high`. | React Router 7, Vite 8/esbuild, and Lighthouse-chain remediation require breaking/upstream work. | Residuals are explicitly time-bounded in [DEPENDENCY_EXCEPTION.md](DEPENDENCY_EXCEPTION.md), not silently accepted. |
| Documentation | Root/current runbooks describe the single Supabase stack; obsolete Fastify/Docker plans are marked historical or archived. | Legal/privacy/vendor and operational ownership decisions still require human review. | Documentation accuracy is not legal or production-operational approval. |

## Verified repository evidence

- Clean migration replay through the frozen baseline and forward migrations.
- Runtime pgTAP allow/deny matrix.
- TypeScript/React lint and type-check.
- Frontend/source-contract tests and production build.
- Static performance budget and production high-severity dependency gate.
- Mock UI journeys plus a separate, fail-closed local-Supabase Auth/RLS journey.

Record exact counts, commit SHA, workflow run IDs, and generated artifacts in the
release evidence produced by the final committed revision; this document does
not assign a release SHA to an uncommitted working tree.

## Required pre-onboarding decisions

1. Complete hosted credential rotation/session invalidation evidence.
2. Keep Community inaccessible to real users while SEC-01/Phase 3 is deferred.
3. Confirm production database backup/restore, retention scheduling, processor
   agreements, cross-border safeguards, and minors' consent workflow.
4. Configure and observe the three uptime repository variables/probes.
5. Accept the documented static-host limitations or move the edge to a service
   capable of true 404 and required response headers.
