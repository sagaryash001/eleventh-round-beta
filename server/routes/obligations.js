import { Router } from 'express'
import { adminSupabase } from '../db/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { childLogger } from '../lib/logger.js'
import { assertObligationTransition } from '../lib/state-machines.js'

const router = Router()
const log    = childLogger('obligations')

const OBLIGATION_COLS = [
  'id', 'owner_id', 'contract_id', 'title', 'description',
  'due_date', 'status', 'priority', 'category',
  'deliverable_type', 'recurrence', 'proof_required',
  'overdue_notified_at', 'created_at', 'updated_at',
].join(', ')

const PROOF_COLS = [
  'id', 'obligation_id', 'submitted_by', 'proof_type', 'proof_value',
  'caption', 'reviewed_by', 'review_status', 'review_notes', 'reviewed_at', 'created_at',
].join(', ')

// ── GET /api/obligations/:id ──────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data: ob, error } = await adminSupabase
      .from('obligations').select(OBLIGATION_COLS).eq('id', req.params.id).maybeSingle()
    if (error) throw error
    if (!ob) return res.status(404).json({ error: 'Not found.' })

    const uid = req.user.id
    // Must be owner or contract participant
    if (ob.owner_id !== uid) {
      if (ob.contract_id) {
        const { data: c } = await adminSupabase
          .from('contracts').select('sponsor_id, fighter_id').eq('id', ob.contract_id).maybeSingle()
        if (!c || (c.sponsor_id !== uid && c.fighter_id !== uid && req.user.role !== 'admin')) {
          return res.status(403).json({ error: 'Forbidden.' })
        }
      } else if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden.' })
      }
    }

    const { data: proofs } = await adminSupabase
      .from('obligation_proofs')
      .select(PROOF_COLS)
      .eq('obligation_id', req.params.id)
      .order('created_at', { ascending: false })

    res.json({ ok: true, obligation: ob, proofs: proofs ?? [] })
  } catch (err) {
    log.error({ err }, 'GET /obligations/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/obligations/:id — status transition ────────────────────────────
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { status: newStatus } = req.body
    if (!newStatus) return res.status(400).json({ error: 'status required.' })

    const { data: ob, error: fErr } = await adminSupabase
      .from('obligations').select(OBLIGATION_COLS).eq('id', req.params.id).maybeSingle()
    if (fErr) throw fErr
    if (!ob) return res.status(404).json({ error: 'Not found.' })

    const uid = req.user.id
    if (ob.owner_id !== uid && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden.' })
    }

    try { assertObligationTransition(ob, newStatus, uid, req.user.role) } catch (e) {
      return res.status(400).json({ error: e.message })
    }

    const { error: uErr } = await adminSupabase
      .from('obligations').update({ status: newStatus }).eq('id', req.params.id)
    if (uErr) throw uErr

    const { data } = await adminSupabase.from('obligations').select(OBLIGATION_COLS).eq('id', req.params.id).maybeSingle()
    res.json({ ok: true, obligation: data })
  } catch (err) {
    log.error({ err }, 'PATCH /obligations/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/obligations/:id/proof — fighter submits proof ───────────────────
router.post('/:id/proof', requireAuth, async (req, res) => {
  try {
    const { data: ob, error: fErr } = await adminSupabase
      .from('obligations').select(OBLIGATION_COLS).eq('id', req.params.id).maybeSingle()
    if (fErr) throw fErr
    if (!ob) return res.status(404).json({ error: 'Not found.' })
    if (ob.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the obligation owner can submit proof.' })
    }

    const { proof_type, proof_value, caption } = req.body
    if (!proof_type || !proof_value) return res.status(400).json({ error: 'proof_type and proof_value required.' })
    if (!['url','file','text'].includes(proof_type)) {
      return res.status(400).json({ error: 'proof_type must be url | file | text.' })
    }

    const { data, error } = await adminSupabase
      .from('obligation_proofs')
      .insert({
        obligation_id: req.params.id,
        submitted_by:  req.user.id,
        proof_type,
        proof_value:   proof_value.trim(),
        caption:       caption?.trim() || null,
        review_status: 'pending',
      })
      .select(PROOF_COLS)
      .maybeSingle()
    if (error) throw error

    // Auto-transition obligation to in_progress if still pending
    if (ob.status === 'pending') {
      await adminSupabase.from('obligations').update({ status: 'in_progress' }).eq('id', req.params.id)
    }

    res.status(201).json({ ok: true, proof: data })
  } catch (err) {
    log.error({ err }, 'POST /obligations/:id/proof threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/obligations/:id/proof/:pid/review — sponsor reviews proof ───────
router.post('/:id/proof/:pid/review', requireAuth, async (req, res) => {
  try {
    const { review_status, review_notes } = req.body
    if (!review_status || !['approved','rejected'].includes(review_status)) {
      return res.status(400).json({ error: 'review_status must be approved | rejected.' })
    }

    const { data: ob } = await adminSupabase
      .from('obligations').select('contract_id, owner_id').eq('id', req.params.id).maybeSingle()
    if (!ob) return res.status(404).json({ error: 'Obligation not found.' })

    // Only sponsor or admin can review
    if (ob.contract_id) {
      const { data: c } = await adminSupabase
        .from('contracts').select('sponsor_id').eq('id', ob.contract_id).maybeSingle()
      if (!c || (c.sponsor_id !== req.user.id && req.user.role !== 'admin')) {
        return res.status(403).json({ error: 'Only the sponsor can review proofs.' })
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden.' })
    }

    const { data: proof, error: pErr } = await adminSupabase
      .from('obligation_proofs')
      .select(PROOF_COLS)
      .eq('id', req.params.pid)
      .eq('obligation_id', req.params.id)
      .maybeSingle()
    if (pErr) throw pErr
    if (!proof) return res.status(404).json({ error: 'Proof not found.' })

    const { error: uErr } = await adminSupabase.from('obligation_proofs').update({
      review_status,
      review_notes: review_notes?.trim() || null,
      reviewed_by:  req.user.id,
      reviewed_at:  new Date().toISOString(),
    }).eq('id', req.params.pid)
    if (uErr) throw uErr

    // Transition obligation status based on review outcome.
    // Re-fetch status so we don't act on stale data from before the proof update.
    const { data: currentOb } = await adminSupabase
      .from('obligations').select('status').eq('id', req.params.id).maybeSingle()

    if (currentOb && !['completed', 'canceled'].includes(currentOb.status)) {
      if (review_status === 'approved') {
        await adminSupabase.from('obligations').update({ status: 'completed' }).eq('id', req.params.id)
      } else {
        // Rejected: reset to pending so the fighter knows to resubmit.
        await adminSupabase.from('obligations').update({ status: 'pending' }).eq('id', req.params.id)
      }
    }

    const { data } = await adminSupabase.from('obligation_proofs').select(PROOF_COLS).eq('id', req.params.pid).maybeSingle()
    res.json({ ok: true, proof: data })
  } catch (err) {
    log.error({ err }, 'POST /obligations/:id/proof/:pid/review threw')
    res.status(500).json({ error: err.message })
  }
})

export default router
