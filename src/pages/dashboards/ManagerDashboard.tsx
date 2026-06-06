import React from 'react'
import DashShell from './DashShell'
import { StatCard, ListCard, ReadinessRing, BarChart, SparkLine,
         SectionHeading, FullWidthCard, StackedBar,
         DashSkeleton, EmptyState, ApiError } from './DashWidgets'
import { useApi } from '../../hooks/useApi'

const NAV = [
  { id: 'overview',    label: 'Overview',      icon: '◈' },
  { id: 'roster',      label: 'Roster',        icon: '👥' },
  { id: 'obligations', label: 'Obligations',   icon: '📋' },
  { id: 'sponsorforge',label: 'SponsorForge',  icon: '⚡' },
  { id: 'playbooks',   label: 'Playbooks',     icon: '📖' },
  { id: 'budget',      label: 'Budget & Camp', icon: '💰' },
  { id: 'reports',     label: 'Reports',       icon: '📊' },
]

function Overview() {
  const { data, loading, error } = useApi<any>('/api/manager/overview')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const rosterCount = data?.active_roster      ?? 0
  const overdue     = data?.overdue_obligations ?? 0
  const sfReady     = data?.sf_ready           ?? 0
  const health      = data?.roster_health      ?? 0
  const rosterChart = data?.roster_chart       ?? []
  const actionItems = data?.action_items       ?? []

  if (rosterCount === 0) return (
    <div className="space-y-4">
      <SectionHeading>Operations Overview</SectionHeading>
      <EmptyState icon="👥" title="No Fighters Connected Yet"
        body="Invite a fighter by email or create a pending fighter profile to build your roster." />
    </div>
  )

  return (
    <div className="space-y-4">
      <SectionHeading>Operations Overview</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 1fr 160px' }}>
        <StatCard label="Active Roster"       value={String(rosterCount)} sub="Fighters managed"       barPct={100} />
        <StatCard label="Overdue Obligations" value={<span className={overdue>0?'text-blood-glow':''}>{overdue}</span>}
          sub="Require immediate action" barPct={overdue>0?40:0} barColor="#c00000" />
        <StatCard label="SponsorForge Ready"  value={String(sfReady)}
          sub="Eligible fighters" barPct={Math.round(sfReady/Math.max(rosterCount,1)*100)} />
        <div className="dash-card flex flex-col items-center text-center">
          <div className="dash-label">Roster Health</div>
          <ReadinessRing pct={health} size={80} />
          <div className="dash-sub mt-1">avg readiness</div>
        </div>
      </div>

      {rosterChart.length > 0 && (
        <div className="dash-card">
          <div className="dash-label mb-3">Roster Readiness Distribution</div>
          <BarChart height={100} data={rosterChart} />
        </div>
      )}

      {actionItems.length > 0
        ? <ListCard label="Immediate Actions" items={actionItems} />
        : <EmptyState icon="✓" title="No Immediate Actions" body="Your roster has no overdue obligations." />
      }
    </div>
  )
}

