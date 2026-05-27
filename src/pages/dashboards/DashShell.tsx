import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

interface NavItem { id: string; label: string; icon: string }
interface Props {
  navItems: NavItem[]
  children: (activeTab: string) => React.ReactNode
  title: string
  subtitle: string
}

export default function DashShell({ navItems, children, title, subtitle }: Props) {
  const [active,   setActive]   = useState(navItems[0].id)
  const [sideOpen, setSideOpen] = useState(true)
  const { user, logout }        = useAuth()
  const navigate                = useNavigate()

  return (
    <div className="min-h-screen bg-black flex" style={{ fontFamily:"'Barlow',sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside className="bg-near-black border-r border-charcoal-3 flex flex-col flex-shrink-0 transition-all duration-300"
        style={{ width: sideOpen ? 252 : 64 }}>

        {/* Logo row */}
        <div className="px-5 py-5 border-b border-charcoal-3 flex items-center justify-between">
          {sideOpen && (
            <Link to="/" className="no-underline inline-block">
              <img src="/logo-white.png" alt="Eleventh Round" style={{ height: 28, width: 'auto' }} />
            </Link>
          )}
          <button onClick={() => setSideOpen(v => !v)}
            className="bg-transparent border-0 cursor-pointer text-gray-3 hover:text-off-white transition-colors"
            style={{ fontSize: 18, padding: 4 }}>
            {sideOpen ? '←' : '→'}
          </button>
        </div>

        {/* User badge */}
        {sideOpen && user && (
          <div className="px-5 py-4 border-b border-charcoal-3">
            <div className="font-condensed font-bold uppercase text-blood-glow mb-1"
              style={{ fontSize: 9, letterSpacing:'0.4em' }}>{user.role}</div>
            <div className="font-condensed font-semibold text-off-white" style={{ fontSize: 15 }}>{user.name}</div>
            <div className="font-condensed text-gray-3" style={{ fontSize: 11 }}>{user.email}</div>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActive(item.id)}
              className="w-full flex items-center gap-3 cursor-pointer border-0 text-left transition-all"
              style={{
                padding: sideOpen ? '13px 20px' : '13px 0',
                justifyContent: sideOpen ? 'flex-start' : 'center',
                background: active===item.id ? 'rgba(139,0,0,0.13)' : 'transparent',
                borderLeft: active===item.id ? '3px solid #c00000' : '3px solid transparent',
                color: active===item.id ? '#f0ece4' : '#4a4846',
              }}>
              <span className="font-condensed font-semibold uppercase whitespace-nowrap"
                style={{ fontSize: 12, letterSpacing:'0.1em' }}>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Sign out */}
        <div className="border-t border-charcoal-3 p-5">
          {sideOpen ? (
            <button onClick={() => { logout(); navigate('/login') }}
              className="font-condensed font-bold uppercase text-gray-3 hover:text-blood-glow transition-colors bg-transparent border-0 cursor-pointer w-full text-left"
              style={{ fontSize: 11, letterSpacing:'0.25em' }}>Sign Out</button>
          ) : (
            <button onClick={() => { logout(); navigate('/login') }}
              className="bg-transparent border-0 cursor-pointer text-gray-3 hover:text-blood-glow text-xl w-full text-center">↩</button>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="bg-near-black border-b border-charcoal-3 px-8 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="font-condensed font-bold uppercase text-blood-glow mb-0.5"
              style={{ fontSize: 10, letterSpacing:'0.4em' }}>{subtitle}</div>
            <h1 className="font-display text-off-white uppercase"
              style={{ fontSize: 'clamp(22px,2.8vw,36px)', lineHeight: 1 }}>
              {navItems.find(n => n.id === active)?.label ?? title}
            </h1>
          </div>
          <div className="flex items-center gap-5">
            <div className="relative cursor-pointer">
              <span className="text-gray-3 hover:text-off-white transition-colors" style={{ fontSize: 20 }}>🔔</span>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blood-glow rounded-full" />
            </div>
            <Link to="/" className="font-condensed font-bold uppercase text-gray-3 hover:text-off-white transition-colors no-underline"
              style={{ fontSize: 11, letterSpacing:'0.2em' }}>← Home</Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-7 bg-black">
          {children(active)}
        </main>
      </div>
    </div>
  )
}
