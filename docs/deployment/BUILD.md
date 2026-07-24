# Build

## Static site build

`npm run build:static` generates static React route shells into `dist/` and copies only the public assets required by the unified React app. Public marketing routes include crawlable prerendered HTML inside `#root`; the React bundle replaces that fallback markup when it starts. Protected dashboard routes remain empty `noindex` shells.

Generated/copied output includes:

- React shells for `/`, `/about`, `/programs`, `/guides`, `/privacy`, `/terms`, `/dashboard/*`, and `/onboarding/*`
- `react-app-dist/`
- `assets/analytics.js`
- `assets/analytics-module.js`
- `assets/portal-config.js`
- `assets/sw-register.js`
- `assets/tailwind-input.css`
- `sw.js`
- `images/`
- `favicon.svg`
- `robots.txt`
- `sitemap.xml`

## DigitalOcean App Platform

`lms-api` (Fastify + Prisma) was fully retired 2026-07-24 (see
[ADR-0003](../architecture/ADR-0003-single-stack-supabase.md)); `.do/app.yaml`
now has a single `static_sites` component and no API service:

- source_dir: repository root
- build_command: `npm ci && npm run build`
- output_dir: `dist`

Backend-only work (Odie AI proxy, admin user invites) runs on Supabase Edge
Functions (`supabase/functions/`), deployed and configured directly against
the Supabase project, not through this app spec.

Routing note:

- The DigitalOcean app spec in `.do/app.yaml` is the production routing source of truth.
- Role subdomains redirect to the unified React dashboards: admin to `/dashboard/admin/`, tutor to `/dashboard/tutor/`, and student to `/dashboard/student/`.

## Public config injection

`npm run inject:config` rewrites `dist/assets/portal-config.js` so the static site knows which API base URL to call.

It reads local env files with `.env.local` precedence over `.env`.

Supported env vars, in priority order:

1. `PUBLIC_PO_API_BASE`
2. `API_BASE_URL`
3. fallback empty string (`""`) to allow same-origin calls in production; local host fallback is handled by runtime client logic.
