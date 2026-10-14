# Changes Implemented

## Code

- `playwright.react.config.ts`: capped browser workers at two to prevent Vite lazy-route compilation starvation observed with 11 workers and residual route-skeleton timeouts at four workers.
- `scripts/run-local-supabase-e2e.cjs`: added an Edge Functions availability preflight with a clear remediation command. The harness now fails before seeding/running browsers instead of hanging during answer evaluation.
- `tests/frontend/golden-demo-contract.test.cjs`: added regression contracts for the runtime preflight and bounded worker configuration.

No production database, RLS, authentication policy, assessment rule or learner record was changed.

## Documentation and evidence

- Added the six required audit documents under `docs/audits/student-portal/`.
- Saved twelve fresh browser screenshots under `evidence/golden-demo/`, captured from the real local-Supabase DOTS journey at desktop, tablet and mobile widths.

## Checks performed

- `npm run typecheck` — passed.
- `npm run lint:react` — passed after the changes.
- `npx eslint scripts/run-local-supabase-e2e.cjs --max-warnings=0` — reported two pre-existing style warnings at lines 223 and 387; neither line was modified by this audit.
- `npm run test:frontend:unit` — 450/450 passed before the added regression case.
- `npm run test:e2e:supabase` — 6 role journeys passed; golden journey initially failed because the local Edge runtime was stopped.
- Targeted real golden journey with Edge Functions running — passed (1/1, 43.3 seconds on evidence capture run).
- Critical mock browser journeys at the final two-worker setting — 14/14 passed, including login for every role, role denial, assignment upload/retry, tutor marking, admin release, reports and logout.
- Full mock browser suite at default 11 workers — 47 passed, 14 timed out, 6 skipped. At four workers it improved to 57 passed, 4 route-skeleton timeouts, 6 skipped. These runs are not reported as passes; the affected critical flow is verified separately at the final two-worker setting.

## Remaining risks

- Re-run the entire 67-test mock suite under the new worker cap in a clean CI-like environment.
- The learning UI still needs its own bounded timeout/retry behavior; the harness preflight only improves test reliability.
- Production, live AI integrations, WebKit/Firefox and assistive technologies remain unverified.
- Broad CAPS content and all learner archetypes do not yet have real-browser fixtures.

