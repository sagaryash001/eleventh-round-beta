import React from 'react'
import DashShell from './DashShell'
import { StatCard, ListCard, ReadinessRing, BarChart, SparkLine,
         SectionHeading, DashSkeleton, EmptyState, ApiError, ChecklistItem } from './DashWidgets'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../hooks/useAuth'

const NAV = [
  { id: 'overview',    label: 'Platform Overview', icon: '◈' },
  { id: 'setup',       label: 'Setup Checklist',   icon: '✓' },
  { id: 'marketplace', label: 'Marketplace',        icon: '🤝' },
  { id: 'users',       label: 'Users & Roles',     icon: '👥' },
  { id: 'mentors',     label: 'Mentors & Consults',icon: '🎯' },
  { id: 'sponsorforge',label: 'SponsorForge',      icon: '⚡' },
  { id: 'packages',    label: 'Packages & Subs',   icon: '📦' },
  { id: 'content',     label: 'Content Modules',   icon: '📚' },
  { id: 'reports',     label: 'System Reports',    icon: '📊' },
]

function Overview() {
  const { data, loading, error } = useApi<any>('/api/admin/overview')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const totalUsers = data?.total_users     ?? 0
  const fighters   = data?.active_fighters ?? 0
  const managers   = data?.active_managers ?? 0
  const promotions = data?.promotions      ?? 0
  const health     = data?.platform_health ?? 0
  const alerts     = data?.alerts          ?? []

  return (
    <div className="space-y-4">
      <SectionHeading>Platform Overview</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
        <StatCard label="Total Users"     value={String(totalUsers)} sub="All roles"    barPct={Math.min(totalUsers, 100)} />
        <StatCard label="Active Fighters" value={String(fighters)}   sub="In pipeline"  barPct={totalUsers>0?Math.round(fighters/totalUsers*100):0} />
        <StatCard label="Active Managers" value={String(managers)}   sub="With rosters" barPct={totalUsers>0?Math.round(managers/totalUsers*100):0} />
        <StatCard label="Promotions"      value={String(promotions)} sub="PRMTN-HUB"    barPct={totalUsers>0?Math.round(promotions/totalUsers*100):0} />
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns:'2fr 1fr' }}>
        <div className="dash-card">
          <div className="dash-label mb-2">Total Users</div>
          <div className="dash-stat">{totalUsers}</div>
          {totalUsers === 0 && <div className="dash-sub mt-1">No users yet — invite fighters, managers, and sponsors to get started.</div>}
        </div>
        <div className="dash-card flex flex-col items-center text-center">
          <div className="dash-label mb-2">Platform Health</div>
          <ReadinessRing pct={health} size={100} color="#00c060" label="Health" />
          <div className="dash-sub mt-2">{health > 0 ? 'All systems normal' : 'Not calculated'}</div>
        </div>
      </div>
      {alerts.length > 0
        ? <ListCard label="System Alerts" items={alerts} />
        : <EmptyState icon="✓" title="No Active Alerts" body="The platform has no unresolved alerts." />
      }
    </div>
  )
}

