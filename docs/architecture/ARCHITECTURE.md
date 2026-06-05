# Architecture

## Source Of Truth

Project Odysseus is Supabase-first.

The accepted architecture decision is documented in `docs/architecture/ADR-0001-supabase-first.md`. That ADR is the source of truth when older code or documentation conflicts with newer implementation work.

## Current Shape

The production application is a unified React, TypeScript, and Vite frontend served from `dist/`.

The platform uses:

- Supabase Auth for browser identity and session state.
- Supabase `profiles` for application role mapping.
- Supabase RLS for row-level authorization.
- Supabase Storage for private learner, tutor, and assignment files.
- Secure Supabase RPC functions for privileged mutations.
- Fastify API services only where trusted server execution is required.

The Fastify API remains useful for jobs, AI services, email, reports, integrations, exports, and operational tasks. It must not become a second browser authentication authority.

## Why This Architecture

- Supabase gives one consistent trust boundary for students, tutors, admins, parents, and NGO partners.
- RLS keeps authorization close to the data it protects.
- RPC functions let the platform expose safe domain actions without exposing privileged columns to browser clients.
- Private Storage policies keep learner submissions and tutor files scoped to the correct people.
- The API can focus on work that actually needs a backend service instead of duplicating auth and role logic.

## Frontend Folders

- `src/` contains the active unified React LMS and public site.
- `src/features/` contains role and domain features.
- `src/lib/supabase/` contains Supabase client setup.
- `src/lib/api/` contains transitional API helpers for backend-only services.
- `assets/` contains public support assets copied into the React static build.
- `legacy/static/` contains retired static portal source kept for reference only.
- `student-app/` is legacy student-app source and should not be treated as the active student portal.

## Backend Folders

- `lms-api/src/routes/` exposes Fastify HTTP routes for backend-only operations.
- `lms-api/src/lib/` contains shared backend helpers.
- `lms-api/src/domains/` contains backend domain modules.
- `lms-api/prisma/migrations/` contains the current API migration path for backend-managed tables.

Backend code that serves the browser must integrate with the Supabase-first identity model. New browser-facing API work should not introduce a separate user session model.

## Data And Authorization Rules

- Browser session state comes from Supabase Auth.
- Browser role checks come from Supabase-backed profiles.
- Direct table writes are allowed only for low-risk self-service operations protected completely by RLS.
- Marking, result release, role management, payment operations, privacy operations, and account provisioning must use secure RPC functions or service-role backend code.
- Private files must live in Supabase Storage buckets with scoped paths and policies.
- Parent and NGO access must be built as scoped RLS/RPC views, not broad table reads.

## Build Flow

1. `npm run build:react` builds the unified React application.
2. `scripts/build-static.js` generates React route shells in `dist/`.
3. `scripts/inject-config.js` injects public runtime config into `dist/assets/portal-config.js`.
4. `lms-api` builds separately with TypeScript for backend-only services.
