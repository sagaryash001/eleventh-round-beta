import React from 'react'
import DashShell from './DashShell'
import { StatCard, ListCard, ReadinessRing, RadarChart, BarChart, SparkLine, ActivityHeatmap, Timeline, SectionHeading, FullWidthCard } from './DashWidgets'

const NAV = [
  { id: 'overview',     label: 'Overview',       icon: '◈' },
  { id: 'pipeline',     label: 'Pipeline',        icon: '▲' },
  { id: 'obligations',  label: 'Obligations',     icon: '📋' },
  { id: 'education',    label: 'Education',       icon: '📚' },
  { id: 'sponsorforge', label: 'SponsorForge',    icon: '⚡' },
  { id: 'mentorship',   label: 'Mentorship',      icon: '🎯' },
  { id: 'transition',   label: 'Transition',      icon: '→' },
  { id: 'profile',      label: 'Profile',         icon: '👤' },
]

function Overview() {
  return (
    <div className="space-y-4">
      <SectionHeading>Your Dashboard</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '200px 1fr 1fr 1fr' }}>
        <div className="dash-card flex flex-col items-center justify-center text-center row-span-2">
          <div className="dash-label w-full text-left mb-3">Readiness</div>
          <ReadinessRing pct={79} size={110} />
          <div className="dash-sub mt-3 text-center">3 areas need<br />attention</div>
        </div>
        <StatCard label="Pipeline Stage" value="3" sub="of 5 complete" barPct={60} trend={5} />
        <StatCard label="Sponsor Score" value="45" sub="100 = SponsorForge ready" barPct={45} />
        <StatCard label="Open Obligations" value={<span className="text-blood-glow">2</span>} sub="1 overdue · 1 upcoming" barPct={20} barColor="#c00000" />

        {/* Radar */}
        <div className="dash-card flex flex-col items-center">
          <div className="dash-label w-full">Readiness Profile</div>
          <RadarChart axes={[
            { label: 'Brand',     value: 45 },
            { label: 'Finance',   value: 60 },
            { label: 'Conduct',   value: 88 },
            { label: 'Sponsor',   value: 30 },
            { label: 'Media',     value: 72 },
            { label: 'Pipeline',  value: 60 },
          ]} />
        </div>
        <div className="dash-card">
          <div className="dash-label">Activity (12 Weeks)</div>
          <ActivityHeatmap weeks={12} />
        </div>
        <div className="dash-card">
          <div className="dash-label">Readiness Trend</div>
          <SparkLine values={[48,52,55,58,60,62,65,68,72,75,77,79]} />
          <div className="dash-sub mt-2">+31pts over 12 weeks</div>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <ListCard label="Action Items" items={[
          { name: 'Sponsor Content Due (2d overdue)',   badge: 'Overdue',  type: 'red'    },
          { name: 'Post-Fight Media — 3 Days',         badge: 'Urgent',   type: 'yellow' },
          { name: 'Financial Module — Continue',       badge: '60%',      type: 'yellow' },
          { name: 'Consultation — Apr 8 @ 2pm',        badge: 'Upcoming', type: 'green'  },
        ]} />
        <div className="dash-card">
          <div className="dash-label">Education Progress</div>
          <BarChart height={100} data={[
            { label: 'Business', value: 80 },
            { label: 'Finance',  value: 60 },
            { label: 'Contracts',value: 25 },
            { label: 'Branding', value: 65 },
            { label: 'NIL',      value: 30 },
          ]} />
        </div>
      </div>
    </div>
  )
}

function Pipeline() {
  const stages = [
    { n: '01', label: 'Profile & Intake',            pct: 100 },
    { n: '02', label: 'Financial Literacy Baseline', pct: 60  },
    { n: '03', label: 'Brand & Digital Presence',    pct: 45  },
    { n: '04', label: 'Sponsor Readiness',           pct: 10  },
    { n: '05', label: 'SponsorForge Access',         pct: 0   },
  ]
  return (
    <div className="space-y-4">
      <SectionHeading>Eleventh Round Ready Pipeline</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 220px' }}>
        <div className="space-y-3">
          {stages.map(s => (
            <div key={s.n} className="dash-card flex items-center gap-5"
              style={{ borderLeft: s.pct===100?'2px solid #00c060':s.pct>0?'2px solid #c00000':'2px solid #222226' }}>
              <span className="font-condensed text-[12px] font-bold tracking-[0.25em] text-gray-3 min-w-[24px]">{s.n}</span>
              <div className="flex-1">
                <div className="font-condensed text-[13px] font-bold text-off-white mb-1.5">{s.label}</div>
                <div className="h-[3px] bg-charcoal-3 rounded overflow-hidden">
                  <div className="h-full rounded transition-all duration-1000"
                    style={{ width:`${s.pct}%`, background:s.pct===100?'#00c060':'linear-gradient(90deg,#8b0000,#c00000)' }} />
                </div>
              </div>
              <span className="font-display text-lg" style={{ color:s.pct===100?'#00c060':s.pct>0?'#c00000':'#2a2a2e' }}>
                {s.pct}%
              </span>
            </div>
          ))}
        </div>
        <div className="dash-card flex flex-col items-center justify-center text-center">
          <div className="dash-label mb-3">Overall Progress</div>
          <ReadinessRing pct={43} size={100} label="Pipeline" />
          <div className="dash-sub mt-3">Stage 2 Active</div>
        </div>
      </div>
    </div>
  )
}

