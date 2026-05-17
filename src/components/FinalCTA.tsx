import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export default function FinalCTA() {
  const sectionRef  = useRef<HTMLElement>(null)
  const ghostRef    = useRef<HTMLDivElement>(null)
  const headlineRef = useRef<HTMLHeadingElement>(null)
  const line1Ref    = useRef<HTMLSpanElement>(null)
  const line2Ref    = useRef<HTMLSpanElement>(null)
  const line3Ref    = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced || !sectionRef.current) return

    const ctx = gsap.context(() => {
      // Ghost XI parallax
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

      // Headline lines clip in
      gsap.from([line1Ref.current, line2Ref.current, line3Ref.current], {
        y: '110%',
        duration: 1.1,
        stagger: 0.09,
        ease: 'power4.out',
        scrollTrigger: {
          trigger: headlineRef.current,
          start: 'top 82%',
        },
      })

      // Stats stagger
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

  // CSS reveal observer
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
      className="bg-black py-40 px-10 relative overflow-hidden text-center"
    >
      <div className="fight-rule absolute top-0 left-0 right-0" />

      {/* Layered atmosphere */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 60%, rgba(196,30,58,0.12) 0%, transparent 60%)',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 20% 80%, rgba(139,0,0,0.08) 0%, transparent 45%)',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 80% 20%, rgba(80,0,0,0.06) 0%, transparent 40%)',
      }} />

      {/* Ghost background XI — parallaxed */}
      <div
        ref={ghostRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-display
                   select-none pointer-events-none whitespace-nowrap leading-none gpu"
        style={{
          fontSize: 'clamp(180px,28vw,520px)',
          color: 'transparent',
          WebkitTextStroke: '1px rgba(255,255,255,0.03)',
          letterSpacing: '-0.02em',
        }}
        aria-hidden
      >
        XI
      </div>

      <div className="relative z-10 max-w-[900px] mx-auto">

        {/* Eyebrow */}
        <div className="reveal eyebrow justify-center mb-7" style={{ display: 'flex' }}>
          The Eleventh Round
        </div>

        {/* Headline — Stitch-inspired skewed treatment */}
        <h2
          ref={headlineRef}
          className="font-display text-off-white uppercase mb-10"
          style={{
            fontSize: 'clamp(64px,10vw,172px)',
            lineHeight: 0.85,
            letterSpacing: '-0.03em',
            transform: 'skewX(-2deg)',
          }}
        >
          <div className="line-clip">
            <span ref={line1Ref} className="block">
              <span className="text-crimson italic">Become</span>
            </span>
          </div>
          <div className="line-clip">
            <span ref={line2Ref} className="block italic">Eleventh Round</span>
          </div>
          <div className="line-clip">
            <span ref={line3Ref} className="block italic">Ready.</span>
          </div>
        </h2>

        {/* Sub */}
        <p
          className="reveal font-narrow text-gray-1 max-w-lg mx-auto mb-14"
          style={{ fontSize:'clamp(15px,1.8vw,20px)', lineHeight:1.7 }}
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
                className="font-display text-crimson italic"
                style={{
                  fontSize: 48,
                  lineHeight: 1,
                  textShadow: '0 0 30px rgba(196,30,58,0.4)',
                }}
              >
                {p.n}
              </span>
              <span
                className="font-narrow font-bold italic uppercase text-gray-3"
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
