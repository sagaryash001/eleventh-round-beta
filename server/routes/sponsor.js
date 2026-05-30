import { Router } from 'express'
import { adminSupabase } from '../db/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { childLogger } from '../lib/logger.js'

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

export default router
