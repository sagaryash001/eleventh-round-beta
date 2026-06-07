import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { getOppApplications, getSponsorMatches, recomputeMatches, updateMatchStatus } from '../../lib/api/opportunities'
import { updateApplicationStatus, type Application } from '../../lib/api/applications'

const STATUS_LABEL: Record<string, string> = {
  applied: 'New', under_review: 'In Review', shortlisted: 'Shortlisted',
  accepted: 'Accepted', rejected: 'Rejected', withdrawn: 'Withdrawn',
}
const STATUS_COLOR: Record<string, string> = {
  applied: '#7a7672', under_review: '#C41E3A', shortlisted: '#f5a623',
  accepted: '#00c060', rejected: '#4a4846', withdrawn: '#4a4846',
}

function Spinner() {
  return <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
}

// ── Score bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  const color = pct >= 70 ? '#00c060' : pct >= 40 ? '#c9a82c' : '#c00000'
  return (
    <div className="flex items-center gap-2 text-[11px] font-condensed">
      <span className="text-gray-3 w-20 flex-shrink-0">{label}</span>
      <div style={{ flex: 1, height: 4, background: '#222226', borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s' }} />
      </div>
      <span className="text-gray-2 w-7 text-right">{value}</span>
    </div>
  )
}

// ── Matches view ──────────────────────────────────────────────────────────────
function MatchesView({ opportunityId }: { opportunityId: string }) {
  const [matches, setMatches]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [computing, setComputing] = useState(false)
  const [dismissing, setDismissing] = useState<string|null>(null)
  const [expandId, setExpandId] = useState<string|null>(null)
  const [computeMsg, setComputeMsg] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    getSponsorMatches(opportunityId)
      .then(d => { setMatches(d.matches ?? []); setLoading(false) })
      .catch(e => { setError(e.message ?? 'Failed to load matches.'); setLoading(false) })
  }, [opportunityId])

  useEffect(() => { load() }, [load])

  const compute = async () => {
    setComputing(true); setComputeMsg('')
    try {
      const r = await recomputeMatches(opportunityId)
      setComputeMsg(`Computed ${r.computed} match${r.computed !== 1 ? 'es' : ''}.`)
      load()
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

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-charcoal-3 border-t-blood-glow rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="py-8 text-center">
      <p className="font-condensed text-blood-glow text-[13px] mb-4">{error}</p>
      <button onClick={load} className="btn-ghost text-[12px] py-2 px-4">Retry</button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="font-condensed text-gray-3 text-[11px]">
            {matches.length > 0 ? `${matches.length} ranked fighters` : 'No matches computed yet'}
          </p>
          {computeMsg && <p className="font-condensed text-[11px] text-gray-2 mt-1">{computeMsg}</p>}
        </div>
        <button onClick={compute} disabled={computing}
          className="btn-ghost text-[11px] py-2 px-4 disabled:opacity-50">
          {computing ? <><Spinner /> Computing…</> : '↻ Recompute Matches'}
        </button>
      </div>

      {!matches.length ? (
        <div className="text-center py-16 bg-charcoal border border-charcoal-3" style={{ borderLeft: '2px solid #8b0000' }}>
          <p className="font-condensed font-bold uppercase text-[10px] tracking-[0.35em] text-gray-3 mb-3">No Matches Yet</p>
          <p className="font-narrow text-gray-2 text-[14px] mb-6">
            Click Recompute to rank fighters against this opportunity's requirements.
          </p>
          <button onClick={compute} disabled={computing} className="btn-primary">
            {computing ? 'Computing…' : 'Compute Matches'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((m, i) => {
            const f   = m.fighter ?? {}
            const fd  = m.fighter_detail ?? {}
            const bd  = m.breakdown ?? {}
            const rs  = m.reasons ?? {}
            const exp = expandId === m.id
            const scoreColor = m.score >= 70 ? '#00c060' : m.score >= 45 ? '#c9a82c' : '#c00000'

            return (
              <div key={m.id} className="bg-charcoal border border-charcoal-3 p-5"
                style={{ borderLeft: `2px solid ${scoreColor}` }}>
                <div className="flex items-start justify-between gap-4">
                  {/* Rank + name */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="font-condensed text-[13px] font-bold text-gray-3 w-5 flex-shrink-0">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-0.5">
                        <span className="font-condensed font-bold text-off-white text-[15px]">{f.name ?? 'Fighter'}</span>
                        {m.status === 'invited' && (
                          <span className="font-condensed text-[9px] uppercase tracking-[0.15em] text-blood-glow border border-blood px-1.5 py-0.5">Invited</span>
                        )}
                      </div>
                      <div className="font-condensed text-gray-3 text-[12px] flex gap-3 flex-wrap">
                        {fd.weight_class && <span>{fd.weight_class}</span>}
                        {fd.current_promotion && <span>{fd.current_promotion}</span>}
                        {fd.base_city && <span>{fd.base_city}</span>}
                        {m.total_followers > 0 && <span>{m.total_followers >= 1000 ? `${(m.total_followers / 1000).toFixed(1)}k` : m.total_followers} followers</span>}
                      </div>
                    </div>
                  </div>

                  {/* Score + actions */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="font-display text-off-white leading-none" style={{ fontSize: 28, color: scoreColor }}>{m.score}</div>
                      <div className="font-condensed text-[9px] text-gray-3 uppercase tracking-wider">/ 100</div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button onClick={() => setExpandId(exp ? null : m.id)}
                        className="font-condensed font-bold uppercase text-[9px] tracking-[0.15em] text-gray-2 border border-charcoal-3 px-2.5 py-1.5 bg-transparent cursor-pointer hover:border-blood hover:text-off-white transition-all">
                        {exp ? 'Close' : 'Details'}
                      </button>
                      <button onClick={() => dismiss(m.id)} disabled={dismissing === m.id}
                        className="font-condensed uppercase text-[9px] tracking-[0.1em] text-gray-3 border border-charcoal-3 px-2.5 py-1.5 bg-transparent cursor-pointer hover:border-blood hover:text-blood-glow transition-all disabled:opacity-40">
                        {dismissing === m.id ? <Spinner /> : 'Dismiss'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded: score breakdown + reasons */}
                {exp && (
                  <div className="mt-4 pt-4 border-t border-charcoal-3 grid grid-cols-2 gap-6">
                    <div>
                      <div className="font-condensed text-[10px] font-bold tracking-[0.25em] uppercase text-gray-3 mb-3">Score Breakdown</div>
                      <div className="space-y-2">
                        <ScoreBar label="Readiness"    value={bd.readiness    ?? 0} max={40} />
                        <ScoreBar label="Brand Fit"    value={bd.brand_fit    ?? 0} max={20} />
                        <ScoreBar label="Audience"     value={bd.audience     ?? 0} max={15} />
                        <ScoreBar label="Location"     value={bd.location     ?? 0} max={10} />
                        <ScoreBar label="Availability" value={bd.availability ?? 0} max={10} />
                        <ScoreBar label="Content"      value={bd.content      ?? 0} max={5}  />
                      </div>
                    </div>
                    <div>
                      <div className="font-condensed text-[10px] font-bold tracking-[0.25em] uppercase text-gray-3 mb-3">Why This Score</div>
                      <div className="space-y-2">
                        {Object.entries(rs).map(([k, v]) => (
                          <p key={k} className="font-narrow text-gray-2 text-[12px] leading-snug">
                            <span className="font-condensed font-semibold text-gray-1 capitalize">{k.replace(/_/g, ' ')}: </span>
                            {v as string}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Applicants view (original) ────────────────────────────────────────────────
function ApplicantsView({ id }: { id: string }) {
  const [apps, setApps]   = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!id) return
    getOppApplications(id)
      .then(r => { setApps(r.applications ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  const move = async (appId: string, status: Application['status'], reason?: string) => {
    setUpdating(appId); setMsg('')
    try {
      const res = await updateApplicationStatus(appId, status, reason)
      setApps(prev => prev.map(a => a.id === appId ? res.application : a))
    } catch (e: any) { setMsg(e.message ?? 'Update failed.') }
    finally { setUpdating(null) }
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-charcoal-3 border-t-blood-glow rounded-full animate-spin" />
    </div>
  )

  return (
    <>
      {msg && <p className="font-condensed text-blood-glow text-[12px] mb-4">{msg}</p>}
      {!apps.length ? (
        <div className="text-center py-16 bg-charcoal border border-charcoal-3" style={{ borderLeft: '2px solid #8b0000' }}>
          <p className="font-condensed text-gray-3 uppercase tracking-widest text-[10px]">No Applications Yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map(app => {
            const f  = app.fighter ?? {}
            const fd = app.fighter_detail ?? {}
            return (
              <div key={app.id} className="bg-charcoal border border-charcoal-3 p-5"
                style={{ borderLeft: `2px solid ${STATUS_COLOR[app.status] ?? '#222226'}` }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-condensed font-bold text-off-white text-[15px]">{f.name ?? 'Fighter'}</span>
                      <span className="font-condensed text-[9px] tracking-[0.2em] uppercase"
                        style={{ color: STATUS_COLOR[app.status] }}>{STATUS_LABEL[app.status]}</span>
                      {app.match_score != null && (
                        <span className="font-condensed text-[11px] text-blood-glow">{app.match_score}% match</span>
                      )}
                    </div>
                    <div className="font-condensed text-gray-3 text-[12px] flex gap-4">
                      {fd.weight_class && <span>{fd.weight_class}</span>}
                      {fd.current_promotion && <span>{fd.current_promotion}</span>}
                      {fd.pro_status && <span className="capitalize">{fd.pro_status}</span>}
                    </div>
                    {app.cover_message && (
                      <p className="font-narrow text-gray-2 text-[13px] leading-relaxed mt-3 max-w-xl">{app.cover_message}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0 min-w-[140px]">
                    {app.status === 'applied' && (
                      <>
                        <button onClick={() => move(app.id, 'under_review')} disabled={updating === app.id}
                          className="font-condensed font-bold uppercase text-[10px] tracking-[0.2em] text-off-white border border-charcoal-3 hover:border-blood px-3 py-1.5 bg-transparent cursor-pointer transition-all">
                          Review
                        </button>
                        <button onClick={() => move(app.id, 'rejected')} disabled={updating === app.id}
                          className="font-condensed uppercase text-[10px] tracking-[0.2em] text-gray-3 border border-charcoal-3 px-3 py-1.5 bg-transparent cursor-pointer">
                          Reject
                        </button>
                      </>
                    )}
                    {app.status === 'under_review' && (
                      <>
                        <button onClick={() => move(app.id, 'shortlisted')} disabled={updating === app.id}
                          className="font-condensed font-bold uppercase text-[10px] tracking-[0.2em] text-off-white border border-charcoal-3 hover:border-blood px-3 py-1.5 bg-transparent cursor-pointer transition-all">
                          Shortlist
                        </button>
                        <button onClick={() => move(app.id, 'rejected')} disabled={updating === app.id}
                          className="font-condensed uppercase text-[10px] tracking-[0.2em] text-gray-3 border border-charcoal-3 px-3 py-1.5 bg-transparent cursor-pointer">
                          Reject
                        </button>
                      </>
                    )}
                    {app.status === 'shortlisted' && (
                      <>
                        <button onClick={() => move(app.id, 'accepted')} disabled={updating === app.id}
                          className="btn-primary text-[10px] py-1.5">
                          Accept
                        </button>
                        <button onClick={() => move(app.id, 'rejected')} disabled={updating === app.id}
                          className="font-condensed uppercase text-[10px] tracking-[0.2em] text-gray-3 border border-charcoal-3 px-3 py-1.5 bg-transparent cursor-pointer">
                          Reject
                        </button>
                      </>
                    )}
                    {['accepted', 'rejected', 'withdrawn'].includes(app.status) && (
                      <span className="font-condensed text-[10px] tracking-[0.15em] text-gray-3 uppercase">
                        {STATUS_LABEL[app.status]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ApplicantsPage() {
  const { id } = useParams<{ id: string }>()
  const [view, setView] = useState<'applicants' | 'matches'>('applicants')
  const [appCount, setAppCount] = useState<number|null>(null)

  useEffect(() => {
    if (!id) return
    getOppApplications(id)
      .then(r => setAppCount((r.applications ?? []).length))
      .catch(() => {})
  }, [id])

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />
      <div className="flex-1 px-6 py-20 max-w-4xl mx-auto w-full">

        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="sec-label mb-1">Sponsor</div>
            <h1 className="font-display text-off-white uppercase" style={{ fontSize: 'clamp(24px,3.5vw,40px)', lineHeight: 0.92 }}>
              {view === 'matches' ? 'SponsorForge Matches' : 'Applicants'}
            </h1>
          </div>
          <Link to="/sponsor/opportunities" className="font-condensed font-bold uppercase text-[10px] tracking-[0.2em] text-gray-3 hover:text-off-white no-underline">
            ← My Opportunities
          </Link>
        </div>

        {/* Tab toggle */}
        <div className="flex border-b border-charcoal-3 mb-6">
          {(['applicants', 'matches'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="font-condensed font-bold uppercase text-[10px] tracking-[0.25em] px-5 py-3 border-b-2 cursor-pointer bg-transparent transition-colors"
              style={{ borderColor: view === v ? '#8b0000' : 'transparent', color: view === v ? '#f0ece4' : '#7a7672' }}>
              {v === 'applicants'
                ? `Applicants${appCount !== null ? ` (${appCount})` : ''}`
                : 'SF Matches'}
            </button>
          ))}
        </div>

        {view === 'applicants'
          ? <ApplicantsView id={id!} />
          : <MatchesView opportunityId={id!} />
        }
      </div>
    </div>
  )
}
