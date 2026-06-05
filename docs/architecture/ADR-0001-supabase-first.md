# ADR-0001: Supabase-First Platform Architecture

## Status

Accepted.

## Decision

Project Odysseus uses Supabase as the platform source of truth for authentication, authorization, storage, and primary data access.

The canonical production model is:

- Supabase Auth owns user identity and sessions.
- Supabase `profiles` owns application role mapping.
- Supabase RLS owns row-level authorization.
- Supabase Storage owns private learner and assignment files.
- Secure Postgres RPC functions own privileged mutations that cannot safely be exposed as direct table updates.

The Fastify API may still exist for server-side jobs, integrations, AI services, email, reporting exports, scheduled work, and other operations that require trusted backend execution. It must not become a second identity or authorization source for the browser application.

## Rationale

The platform handles minors, academic results, tutor operations, parent/guardian context, NGO reporting, and payment-adjacent records. Those workflows need one clear trust boundary.

Supabase-first gives the project one consistent model for:

- login and session state,
- role checks,
- learner/tutor/admin data access,
- private file access,
- database-side authorization,
- auditability of privileged writes.

This also reduces product risk. Students, tutors, admins, parents, and NGO partners should not experience different behavior depending on whether a screen uses Supabase or a separate cookie-based API session.

## Implementation Rules

- Browser routes must use Supabase Auth for signed-in state.
- Browser role checks must read from the authenticated user's Supabase-backed profile.
- Direct browser table writes are allowed only when RLS fully protects the operation and no privileged fields can be changed.
- Sensitive writes must go through secure RPC functions, especially marking, result release, payments, role management, account provisioning, submission review, and privacy operations.
- File uploads must use private Supabase Storage buckets with scoped paths and RLS-backed access rules.
- Admin-only actions must be protected by RLS, RPC checks, and service-role-only backend paths where needed.
- Backend services must accept Supabase identity claims or service-role authority rather than issuing an unrelated browser session.
- Database migrations and schema documentation must describe the Supabase production schema as the canonical schema.

## Code Quality Rules For New Files

New code should follow clean-code and SOLID principles:

- keep each module focused on one responsibility,
- isolate data access from UI rendering,
- use explicit types for domain records and mutation inputs,
- prefer small named functions over large procedural blocks,
- validate inputs at the boundary,
- return clear errors instead of hiding authorization or data failures,
- add comments only where they explain policy, invariants, or non-obvious business rules.

Comments are required for new code files where the domain rule is not obvious from the function or type name. Comments should explain why the rule exists, not repeat what the code says.

## Consequences

- Existing API-cookie authentication becomes transitional for browser workflows.
- Existing direct Supabase mutations must be audited and moved to RPC where they touch privileged fields.
- Existing docs that describe the Fastify API as the browser auth source must be updated.
- Tests must include Supabase Auth, RLS, RPC, and Storage policy coverage.
- Future parent and NGO portals must be designed from this same Supabase-first authorization model.
