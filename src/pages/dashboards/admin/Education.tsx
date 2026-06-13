import React, { useState, useEffect, useCallback } from 'react'
import { useApi } from '../../../hooks/useApi'
import {
  getAdminModules, createModule, updateModule, type AdminModule,
} from '../../../lib/api/admin'
import { setModuleStatus } from '../../../lib/api/education'
import { uploadFile } from '../../../lib/api/uploads'
import { DashSkeleton, ApiError, EmptyState } from '../DashWidgets'
import { DistBar } from './AdminCharts'
import { SubNav, FField, FSelect, ActionMsg, Spinner } from './AdminUtils'

const TABS = [
  { id: 'modules',   label: 'Modules'      },
  { id: 'progress',  label: 'Progress'     },
  { id: 'resources', label: 'Resources'    },
  { id: 'mentors',   label: 'Mentors'      },
]

// ── Module editor constants ───────────────────────────────────────────────────
const CATEGORIES = ['business', 'finance', 'contracts', 'branding', 'nil', 'camp', 'sponsor', 'transition']
const MODULE_TYPES = [
  { value: 'lesson',    label: 'Text Lesson'   },
  { value: 'video',     label: 'Video'         },
  { value: 'pdf',       label: 'PDF'           },
  { value: 'link',      label: 'External Link' },
  { value: 'checklist', label: 'Checklist'     },
  { value: 'mixed',     label: 'Mixed'         },
]
const BLANK_MODULE = {
  name: '', description: '', category: '', order_num: '100', is_published: false,
  estimated_mins: '', module_type: 'lesson', content_url: '', content_body: '',
  is_required: false, required_for_sponsorforge: false, audience: 'all_fighters', status: 'draft',
}

type EduChecklistItem = { id: string; text: string; required: boolean }

// ── PDF upload field ──────────────────────────────────────────────────────────
function PdfUploadField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr]             = useState('')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') { setErr('Only PDF files are allowed.'); return }
    setErr(''); setUploading(true)
    try {
      const { publicUrl } = await uploadFile('module-pdf', file)
      onChange(publicUrl)
    } catch (ex: any) {
      setErr(ex.message ?? 'Upload failed.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1.5">
        PDF File * <span className="font-normal normal-case tracking-normal text-[10px] text-gray-3">(max 10 MB)</span>
      </label>
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="font-condensed font-bold uppercase text-[10px] tracking-[0.15em] px-3 py-2 border border-charcoal-3 text-gray-2 hover:text-off-white hover:border-gray-2 disabled:opacity-40 cursor-pointer">
          {uploading ? 'Uploading…' : 'Choose PDF'}
        </button>
        <input ref={inputRef} type="file" accept="application/pdf" onChange={handleFile} className="hidden" />
        {value && !uploading && (
          <span className="font-condensed text-[11px] text-green-400 truncate max-w-xs">✓ {value.split('/').pop()}</span>
        )}
      </div>
      <FField label="" value={value} onChange={onChange} placeholder="or paste PDF URL / storage path"
        hint="Upload above or paste a URL" />
      {err && <p className="font-condensed text-[11px] text-blood-glow mt-1">{err}</p>}
    </div>
  )
}

// ── Checklist builder ─────────────────────────────────────────────────────────
function ChecklistBuilder({ items, onChange }: {
  items: EduChecklistItem[]
  onChange: (items: EduChecklistItem[]) => void
}) {
  const addItem = () => onChange([...items, { id: crypto.randomUUID(), text: '', required: true }])
  const remove  = (id: string) => onChange(items.filter(i => i.id !== id))
  const update  = (id: string, field: keyof EduChecklistItem, val: string | boolean) =>
    onChange(items.map(i => i.id === id ? { ...i, [field]: val } : i))

  return (
    <div className="space-y-2">
      <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 mb-1.5">Checklist Items</div>
      {items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-2">
          <span className="font-condensed text-[10px] text-gray-3 w-4">{idx + 1}.</span>
          <input value={item.text} onChange={e => update(item.id, 'text', e.target.value)}
            placeholder="Checklist item text…"
            className="flex-1 bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-1.5 outline-none" />
          <label className="flex items-center gap-1 cursor-pointer shrink-0">
            <input type="checkbox" checked={item.required} onChange={e => update(item.id, 'required', e.target.checked)}
              className="w-3 h-3 accent-red-700" />
            <span className="font-condensed text-[10px] text-gray-3">Req</span>
          </label>
          <button onClick={() => remove(item.id)} className="font-condensed text-[10px] text-blood-glow px-1">✕</button>
        </div>
      ))}
      <button onClick={addItem} className="font-condensed text-[10px] tracking-[0.15em] uppercase text-gray-3 hover:text-gray-1 py-1">
        + Add Item
      </button>
    </div>
  )
}

