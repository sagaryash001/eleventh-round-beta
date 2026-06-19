import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import NotificationBell from '../../components/NotificationBell'
import EventCalendar from '../../components/events/EventCalendar'
import { CommandCalendarCard, CommandCalendarPanel } from '../../components/events/Calendar'
import { useApi } from '../../hooks/useApi'
import {
  getManagerRoster, inviteFighter, createPendingFighter,
  updateConnectionStatus, resendInvite, getFighterDetail, updateFighterProfile,
  updatePendingProfile, convertPendingToInvite,
  getManagerContracts, type RosterEntry,
} from '../../lib/api/manager'
import { getManagerModuleProgress } from '../../lib/api/education'
import { ReadinessRing as CommandRing, MiniBar, ClickablePanel } from './shared/CommandLayout'
import { ReadinessRing, StatCard, ListCard, BarChart, DashSkeleton, EmptyState, ApiError, SectionHeading } from './DashWidgets'

// ── Zone definitions ──────────────────────────────────────────────────────────
const ZONES = [
  { id: 'command',     label: 'Command Center'         },
  { id: 'roster',      label: 'Roster'                 },
  { id: 'fighter-ops', label: 'Fighter Ops'            },
  { id: 'education',   label: 'Education'              },
  { id: 'events',      label: 'Event Calendar'         },
  { id: 'contracts',   label: 'Contracts & Obligations'},
]

// ── Events zone — Event Calendar with roster fighters assignable ──────────────
function ManagerEventsZone() {
  const { user } = useAuth()
  const { data: rosterData } = useApi<any>('/api/manager/roster')
  const isPromotion = (user as any)?.account_type === 'promotion'
  const assignable = [
    ...(user ? [{ id: user.id, name: `${user.name} (me)` }] : []),
    ...((rosterData?.roster ?? [])
      .filter((r: any) => r.status === 'active' && r.fighter?.id)
      .map((r: any) => ({ id: r.fighter.id as string, name: r.fighter.name as string }))),
  ]
  return <EventCalendar assignable={assignable} canLinkFighters label={isPromotion ? 'Promotion Calendar' : 'Event Calendar'} />
}

// ── Status maps ───────────────────────────────────────────────────────────────
const MC_COLOR: Record<string, string> = {
  draft: '#4a4846', pending_fighter: '#b45309', active: '#166534',
  in_dispute: '#7f1d1d', completed: '#1e3a5f', terminated: '#374151',
}
const MC_LABEL: Record<string, string> = {
  draft: 'Draft', pending_fighter: 'Awaiting Fighter', active: 'Active',
  in_dispute: 'In Dispute', completed: 'Completed', terminated: 'Terminated',
}
const APP_STATUS_COLOR: Record<string, string> = {
  applied: '#7a7672', under_review: '#C41E3A', shortlisted: '#f5a623',
  accepted: '#00c060', rejected: '#4a4846', withdrawn: '#4a4846',
}
const APP_STATUS_LABEL: Record<string, string> = {
  applied: 'Submitted', under_review: 'In Review', shortlisted: 'Shortlisted',
  accepted: 'Accepted', rejected: 'Rejected', withdrawn: 'Withdrawn',
}

// ── Tiny form utilities ───────────────────────────────────────────────────────
function MI({ label, value, onChange, type = 'text', placeholder, required = false }: {
  label: string; value: string | number; onChange: (v: string) => void
  type?: string; placeholder?: string; required?: boolean
}) {
  const [f, setF] = useState(false)
  return (
    <div>
      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1">
        {label}{required && <span className="text-blood-glow ml-1">*</span>}
      </label>
      <input type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setF(true)} onBlur={() => setF(false)}
        className="w-full bg-charcoal-2 border text-off-white font-body text-[13px] px-3 py-2 outline-none transition-all placeholder:text-gray-3"
        style={{ borderColor: f ? '#8b0000' : '#222226' }} />
    </div>
  )
}
function Spinner() { return <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> }
function Msg({ msg }: { msg: { type: 'ok' | 'err'; text: string } | null }) {
  if (!msg) return null
  return <p className={`font-condensed text-[11px] ${msg.type === 'ok' ? 'text-green-400' : 'text-blood-glow'}`}>{msg.text}</p>
}
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    active: ['Active', 'badge-green'], pending: ['Pending', 'badge-yellow'],
    declined: ['Declined', 'badge-red'], removed: ['Removed', 'badge-red'],
  }
  const [label, cls] = map[status] ?? [status, 'badge-yellow']
  return <span className={`badge ${cls}`}>{label}</span>
}

