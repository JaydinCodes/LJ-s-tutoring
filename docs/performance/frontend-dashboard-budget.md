# Frontend Dashboard Performance Budget

Scope: student dashboard, assignments, results, progress, and careers routes.

## Budgets

- React app JS bundle: <= 1,500,000 bytes uncompressed.
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

## Notes

The current QA pass uses source and build budgets because Lighthouse requires a local browser runtime and authenticated dashboard session. Keep the JSON report in this folder when a browser-authenticated run is available.