// ── Module editor ─────────────────────────────────────────────────────────────
function ModuleEditor({ initial, onSave, onCancel }: {
  initial?: Partial<AdminModule>
  onSave: (data: any) => Promise<void>
  onCancel: () => void
}) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState({
    ...BLANK_MODULE,
    ...(initial ? {
      name:           initial.name           ?? '',
      description:    initial.description    ?? '',
      category:       initial.category       ?? '',
      order_num:      String(initial.order_num ?? 100),
      is_published:   initial.is_published   ?? false,
      estimated_mins: initial.estimated_mins ? String(initial.estimated_mins) : '',
      module_type:    initial.module_type    ?? 'lesson',
      content_url:    initial.content_url    ?? '',
      content_body:   initial.content_body   ?? '',
      is_required:    initial.is_required    ?? false,
      required_for_sponsorforge: initial.required_for_sponsorforge ?? false,
      audience:       initial.audience       ?? 'all_fighters',
      status:         initial.status         ?? 'draft',
    } : {}),
  })

  const parseRawChecklist = (): EduChecklistItem[] => {
    try {
      const meta   = initial?.metadata
      const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta
      return Array.isArray(parsed?.checklist_items) ? parsed.checklist_items : []
    } catch { return [] }
  }
  const [checklistItems, setChecklistItems] = useState<EduChecklistItem[]>(parseRawChecklist)
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState<string | null>(null)

  const sf = (k: string) => (v: string | boolean) => setForm(p => ({ ...p, [k]: v }))
  const needsUrl  = ['video', 'pdf', 'link'].includes(form.module_type)
  const needsBody = ['lesson', 'mixed'].includes(form.module_type)
  const needsList = ['checklist', 'mixed'].includes(form.module_type)

  const submit = async () => {
    if (!form.name.trim()) { setErr('Module name is required.'); return }
    if (needsUrl && !form.content_url.trim()) { setErr('Content URL is required for this module type.'); return }
    setSaving(true); setErr(null)
    try {
      await onSave({
        name:           form.name.trim(),
        description:    form.description.trim() || null,
        category:       form.category || null,
        order_num:      Number(form.order_num) || 100,
        is_published:   form.status === 'published',
        estimated_mins: form.estimated_mins ? Number(form.estimated_mins) : null,
        content_url:    form.content_url.trim() || null,
        module_type:    form.module_type,
        content_body:   form.content_body.trim() || null,
        metadata:       { checklist_items: needsList ? checklistItems : [] },
        is_required:    form.is_required,
        required_for_sponsorforge: form.required_for_sponsorforge,
        audience:       form.audience,
        status:         form.status,
      })
    } catch (e: any) {
      setErr(e.message ?? 'Save failed.')
      setSaving(false)
    }
  }

  return (
    <div className="dash-card space-y-4" style={{ borderLeft: '2px solid #8b0000' }}>
      <div className="dash-label">{isEdit ? 'Edit Module' : 'New Module'}</div>

      <div className="grid grid-cols-2 gap-3">
        <FField label="Module Name *" value={form.name} onChange={sf('name')} placeholder="e.g. Taxes & Filing" required />
        <FField label="Order #" type="number" value={form.order_num} onChange={sf('order_num')} hint="Lower = shown first" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FSelect label="Category" value={form.category} onChange={sf('category') as any}
          options={CATEGORIES.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))} />
        <FSelect label="Module Type *" value={form.module_type} onChange={sf('module_type') as any}
          options={MODULE_TYPES} />
      </div>
      <div>
        <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1.5">Description</label>
        <textarea value={form.description} onChange={e => sf('description')(e.target.value)} rows={2}
          placeholder="What will fighters learn?"
          className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none resize-none" />
      </div>

      {needsUrl && form.module_type === 'pdf'  && <PdfUploadField value={form.content_url} onChange={sf('content_url')} />}
      {needsUrl && form.module_type !== 'pdf'  && (
        <FField label={form.module_type === 'video' ? 'Video URL *' : 'External URL *'}
          value={form.content_url} onChange={sf('content_url')} placeholder="https://…" />
      )}
      {needsBody && (
        <div>
          <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-1.5">
            Lesson Body {form.module_type === 'mixed' ? '(optional)' : '*'}
          </label>
          <textarea value={form.content_body} onChange={e => sf('content_body')(e.target.value)} rows={6}
            placeholder="Write the lesson content here…"
            className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[13px] px-3 py-2 outline-none resize-y" />
        </div>
      )}
      {needsBody && form.module_type === 'mixed' && (
        <FField label="Supplementary URL" value={form.content_url} onChange={sf('content_url')} placeholder="https://…" />
      )}
      {needsList && <ChecklistBuilder items={checklistItems} onChange={setChecklistItems} />}

      <div className="grid grid-cols-3 gap-3">
        <FField label="Est. Minutes" type="number" value={form.estimated_mins} onChange={sf('estimated_mins')} placeholder="30" />
        <FSelect label="Status" value={form.status} onChange={sf('status') as any}
          options={[{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' }]} />
        <FSelect label="Audience" value={form.audience} onChange={sf('audience') as any}
          options={[{ value: 'all_fighters', label: 'All Fighters' }, { value: 'fighters_only', label: 'Fighters Only' }]} />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_required} onChange={e => sf('is_required')(e.target.checked)}
          className="w-4 h-4 accent-red-700 cursor-pointer" />
        <span className="font-condensed text-[11px] text-gray-2 uppercase tracking-widest">Required for all fighters</span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.required_for_sponsorforge} onChange={e => sf('required_for_sponsorforge')(e.target.checked)}
          className="w-4 h-4 accent-red-700 cursor-pointer" />
        <span className="font-condensed text-[11px] text-gray-2 uppercase tracking-widest">Required for SponsorForge unlock</span>
      </label>

      {err && <p className="font-condensed text-[12px] text-blood-glow">{err}</p>}
      <div className="flex gap-3">
        <button onClick={submit} disabled={saving} className="btn-primary disabled:opacity-50"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saving ? <><Spinner /> Saving…</> : isEdit ? 'Save Changes' : 'Create Module'}
        </button>
        <button onClick={onCancel} className="btn-ghost text-[11px] py-2 px-4">Cancel</button>
      </div>
    </div>
  )
}

