// ─────────────────────────────────────────────────────────────────────────────
// PostgreSQL connection pool (node-postgres)
//
// The Supabase JS client talks to PostgREST over HTTP — each call opens a
// fresh HTTP connection and PostgREST in turn opens a PG connection. Under
// load this exhausts Supabase's connection limit quickly.
//
// This pool holds up to MAX_CONNECTIONS persistent PG connections that are
// reused across requests. Use `query()` for all data reads/writes; keep the
// Supabase client only for Auth API calls (JWT verification, user creation).
//
// Connection string comes from DATABASE_URL (direct) or
// SUPABASE_DB_URL (Supabase Supavisor pooler — preferred for Render).
//
// Supabase dashboard → Project Settings → Database → Connection string
//   Direct:   postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
//   Pooler:   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
// ─────────────────────────────────────────────────────────────────────────────

import pg from 'pg'
import { logger } from '../lib/logger.js'

const { Pool } = pg

const MAX  = Number(process.env.PG_POOL_MAX  || 15)
const IDLE = Number(process.env.PG_IDLE_MS   || 10_000)
const CONN = Number(process.env.PG_CONN_MS   || 5_000)

const connectionString =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL

if (!connectionString) {
  logger.warn(
    '[pool] DATABASE_URL / SUPABASE_DB_URL not set — ' +
    'falling back to Supabase JS client for all queries. ' +
    'Set one of these env vars to enable the connection pool.'
  )
}

export const pool = connectionString
  ? new Pool({
      connectionString,
      max:              MAX,
      idleTimeoutMillis: IDLE,
      connectionTimeoutMillis: CONN,
      ssl: { rejectUnauthorized: false }, // Supabase requires SSL
    })
  : null

if (pool) {
  pool.on('connect', () => logger.debug('[pool] new PG connection opened'))
  pool.on('error',  (err) => logger.error({ err }, '[pool] idle client error'))

  logger.info({ max: MAX, idle_ms: IDLE }, '[pool] PostgreSQL pool initialised')
}

/**
 * Execute a parameterised query against the pool.
 *
 * Falls back to throwing a clear error if the pool is not configured,
 * so callers know to add the DATABASE_URL env var rather than silently
 * using the Supabase client.
 *
 * Usage:
 *   const { rows } = await query(
 *     'SELECT * FROM contracts WHERE sponsor_id = $1 AND deleted_at IS NULL',
 *     [sponsorId]
 *   )
 */
export async function query(sql, params = []) {
  if (!pool) {
    throw new Error(
      'PG pool not configured. Set DATABASE_URL or SUPABASE_DB_URL in .env.'
    )
  }
  return pool.query(sql, params)
}

/**
 * Acquire a client for a transaction.
 * Caller must call client.release() in a finally block.
 *
 * Usage:
 *   const client = await getClient()
 *   try {
 *     await client.query('BEGIN')
 *     await client.query('...', [...])
 *     await client.query('COMMIT')
 *   } catch (e) {
 *     await client.query('ROLLBACK')
 *     throw e
 *   } finally {
 *     client.release()
 *   }
 */
export async function getClient() {
  if (!pool) {
    throw new Error(
      'PG pool not configured. Set DATABASE_URL or SUPABASE_DB_URL in .env.'
    )
  }
  return pool.connect()
}

/**
 * Convenience wrapper: run `fn(client)` inside a transaction,
 * auto-commit on success, auto-rollback + rethrow on error.
 */
export async function withTransaction(fn) {
  const client = await getClient()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
