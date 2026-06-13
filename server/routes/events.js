// ─────────────────────────────────────────────────────────────────────────────
// Event Calendar — events, participants, and event obligations.
//
// Roles: fighter (own events), manager (own + roster fighters'),
//        promoter/promotion (own/linked, limited obligation visibility),
//        admin (all). Promotion accounts have role='manager' + account_type
//        'promotion'; they are treated as promoters for visibility.
//
// Obligations live in `event_obligations` (NOT the contract `obligations` table).
// All endpoints are namespaced under /api/events to avoid colliding with the
// existing /api/obligations (contract) routes.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express'
import { adminSupabase } from '../db/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { childLogger } from '../lib/logger.js'
import { maybeAutoSync } from './calendly.js'

const router = Router()
const log    = childLogger('events')
const CLIENT = process.env.CLIENT_URL || ''

// Reject anything that isn't an http(s) URL (blocks javascript:/data: stored XSS
// that would otherwise land in an href on the client).
function safeHttpUrl(url) {
  if (!url) return null
  try {
    const u = new URL(String(url).trim())
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.toString() : null
  } catch { return null }
}

// ── Obligation templates (auto-suggested due dates relative to event date) ─────
// offset = days relative to event date (negative = before, positive = after).
const OBLIGATION_TEMPLATES = {
  medicals:         { title: 'Medicals',                category: 'medical', offset: -30, proof_required: true,  visibility: 'manager_visible'  },
  contract_signed:  { title: 'Contract signed',         category: 'admin',   offset: -21, proof_required: true,  visibility: 'manager_visible'  },
  travel:           { title: 'Travel',                  category: 'travel',  offset: -14, proof_required: false, visibility: 'manager_visible'  },
  tickets_promo:    { title: 'Ticket/promo obligations',category: 'promo',   offset: -14, proof_required: false, visibility: 'promoter_visible' },
  sponsor_content:  { title: 'Sponsor content post',    category: 'sponsor', offset: -10, proof_required: true,  visibility: 'sponsor_visible'  },
  fight_week:       { title: 'Fight week checklist',    category: 'event',   offset: -7,  proof_required: false, visibility: 'manager_visible'  },
  media_day:        { title: 'Media day',               category: 'media',   offset: -5,  proof_required: false, visibility: 'promoter_visible' },
  weigh_in:         { title: 'Weigh-in',                category: 'event',   offset: -1,  proof_required: false, visibility: 'promoter_visible' },
  post_event_recap: { title: 'Post-event recap',        category: 'media',   offset: 2,   proof_required: false, visibility: 'manager_visible'  },
}

const EVENT_TYPES   = ['fight','promotion_event','media_event','weigh_in','camp','sponsor_activation','other']
const EVENT_BADGE   = {
  fight: 'Fight', promotion_event: 'Promotion', media_event: 'Media', weigh_in: 'Weigh-in',
  camp: 'Camp', sponsor_activation: 'Sponsor', other: 'Event',
}
const EVENT_STATUS  = ['planned','active','completed','cancelled']
const EVENT_VIS     = ['private','manager_visible','promoter_visible','public']
const OB_STATUS     = ['not_started','in_progress','completed','overdue','skipped']
const OB_VIS        = ['private','manager_visible','promoter_visible','sponsor_visible']

// ── Helpers ───────────────────────────────────────────────────────────────────
async function rosterFighterIds(managerId) {
  const { data } = await adminSupabase
    .from('manager_fighters').select('fighter_id')
    .eq('manager_id', managerId).eq('status', 'active').not('fighter_id', 'is', null)
  return (data ?? []).map(r => r.fighter_id)
}

async function participantUserIds(eventId) {
  const { data } = await adminSupabase
    .from('event_participants').select('user_id, role').eq('event_id', eventId)
  return data ?? []
}

function notify(recipientId, type, title, body, eventId) {
  if (!recipientId) return
  adminSupabase.from('notifications').insert({
    recipient_id: recipientId, type, title, body: body ?? null,
    action_url: `${CLIENT}/dashboard`, related_type: 'event', related_id: eventId ?? null,
  }).then(() => {}).catch(() => {})
}

// Determine the viewer's relationship to an event → controls obligation visibility.
//   'full'     — sees every obligation (owner / creator / manager-of-owner / admin)
//   'promoter' — promoter_visible + sponsor_visible only
//   'sponsor'  — sponsor_visible only
//   'assigned' — only obligations assigned to them
//   null       — no access
async function relationToEvent(user, event) {
  if (user.role === 'admin') return 'full'
  const uid = user.id
  if ([event.created_by, event.owner_id, event.manager_id].includes(uid)) return 'full'

  const parts = await participantUserIds(event.id)
  const mine  = parts.filter(p => p.user_id === uid)

  if (user.role === 'manager') {
    const fids = await rosterFighterIds(uid)
    if (event.owner_id && fids.includes(event.owner_id)) return 'full'
    if (parts.some(p => p.role === 'fighter' && fids.includes(p.user_id))) return 'full'
  }
  if (event.promoter_id === uid || mine.some(p => p.role === 'promoter')) return 'promoter'
  if (mine.some(p => p.role === 'sponsor')) return 'sponsor'
  if (mine.length) return 'assigned'        // a linked fighter who isn't the owner
  return null
}

