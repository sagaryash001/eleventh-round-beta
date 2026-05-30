import { Router } from 'express'
import { adminSupabase } from '../db/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { childLogger } from '../lib/logger.js'
import { assertContractTransition } from '../lib/state-machines.js'

const router = Router()
const log    = childLogger('contracts')

// Explicit column lists — never SELECT * so we don't pull large JSONB columns
// (deliverables_snapshot, metadata, terms_markdown) on auth checks or list views.
const CONTRACT_COLS = [
  'id', 'opportunity_id', 'application_id', 'sponsor_id', 'fighter_id',
  'value_usd', 'platform_fee_bps', 'payment_schedule',
  'start_date', 'end_date', 'deliverables_snapshot', 'terms_markdown',
  'status', 'sponsor_accepted_at', 'sponsor_accepted_ip',
  'fighter_accepted_at', 'fighter_accepted_ip',
  'terminated_by', 'termination_reason', 'completed_at', 'terminated_at',
  'metadata', 'created_at', 'updated_at',
].join(', ')

// Lightweight version for list endpoints — omits large text/JSONB fields
const CONTRACT_LIST_COLS = [
  'id', 'opportunity_id', 'application_id', 'sponsor_id', 'fighter_id',
  'value_usd', 'platform_fee_bps', 'payment_schedule',
  'start_date', 'end_date', 'status',
  'sponsor_accepted_at', 'fighter_accepted_at',
  'terminated_at', 'completed_at', 'created_at', 'updated_at',
].join(', ')

const OBLIGATION_COLS = [
  'id', 'owner_id', 'contract_id', 'title', 'description',
  'due_date', 'status', 'priority', 'category',
  'deliverable_type', 'recurrence', 'proof_required',
  'overdue_notified_at', 'created_at', 'updated_at',
].join(', ')

const MILESTONE_COLS = 'id, contract_id, name, amount_usd, due_date, status, sequence, created_at, updated_at'

