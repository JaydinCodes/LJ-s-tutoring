# Archived Fastify / Docker Runbook

> **Historical only — do not use for setup, development, deployment, or
> incident response.** The tracked `lms-api` Fastify/Prisma source, its Compose
> files, and its DigitalOcean service were retired on 2026-07-24. The active
> runbook is [../architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md).

This note preserves the shape of the former operating instructions so links and
old audit evidence still have context. Git history remains the authoritative
record of the retired files.

## Former local stack

The old runbook started a standalone PostgreSQL database and Fastify API with:

```bash
docker compose up -d db
docker compose up api db
```

It used `DATABASE_URL`, cookie/JWT secrets, and an API origin on port 3001.
Those commands and credentials are not part of the current React + Supabase
stack.

## Former production stack

The retired API was built with `docker-compose.prod.yml`; an optional Nginx
gateway overlay used `docker-compose.gateway.yml`. Neither compose file is an
active or tracked deployment input. The current DigitalOcean application is a
static website, while trusted backend work runs in Supabase Edge Functions.

## Replacement

- Local database/Auth/Storage/RPC: project-pinned Supabase CLI and committed
  migrations under `supabase/migrations/`.
- Browser app: Vite + React under `src/`.
- Trusted execution: `supabase/functions/`.
- Current commands, environment boundaries, and release gates:
  [Architecture](../architecture/ARCHITECTURE.md) and
  [Local Supabase Development](../supabase/LOCAL_DEVELOPMENT.md).
