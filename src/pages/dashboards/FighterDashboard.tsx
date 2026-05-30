import React from 'react'
import DashShell from './DashShell'
import { StatCard, ListCard, ReadinessRing, BarChart, SparkLine, RadarChart, ActivityHeatmap, Timeline, SectionHeading, FullWidthCard } from './DashWidgets'
import { useApi } from '../../hooks/useApi'

const NAV = [
  { id: 'overview',      label: 'Overview',       icon: '◈' },
  { id: 'sponsorships',  label: 'Sponsorships',   icon: '🤝' },
  { id: 'pipeline',      label: 'Pipeline',        icon: '▲' },
  { id: 'obligations',   label: 'Obligations',     icon: '📋' },
  { id: 'education',     label: 'Education',       icon: '📚' },
  { id: 'sponsorforge',  label: 'SponsorForge',    icon: '⚡' },
  { id: 'mentorship',    label: 'Mentorship',       icon: '🎯' },
  { id: 'transition',    label: 'Transition',       icon: '→' },
  { id: 'profile',       label: 'Profile',          icon: '👤' },
]

function Overview() {
  const { data } = useApi<any>('/api/fighter/overview')

  const readiness   = data?.readiness       ?? 79
  const stage       = data?.pipeline_stage  ?? 3
  const stagePct    = data?.pipeline_pct    ?? 60
  const sfScore     = data?.sponsor_score   ?? 45
  const openObs     = data?.open_obligations ?? 2
  const radar       = data?.radar ?? { brand:45, finance:60, conduct:88, sponsor:30, media:72, pipeline:60 }
  const trend       = data?.readiness_trend ?? [48,52,55,58,60,62,65,68,72,75,77,79]
  const actionItems = data?.action_items ?? [
    { name: 'Sponsor Content Due (2d overdue)',   badge: 'Overdue',  type: 'red'    },
    { name: 'Post-Fight Media — 3 Days',         badge: 'Urgent',   type: 'yellow' },
    { name: 'Financial Module — Continue',       badge: '60%',      type: 'yellow' },
    { name: 'Consultation — Apr 8 @ 2pm',        badge: 'Upcoming', type: 'green'  },
  ]
  const eduData = [
    { label: 'Business', value: 80 }, { label: 'Finance', value: 60 },
    { label: 'Contracts', value: 25 }, { label: 'Branding', value: 65 }, { label: 'NIL', value: 30 },
  ]

  return (
    <div className="space-y-4">
      <SectionHeading>Your Dashboard</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '200px 1fr 1fr 1fr' }}>
        <div className="dash-card flex flex-col items-center justify-center text-center row-span-2">
          <div className="dash-label w-full text-left mb-3">Readiness</div>
          <ReadinessRing pct={readiness} size={110} />
          <div className="dash-sub mt-3 text-center">3 areas need<br />attention</div>
        </div>
        <StatCard label="Pipeline Stage" value={String(stage)} sub={`of 5 complete`} barPct={stagePct} trend={5} />
        <StatCard label="Sponsor Score"  value={String(sfScore)} sub="100 = SponsorForge ready" barPct={sfScore} />
        <StatCard label="Open Obligations" value={<span className="text-blood-glow">{openObs}</span>} sub="1 overdue · 1 upcoming" barPct={20} barColor="#c00000" />
        <div className="dash-card flex flex-col items-center">
          <div className="dash-label w-full">Readiness Profile</div>
          <RadarChart axes={[
            { label: 'Brand',    value: radar.brand    },
            { label: 'Finance',  value: radar.finance  },
            { label: 'Conduct',  value: radar.conduct  },
            { label: 'Sponsor',  value: radar.sponsor  },
            { label: 'Media',    value: radar.media    },
            { label: 'Pipeline', value: radar.pipeline },
          ]} />
        </div>
        <div className="dash-card">
          <div className="dash-label">Activity (12 Weeks)</div>
          <ActivityHeatmap weeks={12} />
        </div>
        <div className="dash-card">
          <div className="dash-label">Readiness Trend</div>
          <SparkLine values={trend.length >= 2 ? trend : [48,52,55,58,60,62,65,68,72,75,77,79]} />
          <div className="dash-sub mt-2">+{(trend[trend.length-1] ?? 79) - (trend[0] ?? 48)}pts over 12 weeks</div>
        </div>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <ListCard label="Action Items" items={actionItems} />
        <div className="dash-card">
          <div className="dash-label">Education Progress</div>
          <BarChart height={100} data={eduData} />
        </div>
      </div>
    </div>
  )
}

