import { Router } from 'express'
import { adminSupabase } from '../db/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { validate, FighterManagerRequestSchema } from '../lib/validate.js'
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
    const [{ data: fp }, { data: socials }] = await Promise.all([
      adminSupabase.from('fighter_profiles').select('*').eq('user_id', uid).maybeSingle(),
      adminSupabase.from('social_accounts').select('platform, handle, profile_url, follower_count').eq('user_id', uid),
    ])

    let managerName = null
    if (fp?.manager_id) {
      const { data: m } = await adminSupabase.from('profiles').select('name').eq('id', fp.manager_id).maybeSingle()
      managerName = m?.name ?? null
    }

    const wins   = fp?.record_wins   ?? 0
    const losses = fp?.record_losses ?? 0
    const draws  = fp?.record_draws  ?? 0
    const completeness = [fp?.division, fp?.base_city, fp?.weight_class, fp?.current_promotion, (socials ?? []).length, req.user.name]
      .filter(Boolean).length * 16

    res.json({
      name:                  req.user.name,
      email:                 req.user.email,
      nickname:              fp?.nickname ?? null,
      division:              fp?.division  ?? null,
      record:                `${wins}-${losses}${draws > 0 ? `-${draws}` : ''}`,
      record_wins:           wins,
      record_losses:         losses,
      record_draws:          draws,
      base:                  fp?.base_city ?? null,
      manager:               managerName,
      // marketplace core fields
      weight_class:          fp?.weight_class ?? null,
      current_promotion:     fp?.current_promotion ?? null,
      pro_status:            fp?.pro_status ?? null,
      nationality:           fp?.nationality ?? null,
      visibility:            fp?.visibility ?? 'sponsors_only',
      is_open_to_sponsorship: fp?.is_open_to_sponsorship ?? true,
      public_slug:           fp?.public_slug ?? null,
      socials:               socials ?? [],
      profile_completeness:  Math.min(completeness, 100),
      // media + public profile fields
      headshot_path:         fp?.headshot_path ?? null,
      banner_path:           fp?.banner_path ?? null,
      media_kit_url:         fp?.media_kit_url ?? null,
      highlight_video_urls:  fp?.highlight_video_urls ?? [],
      bio:                   fp?.bio ?? null,
      gym_name:              fp?.gym_name ?? null,
      coach_name:            fp?.coach_name ?? null,
    })
  } catch (err) {
    log.error({ err }, '/fighter/profile threw')
    res.status(500).json({ error: err.message })
  }
})

// Fields a fighter may set on their own fighter_profiles row.
const FIGHTER_WRITABLE = [
  // existing
  'division', 'base_city', 'record_wins', 'record_losses', 'record_draws',
  // marketplace core (Phase 1)
  'weight_class', 'current_promotion', 'pro_status', 'nationality',
  'visibility', 'is_open_to_sponsorship',
  // uploads + public profile (Phase Storage)
  'headshot_path', 'banner_path', 'media_kit_url', 'highlight_video_urls', 'bio',
  'nickname', 'gym_name', 'coach_name',
]

function pick(body, keys) {
  const out = {}
  for (const k of keys) if (body[k] !== undefined) out[k] = body[k]
  return out
}