// ── Fighter edit form ─────────────────────────────────────────────────────────
function EditFighterPanel({ fighter, onSave, onCancel }: { fighter: any; onSave: (d: any) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState({
    division: fighter.division ?? '', weight_class: fighter.weight_class ?? '',
    record_wins: String(fighter.record_wins ?? 0), record_losses: String(fighter.record_losses ?? 0),
    record_draws: String(fighter.record_draws ?? 0), base_city: fighter.base_city ?? '',
    gym_name: fighter.gym_name ?? '', coach_name: fighter.coach_name ?? '',
    current_promotion: fighter.current_promotion ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const set = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      await onSave({
        division: form.division || null, weight_class: form.weight_class || null,
        record_wins: Number(form.record_wins), record_losses: Number(form.record_losses),
        record_draws: Number(form.record_draws), base_city: form.base_city || null,
        gym_name: form.gym_name || null, coach_name: form.coach_name || null,
        current_promotion: form.current_promotion || null,
      })
      setMsg({ type: 'ok', text: 'Saved.' })
    } catch (e: any) { setMsg({ type: 'err', text: e.message ?? 'Save failed.' }) }
    finally { setSaving(false) }
  }

  return (
    <div className="mt-3 pt-3 border-t border-charcoal-3 space-y-3">
      <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-gray-3">Edit Fighter Profile</div>
      <div className="grid grid-cols-2 gap-3">
        <MI label="Division / Style" value={form.division} onChange={set('division')} placeholder="e.g. MMA" />
        <MI label="Weight Class" value={form.weight_class} onChange={set('weight_class')} placeholder="e.g. Lightweight" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <MI label="Wins"   type="number" value={form.record_wins}   onChange={set('record_wins')} />
        <MI label="Losses" type="number" value={form.record_losses} onChange={set('record_losses')} />
        <MI label="Draws"  type="number" value={form.record_draws}  onChange={set('record_draws')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MI label="City / Base" value={form.base_city}          onChange={set('base_city')}          placeholder="e.g. Las Vegas" />
        <MI label="Gym"         value={form.gym_name}           onChange={set('gym_name')}           placeholder="e.g. AKA" />
        <MI label="Coach"       value={form.coach_name}         onChange={set('coach_name')}         placeholder="Coach name" />
        <MI label="Promotion"   value={form.current_promotion}  onChange={set('current_promotion')}  placeholder="e.g. UFC" />
      </div>
      <Msg msg={msg} />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="btn-primary text-[11px] py-2 disabled:opacity-50">
          {saving ? <Spinner /> : 'Save Changes'}
        </button>
        <button onClick={onCancel} className="btn-ghost text-[11px] py-2">Cancel</button>
      </div>
    </div>
  )
}

// ── Command Center ────────────────────────────────────────────────────────────
function ManagerCommandCenter({ onNavigate }: { onNavigate: (zone: string) => void }) {
  const { data: overview }     = useApi<any>('/api/manager/overview')
  const { data: activityData } = useApi<any>('/api/manager/activity')
  const { data: modsData }     = useApi<any>('/api/manager/modules/progress')
  const { data: rosterData }   = useApi<any>('/api/manager/roster')
  const { data: oblData }      = useApi<any>('/api/manager/obligations')
  const { data: appsApiData }  = useApi<any>('/api/manager/applications')
  const [contracts, setContracts] = useState<any[]>([])

  useEffect(() => {
    getManagerContracts().then(r => setContracts(r.contracts ?? [])).catch(() => {})
  }, [])

  // Panel 1: Active Roster
  const activeRoster  = overview?.active_roster     ?? 0
  const avgHealth     = overview?.roster_health     ?? 0
  const pendingInvites = overview?.pending_invites  ?? 0
  const pendingReqs   = overview?.pending_requests  ?? 0
  const totalPending  = pendingInvites + pendingReqs

  // Panel 2: Roster Readiness
  const profilePct    = avgHealth
  const eduPct        = modsData?.summary?.avg_completion ?? null
  const sfReady       = overview?.sf_ready ?? 0
  const sfPct: number | null = activeRoster > 0 ? Math.round(sfReady / activeRoster * 100) : null
  const oblRate: number | null = oblData?.rate ?? null
  const readinessScore = Math.round(
    [profilePct, eduPct ?? 0, sfPct ?? 0, oblRate ?? 100].reduce((s, v) => s + v, 0) / 4
  )

  // Panel 3: Actions Due
  const contractsAwaiting = contracts.filter(c => c.status === 'pending_fighter').length
  const overdueObs        = overview?.overdue_obligations ?? 0
  const totalActions      = pendingReqs + contractsAwaiting + overdueObs
  const actionBarPct      = Math.min(totalActions * 20, 100)

  const feedRows = activityData?.events ?? []

  // Secondary data
  const apps        = appsApiData?.applications ?? []
  const rosterList  = rosterData?.roster ?? []
  const activeCount = rosterList.filter((r: any) => r.status === 'active').length
  const byAppStatus = apps.reduce((acc: any, a: any) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc }, {})
  const modsTotal   = modsData?.summary?.total_modules ?? 0
  const avgEduPct   = modsData?.summary?.avg_completion ?? 0
  const activeContracts = contracts.filter(c => c.status === 'active').length
  const completedContracts = contracts.filter(c => c.status === 'completed').length

  return (
    <div className="space-y-3.5">

      {/* ── Hero grid ── */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 1.5fr 1fr' }}>

        {/* Panel 1: Active Roster */}
        <ClickablePanel onClick={() => onNavigate('roster')} ariaLabel="Go to Roster">
          <div className="dash-label">Active Roster</div>
          <div className="dash-stat">{activeRoster}</div>
          <div className="dash-sub">Fighters managed</div>
          <div className="dash-bar-track">
            <div className="dash-bar-fill" style={{ width: `${avgHealth}%` }} />
          </div>
          <div className="dash-sub">
            {totalPending > 0
              ? `${activeCount} active · ${totalPending} pending`
              : activeRoster > 0 ? `${activeRoster} active` : 'No fighters yet'}
          </div>
        </ClickablePanel>

        {/* Panel 2: Roster Readiness */}
        <div className="dash-card">
          <div className="dash-label">Roster Readiness</div>
          <div className="flex gap-5 items-center mt-1 flex-wrap">
            <CommandRing pct={readinessScore} />
            <div className="grid grid-cols-2 gap-2 flex-1 min-w-0" style={{ minWidth: 140 }}>
              <MiniBar label="Profiles"    pct={profilePct} />
              <MiniBar label="Education"   pct={eduPct} />
              <MiniBar label="Sponsorship" pct={sfPct} />
              <MiniBar label="Obligations" pct={oblRate} />
            </div>
          </div>
        </div>

        {/* Panel 3: Actions Due */}
        <ClickablePanel
          onClick={totalActions > 0 ? () => onNavigate(pendingReqs > 0 ? 'roster' : contractsAwaiting > 0 ? 'contracts' : 'contracts') : undefined}
          ariaLabel="View pending actions">
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
                  pendingReqs        > 0 && `${pendingReqs} invite${pendingReqs > 1 ? 's' : ''}`,
                  contractsAwaiting  > 0 && `${contractsAwaiting} contract${contractsAwaiting > 1 ? 's' : ''}`,
                  overdueObs         > 0 && `${overdueObs} obligation${overdueObs > 1 ? 's' : ''}`,
                ].filter(Boolean).join(' · ')}
              </div>
            </>
          )}
        </ClickablePanel>

        {/* Row 2: Recent Activity (cols 1–2) + Calendar summary card (col 3) */}
        <div className="dash-card" style={{ gridColumn: '1 / 3' }}>
          <div className="dash-label">Recent Activity</div>
          {feedRows.length === 0 ? (
            <p className="dash-sub py-3">No roster activity yet. Invite fighters to begin.</p>
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
        <CommandCalendarCard onOpen={() => onNavigate('events')} />
      </div>

      {/* Full-width Event Command panel — compact tactical agenda (no month grid) */}
      <CommandCalendarPanel onOpen={() => onNavigate('events')} onAdd={() => onNavigate('events')} onOpenItem={() => onNavigate('events')} />

      {/* ── Secondary sections ── */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* Roster Snapshot */}
        <ClickablePanel onClick={() => onNavigate('roster')} ariaLabel="Go to Roster">
          <div className="dash-label mb-2">Roster Snapshot</div>
          {[
            { l: 'Active Fighters',   v: activeCount,   c: '#00c060' },
            { l: 'Pending Invites',   v: pendingInvites, c: pendingInvites > 0 ? '#c9a82c' : '#4a4846' },
            { l: 'Pending Requests',  v: pendingReqs,   c: pendingReqs   > 0 ? '#C41E3A'  : '#4a4846' },
          ].map(({ l, v, c }) => (
            <div key={l} className="flex justify-between py-1.5 border-b border-charcoal-3 last:border-0">
              <span className="font-condensed text-[11px] text-gray-2">{l}</span>
              <span className="font-condensed text-[13px] font-bold" style={{ color: c }}>{v}</span>
            </div>
          ))}
          <div className="flex gap-2 mt-3">
            <button onClick={e => { e.stopPropagation(); onNavigate('roster') }}
              className="btn-ghost text-[10px] py-1.5 px-3">Invite Fighter →</button>
          </div>
        </ClickablePanel>

        {/* Fighter Ops Summary */}
        <ClickablePanel onClick={() => onNavigate('fighter-ops')} ariaLabel="Go to Fighter Ops">
          <div className="dash-label mb-2">Fighter Ops</div>
          {apps.length === 0 ? (
            <div className="dash-sub">No applications yet.</div>
          ) : (
            [
              { l: 'Submitted',   k: 'applied',      c: '#7a7672' },
              { l: 'In Review',   k: 'under_review', c: '#C41E3A' },
              { l: 'Shortlisted', k: 'shortlisted',  c: '#f5a623' },
              { l: 'Accepted',    k: 'accepted',     c: '#00c060' },
            ].filter(({ k }) => byAppStatus[k]).map(({ l, k, c }) => (
              <div key={k} className="flex justify-between py-1.5 border-b border-charcoal-3 last:border-0">
                <span className="font-condensed text-[11px] text-gray-2">{l}</span>
                <span className="font-condensed text-[13px] font-bold" style={{ color: c }}>{byAppStatus[k]}</span>
              </div>
            ))
          )}
          {sfReady > 0 && (
            <div className="font-condensed text-[11px] text-green-400 mt-2 pt-2 border-t border-charcoal-3">
              {sfReady} fighter{sfReady > 1 ? 's' : ''} SponsorForge-eligible
            </div>
          )}
        </ClickablePanel>
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* Education Progress */}
        <ClickablePanel onClick={() => onNavigate('education')} ariaLabel="Go to Education">
          <div className="dash-label mb-2">Education Progress</div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-condensed text-[11px] text-gray-2">Roster Average</span>
            <span className="font-condensed text-[13px] font-bold text-off-white">{avgEduPct}%</span>
          </div>
          <div className="dash-bar-track mb-2">
            <div className="dash-bar-fill" style={{ width: `${avgEduPct}%` }} />
          </div>
          <div className="font-condensed text-[11px] text-gray-3">{modsTotal} module{modsTotal !== 1 ? 's' : ''} published</div>
        </ClickablePanel>

        {/* Contracts Summary */}
        <ClickablePanel onClick={() => onNavigate('contracts')} ariaLabel="Go to Contracts & Obligations">
          <div className="dash-label mb-2">Contracts</div>
          {[
            { l: 'Awaiting Signature', v: contractsAwaiting, c: contractsAwaiting > 0 ? '#c9a82c' : '#4a4846' },
            { l: 'Active',             v: activeContracts,   c: '#00c060' },
            { l: 'Completed',          v: completedContracts, c: '#4a9f6f' },
          ].map(({ l, v, c }) => (
            <div key={l} className="flex justify-between py-1.5 border-b border-charcoal-3 last:border-0">
              <span className="font-condensed text-[11px] text-gray-2">{l}</span>
              <span className="font-condensed text-[13px] font-bold" style={{ color: c }}>{v}</span>
            </div>
          ))}
          {overdueObs > 0 && (
            <div className="font-condensed text-[11px] mt-2 pt-2 border-t border-charcoal-3 flex justify-between">
              <span className="text-gray-2">Overdue Obligations</span>
              <span className="font-bold" style={{ color: '#C41E3A' }}>{overdueObs}</span>
            </div>
          )}
        </ClickablePanel>
      </div>

      {/* Operations Tools — not yet configured */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="dash-card opacity-60">
          <div className="dash-label mb-1">Playbooks</div>
          <div className="dash-sub">Not configured yet.</div>
        </div>
        <div className="dash-card opacity-60">
          <div className="dash-label mb-1">Camp Budgeting</div>
          <div className="dash-sub">Not configured yet.</div>
        </div>
      </div>
    </div>
  )
}

