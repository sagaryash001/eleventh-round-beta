import React, { useState } from 'react'
import { Link } from 'react-router-dom'

type Role = 'command' | 'fighter' | 'manager' | 'promo'

function ReadinessRing({ pct, size = 96 }: { pct: number; size?: number }) {
  const r = size * 0.45
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#222226" strokeWidth={size * 0.06} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#c00000" strokeWidth={size * 0.06}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.25,0.46,0.45,0.94)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="font-display text-off-white leading-none" style={{ fontSize: size * 0.24 }}>{pct}</span>
        <span className="font-condensed text-gray-3 font-bold tracking-widest uppercase" style={{ fontSize: size * 0.09 }}>Score</span>
      </div>
    </div>
  )
}

function MiniBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="bg-charcoal-2 p-3 border border-charcoal-3">
      <div className="font-condensed text-[10px] font-medium tracking-wide text-gray-2 mb-1.5">{label}</div>
      <div className="h-[2px] bg-charcoal-3 rounded overflow-hidden">
        <div className="h-full bg-blood-glow rounded" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function DashItem({ name, badge, type }: { name: string; badge: string; type: 'green' | 'red' | 'yellow' }) {
  return (
    <li className="dash-list-item">
      <span className="dash-item-name">{name}</span>
      <span className={`badge badge-${type}`}>{badge}</span>
    </li>
  )
}

/* ── Command Center ─── */
function CommandUI() {
  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: '250px 1fr 1fr' }}>
      <div className="dash-card">
        <div className="dash-label">Active Roster</div>
        <div className="dash-stat">47</div>
        <div className="dash-sub">Fighters in system</div>
        <div className="dash-bar-track"><div className="dash-bar-fill" style={{ width: '78%' }} /></div>
        <div className="dash-sub">78% fully onboarded</div>
      </div>
      <div className="dash-card">
        <div className="dash-label">Readiness Overview</div>
        <div className="flex gap-5 items-center mt-1">
          <ReadinessRing pct={72} />
          <div className="grid grid-cols-2 gap-2 flex-1">
            <MiniBar label="Brand" pct={68} />
            <MiniBar label="Financial" pct={55} />
            <MiniBar label="Conduct" pct={84} />
            <MiniBar label="Sponsor" pct={41} />
          </div>
        </div>
      </div>
      <div className="dash-card">
        <div className="dash-label">Obligations Due</div>
        <div className="dash-stat text-blood-glow">3</div>
        <div className="dash-sub">Overdue this week</div>
        <div className="dash-bar-track"><div className="dash-bar-fill" style={{ width: '22%', background: '#c00000' }} /></div>
        <div className="dash-sub">2 sponsor · 1 media</div>
      </div>
      <div className="dash-card" style={{ gridColumn: 'span 3' }}>
        <div className="dash-label">Recent Activity</div>
        <ul className="dc-list">
          <DashItem name="Marcus T. — Onboarding Complete"        badge="Ready"           type="green"  />
          <DashItem name="Jordan K. — Sponsor Obligation Overdue" badge="Action Required"  type="red"    />
          <DashItem name="SponsorForge — 2 New Matches Available" badge="New"              type="green"  />
          <DashItem name="Diego M. — Financial Module 60%"        badge="In Progress"      type="yellow" />
          <DashItem name="3 Consultations Scheduled This Week"    badge="Confirmed"        type="green"  />
        </ul>
      </div>
    </div>
  )
}

