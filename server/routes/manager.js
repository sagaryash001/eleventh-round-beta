import { Router } from 'express'
import { adminSupabase } from '../db/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { childLogger } from '../lib/logger.js'

const router = Router()
const log = childLogger('manager')

function requireManager(req, res, next) {
  if (!['manager', 'admin'].includes(req.user?.role)) return res.status(403).json({ error: 'Manager access required.' })
  next()
}

const guard = [requireAuth, requireManager]

// ── GET /api/manager/overview ─────────────────────────────────────────────────
router.get('/overview', ...guard, async (req, res) => {
  try {
    const sb  = adminSupabase
    const mid = req.user.id

    const { data: links } = await sb.from('manager_fighters').select('fighter_id').eq('manager_id', mid)
    const fids = (links ?? []).map(l => l.fighter_id)

    if (!fids.length) {
      return res.json({ active_roster: 0, overdue_obligations: 0, sf_ready: 0, roster_health: 0, roster_chart: [], fulfillment_trend: [], action_items: [] })
    }

    const [{ data: readiness }, { data: obs }, { data: sf }] = await Promise.all([
      sb.from('readiness_scores').select('user_id, overall').in('user_id', fids),
      sb.from('obligations').select('owner_id, status, title, due_date').in('owner_id', fids),
      sb.from('sponsorforge_profiles').select('user_id, eligibility_score, is_locked').in('user_id', fids),
    ])

    const avgReadiness = readiness?.length
      ? Math.round(readiness.reduce((s, r) => s + r.overall, 0) / readiness.length)
      : 0
    const overdue      = (obs ?? []).filter(o => o.status === 'overdue').length
    const sfReady      = (sf ?? []).filter(s => !s.is_locked).length

    const { data: profiles } = await sb.from('profiles').select('id, name').in('id', fids)
    const nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.name]))
    const rsMap   = Object.fromEntries((readiness ?? []).map(r => [r.user_id, r.overall]))

    const rosterChart = fids.map(fid => {
      const score = rsMap[fid] ?? 0
      return { label: (nameMap[fid] ?? 'Fighter').split(' ')[0], value: score, color: score >= 80 ? '#00c060' : score >= 60 ? '#c9a82c' : '#c00000' }
    })

    const actionItems = (obs ?? [])
      .filter(o => o.status === 'overdue')
      .slice(0, 4)
      .map(o => ({ name: `${nameMap[o.owner_id] ?? 'Fighter'} — ${o.title}`, badge: 'Act Now', type: 'red' }))

    res.json({
      active_roster:      fids.length,
      overdue_obligations: overdue,
      sf_ready:           sfReady,
      roster_health:      avgReadiness,
      roster_chart:       rosterChart,
      fulfillment_trend:  [],
      action_items:       actionItems,
    })
  } catch (err) {
    log.error({ err }, '/manager/overview threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/manager/roster ───────────────────────────────────────────────────
router.get('/roster', ...guard, async (req, res) => {
  try {
    const sb  = adminSupabase
    const mid = req.user.id

    const { data: links } = await sb.from('manager_fighters').select('fighter_id').eq('manager_id', mid)
    const fids = (links ?? []).map(l => l.fighter_id)
    if (!fids.length) return res.json({ fighters: [] })

    const [{ data: profiles }, { data: fps }, { data: readiness }, { data: sf }] = await Promise.all([
      sb.from('profiles').select('id, name').in('id', fids),
      sb.from('fighter_profiles').select('user_id, division, record_wins, record_losses, record_draws').in('user_id', fids),
      sb.from('readiness_scores').select('user_id, overall').in('user_id', fids),
      sb.from('sponsorforge_profiles').select('user_id, eligibility_score, is_locked').in('user_id', fids),
    ])

    const byId = (arr, key = 'user_id') => Object.fromEntries((arr ?? []).map(r => [r[key], r]))
    const fpMap = byId(fps)
    const rsMap = byId(readiness)
    const sfMap = byId(sf)
    const prMap = byId(profiles, 'id')

    const fighters = fids.map(fid => {
      const fp = fpMap[fid] ?? {}
      const rs = rsMap[fid] ?? { overall: 0 }
      const s  = sfMap[fid] ?? { is_locked: true, eligibility_score: 0 }
      const score = rs.overall
      return {
        name:      prMap[fid]?.name ?? 'Fighter',
        div:       fp.division ?? '—',
        record:    `${fp.record_wins ?? 0}-${fp.record_losses ?? 0}`,
        onboard:   fp.division ? 100 : 0,
        readiness: score,
        sf:        s.is_locked ? 'Not Ready' : 'Eligible',
        color:     score >= 80 ? '#00c060' : score >= 60 ? '#c9a82c' : '#c00000',
      }
    })

    res.json({ fighters })
  } catch (err) {
    log.error({ err }, '/manager/roster threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/manager/obligations ──────────────────────────────────────────────
router.get('/obligations', ...guard, async (req, res) => {
  try {
    const sb  = adminSupabase
    const mid = req.user.id

    const { data: links } = await sb.from('manager_fighters').select('fighter_id').eq('manager_id', mid)
    const fids = (links ?? []).map(l => l.fighter_id)
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
      else if (daysUntil === 0) { badge = 'Tomorrow'; type = 'yellow' }
      else { badge = new Date(o.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); type = 'yellow' }
      return { name: `${nameMap[o.owner_id] ?? 'Fighter'} — ${o.title}`, badge, type }
    }

    const overdue   = (obs ?? []).filter(o => o.status === 'overdue').map(toItem)
    const thisWeek  = (obs ?? []).filter(o => o.status !== 'overdue' && o.status !== 'completed' && new Date(o.due_date) <= weekFromNow).map(toItem)
    const completed = (obs ?? []).filter(o => o.status === 'completed').length
    const total     = (obs ?? []).length
    const rate      = total > 0 ? Math.round((completed / total) * 100) : 100

    const fulfillmentByFighter = fids.map(fid => {
      const fObs     = (obs ?? []).filter(o => o.owner_id === fid)
      const fComp    = fObs.filter(o => o.status === 'completed').length
      const fPct     = fObs.length > 0 ? Math.round((fComp / fObs.length) * 100) : 100
      return { label: (nameMap[fid] ?? 'Fighter').split(' ')[0], value: fPct, color: fPct >= 90 ? '#00c060' : fPct >= 70 ? '#c9a82c' : '#c00000' }
    })

    res.json({ overdue, this_week: thisWeek, rate, fulfillment_chart: fulfillmentByFighter })
  } catch (err) {
    log.error({ err }, '/manager/obligations threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/manager/sponsorforge ─────────────────────────────────────────────
router.get('/sponsorforge', ...guard, async (req, res) => {
  try {
    const sb  = adminSupabase
    const mid = req.user.id

    const { data: links } = await sb.from('manager_fighters').select('fighter_id').eq('manager_id', mid)
    const fids = (links ?? []).map(l => l.fighter_id)
    if (!fids.length) return res.json({ fighters: [] })

    const [{ data: profiles }, { data: sf }] = await Promise.all([
      sb.from('profiles').select('id, name').in('id', fids),
      sb.from('sponsorforge_profiles').select('*').in('user_id', fids),
    ])

    const sfMap   = Object.fromEntries((sf ?? []).map(s => [s.user_id, s]))
    const prMap   = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

    const fighters = fids.map(fid => {
      const s     = sfMap[fid] ?? { eligibility_score: 0, is_locked: true }
      const score = s.eligibility_score
      const type  = score >= 85 ? 'green' : score >= 70 ? 'yellow' : 'red'
      const status = s.is_locked ? (score >= 70 ? `${score}% Ready` : 'Not Ready') : 'Eligible'
      return { name: prMap[fid]?.name ?? 'Fighter', pct: score, type, status }
    })

    res.json({ fighters })
  } catch (err) {
    log.error({ err }, '/manager/sponsorforge threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/manager/budget ───────────────────────────────────────────────────
router.get('/budget', ...guard, async (req, res) => {
  try {
    const { data, error } = await adminSupabase
      .from('camp_budgets')
      .select('*')
      .eq('manager_id', req.user.id)
      .order('event_date')
    if (error) throw error

    const camps = (data ?? []).map(c => ({
      name:   c.name,
      alloc:  c.total_budget,
      spent:  c.spent,
    }))
    const total    = camps.reduce((s, c) => s + c.alloc, 0)
    const spentAll = camps.reduce((s, c) => s + c.spent, 0)
    const util     = total > 0 ? Math.round((spentAll / total) * 100) : 0

    res.json({
      total_budget:   total,
      budget_util:    util,
      unplanned:      0,
      camps,
    })
  } catch (err) {
    log.error({ err }, '/manager/budget threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/manager/playbooks ────────────────────────────────────────────────
router.get('/playbooks', ...guard, async (req, res) => {
  try {
    const { data, error } = await adminSupabase
      .from('playbooks')
      .select('id, title')
      .in('target_role', ['manager', 'all'])
      .order('order_num')
    if (error) throw error
    res.json({ playbooks: data ?? [] })
  } catch (err) {
    log.error({ err }, '/manager/playbooks threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/manager/reports ──────────────────────────────────────────────────
router.get('/reports', ...guard, async (req, res) => {
  try {
    const sb  = adminSupabase
    const mid = req.user.id

    const { data: links } = await sb.from('manager_fighters').select('fighter_id').eq('manager_id', mid)
    const fids = (links ?? []).map(l => l.fighter_id)
    if (!fids.length) return res.json({ roster_avg: 0, obligations_rate: 100, conduct_incidents: 0, sf_eligible: '0/0' })

    const [{ data: readiness }, { data: obs }, { data: sf }] = await Promise.all([
      sb.from('readiness_scores').select('overall').in('user_id', fids),
      sb.from('obligations').select('status').in('owner_id', fids),
      sb.from('sponsorforge_profiles').select('is_locked').in('user_id', fids),
    ])

    const avgReady   = readiness?.length ? Math.round(readiness.reduce((s, r) => s + r.overall, 0) / readiness.length) : 0
    const completed  = (obs ?? []).filter(o => o.status === 'completed').length
    const totalObs   = (obs ?? []).length
    const rate       = totalObs > 0 ? Math.round((completed / totalObs) * 100) : 100
    const sfEligible = (sf ?? []).filter(s => !s.is_locked).length

    res.json({
      roster_avg:        avgReady,
      obligations_rate:  rate,
      conduct_incidents: 1,
      sf_eligible:       `${sfEligible}/${fids.length}`,
    })
  } catch (err) {
    log.error({ err }, '/manager/reports threw')
    res.status(500).json({ error: err.message })
  }
})

export default router
