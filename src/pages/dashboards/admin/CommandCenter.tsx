import React, { useState, useEffect } from 'react'
import { useApi } from '../../../hooks/useApi'
import { getAdminDashboard } from '../../../lib/api/admin'
import { DashSkeleton, ApiError, EmptyState } from '../DashWidgets'
import { RoleDonut, FunnelBar, TrendLine } from './AdminCharts'
import { SubNav } from './AdminUtils'

const TABS = [
  { id: 'overview',  label: 'Overview'     },
  { id: 'queue',     label: 'Action Queue' },
  { id: 'activity',  label: 'Activity'     },
  { id: 'health',    label: 'Health'       },
]

// ── Overview ──────────────────────────────────────────────────────────────────
function CCOverview() {
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const { data: ovData }      = useApi<any>('/api/admin/overview')
  const { data: mktData }     = useApi<any>('/api/admin/marketplace')
  const { data: analytics }   = useApi<any>('/api/admin/analytics')
  const { data: sfData }      = useApi<any>('/api/admin/sponsorforge')
  const { data: contentData } = useApi<any>('/api/admin/content')

  useEffect(() => {
    getAdminDashboard()
      .then(d => { setMetrics(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const m        = metrics ?? {}
  const pendVet  = ovData?.pending_vetting ?? 0
  const funnel   = mktData?.applications_funnel ?? {}
  const gmvData  = (analytics?.monthly_gmv ?? []) as { label: string; value: number }[]

  const actionItems: { text: string; urgency: 'red' | 'yellow' }[] = []
  if ((m.overdue_obligations  ?? 0) > 0)
    actionItems.push({ text: `${m.overdue_obligations} overdue obligation${m.overdue_obligations > 1 ? 's' : ''}`, urgency: 'red' })
  if (pendVet > 0)
    actionItems.push({ text: `${pendVet} sponsor${pendVet > 1 ? 's' : ''} pending vetting`, urgency: 'yellow' })
  if ((m.proofs_pending_review ?? 0) > 0)
    actionItems.push({ text: `${m.proofs_pending_review} proof${m.proofs_pending_review > 1 ? 's' : ''} pending review`, urgency: 'yellow' })
  if ((m.disputed_contracts   ?? 0) > 0)
    actionItems.push({ text: `${m.disputed_contracts} contract${m.disputed_contracts > 1 ? 's' : ''} in dispute`, urgency: 'red' })

  const roleData = [
    { name: 'Fighters', value: m.fighters ?? 0, color: '#C41E3A' },
    { name: 'Managers', value: m.managers ?? 0, color: '#c9a82c' },
    { name: 'Sponsors', value: m.sponsors ?? 0, color: '#00c060' },
  ]
  const funnelData = Object.entries(funnel).map(([s, c]) => ({
    label: s.replace(/_/g, ' '),
    value: c as number,
  }))
  const revenueData = gmvData.map(d => ({ month: d.label, value: d.value }))
  const revDisplay  = (m.total_revenue_usd ?? 0) > 0
    ? `$${Math.round(m.total_revenue_usd / 100).toLocaleString()}`
    : '$—'

  return (
    <div className="space-y-5">
      {/* Vital strip */}
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(6,1fr)' }}>
        {[
          { label: 'Users',     value: m.total_users          ?? 0, accent: '#8b0000' },
          { label: 'Fighters',  value: m.fighters             ?? 0, accent: '#8b0000' },
          { label: 'Managers',  value: m.managers             ?? 0, accent: '#8b0000' },
          { label: 'Sponsors',  value: m.sponsors             ?? 0, accent: pendVet > 0 ? '#c9a82c' : '#8b0000' },
          { label: 'Live Opps', value: m.active_opportunities ?? 0, accent: '#00c060' },
          { label: 'Contracts', value: m.active_contracts     ?? 0, accent: '#00c060' },
        ].map(({ label, value, accent }) => (
          <div key={label} className="bg-charcoal-2 border border-charcoal-3 px-3 py-3 text-center"
            style={{ borderTop: `2px solid ${accent}` }}>
            <div className="font-condensed text-[9px] font-bold uppercase tracking-[0.3em] text-gray-3 mb-1">{label}</div>
            <div className="font-display text-off-white" style={{ fontSize: 28, lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Main operational row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 260px' }}>
        {/* Action Required */}
        <div className="dash-card" style={{ borderLeft: '3px solid #c00000' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase" style={{ color: '#c00000' }}>
              Action Required
            </span>
            {actionItems.length > 0 && (
              <span className="font-condensed text-[9px] font-bold px-1.5 py-0.5"
                style={{ background: '#c0000022', color: '#c00000', border: '1px solid #c0000044' }}>
                {actionItems.length}
              </span>
            )}
          </div>
          {actionItems.length === 0 ? (
            <div className="flex items-center gap-2 py-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#00c060', boxShadow: '0 0 5px #00c06055' }} />
              <span className="font-condensed text-[12px] text-gray-2">Queue clear</span>
            </div>
          ) : (
            <ul>
              {actionItems.map((item, i) => (
                <li key={i} className="flex items-center gap-2.5 py-2 border-b border-charcoal-3 last:border-0">
                  <span className="w-1.5 h-1.5 rounded-sm flex-shrink-0"
                    style={{ background: item.urgency === 'red' ? '#c00000' : '#c9a82c' }} />
                  <span className="font-condensed text-[12px] text-gray-1 flex-1">{item.text}</span>
                  <span className={`badge ${item.urgency === 'red' ? 'badge-red' : 'badge-yellow'} flex-shrink-0`}>
                    {item.urgency === 'red' ? 'Urgent' : 'Review'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Key metrics */}
        <div className="space-y-3">
          <div className="dash-card">
            <div className="dash-label">Lifetime Revenue</div>
            <div className="font-display mt-1" style={{ fontSize: 30, lineHeight: 1,
              color: (m.total_revenue_usd ?? 0) > 0 ? '#f0ece4' : '#4a4846' }}>
              {revDisplay}
            </div>
            <div className="dash-sub">Succeeded payments</div>
          </div>
          <div className="dash-card">
            <div className="dash-label">Marketplace Pulse</div>
            <div className="flex gap-5 mt-1">
              <div>
                <div className="font-display text-off-white" style={{ fontSize: 22, lineHeight: 1 }}>{m.total_applications ?? 0}</div>
                <div className="dash-sub">Applications</div>
              </div>
              <div>
                <div className="font-display" style={{ fontSize: 22, lineHeight: 1,
                  color: (m.overdue_obligations ?? 0) > 0 ? '#c00000' : '#f0ece4' }}>
                  {m.overdue_obligations ?? 0}
                </div>
                <div className="dash-sub">Overdue obligs.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Snapshot column */}
        <div className="space-y-3">
          <div className="dash-card">
            <div className="dash-label mb-2">SponsorForge</div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { l: 'Sponsors',  v: sfData?.sponsors            ?? 0 },
                { l: 'Matches',   v: sfData?.active_matches       ?? 0 },
                { l: 'Eligible',  v: sfData?.eligible_fighters    ?? 0 },
                { l: 'Live Opps', v: sfData?.active_opportunities ?? 0 },
              ].map(({ l, v }) => (
                <div key={l} className="text-center bg-charcoal-2 border border-charcoal-3 px-1.5 py-1.5">
                  <div className="font-display text-off-white" style={{ fontSize: 17 }}>{v}</div>
                  <div className="font-condensed text-[8px] text-gray-3 uppercase tracking-wide leading-tight">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="dash-card">
            <div className="dash-label mb-2">Education</div>
            <div className="flex items-center gap-4">
              <div className="text-center flex-1">
                <div className="font-display text-off-white" style={{ fontSize: 22 }}>{contentData?.published_modules ?? 0}</div>
                <div className="dash-sub">Published</div>
              </div>
              <div className="text-center flex-1">
                <div className="font-display text-off-white" style={{ fontSize: 22 }}>{contentData?.total_modules ?? 0}</div>
                <div className="dash-sub">Total</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1.4fr 1fr' }}>
        <div className="dash-card">
          <div className="dash-label mb-3">User Roles</div>
          <RoleDonut data={roleData} />
        </div>
        <div className="dash-card">
          <div className="dash-label mb-3">Applications Funnel</div>
          <FunnelBar data={funnelData} />
        </div>
        <div className="dash-card">
          <div className="dash-label mb-3">Monthly GMV</div>
          <TrendLine data={revenueData} label="GMV $" />
        </div>
      </div>
    </div>
  )
}

// ── Action Queue ──────────────────────────────────────────────────────────────
function ActionQueue() {
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { data: ovData }      = useApi<any>('/api/admin/overview')

  useEffect(() => {
    getAdminDashboard()
      .then(d => { setMetrics(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <DashSkeleton />

  const m       = metrics ?? {}
  const pendVet = ovData?.pending_vetting ?? 0

  const items: { cat: string; text: string; urgency: 'red' | 'yellow'; hint: string }[] = []
  if ((m.overdue_obligations ?? 0) > 0)
    items.push({ cat: 'Obligations', text: `${m.overdue_obligations} obligation${m.overdue_obligations > 1 ? 's' : ''} overdue`, urgency: 'red', hint: 'Marketplace Ops → Obligations' })
  if (pendVet > 0)
    items.push({ cat: 'Vetting', text: `${pendVet} sponsor${pendVet > 1 ? 's' : ''} awaiting vetting`, urgency: 'yellow', hint: 'Users & Vetting → Sponsor Vetting' })
  if ((m.proofs_pending_review ?? 0) > 0)
    items.push({ cat: 'Proofs', text: `${m.proofs_pending_review} proof${m.proofs_pending_review > 1 ? 's' : ''} pending review`, urgency: 'yellow', hint: 'Marketplace Ops → Obligations' })
  if ((m.disputed_contracts ?? 0) > 0)
    items.push({ cat: 'Contracts', text: `${m.disputed_contracts} contract${m.disputed_contracts > 1 ? 's' : ''} in dispute`, urgency: 'red', hint: 'Marketplace Ops → Contracts' })

  if (items.length === 0) return (
    <EmptyState icon="✓" title="Queue Clear" body="No pending actions require attention." />
  )

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="dash-card flex items-center gap-4"
          style={{ borderLeft: `3px solid ${item.urgency === 'red' ? '#c00000' : '#c9a82c'}` }}>
          <div className="flex-1 min-w-0">
            <span className="font-condensed text-[9px] font-bold uppercase tracking-[0.2em] text-gray-3 block mb-0.5">{item.cat}</span>
            <div className="font-condensed text-[13px] text-off-white">{item.text}</div>
            <div className="font-condensed text-[10px] text-gray-3 mt-0.5">→ {item.hint}</div>
          </div>
          <span className={`badge ${item.urgency === 'red' ? 'badge-red' : 'badge-yellow'} flex-shrink-0`}>
            {item.urgency === 'red' ? 'Urgent' : 'Review'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Activity ──────────────────────────────────────────────────────────────────
function CCActivity() {
  const { data, loading, error } = useApi<any>('/api/admin/marketplace')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const recent = (data?.recent_contracts ?? []) as { name: string; badge: string; type: string }[]
  if (!recent.length) return (
    <EmptyState icon="○" title="No Activity Yet"
      body="Recent platform activity appears once marketplace contracts are created." />
  )

  return (
    <div className="space-y-2">
      <div className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase text-gray-3 mb-4">Recent Contracts</div>
      {recent.map((c, i) => (
        <div key={i} className="dash-card flex items-center gap-4">
          <span className="font-condensed text-[12px] text-gray-1 flex-1">{c.name}</span>
          <span className={`badge badge-${c.type ?? 'yellow'}`}>{c.badge}</span>
        </div>
      ))}
    </div>
  )
}

// ── Health ────────────────────────────────────────────────────────────────────
function CCHealth() {
  const { data: health, loading } = useApi<any>('/api/health')
  if (loading) return <DashSkeleton />

  const services = [
    { label: 'API Server',    ok: true,                                      na: false, detail: 'Backend server responding' },
    { label: 'Supabase',      ok: !!health?.supabase,                        na: false, detail: health?.supabase ? 'Auth + DB connected' : 'Set SUPABASE_URL + SERVICE_ROLE_KEY' },
    { label: 'SendGrid',      ok: !!health?.sendgrid,                        na: false, detail: health?.sendgrid ? 'Transactional email active' : 'Set SENDGRID_API_KEY + FROM_EMAIL' },
    { label: 'SMTP Fallback', ok: !!health?.email,                           na: false, detail: health?.email ? 'SMTP transport active' : 'Optional — set EMAIL_HOST/USER/PASS' },
    { label: 'Stripe',        ok: false,                                      na: true,  detail: 'Stripe Connect integration — planned V2' },
    { label: 'Storage',       ok: !!health?.supabase,                        na: false, detail: 'Supabase storage (PDFs, assets)' },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {services.map(s => (
        <div key={s.label} className="dash-card flex items-center gap-3"
          style={{ borderLeft: `3px solid ${s.na ? '#3a3a3e' : s.ok ? '#00c060' : '#c00000'}` }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
            background: s.na ? '#3a3a3e' : s.ok ? '#00c060' : '#c00000',
            boxShadow:  s.na ? 'none' : s.ok ? '0 0 6px #00c06055' : '0 0 6px #c0000055',
          }} />
          <div className="flex-1 min-w-0">
            <div className="font-condensed text-[12px] font-bold text-off-white">{s.label}</div>
            <div className="font-condensed text-[10px] text-gray-3">{s.detail}</div>
          </div>
          <span className="font-condensed text-[9px] font-bold uppercase tracking-wider flex-shrink-0"
            style={{ color: s.na ? '#3a3a3e' : s.ok ? '#00c060' : '#c00000' }}>
            {s.na ? 'N/A' : s.ok ? 'OK' : 'Down'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Zone export ───────────────────────────────────────────────────────────────
export default function CommandCenter() {
  const [sub, setSub] = useState('overview')
  return (
    <div>
      <SubNav tabs={TABS} active={sub} onChange={setSub} />
      {sub === 'overview' && <CCOverview />}
      {sub === 'queue'    && <ActionQueue />}
      {sub === 'activity' && <CCActivity />}
      {sub === 'health'   && <CCHealth />}
    </div>
  )
}
