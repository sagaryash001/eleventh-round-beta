import { Router } from 'express'
import { adminSupabase } from '../db/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { childLogger } from '../lib/logger.js'
import { computeMatchScore } from '../lib/matching.js'

const router = Router()
const log    = childLogger('applications')

const APPLICATION_COLS = [
  'id', 'opportunity_id', 'fighter_id', 'sponsor_id', 'direction', 'status',
  'cover_message', 'match_score', 'price_proposed_usd',
  'reviewed_by', 'reviewed_at', 'decided_at', 'rejection_reason',
  'metadata', 'created_at', 'updated_at',
].join(', ')

// Only the fields computeMatchScore() actually reads
const FIGHTER_PROFILE_MATCH_COLS = 'user_id, weight_class, current_promotion, nationality, sponsorship_interests'
const SOCIAL_MATCH_COLS          = 'user_id, follower_count, engagement_rate_bps'

// Legal status transitions for each actor
const FIGHTER_TRANSITIONS = { applied: ['withdrawn'], under_review: ['withdrawn'], shortlisted: ['withdrawn'] }
const SPONSOR_TRANSITIONS  = { applied: ['under_review','rejected'], under_review: ['shortlisted','rejected'], shortlisted: ['accepted','rejected'] }

// ── POST /api/applications — fighter applies ───────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'fighter' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only fighters can apply to opportunities.' })
    }
    const { opportunity_id, cover_message } = req.body
    if (!opportunity_id) return res.status(400).json({ error: 'opportunity_id required.' })

    // Verify the opp exists and is published
    const { data: opp, error: oppErr } = await adminSupabase
      .from('sponsorship_opportunities')
      .select('id, sponsor_id, status, requirements')
      .eq('id', opportunity_id)
      .maybeSingle()
    if (oppErr) throw oppErr
    if (!opp) return res.status(404).json({ error: 'Opportunity not found.' })
    if (opp.status !== 'published') return res.status(400).json({ error: 'Opportunity is not open for applications.' })

    // Compute match score to cache on the application row
    const [{ data: fp }, { data: socials }] = await Promise.all([
      adminSupabase.from('fighter_profiles').select(FIGHTER_PROFILE_MATCH_COLS).eq('user_id', req.user.id).maybeSingle(),
      adminSupabase.from('social_accounts').select(SOCIAL_MATCH_COLS).eq('user_id', req.user.id),
    ])
    const { score } = computeMatchScore(opp, fp ?? {}, socials ?? [])

    const { data, error } = await adminSupabase
      .from('applications')
      .insert({
        opportunity_id,
        fighter_id:    req.user.id,
        sponsor_id:    opp.sponsor_id,
        direction:     'fighter_applied',
        status:        'applied',
        cover_message: cover_message?.trim() || null,
        match_score:   score,
      })
      .select(APPLICATION_COLS)
      .maybeSingle()

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'You have already applied to this opportunity.' })
      throw error
    }

    // Increment application_count
    adminSupabase
      .from('sponsorship_opportunities')
      .update({ application_count: (opp.application_count ?? 0) + 1 })
      .eq('id', opportunity_id)
      .then(() => {}).catch(() => {})

    res.status(201).json({ ok: true, application: data })
  } catch (err) {
    log.error({ err }, 'POST /applications threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/applications/mine — fighter's own applications ───────────────────
// ?limit=20&before=<ISO> (cursor pagination on created_at)
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit) || 20, 100)
    const before = req.query.before

    let q = adminSupabase
      .from('applications')
      .select(APPLICATION_COLS)
      .eq('fighter_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit + 1)

    if (before) q = q.lt('created_at', before)

    const { data: apps, error } = await q
    if (error) throw error

    const has_more = (apps ?? []).length > limit
    const page     = (apps ?? []).slice(0, limit)

    // Enrich with opportunity + sponsor detail
    const oppIds     = [...new Set(page.map(a => a.opportunity_id))]
    const sponsorIds = [...new Set(page.map(a => a.sponsor_id))]
    let oppMap = {}, sponsorMap = {}
    const fetches = []
    if (oppIds.length)     fetches.push(adminSupabase.from('sponsorship_opportunities').select('id, title, campaign_type, budget_min_usd, budget_max_usd, status').in('id', oppIds).then(r => { for (const o of r.data ?? []) oppMap[o.id] = o }))
    if (sponsorIds.length) fetches.push(adminSupabase.from('sponsor_profiles').select('user_id, company_name, logo_path, is_verified').in('user_id', sponsorIds).then(r => { for (const s of r.data ?? []) sponsorMap[s.user_id] = s }))
    await Promise.all(fetches)

    const data = page.map(a => ({
      ...a,
      opportunity:    oppMap[a.opportunity_id]  ?? null,
      sponsor_detail: sponsorMap[a.sponsor_id]  ?? null,
    }))
    res.json({ ok: true, applications: data, has_more })
  } catch (err) {
    log.error({ err }, 'GET /applications/mine threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/applications/:id ─────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await adminSupabase
      .from('applications')
      .select(APPLICATION_COLS)
      .eq('id', req.params.id)
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Not found.' })
    if (data.fighter_id !== req.user.id && data.sponsor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden.' })
    }
    res.json({ ok: true, application: data })
  } catch (err) {
    log.error({ err }, 'GET /applications/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/applications/:id — status transition ───────────────────────────
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { status: newStatus, rejection_reason } = req.body
    if (!newStatus) return res.status(400).json({ error: 'status required.' })

    const { data: app, error: fetchErr } = await adminSupabase
      .from('applications')
      .select(APPLICATION_COLS)
      .eq('id', req.params.id)
      .maybeSingle()
    if (fetchErr) throw fetchErr
    if (!app) return res.status(404).json({ error: 'Not found.' })

    const role = req.user.role
    const uid  = req.user.id

    // Guard: who can do what
    let allowed = []
    if (uid === app.fighter_id || role === 'admin')  allowed = [...allowed, ...(FIGHTER_TRANSITIONS[app.status] ?? [])]
    if (uid === app.sponsor_id || role === 'admin')  allowed = [...allowed, ...(SPONSOR_TRANSITIONS[app.status] ?? [])]

    if (!allowed.includes(newStatus)) {
      return res.status(400).json({
        error: `Cannot transition from '${app.status}' to '${newStatus}' as ${role}.`,
      })
    }

    const updates = {
      status:     newStatus,
      updated_at: new Date().toISOString(),
    }
    if (newStatus === 'under_review' || newStatus === 'shortlisted' || newStatus === 'rejected' || newStatus === 'accepted') {
      updates.reviewed_by = uid
      updates.reviewed_at = new Date().toISOString()
    }
    if (newStatus === 'accepted' || newStatus === 'rejected') {
      updates.decided_at = new Date().toISOString()
    }
    if (newStatus === 'rejected' && rejection_reason) {
      updates.rejection_reason = rejection_reason.trim()
    }

    // Update and then fetch separately — chained .select() after .update()
    // returns null on tables with no explicit PostgREST SELECT grants,
    // even with service role, due to a PostgREST RLS interaction.
    const { error: updateErr } = await adminSupabase
      .from('applications')
      .update(updates)
      .eq('id', req.params.id)
    if (updateErr) throw updateErr

    const { data, error: refetchErr } = await adminSupabase
      .from('applications')
      .select(APPLICATION_COLS)
      .eq('id', req.params.id)
      .maybeSingle()
    if (refetchErr) throw refetchErr

    res.json({ ok: true, application: data })
  } catch (err) {
    log.error({ err }, 'PATCH /applications/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/applications/invite — sponsor invites fighter ───────────────────
router.post('/invite', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'sponsor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only sponsors can invite fighters.' })
    }
    const { opportunity_id, fighter_id, cover_message } = req.body
    if (!opportunity_id || !fighter_id) {
      return res.status(400).json({ error: 'opportunity_id and fighter_id required.' })
    }

    const { data: opp } = await adminSupabase
      .from('sponsorship_opportunities')
      .select('id, sponsor_id, status')
      .eq('id', opportunity_id)
      .maybeSingle()
    if (!opp) return res.status(404).json({ error: 'Opportunity not found.' })
    if (opp.sponsor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not your opportunity.' })
    }

    const { data: inserted, error } = await adminSupabase
      .from('applications')
      .insert({
        opportunity_id,
        fighter_id,
        sponsor_id:    req.user.id,
        direction:     'sponsor_invited',
        status:        'applied',
        cover_message: cover_message?.trim() || null,
      })
      .select(APPLICATION_COLS)
      .maybeSingle()

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'This fighter has already been invited or applied.' })
      throw error
    }

    // Re-fetch to guarantee full row (avoid PostgREST .select() chain null issue)
    const { data } = inserted
      ? await adminSupabase.from('applications').select(APPLICATION_COLS).eq('id', inserted.id).maybeSingle()
      : { data: inserted }

    res.status(201).json({ ok: true, application: data })
  } catch (err) {
    log.error({ err }, 'POST /applications/invite threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/applications/:applicationId/accept-contract ─────────────────────
// Atomically accepts a shortlisted application and creates a draft contract.
// Idempotent: if a contract already exists for the application, returns it.
router.post('/:applicationId/accept-contract', requireAuth, async (req, res) => {
  try {
    const { role, id: uid } = req.user
    if (role !== 'sponsor' && role !== 'admin') {
      return res.status(403).json({ error: 'Only sponsors can accept applications.' })
    }

    const { data: app, error: appErr } = await adminSupabase
      .from('applications')
      .select(APPLICATION_COLS)
      .eq('id', req.params.applicationId)
      .maybeSingle()
    if (appErr) throw appErr
    if (!app) return res.status(404).json({ error: 'Application not found.' })
    if (app.sponsor_id !== uid && role !== 'admin') {
      return res.status(403).json({ error: 'Not your application.' })
    }
    if (!['shortlisted', 'accepted'].includes(app.status)) {
      return res.status(400).json({ error: `Application must be shortlisted to accept. Current status: ${app.status}` })
    }

    // Idempotent: return existing contract if one exists
    const { data: existing } = await adminSupabase
      .from('contracts')
      .select('id, opportunity_id, application_id, sponsor_id, fighter_id, value_usd, payment_schedule, start_date, end_date, status, created_at, updated_at')
      .eq('application_id', req.params.applicationId)
      .is('deleted_at', null)
      .maybeSingle()
    if (existing) {
      return res.json({ ok: true, application: app, contract: existing, created: false })
    }

    // Accept application if not already accepted
    if (app.status !== 'accepted') {
      const now = new Date().toISOString()
      const { error: uErr } = await adminSupabase
        .from('applications')
        .update({ status: 'accepted', reviewed_by: uid, reviewed_at: now, decided_at: now, updated_at: now })
        .eq('id', req.params.applicationId)
      if (uErr) throw uErr
    }

    // Fetch opportunity for deliverables + budget default
    const { data: opp } = await adminSupabase
      .from('sponsorship_opportunities')
      .select('id, deliverables, budget_min_usd')
      .eq('id', app.opportunity_id)
      .maybeSingle()

    const value_usd = opp?.budget_min_usd ?? 0

    const { data: contract, error: cErr } = await adminSupabase
      .from('contracts')
      .insert({
        application_id:        req.params.applicationId,
        opportunity_id:        app.opportunity_id,
        sponsor_id:            app.sponsor_id,
        fighter_id:            app.fighter_id,
        value_usd,
        platform_fee_bps:      0,
        payment_schedule:      'upfront',
        deliverables_snapshot: opp?.deliverables ?? [],
        status:                'draft',
      })
      .select('id, opportunity_id, application_id, sponsor_id, fighter_id, value_usd, payment_schedule, start_date, end_date, status, created_at, updated_at')
      .maybeSingle()
    if (cErr) throw cErr

    const { data: updatedApp } = await adminSupabase
      .from('applications').select(APPLICATION_COLS).eq('id', req.params.applicationId).maybeSingle()

    log.info({ appId: req.params.applicationId, contractId: contract?.id }, 'application accepted + contract draft created')
    res.status(201).json({ ok: true, application: updatedApp ?? app, contract, created: true })
  } catch (err) {
    log.error({ err }, 'POST /applications/:id/accept-contract threw')
    res.status(500).json({ error: err.message })
  }
})

export default router
