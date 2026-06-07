import { Router } from 'express'
import { adminSupabase } from '../db/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { childLogger } from '../lib/logger.js'
import { computeMatchesForOpp } from '../lib/matching.js'

const router = Router()
const log = childLogger('sponsor')

function requireSponsor(req, res, next) {
  if (req.user?.role !== 'sponsor' && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Sponsor access required.' })
  }
  next()
}

const guard = [requireAuth, requireSponsor]

// Fields a sponsor is allowed to set/update on their own profile.
const WRITABLE = [
  'company_name', 'logo_path', 'website_url', 'industry', 'company_size',
  'hq_country', 'hq_region', 'description', 'budget_min_usd', 'budget_max_usd',
  'preferred_demographics', 'preferred_weight_classes', 'preferred_promotions',
  'campaign_goals', 'visibility',
]

function pick(body, keys) {
  const out = {}
  for (const k of keys) if (body[k] !== undefined) out[k] = body[k]
  return out
}

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'sponsor'
}

// ── GET /api/sponsor/status ───────────────────────────────────────────────────
// Has this sponsor completed onboarding (i.e. does a sponsor_profiles row exist)?
router.get('/status', ...guard, async (req, res) => {
  try {
    const { data, error } = await adminSupabase
      .from('sponsor_profiles')
      .select('user_id')
      .eq('user_id', req.user.id)
      .maybeSingle()
    if (error) throw error
    res.json({ onboarded: !!data })
  } catch (err) {
    log.error({ err }, '/sponsor/status threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/sponsor/onboard ─────────────────────────────────────────────────
// Create the sponsor_profiles row. Requires company_name. Idempotent (upsert).
router.post('/onboard', ...guard, async (req, res) => {
  try {
    const uid = req.user.id
    const company_name = (req.body.company_name || '').trim()
    if (!company_name) {
      return res.status(400).json({ error: 'Company name is required.' })
    }

    const row = { user_id: uid, company_name, ...pick(req.body, WRITABLE) }

    // Generate a public_slug only if one doesn't exist yet.
    const { data: existing } = await adminSupabase
      .from('sponsor_profiles')
      .select('public_slug')
      .eq('user_id', uid)
      .maybeSingle()

    if (!existing?.public_slug) {
      const base = slugify(company_name)
      let slug = base
      // Two attempts: bare slug, then slug + short random suffix.
      for (let attempt = 0; attempt < 2; attempt++) {
        const { data: clash } = await adminSupabase
          .from('sponsor_profiles')
          .select('user_id')
          .eq('public_slug', slug)
          .maybeSingle()
        if (!clash) break
        slug = `${base}-${Math.random().toString(36).slice(2, 6)}`
      }
      row.public_slug = slug
    }

    const { data, error } = await adminSupabase
      .from('sponsor_profiles')
      .upsert(row, { onConflict: 'user_id' })
      .select()
      .maybeSingle()
    if (error) throw error

    res.status(201).json({ ok: true, sponsorProfile: data })
  } catch (err) {
    log.error({ err }, '/sponsor/onboard threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/sponsor/dashboard ────────────────────────────────────────────────
router.get('/dashboard', ...guard, async (req, res) => {
  try {
    const uid = req.user.id
    const [{ data: profile }, { data: sponsorProfile }] = await Promise.all([
      adminSupabase.from('profiles')
        .select('id, name, email, role, avatar_url')
        .eq('id', uid).maybeSingle(),
      adminSupabase.from('sponsor_profiles')
        .select('user_id, company_name, logo_path, website_url, industry, company_size, hq_country, hq_region, description, budget_min_usd, budget_max_usd, preferred_demographics, preferred_weight_classes, preferred_promotions, campaign_goals, is_verified, visibility, total_active_contracts, public_slug')
        .eq('user_id', uid).maybeSingle(),
    ])
    res.json({ profile, sponsorProfile: sponsorProfile ?? null })
  } catch (err) {
    log.error({ err }, '/sponsor/dashboard threw')
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/sponsor/profile ────────────────────────────────────────────────
router.patch('/profile', ...guard, async (req, res) => {
  try {
    const uid = req.user.id
    const updates = pick(req.body, WRITABLE)
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided.' })
    }
    updates.updated_at = new Date().toISOString()

    const { data, error } = await adminSupabase
      .from('sponsor_profiles')
      .update(updates)
      .eq('user_id', uid)
      .select()
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Sponsor profile not found. Complete onboarding first.' })

    // Allow updating the display name on the base profile too.
    if (req.body.name) {
      await adminSupabase.from('profiles').update({ name: req.body.name }).eq('id', uid)
    }

    res.json({ ok: true, sponsorProfile: data })
  } catch (err) {
    log.error({ err }, 'PATCH /sponsor/profile threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/sponsor/marketplace — sponsor's marketplace analytics ─────────────
router.get('/marketplace', ...guard, async (req, res) => {
  try {
    const uid = req.user.id
    const [
      { data: opps },
      { data: apps },
      { data: contracts },
      { data: payments },
    ] = await Promise.all([
      adminSupabase.from('sponsorship_opportunities').select('id, status').eq('sponsor_id', uid),
      adminSupabase.from('applications').select('id, status').eq('sponsor_id', uid),
      adminSupabase.from('contracts').select('id, status, value_usd').eq('sponsor_id', uid).is('deleted_at', null),
      adminSupabase.from('sponsorship_payments').select('amount_usd, status').eq('sponsor_id', uid),
    ])

    const publishedOpps   = (opps ?? []).filter(o => o.status === 'published').length
    const activeContracts = (contracts ?? []).filter(c => c.status === 'active').length
    const totalSpent      = (payments ?? [])
      .filter(p => p.status === 'succeeded')
      .reduce((s, p) => s + (p.amount_usd ?? 0), 0)

    const byStatus = {}
    for (const a of (apps ?? [])) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1
    }

    res.json({
      total_opportunities:   (opps ?? []).length,
      published_opportunities: publishedOpps,
      total_applications:    (apps ?? []).length,
      accepted_applications: byStatus.accepted ?? 0,
      active_contracts:      activeContracts,
      total_contracts:       (contracts ?? []).length,
      total_spent_usd:       totalSpent,
      applications_by_status: byStatus,
    })
  } catch (err) {
    log.error({ err }, 'GET /sponsor/marketplace threw')
    res.status(500).json({ error: err.message })
  }
})

// ── Shared: verify sponsor is verified and owns an opportunity ─────────────────
async function ownedVerifiedOpp(uid, oid, role) {
  if (role !== 'admin') {
    const { data: sp } = await adminSupabase
      .from('sponsor_profiles').select('is_verified').eq('user_id', uid).maybeSingle()
    if (!sp?.is_verified) return { err: 'Sponsor profile must be verified to access matches.' }
  }
  const { data: opp } = await adminSupabase
    .from('sponsorship_opportunities')
    .select('*').eq('id', oid).is('deleted_at', null).maybeSingle()
  if (!opp) return { err: 'Opportunity not found.' }
  if (opp.sponsor_id !== uid && role !== 'admin') return { err: 'Not your opportunity.' }
  return { opp }
}

// ── GET /api/sponsor/opportunities/:id/matches ────────────────────────────────
router.get('/opportunities/:id/matches', ...guard, async (req, res) => {
  try {
    const { err, opp } = await ownedVerifiedOpp(req.user.id, req.params.id, req.user.role)
    if (err) return res.status(403).json({ error: err })

    const { data: rows, error } = await adminSupabase
      .from('matches')
      .select('id, fighter_id, score, breakdown, reasons, status, computed_at')
      .eq('opportunity_id', opp.id)
      .eq('stale', false)
      .neq('status', 'dismissed')
      .order('score', { ascending: false })
      .limit(50)
    if (error) throw error

    if (!(rows ?? []).length) return res.json({ ok: true, matches: [], recomputed: false })

    const fids = rows.map(m => m.fighter_id)
    const [{ data: profiles }, { data: fps }, { data: socials }] = await Promise.all([
      adminSupabase.from('profiles').select('id, name, avatar_url').in('id', fids),
      adminSupabase.from('fighter_profiles').select('user_id, weight_class, current_promotion, base_city, sponsorship_interests').in('user_id', fids),
      adminSupabase.from('social_accounts').select('user_id, platform, follower_count').in('user_id', fids),
    ])

    const prMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
    const fpMap = Object.fromEntries((fps ?? []).map(f => [f.user_id, f]))
    const socMap = {}
    for (const s of (socials ?? [])) {
      if (!socMap[s.user_id]) socMap[s.user_id] = []
      socMap[s.user_id].push(s)
    }

    const matches = rows.map(m => ({
      ...m,
      fighter:         prMap[m.fighter_id] ?? null,
      fighter_detail:  fpMap[m.fighter_id] ?? null,
      total_followers: (socMap[m.fighter_id] ?? []).reduce((s, a) => s + (a.follower_count || 0), 0),
      platforms:       (socMap[m.fighter_id] ?? []).map(a => a.platform),
    }))

    res.json({ ok: true, matches })
  } catch (err) {
    log.error({ err }, 'GET /sponsor/opportunities/:id/matches threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/sponsor/opportunities/:id/recompute-matches ─────────────────────
router.post('/opportunities/:id/recompute-matches', ...guard, async (req, res) => {
  try {
    const { err, opp } = await ownedVerifiedOpp(req.user.id, req.params.id, req.user.role)
    if (err) return res.status(403).json({ error: err })

    await adminSupabase.from('matches').update({ stale: true }).eq('opportunity_id', opp.id)

    const computed = await computeMatchesForOpp(opp, adminSupabase)
    if (computed.length) {
      await adminSupabase.from('matches').upsert(
        computed.map(m => ({
          opportunity_id: opp.id,
          sponsor_id:     opp.sponsor_id,
          fighter_id:     m.fighter_id,
          score:          m.score,
          breakdown:      m.breakdown,
          reasons:        m.reasons,
          algorithm_ver:  'v1-rule',
          status:         'suggested',
          stale:          false,
          computed_at:    new Date().toISOString(),
        })),
        { onConflict: 'opportunity_id,fighter_id' },
      )
    }

    log.info({ oid: opp.id, count: computed.length }, 'sponsor recomputed matches')
    res.json({ ok: true, computed: computed.length })
  } catch (err) {
    log.error({ err }, 'POST /sponsor/opportunities/:id/recompute-matches threw')
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/sponsor/matches/:matchId/status ────────────────────────────────
router.patch('/matches/:matchId/status', ...guard, async (req, res) => {
  try {
    const { status } = req.body
    const ALLOWED = ['viewed', 'dismissed', 'invited']
    if (!ALLOWED.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${ALLOWED.join(', ')}` })
    }

    const { data: match } = await adminSupabase
      .from('matches').select('id, sponsor_id')
      .eq('id', req.params.matchId).maybeSingle()
    if (!match) return res.status(404).json({ error: 'Match not found.' })
    if (match.sponsor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not your match.' })
    }

    const { error } = await adminSupabase.from('matches')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', match.id)
    if (error) throw error

    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /sponsor/matches/:id/status threw')
    res.status(500).json({ error: err.message })
  }
})

export default router
