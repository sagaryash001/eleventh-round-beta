import React from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { Link } from 'react-router-dom'

const EPISODES = [
  { ep: 'E012', title: 'Building a Career After the Belt',       guest: 'Marcus Torres',       role: 'Former WBA Champion',           duration: '58m', topic: 'Career Transition' },
  { ep: 'E011', title: 'What Sponsors Actually Want',            guest: 'Kira Fontaine',        role: 'Sports Brand Director',         duration: '44m', topic: 'Sponsorship' },
  { ep: 'E010', title: 'Managing a Roster Without Burning Out',  guest: 'Ray Callahan',         role: 'Independent Manager',           duration: '51m', topic: 'Management' },
  { ep: 'E009', title: 'Financial Literacy No One Taught You',   guest: 'Devon Price CPA',      role: 'Combat Sports Accountant',      duration: '62m', topic: 'Finance' },
  { ep: 'E008', title: 'Brand Before the Fight Camp Starts',     guest: 'Anya Solis',           role: 'Featherweight Contender',       duration: '39m', topic: 'Branding' },
  { ep: 'E007', title: 'The Contract You Should Have Read',      guest: 'James Okafor Esq.',    role: 'Combat Sports Attorney',        duration: '55m', topic: 'Contracts' },
]

const TOPICS = ['All', 'Career Transition', 'Sponsorship', 'Management', 'Finance', 'Branding', 'Contracts']

export default function PodcastPage() {
  const [filter, setFilter] = React.useState('All')
  const filtered = filter === 'All' ? EPISODES : EPISODES.filter(e => e.topic === filter)

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-36 pb-20 px-10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse at 60% 20%, rgba(139,0,0,0.12) 0%, transparent 60%)' }} />
        <div className="max-w-[1200px] mx-auto relative z-10">
          <div className="sec-label mb-4">Ecosystem · Audio</div>
          <h1
            className="font-display text-off-white uppercase mb-6"
            style={{ fontSize: 'clamp(64px,9vw,148px)', lineHeight: 0.88 }}
          >
            The<br />
            <span className="text-blood-glow">Eleventh</span><br />
            Round Pod
          </h1>
          <p className="font-condensed font-light text-gray-1 max-w-[520px] text-[16px] leading-relaxed tracking-wide">
            Fighter stories. Career lessons. Professionalism, discipline, and business
            — through conversations with people who move with substance.
          </p>

          <div className="flex gap-4 mt-10 flex-wrap">
            <a href="#episodes" className="btn-primary">Browse Episodes</a>
            <a href="#" className="btn-ghost">Subscribe</a>
          </div>
        </div>
      </section>

      <div className="red-rule" />

      {/* Platform badges */}
      <section className="py-10 px-10">
        <div className="max-w-[1200px] mx-auto">
          <div className="font-condensed text-[10px] font-bold tracking-[0.4em] uppercase text-gray-3 mb-5">Available on</div>
          <div className="flex gap-4 flex-wrap">
            {['Spotify', 'Apple Podcasts', 'YouTube', 'Amazon Music'].map(p => (
              <div key={p} className="bg-charcoal border border-charcoal-3 px-5 py-2.5 font-condensed text-[12px] font-semibold tracking-[0.08em] text-gray-2 hover:text-off-white hover:border-blood/40 transition-colors cursor-pointer">
                {p}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Episodes */}
      <section id="episodes" className="py-16 px-10">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <h2 className="font-display text-off-white uppercase" style={{ fontSize: 'clamp(32px,4vw,56px)', lineHeight: 0.9 }}>
              Episodes
            </h2>
            {/* Topic filter */}
            <div className="flex gap-2 flex-wrap">
              {TOPICS.map(t => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className="font-condensed text-[10px] font-bold tracking-[0.2em] uppercase px-4 py-2 border transition-all cursor-pointer"
                  style={{
                    background: filter === t ? '#8b0000' : 'transparent',
                    borderColor: filter === t ? '#8b0000' : '#222226',
                    color: filter === t ? '#f0ece4' : '#4a4846',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filtered.map((ep, i) => (
              <div
                key={ep.ep}
                className="bg-charcoal border border-charcoal-3 px-7 py-5 flex items-center gap-6 hover:border-blood/40 transition-all group cursor-pointer"
                style={{ borderLeft: '2px solid transparent', transition: 'all 0.25s' }}
                onMouseEnter={e => (e.currentTarget.style.borderLeftColor = '#8b0000')}
                onMouseLeave={e => (e.currentTarget.style.borderLeftColor = 'transparent')}
              >
                <div className="font-condensed text-[10px] font-bold tracking-[0.3em] text-blood-glow min-w-[40px]">{ep.ep}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-condensed text-[15px] font-bold tracking-wide text-off-white mb-1 group-hover:text-blood-glow transition-colors truncate">
                    {ep.title}
                  </div>
                  <div className="font-condensed text-[12px] text-gray-3">
                    {ep.guest} <span className="text-gray-3 opacity-50 mx-1">·</span> {ep.role}
                  </div>
                </div>
                <div className="font-condensed text-[10px] font-bold tracking-[0.2em] uppercase text-gray-3 border border-charcoal-3 px-3 py-1 whitespace-nowrap">
                  {ep.topic}
                </div>
                <div className="font-condensed text-[11px] text-gray-3 min-w-[36px] text-right">{ep.duration}</div>
                <div className="w-8 h-8 rounded-full border border-charcoal-3 flex items-center justify-center group-hover:border-blood/50 transition-colors">
                  <span className="text-gray-3 text-[10px] group-hover:text-off-white transition-colors">▶</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="py-16 px-10 bg-near-black">
        <div className="red-rule mb-16" />
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
          <div>
            <div className="sec-label mb-4">About the Show</div>
            <h2 className="font-display text-off-white uppercase mb-6"
                style={{ fontSize: 'clamp(36px,4.5vw,68px)', lineHeight: 0.9 }}>
              Not Hype.<br /><span className="text-blood-glow">Substance.</span>
            </h2>
            <p className="font-body font-light text-gray-1 text-[14px] leading-relaxed mb-4">
              Every episode is a real conversation with fighters, managers, coaches, attorneys,
              and business minds who understand combat sports from the inside.
            </p>
            <p className="font-body font-light text-gray-1 text-[14px] leading-relaxed">
              No highlight reels. No empty motivation. Just the information and perspective
              that helps fighters and managers operate at a higher level.
            </p>
          </div>
          <div className="space-y-3">
            {['Fighter career stories and lessons', 'Professionalism and conduct', 'Sponsorship and branding', 'Contract and legal literacy', 'Financial stability', 'Life and transition beyond fighting'].map(t => (
              <div key={t} className="flex items-center gap-3 font-condensed text-[13px] font-medium tracking-wide text-gray-1">
                <div className="w-1.5 h-1.5 rounded-full bg-blood-glow flex-shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
