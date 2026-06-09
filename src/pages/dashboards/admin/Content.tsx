import React, { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiPatch } from '../../../lib/api/client'
import { DashSkeleton, ApiError, EmptyState } from '../DashWidgets'
import { SubNav, FField, FSelect, ActionMsg, Spinner } from './AdminUtils'

const TABS = [
  { id: 'podcast',     label: 'Podcast'     },
  { id: 'apparel',     label: 'Apparel'     },
  { id: 'consultants', label: 'Consultants' },
]

const STATUS_COLORS: Record<string, string> = {
  draft:     '#c9a82c',
  published: '#00c060',
  archived:  '#4a4846',
  active:    '#00c060',
  inactive:  '#c9a82c',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="font-condensed text-[9px] font-bold uppercase tracking-widest px-2 py-1 border"
      style={{ borderColor: STATUS_COLORS[status] ?? '#4a4846', color: STATUS_COLORS[status] ?? '#4a4846' }}>
      {status}
    </span>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// PODCAST TAB
// ═════════════════════════════════════════════════════════════════════════════

const BLANK_EPISODE = {
  title: '', description: '', episode_number: '', season: '1',
  spotify_url: '', apple_url: '', youtube_url: '', embed_url: '',
  thumbnail_path: '', duration: '', published_at: '', sort_order: '100',
}

function PodcastTab() {
  const [episodes, setEpisodes] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [actingId, setActingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...BLANK_EPISODE })
  const setF = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  const load = useCallback(() => {
    setLoading(true); setError(null)
    apiGet('/api/admin/podcast')
      .then(d => { setEpisodes(d.episodes ?? []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!form.title.trim()) { setMsg({ type: 'err', text: 'Title is required.' }); return }
    setSaving(true); setMsg(null)
    try {
      await apiPost('/api/admin/podcast', {
        title:          form.title.trim(),
        description:    form.description.trim() || null,
        episode_number: form.episode_number ? Number(form.episode_number) : null,
        season:         Number(form.season) || 1,
        spotify_url:    form.spotify_url.trim()    || null,
        apple_url:      form.apple_url.trim()      || null,
        youtube_url:    form.youtube_url.trim()    || null,
        embed_url:      form.embed_url.trim()      || null,
        thumbnail_path: form.thumbnail_path.trim() || null,
        duration:       form.duration.trim()       || null,
        published_at:   form.published_at          || null,
        sort_order:     Number(form.sort_order) || 100,
      })
      setMsg({ type: 'ok', text: 'Episode created.' })
      setForm({ ...BLANK_EPISODE }); setShowForm(false); load()
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message })
    } finally { setSaving(false) }
  }

  const saveEdit = async (id: string) => {
    setSaving(true); setMsg(null)
    try {
      const f = editForm
      await apiPatch(`/api/admin/podcast/${id}`, {
        title:          f.title?.trim()         || undefined,
        description:    f.description?.trim()   || null,
        episode_number: f.episode_number != null ? (Number(f.episode_number) || null) : undefined,
        season:         f.season != null ? (Number(f.season) || 1) : undefined,
        spotify_url:    f.spotify_url?.trim()   || null,
        apple_url:      f.apple_url?.trim()     || null,
        youtube_url:    f.youtube_url?.trim()   || null,
        embed_url:      f.embed_url?.trim()     || null,
        thumbnail_path: f.thumbnail_path?.trim()|| null,
        duration:       f.duration?.trim()      || null,
        published_at:   f.published_at          || null,
        sort_order:     Number(f.sort_order) || 100,
      })
      setMsg({ type: 'ok', text: 'Saved.' }); setEditId(null); load()
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message })
    } finally { setSaving(false) }
  }

  const setStatus = async (id: string, status: string) => {
    setActingId(id)
    try {
      await apiPatch(`/api/admin/podcast/${id}/status`, { status })
      load()
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message })
    } finally { setActingId(null) }
  }

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-condensed text-[11px] text-gray-3">{episodes.length} episode{episodes.length !== 1 ? 's' : ''}</div>
        <button onClick={() => { setShowForm(v => !v); setMsg(null) }}
          className="font-condensed text-[10px] font-bold tracking-[0.2em] uppercase px-4 py-2 border border-charcoal-3 hover:border-blood/50 text-gray-2 hover:text-off-white transition-all">
          {showForm ? '✕ Cancel' : '+ New Episode'}
        </button>
      </div>

      <ActionMsg msg={msg} />

      {showForm && (
        <div className="dash-card space-y-3">
          <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-gray-3 mb-3">New Episode</div>
          <div className="grid gap-3 grid-cols-2">
            <FField label="Title" value={form.title} onChange={setF('title')} required />
            <div className="grid grid-cols-2 gap-3">
              <FField label="Ep #" value={form.episode_number} onChange={setF('episode_number')} type="number" placeholder="12" />
              <FField label="Season" value={form.season} onChange={setF('season')} type="number" placeholder="1" />
            </div>
          </div>
          <FField label="Description" value={form.description} onChange={setF('description')} />
          <div className="grid gap-3 grid-cols-2">
            <FField label="Spotify URL" value={form.spotify_url} onChange={setF('spotify_url')} placeholder="https://open.spotify.com/…" />
            <FField label="Apple URL"   value={form.apple_url}   onChange={setF('apple_url')}   placeholder="https://podcasts.apple.com/…" />
            <FField label="YouTube URL" value={form.youtube_url} onChange={setF('youtube_url')} placeholder="https://youtube.com/…" />
            <FField label="Embed URL"   value={form.embed_url}   onChange={setF('embed_url')}   placeholder="https://…/embed" />
          </div>
          <div className="grid gap-3 grid-cols-3">
            <FField label="Thumbnail Path" value={form.thumbnail_path} onChange={setF('thumbnail_path')} />
            <FField label="Duration"       value={form.duration}       onChange={setF('duration')}       placeholder="42m" />
            <FField label="Sort Order"     value={form.sort_order}     onChange={setF('sort_order')}     type="number" />
          </div>
          <FField label="Publish Date" value={form.published_at} onChange={setF('published_at')} type="datetime-local" />
          <div className="flex gap-3 pt-1">
            <button onClick={submit} disabled={saving}
              className="btn-primary flex items-center gap-2 text-[11px]">
              {saving && <Spinner />} Create Episode
            </button>
            <button onClick={() => { setShowForm(false); setMsg(null) }}
              className="font-condensed text-[10px] font-bold uppercase text-gray-3 hover:text-off-white px-3 py-2 bg-transparent border-0 cursor-pointer transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {episodes.length === 0 ? (
        <EmptyState icon="🎙" title="No Episodes Yet" body="Create your first podcast episode above." />
      ) : (
        <div className="dash-card p-0 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-charcoal-3">
                {['Ep', 'Title', 'Duration', 'Status', 'Actions'].map(h => (
                  <th key={h} className="font-condensed text-[9px] font-bold uppercase tracking-[0.2em] text-gray-3 px-3 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {episodes.map(ep => (
                <React.Fragment key={ep.id}>
                  <tr className="border-b border-charcoal-3 last:border-0">
                    <td className="font-condensed text-[11px] text-blood-glow px-3 py-2.5 whitespace-nowrap">
                      {ep.season && ep.episode_number ? `S${ep.season}E${ep.episode_number}` : ep.episode_number ? `E${ep.episode_number}` : '—'}
                    </td>
                    <td className="font-condensed text-[12px] font-bold text-off-white px-3 py-2.5 max-w-[240px] truncate">{ep.title}</td>
                    <td className="font-condensed text-[11px] text-gray-3 px-3 py-2.5 whitespace-nowrap">{ep.duration ?? '—'}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={ep.status} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => { setEditId(editId === ep.id ? null : ep.id); setEditForm({ ...ep, episode_number: ep.episode_number ?? '', season: ep.season ?? '1', sort_order: ep.sort_order ?? '100', published_at: ep.published_at ? ep.published_at.slice(0, 16) : '' }) }}
                          className="font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border border-charcoal-3 text-gray-3 hover:text-off-white hover:border-off-white/30 transition-all cursor-pointer">
                          {editId === ep.id ? 'Close' : 'Edit'}
                        </button>
                        {ep.status !== 'published' && (
                          <button disabled={actingId === ep.id} onClick={() => setStatus(ep.id, 'published')}
                            className="font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border border-green-900 text-green-500 hover:border-green-700 transition-all cursor-pointer">
                            Publish
                          </button>
                        )}
                        {ep.status === 'published' && (
                          <button disabled={actingId === ep.id} onClick={() => setStatus(ep.id, 'draft')}
                            className="font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border border-charcoal-3 text-gray-3 hover:text-off-white hover:border-off-white/30 transition-all cursor-pointer">
                            Unpublish
                          </button>
                        )}
                        {ep.status !== 'archived' && (
                          <button disabled={actingId === ep.id} onClick={() => setStatus(ep.id, 'archived')}
                            className="font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border border-blood/30 text-blood-glow hover:border-blood transition-all cursor-pointer">
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {editId === ep.id && (
                    <tr className="border-b border-charcoal-3">
                      <td colSpan={5} className="px-3 py-4 bg-charcoal-2">
                        <div className="space-y-3">
                          <div className="grid gap-3 grid-cols-2">
                            <FField label="Title" value={editForm.title ?? ''} onChange={v => setEditForm(p => ({ ...p, title: v }))} required />
                            <div className="grid grid-cols-2 gap-3">
                              <FField label="Ep #" value={editForm.episode_number ?? ''} onChange={v => setEditForm(p => ({ ...p, episode_number: v }))} type="number" />
                              <FField label="Season" value={editForm.season ?? '1'} onChange={v => setEditForm(p => ({ ...p, season: v }))} type="number" />
                            </div>
                          </div>
                          <FField label="Description" value={editForm.description ?? ''} onChange={v => setEditForm(p => ({ ...p, description: v }))} />
                          <div className="grid gap-3 grid-cols-2">
                            <FField label="Spotify URL"    value={editForm.spotify_url    ?? ''} onChange={v => setEditForm(p => ({ ...p, spotify_url: v }))} />
                            <FField label="Apple URL"      value={editForm.apple_url      ?? ''} onChange={v => setEditForm(p => ({ ...p, apple_url: v }))} />
                            <FField label="YouTube URL"    value={editForm.youtube_url    ?? ''} onChange={v => setEditForm(p => ({ ...p, youtube_url: v }))} />
                            <FField label="Embed URL"      value={editForm.embed_url      ?? ''} onChange={v => setEditForm(p => ({ ...p, embed_url: v }))} />
                          </div>
                          <div className="grid gap-3 grid-cols-3">
                            <FField label="Thumbnail Path" value={editForm.thumbnail_path ?? ''} onChange={v => setEditForm(p => ({ ...p, thumbnail_path: v }))} />
                            <FField label="Duration"       value={editForm.duration       ?? ''} onChange={v => setEditForm(p => ({ ...p, duration: v }))} />
                            <FField label="Sort Order"     value={editForm.sort_order     ?? '100'} onChange={v => setEditForm(p => ({ ...p, sort_order: v }))} type="number" />
                          </div>
                          <FField label="Publish Date" value={editForm.published_at ?? ''} onChange={v => setEditForm(p => ({ ...p, published_at: v }))} type="datetime-local" />
                          <div className="flex gap-3 pt-1">
                            <button onClick={() => saveEdit(ep.id)} disabled={saving}
                              className="btn-primary flex items-center gap-2 text-[11px]">
                              {saving && <Spinner />} Save
                            </button>
                            <button onClick={() => setEditId(null)}
                              className="font-condensed text-[10px] font-bold uppercase text-gray-3 hover:text-off-white px-3 py-2 bg-transparent border-0 cursor-pointer transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// APPAREL TAB
// ═════════════════════════════════════════════════════════════════════════════

const BLANK_PRODUCT = {
  name: '', description: '', price_display: '', category: '',
  image_path: '', external_url: '', featured: 'false', sort_order: '100',
}

function ApparelTab() {
  const [products, setProducts] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [actingId, setActingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...BLANK_PRODUCT })
  const setF = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  const load = useCallback(() => {
    setLoading(true); setError(null)
    apiGet('/api/admin/apparel')
      .then(d => { setProducts(d.products ?? []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!form.name.trim()) { setMsg({ type: 'err', text: 'Name is required.' }); return }
    setSaving(true); setMsg(null)
    try {
      await apiPost('/api/admin/apparel', {
        name:         form.name.trim(),
        description:  form.description.trim()  || null,
        price_display: form.price_display.trim() || null,
        category:     form.category.trim()     || null,
        image_path:   form.image_path.trim()   || null,
        external_url: form.external_url.trim() || null,
        featured:     form.featured === 'true',
        sort_order:   Number(form.sort_order) || 100,
      })
      setMsg({ type: 'ok', text: 'Product created.' })
      setForm({ ...BLANK_PRODUCT }); setShowForm(false); load()
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message })
    } finally { setSaving(false) }
  }

  const saveEdit = async (id: string) => {
    setSaving(true); setMsg(null)
    try {
      const f = editForm
      await apiPatch(`/api/admin/apparel/${id}`, {
        name:         f.name?.trim()         || undefined,
        description:  f.description?.trim()  || null,
        price_display: f.price_display?.trim() || null,
        category:     f.category?.trim()     || null,
        image_path:   f.image_path?.trim()   || null,
        external_url: f.external_url?.trim() || null,
        featured:     f.featured === 'true',
        sort_order:   Number(f.sort_order) || 100,
      })
      setMsg({ type: 'ok', text: 'Saved.' }); setEditId(null); load()
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message })
    } finally { setSaving(false) }
  }

  const setStatus = async (id: string, status: string) => {
    setActingId(id)
    try {
      await apiPatch(`/api/admin/apparel/${id}/status`, { status })
      load()
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message })
    } finally { setActingId(null) }
  }

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-condensed text-[11px] text-gray-3">{products.length} product{products.length !== 1 ? 's' : ''}</div>
        <button onClick={() => { setShowForm(v => !v); setMsg(null) }}
          className="font-condensed text-[10px] font-bold tracking-[0.2em] uppercase px-4 py-2 border border-charcoal-3 hover:border-blood/50 text-gray-2 hover:text-off-white transition-all">
          {showForm ? '✕ Cancel' : '+ New Product'}
        </button>
      </div>

      <ActionMsg msg={msg} />

      {showForm && (
        <div className="dash-card space-y-3">
          <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-gray-3 mb-3">New Product</div>
          <div className="grid gap-3 grid-cols-2">
            <FField label="Name" value={form.name} onChange={setF('name')} required />
            <FField label="Price Display" value={form.price_display} onChange={setF('price_display')} placeholder="$45" />
          </div>
          <FField label="Description" value={form.description} onChange={setF('description')} />
          <div className="grid gap-3 grid-cols-2">
            <FField label="Category"     value={form.category}     onChange={setF('category')}     placeholder="hoodie" />
            <FField label="Image Path"   value={form.image_path}   onChange={setF('image_path')}   placeholder="/apparel/…" />
            <FField label="External URL" value={form.external_url} onChange={setF('external_url')} placeholder="https://…" />
            <FField label="Sort Order"   value={form.sort_order}   onChange={setF('sort_order')}   type="number" />
          </div>
          <FSelect label="Featured" value={form.featured} onChange={setF('featured')}
            options={[{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes — show first' }]} />
          <div className="flex gap-3 pt-1">
            <button onClick={submit} disabled={saving}
              className="btn-primary flex items-center gap-2 text-[11px]">
              {saving && <Spinner />} Create Product
            </button>
            <button onClick={() => { setShowForm(false); setMsg(null) }}
              className="font-condensed text-[10px] font-bold uppercase text-gray-3 hover:text-off-white px-3 py-2 bg-transparent border-0 cursor-pointer transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <EmptyState icon="👕" title="No Products Yet" body="Create your first apparel product above." />
      ) : (
        <div className="dash-card p-0 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-charcoal-3">
                {['Name', 'Category', 'Price', 'Featured', 'Status', 'Actions'].map(h => (
                  <th key={h} className="font-condensed text-[9px] font-bold uppercase tracking-[0.2em] text-gray-3 px-3 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <React.Fragment key={p.id}>
                  <tr className="border-b border-charcoal-3 last:border-0">
                    <td className="font-condensed text-[12px] font-bold text-off-white px-3 py-2.5 max-w-[180px] truncate">{p.name}</td>
                    <td className="font-condensed text-[11px] text-gray-3 px-3 py-2.5">{p.category ?? '—'}</td>
                    <td className="font-condensed text-[11px] text-gray-3 px-3 py-2.5 whitespace-nowrap">{p.price_display ?? '—'}</td>
                    <td className="font-condensed text-[11px] px-3 py-2.5" style={{ color: p.featured ? '#00c060' : '#4a4846' }}>
                      {p.featured ? 'Yes' : 'No'}
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={p.status} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => { setEditId(editId === p.id ? null : p.id); setEditForm({ ...p, featured: p.featured ? 'true' : 'false', sort_order: String(p.sort_order ?? 100) }) }}
                          className="font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border border-charcoal-3 text-gray-3 hover:text-off-white hover:border-off-white/30 transition-all cursor-pointer">
                          {editId === p.id ? 'Close' : 'Edit'}
                        </button>
                        {p.status !== 'published' && (
                          <button disabled={actingId === p.id} onClick={() => setStatus(p.id, 'published')}
                            className="font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border border-green-900 text-green-500 hover:border-green-700 transition-all cursor-pointer">
                            Publish
                          </button>
                        )}
                        {p.status === 'published' && (
                          <button disabled={actingId === p.id} onClick={() => setStatus(p.id, 'draft')}
                            className="font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border border-charcoal-3 text-gray-3 hover:text-off-white hover:border-off-white/30 transition-all cursor-pointer">
                            Unpublish
                          </button>
                        )}
                        {p.status !== 'archived' && (
                          <button disabled={actingId === p.id} onClick={() => setStatus(p.id, 'archived')}
                            className="font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border border-blood/30 text-blood-glow hover:border-blood transition-all cursor-pointer">
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {editId === p.id && (
                    <tr className="border-b border-charcoal-3">
                      <td colSpan={6} className="px-3 py-4 bg-charcoal-2">
                        <div className="space-y-3">
                          <div className="grid gap-3 grid-cols-2">
                            <FField label="Name" value={editForm.name ?? ''} onChange={v => setEditForm(f => ({ ...f, name: v }))} required />
                            <FField label="Price Display" value={editForm.price_display ?? ''} onChange={v => setEditForm(f => ({ ...f, price_display: v }))} />
                          </div>
                          <FField label="Description" value={editForm.description ?? ''} onChange={v => setEditForm(f => ({ ...f, description: v }))} />
                          <div className="grid gap-3 grid-cols-2">
                            <FField label="Category"     value={editForm.category     ?? ''} onChange={v => setEditForm(f => ({ ...f, category: v }))} />
                            <FField label="Image Path"   value={editForm.image_path   ?? ''} onChange={v => setEditForm(f => ({ ...f, image_path: v }))} />
                            <FField label="External URL" value={editForm.external_url ?? ''} onChange={v => setEditForm(f => ({ ...f, external_url: v }))} />
                            <FField label="Sort Order"   value={editForm.sort_order   ?? '100'} onChange={v => setEditForm(f => ({ ...f, sort_order: v }))} type="number" />
                          </div>
                          <FSelect label="Featured" value={editForm.featured ?? 'false'} onChange={v => setEditForm(f => ({ ...f, featured: v }))}
                            options={[{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes — show first' }]} />
                          <div className="flex gap-3 pt-1">
                            <button onClick={() => saveEdit(p.id)} disabled={saving}
                              className="btn-primary flex items-center gap-2 text-[11px]">
                              {saving && <Spinner />} Save
                            </button>
                            <button onClick={() => setEditId(null)}
                              className="font-condensed text-[10px] font-bold uppercase text-gray-3 hover:text-off-white px-3 py-2 bg-transparent border-0 cursor-pointer transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// CONSULTANTS TAB
// ═════════════════════════════════════════════════════════════════════════════

const BLANK_CONSULTANT = {
  name: '', title: '', specialty: '', bio: '', email: '', phone: '',
  booking_url: '', image_path: '', location: '', tags: '', audience: 'all',
  hourly_rate_usd: '', linkedin_url: '', sort_order: '100',
}

const AUDIENCE_OPTIONS = [
  { value: 'all',     label: 'All Roles'  },
  { value: 'fighter', label: 'Fighters'   },
  { value: 'manager', label: 'Managers'   },
  { value: 'sponsor', label: 'Sponsors'   },
]

function ConsultantsTab() {
  const [consultants, setConsultants] = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [showForm,    setShowForm]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [msg,         setMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [editId,      setEditId]      = useState<string | null>(null)
  const [editForm,    setEditForm]    = useState<Record<string, string>>({})
  const [actingId,    setActingId]    = useState<string | null>(null)
  const [form, setForm] = useState({ ...BLANK_CONSULTANT })
  const setF = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  const load = useCallback(() => {
    setLoading(true); setError(null)
    apiGet('/api/admin/consultants')
      .then(d => { setConsultants(d.consultants ?? []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const parseTags = (v: string) => v ? v.split(',').map(t => t.trim()).filter(Boolean) : []

  const submit = async () => {
    if (!form.name.trim()) { setMsg({ type: 'err', text: 'Name is required.' }); return }
    setSaving(true); setMsg(null)
    try {
      await apiPost('/api/admin/consultants', {
        name:            form.name.trim(),
        title:           form.title.trim()       || null,
        specialty:       form.specialty.trim()   || null,
        bio:             form.bio.trim()         || null,
        email:           form.email.trim()       || null,
        phone:           form.phone.trim()       || null,
        booking_url:     form.booking_url.trim() || null,
        image_path:      form.image_path.trim()  || null,
        location:        form.location.trim()    || null,
        tags:            parseTags(form.tags),
        audience:        form.audience || 'all',
        hourly_rate_usd: form.hourly_rate_usd ? Number(form.hourly_rate_usd) : null,
        linkedin_url:    form.linkedin_url.trim()|| null,
        sort_order:      Number(form.sort_order) || 100,
      })
      setMsg({ type: 'ok', text: 'Consultant added.' })
      setForm({ ...BLANK_CONSULTANT }); setShowForm(false); load()
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message })
    } finally { setSaving(false) }
  }

  const saveEdit = async (id: string) => {
    setSaving(true); setMsg(null)
    try {
      const f = editForm
      await apiPatch(`/api/admin/consultants/${id}`, {
        name:            f.name?.trim()         || undefined,
        title:           f.title?.trim()        || null,
        specialty:       f.specialty?.trim()    || null,
        bio:             f.bio?.trim()          || null,
        email:           f.email?.trim()        || null,
        phone:           f.phone?.trim()        || null,
        booking_url:     f.booking_url?.trim()  || null,
        image_path:      f.image_path?.trim()   || null,
        location:        f.location?.trim()     || null,
        tags:            parseTags(f.tags ?? ''),
        audience:        f.audience || 'all',
        hourly_rate_usd: f.hourly_rate_usd ? Number(f.hourly_rate_usd) : null,
        linkedin_url:    f.linkedin_url?.trim() || null,
        sort_order:      Number(f.sort_order) || 100,
      })
      setMsg({ type: 'ok', text: 'Saved.' }); setEditId(null); load()
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message })
    } finally { setSaving(false) }
  }

  const setStatus = async (id: string, status: string) => {
    setActingId(id)
    try {
      await apiPatch(`/api/admin/consultants/${id}/status`, { status })
      load()
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message })
    } finally { setActingId(null) }
  }

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-condensed text-[11px] text-gray-3">{consultants.length} consultant{consultants.length !== 1 ? 's' : ''}</div>
        <button onClick={() => { setShowForm(v => !v); setMsg(null) }}
          className="font-condensed text-[10px] font-bold tracking-[0.2em] uppercase px-4 py-2 border border-charcoal-3 hover:border-blood/50 text-gray-2 hover:text-off-white transition-all">
          {showForm ? '✕ Cancel' : '+ New Consultant'}
        </button>
      </div>

      <ActionMsg msg={msg} />

      {showForm && (
        <div className="dash-card space-y-3">
          <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-gray-3 mb-3">New Consultant</div>
          <div className="grid gap-3 grid-cols-2">
            <FField label="Name"      value={form.name}      onChange={setF('name')}      required />
            <FField label="Title"     value={form.title}     onChange={setF('title')}     placeholder="Combat Sports Attorney" />
            <FField label="Specialty" value={form.specialty} onChange={setF('specialty')} placeholder="Contract Law" />
            <FField label="Location"  value={form.location}  onChange={setF('location')}  placeholder="Las Vegas, NV" />
          </div>
          <FField label="Bio" value={form.bio} onChange={setF('bio')} />
          <div className="grid gap-3 grid-cols-2">
            <FField label="Email"       value={form.email}       onChange={setF('email')}       type="email" />
            <FField label="Phone"       value={form.phone}       onChange={setF('phone')}        placeholder="+1 555…" />
            <FField label="Booking URL" value={form.booking_url} onChange={setF('booking_url')}  placeholder="https://calendly.com/…" />
            <FField label="LinkedIn URL" value={form.linkedin_url} onChange={setF('linkedin_url')} placeholder="https://linkedin.com/in/…" />
            <FField label="Image Path"  value={form.image_path}  onChange={setF('image_path')}   placeholder="/mentors/…" />
            <FField label="Hourly Rate (USD)" value={form.hourly_rate_usd} onChange={setF('hourly_rate_usd')} type="number" placeholder="150" />
          </div>
          <div className="grid gap-3 grid-cols-2">
            <FField label="Tags (comma-separated)" value={form.tags} onChange={setF('tags')} placeholder="contracts, legal, NIL" />
            <FField label="Sort Order" value={form.sort_order} onChange={setF('sort_order')} type="number" />
          </div>
          <FSelect label="Audience" value={form.audience} onChange={setF('audience')} options={AUDIENCE_OPTIONS} />
          <div className="flex gap-3 pt-1">
            <button onClick={submit} disabled={saving}
              className="btn-primary flex items-center gap-2 text-[11px]">
              {saving && <Spinner />} Add Consultant
            </button>
            <button onClick={() => { setShowForm(false); setMsg(null) }}
              className="font-condensed text-[10px] font-bold uppercase text-gray-3 hover:text-off-white px-3 py-2 bg-transparent border-0 cursor-pointer transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {consultants.length === 0 ? (
        <EmptyState icon="○" title="No Consultants Yet" body="Add your first consultant above." />
      ) : (
        <div className="dash-card p-0 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-charcoal-3">
                {['Name', 'Specialty', 'Audience', 'Rate', 'Status', 'Actions'].map(h => (
                  <th key={h} className="font-condensed text-[9px] font-bold uppercase tracking-[0.2em] text-gray-3 px-3 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {consultants.map(c => (
                <React.Fragment key={c.id}>
                  <tr className="border-b border-charcoal-3 last:border-0">
                    <td className="px-3 py-2.5">
                      <div className="font-condensed text-[12px] font-bold text-off-white">{c.name}</div>
                      {c.title && <div className="font-condensed text-[10px] text-gray-3">{c.title}</div>}
                    </td>
                    <td className="font-condensed text-[11px] text-gray-3 px-3 py-2.5">{c.specialty ?? '—'}</td>
                    <td className="font-condensed text-[10px] uppercase tracking-wide px-3 py-2.5 text-gray-3">{c.audience ?? 'all'}</td>
                    <td className="font-condensed text-[11px] text-gray-3 px-3 py-2.5 whitespace-nowrap">
                      {c.hourly_rate_usd ? `$${c.hourly_rate_usd}/hr` : '—'}
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => { setEditId(editId === c.id ? null : c.id); setEditForm({ ...c, tags: Array.isArray(c.tags) ? c.tags.join(', ') : '', hourly_rate_usd: c.hourly_rate_usd ? String(c.hourly_rate_usd) : '', sort_order: String(c.sort_order ?? 100) }) }}
                          className="font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border border-charcoal-3 text-gray-3 hover:text-off-white hover:border-off-white/30 transition-all cursor-pointer">
                          {editId === c.id ? 'Close' : 'Edit'}
                        </button>
                        {c.status !== 'active' && (
                          <button disabled={actingId === c.id} onClick={() => setStatus(c.id, 'active')}
                            className="font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border border-green-900 text-green-500 hover:border-green-700 transition-all cursor-pointer">
                            Activate
                          </button>
                        )}
                        {c.status === 'active' && (
                          <button disabled={actingId === c.id} onClick={() => setStatus(c.id, 'inactive')}
                            className="font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border border-charcoal-3 text-gray-3 hover:text-off-white hover:border-off-white/30 transition-all cursor-pointer">
                            Deactivate
                          </button>
                        )}
                        {c.status !== 'archived' && (
                          <button disabled={actingId === c.id} onClick={() => setStatus(c.id, 'archived')}
                            className="font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border border-blood/30 text-blood-glow hover:border-blood transition-all cursor-pointer">
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {editId === c.id && (
                    <tr className="border-b border-charcoal-3">
                      <td colSpan={6} className="px-3 py-4 bg-charcoal-2">
                        <div className="space-y-3">
                          <div className="grid gap-3 grid-cols-2">
                            <FField label="Name"      value={editForm.name      ?? ''} onChange={v => setEditForm(f => ({ ...f, name: v }))}      required />
                            <FField label="Title"     value={editForm.title     ?? ''} onChange={v => setEditForm(f => ({ ...f, title: v }))}     />
                            <FField label="Specialty" value={editForm.specialty ?? ''} onChange={v => setEditForm(f => ({ ...f, specialty: v }))} />
                            <FField label="Location"  value={editForm.location  ?? ''} onChange={v => setEditForm(f => ({ ...f, location: v }))}  />
                          </div>
                          <FField label="Bio" value={editForm.bio ?? ''} onChange={v => setEditForm(f => ({ ...f, bio: v }))} />
                          <div className="grid gap-3 grid-cols-2">
                            <FField label="Email"       value={editForm.email       ?? ''} onChange={v => setEditForm(f => ({ ...f, email: v }))}       type="email" />
                            <FField label="Phone"       value={editForm.phone       ?? ''} onChange={v => setEditForm(f => ({ ...f, phone: v }))}       />
                            <FField label="Booking URL" value={editForm.booking_url ?? ''} onChange={v => setEditForm(f => ({ ...f, booking_url: v }))} />
                            <FField label="LinkedIn URL" value={editForm.linkedin_url ?? ''} onChange={v => setEditForm(f => ({ ...f, linkedin_url: v }))} />
                            <FField label="Image Path"  value={editForm.image_path  ?? ''} onChange={v => setEditForm(f => ({ ...f, image_path: v }))}  />
                            <FField label="Hourly Rate (USD)" value={editForm.hourly_rate_usd ?? ''} onChange={v => setEditForm(f => ({ ...f, hourly_rate_usd: v }))} type="number" />
                          </div>
                          <div className="grid gap-3 grid-cols-2">
                            <FField label="Tags (comma-separated)" value={editForm.tags ?? ''} onChange={v => setEditForm(f => ({ ...f, tags: v }))} />
                            <FField label="Sort Order" value={editForm.sort_order ?? '100'} onChange={v => setEditForm(f => ({ ...f, sort_order: v }))} type="number" />
                          </div>
                          <FSelect label="Audience" value={editForm.audience ?? 'all'} onChange={v => setEditForm(f => ({ ...f, audience: v }))} options={AUDIENCE_OPTIONS} />
                          <div className="flex gap-3 pt-1">
                            <button onClick={() => saveEdit(c.id)} disabled={saving}
                              className="btn-primary flex items-center gap-2 text-[11px]">
                              {saving && <Spinner />} Save
                            </button>
                            <button onClick={() => setEditId(null)}
                              className="font-condensed text-[10px] font-bold uppercase text-gray-3 hover:text-off-white px-3 py-2 bg-transparent border-0 cursor-pointer transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// ZONE EXPORT
// ═════════════════════════════════════════════════════════════════════════════

export default function Content() {
  const [sub, setSub] = useState('podcast')
  return (
    <div>
      <SubNav tabs={TABS} active={sub} onChange={setSub} />
      {sub === 'podcast'     && <PodcastTab />}
      {sub === 'apparel'     && <ApparelTab />}
      {sub === 'consultants' && <ConsultantsTab />}
    </div>
  )
}
