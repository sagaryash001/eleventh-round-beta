import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../../hooks/useApi'
import { getMyOpportunities, getSponsorMatches, recomputeMatches, updateMatchStatus, type Opportunity } from '../../../lib/api/opportunities'
import { DashSkeleton, ApiError, EmptyState } from '../DashWidgets'
import { FunnelBar } from '../admin/AdminCharts'
import { SubNav } from '../admin/AdminUtils'
import type { SponsorProfile } from '../../../lib/api/sponsors'

const TABS = [
  { id: 'applicants',   label: 'Applicants'    },
  { id: 'sponsorforge', label: 'SponsorForge'  },
]

const STATUS_COLOR: Record<string, string> = {
  applied: '#7a7672', under_review: '#C41E3A', shortlisted: '#f5a623',
  accepted: '#00c060', rejected: '#4a4846', withdrawn: '#4a4846',
}
const STATUS_LABEL: Record<string, string> = {
  applied: 'New', under_review: 'In Review', shortlisted: 'Shortlisted',
  accepted: 'Accepted', rejected: 'Rejected', withdrawn: 'Withdrawn',
}

function Spinner() {
  return <span className="inline-block w-3 h-3 border border-off-white/40 border-t-off-white rounded-full animate-spin" />
}

// ── Applicants overview ───────────────────────────────────────────────────────
function ApplicantsOverview() {
  const { data: mkt, loading, error } = useApi<any>('/api/sponsor/marketplace')
  const [opps, setOpps] = useState<Opportunity[]>([])

  useEffect(() => {
    getMyOpportunities()
      .then(d => setOpps(d.data ?? []))
      .catch(() => {})
  }, [])

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const byStatus   = mkt?.applications_by_status ?? {}
  const totalApps  = mkt?.total_applications     ?? 0
  const funnelData = Object.entries(byStatus).map(([s, c]) => ({
    label: s.replace(/_/g, ' '), value: c as number,
  }))

  if (totalApps === 0) return (
    <EmptyState icon="○" title="No Applications Yet"
      body="Applications appear once you publish a campaign and fighters apply. Review and manage them here." />
  )

  return (
    <div className="space-y-5">
      {/* Status summary */}
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        {Object.entries(byStatus).map(([s, c]) => (
          <div key={s} className="bg-charcoal-2 border border-charcoal-3 px-3 py-2.5 text-center"
            style={{ borderTop: `2px solid ${STATUS_COLOR[s] ?? '#8b0000'}` }}>
            <div className="font-condensed text-[9px] font-bold uppercase tracking-[0.25em] text-gray-3 mb-1">
              {STATUS_LABEL[s] ?? s}
            </div>
            <div className="font-display text-off-white" style={{ fontSize: 22, lineHeight: 1 }}>{c as number}</div>
          </div>
        ))}
      </div>

      {/* Funnel chart */}
      <div className="dash-card">
        <div className="dash-label mb-3">Application Pipeline</div>
        <FunnelBar data={funnelData} color="#C41E3A" />
      </div>

      {/* Campaigns with applicants */}
      <div className="space-y-2">
        <div className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase text-gray-3 mb-2">
          Manage by Campaign
        </div>
        {opps.filter(o => (o.application_count ?? 0) > 0 || o.status === 'published').map(o => (
          <div key={o.id} className="dash-card flex items-center gap-4"
            style={{ borderLeft: `2px solid ${o.status === 'published' ? '#00c060' : '#4a4846'}` }}>
            <div className="flex-1 min-w-0">
              <div className="font-condensed font-bold text-off-white text-[13px] truncate">{o.title}</div>
              <div className="font-condensed text-[11px] text-gray-3 mt-0.5">
                {o.application_count ?? 0} applicants · {o.status}
              </div>
            </div>
            <Link to={`/sponsor/opportunities/${o.id}/applicants`}
              className="font-condensed font-bold uppercase text-[9px] tracking-[0.15em] px-3 py-1.5 border border-charcoal-3 text-gray-2 no-underline hover:border-blood hover:text-off-white transition-all flex-shrink-0">
              Review →
            </Link>
          </div>
        ))}
        {opps.filter(o => (o.application_count ?? 0) === 0 && o.status !== 'published').length > 0 && (
          <div className="font-condensed text-[10px] text-gray-3 text-center py-2">
            + {opps.filter(o => (o.application_count ?? 0) === 0 && o.status !== 'published').length} draft/closed campaign{opps.filter(o => (o.application_count ?? 0) === 0 && o.status !== 'published').length > 1 ? 's' : ''} with no applicants
          </div>
        )}
      </div>
    </div>
  )
}

