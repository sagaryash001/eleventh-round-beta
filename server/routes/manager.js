// ─────────────────────────────────────────────────────────────────────────────
// Manager routes — all protected by requireAuth + requireManager
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express'
import { adminSupabase } from '../db/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { validate,
  ManagerInviteSchema, PendingFighterCreateSchema, PendingProfileEmailSchema,
  ManagerConnectionStatusSchema, ManagerFighterProfileUpdateSchema,
} from '../lib/validate.js'
import { activateConnection, clearManagerLink } from '../lib/roster.js'
import { childLogger } from '../lib/logger.js'

const router = Router()
const log    = childLogger('manager')

// Minimum gap between resends of the same invite — prevents accidental spam.
const RESEND_COOLDOWN_MS = 60 * 1000

function requireManager(req, res, next) {
  if (!['manager', 'admin'].includes(req.user?.role))
    return res.status(403).json({ error: 'Manager access required.' })
  next()
}

const guard = [requireAuth, requireManager]

function pick(obj, keys) {
  const out = {}
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k]
  return out
}

// ── Shared helper: fetch active fighter_ids for a manager ─────────────────────
async function activeFighterIds(managerId) {
  const { data } = await adminSupabase
    .from('manager_fighters')
    .select('fighter_id')
    .eq('manager_id', managerId)
    .eq('status', 'active')
    .not('fighter_id', 'is', null)
  return (data ?? []).map(l => l.fighter_id)
}

// ═════════════════════════════════════════════════════════════════════════════
// OVERVIEW + DASHBOARD (unchanged logic, status filter added)
// ═════════════════════════════════════════════════════════════════════════════

