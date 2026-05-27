import React from 'react'
import DashShell from './DashShell'
import { StatCard, ListCard, ReadinessRing, BarChart, SparkLine, SectionHeading, FullWidthCard, StackedBar } from './DashWidgets'
import { useApi } from '../../hooks/useApi'

const NAV = [
  { id: 'overview',    label: 'Overview',        icon: '◈' },
  { id: 'roster',      label: 'Roster',          icon: '👥' },
  { id: 'obligations', label: 'Obligations',     icon: '📋' },
  { id: 'sponsorforge',label: 'SponsorForge',    icon: '⚡' },
  { id: 'playbooks',   label: 'Playbooks',       icon: '📖' },
  { id: 'budget',      label: 'Budget & Camp',   icon: '💰' },
  { id: 'reports',     label: 'Reports',         icon: '📊' },
]

function Overview() {
  const { data } = useApi<any>('/api/manager/overview')

  const rosterCount  = data?.active_roster      ?? 5
  const overdue      = data?.overdue_obligations ?? 2
  const sfReady      = data?.sf_ready           ?? 2
  const health       = data?.roster_health      ?? 68
  const rosterChart  = data?.roster_chart       ?? [
    { label: 'Marcus', value: 82, color: '#00c060' },
    { label: 'Jordan', value: 54, color: '#c9a82c' },
    { label: 'Diego',  value: 70, color: '#c9a82c' },
    { label: 'Anya',   value: 22, color: '#c00000' },
    { label: 'Chris',  value: 88, color: '#00c060' },
  ]
  const actionItems  = data?.action_items ?? [
    { name: 'Jordan K. — Instagram Post Overdue',  badge: 'Act Now',   type: 'red'    },
    { name: 'Marcus T. — Press Interview Due',     badge: 'Tomorrow',  type: 'yellow' },
    { name: 'Anya S. — Onboarding Stalled',       badge: 'Follow Up', type: 'red'    },
    { name: 'Jordan K. — Conduct Flag Review',    badge: 'Review',    type: 'red'    },
  ]

  return (
    <div className="space-y-4">
      <SectionHeading>Operations Overview</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 1fr 160px' }}>
        <StatCard label="Active Roster"       value={String(rosterCount)}  sub="Fighters managed"    barPct={100} trend={0} />
        <StatCard label="Overdue Obligations" value={<span className="text-blood-glow">{overdue}</span>} sub="Require immediate action" barPct={40} barColor="#c00000" />
        <StatCard label="SponsorForge Ready"  value={String(sfReady)}  sub="Eligible fighters" barPct={Math.round(sfReady / Math.max(rosterCount, 1) * 100)} trend={1} />
        <div className="dash-card flex flex-col items-center text-center">
          <div className="dash-label">Roster Health</div>
          <ReadinessRing pct={health} size={80} />
          <div className="dash-sub mt-1">avg readiness</div>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="dash-card">
          <div className="dash-label mb-3">Roster Readiness Distribution</div>
          <BarChart height={100} data={rosterChart} />
        </div>
        <div className="dash-card">
          <div className="dash-label mb-2">Obligation Fulfillment Trend</div>
          <SparkLine values={[72,75,78,74,80,82,84,86,88,85,88,88]} />
          <div className="dash-sub mt-1">88% — Last 30 days</div>
          <div className="dash-bar-track"><div className="dash-bar-fill" style={{ width: '88%' }} /></div>
        </div>
      </div>

      <ListCard label="Immediate Actions" items={actionItems} />
    </div>
  )
}