function Roster() {
  const { data, loading, error } = useApi<any>('/api/manager/roster')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const fighters = data?.fighters ?? []

  if (!fighters.length) return (
    <div className="space-y-4">
      <SectionHeading>Roster Management</SectionHeading>
      <EmptyState icon="👥" title="No Fighters Connected Yet"
        body="No fighters connected yet. Invite a fighter by email or create a pending fighter profile to start building your roster." />
    </div>
  )

  return (
    <div className="space-y-4">
      <SectionHeading>Roster Management</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(fighters.length,5)},1fr)` }}>
        {fighters.map((f: any) => (
          <div key={f.name} className="dash-card text-center" style={{ borderTop: `2px solid ${f.color}` }}>
            <div className="font-condensed text-[11px] font-bold text-off-white mb-0.5">{f.name.split(' ')[0]}</div>
            <div className="font-condensed text-[9px] text-gray-3 mb-3">{f.div}</div>
            <ReadinessRing pct={f.readiness} size={70} color={f.color} label="Ready" />
            <div className="font-condensed text-[9px] text-gray-3 mt-2">{f.record}</div>
            <div className="dash-bar-track" style={{ margin:'8px 0 4px' }}>
              <div className="dash-bar-fill" style={{ width:`${f.onboard}%`, background:f.color }} />
            </div>
            <div className="font-condensed text-[9px] text-gray-3">Onboard {f.onboard}%</div>
          </div>
        ))}
      </div>
      <FullWidthCard label="Roster Comparison">
        <BarChart height={90} data={fighters.map((f: any) => ({
          label: f.name.split(' ')[0], value: f.readiness,
          color: f.readiness >= 80 ? '#00c060' : f.readiness >= 60 ? '#c9a82c' : '#c00000',
        }))} />
      </FullWidthCard>
    </div>
  )
}

function Obligations() {
  const { data, loading, error } = useApi<any>('/api/manager/obligations')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const overdueItems  = data?.overdue    ?? []
  const thisWeekItems = data?.this_week  ?? []
  const rate          = data?.rate       ?? 100
  const fulfillChart  = data?.fulfillment_chart ?? []

  if (!overdueItems.length && !thisWeekItems.length) return (
    <div className="space-y-4">
      <SectionHeading>Obligations Tracker</SectionHeading>
      <EmptyState icon="📋" title="No Obligations"
        body="No active obligations across your roster. Obligations appear once sponsorship deals are active." />
    </div>
  )

  return (
    <div className="space-y-4">
      <SectionHeading>Obligations Tracker</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 160px' }}>
        {overdueItems.length
          ? <ListCard label="Overdue" items={overdueItems} />
          : <EmptyState title="No Overdue Items" body="All obligations are on track." />
        }
        {thisWeekItems.length
          ? <ListCard label="Due This Week" items={thisWeekItems} />
          : <EmptyState title="Nothing Due This Week" body="No obligations due in the next 7 days." />
        }
        <div className="dash-card text-center">
          <div className="dash-label">Rate</div>
          <ReadinessRing pct={rate} size={75} color="#c9a82c" label="%" />
          <div className="dash-sub mt-1">Last 90d</div>
        </div>
      </div>
      {fulfillChart.length > 0 && (
        <div className="dash-card">
          <div className="dash-label mb-3">Fulfillment by Fighter</div>
          <BarChart height={80} data={fulfillChart} />
        </div>
      )}
    </div>
  )
}

function SponsorForge() {
  const { data, loading, error } = useApi<any>('/api/manager/sponsorforge')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const fighters = data?.fighters ?? []

  if (!fighters.length) return (
    <div className="space-y-4">
      <SectionHeading>SponsorForge Eligibility</SectionHeading>
      <EmptyState icon="⚡" title="No Fighters in SponsorForge"
        body="Add fighters to your roster to see their SponsorForge eligibility scores here." />
    </div>
  )

  return (
    <div className="space-y-4">
      <SectionHeading>SponsorForge Eligibility</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(fighters.length,5)},1fr)` }}>
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
  const { data, loading, error } = useApi<any>('/api/manager/budget')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const totalBudget = data?.total_budget ?? 0
  const budgetUtil  = data?.budget_util  ?? 0
  const unplanned   = data?.unplanned    ?? 0
  const camps       = data?.camps        ?? []

  if (!camps.length) return (
    <div className="space-y-4">
      <SectionHeading>Budget & Camp Planning</SectionHeading>
      <EmptyState icon="💰" title="No Camp Budgets Yet"
        body="Camp budgets will appear here once they are created by the platform team." />
    </div>
  )

  const totalK = totalBudget >= 1000 ? `$${Math.round(totalBudget/1000)}K` : `$${totalBudget}`

  return (
    <div className="space-y-4">
      <SectionHeading>Budget & Camp Planning</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <StatCard label="Total Managed Budget"  value={totalK} sub="Across active camps" barPct={budgetUtil} />
        <StatCard label="Unplanned Events" value={<span className={unplanned>0?'text-blood-glow':''}>{unplanned}</span>}
          sub="Need scheduling" barPct={unplanned>0?40:0} barColor="#c00000" />
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
                { label:'Spent',     pct: c.alloc>0?Math.round(c.spent/c.alloc*100):0, color:'#c00000' },
                { label:'Remaining', pct: c.alloc>0?100-Math.round(c.spent/c.alloc*100):100, color:'#222226' },
              ]} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Reports() {
  const { data, loading, error } = useApi<any>('/api/manager/reports')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const rosterAvg  = data?.roster_avg       ?? 0
  const oblRate    = data?.obligations_rate ?? 100
  const incidents  = data?.conduct_incidents ?? 0
  const sfEligible = data?.sf_eligible      ?? '0/0'

  return (
    <div className="space-y-4">
      <SectionHeading>Reports</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="dash-card text-center"><div className="dash-label">Roster Avg</div><ReadinessRing pct={rosterAvg} size={80} /></div>
        <StatCard label="Obligations 90d" value={`${oblRate}%`} barPct={oblRate} />
        <StatCard label="Conduct Incidents" value={<span className={incidents>0?'text-blood-glow':''}>{incidents}</span>}
          sub="Last 60 days" barPct={incidents>0?10:0} barColor="#c00000" />
        <StatCard label="SF Eligible" value={sfEligible} barPct={40} />
      </div>
    </div>
  )
}

function Playbooks() {
  const { data, loading, error } = useApi<any>('/api/manager/playbooks')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const books = data?.playbooks?.map((p: any) => p.title) ?? []

  if (!books.length) return (
    <div className="space-y-4">
      <SectionHeading>Operations Playbooks</SectionHeading>
      <EmptyState icon="📖" title="No Playbooks Yet"
        body="Operations playbooks will appear here once the admin team publishes them." />
    </div>
  )

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
  overview: Overview, roster: Roster, obligations: Obligations,
  sponsorforge: SponsorForge, playbooks: Playbooks, budget: Budget, reports: Reports,
}

export default function ManagerDashboard() {
  return (
    <DashShell navItems={NAV} title="Manager Dashboard" subtitle="MGMT-SUITE">
      {tab => { const V = VIEWS[tab] ?? Overview; return <V /> }}
    </DashShell>
  )
}
