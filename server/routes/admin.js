// ─────────────────────────────────────────────────────────────────────────────
// Admin routes — all protected by requireAuth + requireAdmin
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express'
import { adminSupabase }    from '../db/supabase.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { validate, ModuleCreateSchema, PackageCreateSchema, z } from '../lib/validate.js'
import { childLogger }      from '../lib/logger.js'
import { computeMatchesForOpp } from '../lib/matching.js'
import { sendEmail, emailHtml, ctaButton, esc, isEmailConfigured } from '../services/email.js'

const router = Router()
const log    = childLogger('admin')
const guard  = [requireAuth, requireAdmin]

function pick(body, keys) {
  const out = {}
  for (const k of keys) if (body[k] !== undefined) out[k] = body[k]
  return out
}

// ═════════════════════════════════════════════════════════════════════════════
// OVERVIEW + DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════

// ── GET /api/admin/overview ───────────────────────────────────────────────────
router.get('/overview', ...guard, async (req, res) => {
  try {
    const sb = adminSupabase

    const [
      { data: users },
      { data: alts },
      { count: pendingVetting },
      { count: opportunityCount },
    ] = await Promise.all([
      sb.from('profiles').select('id, role, account_type, status'),
      sb.from('alerts').select('id, message, type').eq('resolved', false)
          .order('created_at', { ascending: false }),
      sb.from('sponsor_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_verified', false)
        .is('deleted_at', null),
      sb.from('sponsorship_opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published')
        .is('deleted_at', null),
    ])

    const list      = users ?? []
    const fighters  = list.filter(u => u.role === 'fighter').length
    const managers  = list.filter(u => u.role === 'manager').length
    const promotions= list.filter(u => u.account_type === 'promotion').length
    const sponsors  = list.filter(u => u.role === 'sponsor').length
    const total     = list.length

    // Real health: each passing check adds points
    const emailOk   = !!(process.env.EMAIL_HOST && process.env.EMAIL_USER)
    const usersOk   = total > 0
    const checks    = [true /* supabase */, emailOk, usersOk]
    const platformHealth = Math.round(checks.filter(Boolean).length / checks.length * 100)

    const alertItems = (alts ?? []).slice(0, 5).map(a => ({
      name:  a.message ?? 'Alert',
      badge: a.type === 'urgent' ? 'Urgent' : a.type === 'action' ? 'Action' : a.type === 'review' ? 'Review' : 'Info',
      type:  a.type === 'urgent' ? 'red' : a.type === 'action' ? 'red' : a.type === 'review' ? 'yellow' : 'green',
    }))

    res.json({
      total_users:          total,
      active_fighters:      fighters,
      active_managers:      managers,
      promotions,
      sponsors,
      pending_vetting:      pendingVetting ?? 0,
      active_opportunities: opportunityCount ?? 0,
      platform_health:      platformHealth,
      alerts:               alertItems,
    })
  } catch (err) {
    log.error({ err }, '/admin/overview threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/dashboard — comprehensive single-shot metrics ───────────────
router.get('/dashboard', ...guard, async (req, res) => {
  try {
    const sb = adminSupabase
    const [
      { data: userRows },
      { count: oppCount },
      { count: appCount },
      { count: activeContractCount },
      { count: totalContractCount },
      { count: disputedContractCount },
      { data: obsRows },
      { data: gmvRows },
      { count: proofsPendingCount },
      { data: billingPayments },
      { count: activeMemberships },
    ] = await Promise.all([
      sb.from('profiles').select('id, role, status'),
      sb.from('sponsorship_opportunities').select('*', { count: 'exact', head: true })
        .eq('status', 'published').is('deleted_at', null),
      sb.from('applications').select('*', { count: 'exact', head: true }),
      sb.from('contracts').select('*', { count: 'exact', head: true })
        .eq('status', 'active').is('deleted_at', null),
      sb.from('contracts').select('*', { count: 'exact', head: true })
        .is('deleted_at', null),
      sb.from('contracts').select('*', { count: 'exact', head: true })
        .eq('status', 'in_dispute').is('deleted_at', null),
      sb.from('obligations').select('status'),
      sb.from('sponsorship_payments').select('amount_usd').eq('status', 'succeeded'),
      sb.from('obligation_proofs').select('*', { count: 'exact', head: true })
        .eq('review_status', 'pending'),
      sb.from('payments').select('amount, status').not('package_id', 'is', null),
      sb.from('memberships').select('*', { count: 'exact', head: true }).eq('status', 'active')
        .not('package_id', 'is', null),
    ])

    const obs           = obsRows ?? []
    const overdueObs    = obs.filter(o => o.status === 'overdue').length
    const completedObs  = obs.filter(o => o.status === 'completed').length
    const totalObs      = obs.length
    const totalRevenue  = (gmvRows ?? []).reduce((s, p) => s + (p.amount_usd ?? 0), 0)

    const billing       = billingPayments ?? []
    const billingRevenueCents   = billing.filter(p => p.status === 'succeeded').reduce((s, p) => s + (p.amount ?? 0), 0)
    const billingSuccessful     = billing.filter(p => p.status === 'succeeded').length
    const billingFailed         = billing.filter(p => p.status === 'failed').length

    const users = userRows ?? []
    res.json({
      total_users:      users.length,
      fighters:         users.filter(u => u.role === 'fighter').length,
      managers:         users.filter(u => u.role === 'manager').length,
      sponsors:         users.filter(u => u.role === 'sponsor').length,
      admins:           users.filter(u => u.role === 'admin').length,
      active_opportunities:    oppCount           ?? 0,
      total_applications:      appCount           ?? 0,
      active_contracts:        activeContractCount ?? 0,
      total_contracts:         totalContractCount  ?? 0,
      disputed_contracts:      disputedContractCount ?? 0,
      proofs_pending_review:   proofsPendingCount  ?? 0,
      total_obligations:       totalObs,
      overdue_obligations:     overdueObs,
      completed_obligations:   completedObs,
      total_revenue_usd:       totalRevenue,
      billing_revenue_cents:   billingRevenueCents,
      billing_successful:      billingSuccessful,
      billing_failed:          billingFailed,
      active_memberships:      activeMemberships ?? 0,
    })
  } catch (err) {
    log.error({ err }, '/admin/dashboard threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/contracts — paginated list of all contracts ────────────────
router.get('/contracts', ...guard, async (req, res) => {
  try {
    const sb     = adminSupabase
    const limit  = Math.min(Number(req.query.limit) || 20, 100)
    const offset = Math.max(0, Number(req.query.offset) || 0)
    const status = req.query.status

    let q = sb.from('contracts')
      .select('id, opportunity_id, application_id, sponsor_id, fighter_id, value_usd, payment_schedule, start_date, end_date, status, created_at, updated_at', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (status) q = q.eq('status', status)

    const { data: contracts, error, count } = await q
    if (error) throw error

    const fids = [...new Set((contracts ?? []).map(c => c.fighter_id))]
    const sids = [...new Set((contracts ?? []).map(c => c.sponsor_id))]
    const cids = (contracts ?? []).map(c => c.id)

    const [{ data: fighters }, { data: sponsors }, { data: obs }] = await Promise.all([
      fids.length ? sb.from('profiles').select('id, name').in('id', fids) : { data: [] },
      sids.length ? sb.from('sponsor_profiles').select('user_id, company_name').in('user_id', sids) : { data: [] },
      cids.length ? sb.from('obligations').select('contract_id, status').in('contract_id', cids) : { data: [] },
    ])

    const fMap   = Object.fromEntries((fighters ?? []).map(p => [p.id, p]))
    const sMap   = Object.fromEntries((sponsors ?? []).map(s => [s.user_id, s]))
    const obsMap = {}
    for (const o of (obs ?? [])) {
      if (!obsMap[o.contract_id]) obsMap[o.contract_id] = { total: 0, completed: 0 }
      obsMap[o.contract_id].total++
      if (o.status === 'completed') obsMap[o.contract_id].completed++
    }

    const enriched = (contracts ?? []).map(c => ({
      ...c,
      fighter:               fMap[c.fighter_id]  ?? null,
      sponsor_detail:        sMap[c.sponsor_id]  ?? null,
      obligations_total:     obsMap[c.id]?.total     ?? 0,
      obligations_completed: obsMap[c.id]?.completed ?? 0,
    }))

    res.json({ ok: true, contracts: enriched, total: count ?? 0 })
  } catch (err) {
    log.error({ err }, '/admin/contracts threw')
    res.status(500).json({ error: err.message })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// USERS
// ═════════════════════════════════════════════════════════════════════════════

// ── GET /api/admin/users ──────────────────────────────────────────────────────
// Query params: limit, offset, role, status, search
router.get('/users', ...guard, async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit)  || 50, 200)
    const offset = Math.max(0, Number(req.query.offset) || 0)
    const { role, status, search } = req.query

    let q = adminSupabase
      .from('profiles')
      .select('id, name, email, role, account_type, status, onboarding_complete, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (role)   q = q.eq('role', role)
    if (status) q = q.eq('status', status)
    if (search) {
      const s = String(search).replace(/'/g, '')
      q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%`)
    }

    const { data, error, count } = await q
    if (error) throw error

    res.json({
      users: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    })
  } catch (err) {
    log.error({ err }, '/admin/users threw')
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/admin/users/:id ────────────────────────────────────────────────
router.patch('/users/:id', ...guard, async (req, res) => {
  try {
    const targetId = req.params.id

    // Self-protection: admin cannot demote or suspend themselves
    if (targetId === req.user.id) {
      const { role, status } = req.body
      if (role && role !== 'admin') {
        return res.status(400).json({
          error: 'You cannot change your own role. Use the Supabase Auth dashboard or ask another admin.',
        })
      }
      if (status === 'suspended') {
        return res.status(400).json({ error: 'You cannot suspend your own account.' })
      }
    }

    const allowed = ['role', 'account_type', 'status', 'onboarding_complete']
    const updates = pick(req.body, allowed)
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No updatable fields provided.' })
    }
    updates.updated_at = new Date().toISOString()

    const { error } = await adminSupabase
      .from('profiles')
      .update(updates)
      .eq('id', targetId)
    if (error) throw error

    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /admin/users/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// SPONSOR VETTING
// ═════════════════════════════════════════════════════════════════════════════

// ── GET /api/admin/sponsors/pending ──────────────────────────────────────────
router.get('/sponsors/pending', ...guard, async (req, res) => {
  try {
    // Fetch unverified sponsor_profiles joined to profiles
    const { data: pending, error: pErr } = await adminSupabase
      .from('sponsor_profiles')
      .select(`
        user_id, company_name, industry, website_url, description,
        budget_min_usd, budget_max_usd, campaign_goals,
        preferred_weight_classes, preferred_promotions,
        is_verified, created_at,
        profiles!inner(id, email, name, status)
      `)
      .eq('is_verified', false)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (pErr) throw pErr

    const { data: verified, error: vErr } = await adminSupabase
      .from('sponsor_profiles')
      .select('user_id, company_name, industry, is_verified, created_at, profiles!inner(email, name)')
      .eq('is_verified', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20)
    if (vErr) throw vErr

    res.json({
      pending:  pending  ?? [],
      verified: verified ?? [],
    })
  } catch (err) {
    log.error({ err }, '/admin/sponsors/pending threw')
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/admin/sponsors/:userId/verify ──────────────────────────────────
router.patch('/sponsors/:userId/verify', ...guard, async (req, res) => {
  try {
    const { approved, reason } = req.body
    const userId = req.params.userId

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'approved (boolean) is required.' })
    }

    if (approved) {
      const { data: sp, error } = await adminSupabase
        .from('sponsor_profiles')
        .update({ is_verified: true, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select('company_name')
        .maybeSingle()
      if (error) throw error
      log.info({ userId, by: req.user.id }, 'sponsor approved')
      adminSupabase.from('outbox_events').insert({
        event_type:     'sponsor.approved',
        aggregate_type: 'sponsor_profiles',
        aggregate_id:   userId,
        payload: { user_id: userId, company_name: sp?.company_name ?? null },
      }).then(() => {}).catch(() => {})
      return res.json({ ok: true, action: 'approved' })
    } else {
      // Reject: suspend the user account
      const { error } = await adminSupabase
        .from('profiles')
        .update({ status: 'suspended', updated_at: new Date().toISOString() })
        .eq('id', userId)
      if (error) throw error
      log.info({ userId, by: req.user.id, reason }, 'sponsor rejected/suspended')
      return res.json({ ok: true, action: 'rejected' })
    }
  } catch (err) {
    log.error({ err }, 'PATCH /admin/sponsors/:userId/verify threw')
    res.status(500).json({ error: err.message })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// EDUCATION MODULES
// ═════════════════════════════════════════════════════════════════════════════

// ── GET /api/admin/modules ────────────────────────────────────────────────────
router.get('/modules', ...guard, async (req, res) => {
  try {
    const [{ data: mods, error }, { data: progress }] = await Promise.all([
      adminSupabase.from('education_modules').select('*').order('order_num'),
      adminSupabase.from('module_progress').select('module_id, completion_pct'),
    ])
    if (error) throw error

    const modules = (mods ?? []).map(m => {
      const rows = (progress ?? []).filter(p => p.module_id === m.id)
      const avg  = rows.length ? Math.round(rows.reduce((s, r) => s + r.completion_pct, 0) / rows.length) : 0
      return { ...m, avg_completion: avg, enrolled_count: rows.length }
    })

    res.json({ modules, total: modules.length })
  } catch (err) {
    log.error({ err }, '/admin/modules threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/modules/:id ────────────────────────────────────────────────
router.get('/modules/:id', ...guard, async (req, res) => {
  try {
    const [{ data: mod, error }, { data: resources }] = await Promise.all([
      adminSupabase.from('education_modules').select('*').eq('id', req.params.id).maybeSingle(),
      adminSupabase.from('education_module_resources').select('*').eq('module_id', req.params.id).order('order_num'),
    ])
    if (error) throw error
    if (!mod) return res.status(404).json({ error: 'Module not found.' })
    res.json({ ok: true, module: mod, resources: resources ?? [] })
  } catch (err) {
    log.error({ err }, 'GET /admin/modules/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/modules ───────────────────────────────────────────────────
router.post('/modules', ...guard, validate(ModuleCreateSchema), async (req, res) => {
  try {
    const p = req.valid
    const isPublished = p.status === 'published' || p.is_published
    const { data, error } = await adminSupabase
      .from('education_modules')
      .insert({
        name:           p.name,
        description:    p.description    ?? null,
        category:       p.category       ?? null,
        order_num:      p.order_num,
        is_published:   isPublished,
        estimated_mins: p.estimated_mins ?? null,
        content_url:    p.content_url    ?? null,
        module_type:    p.module_type,
        content_body:   p.content_body   ?? null,
        metadata:       JSON.stringify(p.metadata ?? {}),
        is_required:    p.is_required,
        required_for_sponsorforge: !!req.body.required_for_sponsorforge,
        audience:       p.audience,
        status:         p.status,
        published_at:   isPublished ? new Date().toISOString() : null,
        created_by:     req.user.id,
      })
      .select()
      .maybeSingle()
    if (error) throw error

    log.info({ id: data.id, name: p.name, type: p.module_type }, 'module created')
    res.status(201).json({ ok: true, module: data })
  } catch (err) {
    log.error({ err }, 'POST /admin/modules threw')
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/admin/modules/:id ──────────────────────────────────────────────
router.patch('/modules/:id', ...guard, async (req, res) => {
  try {
    const allowed = [
      'name', 'description', 'category', 'order_num', 'is_published',
      'estimated_mins', 'content_url', 'thumbnail_path',
      'module_type', 'content_body', 'metadata', 'is_required', 'audience', 'status',
      'required_for_sponsorforge',
    ]
    const updates = pick(req.body, allowed)
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No updatable fields provided.' })
    }

    // Keep is_published in sync with status
    if (updates.status === 'published') {
      updates.is_published = true
      if (!req.body.published_at) updates.published_at = new Date().toISOString()
    } else if (updates.status === 'draft' || updates.status === 'archived') {
      updates.is_published = false
    }
    if (typeof updates.is_published === 'boolean' && updates.status === undefined) {
      updates.status = updates.is_published ? 'published' : 'draft'
      if (updates.is_published) updates.published_at = new Date().toISOString()
    }
    if (Array.isArray(updates.metadata) || (updates.metadata && typeof updates.metadata === 'object')) {
      updates.metadata = JSON.stringify(updates.metadata)
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await adminSupabase
      .from('education_modules')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Module not found.' })

    res.json({ ok: true, module: data })
  } catch (err) {
    log.error({ err }, 'PATCH /admin/modules/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/admin/modules/:id/status ──────────────────────────────────────
router.patch('/modules/:id/status', ...guard, async (req, res) => {
  try {
    const { status } = req.body
    if (!['draft','published','archived'].includes(status)) {
      return res.status(400).json({ error: 'status must be draft | published | archived.' })
    }
    const updates = {
      status,
      is_published:  status === 'published',
      updated_at:    new Date().toISOString(),
    }
    if (status === 'published') updates.published_at = new Date().toISOString()

    const { data, error } = await adminSupabase
      .from('education_modules').update(updates).eq('id', req.params.id).select().maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Module not found.' })

    log.info({ id: req.params.id, status }, 'module status updated')
    res.json({ ok: true, module: data })
  } catch (err) {
    log.error({ err }, 'PATCH /admin/modules/:id/status threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/modules/:id/analytics ─────────────────────────────────────
router.get('/modules/:id/analytics', ...guard, async (req, res) => {
  try {
    const { data: rows, error } = await adminSupabase
      .from('module_progress')
      .select('user_id, completion_pct, status, started_at, completed_at')
      .eq('module_id', req.params.id)
    if (error) throw error

    const total     = (rows ?? []).length
    const completed = (rows ?? []).filter(r => r.status === 'completed' || r.completion_pct === 100).length
    const inProg    = (rows ?? []).filter(r => r.status === 'in_progress' || (r.completion_pct > 0 && r.completion_pct < 100)).length
    const avgPct    = total ? Math.round((rows ?? []).reduce((s, r) => s + r.completion_pct, 0) / total) : 0

    res.json({ ok: true, enrolled: total, completed, in_progress: inProg, avg_completion: avgPct })
  } catch (err) {
    log.error({ err }, 'GET /admin/modules/:id/analytics threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/modules/:id/resources ────────────────────────────────────
router.post('/modules/:id/resources', ...guard, async (req, res) => {
  try {
    const { title, resource_type = 'link', url, storage_path, order_num = 100 } = req.body
    if (!title) return res.status(400).json({ error: 'title required.' })
    if (!['pdf','link','video','file'].includes(resource_type)) {
      return res.status(400).json({ error: 'resource_type must be pdf|link|video|file.' })
    }
    const { data, error } = await adminSupabase
      .from('education_module_resources')
      .insert({ module_id: req.params.id, title, resource_type, url: url ?? null, storage_path: storage_path ?? null, order_num })
      .select().maybeSingle()
    if (error) throw error
    res.status(201).json({ ok: true, resource: data })
  } catch (err) {
    log.error({ err }, 'POST /admin/modules/:id/resources threw')
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/admin/modules/:id/resources/:resourceId ──────────────────────
router.delete('/modules/:id/resources/:resourceId', ...guard, async (req, res) => {
  try {
    const { error } = await adminSupabase
      .from('education_module_resources')
      .delete()
      .eq('id', req.params.resourceId)
      .eq('module_id', req.params.id)
    if (error) throw error
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'DELETE /admin/modules/:id/resources/:resourceId threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/content — legacy endpoint for chart data ───────────────────
router.get('/content', ...guard, async (req, res) => {
  try {
    const [{ data: mods }, { data: progress }] = await Promise.all([
      adminSupabase.from('education_modules').select('id, name, is_published').order('order_num'),
      adminSupabase.from('module_progress').select('module_id, completion_pct'),
    ])

    const modules = (mods ?? []).map(m => {
      const rows = (progress ?? []).filter(p => p.module_id === m.id)
      const avg  = rows.length ? Math.round(rows.reduce((s, r) => s + r.completion_pct, 0) / rows.length) : 0
      return { name: m.name, avg, is_published: m.is_published }
    })

    const published    = modules.filter(m => m.is_published)
    const platformAvg  = published.length ? Math.round(published.reduce((s, m) => s + m.avg, 0) / published.length) : 0

    res.json({
      modules,
      published_modules: published.length,
      platform_avg:      platformAvg,
      total_modules:     modules.length,
      chart_data:        published.slice(0, 6).map(m => ({ label: m.name.split(' ')[0], value: m.avg })),
    })
  } catch (err) {
    log.error({ err }, '/admin/content threw')
    res.status(500).json({ error: err.message })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// PACKAGES
// ═════════════════════════════════════════════════════════════════════════════

// ── GET /api/admin/packages ───────────────────────────────────────────────────
router.get('/packages', ...guard, async (req, res) => {
  try {
    const [{ data: pkgs, error }, { data: memberships }] = await Promise.all([
      adminSupabase.from('packages').select('*').order('sort_order'),
      adminSupabase.from('memberships').select('tier, status'),
    ])
    if (error) throw error

    const active   = (memberships ?? []).filter(m => m.status === 'active')
    const totalMrr = (pkgs ?? []).reduce((s, pkg) => {
      const count = active.filter(m => m.tier === pkg.name.toLowerCase().replace(/\s+/g, '_')).length
      return s + count * (pkg.price_cents / 100)
    }, 0)

    res.json({
      packages: pkgs ?? [],
      stats: {
        total_active_subscriptions: active.length,
        mrr_usd: Math.round(totalMrr),
      },
    })
  } catch (err) {
    log.error({ err }, '/admin/packages threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/packages ──────────────────────────────────────────────────
router.post('/packages', ...guard, validate(PackageCreateSchema), async (req, res) => {
  try {
    const p = req.valid
    const { data, error } = await adminSupabase
      .from('packages')
      .insert({
        name:             p.name,
        audience:         p.audience,
        description:      p.description      ?? null,
        price_cents:      p.price_cents,
        billing_interval: p.billing_interval,
        features:         JSON.stringify(p.features),
        active:           p.active,
        sort_order:       p.sort_order,
      })
      .select()
      .maybeSingle()
    if (error) throw error

    log.info({ id: data.id, name: p.name }, 'package created')
    res.status(201).json({ ok: true, package: data })
  } catch (err) {
    log.error({ err }, 'POST /admin/packages threw')
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/admin/packages/:id ─────────────────────────────────────────────
router.patch('/packages/:id', ...guard, async (req, res) => {
  try {
    const allowed = ['name', 'audience', 'description', 'price_cents', 'billing_interval', 'features', 'active', 'sort_order', 'stripe_price_id']
    const updates = pick(req.body, allowed)
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No updatable fields provided.' })
    }
    // features may arrive as an array — serialise to JSON if so
    if (Array.isArray(updates.features)) {
      updates.features = JSON.stringify(updates.features)
    }
    updates.updated_at = new Date().toISOString()

    const { data, error } = await adminSupabase
      .from('packages')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Package not found.' })

    res.json({ ok: true, package: data })
  } catch (err) {
    log.error({ err }, 'PATCH /admin/packages/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// REPORTS + ANALYTICS (unchanged from original)
// ═════════════════════════════════════════════════════════════════════════════

router.get('/reports', ...guard, async (req, res) => {
  try {
    const sb = adminSupabase
    const [{ data: rs }, { data: obs }, { data: sf }] = await Promise.all([
      sb.from('readiness_scores').select('overall'),
      sb.from('obligations').select('status'),
      sb.from('sponsorforge_profiles').select('is_locked'),
    ])

    const avgReady  = rs?.length ? Math.round(rs.reduce((s, r) => s + r.overall, 0) / rs.length) : 0
    const completed = (obs ?? []).filter(o => o.status === 'completed').length
    const rate      = (obs ?? []).length > 0 ? Math.round((completed / (obs ?? []).length) * 100) : 100
    const sfActive  = (sf ?? []).filter(s => !s.is_locked).length

    res.json({
      avg_readiness:     avgReady,
      obligations_rate:  rate,
      conduct_incidents: 0,
      sf_matches:        sfActive,
    })
  } catch (err) {
    log.error({ err }, '/admin/reports threw')
    res.status(500).json({ error: err.message })
  }
})

router.get('/analytics', ...guard, async (req, res) => {
  try {
    const sb  = adminSupabase
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()

    const { data: payments } = await sb
      .from('sponsorship_payments')
      .select('amount_usd, created_at')
      .eq('status', 'succeeded')
      .gte('created_at', sixMonthsAgo)

    const monthly = []
    for (let i = 5; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const value = (payments ?? [])
        .filter(p => { const t = new Date(p.created_at); return t >= d && t < end })
        .reduce((s, p) => s + (p.amount_usd ?? 0), 0)
      monthly.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), value })
    }

    res.json({ monthly_gmv: monthly })
  } catch (err) {
    log.error({ err }, '/admin/analytics threw')
    res.status(500).json({ error: err.message })
  }
})

router.get('/mentors', ...guard, async (req, res) => {
  try {
    const [{ data: cons, error: consErr }, { data: bookings }] = await Promise.all([
      adminSupabase.from('consultants').select('*').order('created_at'),
      adminSupabase.from('bookings').select('status').eq('status', 'completed'),
    ])
    if (consErr) log.warn({ err: consErr }, '/admin/mentors: consultants table not available')

    res.json({
      active_consultants:  (cons ?? []).filter(c => c.availability !== 'unavailable').length,
      sessions_this_month: (bookings ?? []).length,
      booking_rate:        0,
      consultants:         (cons ?? []).map(c => ({
        name:         c.name,
        specialty:    c.specialty,
        availability: c.availability,
        badge:        c.availability === 'available' ? 'Available' : c.availability === 'busy' ? 'Busy' : 'Unavailable',
        type:         c.availability === 'available' ? 'green' : c.availability === 'busy' ? 'yellow' : 'red',
      })),
    })
  } catch (err) {
    log.error({ err }, '/admin/mentors threw')
    res.status(500).json({ error: err.message })
  }
})

router.get('/sponsorforge', ...guard, async (req, res) => {
  try {
    const [{ data: sf }, { count: sponsorCount }, { count: matchCount }, { count: activeOppCount }, { count: pendingReviews }] = await Promise.all([
      adminSupabase.from('sponsorforge_profiles').select('user_id, is_locked'),
      adminSupabase.from('sponsor_profiles').select('*', { count: 'exact', head: true }).eq('is_verified', true),
      adminSupabase.from('matches').select('*', { count: 'exact', head: true }).eq('stale', false).neq('status', 'dismissed'),
      adminSupabase.from('sponsorship_opportunities').select('*', { count: 'exact', head: true }).eq('status', 'published').is('deleted_at', null),
      adminSupabase.from('sponsorforge_reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ])

    const eligible = (sf ?? []).filter(s => !s.is_locked).length

    res.json({
      sponsors:             sponsorCount  ?? 0,
      active_matches:       matchCount    ?? 0,
      eligible_fighters:    eligible,
      active_opportunities: activeOppCount ?? 0,
      pending_reviews:      pendingReviews ?? 0,
      deals_closed:         0,
      total_value:          0,
      activity:             [],
    })
  } catch (err) {
    log.error({ err }, '/admin/sponsorforge threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/sponsorforge/reviews ───────────────────────────────────────
// SponsorForge access requests. Defaults to the pending queue; ?status=all|approved|rejected.
router.get('/sponsorforge/reviews', ...guard, async (req, res) => {
  try {
    const status = req.query.status || 'pending'
    let q = adminSupabase
      .from('sponsorforge_reviews')
      .select('id, user_id, role, status, submitted_at, reviewed_at, admin_notes')
      .order('submitted_at', { ascending: false, nullsFirst: false })
    if (status !== 'all') q = q.eq('status', status)

    const { data: reviews, error } = await q
    if (error) throw error

    const uids = [...new Set((reviews ?? []).map(r => r.user_id))]
    const { data: profiles } = uids.length
      ? await adminSupabase.from('profiles').select('id, name, email').in('id', uids)
      : { data: [] }
    const pMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

    res.json({
      reviews: (reviews ?? []).map(r => ({
        ...r,
        name:  pMap[r.user_id]?.name  ?? 'User',
        email: pMap[r.user_id]?.email ?? null,
      })),
    })
  } catch (err) {
    log.error({ err }, 'GET /admin/sponsorforge/reviews threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/sponsorforge/reviews/:id ──────────────────────────────────
// Body: { action: 'approve' | 'reject', notes?, force? }
// approve → unlock SponsorForge (sponsorforge_profiles.is_locked = false) + notify.
// reject  → record admin_notes + notify; fighter can resubmit.
router.post('/sponsorforge/reviews/:id', ...guard, async (req, res) => {
  try {
    const sb = adminSupabase
    const { action, notes, force } = req.body
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be "approve" or "reject".' })
    }
    if (action === 'reject' && !(notes && String(notes).trim())) {
      return res.status(400).json({ error: 'A note is required when rejecting so the fighter knows what to fix.' })
    }

    const { data: review } = await sb
      .from('sponsorforge_reviews').select('id, user_id, role, status')
      .eq('id', req.params.id).maybeSingle()
    if (!review) return res.status(404).json({ error: 'Review not found.' })
    if (review.status !== 'pending' && !force) {
      return res.status(409).json({ error: `Review is "${review.status}". Pass force to override.` })
    }

    const now = new Date().toISOString()
    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    const { error: upErr } = await sb.from('sponsorforge_reviews').update({
      status: newStatus, reviewed_at: now, reviewed_by: req.user.id,
      admin_notes: notes ? String(notes).trim() : null, updated_at: now,
    }).eq('id', review.id)
    if (upErr) throw upErr

    if (action === 'approve') {
      // Unlock SponsorForge for this user.
      await sb.from('sponsorforge_profiles').upsert(
        { user_id: review.user_id, is_locked: false, updated_at: now },
        { onConflict: 'user_id' },
      )
    }

    // Notify the fighter of the decision.
    sb.from('notifications').insert({
      recipient_id: review.user_id,
      type:  action === 'approve' ? 'sponsorforge.approved' : 'sponsorforge.rejected',
      title: action === 'approve' ? 'SponsorForge unlocked' : 'SponsorForge review needs changes',
      body:  action === 'approve'
        ? 'Your access is approved — you can now see sponsor matches.'
        : (notes ? String(notes).trim() : 'Please review the feedback and resubmit.'),
      action_url: `${process.env.CLIENT_URL || ''}/dashboard/fighter`,
      related_type: 'sponsorforge_review', related_id: review.id,
    }).then(() => {}).catch(() => {})

    log.info({ id: review.id, action, by: req.user.id }, 'SponsorForge review decided')
    res.json({ ok: true, status: newStatus })
  } catch (err) {
    log.error({ err }, 'POST /admin/sponsorforge/reviews/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/sponsorforge/matches ───────────────────────────────────────
router.get('/sponsorforge/matches', ...guard, async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit) || 20, 100)
    const offset = Math.max(0, Number(req.query.offset) || 0)

    const { data: rows, error, count } = await adminSupabase
      .from('matches')
      .select('id, opportunity_id, fighter_id, sponsor_id, score, breakdown, reasons, status, computed_at', { count: 'exact' })
      .eq('stale', false)
      .order('score', { ascending: false })
      .range(offset, offset + limit - 1)
    if (error) throw error

    const fids   = [...new Set((rows ?? []).map(m => m.fighter_id))]
    const oidArr = [...new Set((rows ?? []).map(m => m.opportunity_id))]

    const [{ data: profiles }, { data: opps }] = await Promise.all([
      fids.length   ? adminSupabase.from('profiles').select('id, name').in('id', fids) : { data: [] },
      oidArr.length ? adminSupabase.from('sponsorship_opportunities').select('id, title').in('id', oidArr) : { data: [] },
    ])

    const prMap  = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
    const oppMap = Object.fromEntries((opps ?? []).map(o => [o.id, o]))

    const matches = (rows ?? []).map(m => ({
      ...m,
      fighter:     prMap[m.fighter_id]      ?? null,
      opportunity: oppMap[m.opportunity_id] ?? null,
    }))

    res.json({ ok: true, matches, total: count ?? 0 })
  } catch (err) {
    log.error({ err }, '/admin/sponsorforge/matches threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/sponsorforge/recompute ────────────────────────────────────
router.post('/sponsorforge/recompute', ...guard, async (req, res) => {
  try {
    const { data: opps, error: oppErr } = await adminSupabase
      .from('sponsorship_opportunities')
      .select('*')
      .eq('status', 'published')
      .is('deleted_at', null)
    if (oppErr) throw oppErr
    if (!(opps ?? []).length) return res.json({ ok: true, computed: 0, opportunities: 0 })

    let totalComputed = 0
    const failures = []
    for (const opp of opps) {
      try {
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
          totalComputed += computed.length
        }
      } catch (oppErr) {
        log.error({ err: oppErr, opp_id: opp.id }, 'recompute failed for one opportunity — continuing')
        failures.push(opp.id)
      }
    }

    log.info({ opps: opps.length, computed: totalComputed, failures: failures.length }, 'admin recomputed all matches')
    res.json({ ok: true, computed: totalComputed, opportunities: opps.length, failures })
  } catch (err) {
    log.error({ err }, '/admin/sponsorforge/recompute threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/marketplace ────────────────────────────────────────────────
router.get('/marketplace', ...guard, async (req, res) => {
  try {
    const sb = adminSupabase
    const [
      { count: contractCount },
      { count: activeContractCount },
      { count: oppCount },
      { count: appCount },
      { count: sponsorCount },
      { count: verifiedSponsorCount },
      { data: gmvRows },
      { data: appFunnel },
      { data: recent },
    ] = await Promise.all([
      sb.from('contracts').select('*', { count:'exact', head:true }).is('deleted_at', null),
      sb.from('contracts').select('*', { count:'exact', head:true }).eq('status','active').is('deleted_at', null),
      sb.from('sponsorship_opportunities').select('*', { count:'exact', head:true }),
      sb.from('applications').select('*', { count:'exact', head:true }),
      sb.from('sponsor_profiles').select('*', { count:'exact', head:true }).is('deleted_at', null),
      sb.from('sponsor_profiles').select('*', { count:'exact', head:true }).eq('is_verified', true),
      sb.from('sponsorship_payments').select('amount_usd').eq('status','succeeded'),
      sb.from('applications').select('status'),
      sb.from('contracts').select('id, status, value_usd, created_at').is('deleted_at', null)
        .order('created_at', { ascending:false }).limit(5),
    ])

    const gmv      = (gmvRows ?? []).reduce((s, p) => s + (p.amount_usd ?? 0), 0)
    const byStatus = {}
    for (const a of (appFunnel ?? [])) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1

    res.json({
      gmv_usd:             gmv,
      active_contracts:    activeContractCount  ?? 0,
      total_contracts:     contractCount        ?? 0,
      total_opportunities: oppCount             ?? 0,
      total_applications:  appCount             ?? 0,
      open_disputes:       0,
      sponsor_count:       sponsorCount         ?? 0,
      verified_sponsors:   verifiedSponsorCount ?? 0,
      applications_funnel: byStatus,
      recent_contracts:    (recent ?? []).map(c => ({
        name:  `Contract $${c.value_usd?.toLocaleString?.() ?? c.value_usd}`,
        badge: c.status.replace('_', ' '),
        type:  c.status === 'active' ? 'green' : c.status === 'terminated' ? 'red' : 'yellow',
      })),
    })
  } catch (err) {
    log.error({ err }, '/admin/marketplace threw')
    res.status(500).json({ error: err.message })
  }
})

router.get('/disputes', ...guard, async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit)  || 50, 200)
    const offset = Math.max(0, Number(req.query.offset) || 0)
    const status = req.query.status

    let q = adminSupabase
      .from('disputes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (status) q = q.eq('status', status)

    const { data, error, count } = await q
    if (error) throw error
    res.json({ ok: true, disputes: data ?? [], total: count ?? 0 })
  } catch (err) {
    log.error({ err }, '/admin/disputes threw')
    res.status(500).json({ error: err.message })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// BILLING — PAYMENTS + MEMBERSHIPS
// ═════════════════════════════════════════════════════════════════════════════

// ── GET /api/admin/payments ───────────────────────────────────────────────────
router.get('/payments', ...guard, async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit) || 20, 100)
    const offset = Math.max(0, Number(req.query.offset) || 0)
    const status = req.query.status

    let q = adminSupabase
      .from('payments')
      .select('id, user_id, package_id, amount, currency, status, stripe_checkout_session_id, stripe_payment_intent_id, created_at, packages(name, billing_interval)', { count: 'exact' })
      .not('package_id', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (status) q = q.eq('status', status)

    const { data: rows, error, count } = await q
    if (error) throw error

    const uids = [...new Set((rows ?? []).map(r => r.user_id).filter(Boolean))]
    const { data: profiles } = uids.length
      ? await adminSupabase.from('profiles').select('id, name, email, role').in('id', uids)
      : { data: [] }
    const pMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

    const enriched = (rows ?? []).map(r => ({ ...r, user: pMap[r.user_id] ?? null }))

    // Revenue summary
    const { data: allSucceeded } = await adminSupabase
      .from('payments')
      .select('amount, status')
      .not('package_id', 'is', null)

    const totalRevenueCents    = (allSucceeded ?? []).filter(p => p.status === 'succeeded').reduce((s, p) => s + (p.amount ?? 0), 0)
    const successfulPayments   = (allSucceeded ?? []).filter(p => p.status === 'succeeded').length
    const failedPayments       = (allSucceeded ?? []).filter(p => p.status === 'failed').length

    res.json({
      ok:       true,
      payments: enriched,
      total:    count ?? 0,
      summary: {
        total_revenue_cents: totalRevenueCents,
        successful:          successfulPayments,
        failed:              failedPayments,
        pending:             (allSucceeded ?? []).filter(p => p.status === 'pending').length,
      },
    })
  } catch (err) {
    log.error({ err }, '/admin/payments threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/memberships ────────────────────────────────────────────────
router.get('/memberships', ...guard, async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit) || 20, 100)
    const offset = Math.max(0, Number(req.query.offset) || 0)
    const status = req.query.status

    let q = adminSupabase
      .from('memberships')
      .select('id, user_id, package_id, status, billing_interval, current_period_start, current_period_end, cancel_at_period_end, created_at, packages(name, price_cents)', { count: 'exact' })
      .not('package_id', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (status) q = q.eq('status', status)

    const { data: rows, error, count } = await q
    if (error) throw error

    const uids = [...new Set((rows ?? []).map(r => r.user_id).filter(Boolean))]
    const { data: profiles } = uids.length
      ? await adminSupabase.from('profiles').select('id, name, email, role').in('id', uids)
      : { data: [] }
    const pMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

    const enriched = (rows ?? []).map(r => ({ ...r, user: pMap[r.user_id] ?? null }))

    res.json({ ok: true, memberships: enriched, total: count ?? 0 })
  } catch (err) {
    log.error({ err }, '/admin/memberships threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/conversations — list all conversations ─────────────────────
router.get('/conversations', ...guard, async (req, res) => {
  try {
    const sb     = adminSupabase
    const limit  = Math.min(Number(req.query.limit) || 20, 100)
    const offset = Math.max(0, Number(req.query.offset) || 0)
    const status = req.query.status

    let q = sb.from('conversations')
      .select('id, subject, context_type, context_id, status, created_by, last_message_at, created_at, updated_at', { count: 'exact' })
      .is('deleted_at', null)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)
    if (status) q = q.eq('status', status)

    const { data: convs, error, count } = await q
    if (error) throw error

    res.json({ ok: true, conversations: convs ?? [], total: count ?? 0 })
  } catch (err) {
    log.error({ err }, '/admin/conversations threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/conversations/:id — view conversation with messages ────────
router.get('/conversations/:id', ...guard, async (req, res) => {
  try {
    const sb = adminSupabase

    const [{ data: conv, error: cErr }, { data: participants }, { data: messages }] = await Promise.all([
      sb.from('conversations')
        .select('id, subject, context_type, context_id, status, created_by, last_message_at, created_at, updated_at')
        .eq('id', req.params.id)
        .maybeSingle(),
      sb.from('conversation_participants')
        .select('user_id, role_in_thread, unread_count, last_read_at')
        .eq('conversation_id', req.params.id),
      sb.from('messages')
        .select('id, conversation_id, sender_id, body, message_type, attachments, edited_at, deleted_at, created_at')
        .eq('conversation_id', req.params.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(100),
    ])

    if (cErr) throw cErr
    if (!conv) return res.status(404).json({ error: 'Not found.' })

    const pids = (participants ?? []).map(p => p.user_id)
    const { data: profiles } = pids.length
      ? await sb.from('profiles').select('id, name, role').in('id', pids)
      : { data: [] }

    res.json({
      ok:           true,
      conversation: conv,
      participants: participants ?? [],
      messages:     messages ?? [],
      profiles:     Object.fromEntries((profiles ?? []).map(p => [p.id, p])),
    })
  } catch (err) {
    log.error({ err }, '/admin/conversations/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/admin/conversations/:id/status — lock or archive ───────────────
router.patch('/conversations/:id/status', ...guard, async (req, res) => {
  try {
    const { status } = req.body
    if (!status || !['open', 'archived', 'locked'].includes(status)) {
      return res.status(400).json({ error: 'status must be open | archived | locked.' })
    }

    const { error } = await adminSupabase
      .from('conversations')
      .update({ status })
      .eq('id', req.params.id)
    if (error) throw error

    log.info({ id: req.params.id, status, by: req.user.id }, 'admin updated conversation status')
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /admin/conversations/:id/status threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/email/test ────────────────────────────────────────────────
router.post('/email/test', ...guard, async (req, res) => {
  try {
    if (!isEmailConfigured()) {
      return res.status(503).json({
        ok:    false,
        error: 'Email is not configured. Set SENDGRID_API_KEY (or EMAIL_HOST + EMAIL_USER + EMAIL_PASS).',
      })
    }

    const recipient = (req.body.to || req.user.email || '').trim()
    if (!recipient) {
      return res.status(400).json({ ok: false, error: 'No recipient email address.' })
    }

    await sendEmail(recipient, 'Eleventh Round — email delivery test', emailHtml(`
      <p>This is a test email from the <strong style="color:#f0ece4">Eleventh Round</strong> admin panel.</p>
      <p>If you received this, transactional email delivery is working correctly.</p>
      <p style="font-size:12px;color:#4a4846;margin-top:20px">Sent by: ${esc(req.user.email)}</p>
      ${ctaButton(process.env.CLIENT_URL || 'http://localhost:5173', 'Open Dashboard')}
    `))

    log.info({ to: recipient, by: req.user.id }, 'admin test email sent')
    res.json({ ok: true, sent_to: recipient })
  } catch (err) {
    log.error({ err }, 'POST /admin/email/test threw')
    res.status(500).json({ ok: false, error: err.message })
  }
})

export default router
