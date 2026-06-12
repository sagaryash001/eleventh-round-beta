import React, { useEffect, useRef, useState } from 'react'
import { PROBLEMS } from '../data/problems'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

function HexNode({ num, title, active, visible, onClick }: {
  num: string; title: string; active: boolean; visible: boolean; onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col items-center text-center cursor-pointer border-0 bg-transparent p-0 focus:outline-none flex-shrink-0"
      style={{
        opacity:   visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.94)',
        transition:'opacity 0.55s cubic-bezier(.25,.46,.45,.94), transform 0.55s cubic-bezier(.25,.46,.45,.94)',
        width: 120,
      }}
    >
      <div className="font-narrow font-bold italic mb-1 transition-colors duration-300"
        style={{ fontSize:10, letterSpacing:'0.25em', color: active?'#C41E3A':'#4a4846' }}>
        {num}
      </div>

      <div className="relative flex items-center justify-center transition-all duration-300"
        style={{
          width:112, height:98,
          clipPath:'polygon(50% 0%,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)',
          background: active ? 'linear-gradient(135deg,#1e0202 0%,#3a0505 100%)' : hovered ? '#1a1a1d' : '#141416',
          boxShadow: active ? '0 0 28px rgba(196,30,58,0.35)' : 'none',
        }}>
        <span className="font-narrow font-bold italic text-center px-2 leading-tight relative z-10 transition-colors duration-300"
          style={{ fontSize:11, color: active?'#f0ece4':hovered?'#b8b4ae':'#7a7672' }}>
          {title}
        </span>
      </div>

      <svg className="absolute pointer-events-none" width="112" height="98"
        viewBox="0 0 112 98" style={{ top:20 }}>
        <polygon points="56,2 107,26 107,72 56,96 5,72 5,26"
          fill="none"
          stroke={active ? '#C41E3A' : hovered ? '#4a4846' : '#2a2a2e'}
          strokeWidth="1" strokeDasharray="5 4"
          style={{ transition:'stroke 0.3s' }}
        />
      </svg>
    </button>
  )
}

function DetailPanel({ problem }: { problem: typeof PROBLEMS[0] }) {
  const [shown, setShown] = useState(problem)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    setFading(true)
    const t = setTimeout(() => { setShown(problem); setFading(false) }, 200)
    return () => clearTimeout(t)
  }, [problem])

  return (
    <div style={{ display:'flex', alignItems:'stretch', gap:0 }}>
      <div style={{ width:2, flexShrink:0, background:'#C41E3A', borderRadius:1, marginLeft:40 }} />
      <div className="bg-charcoal border border-charcoal-3 relative overflow-hidden" style={{ minHeight:360, marginLeft:40, flex:1 }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background:'radial-gradient(ellipse at 80% 15%,rgba(196,30,58,0.07) 0%,transparent 60%)' }} />
      <div className="relative z-10 p-10 transition-all duration-200"
        style={{ opacity: fading?0:1, transform: fading?'translateY(8px)':'translateY(0)' }}>
        <div className="eyebrow mb-3">{shown.num} / 09</div>
        <h3 className="font-display text-off-white uppercase mb-5"
          style={{ fontSize:'clamp(26px,3vw,46px)', lineHeight:0.93 }}>
          {shown.title}
        </h3>
        <p className="font-narrow text-gray-2 leading-relaxed mb-6 pb-6 border-b border-charcoal-3"
          style={{ fontSize:14 }}>
          {shown.why}
        </p>
        <div className="eyebrow mb-2.5">The Eleventh Round Solution</div>
        <p className="font-narrow text-off-white leading-relaxed" style={{ fontSize:14 }}>
          {shown.solution}
        </p>
      </div>
    </div>
    </div>
  )
}

