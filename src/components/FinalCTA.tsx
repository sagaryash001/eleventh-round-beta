import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export default function FinalCTA() {
  const sectionRef = useRef<HTMLElement>(null)
  const ghostRef   = useRef<HTMLDivElement>(null)

  // GSAP parallax on ghost XI + reveal
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced || !sectionRef.current) return

    const ctx = gsap.context(() => {
      // Ghost XI moves upward as section enters viewport — cinematic depth
      if (ghostRef.current) {
        gsap.to(ghostRef.current, {
          yPercent: -22,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 2,
          },
        })
      }

      // Stats stagger in on scroll
      gsap.from('.cta-stat-item', {
        opacity: 0,
        y: 28,
        stagger: 0.1,
        duration: 0.9,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.cta-stats-row',
          start: 'top 82%',
        },
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  // CSS reveal observer (same pattern as rest of site)
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.querySelectorAll('.reveal').forEach((el, i) => {
            setTimeout(() => el.classList.add('in-view'), i * 100)
          })
        }
      }),
      { threshold: 0.12 }
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="cta"
      className="bg-black py-36 px-10 relative overflow-hidden text-center"
    >
      <div className="fight-rule absolute top-0 left-0 right-0" />

      {/* Layered atmospheric background */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 60%, rgba(80,0,0,0.18) 0%, transparent 60%)',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 20% 80%, rgba(100,0,0,0.1) 0%, transparent 45%)',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 80% 20%, rgba(80,0,0,0.08) 0%, transparent 40%)',
      }} />

      {/* Ghost background XI — parallaxed */}
      <div
        ref={ghostRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-display
                   select-none pointer-events-none whitespace-nowrap leading-none gpu"
        style={{
          fontSize: 'clamp(180px,28vw,520px)',
          color: 'transparent',
          WebkitTextStroke: '1px rgba(255,255,255,0.04)',
          letterSpacing: '-0.02em',
        }}
        aria-hidden
      >
        XI
      </div>

      <div className="relative z-10 max-w-[860px] mx-auto">

        {/* Eyebrow */}
        <div className="reveal font-condensed text-[11px] font-bold tracking-[0.5em] uppercase text-blood-glow mb-6">
          The Eleventh Round
        </div>

        {/* Headline */}
        <h2
          className="reveal font-display text-off-white uppercase mb-8"
          style={{ fontSize:'clamp(60px,9.5vw,164px)', lineHeight:0.87 }}
        >
          <span className="text-blood-glow">Become</span><br />
          Eleventh Round<br />
          Ready.
        </h2>

        {/* Sub */}
        <p
          className="reveal font-condensed font-light text-gray-1 max-w-lg mx-auto mb-14"
          style={{ fontSize:'clamp(15px,1.9vw,22px)', letterSpacing:'0.06em', lineHeight:1.65 }}
        >
          Professionalism creates opportunity. Development is a system.
          Readiness is the differentiator.
        </p>

        {/* CTAs */}
        <div className="reveal flex gap-4 justify-center flex-wrap mb-20">
          <Link to="/login" className="btn-primary">Start for Fighters</Link>
          <Link to="/login" className="btn-primary">Start for Managers</Link>
          <Link to="/login" className="btn-ghost">See the Platform</Link>
        </div>

        {/* Stats row */}
        <div
          className="cta-stats-row flex justify-center gap-14 pt-14 flex-wrap"
          style={{ borderTop:'1px solid #1e1e22' }}
        >
          {[
            { n:'XI', l:'Rounds'     },
            { n:'3',  l:'Ecosystems' },
            { n:'∞',  l:'Careers'    },
            { n:'1',  l:'System'     },
          ].map(p => (
            <div key={p.l} className="cta-stat-item flex flex-col items-center gap-2">
              <span
                className="font-display text-blood-glow"
                style={{
                  fontSize:48,
                  lineHeight:1,
                  textShadow:'0 0 30px rgba(192,0,0,0.4)',
                }}
              >
                {p.n}
              </span>
              <span
                className="font-condensed font-bold uppercase text-gray-3"
                style={{ fontSize:10, letterSpacing:'0.3em' }}
              >
                {p.l}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
