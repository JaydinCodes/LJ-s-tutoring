import { Pool } from 'pg';

const isTest = process.env.NODE_ENV === 'test';
const rawDatabaseUrl = isTest ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;

if (isTest && !process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is required when NODE_ENV=test');
}

if (!rawDatabaseUrl) {
  throw new Error('DATABASE_URL is required');
}

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
    throw new Error(
      'DATABASE_URL is not a valid PostgreSQL connection URL. Use Supabase Project Settings > Database, replace [YOUR-PASSWORD], and do not include wrapping quotes.'
    );
  }
}

const DATABASE_URL = normalizeDatabaseUrl(rawDatabaseUrl);
const parsedDatabaseUrl = parseDatabaseUrl(DATABASE_URL);
if (process.env.NODE_ENV === 'production' && /^db\.[^.]+\.supabase\.co$/.test(parsedDatabaseUrl.hostname)) {
  throw new Error(
    'DATABASE_URL uses Supabase direct Postgres host, which can be IPv6-only and unreachable from DigitalOcean. Use the Supabase Session Pooler connection string instead.'
  );
}
const requiresSsl = DATABASE_URL.includes('sslmode=require') || parsedDatabaseUrl.hostname.endsWith('.supabase.co');
const ssl = requiresSsl
  ? { rejectUnauthorized: false }
  : undefined;

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl,
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30000),
  connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS ?? 5000),
});