export default function ProblemsSection() {
  const [active,  setActive]  = useState(0)
  const [visible, setVisible] = useState<boolean[]>(Array(9).fill(false))
  const sectionRef  = useRef<HTMLDivElement>(null)
  const headerRef   = useRef<HTMLDivElement>(null)
  const line1Ref    = useRef<HTMLSpanElement>(null)
  const line2Ref    = useRef<HTMLSpanElement>(null)
  const eyebrowRef  = useRef<HTMLDivElement>(null)
  const subRef      = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Hex node stagger — IntersectionObserver (lightweight)
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        PROBLEMS.forEach((_, i) => {
          setTimeout(() => setVisible(prev => {
            const n = [...prev]; n[i] = true; return n
          }), i * 90)
        })
        obs.disconnect()
      }
    }, { threshold: 0.1 })
    if (sectionRef.current) obs.observe(sectionRef.current)

    // Headline clip-from-bottom (GSAP ScrollTrigger)
    if (!prefersReduced && headerRef.current) {
      const ctx = gsap.context(() => {
        gsap.from(eyebrowRef.current, {
          opacity: 0, y: 14,
          duration: 0.7, ease: 'power2.out',
          scrollTrigger: { trigger: headerRef.current, start: 'top 82%' },
        })
        gsap.from([line1Ref.current, line2Ref.current], {
          y: '110%',
          duration: 1.1,
          stagger: 0.09,
          ease: 'power4.out',
          scrollTrigger: { trigger: headerRef.current, start: 'top 80%' },
        })
        gsap.from(subRef.current, {
          opacity: 0, y: 20,
          duration: 0.8, ease: 'power2.out',
          scrollTrigger: { trigger: headerRef.current, start: 'top 75%' },
        })
      }, headerRef)
      return () => { ctx.revert(); obs.disconnect() }
    }

    return () => obs.disconnect()
  }, [])

  const row1 = PROBLEMS.slice(0, 5)
  const row2 = PROBLEMS.slice(5, 9)

  return (
    <section id="problems" ref={sectionRef} className="bg-near-black py-20 md:py-32 px-5 md:px-10 relative overflow-hidden">
      <div className="red-rule absolute top-0 left-0 right-0" />

      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div ref={headerRef} className="mb-16">
          <div ref={eyebrowRef} className="sec-label mb-5">The Problem</div>
          <h2 className="font-display text-off-white uppercase mb-6"
            style={{ fontSize:'clamp(52px,7.5vw,116px)', lineHeight:0.87, letterSpacing:'-0.02em' }}>
            <div className="line-clip">
              <span ref={line1Ref} className="block">The Industry</span>
            </div>
            <div className="line-clip">
              <span ref={line2Ref} className="block">
                Fails <span className="text-crimson">Fighters.</span>
              </span>
            </div>
          </h2>
          <p ref={subRef} className="font-narrow text-gray-1 max-w-[500px] leading-relaxed" style={{ fontSize:15 }}>
            No standardized systems. No structured support. Talent gets wasted because the infrastructure was never built.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-start">
          {/* Left: hex map */}
          <div className="reveal">
            <div className="flex items-end" style={{ gap:0, marginBottom:8 }}>
              {row1.map((p, i) => (
                <React.Fragment key={p.id}>
                  <div style={{ marginTop: i % 2 === 1 ? 24 : 0, flexShrink:0 }}>
                    <HexNode num={p.num} title={p.title} active={active===p.id} visible={visible[p.id]} onClick={() => setActive(p.id)} />
                  </div>
                  {i < row1.length - 1 && (
                    <div style={{
                      flexShrink:0, width:8, height:1,
                      borderTop:'1px dashed #2a2a2e',
                      alignSelf:'center',
                      marginTop: i%2===0 ? -12 : 12,
                      opacity: visible[p.id] ? 1:0, transition:'opacity 0.5s',
                    }} />
                  )}
                </React.Fragment>
              ))}
            </div>

            <div style={{ marginLeft:56, width:1, height:20, background:'linear-gradient(#2a2a2e,transparent)', opacity:0.7 }} />

            <div className="flex items-end" style={{ gap:0, marginLeft:16 }}>
              {row2.map((p, i) => (
                <React.Fragment key={p.id}>
                  <div style={{ marginTop: i % 2 === 0 ? 24 : 0, flexShrink:0 }}>
                    <HexNode num={p.num} title={p.title} active={active===p.id} visible={visible[p.id]} onClick={() => setActive(p.id)} />
                  </div>
                  {i < row2.length - 1 && (
                    <div style={{
                      flexShrink:0, width:8, height:1,
                      borderTop:'1px dashed #2a2a2e',
                      alignSelf:'center',
                      marginTop: i%2===1 ? -12 : 12,
                      opacity: visible[p.id] ? 1:0, transition:'opacity 0.5s',
                    }} />
                  )}
                </React.Fragment>
              ))}
            </div>

            <p className="font-narrow italic uppercase text-gray-3 mt-6"
              style={{ fontSize:10, letterSpacing:'0.3em', opacity: visible[8]?1:0, transition:'opacity 0.5s 0.5s' }}>
              Select a node to explore
            </p>
          </div>

          {/* Right: detail panel */}
          <div className="lg:sticky lg:top-[100px] reveal reveal-delay-2">
            <DetailPanel problem={PROBLEMS[active]} />
          </div>
        </div>

        {/* Truth statement */}
        <div className="mt-20 pt-9 border-t border-charcoal-3 reveal reveal-delay-3">
          <p className="font-narrow font-bold italic text-off-white"
            style={{ fontSize:'clamp(18px,2.4vw,30px)', lineHeight:1.3 }}>
            The Eleventh Round{' '}
            <span className="text-crimson not-italic">supports</span>{' '}
            fighters and managers —{' '}
            <span className="text-crimson not-italic">it does not replace them.</span>
          </p>
        </div>
      </div>
    </section>
  )
}
