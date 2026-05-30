import { Router } from 'express'
import { adminSupabase } from '../db/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { childLogger } from '../lib/logger.js'

const router = Router()
const log    = childLogger('notifications')

// ── GET /api/notifications — get user's notifications ────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit) || 30, 100)
    const unread = req.query.unread === 'true'

    let query = adminSupabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unread) query = query.is('read_at', null)

    const { data, error } = await query
    if (error) throw error

    // Unread count
    const { count } = await adminSupabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', req.user.id)
      .is('read_at', null)

    res.json({ ok: true, notifications: data ?? [], unread_count: count ?? 0 })
  } catch (err) {
    log.error({ err }, 'GET /notifications threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/notifications/read-all — mark all read ─────────────────────────
router.post('/read-all', requireAuth, async (req, res) => {
  try {
    const { error } = await adminSupabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', req.user.id)
      .is('read_at', null)

    if (error) throw error
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'POST /notifications/read-all threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/notifications/:id/read — mark one read ─────────────────────────
router.post('/:id/read', requireAuth, async (req, res) => {
  try {
    const { data: notif, error: fErr } = await adminSupabase
      .from('notifications')
      .select('id, recipient_id')
      .eq('id', req.params.id)
      .maybeSingle()

    if (fErr) throw fErr
    if (!notif) return res.status(404).json({ error: 'Not found.' })
    if (notif.recipient_id !== req.user.id) return res.status(403).json({ error: 'Forbidden.' })

    const { error } = await adminSupabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', req.params.id)

    if (error) throw error
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'POST /notifications/:id/read threw')
    res.status(500).json({ error: err.message })
  }
})

export default router
