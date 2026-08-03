# Frontend Dashboard Performance Budget

Scope: student dashboard, assignments, results, progress, and careers routes.

## Budgets

- Eager React entry (`react-app.js`): <= 1,400,000 bytes uncompressed.
- All generated React JavaScript, including lazy route chunks: <= 2,700,000 bytes uncompressed.
- Largest lazy chunk: <= 150,000 bytes uncompressed.
- React app CSS bundle: <= 90,000 bytes uncompressed.
- Student dashboard query freshness: 60 seconds before background data is considered stale.
- Student dashboard refetch triggers: no window-focus or reconnect refetch; manual reload still works.
- Student result list size: bounded by the API to the latest 24 released results.
- Student results analytics input: bounded by the API to the latest 100 released results.
- Motion: transform/opacity only, with `useReducedMotion` fallbacks.
- Icons: Lucide React icons only, imported by name so the build can tree-shake unused icons.

## Lighthouse Tracking

Run after `npm run build` and while serving the built site:

```powershell
npx lighthouse http://127.0.0.1:8080/dashboard/student --output=json --output-path=docs/performance/lighthouse-dashboard-after.json --chrome-flags="--headless"
```

Lighthouse before: not captured before this QA pass.

Lighthouse after: pending local browser run. The enforceable budget check is `npm run perf:budget`, which validates query, bundle, motion, icon, and result-list constraints.

## Code-splitting baseline

Measured after the 2026-08-03 production build:

- eager entry: 1,365,990 bytes;
- all generated JavaScript: 2,582,900 bytes across 48 files;
- largest lazy chunk: 135,690 bytes;
- generated CSS: 83,825 bytes.

Public, student, tutor, administrator, parent, NGO, login, onboarding, and not-found routes load through `React.lazy` boundaries. Smooth-scroll animation dependencies are optional async chunks; native scrolling remains available if those chunks cannot load.

## Notes

The current QA pass uses source and build budgets because Lighthouse requires a local browser runtime and authenticated dashboard session. Keep the JSON report in this folder when a browser-authenticated run is available.
