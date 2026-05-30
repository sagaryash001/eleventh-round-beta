import React from 'react'
import DashShell from './DashShell'
import { StatCard, ListCard, ReadinessRing, BarChart, SparkLine, SectionHeading } from './DashWidgets'
import { useApi } from '../../hooks/useApi'

const NAV = [
  { id:'overview',    label:'Platform Overview',  icon:'◈' },
  { id:'marketplace', label:'Marketplace',         icon:'🤝' },
  { id:'users',       label:'Users & Roles',      icon:'👥' },
  { id:'mentors',     label:'Mentors & Consults', icon:'🎯' },
  { id:'sponsorforge',label:'SponsorForge',       icon:'⚡' },
  { id:'packages',    label:'Packages & Subs',    icon:'📦' },
  { id:'content',     label:'Content Modules',    icon:'📚' },
  { id:'reports',     label:'System Reports',     icon:'📊' },
]

function Overview() {
  const { data } = useApi<any>('/api/admin/overview')

  const totalUsers   = data?.total_users     ?? 312
  const fighters     = data?.active_fighters ?? 201
  const managers     = data?.active_managers ?? 47
  const promotions   = data?.promotions      ?? 12
  const health       = data?.platform_health ?? 91
  const alerts       = data?.alerts ?? [
    { name:'Jordan K. — Conduct Flag Unresolved', badge:'Urgent',  type:'red'    },
    { name:'3 Sponsor Obligations Overdue',       badge:'Action',  type:'red'    },
    { name:'4 Onboardings Stalled > 14 days',     badge:'Review',  type:'yellow' },
    { name:'Module Update Available',             badge:'Info',    type:'green'  },
  ]

  return (
    <div className="space-y-4">
      <SectionHeading>Platform Overview</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
        <StatCard label="Total Users"     value={String(totalUsers)} sub="All roles"    barPct={78} trend={8} />
        <StatCard label="Active Fighters" value={String(fighters)}   sub="In pipeline"  barPct={Math.round(fighters / Math.max(totalUsers,1) * 100)} trend={5} />
        <StatCard label="Active Managers" value={String(managers)}   sub="With rosters" barPct={Math.round(managers / Math.max(totalUsers,1) * 100)} trend={2} />
        <StatCard label="Promotions"      value={String(promotions)} sub="PRMTN-HUB"    barPct={Math.round(promotions / Math.max(totalUsers,1) * 100)} trend={1} />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns:'2fr 1fr' }}>
        <div className="dash-card">
          <div className="dash-label mb-3">User Growth (12 Months)</div>
          <BarChart height={110} data={[
            {label:'May',value:180},{label:'Jun',value:195},{label:'Jul',value:200},
            {label:'Aug',value:210},{label:'Sep',value:215},{label:'Oct',value:224},
            {label:'Nov',value:240},{label:'Dec',value:258},{label:'Jan',value:272},
            {label:'Feb',value:288},{label:'Mar',value:300},{label:'Apr',value:totalUsers},
          ]} />
        </div>
        <div className="dash-card flex flex-col items-center text-center">
          <div className="dash-label mb-2">Platform Health</div>
          <ReadinessRing pct={health} size={100} color="#00c060" label="Health" />
          <div className="dash-sub mt-2">All systems normal</div>
          <div className="dash-sub">{alerts.filter((a: any) => a.type === 'red').length} active alert(s)</div>
        </div>
      </div>

      <ListCard label="System Alerts" items={alerts} />
    </div>
  )
}

