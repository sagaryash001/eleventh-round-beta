import React, { useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

const COLLECTIONS = [
  {
    id: 'resilience',
    name: 'Resilience Line',
    tag: 'Signature Collection',
    desc: 'Built for the ones who keep going. Premium fabrics, minimal branding, maximum meaning. The Resilience Line is the foundation of the Eleventh Round apparel identity.',
    items: ['Heavyweight Pullover', 'Training Tee', 'Camp Shorts', 'Quarter-Zip'],
    colors: ['Onyx', 'Blood Red', 'Bone'],
    sport: 'All Combat Sports',
  },
  {
    id: 'mma',
    name: 'MMA Collection',
    tag: 'Sport · MMA',
    desc: 'Designed for mixed martial artists who compete with discipline and represent with intention. Technical cuts, durable materials, fighter-tested fit.',
    items: ['Fight Shorts', 'Rashguard', 'Compression Tee', 'Hoodie'],
    colors: ['Charcoal', 'Blood Red', 'Slate'],
    sport: 'Mixed Martial Arts',
  },
  {
    id: 'boxing',
    name: 'Boxing Collection',
    tag: 'Sport · Boxing',
    desc: 'The sweet science, elevated. Sharp silhouettes for a sport built on precision and craft. From the gym to the weigh-in, wear it with purpose.',
    items: ['Tank Top', 'Boxing Shorts', 'Warm-Up Set', 'Camp Tee'],
    colors: ['Black', 'Crimson', 'White'],
    sport: 'Boxing',
  },
  {
    id: 'essentials',
    name: 'Premium Essentials',
    tag: 'Everyday',
    desc: 'Wearable extensions of the brand ethos. No sport-specific cuts — just premium basics that carry the Eleventh Round identity into everyday life.',
    items: ['Logo Tee', 'Sweatpants', 'Cap', 'Neck Gaiter'],
    colors: ['All Colorways'],
    sport: 'Lifestyle',
  },
]

export default function ApparelPage() {
  const [active, setActive] = useState('resilience')
  const current = COLLECTIONS.find(c => c.id === active)!

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-36 pb-20 px-10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse at 30% 60%, rgba(139,0,0,0.12) 0%, transparent 60%)' }} />
        <div className="max-w-[1200px] mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-end">
          <div>
            <div className="sec-label mb-4">Ecosystem · Apparel</div>
            <h1
              className="font-display text-off-white uppercase mb-6"
              style={{ fontSize: 'clamp(64px,9vw,148px)', lineHeight: 0.88 }}
            >
              Wear<br />
              <span className="text-blood-glow">Your</span><br />
              Ethos.
            </h1>
          </div>
          <div>
            <p className="font-condensed font-light text-gray-1 text-[16px] leading-relaxed tracking-wide mb-8">
              Not random merch. Identity. Discipline. Resilience. Collections built around
              combat sports culture with real meaning behind the fabric.
            </p>
            <a href="#collections" className="btn-primary">View Collections</a>
          </div>
        </div>
      </section>

      <div className="red-rule" />

      {/* Collections */}
      <section id="collections" className="py-20 px-10">
        <div className="max-w-[1200px] mx-auto">
          <div className="sec-label mb-10">Collections</div>

          {/* Tab selector */}
          <div className="flex gap-2 flex-wrap mb-12">
            {COLLECTIONS.map(c => (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className="font-condensed text-[11px] font-bold tracking-[0.2em] uppercase px-6 py-3 border transition-all cursor-pointer"
                style={{
                  background:   active === c.id ? '#8b0000' : '#141416',
                  borderColor:  active === c.id ? '#8b0000' : '#222226',
                  color:        active === c.id ? '#f0ece4' : '#7a7672',
                }}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Active collection detail */}
          <div
            className="grid grid-cols-1 lg:grid-cols-2 gap-0 border border-charcoal-3 overflow-hidden"
            style={{ borderLeft: '2px solid #8b0000' }}
          >
            {/* Left — info */}
            <div className="bg-charcoal p-12 flex flex-col">
              <div className="font-condensed text-[9px] font-bold tracking-[0.5em] uppercase text-blood-glow mb-3">{current.tag}</div>
              <h2 className="font-display text-off-white uppercase mb-6"
                  style={{ fontSize: 'clamp(40px,4.5vw,72px)', lineHeight: 0.9 }}>
                {current.name}
              </h2>
              <p className="font-body font-light text-gray-1 text-[14px] leading-relaxed mb-8 flex-1">
                {current.desc}
              </p>

              <div className="space-y-4">
                <div>
                  <div className="font-condensed text-[9px] font-bold tracking-[0.4em] uppercase text-gray-3 mb-2">Sport</div>
                  <div className="font-condensed text-[13px] font-semibold tracking-wide text-off-white">{current.sport}</div>
                </div>
                <div>
                  <div className="font-condensed text-[9px] font-bold tracking-[0.4em] uppercase text-gray-3 mb-2">Colorways</div>
                  <div className="flex gap-2">
                    {current.colors.map(c => (
                      <span key={c} className="font-condensed text-[11px] font-medium tracking-wide text-gray-1 border border-charcoal-3 px-3 py-1">{c}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button className="btn-primary">Notify Me</button>
                <button className="btn-ghost">Learn More</button>
              </div>
            </div>

            {/* Right — items grid */}
            <div className="bg-charcoal-2 p-12 border-l border-charcoal-3">
              <div className="font-condensed text-[9px] font-bold tracking-[0.4em] uppercase text-gray-3 mb-6">Items in Collection</div>
              <div className="grid grid-cols-2 gap-3">
                {current.items.map((item, i) => (
                  <div
                    key={item}
                    className="bg-charcoal border border-charcoal-3 p-5 aspect-square flex flex-col justify-between hover:border-blood/40 transition-colors group cursor-pointer"
                  >
                    <div
                      className="w-12 h-12 border border-charcoal-3 flex items-center justify-center mb-4"
                      style={{ borderColor: 'rgba(139,0,0,0.3)' }}
                    >
                      <span className="font-condensed text-[10px] font-bold tracking-widest text-blood-glow">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <div>
                      <div className="font-condensed text-[13px] font-bold tracking-wide text-gray-1 group-hover:text-off-white transition-colors">
                        {item}
                      </div>
                      <div className="font-condensed text-[10px] tracking-wide text-gray-3 mt-1">Coming Soon</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Brand statement */}
      <section className="py-16 px-10 bg-near-black">
        <div className="red-rule mb-16" />
        <div className="max-w-[1200px] mx-auto text-center">
          <p
            className="font-display text-off-white uppercase"
            style={{ fontSize: 'clamp(36px,5vw,80px)', lineHeight: 0.9 }}
          >
            Not Merch.<br />
            <span className="text-blood-glow">Identity.</span>
          </p>
          <p className="font-condensed font-light text-gray-2 text-[15px] leading-relaxed max-w-lg mx-auto mt-6">
            Every piece in the Eleventh Round catalog represents something real.
            Worn by fighters who train with purpose and move with discipline.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
