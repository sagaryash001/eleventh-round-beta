import React from 'react'
import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-black border-t border-charcoal-3 relative overflow-hidden">
      {/* Atmospheric glow — subtle arena floor warmth */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 140%, rgba(80,0,0,0.14) 0%, transparent 55%)',
      }} />

      {/* Manifesto bar */}
      <div
        className="relative border-b border-charcoal-3 py-7 px-12 text-center"
      >
        <p
          className="font-condensed italic text-gray-3 uppercase"
          style={{ fontSize:'clamp(11px,1.1vw,13px)', letterSpacing:'0.22em' }}
        >
          "Professionalism creates opportunity. Readiness is the differentiator."
        </p>
      </div>

      {/* Main footer row */}
      <div className="relative max-w-[1200px] mx-auto px-12 py-8 flex flex-col md:flex-row justify-between items-center gap-6">

        {/* Wordmark */}
        <Link
          to="/"
          className="group flex items-baseline gap-2 no-underline"
          aria-label="The Eleventh Round"
        >
          <span
            className="font-display text-blood-glow group-hover:text-blood-bright transition-colors duration-200"
            style={{ fontSize:22, lineHeight:1, textShadow:'0 0 16px rgba(139,0,0,0.4)' }}
          >
            XI
          </span>
          <span
            className="font-condensed font-extrabold uppercase text-gray-2 group-hover:text-gray-1 transition-colors duration-200"
            style={{ fontSize:13, letterSpacing:'0.1em' }}
          >
            The Eleventh Round
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex gap-8">
          {[
            { to:'/podcast', label:'Podcast' },
            { to:'/apparel', label:'Apparel' },
            { to:'/login',   label:'Sign In'  },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="font-condensed text-[11px] tracking-[0.2em] uppercase text-gray-3
                         hover:text-off-white transition-colors duration-200 no-underline"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Legal */}
        <div
          className="font-condensed text-[10px] tracking-[0.15em] uppercase text-gray-3"
        >
          © 2026 The Eleventh Round
        </div>
      </div>
    </footer>
  )
}
