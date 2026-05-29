// ─────────────────────────────────────────────────────────────────────────────
// Auth routes — Supabase Auth + branded SendGrid emails
//
// Flow:
//   1. POST /register
//        → admin API creates user with email_confirm=false
//        → insert profiles + onboarding rows
//        → generate a verification link via admin.generateLink
//        → send branded verification email via SendGrid (not Supabase's default)
//   2. GET  /verify?token_hash=...&type=signup       (link from email)
//        → frontend exchanges via supabase.auth.verifyOtp on the client
//        → backend just sends welcome email (POST /post-verify)
//   3. POST /login
//        → frontend uses supabase.auth.signInWithPassword directly
//        → this endpoint is here only for backward compatibility/server-side login
//   4. GET  /me                          → returns merged profile (requires auth)
//   5. GET  /check-subdomain/:slug       → availability check (public)
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express'
import { adminSupabase, requireSupabase } from '../db/supabase.js'
import { requireAuth }   from '../middleware/auth.js'
import { validate, RegisterSchema, LoginSchema, SubdomainSchema } from '../lib/validate.js'
import { sendVerificationEmail, sendWelcomeEmail } from '../services/email.js'
import { childLogger } from '../lib/logger.js'

const router = Router()
const log    = childLogger('auth')

// When true, new users are confirmed instantly and can log in without an email.
// Defaults to ON whenever SendGrid isn't configured, so registration works
// out of the box. Set AUTH_AUTOCONFIRM=false to force the real email flow
// even before SendGrid is wired up, or =true to always skip email.
const AUTO_CONFIRM =
  process.env.AUTH_AUTOCONFIRM === 'true' ||
  (process.env.AUTH_AUTOCONFIRM !== 'false' && !process.env.SENDGRID_API_KEY)

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/auth/register
// ═════════════════════════════════════════════════════════════════════════════
router.post('/register', validate(RegisterSchema), async (req, res) => {
  try {
    const sb = requireSupabase()
    const { name, email, password, accountType, teamName, subdomain, onboarding } = req.valid

    // 1. Uniqueness checks
    if (subdomain) {
      const { data: existingSub } = await sb
        .from('profiles')
        .select('id')
        .eq('subdomain', subdomain)
        .maybeSingle()
      if (existingSub) {
        return res.status(409).json({ error: 'That subdomain is already taken. Choose another.' })
      }
    }

    // 2. Create the auth user.
    //    - AUTO_CONFIRM on  → email_confirm:true, user can log in immediately
    //    - AUTO_CONFIRM off → email_confirm:false, we send a verification link
    const { data: created, error: createErr } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: AUTO_CONFIRM,
      user_metadata: { name, account_type: accountType, team_name: teamName, subdomain },
    })

    if (createErr) {
      const msg  = (createErr.message || '').toLowerCase()
      const code = String(createErr.code || '').toLowerCase()
      const isDuplicate =
        msg.includes('already')          ||
        msg.includes('duplicate')        ||
        msg.includes('exists')           ||
        code === 'email_exists'          ||
        code === 'user_already_exists'   ||
        createErr.status === 422
      if (isDuplicate) {
        return res.status(409).json({ error: 'An account with this email already exists.' })
      }
      log.error({ err: createErr, code, status: createErr.status, email }, 'auth.admin.createUser failed')
      return res.status(500).json({ error: 'Registration failed. Please try again.' })
    }

    const userId = created.user.id
    const role   = accountType === 'fighter' ? 'fighter' : 'manager'

    // 3. Insert profile (service role bypasses RLS)
    const { error: profileErr } = await sb.from('profiles').insert({
      id:           userId,
      email,
      name,
      role,
      account_type: accountType,
      team_name:    teamName || null,
      subdomain:    subdomain || null,
      onboarding_complete: !!onboarding,
    })

    if (profileErr) {
      // Roll back the auth user so the next try has a clean slate
      log.error({ err: profileErr, userId }, 'profile insert failed — rolling back auth user')
      await sb.auth.admin.deleteUser(userId).catch(() => {})
      // TEMP DEBUG: surface the real PostgREST/DB error to diagnose in prod.
      return res.status(500).json({
        error: 'Registration failed. Please try again.',
        debug: {
          message: profileErr.message,
          code:    profileErr.code,
          details: profileErr.details,
          hint:    profileErr.hint,
        },
      })
    }

    // 4. Insert onboarding answers
    if (onboarding) {
      const { error: obErr } = await sb.from('onboarding').insert({
        user_id:           userId,
        q1_role:           onboarding.q1 ?? null,
        q2_goal:           onboarding.q2 ?? null,
        q3_common_problem: onboarding.q3 ?? null,
        q4_end_goal:       onboarding.q4 ?? null,
        q5_upcoming_event: onboarding.q5 ?? null,
      })
      if (obErr) log.warn({ err: obErr, userId }, 'onboarding insert failed (non-fatal)')
    }

    // 5. Email verification — skipped entirely when AUTO_CONFIRM is on.
    if (AUTO_CONFIRM) {
      log.info({ userId, email }, 'user auto-confirmed (no email verification)')
      return res.status(201).json({
        ok:            true,
        autoConfirmed: true,
        message:       'Account created — you can sign in now.',
      })
    }

    // Generate a Supabase verification link, then send our branded email.
    const clientUrl   = process.env.CLIENT_URL || 'http://localhost:5173'
    const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
      type:    'signup',
      email,
      password,
      options: { redirectTo: `${clientUrl}/verify-email` },
    })

    if (linkErr) {
      log.error({ err: linkErr, userId }, 'generateLink failed')
      // Continue anyway — user can request resend
    }

    // Supabase returns a full action_link the user clicks. We pass it
    // through SendGrid so the email matches our brand.
    const verifyUrl = linkData?.properties?.action_link || `${clientUrl}/verify-email`

    sendVerificationEmail(email, name, verifyUrl).catch(err =>
      log.error({ err, email }, 'sendVerificationEmail failed'),
    )

    return res.status(201).json({
      ok:            true,
      autoConfirmed: false,
      message:       'Account created — check your email to verify and unlock your dashboard.',
    })
  } catch (err) {
    log.error({ err }, '/register threw')
    return res.status(500).json({ error: err.message || 'Registration failed. Please try again.' })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/auth/post-verify
//
// Called by the frontend AFTER it has exchanged the verification link for a
// session via supabase.auth.verifyOtp. Requires a valid session JWT. We use
// this hook to send the welcome email and any post-verify side effects.
// ═════════════════════════════════════════════════════════════════════════════
router.post('/post-verify', requireAuth, async (req, res) => {
  try {
    const { id, email, name, role, subdomain } = req.user
    sendWelcomeEmail(email, name || 'Fighter', role, subdomain).catch(err =>
      log.error({ err, userId: id }, 'sendWelcomeEmail failed'),
    )
    return res.json({ ok: true })
  } catch (err) {
    log.error({ err }, '/post-verify threw')
    return res.status(500).json({ error: 'Post-verify step failed.' })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/auth/login
//
// Server-side login is optional — the frontend uses supabase.auth
// .signInWithPassword directly so it can manage its own session. This route
// is kept for non-browser clients and integration tests.
// ═════════════════════════════════════════════════════════════════════════════
router.post('/login', validate(LoginSchema), async (req, res) => {
  try {
    const sb = requireSupabase()
    const { email, password } = req.valid

    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) {
      const code = /not confirmed/i.test(error.message) ? 403 : 401
      return res.status(code).json({ error: error.message })
    }

    return res.json({ ok: true, session: data.session, user: data.user })
  } catch (err) {
    log.error({ err }, '/login threw')
    return res.status(500).json({ error: err.message || 'Login failed.' })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/auth/me — current user's merged profile
// ═════════════════════════════════════════════════════════════════════════════
router.get('/me', requireAuth, (req, res) => {
  return res.json(req.user)
})

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/auth/check-subdomain/:slug
// ═════════════════════════════════════════════════════════════════════════════
router.get('/check-subdomain/:slug', async (req, res) => {
  try {
    const parsed = SubdomainSchema.safeParse(req.params.slug)
    if (!parsed.success) {
      return res.json({ available: false, taken: false, invalid: true })
    }

    const sb = requireSupabase()
    const { data, error } = await sb
      .from('profiles')
      .select('id')
      .eq('subdomain', parsed.data)
      .maybeSingle()

    if (error) {
      log.error({ err: error, slug: parsed.data }, 'check-subdomain query failed')
      return res.status(500).json({ error: 'Could not check subdomain.' })
    }

    return res.json({ available: !data, taken: !!data, invalid: false })
  } catch (err) {
    log.error({ err }, '/check-subdomain threw')
    return res.status(500).json({ error: err.message || 'Check failed.' })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/auth/resend-verification
// ═════════════════════════════════════════════════════════════════════════════
router.post('/resend-verification', validate(LoginSchema.pick({ email: true }).extend({}).strip()), async (req, res) => {
  try {
    const sb = requireSupabase()
    const { email } = req.valid
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'

    const { data: linkData, error } = await sb.auth.admin.generateLink({
      type: 'signup',
      email,
      options: { redirectTo: `${clientUrl}/verify-email` },
    })

    if (error) {
      log.warn({ err: error, email }, 'resend generateLink failed')
      // Don't leak whether the email exists — just return ok.
      return res.json({ ok: true })
    }

    const { data: profile } = await sb
      .from('profiles')
      .select('name')
      .eq('email', email)
      .maybeSingle()

    sendVerificationEmail(email, profile?.name || 'Fighter', linkData?.properties?.action_link)
      .catch(err => log.error({ err, email }, 'resend send failed'))

    return res.json({ ok: true })
  } catch (err) {
    log.error({ err }, '/resend-verification threw')
    return res.status(500).json({ error: 'Resend failed.' })
  }
})

export default router