// ── Draft profile card (manager-only tracking; not yet invited) ───────────────
function DraftProfileCard({ conn, onChanged }: { conn: RosterEntry; onChanged: () => void }) {
  const d: any = conn.pending_fighter_data ?? {}
  const [mode, setMode] = useState<'view' | 'invite' | 'edit'>('view')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [form, setForm] = useState({
    name: conn.invited_name ?? d.name ?? '', sport: d.sport ?? 'mma',
    weight_class: d.weight_class ?? '', base_city: d.base_city ?? '',
    record_wins: String(d.record_wins ?? 0), record_losses: String(d.record_losses ?? 0), record_draws: String(d.record_draws ?? 0),
    notes: d.notes ?? '',
  })

  const name   = conn.invited_name ?? d.name ?? 'Draft Fighter'
  const record = `${d.record_wins ?? 0}-${d.record_losses ?? 0}${(d.record_draws ?? 0) > 0 ? `-${d.record_draws}` : ''}`

  const sendInvite = async () => {
    if (!email.trim()) { setMsg({ type: 'err', text: 'Enter a fighter email.' }); return }
    setBusy(true); setMsg(null)
    try {
      const r = await convertPendingToInvite(conn.id, email.trim())
      setMsg({ type: 'ok', text: r.matched ? 'Invite sent to existing fighter.' : 'Email invite sent.' })
      onChanged()
    } catch (e: any) { setMsg({ type: 'err', text: e.message }) }
    finally { setBusy(false) }
  }
  const saveEdit = async () => {
    if (!form.name.trim()) { setMsg({ type: 'err', text: 'Name is required.' }); return }
    setBusy(true); setMsg(null)
    try {
      await updatePendingProfile(conn.id, {
        name: form.name.trim(), sport: form.sport,
        weight_class: form.weight_class || null, base_city: form.base_city || null,
        record_wins: Number(form.record_wins), record_losses: Number(form.record_losses), record_draws: Number(form.record_draws),
        notes: form.notes || null,
      })
      setMode('view'); onChanged()
    } catch (e: any) { setMsg({ type: 'err', text: e.message }) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true); setMsg(null)
    try { await updateConnectionStatus(conn.id, 'removed'); onChanged() }
    catch (e: any) { setMsg({ type: 'err', text: e.message }) }
    finally { setBusy(false) }
  }

  return (
    <div className="dash-card" style={{ borderLeft: '2px solid #5a5a66' }}>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-condensed font-bold text-off-white" style={{ fontSize: 13 }}>{name}</span>
            <span className="badge" style={{ background: 'rgba(120,120,130,0.12)', color: '#9a9aa2', border: '1px solid rgba(120,120,130,0.25)' }}>Draft Profile</span>
          </div>
          <div className="font-condensed text-[11px] text-gray-3">
            {record}{d.weight_class ? ` · ${d.weight_class}` : ''}{d.base_city ? ` · ${d.base_city}` : ''}
          </div>
          <div className="font-condensed text-[10px] text-gray-3 mt-0.5">Manager-only profile — not yet invited</div>
        </div>
        {mode === 'view' && (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => { setMode('invite'); setMsg(null) }} disabled={busy}
              className="font-condensed font-bold uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border cursor-pointer transition-all disabled:opacity-40"
              style={{ borderColor: '#2a5c2a', color: '#00c060' }}>Invite by Email</button>
            <button onClick={() => { setMode('edit'); setMsg(null) }} disabled={busy}
              className="font-condensed font-bold uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border border-charcoal-3 text-gray-2 cursor-pointer hover:border-blood hover:text-off-white transition-all disabled:opacity-40">Edit</button>
            <button onClick={remove} disabled={busy}
              className="font-condensed font-bold uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border border-charcoal-3 text-gray-3 cursor-pointer hover:border-blood hover:text-blood-glow transition-all disabled:opacity-40">
              {busy ? <Spinner /> : 'Remove'}</button>
          </div>
        )}
      </div>

      {mode === 'invite' && (
        <div className="mt-3 pt-3 border-t border-charcoal-3 space-y-2">
          <MI label="Fighter Email" value={email} onChange={setEmail} placeholder="fighter@email.com" required />
          <Msg msg={msg} />
          <div className="flex gap-2">
            <button onClick={sendInvite} disabled={busy} className="btn-primary text-[11px] py-2 disabled:opacity-50">
              {busy ? <><Spinner /> Sending…</> : 'Send Invite'}</button>
            <button onClick={() => { setMode('view'); setMsg(null) }} className="btn-ghost text-[11px] py-2">Cancel</button>
          </div>
        </div>
      )}

      {mode === 'edit' && (
        <div className="mt-3 pt-3 border-t border-charcoal-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <MI label="Name" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} required />
            <div>
              <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1">Sport</label>
              <select value={form.sport} onChange={e => setForm(p => ({ ...p, sport: e.target.value }))}
                className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none">
                {['mma', 'boxing', 'bjj', 'muay_thai', 'wrestling', 'other'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <MI label="Weight Class" value={form.weight_class} onChange={v => setForm(p => ({ ...p, weight_class: v }))} />
            <MI label="City / Base" value={form.base_city} onChange={v => setForm(p => ({ ...p, base_city: v }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MI label="Wins" type="number" value={form.record_wins} onChange={v => setForm(p => ({ ...p, record_wins: v }))} />
            <MI label="Losses" type="number" value={form.record_losses} onChange={v => setForm(p => ({ ...p, record_losses: v }))} />
            <MI label="Draws" type="number" value={form.record_draws} onChange={v => setForm(p => ({ ...p, record_draws: v }))} />
          </div>
          <div>
            <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
              className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none resize-none" />
          </div>
          <Msg msg={msg} />
          <div className="flex gap-2">
            <button onClick={saveEdit} disabled={busy} className="btn-primary text-[11px] py-2 disabled:opacity-50">
              {busy ? <><Spinner /> Saving…</> : 'Save Changes'}</button>
            <button onClick={() => { setMode('view'); setMsg(null) }} className="btn-ghost text-[11px] py-2">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Roster zone ───────────────────────────────────────────────────────────────
function RosterZone() {
  const [roster,     setRoster]    = useState<RosterEntry[]>([])
  const [loading,    setLoading]   = useState(true)
  const [error,      setError]     = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [expandId,   setExpandId]  = useState<string | null>(null)
  const [editId,     setEditId]    = useState<string | null>(null)
  const [detail,     setDetail]    = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actingId,   setActingId]  = useState<string | null>(null)
  const [msg,        setMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [invite, setInvite] = useState({ email: '', name: '', message: '' })
  const [invSaving, setInvSaving] = useState(false)
  const [invMsg, setInvMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [cpf, setCpf] = useState({ name: '', sport: 'mma', weight_class: '', record_wins: '0', record_losses: '0', record_draws: '0', base_city: '', notes: '' })
  const [cpfSaving, setCpfSaving] = useState(false)
  const [cpfMsg, setCpfMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    getManagerRoster()
      .then(d => { setRoster(d.roster ?? []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const expand = async (id: string, fighterId: string | null) => {
    if (expandId === id) { setExpandId(null); setDetail(null); setEditId(null); return }
    setExpandId(id)
    if (!fighterId) return
    setDetailLoading(true)
    getFighterDetail(fighterId)
      .then(d => { setDetail(d); setDetailLoading(false) })
      .catch(() => setDetailLoading(false))
  }

  const changeStatus = async (id: string, status: 'active' | 'declined' | 'removed') => {
    setActingId(id); setMsg(null)
    try {
      await updateConnectionStatus(id, status)
      setMsg({ type: 'ok', text: `Connection ${status}.` }); load()
    } catch (e: any) { setMsg({ type: 'err', text: e.message }) }
    finally { setActingId(null) }
  }

  const resend = async (id: string) => {
    setActingId(id); setMsg(null)
    try {
      await resendInvite(id)
      setMsg({ type: 'ok', text: 'Invite resent.' }); load()
    } catch (e: any) { setMsg({ type: 'err', text: e.message }) }
    finally { setActingId(null) }
  }

  const submitInvite = async () => {
    if (!invite.email.trim()) { setInvMsg({ type: 'err', text: 'Email is required.' }); return }
    setInvSaving(true); setInvMsg(null)
    try {
      const r = await inviteFighter({ email: invite.email.trim(), name: invite.name || null, message: invite.message || null })
      setInvMsg({ type: 'ok', text: r.matched ? 'Invite sent to existing fighter.' : 'Invite queued — email not yet registered.' })
      setInvite({ email: '', name: '', message: '' }); load()
    } catch (e: any) { setInvMsg({ type: 'err', text: e.message }) }
    finally { setInvSaving(false) }
  }

  const submitCreate = async () => {
    if (!cpf.name.trim()) { setCpfMsg({ type: 'err', text: 'Name is required.' }); return }
    setCpfSaving(true); setCpfMsg(null)
    try {
      await createPendingFighter({
        name: cpf.name.trim(), sport: cpf.sport, weight_class: cpf.weight_class || null,
        record_wins: Number(cpf.record_wins), record_losses: Number(cpf.record_losses), record_draws: Number(cpf.record_draws),
        base_city: cpf.base_city || null, notes: cpf.notes || null,
      })
      setCpfMsg({ type: 'ok', text: 'Draft profile created — manager-only. Invite by email when ready.' })
      setCpf({ name: '', sport: 'mma', weight_class: '', record_wins: '0', record_losses: '0', record_draws: '0', base_city: '', notes: '' })
      load()
    } catch (e: any) { setCpfMsg({ type: 'err', text: e.message }) }
    finally { setCpfSaving(false) }
  }

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} retry={load} />

  // A manager-only draft profile: pending, no linked fighter, no email yet.
  // (Recognise the new 'draft_profile' source and legacy 'manual_create' rows.)
  const isDraft = (c: RosterEntry) =>
    c.status === 'pending' && !c.fighter_id && !c.invited_email &&
    (c.source === 'draft_profile' || c.source === 'manual_create')

  const active   = roster.filter(c => c.status === 'active')
  const drafts   = roster.filter(isDraft)
  const pending  = roster.filter(c => c.status === 'pending' && !isDraft(c))
  const declined = roster.filter(c => c.status === 'declined')
  const other    = roster.filter(c => !['active', 'pending', 'declined'].includes(c.status))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionHeading>Roster Management ({active.length} active)</SectionHeading>
        <div className="flex gap-2">
          <button onClick={() => { setShowInvite(v => !v); setShowCreate(false) }}
            className="btn-ghost text-[11px] py-2 px-4">{showInvite ? 'Cancel' : '+ Invite Fighter'}</button>
          <button onClick={() => { setShowCreate(v => !v); setShowInvite(false) }}
            className="btn-ghost text-[11px] py-2 px-4">{showCreate ? 'Cancel' : '+ Create Pending Profile'}</button>
        </div>
      </div>
      <Msg msg={msg} />

      {showInvite && (
        <div className="dash-card space-y-3" style={{ borderLeft: '2px solid #8b0000' }}>
          <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3">Invite Fighter by Email</div>
          <p className="font-condensed text-[11px] text-gray-3">Sends an invite to a real fighter. Existing platform fighters get an in-app notification; new emails get an account invite. Active only after they accept.</p>
          <div className="grid grid-cols-2 gap-3">
            <MI label="Fighter Email" value={invite.email} onChange={v => setInvite(p => ({ ...p, email: v }))} placeholder="fighter@email.com" required />
            <MI label="Name (optional)" value={invite.name} onChange={v => setInvite(p => ({ ...p, name: v }))} placeholder="Fighter name" />
          </div>
          <div>
            <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1">Message (optional)</label>
            <textarea value={invite.message} onChange={e => setInvite(p => ({ ...p, message: e.target.value }))} rows={2}
              placeholder="Add a personal note…"
              className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none resize-none" />
          </div>
          <Msg msg={invMsg} />
          <button onClick={submitInvite} disabled={invSaving} className="btn-primary text-[11px] py-2 disabled:opacity-50">
            {invSaving ? <><Spinner /> Sending…</> : 'Send Invite'}
          </button>
        </div>
      )}

      {showCreate && (
        <div className="dash-card space-y-3" style={{ borderLeft: '2px solid #8b0000' }}>
          <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3">Create Pending Profile</div>
          <p className="font-condensed text-[11px] text-gray-3">Manager-only tracking — no email is sent and no account is created. You can invite this profile by email later.</p>
          <div className="grid grid-cols-2 gap-3">
            <MI label="Name" value={cpf.name} onChange={v => setCpf(p => ({ ...p, name: v }))} required placeholder="Full name" />
            <div>
              <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1">Sport</label>
              <select value={cpf.sport} onChange={e => setCpf(p => ({ ...p, sport: e.target.value }))}
                className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none">
                {['mma', 'boxing', 'bjj', 'muay_thai', 'wrestling', 'other'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <MI label="Weight Class" value={cpf.weight_class} onChange={v => setCpf(p => ({ ...p, weight_class: v }))} placeholder="e.g. Lightweight" />
            <MI label="City / Base"  value={cpf.base_city}    onChange={v => setCpf(p => ({ ...p, base_city: v }))}    placeholder="e.g. Las Vegas" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MI label="Wins"   type="number" value={cpf.record_wins}   onChange={v => setCpf(p => ({ ...p, record_wins: v }))} />
            <MI label="Losses" type="number" value={cpf.record_losses} onChange={v => setCpf(p => ({ ...p, record_losses: v }))} />
            <MI label="Draws"  type="number" value={cpf.record_draws}  onChange={v => setCpf(p => ({ ...p, record_draws: v }))} />
          </div>
          <div>
            <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1">Notes</label>
            <textarea value={cpf.notes} onChange={e => setCpf(p => ({ ...p, notes: e.target.value }))} rows={2}
              placeholder="Internal notes…"
              className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none resize-none" />
          </div>
          <Msg msg={cpfMsg} />
          <button onClick={submitCreate} disabled={cpfSaving} className="btn-primary text-[11px] py-2 disabled:opacity-50">
            {cpfSaving ? <><Spinner /> Creating…</> : 'Create Pending Profile'}
          </button>
        </div>
      )}

      {!roster.length && <EmptyState icon="■" title="No Fighters Connected Yet" body="Invite a fighter by email or create a pending fighter profile." />}

      {active.length > 0 && (
        <div className="space-y-2">
          <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3">Active Roster</div>
          {active.map(conn => {
            const f = conn.fighter!
            const col = f.readiness >= 80 ? '#00c060' : f.readiness >= 60 ? '#c9a82c' : '#c00000'
            const isExpanded = expandId === conn.id
            return (
              <div key={conn.id} className="dash-card" style={{ borderLeft: `2px solid ${col}` }}>
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-condensed font-bold text-off-white" style={{ fontSize: 14 }}>{f.name}</span>
                      <StatusBadge status={conn.status} />
                      {f.division && <span className="font-condensed text-[10px] text-gray-3">{f.division}</span>}
                    </div>
                    <div className="font-condensed text-[11px] text-gray-3">
                      {f.record_wins}-{f.record_losses}{f.record_draws > 0 ? `-${f.record_draws}` : ''}
                      {f.weight_class ? ` · ${f.weight_class}` : ''}
                      {f.base_city    ? ` · ${f.base_city}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-center">
                      <ReadinessRing pct={f.readiness} size={44} color={col} />
                      <div className="font-condensed text-[9px] text-gray-3 mt-0.5">Ready</div>
                    </div>
                    <button onClick={() => expand(conn.id, conn.fighter_id)}
                      className="font-condensed font-bold uppercase text-[9px] tracking-[0.15em] px-2.5 py-1.5 border border-charcoal-3 text-gray-2 cursor-pointer hover:border-blood hover:text-off-white transition-all">
                      {isExpanded ? 'Close' : 'View / Edit'}
                    </button>
                    <button onClick={() => changeStatus(conn.id, 'removed')} disabled={actingId === conn.id}
                      className="font-condensed font-bold uppercase text-[9px] tracking-[0.15em] px-2.5 py-1.5 border border-charcoal-3 text-gray-3 cursor-pointer hover:border-blood hover:text-blood-glow transition-all disabled:opacity-40">
                      {actingId === conn.id ? <Spinner /> : 'Remove'}
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-charcoal-3">
                    {detailLoading ? <div className="dash-sub">Loading…</div> : (
                      <>
                        {detail && (
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            {([['Email', detail.email], ['Gym', detail.gym_name || '—'], ['Coach', detail.coach_name || '—'], ['Promotion', detail.current_promotion || '—']] as [string, string][]).map(([k, v]) => (
                              <div key={k} className="flex justify-between text-[11px] py-1 border-b border-charcoal-3">
                                <span className="font-condensed text-gray-3">{k}</span>
                                <span className="font-condensed text-gray-1">{v}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {editId === conn.id ? (
                          <EditFighterPanel
                            fighter={detail ?? f}
                            onSave={data => updateFighterProfile(conn.fighter_id!, data).then(() => {
                              setEditId(null)
                              getFighterDetail(conn.fighter_id!).then(setDetail)
                              load()
                            })}
                            onCancel={() => setEditId(null)} />
                        ) : (
                          <button onClick={() => setEditId(conn.id)}
                            className="font-condensed font-bold uppercase text-[10px] tracking-[0.15em] px-3 py-1.5 border border-charcoal-3 text-gray-2 cursor-pointer hover:border-blood hover:text-off-white transition-all">
                            Edit Allowed Fields
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-2">
          <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3">Pending Connections</div>
          {pending.map(conn => {
            const isRequest    = conn.source === 'fighter_request'
            const onPlatform   = !!conn.fighter_id          // existing platform fighter
            const emailFailed  = !isRequest && !onPlatform && conn.invite_email_status === 'failed'
            const displayName  = rosterDisplayName(conn)
            const displayEmail = conn.fighter?.email ?? conn.invited_email ?? null
            // Truthful status: in-app invites say "pending acceptance"; email
            // invites reflect the REAL delivery state from the outbox dispatcher.
            const emailLine =
              conn.invite_email_status === 'sent'   ? 'Email sent — awaiting registration'
            : conn.invite_email_status === 'failed' ? 'Email failed — retry'
            :                                         'Invite queued'
            const statusLine = isRequest
              ? 'Requested to join your roster'
              : onPlatform
                ? 'Pending fighter acceptance'
                : emailLine
            // Badge mirrors the same truth.
            const [badgeCls, badgeText] = isRequest || onPlatform
              ? ['badge-yellow', 'Pending']
              : conn.invite_email_status === 'sent'   ? ['badge-green',  'Email Sent']
              : conn.invite_email_status === 'failed' ? ['badge-red',    'Email Failed']
              :                                         ['badge-yellow', 'Queued']
            return (
              <div key={conn.id} className="dash-card" style={{ borderLeft: `2px solid ${emailFailed ? '#8b0000' : '#c9a82c'}` }}>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-condensed font-bold text-off-white" style={{ fontSize: 13 }}>{displayName}</span>
                      <span className={`badge ${badgeCls}`}>{badgeText}</span>
                    </div>
                    {displayEmail && <div className="font-condensed text-[11px] text-gray-3">{displayEmail}</div>}
                    <div className="font-condensed text-[10px] text-gray-3 mt-0.5">
                      {statusLine}{conn.created_at ? ` · ${new Date(conn.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                    </div>
                    {conn.request_message && <div className="font-condensed text-[11px] text-gray-2 italic mt-0.5">"{conn.request_message}"</div>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {isRequest ? (
                      <>
                        <button onClick={() => changeStatus(conn.id, 'active')} disabled={actingId === conn.id}
                          className="font-condensed font-bold uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border cursor-pointer transition-all disabled:opacity-40"
                          style={{ borderColor: '#2a5c2a', color: '#00c060' }}>
                          {actingId === conn.id ? <Spinner /> : 'Accept'}
                        </button>
                        <button onClick={() => changeStatus(conn.id, 'declined')} disabled={actingId === conn.id}
                          className="font-condensed font-bold uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border cursor-pointer transition-all disabled:opacity-40"
                          style={{ borderColor: '#4a0000', color: '#c00000' }}>
                          {actingId === conn.id ? <Spinner /> : 'Decline'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => resend(conn.id)} disabled={actingId === conn.id}
                          className="font-condensed font-bold uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border cursor-pointer transition-all disabled:opacity-40"
                          style={emailFailed
                            ? { borderColor: '#2a5c2a', color: '#00c060' }
                            : { borderColor: '#3a3a40', color: '#b8b4ae' }}>
                          {actingId === conn.id ? <Spinner /> : emailFailed ? 'Retry' : 'Resend'}
                        </button>
                        <button onClick={() => changeStatus(conn.id, 'removed')} disabled={actingId === conn.id}
                          className="font-condensed font-bold uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border border-charcoal-3 text-gray-3 cursor-pointer hover:border-blood hover:text-blood-glow transition-all disabled:opacity-40">
                          {actingId === conn.id ? <Spinner /> : 'Cancel'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {drafts.length > 0 && (
        <div className="space-y-2">
          <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3">Pending Profiles / Draft Profiles</div>
          {drafts.map(conn => <DraftProfileCard key={conn.id} conn={conn} onChanged={load} />)}
        </div>
      )}

      {declined.length > 0 && (
        <div className="space-y-2">
          <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3">Declined Invites</div>
          {declined.map(conn => (
            <div key={conn.id} className="dash-card" style={{ borderLeft: '2px solid #8b0000' }}>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-condensed font-bold text-gray-1" style={{ fontSize: 13 }}>{rosterDisplayName(conn)}</span>
                    <span className="badge badge-red">Declined</span>
                  </div>
                  {(conn.fighter?.email ?? conn.invited_email) && (
                    <div className="font-condensed text-[11px] text-gray-3">{conn.fighter?.email ?? conn.invited_email}</div>
                  )}
                  <div className="font-condensed text-[10px] text-gray-3 mt-0.5">
                    Invite declined{conn.declined_at ? ` · ${new Date(conn.declined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                  </div>
                </div>
                {/* Fighter requests are not resendable — only manager-initiated invites. */}
                {conn.source !== 'fighter_request' && (
                  <button onClick={() => resend(conn.id)} disabled={actingId === conn.id}
                    className="font-condensed font-bold uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border cursor-pointer transition-all disabled:opacity-40"
                    style={{ borderColor: '#2a5c2a', color: '#00c060' }}>
                    {actingId === conn.id ? <Spinner /> : 'Resend Invite'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {other.length > 0 && (
        <div className="space-y-2">
          <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3">History</div>
          {other.map(conn => (
            <div key={conn.id} className="dash-card opacity-60" style={{ borderLeft: '2px solid #222226' }}>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <span className="font-condensed text-[12px] text-gray-2">{rosterDisplayName(conn)}</span>
                </div>
                <StatusBadge status={conn.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Best display name for a roster row — never shows "Unknown" when an email exists.
function rosterDisplayName(conn: RosterEntry): string {
  return conn.fighter?.name
    ?? conn.invited_name
    ?? (conn.pending_fighter_data?.name as string | undefined)
    ?? conn.invited_email
    ?? 'Invited Fighter'
}

// ── Fighter Ops zone (Applications + SponsorForge) ────────────────────────────
function FighterOpsZone() {
  const { data: appsData,  loading: appsLoad,  error: appsErr  } = useApi<any>('/api/manager/applications')
  const { data: sfData,    loading: sfLoad                       } = useApi<any>('/api/manager/sponsorforge')

  if (appsLoad || sfLoad) return <DashSkeleton />
  if (appsErr)            return <ApiError message={appsErr} />

  const apps    = appsData?.applications ?? []
  const fighters = sfData?.fighters     ?? []

  return (
    <div className="space-y-4">
      {/* Applications */}
      <div className="space-y-2">
        <SectionHeading>Fighter Applications ({apps.length})</SectionHeading>
        {apps.length === 0 ? (
          <EmptyState icon="◈" title="No Applications Yet" body="Applications for your roster fighters appear here once they apply to sponsorship opportunities." />
        ) : (
          apps.map((app: any) => (
            <div key={app.id} className="dash-card flex items-center gap-4"
              style={{ borderLeft: `2px solid ${APP_STATUS_COLOR[app.status] ?? '#222226'}` }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-0.5">
                  <span className="font-condensed font-bold text-off-white text-[13px]">{app.fighter?.name ?? '—'}</span>
                  <span className="font-condensed text-[9px] uppercase tracking-[0.15em]" style={{ color: APP_STATUS_COLOR[app.status] }}>
                    {APP_STATUS_LABEL[app.status] ?? app.status}
                  </span>
                </div>
                <div className="font-condensed text-[11px] text-gray-3">
                  {app.opportunity?.title ?? '—'}
                  {app.sponsor_detail?.company_name ? ` · ${app.sponsor_detail.company_name}` : ''}
                </div>
              </div>
              <div className="font-condensed text-[10px] text-gray-3 flex-shrink-0">
                {new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              {app.match_score != null && (
                <div className="font-condensed text-[11px] text-blood-glow flex-shrink-0">{app.match_score}% match</div>
              )}
            </div>
          ))
        )}
      </div>

      {/* SponsorForge eligibility */}
      {fighters.length > 0 && (
        <div className="space-y-3">
          <SectionHeading>SponsorForge Eligibility</SectionHeading>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(fighters.length, 5)}, 1fr)` }}>
            {fighters.map((f: any) => {
              const color = f.type === 'green' ? '#00c060' : f.type === 'yellow' ? '#c9a82c' : '#c00000'
              return (
                <div key={f.name} className="dash-card text-center" style={{ borderTop: `2px solid ${color}` }}>
                  <div className="font-condensed text-[11px] font-bold text-off-white mb-3">{f.name.split(' ')[0]}</div>
                  <ReadinessRing pct={f.pct} size={72} color={color} label="Eligib." />
                  <div className={`badge mt-3 badge-${f.type}`}>{f.status}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Education zone ────────────────────────────────────────────────────────────
function EducationZone() {
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    getManagerModuleProgress()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const modules  = data?.modules  ?? []
  const fighters = data?.fighters ?? []
  const summary  = data?.summary  ?? { total_modules: 0, avg_completion: 0 }

  if (!fighters.length) return (
    <EmptyState icon="■" title="No Active Roster" body="Add fighters to your roster to track module progress." />
  )
  if (!modules.length) return (
    <EmptyState icon="■" title="No Modules Published" body="Education modules will appear here once published by admin." />
  )

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <SectionHeading>Roster Education Progress</SectionHeading>
        <div className="font-condensed text-[11px] text-gray-3">Avg {summary.avg_completion}% · {summary.total_modules} modules</div>
      </div>
      <div>
        <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 mb-2">Fighter Progress</div>
        <div className="space-y-2">
          {fighters.map((f: any) => (
            <div key={f.fighter_id} className="dash-card" style={{ borderLeft: '2px solid #222226' }}>
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-condensed font-bold text-[13px] text-off-white">{f.name}</div>
                  <div className="font-condensed text-[11px] text-gray-3">{f.completed} / {f.total} completed</div>
                </div>
                <div className="font-display text-off-white shrink-0" style={{ fontSize: 20 }}>{f.avg_pct}%</div>
              </div>
              <div className="dash-bar-track mt-2" style={{ height: 3 }}>
                <div className="dash-bar-fill" style={{ width: `${f.avg_pct}%`, height: '100%',
                  background: f.avg_pct === 100 ? '#00c060' : 'linear-gradient(90deg,#8b0000,#c00000)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 mb-2">Module Completion Rates</div>
        <div className="dash-card p-0 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-charcoal-3">
                {['Module', 'Type', 'Req', 'Roster %'].map(h => (
                  <th key={h} className="font-condensed text-[9px] font-bold uppercase tracking-[0.2em] text-gray-3 px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((m: any) => (
                <tr key={m.id} className="border-b border-charcoal-3 last:border-0">
                  <td className="font-condensed text-[12px] text-off-white px-4 py-2">{m.name}</td>
                  <td className="font-condensed text-[10px] text-gray-2 px-4 py-2 capitalize">{(m.module_type || 'lesson').replace('_', ' ')}</td>
                  <td className="font-condensed text-[10px] px-4 py-2" style={{ color: m.is_required ? '#C41E3A' : '#4a4846' }}>
                    {m.is_required ? '✓' : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="dash-bar-track flex-1" style={{ height: 3, minWidth: 60 }}>
                        <div className="dash-bar-fill" style={{ width: `${m.roster_completion_rate}%`, height: '100%',
                          background: m.roster_completion_rate === 100 ? '#00c060' : '#8b0000' }} />
                      </div>
                      <span className="font-condensed text-[11px] text-gray-2 shrink-0">{m.roster_completion_rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Contracts & Obligations zone ──────────────────────────────────────────────
function ContractsZone() {
  const [contracts, setContracts] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const { data: oblData, loading: oblLoading } = useApi<any>('/api/manager/obligations')

  const load = useCallback(() => {
    setLoading(true); setError('')
    getManagerContracts()
      .then(r => { setContracts(r.contracts ?? []); setLoading(false) })
      .catch(e => { setError(e.message ?? 'Failed to load contracts.'); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  if (loading || oblLoading) return <DashSkeleton />
  if (error)                 return <ApiError message={error} retry={load} />

  const active    = contracts.filter(c => c.status === 'active').length
  const pending   = contracts.filter(c => c.status === 'pending_fighter').length
  const overdue   = contracts.reduce((s: number, c: any) => s + Math.max(0, c.obligations_total - c.obligations_completed), 0)

  const overdueItems  = oblData?.overdue    ?? []
  const thisWeekItems = oblData?.this_week  ?? []
  const rate          = oblData?.rate       ?? 100
  const fulfillChart  = oblData?.fulfillment_chart ?? []

  return (
    <div className="space-y-4">
      {/* Contracts */}
      <SectionHeading>Roster Contracts ({contracts.length})</SectionHeading>
      {contracts.length > 0 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <StatCard label="Active Contracts"   value={String(active)}  sub="Live deals"        barPct={contracts.length > 0 ? Math.round(active / contracts.length * 100) : 0} />
          <StatCard label="Awaiting Signature" value={String(pending)} sub="Fighter to sign"   barPct={pending > 0 ? 30 : 0} barColor="#c9a82c" />
          <StatCard label="Open Obligations"   value={String(overdue)} sub="Across fighters"   barPct={overdue > 0 ? 25 : 0} barColor={overdue > 0 ? '#c00000' : '#00c060'} />
        </div>
      )}
      {contracts.length === 0 ? (
        <EmptyState icon="■" title="No Contracts Yet" body="Contracts for active roster fighters appear here once sponsors accept applications." />
      ) : (
        <div className="space-y-2">
          {contracts.map((c: any) => {
            const oblPct = c.obligations_total > 0 ? Math.round(c.obligations_completed / c.obligations_total * 100) : 0
            return (
              <Link key={c.id} to={`/contracts/${c.id}`}
                className="dash-card flex items-center gap-4 no-underline block"
                style={{ borderLeft: `2px solid ${MC_COLOR[c.status] ?? '#222226'}` }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-condensed text-[9px] font-bold uppercase tracking-widest px-2 py-0.5"
                      style={{ background: MC_COLOR[c.status] ?? '#374151', color: '#f0ece4' }}>
                      {MC_LABEL[c.status] ?? c.status}
                    </span>
                    {c.fighter && <span className="font-condensed font-bold text-off-white text-[12px]">{c.fighter.name}</span>}
                  </div>
                  <div className="font-condensed text-[12px] text-gray-2">${c.value_usd?.toLocaleString()} · {c.payment_schedule}</div>
                  {c.obligations_total > 0 && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <div style={{ flex: 1, height: 3, background: '#222226', borderRadius: 2 }}>
                        <div style={{ width: `${oblPct}%`, height: '100%', background: oblPct === 100 ? '#00c060' : '#8b0000', borderRadius: 2 }} />
                      </div>
                      <span className="font-condensed text-[10px] text-gray-3">{c.obligations_completed}/{c.obligations_total} done</span>
                    </div>
                  )}
                </div>
                <span className="font-condensed text-[11px] text-gray-3 flex-shrink-0">View →</span>
              </Link>
            )
          })}
        </div>
      )}

      {/* Obligations */}
      {(overdueItems.length > 0 || thisWeekItems.length > 0) && (
        <>
          <SectionHeading>Obligations</SectionHeading>
          <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 160px' }}>
            {overdueItems.length
              ? <ListCard label="Overdue" items={overdueItems} />
              : <EmptyState title="No Overdue Items" body="All obligations on track." />}
            {thisWeekItems.length
              ? <ListCard label="Due This Week" items={thisWeekItems} />
              : <EmptyState title="Nothing Due This Week" body="No obligations due in the next 7 days." />}
            <div className="dash-card text-center">
              <div className="dash-label">Rate</div>
              <ReadinessRing pct={rate} size={75} color="#c9a82c" label="%" />
              <div className="dash-sub mt-1">Fulfillment</div>
            </div>
          </div>
          {fulfillChart.length > 0 && (
            <div className="dash-card">
              <div className="dash-label mb-3">Fulfillment by Fighter</div>
              <BarChart height={80} data={fulfillChart} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Default export — shell + zone routing ─────────────────────────────────────
export default function ManagerDashboard() {
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
              MGMT-SUITE
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
        {zone === 'command'     && <ManagerCommandCenter onNavigate={setZone} />}
        {zone === 'roster'      && <RosterZone />}
        {zone === 'fighter-ops' && <FighterOpsZone />}
        {zone === 'education'   && <EducationZone />}
        {zone === 'events'      && <ManagerEventsZone />}
        {zone === 'contracts'   && <ContractsZone />}
      </main>
    </div>
  )
}
