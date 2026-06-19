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

// Email confirmation is REQUIRED by default. New users are created UNCONFIRMED
// and the browser triggers Supabase's own confirmation email (via
// supabase.auth.resend) right after registration, so delivery goes through
// Supabase Auth's configured SMTP (SendGrid) rather than this server's separate
// transport.
//
// Set AUTH_AUTOCONFIRM=true ONLY for local/dev or test environments with no
// email delivery — it confirms users instantly and lets them sign in without an
// email. It must NEVER be true in production. (Previously this defaulted to ON
// whenever the *backend* lacked its own SENDGRID_API_KEY, which silently
// bypassed verification and is why signup confirmation emails never arrived.)
const AUTO_CONFIRM = process.env.AUTH_AUTOCONFIRM === 'true'

// Whether a freshly-registered user is considered fully onboarded.
//
// Sponsors are NEVER complete at registration: completing the marketing
// questionnaire is not the same as having a company profile. Their
// onboarding_complete flips to true only once the sponsor_profiles row is
// created at /sponsor company setup. Fighters/managers/promotions keep the
// existing behaviour (complete once they've answered the questionnaire).
export function computeOnboardingComplete(role, onboarding) {
  if (role === 'sponsor') return false
  return !!onboarding
}

// Idempotently create the profile + onboarding rows for an auth user. Used by
// both the client-signUp register flow and the post-verify safety net, so a user
// is never left verified-but-profileless. Throws on a fatal profile failure.
async function bootstrapProfile(sb, { userId, email, name, role, accountType, teamName, subdomain, onboarding }) {
  const { data: existing } = await sb.from('profiles').select('id').eq('id', userId).maybeSingle()
  if (!existing) {
    const { error: profileErr } = await sb.from('profiles').insert({
      id:           userId,
      email,
      name,
      role,
      account_type: accountType,
      team_name:    teamName || null,
      subdomain:    subdomain || null,
      onboarding_complete: computeOnboardingComplete(role, onboarding),
    })
    if (profileErr) throw profileErr
  }
  if (onboarding) {
    const { data: existingOb } = await sb.from('onboarding').select('user_id').eq('user_id', userId).maybeSingle()
    if (!existingOb) {
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
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/auth/register
// ═════════════════════════════════════════════════════════════════════════════
router.post('/register', validate(RegisterSchema), async (req, res) => {
  try {
    const sb = requireSupabase()
    const { name, email, password, accountType, teamName, subdomain, onboarding, userId } = req.valid
    const role = accountType === 'fighter' ? 'fighter'
               : accountType === 'sponsor' ? 'sponsor'
               : 'manager'

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

    // ── New flow: the browser already created the auth user via the normal
    //    supabase.auth.signUp() (which reliably sends the confirmation email via
    //    Supabase's SMTP). Here we ONLY bootstrap profile + onboarding rows for
    //    that user. We never create the user or auto-confirm in this path.
    if (userId) {
      const { data: got, error: getErr } = await sb.auth.admin.getUserById(userId)
      if (getErr || !got?.user || (got.user.email || '').toLowerCase() !== email.toLowerCase()) {
        log.warn({ userId, email }, 'register bootstrap: auth user/email mismatch')
        return res.status(400).json({ error: 'Could not verify the new account. Please try registering again.' })
      }
      await bootstrapProfile(sb, { userId, email, name, role, accountType, teamName, subdomain, onboarding })
      log.info({ userId, email }, 'profile bootstrapped (client signUp flow)')
      return res.status(201).json({ ok: true, autoConfirmed: false })
    }

    // ── Legacy flow (no userId): backend creates the auth user. Kept for
    //    backward compatibility, server tests, and AUTH_AUTOCONFIRM dev mode.
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
        // The account may exist but never have been verified (e.g. created while
        // email sending was broken). Send a `code` so the client can offer a
        // "resend verification" path instead of a dead-end error. We do NOT probe
        // confirmation state here — that would leak which emails are registered.
        return res.status(409).json({
          error: 'An account with this email already exists.',
          code:  'exists',
        })
      }
      log.error({ err: createErr, code, status: createErr.status, email }, 'auth.admin.createUser failed')
      return res.status(500).json({ error: 'Registration failed. Please try again.' })
    }

    const newUserId = created.user.id

    // 3. Insert profile (service role bypasses RLS)
    const { error: profileErr } = await sb.from('profiles').insert({
      id:           newUserId,
      email,
      name,
      role,
      account_type: accountType,
      team_name:    teamName || null,
      subdomain:    subdomain || null,
      onboarding_complete: computeOnboardingComplete(role, onboarding),
    })

    if (profileErr) {
      // Roll back the auth user so the next try has a clean slate
      log.error({ err: profileErr, userId: newUserId }, 'profile insert failed — rolling back auth user')
      await sb.auth.admin.deleteUser(newUserId).catch(() => {})
      return res.status(500).json({ error: 'Registration failed. Please try again.' })
    }

    // 4. Insert onboarding answers
    if (onboarding) {
      const { error: obErr } = await sb.from('onboarding').insert({
        user_id:           newUserId,
        q1_role:           onboarding.q1 ?? null,
        q2_goal:           onboarding.q2 ?? null,
        q3_common_problem: onboarding.q3 ?? null,
        q4_end_goal:       onboarding.q4 ?? null,
        q5_upcoming_event: onboarding.q5 ?? null,
      })
      if (obErr) log.warn({ err: obErr, userId: newUserId }, 'onboarding insert failed (non-fatal)')
    }

    // 5. Email verification.
    //    AUTO_CONFIRM on  → user is already confirmed; no email, client logs in.
    //    AUTO_CONFIRM off → user is UNCONFIRMED. We do NOT send the email from
    //                       here (that used this server's own transport, which is
    //                       separate from Supabase's SMTP). Instead the browser
    //                       calls supabase.auth.resend({ type: 'signup' }) right
    //                       after this responds, so the confirmation email is
    //                       delivered through Supabase Auth's configured SMTP.
    if (AUTO_CONFIRM) {
      log.info({ userId: newUserId, email }, 'user auto-confirmed (AUTH_AUTOCONFIRM=true) — no email verification')
      return res.status(201).json({
        ok:            true,
        autoConfirmed: true,
        message:       'Account created — you can sign in now.',
      })
    }

    log.info({ userId: newUserId, email }, 'user created unconfirmed — client will trigger Supabase confirmation email')
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
    // Safety net: if registration's profile bootstrap never completed, the user
    // would be verified-but-profileless. Recreate the profile now from the auth
    // user's signup metadata so login always finds a profile.
    if (!req.user?.role) {
      try {
        const sb = requireSupabase()
        const { data: got } = await sb.auth.admin.getUserById(req.user.id)
        const meta = got?.user?.user_metadata || {}
        const accountType = meta.account_type || 'fighter'
        const role = meta.role || (accountType === 'fighter' ? 'fighter'
                                : accountType === 'sponsor' ? 'sponsor' : 'manager')
        await bootstrapProfile(sb, {
          userId: req.user.id, email: req.user.email, name: meta.name || 'Fighter',
          role, accountType, teamName: meta.team_name || null, subdomain: meta.subdomain || null,
          onboarding: null,
        })
        log.info({ userId: req.user.id }, 'post-verify safety-net profile bootstrap')
      } catch (e) {
        log.warn({ err: e, userId: req.user.id }, 'post-verify profile bootstrap failed')
      }
    }

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

// Is the auth user behind this profile id email-verified?
async function isEmailVerified(sb, userId) {
  try {
    const { data } = await sb.auth.admin.getUserById(userId)
    return !!data?.user?.email_confirmed_at
  } catch { return false }
}

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/auth/pending-invite?email=...
//
// Drives the invite-aware registration screen. Privacy: account state is only
// revealed for emails that ALREADY have a pending manager invite (the inviting
// manager already knows that email), so this is not a general account-enumeration
// oracle — arbitrary emails just get { hasPendingInvite: false }.
// ═════════════════════════════════════════════════════════════════════════════
router.get('/pending-invite', async (req, res) => {
  try {
    const sb    = requireSupabase()
    const email = String(req.query.email || '').trim().toLowerCase()
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.json({ hasPendingInvite: false })
    }

    // Who is this email? Drives the invited-fighter UI case (A–D).
    const { data: profile } = await sb.from('profiles').select('id, role').eq('email', email).maybeSingle()

    // A manager-initiated invite is keyed on invited_email (non-platform) OR on
    // fighter_id (existing platform fighter). Check both; exclude the fighter's
    // own outbound requests (source = fighter_request).
    let { data: invite } = await sb
      .from('manager_fighters')
      .select('id, status, source, manager_id, invited_name, created_at')
      .eq('invited_email', email)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!invite && profile) {
      const { data: byFid } = await sb
        .from('manager_fighters')
        .select('id, status, source, manager_id, invited_name, created_at')
        .eq('fighter_id', profile.id)
        .eq('status', 'pending')
        .in('source', ['manager_invite', 'manual_create'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      invite = byFid
    }

    if (!invite) return res.json({ hasPendingInvite: false })

    let managerName = null, teamName = null
    if (invite.manager_id) {
      const { data: mgr } = await sb.from('profiles').select('name, team_name').eq('id', invite.manager_id).maybeSingle()
      managerName = mgr?.name ?? null
      teamName    = mgr?.team_name ?? null
    }

    let accountState = 'none'                       // Case A — no account yet
    if (profile) {
      if (profile.role !== 'fighter') accountState = 'non_fighter'   // Case D
      else accountState = (await isEmailVerified(sb, profile.id)) ? 'verified' : 'unverified' // Case C / B
    }

    log.info({ email, accountState, hasInvite: true }, 'pending-invite lookup')
    return res.json({
      hasPendingInvite: true,
      accountState,
      managerName,
      teamName,
      inviteStatus: invite.status,
      invitedEmail: email,
    })
  } catch (err) {
    log.error({ err }, 'GET /auth/pending-invite threw')
    return res.json({ hasPendingInvite: false })
  }
})

export default router
