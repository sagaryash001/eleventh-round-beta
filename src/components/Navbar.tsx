import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getNotifications, markAllNotificationsRead, type Notification } from '../lib/api/notifications'

export default function Navbar() {
  const [scrolled,    setScrolled]    = useState(false)
  const [heroDone,    setHeroDone]    = useState(false)
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [linksIn,     setLinksIn]     = useState(false)
  const [notifOpen,   setNotifOpen]   = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const notifRef                      = useRef<HTMLDivElement>(null)
  const { user, logout }              = useAuth()
  const location                      = useLocation()
  const navigate                      = useNavigate()
  const isHome                        = location.pathname === '/'

  const showLinks = !isHome || heroDone

  const dashPath = user
    ? `/dashboard/${user.role === 'admin' ? 'admin' : user.role}`
    : '/login'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Show nav links only after the hero section has fully scrolled past
  // IntersectionObserver doesn't work with GSAP-pinned elements — use scroll listener instead
  useEffect(() => {
    if (!isHome) { setHeroDone(true); return }
    setHeroDone(false)
    const check = () => {
      const hero = document.getElementById('hero')
      if (!hero) { setHeroDone(true); return }
      // GSAP wraps pinned sections in a .pin-spacer div — track that if present
      const trackEl = (hero.parentElement?.classList.contains('pin-spacer') ? hero.parentElement : hero)
      setHeroDone(trackEl.getBoundingClientRect().bottom <= 0)
    }
    window.addEventListener('scroll', check, { passive: true })
    check()
    return () => window.removeEventListener('scroll', check)
  }, [isHome])

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden'
      const t = setTimeout(() => setLinksIn(true), 60)
      return () => { clearTimeout(t); document.body.style.overflow = '' }
    } else {
      setLinksIn(false)
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  // Close on route change
  useEffect(() => { setMenuOpen(false); setNotifOpen(false) }, [location.pathname])

  // Load notifications for logged-in users
  useEffect(() => {
    if (!user) { setNotifications([]); setUnreadCount(0); return }
    const load = () =>
      getNotifications({ limit: 10 })
        .then(r => { setNotifications(r.notifications); setUnreadCount(r.unread_count) })
        .catch(() => {})
    load()

    // Realtime badge updates
    const sb = supabase
    if (!sb) return
    const channel = sb
      .channel(`notif:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, () => load())
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [user])

  // Close notification dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    if (notifOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notifOpen])

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead().catch(() => {})
    setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })))
    setUnreadCount(0)
  }

  const scrollTo = (href: string) => {
    setMenuOpen(false)
    setTimeout(() => {
      const el = document.querySelector(href)
      if (!el) return
      const lenis = (window as any).__lenis
      if (lenis) lenis.scrollTo(el, { offset: -80 })
      else el.scrollIntoView({ behavior: 'smooth' })
    }, 400)
  }

  const homeLinks: { href: string; label: string }[] = []

  const globalLinks = [
    { to: '/opportunities', label: 'Opportunities' },
    { to: '/team',          label: 'The Team'       },
    { to: '/podcast',       label: 'Podcast'        },
    { to: '/apparel',       label: 'Apparel'        },
  ]

  const allMobileLinks = [
    ...homeLinks.map((l, i) => ({ key: l.href, label: l.label, idx: i, isHash: true as const, href: l.href })),
    ...globalLinks.map((l, i) => ({ key: l.to, label: l.label, idx: homeLinks.length + i, isHash: false as const, to: l.to })),
  ]

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-[1000]"
        style={{
          padding: `${scrolled && showLinks ? 12 : 20}px 40px`,
          // Scrolled → solid glass. Over the cinematic hero (home, top) → a SUBTLE
          // glass scrim with a faint red accent so the logo/CTA stay legible against
          // the bright cage centre without over-darkening. Other pages: transparent.
          background: scrolled && showLinks
            ? 'rgba(8,8,8,0.97)'
            : isHome
              ? 'linear-gradient(180deg, rgba(8,8,8,0.62) 0%, rgba(8,8,8,0.14) 68%, transparent 100%)'
              : 'transparent',
          backdropFilter: scrolled && showLinks ? 'blur(20px) saturate(1.3)' : isHome ? 'blur(6px)' : 'none',
          WebkitBackdropFilter: scrolled && showLinks ? 'blur(20px) saturate(1.3)' : isHome ? 'blur(6px)' : 'none',
          borderBottom: scrolled && showLinks
            ? '1px solid rgba(139,0,0,0.16)'
            : isHome ? '1px solid rgba(196,30,58,0.10)' : 'none',
          boxShadow: scrolled && showLinks ? '0 2px 40px rgba(0,0,0,0.6)' : 'none',
          transition: 'padding 0.4s cubic-bezier(.25,.46,.45,.94), background 0.4s, box-shadow 0.4s, border-color 0.4s',
        }}
      >
        <div className="flex items-center justify-between w-full relative">

          {/* ── Logo ── */}
          <Link to="/" className="no-underline flex-shrink-0" aria-label="The Eleventh Round — Home">
            <img
              src="/logo-white.png"
              alt="Eleventh Round"
              style={{ height: scrolled ? 44 : 52, width: 'auto', transition: 'height 0.4s cubic-bezier(.25,.46,.45,.94)' }}
            />
          </Link>

          {/* ── Desktop nav — absolutely centered, hidden on home until hero exits ── */}
          <ul
            className="hidden md:flex gap-8 list-none m-0 p-0 absolute left-1/2 -translate-x-1/2"
            style={{
              opacity:       showLinks ? 1 : 0,
              transform:     showLinks ? 'translateX(-50%)' : 'translateX(-50%) translateY(-6px)',
              pointerEvents: showLinks ? 'all' : 'none',
              transition: 'opacity 0.5s ease, transform 0.5s ease',
            }}
            role="list"
          >
            {homeLinks.map(({ href, label }) => (
              <li key={href}>
                <a href={href} className="er-nav-link">{label}</a>
              </li>
            ))}
            {globalLinks.map(({ to, label }) => (
              <li key={to}>
                <Link to={to} className="er-nav-link">{label}</Link>
              </li>
            ))}
          </ul>

          {/* ── Desktop actions ── */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <>
                {/* Notification bell */}
                <div ref={notifRef} className="relative">
                  <button
                    onClick={() => setNotifOpen(o => !o)}
                    className="relative flex items-center justify-center w-9 h-9"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                    aria-label="Notifications"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7a7672" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    {unreadCount > 0 && (
                      <span
                        className="absolute -top-1 -right-1 text-[9px] font-bold leading-none rounded-full flex items-center justify-center"
                        style={{ background: '#8b0000', color: '#f0ece4', minWidth: 16, height: 16, padding: '0 3px' }}
                      >
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification dropdown */}
                  {notifOpen && (
                    <div
                      className="absolute right-0 mt-2 rounded shadow-2xl overflow-hidden"
                      style={{
                        width: 320,
                        background: '#0d0d0f',
                        border: '1px solid rgba(255,255,255,0.07)',
                        zIndex: 2000,
                        top: '100%',
                      }}
                    >
                      <div
                        className="flex items-center justify-between px-4 py-3"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f0ece4', letterSpacing: '0.18em' }}>
                          Notifications
                        </span>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            className="text-[10px] uppercase tracking-widest"
                            style={{ color: '#7a7672', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                        {notifications.length === 0 ? (
                          <p className="px-4 py-6 text-center text-sm" style={{ color: '#4a4846' }}>
                            No notifications
                          </p>
                        ) : (
                          notifications.map(n => (
                            <button
                              key={n.id}
                              className="w-full text-left px-4 py-3 transition-colors"
                              style={{
                                background: n.read_at ? 'transparent' : 'rgba(139,0,0,0.06)',
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                cursor: 'pointer',
                                border: 'none',
                                borderBottomColor: 'rgba(255,255,255,0.04)',
                                borderBottomWidth: 1,
                                borderBottomStyle: 'solid',
                              }}
                              onClick={() => {
                                setNotifOpen(false)
                                if (n.action_url) navigate(n.action_url.replace(window.location.origin, ''))
                              }}
                            >
                              <p className="text-xs font-semibold mb-0.5" style={{ color: n.read_at ? '#7a7672' : '#f0ece4' }}>
                                {n.title}
                              </p>
                              {n.body && (
                                <p className="text-[11px] truncate" style={{ color: '#4a4846' }}>{n.body}</p>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <Link
                          to="/inbox"
                          className="block text-center text-[10px] uppercase tracking-widest py-3"
                          style={{ color: '#7a7672', textDecoration: 'none' }}
                        >
                          Open Inbox
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                <Link
                  to={dashPath}
                  className="font-condensed text-[13px] font-bold tracking-[0.22em] uppercase text-off-white
                             bg-charcoal border px-7 py-3 no-underline transition-colors duration-200"
                  style={{ borderColor: 'rgba(240,236,228,0.1)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(139,0,0,0.5)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(240,236,228,0.1)')}
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-primary" style={{ fontSize: 10, padding: '10px 22px' }}>
                  Join the Ecosystem
                </Link>
              </>
            )}
          </div>

          {/* ── Mobile hamburger ── */}
          <button
            className="md:hidden relative flex flex-col justify-center items-end gap-[5px]
                       w-10 h-10 bg-transparent border-0 cursor-pointer"
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
          >
            <span style={{
              display: 'block', height: 1, width: 24, background: '#f0ece4',
              transform: menuOpen ? 'translateY(6px) rotate(45deg)' : 'none',
              transformOrigin: 'center',
              transition: 'transform 0.32s cubic-bezier(.77,0,.175,1)',
            }} />
            <span style={{
              display: 'block', height: 1, width: 16, background: '#f0ece4',
              opacity: menuOpen ? 0 : 1,
              transform: menuOpen ? 'scaleX(0)' : 'none',
              transition: 'opacity 0.2s, transform 0.2s',
            }} />
            <span style={{
              display: 'block', height: 1, width: 24, background: '#f0ece4',
              transform: menuOpen ? 'translateY(-6px) rotate(-45deg)' : 'none',
              transformOrigin: 'center',
              transition: 'transform 0.32s cubic-bezier(.77,0,.175,1)',
            }} />
          </button>
        </div>
      </nav>

      {/* ══ Mobile overlay menu ══ */}
      <div
        id="mobile-nav"
        className="fixed inset-0 z-[998] flex flex-col md:hidden overflow-hidden"
        style={{
          background: 'rgba(8,8,8,0.99)',
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? 'all' : 'none',
          transition: 'opacity 0.42s cubic-bezier(.77,0,.175,1)',
        }}
        aria-hidden={!menuOpen}
      >
        {/* Atmospheric layers */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 8% 82%, rgba(139,0,0,0.28) 0%, transparent 52%)',
        }} />
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 92% 18%, rgba(100,0,0,0.1) 0%, transparent 45%)',
        }} />

        {/* Links — vertically centered */}
        <nav
          className="relative z-10 flex flex-col justify-center px-10 h-full"
          aria-label="Mobile navigation"
        >
          <div className="mb-8">
            {allMobileLinks.map(({ key, label, idx, isHash, ...rest }) => {
              const delay = idx * 0.06
              const s: React.CSSProperties = {
                opacity: linksIn ? 1 : 0,
                transform: linksIn ? 'translateX(0)' : 'translateX(-28px)',
                transition: `opacity 0.55s ${delay}s cubic-bezier(.25,.46,.45,.94),
                             transform 0.55s ${delay}s cubic-bezier(.25,.46,.45,.94)`,
              }
              return isHash ? (
                <button
                  key={key}
                  onClick={() => scrollTo((rest as { href: string }).href)}
                  className="font-display text-off-white uppercase text-left
                             bg-transparent border-0 cursor-pointer block mb-1"
                  style={{ fontSize: 'clamp(36px,9vw,66px)', lineHeight: 0.9, letterSpacing: '0.01em', ...s }}
                >
                  {label}
                </button>
              ) : (
                <Link
                  key={key}
                  to={(rest as { to: string }).to}
                  className="font-display text-off-white uppercase no-underline block mb-1"
                  style={{ fontSize: 'clamp(36px,9vw,66px)', lineHeight: 0.9, letterSpacing: '0.01em', ...s }}
                >
                  {label}
                </Link>
              )
            })}
          </div>

          {/* Red accent divider */}
          <div style={{
            width: 36, height: 1, background: '#c00000', marginBottom: 24,
            opacity: linksIn ? 1 : 0,
            transition: 'opacity 0.5s 0.28s',
          }} />

          {/* Auth CTA */}
          <div style={{
            opacity: linksIn ? 1 : 0,
            transform: linksIn ? 'translateX(0)' : 'translateX(-20px)',
            transition: 'opacity 0.5s 0.34s, transform 0.5s 0.34s cubic-bezier(.25,.46,.45,.94)',
          }}>
            {user ? (
              <Link to={dashPath} className="btn-primary" onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
            ) : (
              <Link to="/login" className="btn-primary" onClick={() => setMenuOpen(false)}>
                Join the Ecosystem
              </Link>
            )}
          </div>
        </nav>
      </div>

      <style>{`
        .er-nav-link {
          position: relative;
          font-family: 'Archivo Narrow', 'Barlow Condensed', sans-serif;
          font-size: 11px;
          font-weight: 700;
          font-style: italic;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #7a7672;
          text-decoration: none;
          transition: color 0.22s;
        }
        .er-nav-link::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          right: 100%;
          height: 1px;
          background: #C41E3A;
          transition: right 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .er-nav-link:hover { color: #f0ece4; }
        .er-nav-link:hover::after { right: 0; }
      `}</style>
    </>
  )
}
