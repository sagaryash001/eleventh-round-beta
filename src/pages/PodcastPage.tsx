import React, { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { apiGet } from '../lib/api/client'

type Episode = {
  id: string
  title: string
  description: string | null
  episode_number: number | null
  season: number | null
  spotify_url: string | null
  apple_url: string | null
  youtube_url: string | null
  embed_url: string | null
  thumbnail_path: string | null
  duration: string | null
  published_at: string | null
  sort_order: number
}

export default function PodcastPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    apiGet<{ ok: boolean; episodes: Episode[] }>('/api/public/podcast')
      .then(d => setEpisodes(d.episodes ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-36 pb-20 px-10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse at 60% 20%, rgba(139,0,0,0.12) 0%, transparent 60%)' }} />
        <div className="max-w-[1200px] mx-auto relative z-10">
          <div className="sec-label mb-4">Ecosystem · Audio</div>
          <h1
            className="font-display text-off-white uppercase mb-6"
            style={{ fontSize: 'clamp(64px,9vw,148px)', lineHeight: 0.88 }}
          >
            The<br />
            <span className="text-blood-glow">Eleventh</span><br />
            Round Pod
          </h1>
          <p className="font-condensed font-light text-gray-1 max-w-[520px] text-[16px] leading-relaxed tracking-wide">
            Fighter stories. Career lessons. Professionalism, discipline, and business
            — through conversations with people who move with substance.
          </p>

          <div className="flex gap-4 mt-10 flex-wrap">
            <a href="#episodes" className="btn-primary">Browse Episodes</a>
          </div>
        </div>
      </section>

      <div className="red-rule" />

      {/* Platform badges */}
      <section className="py-10 px-10">
        <div className="max-w-[1200px] mx-auto">
          <div className="font-condensed text-[10px] font-bold tracking-[0.4em] uppercase text-gray-3 mb-5">Available on</div>
          <div className="flex gap-4 flex-wrap">
            {['Spotify', 'Apple Podcasts', 'YouTube', 'Amazon Music'].map(p => (
              <div key={p} className="bg-charcoal border border-charcoal-3 px-5 py-2.5 font-condensed text-[12px] font-semibold tracking-[0.08em] text-gray-2 hover:text-off-white hover:border-blood/40 transition-colors cursor-pointer">
                {p}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Episodes */}
      <section id="episodes" className="py-16 px-10">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="font-display text-off-white uppercase mb-8" style={{ fontSize: 'clamp(32px,4vw,56px)', lineHeight: 0.9 }}>
            Episodes
          </h2>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-charcoal border border-charcoal-3 px-7 py-5 animate-pulse h-[70px]" />
              ))}
            </div>
          ) : episodes.length === 0 ? (
            <div className="py-16 text-center border border-charcoal-3">
              <div className="font-condensed text-gray-3 text-[13px] tracking-wide">No episodes published yet.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {episodes.map(ep => {
                const epLabel = ep.season && ep.episode_number
                  ? `S${ep.season}E${ep.episode_number}`
                  : ep.episode_number ? `E${ep.episode_number}` : null
                const primaryLink = ep.embed_url || ep.spotify_url || ep.youtube_url || ep.apple_url || null

                return (
                  <div
                    key={ep.id}
                    className="bg-charcoal border border-charcoal-3 px-7 py-5 flex items-center gap-6 hover:border-blood/40 transition-all group"
                    style={{ borderLeft: '2px solid transparent', transition: 'all 0.25s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderLeftColor = '#8b0000')}
                    onMouseLeave={e => (e.currentTarget.style.borderLeftColor = 'transparent')}
                  >
                    {epLabel && (
                      <div className="font-condensed text-[10px] font-bold tracking-[0.3em] text-blood-glow min-w-[52px]">{epLabel}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-condensed text-[15px] font-bold tracking-wide text-off-white mb-1 group-hover:text-blood-glow transition-colors truncate">
                        {ep.title}
                      </div>
                      {ep.description && (
                        <div className="font-condensed text-[12px] text-gray-3 truncate">{ep.description}</div>
                      )}
                    </div>
                    {ep.duration && (
                      <div className="font-condensed text-[11px] text-gray-3 min-w-[36px] text-right">{ep.duration}</div>
                    )}
                    {/* Platform links */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {ep.spotify_url && (
                        <a href={ep.spotify_url} target="_blank" rel="noopener noreferrer"
                          className="font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border border-charcoal-3 text-gray-3 hover:text-off-white hover:border-green-900 transition-colors">
                          Spotify
                        </a>
                      )}
                      {ep.apple_url && (
                        <a href={ep.apple_url} target="_blank" rel="noopener noreferrer"
                          className="font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border border-charcoal-3 text-gray-3 hover:text-off-white hover:border-purple-900 transition-colors">
                          Apple
                        </a>
                      )}
                      {ep.youtube_url && (
                        <a href={ep.youtube_url} target="_blank" rel="noopener noreferrer"
                          className="font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border border-charcoal-3 text-gray-3 hover:text-off-white hover:border-red-900 transition-colors">
                          YouTube
                        </a>
                      )}
                    </div>
                    {primaryLink && (
                      <a href={primaryLink} target="_blank" rel="noopener noreferrer"
                        className="w-8 h-8 rounded-full border border-charcoal-3 flex items-center justify-center hover:border-blood/50 transition-colors flex-shrink-0"
                        onClick={e => e.stopPropagation()}>
                        <span className="text-gray-3 text-[10px] group-hover:text-off-white transition-colors">▶</span>
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* About */}
      <section className="py-16 px-10 bg-near-black">
        <div className="red-rule mb-16" />
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
          <div>
            <div className="sec-label mb-4">About the Show</div>
            <h2 className="font-display text-off-white uppercase mb-6"
                style={{ fontSize: 'clamp(36px,4.5vw,68px)', lineHeight: 0.9 }}>
              Not Hype.<br /><span className="text-blood-glow">Substance.</span>
            </h2>
            <p className="font-body font-light text-gray-1 text-[14px] leading-relaxed mb-4">
              Every episode is a real conversation with fighters, managers, coaches, attorneys,
              and business minds who understand combat sports from the inside.
            </p>
            <p className="font-body font-light text-gray-1 text-[14px] leading-relaxed">
              No highlight reels. No empty motivation. Just the information and perspective
              that helps fighters and managers operate at a higher level.
            </p>
          </div>
          <div className="space-y-3">
            {['Fighter career stories and lessons', 'Professionalism and conduct', 'Sponsorship and branding', 'Contract and legal literacy', 'Financial stability', 'Life and transition beyond fighting'].map(t => (
              <div key={t} className="flex items-center gap-3 font-condensed text-[13px] font-medium tracking-wide text-gray-1">
                <div className="w-1.5 h-1.5 rounded-full bg-blood-glow flex-shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
