import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getContracts, type Contract } from '../../../lib/api/contracts'
import { DashSkeleton, ApiError, EmptyState } from '../DashWidgets'
import { StatusPie } from '../admin/AdminCharts'

const STATUS_COLOR: Record<string, string> = {
  draft: '#4a4846', pending_fighter: '#b45309', active: '#166534',
  in_dispute: '#7f1d1d', completed: '#1e3a5f', terminated: '#374151',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Awaiting Your Signature', pending_fighter: 'Awaiting Fighter',
  active: 'Active', in_dispute: 'In Dispute',
  completed: 'Completed', terminated: 'Terminated',
}
const STATUS_BADGE_COLOR: Record<string, string> = {
  draft: '#c9a82c', pending_fighter: '#b45309', active: '#00c060',
  in_dispute: '#c00000', completed: '#4a4846', terminated: '#374151',
}

export default function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [filter, setFilter]       = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    getContracts()
      .then(r => { setContracts(r.contracts ?? []); setLoading(false) })
      .catch(e => { setError(e.message ?? 'Failed.'); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} retry={load} />

  if (!contracts.length) return (
    <EmptyState icon="○" title="No Contracts Yet"
      body="Accept a fighter application to create your first contract. Contracts track deliverables, obligations, and payments."
      action={<Link to="/sponsor/opportunities" className="btn-ghost text-[11px] py-2 px-4 no-underline">My Campaigns →</Link>} />
  )

  const active    = contracts.filter(c => c.status === 'active').length
  const awaiting  = contracts.filter(c => c.status === 'draft').length
  const pending   = contracts.filter(c => c.status === 'pending_fighter').length
  const completed = contracts.filter(c => c.status === 'completed').length
  const disputed  = contracts.filter(c => c.status === 'in_dispute').length

  const pieData = [
    { name: 'Active',     value: active,    color: '#00c060' },
    { name: 'Awaiting',   value: awaiting,  color: '#c9a82c' },
    { name: 'Pend. Fighter', value: pending, color: '#b45309' },
    { name: 'Completed',  value: completed, color: '#4a4846' },
    { name: 'Disputed',   value: disputed,  color: '#c00000' },
  ]

  const filtered = filter ? contracts.filter(c => c.status === filter) : contracts

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1.5fr' }}>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {[
            { label: 'Active',         value: active,    color: '#00c060' },
            { label: 'Your Signature', value: awaiting,  color: awaiting > 0 ? '#c9a82c' : '#4a4846' },
            { label: 'Pend. Fighter',  value: pending,   color: '#b45309' },
            { label: 'Completed',      value: completed, color: '#4a4846' },
          ].map(({ label, value, color }) => (
            <div key={label} className="dash-card text-center" style={{ borderTop: `2px solid ${color}` }}>
              <div className="dash-label">{label}</div>
              <div className="font-display mt-0.5" style={{ fontSize: 26, color }}>{value}</div>
            </div>
          ))}
        </div>
        <div className="dash-card">
          <div className="dash-label mb-3">Contract Distribution</div>
          <StatusPie data={pieData} />
        </div>
      </div>

      {/* Action alert for awaiting signature */}
      {awaiting > 0 && (
        <div className="dash-card" style={{ borderLeft: '3px solid #c9a82c' }}>
          <div className="font-condensed font-bold text-[11px] tracking-[0.2em] uppercase mb-1" style={{ color: '#c9a82c' }}>
            Signature Required
          </div>
          <p className="font-condensed text-[12px] text-gray-2" style={{ lineHeight: 1.6 }}>
            {awaiting} contract{awaiting > 1 ? 's' : ''} {awaiting > 1 ? 'are' : 'is'} in draft status and waiting for your signature. Review and sign below.
          </p>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'draft', 'pending_fighter', 'active', 'in_dispute', 'completed', 'terminated'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className="font-condensed font-bold uppercase text-[10px] tracking-[0.15em] px-3 py-1.5 border cursor-pointer transition-all"
            style={{
              borderColor: filter === s ? '#8b0000' : '#222226',
              color:       filter === s ? '#f0ece4' : '#7a7672',
              background:  filter === s ? 'rgba(139,0,0,0.1)' : 'transparent',
            }}>
            {s ? STATUS_LABEL[s] ?? s : 'All'}
          </button>
        ))}
      </div>

      {/* Contract list */}
      {!filtered.length ? (
        <EmptyState icon="○" title="No Contracts" body="No contracts match the selected filter." />
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const oblPct = (c as any).obligations_total > 0
              ? Math.round((c as any).obligations_completed / (c as any).obligations_total * 100) : 0
            return (
              <Link key={c.id} to={`/contracts/${c.id}`}
                className="dash-card flex items-center gap-4 no-underline block transition-colors"
                style={{ borderLeft: `3px solid ${STATUS_BADGE_COLOR[c.status] ?? '#222226'}` }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className="font-condensed text-[9px] font-bold uppercase tracking-widest px-2 py-0.5"
                      style={{ background: STATUS_COLOR[c.status] ?? '#374151', color: '#f0ece4' }}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                    {c.status === 'draft' && (
                      <span className="font-condensed text-[10px] font-bold" style={{ color: '#c9a82c' }}>
                        → Sign Now
                      </span>
                    )}
                    <span className="font-condensed text-[10px] text-gray-3">
                      {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="font-condensed font-bold text-off-white text-[14px]">
                    ${c.value_usd.toLocaleString()} · {c.payment_schedule}
                  </div>
                  {c.start_date && c.end_date && (
                    <div className="font-condensed text-[11px] text-gray-3 mt-0.5">
                      {new Date(c.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
                      {new Date(c.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                  {(c as any).obligations_total > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <div style={{ width: 60, height: 3, background: '#222226', borderRadius: 2 }}>
                        <div style={{ width: `${oblPct}%`, height: '100%', borderRadius: 2,
                          background: oblPct === 100 ? '#00c060' : '#8b0000' }} />
                      </div>
                      <span className="font-condensed text-[10px] text-gray-3">
                        {(c as any).obligations_completed}/{(c as any).obligations_total} obligations
                      </span>
                    </div>
                  )}
                </div>
                <span className="font-condensed text-[10px] text-gray-3 flex-shrink-0">View →</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
