import { Router } from 'express'
import { adminSupabase } from '../db/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { childLogger } from '../lib/logger.js'
import { computeMatchesForOpp } from '../lib/matching.js'

const router = Router()
const log    = childLogger('opportunities')

function requireSponsor(req, res, next) {
  if (req.user?.role !== 'sponsor' && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Sponsor access required.' })
  }
  next()
}
function optionalAuth(req, res, next) { next() } // placeholder — auth already attached by middleware

const OPP_WRITABLE = [
  'title', 'description', 'campaign_type', 'budget_min_usd', 'budget_max_usd',
  'budget_per_fighter_usd', 'max_fighters', 'deliverables', 'requirements',
  'application_deadline', 'campaign_start', 'campaign_end', 'visibility',
  'location_country', 'location_region',
]
function pick(body, keys) {
  const out = {}
  for (const k of keys) if (body[k] !== undefined) out[k] = body[k]
  return out
}

// ── GET /api/opportunities — public discovery feed ────────────────────────────
router.get('/', async (req, res) => {
  try {
    const sb = adminSupabase
    const {
      search, weight_class, promotion, country,
      budget_min, budget_max, campaign_type,
      page = '1', limit: lim = '20',
    } = req.query

    let q = sb
      .from('sponsorship_opportunities')
      .select(`
        id, title, description, campaign_type, budget_min_usd, budget_max_usd,
        budget_per_fighter_usd, max_fighters, deliverables, requirements,
        application_deadline, campaign_start, campaign_end, location_country,
        location_region, view_count, application_count, published_at, status, visibility,
        sponsor_id
      `)
      .eq('status', 'published')
      .eq('visibility', 'public')
      .is('deleted_at', null)
      .order('published_at', { ascending: false })

    if (search)       q = q.textSearch('title', search, { type: 'plain' })
    if (country)      q = q.eq('location_country', country.toUpperCase())
    if (campaign_type) q = q.eq('campaign_type', campaign_type)
    if (budget_min)   q = q.gte('budget_min_usd', Number(budget_min))
    if (budget_max)   q = q.lte('budget_max_usd', Number(budget_max))

    const pageNum  = Math.max(1, Number(page))
    const pageSize = Math.min(50, Math.max(1, Number(lim)))
    q = q.range((pageNum - 1) * pageSize, pageNum * pageSize - 1)

    const { data: opps, error } = await q
    if (error) throw error

    // Enrich with sponsor detail in a second query
    const sponsorIds = [...new Set((opps ?? []).map(o => o.sponsor_id))]
    let sponsorMap = {}
    if (sponsorIds.length) {
      const { data: sps } = await sb
        .from('sponsor_profiles')
        .select('user_id, company_name, logo_path, is_verified, industry')
        .in('user_id', sponsorIds)
      for (const sp of (sps ?? [])) sponsorMap[sp.user_id] = sp
    }
    const data = (opps ?? []).map(o => ({ ...o, sponsor_detail: sponsorMap[o.sponsor_id] ?? null }))

    res.json({ ok: true, data, page: pageNum, limit: pageSize })
  } catch (err) {
    log.error({ err }, 'GET /opportunities threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/opportunities/mine — sponsor's own opportunities ─────────────────
// ?limit=20&before=<ISO> (cursor pagination)
router.get('/mine', requireAuth, requireSponsor, async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit) || 20, 100)
    const before = req.query.before

    let q = adminSupabase
      .from('sponsorship_opportunities')
      .select('*, application_count, view_count')
      .eq('sponsor_id', req.user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit + 1)

    if (before) q = q.lt('created_at', before)

    const { data, error } = await q
    if (error) throw error

    const has_more = (data ?? []).length > limit
    res.json({ ok: true, data: (data ?? []).slice(0, limit), has_more })
  } catch (err) {
    log.error({ err }, 'GET /opportunities/mine threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/opportunities — create draft ────────────────────────────────────
router.post('/', requireAuth, requireSponsor, async (req, res) => {
  try {
    if (!req.body.title?.trim()) return res.status(400).json({ error: 'Title is required.' })

    const row = {
      sponsor_id: req.user.id,
      title:      req.body.title.trim(),
      status:     'draft',
      ...pick(req.body, OPP_WRITABLE.filter(k => k !== 'title')),
    }

    const { data, error } = await adminSupabase
      .from('sponsorship_opportunities')
      .insert(row)
      .select()
      .maybeSingle()
    if (error) throw error

    res.status(201).json({ ok: true, opportunity: data })
  } catch (err) {
    log.error({ err }, 'POST /opportunities threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/opportunities/:id ────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { data: opp, error } = await adminSupabase
      .from('sponsorship_opportunities')
      .select('*')
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw error
    if (!opp) return res.status(404).json({ error: 'Not found.' })

    // Fetch sponsor detail separately (avoids PostgREST join schema issues)
    const { data: sponsorDetail } = await adminSupabase
      .from('sponsor_profiles')
      .select('company_name, logo_path, is_verified, industry, website_url')
      .eq('user_id', opp.sponsor_id)
      .maybeSingle()

    // Increment view_count asynchronously
    adminSupabase
      .from('sponsorship_opportunities')
      .update({ view_count: (opp.view_count ?? 0) + 1 })
      .eq('id', req.params.id)
      .then(() => {}).catch(() => {})

    res.json({ ok: true, opportunity: { ...opp, sponsor_detail: sponsorDetail ?? null } })
  } catch (err) {
    log.error({ err }, 'GET /opportunities/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/opportunities/:id ──────────────────────────────────────────────
router.patch('/:id', requireAuth, requireSponsor, async (req, res) => {
  try {
    // Confirm ownership
    const { data: existing, error: fetchErr } = await adminSupabase
      .from('sponsorship_opportunities')
      .select('id, sponsor_id, status')
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (fetchErr) throw fetchErr
    if (!existing) return res.status(404).json({ error: 'Not found.' })
    if (existing.sponsor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not your opportunity.' })
    }

    const updates = { ...pick(req.body, OPP_WRITABLE), updated_at: new Date().toISOString() }

    const { data, error } = await adminSupabase
      .from('sponsorship_opportunities')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .maybeSingle()
    if (error) throw error

    res.json({ ok: true, opportunity: data })
  } catch (err) {
    log.error({ err }, 'PATCH /opportunities/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/opportunities/:id/publish ───────────────────────────────────────
router.post('/:id/publish', requireAuth, requireSponsor, async (req, res) => {
  try {
    const { data: opp, error: fetchErr } = await adminSupabase
      .from('sponsorship_opportunities')
      .select('*')
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (fetchErr) throw fetchErr
    if (!opp) return res.status(404).json({ error: 'Not found.' })
    if (opp.sponsor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not your opportunity.' })
    }
    if (!opp.title) return res.status(400).json({ error: 'Title required before publishing.' })
    if (opp.status === 'published') return res.json({ ok: true, message: 'Already published.' })

    const { data, error } = await adminSupabase
      .from('sponsorship_opportunities')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .maybeSingle()
    if (error) throw error

    // Kick off match scoring asynchronously (non-blocking)
    computeMatchesForOpp(data, adminSupabase)
      .then(async matches => {
        if (!matches.length) return
        const rows = matches.map(m => ({
          opportunity_id:    data.id,
          fighter_id:        m.fighter_id,
          score:             m.score,
          factor_breakdown:  m.breakdown,
          reasons:           m.reasons,
          algorithm_version: 'v1-rule',
          stale:             false,
          computed_at:       new Date().toISOString(),
        }))
        await adminSupabase
          .from('matches')
          .upsert(rows, { onConflict: 'opportunity_id,fighter_id,algorithm_version' })
      })
      .catch(e => log.warn({ err: e }, 'match recompute failed'))

    res.json({ ok: true, opportunity: data })
  } catch (err) {
    log.error({ err }, 'POST /opportunities/:id/publish threw')
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/opportunities/:id (soft) ──────────────────────────────────────
router.delete('/:id', requireAuth, requireSponsor, async (req, res) => {
  try {
    const { data: opp } = await adminSupabase
      .from('sponsorship_opportunities')
      .select('sponsor_id')
      .eq('id', req.params.id)
      .maybeSingle()
    if (!opp) return res.status(404).json({ error: 'Not found.' })
    if (opp.sponsor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not your opportunity.' })
    }
    await adminSupabase
      .from('sponsorship_opportunities')
      .update({ deleted_at: new Date().toISOString(), status: 'archived' })
      .eq('id', req.params.id)
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'DELETE /opportunities/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/opportunities/:id/applications — sponsor view ────────────────────
router.get('/:id/applications', requireAuth, requireSponsor, async (req, res) => {
  try {
    const { data: opp } = await adminSupabase
      .from('sponsorship_opportunities')
      .select('sponsor_id')
      .eq('id', req.params.id)
      .maybeSingle()
    if (!opp) return res.status(404).json({ error: 'Not found.' })
    if (opp.sponsor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not your opportunity.' })
    }

    const limit  = Math.min(Number(req.query.limit) || 50, 200)
    const offset = Math.max(0, Number(req.query.offset) || 0)

    const { data: apps, error } = await adminSupabase
      .from('applications')
      .select('*')
      .eq('opportunity_id', req.params.id)
      .order('match_score', { ascending: false })
      .range(offset, offset + limit)
    if (error) throw error

    // Enrich with fighter profile details
    const fighterIds = (apps ?? []).map(a => a.fighter_id)
    let fighterMap = {}
    let profileMap = {}
    if (fighterIds.length) {
      const [{ data: fps }, { data: profs }] = await Promise.all([
        adminSupabase.from('fighter_profiles').select('user_id, weight_class, current_promotion, pro_status').in('user_id', fighterIds),
        adminSupabase.from('profiles').select('id, name, avatar_url').in('id', fighterIds),
      ])
      for (const fp of (fps ?? []))  fighterMap[fp.user_id] = fp
      for (const p  of (profs ?? [])) profileMap[p.id] = p
    }
    const data = (apps ?? []).map(a => ({
      ...a,
      fighter:        profileMap[a.fighter_id]  ?? null,
      fighter_detail: fighterMap[a.fighter_id]  ?? null,
    }))

    res.json({ ok: true, applications: data, limit, offset })
  } catch (err) {
    log.error({ err }, 'GET /opportunities/:id/applications threw')
    res.status(500).json({ error: err.message })
  }
})

export default router
