import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { apiGet, apiPost, apiPatch } from '../../../lib/api/client'
import { DashSkeleton, ApiError, EmptyState } from '../DashWidgets'
import { SubNav, FField, FSelect, ActionMsg, Spinner } from './AdminUtils'

const TABS = [
  { id: 'podcast',     label: 'Podcast'     },
  { id: 'apparel',     label: 'Apparel'     },
  { id: 'consultants', label: 'Consultants' },
]

// ── Shared helpers ────────────────────────────────────────────────────────────

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

const toSlug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const toArr = (v: any): string[] => {
  if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean)
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean)
  return []
}
const fromArr = (v: any): string =>
  Array.isArray(v) ? v.join(', ') : (v ?? '')

// Inline-edit row expansion helper
function ExpandBtn({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border border-charcoal-3 text-gray-3 hover:text-off-white hover:border-off-white/30 transition-all cursor-pointer">
      {open ? 'Close' : 'Edit'}
    </button>
  )
}

function StatusBtn({
  label, onClick, disabled, variant = 'default',
}: { label: string; onClick: () => void; disabled?: boolean; variant?: 'green' | 'red' | 'default' }) {
  const colors = {
    green:   'border-green-900 text-green-500 hover:border-green-700',
    red:     'border-blood/30 text-blood-glow hover:border-blood',
    default: 'border-charcoal-3 text-gray-3 hover:text-off-white hover:border-off-white/30',
  }
  return (
    <button disabled={disabled} onClick={onClick}
      className={`font-condensed text-[9px] font-bold uppercase tracking-wide px-2 py-1 border transition-all cursor-pointer ${colors[variant]}`}>
      {label}
    </button>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// PODCAST ZONE
// ═════════════════════════════════════════════════════════════════════════════

const PODCAST_SUBTABS = [
  { id: 'episodes', label: 'Episodes'  },
  { id: 'featured', label: 'Featured'  },
  { id: 'settings', label: 'Settings'  },
]

const BLANK_EP: Record<string, string> = {
  title: '', slug: '', episode_number: '', season: '1',
  guest_name: '', guest_title: '',
  short_description: '', description: '', show_notes: '',
  spotify_url: '', apple_url: '', youtube_url: '', embed_url: '',
  thumbnail_path: '', duration: '', tags: '',
  is_featured: 'false', published_at: '', sort_order: '100',
  meta_title: '', meta_description: '',
}

function epToForm(ep: any): Record<string, string> {
  return {
    title:             ep.title             ?? '',
    slug:              ep.slug              ?? '',
    episode_number:    ep.episode_number != null ? String(ep.episode_number) : '',
    season:            ep.season != null        ? String(ep.season)          : '1',
    guest_name:        ep.guest_name        ?? '',
    guest_title:       ep.guest_title       ?? '',
    short_description: ep.short_description ?? '',
    description:       ep.description       ?? '',
    show_notes:        ep.show_notes        ?? '',
    spotify_url:       ep.spotify_url       ?? '',
    apple_url:         ep.apple_url         ?? '',
    youtube_url:       ep.youtube_url       ?? '',
    embed_url:         ep.embed_url         ?? '',
    thumbnail_path:    ep.thumbnail_path    ?? '',
    duration:          ep.duration          ?? '',
    tags:              fromArr(ep.tags),
    is_featured:       ep.is_featured ? 'true' : 'false',
    published_at:      ep.published_at ? ep.published_at.slice(0, 16) : '',
    sort_order:        String(ep.sort_order ?? 100),
    meta_title:        ep.meta_title        ?? '',
    meta_description:  ep.meta_description  ?? '',
  }
}

function buildEpPayload(f: Record<string, string>) {
  return {
    title:             f.title.trim()             || undefined,
    slug:              f.slug.trim()              || null,
    episode_number:    f.episode_number           ? Number(f.episode_number) : null,
    season:            Number(f.season)           || 1,
    guest_name:        f.guest_name.trim()        || null,
    guest_title:       f.guest_title.trim()       || null,
    short_description: f.short_description.trim() || null,
    description:       f.description.trim()       || null,
    show_notes:        f.show_notes.trim()        || null,
    spotify_url:       f.spotify_url.trim()       || null,
    apple_url:         f.apple_url.trim()         || null,
    youtube_url:       f.youtube_url.trim()       || null,
    embed_url:         f.embed_url.trim()         || null,
    thumbnail_path:    f.thumbnail_path.trim()    || null,
    duration:          f.duration.trim()          || null,
    tags:              toArr(f.tags),
    is_featured:       f.is_featured === 'true',
    published_at:      f.published_at             || null,
    sort_order:        Number(f.sort_order)       || 100,
    meta_title:        f.meta_title.trim()        || null,
    meta_description:  f.meta_description.trim()  || null,
  }
}

function EpisodeForm({
  form, setForm, onSubmit, onCancel, saving, submitLabel,
}: {
  form: Record<string, string>
  setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>
  onSubmit: () => void
  onCancel: () => void
  saving: boolean
  submitLabel: string
}) {
  const set = (k: string) => (v: string) => setForm(p => ({ ...p, [k]: v }))
  const autoSlug = () => {
    if (!form.slug && form.title) setForm(p => ({ ...p, slug: toSlug(p.title) }))
  }

  return (
    <div className="space-y-3">
      {/* Row 1: title + ep/season */}
      <div className="grid gap-3 grid-cols-3">
        <div className="col-span-2">
          <FField label="Title" value={form.title} onChange={set('title')} required
            hint="Required." />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FField label="Ep #"    value={form.episode_number} onChange={set('episode_number')} type="number" placeholder="12" />
          <FField label="Season"  value={form.season}         onChange={set('season')}         type="number" placeholder="1" />
        </div>
      </div>

      {/* Slug */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <FField label="Slug" value={form.slug} onChange={set('slug')} placeholder="auto-generated from title" />
        </div>
        <button type="button" onClick={autoSlug}
          className="font-condensed text-[9px] font-bold uppercase tracking-wide px-3 py-2 border border-charcoal-3 text-gray-3 hover:text-off-white transition-colors mb-[2px]">
          Auto
        </button>
      </div>

      {/* Guest */}
      <div className="grid gap-3 grid-cols-2">
        <FField label="Guest Name"  value={form.guest_name}  onChange={set('guest_name')}  placeholder="Marcus Torres" />
        <FField label="Guest Title" value={form.guest_title} onChange={set('guest_title')} placeholder="Former WBA Champion" />
      </div>

      {/* Descriptions */}
      <FField label="Short Description (card teaser)" value={form.short_description} onChange={set('short_description')} placeholder="One-line hook for the episode card" />
      <FField label="Full Description"               value={form.description}       onChange={set('description')} />
      <FField label="Show Notes"                     value={form.show_notes}        onChange={set('show_notes')} hint="Links, timestamps, resources (plain text)" />

      {/* URLs */}
      <div className="font-condensed text-[9px] font-bold tracking-[0.3em] uppercase text-gray-3 pt-1">Links</div>
      <div className="grid gap-3 grid-cols-2">
        <FField label="Spotify URL ★"  value={form.spotify_url}  onChange={set('spotify_url')}  placeholder="https://open.spotify.com/episode/…" />
        <FField label="Apple URL"      value={form.apple_url}    onChange={set('apple_url')}    placeholder="https://podcasts.apple.com/…" />
        <FField label="YouTube URL"    value={form.youtube_url}  onChange={set('youtube_url')}  placeholder="https://youtube.com/watch?v=…" />
        <FField label="Embed URL"      value={form.embed_url}    onChange={set('embed_url')}    placeholder="https://open.spotify.com/embed/episode/…" />
      </div>

      {/* Media + meta */}
      <div className="grid gap-3 grid-cols-3">
        <FField label="Thumbnail Path" value={form.thumbnail_path} onChange={set('thumbnail_path')} placeholder="/podcast/ep12.jpg" />
        <FField label="Duration"       value={form.duration}       onChange={set('duration')}       placeholder="58m" />
        <FField label="Sort Order"     value={form.sort_order}     onChange={set('sort_order')}     type="number" />
      </div>

      {/* Tags + featured + date */}
      <div className="grid gap-3 grid-cols-2">
        <FField label="Tags (comma-sep)" value={form.tags} onChange={set('tags')} placeholder="sponsorship, career-transition" />
        <FSelect label="Featured"        value={form.is_featured} onChange={set('is_featured')}
          options={[{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes — show first' }]} />
      </div>
      <FField label="Publish Date" value={form.published_at} onChange={set('published_at')} type="datetime-local" />

      {/* SEO */}
      <div className="font-condensed text-[9px] font-bold tracking-[0.3em] uppercase text-gray-3 pt-1">SEO (optional)</div>
      <div className="grid gap-3 grid-cols-2">
        <FField label="Meta Title"       value={form.meta_title}       onChange={set('meta_title')} />
        <FField label="Meta Description" value={form.meta_description} onChange={set('meta_description')} />
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={onSubmit} disabled={saving}
          className="btn-primary flex items-center gap-2 text-[11px]">
          {saving && <Spinner />} {submitLabel}
        </button>
        <button onClick={onCancel}
          className="font-condensed text-[10px] font-bold uppercase text-gray-3 hover:text-off-white px-3 py-2 bg-transparent border-0 cursor-pointer transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Episodes sub-tab ──────────────────────────────────────────────────────────
function EpisodesTab({ episodes, load }: { episodes: any[]; load: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [actingId, setActingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...BLANK_EP })

  const openEdit = (ep: any) => {
    setEditId(editId === ep.id ? null : ep.id)
    setEditForm(epToForm(ep))
  }

  const submit = async () => {
    if (!form.title.trim()) { setMsg({ type: 'err', text: 'Title is required.' }); return }
    setSaving(true); setMsg(null)
    try {
      await apiPost('/api/admin/podcast', buildEpPayload(form))
      setMsg({ type: 'ok', text: 'Episode created.' })
      setForm({ ...BLANK_EP }); setShowForm(false); load()
    } catch (e: any) { setMsg({ type: 'err', text: e.message }) }
    finally { setSaving(false) }
  }

  const saveEdit = async (id: string) => {
    setSaving(true); setMsg(null)
    try {
      await apiPatch(`/api/admin/podcast/${id}`, buildEpPayload(editForm))
      setMsg({ type: 'ok', text: 'Saved.' }); setEditId(null); load()
    } catch (e: any) { setMsg({ type: 'err', text: e.message }) }
    finally { setSaving(false) }
  }

  const setStatus = async (id: string, status: string) => {
    setActingId(id)
    try { await apiPatch(`/api/admin/podcast/${id}/status`, { status }); load() }
    catch (e: any) { setMsg({ type: 'err', text: (e as any).message }) }
    finally { setActingId(null) }
  }

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
        <div className="dash-card">
          <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-gray-3 mb-4">New Episode</div>
          <EpisodeForm form={form} setForm={setForm} onSubmit={submit} onCancel={() => { setShowForm(false); setMsg(null) }} saving={saving} submitLabel="Create Episode" />
        </div>
      )}

      {episodes.length === 0 ? (
        <EmptyState icon="🎙" title="No Episodes Yet" body="Create your first podcast episode above." />
      ) : (
        <div className="dash-card p-0 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-charcoal-3">
                {['Ep', 'Title', 'Guest', 'Duration', 'Featured', 'Status', 'Actions'].map(h => (
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
                    <td className="px-3 py-2.5 max-w-[200px]">
                      <div className="font-condensed text-[12px] font-bold text-off-white truncate">{ep.title}</div>
                      {ep.slug && <div className="font-condensed text-[9px] text-gray-3">{ep.slug}</div>}
                    </td>
                    <td className="px-3 py-2.5 max-w-[140px]">
                      {ep.guest_name ? (
                        <>
                          <div className="font-condensed text-[11px] text-gray-2 truncate">{ep.guest_name}</div>
                          {ep.guest_title && <div className="font-condensed text-[9px] text-gray-3 truncate">{ep.guest_title}</div>}
                        </>
                      ) : <span className="text-gray-3 text-[10px]">—</span>}
                    </td>
                    <td className="font-condensed text-[11px] text-gray-3 px-3 py-2.5 whitespace-nowrap">{ep.duration ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      {ep.is_featured
                        ? <span className="font-condensed text-[9px] font-bold uppercase tracking-wide text-yellow-400">★ Yes</span>
                        : <span className="font-condensed text-[9px] text-gray-3">—</span>}
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={ep.status} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <ExpandBtn open={editId === ep.id} onClick={() => openEdit(ep)} />
                        {ep.status !== 'published' && <StatusBtn label="Publish"   onClick={() => setStatus(ep.id, 'published')} disabled={actingId === ep.id} variant="green" />}
                        {ep.status === 'published' && <StatusBtn label="Unpublish" onClick={() => setStatus(ep.id, 'draft')}     disabled={actingId === ep.id} />}
                        {ep.status !== 'archived'  && <StatusBtn label="Archive"   onClick={() => setStatus(ep.id, 'archived')}  disabled={actingId === ep.id} variant="red" />}
                      </div>
                    </td>
                  </tr>
                  {editId === ep.id && (
                    <tr className="border-b border-charcoal-3">
                      <td colSpan={7} className="px-3 py-4 bg-charcoal-2">
                        <EpisodeForm form={editForm} setForm={setEditForm}
                          onSubmit={() => saveEdit(ep.id)} onCancel={() => setEditId(null)}
                          saving={saving} submitLabel="Save Changes" />
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

// ── Featured sub-tab ──────────────────────────────────────────────────────────
function FeaturedTab({ episodes, load }: { episodes: any[]; load: () => void }) {
  const [actingId, setActingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const current = episodes.find(ep => ep.is_featured)
  const published = episodes.filter(ep => ep.status === 'published')

  const setFeatured = async (id: string, val: boolean) => {
    setActingId(id); setMsg(null)
    try {
      await apiPatch(`/api/admin/podcast/${id}`, { is_featured: val })
      setMsg({ type: 'ok', text: val ? 'Featured episode set.' : 'Featured removed.' })
      load()
    } catch (e: any) { setMsg({ type: 'err', text: e.message }) }
    finally { setActingId(null) }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <ActionMsg msg={msg} />

      {current ? (
        <div className="dash-card" style={{ borderLeft: '3px solid #c9a82c' }}>
          <div className="font-condensed text-[9px] font-bold tracking-[0.3em] uppercase text-yellow-400 mb-2">★ Currently Featured</div>
          <div className="font-condensed text-[14px] font-bold text-off-white">{current.title}</div>
          {current.guest_name && <div className="font-condensed text-[11px] text-gray-3 mt-0.5">{current.guest_name}{current.guest_title ? ` · ${current.guest_title}` : ''}</div>}
          <button onClick={() => setFeatured(current.id, false)} disabled={!!actingId}
            className="mt-3 font-condensed text-[9px] font-bold uppercase tracking-wide px-3 py-1.5 border border-charcoal-3 text-gray-3 hover:text-off-white transition-colors cursor-pointer">
            Remove Featured
          </button>
        </div>
      ) : (
        <div className="dash-card">
          <div className="font-condensed text-[12px] text-gray-3">No featured episode set. Select one from the published episodes below.</div>
        </div>
      )}

      {published.length === 0 ? (
        <EmptyState icon="○" title="No Published Episodes" body="Publish an episode from the Episodes tab to set it as featured." />
      ) : (
        <div className="space-y-2">
          <div className="font-condensed text-[9px] font-bold tracking-[0.3em] uppercase text-gray-3">Published Episodes</div>
          {published.map(ep => (
            <div key={ep.id} className="dash-card flex items-center gap-4"
              style={ep.is_featured ? { borderLeft: '2px solid #c9a82c' } : {}}>
              <div className="flex-1 min-w-0">
                <div className="font-condensed text-[12px] font-bold text-off-white truncate">{ep.title}</div>
                {ep.guest_name && <div className="font-condensed text-[10px] text-gray-3">{ep.guest_name}</div>}
              </div>
              {ep.is_featured ? (
                <span className="font-condensed text-[9px] font-bold uppercase text-yellow-400 tracking-wide">★ Featured</span>
              ) : (
                <button onClick={() => setFeatured(ep.id, true)} disabled={!!actingId}
                  className="font-condensed text-[9px] font-bold uppercase tracking-wide px-3 py-1.5 border border-charcoal-3 text-gray-3 hover:text-off-white hover:border-off-white/30 transition-colors cursor-pointer">
                  {actingId === ep.id ? <Spinner /> : 'Set Featured'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Settings sub-tab ──────────────────────────────────────────────────────────
function PodcastSettingsTab() {
  return (
    <div className="max-w-lg space-y-4">
      <div className="dash-card">
        <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-gray-3 mb-3">Podcast Settings</div>
        <p className="font-condensed text-[12px] text-gray-2 leading-relaxed">
          Podcast settings — show name, description, artwork, and platform links — can be
          managed directly from individual episode fields.
        </p>
        <ul className="mt-4 space-y-2">
          {[
            'Use the Episodes tab to create and manage episodes.',
            'Set the Spotify URL on each episode as the primary link.',
            'Use the Featured tab to pin one episode to the top of the public page.',
            'Slug, guest info, and tags are all per-episode fields.',
          ].map(t => (
            <li key={t} className="flex items-start gap-2 font-condensed text-[11px] text-gray-3">
              <span className="text-blood-glow flex-shrink-0 mt-0.5">·</span>{t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ── Podcast zone ──────────────────────────────────────────────────────────────
function PodcastZone() {
  const [sub, setSub]         = useState('episodes')
  const [episodes, setEpisodes] = useState<any[]>([])
  const [loading, setLoading]  = useState(true)
  const [error, setError]      = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    apiGet('/api/admin/podcast')
      .then(d => { setEpisodes(d.episodes ?? []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  if (loading) return <DashSkeleton />
  if (error)   return <ApiError message={error} />

  return (
    <div>
      <SubNav tabs={PODCAST_SUBTABS} active={sub} onChange={setSub} />
      {sub === 'episodes' && <EpisodesTab episodes={episodes} load={load} />}
      {sub === 'featured' && <FeaturedTab episodes={episodes} load={load} />}
      {sub === 'settings' && <PodcastSettingsTab />}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// APPAREL ZONE
// ═════════════════════════════════════════════════════════════════════════════

const APPAREL_SUBTABS = [
  { id: 'products',   label: 'Products'         },
  { id: 'collections',label: 'Collections'      },
  { id: 'analytics',  label: 'Click Analytics'  },
]

const STOCK_STATUS_OPTIONS = [
  { value: 'in_stock',  label: 'In Stock'   },
  { value: 'low_stock', label: 'Low Stock'  },
  { value: 'sold_out',  label: 'Sold Out'   },
  { value: 'hidden',    label: 'Hidden'     },
]

const BLANK_PROD: Record<string, string> = {
  name: '', slug: '', description: '', price_display: '',
  category: '', collection: '',
  image_path: '', gallery_images: '', hover_image_path: '',
  external_url: '', shopify_url: '',
  sizes: '', colors: '', badge: '', stock_status: 'in_stock',
  material: '', fit: '', care_instructions: '',
  featured: 'false', sort_order: '100',
  meta_title: '', meta_description: '',
}

function prodToForm(p: any): Record<string, string> {
  return {
    name:             p.name             ?? '',
    slug:             p.slug             ?? '',
    description:      p.description      ?? '',
    price_display:    p.price_display    ?? '',
    category:         p.category         ?? '',
    collection:       p.collection       ?? '',
    image_path:       p.image_path       ?? '',
    gallery_images:   fromArr(p.gallery_images),
    hover_image_path: p.hover_image_path ?? '',
    external_url:     p.external_url     ?? '',
    shopify_url:      p.shopify_url      ?? '',
    sizes:            fromArr(p.sizes),
    colors:           fromArr(p.colors),
    badge:            p.badge            ?? '',
    stock_status:     p.stock_status     ?? 'in_stock',
    material:         p.material         ?? '',
    fit:              p.fit              ?? '',
    care_instructions:p.care_instructions?? '',
    featured:         p.featured ? 'true' : 'false',
    sort_order:       String(p.sort_order ?? 100),
    meta_title:       p.meta_title       ?? '',
    meta_description: p.meta_description ?? '',
  }
}

function buildProdPayload(f: Record<string, string>) {
  return {
    name:              f.name.trim()             || undefined,
    slug:              f.slug.trim()             || null,
    description:       f.description.trim()      || null,
    price_display:     f.price_display.trim()    || null,
    category:          f.category.trim()         || null,
    collection:        f.collection.trim()       || null,
    image_path:        f.image_path.trim()       || null,
    gallery_images:    toArr(f.gallery_images),
    hover_image_path:  f.hover_image_path.trim() || null,
    external_url:      f.external_url.trim()     || null,
    shopify_url:       f.shopify_url.trim()      || null,
    sizes:             toArr(f.sizes),
    colors:            toArr(f.colors),
    badge:             f.badge.trim()            || null,
    stock_status:      f.stock_status            || 'in_stock',
    material:          f.material.trim()         || null,
    fit:               f.fit.trim()              || null,
    care_instructions: f.care_instructions.trim()|| null,
    featured:          f.featured === 'true',
    sort_order:        Number(f.sort_order)      || 100,
    meta_title:        f.meta_title.trim()       || null,
    meta_description:  f.meta_description.trim() || null,
  }
}

function ProductForm({
  form, setForm, onSubmit, onCancel, saving, submitLabel,
}: {
  form: Record<string, string>
  setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>
  onSubmit: () => void
  onCancel: () => void
  saving: boolean
  submitLabel: string
}) {
  const set = (k: string) => (v: string) => setForm(p => ({ ...p, [k]: v }))
  const autoSlug = () => {
    if (!form.slug && form.name) setForm(p => ({ ...p, slug: toSlug(p.name) }))
  }

  const STOCK_COLOR: Record<string, string> = {
    in_stock: '#00c060', low_stock: '#c9a82c', sold_out: '#c00000', hidden: '#4a4846',
  }

  return (
    <div className="space-y-3">
      {/* Row 1: name + price + category + collection */}
      <div className="grid gap-3 grid-cols-2">
        <FField label="Name" value={form.name} onChange={set('name')} required />
        <FField label="Price Display" value={form.price_display} onChange={set('price_display')} placeholder="$45" />
        <FField label="Category" value={form.category} onChange={set('category')} placeholder="hoodie" />
        <FField label="Collection" value={form.collection} onChange={set('collection')} placeholder="Resilience Line" />
      </div>

      {/* Slug */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <FField label="Slug" value={form.slug} onChange={set('slug')} placeholder="auto-generated from name" />
        </div>
        <button type="button" onClick={autoSlug}
          className="font-condensed text-[9px] font-bold uppercase tracking-wide px-3 py-2 border border-charcoal-3 text-gray-3 hover:text-off-white transition-colors mb-[2px]">
          Auto
        </button>
      </div>

      <FField label="Description" value={form.description} onChange={set('description')} />

      {/* Images */}
      <div className="font-condensed text-[9px] font-bold tracking-[0.3em] uppercase text-gray-3 pt-1">Images</div>
      <div className="grid gap-3 grid-cols-2">
        <FField label="Main Image Path"  value={form.image_path}       onChange={set('image_path')}       placeholder="/apparel/products/…" />
        <FField label="Hover Image Path" value={form.hover_image_path} onChange={set('hover_image_path')} placeholder="/apparel/products/…-hover.jpg" />
      </div>
      <FField label="Gallery Images (comma-sep paths)" value={form.gallery_images} onChange={set('gallery_images')}
        hint="e.g. /apparel/products/img-1.png, /apparel/products/img-2.png" />

      {/* Links */}
      <div className="font-condensed text-[9px] font-bold tracking-[0.3em] uppercase text-gray-3 pt-1">Purchase Links</div>
      <div className="grid gap-3 grid-cols-2">
        <FField label="Shopify URL ★"  value={form.shopify_url}  onChange={set('shopify_url')}  placeholder="https://…myshopify.com/products/…" />
        <FField label="External URL"   value={form.external_url} onChange={set('external_url')} placeholder="https://…" />
      </div>

      {/* Variants */}
      <div className="font-condensed text-[9px] font-bold tracking-[0.3em] uppercase text-gray-3 pt-1">Variants</div>
      <div className="grid gap-3 grid-cols-2">
        <FField label="Sizes (comma-sep)"  value={form.sizes}  onChange={set('sizes')}  placeholder="XS, S, M, L, XL, XXL" />
        <FField label="Colors (comma-sep)" value={form.colors} onChange={set('colors')} placeholder="Onyx, Bone" />
      </div>

      {/* Details */}
      <div className="font-condensed text-[9px] font-bold tracking-[0.3em] uppercase text-gray-3 pt-1">Details</div>
      <div className="grid gap-3 grid-cols-3">
        <FField label="Material"           value={form.material}           onChange={set('material')}           placeholder="Heavyweight fleece" />
        <FField label="Fit"                value={form.fit}                onChange={set('fit')}                placeholder="Relaxed / Tapered" />
        <FField label="Care Instructions"  value={form.care_instructions}  onChange={set('care_instructions')}  placeholder="Machine wash cold" />
      </div>

      {/* Badge + stock + featured */}
      <div className="grid gap-3 grid-cols-3">
        <FField label="Badge" value={form.badge} onChange={set('badge')} placeholder="Best Seller" />
        <div>
          <FSelect label="Stock Status" value={form.stock_status} onChange={set('stock_status')} options={STOCK_STATUS_OPTIONS} />
          {form.stock_status && (
            <div className="font-condensed text-[9px] mt-1 font-bold uppercase" style={{ color: STOCK_COLOR[form.stock_status] ?? '#4a4846' }}>
              ● {form.stock_status.replace('_', ' ')}
            </div>
          )}
        </div>
        <div>
          <FSelect label="Featured" value={form.featured} onChange={set('featured')}
            options={[{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes — show first' }]} />
        </div>
      </div>

      <FField label="Sort Order" value={form.sort_order} onChange={set('sort_order')} type="number" />

      {/* SEO */}
      <div className="font-condensed text-[9px] font-bold tracking-[0.3em] uppercase text-gray-3 pt-1">SEO (optional)</div>
      <div className="grid gap-3 grid-cols-2">
        <FField label="Meta Title"       value={form.meta_title}       onChange={set('meta_title')} />
        <FField label="Meta Description" value={form.meta_description} onChange={set('meta_description')} />
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={onSubmit} disabled={saving}
          className="btn-primary flex items-center gap-2 text-[11px]">
          {saving && <Spinner />} {submitLabel}
        </button>
        <button onClick={onCancel}
          className="font-condensed text-[10px] font-bold uppercase text-gray-3 hover:text-off-white px-3 py-2 bg-transparent border-0 cursor-pointer transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Products sub-tab ──────────────────────────────────────────────────────────
function ProductsTab({ products, load }: { products: any[]; load: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [actingId, setActingId] = useState<string | null>(null)
  const [form,     setForm]     = useState({ ...BLANK_PROD })

  const STOCK_COLOR: Record<string, string> = {
    in_stock: '#00c060', low_stock: '#c9a82c', sold_out: '#c00000', hidden: '#4a4846',
  }

  const submit = async () => {
    if (!form.name.trim()) { setMsg({ type: 'err', text: 'Name is required.' }); return }
    setSaving(true); setMsg(null)
    try {
      await apiPost('/api/admin/apparel', buildProdPayload(form))
      setMsg({ type: 'ok', text: 'Product created.' })
      setForm({ ...BLANK_PROD }); setShowForm(false); load()
    } catch (e: any) { setMsg({ type: 'err', text: e.message }) }
    finally { setSaving(false) }
  }

  const saveEdit = async (id: string) => {
    setSaving(true); setMsg(null)
    try {
      await apiPatch(`/api/admin/apparel/${id}`, buildProdPayload(editForm))
      setMsg({ type: 'ok', text: 'Saved.' }); setEditId(null); load()
    } catch (e: any) { setMsg({ type: 'err', text: e.message }) }
    finally { setSaving(false) }
  }

  const setStatus = async (id: string, status: string) => {
    setActingId(id)
    try { await apiPatch(`/api/admin/apparel/${id}/status`, { status }); load() }
    catch (e: any) { setMsg({ type: 'err', text: (e as any).message }) }
    finally { setActingId(null) }
  }

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
        <div className="dash-card">
          <div className="font-condensed text-[10px] font-bold tracking-[0.3em] uppercase text-gray-3 mb-4">New Product</div>
          <ProductForm form={form} setForm={setForm} onSubmit={submit} onCancel={() => { setShowForm(false); setMsg(null) }} saving={saving} submitLabel="Create Product" />
        </div>
      )}

      {products.length === 0 ? (
        <EmptyState icon="👕" title="No Products Yet" body="Create your first apparel product above." />
      ) : (
        <div className="dash-card p-0 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-charcoal-3">
                {['Name', 'Collection', 'Price', 'Colors', 'Stock', 'Status', 'Actions'].map(h => (
                  <th key={h} className="font-condensed text-[9px] font-bold uppercase tracking-[0.2em] text-gray-3 px-3 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <React.Fragment key={p.id}>
                  <tr className="border-b border-charcoal-3 last:border-0">
                    <td className="px-3 py-2.5 max-w-[160px]">
                      <div className="font-condensed text-[12px] font-bold text-off-white truncate">{p.name}</div>
                      {p.badge && <div className="font-condensed text-[9px] text-blood-glow">{p.badge}</div>}
                    </td>
                    <td className="font-condensed text-[11px] text-gray-3 px-3 py-2.5">{p.collection ?? p.category ?? '—'}</td>
                    <td className="font-condensed text-[11px] text-gray-3 px-3 py-2.5 whitespace-nowrap">{p.price_display ?? '—'}</td>
                    <td className="font-condensed text-[10px] text-gray-3 px-3 py-2.5">
                      {Array.isArray(p.colors) && p.colors.length > 0 ? p.colors.join(', ') : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-condensed text-[9px] font-bold uppercase tracking-wide"
                        style={{ color: STOCK_COLOR[p.stock_status ?? 'in_stock'] ?? '#4a4846' }}>
                        {(p.stock_status ?? 'in_stock').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={p.status} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <ExpandBtn open={editId === p.id} onClick={() => { setEditId(editId === p.id ? null : p.id); setEditForm(prodToForm(p)) }} />
                        {p.status !== 'published' && <StatusBtn label="Publish"   onClick={() => setStatus(p.id, 'published')} disabled={actingId === p.id} variant="green" />}
                        {p.status === 'published' && <StatusBtn label="Unpublish" onClick={() => setStatus(p.id, 'draft')}     disabled={actingId === p.id} />}
                        {p.status !== 'archived'  && <StatusBtn label="Archive"   onClick={() => setStatus(p.id, 'archived')}  disabled={actingId === p.id} variant="red" />}
                      </div>
                    </td>
                  </tr>
                  {editId === p.id && (
                    <tr className="border-b border-charcoal-3">
                      <td colSpan={7} className="px-3 py-4 bg-charcoal-2">
                        <ProductForm form={editForm} setForm={setEditForm}
                          onSubmit={() => saveEdit(p.id)} onCancel={() => setEditId(null)}
                          saving={saving} submitLabel="Save Changes" />
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

// ── Collections sub-tab ───────────────────────────────────────────────────────
function CollectionsTab({ products }: { products: any[] }) {
  const collections = useMemo(() => {
    const map: Record<string, { name: string; total: number; published: number }> = {}
    for (const p of products) {
      const key = p.collection ?? p.category ?? '(uncategorized)'
      if (!map[key]) map[key] = { name: key, total: 0, published: 0 }
      map[key].total++
      if (p.status === 'published') map[key].published++
    }
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [products])

  if (collections.length === 0)
    return <EmptyState icon="○" title="No Collections" body="Collections are derived from product collection and category fields." />

  return (
    <div className="dash-card p-0 overflow-hidden max-w-lg">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-charcoal-3">
            {['Collection / Category', 'Products', 'Published'].map(h => (
              <th key={h} className="font-condensed text-[9px] font-bold uppercase tracking-[0.2em] text-gray-3 px-3 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {collections.map(c => (
            <tr key={c.name} className="border-b border-charcoal-3 last:border-0">
              <td className="font-condensed text-[12px] font-bold text-off-white px-3 py-2.5">{c.name}</td>
              <td className="font-condensed text-[12px] text-gray-2 px-3 py-2.5">{c.total}</td>
              <td className="px-3 py-2.5">
                <span className="font-condensed text-[11px] font-bold"
                  style={{ color: c.published > 0 ? '#00c060' : '#4a4846' }}>
                  {c.published}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Click Analytics sub-tab ───────────────────────────────────────────────────
function ClickAnalyticsTab() {
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/api/admin/apparel/clicks')
      .then(d => setData(d))
      .catch(() => setData({ ok: true, total: 0, by_product: [] }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <DashSkeleton />

  const rows: any[] = data?.by_product ?? []

  return (
    <div className="space-y-4 max-w-xl">
      <div className="font-condensed text-[11px] text-gray-3">
        Total clicks tracked: <span className="text-off-white font-bold">{data?.total ?? 0}</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="○" title="No Clicks Recorded Yet" body="Click analytics appear here once visitors click product links on the /apparel page." />
      ) : (
        <div className="dash-card p-0 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-charcoal-3">
                {['Product', 'Clicks'].map(h => (
                  <th key={h} className="font-condensed text-[9px] font-bold uppercase tracking-[0.2em] text-gray-3 px-3 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.product_id} className="border-b border-charcoal-3 last:border-0">
                  <td className="font-condensed text-[12px] text-off-white px-3 py-2.5">{r.name}</td>
                  <td className="font-condensed text-[12px] font-bold text-off-white px-3 py-2.5">{r.clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Apparel zone ──────────────────────────────────────────────────────────────
function ApparelZone() {
  const [sub, setSub]           = useState('products')
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    apiGet('/api/admin/apparel')
      .then(d => { setProducts(d.products ?? []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  if (loading && sub !== 'analytics') return <DashSkeleton />
  if (error)                          return <ApiError message={error} />

  return (
    <div>
      <SubNav tabs={APPAREL_SUBTABS} active={sub} onChange={setSub} />
      {sub === 'products'    && <ProductsTab products={products} load={load} />}
      {sub === 'collections' && <CollectionsTab products={products} />}
      {sub === 'analytics'   && <ClickAnalyticsTab />}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// CONSULTANTS TAB (unchanged)
// ═════════════════════════════════════════════════════════════════════════════

const AUDIENCE_OPTIONS = [
  { value: 'all',     label: 'All Roles'  },
  { value: 'fighter', label: 'Fighters'   },
  { value: 'manager', label: 'Managers'   },
  { value: 'sponsor', label: 'Sponsors'   },
]

const BLANK_CONSULTANT: Record<string, string> = {
  name: '', title: '', specialty: '', bio: '', email: '', phone: '',
  booking_url: '', image_path: '', location: '', tags: '', audience: 'all',
  hourly_rate_usd: '', linkedin_url: '', sort_order: '100',
}

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
        name: form.name.trim(), title: form.title.trim() || null, specialty: form.specialty.trim() || null,
        bio: form.bio.trim() || null, email: form.email.trim() || null, phone: form.phone.trim() || null,
        booking_url: form.booking_url.trim() || null, image_path: form.image_path.trim() || null,
        location: form.location.trim() || null, tags: parseTags(form.tags), audience: form.audience || 'all',
        hourly_rate_usd: form.hourly_rate_usd ? Number(form.hourly_rate_usd) : null,
        linkedin_url: form.linkedin_url.trim() || null, sort_order: Number(form.sort_order) || 100,
      })
      setMsg({ type: 'ok', text: 'Consultant added.' })
      setForm({ ...BLANK_CONSULTANT }); setShowForm(false); load()
    } catch (e: any) { setMsg({ type: 'err', text: e.message }) }
    finally { setSaving(false) }
  }

  const saveEdit = async (id: string) => {
    setSaving(true); setMsg(null)
    try {
      const f = editForm
      await apiPatch(`/api/admin/consultants/${id}`, {
        name: f.name?.trim() || undefined, title: f.title?.trim() || null,
        specialty: f.specialty?.trim() || null, bio: f.bio?.trim() || null,
        email: f.email?.trim() || null, phone: f.phone?.trim() || null,
        booking_url: f.booking_url?.trim() || null, image_path: f.image_path?.trim() || null,
        location: f.location?.trim() || null, tags: parseTags(f.tags ?? ''), audience: f.audience || 'all',
        hourly_rate_usd: f.hourly_rate_usd ? Number(f.hourly_rate_usd) : null,
        linkedin_url: f.linkedin_url?.trim() || null, sort_order: Number(f.sort_order) || 100,
      })
      setMsg({ type: 'ok', text: 'Saved.' }); setEditId(null); load()
    } catch (e: any) { setMsg({ type: 'err', text: e.message }) }
    finally { setSaving(false) }
  }

  const setStatus = async (id: string, status: string) => {
    setActingId(id)
    try { await apiPatch(`/api/admin/consultants/${id}/status`, { status }); load() }
    catch (e: any) { setMsg({ type: 'err', text: (e as any).message }) }
    finally { setActingId(null) }
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
            <FField label="Name" value={form.name} onChange={setF('name')} required />
            <FField label="Title" value={form.title} onChange={setF('title')} placeholder="Combat Sports Attorney" />
            <FField label="Specialty" value={form.specialty} onChange={setF('specialty')} placeholder="Contract Law" />
            <FField label="Location" value={form.location} onChange={setF('location')} placeholder="Las Vegas, NV" />
          </div>
          <FField label="Bio" value={form.bio} onChange={setF('bio')} />
          <div className="grid gap-3 grid-cols-2">
            <FField label="Email" value={form.email} onChange={setF('email')} type="email" />
            <FField label="Phone" value={form.phone} onChange={setF('phone')} placeholder="+1 555…" />
            <FField label="Booking URL" value={form.booking_url} onChange={setF('booking_url')} placeholder="https://calendly.com/…" />
            <FField label="LinkedIn URL" value={form.linkedin_url} onChange={setF('linkedin_url')} placeholder="https://linkedin.com/in/…" />
            <FField label="Image Path" value={form.image_path} onChange={setF('image_path')} placeholder="/mentors/…" />
            <FField label="Hourly Rate (USD)" value={form.hourly_rate_usd} onChange={setF('hourly_rate_usd')} type="number" placeholder="150" />
          </div>
          <div className="grid gap-3 grid-cols-2">
            <FField label="Tags (comma-sep)" value={form.tags} onChange={setF('tags')} placeholder="contracts, legal, NIL" />
            <FField label="Sort Order" value={form.sort_order} onChange={setF('sort_order')} type="number" />
          </div>
          <FSelect label="Audience" value={form.audience} onChange={setF('audience')} options={AUDIENCE_OPTIONS} />
          <div className="flex gap-3 pt-1">
            <button onClick={submit} disabled={saving} className="btn-primary flex items-center gap-2 text-[11px]">
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <ExpandBtn open={editId === c.id} onClick={() => {
                          setEditId(editId === c.id ? null : c.id)
                          setEditForm({ ...c, tags: Array.isArray(c.tags) ? c.tags.join(', ') : '', hourly_rate_usd: c.hourly_rate_usd ? String(c.hourly_rate_usd) : '', sort_order: String(c.sort_order ?? 100) })
                        }} />
                        {c.status !== 'active'   && <StatusBtn label="Activate"   onClick={() => setStatus(c.id, 'active')}    disabled={actingId === c.id} variant="green" />}
                        {c.status === 'active'   && <StatusBtn label="Deactivate" onClick={() => setStatus(c.id, 'inactive')}  disabled={actingId === c.id} />}
                        {c.status !== 'archived' && <StatusBtn label="Archive"    onClick={() => setStatus(c.id, 'archived')}  disabled={actingId === c.id} variant="red" />}
                      </div>
                    </td>
                  </tr>
                  {editId === c.id && (
                    <tr className="border-b border-charcoal-3">
                      <td colSpan={6} className="px-3 py-4 bg-charcoal-2">
                        <div className="space-y-3">
                          <div className="grid gap-3 grid-cols-2">
                            <FField label="Name" value={editForm.name ?? ''} onChange={v => setEditForm(f => ({ ...f, name: v }))} required />
                            <FField label="Title" value={editForm.title ?? ''} onChange={v => setEditForm(f => ({ ...f, title: v }))} />
                            <FField label="Specialty" value={editForm.specialty ?? ''} onChange={v => setEditForm(f => ({ ...f, specialty: v }))} />
                            <FField label="Location" value={editForm.location ?? ''} onChange={v => setEditForm(f => ({ ...f, location: v }))} />
                          </div>
                          <FField label="Bio" value={editForm.bio ?? ''} onChange={v => setEditForm(f => ({ ...f, bio: v }))} />
                          <div className="grid gap-3 grid-cols-2">
                            <FField label="Email" value={editForm.email ?? ''} onChange={v => setEditForm(f => ({ ...f, email: v }))} type="email" />
                            <FField label="Phone" value={editForm.phone ?? ''} onChange={v => setEditForm(f => ({ ...f, phone: v }))} />
                            <FField label="Booking URL" value={editForm.booking_url ?? ''} onChange={v => setEditForm(f => ({ ...f, booking_url: v }))} />
                            <FField label="LinkedIn URL" value={editForm.linkedin_url ?? ''} onChange={v => setEditForm(f => ({ ...f, linkedin_url: v }))} />
                            <FField label="Image Path" value={editForm.image_path ?? ''} onChange={v => setEditForm(f => ({ ...f, image_path: v }))} />
                            <FField label="Hourly Rate (USD)" value={editForm.hourly_rate_usd ?? ''} onChange={v => setEditForm(f => ({ ...f, hourly_rate_usd: v }))} type="number" />
                          </div>
                          <div className="grid gap-3 grid-cols-2">
                            <FField label="Tags (comma-sep)" value={editForm.tags ?? ''} onChange={v => setEditForm(f => ({ ...f, tags: v }))} />
                            <FField label="Sort Order" value={editForm.sort_order ?? '100'} onChange={v => setEditForm(f => ({ ...f, sort_order: v }))} type="number" />
                          </div>
                          <FSelect label="Audience" value={editForm.audience ?? 'all'} onChange={v => setEditForm(f => ({ ...f, audience: v }))} options={AUDIENCE_OPTIONS} />
                          <div className="flex gap-3 pt-1">
                            <button onClick={() => saveEdit(c.id)} disabled={saving} className="btn-primary flex items-center gap-2 text-[11px]">
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
  const [tab, setTab] = useState('podcast')
  return (
    <div>
      <SubNav tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'podcast'     && <PodcastZone />}
      {tab === 'apparel'     && <ApparelZone />}
      {tab === 'consultants' && <ConsultantsTab />}
    </div>
  )
}
