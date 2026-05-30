import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Navbar() {
  const [scrolled,    setScrolled]    = useState(false)
  const [heroDone,    setHeroDone]    = useState(false)
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [linksIn,     setLinksIn]     = useState(false)
  const { user, logout }              = useAuth()
  const location                      = useLocation()
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
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

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
          // While the hero is in view, stay fully transparent — don't let scrolled state cut across the animation
          padding: `${scrolled && showLinks ? 12 : 20}px 40px`,
          background: scrolled && showLinks ? 'rgba(8,8,8,0.97)' : 'transparent',
          backdropFilter: scrolled && showLinks ? 'blur(20px) saturate(1.3)' : 'none',
          borderBottom: scrolled && showLinks ? '1px solid rgba(139,0,0,0.16)' : 'none',
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
