// ─────────────────────────────────────────────────────────────────────────────
// Admin content management — podcast episodes, apparel products, consultants.
// All routes require [requireAuth, requireAdmin].
// Mounted at /api/admin by app.js.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express'
import { adminSupabase } from '../db/supabase.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { childLogger } from '../lib/logger.js'

const router = Router()
const log    = childLogger('content')
const guard  = [requireAuth, requireAdmin]

function pick(body, keys) {
  const out = {}
  for (const k of keys) if (body[k] !== undefined) out[k] = body[k]
  return out
}

// Parse comma-separated string or passthrough array into a clean string[].
function toArr(v) {
  if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean)
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean)
  return []
}

// ═════════════════════════════════════════════════════════════════════════════
// PODCAST EPISODES
// ═════════════════════════════════════════════════════════════════════════════

const PODCAST_SCALAR = [
  'title', 'slug', 'description', 'short_description', 'show_notes',
  'episode_number', 'season',
  'guest_name', 'guest_title',
  'spotify_url', 'apple_url', 'youtube_url', 'embed_url',
  'thumbnail_path', 'duration',
  'is_featured',
  'published_at', 'sort_order',
  'meta_title', 'meta_description',
]
const PODCAST_ARRAY_FIELDS = ['tags']

router.get('/podcast', ...guard, async (req, res) => {
  try {
    const { data, error } = await adminSupabase
      .from('podcast_episodes')
      .select('*')
      .order('sort_order')
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ ok: true, episodes: data ?? [] })
  } catch (err) {
    log.error({ err }, 'GET /admin/podcast threw')
    res.status(500).json({ error: err.message })
  }
})

router.post('/podcast', ...guard, async (req, res) => {
  try {
    const row = pick(req.body, [...PODCAST_SCALAR, ...PODCAST_ARRAY_FIELDS])
    if (!row.title?.trim()) return res.status(400).json({ error: 'title is required.' })
    for (const f of PODCAST_ARRAY_FIELDS) if (row[f] !== undefined) row[f] = toArr(row[f])
    row.status     = 'draft'
    row.created_at = new Date().toISOString()
    row.updated_at = new Date().toISOString()

    const { data, error } = await adminSupabase
      .from('podcast_episodes').insert(row).select().maybeSingle()
    if (error) throw error
    res.status(201).json({ ok: true, episode: data })
  } catch (err) {
    log.error({ err }, 'POST /admin/podcast threw')
    res.status(500).json({ error: err.message })
  }
})

router.patch('/podcast/:id', ...guard, async (req, res) => {
  try {
    const updates = pick(req.body, [...PODCAST_SCALAR, ...PODCAST_ARRAY_FIELDS])
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No updatable fields.' })
    for (const f of PODCAST_ARRAY_FIELDS) if (updates[f] !== undefined) updates[f] = toArr(updates[f])
    updates.updated_at = new Date().toISOString()
    const { error } = await adminSupabase
      .from('podcast_episodes').update(updates).eq('id', req.params.id)
    if (error) throw error
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /admin/podcast/:id threw')
    res.status(500).json({ error: err.message })
  }
})

