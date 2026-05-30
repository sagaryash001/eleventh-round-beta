import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { getOppApplications } from '../../lib/api/opportunities'
import { updateApplicationStatus, type Application } from '../../lib/api/applications'

const STATUS_LABEL: Record<string, string> = {
  applied: 'New', under_review: 'In Review', shortlisted: 'Shortlisted',
  accepted: 'Accepted', rejected: 'Rejected', withdrawn: 'Withdrawn', expired: 'Expired',
}
const STATUS_COLOR: Record<string, string> = {
  applied: '#7a7672', under_review: '#C41E3A', shortlisted: '#f5a623',
  accepted: '#00c060', rejected: '#4a4846', withdrawn: '#4a4846', expired: '#4a4846',
}

export default function ApplicantsPage() {
  const { id } = useParams<{ id: string }>()
  const [apps, setApps]   = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const load = () => {
    if (!id) return
    getOppApplications(id)
      .then(r => { setApps(r.applications ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(load, [id])

  const move = async (appId: string, status: Application['status'], reason?: string) => {
    setUpdating(appId); setMsg('')
    try {
      const res = await updateApplicationStatus(appId, status, reason)
      setApps(prev => prev.map(a => a.id === appId ? res.application : a))
    } catch (e: any) {
      setMsg(e.message ?? 'Update failed.')
    } finally { setUpdating(null) }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />
      <div className="flex-1 px-6 py-20 max-w-4xl mx-auto w-full">

        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="sec-label mb-1">Sponsor</div>
            <h1 className="font-display text-off-white uppercase" style={{ fontSize: 'clamp(24px,3.5vw,40px)', lineHeight: 0.92 }}>
              Applicants
            </h1>
          </div>
          <Link to="/sponsor/opportunities" className="font-condensed font-bold uppercase text-[10px] tracking-[0.2em] text-gray-3 hover:text-off-white no-underline">
            ← My Opportunities
          </Link>
        </div>

        {msg && <p className="font-condensed text-blood-glow text-[12px] mb-4">{msg}</p>}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-charcoal-3 border-t-blood-glow rounded-full animate-spin" />
          </div>
        ) : apps.length === 0 ? (
          <div className="text-center py-16 bg-charcoal border border-charcoal-3" style={{ borderLeft: '2px solid #8b0000' }}>
            <p className="font-condensed text-gray-3 uppercase tracking-widest text-[10px]">No Applications Yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {apps.map(app => {
              const f = app.fighter ?? {}
              const fd = app.fighter_detail ?? {}
              return (
                <div key={app.id} className="bg-charcoal border border-charcoal-3 p-5"
                  style={{ borderLeft: `2px solid ${STATUS_COLOR[app.status] ?? '#222226'}` }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-condensed font-bold text-off-white text-[15px]">{f.name ?? 'Fighter'}</span>
                        <span className="font-condensed text-[9px] tracking-[0.2em] uppercase"
                          style={{ color: STATUS_COLOR[app.status] }}>
                          {STATUS_LABEL[app.status]}
                        </span>
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

                    {/* Action buttons by status */}
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
                      {['accepted', 'rejected', 'withdrawn', 'expired'].includes(app.status) && (
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
      </div>
    </div>
  )
}
