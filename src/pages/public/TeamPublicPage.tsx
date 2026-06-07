import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { getPublicTeam, storageUrl, type PublicTeam } from '../../lib/api/public'

function FighterCard({ fighter }: { fighter: PublicTeam['fighters'][0] }) {
  const headshotUrl = storageUrl(fighter.headshot_path)
  const recordStr   = `${fighter.record.wins}-${fighter.record.losses}${fighter.record.draws > 0 ? `-${fighter.record.draws}` : ''}`

  const card = (
    <div className="bg-charcoal border border-charcoal-3 p-4 flex items-center gap-4 transition-colors"
      style={{ borderLeft: '2px solid #8b0000' }}>
      <div className="flex-shrink-0 w-14 h-14 border border-charcoal-3 overflow-hidden"
        style={{ background: '#141416' }}>
        {headshotUrl ? (
          <img src={headshotUrl} alt={fighter.name ?? 'Fighter'} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="font-display text-gray-3 uppercase" style={{ fontSize: 20 }}>
              {(fighter.name ?? '?')[0]}
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-condensed font-bold text-off-white text-[15px] truncate">{fighter.name ?? 'Fighter'}</div>
        <div className="font-condensed text-gray-3 text-[11px] flex gap-3 mt-0.5">
          {fighter.weight_class && <span>{fighter.weight_class}</span>}
          {fighter.pro_status && <span className="capitalize">{fighter.pro_status}</span>}
        </div>
        <div className="font-condensed text-[11px] text-gray-2 mt-0.5">{recordStr}</div>
      </div>
      {fighter.public_slug && (
        <span className="font-condensed text-[10px] text-gray-3 flex-shrink-0">View →</span>
      )}
    </div>
  )

  if (fighter.public_slug) {
    return (
      <Link to={`/fighters/${fighter.public_slug}`} className="block no-underline hover:opacity-80 transition-opacity">
        {card}
      </Link>
    )
  }
  return card
}

export default function TeamPublicPage() {
  const { slug } = useParams<{ slug: string }>()
  const [team, setTeam]       = useState<PublicTeam | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    getPublicTeam(slug)
      .then(r => { setTeam(r.team); setLoading(false) })
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

  if (notFound || !team) return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="font-condensed text-gray-3 uppercase tracking-widest text-[11px] mb-4">Team Not Found</p>
          <Link to="/" className="btn-ghost no-underline">Go Home</Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />
      <div className="flex-1 px-6 py-24 max-w-3xl mx-auto w-full">

        <div className="mb-8">
          <div className="sec-label mb-2">Team</div>
          <h1 className="font-display text-off-white uppercase" style={{ fontSize: 'clamp(32px,5vw,56px)', lineHeight: 0.9 }}>
            {team.name}
          </h1>
        </div>

        {team.fighters.length === 0 ? (
          <div className="text-center py-16 bg-charcoal border border-charcoal-3" style={{ borderLeft: '2px solid #8b0000' }}>
            <p className="font-condensed text-gray-3 uppercase tracking-widest text-[10px]">No Public Fighters</p>
            <p className="font-narrow text-gray-2 text-[13px] mt-2">
              Fighters on this roster have not made their profiles public yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-blood-glow mb-4">
              Active Roster ({team.fighters.length})
            </div>
            <div className="space-y-2">
              {team.fighters.map((f, i) => (
                <FighterCard key={f.public_slug ?? i} fighter={f} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 text-center">
          <p className="font-condensed text-gray-3 text-[12px] mb-4">
            Interested in working with {team.name}?
          </p>
          <Link to="/register" className="btn-primary no-underline inline-block">Join The Eleventh Round</Link>
        </div>
      </div>
    </div>
  )
}
