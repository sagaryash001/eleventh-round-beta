// ─────────────────────────────────────────────────────────────────────────────
// Billing routes — package discovery, membership status, Stripe Checkout
//
// POST /api/billing/checkout creates a Stripe Checkout session server-side.
// Package price is always loaded from DB — frontend cannot set the amount.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express'
import Stripe from 'stripe'
import { adminSupabase } from '../db/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { childLogger } from '../lib/logger.js'

const router = Router()
const log    = childLogger('billing')

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured. Add it to .env to enable checkout.')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
}

// Map authenticated user role → package audience filter
function audienceFor(user) {
  if (user.role === 'admin')   return null      // admin bypasses audience filter
  if (user.role === 'sponsor') return 'sponsor'
  if (user.role === 'manager') return 'manager'
  if (user.role === 'fighter') return 'fighter'
  return null
}

// ── GET /api/billing/packages ─────────────────────────────────────────────────
// Lists active packages the requesting user is eligible to purchase.
router.get('/packages', requireAuth, async (req, res) => {
  try {
    const audience = audienceFor(req.user)
    let q = adminSupabase
      .from('packages')
      .select('id, name, audience, description, price_cents, billing_interval, features, sort_order, stripe_price_id')
      .eq('active', true)
      .order('sort_order')

    // Admins see all packages; others see packages for their role + 'all'
    if (audience) {
      q = q.or(`audience.eq.${audience},audience.eq.all`)
    }

    const { data: pkgs, error } = await q
    if (error) throw error

    res.json({ ok: true, packages: pkgs ?? [] })
  } catch (err) {
    log.error({ err }, 'GET /billing/packages threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/billing/me ───────────────────────────────────────────────────────
// Returns the user's active membership (if any) and recent billing payments.
router.get('/me', requireAuth, async (req, res) => {
  try {
    const uid = req.user.id

    const [membershipResult, paymentsResult] = await Promise.all([
      adminSupabase
        .from('memberships')
        .select('id, status, billing_interval, current_period_start, current_period_end, cancel_at_period_end, created_at, packages(id, name, audience, price_cents, billing_interval, features)')
        .eq('user_id', uid)
        .in('status', ['active', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      adminSupabase
        .from('payments')
        .select('id, amount, currency, status, created_at, packages(id, name)')
        .eq('user_id', uid)
        .not('package_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10)
        .catch(() => ({ data: [] })),
    ])

    if (membershipResult.error) throw membershipResult.error

    res.json({
      ok:         true,
      membership: membershipResult.data ?? null,
      payments:   paymentsResult.data ?? [],
    })
  } catch (err) {
    log.error({ err }, 'GET /billing/me threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/billing/checkout ────────────────────────────────────────────────
// Creates a Stripe Checkout session for a specific package.
// Rules:
//   - package_id must exist and be active
//   - package audience must match user role (or be 'all')
//   - price is loaded from DB — frontend cannot influence the amount
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const { package_id } = req.body
    if (!package_id) {
      return res.status(400).json({ error: 'package_id is required.' })
    }

    // Load package from DB — never trust frontend price
    const { data: pkg, error: pkgErr } = await adminSupabase
      .from('packages')
      .select('*')
      .eq('id', package_id)
      .eq('active', true)
      .maybeSingle()
    if (pkgErr) throw pkgErr
    if (!pkg) return res.status(404).json({ error: 'Package not found or inactive.' })

    // Audience check — admin bypasses
    const audience = audienceFor(req.user)
    if (audience && pkg.audience !== 'all' && pkg.audience !== audience) {
      return res.status(403).json({ error: 'This package is not available for your account type.' })
    }

    if (pkg.price_cents <= 0) {
      return res.status(400).json({ error: 'Package has no price configured.' })
    }

    const stripe  = getStripe()
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173'
    const isRecurring = pkg.billing_interval !== 'one_time'

    // Build Stripe Checkout Session params
    const sessionParams = {
      payment_method_types:  ['card'],
      client_reference_id:   req.user.id,
      metadata: {
        package_id: pkg.id,
        user_id:    req.user.id,
      },
      success_url: `${baseUrl}/dashboard?billing=success&package=${encodeURIComponent(pkg.name)}`,
      cancel_url:  `${baseUrl}/dashboard?billing=cancel`,
    }

    if (isRecurring) {
      sessionParams.mode = 'subscription'
      // Use pre-created Stripe Price if available, else dynamic price_data
      if (pkg.stripe_price_id) {
        sessionParams.line_items = [{ price: pkg.stripe_price_id, quantity: 1 }]
      } else {
        sessionParams.line_items = [{
          quantity: 1,
          price_data: {
            currency:   'usd',
            unit_amount: pkg.price_cents,
            recurring: { interval: pkg.billing_interval === 'annual' ? 'year' : 'month' },
            product_data: {
              name:        pkg.name,
              description: pkg.description ?? undefined,
            },
          },
        }]
      }
    } else {
      sessionParams.mode = 'payment'
      sessionParams.line_items = [{
        quantity: 1,
        price_data: {
          currency:   'usd',
          unit_amount: pkg.price_cents,
          product_data: {
            name:        pkg.name,
            description: pkg.description ?? undefined,
          },
        },
      }]
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    log.info({ session_id: session.id, package_id: pkg.id, user_id: req.user.id }, 'Billing checkout session created')
    res.json({ ok: true, url: session.url })
  } catch (err) {
    log.error({ err }, 'POST /billing/checkout threw')
    const status = err.message?.includes('not configured') ? 503 : (err.statusCode || 500)
    res.status(status).json({ error: err.message })
  }
})

export default router