router.get('/overview', ...guard, async (req, res) => {
  try {
    const sb  = adminSupabase
    const mid = req.user.id

    const [fids, { data: pendingConns }] = await Promise.all([
      activeFighterIds(mid),
      sb.from('manager_fighters').select('id, source').eq('manager_id', mid).eq('status', 'pending'),
    ])
    const pendingRequests = (pendingConns ?? []).filter(c => c.source === 'fighter_request').length
    const pendingInvites  = (pendingConns ?? []).length

    if (!fids.length) {
      return res.json({ active_roster: 0, overdue_obligations: 0, sf_ready: 0, roster_health: 0,
        roster_chart: [], fulfillment_trend: [], action_items: [],
        pending_invites: pendingInvites, pending_requests: pendingRequests })
    }

    const [{ data: readiness }, { data: obs }, { data: sf }] = await Promise.all([
      sb.from('readiness_scores').select('user_id, overall').in('user_id', fids),
      sb.from('obligations').select('owner_id, status, title, due_date').in('owner_id', fids),
      sb.from('sponsorforge_profiles').select('user_id, eligibility_score, is_locked').in('user_id', fids),
    ])

    const avgReadiness = readiness?.length
      ? Math.round(readiness.reduce((s, r) => s + r.overall, 0) / readiness.length) : 0
    const overdue  = (obs ?? []).filter(o => o.status === 'overdue').length
    const sfReady  = (sf ?? []).filter(s => !s.is_locked).length

    const { data: profiles } = await sb.from('profiles').select('id, name').in('id', fids)
    const nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.name]))
    const rsMap   = Object.fromEntries((readiness ?? []).map(r => [r.user_id, r.overall]))

    const rosterChart = fids.map(fid => {
      const score = rsMap[fid] ?? 0
      return { label: (nameMap[fid] ?? 'Fighter').split(' ')[0], value: score,
        color: score >= 80 ? '#00c060' : score >= 60 ? '#c9a82c' : '#c00000' }
    })

    const actionItems = (obs ?? []).filter(o => o.status === 'overdue').slice(0, 4)
      .map(o => ({ name: `${nameMap[o.owner_id] ?? 'Fighter'} — ${o.title}`, badge: 'Act Now', type: 'red' }))

    res.json({ active_roster: fids.length, overdue_obligations: overdue, sf_ready: sfReady,
      roster_health: avgReadiness, roster_chart: rosterChart, fulfillment_trend: [], action_items: actionItems,
      pending_invites: pendingInvites, pending_requests: pendingRequests })
  } catch (err) {
    log.error({ err }, '/manager/overview threw')
    res.status(500).json({ error: err.message })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// ROSTER — full connection list (pending + active + declined)
// ═════════════════════════════════════════════════════════════════════════════

router.get('/roster', ...guard, async (req, res) => {
  try {
    const sb  = adminSupabase
    const mid = req.user.id

    // All non-removed connections for this manager
    const { data: connections, error: connErr } = await sb
      .from('manager_fighters')
      .select('id, fighter_id, status, source, invited_email, invited_name, pending_fighter_data, requested_by, request_message, team_name, created_at, accepted_at, declined_at')
      .eq('manager_id', mid)
      .neq('status', 'removed')
      .order('created_at', { ascending: false })
    if (connErr) throw connErr

    const activeFids = (connections ?? [])
      .filter(c => c.status === 'active' && c.fighter_id)
      .map(c => c.fighter_id)

    // Batch-fetch fighter data only for active connections
    const [{ data: profiles }, { data: fps }, { data: readiness }] = activeFids.length > 0
      ? await Promise.all([
          sb.from('profiles').select('id, name, email, status').in('id', activeFids),
          sb.from('fighter_profiles').select('user_id, division, weight_class, record_wins, record_losses, record_draws, base_city, gym_name, coach_name').in('user_id', activeFids),
          sb.from('readiness_scores').select('user_id, overall').in('user_id', activeFids),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }]

    const prMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
    const fpMap = Object.fromEntries((fps ?? []).map(f => [f.user_id, f]))
    const rsMap = Object.fromEntries((readiness ?? []).map(r => [r.user_id, r]))

    const roster = (connections ?? []).map(c => {
      const fid = c.fighter_id
      return {
        id:                   c.id,
        status:               c.status,
        source:               c.source,
        fighter_id:           fid,
        invited_email:        c.invited_email,
        invited_name:         c.invited_name,
        pending_fighter_data: c.pending_fighter_data ?? {},
        requested_by:         c.requested_by,
        request_message:      c.request_message,
        team_name:            c.team_name,
        created_at:           c.created_at,
        accepted_at:          c.accepted_at,
        declined_at:          c.declined_at,
        fighter: fid && prMap[fid] ? {
          id:           fid,
          name:         prMap[fid].name,
          email:        prMap[fid].email,
          division:     fpMap[fid]?.division     ?? null,
          weight_class: fpMap[fid]?.weight_class ?? null,
          record_wins:  fpMap[fid]?.record_wins  ?? 0,
          record_losses:fpMap[fid]?.record_losses ?? 0,
          record_draws: fpMap[fid]?.record_draws  ?? 0,
          base_city:    fpMap[fid]?.base_city    ?? null,
          gym_name:     fpMap[fid]?.gym_name     ?? null,
          coach_name:   fpMap[fid]?.coach_name   ?? null,
          readiness:    rsMap[fid]?.overall      ?? 0,
        } : null,
      }
    })

    res.json({ roster })
  } catch (err) {
    log.error({ err }, '/manager/roster threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/manager/roster/invite ──────────────────────────────────────────
router.post('/roster/invite', ...guard, validate(ManagerInviteSchema), async (req, res) => {
  try {
    const mid = req.user.id
    const { email, name, message } = req.valid
    const now = new Date().toISOString()

    // Look up whether a fighter account exists with this email
    const { data: existingUser } = await adminSupabase
      .from('profiles')
      .select('id, role')
      .eq('email', email)
      .eq('role', 'fighter')
      .maybeSingle()

    if (existingUser) {
      // Check for existing connection row
      const { data: existing } = await adminSupabase
        .from('manager_fighters')
        .select('id, status')
        .eq('manager_id', mid)
        .eq('fighter_id', existingUser.id)
        .maybeSingle()

      if (existing?.status === 'active') {
        return res.status(409).json({ error: 'This fighter is already on your active roster.' })
      }
      if (existing?.status === 'pending') {
        return res.status(409).json({ error: 'A pending invite for this fighter already exists.' })
      }

      if (existing) {
        // Re-invite after removal/decline
        const { error } = await adminSupabase.from('manager_fighters')
          .update({ status: 'pending', source: 'manager_invite', invited_name: name ?? null,
            request_message: message ?? null, requested_by: mid, declined_at: null, removed_at: null, updated_at: now })
          .eq('id', existing.id)
        if (error) throw error
        adminSupabase.from('outbox_events').insert({ event_type: 'manager.roster_invite', aggregate_type: 'manager_fighters', aggregate_id: existing.id, payload: { fighter_id: existingUser.id, invited_email: email, invited_name: name ?? null, manager_id: mid, message: message ?? null } }).then(() => {}).catch(() => {})
        log.info({ mid, fid: existingUser.id, connectionId: existing.id, route: 'existing-user-reinvite' }, 'roster invite (existing fighter)')
        return res.json({ ok: true, connection_id: existing.id, matched: true })
      }

      const { data, error } = await adminSupabase.from('manager_fighters')
        .insert({ manager_id: mid, fighter_id: existingUser.id, status: 'pending',
          source: 'manager_invite', invited_name: name ?? null,
          request_message: message ?? null, requested_by: mid })
        .select('id').maybeSingle()
      if (error) throw error
      adminSupabase.from('outbox_events').insert({ event_type: 'manager.roster_invite', aggregate_type: 'manager_fighters', aggregate_id: data.id, payload: { fighter_id: existingUser.id, invited_email: email, invited_name: name ?? null, manager_id: mid, message: message ?? null } }).then(() => {}).catch(() => {})
      log.info({ mid, fid: existingUser.id, connectionId: data.id, route: 'existing-user-new' }, 'roster invite (existing fighter)')
      return res.status(201).json({ ok: true, connection_id: data.id, matched: true })
    }

    // Fighter does not have an account — invite by email
    const { data: existingEmail } = await adminSupabase
      .from('manager_fighters')
      .select('id, status')
      .eq('manager_id', mid)
      .eq('invited_email', email)
      .maybeSingle()

    if (existingEmail?.status === 'pending') {
      return res.status(409).json({ error: 'A pending invite to this email already exists.' })
    }

    if (existingEmail) {
      const { error } = await adminSupabase.from('manager_fighters')
        .update({ status: 'pending', invited_name: name ?? null,
          request_message: message ?? null, updated_at: now })
        .eq('id', existingEmail.id)
      if (error) throw error
      adminSupabase.from('outbox_events').insert({ event_type: 'manager.roster_invite', aggregate_type: 'manager_fighters', aggregate_id: existingEmail.id, payload: { invited_email: email, invited_name: name ?? null, manager_id: mid, message: message ?? null } }).then(() => {}).catch(() => {})
      log.info({ mid, email, connectionId: existingEmail.id, route: 'email-invite-reuse' }, 'roster invite (non-platform)')
      return res.json({ ok: true, connection_id: existingEmail.id, matched: false })
    }

    const { data, error } = await adminSupabase.from('manager_fighters')
      .insert({ manager_id: mid, fighter_id: null, status: 'pending',
        source: 'manager_invite', invited_email: email, invited_name: name ?? null,
        request_message: message ?? null, requested_by: mid })
      .select('id').maybeSingle()
    if (error) throw error
    adminSupabase.from('outbox_events').insert({ event_type: 'manager.roster_invite', aggregate_type: 'manager_fighters', aggregate_id: data.id, payload: { invited_email: email, invited_name: name ?? null, manager_id: mid, message: message ?? null } }).then(() => {}).catch(() => {})
    log.info({ mid, email, connectionId: data.id, route: 'email-invite-new' }, 'roster invite (non-platform)')
    return res.status(201).json({ ok: true, connection_id: data.id, matched: false })
  } catch (err) {
    log.error({ err }, 'POST /manager/roster/invite threw')
    res.status(500).json({ error: err.message })
  }
})

// Build the manager-entered profile blob (stored as JSONB).
function buildPendingProfileData(p) {
  return {
    name:          p.name,
    sport:         p.sport,
    weight_class:  p.weight_class  ?? null,
    record_wins:   p.record_wins,
    record_losses: p.record_losses,
    record_draws:  p.record_draws,
    base_city:     p.base_city     ?? null,
    notes:         p.notes         ?? null,
  }
}

// ── POST /api/manager/roster/create-pending ───────────────────────────────────
// MANAGER-ONLY DRAFT PROFILE. This is NOT an invite: it creates no auth user,
// sends no email, emits no outbox event, and creates no notification. The fighter
// never sees it (fighter_id is null) until the manager later converts it to an
// invite via /roster/:id/invite-email.
router.post('/roster/create-pending', ...guard, validate(PendingFighterCreateSchema), async (req, res) => {
  try {
    const mid = req.user.id
    const p   = req.valid

    const { data, error } = await adminSupabase.from('manager_fighters')
      .insert({
        manager_id:           mid,
        fighter_id:           null,
        invited_email:        null,            // explicitly no email — this is a draft, not an invite
        status:               'pending',
        source:               'draft_profile', // distinct from 'manager_invite' so the UI can separate it
        invited_name:         p.name,
        pending_fighter_data: buildPendingProfileData(p),
      })
      .select('id').maybeSingle()
    if (error) throw error

    log.info({ connectionId: data.id, mid, name: p.name }, 'draft profile created (manager-only, no email/notification/user)')
    res.status(201).json({ ok: true, connection_id: data.id })
  } catch (err) {
    log.error({ err }, 'POST /manager/roster/create-pending threw')
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/manager/roster/:connectionId/pending-profile ───────────────────
// Edit a manager-only draft profile's details. Draft rows only.
router.patch('/roster/:connectionId/pending-profile', ...guard, validate(PendingFighterCreateSchema), async (req, res) => {
  try {
    const mid = req.user.id
    const p   = req.valid

    const { data: conn } = await adminSupabase.from('manager_fighters')
      .select('id, source, fighter_id, status')
      .eq('id', req.params.connectionId).eq('manager_id', mid).maybeSingle()
    if (!conn) return res.status(404).json({ error: 'Draft profile not found.' })
    if (conn.source !== 'draft_profile' || conn.fighter_id) {
      return res.status(400).json({ error: 'Only manager-only draft profiles can be edited here.' })
    }

    const { error } = await adminSupabase.from('manager_fighters')
      .update({ invited_name: p.name, pending_fighter_data: buildPendingProfileData(p), updated_at: new Date().toISOString() })
      .eq('id', conn.id)
    if (error) throw error

    log.info({ connectionId: conn.id, mid }, 'draft profile updated')
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /manager/roster/:id/pending-profile threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/manager/roster/:connectionId/invite-email ───────────────────────
// Convert a manager-only draft profile into a real invite. Reuses the invite
// routing: existing platform fighter → in-app notification (no email); unknown
// email → email invite. Preserves the manager-entered profile data; never
// duplicates a roster row.
router.post('/roster/:connectionId/invite-email', ...guard, validate(PendingProfileEmailSchema), async (req, res) => {
  try {
    const mid   = req.user.id
    const email = req.valid.email
    const now   = new Date().toISOString()

    const { data: conn } = await adminSupabase.from('manager_fighters')
      .select('id, source, fighter_id, status, invited_name')
      .eq('id', req.params.connectionId).eq('manager_id', mid).maybeSingle()
    if (!conn) return res.status(404).json({ error: 'Draft profile not found.' })
    if (conn.status === 'active') return res.status(400).json({ error: 'This fighter is already active on your roster.' })
    if (conn.source !== 'draft_profile' || conn.fighter_id) {
      return res.status(400).json({ error: 'This roster entry is not a draft profile.' })
    }

    // Does a platform user already own this email?
    const { data: existingUser } = await adminSupabase
      .from('profiles').select('id, role').eq('email', email).maybeSingle()

    if (existingUser && existingUser.role !== 'fighter') {
      return res.status(400).json({ error: 'That email belongs to a non-fighter account.' })
    }

    if (existingUser) {
      // Guard against duplicating an existing manager↔fighter row.
      const { data: dupe } = await adminSupabase.from('manager_fighters')
        .select('id, status').eq('manager_id', mid).eq('fighter_id', existingUser.id).neq('id', conn.id).maybeSingle()
      if (dupe?.status === 'active')  return res.status(409).json({ error: 'This fighter is already on your active roster.' })
      if (dupe?.status === 'pending') return res.status(409).json({ error: 'A pending invite for this fighter already exists.' })
      if (dupe) {
        // A declined/removed row exists — re-use it and drop the draft to satisfy the unique (manager_id, fighter_id) index.
        await adminSupabase.from('manager_fighters')
          .update({ status: 'pending', source: 'manager_invite', invited_email: email, requested_by: mid, declined_at: null, removed_at: null, updated_at: now })
          .eq('id', dupe.id)
        await adminSupabase.from('manager_fighters').update({ status: 'removed', removed_at: now, updated_at: now }).eq('id', conn.id)
        adminSupabase.from('outbox_events').insert({ event_type: 'manager.roster_invite', aggregate_type: 'manager_fighters', aggregate_id: dupe.id, payload: { fighter_id: existingUser.id, invited_email: email, invited_name: conn.invited_name, manager_id: mid } }).then(() => {}).catch(() => {})
        log.info({ mid, fid: existingUser.id, connectionId: dupe.id, draftId: conn.id, route: 'convert-existing-merge' }, 'draft converted to invite (existing fighter, merged)')
        return res.json({ ok: true, connection_id: dupe.id, matched: true })
      }

      // Link the draft row to the existing fighter and invite them in-app.
      const { error } = await adminSupabase.from('manager_fighters')
        .update({ fighter_id: existingUser.id, source: 'manager_invite', invited_email: email, requested_by: mid, updated_at: now })
        .eq('id', conn.id)
      if (error) throw error
      adminSupabase.from('outbox_events').insert({ event_type: 'manager.roster_invite', aggregate_type: 'manager_fighters', aggregate_id: conn.id, payload: { fighter_id: existingUser.id, invited_email: email, invited_name: conn.invited_name, manager_id: mid } }).then(() => {}).catch(() => {})
      log.info({ mid, fid: existingUser.id, connectionId: conn.id, route: 'convert-existing' }, 'draft converted to invite (existing fighter)')
      return res.json({ ok: true, connection_id: conn.id, matched: true })
    }

    // No platform account — convert to an email invite (non-platform).
    const { error } = await adminSupabase.from('manager_fighters')
      .update({ source: 'manager_invite', invited_email: email, requested_by: mid, updated_at: now })
      .eq('id', conn.id)
    if (error) throw error
    adminSupabase.from('outbox_events').insert({ event_type: 'manager.roster_invite', aggregate_type: 'manager_fighters', aggregate_id: conn.id, payload: { invited_email: email, invited_name: conn.invited_name, manager_id: mid } }).then(() => {}).catch(() => {})
    log.info({ mid, email, connectionId: conn.id, route: 'convert-email' }, 'draft converted to invite (non-platform)')
    res.json({ ok: true, connection_id: conn.id, matched: false })
  } catch (err) {
    log.error({ err }, 'POST /manager/roster/:id/invite-email threw')
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/manager/roster/:connectionId/status ────────────────────────────
router.patch('/roster/:connectionId/status', ...guard, validate(ManagerConnectionStatusSchema), async (req, res) => {
  try {
    const mid = req.user.id
    const { status } = req.valid
    const now = new Date().toISOString()

    const { data: conn, error: findErr } = await adminSupabase
      .from('manager_fighters')
      .select('id, status, source, fighter_id')
      .eq('id', req.params.connectionId)
      .eq('manager_id', mid)
      .maybeSingle()
    if (findErr) throw findErr
    if (!conn)   return res.status(404).json({ error: 'Connection not found.' })

    // ── Activate (only fighter-requested rows; manager invites need fighter consent) ──
    if (status === 'active') {
      if (conn.source !== 'fighter_request') {
        return res.status(400).json({
          error: 'This invite must be accepted by the fighter, not activated by the manager.',
        })
      }
      // Shared helper enforces the one-manager rule + profile link + sibling decline.
      const result = await activateConnection(adminSupabase, { conn, managerId: mid, fighterId: conn.fighter_id })
      if (result.error) return res.status(result.status).json({ error: result.error })
      // Notify the fighter that the manager accepted their request.
      adminSupabase.from('outbox_events').insert({
        event_type: 'roster.request_accepted', aggregate_type: 'manager_fighters', aggregate_id: conn.id,
        payload: { manager_id: mid, fighter_id: conn.fighter_id },
      }).then(() => {}).catch(() => {})
      log.info({ connectionId: conn.id, mid, fid: conn.fighter_id, status: 'active' }, 'manager accepted fighter request')
      return res.json({ ok: true })
    }

    const updates = { status, updated_at: now }
    if (status === 'declined') updates.declined_at = now
    if (status === 'removed')  updates.removed_at  = now

    const { error } = await adminSupabase.from('manager_fighters')
      .update(updates).eq('id', conn.id)
    if (error) throw error

    // Leaving an active relationship unlinks the fighter profile.
    if ((status === 'removed' || status === 'declined') && conn.status === 'active') {
      await clearManagerLink(adminSupabase, conn.fighter_id, mid)
    }

    log.info({ connectionId: conn.id, mid, fid: conn.fighter_id, status }, 'connection status updated')
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /manager/roster/:id/status threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/manager/roster/:connectionId/resend ─────────────────────────────
// Re-send a declined or still-pending invite. Resets the row to pending, bumps
// the timestamp, and re-emits the outbox notification. A short cooldown prevents
// rapid double-sends. Cannot resend an already-active connection.
router.post('/roster/:connectionId/resend', ...guard, async (req, res) => {
  try {
    const mid = req.user.id
    const now = new Date().toISOString()

    const { data: conn, error: findErr } = await adminSupabase
      .from('manager_fighters')
      .select('id, status, source, fighter_id, invited_email, invited_name, updated_at')
      .eq('id', req.params.connectionId)
      .eq('manager_id', mid)
      .maybeSingle()
    if (findErr) throw findErr
    if (!conn) return res.status(404).json({ error: 'Connection not found.' })

    if (conn.status === 'active') {
      return res.status(400).json({ error: 'This fighter is already active on your roster.' })
    }
    if (conn.source === 'fighter_request') {
      return res.status(400).json({ error: 'This is a fighter request — accept or decline it instead of resending.' })
    }
    if (conn.source === 'draft_profile' || (!conn.invited_email && !conn.fighter_id)) {
      return res.status(400).json({ error: 'Add an email to this draft profile before sending an invite.' })
    }
    // Cooldown: only throttle invites that are already pending (a declined invite
    // should always be resendable regardless of when it was declined).
    if (conn.status === 'pending' && conn.updated_at &&
        Date.now() - new Date(conn.updated_at).getTime() < RESEND_COOLDOWN_MS) {
      return res.status(429).json({ error: 'Invite was just sent. Please wait a moment before resending.' })
    }

    const { error } = await adminSupabase.from('manager_fighters')
      .update({ status: 'pending', declined_at: null, updated_at: now })
      .eq('id', conn.id)
    if (error) throw error

    const { error: outboxErr } = await adminSupabase.from('outbox_events').insert({
      event_type:     'manager.roster_invite',
      aggregate_type: 'manager_fighters',
      aggregate_id:   conn.id,
      payload: { invited_email: conn.invited_email, invited_name: conn.invited_name, fighter_id: conn.fighter_id, manager_id: mid, resend: true },
    })
    if (outboxErr) log.warn({ err: outboxErr, connectionId: conn.id }, 'resend outbox insert failed')

    log.info({ connectionId: conn.id, mid, fid: conn.fighter_id, email: conn.invited_email, status: 'pending' }, 'invite resent')
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'POST /manager/roster/:id/resend threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/manager/fighters/:fighterId ──────────────────────────────────────
router.get('/fighters/:fighterId', ...guard, async (req, res) => {
  try {
    const mid = req.user.id
    const fid = req.params.fighterId

    const { data: conn } = await adminSupabase
      .from('manager_fighters').select('id')
      .eq('manager_id', mid).eq('fighter_id', fid).eq('status', 'active').maybeSingle()
    if (!conn) return res.status(403).json({ error: 'No active connection to this fighter.' })

    const [{ data: profile }, { data: fp }, { data: rs }, { data: socials }] = await Promise.all([
      adminSupabase.from('profiles').select('id, name, email, status').eq('id', fid).maybeSingle(),
      adminSupabase.from('fighter_profiles').select('*').eq('user_id', fid).maybeSingle(),
      adminSupabase.from('readiness_scores').select('overall, brand, finance, conduct, sponsor, media, pipeline').eq('user_id', fid).maybeSingle(),
      adminSupabase.from('social_accounts').select('platform, handle, follower_count').eq('user_id', fid),
    ])
    if (!profile) return res.status(404).json({ error: 'Fighter not found.' })

    res.json({ id: fid, name: profile.name, email: profile.email, account_status: profile.status,
      ...(fp ?? {}), readiness: rs ?? { overall: 0 }, socials: socials ?? [] })
  } catch (err) {
    log.error({ err }, 'GET /manager/fighters/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/manager/fighters/:fighterId/profile ────────────────────────────
const MANAGER_WRITABLE = [
  'weight_class','division','record_wins','record_losses','record_draws',
  'base_city','gym_name','coach_name','current_promotion','pro_status',
  'sponsorship_interests',
]

router.patch('/fighters/:fighterId/profile', ...guard, validate(ManagerFighterProfileUpdateSchema), async (req, res) => {
  try {
    const mid = req.user.id
    const fid = req.params.fighterId

    const { data: conn } = await adminSupabase
      .from('manager_fighters').select('id')
      .eq('manager_id', mid).eq('fighter_id', fid).eq('status', 'active').maybeSingle()
    if (!conn) return res.status(403).json({ error: 'No active connection to this fighter.' })

    const updates = pick(req.valid, MANAGER_WRITABLE.filter(k => req.valid[k] !== undefined && req.valid[k] !== null || k in req.valid))
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No updatable fields provided.' })
    updates.updated_at = new Date().toISOString()

    const { error } = await adminSupabase.from('fighter_profiles')
      .upsert({ user_id: fid, ...updates }, { onConflict: 'user_id' })
    if (error) throw error

    log.info({ mid, fid, fields: Object.keys(updates) }, 'manager updated fighter profile')
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /manager/fighters/:id/profile threw')
    res.status(500).json({ error: err.message })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// OBLIGATIONS (status filter added)
// ═════════════════════════════════════════════════════════════════════════════

router.get('/obligations', ...guard, async (req, res) => {
  try {
    const sb   = adminSupabase
    const mid  = req.user.id
    const fids = await activeFighterIds(mid)
    if (!fids.length) return res.json({ overdue: [], this_week: [], rate: 100, fulfillment_chart: [] })

    const [{ data: obs }, { data: profiles }] = await Promise.all([
      sb.from('obligations').select('*').in('owner_id', fids).order('due_date'),
      sb.from('profiles').select('id, name').in('id', fids),
    ])

    const nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.name]))
    const now = new Date()
    const weekFromNow = new Date(now.getTime() + 7 * 86400000)

    const toItem = (o) => {
      const daysUntil = Math.round((new Date(o.due_date) - now) / 86400000)
      let badge, type
      if (o.status === 'overdue') { badge = 'Critical'; type = 'red' }
      else if (daysUntil === 0)  { badge = 'Tomorrow'; type = 'yellow' }
      else { badge = new Date(o.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); type = 'yellow' }
      return { name: `${nameMap[o.owner_id] ?? 'Fighter'} — ${o.title}`, badge, type }
    }

    const overdue  = (obs ?? []).filter(o => o.status === 'overdue').map(toItem)
    const thisWeek = (obs ?? []).filter(o => o.status !== 'overdue' && o.status !== 'completed' && new Date(o.due_date) <= weekFromNow).map(toItem)
    const completed = (obs ?? []).filter(o => o.status === 'completed').length
    const rate = (obs ?? []).length > 0 ? Math.round((completed / (obs ?? []).length) * 100) : 100

    const fulfillmentByFighter = fids.map(fid => {
      const fObs  = (obs ?? []).filter(o => o.owner_id === fid)
      const fComp = fObs.filter(o => o.status === 'completed').length
      const fPct  = fObs.length > 0 ? Math.round((fComp / fObs.length) * 100) : 100
      return { label: (nameMap[fid] ?? 'Fighter').split(' ')[0], value: fPct,
        color: fPct >= 90 ? '#00c060' : fPct >= 70 ? '#c9a82c' : '#c00000' }
    })

    res.json({ overdue, this_week: thisWeek, rate, fulfillment_chart: fulfillmentByFighter })
  } catch (err) {
    log.error({ err }, '/manager/obligations threw')
    res.status(500).json({ error: err.message })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// SPONSORFORGE (status filter added)
// ═════════════════════════════════════════════════════════════════════════════

router.get('/sponsorforge', ...guard, async (req, res) => {
  try {
    const sb   = adminSupabase
    const mid  = req.user.id
    const fids = await activeFighterIds(mid)
    if (!fids.length) return res.json({ fighters: [] })

    const [{ data: profiles }, { data: sf }] = await Promise.all([
      sb.from('profiles').select('id, name').in('id', fids),
      sb.from('sponsorforge_profiles').select('*').in('user_id', fids),
    ])

    const sfMap  = Object.fromEntries((sf ?? []).map(s => [s.user_id, s]))
    const prMap  = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

    const fighters = fids.map(fid => {
      const s     = sfMap[fid] ?? { eligibility_score: 0, is_locked: true }
      const score = s.eligibility_score
      const type  = score >= 85 ? 'green' : score >= 70 ? 'yellow' : 'red'
      return { name: prMap[fid]?.name ?? 'Fighter', pct: score, type,
        status: s.is_locked ? (score >= 70 ? `${score}% Ready` : 'Not Ready') : 'Eligible' }
    })

    res.json({ fighters })
  } catch (err) {
    log.error({ err }, '/manager/sponsorforge threw')
    res.status(500).json({ error: err.message })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// BUDGET / PLAYBOOKS / REPORTS (unchanged)
// ═════════════════════════════════════════════════════════════════════════════

router.get('/budget', ...guard, async (req, res) => {
  try {
    const { data, error } = await adminSupabase
      .from('camp_budgets').select('*').eq('manager_id', req.user.id).order('event_date')
    // Table may not be provisioned yet — return empty rather than crashing.
    if (error) return res.json({ total_budget: 0, budget_util: 0, unplanned: 0, camps: [] })

    const camps     = (data ?? []).map(c => ({ name: c.name, alloc: c.total_budget, spent: c.spent }))
    const total     = camps.reduce((s, c) => s + c.alloc, 0)
    const spentAll  = camps.reduce((s, c) => s + c.spent, 0)
    const util      = total > 0 ? Math.round((spentAll / total) * 100) : 0

    res.json({ total_budget: total, budget_util: util, unplanned: 0, camps })
  } catch (err) {
    log.error({ err }, '/manager/budget threw')
    res.status(500).json({ error: err.message })
  }
})

router.get('/playbooks', ...guard, async (req, res) => {
  try {
    const { data, error } = await adminSupabase
      .from('playbooks').select('id, title').in('target_role', ['manager', 'all']).order('order_num')
    // Table may not be provisioned yet — return empty rather than crashing.
    if (error) return res.json({ playbooks: [] })
    res.json({ playbooks: data ?? [] })
  } catch (err) {
    log.error({ err }, '/manager/playbooks threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/manager/applications ────────────────────────────────────────────
// Applications for all active roster fighters, enriched with opp + sponsor + fighter name.
router.get('/applications', ...guard, async (req, res) => {
  try {
    const sb   = adminSupabase
    const mid  = req.user.id
    const fids = await activeFighterIds(mid)
    if (!fids.length) return res.json({ applications: [] })

    const { data: apps, error } = await sb
      .from('applications')
      .select('id, opportunity_id, fighter_id, sponsor_id, status, match_score, cover_message, created_at, updated_at')
      .in('fighter_id', fids)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error

    const oppIds     = [...new Set((apps ?? []).map(a => a.opportunity_id))]
    const sponsorIds = [...new Set((apps ?? []).map(a => a.sponsor_id))]

    const [{ data: opps }, { data: sponsors }, { data: fighters }] = await Promise.all([
      oppIds.length     ? sb.from('sponsorship_opportunities').select('id, title, status').in('id', oppIds) : { data: [] },
      sponsorIds.length ? sb.from('sponsor_profiles').select('user_id, company_name').in('user_id', sponsorIds) : { data: [] },
      sb.from('profiles').select('id, name').in('id', fids),
    ])

    const oppMap     = Object.fromEntries((opps     ?? []).map(o => [o.id,      o]))
    const sponsorMap = Object.fromEntries((sponsors ?? []).map(s => [s.user_id, s]))
    const fighterMap = Object.fromEntries((fighters ?? []).map(f => [f.id,      f]))

    const applications = (apps ?? []).map(a => ({
      ...a,
      opportunity:    oppMap[a.opportunity_id]  ?? null,
      sponsor_detail: sponsorMap[a.sponsor_id]  ?? null,
      fighter:        fighterMap[a.fighter_id]  ?? null,
    }))

    res.json({ applications })
  } catch (err) {
    log.error({ err }, '/manager/applications threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/manager/contracts — contracts for active roster fighters ──────────
router.get('/contracts', ...guard, async (req, res) => {
  try {
    const sb   = adminSupabase
    const mid  = req.user.id
    const fids = await activeFighterIds(mid)
    if (!fids.length) return res.json({ contracts: [] })

    const { data: contracts, error } = await sb
      .from('contracts')
      .select('id, opportunity_id, application_id, sponsor_id, fighter_id, value_usd, payment_schedule, start_date, end_date, status, created_at, updated_at')
      .in('fighter_id', fids)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error

    const cids = (contracts ?? []).map(c => c.id)
    const [{ data: profiles }, { data: obs }] = await Promise.all([
      fids.length ? sb.from('profiles').select('id, name').in('id', fids) : { data: [] },
      cids.length ? sb.from('obligations').select('contract_id, status').in('contract_id', cids) : { data: [] },
    ])

    const prMap  = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
    const obsMap = {}
    for (const o of (obs ?? [])) {
      if (!obsMap[o.contract_id]) obsMap[o.contract_id] = { total: 0, completed: 0 }
      obsMap[o.contract_id].total++
      if (o.status === 'completed') obsMap[o.contract_id].completed++
    }

    const enriched = (contracts ?? []).map(c => ({
      ...c,
      fighter:               prMap[c.fighter_id] ?? null,
      obligations_total:     obsMap[c.id]?.total     ?? 0,
      obligations_completed: obsMap[c.id]?.completed ?? 0,
    }))

    res.json({ contracts: enriched })
  } catch (err) {
    log.error({ err }, '/manager/contracts threw')
    res.status(500).json({ error: err.message })
  }
})

router.get('/reports', ...guard, async (req, res) => {
  try {
    const sb   = adminSupabase
    const mid  = req.user.id
    const fids = await activeFighterIds(mid)
    if (!fids.length) return res.json({ roster_avg: 0, obligations_rate: 100, conduct_incidents: 0, sf_eligible: '0/0' })

    const [{ data: readiness }, { data: obs }, { data: sf }] = await Promise.all([
      sb.from('readiness_scores').select('overall').in('user_id', fids),
      sb.from('obligations').select('status').in('owner_id', fids),
      sb.from('sponsorforge_profiles').select('is_locked').in('user_id', fids),
    ])

    const avgReady   = readiness?.length ? Math.round(readiness.reduce((s, r) => s + r.overall, 0) / readiness.length) : 0
    const completed  = (obs ?? []).filter(o => o.status === 'completed').length
    const rate       = (obs ?? []).length > 0 ? Math.round((completed / (obs ?? []).length) * 100) : 100
    const sfEligible = (sf ?? []).filter(s => !s.is_locked).length

    res.json({ roster_avg: avgReady, obligations_rate: rate, conduct_incidents: 0, sf_eligible: `${sfEligible}/${fids.length}` })
  } catch (err) {
    log.error({ err }, '/manager/reports threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/manager/modules/progress ────────────────────────────────────────
// Returns published modules + each active roster fighter's progress.
router.get('/modules/progress', ...guard, async (req, res) => {
  try {
    const mid = req.user.id

    // Active roster fighter IDs
    const { data: links } = await adminSupabase
      .from('manager_fighters')
      .select('fighter_id')
      .eq('manager_id', mid)
      .eq('status', 'active')
      .not('fighter_id', 'is', null)
    const fids = (links ?? []).map(l => l.fighter_id)

    if (!fids.length) {
      return res.json({ ok: true, modules: [], fighters: [], summary: { total_modules: 0, avg_completion: 0 } })
    }

    const [{ data: mods }, { data: progressRows }, { data: profiles }] = await Promise.all([
      adminSupabase.from('education_modules').select('id, name, category, module_type, is_required, order_num').eq('status', 'published').order('order_num'),
      adminSupabase.from('module_progress').select('user_id, module_id, completion_pct, status, completed_at').in('user_id', fids),
      adminSupabase.from('profiles').select('id, name').in('id', fids),
    ])

    const nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.name]))

    // Per-fighter summary
    const fighters = fids.map(fid => {
      const fp = (progressRows ?? []).filter(p => p.user_id === fid)
      const completed  = fp.filter(p => p.status === 'completed' || p.completion_pct === 100).length
      const totalMods  = (mods ?? []).length
      const avgPct     = totalMods
        ? Math.round(fp.reduce((s, p) => s + p.completion_pct, 0) / totalMods)
        : 0
      return { fighter_id: fid, name: nameMap[fid] ?? 'Fighter', completed, total: totalMods, avg_pct: avgPct }
    })

    // Per-module completion rates
    const modules = (mods ?? []).map(m => {
      const rows    = (progressRows ?? []).filter(p => p.module_id === m.id)
      const done    = rows.filter(p => p.status === 'completed' || p.completion_pct === 100).length
      const rate    = fids.length ? Math.round((done / fids.length) * 100) : 0
      return { ...m, roster_completion_rate: rate, completed_count: done, roster_size: fids.length }
    })

    const overallAvg = fighters.length
      ? Math.round(fighters.reduce((s, f) => s + f.avg_pct, 0) / fighters.length)
      : 0

    res.json({ ok: true, modules, fighters, summary: { total_modules: (mods ?? []).length, avg_completion: overallAvg } })
  } catch (err) {
    log.error({ err }, '/manager/modules/progress threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/manager/activity ─────────────────────────────────────────────────
router.get('/activity', ...guard, async (req, res) => {
  try {
    const mid   = req.user.id
    const sb    = adminSupabase
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const fids  = await activeFighterIds(mid)

    const [{ data: connections }, appResult, contractResult, modResult] = await Promise.all([
      sb.from('manager_fighters').select('id, status, source, invited_name, fighter_id, updated_at')
        .eq('manager_id', mid).gte('updated_at', since).order('updated_at', { ascending: false }).limit(4),
      fids.length
        ? sb.from('applications').select('id, status, fighter_id, updated_at, opportunities(title)')
            .in('fighter_id', fids).gte('updated_at', since).order('updated_at', { ascending: false }).limit(4)
        : { data: [] },
      fids.length
        ? sb.from('contracts').select('id, status, value_usd, fighter_id, updated_at')
            .in('fighter_id', fids).gte('updated_at', since).order('updated_at', { ascending: false }).limit(3)
        : { data: [] },
      fids.length
        ? sb.from('module_progress').select('user_id, status, updated_at, education_modules(name)')
            .in('user_id', fids).eq('status', 'completed').gte('updated_at', since)
            .order('updated_at', { ascending: false }).limit(4)
        : { data: [] },
    ])

    const apps      = appResult.data ?? []
    const contracts = contractResult.data ?? []
    const mods      = modResult.data ?? []

    const allFids = [...new Set([...(connections ?? []).map(c => c.fighter_id).filter(Boolean), ...fids])]
    const { data: profiles } = allFids.length
      ? await sb.from('profiles').select('id, name').in('id', allFids)
      : { data: [] }
    const nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.name]))

    const events = []

    ;(connections ?? []).forEach(c => {
      const name = c.fighter_id ? (nameMap[c.fighter_id] ?? 'Fighter') : (c.invited_name ?? 'Fighter')
      if (c.status === 'active') {
        events.push({ date: c.updated_at, name: `${name} joined your roster`, badge: 'Roster', type: 'green' })
      } else if (c.status === 'pending' && c.source === 'fighter_request') {
        events.push({ date: c.updated_at, name: `${name} requested to join`, badge: 'Pending', type: 'yellow' })
      }
    })

    const APP_LABELS = { applied: 'applied', under_review: 'in review', shortlisted: 'shortlisted', accepted: 'accepted', rejected: 'not accepted' }
    const APP_TYPES  = { accepted: 'green', rejected: 'red', shortlisted: 'yellow' }
    ;(apps).forEach(a => {
      const name = nameMap[a.fighter_id] ?? 'Fighter'
      events.push({ date: a.updated_at, name: `${name} ${APP_LABELS[a.status] ?? a.status} — ${a.opportunities?.title ?? 'opportunity'}`, badge: 'Application', type: APP_TYPES[a.status] ?? 'yellow' })
    })

    const CONTRACT_LABELS = { pending_fighter: 'contract awaiting signature', active: 'contract active', completed: 'contract completed' }
    const CONTRACT_TYPES  = { pending_fighter: 'yellow', active: 'green', completed: 'green' }
    ;(contracts).forEach(c => {
      const name = nameMap[c.fighter_id] ?? 'Fighter'
      const val  = `$${(c.value_usd ?? 0).toLocaleString()}`
      events.push({ date: c.updated_at, name: `${name} — ${val} ${CONTRACT_LABELS[c.status] ?? `contract (${c.status})`}`, badge: 'Contract', type: CONTRACT_TYPES[c.status] ?? 'yellow' })
    })

    ;(mods).forEach(m => {
      const name    = nameMap[m.user_id] ?? 'Fighter'
      const modName = m.education_modules?.name ?? 'module'
      events.push({ date: m.updated_at, name: `${name} completed ${modName}`, badge: 'Education', type: 'green' })
    })

    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    res.json({ events: events.slice(0, 10) })
  } catch (err) {
    log.error({ err }, 'GET /manager/activity threw')
    res.status(500).json({ error: err.message })
  }
})

export default router
