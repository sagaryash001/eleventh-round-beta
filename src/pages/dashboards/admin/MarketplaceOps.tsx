import React, { useState, useEffect, useCallback } from 'react'
import { useApi } from '../../../hooks/useApi'
import {
  getAdminContracts, getAdminConversationList, adminLockConversation,
  getSponsorForgeReviews, decideSponsorForgeReview, type SFReview,
} from '../../../lib/api/admin'
import { adminRecompute } from '../../../lib/api/opportunities'
import { getAdminDashboard } from '../../../lib/api/admin'
import { DashSkeleton, ApiError, EmptyState, StatCard } from '../DashWidgets'
import { FunnelBar, StatusPie, DistBar } from './AdminCharts'
import { SubNav, ActionMsg, Spinner } from './AdminUtils'

const TABS = [
  { id: 'mkt-overview',  label: 'Overview'     },
  { id: 'applications',  label: 'Applications' },
  { id: 'contracts',     label: 'Contracts'    },
  { id: 'obligations',   label: 'Obligations'  },
  { id: 'sponsorforge',  label: 'SponsorForge' },
  { id: 'messaging',     label: 'Messaging'    },
]

// ── Marketplace Overview ──────────────────────────────────────────────────────
function MktOverview() {
  const { data, loading, error } = useApi<any>('/api/admin/marketplace')
  const { data: analytics }      = useApi<any>('/api/admin/analytics')
  const { data: sfData }         = useApi<any>('/api/admin/sponsorforge')

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const gmv           = data?.gmv_usd             ?? 0
  const activeContracts= data?.active_contracts   ?? 0
  const totalContracts= data?.total_contracts     ?? 0
  const sponsorCount  = data?.sponsor_count       ?? 0
  const verifiedSpons = data?.verified_sponsors   ?? 0
  const totalApps     = data?.total_applications  ?? 0
  const funnel        = data?.applications_funnel ?? {}
  const monthlyGmv    = analytics?.monthly_gmv   ?? []

  const funnelData = Object.entries(funnel).map(([s, c]) => ({
    label: s.replace(/_/g, ' '), value: c as number,
  }))

  const contractStatuses = [
    { name: 'Active',     value: activeContracts,                       color: '#00c060' },
    { name: 'Total',      value: totalContracts - activeContracts,      color: '#4a4846' },
  ]

  return (
    <div className="space-y-5">
      {/* Metric strip */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="dash-card text-center" style={{ borderTop: '2px solid #c00000' }}>
          <div className="dash-label">GMV</div>
          <div className="font-display text-off-white mt-1" style={{ fontSize: 28 }}>
            {gmv > 0 ? `$${(gmv >= 1000 ? (gmv / 1000).toFixed(1) + 'K' : gmv)}` : '$—'}
          </div>
          <div className="dash-sub">Payments succeeded</div>
        </div>
        <StatCard label="Active Contracts" value={String(activeContracts)}
          sub={`${totalContracts} total`} barPct={totalContracts > 0 ? Math.round(activeContracts / totalContracts * 100) : 0} barColor="#00c060" />
        <StatCard label="Sponsors" value={String(sponsorCount)}
          sub={`${verifiedSpons} verified`} barPct={sponsorCount > 0 ? Math.round(verifiedSpons / sponsorCount * 100) : 0} />
        <StatCard label="Applications" value={String(totalApps)} sub="All time" barPct={50} />
      </div>

      {/* Charts */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1.5fr 1fr 1fr' }}>
        <div className="dash-card">
          <div className="dash-label mb-3">Applications Funnel</div>
          <FunnelBar data={funnelData} />
        </div>
        <div className="dash-card">
          <div className="dash-label mb-3">Contract Status</div>
          <StatusPie data={contractStatuses} />
        </div>
        <div className="dash-card">
          <div className="dash-label mb-2">SponsorForge</div>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {[
              { l: 'Sponsors',  v: sfData?.sponsors            ?? 0, c: '#00c060' },
              { l: 'Matches',   v: sfData?.active_matches       ?? 0, c: '#C41E3A' },
              { l: 'Eligible',  v: sfData?.eligible_fighters    ?? 0, c: '#c9a82c' },
              { l: 'Live Opps', v: sfData?.active_opportunities ?? 0, c: '#00c060' },
            ].map(({ l, v, c }) => (
              <div key={l} className="text-center bg-charcoal-2 border border-charcoal-3 px-2 py-2">
                <div className="font-display" style={{ fontSize: 20, color: c }}>{v}</div>
                <div className="font-condensed text-[9px] text-gray-3 uppercase tracking-wide">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Applications ──────────────────────────────────────────────────────────────
function ApplicationsTab() {
  const { data, loading, error } = useApi<any>('/api/admin/marketplace')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const funnel    = data?.applications_funnel ?? {}
  const totalApps = data?.total_applications  ?? 0
  const funnelData= Object.entries(funnel).map(([s, c]) => ({
    label: s.replace(/_/g, ' '), value: c as number,
  }))

  if (totalApps === 0) return (
    <EmptyState icon="○" title="No Applications Yet"
      body="Application data appears once fighters apply to sponsor opportunities." />
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="dash-card text-center" style={{ borderTop: '2px solid #C41E3A' }}>
          <div className="dash-label">Total Applications</div>
          <div className="font-display text-off-white mt-1" style={{ fontSize: 34 }}>{totalApps}</div>
        </div>
        {Object.entries(funnel).slice(0, 2).map(([status, count]) => (
          <div key={status} className="dash-card text-center">
            <div className="dash-label capitalize">{status.replace(/_/g, ' ')}</div>
            <div className="font-display text-off-white mt-1" style={{ fontSize: 34 }}>{count as number}</div>
          </div>
        ))}
      </div>
      <div className="dash-card">
        <div className="dash-label mb-3">Application Pipeline</div>
        <FunnelBar data={funnelData} height={Math.max(funnelData.length * 34 + 24, 120)} />
      </div>
    </div>
  )
}

// ── Contracts ─────────────────────────────────────────────────────────────────
const AC_COLOR: Record<string, string> = {
  draft: '#4a4846', pending_fighter: '#b45309', active: '#166534',
  in_dispute: '#7f1d1d', completed: '#1e3a5f', terminated: '#374151',
}
const AC_LABEL: Record<string, string> = {
  draft: 'Draft', pending_fighter: 'Awaiting Fighter', active: 'Active',
  in_dispute: 'In Dispute', completed: 'Completed', terminated: 'Terminated',
}

function ContractsTab() {
  const { data: metrics }          = useApi<any>('/api/admin/dashboard')
  const [contracts, setContracts]  = useState<any[]>([])
  const [loading, setLoading]      = useState(true)
  const [error, setError]          = useState('')
  const [statusFilter, setFilter]  = useState('')

  const load = useCallback((status?: string) => {
    setLoading(true); setError('')
    getAdminContracts({ status: status || undefined, limit: 50 })
      .then(r => { setContracts(r.contracts ?? []); setLoading(false) })
      .catch(e => { setError(e.message ?? 'Failed.'); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const m = metrics ?? {}

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} retry={() => load(statusFilter || undefined)} />

  return (
    <div className="space-y-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <StatCard label="Total Contracts"      value={String(m.total_contracts       ?? 0)} sub="All time"          barPct={100} />
        <StatCard label="Active"               value={String(m.active_contracts      ?? 0)} sub="Live"              barPct={50} barColor="#00c060" />
        <StatCard label="Proofs Pending"       value={<span style={{ color: (m.proofs_pending_review ?? 0) > 0 ? '#c00000' : undefined }}>{m.proofs_pending_review ?? 0}</span>}
          sub="Awaiting sponsor review" barPct={(m.proofs_pending_review ?? 0) > 0 ? 30 : 0} barColor="#c9a82c" />
        <StatCard label="Disputed"             value={<span style={{ color: (m.disputed_contracts ?? 0) > 0 ? '#c00000' : undefined }}>{m.disputed_contracts ?? 0}</span>}
          sub="In dispute" barPct={(m.disputed_contracts ?? 0) > 0 ? 30 : 0} barColor="#c00000" />
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'draft', 'pending_fighter', 'active', 'in_dispute', 'completed', 'terminated'].map(s => (
          <button key={s} onClick={() => { setFilter(s); load(s || undefined) }}
            className="font-condensed font-bold uppercase text-[10px] tracking-[0.15em] px-3 py-1.5 border cursor-pointer transition-all"
            style={{
              borderColor: statusFilter === s ? '#8b0000' : '#222226',
              color:       statusFilter === s ? '#f0ece4' : '#7a7672',
              background:  statusFilter === s ? 'rgba(139,0,0,0.1)' : 'transparent',
            }}>
            {s ? AC_LABEL[s] ?? s : 'All'}
          </button>
        ))}
      </div>

      {!contracts.length ? (
        <EmptyState icon="○" title="No Contracts" body="No contracts match the current filter." />
      ) : (
        <div className="space-y-2">
          {contracts.map((c: any) => {
            const oblPct = c.obligations_total > 0
              ? Math.round(c.obligations_completed / c.obligations_total * 100) : 0
            return (
              <div key={c.id} className="dash-card flex items-center gap-4"
                style={{ borderLeft: `2px solid ${AC_COLOR[c.status] ?? '#222226'}` }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className="font-condensed text-[9px] font-bold uppercase tracking-widest px-2 py-0.5"
                      style={{ background: AC_COLOR[c.status] ?? '#374151', color: '#f0ece4' }}>
                      {AC_LABEL[c.status] ?? c.status}
                    </span>
                    {c.fighter && <span className="font-condensed text-[12px] font-bold text-off-white">{c.fighter.name}</span>}
                    {c.sponsor_detail && <span className="font-condensed text-[11px] text-gray-3">{c.sponsor_detail.company_name}</span>}
                  </div>
                  <div className="font-condensed text-[12px] text-gray-2">${c.value_usd?.toLocaleString()} · {c.payment_schedule}</div>
                  {c.obligations_total > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <div style={{ width: 80, height: 3, background: '#222226', borderRadius: 2 }}>
                        <div style={{ width: `${oblPct}%`, height: '100%', background: oblPct === 100 ? '#00c060' : '#8b0000', borderRadius: 2 }} />
                      </div>
                      <span className="font-condensed text-[10px] text-gray-3">{c.obligations_completed}/{c.obligations_total}</span>
                    </div>
                  )}
                </div>
                <a href={`/contracts/${c.id}`}
                  className="font-condensed text-[10px] text-gray-3 hover:text-off-white no-underline flex-shrink-0">View →</a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Obligations ───────────────────────────────────────────────────────────────
function ObligationsTab() {
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAdminDashboard()
      .then(d => { setMetrics(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <DashSkeleton />

  const m = metrics ?? {}
  const total     = m.total_obligations      ?? 0
  const completed = m.completed_obligations  ?? 0
  const overdue   = m.overdue_obligations    ?? 0
  const active    = total - completed

  const statusData = [
    { label: 'Active',    value: active > 0 ? active : 0,    color: '#C41E3A' },
    { label: 'Completed', value: completed,                   color: '#00c060' },
    { label: 'Overdue',   value: overdue,                     color: '#7f1d1d' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <StatCard label="Total Obligations"  value={String(total)}     sub="All active"   barPct={100} />
        <StatCard label="Completed"          value={String(completed)} sub="All time"     barPct={total > 0 ? Math.round(completed / total * 100) : 0} barColor="#00c060" />
        <StatCard label="Active"             value={String(active > 0 ? active : 0)} sub="In progress" barPct={50} />
        <StatCard label="Overdue"
          value={<span style={{ color: overdue > 0 ? '#c00000' : undefined }}>{overdue}</span>}
          sub="Need attention" barPct={overdue > 0 ? 30 : 0} barColor="#c00000" />
      </div>
      {total > 0 ? (
        <div className="dash-card">
          <div className="dash-label mb-3">Obligations by Status</div>
          <DistBar data={statusData} />
        </div>
      ) : (
        <EmptyState icon="○" title="No Obligations Yet"
          body="Obligation data appears once contracts with deliverables are active." />
      )}
      {m.proofs_pending_review > 0 && (
        <div className="dash-card" style={{ borderLeft: '3px solid #c9a82c' }}>
          <div className="font-condensed font-bold text-[11px] tracking-[0.2em] uppercase mb-1" style={{ color: '#c9a82c' }}>
            Proofs Pending Review
          </div>
          <div className="font-body text-gray-2" style={{ fontSize: 13 }}>
            {m.proofs_pending_review} proof{m.proofs_pending_review > 1 ? 's' : ''} submitted by fighters, awaiting sponsor review.
          </div>
        </div>
      )}
    </div>
  )
}

// ── SponsorForge access review queue ──────────────────────────────────────────
function SponsorForgeReviews() {
  const [reviews, setReviews]   = useState<SFReview[]>([])
  const [loading, setLoading]   = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [note, setNote]         = useState('')
  const [msg, setMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getSponsorForgeReviews('pending')
      .then(r => { setReviews(r.reviews ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const decide = async (id: string, action: 'approve' | 'reject', notes?: string) => {
    setActingId(id); setMsg(null)
    try {
      await decideSponsorForgeReview(id, action, notes)
      setMsg({ type: 'ok', text: action === 'approve' ? 'Approved — SponsorForge unlocked.' : 'Returned to fighter with feedback.' })
      setRejectId(null); setNote(''); load()
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message ?? 'Action failed.' })
    } finally { setActingId(null) }
  }

  return (
    <div className="dash-card" style={{ borderLeft: '2px solid #c00000' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="dash-label">SponsorForge Review Queue</div>
        <span className={`badge ${reviews.length > 0 ? 'badge-red' : 'badge-green'}`}>{reviews.length} pending</span>
      </div>
      {msg && <p className={`font-condensed text-[11px] mb-3 ${msg.type === 'ok' ? 'text-green-400' : 'text-blood-glow'}`}>{msg.text}</p>}
      {loading ? (
        <div className="dash-sub">Loading requests…</div>
      ) : reviews.length === 0 ? (
        <div className="dash-sub">No pending SponsorForge access requests.</div>
      ) : (
        <div className="space-y-1">
          {reviews.map(r => (
            <div key={r.id} className="py-2.5 border-b border-charcoal-3 last:border-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-condensed font-bold text-[13px] text-off-white truncate">{r.name}</div>
                  <div className="font-condensed text-[11px] text-gray-3">
                    {r.email ?? '—'}{r.submitted_at ? ` · submitted ${new Date(r.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                  </div>
                </div>
                {rejectId !== r.id && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => decide(r.id, 'approve')} disabled={actingId === r.id}
                      className="font-condensed font-bold uppercase text-[9px] tracking-[0.1em] px-3 py-1.5 border cursor-pointer disabled:opacity-40"
                      style={{ borderColor: '#2a5c2a', color: '#00c060', background: 'rgba(0,160,80,0.08)' }}>
                      {actingId === r.id ? '…' : 'Approve'}
                    </button>
                    <button onClick={() => { setRejectId(r.id); setNote('') }} disabled={actingId === r.id}
                      className="font-condensed font-bold uppercase text-[9px] tracking-[0.1em] px-3 py-1.5 border border-charcoal-3 text-gray-3 hover:text-blood-glow hover:border-blood cursor-pointer disabled:opacity-40">
                      Reject
                    </button>
                  </div>
                )}
              </div>
              {rejectId === r.id && (
                <div className="mt-2 space-y-2">
                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                    placeholder="What does the fighter need to fix? (sent to them)"
                    className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[12px] px-3 py-2 outline-none resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => decide(r.id, 'reject', note)} disabled={actingId === r.id || !note.trim()}
                      className="btn-primary text-[10px] py-1.5 px-4 disabled:opacity-40">Send Rejection</button>
                    <button onClick={() => { setRejectId(null); setNote('') }} className="btn-ghost text-[10px] py-1.5 px-4">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SponsorForge ──────────────────────────────────────────────────────────────
function SponsorForgeTab() {
  const { data, loading, error } = useApi<any>('/api/admin/sponsorforge')
  const [recomputing, setRecomputing] = useState(false)
  const [recomputeMsg, setRecomputeMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const recompute = async () => {
    setRecomputing(true); setRecomputeMsg(null)
    try {
      const r = await adminRecompute()
      setRecomputeMsg({ type: 'ok', text: `Recomputed ${r.computed} matches across ${r.opportunities} opportunities.` })
    } catch (e: any) {
      setRecomputeMsg({ type: 'err', text: e.message ?? 'Recompute failed.' })
    } finally { setRecomputing(false) }
  }

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const matchCount = data?.active_matches       ?? 0
  const activeOpps = data?.active_opportunities ?? 0
  const sponsors   = data?.sponsors             ?? 0
  const eligible   = data?.eligible_fighters    ?? 0

  const eligibilityData = [
    { label: 'Eligible',  value: eligible,                            color: '#00c060' },
    { label: 'Not Ready', value: Math.max(0, (data?.total_fighters ?? 0) - eligible), color: '#4a4846' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase text-gray-3">SponsorForge Network</div>
        <div className="flex items-center gap-3">
          {recomputeMsg && (
            <span className={`font-condensed text-[11px] ${recomputeMsg.type === 'ok' ? 'text-green-400' : 'text-blood-glow'}`}>
              {recomputeMsg.text}
            </span>
          )}
          <button onClick={recompute} disabled={recomputing}
            className="font-condensed font-bold uppercase text-[10px] tracking-[0.15em] px-4 py-2 border cursor-pointer transition-all disabled:opacity-50"
            style={{ borderColor: '#8b0000', color: '#C41E3A', background: 'rgba(139,0,0,0.08)' }}>
            {recomputing ? '↻ Computing…' : '↻ Recompute All'}
          </button>
        </div>
      </div>

      {/* Access requests awaiting admin decision */}
      <SponsorForgeReviews />

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="dash-card text-center" style={{ borderTop: '2px solid #00c060' }}>
          <div className="dash-label">Verified Sponsors</div>
          <div className="font-display text-off-white mt-1" style={{ fontSize: 34 }}>{sponsors}</div>
        </div>
        <StatCard label="Eligible Fighters"  value={String(eligible)}   sub="Profile unlocked"    barPct={eligible > 0 ? 60 : 0} />
        <StatCard label="Active Matches"     value={String(matchCount)} sub="Non-dismissed"        barPct={matchCount > 0 ? 50 : 0} />
        <StatCard label="Live Opportunities" value={String(activeOpps)} sub="Published campaigns"  barPct={activeOpps > 0 ? 80 : 0} />
      </div>

      {matchCount === 0 ? (
        <EmptyState icon="○" title="No Matches Yet"
          body={sponsors === 0 ? 'No verified sponsors yet.' : 'Click Recompute All to generate matches.'}
          action={sponsors > 0 ? (
            <button onClick={recompute} disabled={recomputing} className="btn-primary text-[11px] py-2 px-6">
              {recomputing ? 'Computing…' : 'Compute Now'}
            </button>
          ) : undefined}
        />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="dash-card">
            <div className="dash-label mb-1">Match Engine V1</div>
            <div className="font-condensed text-[13px] text-gray-2">
              {matchCount} active matches · {activeOpps} opportunit{activeOpps === 1 ? 'y' : 'ies'}
            </div>
            <div className="font-condensed text-[11px] text-gray-3 mt-1">
              Readiness 40% · Brand Fit 20% · Audience 15% · Location 10% · Availability 10% · Content 5%
            </div>
          </div>
          <div className="dash-card">
            <div className="dash-label mb-3">Fighter Eligibility</div>
            <DistBar data={eligibilityData} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Messaging ─────────────────────────────────────────────────────────────────
const CONV_COLOR: Record<string, string> = { open: '#00c060', archived: '#4a4846', locked: '#7f1d1d' }

function MessagingTab() {
  const [convs, setConvs]         = useState<any[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setFilter] = useState('')
  const [acting, setActing]       = useState<string | null>(null)
  const [msg, setMsg]             = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback((s?: string) => {
    setLoading(true); setMsg(null)
    getAdminConversationList({ status: s || undefined, limit: 30 })
      .then(r => { setConvs(r.conversations ?? []); setTotal(r.total ?? 0); setLoading(false) })
      .catch(e => { setMsg({ type: 'err', text: e.message ?? 'Failed.' }); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const changeStatus = async (id: string, status: 'open' | 'archived' | 'locked') => {
    setActing(id)
    try {
      await adminLockConversation(id, status)
      setConvs(prev => prev.map(c => c.id === id ? { ...c, status } : c))
      setMsg({ type: 'ok', text: `Conversation ${status}.` })
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message ?? 'Failed.' })
    } finally { setActing(null) }
  }

  return (
    <div className="space-y-4">
      <div className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase text-gray-3 mb-1">
        Conversations ({total})
      </div>
      <div className="flex gap-2 flex-wrap">
        {(['', 'open', 'archived', 'locked'] as const).map(s => (
          <button key={s} onClick={() => { setFilter(s); load(s || undefined) }}
            className="font-condensed font-bold uppercase text-[10px] tracking-[0.15em] px-3 py-1.5 border cursor-pointer transition-all"
            style={{
              borderColor: statusFilter === s ? '#8b0000' : '#222226',
              color:       statusFilter === s ? '#f0ece4' : '#7a7672',
              background:  statusFilter === s ? 'rgba(139,0,0,0.1)' : 'transparent',
            }}>
            {s || 'All'}
          </button>
        ))}
      </div>
      {msg && <ActionMsg msg={msg} />}
      {loading ? <DashSkeleton /> : !convs.length ? (
        <EmptyState icon="○" title="No Conversations" body="No conversations match the current filter." />
      ) : (
        <div className="space-y-2">
          {convs.map((c: any) => (
            <div key={c.id} className="dash-card flex items-center gap-4"
              style={{ borderLeft: `2px solid ${CONV_COLOR[c.status] ?? '#222226'}` }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="font-condensed text-[9px] font-bold uppercase tracking-widest px-2 py-0.5"
                    style={{ background: CONV_COLOR[c.status] ?? '#374151', color: '#f0ece4' }}>
                    {c.status ?? 'open'}
                  </span>
                  <span className="font-condensed text-[10px] text-gray-3">{c.context_type}</span>
                </div>
                <div className="font-condensed font-bold text-off-white text-[13px] truncate">
                  {c.subject || `${c.context_type} conversation`}
                </div>
                {c.last_message_at && (
                  <div className="font-condensed text-[10px] text-gray-3 mt-0.5">
                    {new Date(c.last_message_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {c.status !== 'locked' && (
                  <button onClick={() => changeStatus(c.id, 'locked')} disabled={acting === c.id}
                    className="font-condensed uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border border-charcoal-3 text-gray-3 cursor-pointer hover:border-blood hover:text-blood-glow transition-all disabled:opacity-40">
                    {acting === c.id ? <Spinner /> : 'Lock'}
                  </button>
                )}
                {c.status !== 'archived' && (
                  <button onClick={() => changeStatus(c.id, 'archived')} disabled={acting === c.id}
                    className="font-condensed uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border border-charcoal-3 text-gray-3 cursor-pointer disabled:opacity-40">
                    Archive
                  </button>
                )}
                {c.status !== 'open' && (
                  <button onClick={() => changeStatus(c.id, 'open')} disabled={acting === c.id}
                    className="font-condensed uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border border-charcoal-3 text-gray-3 cursor-pointer disabled:opacity-40">
                    Re-open
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Zone export ───────────────────────────────────────────────────────────────
export default function MarketplaceOps() {
  const [sub, setSub] = useState('mkt-overview')
  return (
    <div>
      <SubNav tabs={TABS} active={sub} onChange={setSub} />
      {sub === 'mkt-overview'  && <MktOverview />}
      {sub === 'applications'  && <ApplicationsTab />}
      {sub === 'contracts'     && <ContractsTab />}
      {sub === 'obligations'   && <ObligationsTab />}
      {sub === 'sponsorforge'  && <SponsorForgeTab />}
      {sub === 'messaging'     && <MessagingTab />}
    </div>
  )
}
