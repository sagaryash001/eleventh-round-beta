import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import NotificationBell from '../../components/NotificationBell'
import CommandCenter  from './admin/CommandCenter'
import UsersVetting   from './admin/UsersVetting'
import MarketplaceOps from './admin/MarketplaceOps'
import Education      from './admin/Education'
import Content        from './admin/Content'
import BillingSystem  from './admin/BillingSystem'

const ZONES = [
  { id: 'command',     label: 'Command Center'   },
  { id: 'users',       label: 'Users & Vetting'  },
  { id: 'marketplace', label: 'Marketplace Ops'  },
  { id: 'education',   label: 'Education'        },
  { id: 'content',     label: 'Content'          },
  { id: 'billing',     label: 'Billing & System' },
]

export default function AdminDashboard() {
  const [zone, setZone]  = useState('command')
  const { user, logout } = useAuth()
  const navigate         = useNavigate()

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
              Platform Admin
            </div>
            <div className="font-display text-off-white uppercase leading-none" style={{ fontSize: 14 }}>
              Command Center
            </div>
          </div>
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
        {zone === 'command'     && <CommandCenter onNavigate={setZone} />}
        {zone === 'users'       && <UsersVetting />}
        {zone === 'marketplace' && <MarketplaceOps />}
        {zone === 'education'   && <Education />}
        {zone === 'content'     && <Content />}
        {zone === 'billing'     && <BillingSystem />}
      </main>
    </div>
  )
}
