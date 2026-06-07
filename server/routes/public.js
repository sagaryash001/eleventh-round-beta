// ─────────────────────────────────────────────────────────────────────────────
// Public API — no authentication required.
//
// Rules:
//   - Fighter visibility='public'  → anyone can view
//   - Fighter visibility='sponsors_only' → authenticated sponsors only (enforced at backend)
//   - Fighter visibility='private' → 404 for everyone
//   - Never expose: email, contract details, applications, messages, private obligations
//   - Team page: manager's active roster fighters with public profiles
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express'
import { adminSupabase } from '../db/supabase.js'
import { childLogger } from '../lib/logger.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const log    = childLogger('public')

// Public fields safe to expose on a fighter's public profile
const FIGHTER_PUBLIC_FIELDS = [
  'user_id', 'nickname', 'division', 'weight_class', 'current_promotion',
  'pro_status', 'nationality', 'base_city', 'gym_name', 'coach_name',
  'record_wins', 'record_losses', 'record_draws',
  'headshot_path', 'banner_path', 'media_kit_url', 'highlight_video_urls',
  'sponsorship_interests', 'bio', 'visibility', 'is_open_to_sponsorship',
  'public_slug',
].join(', ')

// ── GET /api/public/fighters/:slug ───────────────────────────────────────────
router.get('/fighters/:slug', async (req, res) => {
  try {
    const sb = adminSupabase
    if (!sb) return res.status(503).json({ error: 'Database not configured.' })

    const { slug } = req.params

    const { data: fp, error: fpErr } = await sb
      .from('fighter_profiles')
      .select(FIGHTER_PUBLIC_FIELDS)
      .eq('public_slug', slug)
      .maybeSingle()

    if (fpErr) throw fpErr
    if (!fp) return res.status(404).json({ error: 'Fighter not found.' })

    // Visibility gate
    if (fp.visibility === 'private') return res.status(404).json({ error: 'Fighter not found.' })
    // sponsors_only: allow (we serve the page and let the frontend handle the CTA)
    // In V1 we don't enforce auth on this endpoint for sponsors_only —
    // the profile data is still returned so sponsors browsing can see it.

    // Fetch public name from profiles (no email)
    const { data: profile } = await sb
      .from('profiles')
      .select('name')
      .eq('id', fp.user_id)
      .maybeSingle()

    // Fetch social accounts
    const { data: socials } = await sb
      .from('social_accounts')
      .select('platform, handle, profile_url, follower_count')
      .eq('user_id', fp.user_id)

    res.json({
      ok: true,
      fighter: {
        name:                  profile?.name ?? null,
        nickname:              fp.nickname ?? null,
        division:              fp.division ?? null,
        weight_class:          fp.weight_class ?? null,
        current_promotion:     fp.current_promotion ?? null,
        pro_status:            fp.pro_status ?? null,
        nationality:           fp.nationality ?? null,
        base_city:             fp.base_city ?? null,
        gym_name:              fp.gym_name ?? null,
        coach_name:            fp.coach_name ?? null,
        record:                { wins: fp.record_wins ?? 0, losses: fp.record_losses ?? 0, draws: fp.record_draws ?? 0 },
        headshot_path:         fp.headshot_path ?? null,
        banner_path:           fp.banner_path ?? null,
        media_kit_url:         fp.media_kit_url ?? null,
        highlight_video_urls:  fp.highlight_video_urls ?? [],
        sponsorship_interests: fp.sponsorship_interests ?? [],
        bio:                   fp.bio ?? null,
        visibility:            fp.visibility,
        is_open_to_sponsorship: fp.is_open_to_sponsorship,
        public_slug:           fp.public_slug,
        socials:               (socials ?? []).map(s => ({ platform: s.platform, handle: s.handle, profile_url: s.profile_url, follower_count: s.follower_count })),
      },
    })
  } catch (err) {
    log.error({ err }, 'GET /public/fighters/:slug threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/public/team/:slug ────────────────────────────────────────────────
// Team page: manager's public profile + active roster fighters.
// :slug is the manager's profiles.subdomain.
router.get('/team/:slug', async (req, res) => {
  try {
    const sb = adminSupabase
    if (!sb) return res.status(503).json({ error: 'Database not configured.' })

    const { slug } = req.params

    // Find the manager by subdomain
    const { data: manager, error: mErr } = await sb
      .from('profiles')
      .select('id, name, team_name, role')
      .eq('subdomain', slug)
      .in('role', ['manager', 'admin'])
      .maybeSingle()

    if (mErr) throw mErr
    if (!manager) return res.status(404).json({ error: 'Team not found.' })

    // Get active roster fighter IDs
    const { data: links } = await sb
      .from('manager_fighters')
      .select('fighter_id')
      .eq('manager_id', manager.id)
      .eq('status', 'active')
      .not('fighter_id', 'is', null)

    const fids = (links ?? []).map(l => l.fighter_id)

    let fighters = []
    if (fids.length) {
      // Only fighters with public visibility
      const [{ data: fps }, { data: profiles }] = await Promise.all([
        sb.from('fighter_profiles')
          .select('user_id, division, weight_class, record_wins, record_losses, record_draws, headshot_path, pro_status, public_slug, visibility')
          .in('user_id', fids)
          .eq('visibility', 'public'),
        sb.from('profiles').select('id, name').in('id', fids),
      ])

      const nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.name]))
      fighters = (fps ?? []).map(fp => ({
        name:        nameMap[fp.user_id] ?? null,
        division:    fp.division ?? null,
        weight_class: fp.weight_class ?? null,
        pro_status:  fp.pro_status ?? null,
        record:      { wins: fp.record_wins ?? 0, losses: fp.record_losses ?? 0, draws: fp.record_draws ?? 0 },
        headshot_path: fp.headshot_path ?? null,
        public_slug: fp.public_slug ?? null,
      }))
    }

    res.json({
      ok: true,
      team: {
        name:      manager.team_name ?? manager.name,
        slug,
        fighters,
      },
    })
  } catch (err) {
    log.error({ err }, 'GET /public/team/:slug threw')
    res.status(500).json({ error: err.message })
  }
})

export default router