// ── PATCH /api/fighter/profile ────────────────────────────────────────────────
router.patch('/profile', ...guard, async (req, res) => {
  try {
    const uid = req.user.id
    const row = { user_id: uid, ...pick(req.body, FIGHTER_WRITABLE), updated_at: new Date().toISOString() }

    const { error } = await adminSupabase
      .from('fighter_profiles')
      .upsert(row, { onConflict: 'user_id' })
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

// ── PATCH /api/fighter/socials ────────────────────────────────────────────────
// Body: { socials: [{ platform, handle, profile_url, follower_count }] }
// Upserts each by (user_id, platform). Empty handle removes that platform.
router.patch('/socials', ...guard, async (req, res) => {
  try {
    const uid = req.user.id
    const socials = Array.isArray(req.body.socials) ? req.body.socials : []
    const VALID = ['instagram', 'tiktok', 'youtube', 'x', 'facebook', 'twitch']

    const toUpsert = []
    const toDelete = []
    for (const s of socials) {
      if (!VALID.includes(s.platform)) continue
      if (!s.handle || !String(s.handle).trim()) { toDelete.push(s.platform); continue }
      toUpsert.push({
        user_id:        uid,
        platform:       s.platform,
        handle:         String(s.handle).trim().replace(/^@/, ''),
        profile_url:    s.profile_url || `https://${s.platform}.com/${String(s.handle).trim().replace(/^@/, '')}`,
        follower_count: Number.isFinite(+s.follower_count) ? +s.follower_count : null,
        updated_at:     new Date().toISOString(),
      })
    }

    if (toUpsert.length) {
      const { error } = await adminSupabase
        .from('social_accounts')
        .upsert(toUpsert, { onConflict: 'user_id,platform' })
      if (error) throw error
    }
    if (toDelete.length) {
      await adminSupabase
        .from('social_accounts')
        .delete()
        .eq('user_id', uid)
        .in('platform', toDelete)
    }

    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /fighter/socials threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/fighter/sponsorforge/gaps ───────────────────────────────────────
// Returns structured gap analysis for the fighter's SponsorForge profile.
router.get('/sponsorforge/gaps', ...guard, async (req, res) => {
  try {
    const uid = req.user.id
    const sb  = adminSupabase

    const [{ data: rs }, { data: fp }, { data: socials }] = await Promise.all([
      sb.from('readiness_scores').select('overall, brand, finance, conduct, sponsor, media, pipeline').eq('user_id', uid).maybeSingle(),
      sb.from('fighter_profiles').select('weight_class, base_city, sponsorship_interests, media_kit_url, highlight_video_urls, banner_path, is_open_to_sponsorship, nationality').eq('user_id', uid).maybeSingle(),
      sb.from('social_accounts').select('platform, follower_count').eq('user_id', uid),
    ])

    const gaps = []
    const readiness      = rs?.overall ?? 0
    const totalFollowers = (socials ?? []).reduce((s, a) => s + (a.follower_count || 0), 0)
    const mediaCount     = [!!fp?.media_kit_url, (fp?.highlight_video_urls || []).length > 0, !!fp?.banner_path].filter(Boolean).length

    // Visibility gate
    if (fp?.is_open_to_sponsorship === false) {
      gaps.push({ area: 'profile', label: 'Open to Sponsorship', impact: 'critical',
        message: "Profile is not marked open to sponsorship — you won't appear in any matches.",
        action: 'Enable "Open to Sponsorship" in your fighter profile' })
    }

    // Readiness (40% of match score)
    if (readiness < 70) {
      gaps.push({ area: 'readiness', label: 'Readiness Score', impact: 'high', score: readiness, target: 70,
        message: `Readiness is ${readiness}/100. SponsorForge matches weight this at 40% — it's the biggest lever.`,
        action: 'Complete pipeline stages and education modules to raise this score' })
    }

    // Sponsorship interests (brand fit 20%)
    if (!(fp?.sponsorship_interests ?? []).length) {
      gaps.push({ area: 'profile', label: 'Sponsorship Interests', impact: 'high',
        message: 'No interests listed. This drives brand/category matching (20% of score).',
        action: 'Add sponsorship interests in your fighter profile' })
    }

    // Social accounts (audience 15%)
    if (!(socials ?? []).length) {
      gaps.push({ area: 'social', label: 'Social Accounts', impact: 'high',
        message: 'No social accounts connected. Audience reach is 15% of your match score.',
        action: 'Link Instagram, TikTok or YouTube in your profile' })
    } else if (totalFollowers < 10000) {
      gaps.push({ area: 'social', label: 'Social Reach', impact: 'medium',
        message: `${totalFollowers.toLocaleString()} total followers. Most sponsors look for 10k+.`,
        action: 'Grow your audience on social platforms' })
    }

    // Media assets (content 5%)
    if (mediaCount < 2) {
      gaps.push({ area: 'media', label: 'Media Assets', impact: 'medium',
        message: `${mediaCount}/3 media assets complete. Sponsors want to see your content quality.`,
        action: 'Upload a media kit, banner image, or highlight reel' })
    }

    // Location (10%)
    if (!fp?.base_city && !fp?.nationality) {
      gaps.push({ area: 'profile', label: 'Location', impact: 'low',
        message: 'No location set. This affects location-targeted campaign matches (10% of score).',
        action: 'Add your nationality and base city in your profile' })
    }

    res.json({
      readiness_score:  readiness,
      is_open:          fp?.is_open_to_sponsorship ?? true,
      total_followers:  totalFollowers,
      platforms:        (socials ?? []).map(s => s.platform),
      media_count:      mediaCount,
      gaps,
      sub_scores: {
        brand:    rs?.brand    ?? 0,
        finance:  rs?.finance  ?? 0,
        conduct:  rs?.conduct  ?? 0,
        sponsor:  rs?.sponsor  ?? 0,
        media:    rs?.media    ?? 0,
        pipeline: rs?.pipeline ?? 0,
      },
    })
  } catch (err) {
    log.error({ err }, 'GET /fighter/sponsorforge/gaps threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/fighter/manager ──────────────────────────────────────────────────
// Returns all non-removed manager connections for this fighter.
// Auto-links any pending email invites that match this fighter's email.
router.get('/manager', ...guard, async (req, res) => {
  try {
    const sb    = adminSupabase
    const uid   = req.user.id
    const email = req.user.email
    const now   = new Date().toISOString()

    // Auto-link pending email invites created before this fighter registered.
    // Select manager_id so we can check for duplicate rows before linking.
    const { data: byEmail } = await sb
      .from('manager_fighters')
      .select('id, manager_id')
      .eq('invited_email', email)
      .eq('status', 'pending')
      .is('fighter_id', null)

    for (const invite of byEmail ?? []) {
      // If the fighter already has a row with this manager (e.g. they sent their
      // own request), linking would violate the (manager_id, fighter_id) unique
      // partial index. Remove the superseded email-invite row instead.
      const { data: dupe } = await sb
        .from('manager_fighters')
        .select('id')
        .eq('manager_id', invite.manager_id)
        .eq('fighter_id', uid)
        .maybeSingle()

      if (dupe) {
        await sb.from('manager_fighters')
          .update({ status: 'removed', removed_at: now, updated_at: now })
          .eq('id', invite.id)
      } else {
        await sb.from('manager_fighters')
          .update({ fighter_id: uid, invited_email: null, updated_at: now })
          .eq('id', invite.id)
      }
    }

    const { data: connections, error } = await sb
      .from('manager_fighters')
      .select('id, manager_id, status, source, request_message, requested_by, team_name, created_at, accepted_at, declined_at')
      .eq('fighter_id', uid)
      .neq('status', 'removed')
      .order('created_at', { ascending: false })
    if (error) throw error

    if (!(connections ?? []).length) return res.json({ connections: [] })

    const mids = [...new Set((connections ?? []).map(c => c.manager_id).filter(Boolean))]
    const { data: managers } = mids.length > 0
      ? await sb.from('profiles').select('id, name, email, team_name').in('id', mids)
      : { data: [] }

    const mgrMap = Object.fromEntries((managers ?? []).map(m => [m.id, m]))
    const enriched = (connections ?? []).map(c => ({
      ...c, manager: c.manager_id ? (mgrMap[c.manager_id] ?? null) : null,
    }))

    res.json({ connections: enriched })
  } catch (err) {
    log.error({ err }, 'GET /fighter/manager threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/fighter/manager/request ─────────────────────────────────────────
router.post('/manager/request', ...guard, validate(FighterManagerRequestSchema), async (req, res) => {
  try {
    const sb  = adminSupabase
    const uid = req.user.id
    const { manager_email, team_name, message } = req.valid
    const now = new Date().toISOString()

    let managerId = null

    if (manager_email) {
      const { data: mgr } = await sb.from('profiles')
        .select('id').eq('email', manager_email).in('role', ['manager', 'admin']).maybeSingle()
      if (!mgr) return res.status(404).json({ error: 'No manager account found with that email address.' })
      managerId = mgr.id
    } else if (team_name) {
      const safe = team_name.replace(/'/g, '')
      const { data: mgr } = await sb.from('profiles')
        .select('id').in('role', ['manager', 'admin']).ilike('team_name', `%${safe}%`).limit(1).maybeSingle()
      if (!mgr) return res.status(404).json({ error: 'No manager found with that team name. Try using their email instead.' })
      managerId = mgr.id
    }

    if (!managerId) return res.status(400).json({ error: 'Could not resolve manager.' })

    // Guard against self-linking
    if (managerId === uid) return res.status(400).json({ error: 'You cannot link to yourself.' })

    const { data: existing } = await sb.from('manager_fighters')
      .select('id, status').eq('manager_id', managerId).eq('fighter_id', uid).maybeSingle()

    if (existing?.status === 'active') {
      return res.status(409).json({ error: 'You are already connected to this manager.' })
    }
    if (existing?.status === 'pending') {
      return res.status(409).json({ error: 'A connection request to this manager is already pending.' })
    }

    const outboxPayload = { manager_id: managerId, fighter_id: uid, fighter_name: req.user.name ?? req.user.email, message: message ?? null }

    if (existing) {
      const { error } = await sb.from('manager_fighters')
        .update({ status: 'pending', source: 'fighter_request', request_message: message ?? null,
          requested_by: uid, declined_at: null, removed_at: null, updated_at: now })
        .eq('id', existing.id)
      if (error) throw error
      sb.from('outbox_events').insert({ event_type: 'fighter.manager_request', aggregate_type: 'manager_fighters', aggregate_id: existing.id, payload: outboxPayload }).then(() => {}).catch(() => {})
      return res.json({ ok: true, connection_id: existing.id })
    }

    const { data, error } = await sb.from('manager_fighters')
      .insert({ manager_id: managerId, fighter_id: uid, status: 'pending',
        source: 'fighter_request', team_name: team_name ?? null,
        request_message: message ?? null, requested_by: uid })
      .select('id').maybeSingle()
    if (error) throw error

    sb.from('outbox_events').insert({ event_type: 'fighter.manager_request', aggregate_type: 'manager_fighters', aggregate_id: data.id, payload: outboxPayload }).then(() => {}).catch(() => {})
    log.info({ mid: managerId, fid: uid }, 'fighter submitted manager request')
    return res.status(201).json({ ok: true, connection_id: data.id })
  } catch (err) {
    log.error({ err }, 'POST /fighter/manager/request threw')
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/fighter/manager/request/:connectionId ──────────────────────────
// Fighter can: remove/cancel their own request, OR accept a manager-initiated invite.
router.patch('/manager/request/:connectionId', ...guard, async (req, res) => {
  try {
    const uid         = req.user.id
    const { status }  = req.body
    const now         = new Date().toISOString()

    if (!['removed', 'active'].includes(status)) {
      return res.status(400).json({ error: 'Only "removed" or "active" are accepted.' })
    }

    const { data: conn } = await adminSupabase
      .from('manager_fighters').select('id, status, source')
      .eq('id', req.params.connectionId).eq('fighter_id', uid).maybeSingle()

    if (!conn) return res.status(404).json({ error: 'Connection not found.' })
    if (conn.status === 'removed') return res.status(400).json({ error: 'Connection is already removed.' })

    // A fighter may only accept rows the manager created (manager_invite or manual_create).
    // Fighter cannot self-accept their own outbound requests.
    if (status === 'active' && conn.source === 'fighter_request') {
      return res.status(400).json({ error: 'You cannot accept your own outbound request. The manager must accept it.' })
    }
    if (status === 'active' && conn.status !== 'pending') {
      return res.status(400).json({ error: 'Connection is not pending.' })
    }

    const updates = { status, updated_at: now }
    if (status === 'active')  updates.accepted_at = now
    if (status === 'removed') updates.removed_at  = now

    const { error } = await adminSupabase.from('manager_fighters')
      .update(updates).eq('id', conn.id)
    if (error) throw error

    log.info({ connectionId: conn.id, uid, status }, 'fighter updated connection status')
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /fighter/manager/request/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/fighter/marketplace — fighter's marketplace analytics ────────────
router.get('/marketplace', requireAuth, async (req, res) => {
  try {
    const uid = req.user.id
    const [
      { data: apps },
      { data: contracts },
      { data: payments },
      { data: obligations },
    ] = await Promise.all([
      adminSupabase.from('applications').select('id, status').eq('fighter_id', uid),
      adminSupabase.from('contracts').select('id, status, value_usd').eq('fighter_id', uid).is('deleted_at', null),
      adminSupabase.from('sponsorship_payments').select('amount_usd, status').eq('fighter_id', uid),
      adminSupabase.from('obligations').select('id, status').eq('owner_id', uid).not('contract_id', 'is', null),
    ])

    const totalApps      = (apps ?? []).length
    const acceptedApps   = (apps ?? []).filter(a => a.status === 'accepted').length
    const activeContracts  = (contracts ?? []).filter(c => c.status === 'active').length
    const totalEarnings  = (payments ?? [])
      .filter(p => p.status === 'succeeded')
      .reduce((s, p) => s + (p.amount_usd ?? 0), 0)
    const completedObs   = (obligations ?? []).filter(o => o.status === 'completed').length
    const pendingObs     = (obligations ?? []).filter(o => ['pending','in_progress'].includes(o.status)).length

    res.json({
      total_applications:   totalApps,
      accepted_applications: acceptedApps,
      acceptance_rate:      totalApps > 0 ? Math.round(acceptedApps / totalApps * 100) : 0,
      active_contracts:     activeContracts,
      total_contracts:      (contracts ?? []).length,
      total_earnings_usd:   totalEarnings,
      completed_obligations: completedObs,
      pending_obligations:   pendingObs,
    })
  } catch (err) {
    log.error({ err }, 'GET /fighter/marketplace threw')
    res.status(500).json({ error: err.message })
  }
})

export default router
