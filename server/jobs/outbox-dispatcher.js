// ─────────────────────────────────────────────────────────────────────────────
// Outbox dispatcher — polls outbox_events and fans out in-app + email
//
// Runs in-process, started from server/index.js.
// Polls every OUTBOX_POLL_MS (default 5 000). On each tick, claims up to
// OUTBOX_BATCH_SIZE pending events, processes them concurrently, and marks
// each sent or failed.
//
// Event types handled:
//   message.received   → in-app notification for each recipient
//                        + deferred email (if recipient has no recent read)
//   application.received → in-app notification to sponsor
//   application.accepted → in-app notification to fighter
//   application.rejected → in-app notification to fighter
// ─────────────────────────────────────────────────────────────────────────────

import { adminSupabase } from '../db/supabase.js'
import { childLogger } from '../lib/logger.js'
import sgMail from '@sendgrid/mail'

const log           = childLogger('outbox-dispatcher')
const POLL_MS       = Number(process.env.OUTBOX_POLL_MS   || 5_000)
const BATCH_SIZE    = Number(process.env.OUTBOX_BATCH_SIZE || 10)
const MAX_ATTEMPTS  = 5
const FROM          = process.env.FROM_EMAIL || 'contact@eleventh-rnd.us'
const CLIENT        = process.env.CLIENT_URL || 'http://localhost:5173'

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

// ── Handler registry ─────────────────────────────────────────────────────────

async function handleMessageReceived(payload) {
  const { conversation_id, sender_id, sender_name, body_preview, recipient_ids } = payload
  if (!Array.isArray(recipient_ids) || !recipient_ids.length) return

  // Fetch sender's profile name if not provided
  let senderLabel = sender_name
  if (!senderLabel) {
    const { data: p } = await adminSupabase
      .from('profiles')
      .select('name')
      .eq('id', sender_id)
      .maybeSingle()
    senderLabel = p?.name ?? 'Someone'
  }

  for (const recipientId of recipient_ids) {
    // Create in-app notification
    await adminSupabase.from('notifications').insert({
      recipient_id: recipientId,
      type:         'message.received',
      title:        `New message from ${senderLabel}`,
      body:         body_preview || null,
      action_url:   `${CLIENT}/inbox`,
      related_type: 'conversation',
      related_id:   conversation_id,
    })

    // Send email if SendGrid is configured (fire-and-forget — don't fail the event)
    if (process.env.SENDGRID_API_KEY) {
      const { data: profile } = await adminSupabase
        .from('profiles')
        .select('email, name')
        .eq('id', recipientId)
        .maybeSingle()

      if (profile?.email) {
        sgMail.send({
          to:      profile.email,
          from:    { email: FROM, name: 'The Eleventh Round' },
          subject: `New message from ${senderLabel}`,
          text:    `${senderLabel} sent you a message:\n\n"${body_preview}"\n\nReply at ${CLIENT}/inbox`,
        }).catch(e => log.warn({ err: e }, 'Email send failed'))
      }
    }
  }
}

async function handleApplicationReceived(payload) {
  const { sponsor_id, fighter_name, opportunity_title, application_id } = payload
  if (!sponsor_id) return

  await adminSupabase.from('notifications').insert({
    recipient_id: sponsor_id,
    type:         'application.received',
    title:        `New application from ${fighter_name ?? 'a fighter'}`,
    body:         opportunity_title ? `For: ${opportunity_title}` : null,
    action_url:   application_id ? `${CLIENT}/applications/${application_id}` : `${CLIENT}/dashboard/sponsor`,
    related_type: 'application',
    related_id:   application_id ?? null,
  })
}

async function handleApplicationAccepted(payload) {
  const { fighter_id, opportunity_title, application_id } = payload
  if (!fighter_id) return

  await adminSupabase.from('notifications').insert({
    recipient_id: fighter_id,
    type:         'application.accepted',
    title:        'Your application was accepted!',
    body:         opportunity_title ? `You were accepted for: ${opportunity_title}` : null,
    action_url:   application_id ? `${CLIENT}/applications/${application_id}` : `${CLIENT}/fighter/applications`,
    related_type: 'application',
    related_id:   application_id ?? null,
  })
}

async function handleApplicationRejected(payload) {
  const { fighter_id, opportunity_title, application_id } = payload
  if (!fighter_id) return

  await adminSupabase.from('notifications').insert({
    recipient_id: fighter_id,
    type:         'application.rejected',
    title:        'Application update',
    body:         opportunity_title ? `Re: ${opportunity_title}` : null,
    action_url:   `${CLIENT}/fighter/applications`,
    related_type: 'application',
    related_id:   application_id ?? null,
  })
}

const HANDLERS = {
  'message.received':      handleMessageReceived,
  'application.received':  handleApplicationReceived,
  'application.accepted':  handleApplicationAccepted,
  'application.rejected':  handleApplicationRejected,
}

// ── Single dispatch tick ─────────────────────────────────────────────────────

async function tick() {
  if (!adminSupabase) return

  // Claim a batch of pending events whose next_attempt_at is due
  const { data: events, error } = await adminSupabase
    .from('outbox_events')
    .select('id, event_type, payload, attempts')
    .in('status', ['pending', 'failed'])
    .lte('next_attempt_at', new Date().toISOString())
    .order('id', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) { log.error({ err: error }, 'outbox tick select failed'); return }
  if (!events?.length) return

  // Mark as processing (prevents double-processing on concurrent workers)
  const ids = events.map(e => e.id)
  await adminSupabase
    .from('outbox_events')
    .update({ status: 'processing' })
    .in('id', ids)

  await Promise.all(events.map(async event => {
    const handler = HANDLERS[event.event_type]
    if (!handler) {
      log.warn({ event_type: event.event_type }, 'No handler for event type; marking sent')
      await adminSupabase.from('outbox_events').update({ status: 'sent', processed_at: new Date().toISOString() }).eq('id', event.id)
      return
    }

    try {
      await handler(event.payload)
      await adminSupabase.from('outbox_events').update({
        status:       'sent',
        processed_at: new Date().toISOString(),
      }).eq('id', event.id)
    } catch (err) {
      const attempts = (event.attempts ?? 0) + 1
      const isDead   = attempts >= MAX_ATTEMPTS
      const backoffMs = Math.min(1_000 * 2 ** attempts, 300_000) // cap at 5 min
      log.error({ err, event_id: event.id, attempts }, 'outbox event dispatch failed')
      await adminSupabase.from('outbox_events').update({
        status:         isDead ? 'dead' : 'failed',
        attempts,
        last_error:     err.message?.slice(0, 500),
        next_attempt_at: isDead ? null : new Date(Date.now() + backoffMs).toISOString(),
      }).eq('id', event.id)
    }
  }))
}

// ── Start the dispatcher ─────────────────────────────────────────────────────

export function startOutboxDispatcher() {
  log.info({ poll_ms: POLL_MS, batch_size: BATCH_SIZE }, 'Outbox dispatcher starting')
  const run = async () => {
    try { await tick() } catch (err) { log.error({ err }, 'outbox tick threw') }
    setTimeout(run, POLL_MS)
  }
  setTimeout(run, POLL_MS) // first tick after initial delay
}
