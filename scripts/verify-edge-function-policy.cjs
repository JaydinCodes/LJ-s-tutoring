const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'supabase', 'config.toml');
const protectedFunctions = [
  'admin-invite-user',
  'complete-temporary-password',
  'cleanup-submission-assets',
  'grade-submission',
  'odie-careers-chat-stream',
  'refresh-stale-weekly-reports',
];

function functionConfigSection(config, name) {
  const start = config.indexOf(`[functions.${name}]`);
  if (start === -1) return null;
  const next = config.indexOf('\n[', start + 1);
  return config.slice(start, next === -1 ? undefined : next);
}

function requireVerifiedGatewayConfig(config) {
  for (const name of protectedFunctions) {
    const section = functionConfigSection(config, name);
    if (!section || !/^verify_jwt\s*=\s*true\s*$/m.test(section)) {
      throw new Error(`${name} must explicitly set verify_jwt = true in supabase/config.toml`);
    }
  }
}

function verifyDeployedPolicy() {
  const projectRef = process.env.SUPABASE_PRODUCTION_PROJECT_REF;
  if (!projectRef) throw new Error('SUPABASE_PRODUCTION_PROJECT_REF is required for deployed policy verification');
  if (!process.env.SUPABASE_ACCESS_TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN is required for deployed policy verification');

  const cli = require.resolve('supabase/dist/supabase.js');
  const stdout = execFileSync(process.execPath, [cli, 'functions', 'list', '--project-ref', projectRef, '--output', 'json'], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
  const rows = JSON.parse(stdout);
  if (!Array.isArray(rows)) throw new Error('Supabase functions list did not return an array');
  for (const name of protectedFunctions) {
    const row = rows.find((candidate) => candidate.slug === name || candidate.name === name);
    if (!row) throw new Error(`Deployed Edge Function is missing: ${name}`);
    const verified = row.verify_jwt ?? row.verifyJwt;
    if (verified !== true) throw new Error(`Deployed ${name} does not enforce verify_jwt`);
  }
}

requireVerifiedGatewayConfig(fs.readFileSync(configPath, 'utf8'));
if (process.argv.includes('--production')) verifyDeployedPolicy();
console.log(`Verified gateway JWT policy for ${protectedFunctions.join(', ')}.`);
