// ─────────────────────────────────────────────────────────────────────────────
// Guided event/fight setup wizard.
//
// The user picks what they're preparing for, answers a few smart questions, and
// the app proposes obligation templates + due dates. On submit, the BACKEND
// (`POST /api/events/guided-create`) creates the event, participants (with
// pending confirmation for fighters added by someone else), and obligations —
// the wizard only proposes; the server enforces permissions and safe creation.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react'
import {
  getEventTemplates, guidedCreateEvent,
  type ObTemplate, type EventType, type GuidedCreatePayload,
} from '../../lib/api/events'
import {
  getCalendlyStatus, getCalendlyConnectUrl, getCalendlyEventTypes,
  type CalendlyStatus, type CalendlyEventType,
} from '../../lib/api/calendly'

interface Assignable { id: string; name: string }

// Wizard type keys → stored event_type ('meeting' has no dedicated column, so it
// is stored as 'other' with a meeting purpose in notes).
type TypeOpt = { key: string; label: string; stored: EventType }
const DEFAULT_TYPE_OPTS: TypeOpt[] = [
  { key: 'fight',              label: 'Fight',             stored: 'fight' },
  { key: 'promotion_event',    label: 'Promotion Event',   stored: 'promotion_event' },
  { key: 'media_event',        label: 'Media Day',         stored: 'media_event' },
  { key: 'sponsor_activation', label: 'Sponsor Activation',stored: 'sponsor_activation' },
  { key: 'weigh_in',           label: 'Weigh-in',          stored: 'weigh_in' },
  { key: 'camp',               label: 'Training Camp',     stored: 'camp' },
  { key: 'meeting',            label: 'Meeting',           stored: 'other' },
  { key: 'other',              label: 'Other',             stored: 'other' },
]
// Sponsor-facing scheduling vocabulary (mapped onto existing event types).
const SPONSOR_TYPE_OPTS: TypeOpt[] = [
  { key: 'sponsor_activation', label: 'Sponsor Activation',  stored: 'sponsor_activation' },
  { key: 'content_deliverable',label: 'Content Deliverable', stored: 'sponsor_activation' },
  { key: 'fighter_appearance', label: 'Fighter Appearance',  stored: 'sponsor_activation' },
  { key: 'media_event',        label: 'Media Day',           stored: 'media_event' },
  { key: 'meeting',            label: 'Meeting',             stored: 'other' },
  { key: 'campaign_deadline',  label: 'Campaign Deadline',   stored: 'sponsor_activation' },
  { key: 'other',              label: 'Other',               stored: 'other' },
]

const inputCls = 'w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none focus:border-blood'
const labelCls = 'font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-gray-3 block mb-1.5'

function pad(n: number) { return String(n).padStart(2, '0') }
function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Recommended templates from type + answers (pre-selected, user can change).
function recommend(typeKey: string, ans: Record<string, any>): Set<string> {
  const s = new Set<string>()
  // Sponsor scheduling types.
  if (['sponsor_activation', 'content_deliverable', 'fighter_appearance', 'campaign_deadline'].includes(typeKey)) {
    s.add('sponsor_content')
    if (ans.tied_to_contract) s.add('contract_signed')
    if (typeKey === 'sponsor_activation' || typeKey === 'campaign_deadline') s.add('post_event_recap')
    return s
  }
  if (typeKey === 'fight') {
    s.add('weigh_in'); s.add('fight_week'); s.add('post_event_recap')
    if (ans.needs_medicals)      s.add('medicals')
    if (ans.bout_agreement)      s.add('contract_signed')
    if (ans.needs_travel)        s.add('travel')
    if (ans.sponsor_obligations) s.add('sponsor_content')
    if (ans.media_obligations)   s.add('media_day')
    if (ans.ticket_obligations)  s.add('tickets_promo')
  } else if (typeKey === 'promotion_event') {
    if (ans.ticket_req)   s.add('tickets_promo')
    if (ans.media_req)    s.add('media_day')
    if (ans.sponsor_req)  s.add('sponsor_content')
    if (ans.weigh_in_req) s.add('weigh_in')
  } else if (typeKey === 'sponsor_activation') {
    s.add('sponsor_content')
  } else if (typeKey === 'media_event') {
    s.add('media_day')
  }
  return s
}

