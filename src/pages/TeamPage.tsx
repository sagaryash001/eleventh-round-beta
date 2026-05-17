import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { FOUNDER, MANAGERS } from '../data/team'

// ── Headshot — shows styled placeholder until real image loads ────────────────
function Headshot({
  src,
  name,
  className = '',
  style = {},
  children,
}: {
  src: string
  name: string
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}) {
  const [loaded, setLoaded] = useState(false)
  const initials = name
    .replace(/TODO\s*—?\s*/gi, '')
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      <div className="absolute inset-0 bg-charcoal-2" />

      {!loaded && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,#1a1a1d 0,#1a1a1d 1px,transparent 1px,transparent 40px),' +
              'repeating-linear-gradient(90deg,#1a1a1d 0,#1a1a1d 1px,transparent 1px,transparent 40px)',
            opacity: 0.5,
          }}
        />
      )}

      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        style={{ opacity: loaded ? 0 : 0.06, transition: 'opacity 0.6s' }}
      >
        <span
          className="font-display text-off-white uppercase"
          style={{ fontSize: 'clamp(64px,10vw,128px)', letterSpacing: '-0.02em' }}
        >
          {initials}
        </span>
      </div>

      <img
        src={src}
        alt={name}
        onLoad={() => setLoaded(true)}
        className="absolute inset-0 w-full h-full object-cover object-top"
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.7s ease', filter: 'grayscale(8%)' }}
      />

      {children}
    </div>
  )
}

