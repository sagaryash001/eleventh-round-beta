// ─────────────────────────────────────────────────────────────────────────────
// Stripe webhook — sponsorship payment events + billing package checkout
//
// Mounted BEFORE express.json() in index.js so the raw body is available
// for signature verification.
//
// Handled events:
//   checkout.session.completed    → record package payment + membership
//   payment_intent.succeeded      → mark sponsorship payment succeeded
//   payment_intent.payment_failed → mark sponsorship payment failed
//   invoice.paid                  → renew subscription membership period
//   customer.subscription.updated → sync subscription status
//   customer.subscription.deleted → cancel membership
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
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object)
        break
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object)
        break
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object)
        break
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object)
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

// ── checkout.session.completed ────────────────────────────────────────────────
// Records a package payment and creates/updates a membership.
//
// Idempotency strategy:
//   1. Check for existing payment by stripe_checkout_session_id — skip if found.
//   2. On payment insert, if stripe_payment_intent_id conflicts (invoice.paid
//      fired first for subscriptions), patch the session ID onto the existing row
//      instead of failing. This prevents an infinite 500 retry loop from Stripe.
//   3. Membership uses explicit SELECT → UPDATE/INSERT because user_id has no
//      UNIQUE constraint on the memberships table, making upsert({ onConflict:
//      'user_id' }) fail with a Postgres error every time.
async function handleCheckoutCompleted(session) {
  const packageId = session.metadata?.package_id
  const userId    = session.client_reference_id ?? session.metadata?.user_id

  if (!packageId || !userId) {
    log.warn({ session_id: session.id }, 'checkout.session.completed missing package_id or user_id — not a billing package session')
    return
  }

  // Idempotency: skip if we already recorded this checkout session
  const { data: existingBySession } = await adminSupabase
    .from('payments')
    .select('id')
    .eq('stripe_checkout_session_id', session.id)
    .maybeSingle()
  if (existingBySession) {
    log.info({ session_id: session.id }, 'checkout.session.completed already processed — skipping')
    return
  }

  // Load package to get billing interval
  const { data: pkg } = await adminSupabase
    .from('packages')
    .select('id, name, price_cents, billing_interval')
    .eq('id', packageId)
    .maybeSingle()
  if (!pkg) {
    log.warn({ package_id: packageId, session_id: session.id }, 'Package not found in DB — cannot record payment')
    return
  }

  const amountTotal     = session.amount_total ?? pkg.price_cents
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null

  // Insert payment row.
  // For subscriptions, invoice.paid may have already inserted a row with the
  // same stripe_payment_intent_id (unique constraint, code 23505). In that case,
  // patch the checkout_session_id onto the existing row and continue.
  const { data: payment, error: payErr } = await adminSupabase
    .from('payments')
    .insert({
      user_id:                    userId,
      package_id:                 packageId,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id:   paymentIntentId,
      amount:                     amountTotal,
      currency:                   session.currency ?? 'usd',
      status:                     'succeeded',
    })
    .select('id')
    .maybeSingle()

  if (payErr) {
    if (payErr.code === '23505' && paymentIntentId) {
      // invoice.paid fired first — patch the checkout_session_id and continue
      await adminSupabase.from('payments')
        .update({ stripe_checkout_session_id: session.id })
        .eq('stripe_payment_intent_id', paymentIntentId)
        .catch(e => log.warn({ err: e }, 'Could not patch stripe_checkout_session_id onto existing payment'))
    } else {
      log.error({ err: payErr, session_id: session.id }, 'Failed to insert payment row')
      throw payErr
    }
  }

  // Membership: SELECT → UPDATE or INSERT.
  // Cannot use upsert({ onConflict: 'user_id' }) because user_id has no UNIQUE
  // constraint on the memberships table — that requires a unique index/constraint,
  // not just a plain index.
  const now      = new Date()
  const interval = pkg.billing_interval
  let periodEnd  = null
  if (interval === 'monthly') {
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString()
  } else if (interval === 'annual') {
    periodEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString()
  }

  const membershipData = {
    package_id:             packageId,
    stripe_customer_id:     typeof session.customer === 'string' ? session.customer : null,
    stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
    tier:                   pkg.name.toLowerCase().replace(/\s+/g, '_'),
    status:                 'active',
    billing_interval:       interval,
    current_period_start:   now.toISOString(),
    current_period_end:     periodEnd,
    cancel_at_period_end:   false,
  }

  const { data: existingMem } = await adminSupabase
    .from('memberships')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingMem) {
    await adminSupabase.from('memberships').update(membershipData).eq('id', existingMem.id)
  } else {
    await adminSupabase.from('memberships').insert({ user_id: userId, ...membershipData })
  }

  // Emit notification + email via outbox (fire-and-forget, non-fatal)
  await adminSupabase.from('outbox_events').insert({
    event_type:     'billing.package_purchased',
    aggregate_type: 'payments',
    aggregate_id:   payment?.id ?? packageId,
    payload: {
      user_id:          userId,
      package_name:     pkg.name,
      billing_interval: pkg.billing_interval,
      amount_cents:     amountTotal,
    },
  }).catch(e => log.warn({ err: e }, 'billing.package_purchased outbox insert failed'))

  log.info({ payment_id: payment?.id, package_id: packageId, user_id: userId }, 'Package checkout completed — payment + membership recorded')
}

