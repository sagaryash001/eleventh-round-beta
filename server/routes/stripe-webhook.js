// ─────────────────────────────────────────────────────────────────────────────
// Stripe webhook — sponsorship payment events
//
// Mounted BEFORE express.json() in index.js so the raw body is available
// for signature verification.
//
// Handled events:
//   payment_intent.succeeded  → mark payment succeeded, queue outbox event
//   payment_intent.payment_failed → mark payment failed
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express'
import Stripe from 'stripe'
import { adminSupabase } from '../db/supabase.js'
import { childLogger } from '../lib/logger.js'

const router = Router()
const log    = childLogger('stripe-webhook')

router.post('/', express_raw_workaround, async (req, res) => {
  const sig     = req.headers['stripe-signature']
  const secret  = process.env.STRIPE_WEBHOOK_SECRET

  if (!secret) {
    log.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature verification')
    return res.status(400).json({ error: 'Webhook secret not configured.' })
  }

  let event
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
    event = stripe.webhooks.constructEvent(req.rawBody, sig, secret)
  } catch (err) {
    log.warn({ err }, 'Webhook signature verification failed')
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

  log.info({ type: event.type, id: event.id }, 'Stripe webhook received')

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object)
        break
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object)
        break
      default:
        // Unhandled event — acknowledge and move on
        break
    }
    res.json({ received: true })
  } catch (err) {
    log.error({ err, event_type: event.type }, 'Webhook handler threw')
    res.status(500).json({ error: 'Handler failed.' })
  }
})

async function handlePaymentSucceeded(intent) {
  const { data: payment, error } = await adminSupabase
    .from('sponsorship_payments')
    .select('id, contract_id, sponsor_id, fighter_id, amount_usd, milestone_id, status')
    .eq('stripe_payment_intent_id', intent.id)
    .maybeSingle()

  if (error || !payment) {
    log.warn({ intent_id: intent.id }, 'No payment row found for intent')
    return
  }

  // Idempotency: skip if already succeeded
  if (payment.status === 'succeeded') return

  await adminSupabase.from('sponsorship_payments').update({
    status:           'succeeded',
    stripe_charge_id: intent.latest_charge ?? null,
    paid_at:          new Date().toISOString(),
  }).eq('id', payment.id)

  // Mark milestone paid if applicable
  if (payment.milestone_id) {
    await adminSupabase
      .from('payment_milestones')
      .update({ status: 'paid' })
      .eq('id', payment.milestone_id)
  }

  // Queue notification via outbox
  await adminSupabase.from('outbox_events').insert({
    event_type:     'payment.succeeded',
    aggregate_type: 'payment',
    aggregate_id:   payment.id,
    payload: {
      payment_id:  payment.id,
      contract_id: payment.contract_id,
      sponsor_id:  payment.sponsor_id,
      fighter_id:  payment.fighter_id,
      amount_usd:  payment.amount_usd,
    },
  }).catch(() => {})

  log.info({ payment_id: payment.id, amount_usd: payment.amount_usd }, 'Payment succeeded')
}

async function handlePaymentFailed(intent) {
  const lastErr = intent.last_payment_error
  await adminSupabase
    .from('sponsorship_payments')
    .update({
      status:          'failed',
      failure_code:    lastErr?.code    ?? null,
      failure_message: lastErr?.message ?? null,
    })
    .eq('stripe_payment_intent_id', intent.id)
}

// express.raw() is applied per-route in index.js; this middleware captures
// the raw buffer into req.rawBody for signature verification.
function express_raw_workaround(req, _res, next) {
  // Body is already a Buffer when express.raw() is used upstream; pass through.
  if (Buffer.isBuffer(req.body)) {
    req.rawBody = req.body
  }
  next()
}

export default router
