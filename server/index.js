// ─────────────────────────────────────────────────────────────────────────────
// Eleventh Round — API server bootstrap
// ─────────────────────────────────────────────────────────────────────────────

import express     from 'express'
import cors        from 'cors'
import dotenv      from 'dotenv'
import rateLimit   from 'express-rate-limit'
import pinoHttp    from 'pino-http'

// Load .env from project root (one level up from /server)
dotenv.config({ path: new URL('../.env', import.meta.url).pathname })

import { logger } from './lib/logger.js'
import authRoutes    from './routes/auth.js'
import fighterRoutes from './routes/fighter.js'
import managerRoutes from './routes/manager.js'
import adminRoutes   from './routes/admin.js'
import stripeRoutes  from './routes/stripe.js'

const app  = express()
const PORT = process.env.PORT || 3001

// ── Structured request logging ──────────────────────────────────────────────
app.use(pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error'
    if (res.statusCode >= 400)        return 'warn'
    return 'info'
  },
}))

// ── CORS ────────────────────────────────────────────────────────────────────
// Allow-list:
//   • the configured CLIENT_URL (dev: http://localhost:5173)
//   • any *.eleventh-rnd.com production subdomain
//   • any *.vercel.app preview/production deployment for this project
//   • additional comma-separated origins in CORS_EXTRA_ORIGINS
const extraOrigins = (process.env.CORS_EXTRA_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)                                  // server-to-server, curl, etc.
    if (origin === (process.env.CLIENT_URL || 'http://localhost:5173')) return cb(null, true)
    if (/^https:\/\/[a-z0-9-]+\.eleventh-rnd\.com$/.test(origin))       return cb(null, true)
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin))             return cb(null, true)
    if (extraOrigins.includes(origin))                                  return cb(null, true)
    logger.warn({ origin }, 'CORS blocked')
    cb(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true,
}))

// ── Stripe webhook MUST come before express.json() — it needs raw body ──────
// (Wired up in Phase 3. Placeholder route reserves the path so order is correct.)
// app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookRoutes)

// ── JSON parsing for everything else ────────────────────────────────────────
app.use(express.json({ limit: '256kb' }))

// ── Rate limiting (public endpoints) ────────────────────────────────────────
const publicLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_PUBLIC_PER_MIN || 20),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests. Slow down and try again in a minute.' },
})
app.use('/api/auth', publicLimiter)
// Apply to other public routes as they get added (leads, etc.)

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes)
app.use('/api/fighter', fighterRoutes)
app.use('/api/manager', managerRoutes)
app.use('/api/admin',   adminRoutes)
app.use('/api/stripe',  stripeRoutes)

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({
  ok: true,
  ts: Date.now(),
  env: process.env.NODE_ENV || 'development',
  supabase: !!process.env.SUPABASE_URL,
  sendgrid: !!process.env.SENDGRID_API_KEY,
}))

// ── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.path }))

// ── Centralized error handler ───────────────────────────────────────────────
app.use((err, req, res, _next) => {
  req.log?.error({ err }, 'Unhandled error')
  if (res.headersSent) return
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error.'
      : err.message,
  })
})

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV }, 'Eleventh Round API listening')
  console.log(`\n  ╔══════════════════════════════════════╗`)
  console.log(`  ║  Eleventh Round API  → :${PORT}        ║`)
  console.log(`  ╚══════════════════════════════════════╝\n`)
})
