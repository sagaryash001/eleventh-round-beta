// ─────────────────────────────────────────────────────────────────────────────
// Calendly webhook — invitee.created / invitee.canceled.
//
// SCAFFOLD: signature verification + handlers are implemented, but this only
// fires once a Calendly webhook *subscription* is registered (via the Calendly
// API) pointing at /api/calendly/webhook with CALENDLY_WEBHOOK_SIGNING_KEY.
// It is NOT exercised by the test suite — see docs/CALENDLY_SETUP for setup.
//
// Mounted with express.raw() (before the JSON parser) so the raw body is
// available for HMAC verification.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express'
import crypto from 'crypto'
import { adminSupabase } from '../db/supabase.js'
import { childLogger } from '../lib/logger.js'

const router = Router()
const log    = childLogger('calendly-webhook')

// Verify the `Calendly-Webhook-Signature: t=<ts>,v1=<hmac>` header.
function verifySignature(rawBody, header, key) {
  if (!key || !header) return false
  const parts = Object.fromEntries(String(header).split(',').map(kv => {
    const i = kv.indexOf('='); return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()]
  }))
  if (!parts.t || !parts.v1) return false
  const expected = crypto.createHmac('sha256', key).update(`${parts.t}.${rawBody}`).digest('hex')
  try { return crypto.timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expected)) } catch { return false }
}

function calendlyLocation(loc) {
  if (!loc) return null
  if (typeof loc === 'string') return loc
  return loc.location || loc.type || (loc.join_url ? 'Video call' : null)
}

router.post('/', async (req, res) => {
  const key = process.env.CALENDLY_WEBHOOK_SIGNING_KEY
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8')
            : typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})

  if (!verifySignature(raw, req.headers['calendly-webhook-signature'], key)) {
    return res.status(400).json({ error: 'Invalid or missing signature.' })
  }

  let evt
  try { evt = JSON.parse(raw) } catch { return res.status(400).json({ error: 'Bad JSON.' }) }

  // Acknowledge fast; do the work best-effort.
  res.json({ received: true })

  try {
    const sb        = adminSupabase
    const type      = evt.event                       // invitee.created | invitee.canceled
    const payload   = evt.payload ?? {}
    const scheduled = payload.scheduled_event ?? {}
    const ceUri     = scheduled.uri
    if (!ceUri) return

    // Match the host connection via the scheduled event's memberships.
    const hostUris = (scheduled.event_memberships ?? []).map(m => m.user).filter(Boolean)
    if (!hostUris.length) return
    const { data: conn } = await sb.from('calendly_connections')
      .select('user_id, scheduling_url').in('calendly_user_uri', hostUris)
      .is('disconnected_at', null).maybeSingle()
    if (!conn) { log.info({ type }, 'webhook: no matching connection'); return }

    const uid    = conn.user_id
    const status = type === 'invitee.canceled' ? 'canceled' : 'active'
    const now    = new Date().toISOString()
    const evFields = {
      name: scheduled.name || 'Calendly Meeting', event_type: 'other',
      event_date: scheduled.start_time, location: calendlyLocation(scheduled.location),
      external_url: scheduled.location?.join_url || conn.scheduling_url || null,
      status: status === 'canceled' ? 'cancelled' : 'planned',
      source: 'calendly', owner_id: uid, created_by: uid, updated_at: now,
    }

    const { data: existing } = await sb.from('calendly_synced_events')
      .select('id, event_id').eq('user_id', uid).eq('calendly_event_uri', ceUri).maybeSingle()

    if (existing?.event_id) {
      await sb.from('events').update(evFields).eq('id', existing.event_id)
      await sb.from('calendly_synced_events').update({
        status, start_time: scheduled.start_time, end_time: scheduled.end_time,
        calendly_invitee_uri: payload.uri ?? null, raw_payload: payload, updated_at: now,
      }).eq('id', existing.id)
    } else {
      const { data: ev } = await sb.from('events').insert(evFields).select('id').maybeSingle()
      await sb.from('calendly_synced_events').upsert({
        user_id: uid, event_id: ev?.id ?? null, calendly_event_uri: ceUri,
        calendly_invitee_uri: payload.uri ?? null, status,
        start_time: scheduled.start_time, end_time: scheduled.end_time,
        name: scheduled.name, location: calendlyLocation(scheduled.location), raw_payload: payload,
      }, { onConflict: 'user_id,calendly_event_uri' })
    }
    log.info({ uid, type }, 'calendly webhook processed')
  } catch (err) {
    log.error({ err }, 'calendly webhook handler threw')
  }
})

export default router
