import React from 'react'
import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-black border-t border-charcoal-3 relative overflow-hidden">
      {/* Arena floor warmth */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 140%, rgba(196,30,58,0.1) 0%, transparent 55%)',
      }} />

      <div className="relative z-10 py-20 flex flex-col items-center text-center px-10">

        {/* Large wordmark — Stitch direction */}
        <Link
          to="/"
          className="no-underline block mb-10 group"
          aria-label="The Eleventh Round"
        >
          <span
            className="font-display uppercase tracking-tight leading-none block transition-colors duration-300"
            style={{
              fontSize: 'clamp(52px,8vw,108px)',
              letterSpacing: '-0.04em',
              color: '#e2e2e2',
            }}
          >
            ELEVENTH{' '}
            <span
              className="transition-colors duration-300 group-hover:text-crimson"
              style={{ color: '#C41E3A' }}
            >
              ROUND
            </span>
          </span>
        </Link>

        {/* Red rule */}
        <div className="w-12 h-px mb-10" style={{ background: '#C41E3A', opacity: 0.7 }} />

        {/* Nav links */}
        <div className="flex flex-wrap justify-center gap-8 mb-10">
          {[
            { to:'/team',  label:'The Team' },
            { to:'/login', label:'Sign In'  },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="font-narrow font-bold italic text-[11px] tracking-[0.2em] uppercase text-gray-3
                         hover:text-off-white transition-colors duration-200 no-underline"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Social links */}
        <div className="flex items-center gap-8 mb-10">
          {/* Instagram */}
          <a
            href="https://www.instagram.com/eleventhrnd"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram (@eleventhrnd)"
            className="group flex flex-col items-center gap-1.5 no-underline"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              className="text-gray-3 group-hover:text-off-white transition-colors duration-200"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <circle cx="12" cy="12" r="4"/>
              <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none"/>
            </svg>
            <span className="font-condensed font-bold uppercase text-gray-3 group-hover:text-off-white transition-colors duration-200"
              style={{ fontSize: 9, letterSpacing: '0.3em' }}>Instagram</span>
          </a>

          {/* Divider dot */}
          <div className="w-px h-6 bg-charcoal-3" />

          {/* YouTube */}
          <a
            href="https://www.youtube.com/@theeleventhrnd"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="YouTube"
            className="group flex flex-col items-center gap-1.5 no-underline"
          >
            <svg width="22" height="20" viewBox="0 0 24 24" fill="none"
              className="text-gray-3 group-hover:text-off-white transition-colors duration-200"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22.54 6.42A2.78 2.78 0 0 0 20.6 4.47C18.88 4 12 4 12 4s-6.88 0-8.6.47A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.4 19.53C5.12 20 12 20 12 20s6.88 0 8.6-.47a2.78 2.78 0 0 0 1.94-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
              <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="currentColor" stroke="none"/>
            </svg>
            <span className="font-condensed font-bold uppercase text-gray-3 group-hover:text-off-white transition-colors duration-200"
              style={{ fontSize: 9, letterSpacing: '0.3em' }}>YouTube</span>
          </a>

          {/* Divider dot */}
          <div className="w-px h-6 bg-charcoal-3" />

          {/* Email */}
          <a
            href="mailto:contact@eleventh-rnd.us"
            aria-label="Email"
            className="group flex flex-col items-center gap-1.5 no-underline"
          >
            <svg width="22" height="20" viewBox="0 0 24 24" fill="none"
              className="text-gray-3 group-hover:text-off-white transition-colors duration-200"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <span className="font-condensed font-bold uppercase text-gray-3 group-hover:text-off-white transition-colors duration-200"
              style={{ fontSize: 9, letterSpacing: '0.3em' }}>Email</span>
          </a>
        </div>

        {/* Manifesto */}
        <p
          className="font-narrow italic text-gray-3 mb-8 max-w-md"
          style={{ fontSize:'clamp(11px,1.1vw,13px)', letterSpacing:'0.1em', lineHeight: 1.6 }}
        >
          "Professionalism creates opportunity. Readiness is the differentiator."
        </p>

        {/* Legal */}
        <div
          className="font-narrow italic text-[10px] tracking-[0.15em] uppercase text-gray-3"
          style={{ opacity: 0.5 }}
        >
          © 2026 The Eleventh Round
        </div>
      </div>
    </footer>
  )
}
