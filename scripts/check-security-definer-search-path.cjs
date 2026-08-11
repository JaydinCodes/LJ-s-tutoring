const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
// Existing migration history is immutable. Enforce this on every forward
// migration created after the audit remediation landed.
const guardrailSince = '20260812';
const migrations = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql') && name >= guardrailSince);
const violations = [];

for (const migration of migrations) {
  const source = fs.readFileSync(path.join(migrationsDir, migration), 'utf8');
  for (const statement of source.match(/create(?:\s+or\s+replace)?\s+function[\s\S]*?\$\$\s*;/gi) ?? []) {
    if (!/security\s+definer/i.test(statement)) continue;
    if (!/set\s+search_path\s*=\s*(?:''|pg_catalog)/i.test(statement)) {
      const functionName = statement.match(/function\s+([^\s(]+)/i)?.[1] ?? '<unknown>';
      violations.push(`${migration}: ${functionName} must use an empty or pg_catalog-only search_path`);
    }
  }
}

if (violations.length) throw new Error(violations.join('\n'));
console.log('All new SECURITY DEFINER functions use a restricted search_path.');