// ── Manager card ──────────────────────────────────────────────────────────────
function ManagerCard({
  manager,
  visible,
  delay,
}: {
  manager: (typeof MANAGERS)[0]
  visible: boolean
  delay: number
}) {
  const [hovered, setHovered] = useState(false)
  const isTodo = manager.name.startsWith('TODO')

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative bg-charcoal border border-charcoal-3 overflow-hidden"
      style={{
        opacity:   visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(36px)',
        transition: `opacity 0.75s ${delay}s cubic-bezier(.25,.46,.45,.94),
                     transform 0.75s ${delay}s cubic-bezier(.25,.46,.45,.94)`,
      }}
    >
      {/* Red top-rule on hover */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1, zIndex: 2,
        background: 'linear-gradient(90deg, #8b0000, transparent)',
        opacity: hovered ? 1 : 0, transition: 'opacity 0.3s',
      }} />

      <Headshot src={manager.photo} name={manager.name} style={{ aspectRatio: '4/5' }}>
        {/* Bottom vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(8,8,8,0.88) 0%, rgba(8,8,8,0.1) 45%, transparent 100%)',
            zIndex: 1,
          }}
        />
        {/* Image scale on hover — wrapper trick */}
        <div
          className="absolute inset-0"
          style={{
            transform: hovered ? 'scale(1.04)' : 'scale(1)',
            transition: 'transform 0.65s cubic-bezier(.25,.46,.45,.94)',
          }}
        />
      </Headshot>

      <div className="p-6 relative z-10">
        <div
          className="font-condensed font-bold uppercase text-blood-glow mb-2"
          style={{ fontSize: 9, letterSpacing: '0.45em' }}
        >
          {isTodo ? 'Role — TODO' : manager.role}
        </div>
        <h3
          className="font-display text-off-white uppercase mb-3"
          style={{ fontSize: 'clamp(24px,2.8vw,36px)', lineHeight: 0.92 }}
        >
          {isTodo ? '—' : manager.name}
        </h3>
        <p className="font-narrow text-gray-2 leading-relaxed" style={{ fontSize: 13 }}>
          {isTodo ? 'Bio copy pending.' : manager.bio}
        </p>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const pageRef     = useRef<HTMLDivElement>(null)
  const headerRef   = useRef<HTMLDivElement>(null)
  const line1Ref    = useRef<HTMLSpanElement>(null)
  const line2Ref    = useRef<HTMLSpanElement>(null)
  const eyebrowRef  = useRef<HTMLDivElement>(null)
  const subRef      = useRef<HTMLParagraphElement>(null)
  const founderRef  = useRef<HTMLDivElement>(null)
  const managersRef = useRef<HTMLDivElement>(null)
  const [cardsVisible, setCardsVisible] = useState(false)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Stagger cards in via IntersectionObserver
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setCardsVisible(true); obs.disconnect() } },
      { threshold: 0.08 },
    )
    if (managersRef.current) obs.observe(managersRef.current)

    if (prefersReduced) return () => obs.disconnect()

    const ctx = gsap.context(() => {
      // Hero headline clip-from-bottom
      gsap.from(eyebrowRef.current, {
        opacity: 0, y: 14, duration: 0.7, ease: 'power2.out',
        scrollTrigger: { trigger: headerRef.current, start: 'top 85%' },
      })
      gsap.from([line1Ref.current, line2Ref.current], {
        y: '110%', duration: 1.1, stagger: 0.09, ease: 'power4.out',
        scrollTrigger: { trigger: headerRef.current, start: 'top 82%' },
      })
      gsap.from(subRef.current, {
        opacity: 0, y: 20, duration: 0.8, ease: 'power2.out',
        scrollTrigger: { trigger: headerRef.current, start: 'top 78%' },
      })

      // Founder block slides in
      if (founderRef.current) {
        gsap.from(founderRef.current, {
          opacity: 0, x: -48, duration: 1.1, ease: 'power3.out',
          scrollTrigger: { trigger: founderRef.current, start: 'top 80%' },
        })
      }
    }, pageRef)

    return () => { ctx.revert(); obs.disconnect() }
  }, [])

  const founderTitle = FOUNDER.title.replace(/^TODO\s*—?\s*/i, '')
  const founderBio   = FOUNDER.bio.replace(/^TODO\s*—?\s*/i, '')
  const founderIsTodo = FOUNDER.bio.startsWith('TODO')

  return (
    <div ref={pageRef} className="min-h-screen bg-black">
      <Navbar />

      {/* ── Page hero ── */}
      <section className="relative pt-36 pb-20 px-10 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 20% 60%, rgba(139,0,0,0.10) 0%, transparent 55%),' +
              'radial-gradient(ellipse at 80% 20%, rgba(139,0,0,0.06) 0%, transparent 45%)',
          }}
        />
        <div ref={headerRef} className="max-w-[1200px] mx-auto relative z-10">
          <div ref={eyebrowRef} className="sec-label mb-5">Team · Eleventh Round</div>
          <h1
            className="font-display text-off-white uppercase mb-6"
            style={{
              fontSize: 'clamp(64px,9vw,148px)',
              lineHeight: 0.87,
              letterSpacing: '-0.02em',
            }}
          >
            <div className="line-clip">
              <span ref={line1Ref} className="block">The Team</span>
            </div>
            <div className="line-clip">
              <span ref={line2Ref} className="block">
                Behind the{' '}
                <span className="text-blood-glow">Round.</span>
              </span>
            </div>
          </h1>
          <p
            ref={subRef}
            className="font-condensed font-light text-gray-1 leading-relaxed tracking-wide"
            style={{ fontSize: 16, maxWidth: 520 }}
          >
            Real operators. Real systems. Built by people who understand what fighters
            and managers actually need to succeed — in and out of competition.
          </p>
        </div>
      </section>

      <div className="red-rule" />

      {/* ── Founder ── */}
      <section className="py-20 px-10">
        <div className="max-w-[1200px] mx-auto">
          <div className="sec-label mb-10">Founder &amp; Vision</div>

          <div
            ref={founderRef}
            className="grid grid-cols-1 lg:grid-cols-2 gap-0 border border-charcoal-3 overflow-hidden"
            style={{ borderLeft: '2px solid #8b0000' }}
          >
            {/* LEFT — headshot */}
            <div className="relative" style={{ minHeight: 560 }}>
              <Headshot
                src={FOUNDER.photo}
                name={FOUNDER.name}
                className="absolute inset-0"
                style={{ height: '100%', width: '100%' }}
              >
                {/* Cinematic fade to info panel */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(to right, transparent 50%, rgba(20,20,22,0.92) 100%),' +
                      'linear-gradient(to top, rgba(8,8,8,0.55) 0%, transparent 35%)',
                    zIndex: 1,
                  }}
                />
                {/* Top red accent line */}
                <div
                  className="absolute top-0 left-0 right-0 pointer-events-none"
                  style={{
                    height: 1,
                    background: 'linear-gradient(90deg, #8b0000 0%, transparent 60%)',
                    zIndex: 2,
                  }}
                />
              </Headshot>
            </div>

            {/* RIGHT — info */}
            <div className="bg-charcoal p-10 lg:p-14 flex flex-col justify-center relative">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse at 0% 50%, rgba(139,0,0,0.09) 0%, transparent 65%)',
                }}
              />
              <div className="relative z-10">
                <div
                  className="font-condensed font-bold uppercase text-blood-glow mb-3"
                  style={{ fontSize: 9, letterSpacing: '0.5em' }}
                >
                  {founderTitle || 'Founder'}
                </div>

                <h2
                  className="font-display text-off-white uppercase"
                  style={{
                    fontSize: 'clamp(52px,5.5vw,96px)',
                    lineHeight: 0.88,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {FOUNDER.name}
                </h2>

                <div
                  style={{
                    width: 56, height: 2,
                    background: '#8b0000',
                    boxShadow: '0 0 10px rgba(139,0,0,0.5)',
                    margin: '24px 0',
                  }}
                />

                <p
                  className="font-narrow text-gray-1 leading-relaxed mb-8"
                  style={{ fontSize: 15, maxWidth: 480 }}
                >
                  {founderIsTodo
                    ? 'Bio copy pending — update FOUNDER.bio in src/data/team.ts.'
                    : founderBio}
                </p>

                <div className="flex gap-3 flex-wrap">
                  <a href="/#products" className="btn-primary">The Platform</a>
                  <a href="/apparel"   className="btn-ghost">Apparel</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="red-rule" />

      {/* ── Managers ── */}
      <section className="py-20 px-10 bg-near-black relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 90% 10%, rgba(139,0,0,0.07) 0%, transparent 50%)',
          }}
        />
        <div className="max-w-[1200px] mx-auto relative z-10">
          <div className="sec-label mb-4">The Management Team</div>
          <p className="font-narrow text-gray-2 mb-12" style={{ fontSize: 14, maxWidth: 440 }}>
            The operators and support staff behind The Eleventh Round's systems and
            fighter-facing programs.
          </p>

          <div ref={managersRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {MANAGERS.map((manager, i) => (
              <ManagerCard
                key={manager.id}
                manager={manager}
                visible={cardsVisible}
                delay={i * 0.12}
              />
            ))}
          </div>

          {/* Closing statement */}
          <div className="mt-20 pt-9 border-t border-charcoal-3">
            <p
              className="font-narrow font-bold italic text-off-white"
              style={{ fontSize: 'clamp(17px,2.2vw,28px)', lineHeight: 1.4 }}
            >
              A team built on{' '}
              <span className="text-crimson not-italic">discipline</span>,
              operating with{' '}
              <span className="text-crimson not-italic">purpose.</span>
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
