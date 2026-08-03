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
- `assets/lib/sanitize.js`
- `sw.js`
- `images/`
- `favicon.svg`
- `robots.txt`
- `sitemap.xml`

The source-side ownership and the one explicitly excluded, non-production
historical file are documented in
[STATIC_ASSET_OWNERSHIP.md](../architecture/STATIC_ASSET_OWNERSHIP.md).

## DigitalOcean App Platform

`lms-api` (Fastify + Prisma) was fully retired 2026-07-24 (see
[ADR-0003](../architecture/ADR-0003-single-stack-supabase.md)); `.do/app.yaml`
now has a single `static_sites` component and no API service:

- source_dir: repository root
- build_command: `npm ci --include=dev && npm run build`

The explicit `--include=dev` is required because DigitalOcean sets
`NODE_ENV=production` during the build while Vite, Tailwind, PostCSS, and their
plugins are intentionally build-only `devDependencies`.
- output_dir: `dist`

Backend-only work (Odie AI proxy, admin user invites) runs on Supabase Edge
Functions (`supabase/functions/`), deployed and configured directly against
the Supabase project, not through this app spec.

Routing note:

- The DigitalOcean app spec in `.do/app.yaml` is the production routing source of truth.
- Role subdomains redirect to the unified React dashboards: admin to `/dashboard/admin/`, tutor to `/dashboard/tutor/`, and student to `/dashboard/student/`.

## Public config injection

The active React client reads `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` at build time and talks directly to Supabase. These are
public browser values; authorization remains enforced by RLS.

`npm run inject:config` still rewrites the retained
`dist/assets/portal-config.js` compatibility object after the static build. Its
`PUBLIC_PO_API_BASE` / `API_BASE_URL` value is inert metadata for the active
React repositories, not a second API or authorization boundary. Do not put
access keys or server credentials into it.

See [PUBLIC_CONFIG.md](../setup/PUBLIC_CONFIG.md) for the complete active and
server-only variable split.
