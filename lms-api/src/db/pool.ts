import { Pool } from 'pg';
import type { PoolClient, QueryConfig, QueryResult, QueryResultRow } from 'pg';

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

function connectionStringForPg(databaseUrl: string) {
  const parsed = parseDatabaseUrl(databaseUrl);
  parsed.searchParams.delete('sslmode');
  parsed.searchParams.delete('uselibpqcompat');
  return parsed.toString();
}

const DATABASE_URL = normalizeDatabaseUrl(rawDatabaseUrl);
const parsedDatabaseUrl = parseDatabaseUrl(DATABASE_URL);
if (process.env.NODE_ENV === 'production' && /^db\.[^.]+\.supabase\.co$/.test(parsedDatabaseUrl.hostname)) {
  throw new Error(
    'DATABASE_URL uses Supabase direct Postgres host, which can be IPv6-only and unreachable from DigitalOcean. Use the Supabase Session Pooler connection string instead.'
  );
}
const requiresSsl =
  DATABASE_URL.includes('sslmode=require') ||
  parsedDatabaseUrl.hostname.endsWith('.supabase.co') ||
  parsedDatabaseUrl.hostname.endsWith('.supabase.com');
const ssl = requiresSsl
  ? { rejectUnauthorized: false }
  : undefined;

export const pool = new Pool({
  connectionString: connectionStringForPg(DATABASE_URL),
  ssl,
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30000),
  connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS ?? 5000),
});

const slowQueryMs = Number(process.env.SLOW_QUERY_MS ?? 250);

function queryLabel(query: string | QueryConfig) {
  const sql = typeof query === 'string' ? query : query.text;
  return sql.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function logSlowQuery(query: string | QueryConfig, durationMs: number, rowCount?: number | null) {
  if (durationMs < slowQueryMs) return;
  // Keep the SQL sample short and parameter-free; this log is for query-plan triage, not data capture.
  console.warn(JSON.stringify({
    event: 'db.query.slow',
    durationMs,
    rowCount: rowCount ?? null,
    query: queryLabel(query),
  }));
}

const rawPoolQuery = pool.query.bind(pool);
pool.query = (async (...args: Parameters<typeof pool.query>) => {
  const started = Date.now();
  const result = await (rawPoolQuery as any)(...args);
  logSlowQuery(args[0] as string | QueryConfig, Date.now() - started, result?.rowCount);
  return result;
}) as typeof pool.query;

const patchedClients = new WeakSet<PoolClient>();
const rawConnect = pool.connect.bind(pool);
pool.connect = (async () => {
  const client = await rawConnect();
  if (!patchedClients.has(client)) {
    const rawClientQuery = client.query.bind(client);
    client.query = (async (...args: Parameters<typeof client.query>): Promise<QueryResult<QueryResultRow>> => {
      const started = Date.now();
      const result = await (rawClientQuery as any)(...args);
      logSlowQuery(args[0] as string | QueryConfig, Date.now() - started, result?.rowCount);
      return result;
    }) as typeof client.query;
    patchedClients.add(client);
  }
  return client;
}) as typeof pool.connect;
