// ─────────────────────────────────────────────────────────────────────────────
// Auth middleware — verifies Supabase JWTs
//
// The frontend keeps the user's Supabase session in localStorage (handled
// by supabase-js). When it calls the backend, it sends:
//   Authorization: Bearer <access_token>
//
// We verify the token by asking Supabase to resolve it to a user. This
// also handles refresh / expiry / revocation correctly.
//
// `req.user` will contain: { id, email, role, account_type, subdomain, ... }
// (merged from auth.users + profiles).
// ─────────────────────────────────────────────────────────────────────────────

import { adminSupabase } from '../db/supabase.js'
import { childLogger } from '../lib/logger.js'

const log = childLogger('auth-middleware')

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — no token provided.' })
  }
  const token = header.slice(7)

  if (!adminSupabase) {
    return res.status(503).json({ error: 'Auth backend not configured.' })
  }

  try {
    // 1. Resolve token → user (Supabase Auth)
    const { data: authData, error: authErr } = await adminSupabase.auth.getUser(token)
    if (authErr || !authData?.user) {
      return res.status(401).json({ error: 'Invalid or expired token.' })
    }

    // 2. Merge in profile row (role, subdomain, account_type, etc.)
    const { data: profile, error: profErr } = await adminSupabase
      .from('profiles')
      .select('id, email, name, role, account_type, team_name, subdomain, onboarding_complete')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (profErr) {
      log.error({ err: profErr, userId: authData.user.id }, 'Profile fetch failed')
      return res.status(500).json({ error: 'Could not load profile.' })
    }

    if (!profile) {
      // User exists in auth but no profile yet (incomplete onboarding edge case)
      req.user = {
        id:    authData.user.id,
        email: authData.user.email,
        role:  null,
      }
    } else {
      req.user = profile
    }

    next()
  } catch (err) {
    log.error({ err }, 'requireAuth threw')
    return res.status(500).json({ error: 'Auth check failed.' })
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized.' })
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' })
  }
  next()
}

/**
 * Soft auth — attaches req.user if a token is present, but doesn't reject
 * if it's missing or invalid. Useful for endpoints that personalize when
 * logged in but still serve anon users (e.g. apparel click tracking).
 */
export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ') || !adminSupabase) return next()

  try {
    const { data } = await adminSupabase.auth.getUser(header.slice(7))
    if (data?.user) {
      const { data: profile } = await adminSupabase
        .from('profiles')
        .select('id, email, name, role')
        .eq('id', data.user.id)
        .maybeSingle()
      req.user = profile || { id: data.user.id, email: data.user.email }
    }
  } catch { /* ignore — soft auth */ }
  next()
}
