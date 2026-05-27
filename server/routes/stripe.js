import { Router } from 'express'
import Stripe from 'stripe'
import { childLogger } from '../lib/logger.js'

const router = Router()
const log    = childLogger('stripe')

// Lazily instantiate — server still starts without STRIPE_SECRET_KEY
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured. Add it to .env to enable checkout.')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
}

// ── POST /api/stripe/checkout ──────────────────────────────────────────────────
router.post('/checkout', async (req, res) => {
  try {
    const { items, success_url, cancel_url } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' })
    }

    const stripe = getStripe()

    const line_items = items.map((item) => ({
      quantity: item.quantity ?? 1,
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(item.price * 100),
        product_data: {
          name:   item.name,
          ...(item.image ? { images: [item.image] } : {}),
        },
      },
    }))

    const session = await stripe.checkout.sessions.create({
      mode:                'payment',
      payment_method_types: ['card'],
      line_items,
      success_url: success_url || `${process.env.CLIENT_URL}/apparel?checkout=success`,
      cancel_url:  cancel_url  || `${process.env.CLIENT_URL}/apparel`,
      shipping_address_collection: { allowed_countries: ['US', 'CA', 'GB', 'AU'] },
      automatic_tax: { enabled: false },
    })

    log.info({ sessionId: session.id, itemCount: items.length }, 'Checkout session created')
    res.json({ url: session.url })
  } catch (err) {
    log.error({ err }, 'POST /stripe/checkout threw')
    res.status(err.statusCode || 500).json({ error: err.message })
  }
})

export default router
