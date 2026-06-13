// ─────────────────────────────────────────────────────────────────────────────
// Calendly OAuth + scheduled-event sync.
//
// Tokens are exchanged and stored SERVER-SIDE ONLY (AES-256-GCM encrypted via
// lib/crypto.js). The frontend never receives tokens — only connection status.
// The OAuth round-trip is CSRF-protected with a one-time `state` row.
//
// Webhook handling lives in routes/calendly-webhook.js (raw body required).
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express'
import crypto from 'crypto'
import { adminSupabase } from '../db/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { childLogger } from '../lib/logger.js'
import { encrypt, decrypt, isEncryptionConfigured } from '../lib/crypto.js'

const router = Router()
const log    = childLogger('calendly')

const AUTH_BASE = 'https://auth.calendly.com'
const API_BASE  = 'https://api.calendly.com'
const CLIENT    = process.env.CLIENT_URL || ''

function cfg() {
  return {
    clientId:     process.env.CALENDLY_CLIENT_ID,
    clientSecret: process.env.CALENDLY_CLIENT_SECRET,
    redirectUri:  process.env.CALENDLY_REDIRECT_URI,
  }
}
function isConfigured() {
  const c = cfg()
  return !!(c.clientId && c.clientSecret && c.redirectUri && isEncryptionConfigured())
}