// ── POST /api/contracts — create from accepted application ────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'sponsor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only sponsors can create contracts.' })
    }

    const {
      application_id, value_usd, payment_schedule = 'upfront',
      start_date, end_date, terms_markdown,
    } = req.body

    if (!application_id) return res.status(400).json({ error: 'application_id required.' })
    if (!value_usd || value_usd < 0) return res.status(400).json({ error: 'value_usd required.' })

    // Verify application is accepted and belongs to this sponsor
    const { data: app, error: appErr } = await adminSupabase
      .from('applications')
      .select('id, opportunity_id, fighter_id, sponsor_id, status')
      .eq('id', application_id)
      .maybeSingle()

    if (appErr) throw appErr
    if (!app) return res.status(404).json({ error: 'Application not found.' })
    if (app.status !== 'accepted') return res.status(400).json({ error: 'Application must be accepted before creating a contract.' })
    if (app.sponsor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not your application.' })
    }

    // Prevent duplicate contract for same application
    const { data: existing } = await adminSupabase
      .from('contracts')
      .select('id')
      .eq('application_id', application_id)
      .is('deleted_at', null)
      .maybeSingle()
    if (existing) return res.status(409).json({ error: 'A contract already exists for this application.', contract_id: existing.id })

    // Fetch opportunity deliverables for snapshot
    const { data: opp } = await adminSupabase
      .from('sponsorship_opportunities')
      .select('deliverables, title')
      .eq('id', app.opportunity_id)
      .maybeSingle()

    const { data: contract, error: cErr } = await adminSupabase
      .from('contracts')
      .insert({
        application_id,
        opportunity_id:       app.opportunity_id,
        sponsor_id:           app.sponsor_id,
        fighter_id:           app.fighter_id,
        value_usd:            Number(value_usd),
        platform_fee_bps:     0,
        payment_schedule,
        start_date:           start_date || null,
        end_date:             end_date   || null,
        deliverables_snapshot: opp?.deliverables ?? [],
        terms_markdown:       terms_markdown?.trim() || null,
        status:               'draft',
      })
      .select(CONTRACT_COLS)
      .maybeSingle()

    if (cErr) throw cErr

    // Re-fetch (PostgREST service-role quirk)
    const { data } = await adminSupabase.from('contracts').select(CONTRACT_COLS).eq('id', contract.id).maybeSingle()

    res.status(201).json({ ok: true, contract: data })
  } catch (err) {
    log.error({ err }, 'POST /contracts threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/contracts — list user's contracts ────────────────────────────────
// ?limit=20&before=<ISO> (cursor pagination on created_at)
router.get('/', requireAuth, async (req, res) => {
  try {
    const uid    = req.user.id
    const col    = req.user.role === 'sponsor' ? 'sponsor_id' : 'fighter_id'
    const limit  = Math.min(Number(req.query.limit) || 20, 100)
    const before = req.query.before

    let q = req.user.role === 'admin'
      ? adminSupabase.from('contracts').select(CONTRACT_LIST_COLS).is('deleted_at', null)
      : adminSupabase.from('contracts').select(CONTRACT_LIST_COLS).eq(col, uid).is('deleted_at', null)

    q = q.order('created_at', { ascending: false }).limit(limit + 1)
    if (before) q = q.lt('created_at', before)

    const { data, error } = await q
    if (error) throw error

    const has_more = (data ?? []).length > limit
    res.json({ ok: true, contracts: (data ?? []).slice(0, limit), has_more })
  } catch (err) {
    log.error({ err }, 'GET /contracts threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/contracts/:id ────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data: contract, error } = await adminSupabase
      .from('contracts')
      .select(CONTRACT_COLS)
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw error
    if (!contract) return res.status(404).json({ error: 'Not found.' })

    const uid = req.user.id
    if (contract.sponsor_id !== uid && contract.fighter_id !== uid && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden.' })
    }

    // Enrich with obligations
    const { data: obligations } = await adminSupabase
      .from('obligations')
      .select(OBLIGATION_COLS)
      .eq('contract_id', req.params.id)
      .order('due_date', { ascending: true })

    res.json({ ok: true, contract, obligations: obligations ?? [] })
  } catch (err) {
    log.error({ err }, 'GET /contracts/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/contracts/:id — update draft contract ─────────────────────────
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { data: contract, error: fErr } = await adminSupabase
      .from('contracts').select('id, sponsor_id, status').eq('id', req.params.id).maybeSingle()
    if (fErr) throw fErr
    if (!contract) return res.status(404).json({ error: 'Not found.' })
    if (contract.sponsor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden.' })
    }
    if (contract.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft contracts can be edited.' })
    }

    const WRITABLE = ['value_usd','payment_schedule','start_date','end_date','terms_markdown','deliverables_snapshot']
    const updates = {}
    for (const key of WRITABLE) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No updatable fields provided.' })

    const { error: uErr } = await adminSupabase.from('contracts').update(updates).eq('id', req.params.id)
    if (uErr) throw uErr

    const { data } = await adminSupabase.from('contracts').select(CONTRACT_COLS).eq('id', req.params.id).maybeSingle()
    res.json({ ok: true, contract: data })
  } catch (err) {
    log.error({ err }, 'PATCH /contracts/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/contracts/:id/accept — two-party signoff ───────────────────────
router.post('/:id/accept', requireAuth, async (req, res) => {
  try {
    const { data: contract, error: fErr } = await adminSupabase
      .from('contracts').select('id, sponsor_id, fighter_id, status, sponsor_accepted_at, fighter_accepted_at, deliverables_snapshot, end_date').eq('id', req.params.id).maybeSingle()
    if (fErr) throw fErr
    if (!contract) return res.status(404).json({ error: 'Not found.' })

    const uid  = req.user.id
    const role = req.user.role
    // Admin acts as the party whose slot is still unfilled, not both at once.
    const isSponsor = uid === contract.sponsor_id || (role === 'admin' && !contract.sponsor_accepted_at)
    const isFighter = uid === contract.fighter_id || (role === 'admin' && !contract.fighter_accepted_at && contract.status === 'pending_fighter')

    if (!isSponsor && !isFighter) return res.status(403).json({ error: 'Forbidden.' })

    const ip  = req.ip ?? null
    const now = new Date().toISOString()
    const updates = {}

    if (isSponsor && !contract.sponsor_accepted_at) {
      updates.sponsor_accepted_at = now
      updates.sponsor_accepted_ip = ip
      if (contract.status === 'draft') updates.status = 'pending_fighter'
    } else if (isFighter && !contract.fighter_accepted_at && contract.status === 'pending_fighter') {
      updates.fighter_accepted_at = now
      updates.fighter_accepted_ip = ip
      updates.status = 'active'
    } else {
      return res.status(400).json({ error: 'No acceptance action available for your role at this stage.' })
    }

    const { error: uErr } = await adminSupabase.from('contracts').update(updates).eq('id', req.params.id)
    if (uErr) throw uErr

    const { data: updated } = await adminSupabase.from('contracts').select(CONTRACT_COLS).eq('id', req.params.id).maybeSingle()

    // When contract becomes active, generate obligations from deliverables_snapshot
    if (updated.status === 'active' && Array.isArray(updated.deliverables_snapshot) && updated.deliverables_snapshot.length) {
      const obligationRows = updated.deliverables_snapshot.map(d => ({
        owner_id:         updated.fighter_id,
        contract_id:      updated.id,
        title:            d.notes ? `${d.type}: ${d.notes}` : d.type,
        description:      d.notes ?? null,
        due_date:         updated.end_date ? new Date(updated.end_date).toISOString() : new Date(Date.now() + 30 * 86400_000).toISOString(),
        status:           'pending',
        priority:         'medium',
        deliverable_type: d.type,
        recurrence:       'once',
        proof_required:   true,
        category:         'sponsor',
      }))
      await adminSupabase.from('obligations').insert(obligationRows)
    }

    // Queue outbox event
    await adminSupabase.from('outbox_events').insert({
      event_type:     updated.status === 'active' ? 'contract.signed' : 'contract.pending_signature',
      aggregate_type: 'contract',
      aggregate_id:   updated.id,
      payload: {
        contract_id: updated.id,
        sponsor_id:  updated.sponsor_id,
        fighter_id:  updated.fighter_id,
        status:      updated.status,
      },
    }).catch(() => {})

    res.json({ ok: true, contract: updated })
  } catch (err) {
    log.error({ err }, 'POST /contracts/:id/accept threw')
    res.status(err.status || 500).json({ error: err.message })
  }
})

// ── POST /api/contracts/:id/terminate ────────────────────────────────────────
router.post('/:id/terminate', requireAuth, async (req, res) => {
  try {
    const { termination_reason } = req.body
    const { data: contract, error: fErr } = await adminSupabase
      .from('contracts').select('id, sponsor_id, fighter_id, status').eq('id', req.params.id).maybeSingle()
    if (fErr) throw fErr
    if (!contract) return res.status(404).json({ error: 'Not found.' })

    const uid = req.user.id
    if (contract.sponsor_id !== uid && contract.fighter_id !== uid && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden.' })
    }
    try { assertContractTransition(contract, 'terminated', uid, req.user.role) } catch (e) {
      return res.status(400).json({ error: e.message })
    }

    const { error: uErr } = await adminSupabase.from('contracts').update({
      status:             'terminated',
      terminated_by:      uid,
      termination_reason: termination_reason?.trim() || null,
      terminated_at:      new Date().toISOString(),
    }).eq('id', req.params.id)
    if (uErr) throw uErr

    const { data } = await adminSupabase.from('contracts').select(CONTRACT_COLS).eq('id', req.params.id).maybeSingle()
    res.json({ ok: true, contract: data })
  } catch (err) {
    log.error({ err }, 'POST /contracts/:id/terminate threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/contracts/:id/obligations ────────────────────────────────────────
router.get('/:id/obligations', requireAuth, async (req, res) => {
  try {
    const { data: contract } = await adminSupabase
      .from('contracts').select('sponsor_id, fighter_id').eq('id', req.params.id).maybeSingle()
    if (!contract) return res.status(404).json({ error: 'Not found.' })

    const uid = req.user.id
    if (contract.sponsor_id !== uid && contract.fighter_id !== uid && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden.' })
    }

    const limit = Math.min(Number(req.query.limit) || 100, 500)

    const { data, error } = await adminSupabase
      .from('obligations')
      .select(OBLIGATION_COLS)
      .eq('contract_id', req.params.id)
      .order('due_date', { ascending: true })
      .limit(limit)
    if (error) throw error

    res.json({ ok: true, obligations: data ?? [] })
  } catch (err) {
    log.error({ err }, 'GET /contracts/:id/obligations threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/contracts/:id/obligations — add ad-hoc obligation ───────────────
router.post('/:id/obligations', requireAuth, async (req, res) => {
  try {
    const { data: contract } = await adminSupabase
      .from('contracts').select('sponsor_id, fighter_id, status').eq('id', req.params.id).maybeSingle()
    if (!contract) return res.status(404).json({ error: 'Not found.' })

    if (contract.sponsor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the sponsor can add obligations.' })
    }
    if (!['active', 'pending_fighter'].includes(contract.status)) {
      return res.status(400).json({ error: 'Can only add obligations to active contracts.' })
    }

    const { title, description, due_date, deliverable_type, proof_required = true } = req.body
    if (!title || !due_date) return res.status(400).json({ error: 'title and due_date required.' })

    const { data, error } = await adminSupabase
      .from('obligations')
      .insert({
        owner_id:         contract.fighter_id,
        contract_id:      req.params.id,
        title:            title.trim(),
        description:      description?.trim() || null,
        due_date,
        status:           'pending',
        priority:         'medium',
        deliverable_type: deliverable_type || null,
        proof_required,
        category:         'sponsor',
      })
      .select(OBLIGATION_COLS)
      .maybeSingle()
    if (error) throw error

    res.status(201).json({ ok: true, obligation: data })
  } catch (err) {
    log.error({ err }, 'POST /contracts/:id/obligations threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/contracts/:id/milestones ─────────────────────────────────────────
router.get('/:id/milestones', requireAuth, async (req, res) => {
  try {
    const { data: contract } = await adminSupabase
      .from('contracts').select('sponsor_id, fighter_id').eq('id', req.params.id).maybeSingle()
    if (!contract) return res.status(404).json({ error: 'Not found.' })
    const uid = req.user.id
    if (contract.sponsor_id !== uid && contract.fighter_id !== uid && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden.' })
    }
    const { data, error } = await adminSupabase
      .from('payment_milestones')
      .select(MILESTONE_COLS)
      .eq('contract_id', req.params.id)
      .order('sequence', { ascending: true })
      .limit(200)
    if (error) throw error
    res.json({ ok: true, milestones: data ?? [] })
  } catch (err) {
    log.error({ err }, 'GET /contracts/:id/milestones threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/contracts/:id/milestones ────────────────────────────────────────
router.post('/:id/milestones', requireAuth, async (req, res) => {
  try {
    const { data: contract } = await adminSupabase
      .from('contracts').select('sponsor_id, payment_schedule').eq('id', req.params.id).maybeSingle()
    if (!contract) return res.status(404).json({ error: 'Not found.' })
    if (contract.sponsor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only sponsors can add milestones.' })
    }

    const { name, amount_usd, due_date, sequence } = req.body
    if (!name || !amount_usd) return res.status(400).json({ error: 'name and amount_usd required.' })

    // Auto-assign next sequence if not provided
    let seq = sequence
    if (!seq) {
      const { count } = await adminSupabase
        .from('payment_milestones')
        .select('id', { count: 'exact', head: true })
        .eq('contract_id', req.params.id)
      seq = (count ?? 0) + 1
    }

    const { data, error } = await adminSupabase
      .from('payment_milestones')
      .insert({ contract_id: req.params.id, name: name.trim(), amount_usd: Number(amount_usd), due_date: due_date ?? null, sequence: seq })
      .select(MILESTONE_COLS).maybeSingle()
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'A milestone with that sequence already exists.' })
      throw error
    }
    res.status(201).json({ ok: true, milestone: data })
  } catch (err) {
    log.error({ err }, 'POST /contracts/:id/milestones threw')
    res.status(500).json({ error: err.message })
  }
})

export default router
