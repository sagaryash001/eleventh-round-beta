import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { getMyApplications, updateApplicationStatus, type Application } from '../../lib/api/applications'
import { useAuth } from '../../hooks/useAuth'

const STATUS_LABEL: Record<string, string> = {
  applied: 'Submitted', under_review: 'In Review', shortlisted: 'Shortlisted',
  accepted: 'Accepted 🎉', rejected: 'Rejected', withdrawn: 'Withdrawn', expired: 'Expired',
}
const STATUS_COLOR: Record<string, string> = {
  applied: '#7a7672', under_review: '#C41E3A', shortlisted: '#f5a623',
  accepted: '#00c060', rejected: '#4a4846', withdrawn: '#4a4846', expired: '#4a4846',
}

export default function MyApplicationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [apps, setApps]     = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return }
    getMyApplications()
      .then(r => { setApps(r.applications ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user, navigate])

  const withdraw = async (id: string) => {
    try {
      const res = await updateApplicationStatus(id, 'withdrawn')
      setApps(prev => prev.map(a => a.id === id ? res.application : a))
    } catch {}
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />
      <div className="flex-1 px-6 py-20 max-w-3xl mx-auto w-full">

        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="sec-label mb-1">Fighter</div>
            <h1 className="font-display text-off-white uppercase" style={{ fontSize: 'clamp(28px,4vw,44px)', lineHeight: 0.92 }}>
              My Applications
            </h1>
          </div>
          <Link to="/opportunities" className="btn-ghost no-underline">Browse Opportunities</Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-charcoal-3 border-t-blood-glow rounded-full animate-spin" />
          </div>
        ) : apps.length === 0 ? (
          <div className="text-center py-20 bg-charcoal border border-charcoal-3" style={{ borderLeft: '2px solid #8b0000' }}>
            <p className="font-condensed font-bold uppercase text-[10px] tracking-[0.35em] text-gray-3 mb-3">No Applications Yet</p>
            <p className="font-narrow text-gray-2 text-[14px] mb-6">Find a sponsorship opportunity and apply to start your journey.</p>
            <Link to="/opportunities" className="btn-primary no-underline">Browse Opportunities</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {apps.map(app => {
              const opp = app.opportunity ?? {}
              const sd  = app.sponsor_detail ?? {}
              return (
                <div key={app.id} className="bg-charcoal border border-charcoal-3 p-5"
                  style={{ borderLeft: `2px solid ${STATUS_COLOR[app.status] ?? '#222226'}` }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-condensed font-bold uppercase text-[10px] tracking-[0.25em] text-blood-glow mb-1">
                        {sd.company_name ?? 'Sponsor'}
                      </div>
                      <Link to={`/opportunities/${app.opportunity_id}`}
                        className="font-condensed font-bold text-off-white text-[15px] no-underline hover:text-blood-glow">
                        {opp.title ?? 'Opportunity'}
                      </Link>
                      <div className="flex items-center gap-4 mt-2 font-condensed text-[11px]">
                        <span style={{ color: STATUS_COLOR[app.status] }}>{STATUS_LABEL[app.status]}</span>
                        {app.match_score != null && <span className="text-gray-3">{app.match_score}% match</span>}
                        <span className="text-gray-3">
                          Applied {new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      {app.rejection_reason && (
                        <p className="font-narrow text-gray-3 text-[12px] mt-2 italic">"{app.rejection_reason}"</p>
                      )}
                    </div>
                    {['applied', 'under_review', 'shortlisted'].includes(app.status) && (
                      <button onClick={() => withdraw(app.id)}
                        className="font-condensed uppercase text-[10px] tracking-[0.15em] text-gray-3 hover:text-blood-glow bg-transparent border-0 cursor-pointer flex-shrink-0">
                        Withdraw
                      </button>
                    )}
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