// ── Admin Setup Checklist ──────────────────────────────────────────────────────
function Setup() {
  const { user }                          = useAuth()
  const { data: usersData }               = useApi<any>('/api/admin/users')
  const { data: mentorsData }             = useApi<any>('/api/admin/mentors')
  const { data: contentData }             = useApi<any>('/api/admin/content')
  const { data: healthData, loading }     = useApi<any>('/api/health')

  const hasUsers       = (usersData?.total ?? 0) > 0
  const hasMentors     = (mentorsData?.active_consultants ?? 0) > 0
  const hasModules     = (contentData?.total_modules ?? 0) > 0
  const emailConfigured= !!healthData?.email
  const supabaseOk     = !!healthData?.supabase

  const checklist = [
    {
      done:   true,
      label:  'Account created',
      detail: `Signed in as ${user?.email}`,
    },
    {
      done:   supabaseOk,
      label:  'Supabase connected',
      detail: supabaseOk ? 'Auth and database are live' : 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Render',
    },
    {
      done:   emailConfigured,
      label:  'Email (SMTP) configured',
      detail: emailConfigured ? 'Welcome and verification emails are enabled' : 'Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS on Render',
    },
    {
      done:   hasUsers,
      label:  'First users registered',
      detail: hasUsers ? `${usersData?.total ?? '?'} users in the system` : 'Share the registration link to invite your first fighters',
    },
    {
      done:   hasModules,
      label:  'Education modules published',
      detail: hasModules ? `${contentData?.total_modules} modules available` : 'Modules were seeded at migration time — verify in Content tab',
    },
    {
      done:   hasMentors,
      label:  'Consultants / mentors added',
      detail: hasMentors ? `${mentorsData?.active_consultants} active consultants` : 'Add consultants via the Mentors tab',
      href:   '#',
    },
    {
      done:   false,
      label:  'Review sponsor vetting queue',
      detail: 'New sponsors require admin approval before they can contact fighters',
    },
    {
      done:   false,
      label:  'Set your password',
      detail: 'Use "Forgot Password" on the login page or request a reset from Supabase Auth dashboard',
    },
  ]

  const completed = checklist.filter(c => c.done).length

  return (
    <div className="space-y-6 max-w-2xl">
      <SectionHeading>Admin Setup Checklist</SectionHeading>

      <div className="dash-card">
        <div className="flex items-center justify-between mb-4">
          <div className="dash-label">Progress</div>
          <div className="font-condensed font-bold text-off-white" style={{ fontSize: 13 }}>
            {completed} / {checklist.length} complete
          </div>
        </div>
        <div className="dash-bar-track mb-4">
          <div className="dash-bar-fill" style={{
            width: `${Math.round(completed / checklist.length * 100)}%`,
            background: completed === checklist.length ? '#00c060' : '#c00000',
          }} />
        </div>
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-charcoal-3 border-t-blood-glow rounded-full animate-spin" />
          </div>
        ) : (
          checklist.map((item, i) => (
            <ChecklistItem key={i} done={item.done} label={item.label} detail={item.detail} href={item.href} />
          ))
        )}
      </div>

      <div className="dash-card" style={{ borderLeft: '2px solid #8b0000' }}>
        <div className="dash-label mb-2">Kevin's Handoff Notes</div>
        <ul className="space-y-2 font-body text-gray-2" style={{ fontSize: 13, lineHeight: 1.6 }}>
          <li>• Your admin email is <strong className="text-off-white">lekakevin679@gmail.com</strong></li>
          <li>• To change your password: click "Forgot Password" on the login page</li>
          <li>• Packages and prices are not yet Stripe-connected — pricing will be admin-editable once Stripe is configured</li>
          <li>• Sponsor vetting: find sponsors in the Users tab, confirm their profile looks legitimate, then update <code className="text-blood-glow">sponsor_profiles.is_verified = true</code> in Supabase directly until the admin UI is built</li>
        </ul>
      </div>
    </div>
  )
}

