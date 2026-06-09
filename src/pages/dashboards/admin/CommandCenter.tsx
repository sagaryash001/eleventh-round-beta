import React, { useState, useEffect } from 'react'
import { useApi } from '../../../hooks/useApi'
import { getAdminDashboard } from '../../../lib/api/admin'
import { DashSkeleton, ApiError, EmptyState } from '../DashWidgets'
import { FunnelBar, TrendLine } from './AdminCharts'
import { SubNav } from './AdminUtils'
import { ReadinessRing, MiniBar } from '../shared/CommandLayout'

const TABS = [
  { id: 'overview',  label: 'Overview'     },
  { id: 'queue',     label: 'Action Queue' },
  { id: 'activity',  label: 'Activity'     },
  { id: 'health',    label: 'Health'       },
]

// ── Overview — Command Center hero layout ────────────────────────────────────
function CCOverview() {
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const { data: ovData }      = useApi<any>('/api/admin/overview')
  const { data: mktData }     = useApi<any>('/api/admin/marketplace')
  const { data: analytics }   = useApi<any>('/api/admin/analytics')
  const { data: sfData }      = useApi<any>('/api/admin/sponsorforge')
  const { data: contentData } = useApi<any>('/api/admin/content')
  const { data: healthData }  = useApi<any>('/api/health')

  useEffect(() => {
    getAdminDashboard()
      .then(d => { setMetrics(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const m       = metrics ?? {}
  const pendVet = ovData?.pending_vetting ?? 0

  // ── Panel 1: Active Platform ─────────────────────────────────────────────
  const totalUsers = m.total_users ?? 0
  const fighters   = m.fighters   ?? 0
  const managers   = m.managers   ?? 0
  const sponsors   = m.sponsors   ?? 0
  const rolePct    = totalUsers > 0 ? Math.round((fighters + managers + sponsors) / totalUsers * 100) : 0

  // ── Panel 2: Platform Readiness score (derived from real metrics) ────────
  const verifiedSpons = mktData?.verified_sponsors ?? 0
  const sponsorCount  = mktData?.sponsor_count     ?? 0
  const sponsorPct    = sponsorCount > 0 ? Math.round(verifiedSpons / sponsorCount * 100) : 0

  const activeOpps     = m.active_opportunities ?? 0
  const totalApps      = m.total_applications   ?? 0
  const mktPct         = activeOpps > 0 ? Math.min(100, 40 + Math.round(totalApps / activeOpps * 8)) : 0

  const activeContracts = m.active_contracts ?? 0
  const totalContracts  = m.total_contracts  ?? 0
  const contractPct     = totalContracts > 0 ? Math.round(activeContracts / totalContracts * 100) : 0

  const pubModules   = contentData?.published_modules ?? 0
  const totalModules = contentData?.total_modules     ?? 0
  const eduPct       = totalModules > 0 ? Math.round(pubModules / totalModules * 100) : 0

  const readinessScore = Math.round([sponsorPct, mktPct, contractPct, eduPct]
    .reduce((a, b) => a + b, 0) / 4)

  // ── Panel 3: Actions Due ─────────────────────────────────────────────────
  const proofsPending = m.proofs_pending_review ?? 0
  const overdue       = m.overdue_obligations   ?? 0
  const disputed      = m.disputed_contracts    ?? 0
  const totalActions  = pendVet + proofsPending + overdue + disputed
  const actionBarPct  = Math.min(totalActions * 14, 100)

  // ── Activity feed: real recent_contracts from marketplace API ────────────
  type FeedRow = { name: string; badge: string; type: 'green' | 'red' | 'yellow' }
  const feedRows: FeedRow[] = (mktData?.recent_contracts ?? []).slice(0, 5)

  // ── Secondary section data ───────────────────────────────────────────────
  const funnel      = mktData?.applications_funnel ?? {}
  const funnelData  = Object.entries(funnel).map(([s, c]) => ({ label: s.replace(/_/g, ' '), value: c as number }))
  const gmvData     = (analytics?.monthly_gmv ?? []) as { label: string; value: number }[]
  const revenueData = gmvData.map(d => ({ month: d.label, value: d.value }))
  const revDisplay  = (m.total_revenue_usd ?? 0) > 0
    ? `$${Math.round(m.total_revenue_usd / 100).toLocaleString()}` : '$—'

  return (
    <div className="space-y-3.5">

      {/* ── ROW 1 + ROW 2 in one grid (same pattern as DashboardPreview CommandUI) ── */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 1.5fr 1fr' }}>

        {/* ── Panel 1: Active Platform ── */}
        <div className="dash-card">
          <div className="dash-label">Active Platform</div>
          <div className="dash-stat">{totalUsers}</div>
          <div className="dash-sub">Users in system</div>
          <div className="dash-bar-track">
            <div className="dash-bar-fill" style={{ width: `${rolePct}%` }} />
          </div>
          <div className="dash-sub">{fighters}F · {managers}M · {sponsors}S</div>
        </div>

        {/* ── Panel 2: Platform Readiness ── */}
        <div className="dash-card">
          <div className="dash-label">Platform Readiness</div>
          <div className="flex gap-5 items-center mt-1 flex-wrap">
            <ReadinessRing pct={readinessScore} />
            <div className="grid grid-cols-2 gap-2 flex-1 min-w-0" style={{ minWidth: 140 }}>
              <MiniBar label="Onboarding"  pct={null} />
              <MiniBar label="Marketplace" pct={mktPct} />
              <MiniBar label="Contracts"   pct={contractPct} />
              <MiniBar label="Education"   pct={eduPct} />
            </div>
          </div>
        </div>

        {/* ── Panel 3: Actions Due ── */}
        <div className="dash-card">
          <div className="dash-label">Actions Due</div>
          {totalActions === 0 ? (
            <>
              <div className="dash-stat" style={{ color: '#00c060' }}>0</div>
              <div className="dash-sub" style={{ color: '#00c060' }}>Queue clear</div>
            </>
          ) : (
            <>
              <div className="dash-stat" style={{ color: '#C41E3A' }}>{totalActions}</div>
              <div className="dash-sub">Need attention</div>
              <div className="dash-bar-track">
                <div className="dash-bar-fill" style={{ width: `${actionBarPct}%`, background: '#C41E3A' }} />
              </div>
              <div className="dash-sub">
                {[
                  pendVet       > 0 && `${pendVet} vetting`,
                  proofsPending > 0 && `${proofsPending} proofs`,
                  overdue       > 0 && `${overdue} overdue`,
                  disputed      > 0 && `${disputed} disputed`,
                ].filter(Boolean).join(' · ')}
              </div>
            </>
          )}
        </div>

        {/* ── Row 2: Full-width Recent Activity ── */}
        <div className="dash-card" style={{ gridColumn: '1 / -1' }}>
          <div className="dash-label">Recent Activity</div>
          {feedRows.length === 0 ? (
            <p className="dash-sub py-3">
              No recent platform activity yet. Activity will appear here as contracts are created.
            </p>
          ) : (
            <ul className="dc-list">
              {feedRows.map((row, i) => (
                <li key={i} className="dash-list-item">
                  <span className="dash-item-name">{row.name}</span>
                  <span className={`badge badge-${row.type}`}>{row.badge}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Row 3: Marketplace Pulse + Platform Vitals ── */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        <div className="dash-card">
          <div className="dash-label mb-3">Marketplace Pulse</div>
          <FunnelBar data={funnelData} />
        </div>
        <div className="dash-card">
          <div className="dash-label mb-2">Platform Vitals</div>
          {[
            { l: 'Active Opportunities', v: activeOpps },
            { l: 'Total Applications',   v: totalApps },
            { l: 'Active Contracts',     v: activeContracts },
            { l: 'SF Matches',           v: sfData?.active_matches ?? 0 },
          ].map(({ l, v }) => (
            <div key={l} className="flex items-center justify-between py-1.5 border-b border-charcoal-3 last:border-0">
              <span className="font-condensed text-[11px] text-gray-2">{l}</span>
              <span className="font-condensed text-[13px] font-bold text-off-white">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 4: Education + Revenue + System Health ── */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="dash-card">
          <div className="dash-label">Education Engine</div>
          <div className="dash-stat-md">{pubModules}</div>
          <div className="dash-sub">Published modules</div>
          <div className="dash-bar-track">
            <div className="dash-bar-fill" style={{ width: `${eduPct}%` }} />
          </div>
          <div className="dash-sub">
            {totalModules > 0 ? `${eduPct}% of ${totalModules} published` : 'No modules yet'}
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-label">Revenue</div>
          <div className="dash-stat-md"
            style={{ color: (m.total_revenue_usd ?? 0) > 0 ? '#f0ece4' : '#4a4846' }}>
            {revDisplay}
          </div>
          <div className="dash-sub">Lifetime GMV</div>
          {revenueData.length > 0 && (
            <div className="mt-2">
              <TrendLine data={revenueData} label="GMV $" height={56} />
            </div>
          )}
        </div>

        <div className="dash-card">
          <div className="dash-label">System Health</div>
          <div className="space-y-2 mt-1">
            {[
              { l: 'API Server', ok: true,                                        na: false },
              { l: 'Supabase',   ok: !!healthData?.supabase,                      na: false },
              { l: 'Email',      ok: !!(healthData?.sendgrid || healthData?.email),na: false },
              { l: 'Stripe',     ok: false,                                        na: true  },
            ].map(s => (
              <div key={s.l} className="flex items-center gap-2">
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                  background: s.na ? '#3a3a3e' : s.ok ? '#00c060' : '#c00000',
                  boxShadow:  s.na ? 'none'    : s.ok ? '0 0 5px #00c06055' : '0 0 5px #c0000055',
                }} />
                <span className="font-condensed text-[11px] text-gray-2 flex-1">{s.l}</span>
                <span className="font-condensed text-[9px] font-bold uppercase tracking-wider"
                  style={{ color: s.na ? '#3a3a3e' : s.ok ? '#00c060' : '#c00000' }}>
                  {s.na ? 'N/A' : s.ok ? 'OK' : 'Down'}
                </span>
              </div>
            ))}
          </div>
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