router.patch('/podcast/:id/status', ...guard, async (req, res) => {
  try {
    const { status } = req.body
    if (!['draft', 'published', 'archived'].includes(status))
      return res.status(400).json({ error: 'status must be draft, published, or archived.' })
    const updates = { status, updated_at: new Date().toISOString() }
    if (status === 'published' && !req.body.published_at) {
      updates.published_at = new Date().toISOString()
    }
    const { error } = await adminSupabase
      .from('podcast_episodes').update(updates).eq('id', req.params.id)
    if (error) throw error
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /admin/podcast/:id/status threw')
    res.status(500).json({ error: err.message })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// APPAREL PRODUCTS
// ═════════════════════════════════════════════════════════════════════════════

const APPAREL_SCALAR = [
  'name', 'slug', 'description', 'price_display',
  'category', 'collection',
  'image_path', 'hover_image_path',
  'external_url', 'shopify_url',
  'badge', 'stock_status',
  'material', 'fit', 'care_instructions',
  'featured', 'sort_order',
  'meta_title', 'meta_description',
]
const APPAREL_ARRAY_FIELDS = ['gallery_images', 'sizes', 'colors']

const STOCK_STATUSES = ['in_stock', 'low_stock', 'sold_out', 'hidden']

router.get('/apparel', ...guard, async (req, res) => {
  try {
    const { data, error } = await adminSupabase
      .from('apparel_products')
      .select('*')
      .order('sort_order')
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ ok: true, products: data ?? [] })
  } catch (err) {
    log.error({ err }, 'GET /admin/apparel threw')
    res.status(500).json({ error: err.message })
  }
})

// Click analytics — aggregate by product
router.get('/apparel/clicks', ...guard, async (req, res) => {
  try {
    const [clicksRes, productsRes] = await Promise.all([
      adminSupabase.from('apparel_clicks').select('product_id'),
      adminSupabase.from('apparel_products').select('id, name, slug'),
    ])
    if (clicksRes.error) throw clicksRes.error

    const counts = {}
    for (const row of clicksRes.data ?? []) {
      counts[row.product_id] = (counts[row.product_id] || 0) + 1
    }

    const nameMap = {}
    for (const p of productsRes.data ?? []) nameMap[p.id] = p

    const summary = Object.entries(counts)
      .map(([pid, count]) => ({ product_id: pid, name: nameMap[pid]?.name ?? pid, slug: nameMap[pid]?.slug ?? null, clicks: count }))
      .sort((a, b) => b.clicks - a.clicks)

    res.json({ ok: true, total: (clicksRes.data ?? []).length, by_product: summary })
  } catch (err) {
    log.error({ err }, 'GET /admin/apparel/clicks threw')
    // Gracefully return empty if table missing
    res.json({ ok: true, total: 0, by_product: [] })
  }
})

router.post('/apparel', ...guard, async (req, res) => {
  try {
    const row = pick(req.body, [...APPAREL_SCALAR, ...APPAREL_ARRAY_FIELDS])
    if (!row.name?.trim()) return res.status(400).json({ error: 'name is required.' })
    for (const f of APPAREL_ARRAY_FIELDS) if (row[f] !== undefined) row[f] = toArr(row[f])
    if (row.stock_status && !STOCK_STATUSES.includes(row.stock_status)) delete row.stock_status
    row.status     = 'draft'
    row.created_at = new Date().toISOString()
    row.updated_at = new Date().toISOString()

    const { data, error } = await adminSupabase
      .from('apparel_products').insert(row).select().maybeSingle()
    if (error) throw error
    res.status(201).json({ ok: true, product: data })
  } catch (err) {
    log.error({ err }, 'POST /admin/apparel threw')
    res.status(500).json({ error: err.message })
  }
})

router.patch('/apparel/:id', ...guard, async (req, res) => {
  try {
    const updates = pick(req.body, [...APPAREL_SCALAR, ...APPAREL_ARRAY_FIELDS])
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No updatable fields.' })
    for (const f of APPAREL_ARRAY_FIELDS) if (updates[f] !== undefined) updates[f] = toArr(updates[f])
    if (updates.stock_status && !STOCK_STATUSES.includes(updates.stock_status)) delete updates.stock_status
    updates.updated_at = new Date().toISOString()
    const { error } = await adminSupabase
      .from('apparel_products').update(updates).eq('id', req.params.id)
    if (error) throw error
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /admin/apparel/:id threw')
    res.status(500).json({ error: err.message })
  }
})

router.patch('/apparel/:id/status', ...guard, async (req, res) => {
  try {
    const { status } = req.body
    if (!['draft', 'published', 'archived'].includes(status))
      return res.status(400).json({ error: 'status must be draft, published, or archived.' })
    const { error } = await adminSupabase
      .from('apparel_products')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
    if (error) throw error
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /admin/apparel/:id/status threw')
    res.status(500).json({ error: err.message })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// CONSULTANTS
// ═════════════════════════════════════════════════════════════════════════════

const CONSULTANT_WRITABLE = [
  'name', 'title', 'specialty', 'bio', 'email', 'phone',
  'booking_url', 'image_path', 'location', 'tags', 'audience',
  'sort_order', 'hourly_rate_usd', 'linkedin_url',
]

router.get('/consultants', ...guard, async (req, res) => {
  try {
    const { data, error } = await adminSupabase
      .from('consultants')
      .select('*')
      .order('sort_order')
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ ok: true, consultants: data ?? [] })
  } catch (err) {
    log.error({ err }, 'GET /admin/consultants threw')
    res.status(500).json({ error: err.message })
  }
})

router.post('/consultants', ...guard, async (req, res) => {
  try {
    const row = pick(req.body, CONSULTANT_WRITABLE)
    if (!row.name?.trim()) return res.status(400).json({ error: 'name is required.' })
    row.status     = 'active'
    row.created_at = new Date().toISOString()
    row.updated_at = new Date().toISOString()
    if (Array.isArray(row.tags)) row.tags = row.tags
    else if (typeof row.tags === 'string') row.tags = row.tags.split(',').map(t => t.trim()).filter(Boolean)
    else row.tags = []

    const { data, error } = await adminSupabase
      .from('consultants').insert(row).select().maybeSingle()
    if (error) throw error
    res.status(201).json({ ok: true, consultant: data })
  } catch (err) {
    log.error({ err }, 'POST /admin/consultants threw')
    res.status(500).json({ error: err.message })
  }
})

router.patch('/consultants/:id', ...guard, async (req, res) => {
  try {
    const updates = pick(req.body, CONSULTANT_WRITABLE)
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No updatable fields.' })
    if (typeof updates.tags === 'string') updates.tags = updates.tags.split(',').map(t => t.trim()).filter(Boolean)
    updates.updated_at = new Date().toISOString()
    const { error } = await adminSupabase
      .from('consultants').update(updates).eq('id', req.params.id)
    if (error) throw error
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /admin/consultants/:id threw')
    res.status(500).json({ error: err.message })
  }
})

router.patch('/consultants/:id/status', ...guard, async (req, res) => {
  try {
    const { status } = req.body
    if (!['active', 'inactive', 'archived'].includes(status))
      return res.status(400).json({ error: 'status must be active, inactive, or archived.' })
    const { error } = await adminSupabase
      .from('consultants')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
    if (error) throw error
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /admin/consultants/:id/status threw')
    res.status(500).json({ error: err.message })
  }
})

export default router
