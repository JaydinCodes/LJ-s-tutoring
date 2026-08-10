const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const snapshotPath = path.join(root, 'supabase', 'types', 'public.generated.ts');
const supabaseCli = require.resolve('supabase/dist/supabase.js');

function localDatabaseUrl() {
  const status = execFileSync(
    process.execPath,
    [supabaseCli, 'status', '--output', 'env'],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const entry = status.match(/^DB_URL=(?:"([^"]+)"|'([^']+)'|(.+))$/m);
  const value = entry?.[1] || entry?.[2] || entry?.[3];
  if (!value) {
    throw new Error('Local Supabase status did not provide DB_URL. Start the local stack before checking types.');
  }
  return value;
}

function normalize(value) {
  return value.replace(/\r\n/g, '\n').trimEnd() + '\n';
}

const generated = normalize(execFileSync(
  process.execPath,
  // CI resets the local database from every committed migration immediately
  // before this check. Pass its explicit DB URL: current CLI releases can
  // incorrectly use the internal container port for `--local`, while `status`
  // returns the host-mapped, authenticated database URL.
  [supabaseCli, 'gen', 'types', '--db-url', localDatabaseUrl(), '--schema', 'public'],
  { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
));

if (!generated.includes('export type Database') || !generated.includes('Tables: {')) {
  throw new Error('Supabase CLI did not return the expected generated TypeScript database shape.');
}

if (process.argv.includes('--update')) {
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, generated, 'utf8');
  process.stdout.write(`Updated reviewed Supabase type snapshot: ${path.relative(root, snapshotPath)}\n`);
  process.exit(0);
}

if (!fs.existsSync(snapshotPath)) {
  process.stderr.write('Reviewed generated Supabase type snapshot is missing. Run: npm run supabase:types:update\n');
  process.exit(1);
}

const tracked = normalize(fs.readFileSync(snapshotPath, 'utf8'));
if (tracked !== generated) {
  const trackedLines = tracked.split('\n');
  const generatedLines = generated.split('\n');
  const firstDifference = generatedLines.findIndex((line, index) => line !== trackedLines[index]);
  process.stderr.write(
    `Generated Supabase types drifted at line ${firstDifference + 1}.\n` +
    `Tracked:   ${trackedLines[firstDifference] ?? '<missing>'}\n` +
    `Generated: ${generatedLines[firstDifference] ?? '<missing>'}\n` +
    'Review the schema/type diff, then run: npm run supabase:types:update\n',
  );
  process.exit(1);
}

process.stdout.write('Generated Supabase types match supabase/types/public.generated.ts\n');
