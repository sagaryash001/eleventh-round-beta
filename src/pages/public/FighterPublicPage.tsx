import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { getPublicFighterProfile, storageUrl, type PublicFighter } from '../../lib/api/public'

const SOCIAL_ICONS: Record<string, string> = {
  instagram: 'IG', tiktok: 'TK', youtube: 'YT', x: 'X', facebook: 'FB', twitch: 'TV',
}

// Only allow http/https/mailto schemes in user-supplied URLs.
// Rejects javascript:, data:, vbscript:, and any other scheme.
function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url, window.location.origin)
    return ['https:', 'http:', 'mailto:'].includes(parsed.protocol) ? url : undefined
  } catch {
    return undefined
  }
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-off-white" style={{ fontSize: 28, lineHeight: 1 }}>{value}</div>
      <div className="font-condensed text-[10px] font-bold uppercase tracking-[0.3em] text-gray-3 mt-1">{label}</div>
    </div>
  )
}

export default function FighterPublicPage() {
  const { slug } = useParams<{ slug: string }>()
  const [fighter, setFighter] = useState<PublicFighter | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    getPublicFighterProfile(slug)
      .then(r => { setFighter(r.fighter); setLoading(false) })
      .catch(e => {
        if (e.status === 404 || e.message?.includes('404') || e.message?.includes('not found')) setNotFound(true)
        setLoading(false)
      })
  }, [slug])

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-charcoal-3 border-t-blood-glow rounded-full animate-spin" />
    </div>
  )

  if (notFound || !fighter) return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="font-condensed text-gray-3 uppercase tracking-widest text-[11px] mb-4">Fighter Not Found</p>
          <Link to="/opportunities" className="btn-ghost no-underline">Browse Opportunities</Link>
        </div>
      </div>
    </div>
  )

  const { record } = fighter
  const recordStr  = `${record.wins}-${record.losses}${record.draws > 0 ? `-${record.draws}` : ''}`
  const headshotUrl = storageUrl(fighter.headshot_path)
  const bannerUrl   = storageUrl(fighter.banner_path)

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />

      {/* Banner */}
      <div className="relative w-full overflow-hidden" style={{ height: 280 }}>
        {bannerUrl ? (
          <img src={bannerUrl} alt={`${fighter.name} banner`}
            className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #0d0d10, #1a1a1e)' }} />
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.9))' }} />
      </div>

      <div className="max-w-4xl mx-auto w-full px-6" style={{ marginTop: -80 }}>
        {/* Headshot + name row */}
        <div className="flex items-end gap-6 mb-8">
          <div className="flex-shrink-0 w-32 h-32 border-2 border-charcoal-3 overflow-hidden"
            style={{ background: '#141416' }}>
            {headshotUrl ? (
              <img src={headshotUrl} alt={fighter.name ?? 'Fighter'} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="font-display text-gray-3 uppercase" style={{ fontSize: 40 }}>
                  {(fighter.name ?? '?')[0]}
                </span>
              </div>
            )}
          </div>

          <div className="pb-2 flex-1 min-w-0">
            <div className="font-display text-off-white uppercase truncate" style={{ fontSize: 'clamp(28px,4vw,48px)', lineHeight: 0.92 }}>
              {fighter.name ?? 'Fighter'}
            </div>
            {fighter.nickname && (
              <div className="font-condensed text-blood-glow text-[14px] mt-1">"{fighter.nickname}"</div>
            )}
            <div className="font-condensed text-gray-3 text-[12px] mt-2 flex flex-wrap gap-3">
              {fighter.weight_class && <span>{fighter.weight_class}</span>}
              {fighter.current_promotion && <span>· {fighter.current_promotion}</span>}
              {fighter.base_city && <span>· {fighter.base_city}</span>}
            </div>
          </div>

          {fighter.is_open_to_sponsorship && (
            <div className="flex-shrink-0 pb-2">
              <span className="font-condensed text-[9px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 border"
                style={{ borderColor: '#00c060', color: '#00c060' }}>
                Open to Sponsorship
              </span>
            </div>
          )}
        </div>

        <div className="grid gap-6 mb-8" style={{ gridTemplateColumns: '1fr 280px' }}>
          {/* Left: bio + details */}
          <div className="space-y-5">
            {/* Bio */}
            {fighter.bio && (
              <div className="bg-charcoal border border-charcoal-3 p-6" style={{ borderLeft: '2px solid #8b0000' }}>
                <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-blood-glow mb-3">About</div>
                <p className="font-body text-gray-2 leading-relaxed" style={{ fontSize: 14 }}>{fighter.bio}</p>
              </div>
            )}

            {/* Record */}
            <div className="bg-charcoal border border-charcoal-3 p-6" style={{ borderLeft: '2px solid #8b0000' }}>
              <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-blood-glow mb-4">Fight Record</div>
              <div className="flex items-center gap-8">
                <StatPill label="Wins"   value={String(record.wins)} />
                <span className="font-display text-charcoal-3 text-[24px]">—</span>
                <StatPill label="Losses" value={String(record.losses)} />
                {record.draws > 0 && <>
                  <span className="font-display text-charcoal-3 text-[24px]">—</span>
                  <StatPill label="Draws" value={String(record.draws)} />
                </>}
                <div className="ml-auto">
                  <div className="font-condensed text-[10px] uppercase tracking-widest text-gray-3 mb-1">Record</div>
                  <div className="font-display text-off-white" style={{ fontSize: 22 }}>{recordStr}</div>
                </div>
              </div>
            </div>

            {/* Socials */}
            {fighter.socials.length > 0 && (
              <div className="bg-charcoal border border-charcoal-3 p-6" style={{ borderLeft: '2px solid #8b0000' }}>
                <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-blood-glow mb-3">Social Media</div>
                <div className="flex flex-wrap gap-3">
                  {fighter.socials.map(s => (
                    <a key={s.platform} href={safeHref(s.profile_url)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 border border-charcoal-3 hover:border-blood no-underline transition-colors">
                      <span className="font-condensed font-bold text-[10px] text-gray-3">{SOCIAL_ICONS[s.platform] ?? s.platform.toUpperCase()}</span>
                      <span className="font-condensed text-[12px] text-off-white">@{s.handle}</span>
                      {s.follower_count && s.follower_count > 0 && (
                        <span className="font-condensed text-[11px] text-gray-3">
                          {s.follower_count >= 1000 ? `${(s.follower_count / 1000).toFixed(1)}k` : s.follower_count}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Highlight videos */}
            {fighter.highlight_video_urls.length > 0 && (
              <div className="bg-charcoal border border-charcoal-3 p-6" style={{ borderLeft: '2px solid #8b0000' }}>
                <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-blood-glow mb-3">Highlight Videos</div>
                <div className="space-y-2">
                  {fighter.highlight_video_urls.map((url, i) => (
                    <a key={i} href={safeHref(url)} target="_blank" rel="noopener noreferrer"
                      className="block font-condensed text-[12px] text-gray-2 hover:text-off-white no-underline truncate transition-colors">
                      ▶ {url}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: meta + CTA */}
          <div className="space-y-4">
            {/* Profile details */}
            <div className="bg-charcoal border border-charcoal-3 p-5" style={{ borderLeft: '2px solid #8b0000' }}>
              <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-blood-glow mb-3">Details</div>
              {[
                ['Status', fighter.pro_status ? fighter.pro_status.charAt(0).toUpperCase() + fighter.pro_status.slice(1) : null],
                ['Division', fighter.division],
                ['Nationality', fighter.nationality],
                ['Base', fighter.base_city],
                ['Gym', fighter.gym_name],
                ['Coach', fighter.coach_name],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k as string} className="flex justify-between py-2 border-b border-charcoal-3 last:border-0">
                  <span className="font-condensed text-[11px] text-gray-3">{k}</span>
                  <span className="font-condensed text-[12px] font-bold text-off-white">{v}</span>
                </div>
              ))}
            </div>

            {/* Sponsorship interests */}
            {fighter.sponsorship_interests.length > 0 && (
              <div className="bg-charcoal border border-charcoal-3 p-5" style={{ borderLeft: '2px solid #8b0000' }}>
                <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-blood-glow mb-3">Interests</div>
                <div className="flex flex-wrap gap-1.5">
                  {fighter.sponsorship_interests.map(i => (
                    <span key={i} className="font-condensed text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-1 border border-charcoal-3 text-gray-2">
                      {i}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Media kit */}
            {fighter.media_kit_url && safeHref(fighter.media_kit_url) && (
              <a href={safeHref(fighter.media_kit_url)} target="_blank" rel="noopener noreferrer"
                className="block bg-charcoal border border-charcoal-3 p-4 hover:border-blood no-underline transition-colors"
                style={{ borderLeft: '2px solid #8b0000' }}>
                <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-blood-glow mb-1">Media Kit</div>
                <div className="font-condensed text-[12px] text-gray-2">Download PDF →</div>
              </a>
            )}

            {/* Sponsor CTA */}
            {fighter.is_open_to_sponsorship && (
              <div className="bg-charcoal border border-charcoal-3 p-5 text-center" style={{ borderLeft: '2px solid #8b0000' }}>
                <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-blood-glow mb-2">Work Together</div>
                <p className="font-body text-gray-2 text-[13px] mb-4 leading-relaxed">
                  Interested in sponsoring {fighter.name?.split(' ')[0] ?? 'this fighter'}? Connect through the platform.
                </p>
                <Link to="/register" className="btn-primary block no-underline text-center text-[11px]">
                  Join as a Sponsor
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
