# Frontend Dashboard Performance Budget

Scope: student dashboard, assignments, results, progress, and careers routes.

## Budgets

- Eager React entry (`react-app.js`): <= 1,455,000 bytes uncompressed and <= 320,000 bytes gzip.
- All generated React JavaScript, including lazy route chunks: <= 3,000,000 bytes uncompressed. This is an asset-growth guard, not a first-visit transfer total because lazy chunks are requested independently.
- Largest lazy route chunk: <= 150,000 bytes uncompressed.
- Deferred Supabase Auth shared chunk: <= 275,000 bytes uncompressed and <= 60,000 bytes gzip. It is loaded only for login, onboarding, and portal routes—not public routes.
- React app CSS bundle: <= 140,000 bytes uncompressed and <= 55,000 bytes gzip.
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

Measured after the current production-shaped public build (2026-08-24):

- eager public entry: 645,847 bytes raw / 159,486 bytes gzip;
- deferred Supabase Auth: 257,030 bytes raw / 51,430 bytes gzip;
- largest lazy route chunk: 122,230 bytes;
- generated CSS: 132,446 bytes raw / 49,321 bytes gzip.

The raw caps retain only about 5–6% of deliberate redesign headroom. The gzip
caps measure the user-facing transfer budget and must not be raised without a
new measured baseline and release review.

Public routes boot independently from the authenticated portal. Student, tutor, administrator, parent, NGO, login, and onboarding paths load the Supabase Auth stack only when needed; this keeps the public home page from paying for learner data access code. Smooth-scroll animation dependencies are optional async chunks; native scrolling remains available if those chunks cannot load.

## Notes

The current QA pass uses source and build budgets because Lighthouse requires a local browser runtime and authenticated dashboard session. Keep the JSON report in this folder when a browser-authenticated run is available.