// ── SponsorForge view ─────────────────────────────────────────────────────────
function SponsorForgeView({ sp }: { sp: SponsorProfile }) {
  const [opps, setOpps]         = useState<Opportunity[]>([])
  const [loading, setLoading]   = useState(true)
  const [expandedOpp, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    getMyOpportunities()
      .then(d => { setOpps(d.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const publishedOpps = opps.filter(o => o.status === 'published')

  if (loading) return <DashSkeleton />

  if (!sp.is_verified) return (
    <div className="dash-card" style={{ borderLeft: '3px solid #c9a82c' }}>
      <div className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase mb-2" style={{ color: '#c9a82c' }}>
        Vetting Required
      </div>
      <p className="font-condensed text-[12px] text-gray-2" style={{ lineHeight: 1.6, maxWidth: 480 }}>
        SponsorForge match engine activates once your sponsor profile is verified by the admin team.
        This usually takes 24–48 hours.
      </p>
    </div>
  )

  if (!publishedOpps.length) return (
    <EmptyState icon="○" title="No Published Campaigns"
      body="SponsorForge matches fighters to your live campaigns. Publish a campaign to start seeing recommendations."
      action={<Link to="/sponsor/opportunities/new" className="btn-primary text-[11px] py-2 px-5 no-underline">Create Campaign</Link>} />
  )

  return (
    <div className="space-y-4">
      <div className="dash-card" style={{ borderLeft: '3px solid #C41E3A' }}>
        <div className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase mb-1.5" style={{ color: '#C41E3A' }}>
          SponsorForge — V1 Match Engine
        </div>
        <p className="font-condensed text-[11px] text-gray-2" style={{ lineHeight: 1.6 }}>
          Fighters are scored against your campaigns using readiness, brand fit, audience, location, availability, and content criteria.
          Select a campaign to view and manage your matches.
        </p>
      </div>

      {publishedOpps.map(o => (
        <MatchPanel key={o.id} opportunity={o} isExpanded={expandedOpp === o.id} onToggle={() => setExpanded(expandedOpp === o.id ? null : o.id)} />
      ))}
    </div>
  )
}

function MatchPanel({ opportunity, isExpanded, onToggle }: {
  opportunity: Opportunity
  isExpanded: boolean
  onToggle: () => void
}) {
  const [matches,   setMatches]   = useState<any[]>([])
  const [loading,   setLoading]   = useState(false)
  const [computing, setComputing] = useState(false)
  const [computeMsg, setComputeMsg] = useState('')
  const [dismissing, setDismissing] = useState<string | null>(null)

  const loadMatches = useCallback(() => {
    setLoading(true)
    getSponsorMatches(opportunity.id)
      .then(d => { setMatches(d.matches ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [opportunity.id])

  useEffect(() => {
    if (isExpanded) loadMatches()
  }, [isExpanded, loadMatches])

  const compute = async () => {
    setComputing(true); setComputeMsg('')
    try {
      const r = await recomputeMatches(opportunity.id)
      setComputeMsg(`${r.computed} match${r.computed !== 1 ? 'es' : ''} computed.`)
      loadMatches()
    } catch (e: any) { setComputeMsg(e.message ?? 'Compute failed.') }
    finally { setComputing(false) }
  }

  const dismiss = async (matchId: string) => {
    setDismissing(matchId)
    try {
      await updateMatchStatus(matchId, 'dismissed')
      setMatches(prev => prev.filter(m => m.id !== matchId))
    } catch {}
    setDismissing(null)
  }

  const shortScore = (m: any) => Math.round(m.total_score ?? m.score ?? 0)

  return (
    <div className="dash-card space-y-0" style={{ borderLeft: '2px solid #00c060' }}>
      <button onClick={onToggle}
        className="w-full flex items-center justify-between bg-transparent border-0 cursor-pointer text-left py-0">
        <div>
          <div className="font-condensed font-bold text-off-white text-[13px]">{opportunity.title}</div>
          <div className="font-condensed text-[10px] text-gray-3 mt-0.5">
            {opportunity.application_count ?? 0} applicants
          </div>
        </div>
        <div className="flex items-center gap-3">
          {computeMsg && <span className="font-condensed text-[10px] text-green-400">{computeMsg}</span>}
          <button onClick={e => { e.stopPropagation(); compute() }} disabled={computing}
            className="font-condensed uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border border-charcoal-3 text-gray-3 cursor-pointer hover:border-blood hover:text-off-white transition-all disabled:opacity-40">
            {computing ? '↻…' : '↻ Compute'}
          </button>
          <span className="font-condensed text-[10px] text-gray-3">{isExpanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-charcoal-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : !matches.length ? (
            <div className="font-condensed text-[11px] text-gray-3 py-2">
              No matches yet — click Compute to generate recommendations.
            </div>
          ) : (
            matches.map(m => (
              <div key={m.id} className="flex items-center gap-3 py-2 border-b border-charcoal-3 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="font-condensed text-[12px] font-bold text-off-white">{m.fighter?.name ?? 'Fighter'}</div>
                  <div className="font-condensed text-[10px] text-gray-3">
                    {m.fighter?.weight_class ?? ''} {m.fighter?.location ? `· ${m.fighter.location}` : ''}
                  </div>
                </div>
                <div className="text-center flex-shrink-0">
                  <div className="font-display" style={{ fontSize: 20, color: shortScore(m) >= 70 ? '#00c060' : shortScore(m) >= 40 ? '#c9a82c' : '#C41E3A' }}>
                    {shortScore(m)}
                  </div>
                  <div className="font-condensed text-[9px] text-gray-3 uppercase">Score</div>
                </div>
                <Link to={`/sponsor/opportunities/${opportunity.id}/applicants`}
                  className="font-condensed text-[9px] uppercase tracking-widest px-2.5 py-1.5 border border-charcoal-3 text-gray-2 no-underline hover:border-blood hover:text-off-white transition-all flex-shrink-0">
                  View
                </Link>
                <button onClick={() => dismiss(m.id)} disabled={dismissing === m.id}
                  className="font-condensed text-[9px] uppercase tracking-widest px-2.5 py-1.5 border border-charcoal-3 text-gray-3 cursor-pointer hover:border-blood hover:text-blood-glow transition-all disabled:opacity-40 flex-shrink-0">
                  {dismissing === m.id ? '…' : 'Dismiss'}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Zone export ───────────────────────────────────────────────────────────────
export default function TalentPipeline({ sp }: { sp: SponsorProfile }) {
  const [sub, setSub] = useState('applicants')
  return (
    <div>
      <SubNav tabs={TABS} active={sub} onChange={setSub} />
      {sub === 'applicants'   && <ApplicantsOverview />}
      {sub === 'sponsorforge' && <SponsorForgeView sp={sp} />}
    </div>
  )
}
