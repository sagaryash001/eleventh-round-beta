// ─────────────────────────────────────────────────────────────────────────────
// Onboarding routes — role-specific profile setup
//
// POST /api/onboarding/fighter  → upsert fighter_profiles, seed pipeline/scores
// POST /api/onboarding/manager  → update profiles with team/type data
// POST /api/onboarding/sponsor  → upsert sponsor_profiles
// GET  /api/onboarding/status   → current onboarding state
//
// All routes require auth. On success each sets profiles.onboarding_complete=true
// and returns { ok, profile, nextDashboard }.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express'
import { adminSupabase }                             from '../db/supabase.js'
import { requireAuth }                               from '../middleware/auth.js'
import { validate, FighterOnboardSchema,
         ManagerOnboardSchema, SponsorOnboardSchema } from '../lib/validate.js'
import { childLogger }                               from '../lib/logger.js'

const router = Router()
const log    = childLogger('onboarding')

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'team'
}

/**
 * Compute a baseline readiness score from onboarding payload.
 * V1 weights: profile 40%, social/media 20%, education 15%,
 *             sponsor-readiness 15%, obligation reliability 10%.
 * Education and sponsor-readiness are always 0 at onboarding.
 * Obligation reliability defaults to 50 (neutral — no history yet).
 */
function computeBaselineReadiness(p) {
  // Profile completeness (40%)
  const profileFields = [
    p.nickname, p.weight_class, p.sport, p.base_city, p.gym_name, p.bio,
    (p.record_wins > 0 || p.record_losses > 0) ? '1' : null,
  ]
  const filled = profileFields.filter(Boolean).length
  const profileScore = Math.round((filled / profileFields.length) * 100)

  // Social / media reach (20%)
  const followers = Number(p.instagram_followers) || 0
  let socialScore = p.instagram_handle ? 40 : 0
  if (followers > 100)    socialScore = Math.min(100, socialScore + 10)
  if (followers > 1_000)  socialScore = Math.min(100, socialScore + 20)
  if (followers > 10_000) socialScore = Math.min(100, socialScore + 20)
  if (followers > 50_000) socialScore = Math.min(100, socialScore + 10)
  if (p.tiktok_handle)    socialScore = Math.min(100, socialScore + 10)
  if (p.youtube_handle)   socialScore = Math.min(100, socialScore + 10)

  const overall = Math.max(0, Math.min(100, Math.round(
    profileScore * 0.40 +
    socialScore  * 0.20 +
    0            * 0.15 +  // education — 0 at onboarding
    0            * 0.15 +  // sponsor readiness — 0 at onboarding
    50           * 0.10    // obligation — neutral
  )))

  return {
    overall,
    brand:    Math.round((profileScore * 0.5 + socialScore * 0.5) * 0.6),
    finance:  0,
    conduct:  80,   // baseline trust
    sponsor:  0,
    media:    socialScore,
    pipeline: 20,   // stage 1 started
  }
}

// ── GET /api/onboarding/status ────────────────────────────────────────────────
router.get('/status', requireAuth, (req, res) => {
  const { role, onboarding_complete } = req.user

  const onboardPath =
    role === 'fighter' ? '/onboarding/fighter' :
    role === 'manager' ? '/onboarding/manager' :
    role === 'sponsor' ? '/onboarding/sponsor' :
    null

  const nextDashboard =
    role === 'fighter' ? '/dashboard/fighter' :
    role === 'manager' ? '/dashboard/manager' :
    role === 'sponsor' ? '/dashboard/sponsor' :
    '/dashboard/admin'

  res.json({
    ok:                  true,
    onboarding_complete: !!onboarding_complete,
    role,
    onboardPath,
    nextDashboard,
  })
})

