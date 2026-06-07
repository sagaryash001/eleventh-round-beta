import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import DashShell from './DashShell'
import { StatCard, ListCard, ReadinessRing, BarChart, SparkLine, RadarChart,
         ActivityHeatmap, Timeline, SectionHeading, FullWidthCard,
         DashSkeleton, EmptyState, ApiError } from './DashWidgets'
import { useApi } from '../../hooks/useApi'
import { getFighterManager, requestManager, cancelManagerRequest, type ManagerConnection } from '../../lib/api/manager'
import { apiPatch } from '../../lib/api/client'

const NAV = [
  { id: 'overview',     label: 'Overview',     icon: '◈' },
  { id: 'sponsorships', label: 'Sponsorships', icon: '🤝' },
  { id: 'pipeline',     label: 'Pipeline',     icon: '▲' },
  { id: 'obligations',  label: 'Obligations',  icon: '📋' },
  { id: 'education',    label: 'Education',    icon: '📚' },
  { id: 'sponsorforge', label: 'SponsorForge', icon: '⚡' },
  { id: 'mentorship',   label: 'Mentorship',   icon: '🎯' },
  { id: 'transition',   label: 'Transition',   icon: '→' },
  { id: 'profile',      label: 'Profile',      icon: '👤' },
]

function Overview() {
  const { data, loading, error } = useApi<any>('/api/fighter/overview')

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const readiness   = data?.readiness       ?? 0
  const stage       = data?.pipeline_stage  ?? 0
  const stagePct    = data?.pipeline_pct    ?? 0
  const sfScore     = data?.sponsor_score   ?? 0
  const openObs     = data?.open_obligations ?? 0
  const radar       = data?.radar ?? { brand:0, finance:0, conduct:0, sponsor:0, media:0, pipeline:0 }
  const trend       = data?.readiness_trend ?? []
  const actionItems = data?.action_items    ?? []

  return (
    <div className="space-y-4">
      <SectionHeading>Your Dashboard</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '200px 1fr 1fr 1fr' }}>
        <div className="dash-card flex flex-col items-center justify-center text-center row-span-2">
          <div className="dash-label w-full text-left mb-3">Readiness</div>
          <ReadinessRing pct={readiness} size={110} />
          <div className="dash-sub mt-3 text-center">
            {readiness === 0 ? 'Complete your profile to score' : '3 areas need attention'}
          </div>
        </div>
        <StatCard label="Pipeline Stage" value={stage > 0 ? String(stage) : '—'}
          sub={stage > 0 ? `of 5 complete` : 'Start your pipeline'} barPct={stagePct} trend={stagePct > 0 ? 5 : undefined} />
        <StatCard label="Sponsor Score" value={sfScore > 0 ? String(sfScore) : '—'}
          sub={sfScore > 0 ? '100 = SponsorForge ready' : 'Complete onboarding to score'} barPct={sfScore} />
        <StatCard label="Open Obligations" value={<span className={openObs > 0 ? 'text-blood-glow' : ''}>{openObs}</span>}
          sub={openObs > 0 ? 'Review your obligations' : 'No active obligations'} barPct={openObs > 0 ? 20 : 0} barColor="#c00000" />

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
          {trend.length >= 2
            ? <><SparkLine values={trend} /><div className="dash-sub mt-2">+{(trend[trend.length-1] ?? 0) - (trend[0] ?? 0)}pts over time</div></>
            : <EmptyState title="No trend yet" body="Your readiness score trend will appear after your profile is evaluated." />
          }
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {actionItems.length > 0
          ? <ListCard label="Action Items" items={actionItems} />
          : <EmptyState icon="✓" title="All Clear" body="No immediate action items. Keep completing your pipeline to unlock new tasks." />
        }
        <div className="dash-card">
          <div className="dash-label">Quick Links</div>
          <div className="space-y-2 mt-3">
            {[
              { to: '/fighter/profile',      label: 'Edit Profile' },
              { to: '/opportunities',         label: 'Browse Opportunities' },
              { to: '/fighter/applications',  label: 'My Applications' },
              { to: '/contracts',             label: 'My Contracts' },
            ].map(l => (
              <Link key={l.to} to={l.to}
                className="block font-condensed font-bold uppercase text-[11px] tracking-[0.2em] text-gray-2
                           no-underline hover:text-off-white transition-colors py-2 border-b border-charcoal-3 last:border-0">
                {l.label} →
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Pipeline() {
  const { data, loading, error } = useApi<any>('/api/fighter/pipeline')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const stages  = data?.stages     ?? []
  const overall = data?.overall_pct ?? 0

  if (!stages.length) return (
    <div className="space-y-4">
      <SectionHeading>Pipeline</SectionHeading>
      <EmptyState icon="▲" title="Pipeline Not Started"
        body="Your pipeline is being set up. Complete your fighter profile to generate your first steps."
        action={<Link to="/fighter/profile" className="btn-ghost text-[11px] py-2 px-4 no-underline">Edit Profile →</Link>} />
    </div>
  )

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
  const { data, loading, error } = useApi<any>('/api/fighter/obligations')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const sponsorObs  = data?.sponsor ?? []
  const mediaObs    = data?.media   ?? []
  const fulfillment = data?.fulfillment_pct ?? 100
  const completed   = data?.completed_count ?? 0
  const timeline    = data?.timeline ?? []

  if (!sponsorObs.length && !mediaObs.length) return (
    <div className="space-y-4">
      <SectionHeading>Obligations</SectionHeading>
      <EmptyState icon="📋" title="No Obligations Yet"
        body="Sponsorship deliverables will appear here after a deal is active. Keep building your profile to attract sponsors." />
    </div>
  )

  return (
    <div className="space-y-4">
      <SectionHeading>Obligations</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 160px' }}>
        {sponsorObs.length
          ? <ListCard label="Sponsor Obligations" items={sponsorObs} />
          : <EmptyState title="No Sponsor Obligations" body="Active sponsor deal deliverables appear here." />
        }
        {mediaObs.length
          ? <ListCard label="Media Obligations" items={mediaObs} />
          : <EmptyState title="No Media Obligations" body="Event and promotion media duties appear here." />
        }
        <div className="dash-card text-center">
          <div className="dash-label">Fulfillment</div>
          <ReadinessRing pct={fulfillment} size={80} color="#00c060" label="%" />
          <div className="dash-sub mt-2">{completed} completed</div>
        </div>
      </div>
      {timeline.length > 0 && (
        <FullWidthCard label="Obligation Timeline">
          <Timeline events={timeline} />
        </FullWidthCard>
      )}
    </div>
  )
}

function Education() {
  const { data, loading, error } = useApi<any>('/api/fighter/education')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const mods    = data?.modules     ?? []
  const overall = data?.overall_pct ?? 0
  const started = data?.started_count ?? 0
  const total   = data?.total_count   ?? 0

  if (!mods.length) return (
    <div className="space-y-4">
      <SectionHeading>Education Modules</SectionHeading>
      <EmptyState icon="📚" title="No Modules Assigned Yet"
        body="Once Kevin publishes education modules, they will appear here. Check back soon." />
    </div>
  )

  const chartData = mods.slice(0, 6).map((m: any) => ({ label: m.name.split(' ')[0], value: m.pct }))

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
              <div className="dash-bar-fill" style={{ width:`${m.pct}%`,
                background: m.pct===0?'#222226':m.pct>70?'#00c060':'linear-gradient(90deg,#8b0000,#c00000)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const IMPACT_COLOR: Record<string, string> = {
  critical: '#c00000', high: '#c00000', medium: '#c9a82c', low: '#7a7672',
}

function SponsorForge() {
  const { data: sfData, loading: sfLoading, error: sfError } = useApi<any>('/api/fighter/sponsorforge')
  const { data: gapData, loading: gapLoading }               = useApi<any>('/api/fighter/sponsorforge/gaps')

  if (sfLoading) return <DashSkeleton />
  if (sfError)   return <ApiError message={sfError} />

  const score    = sfData?.eligibility_score  ?? 0
  const locked   = sfData?.is_locked          ?? true
  const reqs     = sfData?.requirements       ?? []
  const progress = sfData?.eligibility_progress ?? []
  const gaps     = gapData?.gaps              ?? []
  const readiness = gapData?.readiness_score  ?? 0

  return (
    <div className="space-y-4">
      <SectionHeading>SponsorForge</SectionHeading>

      {/* Status + score */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 200px' }}>
        <div className="dash-card" style={{ borderLeft: locked ? '2px solid #c00000' : '2px solid #00c060' }}>
          <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase mb-3"
               style={{ color: locked ? '#c00000' : '#00c060' }}>
            Status: {locked ? 'Locked — Complete Requirements' : 'Unlocked'}
          </div>
          {reqs.length > 0
            ? <ListCard label="Requirements" items={reqs} />
            : <EmptyState title="No requirements yet" body="Complete your fighter profile to see requirements." />
          }
        </div>
        <div className="dash-card flex flex-col items-center text-center">
          <div className="dash-label mb-2">Eligibility Score</div>
          <ReadinessRing pct={score} size={90} />
          <div className="dash-sub mt-2">{score < 100 ? `${100 - score} pts to unlock` : 'Eligible!'}</div>
          <div className="dash-sub mt-1">Readiness: {readiness}/100</div>
        </div>
      </div>

      {/* Gaps checklist */}
      {!gapLoading && gaps.length > 0 && (
        <div className="dash-card space-y-3">
          <div className="dash-label">Improve Your Match Score</div>
          <p className="font-condensed text-[11px] text-gray-3">
            Fix these gaps to appear higher in sponsor match rankings.
          </p>
          <div className="space-y-2">
            {gaps.map((g: any, i: number) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-charcoal-3 last:border-0">
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: IMPACT_COLOR[g.impact] ?? '#7a7672' }} />
                <div className="flex-1 min-w-0">
                  <div className="font-condensed font-bold text-[12px] text-off-white">{g.label}</div>
                  <div className="font-condensed text-[11px] text-gray-3 mt-0.5">{g.message}</div>
                  <div className="font-condensed text-[11px] mt-1" style={{ color: '#8b0000' }}>→ {g.action}</div>
                </div>
                <span className="font-condensed text-[9px] uppercase tracking-[0.1em] flex-shrink-0"
                  style={{ color: IMPACT_COLOR[g.impact] }}>
                  {g.impact}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!gapLoading && gaps.length === 0 && score > 0 && (
        <div className="dash-card text-center py-4">
          <div className="font-condensed text-green-400 text-[13px]">✓ No major gaps detected — your profile is match-ready</div>
        </div>
      )}

      {/* Progress chart */}
      {progress.length > 0 && (
        <div className="dash-card">
          <div className="dash-label mb-3">Eligibility Breakdown</div>
          <BarChart height={80} data={progress} />
        </div>
      )}
    </div>
  )
}

function Mentorship() {
  const { data, loading, error } = useApi<any>('/api/fighter/mentorship')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const sessions    = data?.sessions    ?? []
  const thisMonth   = data?.this_month  ?? 0
  const nextSession = data?.next_session ?? null

  if (!sessions.length) return (
    <div className="space-y-4">
      <SectionHeading>Mentorship & Consulting</SectionHeading>
      <EmptyState icon="🎯" title="No Sessions Yet"
        body="Mentorship and consulting sessions will appear here once you book a session through the platform." />
    </div>
  )

  return (
    <div className="space-y-4">
      <SectionHeading>Mentorship & Consulting</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 160px' }}>
        <ListCard label="Session History" items={sessions} />
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

// ── Manager connection card ───────────────────────────────────────────────────
function ManagerCard() {
  const [connections, setConnections] = useState<ManagerConnection[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({ manager_email: '', team_name: '', message: '' })
  const [saving,   setSaving]   = useState(false)
  const [actingId, setActingId] = useState<string|null>(null)
  const [msg,      setMsg]      = useState<{type:'ok'|'err';text:string}|null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getFighterManager()
      .then(d => { setConnections(d.connections ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const active  = connections.find(c => c.status === 'active')
  const pending = connections.filter(c => c.status === 'pending')

  const submitRequest = async () => {
    if (!form.manager_email.trim() && !form.team_name.trim()) {
      setMsg({ type: 'err', text: 'Enter a manager email or team name.' }); return
    }
    setSaving(true); setMsg(null)
    try {
      await requestManager({
        manager_email: form.manager_email.trim() || null,
        team_name:     form.team_name.trim()     || null,
        message:       form.message.trim()       || null,
      })
      setMsg({ type: 'ok', text: 'Request sent. Waiting for manager to accept.' })
      setForm({ manager_email: '', team_name: '', message: '' })
      setShowForm(false)
      load()
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message ?? 'Request failed.' })
    } finally { setSaving(false) }
  }

  const cancel = async (id: string) => {
    setActingId(id); setMsg(null)
    try {
      await cancelManagerRequest(id)
      setMsg({ type: 'ok', text: 'Request cancelled.' })
      load()
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message })
    } finally { setActingId(null) }
  }

  if (loading) return <div className="dash-card"><div className="dash-sub">Loading manager status…</div></div>

  return (
    <div className="dash-card space-y-3">
      <div className="dash-label">Manager / Team</div>

      {/* Active manager */}
      {active && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 py-2 border-b border-charcoal-3">
            <div className="flex-1">
              <div className="font-condensed font-bold text-off-white" style={{ fontSize: 13 }}>
                {active.manager?.name ?? 'Manager'}
              </div>
              {active.manager?.team_name && (
                <div className="font-condensed text-[11px] text-gray-3">{active.manager.team_name}</div>
              )}
              <div className="font-condensed text-[11px] text-gray-3">{active.manager?.email}</div>
            </div>
            <span className="badge badge-green">Active</span>
          </div>
          <button onClick={() => cancel(active.id)} disabled={actingId === active.id}
            className="font-condensed font-bold uppercase text-[9px] tracking-[0.15em] px-2.5 py-1.5 border border-charcoal-3 text-gray-3 cursor-pointer hover:border-blood hover:text-blood-glow transition-all disabled:opacity-40">
            {actingId === active.id ? '…' : 'Leave / Request Change'}
          </button>
        </div>
      )}

      {/* Pending requests */}
      {pending.map(c => {
        const isManagerInvite = c.source === 'manager_invite' || c.source === 'manual_create'
        const accept = async () => {
          setActingId(c.id); setMsg(null)
          try {
            await apiPatch(`/api/fighter/manager/request/${c.id}`, { status: 'active' })
            setMsg({ type: 'ok', text: 'Invitation accepted.' })
            load()
          } catch (e: any) { setMsg({ type: 'err', text: e.message }) }
          finally { setActingId(null) }
        }
        return (
          <div key={c.id} className="flex items-center gap-3 py-2 border-b border-charcoal-3">
            <div className="flex-1">
              <div className="font-condensed text-[12px] text-off-white">
                {isManagerInvite ? 'Invited by' : 'Request sent to'}{' '}
                <span className="font-bold">{c.manager?.name ?? c.team_name ?? '—'}</span>
              </div>
              {c.request_message && (
                <div className="font-condensed text-[11px] text-gray-3 italic">"{c.request_message}"</div>
              )}
            </div>
            <span className="badge badge-yellow">Pending</span>
            {isManagerInvite && (
              <button onClick={accept} disabled={actingId === c.id}
                className="font-condensed font-bold uppercase text-[9px] tracking-[0.1em] px-2 py-1 border cursor-pointer transition-all disabled:opacity-40"
                style={{ borderColor: '#2a5c2a', color: '#00c060' }}>
                {actingId === c.id ? '…' : 'Accept'}
              </button>
            )}
            <button onClick={() => cancel(c.id)} disabled={actingId === c.id}
              className="font-condensed font-bold uppercase text-[9px] tracking-[0.15em] px-2 py-1 border border-charcoal-3 text-gray-3 cursor-pointer hover:border-blood hover:text-blood-glow transition-all disabled:opacity-40">
              {actingId === c.id ? '…' : isManagerInvite ? 'Decline' : 'Cancel'}
            </button>
          </div>
        )
      })}

      {/* No manager */}
      {!active && !pending.length && !showForm && (
        <div className="space-y-2">
          <div className="font-condensed text-[12px] text-gray-3">No manager connected.</div>
          <button onClick={() => setShowForm(true)}
            className="btn-ghost text-[10px] py-2 px-4">Link a Manager →</button>
        </div>
      )}

      {/* Request form */}
      {showForm && (
        <div className="space-y-3 pt-1">
          <div>
            <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1">Manager Email</label>
            <input value={form.manager_email} onChange={e => setForm(p=>({...p,manager_email:e.target.value}))}
              placeholder="manager@email.com" type="email"
              className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none" />
          </div>
          <div>
            <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1">or Team Name</label>
            <input value={form.team_name} onChange={e => setForm(p=>({...p,team_name:e.target.value}))}
              placeholder="Team / gym name"
              className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none" />
          </div>
          <div>
            <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1">Message (optional)</label>
            <textarea value={form.message} onChange={e => setForm(p=>({...p,message:e.target.value}))} rows={2}
              placeholder="Introduce yourself…"
              className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none resize-none" />
          </div>
          {msg && <p className={`font-condensed text-[11px] ${msg.type==='ok'?'text-green-400':'text-blood-glow'}`}>{msg.text}</p>}
          <div className="flex gap-2">
            <button onClick={submitRequest} disabled={saving}
              className="btn-primary text-[11px] py-2 disabled:opacity-50">
              {saving ? 'Sending…' : 'Send Request'}
            </button>
            <button onClick={() => { setShowForm(false); setMsg(null) }} className="btn-ghost text-[11px] py-2">Cancel</button>
          </div>
        </div>
      )}

      {msg && !showForm && (
        <p className={`font-condensed text-[11px] ${msg.type==='ok'?'text-green-400':'text-blood-glow'}`}>{msg.text}</p>
      )}
    </div>
  )
}

function Profile() {
  const { data, loading, error } = useApi<any>('/api/fighter/profile')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const name        = data?.name                ?? '—'
  const division    = data?.division            ?? '—'
  const wins        = data?.record_wins         ?? 0
  const losses      = data?.record_losses       ?? 0
  const draws       = data?.record_draws        ?? 0
  const base        = data?.base                ?? '—'
  const completeness = data?.profile_completeness ?? 0

  return (
    <div className="space-y-4">
      <SectionHeading>My Profile</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="dash-card">
          <div className="dash-label">Fighter Info</div>
          {([
            ['Full Name', name],
            ['Division',  division],
            ['Record',    `${wins}-${losses}${draws > 0 ? `-${draws}` : ''}`],
            ['Base',      base],
          ] as [string,string][]).map(([k,v]) => (
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
            <Link to="/fighter/profile" className="btn-ghost w-full text-[10px] py-2 no-underline text-center block">
              Edit Profile
            </Link>
          </div>
        </div>
      </div>
      <ManagerCard />
    </div>
  )
}

// ── Compact recent applications list ─────────────────────────────────────────
const APP_SC: Record<string,string> = {
  applied:'#7a7672',under_review:'#C41E3A',shortlisted:'#f5a623',
  accepted:'#00c060',rejected:'#4a4846',withdrawn:'#4a4846',
}
const APP_SL: Record<string,string> = {
  applied:'Submitted',under_review:'In Review',shortlisted:'Shortlisted',
  accepted:'Accepted',rejected:'Rejected',withdrawn:'Withdrawn',
}
function RecentApplications() {
  const { data, loading } = useApi<any>('/api/applications/mine')
  const apps = (data?.applications ?? []).slice(0, 5)
  if (loading) return <div className="dash-sub">Loading…</div>
  if (!apps.length) return (
    <EmptyState icon="🤝" title="No Applications Yet"
      body="You haven't applied to any opportunities yet."
      action={<Link to="/opportunities" className="btn-ghost text-[11px] py-2 px-4 no-underline">Browse Opportunities →</Link>} />
  )
  return (
    <div className="space-y-2">
      {apps.map((a: any) => (
        <div key={a.id} className="dash-card flex items-center gap-3"
          style={{ borderLeft:`2px solid ${APP_SC[a.status]??'#222226'}` }}>
          <div className="flex-1 min-w-0">
            <div className="font-condensed font-bold text-[12px] text-off-white truncate">
              {a.opportunity?.title ?? 'Opportunity'}
            </div>
            <div className="font-condensed text-[11px] text-gray-3">{a.sponsor_detail?.company_name ?? '—'}</div>
          </div>
          <span className="font-condensed text-[10px] uppercase tracking-[0.1em] flex-shrink-0"
            style={{ color: APP_SC[a.status] }}>
            {APP_SL[a.status] ?? a.status}
          </span>
        </div>
      ))}
      <Link to="/fighter/applications"
        className="font-condensed text-[11px] text-gray-3 hover:text-off-white block text-center mt-1 no-underline">
        View all applications →
      </Link>
    </div>
  )
}

function Sponsorships() {
  const { data, loading, error } = useApi<any>('/api/fighter/marketplace')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const totalApps    = data?.total_applications    ?? 0
  const acceptedApps = data?.accepted_applications ?? 0
  const acceptRate   = data?.acceptance_rate       ?? 0
  const activeC      = data?.active_contracts      ?? 0
  const totalC       = data?.total_contracts       ?? 0
  const earnings     = data?.total_earnings_usd    ?? 0
  const doneObs      = data?.completed_obligations ?? 0
  const pendingObs   = data?.pending_obligations   ?? 0

  if (totalApps === 0 && activeC === 0) return (
    <div className="space-y-4">
      <SectionHeading>Sponsorship Stats</SectionHeading>
      <EmptyState icon="🤝" title="No Sponsorship Activity Yet"
        body="No SponsorForge matches yet. Complete your fighter profile and social accounts to improve match quality."
        action={<Link to="/opportunities" className="btn-ghost text-[11px] py-2 px-4 no-underline">Browse Opportunities →</Link>} />
    </div>
  )

  const earningsDisplay = earnings >= 1000 ? `$${(earnings / 1000).toFixed(1)}K` : `$${earnings}`

  return (
    <div className="space-y-4">
      <SectionHeading>Sponsorship Stats</SectionHeading>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <StatCard label="Applications Sent"  value={String(totalApps)}  sub={`${acceptedApps} accepted`} barPct={100} />
        <StatCard label="Acceptance Rate"    value={`${acceptRate}%`}   sub="of all applications"        barPct={acceptRate} />
        <StatCard label="Active Contracts"   value={String(activeC)}    sub={`${totalC} total`}           barPct={totalC>0?Math.round(activeC/totalC*100):0} />
        <div className="dash-card text-center">
          <div className="dash-label">Total Earnings</div>
          <div className="font-display text-off-white" style={{ fontSize:28 }}>{earningsDisplay}</div>
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
            <div className="dash-bar-fill" style={{ width:`${doneObs+pendingObs>0?Math.round(doneObs/(doneObs+pendingObs)*100):0}%`, background:'#00c060' }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="dash-sub">Pending</span>
            <span className="font-condensed text-off-white font-bold">{pendingObs}</span>
          </div>
        </div>
        <div className="dash-card flex flex-col gap-3">
          <div className="dash-label">Quick Links</div>
          {[
            { to:'/opportunities',        label:'Browse Opportunities' },
            { to:'/fighter/applications', label:'My Applications' },
            { to:'/contracts',            label:'My Contracts' },
          ].map(l => (
            <Link key={l.to} to={l.to}
              className="btn-ghost text-[11px] py-2 text-center block no-underline">{l.label}</Link>
          ))}
        </div>
      </div>
      <div className="dash-card space-y-3">
        <div className="dash-label">Recent Applications</div>
        <RecentApplications />
      </div>
    </div>
  )
}

function Transition() {
  return (
    <div className="space-y-4">
      <SectionHeading>Transition Planning</SectionHeading>
      <div className="dash-card" style={{ borderLeft: '2px solid #222226' }}>
        <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-gray-3 mb-3">
          Status: Locked — Pipeline Level 3 Required
        </div>
        <p className="font-body text-gray-2 text-[13px] leading-relaxed">
          The Transition Blueprint helps fighters plan life and career beyond active competition. Unlocks at Pipeline Level 3.
        </p>
      </div>
    </div>
  )
}

const VIEWS: Record<string, React.FC> = {
  overview: Overview, sponsorships: Sponsorships, pipeline: Pipeline, obligations: Obligations,
  education: Education, sponsorforge: SponsorForge, mentorship: Mentorship,
  transition: Transition, profile: Profile,
}

export default function FighterDashboard() {
  return (
    <DashShell navItems={NAV} title="Fighter Dashboard" subtitle="Fighter Portal">
      {tab => { const V = VIEWS[tab] ?? Overview; return <V /> }}
    </DashShell>
  )
}
