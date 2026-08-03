# React Migration Cleanup Checklist

> **Historical cutover tracker.** This checklist records work performed while
> the unified React app became the production route owner. It is retained for
> audit context, not as a current deployment or cleanup runbook. Use
> [ARCHITECTURE.md](architecture/ARCHITECTURE.md) and the root
> [README](../README.md) for the current topology.

This checklist records the final cutover posture after the unified React app became the production route owner.

## Completed Cleanup

- Production build no longer compiles or ships the retired `student-app` bundle.
- Retired `student-app-dist/`, `vite.student.config.ts`, and `tsconfig.student.json` were removed from active tooling.
- The inactive `student-app/` source tree and obsolete `assets/app-critical.js` were removed after route parity; their history remains available in Git.
- Fifty-four unreachable non-Community legacy assets were removed after the production copy allowlist was verified; Git history remains the recovery record.
- Production build no longer copies legacy `admin/`, `dashboard/`, `student/`, `tutor/`, `reports/`, or `guides/` route trees into `dist/`.
- Root `index.html` is now the Vite React shell for local development.
- Obsolete public static entry files `login.html`, `privacy.html`, `terms.html`, and `guides/*.html` were removed after React route parity.
- `scripts/build-static.js` generates React shells for public, auth, onboarding, student, admin, and tutor routes.
- DigitalOcean App Platform ingress now points legacy dashboard/student/tutor/admin URLs at the unified `/dashboard/*` React routes.
- The service worker now precaches React bundle assets instead of legacy static CSS/JS.

## Retained Asset Contract

- Six production/build assets remain on the explicit allowlist documented in [STATIC_ASSET_OWNERSHIP.md](architecture/STATIC_ASSET_OWNERSHIP.md).
- `assets/lib/sanitize.js` remains because the public-asset contract and frontend safety tests exercise it directly.
- `assets/student/community.js` remains untouched solely under the project owner's explicit Community exclusion. It is not copied to production and is not an active dependency.
- Removed source remains available in Git history; duplicate executable archives are not kept in the active tree.
- The former Fastify/Prisma fallback was subsequently retired. Its appearance in earlier checklist revisions is historical; current browser data access is Supabase-first.

## Remaining Asset Cleanup

There are no remaining authorized legacy-asset candidates. The sole historical
Community file is deliberately deferred until the project owner reopens
Community scope.

## Verification Checklist

- `npm run typecheck:react`
- `npm run test:frontend:unit`
- `npm run build`
- Confirm `dist/` contains React route shells and does not contain retired portal route trees.
- Confirm `/dashboard/login/`, `/dashboard/student/`, `/dashboard/admin/`, and `/dashboard/tutor/` load from the built static server.
