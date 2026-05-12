import React, { useEffect, useRef, useState } from 'react'
import { PROBLEMS } from '../data/problems'

// Hex node
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
      <div className="font-condensed font-bold mb-1 transition-colors duration-300"
        style={{ fontSize:10, letterSpacing:'0.25em', color: active?'#c00000':'#4a4846' }}>
        {num}
      </div>

      {/* Hex shape */}
      <div className="relative flex items-center justify-center transition-all duration-300"
        style={{
          width:112, height:98,
          clipPath:'polygon(50% 0%,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)',
          background: active ? 'linear-gradient(135deg,#1e0202 0%,#3a0505 100%)' : hovered ? '#1a1a1d' : '#141416',
          boxShadow: active ? '0 0 28px rgba(139,0,0,0.4)' : 'none',
        }}>
        <span className="font-condensed font-bold text-center px-2 leading-tight relative z-10 transition-colors duration-300"
          style={{ fontSize:11, color: active?'#f0ece4':hovered?'#b8b4ae':'#7a7672' }}>
          {title}
        </span>
      </div>

      {/* Dashed border via SVG */}
      <svg className="absolute pointer-events-none" width="112" height="98"
        viewBox="0 0 112 98" style={{ top:20 }}>
        <polygon points="56,2 107,26 107,72 56,96 5,72 5,26"
          fill="none"
          stroke={active ? '#8b0000' : hovered ? '#4a4846' : '#2a2a2e'}
          strokeWidth="1" strokeDasharray="5 4"
          style={{ transition:'stroke 0.3s' }}
        />
      </svg>
    </button>
  )
}

// Detail panel
function DetailPanel({ problem }: { problem: typeof PROBLEMS[0] }) {
  const [shown, setShown] = useState(problem)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    setFading(true)
    const t = setTimeout(() => { setShown(problem); setFading(false) }, 200)
    return () => clearTimeout(t)
  }, [problem])

  return (
    <div className="bg-charcoal border border-charcoal-3 relative overflow-hidden" style={{ borderLeft:'2px solid #8b0000', minHeight:360 }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background:'radial-gradient(ellipse at 80% 15%,rgba(139,0,0,0.09) 0%,transparent 60%)' }} />
      <div className="relative z-10 p-10 transition-all duration-200"
        style={{ opacity: fading?0:1, transform: fading?'translateY(8px)':'translateY(0)' }}>
        <div className="font-condensed font-bold uppercase text-blood-glow mb-3"
          style={{ fontSize:10, letterSpacing:'0.4em' }}>{shown.num} / 09</div>
        <h3 className="font-display text-off-white uppercase mb-5"
          style={{ fontSize:'clamp(26px,3vw,46px)', lineHeight:0.95 }}>
          {shown.title}
        </h3>
        <p className="font-body text-gray-2 leading-relaxed mb-6 pb-6 border-b border-charcoal-3"
          style={{ fontSize:14 }}>
          {shown.why}
        </p>
        <div className="font-condensed font-bold uppercase text-blood-glow mb-2.5"
          style={{ fontSize:9, letterSpacing:'0.4em' }}>The Eleventh Round Solution</div>
        <p className="text-off-white leading-relaxed" style={{ fontSize:14 }}>
          {shown.solution}
        </p>
      </div>
    </div>
  )
}

export default function ProblemsSection() {
  const [active,  setActive]  = useState(0)
  const [visible, setVisible] = useState<boolean[]>(Array(9).fill(false))
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
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
    return () => obs.disconnect()
  }, [])

  // Fixed grid: 5 nodes row 1, 4 nodes row 2
  // Each row uses a flex row with fixed spacing so they NEVER wrap
  const row1 = PROBLEMS.slice(0, 5)   // 01–05
  const row2 = PROBLEMS.slice(5, 9)   // 06–09

  return (
    <section id="problems" ref={sectionRef} className="bg-near-black py-28 px-10 relative overflow-hidden">
      <div className="red-rule absolute top-0 left-0 right-0" />

      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="mb-16">
          <div className="sec-label reveal mb-4">The Problem</div>
          <h2 className="reveal font-display text-off-white uppercase mb-6"
            style={{ fontSize:'clamp(52px,7vw,108px)', lineHeight:0.88 }}>
            The Industry<br />Fails <span className="text-blood-glow">Fighters.</span>
          </h2>
          <p className="reveal font-body font-light text-gray-1 max-w-[500px] leading-relaxed" style={{ fontSize:15 }}>
            No standardized systems. No structured support. Talent gets wasted because the infrastructure was never built.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left: hex map — two fixed rows */}
          <div className="reveal">
            {/* Row 1 — 5 nodes, no wrap */}
            <div className="flex items-end" style={{ gap:0, marginBottom:8 }}>
              {row1.map((p, i) => (
                <React.Fragment key={p.id}>
                  {/* Offset every other node down */}
                  <div style={{ marginTop: i % 2 === 1 ? 24 : 0, flexShrink:0 }}>
                    <HexNode num={p.num} title={p.title} active={active===p.id} visible={visible[p.id]} onClick={() => setActive(p.id)} />
                  </div>
                  {/* Connector between nodes */}
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

            {/* Vertical connector */}
            <div style={{ marginLeft:56, width:1, height:20, background:'linear-gradient(#2a2a2e,transparent)', opacity:0.7 }} />

            {/* Row 2 — 4 nodes, offset right to stagger under row 1 */}
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

            <p className="font-condensed uppercase text-gray-3 mt-6"
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
          <p className="font-condensed font-bold italic text-off-white"
            style={{ fontSize:'clamp(18px,2.4vw,30px)', letterSpacing:'0.02em', lineHeight:1.3 }}>
            The Eleventh Round{' '}
            <span className="text-blood-glow not-italic">supports</span>{' '}
            fighters and managers —{' '}
            <span className="text-blood-glow not-italic">it does not replace them.</span>
          </p>
        </div>
      </div>
    </section>
  )
}