function canEditEvent(rel) {
  return rel === 'full'
}

function obligationVisible(ob, rel, uid) {
  if (rel === 'full') return true
  if (ob.assigned_to_user_id === uid) return true
  if (rel === 'promoter') return ['promoter_visible', 'sponsor_visible'].includes(ob.visibility)
  if (rel === 'sponsor')  return ob.visibility === 'sponsor_visible'
  return false
}

// Lazily flag past-due obligations as overdue for display (no DB mutation here).
function withDerivedStatus(ob) {
  if (ob.status === 'completed' || ob.status === 'skipped') return ob
  if (ob.due_date && new Date(ob.due_date).getTime() < Date.now() && ob.status !== 'overdue') {
    return { ...ob, status: 'overdue' }
  }
  return ob
}

// Gather every event row the user may see (admin = all; otherwise events they
// created/own/manage/promote, are a participant in, or — for managers — that
// belong to a roster fighter). Shared by GET / and GET /calendar-feed.
async function gatherVisibleEvents(user) {
  const sb  = adminSupabase
  const uid = user.id
  if (user.role === 'admin') {
    const { data } = await sb.from('events').select('*').order('event_date', { ascending: true })
    return data ?? []
  }
  const ids = new Set()
  const { data: direct } = await sb.from('events').select('id')
    .or(`created_by.eq.${uid},owner_id.eq.${uid},manager_id.eq.${uid},promoter_id.eq.${uid}`)
  ;(direct ?? []).forEach(e => ids.add(e.id))
  const { data: parts } = await sb.from('event_participants').select('event_id').eq('user_id', uid)
  ;(parts ?? []).forEach(p => ids.add(p.event_id))

  if (user.role === 'manager') {
    const fids = await rosterFighterIds(uid)
    if (fids.length) {
      const [{ data: re }, { data: oe }] = await Promise.all([
        sb.from('event_participants').select('event_id').in('user_id', fids),
        sb.from('events').select('id').in('owner_id', fids),
      ])
      ;(re ?? []).forEach(p => ids.add(p.event_id))
      ;(oe ?? []).forEach(e => ids.add(e.id))
    }
  }
  if (!ids.size) return []
  const { data } = await sb.from('events').select('*').in('id', [...ids]).order('event_date', { ascending: true })
  return data ?? []
}

