import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { sendVerificationEmail, sendWelcomeEmail } from '../services/email.js'

const router = Router()
const SECRET  = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const EXPIRES = '30d'

function sign(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, subdomain: user.subdomain ?? null },
    SECRET,
    { expiresIn: EXPIRES },
  )
}

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, subdomain: u.subdomain ?? null }
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const {
      name, email, password,
      accountType,            // 'fighter' | 'management' | 'promotion'
      teamName, subdomain,
      onboarding,             // { q1, q2, q3, q4, q5 }
    } = req.body

    // Validation
    if (!name?.trim() || !email?.trim() || !password || !accountType) {
      return res.status(400).json({ error: 'Missing required fields.' })
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' })
    }

    const normalEmail = email.toLowerCase().trim()

    // Unique email
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(normalEmail)) {
      return res.status(409).json({ error: 'An account with this email already exists.' })
    }

    // Unique subdomain
    const slug = subdomain?.toLowerCase().trim() || null
    if (slug && db.prepare('SELECT id FROM users WHERE subdomain = ?').get(slug)) {
      return res.status(409).json({ error: 'That subdomain is already taken. Choose another.' })
    }

    // Map account type → internal role
    const role = accountType === 'fighter' ? 'fighter' : 'manager'

    const id           = uuid()
    const passwordHash = await bcrypt.hash(password, 12)
    const verifyToken  = uuid()

    // Insert user
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, account_type, team_name, subdomain, verify_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, normalEmail, passwordHash, name.trim(), role, accountType, teamName?.trim() || null, slug, verifyToken)

    // Insert onboarding answers
    if (onboarding) {
      db.prepare(`
        INSERT INTO onboarding (user_id, q1_role, q2_goal, q3_common_problem, q4_end_goal, q5_upcoming_event)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, onboarding.q1 ?? null, onboarding.q2 ?? null, onboarding.q3 ?? null, onboarding.q4 ?? null, onboarding.q5 ?? null)

      db.prepare('UPDATE users SET onboarding_complete = 1 WHERE id = ?').run(id)
    }

    // Send verification email (non-blocking — don't fail registration if email fails)
    sendVerificationEmail(normalEmail, name.trim(), verifyToken).catch(err =>
      console.error('[Email] Verification send failed:', err.message),
    )

    return res.status(201).json({
      ok: true,
      message: 'Account created — check your email to verify and unlock your dashboard.',
    })
  } catch (err) {
    console.error('[Register]', err)
    return res.status(500).json({ error: 'Registration failed. Please try again.' })
  }
})

// ── GET /api/auth/verify/:token ───────────────────────────────────────────────
router.get('/verify/:token', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE verify_token = ?').get(req.params.token)
    if (!user) return res.status(400).json({ error: 'Invalid or expired verification link.' })

    db.prepare('UPDATE users SET verified = 1, verify_token = NULL WHERE id = ?').run(user.id)

    // Send welcome email (non-blocking)
    sendWelcomeEmail(user.email, user.name, user.role, user.subdomain).catch(err =>
      console.error('[Email] Welcome send failed:', err.message),
    )

    // Return JWT so frontend can log the user in immediately
    const token = sign(user)
    return res.json({ ok: true, token, user: publicUser(user) })
  } catch (err) {
    console.error('[Verify]', err)
    return res.status(500).json({ error: 'Verification failed.' })
  }
})

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required.' })

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim())
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' })

    const match = await bcrypt.compare(password, user.password_hash)
    if (!match) return res.status(401).json({ error: 'Invalid credentials.' })

    if (!user.verified) {
      return res.status(403).json({
        error: 'Email not verified — check your inbox and click the verification link.',
      })
    }

    return res.json({ ok: true, token: sign(user), user: publicUser(user) })
  } catch (err) {
    console.error('[Login]', err)
    return res.status(500).json({ error: 'Login failed. Please try again.' })
  }
})

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const u = db.prepare(
    'SELECT id, email, name, role, account_type, team_name, subdomain, onboarding_complete FROM users WHERE id = ?',
  ).get(req.user.id)
  if (!u) return res.status(404).json({ error: 'User not found.' })
  return res.json(u)
})

// ── GET /api/auth/check-subdomain/:slug ───────────────────────────────────────
router.get('/check-subdomain/:slug', (req, res) => {
  const slug    = req.params.slug.toLowerCase().trim()
  const taken   = !!db.prepare('SELECT id FROM users WHERE subdomain = ?').get(slug)
  const invalid = !/^[a-z0-9-]{3,32}$/.test(slug)
  return res.json({ available: !taken && !invalid, taken, invalid })
})

export default router