// ── POST /api/onboarding/fighter ──────────────────────────────────────────────
router.post('/fighter', requireAuth, validate(FighterOnboardSchema), async (req, res) => {
  const sb  = adminSupabase
  const uid = req.user.id

  if (!['fighter', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Fighter onboarding requires a fighter account.' })
  }

  try {
    const p = req.valid

    // ── 1. Upsert fighter_profiles ────────────────────────────────────────
    const { error: fpErr } = await sb.from('fighter_profiles').upsert({
      user_id:               uid,
      nickname:              p.nickname              || null,
      weight_class:          p.weight_class,
      pro_status:            p.level,
      record_wins:           p.record_wins           || 0,
      record_losses:         p.record_losses         || 0,
      record_draws:          p.record_draws          || 0,
      base_city:             p.base_city             || null,
      gym_name:              p.gym_name              || null,
      bio:                   p.bio                   || null,
      sponsorship_interests: p.sport ? [p.sport] : [],
      is_open_to_sponsorship: true,
      visibility:            'sponsors_only',
      updated_at:            new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (fpErr) throw fpErr

    // ── 2. Upsert social_accounts ─────────────────────────────────────────
    const socialRows = []
    if (p.instagram_handle) {
      const h = p.instagram_handle.replace(/^@/, '').trim()
      socialRows.push({
        user_id:        uid,
        platform:       'instagram',
        handle:         h,
        profile_url:    `https://instagram.com/${h}`,
        follower_count: Number(p.instagram_followers) || 0,
        updated_at:     new Date().toISOString(),
      })
    }
    if (p.tiktok_handle) {
      const h = p.tiktok_handle.replace(/^@/, '').trim()
      socialRows.push({
        user_id:        uid,
        platform:       'tiktok',
        handle:         h,
        profile_url:    `https://tiktok.com/@${h}`,
        follower_count: 0,
        updated_at:     new Date().toISOString(),
      })
    }
    if (p.youtube_handle) {
      const h = p.youtube_handle.replace(/^@/, '').trim()
      socialRows.push({
        user_id:        uid,
        platform:       'youtube',
        handle:         h,
        profile_url:    `https://youtube.com/@${h}`,
        follower_count: 0,
        updated_at:     new Date().toISOString(),
      })
    }
    if (socialRows.length) {
      const { error: socErr } = await sb
        .from('social_accounts')
        .upsert(socialRows, { onConflict: 'user_id,platform' })
      if (socErr) log.warn({ err: socErr, uid }, 'social_accounts upsert failed (non-fatal)')
    }

    // ── 3. Link manager by email (optional) ───────────────────────────────
    if (p.manager_status === 'has_manager' && p.manager_email) {
      const { data: mgr } = await sb
        .from('profiles')
        .select('id')
        .ilike('email', p.manager_email.trim())
        .in('role', ['manager', 'admin'])
        .maybeSingle()

      if (mgr) {
        await sb.from('fighter_profiles')
          .update({ manager_id: mgr.id })
          .eq('user_id', uid)
        await sb.from('manager_fighters').upsert(
          { manager_id: mgr.id, fighter_id: uid, status: 'active', accepted_at: new Date().toISOString() },
          { onConflict: 'manager_id,fighter_id' }
        ).catch(e => log.warn({ e }, 'manager_fighters upsert failed (non-fatal)'))
      }
    }

    // ── 4. Compute + store readiness score ────────────────────────────────
    const scores = computeBaselineReadiness(p)
    await sb.from('readiness_scores').upsert({
      user_id:     uid,
      ...scores,
      trend:       JSON.stringify([scores.overall]),
      computed_at: new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    }, { onConflict: 'user_id' })

    // ── 5. Seed default pipeline_progress rows ────────────────────────────
    const filledFields  = [p.nickname, p.weight_class, p.base_city, p.gym_name, p.bio].filter(Boolean).length
    const profilePct    = Math.round(Math.min(100, (filledFields / 5) * 80))
    const recordPct     = (p.record_wins > 0 || p.record_losses > 0) ? 100 : 0
    const socialPct     = p.instagram_handle ? 50 : 0

    await sb.from('pipeline_progress').upsert([
      { user_id: uid, stage_number: 1, stage_label: 'Complete Fighter Profile',       completion_pct: profilePct },
      { user_id: uid, stage_number: 2, stage_label: 'Upload Headshot & Media',         completion_pct: 0 },
      { user_id: uid, stage_number: 3, stage_label: 'Add Fight Record',               completion_pct: recordPct },
      { user_id: uid, stage_number: 4, stage_label: 'Connect Social Accounts',        completion_pct: socialPct },
      { user_id: uid, stage_number: 5, stage_label: 'Complete First Education Module', completion_pct: 0 },
      { user_id: uid, stage_number: 6, stage_label: 'Become SponsorForge Ready',      completion_pct: 0 },
    ], { onConflict: 'user_id,stage_number' })

    // ── 6. Seed sponsorforge_profiles row ─────────────────────────────────
    await sb.from('sponsorforge_profiles').upsert({
      user_id:                 uid,
      eligibility_score:       Math.round(scores.overall * 0.7),
      is_locked:               scores.overall < 80,
      sponsor_profile_complete: false,
      pipeline_stage:          1,
      obligation_record_pct:   0,
      brand_readiness:         scores.brand,
      audience_score:          scores.media,
      availability_score:      p.has_upcoming_event ? 70 : 40,
      content_score:           0,
      last_computed_at:        new Date().toISOString(),
      updated_at:              new Date().toISOString(),
    }, { onConflict: 'user_id' })

    // ── 6b. Event Calendar — turn the "upcoming event" answer into a real event ──
    // Previously has_upcoming_event only nudged a score; now it seeds a real
    // calendar event the fighter can build obligations around.
    if (p.has_upcoming_event && (p.event_name || p.event_date)) {
      try {
        const { data: ev } = await sb.from('events').insert({
          name:        (p.event_name && p.event_name.trim()) || 'Upcoming Fight',
          event_type:  'fight',
          event_date:  p.event_date || new Date(Date.now() + 30 * 86400000).toISOString(),
          status:      'planned',
          visibility:  'manager_visible',
          weight_class: p.weight_class || null,
          owner_id:    uid,
          created_by:  uid,
        }).select('id').maybeSingle()
        if (ev?.id) {
          await sb.from('event_participants')
            .upsert({ event_id: ev.id, user_id: uid, role: 'fighter' }, { onConflict: 'event_id,user_id,role' })
        }
      } catch (e) { log.warn({ err: e, uid }, 'could not seed onboarding event') }
    }

    // ── 7. Mark onboarding complete ───────────────────────────────────────
    await sb.from('profiles').update({
      name:                p.full_name.trim(),
      onboarding_complete: true,
    }).eq('id', uid)

    const { data: profile } = await sb
      .from('profiles')
      .select('id, email, name, role, account_type, subdomain, onboarding_complete')
      .eq('id', uid)
      .maybeSingle()

    log.info({ uid, score: scores.overall }, 'fighter onboarding complete')
    res.json({ ok: true, profile, nextDashboard: '/dashboard/fighter' })
  } catch (err) {
    log.error({ err }, '/onboarding/fighter threw')
    res.status(500).json({ error: err.message || 'Onboarding failed. Please try again.' })
  }
})

// ── POST /api/onboarding/manager ──────────────────────────────────────────────
router.post('/manager', requireAuth, validate(ManagerOnboardSchema), async (req, res) => {
  const sb  = adminSupabase
  const uid = req.user.id

  if (!['manager', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager onboarding requires a manager account.' })
  }

  try {
    const p = req.valid

    // Ensure team_slug uniqueness before updating subdomain
    let subdomain = null
    if (p.team_slug) {
      const candidate = slugify(p.team_slug)
      const { data: clash } = await sb
        .from('profiles')
        .select('id')
        .eq('subdomain', candidate)
        .neq('id', uid)
        .maybeSingle()
      if (clash) {
        return res.status(409).json({ error: 'That team URL is already taken. Please choose another.' })
      }
      subdomain = candidate
    }

    const updates = {
      name:                p.manager_name.trim(),
      team_name:           p.team_name.trim(),
      manager_type:        p.manager_type,
      onboarding_complete: true,
    }
    if (subdomain) updates.subdomain = subdomain

    const { error: profErr } = await sb.from('profiles').update(updates).eq('id', uid)
    if (profErr) throw profErr

    const { data: profile } = await sb
      .from('profiles')
      .select('id, email, name, role, account_type, team_name, subdomain, manager_type, onboarding_complete')
      .eq('id', uid)
      .maybeSingle()

    log.info({ uid, manager_type: p.manager_type }, 'manager onboarding complete')
    res.json({ ok: true, profile, nextDashboard: '/dashboard/manager' })
  } catch (err) {
    log.error({ err }, '/onboarding/manager threw')
    res.status(500).json({ error: err.message || 'Onboarding failed. Please try again.' })
  }
})

// ── POST /api/onboarding/sponsor ──────────────────────────────────────────────
router.post('/sponsor', requireAuth, validate(SponsorOnboardSchema), async (req, res) => {
  const sb  = adminSupabase
  const uid = req.user.id

  if (!['sponsor', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Sponsor onboarding requires a sponsor account.' })
  }

  try {
    const p = req.valid

    // Get or generate public_slug
    const { data: existing } = await sb
      .from('sponsor_profiles')
      .select('public_slug')
      .eq('user_id', uid)
      .maybeSingle()

    const publicSlug = existing?.public_slug || (() => {
      const base = slugify(p.company_name)
      return `${base}-${Math.random().toString(36).slice(2, 6)}`
    })()

    const { error: spErr } = await sb.from('sponsor_profiles').upsert({
      user_id:                  uid,
      company_name:             p.company_name.trim(),
      website_url:              p.website_url              || null,
      industry:                 p.industry                 || null,
      description:              p.description              || null,
      hq_country:               p.hq_country               || null,
      hq_region:                p.hq_region                || null,
      budget_min_usd:           p.budget_min_usd ? Number(p.budget_min_usd) : null,
      budget_max_usd:           p.budget_max_usd ? Number(p.budget_max_usd) : null,
      preferred_weight_classes: p.preferred_weight_classes || [],
      preferred_promotions:     p.preferred_promotions     || [],
      campaign_goals:           p.campaign_goals           || [],
      is_verified:              false,   // admin must vet before sponsor can contact fighters
      visibility:               'verified_only',
      public_slug:              publicSlug,
      updated_at:               new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (spErr) throw spErr

    await sb.from('profiles').update({
      onboarding_complete: true,
    }).eq('id', uid)

    const { data: profile } = await sb
      .from('profiles')
      .select('id, email, name, role, account_type, onboarding_complete')
      .eq('id', uid)
      .maybeSingle()

    const { data: sponsorProfile } = await sb
      .from('sponsor_profiles')
      .select('user_id, company_name, is_verified, public_slug')
      .eq('user_id', uid)
      .maybeSingle()

    log.info({ uid }, 'sponsor onboarding complete')
    res.json({ ok: true, profile, sponsorProfile, nextDashboard: '/dashboard/sponsor' })
  } catch (err) {
    log.error({ err }, '/onboarding/sponsor threw')
    res.status(500).json({ error: err.message || 'Onboarding failed. Please try again.' })
  }
})

export default router
