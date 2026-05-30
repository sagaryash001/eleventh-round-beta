import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  createOpportunity, updateOpportunity, publishOpportunity,
  getOpportunity, type OppInput,
} from '../../lib/api/opportunities'
import Navbar from '../../components/Navbar'

const CAMPAIGN_TYPES = [
  { value: 'brand_ambassador', label: 'Brand Ambassador' },
  { value: 'single_event',     label: 'Single Event' },
  { value: 'one_off_post',     label: 'Social Post' },
  { value: 'seasonal',         label: 'Seasonal Campaign' },
  { value: 'annual',           label: 'Annual Partnership' },
  { value: 'appearance',       label: 'Appearance' },
  { value: 'other',            label: 'Other' },
]
const WEIGHT_CLASSES = [
  'Flyweight','Bantamweight','Featherweight','Lightweight','Welterweight',
  'Middleweight','Light Heavyweight','Heavyweight',
  "Women's Strawweight","Women's Flyweight","Women's Bantamweight",
]
const DELIVERABLE_TYPES = [
  'instagram_post','story','tiktok','youtube_video','appearance',
  'logo_placement','merch_promo','event_attendance','content_creation','other',
]

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  const [f, setF] = useState(false)
  return (
    <div>
      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">{label}</label>
      <input type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)}
        className="w-full bg-charcoal-2 border text-off-white font-body text-[14px] px-4 py-3 outline-none transition-all placeholder:text-gray-3"
        style={{ borderColor: f ? '#8b0000' : '#222226' }} />
    </div>
  )
}
function Chips({ label, options, selected, onToggle }: {
  label: string; options: string[]; selected: string[]; onToggle: (v: string) => void
}) {
  return (
    <div>
      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2.5">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(o => {
          const on = selected.includes(o)
          return <button key={o} type="button" onClick={() => onToggle(o)}
            className="font-condensed font-semibold uppercase text-[11px] tracking-[0.1em] px-3 py-1.5 border cursor-pointer transition-all"
            style={{ borderColor: on ? '#8b0000' : '#222226', background: on ? 'rgba(139,0,0,0.12)' : '#141416', color: on ? '#f0ece4' : '#7a7672' }}>
            {o.replace(/_/g, ' ')}
          </button>
        })}
      </div>
    </div>
  )
}

type Deliverable = { type: string; count: number; notes: string }

