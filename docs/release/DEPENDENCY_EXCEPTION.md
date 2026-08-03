# Dependency remediation register

**Verified:** 2026-08-03

`npm audit fix --package-lock-only` resolved the non-breaking PostCSS, Rollup,
and Picomatch advisories. REPO-01 also removed the unused direct `date-fns`,
`recharts`, and `ws` declarations and classified the Vite/Tailwind plugins as
build-only dependencies.

The verified residual counts are:

- `npm audit --omit=dev --json`: 2 affected packages, both moderate
  (`react-router-dom` and its `react-router` dependency; three advisory records).
- `npm audit --json`: 9 affected package entries (2 low, 5 moderate, 2 high),
  including build/QA-only dependency chains.

| Dependency | Finding | Required remediation | Owner / gate |
|---|---|---|---|
| React Router 6 | Three moderate redirect and SSR-hydration advisories in the production dependency graph | Upgrade to React Router 7, then test every role guard, redirect, direct route, and navigation flow. | Frontend; tracked breaking upgrade. The current high-severity production CI gate passes while these moderate findings remain explicitly recorded. |
| Vite 5 / esbuild | One high Vite finding plus related moderate Vite/esbuild development-server findings | Upgrade to Vite 8 and its supported React plugin, then validate local development, production chunks, and the DigitalOcean build. | Platform; required before the next tooling upgrade release. |
| Lighthouse CI toolchain | `@lhci/cli` reaches vulnerable `tmp`, `uuid`, `inquirer`, and `external-editor` versions; npm offers no safe in-range repair | Track an upstream release or replace the runner. Do not accept npm's suggested forced downgrade to `@lhci/cli@0.1.0`. | QA tooling; isolated to CI/development execution and reviewed before any Lighthouse tooling upgrade. |

The Vite and Lighthouse chains are build/development-tooling concerns in the
current static deployment; the React Router findings are in the production
dependency graph. All remain upgrade work and must not be silently waived.
This register is a time-bounded disposition, not a claim that the advisories
are fixed.
