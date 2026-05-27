# React Migration Cleanup Checklist

This checklist records the final cutover posture after the unified React app became the production route owner.

## Completed Cleanup

- Production build no longer compiles or ships the retired `student-app` bundle.
- Retired `student-app-dist/`, `vite.student.config.ts`, and `tsconfig.student.json` were removed from active tooling.
- Production build no longer copies legacy `admin/`, `dashboard/`, `student/`, `tutor/`, `reports/`, or `guides/` route trees into `dist/`.
- Root `index.html` is now the Vite React shell for local development.
- Obsolete public static entry files `login.html`, `privacy.html`, `terms.html`, and `guides/*.html` were removed after React route parity.
- `scripts/build-static.js` generates React shells for public, auth, onboarding, student, admin, and tutor routes.
- DigitalOcean App Platform ingress now points legacy dashboard/student/tutor/admin URLs at the unified `/dashboard/*` React routes.
- The service worker now precaches React bundle assets instead of legacy static CSS/JS.

## Retained As Reference

- Legacy source HTML/CSS/JS files may remain in the repository for audit history, copy comparison, and rollback research.
- `assets/lib/sanitize.js` remains because frontend safety tests exercise it directly.
- Existing Fastify/Prisma API routes remain active while React repositories use them as operational fallbacks during the Supabase transition.

## Next Safe Deletion Candidates

- `student-app/` after any remaining historical comparison need is gone.
- Legacy source route folders: `admin/`, `dashboard/`, `student/`, `tutor/`, `reports/`, and static `guides/*.html`.
- Legacy browser modules under `assets/student/`, `assets/admin/`, `assets/tutor/`, plus unused `assets/portal.css`, `assets/site.css`, `assets/common.js`, and `assets/portal-shared.js`.

## Verification Checklist

- `npm run typecheck:react`
- `npm run test:frontend:unit`
- `npm run build`
- Confirm `dist/` contains React route shells and does not contain retired portal route trees.
- Confirm `/dashboard/login/`, `/dashboard/student/`, `/dashboard/admin/`, and `/dashboard/tutor/` load from the built static server.
