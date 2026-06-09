import React, { useState, useEffect, useMemo } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { apiGet } from '../lib/api/client'

type Episode = {
  id: string
  title: string
  slug: string | null
  description: string | null
  short_description: string | null
  episode_number: number | null
  season: number | null
  guest_name: string | null
  guest_title: string | null
  spotify_url: string | null
  apple_url: string | null
  youtube_url: string | null
  embed_url: string | null
  thumbnail_path: string | null
  duration: string | null
  tags: string[] | null
  is_featured: boolean
  published_at: string | null
  sort_order: number
}

export default function PodcastPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading,  setLoading]  = useState(true)
  const [tagFilter, setTagFilter] = useState('all')

  useEffect(() => {
    apiGet<{ ok: boolean; episodes: Episode[] }>('/api/public/podcast')
      .then(d => setEpisodes(d.episodes ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const featured = episodes.find(ep => ep.is_featured)

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const ep of episodes) for (const t of ep.tags ?? []) set.add(t)
    return [...set]
  }, [episodes])

  const filtered = useMemo(() => {
    if (tagFilter === 'all') return episodes
    return episodes.filter(ep => (ep.tags ?? []).includes(tagFilter))
  }, [episodes, tagFilter])

  const epLabel = (ep: Episode) =>
    ep.season && ep.episode_number
      ? `S${ep.season}E${ep.episode_number}`
      : ep.episode_number ? `E${ep.episode_number}` : null

  const primaryLink = (ep: Episode) =>
    ep.embed_url || ep.spotify_url || ep.youtube_url || ep.apple_url || null

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

      {/* Featured episode */}
      {!loading && featured && (
        <section className="py-10 px-10">
          <div className="max-w-[1200px] mx-auto">
            <div className="font-condensed text-[9px] font-bold tracking-[0.4em] uppercase text-yellow-400 mb-4">★ Featured Episode</div>
            <div className="border border-charcoal-3 overflow-hidden"
              style={{ borderLeft: '3px solid #c9a82c', background: '#0d0d10' }}>
              {/* Embed player */}
              {featured.embed_url && (
                <div className="w-full" style={{ height: 152 }}>
                  <iframe
                    src={featured.embed_url}
                    width="100%" height="152"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    style={{ border: 0 }}
                  />
                </div>
              )}
              <div className="px-7 py-5 flex items-start gap-6">
                <div className="flex-1 min-w-0">
                  {epLabel(featured) && (
                    <div className="font-condensed text-[10px] font-bold tracking-[0.3em] text-blood-glow mb-1">{epLabel(featured)}</div>
                  )}
                  <div className="font-condensed text-[18px] font-bold text-off-white mb-1">{featured.title}</div>
                  {featured.guest_name && (
                    <div className="font-condensed text-[13px] text-gray-3 mb-2">
                      {featured.guest_name}{featured.guest_title ? ` · ${featured.guest_title}` : ''}
                    </div>
                  )}
                  {(featured.short_description || featured.description) && (
                    <p className="font-condensed text-[12px] text-gray-2 leading-relaxed max-w-2xl">
                      {featured.short_description ?? featured.description}
                    </p>
                  )}
                  {(featured.tags ?? []).length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-3">
                      {(featured.tags ?? []).map(t => (
                        <span key={t} className="font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border border-charcoal-3 text-gray-3">
                          {t.replace(/-/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {featured.spotify_url && (
                    <a href={featured.spotify_url} target="_blank" rel="noopener noreferrer"
                      className="font-condensed text-[10px] font-bold uppercase tracking-wide px-4 py-2 border border-green-900 text-green-500 hover:border-green-700 transition-colors whitespace-nowrap">
                      ▶ Spotify
                    </a>
                  )}
                  {featured.apple_url && (
                    <a href={featured.apple_url} target="_blank" rel="noopener noreferrer"
                      className="font-condensed text-[10px] font-bold uppercase tracking-wide px-4 py-2 border border-charcoal-3 text-gray-3 hover:text-off-white transition-colors whitespace-nowrap">
                      Apple
                    </a>
                  )}
                  {featured.duration && (
                    <span className="font-condensed text-[10px] text-gray-3 text-center">{featured.duration}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Episode list */}
      <section id="episodes" className="py-16 px-10">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <h2 className="font-display text-off-white uppercase" style={{ fontSize: 'clamp(32px,4vw,56px)', lineHeight: 0.9 }}>
              Episodes
            </h2>
            {/* Tag filter — only shown when tags exist */}
            {allTags.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {['all', ...allTags].map(t => (
                  <button
                    key={t}
                    onClick={() => setTagFilter(t)}
                    className="font-condensed text-[10px] font-bold tracking-[0.2em] uppercase px-4 py-2 border transition-all"
                    style={{
                      background:  tagFilter === t ? '#8b0000' : 'transparent',
                      borderColor: tagFilter === t ? '#8b0000' : '#222226',
                      color:       tagFilter === t ? '#f0ece4' : '#4a4846',
                    }}
                  >
                    {t === 'all' ? 'All' : t.replace(/-/g, ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-charcoal border border-charcoal-3 h-[70px] animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center border border-charcoal-3">
              <div className="font-condensed text-gray-3 text-[13px] tracking-wide">
                {tagFilter !== 'all'
                  ? <>No episodes with this tag. <button className="text-blood-glow underline ml-1" onClick={() => setTagFilter('all')}>Show all</button></>
                  : 'No episodes published yet.'}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(ep => (
                <div
                  key={ep.id}
                  className="bg-charcoal border border-charcoal-3 px-7 py-5 flex items-center gap-6 hover:border-blood/40 transition-all group"
                  style={{ borderLeft: '2px solid transparent', transition: 'all 0.25s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderLeftColor = '#8b0000')}
                  onMouseLeave={e => (e.currentTarget.style.borderLeftColor = 'transparent')}
                >
                  {epLabel(ep) && (
                    <div className="font-condensed text-[10px] font-bold tracking-[0.3em] text-blood-glow min-w-[52px]">
                      {epLabel(ep)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-condensed text-[15px] font-bold tracking-wide text-off-white mb-0.5 group-hover:text-blood-glow transition-colors truncate">
                      {ep.title}
                    </div>
                    {ep.guest_name ? (
                      <div className="font-condensed text-[12px] text-gray-3">
                        {ep.guest_name}{ep.guest_title ? <span className="opacity-50 mx-1">·</span> : ''}{ep.guest_title}
                      </div>
                    ) : (ep.short_description || ep.description) ? (
                      <div className="font-condensed text-[12px] text-gray-3 truncate">
                        {ep.short_description ?? ep.description}
                      </div>
                    ) : null}
                    {(ep.tags ?? []).length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        {(ep.tags ?? []).map(t => (
                          <span key={t} className="font-condensed text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 border border-charcoal-3 text-gray-3">
                            {t.replace(/-/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {ep.duration && (
                    <div className="font-condensed text-[11px] text-gray-3 min-w-[36px] text-right flex-shrink-0">
                      {ep.duration}
                    </div>
                  )}
                  {/* Platform links */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {ep.spotify_url && (
                      <a href={ep.spotify_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        className="font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border border-charcoal-3 text-gray-3 hover:text-off-white hover:border-green-900 transition-colors">
                        Spotify
                      </a>
                    )}
                    {ep.apple_url && (
                      <a href={ep.apple_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        className="font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border border-charcoal-3 text-gray-3 hover:text-off-white hover:border-purple-900 transition-colors">
                        Apple
                      </a>
                    )}
                    {ep.youtube_url && (
                      <a href={ep.youtube_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        className="font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border border-charcoal-3 text-gray-3 hover:text-off-white hover:border-red-900 transition-colors">
                        YouTube
                      </a>
                    )}
                  </div>
                  {primaryLink(ep) && (
                    <a href={primaryLink(ep)!} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      className="w-8 h-8 rounded-full border border-charcoal-3 flex items-center justify-center hover:border-blood/50 transition-colors flex-shrink-0">
                      <span className="text-gray-3 text-[10px] group-hover:text-off-white transition-colors">▶</span>
                    </a>
                  )}
                </div>
              ))}
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
