// ─────────────────────────────────────────────────────────────────────────────
// Rule-based matching engine (v1-rule)
//
// Scores a fighter against an opportunity on 7 weighted factors → 0–100.
// Stored in matches.factor_breakdown so the UI can show "why".
// Algorithm version is baked into every row so a v2-ai model can coexist.
//
// Input contract:
//   opp    — sponsorship_opportunities row
//   fp     — fighter_profiles row (with weight_class, current_promotion, nationality)
//   socials — social_accounts[] for the fighter (sum for total reach)
//
// Returns: { score, breakdown, reasons }
// ─────────────────────────────────────────────────────────────────────────────

const WEIGHTS = {
  geography:    15,
  weight_class: 15,
  promotion:    10,
  reach:        20,
  engagement:   15,
  demographics: 15,
  reliability:  10,
}

export function computeMatchScore(opp, fp, socials = [], reliabilityPct = null) {
  const breakdown = {}
  const reasons   = []

  // ── 1. Geography (15 pts) ──────────────────────────────────────────────────
  {
    const fCountry = (fp.nationality  || '').toUpperCase()
    const oCountry = (opp.location_country || '').toUpperCase()
    let pts = 0
    if (oCountry && fCountry) {
      if (fCountry === oCountry) { pts = 15; reasons.push('Same country as campaign') }
      else pts = 5
    } else {
      pts = 8 // no geo filter → partial credit
    }
    breakdown.geography = pts
  }

  // ── 2. Weight class (15 pts) ───────────────────────────────────────────────
  {
    const req = opp.requirements?.weight_classes || []
    const fw  = fp.weight_class
    let pts = 0
    if (!req.length) {
      pts = 12; reasons.push('Open to all weight classes')
    } else if (fw && req.includes(fw)) {
      pts = 15; reasons.push(`Weight class match (${fw})`)
    } else {
      pts = 0
    }
    breakdown.weight_class = pts
  }

  // ── 3. Promotion fit (10 pts) ──────────────────────────────────────────────
  {
    const preferred = opp.requirements?.promotions || []
    const fp_promo  = fp.current_promotion
    let pts = 0
    if (!preferred.length) {
      pts = 8
    } else if (fp_promo && preferred.includes(fp_promo)) {
      pts = 10; reasons.push(`Promotion match (${fp_promo})`)
    } else {
      pts = 0
    }
    breakdown.promotion = pts
  }

  // ── 4. Social reach (20 pts) ───────────────────────────────────────────────
  {
    const totalFollowers = (socials || []).reduce((s, a) => s + (a.follower_count || 0), 0)
    const minRequired    = opp.requirements?.min_followers || 0
    let pts = 0
    if (totalFollowers >= minRequired) {
      // log10 scale: 0→0, 1k→10, 10k→14, 100k→18, 1M→20
      pts = Math.min(20, Math.round((Math.log10(Math.max(totalFollowers, 1)) / 6) * 20))
      if (totalFollowers >= 50000) reasons.push(`Strong social reach (${(totalFollowers/1000).toFixed(0)}k followers)`)
    } else {
      // partial credit proportional to requirement gap
      pts = Math.round((totalFollowers / minRequired) * 10)
    }
    breakdown.reach = Math.max(0, pts)
  }

  // ── 5. Engagement (15 pts) ────────────────────────────────────────────────
  {
    const accountsWithEng  = (socials || []).filter(a => a.engagement_rate_bps)
    const avgEngBps        = accountsWithEng.length
      ? Math.round(accountsWithEng.reduce((s, a) => s + a.engagement_rate_bps, 0) / accountsWithEng.length)
      : null
    const minEngBps        = opp.requirements?.min_engagement_bps || 0
    let pts = 0
    if (avgEngBps === null) {
      pts = 7 // unknown → half credit
    } else if (avgEngBps >= minEngBps) {
      // 100bps = 1%; 700bps (7%) = max score
      pts = Math.min(15, Math.round((avgEngBps / 700) * 15))
      if (avgEngBps >= 300) reasons.push(`Good engagement (${(avgEngBps/100).toFixed(1)}%)`)
    }
    breakdown.engagement = Math.max(0, pts)
  }

  // ── 6. Demographics (15 pts) — self-reported placeholder ──────────────────
  {
    // Full implementation needs audience_demographics row.
    // v1: grant 10pts (partial) when fighter has any social reach, else 5.
    const hasSocials = (socials || []).some(a => a.follower_count > 0)
    breakdown.demographics = hasSocials ? 10 : 5
  }

  // ── 7. Reliability (10 pts) ────────────────────────────────────────────────
  {
    let pts = 7 // default: no history → mostly trust
    if (reliabilityPct !== null) {
      pts = Math.round((reliabilityPct / 100) * 10)
      if (reliabilityPct >= 90) reasons.push('Strong obligation completion record')
    }
    breakdown.reliability = pts
  }

  const raw   = Object.values(breakdown).reduce((s, v) => s + v, 0)
  const max   = Object.values(WEIGHTS).reduce((s, v) => s + v, 0)
  const score = Math.max(0, Math.min(100, Math.round((raw / max) * 100)))

  return { score, breakdown, reasons }
}

// ── Batch-compute for all eligible fighters against one opportunity ───────────
// Returns array of { fighter_id, score, breakdown, reasons }
export async function computeMatchesForOpp(opp, sb) {
  // Fetch fighters who are open to sponsorship
  const { data: fighters } = await sb
    .from('fighter_profiles')
    .select('user_id, weight_class, current_promotion, nationality')
    .eq('is_open_to_sponsorship', true)
    .neq('visibility', 'private')

  if (!fighters?.length) return []

  const fighterIds = fighters.map(f => f.user_id)

  // Fetch socials for all fighters in one query
  const { data: allSocials } = await sb
    .from('social_accounts')
    .select('user_id, platform, follower_count, engagement_rate_bps')
    .in('user_id', fighterIds)

  const socialsByFighter = {}
  for (const s of (allSocials || [])) {
    if (!socialsByFighter[s.user_id]) socialsByFighter[s.user_id] = []
    socialsByFighter[s.user_id].push(s)
  }

  const results = []
  for (const fp of fighters) {
    const socials = socialsByFighter[fp.user_id] || []
    const { score, breakdown, reasons } = computeMatchScore(opp, fp, socials)
    results.push({ fighter_id: fp.user_id, score, breakdown, reasons })
  }

  return results.sort((a, b) => b.score - a.score)
}
