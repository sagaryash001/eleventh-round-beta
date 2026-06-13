import React, { useEffect, useState, useCallback } from 'react'
import {
  getEvents, getEvent, createEvent, getEventTemplates,
  addObligation, addObligationsFromTemplate, updateObligation, completeObligation,
  type CalEvent, type EventObligation, type ObTemplate, type EventType, type ObStatus,
} from '../../lib/api/events'
import {
  getCalendlyStatus, getCalendlyConnectUrl, syncCalendly, disconnectCalendly,
  type CalendlyStatus,
} from '../../lib/api/calendly'

const TYPE_LABEL: Record<EventType, string> = {
  fight: 'Fight', promotion_event: 'Promotion Event', media_event: 'Media Event',
  weigh_in: 'Weigh-in', camp: 'Camp', sponsor_activation: 'Sponsor Activation', other: 'Other',
}
const TYPES = Object.keys(TYPE_LABEL) as EventType[]

const STATUS_COLOR: Record<string, string> = {
  planned: '#c9a82c', active: '#00c060', completed: '#4a9f6f', cancelled: '#7a4a4a',
}
const OB_COLOR: Record<ObStatus, string> = {
  not_started: '#4a4846', in_progress: '#c9a82c', completed: '#00c060', overdue: '#c00000', skipped: '#4a4846',
}
const OB_NEXT: Record<ObStatus, string> = {
  not_started: 'in_progress', in_progress: 'completed', completed: 'not_started',
  overdue: 'completed', skipped: 'not_started',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

// Only allow http(s) links into href — blocks javascript:/data: XSS vectors.
function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.toString() : null
  } catch { return null }
}

interface Assignable { id: string; name: string }

