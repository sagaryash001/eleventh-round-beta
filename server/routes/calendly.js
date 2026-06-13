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

// ── Scope / capability detection ──────────────────────────────────────────────
// The stored token scope (when Calendly returns one) is a space/comma-separated
// string. Calendly does NOT always populate it, so capability flags are OPTIMISTIC
// when the scope is unknown — the write routes still handle a 403 cleanly. This
// avoids hiding a button that would actually work, while never crashing.
function scopeList(conn) {
  return (conn?.scope || '').split(/[\s,]+/).filter(Boolean)
}
function hasAnyScope(conn, ...needed) {
  const list = scopeList(conn)
  if (!list.length) return null              // unknown
  return needed.some(n => list.includes(n))
}
function canCreateLinks(conn) { const h = hasAnyScope(conn, 'scheduling_links:write', 'shares:write'); return h === null ? true : h }
function canCancelEvents(conn) { const h = hasAnyScope(conn, 'scheduled_events:write'); return h === null ? true : h }

// POST helper returning a structured result so callers can map Calendly's
// plan/scope failures (402/403) to a clean user-facing message.
async function calendlyPost(token, urlOrPath, body) {
  const url = urlOrPath.startsWith('http') ? urlOrPath : `${API_BASE}${urlOrPath}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  let json = null
  const text = await res.text().catch(() => '')
  try { json = text ? JSON.parse(text) : null } catch { /* non-JSON */ }
  return { ok: res.ok, status: res.status, json, text }
}

// Can the requesting user manage this app event? (creator / owner / manager /
// promoter / admin, or a manager of the roster fighter who owns it.) Self-
// contained here to avoid a circular import with routes/events.js.
async function canManageEvent(user, ev) {
  if (!ev) return false
  if (user.role === 'admin') return true
  if ([ev.created_by, ev.owner_id, ev.manager_id, ev.promoter_id].includes(user.id)) return true
  if (user.role === 'manager' && ev.owner_id) {
    const { data } = await adminSupabase
      .from('manager_fighters').select('fighter_id')
      .eq('manager_id', user.id).eq('status', 'active')
    if ((data ?? []).some(r => r.fighter_id === ev.owner_id)) return true
  }
  return false
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
      // webhook_uri present → Calendly pushes new/cancelled bookings live.
      auto_sync:           !!conn.webhook_uri,   // kept for back-compat
      manual_sync_enabled: true,
      auto_sync_active:    !!conn.webhook_uri,
      can_create_scheduling_links: canCreateLinks(conn),
      can_cancel_events:           canCancelEvents(conn),
      scopes: scopeList(conn),
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

// ── Core sync routine (shared by POST /sync and maybeAutoSync) ────────────────
// Pulls active + canceled scheduled events into Event Calendar (idempotent upsert
// keyed on calendly_event_uri). Throws on hard failure; callers decide how loud.
async function runSyncForUser(uid) {
  const sb   = adminSupabase
  const conn = await activeConnection(uid)
  if (!conn) { const e = new Error('Calendly is not connected.'); e.code = 409; throw e }
  if (!conn.calendly_user_uri) { const e = new Error('Calendly account info unavailable — reconnect.'); e.code = 409; throw e }

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
  return { imported, updated, canceled: canceledCount }
}

// Best-effort background sync used by the calendar-feed endpoint so Calendly
// "feels automatic" without spamming the API: only runs when connected AND the
// last sync is older than `maxAgeMs` (default 8 min). Never throws — a failure
// here must never break a dashboard load (manual "Sync Calendly" is the fallback).
// Returns true if a sync actually ran.
export async function maybeAutoSync(uid, maxAgeMs = 8 * 60_000) {
  try {
    const conn = await activeConnection(uid)
    if (!conn || !conn.calendly_user_uri) return false
    const last = conn.last_synced_at ? new Date(conn.last_synced_at).getTime() : 0
    if (last && (Date.now() - last) < maxAgeMs) return false   // still fresh
    await runSyncForUser(uid)
    return true
  } catch (err) {
    log.warn({ err, uid }, 'Calendly auto-sync failed (non-fatal)')
    return false
  }
}

// ── POST /api/calendly/sync ───────────────────────────────────────────────────
// Manual sync — always forces a fresh pull regardless of freshness window.
router.post('/sync', requireAuth, async (req, res) => {
  try {
    const r = await runSyncForUser(req.user.id)
    res.json({ ok: true, ...r })
  } catch (err) {
    if (err.code === 409) return res.status(409).json({ error: err.message })
    log.error({ err }, 'POST /calendly/sync threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/calendly/scheduling-links ───────────────────────────────────────
// Create a Calendly scheduling link for one of the connected user's event types
// and attach the resulting booking URL to an app event. Uses the requester's own
// Calendly token (server-side). Requires scheduling_links:write on the account.
router.post('/scheduling-links', requireAuth, async (req, res) => {
  try {
    const sb  = adminSupabase
    const uid = req.user.id
    const { event_id, calendly_event_type_uri, max_event_count, single_use } = req.body || {}

    if (!event_id || !calendly_event_type_uri) {
      return res.status(400).json({ error: 'event_id and calendly_event_type_uri are required.' })
    }

    // Permission: the requester must be able to manage the target app event.
    const { data: ev } = await sb.from('events').select('*').eq('id', event_id).maybeSingle()
    if (!ev) return res.status(404).json({ error: 'Event not found.' })
    if (!(await canManageEvent(req.user, ev))) {
      return res.status(403).json({ error: 'You cannot create a booking link for this event.' })
    }

    const conn = await activeConnection(uid)
    if (!conn) return res.status(409).json({ error: 'Calendly is not connected.' })

    // Verify the event type belongs to this account (never trust a raw URI alone).
    const token = await getValidAccessToken(conn)
    let owned = true
    try {
      const list = await calendlyApi(token, `/event_types?user=${encodeURIComponent(conn.calendly_user_uri)}&count=100`)
      owned = (list?.collection ?? []).some(t => t.uri === calendly_event_type_uri)
    } catch { owned = true /* don't block on listing failure; create still authorizes */ }
    if (!owned) return res.status(400).json({ error: 'That event type is not on your Calendly account.' })

    // Calendly /scheduling_links: owner = event type URI, owner_type = "EventType".
    // single_use → max_event_count 1; otherwise honour a provided count (1–1000).
    const count = single_use ? 1 : Math.min(Math.max(parseInt(max_event_count, 10) || 1, 1), 1000)
    const r = await calendlyPost(token, '/scheduling_links', {
      max_event_count: count,
      owner: calendly_event_type_uri,
      owner_type: 'EventType',
    })

    if (!r.ok) {
      // 402 (plan) / 403 (scope) → clean, actionable message; never a stack/dump.
      if (r.status === 402 || r.status === 403) {
        return res.status(403).json({ error: 'Calendly could not create a booking link for this account. Check Calendly permissions or plan.' })
      }
      log.warn({ status: r.status, body: (r.text || '').slice(0, 300) }, 'scheduling_links create failed')
      return res.status(502).json({ error: 'Calendly could not create a booking link right now.' })
    }

    const bookingUrl = r.json?.resource?.booking_url ?? null
    if (!bookingUrl) return res.status(502).json({ error: 'Calendly returned no booking link.' })

    await sb.from('events').update({
      calendly_scheduling_url: bookingUrl,
      calendly_event_type_uri: calendly_event_type_uri,
      updated_at: new Date().toISOString(),
    }).eq('id', ev.id)

    log.info({ uid, event_id, count }, 'Calendly scheduling link created')
    res.status(201).json({ ok: true, booking_url: bookingUrl })
  } catch (err) {
    log.error({ err }, 'POST /calendly/scheduling-links threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/calendly/events/:syncedEventId/cancel ───────────────────────────
// Cancel a synced Calendly meeting. Cancellation is performed with the token of
// the account that OWNS the meeting (the connected user_id on the synced row),
// using the STORED calendly_event_uri — never a URI from the request body.
// Requires scheduled_events:write on that account.
router.post('/events/:syncedEventId/cancel', requireAuth, async (req, res) => {
  try {
    const sb     = adminSupabase
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : undefined

    const { data: synced } = await sb.from('calendly_synced_events').select('*').eq('id', req.params.syncedEventId).maybeSingle()
    if (!synced) return res.status(404).json({ error: 'Calendly meeting not found.' })
    if (!synced.calendly_event_uri) return res.status(409).json({ error: 'This meeting has no Calendly reference to cancel.' })

    const { data: ev } = synced.event_id
      ? await sb.from('events').select('*').eq('id', synced.event_id).maybeSingle()
      : { data: null }

    // Permission: the synced event's own user, or a manager/owner of the app event.
    const isOwner = synced.user_id === req.user.id
    if (!isOwner && !(await canManageEvent(req.user, ev))) {
      return res.status(403).json({ error: 'You cannot cancel this Calendly meeting.' })
    }
    if (synced.status === 'canceled') return res.json({ ok: true, already: true })

    // Cancel via the meeting OWNER's Calendly token.
    const conn = await activeConnection(synced.user_id)
    if (!conn) return res.status(409).json({ error: 'The Calendly account for this meeting is no longer connected.' })
    const token = await getValidAccessToken(conn)

    const r = await calendlyPost(token, `${synced.calendly_event_uri}/cancellation`, reason ? { reason } : {})
    if (!r.ok) {
      if (r.status === 402 || r.status === 403) {
        return res.status(403).json({ error: 'This Calendly account does not allow this action. Check Calendly permissions or plan.' })
      }
      if (r.status === 404) return res.status(404).json({ error: 'This meeting was not found on Calendly (it may already be cancelled).' })
      log.warn({ status: r.status, body: (r.text || '').slice(0, 300) }, 'Calendly cancellation failed')
      return res.status(502).json({ error: 'Calendly could not cancel this meeting right now.' })
    }

    const now = new Date().toISOString()
    await sb.from('calendly_synced_events').update({ status: 'canceled', raw_payload: { ...(synced.raw_payload || {}), cancelled_via: 'app', reason: reason ?? null }, updated_at: now }).eq('id', synced.id)
    if (synced.event_id) await sb.from('events').update({ status: 'cancelled', updated_at: now }).eq('id', synced.event_id)

    log.info({ by: req.user.id, syncedEventId: synced.id }, 'Calendly meeting cancelled from app')
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'POST /calendly/events/:syncedEventId/cancel threw')
    res.status(500).json({ error: err.message })
  }
})

export default router
