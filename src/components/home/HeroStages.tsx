import React, { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import HeroProductCard from './HeroProductCard'

// ─────────────────────────────────────────────────────────────────────────────
// The five "Blackout Noir" stage layers + small HUD primitives. Each stage is an
// absolutely-positioned layer inside the pinned hero stage; CinematicHero drives
// the cross-dissolve / transforms between them. Layouts/copy follow the exported
// storyboard. Content is real HTML — nothing baked into an image.
// ─────────────────────────────────────────────────────────────────────────────

export function HudTick({ children, tone = '', className = '' }:
  { children: React.ReactNode; tone?: '' | 'crimson' | 'cyan'; className?: string }) {
  return <span className={`hud-tick ${tone ? `hud-tick--${tone}` : ''} ${className}`}>{children}</span>
}

// ── Stage 01 — Boot-up / Welcome ──────────────────────────────────────────────
export const StageBoot = forwardRef<HTMLDivElement>((_, ref) => (
  <div ref={ref} className="cine-stage-layer cine-layer-boot">
    <div className="cine-layer-inner">
      <div className="cine-boot-tick flex items-center gap-4 mb-7">
        <HudTick tone="crimson">SEQ 01 / 05</HudTick>
        <span className="hud-tick">▸ INITIALIZING · 11R-CORE</span>
      </div>
      <div className="cine-boot-title font-display uppercase text-off-white" style={{ lineHeight: 0.92, letterSpacing: '-0.01em' }}>
        <div style={{ fontSize: 'clamp(20px,2.4vw,34px)', color: '#9a8388' }}>Welcome to</div>
        <div style={{ fontSize: 'clamp(56px,9vw,150px)' }}>The Eleventh</div>
        <div style={{ fontSize: 'clamp(56px,9vw,150px)', color: '#e11d2a', textShadow: '0 0 40px rgba(225,29,42,0.4)' }}>Round</div>
      </div>
      <div className="cine-boot-sub mt-7 flex items-center gap-4 flex-wrap">
        <HudTick>The fight after the fight</HudTick>
        <span className="hud-tick" style={{ opacity: 0.6 }}>SYS.ONLINE // SECTOR 11</span>
      </div>
    </div>
  </div>
))
StageBoot.displayName = 'StageBoot'

// ── Stage 02 — Horizontal Hologram Flow ───────────────────────────────────────
const PILLARS = [
  { n: '01', name: 'Fighters',   sub: 'ATHLETES' },
  { n: '02', name: 'Managers',   sub: 'REPRESENTATION' },
  { n: '03', name: 'Sponsors',   sub: 'BRAND CAPITAL', focus: true },
  { n: '04', name: 'Promotions', sub: 'EVENT COMMAND' },
]
export const StageHologram = forwardRef<HTMLDivElement>((_, ref) => (
  <div ref={ref} className="cine-stage-layer cine-layer-hologram">
    <div className="cine-layer-inner">
      <div className="cine-holo-head flex items-center gap-4 mb-6">
        <HudTick tone="crimson">SEQ 02 / 05</HudTick>
        <span className="hud-tick">ENTITY STREAM // FOUR PILLARS</span>
        <span className="hud-tick--crimson hud-tick">▸▸▸</span>
      </div>
      <div className="cine-pillars">
        {PILLARS.map(p => (
          <div key={p.n} className="cine-pillar hud-panel">
            <div className="flex items-center justify-between">
              <span className="hud-module__code">{p.n}</span>
              {p.focus && <span className="hud-tick--cyan hud-tick" style={{ fontSize: 8 }}>▮ IN FOCUS</span>}
            </div>
            <div>
              <div className="font-display uppercase text-off-white" style={{ fontSize: 'clamp(22px,2.4vw,30px)', lineHeight: 1 }}>{p.name}</div>
              <div className="hud-module__sub mt-1">{p.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6"><HudTick>04 ENTITIES TRACKED</HudTick></div>
    </div>
  </div>
))
StageHologram.displayName = 'StageHologram'

// ── Stage 03 — Circular Command Table ─────────────────────────────────────────
// top / right / bottom / left positions around the ring.
const NODES = [
  { name: 'Fighters',   tag: '01 · ATHLETES', pos: { left: '50%', top: '4%' } },
  { name: 'Sponsors',   tag: '03 · CAPITAL',  pos: { left: '96%', top: '50%' } },
  { name: 'Promotions', tag: '04 · EVENTS',   pos: { left: '50%', top: '96%' } },
  { name: 'Managers',   tag: '02 · REP',      pos: { left: '4%',  top: '50%' } },
]
export const StageTable = forwardRef<HTMLDivElement>((_, ref) => (
  <div ref={ref} className="cine-stage-layer cine-layer-table" style={{ justifyContent: 'center', flexDirection: 'column' }}>
    <div className="cine-layer-inner" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="mb-6"><HudTick tone="crimson">SEQ 03 / 05</HudTick> <span className="hud-tick ml-3">ROUND-TABLE COMMAND</span></div>
      <div className="cine-table">
        <div className="cine-table__ring" />
        <div className="cine-table__core hud-panel hud-glow">
          <span className="font-display text-off-white" style={{ fontSize: 30, letterSpacing: '0.04em' }}>11R</span>
        </div>
        {NODES.map(nd => (
          <div key={nd.name} className="cine-node hud-panel" style={{ left: nd.pos.left, top: nd.pos.top }}>
            <div className="font-display uppercase text-off-white" style={{ fontSize: 18, lineHeight: 1 }}>{nd.name}</div>
            <div className="hud-module__sub mt-1">{nd.tag}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
))
StageTable.displayName = 'StageTable'

// ── Stage 04 — Hyperspace Transition ──────────────────────────────────────────
export const StageHyper = forwardRef<HTMLDivElement>((_, ref) => (
  <div ref={ref} className="cine-stage-layer cine-layer-hyper" style={{ justifyContent: 'center' }}>
    <div className="cine-streaks" aria-hidden />
    <div className="cine-layer-inner cine-hyper-text" style={{ textAlign: 'center' }}>
      <div className="font-display uppercase text-off-white" style={{ fontSize: 'clamp(30px,5vw,68px)', lineHeight: 1, textShadow: '0 0 40px rgba(225,29,42,0.45)' }}>
        Entering Command Space
      </div>
      <div className="mt-5 flex items-center justify-center gap-5 flex-wrap">
        <HudTick>JUMP // FORWARD VECTOR</HudTick>
        <HudTick tone="crimson">VEL ▸ 0.97c</HudTick>
      </div>
    </div>
  </div>
))
StageHyper.displayName = 'StageHyper'

// ── Stage 05 — Product Reveal (resting hero) ──────────────────────────────────
const MODULES = [
  { code: 'F-01', title: 'SponsorForge',         sub: 'Sponsorship matching & deal flow' },
  { code: 'E-02', title: 'Event Calendar',       sub: 'Fight-night scheduling' },
  { code: 'C-03', title: 'Contract Obligations', sub: 'Clause & deadline tracking' },
  { code: 'M-04', title: 'Manager Roster',       sub: 'Athlete portfolio control' },
  { code: 'G-05', title: 'Fighter Growth',       sub: 'Career trajectory analytics' },
  { code: 'P-06', title: 'Promotion Operations', sub: 'End-to-end event ops' },
]
export const StageReveal = forwardRef<HTMLDivElement, { onSeeHow: (e: React.MouseEvent) => void }>(({ onSeeHow }, ref) => (
  <div ref={ref} className="cine-stage-layer cine-layer-reveal">
    <div className="cine-layer-inner">
      <div className="cine-reveal">
        {/* Left — copy */}
        <div className="cine-reveal-left">
          <div className="mb-5 flex items-center gap-3">
            <HudTick tone="crimson">SEQ 05 / 05</HudTick>
            <span className="eyebrow">The Eleventh Round</span>
          </div>
          <h1 className="font-display uppercase text-off-white" style={{ margin: 0, lineHeight: 0.9, letterSpacing: '-0.02em' }}>
            <div className="cine-rv-line" style={{ fontSize: 'clamp(40px,6vw,92px)' }}>Built for the</div>
            <div className="cine-rv-line" style={{ fontSize: 'clamp(40px,6vw,92px)' }}>fight after</div>
            <div className="cine-rv-line" style={{ fontSize: 'clamp(40px,6vw,92px)' }}>the <span style={{ color: '#e11d2a', textShadow: '0 0 36px rgba(225,29,42,0.4)' }}>fight.</span></div>
          </h1>
          <p className="font-narrow text-gray-1 cine-rv-line" style={{ marginTop: 22, maxWidth: 520, fontSize: 'clamp(14px,1.5vw,18px)', lineHeight: 1.7 }}>
            The command center connecting fighters, managers, sponsors, and promotions —
            from event prep to sponsorships, contracts, obligations, and career growth.
          </p>
          <div className="cine-rv-line" style={{ marginTop: 30, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/login" className="btn-primary">Enter the Platform</Link>
            <a href="#hero" onClick={onSeeHow} className="btn-ghost">See How It Works ▸</a>
          </div>
        </div>
        {/* Right — six modules */}
        <div className="cine-modules">
          {MODULES.map(m => <HeroProductCard key={m.code} {...m} className="cine-module" />)}
        </div>
      </div>
    </div>
  </div>
))
StageReveal.displayName = 'StageReveal'
