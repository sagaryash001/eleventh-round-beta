// ─────────────────────────────────────────────────────────────────────────────
// Sponsorship payments — Phase 5a
//
// v1: direct card capture via Stripe PaymentIntent. Platform holds funds;
// fighter payout is manual (Stripe Connect deferred to Phase 5b).
//
// Money invariant: all amounts in integer USD in our DB.
// We multiply by 100 only when calling Stripe (which uses cents).
//
// Routes:
//   POST /api/payments/intent          — create PaymentIntent for a contract
//   GET  /api/payments/:id             — get payment record
//   GET  /api/payments/contract/:cid   — list payments for a contract
//   POST /api/contracts/:cid/milestones           (mounted in contracts.js)
//   GET  /api/contracts/:cid/milestones           (mounted in contracts.js)
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express'
import Stripe from 'stripe'
import { adminSupabase } from '../db/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { childLogger } from '../lib/logger.js'

const router = Router()
const log    = childLogger('sponsorship-payments')

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw Object.assign(new Error('STRIPE_SECRET_KEY not configured.'), { status: 503 })
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
}

// ── POST /api/payments/intent ─────────────────────────────────────────────────
// Creates a Stripe PaymentIntent and a sponsorship_payments row in
// `requires_payment` status. Frontend uses the client_secret to render
// Stripe Elements and confirm the payment.
router.post('/intent', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'sponsor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only sponsors can initiate payments.' })
    }

    const { contract_id, milestone_id } = req.body
    if (!contract_id) return res.status(400).json({ error: 'contract_id required.' })

    // Verify contract and ownership
    const { data: contract, error: cErr } = await adminSupabase
      .from('contracts')
      .select('id, sponsor_id, fighter_id, value_usd, platform_fee_bps, status, payment_schedule')
      .eq('id', contract_id)
      .maybeSingle()

    if (cErr) throw cErr
    if (!contract) return res.status(404).json({ error: 'Contract not found.' })
    if (contract.sponsor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not your contract.' })
    }
    if (contract.status !== 'active') {
      return res.status(400).json({ error: 'Contract must be active before payment.' })
    }

    // Determine amount — milestone or full contract value
    let amountUsd = contract.value_usd
    let milestoneRow = null

    if (milestone_id) {
      const { data: ms } = await adminSupabase
        .from('payment_milestones')
        .select('*')
        .eq('id', milestone_id)
        .eq('contract_id', contract_id)
        .maybeSingle()
      if (!ms) return res.status(404).json({ error: 'Milestone not found.' })
      if (ms.status !== 'pending') return res.status(400).json({ error: 'Milestone already paid or skipped.' })
      amountUsd    = ms.amount_usd
      milestoneRow = ms
    }

    // Check for duplicate in-flight payment
    const { data: existing } = await adminSupabase
      .from('sponsorship_payments')
      .select('id, stripe_payment_intent_id, status')
      .eq('contract_id', contract_id)
      .in('status', ['requires_payment', 'processing'])
      .is('milestone_id', milestone_id ?? null)
      .maybeSingle()

    if (existing) {
      // Return the existing intent so frontend can reuse it
      const stripe = getStripe()
      const pi = await stripe.paymentIntents.retrieve(existing.stripe_payment_intent_id)
      return res.json({ ok: true, client_secret: pi.client_secret, payment_id: existing.id, reused: true })
    }

    const platformFeeUsd = Math.floor(amountUsd * (contract.platform_fee_bps / 10_000))
    const netToFighterUsd = amountUsd - platformFeeUsd

    const stripe = getStripe()
    const intent = await stripe.paymentIntents.create({
      amount:   amountUsd * 100, // cents
      currency: 'usd',
      metadata: {
        contract_id,
        sponsor_id:  contract.sponsor_id,
        fighter_id:  contract.fighter_id,
        milestone_id: milestone_id ?? '',
        platform:    'eleventh-round',
      },
      description: `Eleventh Round sponsorship contract ${contract_id}`,
    })

    const { data: payment, error: pErr } = await adminSupabase
      .from('sponsorship_payments')
      .insert({
        contract_id,
        sponsor_id:               contract.sponsor_id,
        fighter_id:               contract.fighter_id,
        milestone_id:             milestone_id ?? null,
        amount_usd:               amountUsd,
        platform_fee_usd:         platformFeeUsd,
        net_to_fighter_usd:       netToFighterUsd,
        stripe_payment_intent_id: intent.id,
        status:                   'requires_payment',
      })
      .select()
      .maybeSingle()

    if (pErr) throw pErr

    log.info({ payment_id: payment.id, amount_usd: amountUsd }, 'PaymentIntent created')
    res.json({ ok: true, client_secret: intent.client_secret, payment_id: payment.id })
  } catch (err) {
    log.error({ err }, 'POST /payments/intent threw')
    res.status(err.status || 500).json({ error: err.message })
  }
})

// ── GET /api/payments/contract/:contractId ────────────────────────────────────
router.get('/contract/:contractId', requireAuth, async (req, res) => {
  try {
    const { data: contract } = await adminSupabase
      .from('contracts')
      .select('sponsor_id, fighter_id')
      .eq('id', req.params.contractId)
      .maybeSingle()

    if (!contract) return res.status(404).json({ error: 'Contract not found.' })
    const uid = req.user.id
    if (contract.sponsor_id !== uid && contract.fighter_id !== uid && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden.' })
    }

    const { data, error } = await adminSupabase
      .from('sponsorship_payments')
      .select('*')
      .eq('contract_id', req.params.contractId)
      .order('created_at', { ascending: false })
    if (error) throw error

    res.json({ ok: true, payments: data ?? [] })
  } catch (err) {
    log.error({ err }, 'GET /payments/contract/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/payments/:id ─────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await adminSupabase
      .from('sponsorship_payments')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Not found.' })

    const uid = req.user.id
    if (data.sponsor_id !== uid && data.fighter_id !== uid && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden.' })
    }
    res.json({ ok: true, payment: data })
  } catch (err) {
    log.error({ err }, 'GET /payments/:id threw')
    res.status(500).json({ error: err.message })
  }
})

export default router