function Obligations() {
  return (
    <div className="space-y-4">
      <SectionHeading>Obligations</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 160px' }}>
        <ListCard label="Sponsor Obligations" items={[
          { name: 'Brand X — Instagram Post',    badge: 'Overdue 2d', type: 'red'    },
          { name: 'Brand Y — Story Post-Fight',  badge: 'Due Apr 8',  type: 'yellow' },
          { name: 'Brand Z — Quarterly Feature', badge: 'Due May 1',  type: 'green'  },
        ]} />
        <ListCard label="Media Obligations" items={[
          { name: 'Post-Fight Press Interview',  badge: '3 Days',   type: 'yellow' },
          { name: 'Promotion Social Tag',        badge: 'Complete', type: 'green'  },
          { name: 'Weigh-In Media Avail.',       badge: 'Upcoming', type: 'yellow' },
        ]} />
        <div className="dash-card text-center">
          <div className="dash-label">Fulfillment</div>
          <ReadinessRing pct={94} size={80} color="#00c060" label="%" />
          <div className="dash-sub mt-2">12 completed</div>
        </div>
      </div>
      <FullWidthCard label="Obligation Timeline">
        <Timeline events={[
          { date: 'Overdue', label: 'Brand X Instagram Post', type: 'red' },
          { date: 'Apr 8',   label: 'Mentorship Session',     type: 'green' },
          { date: 'Apr 8',   label: 'Brand Y Story Post',     type: 'yellow' },
          { date: 'Apr 15',  label: 'Financial Module Due',   type: 'yellow' },
          { date: 'May 1',   label: 'Brand Z Feature',        type: 'green' },
        ]} />
      </FullWidthCard>
    </div>
  )
}

