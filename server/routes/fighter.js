import { Router } from 'express'
import { adminSupabase } from '../db/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { childLogger } from '../lib/logger.js'

const router = Router()
const log = childLogger('fighter')

function requireFighter(req, res, next) {
  if (req.user?.role !== 'fighter') return res.status(403).json({ error: 'Fighter access required.' })
  next()
}

const guard = [requireAuth, requireFighter]

// ── GET /api/fighter/overview ────────────────────────────────────────────────
router.get('/overview', ...guard, async (req, res) => {
  try {
    const sb = adminSupabase
    const uid = req.user.id

    const [{ data: rs }, { data: pipe }, { data: obs }, { data: mods }] = await Promise.all([
      sb.from('readiness_scores').select('*').eq('user_id', uid).maybeSingle(),
      sb.from('pipeline_progress').select('*').eq('user_id', uid).order('stage_number'),
      sb.from('obligations').select('*').eq('owner_id', uid).neq('status', 'completed'),
      sb.from('module_progress').select('completion_pct').eq('user_id', uid),
    ])

    const overallPct = pipe?.length
      ? Math.round(pipe.reduce((s, p) => s + p.completion_pct, 0) / pipe.length)
      : 0
    const currentStage = pipe?.filter(p => p.completion_pct > 0).length ?? 0
    const overdue = obs?.filter(o => o.status === 'overdue') ?? []
    const avgEdu = mods?.length
      ? Math.round(mods.filter(m => m.completion_pct > 0).reduce((s, m) => s + m.completion_pct, 0) / mods.length)
      : 0

    const actionItems = overdue.slice(0, 4).map(o => ({
      name: o.title,
      badge: 'Overdue',
      type: 'red',
    }))

    res.json({
      readiness:        rs?.overall ?? 0,
      pipeline_stage:   currentStage,
      pipeline_pct:     overallPct,
      sponsor_score:    rs?.sponsor ?? 0,
      open_obligations: obs?.length ?? 0,
      radar: {
        brand:    rs?.brand    ?? 0,
        finance:  rs?.finance  ?? 0,
        conduct:  rs?.conduct  ?? 0,
        sponsor:  rs?.sponsor  ?? 0,
        media:    rs?.media    ?? 0,
        pipeline: rs?.pipeline ?? 0,
      },
      readiness_trend: rs?.trend ?? [],
      action_items:    actionItems,
      education_avg:   avgEdu,
    })
  } catch (err) {
    log.error({ err }, '/fighter/overview threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/fighter/pipeline ─────────────────────────────────────────────────
router.get('/pipeline', ...guard, async (req, res) => {
  try {
    const { data, error } = await adminSupabase
      .from('pipeline_progress')
      .select('stage_number, stage_label, completion_pct')
      .eq('user_id', req.user.id)
      .order('stage_number')
    if (error) throw error

    const stages = (data ?? []).map(s => ({
      n:     String(s.stage_number).padStart(2, '0'),
      label: s.stage_label,
      pct:   s.completion_pct,
    }))
    const overall = stages.length
      ? Math.round(stages.reduce((s, p) => s + p.pct, 0) / stages.length)
      : 0

    res.json({ stages, overall_pct: overall })
  } catch (err) {
    log.error({ err }, '/fighter/pipeline threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/fighter/obligations ──────────────────────────────────────────────
router.get('/obligations', ...guard, async (req, res) => {
  try {
    const { data, error } = await adminSupabase
      .from('obligations')
      .select('*')
      .eq('owner_id', req.user.id)
      .order('due_date')
    if (error) throw error

    const toItem = (o) => {
      const daysUntil = Math.round((new Date(o.due_date) - Date.now()) / 86400000)
      let badge, type
      if (o.status === 'completed') { badge = 'Complete'; type = 'green' }
      else if (o.status === 'overdue') { badge = `Overdue ${Math.abs(daysUntil)}d`; type = 'red' }
      else if (daysUntil <= 1) { badge = 'Tomorrow'; type = 'yellow' }
      else { badge = `Due ${new Date(o.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`; type = daysUntil <= 3 ? 'yellow' : 'green' }
      return { name: o.title, badge, type }
    }

    const sponsor  = (data ?? []).filter(o => o.category === 'sponsor').map(toItem)
    const media    = (data ?? []).filter(o => o.category === 'media').map(toItem)
    const completed = (data ?? []).filter(o => o.status === 'completed').length
    const total    = (data ?? []).length
    const fulfillment = total > 0 ? Math.round((completed / total) * 100) : 100

    const timeline = (data ?? [])
      .filter(o => o.status !== 'completed')
      .slice(0, 5)
      .map(o => {
        const daysUntil = Math.round((new Date(o.due_date) - Date.now()) / 86400000)
        return {
          date:  o.status === 'overdue' ? 'Overdue' : new Date(o.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          label: o.title,
          type:  o.status === 'overdue' ? 'red' : daysUntil <= 3 ? 'yellow' : 'green',
        }
      })

    res.json({ sponsor, media, fulfillment_pct: fulfillment, completed_count: completed, timeline })
  } catch (err) {
    log.error({ err }, '/fighter/obligations threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/fighter/education ────────────────────────────────────────────────
router.get('/education', ...guard, async (req, res) => {
  try {
    const { data, error } = await adminSupabase
      .from('module_progress')
      .select('completion_pct, started_at, education_modules(name, order_num)')
      .eq('user_id', req.user.id)
      .order('education_modules(order_num)')
    if (error) throw error

    const modules = (data ?? []).map(m => ({
      name: m.education_modules?.name ?? 'Module',
      pct:  m.completion_pct,
    }))
    const started = modules.filter(m => m.pct > 0).length
    const overall = modules.length
      ? Math.round(modules.reduce((s, m) => s + m.pct, 0) / modules.length)
      : 0
    const chartData = modules.slice(0, 6).map(m => ({
      label: m.name.split(' ')[0],
      value: m.pct,
    }))

    res.json({
      modules,
      overall_pct:   overall,
      started_count: started,
      total_count:   modules.length,
      chart_data:    chartData,
    })
  } catch (err) {
    log.error({ err }, '/fighter/education threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/fighter/sponsorforge ─────────────────────────────────────────────
router.get('/sponsorforge', ...guard, async (req, res) => {
  try {
    const { data, error } = await adminSupabase
      .from('sponsorforge_profiles')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle()
    if (error) throw error

    const sf = data ?? { eligibility_score: 0, is_locked: true, sponsor_profile_complete: false, brand_readiness: 0, pipeline_stage: 0, obligation_record_pct: 0 }

    const requirements = [
      { name: 'Sponsor Profile',       badge: sf.sponsor_profile_complete ? 'Complete' : 'Incomplete', type: sf.sponsor_profile_complete ? 'green' : 'red' },
      { name: 'Brand Readiness Score', badge: `${sf.brand_readiness} / 100`,                           type: sf.brand_readiness >= 80 ? 'green' : 'yellow' },
      { name: 'Pipeline Stage',        badge: `Stage 4+`,                                              type: sf.pipeline_stage >= 80 ? 'green' : 'red' },
      { name: 'Obligation Record',     badge: `${sf.obligation_record_pct}%`,                          type: sf.obligation_record_pct >= 90 ? 'green' : 'yellow' },
    ]

    const eligibility_progress = [
      { label: 'Brand',        value: sf.brand_readiness },
      { label: 'Pipeline',     value: sf.pipeline_stage },
      { label: 'Conduct',      value: 88 },
      { label: 'Obligations',  value: sf.obligation_record_pct },
      { label: 'Profile',      value: sf.sponsor_profile_complete ? 100 : 20 },
    ]

    res.json({ eligibility_score: sf.eligibility_score, is_locked: sf.is_locked, requirements, eligibility_progress })
  } catch (err) {
    log.error({ err }, '/fighter/sponsorforge threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/fighter/mentorship ───────────────────────────────────────────────
router.get('/mentorship', ...guard, async (req, res) => {
  try {
    const { data, error } = await adminSupabase
      .from('bookings')
      .select('invitee_name, event_type, scheduled_at, status')
      .eq('user_id', req.user.id)
      .order('scheduled_at', { ascending: false })
      .limit(10)
    if (error) throw error

    const sessions = (data ?? []).map(b => ({
      name:  `${new Date(b.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${b.event_type ?? 'Session'}`,
      badge: b.status === 'completed' ? 'Complete' : b.status === 'scheduled' ? 'Upcoming' : 'Cancelled',
      type:  b.status === 'completed' ? 'green' : b.status === 'scheduled' ? 'yellow' : 'red',
    }))

    const now = new Date()
    const upcoming = (data ?? []).find(b => b.status === 'scheduled' && new Date(b.scheduled_at) > now)
    const thisMonth = (data ?? []).filter(b => {
      const d = new Date(b.scheduled_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length

    res.json({
      sessions,
      this_month:   thisMonth,
      next_session: upcoming
        ? { date: new Date(upcoming.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), time: new Date(upcoming.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
        : null,
    })
  } catch (err) {
    log.error({ err }, '/fighter/mentorship threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/fighter/profile ──────────────────────────────────────────────────
router.get('/profile', ...guard, async (req, res) => {
  try {
    const uid = req.user.id
    const [{ data: fp }, { data: mgr }] = await Promise.all([
      adminSupabase.from('fighter_profiles').select('*').eq('user_id', uid).maybeSingle(),
      adminSupabase.from('fighter_profiles').select('manager_id').eq('user_id', uid).maybeSingle(),
    ])

    let managerName = null
    if (mgr?.manager_id) {
      const { data: m } = await adminSupabase.from('profiles').select('name').eq('id', mgr.manager_id).maybeSingle()
      managerName = m?.name ?? null
    }

    const wins   = fp?.record_wins   ?? 0
    const losses = fp?.record_losses ?? 0
    const draws  = fp?.record_draws  ?? 0
    const completeness = [fp?.division, fp?.base_city, req.user.name, req.user.email].filter(Boolean).length * 18

    res.json({
      name:                req.user.name,
      email:               req.user.email,
      division:            fp?.division  ?? null,
      record:              `${wins}-${losses}${draws > 0 ? `-${draws}` : ''}`,
      base:                fp?.base_city ?? null,
      manager:             managerName,
      profile_completeness: Math.min(completeness, 100),
    })
  } catch (err) {
    log.error({ err }, '/fighter/profile threw')
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/fighter/profile ────────────────────────────────────────────────
router.patch('/profile', ...guard, async (req, res) => {
  try {
    const { division, base_city, record_wins, record_losses, record_draws } = req.body
    const uid = req.user.id

    const { error } = await adminSupabase
      .from('fighter_profiles')
      .upsert({ user_id: uid, division, base_city, record_wins, record_losses, record_draws, updated_at: new Date().toISOString() })
    if (error) throw error

    if (req.body.name) {
      await adminSupabase.from('profiles').update({ name: req.body.name }).eq('id', uid)
    }

    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /fighter/profile threw')
    res.status(500).json({ error: err.message })
  }
})

export default router