function Users() {
  const { data, loading, error } = useApi<any>('/api/admin/users')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const users = data?.users ?? []
  const total = data?.total ?? 0

  if (!users.length) return (
    <div className="space-y-4">
      <SectionHeading>Users & Roles</SectionHeading>
      <EmptyState icon="👥" title="No Users Yet"
        body="Once users register, they will appear here. Share the registration link to get started." />
    </div>
  )

  const roleCounts = {
    fighter: users.filter((u: any) => u.role === 'fighter').length,
    manager: users.filter((u: any) => u.role === 'manager').length,
    sponsor: users.filter((u: any) => u.role === 'sponsor').length,
    admin:   users.filter((u: any) => u.role === 'admin').length,
  }

  return (
    <div className="space-y-4">
      <SectionHeading>Users & Roles — {total} total</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
        {(Object.entries(roleCounts) as [string,number][]).map(([role,count]) => (
          <div key={role} className="dash-card text-center">
            <div className="dash-label capitalize">{role}s</div>
            <div className="dash-stat mt-1">{count}</div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {users.map((u: any) => (
          <div key={u.id ?? u.name} className="dash-card flex items-center gap-5">
            <div className="w-8 h-8 bg-charcoal-3 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="font-condensed text-[11px] font-bold text-gray-2">{(u.name ?? '?')[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-condensed text-[13px] font-bold text-off-white truncate">{u.name}</div>
              <div className="font-condensed text-[10px] text-gray-3">{u.email}</div>
            </div>
            <span className={`badge ${u.role==='fighter'?'badge-yellow':u.role==='manager'?'badge-green':u.role==='sponsor'?'badge-red':'badge-yellow'}`}>
              {u.role}
            </span>
            <span className={`badge ${u.status==='Active'?'badge-green':'badge-yellow'}`}>{u.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Mentors() {
  const { data, loading, error } = useApi<any>('/api/admin/mentors')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const activeCons    = data?.active_consultants  ?? 0
  const sessionsMonth = data?.sessions_this_month ?? 0
  const bookingRate   = data?.booking_rate        ?? 0
  const consultants   = data?.consultants         ?? []

  if (!consultants.length) return (
    <div className="space-y-4">
      <SectionHeading>Mentors & Consultants</SectionHeading>
      <EmptyState icon="🎯" title="No Consultants Added Yet"
        body="Add mentors and consultants to the platform via the Supabase dashboard. They will appear here once the admin UI is built." />
    </div>
  )

  return (
    <div className="space-y-4">
      <SectionHeading>Mentors & Consultants</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'1fr 1fr 160px' }}>
        <StatCard label="Active Consultants"  value={String(activeCons)}    sub="Available for booking" barPct={80} />
        <StatCard label="Sessions This Month" value={String(sessionsMonth)} sub="Across all fighters"   barPct={68} />
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
  const { data, loading, error } = useApi<any>('/api/admin/sponsorforge')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const sponsors         = data?.sponsors          ?? 0
  const activeMatches    = data?.active_matches    ?? 0
  const dealsClosed      = data?.deals_closed      ?? 0
  const totalValue       = data?.total_value       ?? 0
  const eligibleFighters = data?.eligible_fighters ?? 0
  const activity         = data?.activity          ?? []
  const valueK = totalValue >= 1000 ? `$${Math.round(totalValue/1000)}K` : `$${totalValue}`

  return (
    <div className="space-y-4">
      <SectionHeading>SponsorForge Network</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
        <div className="dash-card text-center"><div className="dash-label">Sponsors</div><div className="dash-stat mt-1">{sponsors}</div><div className="dash-sub">Verified</div></div>
        <StatCard label="Active Matches"     value={String(activeMatches)}   sub="In negotiation"           barPct={46} />
        <StatCard label="Deals Closed (90d)" value={String(dealsClosed)}     sub={`Total value ${valueK}`}  barPct={70} />
        <StatCard label="Eligible Fighters"  value={String(eligibleFighters)} sub="Platform wide"           barPct={24} />
      </div>
      {activity.length > 0
        ? <ListCard label="Recent Activity" items={activity} />
        : <EmptyState icon="⚡" title="No SponsorForge Activity Yet"
            body="Match activity will appear here once fighters reach eligibility and sponsors publish opportunities." />
      }
    </div>
  )
}

function Packages() {
  const { data, loading, error } = useApi<any>('/api/admin/packages')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const pp   = data?.pipeline_pro ?? { count: 0, pct: 0 }
  const ms   = data?.mgmt_suite   ?? { count: 0, pct: 0 }
  const ph   = data?.prmtn_hub    ?? { count: 0, pct: 0 }
  const mrr  = data?.mrr          ?? 0
  const churn= data?.churn        ?? 0
  const mrrDisplay = mrr >= 1000 ? `$${(mrr/1000).toFixed(1)}K` : `$${mrr}`

  return (
    <div className="space-y-4">
      <SectionHeading>Packages & Subscriptions</SectionHeading>
      {mrr === 0
        ? <EmptyState icon="📦" title="No Active Subscriptions"
            body="Package subscriptions will appear here once Stripe is connected and users subscribe. Packages and prices will be admin-editable." />
        : (
          <>
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
            <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(3,1fr)' }}>
              <div className="dash-card text-center"><div className="dash-label">MRR</div><div className="font-display text-off-white" style={{ fontSize:28 }}>{mrrDisplay}</div></div>
              <div className="dash-card text-center"><div className="dash-label">Churn 30d</div><div className="font-display text-off-white" style={{ fontSize:28 }}>{churn}%</div></div>
            </div>
          </>
        )
      }
    </div>
  )
}

function Content() {
  const { data, loading, error } = useApi<any>('/api/admin/content')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const mods         = data?.chart_data   ?? []
  const platformAvg  = data?.platform_avg ?? 0
  const totalModules = data?.total_modules ?? 0

  return (
    <div className="space-y-4">
      <SectionHeading>Content & Modules</SectionHeading>
      {!totalModules
        ? <EmptyState icon="📚" title="No Modules Yet"
            body="Education modules were seeded during migration. If none appear, run the 0003 migration or add modules via Supabase." />
        : (
          <div className="grid gap-4" style={{ gridTemplateColumns:'1fr 160px' }}>
            <div className="dash-card">
              <div className="dash-label mb-3">Module Completion Rates (Platform Avg)</div>
              {mods.length > 0 ? <BarChart height={100} data={mods} /> : <div className="dash-sub">No completion data yet.</div>}
            </div>
            <div className="dash-card text-center">
              <div className="dash-label">Platform Avg</div>
              <ReadinessRing pct={platformAvg} size={80} label="Done" />
              <div className="dash-sub mt-1">{totalModules} modules</div>
            </div>
          </div>
        )
      }
    </div>
  )
}

function Reports() {
  const { data, loading, error } = useApi<any>('/api/admin/reports')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const avgReadiness = data?.avg_readiness    ?? 0
  const oblRate      = data?.obligations_rate ?? 100
  const incidents    = data?.conduct_incidents ?? 0
  const sfMatches    = data?.sf_matches       ?? 0

  return (
    <div className="space-y-4">
      <SectionHeading>System Reports</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
        <div className="dash-card text-center"><div className="dash-label">Avg Readiness</div><ReadinessRing pct={avgReadiness} size={80} /></div>
        <StatCard label="Obligations Rate" value={`${oblRate}%`} barPct={oblRate} />
        <StatCard label="Conduct Incidents" value={<span className={incidents>0?'text-blood-glow':''}>{incidents}</span>}
          sub="Last 30 days" barPct={incidents>0?10:0} barColor="#c00000" />
        <StatCard label="SF Matches" value={String(sfMatches)} sub="Active" barPct={55} />
      </div>
    </div>
  )
}

function Marketplace() {
  const { data, loading, error }          = useApi<any>('/api/admin/marketplace')
  const { data: analytics }               = useApi<any>('/api/admin/analytics')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const gmv             = data?.gmv_usd           ?? 0
  const activeContracts = data?.active_contracts  ?? 0
  const totalContracts  = data?.total_contracts   ?? 0
  const sponsorCount    = data?.sponsor_count     ?? 0
  const verifiedSponsors= data?.verified_sponsors ?? 0
  const openDisputes    = data?.open_disputes     ?? 0
  const totalApps       = data?.total_applications ?? 0
  const funnel          = data?.applications_funnel ?? {}
  const recent          = data?.recent_contracts   ?? []
  const monthlyGmv      = analytics?.monthly_gmv  ?? []
  const gmvDisplay      = gmv >= 1000 ? `$${(gmv/1000).toFixed(1)}K` : `$${gmv}`

  if (totalContracts === 0 && sponsorCount === 0) return (
    <div className="space-y-4">
      <SectionHeading>Marketplace Overview</SectionHeading>
      <EmptyState icon="🤝" title="No Marketplace Activity Yet"
        body="Marketplace data will appear once sponsors are vetted and opportunities are published." />
    </div>
  )

  return (
    <div className="space-y-4">
      <SectionHeading>Marketplace Overview</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="dash-card text-center">
          <div className="dash-label">GMV</div>
          <div className="font-display text-off-white" style={{ fontSize: 28 }}>{gmvDisplay}</div>
          <div className="dash-sub">Total payments succeeded</div>
        </div>
        <StatCard label="Active Contracts" value={String(activeContracts)} sub={`${totalContracts} total`}
          barPct={totalContracts>0?Math.round(activeContracts/totalContracts*100):0} />
        <StatCard label="Sponsors" value={String(sponsorCount)} sub={`${verifiedSponsors} verified`}
          barPct={sponsorCount>0?Math.round(verifiedSponsors/sponsorCount*100):0} />
        <div className="dash-card text-center" style={{ borderTop: openDisputes>0?'2px solid #c00000':undefined }}>
          <div className="dash-label">Open Disputes</div>
          <div className="font-display" style={{ fontSize: 28, color: openDisputes>0?'#c00000':'#f0ece4' }}>{openDisputes}</div>
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
          {Object.keys(funnel).length > 0
            ? Object.entries(funnel).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between mb-2">
                  <span className="dash-sub capitalize">{status.replace('_', ' ')}</span>
                  <div className="flex items-center gap-2">
                    <div className="dash-bar-track" style={{ width: 80 }}>
                      <div className="dash-bar-fill" style={{ width: `${totalApps>0?Math.round((count as number)/totalApps*100):0}%` }} />
                    </div>
                    <span className="dash-sub w-6 text-right">{count as number}</span>
                  </div>
                </div>
              ))
            : <div className="dash-sub">No applications yet.</div>
          }
        </div>
        <ListCard label="Recent Contracts"
          items={recent.length > 0 ? recent : [{ name: 'No contracts yet', badge: '—', type: 'yellow' as const }]} />
      </div>
    </div>
  )
}

const VIEWS: Record<string,React.FC> = {
  overview: Overview, setup: Setup, marketplace: Marketplace, users: Users,
  mentors: Mentors, sponsorforge: SponsorForgeAdmin, packages: Packages,
  content: Content, reports: Reports,
}

export default function AdminDashboard() {
  return (
    <DashShell navItems={NAV} title="Admin Dashboard" subtitle="Platform Administration">
      {tab => { const V = VIEWS[tab] ?? Overview; return <V /> }}
    </DashShell>
  )
}