function Users() {
  const { data } = useApi<any>('/api/admin/users')

  const users = data?.users ?? [
    { name:'Marcus Torres',   role:'fighter', status:'Active',  plan:'Pipeline Pro' },
    { name:'Ray Callahan',    role:'manager', status:'Active',  plan:'MGMT-SUITE'   },
    { name:'Anya Solis',      role:'fighter', status:'Pending', plan:'Free'         },
    { name:'Apex Promotions', role:'promo',   status:'Active',  plan:'PRMTN-HUB'    },
    { name:'Jordan Kim',      role:'fighter', status:'Flagged', plan:'Pipeline Pro' },
  ]

  const roleCounts = {
    fighter: users.filter((u: any) => u.role === 'fighter').length,
    manager: users.filter((u: any) => u.role === 'manager').length,
    promo:   users.filter((u: any) => u.role === 'promo' || u.role === 'promotion').length,
    admin:   users.filter((u: any) => u.role === 'admin').length,
  }
  const total = users.length || 1

  return (
    <div className="space-y-4">
      <SectionHeading>Users & Roles</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
        {(Object.entries(roleCounts) as [string,number][]).map(([role,count])=>(
          <div key={role} className="dash-card text-center">
            <div className="dash-label capitalize">{role}s</div>
            <div className="dash-stat mt-1">{count}</div>
            <div className="dash-bar-track"><div className="dash-bar-fill" style={{ width:`${count/total*100}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="dash-card">
        <div className="dash-label mb-3">Role Distribution</div>
        <BarChart height={80} data={[
          { label:'Fighters', value:roleCounts.fighter, color:'#8b0000' },
          { label:'Managers', value:roleCounts.manager, color:'#6b0000' },
          { label:'Promos',   value:roleCounts.promo,   color:'#4a3030' },
          { label:'Admins',   value:roleCounts.admin,   color:'#2a2a2e' },
        ]} />
      </div>
      <div className="space-y-2">
        {users.map((u: any)=>(
          <div key={u.id ?? u.name} className="dash-card flex items-center gap-5">
            <div className="w-8 h-8 bg-charcoal-3 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="font-condensed text-[11px] font-bold text-gray-2">{(u.name ?? '?')[0]}</span>
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

function Mentors() {
  const { data } = useApi<any>('/api/admin/mentors')

  const activeCons    = data?.active_consultants  ?? 8
  const sessionsMonth = data?.sessions_this_month ?? 34
  const bookingRate   = data?.booking_rate        ?? 72
  const consultants   = data?.consultants ?? [
    { name:'Devon Price — Finance & Business',  badge:'Available', type:'green'  },
    { name:'James Okafor — Contracts & Legal',  badge:'Busy',      type:'yellow' },
    { name:'Kira Fontaine — Brand & Sponsors',  badge:'Available', type:'green'  },
    { name:'Ray Evans — Career Strategy',       badge:'Available', type:'green'  },
  ]

  return (
    <div className="space-y-4">
      <SectionHeading>Mentors & Consultants</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'1fr 1fr 160px' }}>
        <StatCard label="Active Consultants"  value={String(activeCons)}    sub="Available for booking" barPct={80} />
        <StatCard label="Sessions This Month" value={String(sessionsMonth)} sub="Across all fighters"  barPct={68} trend={4} />
        <div className="dash-card text-center"><div className="dash-label">Booking Rate</div><ReadinessRing pct={bookingRate} size={70} /></div>
      </div>
      <ListCard label="Consultant Roster" items={consultants.map((c: any) => ({
        name:  typeof c.name === 'string' ? c.name : `${c.name} — ${c.specialty ?? ''}`,
        badge: c.badge ?? c.availability,
        type:  c.type ?? 'green',
      }))} />
    </div>
  )
}

function SponsorForgeAdmin() {
  const { data } = useApi<any>('/api/admin/sponsorforge')

  const sponsors        = data?.sponsors         ?? 24
  const activeMatches   = data?.active_matches   ?? 11
  const dealsClosed     = data?.deals_closed     ?? 7
  const totalValue      = data?.total_value      ?? 42000
  const eligibleFighters= data?.eligible_fighters ?? 48
  const activity        = data?.activity ?? [
    { name:'Marcus T. × Brand X — Deal Signed ($8K)',       badge:'Closed',    type:'green'  },
    { name:'Chris B. × Supplement Co. — Negotiating',      badge:'Active',    type:'yellow' },
    { name:'Diego M. × Apparel Brand — Profile Submitted', badge:'Submitted', type:'yellow' },
    { name:'Jordan K. — Access Blocked (Obligation Odue)', badge:'Blocked',   type:'red'    },
  ]

  const valueK = totalValue >= 1000 ? `$${Math.round(totalValue / 1000)}K` : `$${totalValue}`

  return (
    <div className="space-y-4">
      <SectionHeading>SponsorForge Network</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
        <div className="dash-card text-center"><div className="dash-label">Sponsors</div><div className="dash-stat mt-1">{sponsors}</div><div className="dash-sub">Verified</div></div>
        <StatCard label="Active Matches"      value={String(activeMatches)}    sub="In negotiation"           barPct={46} trend={3}  />
        <StatCard label="Deals Closed (90d)"  value={String(dealsClosed)}      sub={`Total value ${valueK}`} barPct={70} trend={2}  />
        <StatCard label="Eligible Fighters"   value={String(eligibleFighters)} sub="Platform wide"            barPct={24} trend={6}  />
      </div>
      <div className="dash-card">
        <div className="dash-label mb-3">Deal Volume (12 Months)</div>
        <SparkLine values={[2,2,3,3,4,4,5,6,6,7,7,dealsClosed]} color="#c00000" />
      </div>
      <ListCard label="Recent Activity" items={activity} />
    </div>
  )
}

function Packages() {
  const { data } = useApi<any>('/api/admin/packages')

  const pp   = data?.pipeline_pro ?? { count: 118, pct: 59 }
  const ms   = data?.mgmt_suite   ?? { count: 47,  pct: 47 }
  const ph   = data?.prmtn_hub    ?? { count: 12,  pct: 12 }
  const mrr  = data?.mrr          ?? 28400
  const churn= data?.churn        ?? 2.1

  const mrrDisplay = mrr >= 1000 ? `$${(mrr / 1000).toFixed(1)}K` : `$${mrr}`
  const arrDisplay = mrr >= 1000 ? `$${Math.round(mrr * 12 / 1000)}K` : `$${mrr * 12}`

  return (
    <div className="space-y-4">
      <SectionHeading>Packages & Subscriptions</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(3,1fr)' }}>
        <div className="dash-card text-center" style={{ borderTop:'2px solid #8b0000' }}>
          <div className="dash-label">Pipeline Pro</div>
          <ReadinessRing pct={pp.pct} size={80} label="%" />
          <div className="dash-stat mt-1">{pp.count}</div><div className="dash-sub">fighters</div>
        </div>
        <div className="dash-card text-center" style={{ borderTop:'2px solid #6b0000' }}>
          <div className="dash-label">MGMT-SUITE</div>
          <ReadinessRing pct={ms.pct} size={80} label="%" />
          <div className="dash-stat mt-1">{ms.count}</div><div className="dash-sub">managers</div>
        </div>
        <div className="dash-card text-center" style={{ borderTop:'2px solid #4a3030' }}>
          <div className="dash-label">PRMTN-HUB</div>
          <ReadinessRing pct={ph.pct} size={80} label="%" />
          <div className="dash-stat mt-1">{ph.count}</div><div className="dash-sub">promotions</div>
        </div>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
        {[
          {k:'MRR',      v:mrrDisplay},
          {k:'ARR Run',  v:arrDisplay},
          {k:'Churn 30d',v:`${churn}%`},
          {k:'New MRR',  v:'$4.2K'},
        ].map(s=>(
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
  const { data } = useApi<any>('/api/admin/content')

  const mods = data?.chart_data ?? data?.modules?.map((m: any) => ({ label: m.name.split(' ')[0], value: m.avg })) ?? [
    {label:'Business', value:78},{label:'Financial', value:55},{label:'Contract', value:28},
    {label:'Branding', value:61},{label:'NIL',       value:33},{label:'Camp',     value:49},
  ]
  const platformAvg  = data?.platform_avg  ?? 54
  const totalModules = data?.total_modules ?? 12

  return (
    <div className="space-y-4">
      <SectionHeading>Content & Modules</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'1fr 160px' }}>
        <div className="dash-card">
          <div className="dash-label mb-3">Module Completion Rates</div>
          <BarChart height={100} data={mods} />
        </div>
        <div className="dash-card text-center">
          <div className="dash-label">Platform Avg</div>
          <ReadinessRing pct={platformAvg} size={80} label="Done" />
          <div className="dash-sub mt-1">{totalModules} modules</div>
        </div>
      </div>
    </div>
  )
}

function Reports() {
  const { data } = useApi<any>('/api/admin/reports')

  const avgReadiness  = data?.avg_readiness     ?? 63
  const oblRate       = data?.obligations_rate  ?? 88
  const incidents     = data?.conduct_incidents ?? 4
  const sfMatches     = data?.sf_matches        ?? 11

  return (
    <div className="space-y-4">
      <SectionHeading>System Reports</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
        <div className="dash-card text-center"><div className="dash-label">Avg Readiness</div><ReadinessRing pct={avgReadiness} size={80} /></div>
        <StatCard label="Obligations Rate" value={`${oblRate}%`} barPct={oblRate} />
        <StatCard label="Conduct Incidents" value={<span className="text-blood-glow">{incidents}</span>} sub="Last 30 days" barPct={10} barColor="#c00000" />
        <StatCard label="SF Matches"        value={String(sfMatches)} sub="Active" barPct={55} />
      </div>
      <div className="dash-card">
        <div className="dash-label mb-3">Platform Readiness Trend</div>
        <SparkLine values={[48,50,52,54,56,57,59,60,61,62,62,avgReadiness]} />
        <div className="dash-sub mt-1">+{avgReadiness - 48}pts over 12 months</div>
      </div>
    </div>
  )
}

function Marketplace() {
  const { data } = useApi<any>('/api/admin/marketplace')
  const { data: analytics } = useApi<any>('/api/admin/analytics')

  const gmv             = data?.gmv_usd             ?? 0
  const activeContracts = data?.active_contracts     ?? 0
  const totalContracts  = data?.total_contracts      ?? 0
  const sponsorCount    = data?.sponsor_count        ?? 0
  const verifiedSponsors = data?.verified_sponsors   ?? 0
  const openDisputes    = data?.open_disputes        ?? 0
  const totalApps       = data?.total_applications   ?? 0
  const funnel          = data?.applications_funnel  ?? {}
  const recent          = data?.recent_contracts     ?? []
  const monthlyGmv      = analytics?.monthly_gmv    ?? []

  const gmvDisplay = gmv >= 1000 ? `$${(gmv / 1000).toFixed(1)}K` : `$${gmv}`

  return (
    <div className="space-y-4">
      <SectionHeading>Marketplace Overview</SectionHeading>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="dash-card text-center">
          <div className="dash-label">GMV</div>
          <div className="font-display text-off-white" style={{ fontSize: 28 }}>{gmvDisplay}</div>
          <div className="dash-sub">Total payments succeeded</div>
        </div>
        <StatCard label="Active Contracts"  value={String(activeContracts)}  sub={`${totalContracts} total`}          barPct={totalContracts > 0 ? Math.round(activeContracts / totalContracts * 100) : 0} />
        <StatCard label="Sponsors"          value={String(sponsorCount)}     sub={`${verifiedSponsors} verified`}      barPct={sponsorCount > 0 ? Math.round(verifiedSponsors / sponsorCount * 100) : 0} />
        <div className="dash-card text-center" style={{ borderTop: openDisputes > 0 ? '2px solid #c00000' : undefined }}>
          <div className="dash-label">Open Disputes</div>
          <div className="font-display" style={{ fontSize: 28, color: openDisputes > 0 ? '#c00000' : '#f0ece4' }}>{openDisputes}</div>
          <div className="dash-sub">Requires admin review</div>
        </div>
      </div>

      {monthlyGmv.length > 0 && (
        <div className="dash-card">
          <div className="dash-label mb-3">Monthly GMV (6 months)</div>
          <BarChart height={100} data={monthlyGmv} />
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="dash-card">
          <div className="dash-label mb-3">Applications Funnel ({totalApps} total)</div>
          {Object.entries(funnel).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between mb-2">
              <span className="dash-sub capitalize">{status.replace('_', ' ')}</span>
              <div className="flex items-center gap-2">
                <div className="dash-bar-track" style={{ width: 80 }}>
                  <div className="dash-bar-fill" style={{ width: `${totalApps > 0 ? Math.round((count as number) / totalApps * 100) : 0}%` }} />
                </div>
                <span className="dash-sub w-6 text-right">{count as number}</span>
              </div>
            </div>
          ))}
        </div>
        <ListCard label="Recent Contracts" items={recent.length > 0 ? recent : [{ name: 'No contracts yet', badge: '—', type: 'yellow' }]} />
      </div>
    </div>
  )
}

const VIEWS: Record<string,React.FC> = {
  overview:Overview, marketplace:Marketplace, users:Users, mentors:Mentors,
  sponsorforge:SponsorForgeAdmin, packages:Packages, content:Content, reports:Reports,
}

export default function AdminDashboard() {
  return (
    <DashShell navItems={NAV} title="Admin Dashboard" subtitle="Platform Administration">
      {tab => { const V = VIEWS[tab] ?? Overview; return <V /> }}
    </DashShell>
  )
}