// ── GET /api/events — events visible to the current user ──────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const sb = adminSupabase
    const events = await gatherVisibleEvents(req.user)
    if (!events.length) return res.json({ events: [] })

    // Attach participant names + obligation counts.
    const eventIds = events.map(e => e.id)
    const [{ data: allParts }, { data: allObs }] = eventIds.length
      ? await Promise.all([
          sb.from('event_participants').select('event_id, user_id, role').in('event_id', eventIds),
          sb.from('event_obligations').select('event_id, status, due_date').in('event_id', eventIds),
        ])
      : [{ data: [] }, { data: [] }]

    const partUids = [...new Set((allParts ?? []).map(p => p.user_id))]
    const { data: profs } = partUids.length
      ? await sb.from('profiles').select('id, name').in('id', partUids) : { data: [] }
    const nameMap = Object.fromEntries((profs ?? []).map(p => [p.id, p.name]))

    const result = events.map(e => {
      const parts = (allParts ?? []).filter(p => p.event_id === e.id)
        .map(p => ({ user_id: p.user_id, role: p.role, name: nameMap[p.user_id] ?? 'User' }))
      const obs = (allObs ?? []).filter(o => o.event_id === e.id).map(withDerivedStatus)
      return {
        ...e,
        participants:        parts,
        obligation_total:    obs.length,
        obligation_done:     obs.filter(o => o.status === 'completed').length,
        obligation_overdue:  obs.filter(o => o.status === 'overdue').length,
      }
    })

    res.json({ events: result })
  } catch (err) {
    log.error({ err }, 'GET /events threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/events/templates — available obligation templates ────────────────
router.get('/templates', requireAuth, (req, res) => {
  res.json({
    templates: Object.entries(OBLIGATION_TEMPLATES).map(([key, t]) => ({
      key, title: t.title, category: t.category, offset_days: t.offset,
      proof_required: t.proof_required, visibility: t.visibility,
    })),
  })
})

// ── GET /api/events/calendar-feed — unified, normalized calendar items ────────
// Aggregates app events, Calendly meetings, event obligation due-dates, and
// contract/sponsor deadlines into one role-filtered feed. Used by the Command
// Center cards/panels and the Event Calendar month/list views so each surface
// renders the SAME data instead of stitching it client-side.
//
//   query: from, to (ISO), include_past=1, type=event|calendly|obligation|deadline
//
// MUST be declared before GET /:id so the literal path isn't captured as an id.
router.get('/calendar-feed', requireAuth, async (req, res) => {
  try {
    const sb   = adminSupabase
    const uid  = req.user.id
    const user = req.user

    // Best-effort Calendly refresh (freshness-gated). Fire-and-forget so a slow or
    // failing Calendly API never blocks/breaks the feed — fresh rows land next load,
    // and manual "Sync Calendly" always forces an immediate pull.
    maybeAutoSync(uid).catch(() => {})

    const now  = new Date()
    const from = req.query.from ? new Date(req.query.from) : new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const to   = req.query.to   ? new Date(req.query.to)   : new Date(now.getFullYear(), now.getMonth() + 2, 0)
    const includePast = req.query.include_past === '1' || req.query.include_past === 'true'
    const typeFilter  = typeof req.query.type === 'string' && req.query.type !== 'all' ? req.query.type : null

    const items = []

    // 1. Events (manual + calendly) + their obligation due-dates.
    const events    = await gatherVisibleEvents(user)
    const eventById = Object.fromEntries(events.map(e => [e.id, e]))
    const rels      = {}
    for (const e of events) rels[e.id] = await relationToEvent(user, e)

    // The viewer's own participation status per event (controls pending/declined).
    const evIds0 = events.map(e => e.id)
    const myPart = {}
    if (evIds0.length) {
      const { data: mp } = await sb.from('event_participants')
        .select('event_id, role, status').eq('user_id', uid).in('event_id', evIds0)
      for (const r of (mp ?? [])) { if (r.role === 'fighter' || !(r.event_id in myPart)) myPart[r.event_id] = r.status }
    }

    for (const e of events) {
      const rel = rels[e.id]
      if (!rel) continue
      // A fighter who declined their own participation shouldn't see it on their calendar.
      if (myPart[e.id] === 'declined') continue
      items.push({
        id: `event:${e.id}`,
        type: e.source === 'calendly' ? 'calendly' : 'event',
        source: e.source === 'calendly' ? 'calendly' : 'manual',
        title: e.name,
        start: e.event_date, end: null, date: e.event_date,
        status: e.status,
        badge: e.source === 'calendly' ? 'Calendly' : (EVENT_BADGE[e.event_type] ?? 'Event'),
        event_id: e.id, obligation_id: null, contract_id: null,
        visibility: e.visibility,
        can_edit: canEditEvent(rel),
        metadata: {
          event_type: e.event_type, location: e.location, opponent: e.opponent,
          promotion_name: e.promotion_name, participant_status: myPart[e.id] ?? null,
          scheduling_url: e.calendly_scheduling_url ?? null, external_url: e.external_url ?? null,
        },
      })
    }

    const evIds = events.map(e => e.id)
    if (evIds.length) {
      const { data: obs } = await sb.from('event_obligations').select('*').in('event_id', evIds)
      for (const raw of (obs ?? [])) {
        const ob  = withDerivedStatus(raw)
        const rel = rels[ob.event_id]
        if (!rel || !obligationVisible(ob, rel, uid) || !ob.due_date) continue
        const ev = eventById[ob.event_id]
        items.push({
          id: `obligation:${ob.id}`,
          type: 'obligation', source: 'manual',
          title: ob.title,
          start: ob.due_date, end: null, date: ob.due_date,
          status: ob.status,
          badge: ob.status === 'overdue' ? 'Overdue' : 'Due',
          event_id: ob.event_id, obligation_id: ob.id, contract_id: null,
          visibility: ob.visibility,
          can_edit: rel === 'full' || ob.assigned_to_user_id === uid,
          metadata: { category: ob.category, event_name: ev?.name ?? null, proof_required: ob.proof_required },
        })
      }
    }

    // 2. Contract / sponsor deadlines from the contract-bound `obligations` table.
    //    Owner-scoped (a fighter's own); managers also see roster fighters'.
    //    Promoters/sponsors only ever see their own owner_id rows (no leak of
    //    private fighter obligations). Admin sees all dated obligations.
    let deadlineRows = []
    try {
      if (user.role === 'admin') {
        const { data } = await sb.from('obligations')
          .select('id,title,due_date,status,category,owner_id,contract_id').not('due_date', 'is', null)
        deadlineRows = data ?? []
      } else {
        const ownerIds = user.role === 'manager'
          ? [...new Set([uid, ...(await rosterFighterIds(uid))])]
          : [uid]
        const { data } = await sb.from('obligations')
          .select('id,title,due_date,status,category,owner_id,contract_id')
          .in('owner_id', ownerIds).not('due_date', 'is', null)
        deadlineRows = data ?? []
      }
    } catch (e) { log.warn({ err: e }, 'contract obligations feed query failed (skipping deadlines)') }

    for (const d of deadlineRows) {
      const overdue = !['completed', 'canceled'].includes(d.status) && new Date(d.due_date).getTime() < Date.now()
      items.push({
        id: `deadline:${d.id}`,
        type: 'deadline', source: 'contract',
        title: d.title,
        start: d.due_date, end: null, date: d.due_date,
        status: overdue ? 'overdue' : d.status,
        badge: overdue ? 'Overdue' : 'Deadline',
        event_id: null, obligation_id: d.id, contract_id: d.contract_id ?? null,
        visibility: 'private', can_edit: false,
        metadata: { category: d.category },
      })
    }

    // Range / past / type filtering, then chronological sort.
    const fromT = from.getTime(), toT = to.getTime()
    let out = items.filter(it => {
      const t = new Date(it.date).getTime()
      return !Number.isNaN(t) && t >= fromT && t <= toT
    })
    if (!includePast) {
      const dayAgo = Date.now() - 86400000
      out = out.filter(it => new Date(it.date).getTime() >= dayAgo || it.status === 'overdue')
    }
    if (typeFilter) out = out.filter(it => it.type === typeFilter)
    out.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    res.json({ items: out, range: { from: from.toISOString(), to: to.toISOString() } })
  } catch (err) {
    log.error({ err }, 'GET /events/calendar-feed threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/events/linkable-fighters — fighters the user may link to an event ─
// The verified sponsor↔fighter relationship pass: a sponsor may only link
// fighters they have a real connection with (a contract, or an accepted/
// shortlisted application). Managers link roster fighters; fighters link self.
// MUST be declared before GET /:id.
async function linkableFighterIds(user) {
  const sb = adminSupabase, uid = user.id
  const ids = new Set()
  if (user.role === 'fighter') { ids.add(uid); return ids }
  if (user.role === 'manager') { (await rosterFighterIds(uid)).forEach(f => ids.add(f)); return ids }
  if (user.role === 'sponsor') {
    const [{ data: cts }, { data: apps }] = await Promise.all([
      sb.from('contracts').select('fighter_id').eq('sponsor_id', uid),
      sb.from('applications').select('fighter_id, status').eq('sponsor_id', uid).in('status', ['accepted', 'shortlisted']),
    ])
    ;(cts ?? []).forEach(c => c.fighter_id && ids.add(c.fighter_id))
    ;(apps ?? []).forEach(a => a.fighter_id && ids.add(a.fighter_id))
  }
  return ids
}

router.get('/linkable-fighters', requireAuth, async (req, res) => {
  try {
    const ids = await linkableFighterIds(req.user)
    if (!ids.size) return res.json({ fighters: [] })
    const { data: profs } = await adminSupabase.from('profiles').select('id, name').in('id', [...ids])
    res.json({ fighters: (profs ?? []).map(p => ({ id: p.id, name: p.name ?? 'Fighter' })) })
  } catch (err) {
    log.error({ err }, 'GET /events/linkable-fighters threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/events — create an event ────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const sb  = adminSupabase
    const uid = req.user.id
    const b   = req.body

    if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'Event name is required.' })
    if (!b.event_date) return res.status(400).json({ error: 'Event date is required.' })
    const type = EVENT_TYPES.includes(b.event_type) ? b.event_type : 'fight'
    const status = EVENT_STATUS.includes(b.status) ? b.status : 'planned'
    const visibility = EVENT_VIS.includes(b.visibility) ? b.visibility : 'manager_visible'

    // Resolve linked fighters by id; managers may only link roster fighters.
    let fighterIds = Array.isArray(b.fighter_ids) ? b.fighter_ids.filter(Boolean) : []
    if (req.user.role === 'fighter') fighterIds = [uid]            // fighters own their events
    if (req.user.role === 'manager' && fighterIds.length) {
      const roster = await rosterFighterIds(uid)
      fighterIds = fighterIds.filter(f => roster.includes(f))
    }

    // owner = primary fighter if any, else the creator.
    const ownerId    = fighterIds[0] ?? (req.user.role === 'fighter' ? uid : null)
    const managerId  = req.user.role === 'manager' && req.user.account_type !== 'promotion' ? uid : (b.manager_id ?? null)
    const promoterId = (req.user.role === 'manager' && req.user.account_type === 'promotion') ? uid : (b.promoter_id ?? null)

    const { data: ev, error } = await sb.from('events').insert({
      name: String(b.name).trim(),
      event_type: type,
      event_date: b.event_date,
      timezone: b.timezone ?? null,
      location: b.location?.trim() || null,
      opponent: b.opponent?.trim() || null,
      promotion_name: b.promotion_name?.trim() || null,
      weight_class: b.weight_class?.trim() || null,
      status,
      notes: b.notes?.trim() || null,
      visibility,
      external_url: safeHttpUrl(b.external_url),
      calendly_scheduling_url: safeHttpUrl(b.calendly_scheduling_url),
      calendly_event_type_uri: safeHttpUrl(b.calendly_event_type_uri),
      owner_id: ownerId,
      manager_id: managerId,
      promoter_id: promoterId,
      created_by: uid,
    }).select().maybeSingle()
    if (error) throw error

    // Participants: linked fighters + manager/promoter. A fighter linked by
    // someone else starts 'pending' (must confirm); the creator's own row is
    // 'confirmed'.
    const partRows = []
    for (const fid of [...new Set(fighterIds)]) {
      partRows.push({ event_id: ev.id, user_id: fid, role: 'fighter', status: fid === uid ? 'confirmed' : 'pending' })
    }
    if (managerId)  partRows.push({ event_id: ev.id, user_id: managerId,  role: 'manager',  status: 'confirmed' })
    if (promoterId) partRows.push({ event_id: ev.id, user_id: promoterId, role: 'promoter', status: 'confirmed' })
    if (partRows.length) await sb.from('event_participants').upsert(partRows, { onConflict: 'event_id,user_id,role' })

    // Notify linked fighters (other than the creator) that they have something to confirm.
    for (const fid of fighterIds) {
      if (fid !== uid) notify(fid, 'event.created', `New event: ${ev.name}`, 'You were added to an event — confirm or decline it.', ev.id)
    }

    log.info({ id: ev.id, by: uid, type }, 'event created')
    res.status(201).json({ ok: true, event: ev })
  } catch (err) {
    log.error({ err }, 'POST /events threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/events/guided-create — wizard-driven event + obligation plan ────
// One transaction-like call: create the event, link participants (with pending
// confirmation for fighters added by someone else), and generate the selected
// obligation templates with due-date / visibility overrides. Permissions and
// safe creation are enforced server-side — the wizard only proposes.
router.post('/guided-create', requireAuth, async (req, res) => {
  try {
    const sb   = adminSupabase
    const uid  = req.user.id
    const role = req.user.role
    const isPromotion = role === 'manager' && req.user.account_type === 'promotion'
    const p = req.body || {}
    const d = p.details || {}

    if (!d.name || !String(d.name).trim()) return res.status(400).json({ error: 'Event name is required.' })
    if (!d.event_date) return res.status(400).json({ error: 'Event date is required.' })

    const type       = EVENT_TYPES.includes(p.event_type) ? p.event_type : 'fight'
    const visibility = EVENT_VIS.includes(d.visibility) ? d.visibility : 'manager_visible'

    // Resolve linked fighters. Fighters own their own; managers may only link
    // roster fighters; promotions/sponsors may link provided fighters (gated by
    // the fighter's own pending confirmation before it shows as active to them).
    let fighterIds = Array.isArray(p.participants?.fighter_ids) ? p.participants.fighter_ids.filter(Boolean) : []
    if (role === 'fighter') fighterIds = [uid]
    if (role === 'manager' && !isPromotion && fighterIds.length) {
      const roster = await rosterFighterIds(uid)
      fighterIds = fighterIds.filter(f => roster.includes(f))
    }
    // Sponsors may only link fighters they have a verified relationship with
    // (contract or accepted/shortlisted application) — never arbitrary fighters.
    if (role === 'sponsor' && fighterIds.length) {
      const allowed = await linkableFighterIds(req.user)
      fighterIds = fighterIds.filter(f => allowed.has(f))
    }
    fighterIds = [...new Set(fighterIds)]

    const ownerId    = role === 'fighter' ? uid : (fighterIds[0] ?? (role === 'manager' && !isPromotion ? uid : null))
    const managerId  = (role === 'manager' && !isPromotion) ? uid : (p.participants?.manager_id ?? null)
    const promoterId = isPromotion ? uid : (p.participants?.promoter_id ?? null)
    const sponsorId  = role === 'sponsor' ? uid : (p.participants?.sponsor_id ?? null)

    const { data: ev, error } = await sb.from('events').insert({
      name: String(d.name).trim(),
      event_type: type,
      event_date: d.event_date,
      timezone: d.timezone ?? null,
      location: d.location?.trim() || null,
      opponent: d.opponent?.trim() || null,
      promotion_name: d.promotion_name?.trim() || null,
      weight_class: d.weight_class?.trim() || null,
      status: 'planned',
      notes: d.notes?.trim() || null,
      visibility,
      external_url: safeHttpUrl(d.external_url),
      calendly_scheduling_url: safeHttpUrl(p.calendly_scheduling_url),
      calendly_event_type_uri: safeHttpUrl(p.calendly_event_type_uri),
      owner_id: ownerId,
      manager_id: managerId,
      promoter_id: promoterId,
      created_by: uid,
    }).select().maybeSingle()
    if (error) throw error

    // Participants (+ confirmation status).
    const partRows = []
    for (const fid of fighterIds) partRows.push({ event_id: ev.id, user_id: fid, role: 'fighter', status: fid === uid ? 'confirmed' : 'pending' })
    if (managerId)  partRows.push({ event_id: ev.id, user_id: managerId,  role: 'manager',  status: 'confirmed' })
    if (promoterId) partRows.push({ event_id: ev.id, user_id: promoterId, role: 'promoter', status: 'confirmed' })
    if (sponsorId)  partRows.push({ event_id: ev.id, user_id: sponsorId,  role: 'sponsor',  status: 'confirmed' })
    if (partRows.length) await sb.from('event_participants').upsert(partRows, { onConflict: 'event_id,user_id,role' })

    // Obligations from selected templates (deduped) with due-date / visibility overrides.
    const assignedTo = ownerId ?? uid
    const keys = [...new Set((Array.isArray(p.selected_templates) ? p.selected_templates : []).filter(k => OBLIGATION_TEMPLATES[k]))]
    const dueOverrides = p.due_date_overrides || {}
    const visOverrides = p.visibility_overrides || {}
    const obRows = keys.map(k => {
      const row = fromTemplate(k, ev, assignedTo, uid)
      if (!row) return null
      if (dueOverrides[k]) { const t = new Date(dueOverrides[k]); if (!Number.isNaN(t.getTime())) row.due_date = t.toISOString() }
      if (visOverrides[k] && OB_VIS.includes(visOverrides[k])) row.visibility = visOverrides[k]
      return row
    }).filter(Boolean)

    let obligations = []
    if (obRows.length) {
      const { data: obs, error: obErr } = await sb.from('event_obligations').insert(obRows).select()
      if (obErr) { log.warn({ err: obErr }, 'guided-create obligation insert failed (event still created)') }
      else obligations = obs ?? []
    }

    // Notifications: linked fighters (confirm prompt) + obligation assignees.
    for (const fid of fighterIds) {
      if (fid !== uid) notify(fid, 'event.created', `New event: ${ev.name}`, 'You were added to an event — confirm or decline it.', ev.id)
    }
    for (const ob of obligations) {
      if (ob.assigned_to_user_id && ob.assigned_to_user_id !== uid) {
        notify(ob.assigned_to_user_id, 'obligation.assigned', `New task: ${ob.title}`,
          ob.due_date ? `Due ${new Date(ob.due_date).toLocaleDateString()}` : null, ev.id)
      }
    }

    log.info({ id: ev.id, by: uid, type, obligations: obligations.length }, 'guided event created')
    res.status(201).json({ ok: true, event: ev, obligations })
  } catch (err) {
    log.error({ err }, 'POST /events/guided-create threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/events/:id/confirm | /decline — fighter confirms participation ──
// Only the linked fighter may set their OWN participation status; a manager or
// promoter cannot confirm/decline on the fighter's behalf.
async function setParticipation(req, res, status) {
  const sb = adminSupabase
  const { data: part } = await sb.from('event_participants')
    .select('id').eq('event_id', req.params.id).eq('user_id', req.user.id).eq('role', 'fighter').maybeSingle()
  if (!part) return res.status(403).json({ error: 'Only the linked fighter can respond to this event.' })
  await sb.from('event_participants').update({ status }).eq('id', part.id)
  const { data: ev } = await sb.from('events').select('id, name, created_by').eq('id', req.params.id).maybeSingle()
  if (ev && ev.created_by !== req.user.id) {
    notify(ev.created_by, status === 'confirmed' ? 'event.confirmed' : 'event.declined',
      `${status === 'confirmed' ? 'Confirmed' : 'Declined'}: ${ev.name}`,
      `${req.user.name ?? 'A fighter'} ${status} this event.`, ev.id)
  }
  res.json({ ok: true, status })
}
router.post('/:id/confirm', requireAuth, async (req, res) => {
  try { await setParticipation(req, res, 'confirmed') }
  catch (err) { log.error({ err }, 'POST /events/:id/confirm threw'); res.status(500).json({ error: err.message }) }
})
router.post('/:id/decline', requireAuth, async (req, res) => {
  try { await setParticipation(req, res, 'declined') }
  catch (err) { log.error({ err }, 'POST /events/:id/decline threw'); res.status(500).json({ error: err.message }) }
})

// ── GET /api/events/:id — detail with visibility-filtered obligations ─────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const sb = adminSupabase
    const { data: ev } = await sb.from('events').select('*').eq('id', req.params.id).maybeSingle()
    if (!ev) return res.status(404).json({ error: 'Event not found.' })

    const rel = await relationToEvent(req.user, ev)
    if (!rel) return res.status(403).json({ error: 'You do not have access to this event.' })

    const [{ data: parts }, { data: obs }] = await Promise.all([
      sb.from('event_participants').select('user_id, role, status').eq('event_id', ev.id),
      sb.from('event_obligations').select('*').eq('event_id', ev.id).order('due_date', { ascending: true, nullsFirst: false }),
    ])
    const myPart = (parts ?? []).find(p => p.user_id === req.user.id && p.role === 'fighter')

    const ids = [...new Set([
      ...(parts ?? []).map(p => p.user_id),
      ...(obs ?? []).map(o => o.assigned_to_user_id).filter(Boolean),
    ])]
    const { data: profs } = ids.length ? await sb.from('profiles').select('id, name').in('id', ids) : { data: [] }
    const nameMap = Object.fromEntries((profs ?? []).map(p => [p.id, p.name]))

    const visibleObs = (obs ?? [])
      .map(withDerivedStatus)
      .filter(o => obligationVisible(o, rel, req.user.id))
      .map(o => ({ ...o, assigned_to_name: o.assigned_to_user_id ? (nameMap[o.assigned_to_user_id] ?? 'User') : null }))

    // For Calendly-synced events, surface the synced-row id + status so the UI can
    // offer "Cancel Calendly meeting" (the cancel route is keyed on that id).
    let calendlySyncedId = null, calendlyStatus = null
    if (ev.source === 'calendly') {
      const { data: sync } = await sb.from('calendly_synced_events')
        .select('id, status').eq('event_id', ev.id).maybeSingle()
      calendlySyncedId = sync?.id ?? null
      calendlyStatus   = sync?.status ?? null
    }

    res.json({
      event:        { ...ev, can_edit: canEditEvent(rel), relation: rel,
                      calendly_synced_event_id: calendlySyncedId, calendly_meeting_status: calendlyStatus,
                      my_participant_status: myPart?.status ?? null },
      participants: (parts ?? []).map(p => ({ ...p, name: nameMap[p.user_id] ?? 'User' })),
      obligations:  visibleObs,
    })
  } catch (err) {
    log.error({ err }, 'GET /events/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/events/:id — update event (full-permission users) ──────────────
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const sb = adminSupabase
    const { data: ev } = await sb.from('events').select('*').eq('id', req.params.id).maybeSingle()
    if (!ev) return res.status(404).json({ error: 'Event not found.' })
    const rel = await relationToEvent(req.user, ev)
    if (!canEditEvent(rel)) return res.status(403).json({ error: 'You cannot edit this event.' })

    const b = req.body
    const updates = { updated_at: new Date().toISOString() }
    for (const k of ['name','location','opponent','promotion_name','weight_class','notes','timezone']) {
      if (b[k] !== undefined) updates[k] = typeof b[k] === 'string' ? (b[k].trim() || null) : b[k]
    }
    if (b.external_url !== undefined) updates.external_url = safeHttpUrl(b.external_url)
    if (b.calendly_scheduling_url !== undefined) updates.calendly_scheduling_url = safeHttpUrl(b.calendly_scheduling_url)
    if (b.calendly_event_type_uri !== undefined) updates.calendly_event_type_uri = safeHttpUrl(b.calendly_event_type_uri)
    if (b.event_date) updates.event_date = b.event_date
    if (EVENT_TYPES.includes(b.event_type))  updates.event_type = b.event_type
    if (EVENT_STATUS.includes(b.status))     updates.status = b.status
    if (EVENT_VIS.includes(b.visibility))    updates.visibility = b.visibility

    const { error } = await sb.from('events').update(updates).eq('id', ev.id)
    if (error) throw error
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /events/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/events/:id — owner/creator/admin only ─────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const sb = adminSupabase
    const { data: ev } = await sb.from('events').select('*').eq('id', req.params.id).maybeSingle()
    if (!ev) return res.status(404).json({ error: 'Event not found.' })
    const isOwner = [ev.created_by, ev.owner_id].includes(req.user.id)
    if (!isOwner && req.user.role !== 'admin') return res.status(403).json({ error: 'Only the owner can delete this event.' })
    await sb.from('events').delete().eq('id', ev.id)
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'DELETE /events/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/events/:id/obligations ───────────────────────────────────────────
router.get('/:id/obligations', requireAuth, async (req, res) => {
  try {
    const sb = adminSupabase
    const { data: ev } = await sb.from('events').select('*').eq('id', req.params.id).maybeSingle()
    if (!ev) return res.status(404).json({ error: 'Event not found.' })
    const rel = await relationToEvent(req.user, ev)
    if (!rel) return res.status(403).json({ error: 'No access.' })

    const { data: obs } = await sb.from('event_obligations').select('*').eq('event_id', ev.id)
      .order('due_date', { ascending: true, nullsFirst: false })
    const visible = (obs ?? []).map(withDerivedStatus).filter(o => obligationVisible(o, rel, req.user.id))
    res.json({ obligations: visible })
  } catch (err) {
    log.error({ err }, 'GET /events/:id/obligations threw')
    res.status(500).json({ error: err.message })
  }
})

// Build one obligation row from a template + the event date.
function fromTemplate(key, ev, assignedTo, createdBy) {
  const t = OBLIGATION_TEMPLATES[key]
  if (!t) return null
  const due = new Date(ev.event_date)
  due.setDate(due.getDate() + t.offset)
  return {
    event_id: ev.id, title: t.title, category: t.category,
    assigned_to_user_id: assignedTo ?? ev.owner_id ?? null,
    due_date: due.toISOString(), status: 'not_started',
    visibility: t.visibility, proof_required: t.proof_required,
    template_key: key, created_by: createdBy,
  }
}

// ── POST /api/events/:id/obligations/from-template ────────────────────────────
router.post('/:id/obligations/from-template', requireAuth, async (req, res) => {
  try {
    const sb = adminSupabase
    const { data: ev } = await sb.from('events').select('*').eq('id', req.params.id).maybeSingle()
    if (!ev) return res.status(404).json({ error: 'Event not found.' })
    const rel = await relationToEvent(req.user, ev)
    if (!canEditEvent(rel)) return res.status(403).json({ error: 'You cannot add obligations to this event.' })

    const keys = Array.isArray(req.body.templates) ? req.body.templates : []
    const assignedTo = req.body.assigned_to ?? null
    const rows = keys.map(k => fromTemplate(k, ev, assignedTo, req.user.id)).filter(Boolean)
    if (!rows.length) return res.status(400).json({ error: 'Select at least one valid template.' })

    const { data, error } = await sb.from('event_obligations').insert(rows).select()
    if (error) throw error

    for (const ob of data ?? []) {
      if (ob.assigned_to_user_id && ob.assigned_to_user_id !== req.user.id) {
        notify(ob.assigned_to_user_id, 'obligation.assigned', `New task: ${ob.title}`, `Due ${new Date(ob.due_date).toLocaleDateString()}`, ev.id)
      }
    }
    res.status(201).json({ ok: true, obligations: data, added: data?.length ?? 0 })
  } catch (err) {
    log.error({ err }, 'POST from-template threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/events/:id/obligations — manual add ─────────────────────────────
router.post('/:id/obligations', requireAuth, async (req, res) => {
  try {
    const sb = adminSupabase
    const { data: ev } = await sb.from('events').select('*').eq('id', req.params.id).maybeSingle()
    if (!ev) return res.status(404).json({ error: 'Event not found.' })
    const rel = await relationToEvent(req.user, ev)
    if (!canEditEvent(rel)) return res.status(403).json({ error: 'You cannot add obligations to this event.' })

    const b = req.body
    if (!b.title || !String(b.title).trim()) return res.status(400).json({ error: 'Title is required.' })

    const row = {
      event_id: ev.id,
      title: String(b.title).trim(),
      description: b.description?.trim() || null,
      category: b.category?.trim() || null,
      assigned_to_user_id: b.assigned_to_user_id ?? ev.owner_id ?? null,
      due_date: b.due_date || null,
      status: OB_STATUS.includes(b.status) ? b.status : 'not_started',
      visibility: OB_VIS.includes(b.visibility) ? b.visibility : 'manager_visible',
      proof_required: !!b.proof_required,
      created_by: req.user.id,
    }
    const { data, error } = await sb.from('event_obligations').insert(row).select().maybeSingle()
    if (error) throw error

    if (data.assigned_to_user_id && data.assigned_to_user_id !== req.user.id) {
      notify(data.assigned_to_user_id, 'obligation.assigned', `New task: ${data.title}`,
        data.due_date ? `Due ${new Date(data.due_date).toLocaleDateString()}` : null, ev.id)
    }
    res.status(201).json({ ok: true, obligation: data })
  } catch (err) {
    log.error({ err }, 'POST /events/:id/obligations threw')
    res.status(500).json({ error: err.message })
  }
})

// Load an event obligation + its event, and resolve the caller's relationship.
async function loadObligationCtx(req) {
  const sb = adminSupabase
  const { data: ob } = await sb.from('event_obligations').select('*').eq('id', req.params.oid).maybeSingle()
  if (!ob) return { error: 404 }
  const { data: ev } = await sb.from('events').select('*').eq('id', ob.event_id).maybeSingle()
  if (!ev) return { error: 404 }
  const rel = await relationToEvent(req.user, ev)
  return { ob, ev, rel }
}

// ── PATCH /api/events/obligations/:oid — update obligation ────────────────────
// Assigned user may change status; full-permission users may edit any field.
router.patch('/obligations/:oid', requireAuth, async (req, res) => {
  try {
    const sb = adminSupabase
    const { ob, rel, error } = await loadObligationCtx(req)
    if (error) return res.status(404).json({ error: 'Obligation not found.' })

    const isAssignee = ob.assigned_to_user_id === req.user.id
    if (rel !== 'full' && !isAssignee) return res.status(403).json({ error: 'You cannot update this obligation.' })

    const b = req.body
    const updates = { updated_at: new Date().toISOString() }

    if (b.status && OB_STATUS.includes(b.status)) {
      updates.status = b.status
      updates.completed_at = b.status === 'completed' ? new Date().toISOString() : null
    }
    // Full-permission users may edit the rest; assignees can only change status (+ proof on their own task).
    if (rel === 'full') {
      for (const k of ['title','description','category']) if (b[k] !== undefined) updates[k] = b[k]?.trim?.() || b[k] || null
      if (b.due_date !== undefined) updates.due_date = b.due_date || null
      if (b.assigned_to_user_id !== undefined) updates.assigned_to_user_id = b.assigned_to_user_id || null
      if (OB_VIS.includes(b.visibility)) updates.visibility = b.visibility
      if (b.proof_required !== undefined) updates.proof_required = !!b.proof_required
    }
    if (b.proof_url !== undefined && (rel === 'full' || isAssignee)) updates.proof_url = safeHttpUrl(b.proof_url)

    const { error: upErr } = await sb.from('event_obligations').update(updates).eq('id', ob.id)
    if (upErr) throw upErr
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /events/obligations/:oid threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/events/obligations/:oid/complete ────────────────────────────────
router.post('/obligations/:oid/complete', requireAuth, async (req, res) => {
  try {
    const sb = adminSupabase
    const { ob, ev, rel, error } = await loadObligationCtx(req)
    if (error) return res.status(404).json({ error: 'Obligation not found.' })

    const isAssignee = ob.assigned_to_user_id === req.user.id
    if (rel !== 'full' && !isAssignee) return res.status(403).json({ error: 'You cannot complete this obligation.' })

    const proofUrl = safeHttpUrl(req.body.proof_url) || ob.proof_url
    if (ob.proof_required && !proofUrl) {
      return res.status(400).json({ error: 'This obligation requires a valid http(s) proof link before it can be completed.' })
    }

    const now = new Date().toISOString()
    const { error: upErr } = await sb.from('event_obligations')
      .update({ status: 'completed', completed_at: now, proof_url: proofUrl ?? null, updated_at: now })
      .eq('id', ob.id)
    if (upErr) throw upErr

    // Notify the event owner/creator if someone else completed it.
    const target = ev.created_by !== req.user.id ? ev.created_by : (ev.owner_id !== req.user.id ? ev.owner_id : null)
    if (target) notify(target, 'obligation.completed', `Completed: ${ob.title}`, `For event "${ev.name}"`, ev.id)

    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'POST complete threw')
    res.status(500).json({ error: err.message })
  }
})

export default router