function Education() {
  const mods = [
    { name: 'Business Basics',     pct: 80 },
    { name: 'Taxes & Filing',      pct: 40 },
    { name: 'Contract Reading',    pct: 25 },
    { name: 'Personal Branding',   pct: 65 },
    { name: 'NIL Rights',          pct: 30 },
    { name: 'Camp Budgeting',      pct: 55 },
    { name: 'Sponsorship Strategy',pct: 15 },
    { name: 'Life After Fighting', pct: 0  },
  ]
  return (
    <div className="space-y-4">
      <SectionHeading>Education Modules</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 220px' }}>
        <div className="dash-card">
          <div className="dash-label mb-4">Module Completion</div>
          <BarChart height={120} data={mods.slice(0,6).map(m => ({ label: m.name.split(' ')[0], value: m.pct }))} />
        </div>
        <div className="dash-card flex flex-col items-center justify-center">
          <div className="dash-label mb-2">Overall Progress</div>
          <ReadinessRing pct={39} size={90} label="Done" />
          <div className="dash-sub mt-2">5 of 8 started</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {mods.map(m => (
          <div key={m.name} className="dash-card">
            <div className="flex justify-between items-center mb-2">
              <span className="font-condensed text-[12px] font-semibold text-gray-1">{m.name}</span>
              <span className="font-display text-sm text-off-white">{m.pct}%</span>
            </div>
            <div className="dash-bar-track" style={{ marginTop: 0 }}>
              <div className="dash-bar-fill" style={{ width: `${m.pct}%`, background: m.pct===0?'#222226':m.pct>70?'#00c060':'linear-gradient(90deg,#8b0000,#c00000)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SponsorForge() {
  return (
    <div className="space-y-4">
      <SectionHeading>SponsorForge</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 220px' }}>
        <div className="dash-card" style={{ borderLeft: '2px solid #c00000' }}>
          <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-blood-glow mb-3">Status: Locked</div>
          <p className="font-body text-gray-1 text-[13px] leading-relaxed mb-5">
            Complete Pipeline Stage 4 (Sponsor Readiness) to unlock access to the vetted sponsor network.
          </p>
          <ListCard label="Requirements" items={[
            { name: 'Sponsor Profile',        badge: 'Incomplete', type: 'red'    },
            { name: 'Brand Readiness Score',  badge: '45 / 100',   type: 'yellow' },
            { name: 'Pipeline Stage',         badge: 'Stage 4+',   type: 'red'    },
            { name: 'Obligation Record',      badge: '94%',        type: 'green'  },
          ]} />
        </div>
        <div className="dash-card flex flex-col items-center text-center">
          <div className="dash-label mb-2">Eligibility Score</div>
          <ReadinessRing pct={45} size={90} />
          <div className="dash-sub mt-2">55 pts to unlock</div>
        </div>
      </div>
      <div className="dash-card">
        <div className="dash-label mb-3">Eligibility Progress</div>
        <BarChart height={80} data={[
          { label: 'Brand',    value: 45 },
          { label: 'Pipeline', value: 60 },
          { label: 'Conduct',  value: 88 },
          { label: 'Obligations', value: 94 },
          { label: 'Profile',  value: 20 },
        ]} />
      </div>
    </div>
  )
}

function Mentorship() {
  return (
    <div className="space-y-4">
      <SectionHeading>Mentorship & Consulting</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 160px' }}>
        <ListCard label="Session History" items={[
          { name: 'Mar 24 — Career Roadmap Review',    badge: 'Complete', type: 'green'  },
          { name: 'Mar 10 — Sponsorship Prep',         badge: 'Complete', type: 'green'  },
          { name: 'Feb 22 — Financial Kickoff',        badge: 'Complete', type: 'green'  },
          { name: 'Apr 08 — Strategy Session',         badge: 'Upcoming', type: 'yellow' },
        ]} />
        <div className="dash-card">
          <div className="dash-label mb-3">Session Frequency</div>
          <BarChart height={90} data={[
            { label: 'Jan', value: 1 }, { label: 'Feb', value: 2 },
            { label: 'Mar', value: 3 }, { label: 'Apr', value: 1 },
          ]} />
        </div>
        <div className="dash-card text-center">
          <div className="dash-label">This Month</div>
          <div className="dash-stat mt-2">2</div>
          <div className="dash-sub">sessions</div>
          <div className="dash-sub mt-4">Next<br />Apr 8<br />2:00pm</div>
        </div>
      </div>
    </div>
  )
}

function Profile() {
  return (
    <div className="space-y-4">
      <SectionHeading>My Profile</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="dash-card">
          <div className="dash-label">Fighter Info</div>
          {[['Full Name','Marcus Torres'],['Division','Welterweight'],['Record','12-3-0'],['Base','Miami, FL'],['Manager','Ray Callahan']].map(([k,v])=>(
            <div key={k} className="flex justify-between py-2 border-b border-charcoal-3 last:border-0 text-[12px]">
              <span className="font-condensed text-gray-3">{k}</span>
              <span className="font-condensed font-semibold text-off-white">{v}</span>
            </div>
          ))}
        </div>
        <div className="dash-card">
          <div className="dash-label mb-3">Profile Completeness</div>
          <ReadinessRing pct={72} size={90} label="Profile" />
          <div className="space-y-1 mt-4">
            <button className="btn-ghost w-full text-[10px] py-2">Edit Profile</button>
            <button className="btn-ghost w-full text-[10px] py-2">Change Password</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Transition() {
  return (
    <div className="space-y-4">
      <SectionHeading>Transition Planning</SectionHeading>
      <div className="dash-card" style={{ borderLeft: '2px solid #222226' }}>
        <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-gray-3 mb-3">Status: Locked — Pipeline Level 3 Required</div>
        <div className="flex items-center gap-6">
          <ReadinessRing pct={40} size={80} color="#4a4846" label="Pipeline" />
          <div>
            <p className="font-body text-gray-2 text-[13px] leading-relaxed mb-3">
              The Transition Blueprint helps fighters plan life and career beyond active competition. Unlocks at Pipeline Level 3.
            </p>
            <div className="dash-bar-track"><div className="dash-bar-fill" style={{ width: '40%', background: '#4a4846' }} /></div>
            <div className="dash-sub mt-1">40% — Level 2 of 5 complete</div>
          </div>
        </div>
      </div>
    </div>
  )
}

const VIEWS: Record<string, React.FC> = {
  overview:Overview, pipeline:Pipeline, obligations:Obligations,
  education:Education, sponsorforge:SponsorForge, mentorship:Mentorship,
  transition:Transition, profile:Profile,
}

export default function FighterDashboard() {
  return (
    <DashShell navItems={NAV} title="Fighter Dashboard" subtitle="Fighter Portal">
      {tab => { const V = VIEWS[tab] ?? Overview; return <V /> }}
    </DashShell>
  )
}
