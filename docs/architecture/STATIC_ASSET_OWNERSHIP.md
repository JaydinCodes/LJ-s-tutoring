# Static Asset Ownership

**Status:** current source-of-truth, verified 2026-08-03.

The production static build uses a closed asset allowlist. A file belongs in
the active `assets/` tree only when it has a named consumer, appears in
`assetCopyTargets` in `scripts/build-static.js`, and is covered by a test.

## Production Allowlist

| Source file | Consumer and reason for retention |
|---|---|
| `assets/analytics.js` | Loaded by public route shells as the fail-safe telemetry bridge; defaults to disabled. |
| `assets/analytics-module.js` | Explicitly copied ES-module compatibility wrapper around the telemetry bridge. |
| `assets/portal-config.js` | Loaded by every React shell and rewritten in `dist/` by `scripts/inject-config.js` with public runtime configuration. |
| `assets/sw-register.js` | Loaded by public route shells to register and safely update the service worker. |
| `assets/tailwind-input.css` | Tailwind source entry compiled into the production stylesheet by `npm run build:css`. |
| `assets/lib/sanitize.js` | Small compatibility sanitizer preserved by the explicit public-asset contract and exercised directly by security tests. |

## Owner-Excluded Historical File

`assets/student/community.js` is not active, is not copied to `dist/`, and may
contain imports of retired modules. It remains untouched solely because the
project owner explicitly excluded all Community work. It must not be treated as
a production dependency or restored to the copy allowlist without a separate
Community security and product decision.

## Retired Assets

On 2026-08-03, 54 unreachable legacy files were removed from `assets/`: 16
admin portal files, 17 non-Community student portal files, 7 tutor portal files,
10 shared legacy scripts/styles, 3 retired arcade helpers, and 1 unused mascot
animation. The obsolete word-list fetcher that targeted a retired arcade asset
was removed at the same time. Git history is the recovery and audit record.

A new static asset requires all three of the following:

1. A concrete active consumer.
2. An explicit `assetCopyTargets` entry when it must ship outside Vite.
3. A source-contract or behavior test and an update to this inventory.
