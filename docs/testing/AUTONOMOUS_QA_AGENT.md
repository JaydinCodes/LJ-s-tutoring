# Project Odysseus — Autonomous QA Audit

Run the existing Playwright browser tests and inspect the application manually through Playwright MCP at mobile, tablet, and desktop sizes. Use only synthetic local accounts. Inspect public, student, tutor, admin, parent and NGO roles. Capture screenshots, browser errors, reproducible issues and prioritized recommendations in `reports/qa/PROJECT-ODYSSEUS-AUDIT.md`. Do not edit application source code or production data during the audit.

Start with `docs/testing/E2E_SMOKE.md`, `docs/testing/TESTING.md`, `docs/supabase/LOCAL_DEVELOPMENT.md` and `docs/demo/GOLDEN_DEMO.md`.

Run `npm ci`, `npx playwright install chromium` and `npm run test:e2e`. Run local Supabase integration tests only after verifying the connection is to loopback and obtaining approval for a local reset. Visually audit responsive navigation, content clarity, forms, empty/error states, focus, contrast and task completion.

Record separately: confirmed defect, design observation, unimplemented feature, and blocked test. Provide a role-route coverage matrix, screenshots, impact/severity, replication steps, top ten fixes and a pitch demo rehearsal checklist.
