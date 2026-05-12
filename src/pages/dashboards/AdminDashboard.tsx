import React from 'react'
import DashShell from './DashShell'
import { StatCard, ListCard, ReadinessRing, BarChart, SparkLine, RadarChart, SectionHeading, FullWidthCard } from './DashWidgets'

const NAV = [
  { id:'overview',    label:'Platform Overview',  icon:'◈' },
  { id:'users',       label:'Users & Roles',      icon:'👥' },
  { id:'mentors',     label:'Mentors & Consults', icon:'🎯' },
  { id:'sponsorforge',label:'SponsorForge',       icon:'⚡' },
  { id:'packages',    label:'Packages & Subs',    icon:'📦' },
  { id:'content',     label:'Content Modules',    icon:'📚' },
  { id:'reports',     label:'System Reports',     icon:'📊' },
]

function Overview() {
  return (
    <div className="space-y-4">
      <SectionHeading>Platform Overview</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
        <StatCard label="Total Users"       value="312" sub="All roles"          barPct={78} trend={8} />
        <StatCard label="Active Fighters"   value="201" sub="In pipeline"        barPct={64} trend={5} />
        <StatCard label="Active Managers"   value="47"  sub="With rosters"       barPct={47} trend={2} />
        <StatCard label="Promotions"        value="12"  sub="PRMTN-HUB"          barPct={12} trend={1} />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns:'2fr 1fr' }}>
        <div className="dash-card">
          <div className="dash-label mb-3">User Growth (12 Months)</div>
          <BarChart height={110} data={[
            {label:'May',value:180},{label:'Jun',value:195},{label:'Jul',value:200},
            {label:'Aug',value:210},{label:'Sep',value:215},{label:'Oct',value:224},
            {label:'Nov',value:240},{label:'Dec',value:258},{label:'Jan',value:272},
            {label:'Feb',value:288},{label:'Mar',value:300},{label:'Apr',value:312},
          ]} />
        </div>
        <div className="dash-card flex flex-col items-center text-center">
          <div className="dash-label mb-2">Platform Health</div>
          <ReadinessRing pct={91} size={100} color="#00c060" label="Health" />
          <div className="dash-sub mt-2">All systems normal</div>
          <div className="dash-sub">1 active alert</div>
        </div>
      </div>

      <ListCard label="System Alerts" items={[
        { name:'Jordan K. — Conduct Flag Unresolved', badge:'Urgent',  type:'red'    },
        { name:'3 Sponsor Obligations Overdue',       badge:'Action',  type:'red'    },
        { name:'4 Onboardings Stalled > 14 days',     badge:'Review',  type:'yellow' },
        { name:'Module Update Available',             badge:'Info',    type:'green'  },
      ]} />
    </div>
  )
}

