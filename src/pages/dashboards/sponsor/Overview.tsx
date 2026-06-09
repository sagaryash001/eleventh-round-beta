import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../../hooks/useApi'
import { getBillingStatus } from '../../../lib/api/billing'
import { getContracts } from '../../../lib/api/contracts'
import { getMyOpportunities } from '../../../lib/api/opportunities'
import { DashSkeleton, ApiError } from '../DashWidgets'
import { FunnelBar } from '../admin/AdminCharts'
import { ReadinessRing, MiniBar } from '../shared/CommandLayout'
import type { SponsorProfile } from '../../../lib/api/sponsors'

export default function Overview({ sp }: { sp: SponsorProfile }) {
  const { data: mkt, loading: mktLoad, error: mktErr } = useApi<any>('/api/sponsor/marketplace')
  const [billing,   setBilling]   = useState<any>(null)
  const [contracts, setContracts] = useState<any[]>([])
  const [opps,      setOpps]      = useState<any[]>([])

  useEffect(() => {
    getBillingStatus()
      .then(r => setBilling(r))
      .catch(() => {})
    getContracts()
      .then(r => setContracts(r.contracts ?? []))
      .catch(() => {})
    getMyOpportunities()
      .then(r => setOpps(r.data ?? []))
      .catch(() => {})
  }, [])

  if (mktLoad) return <DashSkeleton />
  if (mktErr)  return <ApiError message={mktErr} />

  const totalOpps    = mkt?.total_opportunities     ?? 0
  const pubOpps      = mkt?.published_opportunities ?? 0
  const totalApps    = mkt?.total_applications      ?? 0
  const acceptedApps = mkt?.accepted_applications   ?? 0
  const activeC      = mkt?.active_contracts        ?? 0
  const totalSpent   = mkt?.total_spent_usd         ?? 0
  const byStatus     = mkt?.applications_by_status  ?? {}

  const newApps         = byStatus.applied      ?? 0
  const shortlisted     = byStatus.shortlisted  ?? 0
  const awaitingSign    = contracts.filter(c => c.status === 'draft').length
  const totalAppsCount  = opps.reduce((s: number, o: any) => s + (o.application_count ?? 0), 0)
  const totalViewsCount = opps.reduce((s: number, o: any) => s + (o.view_count ?? 0), 0)

  // ── Panel 2: Deal Readiness score ────────────────────────────────────────
  const profileFields = [sp.company_name, sp.website_url, sp.industry, sp.description, sp.hq_country]
  const profilePct    = Math.round(profileFields.filter(Boolean).length / profileFields.length * 100)
  const verifiedPct   = sp.is_verified ? 100 : 0
  const campaignPct   = pubOpps > 0 ? 100 : 0
  const pipelinePct   = totalApps > 0 ? Math.min(100, shortlisted > 0 ? 70 + Math.round(shortlisted / totalApps * 30) : 30) : 0
  const billingPct    = billing?.membership ? 100 : 0
  const dealScore     = Math.round([verifiedPct, profilePct, campaignPct, billingPct].reduce((a, b) => a + b, 0) / 4)

  // ── Panel 3: Actions Due ─────────────────────────────────────────────────
  const notVerified   = !sp.is_verified ? 1 : 0
  const noBilling     = !billing?.membership ? 1 : 0
  const totalActions  = newApps + awaitingSign + notVerified + noBilling
  const actionBarPct  = Math.min(totalActions * 18, 100)

  // ── Activity feed: built from real contract + campaign data ──────────────
  type FeedRow = { name: string; badge: string; type: 'green' | 'red' | 'yellow' }
  const feedRows: FeedRow[] = []

  contracts.slice(0, 3).forEach(c => {
    const val = `$${(c.value_usd ?? 0).toLocaleString()}`
    if (c.status === 'draft')          feedRows.push({ name: `${val} contract — awaiting your signature`, badge: 'Sign Now',  type: 'red' })
    else if (c.status === 'pending_fighter') feedRows.push({ name: `${val} contract — awaiting fighter`,  badge: 'Pending',   type: 'yellow' })
    else if (c.status === 'active')    feedRows.push({ name: `${val} contract — active`,                  badge: 'Active',    type: 'green' })
    else if (c.status === 'completed') feedRows.push({ name: `${val} contract — completed`,               badge: 'Completed', type: 'green' })
  })
  if (newApps > 0 && feedRows.length < 5)
    feedRows.push({ name: `${newApps} new application${newApps > 1 ? 's' : ''} pending review`, badge: 'Action Required', type: 'red' })
  if (shortlisted > 0 && feedRows.length < 5)
    feedRows.push({ name: `${shortlisted} fighter${shortlisted > 1 ? 's' : ''} shortlisted`, badge: 'In Progress', type: 'yellow' })
  if (pubOpps > 0 && feedRows.length < 5)
    feedRows.push({ name: `${pubOpps} campaign${pubOpps > 1 ? 's' : ''} live`, badge: 'Live', type: 'green' })

  const spentDisplay = totalSpent >= 1000 ? `$${(totalSpent / 1000).toFixed(1)}K` : totalSpent > 0 ? `$${totalSpent}` : '$—'

  const funnelData = Object.entries(byStatus).map(([s, c]) => ({
    label: s.replace(/_/g, ' '), value: c as number,
  }))

  return (
    <div className="space-y-3.5">

      {/* ── Row 1 + Row 2 in one grid ── */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 1.5fr 1fr' }}>

        {/* ── Panel 1: Live Campaigns ── */}
        <div className="dash-card">
          <div className="dash-label">Live Campaigns</div>
          {pubOpps === 0 ? (
            <>
              <div className="dash-stat" style={{ color: '#4a4846' }}>0</div>
              <div className="dash-sub">No active campaigns</div>
              <div className="dash-bar-track"><div className="dash-bar-fill" style={{ width: '0%' }} /></div>
              <Link to="/sponsor/opportunities/new"
                className="font-condensed font-bold uppercase text-[10px] tracking-[0.2em] mt-2 inline-block no-underline"
                style={{ color: '#C41E3A' }}>
                + Create Campaign
              </Link>
            </>
          ) : (
            <>
              <div className="dash-stat">{pubOpps}</div>
              <div className="dash-sub">Campaigns running</div>
              <div className="dash-bar-track">
                <div className="dash-bar-fill" style={{ width: `${Math.min(pubOpps * 20, 100)}%` }} />
              </div>
              <div className="dash-sub">
                {totalAppsCount > 0 && `${totalAppsCount} applicants`}
                {totalAppsCount > 0 && totalViewsCount > 0 && ' · '}
                {totalViewsCount > 0 && `${totalViewsCount} views`}
                {totalAppsCount === 0 && totalViewsCount === 0 && 'Awaiting applicants'}
              </div>
            </>
          )}
        </div>

        {/* ── Panel 2: Deal Readiness ── */}
        <div className="dash-card">
          <div className="dash-label">Deal Readiness</div>
          <div className="flex gap-5 items-center mt-1 flex-wrap">
            <ReadinessRing pct={dealScore} />
            <div className="grid grid-cols-2 gap-2 flex-1 min-w-0" style={{ minWidth: 140 }}>
              <MiniBar label="Profile"   pct={profilePct} />
              <MiniBar label="Campaigns" pct={campaignPct} />
              <MiniBar label="Pipeline"  pct={pipelinePct} />
              <MiniBar label="Billing"   pct={billingPct} />
            </div>
          </div>
        </div>

        {/* ── Panel 3: Actions Due ── */}
        <div className="dash-card">
          <div className="dash-label">Actions Due</div>
          {totalActions === 0 ? (
            <>
              <div className="dash-stat" style={{ color: '#00c060' }}>0</div>
              <div className="dash-sub" style={{ color: '#00c060' }}>All clear</div>
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
                  newApps      > 0 && `${newApps} to review`,
                  awaitingSign > 0 && `${awaitingSign} to sign`,
                  notVerified  > 0 && 'vetting pending',
                  noBilling    > 0 && 'no active plan',
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
              No sponsor activity yet. Launch a campaign to begin.
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

      {/* ── Row 3: Campaign Performance + Talent Pipeline ── */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        <div className="dash-card">
          <div className="dash-label mb-3">Application Pipeline</div>
          <FunnelBar data={funnelData} />
        </div>
        <div className="dash-card">
          <div className="dash-label mb-2">Talent Summary</div>
          {[
            { l: 'Applications',  v: totalApps },
            { l: 'Shortlisted',   v: shortlisted },
            { l: 'Accepted',      v: acceptedApps },
            { l: 'Active Deals',  v: activeC },
          ].map(({ l, v }) => (
            <div key={l} className="flex items-center justify-between py-1.5 border-b border-charcoal-3 last:border-0">
              <span className="font-condensed text-[11px] text-gray-2">{l}</span>
              <span className="font-condensed text-[13px] font-bold text-off-white">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 4: Contract Operations + Billing ── */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="dash-card">
          <div className="dash-label mb-2">Contract Operations</div>
          {[
            { l: 'Awaiting Your Signature', v: awaitingSign, c: awaitingSign > 0 ? '#c9a82c' : '#4a4846' },
            { l: 'Active Contracts',        v: activeC,      c: '#00c060' },
            { l: 'Total Contracts',         v: contracts.length, c: '#f0ece4' },
          ].map(({ l, v, c }) => (
            <div key={l} className="flex items-center justify-between py-1.5 border-b border-charcoal-3 last:border-0">
              <span className="font-condensed text-[11px] text-gray-2">{l}</span>
              <span className="font-condensed text-[13px] font-bold" style={{ color: c }}>{v}</span>
            </div>
          ))}
          {awaitingSign > 0 && (
            <Link to="/contracts"
              className="font-condensed font-bold uppercase text-[10px] tracking-[0.2em] mt-2 inline-block no-underline"
              style={{ color: '#C41E3A' }}>
              Review Contracts →
            </Link>
          )}
        </div>

        <div className="dash-card">
          <div className="dash-label mb-2">Billing & Spend</div>
          {billing?.membership ? (
            <div className="flex items-center gap-2 py-1.5 border-b border-charcoal-3">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#00c060', boxShadow: '0 0 5px #00c06055' }} />
              <span className="font-condensed text-[12px] font-bold text-off-white flex-1">
                {billing.membership.packages?.name ?? 'Active Plan'}
              </span>
              <span className="badge badge-green">Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-1.5 border-b border-charcoal-3">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#c9a82c' }} />
              <span className="font-condensed text-[12px] text-gray-2 flex-1">No active plan</span>
            </div>
          )}
          <div className="flex items-center justify-between py-1.5">
            <span className="font-condensed text-[11px] text-gray-2">Total Spend</span>
            <span className="font-condensed text-[13px] font-bold"
              style={{ color: totalSpent > 0 ? '#f0ece4' : '#4a4846' }}>
              {spentDisplay}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