/* ── Fighter View ─── */
function FighterUI() {
  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
      <div className="dash-card flex flex-col items-center text-center">
        <div className="dash-label w-full text-left">Personal Readiness</div>
        <ReadinessRing pct={79} size={100} />
        <div className="dash-sub mt-2">3 areas need attention</div>
      </div>
      <div className="dash-card">
        <div className="dash-label">Pipeline Progress</div>
        <ul className="dc-list">
          <DashItem name="Financial Literacy" badge="60%"        type="yellow" />
          <DashItem name="Brand Readiness"    badge="45%"        type="yellow" />
          <DashItem name="Sponsor Profile"    badge="Incomplete" type="red"    />
          <DashItem name="Conduct Log"        badge="Clear"      type="green"  />
          <DashItem name="SponsorForge"       badge="Locked"     type="red"    />
        </ul>
      </div>
      <div className="dash-card">
        <div className="dash-label">Upcoming Obligations</div>
        <ul className="dc-list">
          <DashItem name="Post-Fight Media"    badge="3 Days"   type="yellow" />
          <DashItem name="Sponsor Content"     badge="Overdue"  type="red"    />
          <DashItem name="Consultation"        badge="Scheduled" type="green" />
        </ul>
      </div>
      <div className="dash-card">
        <div className="dash-label">Education Modules</div>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <MiniBar label="Business Basics" pct={80} />
          <MiniBar label="Taxes & Filing"  pct={40} />
          <MiniBar label="Contracts"       pct={25} />
          <MiniBar label="Branding 101"    pct={65} />
        </div>
      </div>
      <div className="dash-card">
        <div className="dash-label">Mentorship</div>
        <div className="dash-stat">2</div>
        <div className="dash-sub">Sessions this month</div>
        <div className="dash-bar-track"><div className="dash-bar-fill" style={{ width: '50%' }} /></div>
        <div className="dash-sub">Next: Apr 8 @ 2pm</div>
      </div>
      <div className="dash-card">
        <div className="dash-label">Transition Planning</div>
        <div className="dash-stat text-gray-2 text-2xl mt-2">Locked</div>
        <div className="dash-sub mt-2">Unlock after Pipeline Level 3</div>
        <div className="dash-bar-track"><div className="dash-bar-fill" style={{ width: '0%' }} /></div>
      </div>
    </div>
  )
}

/* ── Manager View ─── */
function ManagerUI() {
  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <div className="dash-card">
        <div className="dash-label">Roster Onboarding</div>
        <ul className="dc-list">
          <DashItem name="Marcus T. — Welterweight"  badge="Complete"    type="green"  />
          <DashItem name="Jordan K. — Lightweight"   badge="In Progress" type="yellow" />
          <DashItem name="Diego M. — Middleweight"   badge="75%"         type="yellow" />
          <DashItem name="Anya S. — Featherweight"   badge="Not Started" type="red"    />
          <DashItem name="Chris B. — Heavyweight"    badge="Complete"    type="green"  />
        </ul>
      </div>
      <div className="dash-card">
        <div className="dash-label">Sponsor / Media Obligations</div>
        <ul className="dc-list">
          <DashItem name="Jordan K. — Instagram Post"  badge="Overdue 2d"    type="red"    />
          <DashItem name="Marcus T. — Press Interview" badge="Due Tomorrow"  type="yellow" />
          <DashItem name="Diego M. — Sponsor Report"   badge="Submitted"     type="green"  />
          <DashItem name="Chris B. — Post-Event Media" badge="Complete"      type="green"  />
        </ul>
      </div>
      <div className="dash-card">
        <div className="dash-label">SponsorForge Eligibility</div>
        <ul className="dc-list">
          <DashItem name="Marcus T." badge="Eligible"  type="green"  />
          <DashItem name="Chris B."  badge="Eligible"  type="green"  />
          <DashItem name="Diego M."  badge="80% Ready" type="yellow" />
          <DashItem name="Jordan K." badge="Blocked"   type="red"    />
          <DashItem name="Anya S."   badge="Not Ready" type="red"    />
        </ul>
      </div>
      <div className="dash-card">
        <div className="dash-label">Operational Alerts</div>
        <ul className="dc-list">
          <DashItem name="Jordan K. — Conduct Flag"      badge="Review"     type="red"    />
          <DashItem name="Camp Budget — 2 Events Unplan" badge="Attention"  type="yellow" />
          <DashItem name="Anya S. — Onboarding Stalled"  badge="Follow Up"  type="red"    />
        </ul>
      </div>
    </div>
  )
}

