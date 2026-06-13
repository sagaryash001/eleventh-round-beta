// ─────────────────────────────────────────────────────────────────────────────
// SponsorForge V1 rule-based matching engine
//
// Weights (sum = 100):
//   readiness    40 — readiness_scores.overall
//   brand_fit    20 — sponsorship_interests vs campaign category/deliverables
//   location     10 — nationality/base_city vs opp location
//   audience     15 — social follower count (log scale)
//   availability 10 — campaign timing vs fighter schedule
//   content       5 — media asset completeness
//
// computeMatchScore(opp, fp, socials, readinessScore?)
//   → { score, breakdown, reasons }
//   score     : 0–100 integer
//   breakdown : { readiness, brand_fit, location, audience, availability, content }
//   reasons   : { readiness, brand_fit, location, audience, availability, content }
//
// computeMatchesForOpp(opp, sb)
//   → Array<{ fighter_id, score, breakdown, reasons }> sorted desc
// ─────────────────────────────────────────────────────────────────────────────

// ── Tier label for user-facing match display ──────────────────────────────────
// Admins see the exact 0–100 score; everyone else sees only a coarse tier so the
// internal scoring formula isn't exposed. `hasData=false` when the fighter has
// no readiness/profile signal yet.
export function scoreTier(score, hasData = true) {
  if (!hasData || score == null)  return { tier: 'no_data',    label: 'Not Enough Data' }
  if (score >= 75)                return { tier: 'strong',     label: 'Strong Match' }
  if (score >= 55)                return { tier: 'good',       label: 'Good Match' }
  if (score >= 30)                return { tier: 'needs_info', label: 'Needs Info' }
  return { tier: 'no_data', label: 'Not Enough Data' }
}