function Users() {
  const users = [
    { name:'Marcus Torres',   role:'fighter', status:'Active',  plan:'Pipeline Pro' },
    { name:'Ray Callahan',    role:'manager', status:'Active',  plan:'MGMT-SUITE'   },
    { name:'Anya Solis',      role:'fighter', status:'Pending', plan:'Free'         },
    { name:'Apex Promotions', role:'promo',   status:'Active',  plan:'PRMTN-HUB'    },
    { name:'Jordan Kim',      role:'fighter', status:'Flagged', plan:'Pipeline Pro' },
  ]
  const roleCounts = { fighter:201, manager:47, promo:12, admin:4 }
  return (
    <div className="space-y-4">
      <SectionHeading>Users & Roles</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
        {Object.entries(roleCounts).map(([role,count])=>(
          <div key={role} className="dash-card text-center">
            <div className="dash-label capitalize">{role}s</div>
            <div className="dash-stat mt-1">{count}</div>
            <div className="dash-bar-track"><div className="dash-bar-fill" style={{ width:`${count/312*100}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="dash-card">
        <div className="dash-label mb-3">Role Distribution</div>
        <BarChart height={80} data={[
          { label:'Fighters', value:201, color:'#8b0000' },
          { label:'Managers', value:47,  color:'#6b0000' },
          { label:'Promos',   value:12,  color:'#4a3030' },
          { label:'Admins',   value:4,   color:'#2a2a2e' },
        ]} />
      </div>
      <div className="space-y-2">
        {users.map(u=>(
          <div key={u.name} className="dash-card flex items-center gap-5">
            <div className="w-8 h-8 bg-charcoal-3 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="font-condensed text-[11px] font-bold text-gray-2">{u.name[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-condensed text-[13px] font-bold text-off-white truncate">{u.name}</div>
              <div className="font-condensed text-[10px] text-gray-3">{u.plan}</div>
            </div>
            <span className={`badge ${u.role==='fighter'?'badge-yellow':u.role==='manager'?'badge-green':'badge-red'}`}>{u.role}</span>
            <span className={`badge ${u.status==='Active'?'badge-green':u.status==='Flagged'?'badge-red':'badge-yellow'}`}>{u.status}</span>
            <button className="btn-ghost text-[9px] py-1.5 px-3">Manage</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function SponsorForgeAdmin() {
  return (
    <div className="space-y-4">
      <SectionHeading>SponsorForge Network</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
        <div className="dash-card text-center"><div className="dash-label">Sponsors</div><div className="dash-stat mt-1">24</div><div className="dash-sub">Verified</div></div>
        <StatCard label="Active Matches"      value="11" sub="In negotiation"   barPct={46} trend={3}  />
        <StatCard label="Deals Closed (90d)"  value="7"  sub="Total value $42K" barPct={70} trend={2}  />
        <StatCard label="Eligible Fighters"   value="48" sub="Platform wide"    barPct={24} trend={6}  />
      </div>
      <div className="dash-card">
        <div className="dash-label mb-3">Deal Volume (12 Months)</div>
        <SparkLine values={[2,2,3,3,4,4,5,6,6,7,7,7]} color="#c00000" />
      </div>
      <ListCard label="Recent Activity" items={[
        { name:'Marcus T. × Brand X — Deal Signed ($8K)',       badge:'Closed',    type:'green'  },
        { name:'Chris B. × Supplement Co. — Negotiating',      badge:'Active',    type:'yellow' },
        { name:'Diego M. × Apparel Brand — Profile Submitted', badge:'Submitted', type:'yellow' },
        { name:'Jordan K. — Access Blocked (Obligation Odue)', badge:'Blocked',   type:'red'    },
      ]} />
    </div>
  )
}

function Packages() {
  return (
    <div className="space-y-4">
      <SectionHeading>Packages & Subscriptions</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(3,1fr)' }}>
        <div className="dash-card text-center" style={{ borderTop:'2px solid #8b0000' }}>
          <div className="dash-label">Pipeline Pro</div>
          <ReadinessRing pct={59} size={80} label="%" />
          <div className="dash-stat mt-1">118</div><div className="dash-sub">fighters</div>
        </div>
        <div className="dash-card text-center" style={{ borderTop:'2px solid #6b0000' }}>
          <div className="dash-label">MGMT-SUITE</div>
          <ReadinessRing pct={47} size={80} label="%" />
          <div className="dash-stat mt-1">47</div><div className="dash-sub">managers</div>
        </div>
        <div className="dash-card text-center" style={{ borderTop:'2px solid #4a3030' }}>
          <div className="dash-label">PRMTN-HUB</div>
          <ReadinessRing pct={12} size={80} label="%" />
          <div className="dash-stat mt-1">12</div><div className="dash-sub">promotions</div>
        </div>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
        {[{k:'MRR',v:'$28.4K'},{k:'ARR Run',v:'$341K'},{k:'Churn 30d',v:'2.1%'},{k:'New MRR',v:'$4.2K'}].map(s=>(
          <div key={s.k} className="dash-card text-center">
            <div className="dash-label">{s.k}</div>
            <div className="font-display text-off-white" style={{ fontSize:28 }}>{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Content() {
  const mods = [
    {name:'Business Basics',pct:78},{name:'Financial Literacy',pct:55},{name:'Contract Reading',pct:28},
    {name:'Personal Branding',pct:61},{name:'NIL Rights',pct:33},{name:'Camp Budgeting',pct:49},
  ]
  return (
    <div className="space-y-4">
      <SectionHeading>Content & Modules</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'1fr 160px' }}>
        <div className="dash-card">
          <div className="dash-label mb-3">Module Completion Rates</div>
          <BarChart height={100} data={mods.map(m=>({ label:m.name.split(' ')[0], value:m.pct }))} />
        </div>
        <div className="dash-card text-center">
          <div className="dash-label">Platform Avg</div>
          <ReadinessRing pct={54} size={80} label="Done" />
          <div className="dash-sub mt-1">12 modules</div>
        </div>
      </div>
    </div>
  )
}

function Reports() {
  return (
    <div className="space-y-4">
      <SectionHeading>System Reports</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
        <div className="dash-card text-center"><div className="dash-label">Avg Readiness</div><ReadinessRing pct={63} size={80} /></div>
        <StatCard label="Obligations Rate" value="88%" barPct={88} />
        <StatCard label="Conduct Incidents" value={<span className="text-blood-glow">4</span>} sub="Last 30 days" barPct={10} barColor="#c00000" />
        <StatCard label="SF Matches"        value="11" sub="Active"             barPct={55} />
      </div>
      <div className="dash-card">
        <div className="dash-label mb-3">Platform Readiness Trend</div>
        <SparkLine values={[48,50,52,54,56,57,59,60,61,62,62,63]} />
        <div className="dash-sub mt-1">+15pts over 12 months</div>
      </div>
    </div>
  )
}

const VIEWS: Record<string,React.FC> = {
  overview:Overview, users:Users, mentors:()=>(
    <div className="space-y-4">
      <SectionHeading>Mentors & Consultants</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'1fr 1fr 160px' }}>
        <StatCard label="Active Consultants" value="8"  sub="Available for booking" barPct={80} />
        <StatCard label="Sessions This Month" value="34" sub="Across all fighters"  barPct={68} trend={4} />
        <div className="dash-card text-center"><div className="dash-label">Booking Rate</div><ReadinessRing pct={72} size={70} /></div>
      </div>
      <ListCard label="Consultant Roster" items={[
        { name:'Devon Price — Finance & Business',  badge:'Available', type:'green'  },
        { name:'James Okafor — Contracts & Legal',  badge:'Busy',      type:'yellow' },
        { name:'Kira Fontaine — Brand & Sponsors',  badge:'Available', type:'green'  },
        { name:'Ray Evans — Career Strategy',       badge:'Available', type:'green'  },
      ]} />
    </div>
  ),
  sponsorforge:SponsorForgeAdmin, packages:Packages, content:Content, reports:Reports,
}

export default function AdminDashboard() {
  return (
    <DashShell navItems={NAV} title="Admin Dashboard" subtitle="Platform Administration">
      {tab => { const V = VIEWS[tab] ?? Overview; return <V /> }}
    </DashShell>
  )
}
