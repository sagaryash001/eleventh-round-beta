import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../../hooks/useApi'
import { getBillingStatus } from '../../../lib/api/billing'
import { getContracts } from '../../../lib/api/contracts'
import { DashSkeleton, ApiError, EmptyState } from '../DashWidgets'
import { FunnelBar, StatusPie } from '../admin/AdminCharts'
import type { SponsorProfile } from '../../../lib/api/sponsors'

export default function Overview({ sp }: { sp: SponsorProfile }) {
  const { data: mkt, loading: mktLoad, error: mktErr } = useApi<any>('/api/sponsor/marketplace')
  const [billing, setBilling]   = useState<any>(null)
  const [contracts, setContracts] = useState<any[]>([])

  useEffect(() => {
    getBillingStatus()
      .then(r => setBilling(r))
      .catch(() => {})
    getContracts()
      .then(r => setContracts(r.contracts ?? []))
      .catch(() => {})
  }, [])

  if (mktLoad) return <DashSkeleton />
  if (mktErr)  return <ApiError message={mktErr} />

  const totalOpps    = mkt?.total_opportunities     ?? 0
  const pubOpps      = mkt?.published_opportunities ?? 0
  const totalApps    = mkt?.total_applications      ?? 0
  const acceptedApps = mkt?.accepted_applications   ?? 0
  const activeC      = mkt?.active_contracts        ?? 0
  const totalC       = mkt?.total_contracts         ?? 0
  const totalSpent   = mkt?.total_spent_usd         ?? 0
  const byStatus     = mkt?.applications_by_status  ?? {}

  const awaitingSignature = contracts.filter(c => c.status === 'draft').length
  const newApps           = byStatus.applied ?? 0
  const shortlisted       = byStatus.shortlisted ?? 0
  const spentDisplay      = totalSpent >= 1000 ? `$${(totalSpent / 1000).toFixed(1)}K` : totalSpent > 0 ? `$${totalSpent}` : '$—'

  const actionItems: { text: string; urgency: 'red' | 'yellow'; href: string }[] = []
  if (!sp.is_verified)
    actionItems.push({ text: 'Sponsor profile pending admin vetting — campaigns cannot be published yet', urgency: 'yellow', href: '#billing' })
  if (!billing?.membership)
    actionItems.push({ text: 'No active plan — choose a package to unlock platform features', urgency: 'yellow', href: '#billing' })
  if (newApps > 0)
    actionItems.push({ text: `${newApps} new application${newApps > 1 ? 's' : ''} waiting for review`, urgency: 'red', href: '/sponsor/opportunities' })
  if (awaitingSignature > 0)
    actionItems.push({ text: `${awaitingSignature} contract${awaitingSignature > 1 ? 's' : ''} awaiting your signature`, urgency: 'red', href: '/contracts' })

  const funnelData = Object.entries(byStatus).map(([s, c]) => ({
    label: s.replace(/_/g, ' '), value: c as number,
  }))

  const campaignStatusData = [
    { name: 'Published', value: pubOpps,                              color: '#00c060' },
    { name: 'Draft',     value: Math.max(0, totalOpps - pubOpps),     color: '#c9a82c' },
    { name: 'Contracts', value: activeC,                              color: '#C41E3A' },
  ]

  return (
    <div className="space-y-5">

      {/* Vital strip */}
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(6,1fr)' }}>
        {[
          { label: 'Live Campaigns', value: pubOpps,      accent: '#00c060' },
          { label: 'Applications',   value: totalApps,    accent: newApps > 0 ? '#c00000' : '#8b0000' },
          { label: 'Shortlisted',    value: shortlisted,  accent: '#8b0000' },
          { label: 'Accepted',       value: acceptedApps, accent: '#8b0000' },
          { label: 'Contracts',      value: activeC,      accent: '#00c060' },
          { label: 'Spend',          value: spentDisplay, accent: '#8b0000' },
        ].map(({ label, value, accent }) => (
          <div key={label} className="bg-charcoal-2 border border-charcoal-3 px-3 py-3 text-center"
            style={{ borderTop: `2px solid ${accent}` }}>
            <div className="font-condensed text-[9px] font-bold uppercase tracking-[0.3em] text-gray-3 mb-1">{label}</div>
            <div className="font-display text-off-white" style={{ fontSize: 24, lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Main operational row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>

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
              <span className="font-condensed text-[12px] text-gray-2">All clear — no pending actions</span>
            </div>
          ) : (
            <ul>
              {actionItems.map((item, i) => (
                <li key={i} className="flex items-center gap-2.5 py-2 border-b border-charcoal-3 last:border-0">
                  <span className="w-1.5 h-1.5 rounded-sm flex-shrink-0"
                    style={{ background: item.urgency === 'red' ? '#c00000' : '#c9a82c' }} />
                  <span className="font-condensed text-[11px] text-gray-1 flex-1">{item.text}</span>
                  <span className={`badge ${item.urgency === 'red' ? 'badge-red' : 'badge-yellow'} flex-shrink-0`}>
                    {item.urgency === 'red' ? 'Urgent' : 'Review'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Performance snapshot */}
        <div className="space-y-3">
          <div className="dash-card">
            <div className="dash-label">Campaign Performance</div>
            <div className="flex gap-5 mt-1">
              <div>
                <div className="font-display text-off-white" style={{ fontSize: 26, lineHeight: 1 }}>{pubOpps}</div>
                <div className="dash-sub">Live campaigns</div>
              </div>
              <div>
                <div className="font-display text-off-white" style={{ fontSize: 26, lineHeight: 1 }}>{totalApps}</div>
                <div className="dash-sub">Total applicants</div>
              </div>
              <div>
                <div className="font-display text-off-white" style={{ fontSize: 26, lineHeight: 1 }}>{totalC}</div>
                <div className="dash-sub">Contracts</div>
              </div>
            </div>
          </div>
          <div className="dash-card">
            <div className="dash-label">Billing Status</div>
            {billing?.membership ? (
              <div className="flex items-center gap-3 mt-1">
                <span className="w-2 h-2 rounded-full" style={{ background: '#00c060', boxShadow: '0 0 5px #00c06055' }} />
                <div>
                  <div className="font-condensed text-[13px] font-bold text-off-white">{billing.membership.packages?.name ?? 'Active Plan'}</div>
                  <div className="dash-sub capitalize">{billing.membership.status}</div>
                </div>
              </div>
            ) : (
              <div className="mt-1">
                <span className="font-condensed text-[12px] text-gray-3">No active plan — go to </span>
                <span className="font-condensed text-[12px] text-off-white">Company &amp; Billing</span>
                <span className="font-condensed text-[12px] text-gray-3"> to choose a package.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts */}
      {(totalApps > 0 || totalOpps > 0) ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
          <div className="dash-card">
            <div className="dash-label mb-3">Applications Pipeline</div>
            <FunnelBar data={funnelData} />
          </div>
          <div className="dash-card">
            <div className="dash-label mb-3">Campaign Overview</div>
            <StatusPie data={campaignStatusData} />
          </div>
        </div>
      ) : (
        <div className="dash-card" style={{ borderStyle: 'dashed' }}>
          <div className="flex flex-col items-center py-4 gap-2">
            <div className="font-condensed text-[9px] uppercase tracking-[0.3em] text-gray-3">No Activity Yet</div>
            <p className="font-condensed text-[12px] text-gray-3" style={{ maxWidth: 360, textAlign: 'center', lineHeight: 1.6 }}>
              {sp.is_verified
                ? 'Publish a campaign and start receiving applications to see analytics here.'
                : 'Complete admin vetting to publish campaigns. Prepare your campaigns in the meantime.'}
            </p>
            <Link to="/sponsor/opportunities/new" className="btn-primary text-[11px] py-2 px-5 no-underline mt-2">
              Create Campaign
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