// ── Score one fighter against one opportunity ─────────────────────────────────
// readinessScore: readiness_scores.overall (0-100), or null if not yet computed
export function computeMatchScore(opp, fp, socials = [], readinessScore = null) {
  const breakdown = {}
  const reasons   = {}

  // ── 1. Readiness (40 pts) ──────────────────────────────────────────────────
  {
    const rs  = readinessScore ?? 0
    const pts = Math.round((rs / 100) * 40)
    breakdown.readiness = pts
    reasons.readiness   = rs >= 70
      ? `Readiness score is ${rs}/100 — above the 70+ SponsorForge threshold`
      : rs > 0
        ? `Readiness score is ${rs}/100 — complete pipeline stages to reach 70+`
        : 'No readiness score yet — complete your profile to unlock this score'
  }

  // ── 2. Brand / category fit (20 pts) ──────────────────────────────────────
  {
    const campaignType = (opp.campaign_type || '').toLowerCase().replace(/_/g, ' ')
    const delivTypes   = (opp.deliverables || []).map(d => (d.type || '').toLowerCase().replace(/_/g, ' '))
    const interests    = (fp.sponsorship_interests || []).map(i => i.toLowerCase())

    const targets  = [campaignType, ...delivTypes].filter(Boolean)
    const overlaps = interests.filter(i => targets.some(t => t.includes(i) || i.includes(t)))

    let pts
    if (overlaps.length > 0) {
      pts = Math.min(20, 12 + overlaps.length * 4)
      reasons.brand_fit = `Fighter interests align with campaign (${overlaps.slice(0, 2).join(', ')})`
    } else if (interests.length > 0) {
      pts = 6
      reasons.brand_fit = 'Sponsorship interests on profile — no direct category match'
    } else {
      pts = 2
      reasons.brand_fit = 'No sponsorship interests listed — add them to boost brand fit score'
    }
    breakdown.brand_fit = pts
  }

  // ── 3. Location fit (10 pts) ──────────────────────────────────────────────
  {
    const fNat     = (fp.nationality || '').toUpperCase().trim()
    const fCity    = (fp.base_city   || '').toLowerCase().trim()
    const oCountry = (opp.location_country || '').toUpperCase().trim()
    const oRegion  = (opp.location_region  || '').toLowerCase().trim()

    let pts
    if (!oCountry) {
      pts = 7
      reasons.location = 'No location filter on this campaign — all regions eligible'
    } else if (fNat && fNat === oCountry) {
      const cityMatch = oRegion && fCity && (fCity.includes(oRegion) || oRegion.includes(fCity))
      pts = cityMatch ? 10 : 8
      reasons.location = cityMatch
        ? `Fighter is based in the target region (${oRegion})`
        : `Fighter is in the target country (${oCountry})`
    } else if (fNat) {
      pts = 2
      reasons.location = `Campaign targets ${oCountry}; fighter is from ${fNat}`
    } else {
      pts = 4
      reasons.location = 'Fighter location not set — add nationality and city to improve'
    }
    breakdown.location = pts
  }

  // ── 4. Audience / social fit (15 pts) ─────────────────────────────────────
  {
    const totalFollowers = (socials || []).reduce((s, a) => s + (a.follower_count || 0), 0)
    const minRequired    = opp.requirements?.min_followers || 0

    let pts
    if (!socials.length) {
      pts = 1
      reasons.audience = 'No social accounts linked — connect Instagram or TikTok to score audience reach'
    } else if (minRequired > 0 && totalFollowers < minRequired) {
      pts = Math.round((totalFollowers / minRequired) * 7)
      reasons.audience = `${totalFollowers.toLocaleString()} followers — campaign requires ${minRequired.toLocaleString()}+`
    } else {
      // log10 scale: 1k→5, 10k→8, 100k→12, 1M→15
      pts = Math.min(15, Math.round((Math.log10(Math.max(totalFollowers, 100)) / 6) * 15))
      reasons.audience = totalFollowers >= 100000
        ? `Strong reach: ${(totalFollowers / 1000).toFixed(0)}k total followers`
        : totalFollowers >= 10000
          ? `Good reach: ${(totalFollowers / 1000).toFixed(1)}k total followers`
          : `Social presence: ${totalFollowers.toLocaleString()} followers`
    }
    breakdown.audience = Math.max(0, Math.min(15, Math.round(pts)))
  }

  // ── 5. Availability / timing (10 pts) ─────────────────────────────────────
  {
    // V1: neutral 6–7 pts; full 10 only when campaign has no deadline (open-ended)
    // Future: compare campaign_start with fighter event calendar
    let pts
    if (!opp.application_deadline && !opp.campaign_start) {
      pts = 7
      reasons.availability = 'Open-ended campaign — no scheduling conflicts detected'
    } else if (opp.application_deadline) {
      const daysLeft = Math.ceil((new Date(opp.application_deadline) - Date.now()) / 86400000)
      if (daysLeft > 30) {
        pts = 8
        reasons.availability = `${daysLeft} days until application deadline — good availability window`
      } else if (daysLeft > 7) {
        pts = 6
        reasons.availability = `${daysLeft} days to apply — check your schedule before committing`
      } else {
        pts = 4
        reasons.availability = `Deadline in ${daysLeft} days — act quickly if interested`
      }
    } else {
      pts = 6
      reasons.availability = 'Campaign has a start date — confirm availability'
    }
    breakdown.availability = pts
  }

  // ── 6. Content quality (5 pts) ────────────────────────────────────────────
  {
    const assets = [
      !!fp.media_kit_url,
      (fp.highlight_video_urls || []).length > 0,
      !!fp.banner_path,
    ].filter(Boolean).length

    const pts = assets >= 3 ? 5 : assets === 2 ? 4 : assets === 1 ? 2 : 1
    reasons.content = assets >= 2
      ? 'Profile includes media kit and visual content'
      : assets === 1
        ? 'Some media assets — add a media kit or highlight reel to strengthen profile'
        : 'No media assets — upload a media kit, banner, or highlight videos'
    breakdown.content = pts
  }

  // ── Total ──────────────────────────────────────────────────────────────────
  const score = Math.max(0, Math.min(100,
    Object.values(breakdown).reduce((s, v) => s + v, 0),
  ))

  return { score, breakdown, reasons }
}

// ── Batch-compute for all eligible fighters against one opportunity ───────────
// Returns [{ fighter_id, score, breakdown, reasons }] sorted desc
export async function computeMatchesForOpp(opp, sb) {
  const { data: fighters } = await sb
    .from('fighter_profiles')
    .select('user_id, weight_class, current_promotion, nationality, base_city, sponsorship_interests, media_kit_url, highlight_video_urls, banner_path')
    .eq('is_open_to_sponsorship', true)
    .neq('visibility', 'private')

  if (!fighters?.length) return []

  const ids = fighters.map(f => f.user_id)

  const [{ data: allSocials }, { data: allReadiness }] = await Promise.all([
    sb.from('social_accounts')
      .select('user_id, platform, follower_count, engagement_rate_bps')
      .in('user_id', ids),
    sb.from('readiness_scores')
      .select('user_id, overall')
      .in('user_id', ids),
  ])

  const socialsMap   = {}
  const readinessMap = {}
  for (const s of (allSocials   || [])) {
    if (!socialsMap[s.user_id]) socialsMap[s.user_id] = []
    socialsMap[s.user_id].push(s)
  }
  for (const r of (allReadiness || [])) {
    readinessMap[r.user_id] = r.overall
  }

  const results = []
  for (const fp of fighters) {
    const socials   = socialsMap[fp.user_id]   || []
    const readiness = readinessMap[fp.user_id] ?? null
    const { score, breakdown, reasons } = computeMatchScore(opp, fp, socials, readiness)
    results.push({ fighter_id: fp.user_id, score, breakdown, reasons })
  }

  return results.sort((a, b) => b.score - a.score)
}
