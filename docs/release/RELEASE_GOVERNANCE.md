# Release Governance

This is the maintained release process for the unified React + Supabase
application. A release is eligible for promotion only when the exact revision
passes both the required pull-request checks and the manually dispatched
`Release Gates` workflow.

## Required gates

The release workflow runs these checks fail-closed:

1. Generate and validate the rollback plan.
2. Lint, type-check, and run the frontend/source-contract test aggregate.
3. Rebuild local Supabase from committed migrations, run the pgTAP allow/deny
   matrix, and compare generated database types with the committed snapshot.
4. Run the production high-severity dependency audit.
5. Build the static application, enforce the static asset budget, and validate
   monitoring assets.
6. Run seeded real-auth browser journeys against the disposable local Supabase
   stack, followed by the deterministic mock browser suite.
7. Validate generated HTML, canonical links, accessibility, and Lighthouse
   budgets against the built site.
8. Generate, validate, and upload the release evidence artifact.

Use the same package scripts locally; do not substitute unpinned global tools:

```bash
npm run lint
npm run typecheck
npm test
npm run supabase:start
npm run supabase:reset
npm run test:rls:runtime
npm run supabase:types:check
npm audit --omit=dev --audit-level=high
npm run build
npm run perf:budget
npm run validate:monitoring
npm run test:e2e:install
npm run test:e2e:supabase
npm run test:e2e
```

The built-site QA and Lighthouse commands are documented in
[TESTING.md](../testing/TESTING.md).

## Promotion and rollback

- Generate `releases/rollback/latest.md` from the committed template and fill
  in the deployment-specific owner, revision, triggers, and recovery steps.
- Record the exact commit SHA and the `release-gates-evidence` workflow artifact.
- Deploy only the revision covered by that evidence.
- Run the approved live-user scope in [TESTING.md](../testing/TESTING.md) before
  broad onboarding.
- Hold promotion on any failed gate, unauthorized-data result, failed uptime
  probe, or unowned manual prerequisite.
- If a new deployment causes a regression, use the hosting platform's reviewed
  revision rollback procedure and then rerun the health probes. The repository
  does not contain a production API deploy or automated database-restore
  workflow.

## Evidence to retain

- Release-gates workflow run and uploaded evidence JSON.
- Rollback plan for the exact release.
- App CI, Security Stack, QA, and Lighthouse results for the same SHA.
- Deployment identifier and production health-probe snapshot.
- Live-user test decision, timestamp, named owner, monitoring snapshot, and
  cleanup notes when that scope is used.
- Any approved dependency, hosting, or owner-deferred security exception.

## Active workflow map

- Pull-request application gates: `.github/workflows/app-ci.yml`
- Secret scanning, CodeQL, and dependency review:
  `.github/workflows/security-stack.yml`
- Canonical static QA: `.github/workflows/qa.yml`
- Lighthouse budgets: `.github/workflows/lighthouse-ci.yml`
- Strict release evidence: `.github/workflows/release-gates.yml`
- Hourly web/Supabase probes: `.github/workflows/uptime-check.yml`
- Pull-request preview only: `.github/workflows/preview-deploy.yml`

The current known manual blockers and platform limitations are tracked in
[AUDIT_REMEDIATION_STATUS_2026-08-03.md](AUDIT_REMEDIATION_STATUS_2026-08-03.md).
