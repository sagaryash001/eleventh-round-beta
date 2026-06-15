import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import NotificationBell from '../../components/NotificationBell'
import { getSponsorDashboard, type SponsorProfile } from '../../lib/api/sponsors'
import Overview       from './sponsor/Overview'
import Campaigns      from './sponsor/Campaigns'
import TalentPipeline from './sponsor/TalentPipeline'
import Contracts      from './sponsor/Contracts'
import CompanyBilling from './sponsor/CompanyBilling'
import EventCalendar  from '../../components/events/EventCalendar'
import { getLinkableFighters } from '../../lib/api/events'

const ZONES = [
  { id: 'overview',   label: 'Overview'         },
  { id: 'campaigns',  label: 'Campaigns'         },
  { id: 'pipeline',   label: 'Talent Pipeline'   },
  { id: 'contracts',  label: 'Contracts'         },
  { id: 'company',    label: 'Company & Billing' },
  { id: 'events',     label: 'Event Calendar'    },
]

// Sponsor Event Calendar — links only fighters the sponsor has a verified
// relationship with (contract / accepted application), resolved server-side.
function SponsorEventsZone() {
  const [assignable, setAssignable] = useState<{ id: string; name: string }[]>([])
  useEffect(() => { getLinkableFighters().then(d => setAssignable(d.fighters ?? [])).catch(() => {}) }, [])
  return <EventCalendar assignable={assignable} canLinkFighters label="Event Calendar" />
}

// Explicit load states — no more "spinner forever" when an API call fails or a
// new sponsor has no company profile yet.
type LoadStatus = 'loading' | 'ready' | 'needs-setup' | 'error'

const LOAD_TIMEOUT_MS = 12000

export default function SponsorDashboard() {
  const { token, user, logout } = useAuth()
  const navigate               = useNavigate()
  const [zone, setZone]        = useState('overview')
  const [sp, setSp]            = useState<SponsorProfile | null>(null)
  const [status, setStatus]    = useState<LoadStatus>('loading')
  const [errMsg, setErrMsg]    = useState('')
  // Bumped on every (re)load and on unmount so a stale/late response or the
  // timeout can detect it's no longer the current request and bail.
  const reqRef = useRef(0)

  const load = useCallback(() => {
    if (!token) return
    const myReq = ++reqRef.current
    setStatus('loading')
    setErrMsg('')

    // Never let a hung request strand the sponsor on a black spinner.
    const timeout = window.setTimeout(() => {
      if (myReq !== reqRef.current) return
      console.error('[sponsor] dashboard load timed out after', LOAD_TIMEOUT_MS, 'ms')
      setErrMsg('This is taking longer than expected. Check your connection and try again.')
      setStatus('error')
    }, LOAD_TIMEOUT_MS)

    getSponsorDashboard()
      .then(d => {
        if (myReq !== reqRef.current) return
        window.clearTimeout(timeout)
        // New sponsor: auth + profile row exist, but no company profile yet.
        // Show an inline setup CTA instead of redirecting (the old redirect to
        // /onboarding/sponsor bounced back here forever once onboarding_complete
        // was already true — an infinite loop).
        if (!d.sponsorProfile) { setStatus('needs-setup'); return }
        setSp(d.sponsorProfile)
        setStatus('ready')
      })
      .catch(err => {
        if (myReq !== reqRef.current) return
        window.clearTimeout(timeout)
        console.error('[sponsor] dashboard load failed:', err?.message || err)
        setErrMsg(err?.message || 'Could not load your sponsor console. Please try again.')
        setStatus('error')
      })
  }, [token])

  useEffect(() => { load(); return () => { reqRef.current++ } }, [load])

  const signOut = () => { logout(); navigate('/login') }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-charcoal-3 border-t-blood-glow rounded-full animate-spin" />
      </div>
    )
  }

  // ── Error (timeout or failed API) ────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="w-full max-w-[420px] bg-charcoal border border-charcoal-3 p-8 text-center"
             style={{ borderLeft: '2px solid #8b0000' }}>
          <div className="sec-label mb-2 justify-center">Couldn't Load</div>
          <h2 className="font-display text-off-white uppercase mb-3" style={{ fontSize: 'clamp(24px,3vw,34px)', lineHeight: 0.95 }}>
            Sponsor Console
          </h2>
          <p className="font-narrow text-gray-2 mb-6" style={{ fontSize: 13 }}>{errMsg}</p>
          <div className="flex flex-col gap-3">
            <button onClick={load} className="btn-primary">Retry</button>
            <div className="flex gap-3">
              <Link to="/login" className="btn-ghost flex-1 text-center">Back to Login</Link>
              <button onClick={signOut} className="btn-ghost flex-1">Sign Out</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Needs setup (no company profile yet) ─────────────────────────────────
  if (status === 'needs-setup') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="w-full max-w-[440px] bg-charcoal border border-charcoal-3 p-8 text-center"
             style={{ borderLeft: '2px solid #8b0000' }}>
          <div className="sec-label mb-2 justify-center">One More Step</div>
          <h2 className="font-display text-off-white uppercase mb-3" style={{ fontSize: 'clamp(26px,3.4vw,40px)', lineHeight: 0.92 }}>
            Set Up Your Company
          </h2>
          <p className="font-narrow text-gray-1 leading-relaxed mb-7" style={{ fontSize: 14 }}>
            Your account is ready. Add your company profile to unlock the sponsor console —
            campaigns, the talent pipeline, contracts, and billing.
          </p>
          <button onClick={() => navigate('/sponsor/onboard')} className="btn-primary w-full mb-3">
            Complete Company Setup →
          </button>
          <button onClick={signOut}
            className="font-condensed text-[10px] tracking-[0.2em] uppercase text-gray-3 hover:text-blood-glow transition-colors bg-transparent border-0 cursor-pointer mt-1">
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  // ── Ready (sp guaranteed non-null) ───────────────────────────────────────
  if (!sp) return null

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
          <NotificationBell />
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
        {zone === 'events'    && <SponsorEventsZone />}
      </main>
    </div>
  )
}