/* ── Promotions View ─── */
function PromoUI() {
  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
      <div className="dash-card">
        <div className="dash-label">Event Professionalism</div>
        <ul className="dc-list">
          <DashItem name="Fight Night — Mar 22" badge="Clean"   type="green"  />
          <DashItem name="Fight Night — Feb 14" badge="2 Flags" type="yellow" />
          <DashItem name="Regional — Jan 30"    badge="Clean"   type="green"  />
        </ul>
      </div>
      <div className="dash-card">
        <div className="dash-label">Sponsor Compliance</div>
        <div className="dash-stat">94<span className="text-2xl text-gray-2">%</span></div>
        <div className="dash-sub">Last 90 days</div>
        <div className="dash-bar-track"><div className="dash-bar-fill" style={{ width: '94%' }} /></div>
      </div>
      <div className="dash-card flex flex-col items-center text-center">
        <div className="dash-label w-full text-left">Integrity Score</div>
        <ReadinessRing pct={82} />
      </div>
      <div className="dash-card">
        <div className="dash-label">Fighter Evaluation</div>
        <ul className="dc-list">
          <DashItem name="Professionalism Avg" badge="8.4/10" type="green"  />
          <DashItem name="Media Readiness"     badge="7.1/10" type="yellow" />
          <DashItem name="Sponsor Readiness"   badge="6.8/10" type="yellow" />
        </ul>
      </div>
      <div className="dash-card">
        <div className="dash-label">Operational Flags</div>
        <ul className="dc-list">
          <DashItem name="Late Media Check-In"      badge="1 Fighter"  type="yellow" />
          <DashItem name="Sponsor Obligation Missed" badge="2 Fighters" type="red"    />
          <DashItem name="Conduct Violations"        badge="None"       type="green"  />
        </ul>
      </div>
      <div className="dash-card">
        <div className="dash-label">Upcoming Reporting</div>
        <ul className="dc-list">
          <DashItem name="Q1 Compliance Report"   badge="Due Apr 15" type="yellow" />
          <DashItem name="Event Summary — Apr 5"  badge="Pending"    type="yellow" />
        </ul>
      </div>
    </div>
  )
}

/* ── Main Section ─── */
const TABS: { id: Role; label: string }[] = [
  { id: 'command', label: 'Command Center' },
  { id: 'fighter', label: 'Fighter View' },
  { id: 'manager', label: 'Manager View' },
  { id: 'promo',   label: 'Promotions' },
]

export default function DashboardPreview() {
  const [role, setRole] = useState<Role>('command')

  return (
    <section id="dashboard" className="bg-near-black py-28 px-10 relative overflow-hidden">
      <div className="red-rule absolute top-0 left-0 right-0" />

      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-end mb-16">
          <div>
            <div className="sec-label reveal mb-4">The Platform</div>
            <h2
              className="reveal font-display text-off-white uppercase"
              style={{ fontSize: 'clamp(52px,7vw,104px)', lineHeight: 0.88 }}
            >
              The Operating<br />
              <span className="text-blood-glow">System.</span>
            </h2>
          </div>
          <p className="reveal font-body font-light text-gray-1 text-[14px] leading-relaxed">
            The dashboard is where people are managed, readiness is tracked, obligations
            are monitored, development is guided, and opportunities are unlocked. This is
            the infrastructure behind every promise.
          </p>
        </div>

        {/* Role tabs */}
        <div className="reveal flex border-b border-charcoal-3 mb-9 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setRole(t.id)}
              className="font-condensed text-[11px] font-bold tracking-[0.22em] uppercase px-7 py-3.5 cursor-pointer border-0 bg-transparent whitespace-nowrap transition-all duration-200"
              style={{
                color: role === t.id ? '#f0ece4' : '#4a4846',
                borderBottom: role === t.id ? '2px solid #c00000' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Dashboard UI */}
        <div className="reveal reveal-delay-2">
          {role === 'command'  && <CommandUI />}
          {role === 'fighter'  && <FighterUI />}
          {role === 'manager'  && <ManagerUI />}
          {role === 'promo'    && <PromoUI   />}
        </div>

        {/* CTA to full dashboard */}
        <div className="reveal reveal-delay-3 mt-10 flex items-center gap-5">
          <Link to="/login" className="btn-primary">Access Full Dashboard</Link>
          <span className="font-condensed text-[11px] tracking-[0.2em] uppercase text-gray-3">
            Fighter · Manager · Admin roles
          </span>
        </div>
      </div>
    </section>
  )
}