function Roster() {
  const { data } = useApi<any>('/api/manager/roster')

  const fighters = data?.fighters ?? [
    { name:'Marcus Torres', div:'Welterweight', record:'12-3', onboard:100, readiness:82, sf:'Eligible',  color:'#00c060' },
    { name:'Jordan Kim',    div:'Lightweight',  record:'8-1',  onboard:65,  readiness:54, sf:'Blocked',   color:'#c00000' },
    { name:'Diego Morales', div:'Middleweight', record:'6-2',  onboard:75,  readiness:70, sf:'80% Ready', color:'#c9a82c' },
    { name:'Anya Solis',    div:'Featherweight',record:'4-0',  onboard:0,   readiness:22, sf:'Not Ready', color:'#c00000' },
    { name:'Chris Burke',   div:'Heavyweight',  record:'15-6', onboard:100, readiness:88, sf:'Eligible',  color:'#00c060' },
  ]

  return (
    <div className="space-y-4">
      <SectionHeading>Roster Management</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        {fighters.map((f: any) => (
          <div key={f.name} className="dash-card text-center" style={{ borderTop: `2px solid ${f.color}` }}>
            <div className="font-condensed text-[11px] font-bold text-off-white mb-0.5">{f.name.split(' ')[0]}</div>
            <div className="font-condensed text-[9px] text-gray-3 mb-3">{f.div}</div>
            <ReadinessRing pct={f.readiness} size={70} color={f.color} label="Ready" />
            <div className="font-condensed text-[9px] text-gray-3 mt-2">{f.record}</div>
            <div className="dash-bar-track" style={{ margin: '8px 0 4px' }}>
              <div className="dash-bar-fill" style={{ width:`${f.onboard}%`, background:f.color }} />
            </div>
            <div className="font-condensed text-[9px] text-gray-3">Onboard {f.onboard}%</div>
          </div>
        ))}
      </div>
      <FullWidthCard label="Roster Comparison">
        <BarChart height={90} data={fighters.map((f: any) => ({
          label: f.name.split(' ')[0], value: f.readiness,
          color: f.readiness >= 80 ? '#00c060' : f.readiness >= 60 ? '#c9a82c' : '#c00000'
        }))} />
      </FullWidthCard>
    </div>
  )
}

function Obligations() {
  const { data } = useApi<any>('/api/manager/obligations')

  const overdueItems   = data?.overdue ?? [
    { name: 'Jordan K. — Instagram Post (2d)', badge: 'Critical', type: 'red' },
    { name: 'Anya S. — Media Check-In',       badge: 'Overdue',  type: 'red' },
  ]
  const thisWeekItems  = data?.this_week ?? [
    { name: 'Marcus T. — Press Interview',   badge: 'Tomorrow', type: 'yellow' },
    { name: 'Diego M. — Sponsor Report',     badge: 'Apr 7',    type: 'yellow' },
    { name: 'Chris B. — Social Story Tag',   badge: 'Apr 9',    type: 'yellow' },
  ]
  const rate           = data?.rate ?? 88
  const fulfillChart   = data?.fulfillment_chart ?? [
    { label:'Marcus', value:98, color:'#00c060' },
    { label:'Jordan', value:62, color:'#c00000' },
    { label:'Diego',  value:90, color:'#c9a82c' },
    { label:'Anya',   value:45, color:'#c00000' },
    { label:'Chris',  value:100, color:'#00c060' },
  ]

  return (
    <div className="space-y-4">
      <SectionHeading>Obligations Tracker</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 160px' }}>
        <ListCard label="Overdue" items={overdueItems} />
        <ListCard label="Due This Week" items={thisWeekItems} />
        <div className="dash-card text-center">
          <div className="dash-label">Rate</div>
          <ReadinessRing pct={rate} size={75} color="#c9a82c" label="%" />
          <div className="dash-sub mt-1">Last 90d</div>
        </div>
      </div>
      <div className="dash-card">
        <div className="dash-label mb-3">Fulfillment by Fighter</div>
        <BarChart height={80} data={fulfillChart} />
      </div>
    </div>
  )
}