export default function OpportunityFormPage() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const { id }     = useParams<{ id?: string }>() // editing existing if id present
  const isEdit     = !!id

  const [loading,  setLoading]  = useState(isEdit)
  const [saving,   setSaving]   = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [msg,      setMsg]      = useState('')
  const [savedId,  setSavedId]  = useState(id ?? '')

  const [form, setForm] = useState({
    title: '', description: '', campaign_type: '', location_country: '', location_region: '',
    budget_min: '', budget_max: '', budget_per: '', max_fighters: '1',
    deadline: '', campaign_start: '', campaign_end: '',
    weight_classes: [] as string[], promotions: [] as string[],
    min_followers: '', visibility: 'public',
  })
  const [deliverables, setDeliverables] = useState<Deliverable[]>([
    { type: 'instagram_post', count: 1, notes: '' },
  ])

  const set = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }))
  const toggleChip = (k: 'weight_classes' | 'promotions') => (v: string) =>
    setForm(p => ({ ...p, [k]: p[k].includes(v) ? p[k].filter(x => x !== v) : [...p[k], v] }))

  const addDeliverable = () => setDeliverables(d => [...d, { type: 'instagram_post', count: 1, notes: '' }])
  const updDeliv = (i: number, patch: Partial<Deliverable>) =>
    setDeliverables(d => d.map((x, j) => j === i ? { ...x, ...patch } : x))
  const removeDeliv = (i: number) => setDeliverables(d => d.filter((_, j) => j !== i))

  // Load existing if editing
  useEffect(() => {
    if (!isEdit) return
    getOpportunity(id!)
      .then(r => {
        const o = r.opportunity
        const reqs = (o.requirements as any) ?? {}
        setForm({
          title: o.title, description: o.description ?? '', campaign_type: o.campaign_type ?? '',
          location_country: o.location_country ?? '', location_region: o.location_region ?? '',
          budget_min: String(o.budget_min_usd ?? ''), budget_max: String(o.budget_max_usd ?? ''),
          budget_per: String(o.budget_per_fighter_usd ?? ''), max_fighters: String(o.max_fighters ?? 1),
          deadline: o.application_deadline ? o.application_deadline.slice(0, 10) : '',
          campaign_start: o.campaign_start ?? '', campaign_end: o.campaign_end ?? '',
          weight_classes: reqs.weight_classes ?? [], promotions: reqs.promotions ?? [],
          min_followers: String(reqs.min_followers ?? ''), visibility: o.visibility ?? 'public',
        })
        if ((o.deliverables as any[])?.length) setDeliverables(o.deliverables as Deliverable[])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id, isEdit])

  // Guard
  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return }
    if (user.role !== 'sponsor' && user.role !== 'admin') navigate('/dashboard/sponsor', { replace: true })
  }, [user, navigate])

  const buildPayload = (): OppInput & { title: string } => ({
    title:       form.title.trim(),
    description: form.description || undefined,
    campaign_type: (form.campaign_type || undefined) as any,
    location_country: form.location_country || undefined,
    location_region:  form.location_region || undefined,
    budget_min_usd: form.budget_min ? Number(form.budget_min) : undefined,
    budget_max_usd: form.budget_max ? Number(form.budget_max) : undefined,
    budget_per_fighter_usd: form.budget_per ? Number(form.budget_per) : undefined,
    max_fighters: Number(form.max_fighters) || 1,
    application_deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
    campaign_start: form.campaign_start || undefined,
    campaign_end:   form.campaign_end   || undefined,
    visibility: form.visibility as any,
    deliverables: deliverables.filter(d => d.type),
    requirements: {
      weight_classes: form.weight_classes,
      promotions:     form.promotions,
      min_followers:  form.min_followers ? Number(form.min_followers) : undefined,
    },
  })

  const save = async () => {
    if (!form.title.trim()) { setMsg('Title is required.'); return }
    setSaving(true); setMsg('')
    try {
      if (savedId) {
        await updateOpportunity(savedId, buildPayload())
        setMsg('Saved.')
      } else {
        const res = await createOpportunity(buildPayload())
        setSavedId(res.opportunity.id)
        setMsg('Draft saved.')
      }
      setTimeout(() => setMsg(''), 2500)
    } catch (e: any) { setMsg(e.message ?? 'Save failed.') }
    finally { setSaving(false) }
  }

  const publish = async () => {
    if (!form.title.trim()) { setMsg('Title is required.'); return }
    setPublishing(true); setMsg('')
    try {
      let oid = savedId
      if (!oid) {
        const res = await createOpportunity(buildPayload())
        oid = res.opportunity.id; setSavedId(oid)
      } else {
        await updateOpportunity(oid, buildPayload())
      }
      await publishOpportunity(oid)
      navigate('/sponsor/opportunities', { replace: true })
    } catch (e: any) { setMsg(e.message ?? 'Publish failed.') }
    finally { setPublishing(false) }
  }

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-charcoal-3 border-t-blood-glow rounded-full animate-spin" />
    </div>
  )

  const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-charcoal border border-charcoal-3 p-6 mb-4" style={{ borderLeft: '2px solid #8b0000' }}>
      <div className="font-condensed font-bold uppercase text-[10px] tracking-[0.3em] text-blood-glow mb-5">{title}</div>
      {children}
    </div>
  )

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />
      <div className="flex-1 px-6 py-20 max-w-3xl mx-auto w-full">

        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="sec-label mb-1">{isEdit ? 'Edit' : 'New'} Opportunity</div>
            <h1 className="font-display text-off-white uppercase" style={{ fontSize: 'clamp(28px,4vw,44px)', lineHeight: 0.92 }}>
              {isEdit ? 'Edit Opportunity' : 'Post an Opportunity'}
            </h1>
          </div>
        </div>

        <SectionCard title="Basics">
          <div className="space-y-4">
            <Field label="Title *" value={form.title} onChange={set('title')} placeholder="Nike Fight Kit Ambassador 2026" />
            <div>
              <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">Description</label>
              <textarea value={form.description} onChange={e => set('description')(e.target.value)} rows={5}
                placeholder="Describe the campaign, expectations, and brand values…"
                className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[14px] px-4 py-3 outline-none resize-none focus:border-blood" />
            </div>
            <div>
              <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2.5">Campaign Type</label>
              <div className="flex flex-wrap gap-2">
                {CAMPAIGN_TYPES.map(t => {
                  const on = form.campaign_type === t.value
                  return <button key={t.value} type="button" onClick={() => set('campaign_type')(on ? '' : t.value)}
                    className="font-condensed font-semibold uppercase text-[11px] tracking-[0.1em] px-3 py-1.5 border cursor-pointer transition-all"
                    style={{ borderColor: on ? '#8b0000' : '#222226', background: on ? 'rgba(139,0,0,0.12)' : '#141416', color: on ? '#f0ece4' : '#7a7672' }}>
                    {t.label}
                  </button>
                })}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Budget">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Min (USD)" type="number" value={form.budget_min} onChange={set('budget_min')} placeholder="5000" />
            <Field label="Max (USD)" type="number" value={form.budget_max} onChange={set('budget_max')} placeholder="25000" />
            <Field label="Per Fighter" type="number" value={form.budget_per} onChange={set('budget_per')} placeholder="optional" />
          </div>
          <div className="mt-3">
            <Field label="Max Fighters" type="number" value={form.max_fighters} onChange={set('max_fighters')} placeholder="1" />
          </div>
        </SectionCard>

        <SectionCard title="Deliverables">
          <div className="space-y-3 mb-4">
            {deliverables.map((d, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <select value={d.type} onChange={e => updDeliv(i, { type: e.target.value })}
                    className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none">
                    {DELIVERABLE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <input type="number" min="1" value={d.count} onChange={e => updDeliv(i, { count: Number(e.target.value) })}
                    className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none" placeholder="qty" />
                </div>
                <div className="col-span-4">
                  <input value={d.notes} onChange={e => updDeliv(i, { notes: e.target.value })}
                    className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none" placeholder="notes" />
                </div>
                <div className="col-span-1 text-center">
                  <button onClick={() => removeDeliv(i)} className="text-gray-3 hover:text-blood-glow bg-transparent border-0 cursor-pointer text-lg">×</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addDeliverable} className="btn-ghost text-[12px] py-1.5 px-4">+ Add Deliverable</button>
        </SectionCard>

        <SectionCard title="Fighter Requirements">
          <div className="space-y-5">
            <Field label="Min Followers (total)" type="number" value={form.min_followers} onChange={set('min_followers')} placeholder="10000" />
            <Chips label="Weight Classes (leave blank for any)" options={WEIGHT_CLASSES} selected={form.weight_classes} onToggle={toggleChip('weight_classes')} />
            <Chips label="Promotions (leave blank for any)" options={['UFC','ONE Championship','PFL','Bellator','Regional / Other']} selected={form.promotions} onToggle={toggleChip('promotions')} />
          </div>
        </SectionCard>

        <SectionCard title="Timeline & Visibility">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Field label="Application Deadline" type="date" value={form.deadline} onChange={set('deadline')} />
            <Field label="Campaign Start" type="date" value={form.campaign_start} onChange={set('campaign_start')} />
            <Field label="Campaign End" type="date" value={form.campaign_end} onChange={set('campaign_end')} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Field label="Country" value={form.location_country} onChange={set('location_country')} placeholder="US" />
            <Field label="Region" value={form.location_region} onChange={set('location_region')} placeholder="California" />
          </div>
          <div>
            <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2.5">Visibility</label>
            <div className="flex flex-wrap gap-2">
              {[{ value: 'public', label: 'Public Feed' }, { value: 'invited_only', label: 'Invite Only' }].map(v => {
                const on = form.visibility === v.value
                return <button key={v.value} type="button" onClick={() => set('visibility')(v.value)}
                  className="font-condensed font-semibold uppercase text-[11px] tracking-[0.1em] px-3 py-1.5 border cursor-pointer transition-all"
                  style={{ borderColor: on ? '#8b0000' : '#222226', background: on ? 'rgba(139,0,0,0.12)' : '#141416', color: on ? '#f0ece4' : '#7a7672' }}>
                  {v.label}
                </button>
              })}
            </div>
          </div>
        </SectionCard>

        {/* Actions */}
        <div className="flex items-center gap-4 mt-2">
          <button onClick={save} disabled={saving || publishing} className="btn-ghost">
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          <button onClick={publish} disabled={saving || publishing} className="btn-primary">
            {publishing ? 'Publishing…' : 'Publish Opportunity'}
          </button>
          {msg && <span className="font-condensed text-[12px] text-gray-2">{msg}</span>}
        </div>
      </div>
    </div>
  )
}