// ── invoice.paid ──────────────────────────────────────────────────────────────
// Renews the membership period when a subscription renews.
// For the initial subscription payment, checkout.session.completed also fires.
// We check the payment_intent_id before inserting to avoid duplicates instead
// of silently swallowing constraint errors.
async function handleInvoicePaid(invoice) {
  const subscriptionId = invoice.subscription
  if (!subscriptionId) return

  const { data: membership } = await adminSupabase
    .from('memberships')
    .select('id, user_id, package_id, billing_interval')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()
  if (!membership) return

  const now            = new Date()
  const interval       = membership.billing_interval
  const paymentIntentId = typeof invoice.payment_intent === 'string' ? invoice.payment_intent : null
  let periodEnd        = null
  if (interval === 'monthly') {
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString()
  } else if (interval === 'annual') {
    periodEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString()
  }

  // Idempotency: skip payment insert if this intent was already recorded
  // (checkout.session.completed may have handled the initial charge already)
  if (paymentIntentId) {
    const { data: existingPayment } = await adminSupabase
      .from('payments')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle()
    if (existingPayment) {
      // Already recorded — only update the membership period
      await adminSupabase.from('memberships').update({
        status:               'active',
        current_period_start: now.toISOString(),
        current_period_end:   periodEnd,
      }).eq('id', membership.id)
      log.info({ membership_id: membership.id }, 'invoice.paid — payment already recorded, membership period updated')
      return
    }
  }

  // Insert renewal payment
  const { error: payErr } = await adminSupabase.from('payments').insert({
    user_id:                  membership.user_id,
    package_id:               membership.package_id,
    stripe_payment_intent_id: paymentIntentId,
    amount:                   invoice.amount_paid ?? 0,
    currency:                 invoice.currency ?? 'usd',
    status:                   'succeeded',
  })
  if (payErr) log.warn({ err: payErr, subscription_id: subscriptionId }, 'invoice.paid: payment insert failed')

  await adminSupabase.from('memberships').update({
    status:               'active',
    current_period_start: now.toISOString(),
    current_period_end:   periodEnd,
  }).eq('id', membership.id)

  log.info({ membership_id: membership.id, subscription_id: subscriptionId }, 'Subscription renewed — membership period updated')
}

// ── customer.subscription.updated ────────────────────────────────────────────
async function handleSubscriptionUpdated(sub) {
  const statusMap = {
    active:    'active',
    past_due:  'past_due',
    canceled:  'canceled',
    incomplete: 'incomplete',
  }
  const status = statusMap[sub.status] ?? 'incomplete'

  await adminSupabase.from('memberships').update({
    status,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    current_period_end:   sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
  }).eq('stripe_subscription_id', sub.id)

  log.info({ subscription_id: sub.id, status }, 'Subscription updated')
}

// ── customer.subscription.deleted ────────────────────────────────────────────
async function handleSubscriptionDeleted(sub) {
  await adminSupabase.from('memberships').update({
    status:              'canceled',
    cancel_at_period_end: false,
  }).eq('stripe_subscription_id', sub.id)

  log.info({ subscription_id: sub.id }, 'Subscription canceled — membership deactivated')
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