function SponsorForge() {
  const { data } = useApi<any>('/api/manager/sponsorforge')

  const fighters = data?.fighters ?? [
    { name:'Marcus Torres', pct:95, type:'green',  status:'Eligible'   },
    { name:'Chris Burke',   pct:88, type:'green',  status:'Eligible'   },
    { name:'Diego Morales', pct:80, type:'yellow', status:'80% Ready'  },
    { name:'Jordan Kim',    pct:42, type:'red',    status:'Blocked'    },
    { name:'Anya Solis',    pct:18, type:'red',    status:'Not Ready'  },
  ]

  return (
    <div className="space-y-4">
      <SectionHeading>SponsorForge Eligibility</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        {fighters.map((f: any) => {
          const color = f.type==='green'?'#00c060':f.type==='yellow'?'#c9a82c':'#c00000'
          return (
            <div key={f.name} className="dash-card text-center" style={{ borderTop:`2px solid ${color}` }}>
              <div className="font-condensed text-[11px] font-bold text-off-white mb-3">{f.name.split(' ')[0]}</div>
              <ReadinessRing pct={f.pct} size={72} color={color} label="Eligib." />
              <div className={`badge mt-3 badge-${f.type}`}>{f.status}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Budget() {
  const { data } = useApi<any>('/api/manager/budget')

  const totalBudget = data?.total_budget ?? 84000
  const budgetUtil  = data?.budget_util  ?? 64
  const unplanned   = data?.unplanned    ?? 2
  const camps       = data?.camps ?? [
    { name:'Marcus T. — Apr Fight Camp', alloc:22000, spent:14000 },
    { name:'Diego M. — May Prep',        alloc:18000, spent:6000  },
    { name:'Chris B. — June Card',       alloc:28000, spent:0     },
  ]

  const totalK = totalBudget >= 1000 ? `$${Math.round(totalBudget / 1000)}K` : `$${totalBudget}`

  return (
    <div className="space-y-4">
      <SectionHeading>Budget & Camp Planning</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <StatCard label="Total Managed Budget" value={totalK} sub="Across active camps" barPct={budgetUtil} />
        <StatCard label="Unplanned Events" value={<span className="text-blood-glow">{unplanned}</span>} sub="Need scheduling" barPct={40} barColor="#c00000" />
        <StatCard label="Budget Utilization" value={`${budgetUtil}%`} sub="On track" barPct={budgetUtil} />
      </div>
      <div className="dash-card">
        <div className="dash-label mb-4">Camp Budget Breakdown</div>
        <div className="space-y-4">
          {camps.map((c: any) => (
            <div key={c.name}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-condensed text-[12px] font-semibold text-off-white">{c.name}</span>
                <span className="font-condensed text-[11px] text-gray-3">${c.spent.toLocaleString()} / ${c.alloc.toLocaleString()}</span>
              </div>
              <StackedBar segments={[
                { label:'Spent',     pct: c.alloc > 0 ? Math.round(c.spent / c.alloc * 100) : 0, color:'#c00000' },
                { label:'Remaining', pct: c.alloc > 0 ? 100 - Math.round(c.spent / c.alloc * 100) : 100, color:'#222226' },
              ]} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Reports() {
  const { data } = useApi<any>('/api/manager/reports')

  const rosterAvg   = data?.roster_avg        ?? 63
  const oblRate     = data?.obligations_rate  ?? 88
  const incidents   = data?.conduct_incidents ?? 1
  const sfEligible  = data?.sf_eligible       ?? '2/5'

  return (
    <div className="space-y-4">
      <SectionHeading>Reports</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="dash-card text-center"><div className="dash-label">Roster Avg</div><ReadinessRing pct={rosterAvg} size={80} /></div>
        <StatCard label="Obligations 90d" value={`${oblRate}%`} barPct={oblRate} />
        <StatCard label="Conduct Incidents" value={<span className="text-blood-glow">{incidents}</span>} sub="Last 60 days" barPct={10} barColor="#c00000" />
        <StatCard label="SF Eligible" value={sfEligible} barPct={40} />
      </div>
      <div className="dash-card">
        <div className="dash-label mb-3">Readiness Trend — All Fighters</div>
        <SparkLine values={[50,52,54,56,58,60,62,63,65,64,67,68]} />
      </div>
    </div>
  )
}

function Playbooks() {
  const { data } = useApi<any>('/api/manager/playbooks')

  const books = data?.playbooks?.map((p: any) => p.title) ?? [
    'Conduct Incident Protocol','Sponsor Relationship Playbook',
    'Fight Camp Operations Checklist','Media Obligation Tracker','Fighter Onboarding Template',
  ]

  return (
    <div className="space-y-4">
      <SectionHeading>Operations Playbooks</SectionHeading>
      <div className="space-y-2">
        {books.map((b: string) => (
          <div key={b} className="dash-card flex items-center justify-between hover:border-blood/40 transition-colors cursor-pointer">
            <span className="font-condensed text-[13px] font-bold text-off-white">{b}</span>
            <button className="btn-ghost text-[10px] py-2 px-4">Open</button>
          </div>
        ))}
      </div>
    </div>
  )
}

const VIEWS: Record<string,React.FC> = {
  overview:Overview, roster:Roster, obligations:Obligations,
  sponsorforge:SponsorForge, playbooks:Playbooks, budget:Budget, reports:Reports,
}

export default function ManagerDashboard() {
  return (
    <DashShell navItems={NAV} title="Manager Dashboard" subtitle="MGMT-SUITE Lite">
      {tab => { const V = VIEWS[tab] ?? Overview; return <V /> }}
    </DashShell>
  )
}
