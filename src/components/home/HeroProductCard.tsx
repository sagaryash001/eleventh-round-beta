import React from 'react'

// Clip-corner HUD module card — the Blackout-Noir product surface used in the
// hero's Stage 05 (Product Reveal). A code tag (F-01), a Bebas display title, and
// a Share Tech Mono sub-label, on a clip-corner glass panel.

export interface HeroProductCardProps {
  code: string   // e.g. "F-01"
  title: string  // e.g. "SponsorForge"
  sub: string    // e.g. "SPONSORSHIP MATCHING & DEAL FLOW"
  className?: string
}

export default function HeroProductCard({ code, title, sub, className = '' }: HeroProductCardProps) {
  return (
    <div className={`hud-panel hud-module ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="hud-module__code">{code}</span>
        <span className="hud-module__arrow" aria-hidden>▸</span>
      </div>
      <div className="hud-module__title">{title}</div>
      <div className="hud-module__sub mt-1.5">{sub}</div>
    </div>
  )
}
