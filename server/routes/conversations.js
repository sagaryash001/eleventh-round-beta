import { Router } from 'express'
import { adminSupabase } from '../db/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { childLogger } from '../lib/logger.js'

const router = Router()
const log    = childLogger('conversations')

// Context ownership guard: non-admin users may only create conversations
// attached to their own applications/contracts/obligations.
async function validateContextAccess(uid, role, context_type, context_id) {
  if (role === 'admin') return null

  if (!context_type || !context_id) {
    return 'A valid context_type and context_id are required to start a conversation.'
  }

  if (context_type === 'application') {
    const { data: app } = await adminSupabase
      .from('applications')
      .select('fighter_id, sponsor_id, status')
      .eq('id', context_id)
      .maybeSingle()
    if (!app) return 'Application not found.'
    if (app.fighter_id !== uid && app.sponsor_id !== uid) return 'You are not a participant in this application.'
    return null
  }

  if (context_type === 'contract') {
    const { data: c } = await adminSupabase
      .from('contracts')
      .select('sponsor_id, fighter_id')
      .eq('id', context_id)
      .is('deleted_at', null)
      .maybeSingle()
    if (!c) return 'Contract not found.'
    if (c.sponsor_id !== uid && c.fighter_id !== uid) return 'You are not a participant in this contract.'
    return null
  }

  if (context_type === 'obligation') {
    const { data: ob } = await adminSupabase
      .from('obligations')
      .select('owner_id, contract_id')
      .eq('id', context_id)
      .maybeSingle()
    if (!ob) return 'Obligation not found.'
    if (ob.contract_id) {
      const { data: c } = await adminSupabase
        .from('contracts').select('sponsor_id, fighter_id').eq('id', ob.contract_id).maybeSingle()
      if (ob.owner_id !== uid && c?.sponsor_id !== uid && c?.fighter_id !== uid) {
        return 'You are not a participant in this obligation.'
      }
    } else if (ob.owner_id !== uid) {
      return 'You are not a participant in this obligation.'
    }
    return null
  }

  return 'Unsupported context_type.'
}

const CONVERSATION_COLS = 'id, subject, context_type, context_id, status, created_by, last_message_at, created_at, updated_at, deleted_at'
const MESSAGE_COLS      = 'id, conversation_id, sender_id, body, message_type, attachments, edited_at, deleted_at, created_at'

