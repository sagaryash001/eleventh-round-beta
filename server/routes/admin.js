import { Router } from 'express'
import { adminSupabase } from '../db/supabase.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { childLogger } from '../lib/logger.js'

const router  = Router()
const log     = childLogger('admin')
const guard   = [requireAuth, requireAdmin]

// ── GET /api/admin/overview ───────────────────────────────────────────────────
router.get('/overview', ...guard, async (req, res) => {
  try {
    const sb = adminSupabase

    const [{ data: users }, { data: alts }] = await Promise.all([
      sb.from('profiles').select('id, role, account_type'),
      sb.from('alerts').select('*').eq('resolved', false).order('created_at', { ascending: false }),
    ])

    const fighters   = (users ?? []).filter(u => u.role === 'fighter').length
    const managers   = (users ?? []).filter(u => u.role === 'manager').length
    const promotions = (users ?? []).filter(u => u.account_type === 'promotion').length
    const total      = (users ?? []).length

    const alertItems = (alts ?? []).slice(0, 4).map(a => ({
      name:  a.message,
      badge: a.type === 'urgent' ? 'Urgent' : a.type === 'action' ? 'Action' : a.type === 'review' ? 'Review' : 'Info',
      type:  a.type === 'urgent' ? 'red' : a.type === 'action' ? 'red' : a.type === 'review' ? 'yellow' : 'green',
    }))

    res.json({
      total_users:     total,
      active_fighters: fighters,
      active_managers: managers,
      promotions,
      platform_health: 91,
      alerts:          alertItems,
    })
  } catch (err) {
    log.error({ err }, '/admin/overview threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/users', ...guard, async (req, res) => {
  try {
    const { data, error } = await adminSupabase
      .from('profiles')
      .select('id, name, email, role, account_type, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error

    const users = (data ?? []).map(u => ({
      id:     u.id,
      name:   u.name,
      email:  u.email,
      role:   u.role,
      status: 'Active',
      plan:   u.role === 'fighter' ? 'Pipeline Pro' : u.role === 'manager' ? 'MGMT-SUITE' : 'Free',
    }))

    res.json({ users })
  } catch (err) {
    log.error({ err }, '/admin/users threw')
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/admin/users/:id ────────────────────────────────────────────────
router.patch('/users/:id', ...guard, async (req, res) => {
  try {
    const { role, status } = req.body
    const updates = {}
    if (role)   updates.role = role
    if (status) updates.status = status

    const { error } = await adminSupabase
      .from('profiles')
      .update(updates)
      .eq('id', req.params.id)
    if (error) throw error

    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /admin/users/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/mentors ────────────────────────────────────────────────────
router.get('/mentors', ...guard, async (req, res) => {
  try {
    const [{ data: cons }, { data: bookings }] = await Promise.all([
      adminSupabase.from('consultants').select('*').order('created_at'),
      adminSupabase.from('bookings').select('status').eq('status', 'completed'),
    ])

    const consultants = (cons ?? []).map(c => ({
      name:         c.name,
      specialty:    c.specialty,
      availability: c.availability,
      badge:        c.availability === 'available' ? 'Available' : c.availability === 'busy' ? 'Busy' : 'Unavailable',
      type:         c.availability === 'available' ? 'green' : c.availability === 'busy' ? 'yellow' : 'red',
    }))

    res.json({
      active_consultants: (cons ?? []).filter(c => c.availability !== 'unavailable').length,
      sessions_this_month: (bookings ?? []).length,
      booking_rate: 72,
      consultants,
    })
  } catch (err) {
    log.error({ err }, '/admin/mentors threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/sponsorforge ───────────────────────────────────────────────
router.get('/sponsorforge', ...guard, async (req, res) => {
  try {
    const [{ data: matches }, { data: sf }] = await Promise.all([
      adminSupabase.from('sponsorforge_matches').select('*').order('created_at', { ascending: false }),
      adminSupabase.from('sponsorforge_profiles').select('user_id, is_locked'),
    ])

    const closed     = (matches ?? []).filter(m => m.status === 'closed')
    const totalValue = closed.reduce((s, m) => s + (m.deal_value ?? 0), 0)
    const eligible   = (sf ?? []).filter(s => !s.is_locked).length

    const activity = (matches ?? []).slice(0, 4).map(m => {
      const statusMap = { closed: { badge: 'Closed', type: 'green' }, negotiating: { badge: 'Active', type: 'yellow' }, submitted: { badge: 'Submitted', type: 'yellow' }, blocked: { badge: 'Blocked', type: 'red' } }
      const s = statusMap[m.status] ?? { badge: m.status, type: 'yellow' }
      return { name: `${m.sponsor_name} — ${m.status}`, badge: s.badge, type: s.type }
    })

    res.json({
      sponsors:       24,
      active_matches: (matches ?? []).filter(m => m.status === 'negotiating').length,
      deals_closed:   closed.length,
      total_value:    totalValue,
      eligible_fighters: eligible,
      activity,
    })
  } catch (err) {
    log.error({ err }, '/admin/sponsorforge threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/packages ───────────────────────────────────────────────────
router.get('/packages', ...guard, async (req, res) => {
  try {
    const { data: memberships } = await adminSupabase
      .from('memberships')
      .select('tier, status')

    const active    = (memberships ?? []).filter(m => m.status === 'active')
    const pipeline  = active.filter(m => m.tier === 'pipeline_pro').length
    const mgmt      = active.filter(m => m.tier === 'mgmt_suite').length
    const prmtn     = active.filter(m => m.tier === 'prmtn_hub').length

    res.json({
      pipeline_pro: { count: pipeline, pct: Math.round(pipeline / Math.max(active.length, 1) * 100) },
      mgmt_suite:   { count: mgmt,     pct: Math.round(mgmt     / Math.max(active.length, 1) * 100) },
      prmtn_hub:    { count: prmtn,    pct: Math.round(prmtn    / Math.max(active.length, 1) * 100) },
      mrr:   active.length * 99,
      churn: 2.1,
    })
  } catch (err) {
    log.error({ err }, '/admin/packages threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/content ────────────────────────────────────────────────────
router.get('/content', ...guard, async (req, res) => {
  try {
    const [{ data: mods }, { data: progress }] = await Promise.all([
      adminSupabase.from('education_modules').select('id, name').order('order_num'),
      adminSupabase.from('module_progress').select('module_id, completion_pct'),
    ])

    const modules = (mods ?? []).map(m => {
      const rows = (progress ?? []).filter(p => p.module_id === m.id)
      const avg  = rows.length ? Math.round(rows.reduce((s, r) => s + r.completion_pct, 0) / rows.length) : 0
      return { name: m.name, avg }
    })

    const platformAvg = modules.length
      ? Math.round(modules.reduce((s, m) => s + m.avg, 0) / modules.length)
      : 0

    res.json({
      modules,
      platform_avg:  platformAvg,
      total_modules: modules.length,
      chart_data:    modules.slice(0, 6).map(m => ({ label: m.name.split(' ')[0], value: m.avg })),
    })
  } catch (err) {
    log.error({ err }, '/admin/content threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/reports ────────────────────────────────────────────────────
router.get('/reports', ...guard, async (req, res) => {
  try {
    const sb = adminSupabase
    const [{ data: rs }, { data: obs }, { data: sf }] = await Promise.all([
      sb.from('readiness_scores').select('overall'),
      sb.from('obligations').select('status'),
      sb.from('sponsorforge_profiles').select('is_locked'),
    ])

    const avgReady  = rs?.length  ? Math.round(rs.reduce((s, r) => s + r.overall, 0) / rs.length)  : 0
    const completed = (obs ?? []).filter(o => o.status === 'completed').length
    const rate      = (obs ?? []).length > 0 ? Math.round((completed / (obs ?? []).length) * 100) : 100
    const sfActive  = (sf ?? []).filter(s => !s.is_locked).length

    res.json({
      avg_readiness:     avgReady,
      obligations_rate:  rate,
      conduct_incidents: 4,
      sf_matches:        sfActive,
    })
  } catch (err) {
    log.error({ err }, '/admin/reports threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/marketplace ────────────────────────────────────────────────
router.get('/marketplace', ...guard, async (req, res) => {
  try {
    const sb = adminSupabase
    const [
      { data: contracts,    count: contractCount  },
      { data: payments },
      { data: sponsors },
      { data: applications, count: appCount       },
      { data: disputes,     count: disputeCount   },
      { data: opportunities, count: oppCount      },
    ] = await Promise.all([
      sb.from('contracts').select('id, status, value_usd, created_at', { count: 'exact' }).is('deleted_at', null),
      sb.from('sponsorship_payments').select('amount_usd, status'),
      sb.from('sponsor_profiles').select('user_id, is_verified, company_name'),
      sb.from('applications').select('id, status', { count: 'exact' }),
      sb.from('disputes').select('id, status', { count: 'exact' }).eq('status', 'open').catch(() => ({ data: [], count: 0 })),
      sb.from('sponsorship_opportunities').select('id, status', { count: 'exact' }),
    ])

    const activeContracts    = (contracts ?? []).filter(c => c.status === 'active').length
    const completedContracts = (contracts ?? []).filter(c => c.status === 'completed').length
    const gmv = (payments ?? [])
      .filter(p => p.status === 'succeeded')
      .reduce((s, p) => s + (p.amount_usd ?? 0), 0)

    // Applications funnel
    const byStatus = {}
    for (const a of (applications ?? [])) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1
    }

    // Recent contracts for activity feed
    const recent = (contracts ?? [])
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map(c => ({
        name:  `Contract $${c.value_usd?.toLocaleString?.() ?? c.value_usd}`,
        badge: c.status.replace('_', ' '),
        type:  c.status === 'active' ? 'green' : c.status === 'terminated' ? 'red' : 'yellow',
      }))

    res.json({
      gmv_usd:             gmv,
      active_contracts:    activeContracts,
      completed_contracts: completedContracts,
      total_contracts:     contractCount ?? 0,
      total_opportunities: oppCount ?? 0,
      total_applications:  appCount ?? 0,
      open_disputes:       disputeCount ?? 0,
      sponsor_count:       (sponsors ?? []).length,
      verified_sponsors:   (sponsors ?? []).filter(s => s.is_verified).length,
      applications_funnel: byStatus,
      recent_contracts:    recent,
    })
  } catch (err) {
    log.error({ err }, '/admin/marketplace threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/analytics ──────────────────────────────────────────────────
router.get('/analytics', ...guard, async (req, res) => {
  try {
    const sb = adminSupabase
    const [{ data: payments }, { data: contracts }] = await Promise.all([
      sb.from('sponsorship_payments').select('amount_usd, status, created_at'),
      sb.from('contracts').select('status, created_at').is('deleted_at', null),
    ])

    // Monthly GMV for last 6 months
    const now = new Date()
    const monthly = []
    for (let i = 5; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const label = d.toLocaleDateString('en-US', { month: 'short' })
      const value = (payments ?? [])
        .filter(p => p.status === 'succeeded' && new Date(p.created_at) >= d && new Date(p.created_at) < end)
        .reduce((s, p) => s + (p.amount_usd ?? 0), 0)
      monthly.push({ label, value })
    }

    res.json({ monthly_gmv: monthly })
  } catch (err) {
    log.error({ err }, '/admin/analytics threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/disputes ───────────────────────────────────────────────────
router.get('/disputes', ...guard, async (req, res) => {
  try {
    const { data, error } = await adminSupabase
      .from('disputes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    res.json({ ok: true, disputes: data ?? [] })
  } catch (err) {
    log.error({ err }, '/admin/disputes threw')
    res.status(500).json({ error: err.message })
  }
})

export default router
