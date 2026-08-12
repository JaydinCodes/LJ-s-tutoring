# Scale Readiness Budgets

These are deliberately small-programme budgets. They make growth visible
without pretending that the platform has measured production capacity yet.

## Dashboard request budgets

| Workflow | Steady-state target | Current status |
|---|---:|---|
| Learner dashboard | <= 10 Supabase calls, with independent reads concurrent | Bounded detail reads; metrics are database-owned |
| Tutor dashboard | <= 8 calls and no unbounded historical list | **Not met**: assignments, submissions, and sessions are broad reads |
| Admin dashboard | <= 12 calls and recent items only | Recent item limits exist; projections still use `select('*')` |
| Admin markbook | <= 4 calls per page, <= 50 rows per page | **Not met**: current implementation loads complete tables |
| Parent reports | <= 3 calls, child-scoped | RPC-based; historical result list still needs a later page contract |
| NGO reports | <= 3 calls per visible organisation set | **Not met**: one aggregate RPC per organisation |

These are query-count and response-shape budgets, not hard latency SLOs. A
route may exceed a count during an explicit detail action, but the first page
must not fetch an entire historical table.

## Queue budgets

The AI worker is intentionally optional: submission confirmation and human
marking must remain available while AI is delayed.

The current scheduled worker requests one job per minute. Until a measured
concurrency change is approved, use these operator thresholds:

| Signal | Warning | Page / investigate |
|---|---:|---:|
| Ready AI jobs | >= 15 | >= 60 |
| Estimated drain time at configured throughput | >= 15 minutes | >= 60 minutes |
| Oldest ready job age | >= 15 minutes | >= 60 minutes |
| Dead-lettered jobs | >= 1 | Any increase after requeue/runbook review |

The estimate is intentionally conservative: `ready jobs / jobs per minute`.
It does not claim provider capacity. Run the queue probe during a controlled
pilot and replace these thresholds with measured values once real traffic
exists.

## Evidence to retain

- queue probe output with deployment SHA and timestamp;
- dashboard request count and response-size samples from a staging session;
- query plans for approval, tutor-session, and submission-history queries;
- queue age, completion rate, retry rate, and AI provider cost per job.

## Deferred work

Markbook pagination, report summary/detail separation, tutor history paging,
and multi-organisation payroll scoping remain planned growth work. They are
not required for the current 10–20 learner pilot, but the budgets above make
the thresholds explicit.
