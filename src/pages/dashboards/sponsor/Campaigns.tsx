import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getMyOpportunities, changeOpportunityStatus, type Opportunity } from '../../../lib/api/opportunities'
import { DashSkeleton, ApiError, EmptyState } from '../DashWidgets'
import { DistBar } from '../admin/AdminCharts'
import type { SponsorProfile } from '../../../lib/api/sponsors'

const STATUS_COLOR: Record<string, string> = {
  draft: '#7a7672', published: '#00c060', closed: '#4a4846', archived: '#4a4846',
}
const STATUS_ACCENT: Record<string, string> = {
  draft: '#c9a82c', published: '#00c060', closed: '#4a4846',
}

function Spinner() {
  return <span className="inline-block w-3 h-3 border border-off-white/40 border-t-off-white rounded-full animate-spin" />
}

export default function Campaigns({ sp }: { sp: SponsorProfile }) {
  const [opps,    setOpps]    = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [acting,  setActing]  = useState<string | null>(null)
  const [msg,     setMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    getMyOpportunities()
      .then(d => { setOpps(d.data ?? []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const handleStatus = async (id: string, status: 'closed' | 'draft') => {
    setActing(id); setMsg(null)
    try {
      await changeOpportunityStatus(id, status)
      setMsg({ type: 'ok', text: status === 'closed' ? 'Campaign closed.' : 'Reopened as draft.' })
      load()
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message ?? 'Failed.' })
    } finally { setActing(null) }
  }

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} retry={load} />

  const published = opps.filter(o => o.status === 'published').length
  const draft     = opps.filter(o => o.status === 'draft').length
  const closed    = opps.filter(o => o.status === 'closed' || o.status === 'archived').length

  const chartData = [
    { label: 'Published', value: published, color: '#00c060' },
    { label: 'Draft',     value: draft,     color: '#c9a82c' },
    { label: 'Closed',    value: closed,    color: '#4a4846' },
  ]

  return (
    <div className="space-y-5">

      {/* Header + CTA */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {[
            { label: 'Published', v: published, c: '#00c060' },
            { label: 'Draft',     v: draft,     c: '#c9a82c' },
            { label: 'Closed',    v: closed,    c: '#4a4846' },
          ].map(({ label, v, c }) => (
            <div key={label} className="text-center">
              <div className="font-display" style={{ fontSize: 22, color: c }}>{v}</div>
              <div className="font-condensed text-[9px] uppercase tracking-[0.25em] text-gray-3">{label}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {!sp.is_verified && (
            <span className="font-condensed text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 border"
              style={{ borderColor: '#c9a82c', color: '#c9a82c' }}>
              Pending Vetting
            </span>
          )}
          <Link to="/sponsor/opportunities/new"
            className="btn-primary text-[11px] py-2 px-4 no-underline">
            + New Campaign
          </Link>
        </div>
      </div>

      {msg && (
        <p className={`font-condensed text-[11px] ${msg.type === 'ok' ? 'text-green-400' : 'text-blood-glow'}`}>{msg.text}</p>
      )}

      {/* Chart */}
      {opps.length > 0 && (
        <div className="dash-card">
          <div className="dash-label mb-3">Campaigns by Status</div>
          <DistBar data={chartData} />
        </div>
      )}

      {/* Campaign list */}
      {!opps.length ? (
        <EmptyState icon="○" title="No Campaigns Yet"
          body="Create your first campaign to start connecting with fighters."
          action={<Link to="/sponsor/opportunities/new" className="btn-primary text-[11px] py-2 px-5 no-underline">Create Campaign</Link>} />
      ) : (
        <div className="space-y-2">
          {opps.map(o => (
            <div key={o.id} className="dash-card"
              style={{ borderLeft: `3px solid ${STATUS_ACCENT[o.status] ?? '#222226'}` }}>
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                    <span className="font-condensed font-bold text-off-white text-[14px] truncate">{o.title}</span>
                    <span className="font-condensed text-[9px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 border"
                      style={{ borderColor: STATUS_COLOR[o.status], color: STATUS_COLOR[o.status] }}>
                      {o.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 font-condensed text-[11px] text-gray-3 flex-wrap">
                    <span>{o.application_count ?? 0} applicants</span>
                    <span>{o.view_count ?? 0} views</span>
                    {o.budget_min_usd || o.budget_max_usd ? (
                      <span>${o.budget_min_usd ?? 0}–${o.budget_max_usd ?? '∞'}/yr</span>
                    ) : null}
                    {o.application_deadline && (
                      <span>Deadline: {new Date(o.application_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  {o.status === 'published' && (
                    <Link to={`/sponsor/opportunities/${o.id}/applicants`}
                      className="font-condensed font-bold uppercase text-[9px] tracking-[0.15em] px-3 py-1.5 border border-charcoal-3 text-gray-2 no-underline hover:border-blood hover:text-off-white transition-all">
                      Applicants ({o.application_count ?? 0})
                    </Link>
                  )}
                  {(o.status === 'draft' || o.status === 'closed') && (
                    <Link to={`/sponsor/opportunities/${o.id}/edit`}
                      className="font-condensed font-bold uppercase text-[9px] tracking-[0.15em] px-3 py-1.5 border border-charcoal-3 text-gray-2 no-underline hover:border-blood hover:text-off-white transition-all">
                      Edit
                    </Link>
                  )}
                  {o.status === 'published' && (
                    <button onClick={() => handleStatus(o.id, 'closed')} disabled={acting === o.id}
                      className="font-condensed uppercase text-[9px] tracking-[0.1em] px-3 py-1.5 border border-charcoal-3 text-gray-3 cursor-pointer hover:border-blood hover:text-blood-glow transition-all disabled:opacity-40">
                      {acting === o.id ? <Spinner /> : 'Close'}
                    </button>
                  )}
                  {o.status === 'closed' && (
                    <button onClick={() => handleStatus(o.id, 'draft')} disabled={acting === o.id}
                      className="font-condensed uppercase text-[9px] tracking-[0.1em] px-3 py-1.5 border border-charcoal-3 text-gray-3 cursor-pointer hover:border-blood hover:text-off-white transition-all disabled:opacity-40">
                      {acting === o.id ? <Spinner /> : 'Reopen'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
