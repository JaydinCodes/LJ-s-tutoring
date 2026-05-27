import { Pool } from 'pg';

const isTest = process.env.NODE_ENV === 'test';
const DATABASE_URL = isTest ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;

if (isTest && !process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is required when NODE_ENV=test');
}

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const parsedDatabaseUrl = new URL(DATABASE_URL);
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