// ── GET /api/conversations — list user's conversations ───────────────────────
// ?limit=30&before=<ISO last_message_at> (cursor pagination)
router.get('/', requireAuth, async (req, res) => {
  try {
    const uid    = req.user.id
    const limit  = Math.min(Number(req.query.limit) || 30, 100)
    const before = req.query.before

    // Fetch conversations the user participates in
    const { data: participations, error: pErr } = await adminSupabase
      .from('conversation_participants')
      .select('conversation_id, unread_count, last_read_at, muted')
      .eq('user_id', uid)
      .is('left_at', null)

    if (pErr) throw pErr
    if (!participations?.length) return res.json({ ok: true, conversations: [], has_more: false })

    const convIds = participations.map(p => p.conversation_id)
    const pMap    = Object.fromEntries(participations.map(p => [p.conversation_id, p]))

    // Fetch conversation rows with cursor + limit
    let convQ = adminSupabase
      .from('conversations')
      .select(CONVERSATION_COLS)
      .in('id', convIds)
      .is('deleted_at', null)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(limit + 1)

    if (before) convQ = convQ.lt('last_message_at', before)

    const { data: convs, error: cErr } = await convQ

    if (cErr) throw cErr

    // Bulk-fetch all participants across all conversations — one query, not N
    const { data: allParts } = await adminSupabase
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', convIds)
      .is('left_at', null)

    const allUserIds = new Set(
      (allParts ?? []).filter(p => p.user_id !== uid).map(p => p.user_id)
    )

    const profileMap = {}
    if (allUserIds.size) {
      const { data: profiles } = await adminSupabase
        .from('profiles')
        .select('id, name, role')
        .in('id', [...allUserIds])
      for (const p of profiles ?? []) profileMap[p.id] = p
    }

    // Bulk-fetch last message per conversation using Postgres DISTINCT ON —
    // one query regardless of how many conversations there are.
    // Supabase doesn't expose DISTINCT ON via the JS client, so we use rpc or
    // fall back to fetching recent messages and picking the latest per conv.
    const lastMsgMap = {}
    if (convIds.length) {
      const { data: recentMsgs } = await adminSupabase
        .from('messages')
        .select('id, conversation_id, body, message_type, sender_id, created_at')
        .in('conversation_id', convIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(convIds.length * 1) // one per conv — take the first seen per conv_id

      for (const m of recentMsgs ?? []) {
        if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m
      }
    }

    // Assemble response
    const page     = (convs ?? []).slice(0, limit)
    const has_more = (convs ?? []).length > limit

    const result = page.map(c => {
      const myPart = pMap[c.id] ?? {}
      return {
        ...c,
        my_unread_count: myPart.unread_count ?? 0,
        my_last_read_at: myPart.last_read_at ?? null,
        muted: myPart.muted ?? false,
        last_message: lastMsgMap[c.id],
      }
    })

    res.json({ ok: true, conversations: result, profiles: profileMap, has_more })
  } catch (err) {
    log.error({ err }, 'GET /conversations threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/conversations — create a conversation ──────────────────────────
// Body: { participant_ids[], context_type?, context_id?, subject?, initial_message? }
router.post('/', requireAuth, async (req, res) => {
  try {
    const uid = req.user.id
    const { participant_ids, context_type = 'direct', context_id, subject, initial_message } = req.body

    if (!Array.isArray(participant_ids) || !participant_ids.length) {
      return res.status(400).json({ error: 'participant_ids[] required.' })
    }

    // Context ownership check — prevents users starting conversations outside their contexts
    const accessErr = await validateContextAccess(uid, req.user.role, context_type, context_id)
    if (accessErr) return res.status(403).json({ error: accessErr })

    // Deduplicate — always include the creator
    const allParticipants = [...new Set([uid, ...participant_ids])]

    // If this is contextual, check for an existing conversation to avoid duplicates
    if (context_id && context_type !== 'direct') {
      const { data: existing } = await adminSupabase
        .from('conversations')
        .select('id')
        .eq('context_type', context_type)
        .eq('context_id', context_id)
        .is('deleted_at', null)
        .maybeSingle()

      if (existing) {
        const { data: conv } = await adminSupabase
          .from('conversations')
          .select(CONVERSATION_COLS)
          .eq('id', existing.id)
          .maybeSingle()
        return res.json({ ok: true, conversation: conv, existed: true })
      }
    }

    // Create conversation
    const { data: conv, error: cErr } = await adminSupabase
      .from('conversations')
      .insert({
        subject:      subject?.trim() || null,
        context_type,
        context_id:   context_id || null,
        created_by:   uid,
        last_message_at: initial_message ? new Date().toISOString() : null,
      })
      .select(CONVERSATION_COLS)
      .maybeSingle()

    if (cErr) throw cErr

    // Add participants
    const participantRows = allParticipants.map(pid => ({
      conversation_id: conv.id,
      user_id:         pid,
      role_in_thread:  pid === uid ? 'owner' : 'member',
    }))

    const { error: pErr } = await adminSupabase
      .from('conversation_participants')
      .insert(participantRows)

    if (pErr) throw pErr

    // Send initial message if provided
    let firstMessage = null
    if (initial_message?.trim()) {
      const { data: msg, error: mErr } = await adminSupabase
        .from('messages')
        .insert({
          conversation_id: conv.id,
          sender_id:       uid,
          body:            initial_message.trim(),
          message_type:    'text',
        })
        .select(MESSAGE_COLS)
        .maybeSingle()

      if (mErr) throw mErr
      firstMessage = msg

      // Queue outbox event for notification fan-out (fire-and-forget — message is already saved)
      adminSupabase.from('outbox_events').insert({
        event_type:     'message.received',
        aggregate_type: 'message',
        aggregate_id:   msg.id,
        payload: {
          conversation_id: conv.id,
          sender_id:       uid,
          sender_name:     req.user.name,
          body_preview:    initial_message.trim().slice(0, 120),
          recipient_ids:   allParticipants.filter(p => p !== uid),
        },
      }).then(() => {}).catch(() => {})
    }

    res.status(201).json({ ok: true, conversation: conv, first_message: firstMessage })
  } catch (err) {
    log.error({ err }, 'POST /conversations threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/conversations/:id/messages ──────────────────────────────────────
router.get('/:id/messages', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const limit  = Math.min(Number(req.query.limit) || 40, 100)
    const before = req.query.before // cursor: ISO timestamp

    // Verify participation
    const { data: part } = await adminSupabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', id)
      .eq('user_id', req.user.id)
      .is('left_at', null)
      .maybeSingle()

    if (!part) return res.status(403).json({ error: 'Not a participant in this conversation.' })

    let query = adminSupabase
      .from('messages')
      .select(MESSAGE_COLS)
      .eq('conversation_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) query = query.lt('created_at', before)

    const { data: messages, error } = await query
    if (error) throw error

    // Return in ascending order for display
    const sorted = (messages ?? []).reverse()

    res.json({ ok: true, messages: sorted, has_more: (messages ?? []).length === limit })
  } catch (err) {
    log.error({ err }, 'GET /conversations/:id/messages threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/conversations/:id/messages — send a message ────────────────────
router.post('/:id/messages', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { body, attachments } = req.body
    const uid = req.user.id

    if (!body?.trim() && !attachments?.length) {
      return res.status(400).json({ error: 'Message body or attachments required.' })
    }

    // Verify participation
    const { data: part } = await adminSupabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', id)
      .eq('user_id', uid)
      .is('left_at', null)
      .maybeSingle()

    if (!part) return res.status(403).json({ error: 'Not a participant in this conversation.' })

    // Block sends in locked conversations (admins can still post)
    const { data: convCheck } = await adminSupabase
      .from('conversations').select('status').eq('id', id).maybeSingle()
    if (convCheck?.status === 'locked' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'This conversation is locked.' })
    }

    const { data: msg, error: mErr } = await adminSupabase
      .from('messages')
      .insert({
        conversation_id: id,
        sender_id:       uid,
        body:            body?.trim() || null,
        message_type:    'text',
        attachments:     attachments ?? [],
      })
      .select(MESSAGE_COLS)
      .maybeSingle()

    if (mErr) throw mErr

    // Re-fetch to guarantee full row (PostgREST quirk on service role)
    const { data: fullMsg } = await adminSupabase
      .from('messages')
      .select(MESSAGE_COLS)
      .eq('id', msg.id)
      .maybeSingle()

    // Get other participants for notification
    const { data: allParts } = await adminSupabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', id)
      .is('left_at', null)

    const recipientIds = (allParts ?? []).map(p => p.user_id).filter(pid => pid !== uid)

    // Queue outbox event for recipients (fire-and-forget — message is already saved)
    if (recipientIds.length) {
      adminSupabase.from('outbox_events').insert({
        event_type:     'message.received',
        aggregate_type: 'message',
        aggregate_id:   msg.id,
        payload: {
          conversation_id: id,
          sender_id:       uid,
          sender_name:     req.user.name,
          body_preview:    (body ?? '').trim().slice(0, 120),
          recipient_ids:   recipientIds,
        },
      }).then(() => {}).catch(() => {})
    }

    res.status(201).json({ ok: true, message: fullMsg ?? msg })
  } catch (err) {
    log.error({ err }, 'POST /conversations/:id/messages threw')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/conversations/:id/read — mark conversation as read ──────────────
router.post('/:id/read', requireAuth, async (req, res) => {
  try {
    const { error } = await adminSupabase
      .from('conversation_participants')
      .update({ unread_count: 0, last_read_at: new Date().toISOString() })
      .eq('conversation_id', req.params.id)
      .eq('user_id', req.user.id)

    if (error) throw error
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'POST /conversations/:id/read threw')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/conversations/:id — get a single conversation ───────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const uid = req.user.id

    const { data: part } = await adminSupabase
      .from('conversation_participants')
      .select('user_id, unread_count, last_read_at, muted')
      .eq('conversation_id', req.params.id)
      .eq('user_id', uid)
      .is('left_at', null)
      .maybeSingle()

    if (!part && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not a participant in this conversation.' })
    }

    const { data: conv, error: cErr } = await adminSupabase
      .from('conversations')
      .select(CONVERSATION_COLS)
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (cErr) throw cErr
    if (!conv) return res.status(404).json({ error: 'Not found.' })

    const { data: participants } = await adminSupabase
      .from('conversation_participants')
      .select('user_id, role_in_thread, unread_count, last_read_at, muted')
      .eq('conversation_id', req.params.id)
      .is('left_at', null)

    const pids = (participants ?? []).map(p => p.user_id)
    const { data: profiles } = pids.length
      ? await adminSupabase.from('profiles').select('id, name, role').in('id', pids)
      : { data: [] }

    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

    res.json({
      ok: true,
      conversation: { ...conv, my_unread_count: part?.unread_count ?? 0 },
      participants: participants ?? [],
      profiles: profileMap,
    })
  } catch (err) {
    log.error({ err }, 'GET /conversations/:id threw')
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/conversations/:id/archive — archive a conversation (admin only) ─
// Archiving affects the conversation for ALL participants (no per-user archive in schema).
// Restricted to admin to prevent one participant silently hiding the thread for everyone.
router.patch('/:id/archive', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can archive conversations.' })
    }

    const { error } = await adminSupabase
      .from('conversations')
      .update({ status: 'archived' })
      .eq('id', req.params.id)
    if (error) throw error

    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /conversations/:id/archive threw')
    res.status(500).json({ error: err.message })
  }
})

export default router
