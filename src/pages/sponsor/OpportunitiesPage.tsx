import React, { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { getMyOpportunities, changeOpportunityStatus, type Opportunity } from '../../lib/api/opportunities'
import { useAuth } from '../../hooks/useAuth'

const STATUS_COLORS: Record<string, string> = {
  draft:     '#7a7672',
  published: '#00c060',
  closed:    '#4a4846',
  archived:  '#4a4846',
  cancelled: '#4a4846',
}

function OppRow({ opp, onManage, onStatusChange, acting }: {
  opp: Opportunity
  onManage: (id: string) => void
  onStatusChange: (id: string, status: 'closed' | 'draft') => void
  acting: boolean
}) {
  return (
    <div className="bg-charcoal border border-charcoal-3 p-5 flex items-center justify-between gap-4"
      style={{ borderLeft: `2px solid ${STATUS_COLORS[opp.status] ?? '#222226'}` }}>
      <div className="flex-1 min-w-0">
        <div className="font-condensed font-bold text-off-white text-[15px] truncate">{opp.title}</div>
        <div className="flex items-center gap-4 mt-1 font-condensed text-[11px]">
          <span style={{ color: STATUS_COLORS[opp.status] ?? '#7a7672' }}>{opp.status.toUpperCase()}</span>
          <span className="text-gray-3">{opp.application_count ?? 0} applicants</span>
          <span className="text-gray-3">{opp.view_count ?? 0} views</span>
          {opp.application_deadline && (
            <span className="text-gray-3">
              Deadline {new Date(opp.application_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {(opp.status === 'draft' || opp.status === 'closed') && (
          <Link to={`/sponsor/opportunities/${opp.id}/edit`}
            className="font-condensed font-bold uppercase text-[10px] tracking-[0.2em] text-gray-3 hover:text-off-white no-underline border border-charcoal-3 px-3 py-1.5">
            Edit
          </Link>
        )}
        {opp.status === 'published' && (
          <>
            <button onClick={() => onManage(opp.id)}
              className="font-condensed font-bold uppercase text-[10px] tracking-[0.2em] text-off-white bg-transparent border border-charcoal-3 px-3 py-1.5 cursor-pointer hover:border-blood">
              Applicants
            </button>
            <button onClick={() => onStatusChange(opp.id, 'closed')} disabled={acting}
              className="font-condensed uppercase text-[10px] tracking-[0.15em] text-gray-3 border border-charcoal-3 px-3 py-1.5 bg-transparent cursor-pointer hover:border-blood hover:text-blood-glow disabled:opacity-40">
              {acting ? '…' : 'Close'}
            </button>
          </>
        )}
        {opp.status === 'closed' && (
          <button onClick={() => onStatusChange(opp.id, 'draft')} disabled={acting}
            className="font-condensed uppercase text-[10px] tracking-[0.15em] text-gray-3 border border-charcoal-3 px-3 py-1.5 bg-transparent cursor-pointer hover:border-blood hover:text-off-white disabled:opacity-40">
            {acting ? '…' : 'Reopen'}
          </button>
        )}
        <Link to={`/opportunities/${opp.id}`}
          className="font-condensed font-bold uppercase text-[10px] tracking-[0.2em] text-gray-3 hover:text-off-white no-underline border border-charcoal-3 px-3 py-1.5">
          View
        </Link>
      </div>
    </div>
  )
}

export default function SponsorOpportunitiesPage() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const [opps, setOpps]       = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string|null>(null)
  const [msg, setMsg] = useState('')

  const load = useCallback(() => {
    getMyOpportunities()
      .then(r => { setOpps(r.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return }
    load()
  }, [user, navigate, load])

  const handleStatusChange = async (id: string, status: 'closed' | 'draft') => {
    setActingId(id); setMsg('')
    try {
      await changeOpportunityStatus(id, status)
      setMsg(status === 'closed' ? 'Opportunity closed.' : 'Reopened as draft.')
      load()
    } catch (e: any) { setMsg(e.message ?? 'Failed.') }
    finally { setActingId(null) }
  }

  const stats = {
    total:     opps.length,
    published: opps.filter(o => o.status === 'published').length,
    applicants: opps.reduce((s, o) => s + (o.application_count ?? 0), 0),
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />
      <div className="flex-1 px-6 py-20 max-w-4xl mx-auto w-full">

        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="sec-label mb-1">Sponsor</div>
            <h1 className="font-display text-off-white uppercase" style={{ fontSize: 'clamp(28px,4vw,44px)', lineHeight: 0.92 }}>
              My Opportunities
            </h1>
          </div>
          <Link to="/sponsor/opportunities/new" className="btn-primary no-underline">+ Post New</Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total', value: stats.total },
            { label: 'Live', value: stats.published },
            { label: 'Applicants', value: stats.applicants },
          ].map(s => (
            <div key={s.label} className="bg-charcoal border border-charcoal-3 p-5 text-center">
              <div className="font-display text-off-white text-[32px] leading-none">{s.value}</div>
              <div className="font-condensed text-gray-3 text-[10px] tracking-[0.3em] uppercase mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-charcoal-3 border-t-blood-glow rounded-full animate-spin" />
          </div>
        ) : opps.length === 0 ? (
          <div className="text-center py-20 bg-charcoal border border-charcoal-3" style={{ borderLeft: '2px solid #8b0000' }}>
            <p className="font-condensed font-bold uppercase text-[10px] tracking-[0.35em] text-gray-3 mb-3">No Opportunities Yet</p>
            <p className="font-narrow text-gray-2 text-[14px] mb-6">Post your first sponsorship to start connecting with fighters.</p>
            <Link to="/sponsor/opportunities/new" className="btn-primary no-underline">Post an Opportunity</Link>
          </div>
        ) : (
          <>
            {msg && <p className="font-condensed text-[12px] mb-2" style={{ color: msg.includes('ailed') ? '#C41E3A' : '#7a7672' }}>{msg}</p>}
            <div className="space-y-2">
              {opps.map(o => (
                <OppRow key={o.id} opp={o}
                  onManage={id => navigate(`/sponsor/opportunities/${id}/applicants`)}
                  onStatusChange={handleStatusChange}
                  acting={actingId === o.id} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
