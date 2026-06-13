// ─────────────────────────────────────────────────────────────────────────────
// Eleventh Round — Express app factory (no listen, no side-effects)
// Import this in tests; index.js adds listen + dispatcher on top of it.
// ─────────────────────────────────────────────────────────────────────────────

import express     from 'express'
import cors        from 'cors'
import rateLimit   from 'express-rate-limit'
import pinoHttp    from 'pino-http'

import { logger }    from './lib/logger.js'
import { pool }      from './db/pool.js'
import authRoutes    from './routes/auth.js'
import fighterRoutes from './routes/fighter.js'
import managerRoutes from './routes/manager.js'
import adminRoutes   from './routes/admin.js'
import sponsorRoutes        from './routes/sponsor.js'
import opportunityRoutes    from './routes/opportunities.js'
import applicationRoutes    from './routes/applications.js'
import conversationRoutes   from './routes/conversations.js'
import notificationRoutes   from './routes/notifications.js'
import contractRoutes          from './routes/contracts.js'
import obligationRoutes        from './routes/obligations.js'
import eventRoutes             from './routes/events.js'
import calendlyRoutes          from './routes/calendly.js'
import calendlyWebhookRoutes   from './routes/calendly-webhook.js'
import paymentRoutes           from './routes/sponsorship-payments.js'
import stripeWebhookRoutes     from './routes/stripe-webhook.js'
import stripeRoutes            from './routes/stripe.js'
import onboardingRoutes        from './routes/onboarding.js'
import uploadRoutes            from './routes/uploads.js'
import publicRoutes            from './routes/public.js'
import billingRoutes           from './routes/billing.js'
import contentRoutes           from './routes/content.js'

const app = express()

// Extra CORS origins (comma-separated) for custom domains, set in env.
const extraOrigins = (process.env.CORS_EXTRA_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean)

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
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (origin === (process.env.CLIENT_URL || 'http://localhost:5173')) return cb(null, true)
    if (/^https:\/\/[a-z0-9-]+\.eleventh-rnd\.com$/.test(origin))       return cb(null, true)
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin))             return cb(null, true)
    if (extraOrigins.includes(origin))                                  return cb(null, true)
    logger.warn({ origin }, 'CORS blocked')
    cb(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true,
}))

// ── Webhooks MUST come before express.json() — they need the raw body ───────
app.use('/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhookRoutes,
)
app.use('/api/calendly/webhook',
  express.raw({ type: 'application/json' }),
  calendlyWebhookRoutes,
)

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

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes)
app.use('/api/fighter', fighterRoutes)
app.use('/api/manager', managerRoutes)
app.use('/api/admin',   adminRoutes)
app.use('/api/sponsor',       sponsorRoutes)
app.use('/api/opportunities', opportunityRoutes)
app.use('/api/applications',  applicationRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/contracts',    contractRoutes)
app.use('/api/obligations',  obligationRoutes)
app.use('/api/events',       eventRoutes)
app.use('/api/calendly',     calendlyRoutes)
app.use('/api/payments',     paymentRoutes)
app.use('/api/stripe',       stripeRoutes)
app.use('/api/onboarding',  onboardingRoutes)
app.use('/api/uploads',    uploadRoutes)
app.use('/api/public',     publicRoutes)
app.use('/api/billing',    billingRoutes)
app.use('/api/admin',      contentRoutes)

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({
  ok:       true,
  ts:       Date.now(),
  env:      process.env.NODE_ENV || 'development',
  supabase: !!process.env.SUPABASE_URL,
  email:    !!process.env.EMAIL_HOST,
  sendgrid: !!process.env.SENDGRID_API_KEY,
  pool:     pool ? { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount } : null,
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

export default app
