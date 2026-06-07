import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DashShell from './DashShell'
import { StatCard, ListCard, ReadinessRing, BarChart, SparkLine,
         SectionHeading, FullWidthCard, StackedBar,
         DashSkeleton, EmptyState, ApiError } from './DashWidgets'
import { useApi } from '../../hooks/useApi'
import {
  getManagerRoster, inviteFighter, createPendingFighter,
  updateConnectionStatus, getFighterDetail, updateFighterProfile,
  getManagerContracts, type RosterEntry,
} from '../../lib/api/manager'
import { getBillingPackages, getBillingStatus, startCheckout, type BillingPackage, type BillingMembership } from '../../lib/api/billing'

// ── Tiny local primitives ─────────────────────────────────────────────────────
function MI({ label, value, onChange, type='text', placeholder, required=false }: {
  label: string; value: string|number; onChange:(v:string)=>void
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
function Msg({ msg }: { msg: {type:'ok'|'err';text:string}|null }) {
  if (!msg) return null
  return <p className={`font-condensed text-[11px] ${msg.type==='ok'?'text-green-400':'text-blood-glow'}`}>{msg.text}</p>
}

const NAV = [
  { id: 'overview',     label: 'Overview',      icon: '◈' },
  { id: 'roster',       label: 'Roster',        icon: '👥' },
  { id: 'applications', label: 'Applications',  icon: '🤝' },
  { id: 'contracts',    label: 'Contracts',     icon: '📄' },
  { id: 'obligations',  label: 'Obligations',   icon: '📋' },
  { id: 'sponsorforge', label: 'SponsorForge',  icon: '⚡' },
  { id: 'playbooks',    label: 'Playbooks',     icon: '📖' },
  { id: 'budget',       label: 'Budget & Camp', icon: '💰' },
  { id: 'reports',      label: 'Reports',       icon: '📊' },
  { id: 'billing',      label: 'Billing',       icon: '💳' },
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

// ── Status badge helper ───────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string,[string,string]> = {
    active:   ['Active',   'badge-green'],
    pending:  ['Pending',  'badge-yellow'],
    declined: ['Declined', 'badge-red'],
    removed:  ['Removed',  'badge-red'],
  }
  const [label, cls] = map[status] ?? [status, 'badge-yellow']
  return <span className={`badge ${cls}`}>{label}</span>
}

// ── Fighter edit form ─────────────────────────────────────────────────────────
function EditFighterPanel({ fighter, onSave, onCancel }: {
  fighter: any; onSave: (data: any) => Promise<void>; onCancel: () => void
}) {
  const [form, setForm] = useState({
    division:      fighter.division      ?? '',
    weight_class:  fighter.weight_class  ?? '',
    record_wins:   String(fighter.record_wins  ?? 0),
    record_losses: String(fighter.record_losses ?? 0),
    record_draws:  String(fighter.record_draws  ?? 0),
    base_city:     fighter.base_city     ?? '',
    gym_name:      fighter.gym_name      ?? '',
    coach_name:    fighter.coach_name    ?? '',
    current_promotion: fighter.current_promotion ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{type:'ok'|'err';text:string}|null>(null)
  const set = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      await onSave({
        division:      form.division      || null,
        weight_class:  form.weight_class  || null,
        record_wins:   Number(form.record_wins),
        record_losses: Number(form.record_losses),
        record_draws:  Number(form.record_draws),
        base_city:     form.base_city     || null,
        gym_name:      form.gym_name      || null,
        coach_name:    form.coach_name    || null,
        current_promotion: form.current_promotion || null,
      })
      setMsg({ type: 'ok', text: 'Saved.' })
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message ?? 'Save failed.' })
    } finally { setSaving(false) }
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
        <MI label="City / Base"    value={form.base_city}   onChange={set('base_city')}   placeholder="e.g. Las Vegas" />
        <MI label="Gym"            value={form.gym_name}    onChange={set('gym_name')}    placeholder="e.g. AKA" />
        <MI label="Coach"          value={form.coach_name}  onChange={set('coach_name')}  placeholder="Coach name" />
        <MI label="Promotion"      value={form.current_promotion} onChange={set('current_promotion')} placeholder="e.g. UFC" />
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

// ── Main Roster component ─────────────────────────────────────────────────────
function Roster() {
  const [roster,    setRoster]    = useState<RosterEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string|null>(null)
  const [showInvite,setShowInvite]= useState(false)
  const [showCreate,setShowCreate]= useState(false)
  const [expandId,  setExpandId]  = useState<string|null>(null)
  const [editId,    setEditId]    = useState<string|null>(null)
  const [detail,    setDetail]    = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actingId,  setActingId]  = useState<string|null>(null)
  const [msg,       setMsg]       = useState<{type:'ok'|'err';text:string}|null>(null)

  // Invite form
  const [invite, setInvite] = useState({ email:'', name:'', message:'' })
  const [invSaving, setInvSaving] = useState(false)
  const [invMsg, setInvMsg] = useState<{type:'ok'|'err';text:string}|null>(null)

  // Create pending form
  const [cpf, setCpf] = useState({ name:'', sport:'mma', weight_class:'', record_wins:'0', record_losses:'0', record_draws:'0', base_city:'', notes:'' })
  const [cpfSaving, setCpfSaving] = useState(false)
  const [cpfMsg, setCpfMsg] = useState<{type:'ok'|'err';text:string}|null>(null)

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

  const changeStatus = async (id: string, status: 'active'|'declined'|'removed') => {
    setActingId(id); setMsg(null)
    try {
      await updateConnectionStatus(id, status)
      setMsg({ type:'ok', text:`Connection ${status}.` })
      load()
    } catch (e: any) {
      setMsg({ type:'err', text: e.message })
    } finally { setActingId(null) }
  }

  const submitInvite = async () => {
    if (!invite.email.trim()) { setInvMsg({ type:'err', text:'Email is required.' }); return }
    setInvSaving(true); setInvMsg(null)
    try {
      const r = await inviteFighter({ email: invite.email.trim(), name: invite.name || null, message: invite.message || null })
      setInvMsg({ type:'ok', text: r.matched ? 'Invite sent to existing fighter.' : 'Invite queued — email not yet registered.' })
      setInvite({ email:'', name:'', message:'' })
      load()
    } catch (e: any) {
      setInvMsg({ type:'err', text: e.message })
    } finally { setInvSaving(false) }
  }

  const submitCreate = async () => {
    if (!cpf.name.trim()) { setCpfMsg({ type:'err', text:'Name is required.' }); return }
    setCpfSaving(true); setCpfMsg(null)
    try {
      await createPendingFighter({
        name: cpf.name.trim(), sport: cpf.sport,
        weight_class: cpf.weight_class || null,
        record_wins: Number(cpf.record_wins), record_losses: Number(cpf.record_losses), record_draws: Number(cpf.record_draws),
        base_city: cpf.base_city || null, notes: cpf.notes || null,
      })
      setCpfMsg({ type:'ok', text:'Pending fighter profile created.' })
      setCpf({ name:'', sport:'mma', weight_class:'', record_wins:'0', record_losses:'0', record_draws:'0', base_city:'', notes:'' })
      load()
    } catch (e: any) {
      setCpfMsg({ type:'err', text: e.message })
    } finally { setCpfSaving(false) }
  }

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} retry={load} />

  const active  = roster.filter(c => c.status === 'active')
  const pending = roster.filter(c => c.status === 'pending')
  const other   = roster.filter(c => !['active','pending'].includes(c.status))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionHeading>Roster Management ({active.length} active)</SectionHeading>
        <div className="flex gap-2">
          <button onClick={() => { setShowInvite(v=>!v); setShowCreate(false) }}
            className="btn-ghost text-[11px] py-2 px-4">{showInvite ? 'Cancel' : '+ Invite Fighter'}</button>
          <button onClick={() => { setShowCreate(v=>!v); setShowInvite(false) }}
            className="btn-ghost text-[11px] py-2 px-4">{showCreate ? 'Cancel' : '+ Create Pending'}</button>
        </div>
      </div>

      <Msg msg={msg} />

      {/* Invite form */}
      {showInvite && (
        <div className="dash-card space-y-3" style={{ borderLeft:'2px solid #8b0000' }}>
          <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3">Invite Fighter by Email</div>
          <div className="grid grid-cols-2 gap-3">
            <MI label="Fighter Email" value={invite.email} onChange={v=>setInvite(p=>({...p,email:v}))} placeholder="fighter@email.com" required />
            <MI label="Name (optional)" value={invite.name} onChange={v=>setInvite(p=>({...p,name:v}))} placeholder="Fighter name" />
          </div>
          <div>
            <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1">Message (optional)</label>
            <textarea value={invite.message} onChange={e=>setInvite(p=>({...p,message:e.target.value}))} rows={2}
              placeholder="Add a personal note…"
              className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none resize-none" />
          </div>
          <Msg msg={invMsg} />
          <button onClick={submitInvite} disabled={invSaving} className="btn-primary text-[11px] py-2 disabled:opacity-50">
            {invSaving ? <><Spinner /> Sending…</> : 'Send Invite'}
          </button>
        </div>
      )}

      {/* Create pending form */}
      {showCreate && (
        <div className="dash-card space-y-3" style={{ borderLeft:'2px solid #8b0000' }}>
          <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3">Create Pending Fighter Profile</div>
          <div className="grid grid-cols-2 gap-3">
            <MI label="Name" value={cpf.name} onChange={v=>setCpf(p=>({...p,name:v}))} required placeholder="Full name" />
            <div>
              <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1">Sport</label>
              <select value={cpf.sport} onChange={e=>setCpf(p=>({...p,sport:e.target.value}))}
                className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none">
                {['mma','boxing','bjj','muay_thai','wrestling','other'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <MI label="Weight Class" value={cpf.weight_class} onChange={v=>setCpf(p=>({...p,weight_class:v}))} placeholder="e.g. Lightweight" />
            <MI label="City / Base"  value={cpf.base_city}    onChange={v=>setCpf(p=>({...p,base_city:v}))}    placeholder="e.g. Las Vegas" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MI label="Wins"   type="number" value={cpf.record_wins}   onChange={v=>setCpf(p=>({...p,record_wins:v}))} />
            <MI label="Losses" type="number" value={cpf.record_losses} onChange={v=>setCpf(p=>({...p,record_losses:v}))} />
            <MI label="Draws"  type="number" value={cpf.record_draws}  onChange={v=>setCpf(p=>({...p,record_draws:v}))} />
          </div>
          <div>
            <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1">Notes</label>
            <textarea value={cpf.notes} onChange={e=>setCpf(p=>({...p,notes:e.target.value}))} rows={2}
              placeholder="Internal notes about this fighter…"
              className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none resize-none" />
          </div>
          <Msg msg={cpfMsg} />
          <button onClick={submitCreate} disabled={cpfSaving} className="btn-primary text-[11px] py-2 disabled:opacity-50">
            {cpfSaving ? <><Spinner /> Creating…</> : 'Create Pending Profile'}
          </button>
        </div>
      )}

      {/* Empty state */}
      {!roster.length && (
        <EmptyState icon="👥" title="No Fighters Connected Yet"
          body="Invite a fighter by email or create a pending fighter profile to build your roster." />
      )}

      {/* Active fighters */}
      {active.length > 0 && (
        <div className="space-y-2">
          <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3">Active Roster</div>
          {active.map(conn => {
            const f   = conn.fighter!
            const col = f.readiness >= 80 ? '#00c060' : f.readiness >= 60 ? '#c9a82c' : '#c00000'
            const isExpanded = expandId === conn.id
            return (
              <div key={conn.id} className="dash-card" style={{ borderLeft:`2px solid ${col}` }}>
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-condensed font-bold text-off-white" style={{ fontSize:14 }}>{f.name}</span>
                      <StatusBadge status={conn.status} />
                      {f.division && <span className="font-condensed text-[10px] text-gray-3">{f.division}</span>}
                    </div>
                    <div className="font-condensed text-[11px] text-gray-3">
                      {f.record_wins}-{f.record_losses}{f.record_draws > 0 ? `-${f.record_draws}` : ''}
                      {f.weight_class ? ` · ${f.weight_class}` : ''}
                      {f.base_city    ? ` · ${f.base_city}`    : ''}
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

                {/* Expanded detail + edit */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-charcoal-3">
                    {detailLoading ? <div className="dash-sub">Loading…</div> : (
                      <>
                        {detail && (
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            {[['Email', detail.email], ['Gym', detail.gym_name||'—'], ['Coach', detail.coach_name||'—'], ['Promotion', detail.current_promotion||'—']].map(([k,v]) => (
                              <div key={k} className="flex justify-between text-[11px] py-1 border-b border-charcoal-3">
                                <span className="font-condensed text-gray-3">{k}</span>
                                <span className="font-condensed text-gray-1">{v as string}</span>
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

      {/* Pending connections */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3">Pending Connections</div>
          {pending.map(conn => {
            const isRequest = conn.requested_by && conn.requested_by !== conn.fighter_id ? false : conn.source === 'fighter_request'
            const displayName = conn.fighter?.name ?? conn.invited_name ?? conn.pending_fighter_data?.name ?? 'Unknown Fighter'
            const displayEmail = conn.fighter?.email ?? conn.invited_email ?? null
            const displayData = conn.pending_fighter_data
            return (
              <div key={conn.id} className="dash-card" style={{ borderLeft:'2px solid #c9a82c' }}>
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-condensed font-bold text-off-white" style={{ fontSize:13 }}>{displayName}</span>
                      <StatusBadge status={conn.status} />
                      <span className="font-condensed text-[9px] text-gray-3 capitalize">{conn.source.replace(/_/g,' ')}</span>
                    </div>
                    {displayEmail && <div className="font-condensed text-[11px] text-gray-3">{displayEmail}</div>}
                    {conn.source === 'manual_create' && displayData?.weight_class && (
                      <div className="font-condensed text-[11px] text-gray-3">{displayData.weight_class} · {displayData.record_wins||0}-{displayData.record_losses||0}</div>
                    )}
                    {conn.request_message && (
                      <div className="font-condensed text-[11px] text-gray-2 italic mt-0.5">"{conn.request_message}"</div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {/* Show Accept/Decline for fighter-requested rows */}
                    {conn.source === 'fighter_request' && (
                      <>
                        <button onClick={() => changeStatus(conn.id, 'active')} disabled={actingId === conn.id}
                          className="font-condensed font-bold uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border cursor-pointer transition-all disabled:opacity-40"
                          style={{ borderColor:'#2a5c2a', color:'#00c060' }}>
                          {actingId === conn.id ? <Spinner /> : 'Accept'}
                        </button>
                        <button onClick={() => changeStatus(conn.id, 'declined')} disabled={actingId === conn.id}
                          className="font-condensed font-bold uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border cursor-pointer transition-all disabled:opacity-40"
                          style={{ borderColor:'#4a0000', color:'#c00000' }}>
                          {actingId === conn.id ? <Spinner /> : 'Decline'}
                        </button>
                      </>
                    )}
                    {/* Manager-invite or manual-create pending: can activate or remove */}
                    {conn.source !== 'fighter_request' && (
                      <button onClick={() => changeStatus(conn.id, 'removed')} disabled={actingId === conn.id}
                        className="font-condensed font-bold uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border border-charcoal-3 text-gray-3 cursor-pointer hover:border-blood hover:text-blood-glow transition-all disabled:opacity-40">
                        {actingId === conn.id ? <Spinner /> : 'Cancel'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Declined connections */}
      {other.length > 0 && (
        <div className="space-y-2">
          <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3">History</div>
          {other.map(conn => (
            <div key={conn.id} className="dash-card opacity-60" style={{ borderLeft:'2px solid #222226' }}>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <span className="font-condensed text-[12px] text-gray-2">
                    {conn.fighter?.name ?? conn.invited_name ?? conn.pending_fighter_data?.name ?? '—'}
                  </span>
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

// ── Applications tab ──────────────────────────────────────────────────────────
const APP_STATUS_COLOR: Record<string,string> = {
  applied: '#7a7672', under_review: '#C41E3A', shortlisted: '#f5a623',
  accepted: '#00c060', rejected: '#4a4846', withdrawn: '#4a4846',
}
const APP_STATUS_LABEL: Record<string,string> = {
  applied: 'Submitted', under_review: 'In Review', shortlisted: 'Shortlisted',
  accepted: 'Accepted', rejected: 'Rejected', withdrawn: 'Withdrawn',
}

function Applications() {
  const { data, loading, error } = useApi<any>('/api/manager/applications')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const apps = data?.applications ?? []

  if (!apps.length) return (
    <div className="space-y-4">
      <SectionHeading>Fighter Applications</SectionHeading>
      <EmptyState icon="🤝" title="No Applications Yet"
        body="Applications for your roster fighters will appear here once they apply to sponsorship opportunities." />
    </div>
  )

  return (
    <div className="space-y-4">
      <SectionHeading>Fighter Applications ({apps.length})</SectionHeading>
      <div className="space-y-2">
        {apps.map((app: any) => (
          <div key={app.id} className="dash-card flex items-center gap-4"
            style={{ borderLeft:`2px solid ${APP_STATUS_COLOR[app.status]??'#222226'}` }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-0.5">
                <span className="font-condensed font-bold text-off-white text-[13px]">
                  {app.fighter?.name ?? '—'}
                </span>
                <span className="font-condensed text-[9px] uppercase tracking-[0.15em]"
                  style={{ color: APP_STATUS_COLOR[app.status] }}>
                  {APP_STATUS_LABEL[app.status] ?? app.status}
                </span>
              </div>
              <div className="font-condensed text-[11px] text-gray-3">
                {app.opportunity?.title ?? '—'}
                {app.sponsor_detail?.company_name ? ` · ${app.sponsor_detail.company_name}` : ''}
              </div>
            </div>
            <div className="font-condensed text-[10px] text-gray-3 flex-shrink-0">
              {new Date(app.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
            </div>
            {app.match_score != null && (
              <div className="font-condensed text-[11px] text-blood-glow flex-shrink-0">{app.match_score}% match</div>
            )}
          </div>
        ))}
      </div>
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

// ── Manager Contracts tab ─────────────────────────────────────────────────────
const MC_COLOR: Record<string, string> = {
  draft:'#4a4846', pending_fighter:'#b45309', active:'#166534',
  in_dispute:'#7f1d1d', completed:'#1e3a5f', terminated:'#374151',
}
const MC_LABEL: Record<string, string> = {
  draft:'Draft', pending_fighter:'Awaiting Fighter', active:'Active',
  in_dispute:'In Dispute', completed:'Completed', terminated:'Terminated',
}

function ManagerContracts() {
  const [contracts, setContracts] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    getManagerContracts()
      .then(r => { setContracts(r.contracts ?? []); setLoading(false) })
      .catch(e => { setError(e.message ?? 'Failed to load contracts.'); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} retry={load} />
  if (!contracts.length) return (
    <div className="space-y-4">
      <SectionHeading>Roster Contracts</SectionHeading>
      <EmptyState icon="📄" title="No Contracts Yet"
        body="Contracts for active roster fighters appear here once sponsors accept applications." />
    </div>
  )

  const active    = contracts.filter(c => c.status === 'active').length
  const pending   = contracts.filter(c => c.status === 'pending_fighter').length
  const overdue   = contracts.reduce((s: number, c: any) => s + Math.max(0, c.obligations_total - c.obligations_completed), 0)

  return (
    <div className="space-y-4">
      <SectionHeading>Roster Contracts ({contracts.length})</SectionHeading>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <StatCard label="Active Contracts"    value={String(active)}  sub="Live deals"            barPct={contracts.length > 0 ? Math.round(active/contracts.length*100) : 0} />
        <StatCard label="Awaiting Signature"  value={String(pending)} sub="Fighter to sign"       barPct={pending > 0 ? 30 : 0} barColor="#c9a82c" />
        <StatCard label="Open Obligations"    value={String(overdue)} sub="Across all fighters"   barPct={overdue > 0 ? 25 : 0} barColor={overdue > 0 ? '#c00000' : '#00c060'} />
      </div>

      <div className="space-y-2">
        {contracts.map((c: any) => {
          const oblPct = c.obligations_total > 0
            ? Math.round(c.obligations_completed / c.obligations_total * 100) : 0
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
                  {c.fighter && (
                    <span className="font-condensed font-bold text-off-white text-[12px]">{c.fighter.name}</span>
                  )}
                </div>
                <div className="font-condensed text-[12px] text-gray-2">
                  ${c.value_usd?.toLocaleString()} · {c.payment_schedule}
                </div>
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
    </div>
  )
}

// ── Billing tab ───────────────────────────────────────────────────────────────
function ManagerBillingTab() {
  const [searchParams] = useSearchParams()
  const billingStatus = searchParams.get('billing')
  const billingPkg    = searchParams.get('package')

  const [packages,    setPackages]    = useState<BillingPackage[]>([])
  const [membership,  setMembership]  = useState<BillingMembership | null>(null)
  const [payments,    setPayments]    = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [checkoutErr, setCheckoutErr] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([getBillingPackages(), getBillingStatus()])
      .then(([pkgsRes, statusRes]) => {
        setPackages(pkgsRes.packages ?? [])
        setMembership(statusRes.membership ?? null)
        setPayments(statusRes.payments ?? [])
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const handleCheckout = async (pkgId: string) => {
    setCheckingOut(pkgId)
    setCheckoutErr(null)
    try {
      const res = await startCheckout(pkgId)
      window.location.href = res.url
    } catch (e: any) {
      setCheckoutErr(e.message ?? 'Checkout failed.')
      setCheckingOut(null)
    }
  }

  const features = (pkg: BillingPackage): string[] => {
    if (Array.isArray(pkg.features)) return pkg.features
    try { return JSON.parse(pkg.features as string) } catch { return [] }
  }

  const intervalLabel = (interval: string) =>
    interval === 'one_time' ? 'one-time' : `/${interval === 'annual' ? 'yr' : 'mo'}`

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  return (
    <div className="space-y-6 max-w-3xl">
      {billingStatus === 'success' && (
        <div className="font-condensed text-[12px] tracking-[0.15em] uppercase px-4 py-3 border"
          style={{ borderColor: '#00c060', color: '#00c060', background: 'rgba(0,192,96,0.08)' }}>
          Payment complete — welcome to {billingPkg ?? 'your new plan'}!
        </div>
      )}
      {billingStatus === 'cancel' && (
        <div className="font-condensed text-[12px] tracking-[0.15em] uppercase px-4 py-3 border"
          style={{ borderColor: '#c9a82c', color: '#c9a82c', background: 'rgba(201,168,44,0.08)' }}>
          Checkout cancelled — no charge was made.
        </div>
      )}

      {/* Active membership */}
      <div className="dash-card space-y-2" style={{ borderLeft: '2px solid #8b0000' }}>
        <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3">Active Plan</div>
        {membership ? (
          <div className="space-y-1 font-condensed text-[13px]">
            <div className="text-off-white font-bold">{membership.packages?.name ?? '—'}</div>
            <div className="text-gray-2 capitalize">{membership.status}</div>
            {membership.current_period_end && (
              <div className="text-gray-3">Renews {new Date(membership.current_period_end).toLocaleDateString()}</div>
            )}
          </div>
        ) : (
          <EmptyState icon="💳" title="No Active Plan" body="Purchase a package below." />
        )}
      </div>

      {checkoutErr && <p className="font-condensed text-[12px] text-blood-glow">{checkoutErr}</p>}

      {!packages.length ? (
        <EmptyState icon="📦" title="No Packages Available" body="No packages are currently available." />
      ) : (
        <div className="grid gap-4">
          {packages.map(pkg => (
            <div key={pkg.id} className="dash-card" style={{ borderLeft: '2px solid #222226' }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="font-display text-off-white uppercase" style={{ fontSize: 18 }}>{pkg.name}</div>
                  {pkg.description && <p className="font-body text-gray-2 text-[13px] mt-1">{pkg.description}</p>}
                  <ul className="mt-2 space-y-0.5">
                    {features(pkg).map((f, i) => (
                      <li key={i} className="font-condensed text-[12px] text-gray-2 flex items-center gap-2">
                        <span style={{ color: '#8b0000' }}>✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="text-right">
                    <span className="font-display text-off-white" style={{ fontSize: 24 }}>
                      ${(pkg.price_cents / 100).toFixed(0)}
                    </span>
                    <span className="font-condensed text-gray-3 text-[11px]"> {intervalLabel(pkg.billing_interval)}</span>
                  </div>
                  <button
                    onClick={() => handleCheckout(pkg.id)}
                    disabled={!!checkingOut}
                    className="btn-primary text-[11px] py-2 px-5"
                  >
                    {checkingOut === pkg.id ? 'Loading…' : 'Buy Now'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {payments.length > 0 && (
        <div>
          <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 mb-2">Payment History</div>
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className="dash-card flex items-center gap-4 text-[13px] font-condensed">
                <div className="flex-1">{p.packages?.name ?? 'Package'}</div>
                <div className="text-gray-2">${((p.amount ?? 0) / 100).toFixed(2)}</div>
                <div style={{ color: p.status === 'succeeded' ? '#00c060' : '#C41E3A' }}>{p.status}</div>
                <div className="text-gray-3">{new Date(p.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const VIEWS: Record<string,React.FC> = {
  overview: Overview, roster: Roster, applications: Applications,
  contracts: ManagerContracts, obligations: Obligations,
  sponsorforge: SponsorForge, playbooks: Playbooks, budget: Budget, reports: Reports,
  billing: ManagerBillingTab,
}

export default function ManagerDashboard() {
  return (
    <DashShell navItems={NAV} title="Manager Dashboard" subtitle="MGMT-SUITE">
      {tab => { const V = VIEWS[tab] ?? Overview; return <V /> }}
    </DashShell>
  )
}
