import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

const TESTIMONIALS = [
  {
    id: 0,
    name: 'Patrick "The Irishman" Sullivan',
    credential: 'BKFC Prospect & Main Card Top Attraction · Philadelphia\'s Very Own',
    quote:
      'As a professional fighter for the BKFC, Kevin Leka and The Eleventh Round have helped me more than many people I\'ve known in combat sports for my entire life. The best in the business. As loyal, professional, and reliable as they come!',
    photo: '/testimonials/patrick-sullivan.png',
  },
  {
    id: 1,
    name: 'Liz Carmouche',
    credential: 'Reigning PFL Flyweight Women\'s Champion · Former Top UFC Contender + Bellator Champion',
    quote:
      'The Eleventh Round has a lot of promise. I think it can help a lot of fighters who have the right mindset.',
    photo: '/testimonials/liz-carmouche.jpg',
  },
  {
    id: 2,
    name: 'Nicky "The Natural" Tejeda',
    credential: 'Current Undefeated U.S. WBC and New England Light Welterweight Boxing Champion',
    quote:
      'The Eleventh Round is a platform dedicated to the betterment of combat sports and to inspire and inform fighters on the importance of taking care of yourself personally and in the business side of combat sports.',
    photo: '/testimonials/nicky-tejeda.jpg',
  },
]

// ── Single testimonial card ───────────────────────────────────────────────────
function TestimonialCard({
  item,
  visible,
  delay,
}: {
  item: (typeof TESTIMONIALS)[0]
  visible: boolean
  delay: number
}) {
  const [imgLoaded, setImgLoaded] = useState(false)

  return (
    <div
      className="flex flex-col items-center text-center"
      style={{
        opacity:   visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
        transition: `opacity 0.8s ${delay}s cubic-bezier(.25,.46,.45,.94),
                     transform 0.8s ${delay}s cubic-bezier(.25,.46,.45,.94)`,
      }}
    >
      {/* Circular headshot */}
      <div
        className="relative mb-7 flex-shrink-0"
        style={{
          width: 200, height: 200,
          borderRadius: '50%',
          overflow: 'hidden',
          background: '#141416',
          boxShadow: '0 0 0 2px #2a2a2e, 0 0 0 4px rgba(139,0,0,0.35), 0 8px 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* Dark placeholder while loading */}
        {!imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '1px solid #2a2a2e',
              borderTopColor: '#8b0000',
              animation: 'spin 1s linear infinite',
            }} />
          </div>
        )}
        <img
          src={item.photo}
          alt={item.name}
          onLoad={() => setImgLoaded(true)}
          className="w-full h-full object-cover object-top"
          style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.5s' }}
        />
        {/* Inner vignette */}
        <div className="absolute inset-0 rounded-full" style={{
          boxShadow: 'inset 0 0 28px rgba(0,0,0,0.55)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Credential */}
      <div
        className="font-condensed font-bold uppercase text-blood-glow mb-3 px-4"
        style={{ fontSize: 10, letterSpacing: '0.2em', lineHeight: 1.4 }}
      >
        {item.credential}
      </div>

      {/* Name */}
      <h3
        className="font-display text-off-white uppercase mb-5"
        style={{ fontSize: 'clamp(22px,2.2vw,30px)', lineHeight: 0.95, letterSpacing: '-0.01em' }}
      >
        {item.name}
      </h3>

      {/* Red rule */}
      <div style={{
        width: 28, height: 1,
        background: '#8b0000',
        boxShadow: '0 0 8px rgba(139,0,0,0.5)',
        marginBottom: 20,
      }} />

      {/* Quote */}
      <p
        className="font-narrow text-gray-1 leading-relaxed italic"
        style={{ fontSize: 14, maxWidth: 320 }}
      >
        "{item.quote}"
      </p>
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────
export default function TestimonialsSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const headerRef  = useRef<HTMLDivElement>(null)
  const eyebrowRef = useRef<HTMLDivElement>(null)
  const line1Ref   = useRef<HTMLSpanElement>(null)
  const subRef     = useRef<HTMLParagraphElement>(null)
  const gridRef    = useRef<HTMLDivElement>(null)
  const [cardsVisible, setCardsVisible] = useState(false)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Card stagger via IntersectionObserver
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setCardsVisible(true); obs.disconnect() } },
      { threshold: 0.08 },
    )
    if (gridRef.current) obs.observe(gridRef.current)

    if (prefersReduced) return () => obs.disconnect()

    const ctx = gsap.context(() => {
      gsap.from(eyebrowRef.current, {
        opacity: 0, y: 14, duration: 0.7, ease: 'power2.out',
        scrollTrigger: { trigger: headerRef.current, start: 'top 82%' },
      })
      gsap.from(line1Ref.current, {
        y: '110%', duration: 1.1, ease: 'power4.out',
        scrollTrigger: { trigger: headerRef.current, start: 'top 80%' },
      })
      gsap.from(subRef.current, {
        opacity: 0, y: 20, duration: 0.8, ease: 'power2.out',
        scrollTrigger: { trigger: headerRef.current, start: 'top 76%' },
      })
    }, sectionRef)

    return () => { ctx.revert(); obs.disconnect() }
  }, [])

  return (
    <section
      ref={sectionRef}
      id="testimonials"
      className="bg-black py-20 md:py-32 px-5 md:px-10 relative overflow-hidden"
    >
      {/* Top rule */}
      <div className="red-rule absolute top-0 left-0 right-0" />

      {/* Atmospheric glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background:
          'radial-gradient(ellipse at 50% 0%, rgba(139,0,0,0.10) 0%, transparent 55%),' +
          'radial-gradient(ellipse at 50% 100%, rgba(139,0,0,0.06) 0%, transparent 50%)',
      }} />

      <div className="max-w-[1200px] mx-auto relative z-10">

        {/* Header */}
        <div ref={headerRef} className="text-center mb-20">
          <div ref={eyebrowRef} className="sec-label mb-5 justify-center">Early Testimonials</div>

          <h2
            className="font-display text-off-white uppercase mb-6"
            style={{
              fontSize: 'clamp(52px,7.5vw,116px)',
              lineHeight: 0.87,
              letterSpacing: '-0.02em',
            }}
          >
            <div className="line-clip inline-block">
              <span ref={line1Ref} className="block">
                Real Stories. <span className="text-crimson">Real Fighters.</span>
              </span>
            </div>
          </h2>

          <p
            ref={subRef}
            className="font-narrow text-gray-1 leading-relaxed mx-auto"
            style={{ fontSize: 15, maxWidth: 580 }}
          >
            Our programs have already begun attracting athletes, managers, and coaches from
            all levels of combat sports — from regional champions to contenders and champions.
          </p>
        </div>

        {/* Cards grid */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 lg:gap-16"
        >
          {TESTIMONIALS.map((item, i) => (
            <TestimonialCard
              key={item.id}
              item={item}
              visible={cardsVisible}
              delay={i * 0.14}
            />
          ))}
        </div>

        {/* Divider statement */}
        <div className="mt-20 pt-9 border-t border-charcoal-3 text-center">
          <p
            className="font-narrow font-bold italic text-gray-2"
            style={{ fontSize: 'clamp(13px,1.4vw,16px)', letterSpacing: '0.05em' }}
          >
            "Professionalism creates opportunity. Readiness is the differentiator."
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </section>
  )
}
