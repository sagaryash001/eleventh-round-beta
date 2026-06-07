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
import { sendEmail as _sendEmail } from '../services/email.js'

const log           = childLogger('outbox-dispatcher')
const POLL_MS       = Number(process.env.OUTBOX_POLL_MS   || 5_000)
const BATCH_SIZE    = Number(process.env.OUTBOX_BATCH_SIZE || 10)
const MAX_ATTEMPTS  = 5
const CLIENT        = process.env.CLIENT_URL || 'http://localhost:5173'

// Wrap shared email helper so failures are logged but never propagate to the handler
async function sendEmail(to, subject, text) {
  try {
    await _sendEmail(to, subject, `<pre style="font-family:inherit">${text}</pre>`)
  } catch (e) {
    log.warn({ err: e, to }, 'Outbox email send failed')
  }
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

  // Bulk insert all in-app notifications in one query
  await adminSupabase.from('notifications').insert(
    recipient_ids.map(recipientId => ({
      recipient_id: recipientId,
      type:         'message.received',
      title:        `New message from ${senderLabel}`,
      body:         body_preview || null,
      action_url:   `${CLIENT}/inbox`,
      related_type: 'conversation',
      related_id:   conversation_id,
    }))
  )

  // Bulk fetch all recipient emails in one query, then send
  const { data: profiles } = await adminSupabase
    .from('profiles').select('id, email').in('id', recipient_ids)

  await Promise.all((profiles ?? []).filter(p => p.email).map(p =>
    sendEmail(
      p.email,
      `New message from ${senderLabel}`,
      `${senderLabel} sent you a message:\n\n"${body_preview}"\n\nReply at ${CLIENT}/inbox`,
    )
  ))
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

async function handlePaymentSucceeded(payload) {
  const { fighter_id, amount_usd, contract_id, payment_id } = payload
  if (!fighter_id) return

  await adminSupabase.from('notifications').insert({
    recipient_id: fighter_id,
    type:         'payment.succeeded',
    title:        `Payment of $${amount_usd?.toLocaleString()} received`,
    body:         'Funds are being processed. Payout will follow.',
    action_url:   contract_id ? `${CLIENT}/contracts/${contract_id}` : `${CLIENT}/contracts`,
    related_type: 'payment',
    related_id:   payment_id ?? null,
  })

  const { data: profile } = await adminSupabase
    .from('profiles').select('email').eq('id', fighter_id).maybeSingle()
  if (profile?.email) {
    await sendEmail(
      profile.email,
      `Payment of $${amount_usd?.toLocaleString()} received`,
      `Your sponsorship payment of $${amount_usd?.toLocaleString()} has been processed. View your contract at ${CLIENT}/contracts/${contract_id}`,
    )
  }
}

async function handleApplicationShortlisted(payload) {
  const { fighter_id, opportunity_title, application_id } = payload
  if (!fighter_id) return

  await adminSupabase.from('notifications').insert({
    recipient_id: fighter_id,
    type:         'application.shortlisted',
    title:        'You have been shortlisted!',
    body:         opportunity_title ? `For: ${opportunity_title}` : null,
    action_url:   `${CLIENT}/fighter/applications`,
    related_type: 'application',
    related_id:   application_id ?? null,
  })
}

async function handleContractCreated(payload) {
  const { contract_id, sponsor_id, fighter_id, value_usd } = payload
  if (!contract_id) return

  const valueLabel = value_usd ? ` ($${Number(value_usd).toLocaleString()})` : ''
  const notifs = []

  if (fighter_id) {
    notifs.push({
      recipient_id: fighter_id,
      type:         'contract.created',
      title:        `A contract draft has been created${valueLabel}`,
      body:         'Review and sign your contract to activate the sponsorship.',
      action_url:   `${CLIENT}/contracts/${contract_id}`,
      related_type: 'contract',
      related_id:   contract_id,
    })
  }
  if (sponsor_id) {
    notifs.push({
      recipient_id: sponsor_id,
      type:         'contract.created',
      title:        `Contract draft created${valueLabel}`,
      body:         'Sign the contract to send it to the fighter for their signature.',
      action_url:   `${CLIENT}/contracts/${contract_id}`,
      related_type: 'contract',
      related_id:   contract_id,
    })
  }
  if (notifs.length) await adminSupabase.from('notifications').insert(notifs)
}

async function handleObligationProofSubmitted(payload) {
  const { obligation_id, obligation_title, fighter_id, sponsor_id, contract_id } = payload
  if (!sponsor_id) return

  let fighterName = 'Fighter'
  if (fighter_id) {
    const { data: p } = await adminSupabase
      .from('profiles').select('name').eq('id', fighter_id).maybeSingle()
    fighterName = p?.name ?? fighterName
  }

  await adminSupabase.from('notifications').insert({
    recipient_id: sponsor_id,
    type:         'obligation.proof_submitted',
    title:        `${fighterName} submitted proof`,
    body:         obligation_title ? `For: ${obligation_title}` : null,
    action_url:   contract_id ? `${CLIENT}/contracts/${contract_id}` : `${CLIENT}/contracts`,
    related_type: 'obligation',
    related_id:   obligation_id ?? null,
  })
}

async function handleObligationProofApproved(payload) {
  const { obligation_id, obligation_title, fighter_id, contract_id } = payload
  if (!fighter_id) return

  await adminSupabase.from('notifications').insert({
    recipient_id: fighter_id,
    type:         'obligation.proof_approved',
    title:        'Proof approved!',
    body:         obligation_title
      ? `Your submission for "${obligation_title}" was approved.`
      : null,
    action_url:   contract_id ? `${CLIENT}/contracts/${contract_id}` : `${CLIENT}/contracts`,
    related_type: 'obligation',
    related_id:   obligation_id ?? null,
  })
}

async function handleObligationProofRejected(payload) {
  const { obligation_id, obligation_title, fighter_id, contract_id, review_notes } = payload
  if (!fighter_id) return

  await adminSupabase.from('notifications').insert({
    recipient_id: fighter_id,
    type:         'obligation.proof_rejected',
    title:        'Proof needs resubmission',
    body:         review_notes
      ? `"${obligation_title}" — ${review_notes}`
      : obligation_title
        ? `Your submission for "${obligation_title}" was rejected. Please resubmit.`
        : 'A proof submission was rejected. Please resubmit.',
    action_url:   contract_id ? `${CLIENT}/contracts/${contract_id}` : `${CLIENT}/contracts`,
    related_type: 'obligation',
    related_id:   obligation_id ?? null,
  })
}

const HANDLERS = {
  'message.received':             handleMessageReceived,
  'application.received':         handleApplicationReceived,
  'application.shortlisted':      handleApplicationShortlisted,
  'application.accepted':         handleApplicationAccepted,
  'application.rejected':         handleApplicationRejected,
  'contract.created':             handleContractCreated,
  'obligation.proof_submitted':   handleObligationProofSubmitted,
  'obligation.proof_approved':    handleObligationProofApproved,
  'obligation.proof_rejected':    handleObligationProofRejected,
  'payment.succeeded':            handlePaymentSucceeded,
}

// ── Single dispatch tick ─────────────────────────────────────────────────────

async function tick() {
  if (!adminSupabase) return

  // Atomically claim a batch: UPDATE ... RETURNING so two concurrent ticks
  // cannot claim the same rows (Postgres UPDATE is row-level locked).
  const { data: events, error } = await adminSupabase.rpc('claim_outbox_batch', {
    batch_size:     BATCH_SIZE,
    cutoff_time:    new Date().toISOString(),
  })

  if (error) {
    // Fallback: rpc not available yet — use the non-atomic path with a warning
    if (error.code === 'PGRST202') {
      log.warn('claim_outbox_batch RPC not found — using non-atomic claim. Run the migration to fix.')
      const { data: fallback, error: fbErr } = await adminSupabase
        .from('outbox_events')
        .select('id, event_type, payload, attempts')
        .in('status', ['pending', 'failed'])
        .lte('next_attempt_at', new Date().toISOString())
        .order('id', { ascending: true })
        .limit(BATCH_SIZE)
      if (fbErr || !fallback?.length) return
      await adminSupabase.from('outbox_events').update({ status: 'processing' }).in('id', fallback.map(e => e.id))
      return processBatch(fallback)
    }
    log.error({ err: error }, 'outbox tick claim failed')
    return
  }
  if (!events?.length) return
  return processBatch(events)
}

async function processBatch(events) {
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