// ── Add Event form (modal) ────────────────────────────────────────────────────
function AddEventForm({ assignable, canLinkFighters, onClose, onCreated }: {
  assignable: Assignable[]; canLinkFighters: boolean
  onClose: () => void; onCreated: () => void
}) {
  const [f, setF] = useState({
    name: '', event_type: 'fight' as EventType, event_date: '', location: '',
    opponent: '', promotion_name: '', weight_class: '', external_url: '', notes: '',
    visibility: 'manager_visible' as const, fighter_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!f.name.trim()) { setErr('Event name is required.'); return }
    if (!f.event_date)  { setErr('Event date is required.'); return }
    setSaving(true); setErr('')
    try {
      await createEvent({
        name: f.name.trim(), event_type: f.event_type,
        event_date: new Date(f.event_date).toISOString(),
        location: f.location.trim() || null, opponent: f.opponent.trim() || null,
        promotion_name: f.promotion_name.trim() || null, weight_class: f.weight_class.trim() || null,
        external_url: f.external_url.trim() || null, notes: f.notes.trim() || null,
        visibility: f.visibility,
        fighter_ids: canLinkFighters && f.fighter_id ? [f.fighter_id] : undefined,
      })
      onCreated(); onClose()
    } catch (e: any) { setErr(e.message ?? 'Could not create event.'); setSaving(false) }
  }

  const inputCls = 'w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none focus:border-blood'
  const labelCls = 'font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-gray-3 block mb-1.5'

  return (
    <div className="fixed inset-0 z-[900] flex items-start sm:items-center justify-center px-4 py-8 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="relative bg-charcoal border border-charcoal-3 w-full max-w-[560px]" style={{ borderLeft: '2px solid #8b0000' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal-3">
          <div className="font-display text-off-white uppercase" style={{ fontSize: 20 }}>Add Event</div>
          <button onClick={onClose} className="text-gray-3 hover:text-off-white text-xl leading-none">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Event Name *</label>
            <input className={inputCls} value={f.name} onChange={e => set('name')(e.target.value)} placeholder="e.g. Regional Title Fight" autoFocus />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Type</label>
              <select className={inputCls} value={f.event_type} onChange={e => set('event_type')(e.target.value)}>
                {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Date & Time *</label>
              <input type="datetime-local" className={inputCls} value={f.event_date} onChange={e => set('event_date')(e.target.value)} />
            </div>
          </div>
          {canLinkFighters && assignable.length > 0 && (
            <div>
              <label className={labelCls}>Linked Fighter</label>
              <select className={inputCls} value={f.fighter_id} onChange={e => set('fighter_id')(e.target.value)}>
                <option value="">Select roster fighter…</option>
                {assignable.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Opponent</label><input className={inputCls} value={f.opponent} onChange={e => set('opponent')(e.target.value)} placeholder="Optional" /></div>
            <div><label className={labelCls}>Weight Class</label><input className={inputCls} value={f.weight_class} onChange={e => set('weight_class')(e.target.value)} placeholder="Optional" /></div>
            <div><label className={labelCls}>Promotion</label><input className={inputCls} value={f.promotion_name} onChange={e => set('promotion_name')(e.target.value)} placeholder="Optional" /></div>
            <div><label className={labelCls}>Location</label><input className={inputCls} value={f.location} onChange={e => set('location')(e.target.value)} placeholder="City, venue" /></div>
          </div>
          <div>
            <label className={labelCls}>External URL</label>
            <input className={inputCls} value={f.external_url} onChange={e => set('external_url')(e.target.value)} placeholder="Optional — event page" />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea className={`${inputCls} resize-none`} rows={2} value={f.notes} onChange={e => set('notes')(e.target.value)} />
          </div>
          {err && <p className="font-condensed text-[12px] text-blood-glow">{err}</p>}
          <div className="flex gap-3">
            <button onClick={submit} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Saving…' : 'Create Event'}</button>
            <button onClick={onClose} className="btn-ghost">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Event detail modal (obligations) ──────────────────────────────────────────
function EventDetail({ eventId, assignable, onClose, onChanged }: {
  eventId: string; assignable: Assignable[]; onClose: () => void; onChanged: () => void
}) {
  const [ev, setEv]               = useState<CalEvent | null>(null)
  const [obs, setObs]             = useState<EventObligation[]>([])
  const [loading, setLoading]     = useState(true)
  const [templates, setTemplates] = useState<ObTemplate[]>([])
  const [picker, setPicker]       = useState<Set<string>>(new Set())
  const [showTpl, setShowTpl]     = useState(false)
  const [showAddOb, setShowAddOb] = useState(false)
  const [newOb, setNewOb]         = useState({ title: '', category: '', due_date: '', assigned_to: '' })
  const [proofFor, setProofFor]   = useState<string | null>(null)
  const [proofUrl, setProofUrl]   = useState('')
  const [busy, setBusy]           = useState(false)
  const [err, setErr]             = useState('')

  const load = useCallback(() => {
    getEvent(eventId).then(d => { setEv(d.event); setObs(d.obligations); setLoading(false) }).catch(() => setLoading(false))
  }, [eventId])
  useEffect(() => { load(); getEventTemplates().then(t => setTemplates(t.templates)).catch(() => {}) }, [load])

  const canEdit = !!ev?.can_edit

  const cycleStatus = async (ob: EventObligation) => {
    const next = OB_NEXT[ob.status] as ObStatus
    if (next === 'completed' && ob.proof_required && !ob.proof_url) { setProofFor(ob.id); setProofUrl(''); return }
    try { await updateObligation(ob.id, { status: next }); load(); onChanged() } catch (e: any) { setErr(e.message) }
  }
  const doComplete = async (oid: string) => {
    setBusy(true); setErr('')
    try { await completeObligation(oid, proofUrl.trim() || undefined); setProofFor(null); load(); onChanged() }
    catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  const addTemplates = async () => {
    if (!picker.size) return
    setBusy(true); setErr('')
    try { await addObligationsFromTemplate(eventId, [...picker]); setPicker(new Set()); setShowTpl(false); load(); onChanged() }
    catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  const addManual = async () => {
    if (!newOb.title.trim()) { setErr('Obligation title required.'); return }
    setBusy(true); setErr('')
    try {
      await addObligation(eventId, {
        title: newOb.title.trim(), category: newOb.category.trim() || undefined,
        due_date: newOb.due_date ? new Date(newOb.due_date).toISOString() : null,
        assigned_to_user_id: newOb.assigned_to || undefined,
      })
      setNewOb({ title: '', category: '', due_date: '', assigned_to: '' }); setShowAddOb(false); load(); onChanged()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  const inputCls = 'w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[12px] px-3 py-2 outline-none focus:border-blood'

  return (
    <div className="fixed inset-0 z-[900] flex items-start sm:items-center justify-center px-4 py-8 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="relative bg-charcoal border border-charcoal-3 w-full max-w-[640px]" style={{ borderLeft: '2px solid #8b0000' }}
        onClick={e => e.stopPropagation()}>
        {loading || !ev ? (
          <div className="p-10 text-center"><div className="dash-sub">Loading event…</div></div>
        ) : (
          <>
            <div className="flex items-start justify-between px-6 py-4 border-b border-charcoal-3 gap-4">
              <div className="min-w-0">
                <div className="font-condensed text-[9px] font-bold uppercase tracking-[0.3em] text-blood-glow mb-1">
                  {TYPE_LABEL[ev.event_type]} · <span style={{ color: STATUS_COLOR[ev.status] }}>{ev.status}</span>
                </div>
                <div className="font-display text-off-white uppercase truncate" style={{ fontSize: 22, lineHeight: 1 }}>{ev.name}</div>
                <div className="font-condensed text-[12px] text-gray-2 mt-1">
                  {fmtDate(ev.event_date)} · {fmtTime(ev.event_date)}
                  {ev.location ? ` · ${ev.location}` : ''}
                </div>
                {(ev.opponent || ev.weight_class || ev.promotion_name) && (
                  <div className="font-condensed text-[11px] text-gray-3 mt-0.5">
                    {[ev.opponent && `vs ${ev.opponent}`, ev.weight_class, ev.promotion_name].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <button onClick={onClose} className="text-gray-3 hover:text-off-white text-xl leading-none flex-shrink-0">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {safeHttpUrl(ev.external_url) && (
                <a href={safeHttpUrl(ev.external_url)!} target="_blank" rel="noopener noreferrer"
                  className="font-condensed text-[11px] text-blood-glow hover:underline no-underline inline-block">Event page →</a>
              )}
              {ev.notes && <p className="font-body text-[13px] text-gray-1 leading-relaxed">{ev.notes}</p>}

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="dash-label" style={{ marginBottom: 0 }}>Obligations</div>
                {canEdit && (
                  <div className="flex gap-2">
                    <button onClick={() => { setShowTpl(s => !s); setShowAddOb(false) }} className="btn-ghost text-[9px] py-1.5 px-3">+ From Template</button>
                    <button onClick={() => { setShowAddOb(s => !s); setShowTpl(false) }} className="btn-ghost text-[9px] py-1.5 px-3">+ Add</button>
                  </div>
                )}
              </div>

              {/* Template picker */}
              {showTpl && canEdit && (
                <div className="border border-charcoal-3 p-3 space-y-2" style={{ background: '#0d0d10' }}>
                  <div className="font-condensed text-[10px] text-gray-3 uppercase tracking-widest mb-1">Choose templates — due dates auto-set from event date</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {templates.map(t => {
                      const on = picker.has(t.key)
                      return (
                        <button key={t.key} onClick={() => setPicker(p => { const n = new Set(p); n.has(t.key) ? n.delete(t.key) : n.add(t.key); return n })}
                          className="font-condensed text-[11px] text-left px-3 py-2 border transition-all"
                          style={{ borderColor: on ? '#8b0000' : '#222226', background: on ? 'rgba(139,0,0,0.12)' : 'transparent', color: on ? '#f0ece4' : '#7a7672' }}>
                          {on ? '✓ ' : ''}{t.title}
                          <span className="text-gray-3 ml-1">({t.offset_days < 0 ? `${-t.offset_days}d before` : t.offset_days > 0 ? `${t.offset_days}d after` : 'event day'})</span>
                        </button>
                      )
                    })}
                  </div>
                  <button onClick={addTemplates} disabled={busy || !picker.size} className="btn-primary text-[10px] py-1.5 px-4 disabled:opacity-40">
                    Add {picker.size || ''} Obligation{picker.size === 1 ? '' : 's'}
                  </button>
                </div>
              )}

              {/* Manual add */}
              {showAddOb && canEdit && (
                <div className="border border-charcoal-3 p-3 space-y-2" style={{ background: '#0d0d10' }}>
                  <input className={inputCls} placeholder="Obligation title" value={newOb.title} onChange={e => setNewOb(p => ({ ...p, title: e.target.value }))} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input className={inputCls} placeholder="Category (optional)" value={newOb.category} onChange={e => setNewOb(p => ({ ...p, category: e.target.value }))} />
                    <input type="datetime-local" className={inputCls} value={newOb.due_date} onChange={e => setNewOb(p => ({ ...p, due_date: e.target.value }))} />
                  </div>
                  {assignable.length > 1 && (
                    <select className={inputCls} value={newOb.assigned_to} onChange={e => setNewOb(p => ({ ...p, assigned_to: e.target.value }))}>
                      <option value="">Assign to… (default: event owner)</option>
                      {assignable.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  )}
                  <button onClick={addManual} disabled={busy} className="btn-primary text-[10px] py-1.5 px-4 disabled:opacity-40">Add Obligation</button>
                </div>
              )}

              {/* Obligation list */}
              {obs.length === 0 ? (
                <div className="dash-sub py-2">No obligations yet{canEdit ? ' — add from a template or manually.' : '.'}</div>
              ) : (
                <div className="space-y-1">
                  {obs.map(ob => {
                    const due = ob.due_date ? daysUntil(ob.due_date) : null
                    const canAct = canEdit || ob.assigned_to_user_id // assignee or full
                    return (
                      <div key={ob.id} className="flex items-start gap-3 py-2.5 border-b border-charcoal-3 last:border-0">
                        <button onClick={() => canAct && cycleStatus(ob)} disabled={!canAct}
                          title="Toggle status"
                          className="flex items-center justify-center flex-shrink-0 rounded-full mt-0.5"
                          style={{ width: 20, height: 20, border: `2px solid ${OB_COLOR[ob.status]}`, background: ob.status === 'completed' ? OB_COLOR[ob.status] : 'transparent', color: '#0b0b0b', fontSize: 11, cursor: canAct ? 'pointer' : 'default' }}>
                          {ob.status === 'completed' ? '✓' : ''}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="font-condensed font-bold text-[12px] text-off-white flex items-center gap-2 flex-wrap">
                            <span className={ob.status === 'completed' ? 'line-through text-gray-3' : ''}>{ob.title}</span>
                            {ob.proof_required && <span className="font-condensed text-[8px] uppercase tracking-widest px-1.5 py-0.5 border border-charcoal-3 text-gray-3">Proof</span>}
                          </div>
                          <div className="font-condensed text-[11px]" style={{ color: ob.status === 'overdue' ? '#c00000' : '#7a7672' }}>
                            {ob.due_date ? `${ob.status === 'overdue' ? 'Overdue · ' : ''}due ${fmtDate(ob.due_date)}${due !== null && due >= 0 && ob.status !== 'completed' ? ` · ${due}d` : ''}` : 'No due date'}
                            {ob.assigned_to_name ? ` · ${ob.assigned_to_name}` : ''}
                          </div>
                          {safeHttpUrl(ob.proof_url) && <a href={safeHttpUrl(ob.proof_url)!} target="_blank" rel="noopener noreferrer" className="font-condensed text-[10px] text-blood-glow hover:underline no-underline">View proof →</a>}

                          {proofFor === ob.id && (
                            <div className="mt-2 flex gap-2 flex-wrap">
                              <input className={inputCls} style={{ maxWidth: 260 }} placeholder="Paste proof link (URL)" value={proofUrl} onChange={e => setProofUrl(e.target.value)} />
                              <button onClick={() => doComplete(ob.id)} disabled={busy || !proofUrl.trim()} className="btn-primary text-[10px] py-1.5 px-3 disabled:opacity-40">Complete</button>
                              <button onClick={() => setProofFor(null)} className="btn-ghost text-[10px] py-1.5 px-3">Cancel</button>
                            </div>
                          )}
                        </div>
                        <span className="font-condensed text-[9px] uppercase tracking-widest flex-shrink-0 mt-0.5" style={{ color: OB_COLOR[ob.status] }}>
                          {ob.status.replace('_', ' ')}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
              {err && <p className="font-condensed text-[11px] text-blood-glow">{err}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Calendly connection bar ───────────────────────────────────────────────────
function CalendlyBar({ onSynced }: { onSynced: () => void }) {
  const [status, setStatus] = useState<CalendlyStatus | null>(null)
  const [busy, setBusy]     = useState(false)
  const [msg, setMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(() => {
    getCalendlyStatus().then(setStatus).catch(() => setStatus({ connected: false, configured: false }))
  }, [])
  useEffect(() => {
    load()
    // Surface the OAuth round-trip result, then clean the URL.
    const q = new URLSearchParams(window.location.search)
    const c = q.get('calendly')
    if (c === 'connected') setMsg({ type: 'ok', text: 'Calendly connected. Click “Sync” to import your meetings.' })
    else if (c === 'error') setMsg({ type: 'err', text: `Calendly connection failed${q.get('reason') ? ` (${q.get('reason')})` : ''}.` })
    if (c) window.history.replaceState({}, '', window.location.pathname)
  }, [load])

  // Server isn't configured for Calendly → don't render anything (no placeholder UI).
  if (!status || !status.configured) return null

  const connect = async () => {
    setBusy(true); setMsg(null)
    try { const { url } = await getCalendlyConnectUrl(); window.location.href = url }
    catch (e: any) { setMsg({ type: 'err', text: e.message ?? 'Could not start Calendly connect.' }); setBusy(false) }
  }
  const sync = async () => {
    setBusy(true); setMsg(null)
    try {
      const r = await syncCalendly()
      setMsg({ type: 'ok', text: `Synced — ${r.imported} new, ${r.updated} updated${r.canceled ? `, ${r.canceled} cancelled` : ''}.` })
      onSynced(); load()
    } catch (e: any) { setMsg({ type: 'err', text: e.message ?? 'Sync failed.' }) }
    finally { setBusy(false) }
  }
  const disconnect = async () => {
    setBusy(true); setMsg(null)
    try { await disconnectCalendly(); setMsg({ type: 'ok', text: 'Calendly disconnected.' }); load() }
    catch (e: any) { setMsg({ type: 'err', text: e.message ?? 'Disconnect failed.' }) }
    finally { setBusy(false) }
  }

  return (
    <div className="dash-card" style={{ borderLeft: `2px solid ${status.connected ? '#00c060' : '#4a4846'}` }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="dash-label" style={{ marginBottom: 2 }}>Calendly</div>
          <div className="font-condensed text-[12px]" style={{ color: status.connected ? '#00c060' : '#7a7672' }}>
            {status.connected
              ? `Connected · ${status.synced_count ?? 0} synced${status.last_synced_at ? ` · last sync ${new Date(status.last_synced_at).toLocaleDateString()}` : ''}`
              : 'Connect Calendly to sync your scheduled meetings into Event Calendar.'}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {status.connected ? (
            <>
              <button onClick={sync} disabled={busy} className="btn-primary text-[10px] py-2 px-4 disabled:opacity-50">{busy ? '…' : 'Sync Calendly'}</button>
              <button onClick={disconnect} disabled={busy} className="btn-ghost text-[10px] py-2 px-4">Disconnect</button>
            </>
          ) : (
            <button onClick={connect} disabled={busy} className="btn-primary text-[10px] py-2 px-5 disabled:opacity-50">{busy ? '…' : 'Connect Calendly'}</button>
          )}
        </div>
      </div>
      {msg && <p className={`font-condensed text-[11px] mt-2 ${msg.type === 'ok' ? 'text-green-400' : 'text-blood-glow'}`}>{msg.text}</p>}
    </div>
  )
}

// ── Main calendar (list grouped by date) ──────────────────────────────────────
export default function EventCalendar({ assignable = [], canLinkFighters = false }: {
  assignable?: Assignable[]; canLinkFighters?: boolean
}) {
  const [events, setEvents]   = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [openId, setOpenId]   = useState<string | null>(null)

  const load = useCallback(() => {
    getEvents().then(d => { setEvents(d.events ?? []); setLoading(false) }).catch(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const now = Date.now()
  const upcoming = events.filter(e => new Date(e.event_date).getTime() >= now - 86400000 && e.status !== 'cancelled')
  const past     = events.filter(e => new Date(e.event_date).getTime() < now - 86400000 || e.status === 'cancelled')

  const EventCard = ({ e }: { e: CalEvent }) => {
    const du = daysUntil(e.event_date)
    return (
      <button onClick={() => setOpenId(e.id)} className="dash-card text-left w-full hover:border-blood transition-colors"
        style={{ borderLeft: `2px solid ${STATUS_COLOR[e.status] ?? '#222226'}` }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="font-condensed text-[9px] font-bold uppercase tracking-[0.3em] text-gray-3 mb-0.5 flex items-center gap-2">
              {TYPE_LABEL[e.event_type]}
              {e.source === 'calendly' && <span style={{ color: '#00a2c0' }}>· Calendly</span>}
            </div>
            <div className="font-condensed font-bold text-[14px] text-off-white truncate">{e.name}</div>
            <div className="font-condensed text-[11px] text-gray-3 mt-0.5">
              {fmtDate(e.event_date)} · {fmtTime(e.event_date)}{e.location ? ` · ${e.location}` : ''}
            </div>
            {(e.opponent || e.promotion_name) && (
              <div className="font-condensed text-[11px] text-gray-3">{[e.opponent && `vs ${e.opponent}`, e.promotion_name].filter(Boolean).join(' · ')}</div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-display text-off-white" style={{ fontSize: 20, lineHeight: 1 }}>
              {du >= 0 ? du : '—'}<span className="font-condensed text-[9px] text-gray-3 ml-1 uppercase tracking-widest">{du >= 0 ? 'days' : 'past'}</span>
            </div>
            {(e.obligation_total ?? 0) > 0 && (
              <div className="font-condensed text-[10px] mt-1" style={{ color: (e.obligation_overdue ?? 0) > 0 ? '#c00000' : '#7a7672' }}>
                {e.obligation_done}/{e.obligation_total} done{(e.obligation_overdue ?? 0) > 0 ? ` · ${e.obligation_overdue} overdue` : ''}
              </div>
            )}
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="dash-label" style={{ marginBottom: 2 }}>Event Calendar</div>
          <div className="dash-sub" style={{ marginTop: 0 }}>Fights, media, weigh-ins, camps & sponsor activations</div>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-[10px] py-2 px-5">+ Add Event</button>
      </div>

      <CalendlyBar onSynced={load} />

      {loading ? (
        <div className="dash-card"><div className="dash-sub">Loading events…</div></div>
      ) : events.length === 0 ? (
        <div className="dash-card text-center py-12">
          <div className="font-display text-off-white uppercase mb-2" style={{ fontSize: 22 }}>No upcoming events yet</div>
          <p className="font-condensed text-[13px] text-gray-3 mb-5">Add your next fight, promotion, media day, or sponsor activation.</p>
          <button onClick={() => setShowAdd(true)} className="btn-primary">+ Add Your First Event</button>
        </div>
      ) : (
        <div className="space-y-5">
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3">Upcoming</div>
              {upcoming.map(e => <EventCard key={e.id} e={e} />)}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-2">
              <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3">Past & Cancelled</div>
              {past.map(e => <EventCard key={e.id} e={e} />)}
            </div>
          )}
        </div>
      )}

      {showAdd && <AddEventForm assignable={assignable} canLinkFighters={canLinkFighters} onClose={() => setShowAdd(false)} onCreated={load} />}
      {openId && <EventDetail eventId={openId} assignable={assignable} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  )
}
