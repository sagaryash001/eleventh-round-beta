import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import NotificationBell from '../../components/NotificationBell'
import EventCalendar from '../../components/events/EventCalendar'
import { useApi } from '../../hooks/useApi'
import { getContracts, type Contract } from '../../lib/api/contracts'
import { getSponsorForge, submitSponsorForge, type SponsorForgeStatus, type SFChecklistItem, type SFItemStatus } from '../../lib/api/fighters'
import { getFighterManager, requestManager, cancelManagerRequest, type ManagerConnection } from '../../lib/api/manager'
import { apiPatch } from '../../lib/api/client'
import {
  getFighterModules, getFighterModule, updateModuleProgress, completeModule,
  parseMetadata, parseChecklistState,
  type FighterModule, type ModuleProgress, type ModuleResource, type ChecklistItem,
} from '../../lib/api/education'
import { ReadinessRing as CommandRing, MiniBar, ClickablePanel } from './shared/CommandLayout'
import {
  ReadinessRing, StatCard, ListCard, DashSkeleton, EmptyState, ApiError,
  SectionHeading,
} from './DashWidgets'

// ── Zone definitions ──────────────────────────────────────────────────────────
const ZONES = [
  { id: 'command',      label: 'Command Center'         },
  { id: 'profile',      label: 'Profile'                },
  { id: 'sponsorships', label: 'Sponsorships'           },
  { id: 'education',    label: 'Education'              },
  { id: 'events',       label: 'Event Calendar'         },
  { id: 'contracts',    label: 'Contracts & Obligations'},
]

// ── Contract status maps ──────────────────────────────────────────────────────
const FC_COLOR: Record<string, string> = {
  draft: '#4a4846', pending_fighter: '#b45309', active: '#166534',
  in_dispute: '#7f1d1d', completed: '#1e3a5f', terminated: '#374151',
}
const FC_LABEL: Record<string, string> = {
  draft: 'Draft', pending_fighter: 'Awaiting Your Signature', active: 'Active',
  in_dispute: 'In Dispute', completed: 'Completed', terminated: 'Terminated',
}

// ── Application status maps ───────────────────────────────────────────────────
const APP_SC: Record<string, string> = {
  applied: '#7a7672', under_review: '#C41E3A', shortlisted: '#f5a623',
  accepted: '#00c060', rejected: '#4a4846', withdrawn: '#4a4846',
}
const APP_SL: Record<string, string> = {
  applied: 'Submitted', under_review: 'In Review', shortlisted: 'Shortlisted',
  accepted: 'Accepted', rejected: 'Rejected', withdrawn: 'Withdrawn',
}

