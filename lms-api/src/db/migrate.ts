import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath, override: false });
  }
}

function loadRuntimeEnv() {
  const packageRoot = path.resolve(__dirname, '..', '..');
  const repoRoot = path.resolve(packageRoot, '..');

  loadEnvFile(path.resolve(repoRoot, '.env.local'));
  loadEnvFile(path.resolve(repoRoot, '.env'));
  loadEnvFile(path.resolve(packageRoot, '.env.local'));
  loadEnvFile(path.resolve(packageRoot, '.env'));
}

loadRuntimeEnv();

const isTest = process.env.NODE_ENV === 'test';
const rawDatabaseUrl = (isTest ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL)?.trim();
if (!rawDatabaseUrl) {
  console.error(isTest ? 'Missing DATABASE_URL_TEST' : 'Missing DATABASE_URL');
  process.exit(1);
}
const DATABASE_URL = normalizeDatabaseUrl(rawDatabaseUrl);

function normalizeDatabaseUrl(databaseUrl: string) {
  const trimmed = databaseUrl.trim();
  const quoteWrapped =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"));

  return quoteWrapped ? trimmed.slice(1, -1).trim() : trimmed;
}

function parseDatabaseUrl(databaseUrl: string) {
  try {
    const parsed = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
      throw new Error('invalid protocol');
    }
    if (databaseUrl.includes('[YOUR-PASSWORD]')) {
      throw new Error('placeholder password');
    }
    return parsed;
  } catch {
    console.error(
      'DATABASE_URL is not a valid PostgreSQL connection URL. Use Supabase Project Settings > Database, replace [YOUR-PASSWORD], and do not include wrapping quotes.'
    );
    process.exit(1);
  }
}

function describeDatabaseUrl(databaseUrl: string) {
  const parsed = parseDatabaseUrl(databaseUrl);
  const port = parsed.port ? `:${parsed.port}` : '';
  return `${parsed.protocol}//${parsed.hostname}${port}${parsed.pathname}`;
}

function connectionStringForPg(databaseUrl: string) {
  const parsed = parseDatabaseUrl(databaseUrl);
  parsed.searchParams.delete('sslmode');
  parsed.searchParams.delete('uselibpqcompat');
  return parsed.toString();
}

const parsedDatabaseUrl = parseDatabaseUrl(DATABASE_URL);
if (!parsedDatabaseUrl.hostname || parsedDatabaseUrl.hostname === 'base') {
  console.error(
    'DATABASE_URL host is invalid. In DigitalOcean, set DATABASE_URL to the full Supabase Postgres connection string, not a placeholder such as "base".'
  );
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && /^db\.[^.]+\.supabase\.co$/.test(parsedDatabaseUrl.hostname)) {
  console.error(
    'DATABASE_URL uses Supabase direct Postgres host, which can be IPv6-only and unreachable from DigitalOcean. Use the Supabase Session Pooler connection string instead.'
  );
  process.exit(1);
}

const requiresSsl =
  DATABASE_URL.includes('sslmode=require') ||
  parsedDatabaseUrl.hostname.endsWith('.supabase.co') ||
  parsedDatabaseUrl.hostname.endsWith('.supabase.com');
const ssl = requiresSsl
  ? { rejectUnauthorized: false }
  : undefined;

const pool = new Pool({
  connectionString: connectionStringForPg(DATABASE_URL),
  ssl,
  connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS ?? 10000),
});

function getMigrationsDir() {
  return path.resolve(__dirname, '../../prisma/migrations');
}

async function ensureMigrationsTable(client: any) {
  await client.query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function applied(client: any, id: string): Promise<boolean> {
  const res = await client.query('select 1 from schema_migrations where id = $1', [id]);
  return (res.rowCount ?? 0) > 0;
}

async function markApplied(client: any, id: string) {
  await client.query('insert into schema_migrations (id) values ($1) on conflict do nothing', [id]);
}

function migrationPriority(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('baseline')) return 0;
  if (lower.includes('init')) return 1;
  return 2;
}

async function run() {
  const dir = getMigrationsDir();
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => {
      const priorityDelta = migrationPriority(a) - migrationPriority(b);
      if (priorityDelta !== 0) return priorityDelta;
      return a.localeCompare(b);
    });

  let client: PoolClient | undefined;
  let lockAcquired = false;
  try {
    console.log(`Running migrations against ${describeDatabaseUrl(DATABASE_URL)}...`);
    client = await pool.connect();
    await client.query('BEGIN');
    const lockRes = await client.query(
      `select pg_try_advisory_lock($1::int, $2::int) as ok`,
      [1701, 2603]
    );
    lockAcquired = Boolean(lockRes.rows[0]?.ok);
    if (!lockAcquired) {
      throw new Error('Another migration process holds the advisory lock');
    }

    await ensureMigrationsTable(client);

    for (const folder of files) {
      if (await applied(client, folder)) continue;

      const full = path.join(dir, folder, 'migration.sql');
      if (!fs.existsSync(full)) continue;
      const sql = fs.readFileSync(full, 'utf8');

      console.log(`Applying ${folder}...`);
      await client.query(sql);
      await markApplied(client, folder);
    }

    await client.query('COMMIT');
    if (lockAcquired) {
      await client.query(`select pg_advisory_unlock($1::int, $2::int)`, [1701, 2603]);
      lockAcquired = false;
    }
    console.log('Migrations complete.');
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    if (client && lockAcquired) {
      await client.query(`select pg_advisory_unlock($1::int, $2::int)`, [1701, 2603]);
      lockAcquired = false;
    }
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end();
  }
}

run();
