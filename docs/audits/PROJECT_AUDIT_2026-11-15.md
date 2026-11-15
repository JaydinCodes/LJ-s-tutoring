# Project Audit — 2026-11-15

## Executive Summary

The active application is a React/Vite frontend backed by Supabase Auth, Postgres/RLS, Storage, and Edge Functions. The default application checks are strong and passed after a clean lockfile install. The project is **not ready for an unqualified security/privacy sign-off**: administrator MFA is deliberately no longer enforced, and the newer formal-assessment records are not covered by the existing student export/anonymization/retention procedures. The production deployment lifecycle also omits a scheduled Edge Function.

This is a repository-level defensive audit, not a penetration test, legal opinion, or verification of the deployed production environment. `.env.local` was not opened. Existing user changes were preserved.

## Findings

### High — Admin RPC authorization no longer requires MFA

The current `is_platform_admin()` implementation accepts an authenticated profile with `role = 'admin'`; it does not check the Supabase AAL claim. The migration explicitly makes MFA optional. This controls sensitive database operations, including privacy and financial administration, so a stolen admin password/session can reach privileged RPCs without a second factor. The current retention and POPIA documents still claim these operations require AAL2, which is no longer true.

Evidence: [admin authorization migration](../../supabase/migrations/20261029120000_remove_admin_mfa_requirement.sql#L1), [retention runbook](../compliance/DATA_RETENTION_AND_DELETION.md#L12), [POPIA data map](../compliance/POPIA_DATA_MAP.md#L78).

**Action:** Restore AAL2 enforcement in the database authorization boundary for sensitive admin operations, or record an explicit risk acceptance and update the runbooks. Add runtime tests that prove the selected AAL policy. This is an intentional product/security decision, not an accidental client-only bypass.

### High — Formal assessment data is outside privacy export and erasure coverage

The student anonymization procedure removes legacy assessment/progress tables but does not touch the formal assessment session, answer, answer-event, per-question result, or mastery-evidence tables added later. Those records retain a student foreign key and include selected answers, scores, recommendations, and evidence. The privacy map also says the export is manually curated and must be extended when new learner-linked tables are added. Current retention rules do not define a lifecycle for these newer records.

Evidence: [anonymization procedure](../../supabase/migrations/20260803162120_project_odysseus_schema_baseline_part2.sql#L309), [assessment session and answer schema](../../supabase/migrations/20261107120000_grade9_term1_assessment_engine.sql#L50), [POPIA export and erasure follow-ups](../compliance/POPIA_DATA_MAP.md#L113).

**Action:** Extend the access export and deletion/anonymization workflow to these records, or specify which immutable records must be retained and on what approved basis/window. Add a regression test that fails whenever a new student-linked table is absent from export, erasure, or retention coverage.

### Medium — Scheduled learning-retention worker is outside the release lifecycle

A migration schedules a daily request to `materialize-learning-retention`, and the function itself only accepts the service-role bearer. However, the production deployment loop does not deploy this function, the checked-in Supabase function configuration has no section for it, and the Edge Function type-check lists omit it. A production deployment can therefore leave this worker missing or stale while the database schedule continues calling it.

Evidence: [scheduler migration](../../supabase/migrations/20260923205016_sprint5_learning_retention_reporting.sql#L182), [worker implementation](../../supabase/functions/materialize-learning-retention/index.ts#L1), [production deployment function list](../../.github/workflows/deploy-production.yml#L167), [release type-check gate](../../.github/workflows/release-gates.yml#L49).

**Action:** Add the worker to function configuration, deployment, Deno type-check, and deployed-policy verification; assert the scheduled endpoint is deployed and responds successfully.

### Medium — Full dependency tree has unresolved high/critical advisories

The current full `npm audit` reports 52 vulnerabilities: 2 low, 19 moderate, 29 high, and 2 critical. The production-only audit reports two moderate React Router advisories and passes the configured high-severity threshold. High/critical findings are largely in development and QA toolchains, including Vite, Lighthouse/Pa11y/Puppeteer, and transitive dependencies; those tools still execute in CI. The existing dependency exception register reports older full-tree counts and needs refresh.

Evidence: [dependency exception register](../release/DEPENDENCY_EXCEPTION.md#L1), [production dependency gate](../../.github/workflows/release-gates.yml#L97), [security workflow](../../.github/workflows/security-stack.yml#L1).

**Action:** Refresh the exception register from the current lockfile, prioritize direct tooling upgrades/replacements, and add a full-tree advisory review gate with narrowly documented exceptions. Keep the existing production audit gate.

### Low — Migration inventory check is line-ending-sensitive on Windows

`supabase:docs:check` compares the generated LF text with the checked-out file byte-for-byte. In this Windows workspace (`core.autocrlf=true`), the command fails because the generated inventory is checked out with CRLF, even though all 127 top-level migrations are present. Linux CI is not affected by the observed checkout setting.

Evidence: [inventory generator comparison](../../scripts/generate-supabase-schema-docs.cjs#L34), [migration inventory](../supabase/SCHEMA_AND_POLICY_INVENTORY.md#L1).

**Action:** Normalize line endings before comparison or define a stable LF policy for the generated inventory.

### Low — README enquiry-processing description is stale

The public React privacy notice and enquiry implementation name Formspree, while the README says enquiry details are not sent to a third-party form processor. This can mislead maintainers about the data flow even though the public page names the processor.

Evidence: [public privacy notice and enquiry flow](../../src/app/routes/PublicRoutes.tsx#L327), [README environment notes](../../README.md#L143).

**Action:** Align the README with the actual configurable Formspree flow and the public privacy notice.

## Verification

Passed:

- `npm ci` from the committed lockfile; `npm test` (502/502).
- `npm run typecheck`, `npm run lint`, and full `npm run build`.
- `npm run check:security-definer-search-path` and `npm run verify:edge-function-policy`.
- `npm audit --omit=dev --audit-level=high` (exit 0; two moderate React Router advisories remain).
- `npm run perf:budget` and `npm run validate:monitoring`.
- `npm run assessment:content:qa` (258 questions across 17 forms).
- Generated-site HTML validation, internal link crawl, and Pa11y WCAG 2 AA (6/6 routes).
- React E2E: 71 passed, 16 skipped, 2 timed out in the parallel run. The two timed-out homepage/admin-login cases passed when rerun serially, indicating load-sensitive test flakiness rather than a reproduced functional defect.

Not verified / blocked:

- `npm run test:rls:runtime` was run against the already-running local Supabase database and failed because it is behind the checked-in migrations (assessment tables/questions missing; old admin policy behavior). I did not reset the local database because that would destroy its current data. Re-run after an approved local reset.
- Production Deno type-check and deployment state were not verified locally; Deno is unavailable in this environment. The release workflow has the coverage gap described above.
- AI queue capacity was skipped because no explicit Supabase credentials were supplied. No `.env.local` values were read.
- Production response headers, scheduled jobs, backups/restore, Sentry delivery, Cloudflare route activation, and provider credentials require live production evidence unavailable to this audit.
- Automated math/content checks passed; this does not replace curriculum-owner review or approval for learner release.

## Additional Notes

- The two tracked copies of `20260830014000_student_learning_runner.sql` are byte-identical; only the top-level migration is part of the migration manifest. The nested copy is redundant, not a divergent migration.
- Community remains explicitly not release-approved in the current remediation notes. Keep it inaccessible until safeguarding/isolation work and the required owner decision are complete.
- `AUDIT.md` contains a clearly marked historical report about the retired Fastify stack; its old findings must not be used as current evidence.
- POPIA, minors' consent, processor terms, and cross-border transfer decisions require review by the appropriate South African privacy/legal owner.