// ── Modules tab ───────────────────────────────────────────────────────────────
function ModulesTab() {
  const [modules,  setModules]  = useState<AdminModule[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [msg,      setMsg]      = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    getAdminModules()
      .then(d => { setModules(d.modules); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const handleCreate = async (data: any) => {
    await createModule(data); setMsg({ type: 'ok', text: 'Module created.' }); setEditId(null); load()
  }
  const handleUpdate = async (id: string, data: any) => {
    await updateModule(id, data); setMsg({ type: 'ok', text: 'Module saved.' }); setEditId(null); load()
  }
  const handleStatus = async (m: AdminModule, status: 'draft' | 'published' | 'archived') => {
    setActingId(m.id); setMsg(null)
    try {
      await setModuleStatus(m.id, status)
      setModules(prev => prev.map(x => x.id === m.id ? { ...x, status, is_published: status === 'published' } : x))
      setMsg({ type: 'ok', text: `Module ${status}.` })
    } catch (e: any) { setMsg({ type: 'err', text: e.message }) }
    finally { setActingId(null) }
  }

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} retry={load} />

  const published = modules.filter(m => m.status === 'published' || m.is_published).length
  const draft     = modules.filter(m => (m.status || 'draft') === 'draft' && !m.is_published).length
  const archived  = modules.filter(m => m.status === 'archived').length
  const required  = modules.filter(m => m.is_required).length
  const editingModule = editId && editId !== 'new' ? modules.find(m => m.id === editId) : undefined

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {[
          { label: 'Published', value: published, accent: '#00c060' },
          { label: 'Draft',     value: draft,     accent: '#c9a82c' },
          { label: 'Archived',  value: archived,  accent: '#4a4846' },
          { label: 'Required',  value: required,  accent: '#c00000' },
        ].map(({ label, value, accent }) => (
          <div key={label} className="bg-charcoal-2 border border-charcoal-3 px-3 py-2 text-center"
            style={{ borderTop: `2px solid ${accent}` }}>
            <div className="font-condensed text-[9px] font-bold uppercase tracking-[0.3em] text-gray-3 mb-0.5">{label}</div>
            <div className="font-display text-off-white" style={{ fontSize: 24, lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="font-condensed text-[9px] font-bold tracking-[0.35em] uppercase text-gray-3">
          {modules.length} Modules
        </span>
        <button onClick={() => { setEditId(editId === 'new' ? null : 'new'); setMsg(null) }}
          className="btn-ghost text-[11px] py-2 px-4">
          {editId === 'new' ? 'Cancel' : '+ New Module'}
        </button>
      </div>

      {msg && <p className={`font-condensed text-[12px] ${msg.type === 'ok' ? 'text-green-400' : 'text-blood-glow'}`}>{msg.text}</p>}

      {editId === 'new' && (
        <ModuleEditor onSave={handleCreate} onCancel={() => setEditId(null)} />
      )}
      {editId && editId !== 'new' && editingModule && (
        <ModuleEditor initial={editingModule} onSave={d => handleUpdate(editId, d)} onCancel={() => setEditId(null)} />
      )}

      {!modules.length ? (
        <EmptyState icon="○" title="No Modules Yet" body="Create your first education module above." />
      ) : (
        <div className="dash-card p-0 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-charcoal-3">
                {['#', 'Name', 'Type', 'Cat.', 'Req', 'Enrolled', 'Avg %', 'Status', 'Actions'].map(h => (
                  <th key={h} className="font-condensed text-[9px] font-bold uppercase tracking-[0.2em] text-gray-3 px-3 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map(m => (
                <tr key={m.id} className="border-b border-charcoal-3 last:border-0 hover:bg-charcoal-2/20 transition-colors">
                  <td className="font-condensed text-[11px] text-gray-3 px-3 py-2.5">{m.order_num}</td>
                  <td className="px-3 py-2.5 max-w-[180px]">
                    <div className="font-condensed font-bold text-[12px] text-off-white truncate">{m.name}</div>
                    {m.is_required && <span className="font-condensed text-[9px] text-blood-glow uppercase tracking-widest">Required</span>}
                  </td>
                  <td className="font-condensed text-[10px] text-gray-2 px-3 py-2.5 capitalize">{(m.module_type || 'lesson').replace('_', ' ')}</td>
                  <td className="font-condensed text-[10px] text-gray-2 px-3 py-2.5 capitalize">{m.category || '—'}</td>
                  <td className="font-condensed text-[10px] px-3 py-2.5" style={{ color: m.is_required ? '#C41E3A' : '#4a4846' }}>{m.is_required ? '✓' : '—'}</td>
                  <td className="font-condensed text-[11px] text-gray-2 px-3 py-2.5">{m.enrolled_count}</td>
                  <td className="font-condensed text-[11px] text-gray-2 px-3 py-2.5">{m.avg_completion}%</td>
                  <td className="px-3 py-2.5">
                    <span className="font-condensed text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-1 border"
                      style={{
                        borderColor: m.status === 'published' ? '#00c060' : m.status === 'archived' ? '#4a4846' : '#c9a82c',
                        color:       m.status === 'published' ? '#00c060' : m.status === 'archived' ? '#4a4846' : '#c9a82c',
                      }}>
                      {m.status ?? (m.is_published ? 'published' : 'draft')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button onClick={() => { setEditId(m.id); setMsg(null) }} disabled={editId === m.id}
                        className="font-condensed text-[9px] uppercase tracking-[0.1em] px-2 py-1 border border-charcoal-3 text-gray-2 hover:text-off-white hover:border-gray-2 disabled:opacity-40">
                        Edit
                      </button>
                      {(m.status || (m.is_published ? 'published' : 'draft')) !== 'published' ? (
                        <button onClick={() => handleStatus(m, 'published')} disabled={actingId === m.id}
                          className="font-condensed text-[9px] uppercase tracking-[0.1em] px-2 py-1 border disabled:opacity-40"
                          style={{ borderColor: '#2a5c2a', color: '#00c060' }}>
                          {actingId === m.id ? <Spinner /> : 'Publish'}
                        </button>
                      ) : (
                        <button onClick={() => handleStatus(m, 'draft')} disabled={actingId === m.id}
                          className="font-condensed text-[9px] uppercase tracking-[0.1em] px-2 py-1 border disabled:opacity-40"
                          style={{ borderColor: '#4a0000', color: '#c00000' }}>
                          {actingId === m.id ? <Spinner /> : 'Unpublish'}
                        </button>
                      )}
                      {(m.status || '') !== 'archived' && (
                        <button onClick={() => handleStatus(m, 'archived')} disabled={actingId === m.id}
                          className="font-condensed text-[9px] uppercase tracking-[0.1em] px-2 py-1 border border-charcoal-3 text-gray-3 hover:border-gray-2 disabled:opacity-40">
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Progress tab ──────────────────────────────────────────────────────────────
function ProgressTab() {
  const [modules, setModules] = useState<AdminModule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    getAdminModules()
      .then(d => { setModules(d.modules); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const withData = modules.filter(m => m.enrolled_count > 0)
  if (!withData.length) return (
    <EmptyState icon="○" title="No Progress Data Yet"
      body="Module completion analytics appear once fighters enroll in education modules." />
  )

  const completionData = withData.map(m => ({
    label: m.name.length > 18 ? m.name.slice(0, 18) + '…' : m.name,
    value: m.avg_completion,
    color: m.avg_completion >= 80 ? '#00c060' : m.avg_completion >= 50 ? '#c9a82c' : '#C41E3A',
  }))

  const enrollmentData = withData.map(m => ({
    label: m.name.length > 18 ? m.name.slice(0, 18) + '…' : m.name,
    value: m.enrolled_count,
    color: '#C41E3A',
  }))

  return (
    <div className="space-y-4">
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="dash-card">
          <div className="dash-label mb-3">Avg Completion by Module (%)</div>
          <DistBar data={completionData} />
        </div>
        <div className="dash-card">
          <div className="dash-label mb-3">Enrollment by Module</div>
          <DistBar data={enrollmentData} />
        </div>
      </div>

      {/* Completion table */}
      <div className="dash-card p-0 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-charcoal-3">
              {['Module', 'Enrolled', 'Avg Completion', 'Status'].map(h => (
                <th key={h} className="font-condensed text-[9px] font-bold uppercase tracking-[0.2em] text-gray-3 px-3 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withData.map(m => (
              <tr key={m.id} className="border-b border-charcoal-3 last:border-0">
                <td className="font-condensed text-[12px] font-bold text-off-white px-3 py-2.5">{m.name}</td>
                <td className="font-condensed text-[12px] text-gray-2 px-3 py-2.5">{m.enrolled_count}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div style={{ width: 60, height: 3, background: '#222226', borderRadius: 2 }}>
                      <div style={{
                        width: `${m.avg_completion}%`, height: '100%', borderRadius: 2,
                        background: m.avg_completion >= 80 ? '#00c060' : m.avg_completion >= 50 ? '#c9a82c' : '#C41E3A',
                      }} />
                    </div>
                    <span className="font-condensed text-[11px] text-gray-2">{m.avg_completion}%</span>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span className="font-condensed text-[9px] font-bold uppercase tracking-widest px-2 py-1 border"
                    style={{
                      borderColor: m.status === 'published' ? '#00c060' : '#c9a82c',
                      color:       m.status === 'published' ? '#00c060' : '#c9a82c',
                    }}>
                    {m.status ?? 'draft'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Resources tab ─────────────────────────────────────────────────────────────
function ResourcesTab() {
  return (
    <EmptyState icon="○" title="No Resources Yet"
      body="Education resources linked to modules will appear here once added from the module editor." />
  )
}

// ── Mentors tab ───────────────────────────────────────────────────────────────
function MentorsTab() {
  const { data, loading, error } = useApi<any>('/api/admin/consultants')
  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  const consultants  = data?.consultants ?? []
  const activeCount  = consultants.filter((c: any) => c.status === 'active').length

  return (
    <div className="space-y-5">
      {!consultants.length ? (
        <EmptyState icon="○" title="No Consultants Yet"
          body="No consultants added yet. Go to Content → Consultants to add them." />
      ) : (
        <>
          <div className="dash-card" style={{ maxWidth: 180 }}>
            <div className="dash-label">Active</div>
            <div className="font-display text-off-white mt-1" style={{ fontSize: 30 }}>{activeCount}</div>
          </div>
          <div className="space-y-2">
            {consultants.map((c: any, i: number) => (
              <div key={i} className="dash-card flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-condensed text-[13px] font-bold text-off-white">{c.name}</div>
                  {c.specialty && <div className="font-condensed text-[10px] text-gray-3">{c.specialty}</div>}
                </div>
                <span className="font-condensed text-[9px] font-bold uppercase tracking-widest px-2 py-1 border"
                  style={{ borderColor: c.status === 'active' ? '#00c060' : '#4a4846', color: c.status === 'active' ? '#00c060' : '#4a4846' }}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Zone export ───────────────────────────────────────────────────────────────
export default function Education() {
  const [sub, setSub] = useState('modules')
  return (
    <div>
      <SubNav tabs={TABS} active={sub} onChange={setSub} />
      {sub === 'modules'   && <ModulesTab />}
      {sub === 'progress'  && <ProgressTab />}
      {sub === 'resources' && <ResourcesTab />}
      {sub === 'mentors'   && <MentorsTab />}
    </div>
  )
}
