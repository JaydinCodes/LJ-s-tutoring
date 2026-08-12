#!/usr/bin/env node

// Read-only operator probe. It calls the existing service-role metrics RPC;
// it does not insert, update, claim, or retry jobs.

const jobsPerMinute = Math.max(0.1, Number(process.env.AI_WORKER_JOBS_PER_MINUTE || '1'));
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.log('[ai-capacity] skipped: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(0);
}

async function main() {
const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/get_ai_grading_queue_metrics`, {
  method: 'POST',
  headers: {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  },
  body: '{}',
});

if (!response.ok) {
  throw new Error(`[ai-capacity] metrics RPC failed: HTTP ${response.status}`);
}

const rows = await response.json();
const metrics = Array.isArray(rows) ? rows : [];
const readyJobs = metrics.reduce((total, row) => total + Number(row.ready_count || 0), 0);
const deadLettered = metrics.find((row) => row.status === 'dead_lettered');
const oldest = metrics
  .map((row) => row.oldest_available_at)
  .filter(Boolean)
  .map((value) => Date.parse(value))
  .filter(Number.isFinite)
  .sort((a, b) => a - b)[0];
const oldestAgeMinutes = oldest ? Math.max(0, (Date.now() - oldest) / 60000) : 0;
const drainMinutes = readyJobs / jobsPerMinute;
const state = readyJobs >= 60 || oldestAgeMinutes >= 60 || Number(deadLettered?.job_count || 0) > 0
  ? 'investigate'
  : readyJobs >= 15 || oldestAgeMinutes >= 15
    ? 'warning'
    : 'ok';

console.log(JSON.stringify({
  state,
  jobsPerMinute,
  readyJobs,
  estimatedDrainMinutes: Number(drainMinutes.toFixed(1)),
  oldestReadyJobAgeMinutes: Number(oldestAgeMinutes.toFixed(1)),
  deadLetteredJobs: Number(deadLettered?.job_count || 0),
  byStatus: metrics,
}, null, 2));

if (state === 'investigate') process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
