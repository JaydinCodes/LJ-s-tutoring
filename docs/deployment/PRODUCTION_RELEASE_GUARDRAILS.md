# Production release guardrails

Production deployments are intentionally no longer started by a GitHub push.
`.do/app.yaml` sets `deploy_on_push: false`; `.github/workflows/deploy-production.yml`
starts a DigitalOcean deployment only after the `Release Gates` workflow succeeds
for the current `main` commit. It verifies that `main` still points at that same
SHA immediately before calling DigitalOcean. A later push therefore receives its
own release gate and the older result cannot deploy.

The deployment workflow requires these GitHub secrets:

- `DIGITALOCEAN_ACCESS_TOKEN` — a DigitalOcean token that can create a deployment
  for this App Platform application.
- `DIGITALOCEAN_APP_ID` — the immutable App Platform ID, not its display name.

Set the workflow's `production` environment to require the release approvers your
team chooses. Environment protection is the final human approval point after the
automated release gate.

## Required GitHub branch rules

Branch protection/rulesets are repository settings and cannot be enforced by a
checked-in ZIP. In GitHub, protect `main`, require pull requests, dismiss stale
approvals, block force pushes, and require these checks to pass before merging:

- `App CI / dependency-security`
- `App CI / lint`
- `App CI / unit-web`
- `App CI / supabase-rls-runtime`
- `App CI / frontend-smoke`
- `App CI / build`
- `Security Stack / secret-scan`
- `Security Stack / sast-codeql`
- `Security Stack / dependency-policy`
- `QA / qa`
- `Lighthouse CI / lighthouse`
- `Release Gates / gates`

Do not allow administrators to bypass these rules. The `Release Gates / gates`
check is intentionally the complete application, security, database, browser,
accessibility, performance, and release-evidence suite. All third-party GitHub
Actions in this repository are pinned to full immutable commit SHAs.

DigitalOcean App Platform builds the configured GitHub source rather than
accepting a GitHub Actions build artifact. The pre-deployment SHA check plus the
single-concurrency release workflow ensures that source is the commit that passed
Release Gates. If the platform is later changed to support immutable uploaded
artifacts, retain this workflow and replace only its final deployment step.
