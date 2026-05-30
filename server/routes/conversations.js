import { Router } from 'express'
import { adminSupabase } from '../db/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { childLogger } from '../lib/logger.js'

const router = Router()
const log    = childLogger('conversations')

// ── GET /api/conversations — list user's conversations ───────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const uid = req.user.id

    // Fetch conversations the user participates in
    const { data: participations, error: pErr } = await adminSupabase
      .from('conversation_participants')
      .select('conversation_id, unread_count, last_read_at, muted')
      .eq('user_id', uid)
      .is('left_at', null)

    if (pErr) throw pErr
    if (!participations?.length) return res.json({ ok: true, conversations: [] })

    const convIds = participations.map(p => p.conversation_id)
    const pMap    = Object.fromEntries(participations.map(p => [p.conversation_id, p]))

    // Fetch conversation rows
    const { data: convs, error: cErr } = await adminSupabase
      .from('conversations')
      .select('*')
      .in('id', convIds)
      .is('deleted_at', null)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (cErr) throw cErr

    // For each conversation, fetch the other participants' profile info
    const allUserIds = new Set()
    for (const c of convs ?? []) {
      const { data: parts } = await adminSupabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', c.id)
        .is('left_at', null)
      for (const p of parts ?? []) allUserIds.add(p.user_id)
    }
    allUserIds.delete(uid)

    const profileMap = {}
    if (allUserIds.size) {
      const { data: profiles } = await adminSupabase
        .from('profiles')
        .select('id, name, role')
        .in('id', [...allUserIds])
      for (const p of profiles ?? []) profileMap[p.id] = p
    }

    // Fetch last message for each conversation
    const lastMsgMap = {}
    for (const c of convs ?? []) {
      const { data: msgs } = await adminSupabase
        .from('messages')
        .select('id, body, message_type, sender_id, created_at')
        .eq('conversation_id', c.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
      lastMsgMap[c.id] = msgs?.[0] ?? null
    }

    // Assemble response
    const result = (convs ?? []).map(c => {
      const myPart = pMap[c.id] ?? {}
      return {
        ...c,
        my_unread_count: myPart.unread_count ?? 0,
        my_last_read_at: myPart.last_read_at ?? null,
        muted: myPart.muted ?? false,
        last_message: lastMsgMap[c.id],
      }
    })

    res.json({ ok: true, conversations: result, profiles: profileMap })
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
          .select('*')
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
      .select()
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
        .select()
        .maybeSingle()

      if (mErr) throw mErr
      firstMessage = msg

      // Queue outbox event for notification fan-out
      await adminSupabase.from('outbox_events').insert({
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
      })
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
      .select('*')
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

    const { data: msg, error: mErr } = await adminSupabase
      .from('messages')
      .insert({
        conversation_id: id,
        sender_id:       uid,
        body:            body?.trim() || null,
        message_type:    'text',
        attachments:     attachments ?? [],
      })
      .select()
      .maybeSingle()

    if (mErr) throw mErr

    // Re-fetch to guarantee full row (PostgREST quirk on service role)
    const { data: fullMsg } = await adminSupabase
      .from('messages')
      .select('*')
      .eq('id', msg.id)
      .maybeSingle()

    // Get other participants for notification
    const { data: allParts } = await adminSupabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', id)
      .is('left_at', null)

    const recipientIds = (allParts ?? []).map(p => p.user_id).filter(pid => pid !== uid)

    // Queue outbox event for recipients
    if (recipientIds.length) {
      await adminSupabase.from('outbox_events').insert({
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
      })
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

export default router
