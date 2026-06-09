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

// ═════════════════════════════════════════════════════════════════════════════
// PODCAST EPISODES
// ═════════════════════════════════════════════════════════════════════════════

const PODCAST_WRITABLE = [
  'title', 'description', 'episode_number', 'season',
  'spotify_url', 'apple_url', 'youtube_url', 'embed_url',
  'thumbnail_path', 'duration', 'published_at', 'sort_order',
]

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
    const row = pick(req.body, PODCAST_WRITABLE)
    if (!row.title?.trim()) return res.status(400).json({ error: 'title is required.' })
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
    const updates = pick(req.body, PODCAST_WRITABLE)
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No updatable fields.' })
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
    if (status === 'published') updates.published_at = updates.published_at ?? new Date().toISOString()
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

const APPAREL_WRITABLE = [
  'name', 'description', 'price_display', 'category',
  'image_path', 'external_url', 'featured', 'sort_order', 'metadata',
]

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

router.post('/apparel', ...guard, async (req, res) => {
  try {
    const row = pick(req.body, APPAREL_WRITABLE)
    if (!row.name?.trim()) return res.status(400).json({ error: 'name is required.' })
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
    const updates = pick(req.body, APPAREL_WRITABLE)
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No updatable fields.' })
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
