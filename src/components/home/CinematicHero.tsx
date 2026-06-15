import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { StageBoot, StageHologram, StageTable, StageHyper, StageReveal } from './HeroStages'
import { INTRO_FADE_EVENT } from './IntroWalkout'

// ─────────────────────────────────────────────────────────────────────────────
// CinematicHero — "Blackout Noir" storyboard as ONE pinned scroll sequence.
//
// A single GSAP ScrollTrigger timeline camera-journeys through five stacked stage
// layers (Boot → Hologram → Command Table → Hyperspace → Product Reveal) over a
// persistent, less-zoomed octagon background. The walkout intro hands off into the
// Boot wake-up (no black frame). Mobile / reduced-motion: no pin — CSS shows only
// the resting Product-Reveal hero, stacked.
// ─────────────────────────────────────────────────────────────────────────────

export default function CinematicHero() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const stageRef   = useRef<HTMLDivElement>(null)
  const bgRef      = useRef<HTMLDivElement>(null)
  const bootRef    = useRef<HTMLDivElement>(null)
  const holoRef    = useRef<HTMLDivElement>(null)
  const tableRef   = useRef<HTMLDivElement>(null)
  const hyperRef   = useRef<HTMLDivElement>(null)
  const revealRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const q  = gsap.utils.selector(sectionRef)
      const mm = gsap.matchMedia()

      const introPending = (() => {
        try { if (sessionStorage.getItem('er_intro_walkout_v1') === '1') return false } catch { /* */ }
        try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false } catch { /* */ }
        return true
      })()
      const FALLBACK_MS = 15000
      const gateEntrance = (tl: gsap.core.Timeline): (() => void) => {
        if (!introPending) { tl.play(0); return () => {} }
        const start = () => tl.play(0)
        window.addEventListener(INTRO_FADE_EVENT, start, { once: true })
        const fb = window.setTimeout(start, FALLBACK_MS)
        return () => { window.removeEventListener(INTRO_FADE_EVENT, start); window.clearTimeout(fb) }
      }

      // ── Desktop + motion: one pinned, scrubbed 5-stage timeline ─────────────
      mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
        const bootLines = q('.cine-boot-title > div')

        // Initial states — only Boot is present; later stages wait offscreen.
        gsap.set(bgRef.current, { scale: 1 })
        gsap.set([holoRef.current, tableRef.current, hyperRef.current, revealRef.current], { autoAlpha: 0 })
        gsap.set(bootRef.current, { autoAlpha: 0 })
        gsap.set('.cine-boot-tick, .cine-boot-sub', { autoAlpha: 0, y: 14 })
        gsap.set(bootLines, { autoAlpha: 0, yPercent: 70 })

        // (A) Boot wake-up — gated behind the intro handoff (cross-fades in).
        const intro = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } })
        intro
          .to(bootRef.current, { autoAlpha: 1, duration: 0.3, ease: 'none' }, 0)
          .to('.cine-boot-tick', { autoAlpha: 1, y: 0, duration: 0.5 }, 0.1)
          .to(bootLines, { autoAlpha: 1, yPercent: 0, stagger: 0.1, duration: 0.7 }, 0.2)
          .to('.cine-boot-sub', { autoAlpha: 1, y: 0, duration: 0.5 }, 0.6)
        const ungate = gateEntrance(intro)

        // (B) The single pinned, scrubbed timeline (normalized 0 → 1, ~220vh).
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top top',
            end: '+=220%',
            scrub: 0.6,
            pin: stageRef.current,
            anticipatePin: 1,
          },
        })

        tl
          // Persistent slow background drift the whole way.
          .to(bgRef.current, { yPercent: -3, ease: 'none', duration: 1 }, 0)

          // Boot → Hologram (~10–22%)
          .to(bootRef.current, { autoAlpha: 0, ease: 'none', duration: 0.07 }, 0.12)
          .fromTo(holoRef.current, { autoAlpha: 0 }, { autoAlpha: 1, ease: 'none', duration: 0.07 }, 0.12)
          .fromTo(q('.cine-pillar'), { autoAlpha: 0, x: 44 }, { autoAlpha: 1, x: 0, stagger: 0.03, ease: 'power2.out', duration: 0.12 }, 0.14)

          // Hologram → Command Table (~30–46%)
          .to(holoRef.current, { autoAlpha: 0, ease: 'none', duration: 0.07 }, 0.32)
          .fromTo(tableRef.current, { autoAlpha: 0 }, { autoAlpha: 1, ease: 'none', duration: 0.07 }, 0.32)
          .fromTo(q('.cine-table__ring'), { autoAlpha: 0, scale: 0.86 }, { autoAlpha: 1, scale: 1, ease: 'power2.out', duration: 0.12 }, 0.33)
          .fromTo(q('.cine-node'), { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, stagger: 0.04, ease: 'back.out(1.5)', duration: 0.12 }, 0.35)

          // Command Table → Hyperspace (~52–64%)
          .to(tableRef.current, { autoAlpha: 0, scale: 0.82, ease: 'power1.in', duration: 0.08 }, 0.52)
          .fromTo(hyperRef.current, { autoAlpha: 0 }, { autoAlpha: 1, ease: 'none', duration: 0.07 }, 0.53)
          .fromTo(q('.cine-streaks'), { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1.12, ease: 'power2.in', duration: 0.16 }, 0.53)
          .to(bgRef.current, { scale: 1.06, ease: 'power1.in', duration: 0.14 }, 0.54)

          // Hyperspace → Product Reveal (~70–86%)
          .to(hyperRef.current, { autoAlpha: 0, ease: 'power1.in', duration: 0.08 }, 0.70)
          .fromTo(revealRef.current, { autoAlpha: 0 }, { autoAlpha: 1, ease: 'none', duration: 0.07 }, 0.70)
          .to(bgRef.current, { scale: 1, ease: 'power2.out', duration: 0.18 }, 0.70)   // settle the push
          .fromTo(q('.cine-rv-line'), { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, stagger: 0.045, ease: 'power2.out', duration: 0.12 }, 0.72)
          .fromTo(q('.cine-module'), { autoAlpha: 0, y: 32 }, { autoAlpha: 1, y: 0, stagger: 0.04, ease: 'power2.out', duration: 0.12 }, 0.76)
          // Background dims ONLY in the final ~10%.
          .to(bgRef.current, { autoAlpha: 0.5, ease: 'none', duration: 0.10 }, 0.90)

        const t = window.setTimeout(() => ScrollTrigger.refresh(), 400)
        return () => { window.clearTimeout(t); ungate(); intro.kill(); tl.scrollTrigger?.kill(); tl.kill() }
      })

      // ── Mobile (motion): static reveal hero with a light fade-in, no pin ────
      mm.add('(max-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } })
        tl.from(q('.cine-layer-reveal .cine-rv-line'), { y: 16, autoAlpha: 0, stagger: 0.07, duration: 0.5 }, 0)
          .from(q('.cine-layer-reveal .cine-module'), { y: 16, autoAlpha: 0, stagger: 0.06, duration: 0.5 }, 0.2)
        const ungate = gateEntrance(tl)
        return () => { ungate(); tl.kill() }
      })

      // Reduced motion: no branch → CSS shows the static Product-Reveal hero.
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  // Secondary CTA — glide into the cinematic sequence.
  const scrollToHow = (e: React.MouseEvent) => {
    e.preventDefault()
    const target = window.innerHeight * 1.6
    const lenis = (window as any).__lenis
    if (lenis) lenis.scrollTo(target, { duration: 1.7 })
    else window.scrollTo({ top: target, behavior: 'smooth' })
  }

  return (
    <section ref={sectionRef} id="hero" className="cine-hero">
      <div ref={stageRef} className="cine-stage">

        {/* Persistent octagon environment (less-zoomed) + atmosphere */}
        <div ref={bgRef} className="cine-bg gpu" />
        <div className="cine-overlay cine-scrim-edges" />
        <div className="cine-overlay cine-scrim-left" />
        <div className="cine-overlay cine-vignette" />
        <div className="cine-overlay hud-grid" style={{ opacity: 0.5 }} />
        <div className="cine-smoke" aria-hidden />
        <div className="cine-overlay cine-floor-glow" />

        {/* Five stage layers — one pinned timeline cross-dissolves between them */}
        <StageBoot ref={bootRef} />
        <StageHologram ref={holoRef} />
        <StageTable ref={tableRef} />
        <StageHyper ref={hyperRef} />
        <StageReveal ref={revealRef} onSeeHow={scrollToHow} />
      </div>
    </section>
  )
}
