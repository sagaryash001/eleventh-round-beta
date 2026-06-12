import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import { getOpportunity, type Opportunity } from '../../lib/api/opportunities'
import { applyToOpportunity } from '../../lib/api/applications'
import { useAuth } from '../../hooks/useAuth'

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-condensed uppercase text-[10px] tracking-[0.25em] border border-charcoal-3 text-gray-2 px-2.5 py-1 inline-block">
      {children}
    </span>
  )
}

export default function OpportunityDetailPage() {
  const { id }  = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [opp, setOpp]       = useState<Opportunity | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied]   = useState(false)
  const [msg, setMsg]           = useState('')
  const [cover, setCover]       = useState('')
  const [showApply, setShowApply] = useState(false)

  useEffect(() => {
    if (!id) return
    getOpportunity(id)
      .then(r => { setOpp(r.opportunity); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  const handleApply = async () => {
    if (!user) { navigate('/login'); return }
    if (user.role !== 'fighter') { setMsg('Only fighters can apply.'); return }
    setApplying(true); setMsg('')
    try {
      await applyToOpportunity(id!, cover.trim() || undefined)
      setApplied(true); setShowApply(false)
      setMsg('Application submitted!')
    } catch (e: any) {
      setMsg(e.message ?? 'Could not apply.')
    } finally { setApplying(false) }
  }

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-charcoal-3 border-t-blood-glow rounded-full animate-spin" />
    </div>
  )

  if (!opp) return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center">
        <p className="font-condensed text-gray-3 uppercase tracking-widest">Opportunity not found.</p>
      </div>
    </div>
  )

  const company  = opp.sponsor_detail?.company_name ?? opp.sponsor?.name ?? 'Sponsor'
  const budget   = opp.budget_max_usd
    ? `$${(opp.budget_min_usd ?? 0).toLocaleString()}–$${opp.budget_max_usd.toLocaleString()}`
    : opp.budget_min_usd ? `From $${opp.budget_min_usd.toLocaleString()}` : 'Budget TBD'
  const deadline = opp.application_deadline ? new Date(opp.application_deadline) : null
  const daysLeft = deadline ? Math.ceil((deadline.getTime() - Date.now()) / 86400000) : null
  const delivs   = (opp.deliverables as any[]) ?? []
  const reqs     = (opp.requirements as Record<string, any>) ?? {}

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />

      <div className="flex-1 px-6 py-20 max-w-4xl mx-auto w-full">

        {/* Breadcrumb */}
        <Link to="/opportunities" className="font-condensed text-[11px] uppercase tracking-[0.25em] text-gray-3 hover:text-off-white no-underline mb-8 inline-block">
          ← All Opportunities
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="font-condensed font-bold uppercase text-[10px] tracking-[0.3em] text-blood-glow">
              {company}
            </span>
            {opp.sponsor_detail?.is_verified && (
              <span className="font-condensed text-[9px] tracking-[0.2em] uppercase border border-charcoal-3 text-gray-3 px-2 py-0.5">Verified</span>
            )}
          </div>
          <h1 className="font-display text-off-white uppercase mb-4"
            style={{ fontSize: 'clamp(30px,4.5vw,60px)', lineHeight: 0.92 }}>
            {opp.title}
          </h1>

          <div className="flex flex-wrap gap-2 mb-6">
            {opp.campaign_type && <Pill>{opp.campaign_type.replace(/_/g, ' ')}</Pill>}
            {opp.location_country && <Pill>{opp.location_country}{opp.location_region ? ` / ${opp.location_region}` : ''}</Pill>}
            {daysLeft !== null && (
              <span className="font-condensed uppercase text-[10px] tracking-[0.25em] border border-charcoal-3 px-2.5 py-1 inline-block"
                style={{ color: daysLeft <= 3 ? '#C41E3A' : '#7a7672' }}>
                {daysLeft <= 0 ? 'Deadline passed' : `${daysLeft} days to apply`}
              </span>
            )}
          </div>

          {/* Budget + apply */}
          <div className="bg-charcoal border border-charcoal-3 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            style={{ borderLeft: '2px solid #8b0000' }}>
            <div>
              <div className="font-condensed text-[10px] tracking-[0.3em] uppercase text-gray-3 mb-1">Budget</div>
              <div className="font-display text-off-white text-[28px]">{budget}</div>
              {opp.max_fighters && opp.max_fighters > 1 && (
                <div className="font-condensed text-[11px] text-gray-3 mt-1">Up to {opp.max_fighters} fighters</div>
              )}
            </div>
            {!applied && user?.role === 'fighter' && (
              <button onClick={() => setShowApply(v => !v)} className="btn-primary">
                {showApply ? 'Cancel' : 'Apply Now'}
              </button>
            )}
            {!user && (
              <Link to="/register" className="btn-primary no-underline text-center">
                Sign Up to Apply
              </Link>
            )}
            {applied && (
              <div className="font-condensed font-bold uppercase text-[11px] tracking-[0.2em] text-blood-glow">
                ✓ Applied
              </div>
            )}
          </div>
        </div>

        {/* Apply form */}
        {showApply && (
          <div className="bg-charcoal border border-charcoal-3 p-6 mb-6" style={{ borderLeft: '2px solid #8b0000' }}>
            <div className="font-condensed font-bold uppercase text-[10px] tracking-[0.3em] text-gray-3 mb-3">Cover Message (optional)</div>
            <textarea value={cover} onChange={e => setCover(e.target.value)} rows={4}
              placeholder="Tell the sponsor why you're a great fit…"
              className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[14px] px-4 py-3 outline-none resize-none focus:border-blood mb-4" />
            <button onClick={handleApply} disabled={applying} className="btn-primary">
              {applying ? 'Submitting…' : 'Submit Application'}
            </button>
          </div>
        )}

        {msg && <p className="font-condensed text-[12px] text-blood-glow mb-6">{msg}</p>}

        {/* Description */}
        {opp.description && (
          <div className="mb-8">
            <h2 className="font-condensed font-bold uppercase text-[10px] tracking-[0.35em] text-gray-3 mb-3">About This Opportunity</h2>
            <div className="bg-charcoal border border-charcoal-3 p-6">
              <p className="font-narrow text-gray-1 text-[14px] leading-relaxed whitespace-pre-wrap">{opp.description}</p>
            </div>
          </div>
        )}

        {/* Deliverables */}
        {delivs.length > 0 && (
          <div className="mb-8">
            <h2 className="font-condensed font-bold uppercase text-[10px] tracking-[0.35em] text-gray-3 mb-3">Deliverables</h2>
            <div className="bg-charcoal border border-charcoal-3 p-6 space-y-3">
              {delivs.map((d: any, i: number) => (
                <div key={i} className="flex items-start gap-4">
                  <span className="font-condensed font-bold text-blood-glow text-[12px] min-w-[20px]">{i + 1}</span>
                  <div>
                    <div className="font-condensed font-semibold text-off-white text-[13px]">
                      {d.type?.replace(/_/g, ' ') ?? 'Deliverable'}{d.count && d.count > 1 ? ` × ${d.count}` : ''}
                    </div>
                    {d.notes && <div className="font-narrow text-gray-2 text-[12px] mt-0.5">{d.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Requirements */}
        {Object.keys(reqs).length > 0 && (
          <div className="mb-8">
            <h2 className="font-condensed font-bold uppercase text-[10px] tracking-[0.35em] text-gray-3 mb-3">Requirements</h2>
            <div className="bg-charcoal border border-charcoal-3 p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 font-condensed text-[13px]">
              {reqs.min_followers && <div><span className="text-gray-3">Min Followers</span><div className="text-off-white">{Number(reqs.min_followers).toLocaleString()}</div></div>}
              {reqs.weight_classes?.length > 0 && <div><span className="text-gray-3">Weight Classes</span><div className="text-off-white">{reqs.weight_classes.join(', ')}</div></div>}
              {reqs.promotions?.length > 0 && <div><span className="text-gray-3">Promotions</span><div className="text-off-white">{reqs.promotions.join(', ')}</div></div>}
              {reqs.status_in?.length > 0 && <div><span className="text-gray-3">Fighter Status</span><div className="text-off-white capitalize">{reqs.status_in.join(', ')}</div></div>}
            </div>
          </div>
        )}

        {/* Timeline */}
        {(opp.campaign_start || opp.campaign_end || opp.application_deadline) && (
          <div className="mb-8">
            <h2 className="font-condensed font-bold uppercase text-[10px] tracking-[0.35em] text-gray-3 mb-3">Timeline</h2>
            <div className="bg-charcoal border border-charcoal-3 p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 font-condensed text-[13px]">
              {opp.application_deadline && <div><span className="text-gray-3 block">Application Deadline</span><span className="text-off-white">{new Date(opp.application_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>}
              {opp.campaign_start && <div><span className="text-gray-3 block">Campaign Start</span><span className="text-off-white">{new Date(opp.campaign_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>}
              {opp.campaign_end && <div><span className="text-gray-3 block">Campaign End</span><span className="text-off-white">{new Date(opp.campaign_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
