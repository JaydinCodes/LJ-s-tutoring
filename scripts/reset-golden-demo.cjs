const { execFileSync } = require('node:child_process');

const result = JSON.parse(execFileSync(process.execPath, [
  require.resolve('supabase/dist/supabase.js'),
  'status',
  '-o',
  'json',
], { encoding: 'utf8' }));

const apiUrl = new URL(result.API_URL);
if (!['127.0.0.1', 'localhost', '::1'].includes(apiUrl.hostname)) {
  throw new Error(`Refusing to reset a non-local Supabase project: ${apiUrl.origin}`);
}

execFileSync(process.execPath, ['scripts/seed-local-auth.cjs'], {
  cwd: process.cwd(),
  stdio: 'inherit',
});
