import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import { getOpportunities, type Opportunity } from '../../lib/api/opportunities'

const CAMPAIGN_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'brand_ambassador', label: 'Brand Ambassador' },
  { value: 'single_event',     label: 'Single Event' },
  { value: 'one_off_post',     label: 'One-Off Post' },
  { value: 'seasonal',         label: 'Seasonal' },
  { value: 'annual',           label: 'Annual' },
  { value: 'appearance',       label: 'Appearance' },
]

function OppCard({ opp }: { opp: Opportunity }) {
  const company = opp.sponsor_detail?.company_name ?? opp.sponsor?.name ?? 'Sponsor'
  const budget  = opp.budget_max_usd
    ? `$${(opp.budget_min_usd ?? 0).toLocaleString()}–$${opp.budget_max_usd.toLocaleString()}`
    : opp.budget_min_usd ? `From $${opp.budget_min_usd.toLocaleString()}` : 'Budget TBD'

  const deadline = opp.application_deadline
    ? new Date(opp.application_deadline)
    : null
  const daysLeft = deadline
    ? Math.ceil((deadline.getTime() - Date.now()) / 86400000)
    : null

  return (
    <Link to={`/opportunities/${opp.id}`} className="no-underline block group">
      <div className="bg-charcoal border border-charcoal-3 p-6 transition-all duration-200 relative overflow-hidden"
        style={{ borderLeft: '2px solid transparent' }}
        onMouseEnter={e => (e.currentTarget.style.borderLeftColor = '#8b0000')}
        onMouseLeave={e => (e.currentTarget.style.borderLeftColor = 'transparent')}>

        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'radial-gradient(ellipse at 0% 50%, rgba(139,0,0,0.04) 0%, transparent 60%)' }} />

        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-condensed font-bold uppercase text-[10px] tracking-[0.3em] text-blood-glow mb-1">
              {company}{opp.sponsor_detail?.is_verified && ' ✓'}
            </div>
            <h3 className="font-condensed font-bold text-off-white text-[17px] leading-snug">{opp.title}</h3>
          </div>
          {opp.campaign_type && (
            <span className="font-condensed uppercase text-[9px] tracking-[0.25em] text-gray-3 border border-charcoal-3 px-2.5 py-1 ml-4 flex-shrink-0">
              {opp.campaign_type.replace(/_/g, ' ')}
            </span>
          )}
        </div>

        {opp.description && (
          <p className="font-narrow text-gray-2 text-[13px] leading-relaxed mb-4 line-clamp-2">
            {opp.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 font-condensed text-[12px]">
            <span className="text-off-white font-semibold">{budget}</span>
            {opp.location_country && (
              <span className="text-gray-3">{opp.location_country}</span>
            )}
            {(opp.requirements as any)?.weight_classes?.length > 0 && (
              <span className="text-gray-3">
                {(opp.requirements as any).weight_classes.slice(0, 2).join(', ')}
              </span>
            )}
          </div>
          <div className="font-condensed text-[11px]" style={{
            color: daysLeft !== null && daysLeft <= 3 ? '#C41E3A' : '#7a7672',
          }}>
            {daysLeft === null ? 'Open' : daysLeft <= 0 ? 'Closed' : `${daysLeft}d left`}
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function DiscoveryPage() {
  const [opps, setOpps]     = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [campaignType, setCampaignType] = useState('')
  const [budgetMax, setBudgetMax]       = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (search)      params.search      = search
      if (campaignType) params.campaign_type = campaignType
      if (budgetMax)   params.budget_max  = budgetMax
      const res = await getOpportunities(Object.keys(params).length ? params : undefined)
      setOpps(res.data ?? [])
    } catch { setOpps([]) }
    finally { setLoading(false) }
  }, [search, campaignType, budgetMax])

  useEffect(() => { void load() }, [load])

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />

      <div className="flex-1 px-6 py-20 max-w-6xl mx-auto w-full">

        {/* Header */}
        <div className="mb-10">
          <div className="sec-label mb-2">SponsorForge</div>
          <h1 className="font-display text-off-white uppercase mb-4"
            style={{ fontSize: 'clamp(36px,5vw,72px)', lineHeight: 0.9 }}>
            Sponsorship<br />
            <span className="text-blood-glow">Opportunities</span>
          </h1>
          <p className="font-narrow text-gray-2" style={{ fontSize: 14, maxWidth: 520 }}>
            Browse active sponsorships from brands across combat sports.
            Apply directly — no middlemen.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Search opportunities…"
            className="bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[14px] px-4 py-2.5 outline-none focus:border-blood-glow flex-1 min-w-[220px]"
          />
          <select value={campaignType} onChange={e => setCampaignType(e.target.value)}
            className="bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[14px] px-4 py-2.5 outline-none focus:border-blood-glow">
            {CAMPAIGN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={budgetMax} onChange={e => setBudgetMax(e.target.value)}
            className="bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[14px] px-4 py-2.5 outline-none focus:border-blood-glow">
            <option value="">Any Budget</option>
            <option value="5000">Under $5k</option>
            <option value="25000">Under $25k</option>
            <option value="100000">Under $100k</option>
          </select>
          <button onClick={load} className="btn-primary py-2.5 px-6">Search</button>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-2 border-charcoal-3 border-t-blood-glow rounded-full animate-spin" />
          </div>
        ) : opps.length === 0 ? (
          <div className="text-center py-24">
            <p className="font-condensed font-bold uppercase text-[10px] tracking-[0.35em] text-gray-3 mb-3">No Results</p>
            <p className="font-narrow text-gray-2 text-[14px]">No opportunities match your filters. Try broadening your search.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="font-condensed text-gray-3 text-[11px] tracking-[0.2em] uppercase mb-5">
              {opps.length} opportunit{opps.length === 1 ? 'y' : 'ies'}
            </p>
            {opps.map(o => <OppCard key={o.id} opp={o} />)}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
