// ─────────────────────────────────────────────────────────────────────────────
// Eleventh Round — API server bootstrap
// ─────────────────────────────────────────────────────────────────────────────

import dotenv from 'dotenv'

// Load .env from project root (one level up from /server)
dotenv.config({ path: new URL('../.env', import.meta.url).pathname })

import app from './app.js'
import { logger } from './lib/logger.js'
import { pool }   from './db/pool.js'
import { startOutboxDispatcher } from './jobs/outbox-dispatcher.js'

const PORT = process.env.PORT || 3001

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV }, 'Eleventh Round API listening')
  startOutboxDispatcher()
})

// ── Graceful shutdown — drain pool before process exits ──────────────────────
async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down…')
  if (pool) await pool.end().catch(() => {})
  process.exit(0)
}
process.once('SIGTERM', () => shutdown('SIGTERM'))
process.once('SIGINT',  () => shutdown('SIGINT'))