function Pipeline() {
  const { data } = useApi<any>('/api/fighter/pipeline')

  const stages = data?.stages ?? [
    { n:'01', label:'Profile & Intake',            pct:100 },
    { n:'02', label:'Financial Literacy Baseline', pct:60  },
    { n:'03', label:'Brand & Digital Presence',    pct:45  },
    { n:'04', label:'Sponsor Readiness',           pct:10  },
    { n:'05', label:'SponsorForge Access',         pct:0   },
  ]
  const overall = data?.overall_pct ?? 43

  return (
    <div className="space-y-4">
      <SectionHeading>Eleventh Round Ready Pipeline</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 220px' }}>
        <div className="space-y-3">
          {stages.map((s: any) => (
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
          <ReadinessRing pct={overall} size={100} label="Pipeline" />
          <div className="dash-sub mt-3">Stage {stages.filter((s:any) => s.pct > 0).length} Active</div>
        </div>
      </div>
    </div>
  )
}

function Obligations() {
  const { data } = useApi<any>('/api/fighter/obligations')

  const sponsorObs  = data?.sponsor ?? [
    { name: 'Brand X — Instagram Post',    badge: 'Overdue 2d', type: 'red'    },
    { name: 'Brand Y — Story Post-Fight',  badge: 'Due Apr 8',  type: 'yellow' },
    { name: 'Brand Z — Quarterly Feature', badge: 'Due May 1',  type: 'green'  },
  ]
  const mediaObs = data?.media ?? [
    { name: 'Post-Fight Press Interview',  badge: '3 Days',   type: 'yellow' },
    { name: 'Promotion Social Tag',        badge: 'Complete', type: 'green'  },
    { name: 'Weigh-In Media Avail.',       badge: 'Upcoming', type: 'yellow' },
  ]
  const fulfillment = data?.fulfillment_pct  ?? 94
  const completed   = data?.completed_count  ?? 12
  const timeline    = data?.timeline ?? [
    { date: 'Overdue', label: 'Brand X Instagram Post', type: 'red' },
    { date: 'Apr 8',   label: 'Mentorship Session',     type: 'green' },
    { date: 'Apr 8',   label: 'Brand Y Story Post',     type: 'yellow' },
    { date: 'Apr 15',  label: 'Financial Module Due',   type: 'yellow' },
    { date: 'May 1',   label: 'Brand Z Feature',        type: 'green' },
  ]

  return (
    <div className="space-y-4">
      <SectionHeading>Obligations</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 160px' }}>
        <ListCard label="Sponsor Obligations" items={sponsorObs} />
        <ListCard label="Media Obligations"   items={mediaObs}   />
        <div className="dash-card text-center">
          <div className="dash-label">Fulfillment</div>
          <ReadinessRing pct={fulfillment} size={80} color="#00c060" label="%" />
          <div className="dash-sub mt-2">{completed} completed</div>
        </div>
      </div>
      <FullWidthCard label="Obligation Timeline">
        <Timeline events={timeline} />
      </FullWidthCard>
    </div>
  )
}

function Education() {
  const { data } = useApi<any>('/api/fighter/education')

  const mods = data?.modules ?? [
    { name:'Business Basics',      pct:80 }, { name:'Taxes & Filing',        pct:40 },
    { name:'Contract Reading',     pct:25 }, { name:'Personal Branding',     pct:65 },
    { name:'NIL Rights',           pct:30 }, { name:'Camp Budgeting',        pct:55 },
    { name:'Sponsorship Strategy', pct:15 }, { name:'Life After Fighting',   pct:0  },
  ]
  const overall  = data?.overall_pct   ?? 39
  const started  = data?.started_count ?? 5
  const total    = data?.total_count   ?? 8
  const chartData = data?.chart_data   ?? mods.slice(0,6).map((m:any) => ({ label:m.name.split(' ')[0], value:m.pct }))

  return (
    <div className="space-y-4">
      <SectionHeading>Education Modules</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 220px' }}>
        <div className="dash-card">
          <div className="dash-label mb-4">Module Completion</div>
          <BarChart height={120} data={chartData} />
        </div>
        <div className="dash-card flex flex-col items-center justify-center">
          <div className="dash-label mb-2">Overall Progress</div>
          <ReadinessRing pct={overall} size={90} label="Done" />
          <div className="dash-sub mt-2">{started} of {total} started</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {mods.map((m: any) => (
          <div key={m.name} className="dash-card">
            <div className="flex justify-between items-center mb-2">
              <span className="font-condensed text-[12px] font-semibold text-gray-1">{m.name}</span>
              <span className="font-display text-sm text-off-white">{m.pct}%</span>
            </div>
            <div className="dash-bar-track" style={{ marginTop:0 }}>
              <div className="dash-bar-fill" style={{ width:`${m.pct}%`, background: m.pct===0?'#222226':m.pct>70?'#00c060':'linear-gradient(90deg,#8b0000,#c00000)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SponsorForge() {
  const { data } = useApi<any>('/api/fighter/sponsorforge')

  const score    = data?.eligibility_score ?? 45
  const locked   = data?.is_locked         ?? true
  const reqs     = data?.requirements ?? [
    { name:'Sponsor Profile',       badge:'Incomplete', type:'red'    },
    { name:'Brand Readiness Score', badge:'45 / 100',   type:'yellow' },
    { name:'Pipeline Stage',        badge:'Stage 4+',   type:'red'    },
    { name:'Obligation Record',     badge:'94%',        type:'green'  },
  ]
  const progress = data?.eligibility_progress ?? [
    { label:'Brand',       value:45 }, { label:'Pipeline',    value:60 },
    { label:'Conduct',     value:88 }, { label:'Obligations', value:94 },
    { label:'Profile',     value:20 },
  ]

  return (
    <div className="space-y-4">
      <SectionHeading>SponsorForge</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 220px' }}>
        <div className="dash-card" style={{ borderLeft: locked ? '2px solid #c00000' : '2px solid #00c060' }}>
          <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-blood-glow mb-3">
            Status: {locked ? 'Locked' : 'Unlocked'}
          </div>
          {locked && (
            <p className="font-body text-gray-1 text-[13px] leading-relaxed mb-5">
              Complete Pipeline Stage 4 (Sponsor Readiness) to unlock access to the vetted sponsor network.
            </p>
          )}
          <ListCard label="Requirements" items={reqs} />
        </div>
        <div className="dash-card flex flex-col items-center text-center">
          <div className="dash-label mb-2">Eligibility Score</div>
          <ReadinessRing pct={score} size={90} />
          <div className="dash-sub mt-2">{100 - score} pts to unlock</div>
        </div>
      </div>
      <div className="dash-card">
        <div className="dash-label mb-3">Eligibility Progress</div>
        <BarChart height={80} data={progress} />
      </div>
    </div>
  )
}

function Mentorship() {
  const { data } = useApi<any>('/api/fighter/mentorship')

  const sessions    = data?.sessions ?? [
    { name:'Mar 24 — Career Roadmap Review', badge:'Complete', type:'green'  },
    { name:'Mar 10 — Sponsorship Prep',      badge:'Complete', type:'green'  },
    { name:'Feb 22 — Financial Kickoff',     badge:'Complete', type:'green'  },
    { name:'Apr 08 — Strategy Session',      badge:'Upcoming', type:'yellow' },
  ]
  const thisMonth   = data?.this_month   ?? 2
  const nextSession = data?.next_session ?? { date:'Apr 8', time:'2:00pm' }

  return (
    <div className="space-y-4">
      <SectionHeading>Mentorship & Consulting</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 160px' }}>
        <ListCard label="Session History" items={sessions} />
        <div className="dash-card">
          <div className="dash-label mb-3">Session Frequency</div>
          <BarChart height={90} data={[
            { label:'Jan', value:1 }, { label:'Feb', value:2 },
            { label:'Mar', value:3 }, { label:'Apr', value:1 },
          ]} />
        </div>
        <div className="dash-card text-center">
          <div className="dash-label">This Month</div>
          <div className="dash-stat mt-2">{thisMonth}</div>
          <div className="dash-sub">sessions</div>
          {nextSession && (
            <div className="dash-sub mt-4">Next<br />{nextSession.date}<br />{nextSession.time}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function Profile() {
  const { data } = useApi<any>('/api/fighter/profile')

  const name        = data?.name                ?? 'Marcus Torres'
  const division    = data?.division            ?? 'Welterweight'
  const record      = data?.record              ?? '12-3-0'
  const base        = data?.base                ?? 'Miami, FL'
  const manager     = data?.manager             ?? 'Ray Callahan'
  const completeness = data?.profile_completeness ?? 72

  return (
    <div className="space-y-4">
      <SectionHeading>My Profile</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="dash-card">
          <div className="dash-label">Fighter Info</div>
          {([['Full Name', name],['Division', division],['Record', record],['Base', base],['Manager', manager]] as [string,string][]).map(([k,v]) => (
            <div key={k} className="flex justify-between py-2 border-b border-charcoal-3 last:border-0 text-[12px]">
              <span className="font-condensed text-gray-3">{k}</span>
              <span className="font-condensed font-semibold text-off-white">{v}</span>
            </div>
          ))}
        </div>
        <div className="dash-card">
          <div className="dash-label mb-3">Profile Completeness</div>
          <ReadinessRing pct={completeness} size={90} label="Profile" />
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
            <div className="dash-bar-track"><div className="dash-bar-fill" style={{ width:'40%', background:'#4a4846' }} /></div>
            <div className="dash-sub mt-1">40% — Level 2 of 5 complete</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Sponsorships() {
  const { data } = useApi<any>('/api/fighter/marketplace')

  const totalApps    = data?.total_applications    ?? 0
  const acceptedApps = data?.accepted_applications ?? 0
  const acceptRate   = data?.acceptance_rate       ?? 0
  const activeC      = data?.active_contracts      ?? 0
  const totalC       = data?.total_contracts       ?? 0
  const earnings     = data?.total_earnings_usd    ?? 0
  const doneObs      = data?.completed_obligations ?? 0
  const pendingObs   = data?.pending_obligations   ?? 0

  const earningsDisplay = earnings >= 1000 ? `$${(earnings / 1000).toFixed(1)}K` : `$${earnings}`

  return (
    <div className="space-y-4">
      <SectionHeading>Sponsorship Stats</SectionHeading>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <StatCard label="Applications Sent"  value={String(totalApps)}    sub={`${acceptedApps} accepted`}  barPct={100} />
        <StatCard label="Acceptance Rate"    value={`${acceptRate}%`}     sub="of all applications"         barPct={acceptRate} />
        <StatCard label="Active Contracts"   value={String(activeC)}      sub={`${totalC} total`}           barPct={totalC > 0 ? Math.round(activeC / totalC * 100) : 0} />
        <div className="dash-card text-center">
          <div className="dash-label">Total Earnings</div>
          <div className="font-display text-off-white" style={{ fontSize: 28 }}>{earningsDisplay}</div>
          <div className="dash-sub">From succeeded payments</div>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="dash-card">
          <div className="dash-label mb-3">Obligations</div>
          <div className="flex items-center justify-between mb-2">
            <span className="dash-sub">Completed</span>
            <span className="font-condensed text-off-white font-bold">{doneObs}</span>
          </div>
          <div className="dash-bar-track mb-3">
            <div className="dash-bar-fill" style={{ width: `${doneObs + pendingObs > 0 ? Math.round(doneObs / (doneObs + pendingObs) * 100) : 0}%`, background: '#00c060' }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="dash-sub">Pending</span>
            <span className="font-condensed text-off-white font-bold">{pendingObs}</span>
          </div>
        </div>
        <div className="dash-card flex flex-col gap-3">
          <div className="dash-label">Quick Links</div>
          <a href="/opportunities" className="btn-ghost text-[11px] py-2 text-center block no-underline">Browse Opportunities</a>
          <a href="/fighter/applications" className="btn-ghost text-[11px] py-2 text-center block no-underline">My Applications</a>
          <a href="/contracts" className="btn-ghost text-[11px] py-2 text-center block no-underline">My Contracts</a>
        </div>
      </div>
    </div>
  )
}

const VIEWS: Record<string, React.FC> = {
  overview:Overview, sponsorships:Sponsorships, pipeline:Pipeline, obligations:Obligations,
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