// ── Manager card ──────────────────────────────────────────────────────────────
function ManagerCard() {
  const [connections, setConnections] = useState<ManagerConnection[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({ manager_email: '', team_name: '', message: '' })
  const [saving,   setSaving]   = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [msg,      setMsg]      = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

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
      await requestManager({ manager_email: form.manager_email.trim() || null, team_name: form.team_name.trim() || null, message: form.message.trim() || null })
      setMsg({ type: 'ok', text: 'Request sent. Waiting for manager to accept.' })
      setForm({ manager_email: '', team_name: '', message: '' })
      setShowForm(false); load()
    } catch (e: any) { setMsg({ type: 'err', text: e.message ?? 'Request failed.' }) }
    finally { setSaving(false) }
  }

  const cancel = async (id: string) => {
    setActingId(id); setMsg(null)
    try {
      await cancelManagerRequest(id)
      setMsg({ type: 'ok', text: 'Request cancelled.' }); load()
    } catch (e: any) { setMsg({ type: 'err', text: e.message }) }
    finally { setActingId(null) }
  }

  if (loading) return <div className="dash-card"><div className="dash-sub">Loading manager status…</div></div>

  return (
    <div className="dash-card space-y-3">
      <div className="dash-label">Manager / Team</div>
      {active && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 py-2 border-b border-charcoal-3">
            <div className="flex-1">
              <div className="font-condensed font-bold text-off-white" style={{ fontSize: 13 }}>{active.manager?.name ?? 'Manager'}</div>
              {active.manager?.team_name && <div className="font-condensed text-[11px] text-gray-3">{active.manager.team_name}</div>}
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
      {pending.map(c => {
        const isManagerInvite = c.source === 'manager_invite' || c.source === 'manual_create'
        const accept = async () => {
          setActingId(c.id); setMsg(null)
          try {
            await apiPatch(`/api/fighter/manager/request/${c.id}`, { status: 'active' })
            setMsg({ type: 'ok', text: 'Invitation accepted.' }); load()
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
              {c.request_message && <div className="font-condensed text-[11px] text-gray-3 italic">"{c.request_message}"</div>}
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
      {!active && !pending.length && !showForm && (
        <div className="space-y-2">
          <div className="font-condensed text-[12px] text-gray-3">No manager connected.</div>
          <button onClick={() => setShowForm(true)} className="btn-ghost text-[10px] py-2 px-4">Link a Manager →</button>
        </div>
      )}
      {showForm && (
        <div className="space-y-3 pt-1">
          <div>
            <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1">Manager Email</label>
            <input value={form.manager_email} onChange={e => setForm(p => ({ ...p, manager_email: e.target.value }))}
              placeholder="manager@email.com" type="email"
              className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none" />
          </div>
          <div>
            <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1">or Team Name</label>
            <input value={form.team_name} onChange={e => setForm(p => ({ ...p, team_name: e.target.value }))}
              placeholder="Team / gym name"
              className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none" />
          </div>
          <div>
            <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1">Message (optional)</label>
            <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} rows={2}
              placeholder="Introduce yourself…"
              className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none resize-none" />
          </div>
          {msg && <p className={`font-condensed text-[11px] ${msg.type === 'ok' ? 'text-green-400' : 'text-blood-glow'}`}>{msg.text}</p>}
          <div className="flex gap-2">
            <button onClick={submitRequest} disabled={saving} className="btn-primary text-[11px] py-2 disabled:opacity-50">{saving ? 'Sending…' : 'Send Request'}</button>
            <button onClick={() => { setShowForm(false); setMsg(null) }} className="btn-ghost text-[11px] py-2">Cancel</button>
          </div>
        </div>
      )}
      {msg && !showForm && <p className={`font-condensed text-[11px] ${msg.type === 'ok' ? 'text-green-400' : 'text-blood-glow'}`}>{msg.text}</p>}
    </div>
  )
}

// ── Module detail ─────────────────────────────────────────────────────────────
function ModuleDetail({ moduleId, onBack }: { moduleId: string; onBack: () => void }) {
  const [data,      setData]       = useState<{ module: any; progress: ModuleProgress | null; resources: ModuleResource[] } | null>(null)
  const [loading,   setLoading]    = useState(true)
  const [error,     setError]      = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [checked,   setChecked]    = useState<Record<string, boolean>>({})
  const [msg,       setMsg]        = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getFighterModule(moduleId)
      .then(d => { setData(d); setChecked(parseChecklistState(d.progress?.checklist_state)); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [moduleId])

  const mod       = data?.module
  const progress  = data?.progress
  const resources = data?.resources ?? []
  const meta      = parseMetadata(mod?.metadata)
  const items: ChecklistItem[] = Array.isArray(meta.checklist_items) ? meta.checklist_items : []

  const handleCheck = async (itemId: string, val: boolean) => {
    const next = { ...checked, [itemId]: val }
    setChecked(next)
    const req = items.filter(i => i.required)
    const done = req.filter(i => next[i.id]).length
    const pct = req.length ? Math.round((done / req.length) * 100) : Object.values(next).filter(Boolean).length === items.length ? 100 : 50
    const status = pct === 100 ? 'completed' : 'in_progress'
    await updateModuleProgress(moduleId, { checklist_state: next, completion_pct: pct, status }).catch(() => {})
    if (pct === 100) setMsg('All items checked — module complete!')
  }

  const handleComplete = async () => {
    setCompleting(true); setMsg(null)
    try {
      await completeModule(moduleId)
      setMsg('Module marked complete!')
      setData(d => d ? { ...d, progress: { ...(d.progress ?? { module_id: moduleId, completion_pct: 100, started_at: null, last_viewed_at: null, checklist_state: {} }), status: 'completed', completion_pct: 100, completed_at: new Date().toISOString() } } : d)
    } catch (e: any) { setMsg('Could not mark complete: ' + e.message) }
    finally { setCompleting(false) }
  }

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />
  if (!mod)    return <EmptyState icon="●" title="Module not found" body="" />

  const isCompleted = progress?.status === 'completed' || progress?.completion_pct === 100

  return (
    <div className="space-y-4 max-w-2xl">
      <button onClick={onBack} className="font-condensed text-[11px] uppercase tracking-[0.15em] text-gray-3 hover:text-gray-1 flex items-center gap-2">← Back to Modules</button>
      <div className="dash-card space-y-3" style={{ borderLeft: '2px solid #8b0000' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display text-off-white uppercase" style={{ fontSize: 22, lineHeight: 1.1 }}>{mod.name}</h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {mod.category && <span className="font-condensed text-[10px] text-gray-3 uppercase tracking-widest capitalize">{mod.category}</span>}
              <span className="font-condensed text-[10px] text-gray-3 uppercase tracking-widest capitalize">{(mod.module_type || 'lesson').replace('_', ' ')}</span>
              {mod.estimated_mins && <span className="font-condensed text-[10px] text-gray-3">{mod.estimated_mins} min</span>}
              {mod.is_required && <span className="font-condensed text-[9px] uppercase tracking-widest px-2 py-0.5" style={{ background: 'rgba(139,0,0,0.2)', color: '#C41E3A' }}>Required</span>}
            </div>
          </div>
          <ReadinessRing pct={progress?.completion_pct ?? 0} size={56} label="%" />
        </div>
        {mod.description && <p className="font-body text-gray-2 text-[13px] leading-relaxed">{mod.description}</p>}
      </div>
      {mod.content_body && (
        <div className="dash-card">
          <div className="dash-label mb-3">Lesson Content</div>
          <div className="font-body text-gray-1 text-[13px] leading-relaxed whitespace-pre-wrap">{mod.content_body}</div>
        </div>
      )}
      {(['video', 'link', 'pdf', 'mixed'].includes(mod.module_type)) && (
        <div className="dash-card">
          <div className="dash-label mb-3">{mod.module_type === 'video' ? 'Video' : mod.module_type === 'pdf' ? 'PDF Resource' : 'Resource'}</div>
          {mod.module_type === 'video' && mod.content_url && (mod.content_url.includes('youtube') || mod.content_url.includes('youtu.be') || mod.content_url.includes('vimeo') || mod.content_url.includes('loom')) ? (
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
              <iframe
                src={mod.content_url.includes('youtu.be') ? mod.content_url.replace('youtu.be/', 'youtube.com/embed/') : mod.content_url.includes('watch?v=') ? mod.content_url.replace('watch?v=', 'embed/') : mod.content_url}
                title={mod.name} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', background: '#000' }} />
            </div>
          ) : mod.content_url && mod.content_url.startsWith('http') ? (
            <a href={mod.content_url} target="_blank" rel="noopener noreferrer"
               className="btn-primary inline-block text-[11px] no-underline">
              {mod.module_type === 'pdf' ? 'Open PDF' : 'Open Resource'}
            </a>
          ) : (
            <span className="font-condensed text-[11px] text-gray-3 uppercase tracking-[0.15em]">
              PDF unavailable
            </span>
          )}
        </div>
      )}
      {items.length > 0 && (
        <div className="dash-card space-y-3">
          <div className="dash-label">Checklist</div>
          {items.map(item => (
            <label key={item.id} className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" checked={!!checked[item.id]} onChange={e => handleCheck(item.id, e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-red-700 cursor-pointer shrink-0" />
              <span className={`font-body text-[13px] leading-snug transition-colors ${checked[item.id] ? 'line-through text-gray-3' : 'text-gray-1 group-hover:text-off-white'}`}>
                {item.text}
                {item.required && <span className="font-condensed text-[9px] text-blood-glow ml-2 uppercase tracking-widest">required</span>}
              </span>
            </label>
          ))}
        </div>
      )}
      {resources.length > 0 && (
        <div className="dash-card space-y-2">
          <div className="dash-label mb-2">Resources</div>
          {resources.map(r => {
            const href = (r.url && r.url.startsWith('http')) ? r.url : null
            const icon = r.resource_type === 'pdf' ? '■' : r.resource_type === 'video' ? '▶' : '→'
            return href ? (
              <a key={r.id} href={href} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 font-condensed text-[12px] text-gray-2 hover:text-off-white no-underline py-1">
                <span style={{ color: '#8b0000' }}>{icon}</span>
                {r.title}
              </a>
            ) : (
              <div key={r.id} className="flex items-center gap-3 font-condensed text-[12px] text-gray-3 py-1">
                <span style={{ color: '#4a4846' }}>{icon}</span>
                {r.title}
                <span className="text-[10px] uppercase tracking-wide">(unavailable)</span>
              </div>
            )
          })}
        </div>
      )}
      {msg && <p className="font-condensed text-[12px]" style={{ color: msg.includes('complete') ? '#00c060' : '#C41E3A' }}>{msg}</p>}
      {!isCompleted && items.length === 0 && (
        <button onClick={handleComplete} disabled={completing} className="btn-primary disabled:opacity-50">
          {completing ? 'Marking…' : 'Mark as Complete'}
        </button>
      )}
      {isCompleted && <div className="font-condensed text-[12px] uppercase tracking-[0.2em]" style={{ color: '#00c060' }}>✓ Completed</div>}
    </div>
  )
}

// ── Command Center zone ───────────────────────────────────────────────────────
function CommandCenter({ onNavigate }: { onNavigate: (zone: string) => void }) {
  const { data: profileData }  = useApi<any>('/api/fighter/profile')
  const { data: overviewData } = useApi<any>('/api/fighter/overview')
  const { data: activityData } = useApi<any>('/api/fighter/activity')
  const { data: modsData }     = useApi<any>('/api/fighter/modules')
  const [contracts, setContracts] = useState<Contract[]>([])

  useEffect(() => {
    getContracts().then(r => setContracts(r.contracts ?? [])).catch(() => {})
  }, [])

  // Panel 1: Fighter Readiness
  const overallPct   = profileData?.profile_completeness ?? 0
  const corePct      = profileData?.completion?.core_pct ?? 0
  const missingReq   = profileData?.completion?.missing_required ?? []
  const sponsorReady = profileData?.completion?.sponsor_ready ?? false

  // Panel 2: Sponsor Readiness (ReadinessRing + 4 MiniBar)
  const fightDetailsPct = profileData?.completion?.fight_details_pct ?? 0
  const sponsorPct      = profileData?.completion?.sponsorship_pct ?? 0
  const socialPct       = profileData?.completion?.social_proof_pct ?? 0
  const eduPct          = modsData?.overall_pct ?? 0

  // Panel 3: Actions Due
  const missingProfile = missingReq.length
  const awaitSign      = contracts.filter(c => c.status === 'pending_fighter').length
  const openObs        = overviewData?.open_obligations ?? 0
  const requiredEdu    = (modsData?.modules ?? []).filter((m: any) => m.is_required && m.progress?.status !== 'completed').length
  const totalActions   = missingProfile + awaitSign + openObs + requiredEdu
  const actionBarPct   = Math.min(totalActions * 15, 100)

  // Activity feed
  const feedRows = activityData?.events ?? []

  return (
    <div className="space-y-3.5">

      {/* ── Row 1 + Row 2 in one grid ── */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 1.5fr 1fr' }}>

        {/* Panel 1: Fighter Readiness */}
        <ClickablePanel onClick={() => onNavigate('profile')} ariaLabel="Go to Profile">
          <div className="dash-label">Fighter Readiness</div>
          <div className="dash-stat">{overallPct}</div>
          <div className="dash-sub">Sponsor-ready profile</div>
          <div className="dash-bar-track">
            <div className="dash-bar-fill" style={{ width: `${overallPct}%` }} />
          </div>
          <div className="dash-sub">
            {missingReq.length === 0
              ? sponsorReady ? 'Sponsor-ready' : 'Core profile complete'
              : `${missingReq.length} required item${missingReq.length > 1 ? 's' : ''} left`}
          </div>
        </ClickablePanel>

        {/* Panel 2: Sponsor Readiness */}
        <ClickablePanel onClick={() => onNavigate('sponsorships')} ariaLabel="Go to Sponsorships">
          <div className="dash-label">Sponsor Readiness</div>
          <div className="flex gap-5 items-center mt-1 flex-wrap">
            <CommandRing pct={overallPct} />
            <div className="grid grid-cols-2 gap-2 flex-1 min-w-0" style={{ minWidth: 140 }}>
              <MiniBar label="Profile"     pct={corePct}     />
              <MiniBar label="Media"       pct={socialPct}   />
              <MiniBar label="Sponsorship" pct={sponsorPct}  />
              <MiniBar label="Education"   pct={eduPct}      />
            </div>
          </div>
        </ClickablePanel>

        {/* Panel 3: Actions Due */}
        <div className="dash-card">
          <div className="dash-label">Actions Due</div>
          {totalActions === 0 ? (
            <>
              <div className="dash-stat" style={{ color: '#00c060' }}>0</div>
              <div className="dash-sub" style={{ color: '#00c060' }}>All clear</div>
            </>
          ) : (
            <>
              <div className="dash-stat" style={{ color: '#C41E3A' }}>{totalActions}</div>
              <div className="dash-sub">Need attention</div>
              <div className="dash-bar-track">
                <div className="dash-bar-fill" style={{ width: `${actionBarPct}%`, background: '#C41E3A' }} />
              </div>
              <div className="dash-sub">
                {[
                  missingProfile > 0 && `${missingProfile} profile`,
                  awaitSign      > 0 && `${awaitSign} contract${awaitSign > 1 ? 's' : ''}`,
                  openObs        > 0 && `${openObs} obligation${openObs > 1 ? 's' : ''}`,
                  requiredEdu    > 0 && `${requiredEdu} education`,
                ].filter(Boolean).join(' · ')}
              </div>
            </>
          )}
        </div>

        {/* Row 2: Full-width Recent Activity */}
        <div className="dash-card" style={{ gridColumn: '1 / -1' }}>
          <div className="dash-label">Recent Activity</div>
          {feedRows.length === 0 ? (
            <p className="dash-sub py-3">
              No fighter activity yet. Complete your profile to start.
            </p>
          ) : (
            <ul className="dc-list">
              {feedRows.map((row: any, i: number) => (
                <li key={i} className="dash-list-item">
                  <span className="dash-item-name">{row.name}</span>
                  <span className={`badge badge-${row.type}`}>{row.badge}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Secondary sections ── */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* Sponsorship Pipeline */}
        <ClickablePanel onClick={() => onNavigate('sponsorships')} ariaLabel="Go to Sponsorships">
          <div className="dash-label mb-2">Sponsorship Pipeline</div>
          <SponsorshipPipelineCompact />
        </ClickablePanel>

        {/* Education Progress */}
        <ClickablePanel onClick={() => onNavigate('education')} ariaLabel="Go to Education">
          <div className="dash-label mb-2">Education Progress</div>
          {modsData ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="font-condensed text-[11px] text-gray-2">Overall</span>
                <span className="font-condensed text-[13px] font-bold text-off-white">{modsData.overall_pct ?? 0}%</span>
              </div>
              <div className="dash-bar-track mb-3">
                <div className="dash-bar-fill" style={{ width: `${modsData.overall_pct ?? 0}%` }} />
              </div>
              {[
                { l: 'Completed',   v: modsData.completed },
                { l: 'In Progress', v: modsData.in_progress },
                { l: 'Not Started', v: modsData.not_started },
              ].map(({ l, v }) => (
                <div key={l} className="flex justify-between py-1 border-b border-charcoal-3 last:border-0">
                  <span className="font-condensed text-[11px] text-gray-2">{l}</span>
                  <span className="font-condensed text-[12px] font-bold text-off-white">{v ?? 0}</span>
                </div>
              ))}
            </>
          ) : <div className="dash-sub">Loading…</div>}
        </ClickablePanel>
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* Profile Improvement */}
        <ClickablePanel onClick={() => onNavigate('profile')} ariaLabel="Go to Profile">
          <div className="dash-label mb-2">Profile Improvement</div>
          {profileData ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="font-condensed text-[11px] text-gray-2">Overall Score</span>
                <span className="font-condensed text-[13px] font-bold text-off-white">{overallPct}%</span>
              </div>
              {(profileData.completion?.missing_required ?? []).length > 0 && (
                <div className="mb-3">
                  <div className="font-condensed text-[9px] font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: '#C41E3A' }}>Required</div>
                  {(profileData.completion.missing_required).map((f: string) => (
                    <div key={f} className="font-condensed text-[11px] text-off-white flex items-center gap-2 py-0.5">
                      <span style={{ color: '#C41E3A' }}>✕</span> {f.replace(/_/g, ' ')}
                    </div>
                  ))}
                </div>
              )}
              {(profileData.completion?.recommended_improvements ?? []).slice(0, 3).map((r: string, i: number) => (
                <div key={i} className="font-condensed text-[11px] text-gray-2 flex items-center gap-2 py-0.5">
                  <span className="text-gray-3">→</span> {r}
                </div>
              ))}
              <Link to="/fighter/profile" className="btn-ghost w-full text-[10px] py-2 no-underline text-center block mt-3">Edit Profile →</Link>
            </>
          ) : <div className="dash-sub">Loading…</div>}
        </ClickablePanel>

        {/* Contracts Summary */}
        <ClickablePanel onClick={() => onNavigate('contracts')} ariaLabel="Go to Contracts & Obligations">
          <div className="dash-label mb-2">Contracts</div>
          {contracts.length === 0 ? (
            <div className="dash-sub">No contracts yet.</div>
          ) : (
            <>
              {[
                { l: 'Awaiting Signature', v: contracts.filter(c => c.status === 'pending_fighter').length, color: '#C41E3A' },
                { l: 'Active',             v: contracts.filter(c => c.status === 'active').length,          color: '#00c060' },
                { l: 'Completed',          v: contracts.filter(c => c.status === 'completed').length,       color: '#4a9f6f' },
              ].map(({ l, v, color }) => (
                <div key={l} className="flex justify-between py-1.5 border-b border-charcoal-3 last:border-0">
                  <span className="font-condensed text-[11px] text-gray-2">{l}</span>
                  <span className="font-condensed text-[13px] font-bold" style={{ color: v > 0 ? color : '#4a4846' }}>{v}</span>
                </div>
              ))}
            </>
          )}
          {openObs > 0 && (
            <div className="mt-3 pt-2 border-t border-charcoal-3">
              <div className="font-condensed text-[11px] flex justify-between">
                <span className="text-gray-2">Open Obligations</span>
                <span className="font-bold" style={{ color: '#C41E3A' }}>{openObs}</span>
              </div>
            </div>
          )}
        </ClickablePanel>
      </div>
    </div>
  )
}

function SponsorshipPipelineCompact() {
  const { data } = useApi<any>('/api/applications/mine')
  const apps = data?.applications ?? []
  if (!apps.length) return (
    <div className="space-y-2">
      <div className="dash-sub">No applications yet.</div>
      <Link to="/opportunities" className="btn-ghost text-[10px] py-2 px-3 no-underline inline-block">Browse Opportunities →</Link>
    </div>
  )
  const byStatus = apps.reduce((acc: any, a: any) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc }, {})
  return (
    <div className="space-y-1">
      {[
        { l: 'Submitted',   k: 'applied',       c: '#7a7672' },
        { l: 'In Review',   k: 'under_review',  c: '#C41E3A' },
        { l: 'Shortlisted', k: 'shortlisted',   c: '#f5a623' },
        { l: 'Accepted',    k: 'accepted',       c: '#00c060' },
      ].map(({ l, k, c }) => byStatus[k] ? (
        <div key={k} className="flex justify-between py-1 border-b border-charcoal-3 last:border-0">
          <span className="font-condensed text-[11px] text-gray-2">{l}</span>
          <span className="font-condensed text-[12px] font-bold" style={{ color: c }}>{byStatus[k]}</span>
        </div>
      ) : null)}
      <Link to="/opportunities" className="font-condensed text-[10px] text-gray-3 hover:text-off-white block pt-2 no-underline">Browse Opportunities →</Link>
    </div>
  )
}

// ── Profile zone ──────────────────────────────────────────────────────────────
function ProfileZone() {
  const { data, loading, error } = useApi<any>('/api/fighter/profile')

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const completion  = data?.completion ?? {}
  const overallPct  = data?.profile_completeness ?? 0

  return (
    <div className="space-y-3.5">
      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 1.5fr 1fr' }}>

        {/* Score ring */}
        <div className="dash-card flex flex-col items-center justify-center text-center">
          <div className="dash-label w-full text-left mb-3">Profile Score</div>
          <CommandRing pct={overallPct} size={100} />
          <div className="dash-sub mt-2">{completion.sponsor_ready ? 'Sponsor-ready' : 'Building profile'}</div>
          <Link to="/fighter/profile" className="btn-ghost w-full text-[10px] py-2 no-underline text-center block mt-3">Edit Profile →</Link>
        </div>

        {/* Group breakdown */}
        <div className="dash-card">
          <div className="dash-label mb-3">Completion Breakdown</div>
          {[
            { l: 'Core Profile',          v: completion.core_pct },
            { l: 'Fight Details',         v: completion.fight_details_pct },
            { l: 'Sponsorship Readiness', v: completion.sponsorship_pct },
            { l: 'Social / Media Proof',  v: completion.social_proof_pct },
          ].map(({ l, v }) => (
            <div key={l} className="mb-3">
              <div className="flex justify-between mb-1">
                <span className="font-condensed text-[11px] text-gray-2">{l}</span>
                <span className="font-condensed text-[11px] font-bold text-off-white">{v ?? 0}%</span>
              </div>
              <div className="dash-bar-track" style={{ height: 3 }}>
                <div className="dash-bar-fill" style={{ width: `${v ?? 0}%`, height: '100%' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Improvements */}
        <div className="dash-card">
          <div className="dash-label mb-2">Improve Your Profile</div>
          {(completion.missing_required ?? []).length > 0 && (
            <div className="mb-3">
              <div className="font-condensed text-[9px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: '#C41E3A' }}>Required</div>
              {(completion.missing_required ?? []).map((f: string) => (
                <div key={f} className="font-condensed text-[11px] text-off-white flex items-center gap-2 py-0.5">
                  <span style={{ color: '#C41E3A' }}>✕</span> {f.replace(/_/g, ' ')}
                </div>
              ))}
            </div>
          )}
          {(completion.recommended_improvements ?? []).length > 0 && (
            <>
              <div className="font-condensed text-[9px] font-bold uppercase tracking-[0.2em] mb-2 text-gray-3">Recommended</div>
              {(completion.recommended_improvements ?? []).map((r: string, i: number) => (
                <div key={i} className="font-condensed text-[11px] text-gray-2 flex items-center gap-2 py-0.5">
                  <span className="text-gray-3">→</span> {r}
                </div>
              ))}
            </>
          )}
          {(completion.missing_required ?? []).length === 0 && (completion.recommended_improvements ?? []).length === 0 && (
            <div className="font-condensed text-[12px]" style={{ color: '#00c060' }}>✓ Profile looking great</div>
          )}
        </div>
      </div>

      {/* Key info + manager */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="dash-card">
          <div className="dash-label mb-2">Fighter Info</div>
          {([
            ['Name',         data?.name],
            ['Weight Class', data?.weight_class],
            ['Record',       data?.record],
            ['Base City',    data?.base_city],
            ['Promotion',    data?.current_promotion],
            ['Gym',          data?.gym_name],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} className="flex justify-between py-1.5 border-b border-charcoal-3 last:border-0 text-[12px]">
              <span className="font-condensed text-gray-3">{k}</span>
              <span className="font-condensed font-semibold text-off-white">{v || '—'}</span>
            </div>
          ))}
        </div>
        <ManagerCard />
      </div>
    </div>
  )
}

// ── SponsorForge access card — exact unlock checklist + review flow ───────────
function SFIcon({ status }: { status: SFItemStatus }) {
  const m = {
    complete:   { ch: '✓', color: '#00c060', bg: 'rgba(0,160,80,0.12)',  bd: 'rgba(0,160,80,0.35)' },
    pending:    { ch: '•', color: '#c9a82c', bg: 'rgba(180,140,0,0.12)',  bd: 'rgba(180,140,0,0.35)' },
    rejected:   { ch: '!', color: '#c00000', bg: 'rgba(139,0,0,0.14)',    bd: 'rgba(139,0,0,0.4)' },
    incomplete: { ch: '',  color: '#4a4846', bg: 'transparent',           bd: '#2a2a2e' },
  }[status]
  return (
    <span className="flex items-center justify-center flex-shrink-0 rounded-full font-condensed font-bold"
      style={{ width: 22, height: 22, fontSize: 12, color: m.color, background: m.bg, border: `1px solid ${m.bd}` }}>
      {m.ch}
    </span>
  )
}

function SponsorForgeCard({ onNavigate }: { onNavigate: (z: string) => void }) {
  const [sf, setSf]                 = useState<SponsorForgeStatus | null>(null)
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg]               = useState<string | null>(null)

  const load = useCallback(() => {
    getSponsorForge().then(d => { setSf(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const submit = async () => {
    setSubmitting(true); setMsg(null)
    try { await submitSponsorForge(); load() }
    catch (e: any) { setMsg(e.message ?? 'Could not submit for review.') }
    finally { setSubmitting(false) }
  }

  if (loading) return <div className="dash-card"><div className="dash-sub">Loading SponsorForge…</div></div>
  if (!sf)     return <div className="dash-card"><div className="dash-sub">SponsorForge status unavailable.</div></div>

  if (!sf.locked) {
    return (
      <div className="dash-card" style={{ borderLeft: '2px solid #00c060' }}>
        <div className="dash-label mb-1">SponsorForge</div>
        <div className="font-condensed text-[11px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: '#00c060' }}>
          Unlocked — Sponsor Matching Active
        </div>
        <p className="font-condensed text-[12px] text-gray-2 mb-3">You're approved. Browse sponsor opportunities and apply.</p>
        <Link to="/opportunities" className="btn-primary text-[10px] py-2 no-underline inline-block">Browse Opportunities →</Link>
      </div>
    )
  }

  const actionFor = (item: SFChecklistItem) => {
    if (!item.action || item.action === 'view_feedback') return null
    if (item.action === 'continue_profile')
      return <Link to="/fighter/profile" className="btn-ghost text-[9px] py-1.5 px-3 no-underline whitespace-nowrap">{item.action_label}</Link>
    if (item.action === 'submit_review')
      return <button onClick={submit} disabled={submitting} className="btn-primary text-[9px] py-1.5 px-3 disabled:opacity-50 whitespace-nowrap">{submitting ? 'Submitting…' : item.action_label}</button>
    // continue_modules + view_readiness both route to the Education zone (where readiness is built)
    return <button onClick={() => onNavigate('education')} className="btn-ghost text-[9px] py-1.5 px-3 whitespace-nowrap">{item.action_label}</button>
  }

  return (
    <div className="dash-card" style={{ borderLeft: '2px solid #c00000' }}>
      <div className="dash-label mb-1">SponsorForge</div>
      <h3 className="font-display text-off-white uppercase mb-1" style={{ fontSize: 18, lineHeight: 1.05 }}>
        Sponsor matching unlocks after training + admin approval
      </h3>
      <p className="font-condensed text-[11px] text-gray-3 mb-4">
        Complete each step. An admin reviews your request before access opens.
      </p>

      {sf.status === 'pending' && (
        <div className="mb-4 p-3 border" style={{ borderColor: 'rgba(180,140,0,0.35)', background: 'rgba(180,140,0,0.08)' }}>
          <span className="font-condensed text-[12px]" style={{ color: '#c9a82c' }}>
            Your SponsorForge review is pending. We'll notify you when it is approved.
          </span>
        </div>
      )}
      {sf.status === 'rejected' && sf.admin_notes && (
        <div className="mb-4 p-3 border" style={{ borderColor: 'rgba(139,0,0,0.4)', background: 'rgba(139,0,0,0.08)' }}>
          <div className="font-condensed text-[9px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: '#c00000' }}>Admin Feedback</div>
          <p className="font-condensed text-[12px] text-gray-1 leading-relaxed">{sf.admin_notes}</p>
        </div>
      )}

      <div className="space-y-1">
        {sf.checklist.map((item, i) => (
          <div key={item.id} className="flex items-start gap-3 py-2.5 border-b border-charcoal-3 last:border-0">
            <SFIcon status={item.status} />
            <div className="flex-1 min-w-0">
              <div className="font-condensed font-bold text-[12px] text-off-white">
                <span className="text-gray-3 mr-1">{i + 1}.</span>{item.label}
              </div>
              <div className="font-condensed text-[11px] text-gray-3">{item.detail}</div>
            </div>
            <div className="flex-shrink-0">{actionFor(item)}</div>
          </div>
        ))}
      </div>

      {msg && <p className="font-condensed text-[11px] mt-3" style={{ color: '#c00000' }}>{msg}</p>}
    </div>
  )
}

// ── Sponsorships zone ─────────────────────────────────────────────────────────
function SponsorshipsZone({ onNavigate }: { onNavigate: (z: string) => void }) {
  const { data: mkt, loading, error } = useApi<any>('/api/fighter/marketplace')
  const { data: appsData }            = useApi<any>('/api/applications/mine')

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const totalApps    = mkt?.total_applications    ?? 0
  const acceptedApps = mkt?.accepted_applications ?? 0
  const acceptRate   = mkt?.acceptance_rate       ?? 0
  const activeC      = mkt?.active_contracts      ?? 0
  const earnings     = mkt?.total_earnings_usd    ?? 0
  const doneObs      = mkt?.completed_obligations ?? 0
  const pendingObs   = mkt?.pending_obligations   ?? 0
  const earningsDisplay = earnings >= 1000 ? `$${(earnings / 1000).toFixed(1)}K` : earnings > 0 ? `$${earnings}` : '$—'

  const apps     = (appsData?.applications ?? []).slice(0, 5)

  return (
    <div className="space-y-3.5">

      {/* Stats row */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard label="Applications" value={String(totalApps)}  sub={`${acceptedApps} accepted`} barPct={100} />
        <StatCard label="Acceptance Rate" value={`${acceptRate}%`} sub="of applications" barPct={acceptRate} />
        <StatCard label="Active Contracts" value={String(activeC)} sub={`${activeC} running`} barPct={activeC > 0 ? 60 : 0} />
        <div className="dash-card text-center">
          <div className="dash-label">Total Earnings</div>
          <div className="font-display text-off-white" style={{ fontSize: 28 }}>{earningsDisplay}</div>
          <div className="dash-sub">From succeeded payments</div>
        </div>
      </div>

      {/* SponsorForge access — full-width unlock checklist */}
      <SponsorForgeCard onNavigate={onNavigate} />

      {/* Obligations */}
      <div className="dash-card">
        <div className="dash-label mb-3">Obligations</div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-condensed text-[11px] text-gray-2">Completed</span>
          <span className="font-condensed font-bold text-off-white">{doneObs}</span>
        </div>
        <div className="dash-bar-track mb-3">
          <div className="dash-bar-fill" style={{ width: `${doneObs + pendingObs > 0 ? Math.round(doneObs / (doneObs + pendingObs) * 100) : 0}%`, background: '#00c060' }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="font-condensed text-[11px] text-gray-2">Pending</span>
          <span className="font-condensed font-bold text-off-white">{pendingObs}</span>
        </div>
      </div>

      {/* Applications */}
      <div className="dash-card">
        <div className="flex items-center justify-between mb-3">
          <div className="dash-label">Recent Applications</div>
          <Link to="/opportunities" className="font-condensed text-[10px] text-blood-glow hover:underline no-underline">Browse Opportunities →</Link>
        </div>
        {apps.length === 0 ? (
          <EmptyState icon="◈" title="No Applications Yet"
            body="Browse opportunities to apply for your first sponsorship."
            action={<Link to="/opportunities" className="btn-ghost text-[11px] py-2 px-4 no-underline">Browse Now →</Link>} />
        ) : (
          apps.map((a: any) => (
            <div key={a.id} className="flex items-center gap-3 py-2 border-b border-charcoal-3 last:border-0"
              style={{ borderLeft: `2px solid ${APP_SC[a.status] ?? '#222226'}`, paddingLeft: 8, marginLeft: -8 }}>
              <div className="flex-1 min-w-0">
                <div className="font-condensed font-bold text-[12px] text-off-white truncate">{a.opportunity?.title ?? 'Opportunity'}</div>
                <div className="font-condensed text-[11px] text-gray-3">{a.sponsor_detail?.company_name ?? '—'}</div>
              </div>
              <span className="font-condensed text-[10px] uppercase tracking-[0.1em] flex-shrink-0" style={{ color: APP_SC[a.status] }}>{APP_SL[a.status] ?? a.status}</span>
            </div>
          ))
        )}
        {apps.length > 0 && (
          <Link to="/fighter/applications" className="font-condensed text-[11px] text-gray-3 hover:text-off-white block text-center mt-2 no-underline">View all applications →</Link>
        )}
      </div>
    </div>
  )
}

// ── Education zone ────────────────────────────────────────────────────────────
function EducationZone() {
  const [modules,  setModules]  = useState<FighterModule[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [openId,   setOpenId]   = useState<string | null>(null)
  const [overall,  setOverall]  = useState(0)

  const load = useCallback(() => {
    setLoading(true)
    getFighterModules()
      .then(d => { setModules(d.modules); setOverall(d.overall_pct); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />
  if (openId)  return <ModuleDetail moduleId={openId} onBack={() => { setOpenId(null); load() }} />

  if (!modules.length) return (
    <EmptyState icon="●" title="No Modules Assigned Yet" body="Published education modules will appear here. Check back soon." />
  )

  const completed  = modules.filter(m => m.progress.status === 'completed')
  const inProgress = modules.filter(m => m.progress.status === 'in_progress')
  const notStarted = modules.filter(m => m.progress.status === 'not_started')

  const ModuleCard = ({ m }: { m: FighterModule }) => {
    const pct = m.progress.completion_pct ?? 0
    const st  = m.progress.status ?? 'not_started'
    return (
      <button onClick={() => setOpenId(m.id)} className="dash-card text-left w-full hover:border-blood transition-colors"
        style={{ borderLeft: `2px solid ${st === 'completed' ? '#00c060' : st === 'in_progress' ? '#c9a82c' : '#222226'}` }}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="font-condensed font-bold text-[13px] text-off-white truncate">{m.name}</div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {m.category && <span className="font-condensed text-[10px] text-gray-3 capitalize">{m.category}</span>}
              <span className="font-condensed text-[10px] text-gray-3 capitalize">{(m.module_type || 'lesson').replace('_', ' ')}</span>
              {m.estimated_mins && <span className="font-condensed text-[10px] text-gray-3">{m.estimated_mins}m</span>}
              {m.is_required && <span className="font-condensed text-[9px] uppercase tracking-widest" style={{ color: '#C41E3A' }}>Required</span>}
            </div>
          </div>
          <span className="font-condensed text-[11px] font-bold shrink-0"
            style={{ color: st === 'completed' ? '#00c060' : st === 'in_progress' ? '#c9a82c' : '#4a4846' }}>
            {st === 'completed' ? '✓ Done' : st === 'in_progress' ? `${pct}%` : 'Start →'}
          </span>
        </div>
        {pct > 0 && (
          <div className="dash-bar-track mt-1" style={{ height: 3 }}>
            <div className="dash-bar-fill" style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#00c060' : 'linear-gradient(90deg,#8b0000,#c00000)' }} />
          </div>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeading>Education Modules</SectionHeading>
        <div className="flex items-center gap-3">
          <ReadinessRing pct={overall} size={52} label="%" />
          <span className="font-condensed text-[11px] text-gray-3">{completed.length}/{modules.length} done</span>
        </div>
      </div>
      {inProgress.length > 0 && (
        <div>
          <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 mb-2">In Progress</div>
          <div className="grid grid-cols-1 gap-2">{inProgress.map(m => <ModuleCard key={m.id} m={m} />)}</div>
        </div>
      )}
      {notStarted.length > 0 && (
        <div>
          <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 mb-2">Not Started</div>
          <div className="grid grid-cols-1 gap-2">{notStarted.map(m => <ModuleCard key={m.id} m={m} />)}</div>
        </div>
      )}
      {completed.length > 0 && (
        <div>
          <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 mb-2">Completed</div>
          <div className="grid grid-cols-1 gap-2">{completed.map(m => <ModuleCard key={m.id} m={m} />)}</div>
        </div>
      )}
    </div>
  )
}

// ── Contracts & Obligations zone ──────────────────────────────────────────────
function ContractsZone() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading]     = useState(true)
  const { data: obsData, loading: obsLoading } = useApi<any>('/api/fighter/obligations')

  useEffect(() => {
    getContracts()
      .then(r => { setContracts(r.contracts ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading || obsLoading) return <DashSkeleton />

  const sponsorObs  = obsData?.sponsor ?? []
  const mediaObs    = obsData?.media   ?? []
  const fulfillment = obsData?.fulfillment_pct ?? 100
  const completed   = obsData?.completed_count ?? 0

  return (
    <div className="space-y-3.5">

      {/* Contracts */}
      <div className="dash-card">
        <div className="flex items-center justify-between mb-3">
          <div className="dash-label">Contracts</div>
          <Link to="/contracts" className="font-condensed text-[10px] text-gray-3 hover:text-off-white no-underline">View all →</Link>
        </div>
        {contracts.length === 0 ? (
          <EmptyState icon="■" title="No Contracts Yet" body="Accepted applications will generate contracts here." />
        ) : (
          contracts.slice(0, 5).map(c => (
            <Link key={c.id} to={`/contracts/${c.id}`}
              className="dash-card flex items-center gap-3 no-underline block mb-2"
              style={{ borderLeft: `2px solid ${FC_COLOR[c.status] ?? '#222226'}` }}>
              <div className="flex-1 min-w-0">
                <span className="font-condensed text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 mr-2"
                  style={{ background: FC_COLOR[c.status] ?? '#374151', color: '#f0ece4' }}>
                  {FC_LABEL[c.status] ?? c.status}
                </span>
                <span className="font-condensed font-bold text-off-white text-[13px]">
                  ${c.value_usd.toLocaleString()} · {c.payment_schedule}
                </span>
              </div>
              <span className="font-condensed text-[11px] text-gray-3 flex-shrink-0">View →</span>
            </Link>
          ))
        )}
      </div>

      {/* Obligations */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 1fr 160px' }}>
        {sponsorObs.length > 0
          ? <ListCard label="Sponsor Obligations" items={sponsorObs} />
          : <EmptyState title="No Sponsor Obligations" body="Active sponsor deal deliverables appear here." />}
        {mediaObs.length > 0
          ? <ListCard label="Media Obligations" items={mediaObs} />
          : <EmptyState title="No Media Obligations" body="Event and promotion media duties appear here." />}
        <div className="dash-card text-center">
          <div className="dash-label">Fulfillment</div>
          <ReadinessRing pct={fulfillment} size={80} color="#00c060" label="%" />
          <div className="dash-sub mt-2">{completed} completed</div>
        </div>
      </div>
    </div>
  )
}

// ── Default export — shell + zone routing ────────────────────────────────────
export default function FighterDashboard() {
  const [zone, setZone]  = useState('command')
  const { user, logout } = useAuth()
  const navigate         = useNavigate()

  return (
    <div className="min-h-screen bg-black flex flex-col" style={{ fontFamily: "'Barlow',sans-serif" }}>

      {/* ── Command bar ── */}
      <header className="bg-near-black border-b border-charcoal-3 flex items-stretch flex-shrink-0 sticky top-0 z-30">
        <div className="flex items-center px-5 py-3 border-r border-charcoal-3 flex-shrink-0">
          <Link to="/" className="no-underline inline-block">
            <img src="/logo-white.png" alt="Eleventh Round" style={{ height: 22, width: 'auto' }} />
          </Link>
        </div>
        <div className="flex items-center px-5 py-3 border-r border-charcoal-3 flex-shrink-0">
          <div>
            <div className="font-condensed text-[8px] font-bold tracking-[0.4em] uppercase leading-none mb-0.5" style={{ color: '#C41E3A' }}>
              Fighter Portal
            </div>
            <div className="font-display text-off-white uppercase leading-none" style={{ fontSize: 14 }}>
              {user?.name ?? 'My Dashboard'}
            </div>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-5 px-5 py-3">
          {user && (
            <div className="text-right hidden sm:block">
              <div className="font-condensed text-[11px] font-bold text-off-white leading-tight">{user.name}</div>
              <div className="font-condensed text-[9px] text-gray-3 leading-tight">{user.email}</div>
            </div>
          )}
          <NotificationBell />
          <Link to="/" className="font-condensed font-bold uppercase text-gray-3 hover:text-off-white transition-colors no-underline"
            style={{ fontSize: 10, letterSpacing: '0.2em' }}>
            ← Home
          </Link>
          <button onClick={() => { logout(); navigate('/login') }}
            className="font-condensed font-bold uppercase text-gray-3 hover:text-blood-glow transition-colors bg-transparent border-0 cursor-pointer"
            style={{ fontSize: 10, letterSpacing: '0.25em' }}>
            Sign Out
          </button>
        </div>
      </header>

      {/* ── Zone nav ── */}
      <div className="bg-near-black border-b border-charcoal-3 px-4 flex overflow-x-auto flex-shrink-0 sticky top-[57px] z-20"
        style={{ scrollbarWidth: 'none' }}>
        {ZONES.map(z => (
          <button key={z.id} onClick={() => setZone(z.id)}
            className="font-condensed text-[10px] font-bold tracking-[0.18em] uppercase px-5 py-3.5 cursor-pointer border-0 bg-transparent whitespace-nowrap transition-all duration-150"
            style={{
              color:        zone === z.id ? '#f0ece4' : '#4a4846',
              borderBottom: zone === z.id ? '2px solid #C41E3A' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {z.label}
          </button>
        ))}
      </div>

      {/* ── Zone content ── */}
      <main className="flex-1 overflow-y-auto p-6 bg-black">
        {zone === 'command'      && <CommandCenter onNavigate={setZone} />}
        {zone === 'profile'      && <ProfileZone />}
        {zone === 'sponsorships' && <SponsorshipsZone onNavigate={setZone} />}
        {zone === 'education'    && <EducationZone />}
        {zone === 'events'       && <EventCalendar assignable={user ? [{ id: user.id, name: user.name }] : []} />}
        {zone === 'contracts'    && <ContractsZone />}
      </main>
    </div>
  )
}