// ── Tiny controls ─────────────────────────────────────────────────────────────
function YesNo({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-charcoal-3">
      <span className="font-condensed text-[12px] text-gray-1">{label}</span>
      <div className="flex gap-1">
        {[['Yes', true], ['No', false]].map(([l, v]) => (
          <button key={l as string} onClick={() => onChange(v as boolean)} type="button"
            className="font-condensed text-[10px] uppercase tracking-wide px-3 py-1 border"
            style={{
              borderColor: value === v ? '#C41E3A' : '#222226',
              color: value === v ? '#f0ece4' : '#7a7672',
              background: value === v ? 'rgba(196,30,58,0.12)' : 'transparent',
            }}>{l}</button>
        ))}
      </div>
    </div>
  )
}
function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input type={type} className={inputCls} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

const STEP_LABELS = ['Type', 'Details', 'Questions', 'Templates', 'Due dates', 'People', 'Review']

export default function EventWizard({ assignable = [], canLinkFighters = false, role = 'fighter', onClose, onCreated }: {
  assignable?: Assignable[]; canLinkFighters?: boolean; role?: string
  onClose: () => void; onCreated: () => void
}) {
  const sponsor  = role === 'sponsor'
  const typeOpts = sponsor ? SPONSOR_TYPE_OPTS : DEFAULT_TYPE_OPTS
  const [step, setStep]       = useState(1)
  const [typeKey, setTypeKey] = useState(sponsor ? 'sponsor_activation' : 'fight')
  const [det, setDet] = useState({
    name: '', event_date: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    location: '', external_url: '', opponent: '', promotion_name: '', weight_class: '', notes: '',
  })
  const [ans, setAns]         = useState<Record<string, any>>({ needs_medicals: true, needs_travel: true, proof_required: true })
  const [fighterId, setFighterId] = useState('')
  const [templates, setTemplates] = useState<ObTemplate[]>([])
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [tplInit, setTplInit]     = useState(false)
  const [due, setDue]             = useState<Record<string, string>>({})
  const [cal, setCal]             = useState<CalendlyStatus | null>(null)
  const [calTypes, setCalTypes]   = useState<CalendlyEventType[]>([])
  const [calTypeUri, setCalTypeUri] = useState('')
  const [calUrl, setCalUrl]       = useState('')
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState('')

  useEffect(() => {
    getEventTemplates().then(t => setTemplates(t.templates)).catch(() => {})
    getCalendlyStatus().then(setCal).catch(() => setCal(null))
    getCalendlyEventTypes().then(d => setCalTypes((d.event_types ?? []).filter(t => t.active))).catch(() => {})
  }, [])

  const tplByKey = useMemo(() => Object.fromEntries(templates.map(t => [t.key, t])), [templates])
  const setD = (k: string) => (v: string) => setDet(p => ({ ...p, [k]: v }))
  const setA = (k: string) => (v: any) => setAns(p => ({ ...p, [k]: v }))

  // Prefill due dates from event date + each template offset, for any selected
  // template that doesn't yet have one.
  const prefillDue = () => {
    if (!det.event_date) return
    const base = new Date(det.event_date)
    setDue(prev => {
      const next = { ...prev }
      for (const k of selected) {
        if (next[k]) continue
        const t = tplByKey[k]; if (!t) continue
        const d = new Date(base); d.setDate(d.getDate() + (t.offset_days ?? 0))
        next[k] = toLocalInput(d)
      }
      return next
    })
  }

  const next = () => {
    setErr('')
    if (step === 2) {
      if (!det.name.trim())   { setErr('Event name is required.'); return }
      if (!det.event_date)    { setErr('Date & time is required.'); return }
    }
    if (step === 3 && !tplInit) { setSelected(recommend(typeKey, ans)); setTplInit(true) }
    if (step === 4) prefillDue()
    setStep(s => Math.min(s + 1, 7))
  }
  const back = () => { setErr(''); setStep(s => Math.max(s - 1, 1)) }

  const pickCalType = (uri: string) => {
    setCalTypeUri(uri)
    setCalUrl(calTypes.find(t => t.uri === uri)?.scheduling_url ?? '')
  }

  const submit = async () => {
    setSaving(true); setErr('')
    try {
      const stored = typeOpts.find(t => t.key === typeKey)?.stored ?? 'other'
      const dueOverrides: Record<string, string> = {}
      for (const k of selected) if (due[k]) dueOverrides[k] = new Date(due[k]).toISOString()
      const payload: GuidedCreatePayload = {
        event_type: stored,
        details: {
          name: det.name.trim(),
          event_date: new Date(det.event_date).toISOString(),
          timezone: det.timezone || null,
          location: det.location.trim() || null,
          external_url: det.external_url.trim() || null,
          notes: det.notes.trim() || null,
          opponent: det.opponent.trim() || null,
          promotion_name: det.promotion_name.trim() || null,
          weight_class: det.weight_class.trim() || null,
        },
        answers: ans,
        participants: { fighter_ids: canLinkFighters && fighterId ? [fighterId] : undefined },
        selected_templates: [...selected],
        due_date_overrides: dueOverrides,
        calendly_event_type_uri: calTypeUri || null,
        calendly_scheduling_url: calUrl || null,
      }
      await guidedCreateEvent(payload)
      onCreated(); onClose()
    } catch (e: any) { setErr(e?.message ?? 'Could not create the event plan.'); setSaving(false) }
  }

  const toggleTpl = (k: string) => setSelected(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })

  return (
    <div className="fixed inset-0 z-[900] flex items-start sm:items-center justify-center px-4 py-8 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="relative bg-charcoal border border-charcoal-3 w-full max-w-[620px]" style={{ borderLeft: '2px solid #8b0000' }}
        onClick={e => e.stopPropagation()}>

        {/* Header + stepper */}
        <div className="px-6 py-4 border-b border-charcoal-3">
          <div className="flex items-center justify-between">
            <div className="font-display text-off-white uppercase" style={{ fontSize: 20 }}>Guided Event Setup</div>
            <button onClick={onClose} className="text-gray-3 hover:text-off-white text-xl leading-none">✕</button>
          </div>
          <div className="flex gap-1 mt-3 flex-wrap">
            {STEP_LABELS.map((l, i) => (
              <span key={l} className="font-condensed text-[9px] uppercase tracking-wide px-2 py-1"
                style={{ color: step === i + 1 ? '#f0ece4' : step > i + 1 ? '#00a060' : '#4a4846',
                         borderBottom: step === i + 1 ? '2px solid #C41E3A' : '2px solid transparent' }}>
                {i + 1}. {l}
              </span>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-4" style={{ maxHeight: '64vh', overflowY: 'auto' }}>

          {/* Step 1 — type */}
          {step === 1 && (
            <div>
              <div className="font-condensed text-[13px] text-gray-1 mb-3">{sponsor ? 'What are you scheduling?' : 'What are you preparing for?'}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {typeOpts.map(t => (
                  <button key={t.key} type="button" onClick={() => { setTypeKey(t.key); setTplInit(false) }}
                    className="font-condensed text-[12px] px-3 py-3 border text-left transition-colors"
                    style={{
                      borderColor: typeKey === t.key ? '#C41E3A' : '#222226',
                      color: typeKey === t.key ? '#f0ece4' : '#9a958c',
                      background: typeKey === t.key ? 'rgba(196,30,58,0.12)' : 'transparent',
                    }}>{t.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — basic details */}
          {step === 2 && (
            <div className="space-y-3">
              <Field label="Event Name *" value={det.name} onChange={setD('name')} placeholder="e.g. Regional Title Fight" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Date & Time *" type="datetime-local" value={det.event_date} onChange={setD('event_date')} />
                <Field label="Timezone" value={det.timezone} onChange={setD('timezone')} placeholder="e.g. America/Chicago" />
              </div>
              <Field label="Location" value={det.location} onChange={setD('location')} placeholder="City, venue (or 'Remote')" />
              <Field label="External URL (optional)" value={det.external_url} onChange={setD('external_url')} placeholder="Event page" />
            </div>
          )}

          {/* Step 3 — type-specific questions */}
          {step === 3 && (
            <div className="space-y-3">
              {typeKey === 'fight' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Opponent" value={det.opponent} onChange={setD('opponent')} placeholder="Optional" />
                    <Field label="Promotion" value={det.promotion_name} onChange={setD('promotion_name')} placeholder="Optional" />
                    <Field label="Weight Class / Division" value={det.weight_class} onChange={setD('weight_class')} placeholder="Optional" />
                    <div>
                      <label className={labelCls}>Officially confirmed?</label>
                      <select className={inputCls} value={ans.confirmed ?? 'pending'} onChange={e => setA('confirmed')(e.target.value)}>
                        <option value="yes">Yes</option><option value="pending">Pending</option><option value="no">No</option>
                      </select>
                    </div>
                  </div>
                  <YesNo label="Is there a bout agreement?"        value={!!ans.bout_agreement}      onChange={setA('bout_agreement')} />
                  <YesNo label="Do you need medicals?"             value={ans.needs_medicals !== false} onChange={setA('needs_medicals')} />
                  <YesNo label="Do you need travel?"               value={ans.needs_travel !== false}   onChange={setA('needs_travel')} />
                  <YesNo label="Sponsor obligations for this fight?" value={!!ans.sponsor_obligations} onChange={setA('sponsor_obligations')} />
                  <YesNo label="Media obligations?"                value={!!ans.media_obligations}   onChange={setA('media_obligations')} />
                  <YesNo label="Ticket / promo obligations?"       value={!!ans.ticket_obligations}  onChange={setA('ticket_obligations')} />
                </>
              )}
              {typeKey === 'promotion_event' && (
                <>
                  <Field label="Promotion" value={det.promotion_name} onChange={setD('promotion_name')} placeholder="Promotion name" />
                  <Field label="Venue" value={det.location} onChange={setD('location')} placeholder="Venue" />
                  <YesNo label="Ticket / promo requirements?" value={!!ans.ticket_req}   onChange={setA('ticket_req')} />
                  <YesNo label="Media day required?"          value={!!ans.media_req}    onChange={setA('media_req')} />
                  <YesNo label="Sponsor activation required?" value={!!ans.sponsor_req}  onChange={setA('sponsor_req')} />
                  <YesNo label="Weigh-in required?"           value={!!ans.weigh_in_req} onChange={setA('weigh_in_req')} />
                </>
              )}
              {!sponsor && typeKey === 'sponsor_activation' && (
                <>
                  <Field label="Sponsor / Brand" value={det.promotion_name} onChange={setD('promotion_name')} placeholder="Brand name" />
                  <div>
                    <label className={labelCls}>Deliverable type</label>
                    <select className={inputCls} value={ans.deliverable ?? 'post'} onChange={e => setA('deliverable')(e.target.value)}>
                      {['post', 'story', 'video', 'appearance', 'booth', 'other'].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <YesNo label="Proof required?" value={ans.proof_required !== false} onChange={setA('proof_required')} />
                </>
              )}
              {sponsor && ['sponsor_activation', 'content_deliverable', 'fighter_appearance', 'campaign_deadline'].includes(typeKey) && (
                <>
                  <Field label="Brand / Campaign" value={det.promotion_name} onChange={setD('promotion_name')} placeholder="Brand or campaign name" />
                  <div>
                    <label className={labelCls}>Deliverable type</label>
                    <select className={inputCls} value={ans.deliverable ?? 'instagram_post'} onChange={e => setA('deliverable')(e.target.value)}>
                      {[['instagram_post', 'Instagram post'], ['story', 'Story'], ['reel_video', 'Reel / video'],
                        ['appearance', 'In-person appearance'], ['booth', 'Booth activation'], ['logo', 'Logo placement'],
                        ['interview', 'Interview / media'], ['other', 'Other']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <YesNo label="Proof required?"               value={ans.proof_required !== false} onChange={setA('proof_required')} />
                  <YesNo label="Tied to a contract?"           value={!!ans.tied_to_contract}       onChange={setA('tied_to_contract')} />
                  <YesNo label="Does the fighter need to confirm?" value={ans.fighter_approval !== false} onChange={setA('fighter_approval')} />
                </>
              )}
              {typeKey === 'media_event' && (
                <>
                  <Field label="Location / Remote" value={det.location} onChange={setD('location')} placeholder="Studio, gym, remote…" />
                  <Field label="Required content" value={ans.content ?? ''} onChange={setA('content')} placeholder="Photos, interviews, b-roll…" />
                  <Field label="Who is attending" value={ans.attendees ?? ''} onChange={setA('attendees')} placeholder="Fighter, coach, media…" />
                </>
              )}
              {(typeKey === 'meeting') && (
                <>
                  <YesNo label="Is this a Calendly meeting?" value={!!ans.is_calendly} onChange={setA('is_calendly')} />
                  <Field label="Attendees" value={ans.attendees ?? ''} onChange={setA('attendees')} placeholder="Who's joining" />
                  <Field label="Purpose" value={det.notes} onChange={setD('notes')} placeholder="What's it about" />
                </>
              )}
              {(typeKey === 'weigh_in' || typeKey === 'camp' || typeKey === 'other') && (
                <Field label="Notes" value={det.notes} onChange={setD('notes')} placeholder="Anything useful for this event" />
              )}
            </div>
          )}

          {/* Step 4 — templates */}
          {step === 4 && (
            <div className="space-y-2">
              <div className="font-condensed text-[12px] text-gray-1">Recommended obligations are pre-selected — adjust as needed.</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {templates.map(t => {
                  const on = selected.has(t.key)
                  return (
                    <button key={t.key} type="button" onClick={() => toggleTpl(t.key)}
                      className="font-condensed text-[11px] text-left px-3 py-2 border transition-colors"
                      style={{ borderColor: on ? '#8b0000' : '#222226', background: on ? 'rgba(139,0,0,0.12)' : 'transparent', color: on ? '#f0ece4' : '#7a7672' }}>
                      {on ? '✓ ' : ''}{t.title}
                      <span className="text-gray-3 ml-1">({t.offset_days < 0 ? `${-t.offset_days}d before` : t.offset_days > 0 ? `${t.offset_days}d after` : 'event day'})</span>
                    </button>
                  )
                })}
              </div>
              {selected.size === 0 && <div className="font-condensed text-[11px] text-gray-3">No obligations selected — you can still create the event.</div>}
            </div>
          )}

          {/* Step 5 — due dates */}
          {step === 5 && (
            <div className="space-y-2">
              {selected.size === 0 ? (
                <div className="font-condensed text-[12px] text-gray-3">No obligations to schedule.</div>
              ) : (
                [...selected].map(k => (
                  <div key={k} className="flex items-center gap-3 flex-wrap">
                    <span className="font-condensed text-[12px] text-off-white" style={{ minWidth: 150 }}>{tplByKey[k]?.title ?? k}</span>
                    <input type="datetime-local" className={inputCls} style={{ maxWidth: 260 }}
                      value={due[k] ?? ''} onChange={e => setDue(p => ({ ...p, [k]: e.target.value }))} />
                  </div>
                ))
              )}
            </div>
          )}

          {/* Step 6 — people + Calendly */}
          {step === 6 && (
            <div className="space-y-3">
              {canLinkFighters && assignable.length > 0 && (
                <div>
                  <label className={labelCls}>Linked Fighter</label>
                  <select className={inputCls} value={fighterId} onChange={e => setFighterId(e.target.value)}>
                    <option value="">{role === 'manager' ? 'Select roster fighter…' : 'Select fighter…'}</option>
                    {assignable.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  {fighterId && <p className="font-condensed text-[10px] text-gray-3 mt-1">The fighter will see this as <span style={{ color: '#c9a82c' }}>pending confirmation</span> until they accept.</p>}
                </div>
              )}
              <div className="border border-charcoal-3 p-3" style={{ background: '#0d0d10' }}>
                <div className="font-condensed text-[10px] uppercase tracking-[0.25em] text-gray-3 mb-1">Calendly (optional)</div>
                {!cal?.connected ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-condensed text-[11px] text-gray-3">Connect Calendly to attach a booking link.</span>
                    <button type="button" onClick={() => getCalendlyConnectUrl().then(({ url }) => { window.location.href = url }).catch(() => {})}
                      className="btn-ghost text-[10px] py-1.5 px-3">Connect Calendly</button>
                  </div>
                ) : calTypes.length === 0 ? (
                  <span className="font-condensed text-[11px] text-gray-3">Calendly connected. No active event types found.</span>
                ) : (
                  <>
                    <select className={inputCls} value={calTypeUri} onChange={e => pickCalType(e.target.value)}>
                      <option value="">Attach a Calendly event type…</option>
                      {calTypes.map(t => <option key={t.uri} value={t.uri}>{t.name}{t.duration ? ` · ${t.duration} min` : ''}</option>)}
                    </select>
                    {calUrl && <p className="font-condensed text-[10px] text-gray-3 mt-1">Booking link will be attached — invitees still choose a time slot.</p>}
                  </>
                )}
              </div>
              <p className="font-condensed text-[10px] text-gray-3">Visibility is applied automatically (private prep stays private; sponsor tasks are sponsor-visible; promo/media tasks are promoter-visible).</p>
            </div>
          )}

          {/* Step 7 — review */}
          {step === 7 && (
            <div className="space-y-3">
              <div>
                <div className="font-condensed text-[10px] uppercase tracking-[0.25em] text-gray-3 mb-1">Event</div>
                <div className="font-condensed text-[13px] text-off-white font-bold">{det.name || '—'}</div>
                <div className="font-condensed text-[11px] text-gray-3">
                  {typeOpts.find(t => t.key === typeKey)?.label}
                  {det.event_date ? ` · ${new Date(det.event_date).toLocaleString()}` : ''}
                  {det.location ? ` · ${det.location}` : ''}
                </div>
                {(det.opponent || det.promotion_name || det.weight_class) && (
                  <div className="font-condensed text-[11px] text-gray-3">{[det.opponent && `vs ${det.opponent}`, det.promotion_name, det.weight_class].filter(Boolean).join(' · ')}</div>
                )}
              </div>
              {canLinkFighters && fighterId && (
                <div className="font-condensed text-[11px] text-gray-2">Linked fighter: <span className="text-off-white">{assignable.find(a => a.id === fighterId)?.name}</span> (pending confirmation)</div>
              )}
              <div>
                <div className="font-condensed text-[10px] uppercase tracking-[0.25em] text-gray-3 mb-1">Obligations ({selected.size})</div>
                {selected.size === 0 ? <div className="font-condensed text-[11px] text-gray-3">None</div> : (
                  [...selected].map(k => (
                    <div key={k} className="flex justify-between py-1 border-b border-charcoal-3 last:border-0">
                      <span className="font-condensed text-[12px] text-off-white">{tplByKey[k]?.title ?? k}</span>
                      <span className="font-condensed text-[11px] text-gray-3">{due[k] ? new Date(due[k]).toLocaleDateString() : 'no date'}</span>
                    </div>
                  ))
                )}
              </div>
              {calUrl && <div className="font-condensed text-[11px] text-gray-2">Calendly booking link will be attached.</div>}
            </div>
          )}

          {err && <p className="font-condensed text-[12px] text-blood-glow">{err}</p>}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-charcoal-3">
          <button onClick={step === 1 ? onClose : back} className="btn-ghost text-[11px] py-2 px-4">{step === 1 ? 'Cancel' : '← Back'}</button>
          {step < 7
            ? <button onClick={next} className="btn-primary text-[11px] py-2 px-5">Next →</button>
            : <button onClick={submit} disabled={saving} className="btn-primary text-[11px] py-2 px-5 disabled:opacity-50">{saving ? 'Creating…' : (sponsor ? 'Create Sponsor Calendar Plan' : 'Create Event Calendar Plan')}</button>}
        </div>
      </div>
    </div>
  )
}
