import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getSponsorDashboard, type SponsorProfile } from '../../lib/api/sponsors'
import Overview       from './sponsor/Overview'
import Campaigns      from './sponsor/Campaigns'
import TalentPipeline from './sponsor/TalentPipeline'
import Contracts      from './sponsor/Contracts'
import CompanyBilling from './sponsor/CompanyBilling'

const ZONES = [
  { id: 'overview',   label: 'Overview'         },
  { id: 'campaigns',  label: 'Campaigns'         },
  { id: 'pipeline',   label: 'Talent Pipeline'   },
  { id: 'contracts',  label: 'Contracts'         },
  { id: 'company',    label: 'Company & Billing' },
]

export default function SponsorDashboard() {
  const { token, user, logout } = useAuth()
  const navigate               = useNavigate()
  const [zone, setZone]        = useState('overview')
  const [sp, setSp]            = useState<SponsorProfile | null>(null)
  const [loading, setLoading]  = useState(true)

  useEffect(() => {
    if (!token) return
    getSponsorDashboard()
      .then(d => {
        if (!d.sponsorProfile) { navigate('/onboarding/sponsor', { replace: true }); return }
        setSp(d.sponsorProfile)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [navigate, token])

  if (loading || !sp) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-charcoal-3 border-t-blood-glow rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex flex-col" style={{ fontFamily: "'Barlow',sans-serif" }}>

      {/* ── Command bar ── */}
      <header className="bg-near-black border-b border-charcoal-3 flex items-stretch flex-shrink-0 sticky top-0 z-30">
        <div className="flex items-center px-5 py-3 border-r border-charcoal-3 flex-shrink-0">
          <Link to="/" className="no-underline inline-block">
            <img src="/logo-white.png" alt="Eleventh Round" style={{ height: 22, width: 'auto' }} />
          </Link>
        </div>
        <div className="flex items-center px-5 py-3 border-r border-charcoal-3 flex-shrink-0">
          <div>
            <div className="font-condensed text-[8px] font-bold tracking-[0.4em] uppercase leading-none mb-0.5"
              style={{ color: '#C41E3A' }}>
              Sponsor Console
            </div>
            <div className="font-condensed font-bold text-off-white leading-none" style={{ fontSize: 13 }}>
              {sp.company_name}
            </div>
          </div>
        </div>
        {/* Verification badge */}
        <div className="flex items-center px-4 border-r border-charcoal-3 flex-shrink-0">
          <span className="font-condensed text-[9px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 border"
            style={{
              borderColor: sp.is_verified ? '#00c060' : '#c9a82c',
              color:       sp.is_verified ? '#00c060' : '#c9a82c',
              background:  sp.is_verified ? 'rgba(0,192,96,0.08)' : 'rgba(201,168,44,0.08)',
            }}>
            {sp.is_verified ? '● Verified' : '○ Pending Vetting'}
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-5 px-5 py-3">
          {user && (
            <div className="text-right hidden sm:block">
              <div className="font-condensed text-[11px] font-bold text-off-white leading-tight">{user.name}</div>
              <div className="font-condensed text-[9px] text-gray-3 leading-tight">{user.email}</div>
            </div>
          )}
          <div className="relative cursor-pointer">
            <span className="text-gray-3 hover:text-off-white transition-colors" style={{ fontSize: 17 }}>🔔</span>
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: '#C41E3A' }} />
          </div>
          <Link to="/" className="font-condensed font-bold uppercase text-gray-3 hover:text-off-white transition-colors no-underline"
            style={{ fontSize: 10, letterSpacing: '0.2em' }}>
            ← Home
          </Link>
          <button onClick={() => { logout(); navigate('/login') }}
            className="font-condensed font-bold uppercase text-gray-3 hover:text-blood-glow transition-colors bg-transparent border-0 cursor-pointer"
            style={{ fontSize: 10, letterSpacing: '0.25em' }}>
            Sign Out
          </button>
        </div>
      </header>

      {/* ── Zone nav ── */}
      <div className="bg-near-black border-b border-charcoal-3 px-4 flex overflow-x-auto flex-shrink-0 sticky top-[57px] z-20"
        style={{ scrollbarWidth: 'none' }}>
        {ZONES.map(z => (
          <button key={z.id} onClick={() => setZone(z.id)}
            className="font-condensed text-[10px] font-bold tracking-[0.18em] uppercase px-5 py-3.5 cursor-pointer border-0 bg-transparent whitespace-nowrap transition-all duration-150"
            style={{
              color:        zone === z.id ? '#f0ece4' : '#4a4846',
              borderBottom: zone === z.id ? '2px solid #C41E3A' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {z.label}
          </button>
        ))}
      </div>

      {/* ── Zone content ── */}
      <main className="flex-1 overflow-y-auto p-6 bg-black">
        {zone === 'overview'  && <Overview sp={sp} onNavigate={setZone} />}
        {zone === 'campaigns' && <Campaigns sp={sp} />}
        {zone === 'pipeline'  && <TalentPipeline sp={sp} />}
        {zone === 'contracts' && <Contracts />}
        {zone === 'company'   && <CompanyBilling sp={sp} onUpdate={u => setSp(p => p ? { ...p, ...u } : p)} />}
      </main>
    </div>
  )
}