async function calendlyApi(token, path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Calendly API ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

// Public URL Calendly should POST webhook events to. Prefer an explicit override,
// otherwise derive it from the OAuth redirect URI's origin so it always matches
// the deployed backend host (no hardcoded URL).
function webhookUrl() {
  if (process.env.CALENDLY_WEBHOOK_URL) return process.env.CALENDLY_WEBHOOK_URL
  try { return `${new URL(cfg().redirectUri).origin}/api/calendly/webhook` } catch { return null }
}

// Create a user-scoped webhook subscription for invitee.created / invitee.canceled.
// Best-effort: returns the subscription URI, or null on any failure (manual sync
// remains the fallback). Requires CALENDLY_WEBHOOK_SIGNING_KEY so payloads are
// signed and verifiable by routes/calendly-webhook.js.
async function createWebhookSubscription(token, userUri, orgUri) {
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY
  const url        = webhookUrl()
  if (!signingKey) { log.info('CALENDLY_WEBHOOK_SIGNING_KEY not set — skipping webhook subscription (manual sync available)'); return null }
  if (!url || !userUri || !orgUri) { log.info('missing webhook url/user/org — skipping subscription'); return null }
  try {
    const res = await fetch(`${API_BASE}/webhook_subscriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        events: ['invitee.created', 'invitee.canceled'],
        organization: orgUri,
        user: userUri,
        scope: 'user',
        signing_key: signingKey,
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      log.warn({ status: res.status, body: text.slice(0, 300) }, 'webhook_subscriptions create failed (manual sync still works)')
      return null
    }
    const j = await res.json()
    return j?.resource?.uri ?? null
  } catch (err) {
    log.warn({ err }, 'webhook_subscriptions create threw')
    return null
  }
}

async function deleteWebhookSubscription(token, uri) {
  if (!uri) return
  try {
    // The subscription URI is a fully-qualified Calendly API URL.
    await fetch(uri, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  } catch (err) {
    log.warn({ err }, 'webhook_subscriptions delete failed')
  }
}

// Returns a usable access token, refreshing first if it is about to expire.
async function getValidAccessToken(conn) {
  const c = cfg()
  let access = decrypt(conn.access_token_encrypted)
  const exp  = conn.expires_at ? new Date(conn.expires_at).getTime() : 0
  const stale = exp && (exp - Date.now() < 60_000)

  if (stale && conn.refresh_token_encrypted) {
    const refresh = decrypt(conn.refresh_token_encrypted)
    const res = await fetch(`${AUTH_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token', client_id: c.clientId, client_secret: c.clientSecret, refresh_token: refresh,
      }),
    })
    if (res.ok) {
      const j = await res.json()
      access = j.access_token
      await adminSupabase.from('calendly_connections').update({
        access_token_encrypted:  encrypt(j.access_token),
        refresh_token_encrypted: j.refresh_token ? encrypt(j.refresh_token) : conn.refresh_token_encrypted,
        expires_at: j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', conn.id)
    } else {
      log.warn({ status: res.status }, 'Calendly token refresh failed')
    }
  }
  return access
}

async function activeConnection(uid) {
  const { data } = await adminSupabase
    .from('calendly_connections').select('*').eq('user_id', uid).maybeSingle()
  if (!data || data.disconnected_at || !data.access_token_encrypted) return null
  return data
}

// ── GET /api/calendly/status ──────────────────────────────────────────────────
// Never returns tokens — only connection metadata.
router.get('/status', requireAuth, async (req, res) => {
  try {
    const conn = await activeConnection(req.user.id)
    if (!conn) return res.json({ connected: false, configured: isConfigured() })

    const { count } = await adminSupabase
      .from('calendly_synced_events').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id)

    res.json({
      connected:      true,
      configured:     isConfigured(),
      scheduling_url: conn.scheduling_url ?? null,
      synced_count:   count ?? 0,
      last_synced_at: conn.last_synced_at ?? null,
    })
  } catch (err) {
    log.error({ err }, 'GET /calendly/status threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/calendly/connect-url ─────────────────────────────────────────────
// Backend-generated authorization URL + one-time CSRF state.
router.get('/connect-url', requireAuth, async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({ error: 'Calendly is not configured on the server. Set CALENDLY_CLIENT_ID, CALENDLY_CLIENT_SECRET, CALENDLY_REDIRECT_URI and TOKEN_ENCRYPTION_KEY.' })
    }
    const c = cfg()
    const sb = adminSupabase

    // Clean expired states (older than 15 min), then mint a fresh one.
    await sb.from('calendly_oauth_states').delete().lt('created_at', new Date(Date.now() - 15 * 60_000).toISOString())
    const state = crypto.randomBytes(24).toString('hex')
    await sb.from('calendly_oauth_states').insert({ state, user_id: req.user.id })

    const url = `${AUTH_BASE}/oauth/authorize?` + new URLSearchParams({
      client_id: c.clientId, response_type: 'code', redirect_uri: c.redirectUri, state,
    }).toString()

    res.json({ url })
  } catch (err) {
    log.error({ err }, 'GET /calendly/connect-url threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/calendly/oauth/callback ──────────────────────────────────────────
// Calendly redirects here. No bearer auth — the user is identified by `state`.
router.get('/oauth/callback', async (req, res) => {
  const fail = (reason) => res.redirect(`${CLIENT}/dashboard/fighter?calendly=error&reason=${encodeURIComponent(reason)}`)
  try {
    const { code, state, error: oauthError } = req.query
    if (oauthError) return fail('denied')
    if (!code || !state) return fail('missing_params')
    if (!isConfigured()) return fail('not_configured')

    const sb = adminSupabase
    // Validate + consume the state (CSRF protection).
    const { data: stateRow } = await sb.from('calendly_oauth_states').select('user_id, created_at').eq('state', state).maybeSingle()
    if (!stateRow) return fail('invalid_state')
    await sb.from('calendly_oauth_states').delete().eq('state', state)
    if (Date.now() - new Date(stateRow.created_at).getTime() > 15 * 60_000) return fail('expired_state')

    const uid = stateRow.user_id
    const c   = cfg()

    // Exchange the code for tokens.
    const tokenRes = await fetch(`${AUTH_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', client_id: c.clientId, client_secret: c.clientSecret,
        code: String(code), redirect_uri: c.redirectUri,
      }),
    })
    if (!tokenRes.ok) {
      log.warn({ status: tokenRes.status }, 'Calendly token exchange failed')
      return fail('token_exchange')
    }
    const tok = await tokenRes.json()

    // Fetch the connected user (uri, org, scheduling_url).
    let userUri = tok.owner ?? null, orgUri = tok.organization ?? null, schedulingUrl = null
    try {
      const me = await calendlyApi(tok.access_token, '/users/me')
      userUri       = me?.resource?.uri ?? userUri
      orgUri        = me?.resource?.current_organization ?? orgUri
      schedulingUrl = me?.resource?.scheduling_url ?? null
    } catch (e) { log.warn({ err: e }, 'users/me failed (continuing)') }

    await sb.from('calendly_connections').upsert({
      user_id: uid,
      calendly_user_uri: userUri,
      calendly_org_uri:  orgUri,
      scheduling_url:    schedulingUrl,
      access_token_encrypted:  encrypt(tok.access_token),
      refresh_token_encrypted: tok.refresh_token ? encrypt(tok.refresh_token) : null,
      token_type: tok.token_type ?? 'Bearer',
      scope: tok.scope ?? null,
      expires_at: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000).toISOString() : null,
      disconnected_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    // Best-effort: register a webhook subscription so new/cancelled bookings push
    // live. Never block the connect on this — manual sync is the fallback.
    try {
      const whUri = await createWebhookSubscription(tok.access_token, userUri, orgUri)
      if (whUri) {
        await sb.from('calendly_connections')
          .update({ webhook_uri: whUri, updated_at: new Date().toISOString() })
          .eq('user_id', uid)
      }
    } catch (e) { log.warn({ err: e }, 'webhook subscription step failed (manual sync available)') }

    // Redirect back to the user's dashboard.
    const { data: prof } = await sb.from('profiles').select('role').eq('id', uid).maybeSingle()
    const dash = prof?.role === 'manager' ? 'manager' : prof?.role === 'sponsor' ? 'sponsor' : prof?.role === 'admin' ? 'admin' : 'fighter'
    res.redirect(`${CLIENT}/dashboard/${dash}?calendly=connected`)
  } catch (err) {
    log.error({ err }, 'GET /calendly/oauth/callback threw')
    return fail('server_error')
  }
})

// ── POST /api/calendly/disconnect ─────────────────────────────────────────────
router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    const sb   = adminSupabase
    const conn = await activeConnection(req.user.id)

    // Best-effort: tear down the webhook subscription while we still hold a token.
    if (conn?.webhook_uri && conn.access_token_encrypted) {
      try {
        const token = await getValidAccessToken(conn)
        await deleteWebhookSubscription(token, conn.webhook_uri)
      } catch (e) { log.warn({ err: e }, 'could not delete webhook subscription on disconnect') }
    }

    await sb.from('calendly_connections').update({
      access_token_encrypted: null, refresh_token_encrypted: null, webhook_uri: null,
      disconnected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('user_id', req.user.id)
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'POST /calendly/disconnect threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/calendly/event-types ─────────────────────────────────────────────
router.get('/event-types', requireAuth, async (req, res) => {
  try {
    const conn = await activeConnection(req.user.id)
    if (!conn) return res.status(409).json({ error: 'Calendly is not connected.' })
    const token = await getValidAccessToken(conn)
    if (!conn.calendly_user_uri) return res.json({ event_types: [] })

    const data = await calendlyApi(token, `/event_types?user=${encodeURIComponent(conn.calendly_user_uri)}&count=50`)
    res.json({
      event_types: (data?.collection ?? []).map(t => ({
        uri: t.uri, name: t.name, scheduling_url: t.scheduling_url, duration: t.duration, active: t.active,
      })),
    })
  } catch (err) {
    log.error({ err }, 'GET /calendly/event-types threw')
    res.status(500).json({ error: err.message })
  }
})

// Map a Calendly scheduled event to an Event Calendar event row.
function calendlyLocation(loc) {
  if (!loc) return null
  if (typeof loc === 'string') return loc
  return loc.location || loc.type || (loc.join_url ? 'Video call' : null)
}

// ── POST /api/calendly/sync ───────────────────────────────────────────────────
// Pulls upcoming scheduled events into Event Calendar (idempotent upsert).
router.post('/sync', requireAuth, async (req, res) => {
  try {
    const sb   = adminSupabase
    const uid  = req.user.id
    const conn = await activeConnection(uid)
    if (!conn) return res.status(409).json({ error: 'Calendly is not connected.' })
    if (!conn.calendly_user_uri) return res.status(409).json({ error: 'Calendly account info unavailable — reconnect.' })

    const token = await getValidAccessToken(conn)
    const minStart = new Date(Date.now() - 24 * 3600_000).toISOString()

    // Active + canceled (so cancellations reflect on re-sync).
    const [active, canceled] = await Promise.all([
      calendlyApi(token, `/scheduled_events?user=${encodeURIComponent(conn.calendly_user_uri)}&status=active&min_start_time=${minStart}&count=50&sort=start_time:asc`).catch(() => ({ collection: [] })),
      calendlyApi(token, `/scheduled_events?user=${encodeURIComponent(conn.calendly_user_uri)}&status=canceled&min_start_time=${minStart}&count=50&sort=start_time:asc`).catch(() => ({ collection: [] })),
    ])

    let imported = 0, updated = 0, canceledCount = 0
    const now = new Date().toISOString()

    const upsertEvent = async (ce, status) => {
      const { data: existing } = await sb.from('calendly_synced_events')
        .select('id, event_id').eq('user_id', uid).eq('calendly_event_uri', ce.uri).maybeSingle()

      const evStatus = status === 'canceled' ? 'cancelled' : 'planned'
      const eventFields = {
        name:        ce.name || 'Calendly Meeting',
        event_type:  'other',
        event_date:  ce.start_time,
        location:    calendlyLocation(ce.location),
        external_url: (ce.location && ce.location.join_url) ? ce.location.join_url : (conn.scheduling_url ?? null),
        status:      evStatus,
        source:      'calendly',
        owner_id:    uid,
        created_by:  uid,
        updated_at:  now,
      }

      if (existing?.event_id) {
        await sb.from('events').update(eventFields).eq('id', existing.event_id)
        await sb.from('calendly_synced_events').update({
          status, start_time: ce.start_time, end_time: ce.end_time, name: ce.name,
          location: calendlyLocation(ce.location), raw_payload: ce, updated_at: now,
        }).eq('id', existing.id)
        if (status === 'canceled') canceledCount++; else updated++
      } else {
        const { data: ev } = await sb.from('events').insert(eventFields).select('id').maybeSingle()
        await sb.from('calendly_synced_events').upsert({
          user_id: uid, event_id: ev?.id ?? null, calendly_event_uri: ce.uri,
          status, start_time: ce.start_time, end_time: ce.end_time, name: ce.name,
          location: calendlyLocation(ce.location), raw_payload: ce,
        }, { onConflict: 'user_id,calendly_event_uri' })
        if (status === 'canceled') canceledCount++; else imported++
      }
    }

    for (const ce of (active?.collection ?? []))   await upsertEvent(ce, 'active')
    for (const ce of (canceled?.collection ?? [])) await upsertEvent(ce, 'canceled')

    await sb.from('calendly_connections').update({ last_synced_at: now, updated_at: now }).eq('id', conn.id)

    log.info({ uid, imported, updated, canceledCount }, 'Calendly sync complete')
    res.json({ ok: true, imported, updated, canceled: canceledCount })
  } catch (err) {
    log.error({ err }, 'POST /calendly/sync threw')
    res.status(500).json({ error: err.message })
  }
})

export default router
