# Public Client Config (Safe To Expose)

The active React build reads public variables through Vite. Every `VITE_*` value
is visible to anyone who loads the site, so only publish non-secret client
configuration.

## Active React variables

- `VITE_SUPABASE_URL` — public Supabase project URL.
- `VITE_SUPABASE_ANON_KEY` — public anon/publishable key; RLS remains the
  authorization boundary.
- `VITE_SENTRY_ENABLED`, `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`,
  `VITE_SENTRY_RELEASE`, `VITE_SENTRY_SAMPLE_RATE` — optional browser monitoring
  configuration. The DSN is public; a Sentry auth token is not.

The two local test controls below must not be enabled in deployed builds:

- `VITE_PO_DEV_ADMIN_MFA_BYPASS`
- `VITE_E2E_AUTH_MOCK` / `VITE_E2E_AUTH_PASSWORD`

## Retained compatibility output

`scripts/inject-config.js` still writes `PUBLIC_PO_API_BASE` and
`ASSISTANT_ENABLED` into the retained `assets/portal-config.js` shape. The active
React repositories use Supabase directly; `PUBLIC_PO_API_BASE=/api` is inert
compatibility metadata, not a second API or session authority. Do not add access
keys to that browser object.

## Server-only secrets

Never expose these through `VITE_*`, `PUBLIC_*`, HTML, or generated JavaScript:

- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- provider/client secrets, database passwords, private tokens, or credentials

Supabase Edge Functions receive server secrets through the Supabase secret store.
Repository `.env.example` values are placeholders for local work only.

## DigitalOcean App Platform

The static-site component needs the two public Supabase browser values at build
time. Keep private Edge Function secrets in Supabase, not the DigitalOcean static
site. Public enquiries use reviewed email/WhatsApp links and require no form
processor key.
