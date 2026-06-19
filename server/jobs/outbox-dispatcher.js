// ─────────────────────────────────────────────────────────────────────────────
// Outbox dispatcher — polls outbox_events and fans out in-app notifications
// and transactional emails.
//
// Runs in-process, started from server/index.js.
// Polls every OUTBOX_POLL_MS (default 5 000). On each tick, claims up to
// OUTBOX_BATCH_SIZE pending events, processes them concurrently, and marks
// each sent or failed.
//
// Email failures never fail the handler — they are logged and the event is
// still marked 'sent' so the main app action always succeeds.
//
// Event types handled:
//   application.received          → in-app (sponsor) + email
//   application.shortlisted       → in-app (fighter) + email
//   application.accepted          → in-app (fighter) + email
//   application.rejected          → in-app (fighter) + email
//   contract.created              → in-app (both)    + email
//   contract.signed               → in-app (both)    + email
//   contract.pending_signature    → in-app (fighter) + email
//   obligation.proof_submitted    → in-app (sponsor) + email
//   obligation.proof_approved     → in-app (fighter) + email
//   obligation.proof_rejected     → in-app (fighter) + email
//   payment.succeeded             → in-app (fighter) + email  (sponsorship payments)
//   message.received              → in-app (all)     + email  (short preview only)
//   manager.roster_invite         → in-app (existing fighter) OR email (non-platform)
//   roster.invite_accepted        → in-app (manager) + email   (fighter accepted)
//   roster.invite_declined        → in-app (manager) + email   (fighter declined)
//   roster.request_accepted       → in-app (fighter) + email   (manager accepted request)
//   fighter.manager_request       → in-app (manager) + email
//   sponsor.approved              → in-app (sponsor) + email
//   billing.package_purchased     → in-app (user)    + email
// ─────────────────────────────────────────────────────────────────────────────

import { adminSupabase } from '../db/supabase.js'
import { childLogger }   from '../lib/logger.js'
import { sendEmail as _sendEmail, emailHtml, ctaButton, esc } from '../services/email.js'

const log          = childLogger('outbox-dispatcher')
const POLL_MS      = Number(process.env.OUTBOX_POLL_MS   || 5_000)
const BATCH_SIZE   = Number(process.env.OUTBOX_BATCH_SIZE || 10)
const MAX_ATTEMPTS = 5
const CLIENT       = process.env.CLIENT_URL || 'http://localhost:5173'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Silently skip email failures — never let email crash a handler.
async function email(to, subject, html) {
  if (!to) return
  try { await _sendEmail(to, subject, html) }
  catch (e) { log.warn({ err: e, to }, 'Email send failed') }
}

// Fetch name + email for a user ID.
async function getProfile(userId) {
  if (!userId) return null
  const { data } = await adminSupabase
    .from('profiles').select('name, email').eq('id', userId).maybeSingle()
  return data ?? null
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleApplicationReceived(payload) {
  const { sponsor_id, fighter_name, opportunity_title, application_id, opportunity_id } = payload
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

  const sp = await getProfile(sponsor_id)
  if (sp?.email) {
    await email(sp.email, `New application — ${esc(opportunity_title ?? 'your opportunity')}`, emailHtml(`
      <p>Hi <strong style="color:#f0ece4">${esc(sp.name ?? 'there')}</strong>,</p>
      <p><strong style="color:#f0ece4">${esc(fighter_name ?? 'A fighter')}</strong> has applied to
         <strong style="color:#f0ece4">${esc(opportunity_title ?? 'your opportunity')}</strong>.</p>
      <p>Review their application and move them to the next stage.</p>
      ${ctaButton(`${CLIENT}/dashboard/sponsor`, 'Review Application')}
    `))
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

  const fp = await getProfile(fighter_id)
  if (fp?.email) {
    await email(fp.email, `You've been shortlisted — ${esc(opportunity_title ?? 'opportunity')}`, emailHtml(`
      <p>Hi <strong style="color:#f0ece4">${esc(fp.name ?? 'there')}</strong>,</p>
      <p>You&rsquo;ve been <strong style="color:#C41E3A">shortlisted</strong> for
         <strong style="color:#f0ece4">${esc(opportunity_title ?? 'an opportunity')}</strong>.</p>
      <p>The sponsor is reviewing your application. We&rsquo;ll notify you when a decision is made.</p>
      ${ctaButton(`${CLIENT}/fighter/applications`, 'View Applications')}
    `))
  }
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

  const fp = await getProfile(fighter_id)
  if (fp?.email) {
    await email(fp.email, `Application accepted — ${esc(opportunity_title ?? 'opportunity')}`, emailHtml(`
      <p>Hi <strong style="color:#f0ece4">${esc(fp.name ?? 'there')}</strong>,</p>
      <p>Your application for <strong style="color:#f0ece4">${esc(opportunity_title ?? 'an opportunity')}</strong>
         has been <strong style="color:#00c060">accepted</strong>.</p>
      <p>A contract draft will be sent to you shortly. Review and sign it to activate the sponsorship.</p>
      ${ctaButton(`${CLIENT}/contracts`, 'View Contracts')}
    `))
  }
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

  const fp = await getProfile(fighter_id)
  if (fp?.email) {
    await email(fp.email, `Application update — ${esc(opportunity_title ?? 'opportunity')}`, emailHtml(`
      <p>Hi <strong style="color:#f0ece4">${esc(fp.name ?? 'there')}</strong>,</p>
      <p>After review, the sponsor has decided not to move forward with your application for
         <strong style="color:#f0ece4">${esc(opportunity_title ?? 'this opportunity')}</strong>.</p>
      <p>There are more opportunities available — keep applying and building your profile.</p>
      ${ctaButton(`${CLIENT}/opportunities`, 'Browse Opportunities')}
    `))
  }
}

async function handleContractCreated(payload) {
  const { contract_id, sponsor_id, fighter_id, value_usd } = payload
  if (!contract_id) return

  const valueLabel = value_usd ? ` ($${Number(value_usd).toLocaleString()})` : ''
  const notifs = []

  if (fighter_id) notifs.push({
    recipient_id: fighter_id,
    type:         'contract.created',
    title:        `A contract draft has been created${valueLabel}`,
    body:         'Review and sign your contract to activate the sponsorship.',
    action_url:   `${CLIENT}/contracts/${contract_id}`,
    related_type: 'contract',
    related_id:   contract_id,
  })
  if (sponsor_id) notifs.push({
    recipient_id: sponsor_id,
    type:         'contract.created',
    title:        `Contract draft created${valueLabel}`,
    body:         'Sign the contract to send it to the fighter for their signature.',
    action_url:   `${CLIENT}/contracts/${contract_id}`,
    related_type: 'contract',
    related_id:   contract_id,
  })
  if (notifs.length) await adminSupabase.from('notifications').insert(notifs)

  const [fp, sp] = await Promise.all([getProfile(fighter_id), getProfile(sponsor_id)])
  const contractUrl = `${CLIENT}/contracts/${contract_id}`

  if (fp?.email) {
    await email(fp.email, `Contract draft ready${valueLabel}`, emailHtml(`
      <p>Hi <strong style="color:#f0ece4">${esc(fp.name ?? 'there')}</strong>,</p>
      <p>A sponsorship contract${esc(valueLabel)} has been created for you.</p>
      <p>Review the terms and add your signature to activate the sponsorship.</p>
      ${ctaButton(contractUrl, 'Review Contract')}
    `))
  }
  if (sp?.email) {
    await email(sp.email, `Contract draft created${valueLabel}`, emailHtml(`
      <p>Hi <strong style="color:#f0ece4">${esc(sp.name ?? 'there')}</strong>,</p>
      <p>A contract draft${esc(valueLabel)} has been created. Sign it to send it to the fighter.</p>
      ${ctaButton(contractUrl, 'Sign Contract')}
    `))
  }
}

async function handleContractSigned(payload) {
  const { contract_id, sponsor_id, fighter_id, status } = payload
  if (!contract_id) return

  const isActive = status === 'active'
  const contractUrl = `${CLIENT}/contracts/${contract_id}`

  const notifs = []
  if (fighter_id) notifs.push({
    recipient_id: fighter_id,
    type:         'contract.signed',
    title:        isActive ? 'Contract is now active!' : 'Contract signed — awaiting co-signature',
    body:         isActive ? 'Both parties have signed. The sponsorship is live.' : null,
    action_url:   contractUrl,
    related_type: 'contract',
    related_id:   contract_id,
  })
  if (sponsor_id) notifs.push({
    recipient_id: sponsor_id,
    type:         'contract.signed',
    title:        isActive ? 'Contract is now active!' : 'Contract signed — fighter signature pending',
    body:         isActive ? 'Both parties have signed. The sponsorship is live.' : null,
    action_url:   contractUrl,
    related_type: 'contract',
    related_id:   contract_id,
  })
  if (notifs.length) await adminSupabase.from('notifications').insert(notifs)

  if (!isActive) return  // pending_fighter state handles the fighter email separately

  const [fp, sp] = await Promise.all([getProfile(fighter_id), getProfile(sponsor_id)])
  if (fp?.email) {
    await email(fp.email, 'Contract active — sponsorship is live', emailHtml(`
      <p>Hi <strong style="color:#f0ece4">${esc(fp.name ?? 'there')}</strong>,</p>
      <p>Both parties have signed. Your sponsorship contract is now <strong style="color:#00c060">active</strong>.</p>
      <p>Check your obligations and start delivering on the agreement.</p>
      ${ctaButton(contractUrl, 'View Contract')}
    `))
  }
  if (sp?.email) {
    await email(sp.email, 'Contract active — sponsorship is live', emailHtml(`
      <p>Hi <strong style="color:#f0ece4">${esc(sp.name ?? 'there')}</strong>,</p>
      <p>Both parties have signed. The sponsorship contract is now <strong style="color:#00c060">active</strong>.</p>
      ${ctaButton(contractUrl, 'View Contract')}
    `))
  }
}

async function handleContractPendingSignature(payload) {
  const { contract_id, fighter_id } = payload
  if (!contract_id || !fighter_id) return

  const contractUrl = `${CLIENT}/contracts/${contract_id}`

  await adminSupabase.from('notifications').insert({
    recipient_id: fighter_id,
    type:         'contract.pending_signature',
    title:        'Your signature is needed',
    body:         'The sponsor has signed the contract. Review and add your signature.',
    action_url:   contractUrl,
    related_type: 'contract',
    related_id:   contract_id,
  })

  const fp = await getProfile(fighter_id)
  if (fp?.email) {
    await email(fp.email, 'Your signature is needed on a contract', emailHtml(`
      <p>Hi <strong style="color:#f0ece4">${esc(fp.name ?? 'there')}</strong>,</p>
      <p>The sponsor has signed your contract. It&rsquo;s now waiting for <strong style="color:#f0ece4">your signature</strong>
         to go live.</p>
      ${ctaButton(contractUrl, 'Sign Contract')}
    `))
  }
}

async function handleObligationProofSubmitted(payload) {
  const { obligation_id, obligation_title, fighter_id, sponsor_id, contract_id } = payload
  if (!sponsor_id) return

  let fighterName = 'Fighter'
  if (fighter_id) {
    const fp = await getProfile(fighter_id)
    fighterName = fp?.name ?? fighterName
  }

  const actionUrl = contract_id ? `${CLIENT}/contracts/${contract_id}` : `${CLIENT}/contracts`
  await adminSupabase.from('notifications').insert({
    recipient_id: sponsor_id,
    type:         'obligation.proof_submitted',
    title:        `${fighterName} submitted proof`,
    body:         obligation_title ? `For: ${obligation_title}` : null,
    action_url:   actionUrl,
    related_type: 'obligation',
    related_id:   obligation_id ?? null,
  })

  const sp = await getProfile(sponsor_id)
  if (sp?.email) {
    await email(sp.email, `Proof submitted — ${esc(obligation_title ?? 'obligation')}`, emailHtml(`
      <p>Hi <strong style="color:#f0ece4">${esc(sp.name ?? 'there')}</strong>,</p>
      <p><strong style="color:#f0ece4">${esc(fighterName)}</strong> has submitted proof for
         <strong style="color:#f0ece4">${esc(obligation_title ?? 'an obligation')}</strong>.</p>
      <p>Review and approve or request changes.</p>
      ${ctaButton(actionUrl, 'Review Proof')}
    `))
  }
}

async function handleObligationProofApproved(payload) {
  const { obligation_id, obligation_title, fighter_id, contract_id } = payload
  if (!fighter_id) return

  const actionUrl = contract_id ? `${CLIENT}/contracts/${contract_id}` : `${CLIENT}/contracts`
  await adminSupabase.from('notifications').insert({
    recipient_id: fighter_id,
    type:         'obligation.proof_approved',
    title:        'Proof approved!',
    body:         obligation_title ? `Your submission for "${obligation_title}" was approved.` : null,
    action_url:   actionUrl,
    related_type: 'obligation',
    related_id:   obligation_id ?? null,
  })

  const fp = await getProfile(fighter_id)
  if (fp?.email) {
    await email(fp.email, `Proof approved — ${esc(obligation_title ?? 'obligation')}`, emailHtml(`
      <p>Hi <strong style="color:#f0ece4">${esc(fp.name ?? 'there')}</strong>,</p>
      <p>Your proof submission for <strong style="color:#f0ece4">${esc(obligation_title ?? 'your obligation')}</strong>
         has been <strong style="color:#00c060">approved</strong>.</p>
      ${ctaButton(actionUrl, 'View Contract')}
    `))
  }
}

async function handleObligationProofRejected(payload) {
  const { obligation_id, obligation_title, fighter_id, contract_id, review_notes } = payload
  if (!fighter_id) return

  const actionUrl = contract_id ? `${CLIENT}/contracts/${contract_id}` : `${CLIENT}/contracts`
  await adminSupabase.from('notifications').insert({
    recipient_id: fighter_id,
    type:         'obligation.proof_rejected',
    title:        'Proof needs resubmission',
    body:         review_notes
      ? `"${obligation_title}" — ${review_notes}`
      : obligation_title
        ? `Your submission for "${obligation_title}" was rejected. Please resubmit.`
        : 'A proof submission was rejected. Please resubmit.',
    action_url:   actionUrl,
    related_type: 'obligation',
    related_id:   obligation_id ?? null,
  })

  const fp = await getProfile(fighter_id)
  if (fp?.email) {
    await email(fp.email, `Proof needs resubmission — ${esc(obligation_title ?? 'obligation')}`, emailHtml(`
      <p>Hi <strong style="color:#f0ece4">${esc(fp.name ?? 'there')}</strong>,</p>
      <p>Your proof for <strong style="color:#f0ece4">${esc(obligation_title ?? 'an obligation')}</strong>
         needs to be resubmitted.</p>
      ${review_notes ? `<p style="padding:12px;background:#141416;border-left:2px solid #8b0000;margin:16px 0;font-size:13px">${esc(review_notes)}</p>` : ''}
      ${ctaButton(actionUrl, 'Resubmit Proof')}
    `))
  }
}

async function handlePaymentSucceeded(payload) {
  const { fighter_id, amount_usd, contract_id, payment_id } = payload
  if (!fighter_id) return

  const actionUrl = contract_id ? `${CLIENT}/contracts/${contract_id}` : `${CLIENT}/contracts`
  await adminSupabase.from('notifications').insert({
    recipient_id: fighter_id,
    type:         'payment.succeeded',
    title:        `Payment of $${amount_usd?.toLocaleString()} received`,
    body:         'Funds are being processed. Payout will follow.',
    action_url:   actionUrl,
    related_type: 'payment',
    related_id:   payment_id ?? null,
  })

  const fp = await getProfile(fighter_id)
  if (fp?.email) {
    await email(fp.email, `Payment of $${amount_usd?.toLocaleString()} received`, emailHtml(`
      <p>Hi <strong style="color:#f0ece4">${esc(fp.name ?? 'there')}</strong>,</p>
      <p>A sponsorship payment of <strong style="color:#f0ece4">$${esc(String(amount_usd?.toLocaleString() ?? ''))}</strong>
         has been processed.</p>
      ${ctaButton(actionUrl, 'View Contract')}
    `))
  }
}

async function handleMessageReceived(payload) {
  const { conversation_id, sender_id, sender_name, body_preview, recipient_ids } = payload
  if (!Array.isArray(recipient_ids) || !recipient_ids.length) return

  let senderLabel = sender_name
  if (!senderLabel) {
    const { data: p } = await adminSupabase
      .from('profiles').select('name').eq('id', sender_id).maybeSingle()
    senderLabel = p?.name ?? 'Someone'
  }

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

  const { data: profiles } = await adminSupabase
    .from('profiles').select('id, name, email').in('id', recipient_ids)

  await Promise.all((profiles ?? []).filter(p => p.email).map(p =>
    email(p.email, `New message from ${esc(senderLabel)}`, emailHtml(`
      <p>Hi <strong style="color:#f0ece4">${esc(p.name ?? 'there')}</strong>,</p>
      <p>You have a new message from <strong style="color:#f0ece4">${esc(senderLabel)}</strong>.</p>
      ${body_preview ? `<p style="padding:12px;background:#141416;border-left:2px solid #8b0000;margin:16px 0;font-size:13px;color:#b8b4ae">&ldquo;${esc(body_preview)}&rdquo;</p>` : ''}
      ${ctaButton(`${CLIENT}/inbox`, 'Open Inbox')}
    `))
  ))
}

async function handleManagerRosterInvite(payload, event) {
  const { invited_email, invited_name, manager_id, fighter_id, message } = payload
  const connId = event?.aggregate_id ?? null

  let managerName = 'A manager'
  if (manager_id) {
    const mp = await getProfile(manager_id)
    managerName = mp?.name ?? managerName
  }

  // Case A/C — existing platform fighter (confirmed or not): in-app notification,
  // NO account-invite email. They accept from their Manager / Team card.
  if (fighter_id) {
    await adminSupabase.from('notifications').insert({
      recipient_id: fighter_id,
      type:         'manager.roster_invite',
      title:        'Roster invite received',
      body:         `${managerName} invited you to join their roster.`,
      action_url:   `${CLIENT}/dashboard/fighter`,
      related_type: 'manager_fighters',
      related_id:   null,
    })
    log.info({ connId, fighter_id, manager_id, route: 'in-app' }, 'manager.roster_invite — in-app notification created')
    return
  }

  // Case B — non-platform fighter: email invite. Track the REAL delivery status
  // on the roster row so the UI never lies about "sent". A send failure rethrows
  // so the dispatcher marks the event failed (retry with backoff).
  if (!invited_email) return
  try {
    await _sendEmail(invited_email, `${esc(managerName)} invited you to join their roster`, emailHtml(`
      <p>Hi${invited_name ? ` <strong style="color:#f0ece4">${esc(invited_name)}</strong>` : ''},</p>
      <p><strong style="color:#f0ece4">${esc(managerName)}</strong> has invited you to join their fighter roster
         on The Eleventh Round.</p>
      ${message ? `<p style="padding:12px;background:#141416;border-left:2px solid #8b0000;margin:16px 0;font-size:13px;color:#b8b4ae">&ldquo;${esc(message)}&rdquo;</p>` : ''}
      <p>Create an account or sign in to accept the invitation.</p>
      ${ctaButton(`${CLIENT}/register?email=${encodeURIComponent(invited_email)}`, 'Accept Invitation')}
    `))
    if (connId) {
      await adminSupabase.from('manager_fighters').update({ invite_email_status: 'sent' }).eq('id', connId)
    }
    log.info({ connId, invited_email, manager_id, route: 'email', result: 'sent' }, 'manager.roster_invite — email sent')
  } catch (e) {
    if (connId) {
      await adminSupabase.from('manager_fighters').update({ invite_email_status: 'failed' }).eq('id', connId)
        .then(() => {}).catch(() => {})
    }
    log.error({ err: e, connId, invited_email, manager_id, route: 'email' }, 'manager.roster_invite — email FAILED')
    throw e
  }
}

// Fighter accepted a manager's invite → notify the manager.
async function handleRosterInviteAccepted(payload) {
  const { manager_id, fighter_id } = payload
  if (!manager_id) return

  const fp = await getProfile(fighter_id)
  const fighterName = fp?.name ?? 'A fighter'

  await adminSupabase.from('notifications').insert({
    recipient_id: manager_id,
    type:         'roster.invite_accepted',
    title:        'Fighter joined your roster',
    body:         `${fighterName} accepted your roster invite.`,
    action_url:   `${CLIENT}/dashboard/manager`,
    related_type: 'manager_fighters',
    related_id:   fighter_id ?? null,
  })

  const mp = await getProfile(manager_id)
  if (mp?.email) {
    await email(mp.email, `${esc(fighterName)} joined your roster`, emailHtml(`
      <p>Hi <strong style="color:#f0ece4">${esc(mp.name ?? 'there')}</strong>,</p>
      <p><strong style="color:#f0ece4">${esc(fighterName)}</strong> has <strong style="color:#00c060">accepted</strong>
         your roster invite and is now active on your roster.</p>
      ${ctaButton(`${CLIENT}/dashboard/manager`, 'View Roster')}
    `))
  }
}

// Fighter declined a manager's invite → notify the manager (resend available).
async function handleRosterInviteDeclined(payload) {
  const { manager_id, fighter_id } = payload
  if (!manager_id) return

  const fp = await getProfile(fighter_id)
  const fighterName = fp?.name ?? 'A fighter'

  await adminSupabase.from('notifications').insert({
    recipient_id: manager_id,
    type:         'roster.invite_declined',
    title:        'Roster invite declined',
    body:         `${fighterName} declined your roster invite.`,
    action_url:   `${CLIENT}/dashboard/manager`,
    related_type: 'manager_fighters',
    related_id:   fighter_id ?? null,
  })

  const mp = await getProfile(manager_id)
  if (mp?.email) {
    await email(mp.email, `${esc(fighterName)} declined your roster invite`, emailHtml(`
      <p>Hi <strong style="color:#f0ece4">${esc(mp.name ?? 'there')}</strong>,</p>
      <p><strong style="color:#f0ece4">${esc(fighterName)}</strong> has declined your roster invite.</p>
      <p>You can resend the invite from your roster page if you&rsquo;d like to try again.</p>
      ${ctaButton(`${CLIENT}/dashboard/manager`, 'View Roster')}
    `))
  }
}

// Manager accepted a fighter's request → notify the fighter.
async function handleRosterRequestAccepted(payload) {
  const { manager_id, fighter_id } = payload
  if (!fighter_id) return

  const mp = await getProfile(manager_id)
  const managerName = mp?.name ?? 'Your manager'

  await adminSupabase.from('notifications').insert({
    recipient_id: fighter_id,
    type:         'roster.request_accepted',
    title:        'You joined a roster',
    body:         `${managerName} accepted your request — you're now on their roster.`,
    action_url:   `${CLIENT}/dashboard/fighter`,
    related_type: 'manager_fighters',
    related_id:   manager_id ?? null,
  })

  const fp = await getProfile(fighter_id)
  if (fp?.email) {
    await email(fp.email, `You're now on ${esc(managerName)}'s roster`, emailHtml(`
      <p>Hi <strong style="color:#f0ece4">${esc(fp.name ?? 'there')}</strong>,</p>
      <p><strong style="color:#f0ece4">${esc(managerName)}</strong> has <strong style="color:#00c060">accepted</strong>
         your request. You&rsquo;re now connected on The Eleventh Round.</p>
      ${ctaButton(`${CLIENT}/dashboard/fighter`, 'Go to Dashboard')}
    `))
  }
}

async function handleFighterManagerRequest(payload) {
  const { manager_id, fighter_id, fighter_name, message } = payload
  if (!manager_id) return

  await adminSupabase.from('notifications').insert({
    recipient_id: manager_id,
    type:         'fighter.manager_request',
    title:        `${fighter_name ?? 'A fighter'} wants to join your roster`,
    body:         message || null,
    action_url:   `${CLIENT}/dashboard/manager`,
    related_type: 'manager_fighters',
    related_id:   fighter_id ?? null,
  })

  const mp = await getProfile(manager_id)
  if (mp?.email) {
    const fn = fighter_name ?? 'A fighter'
    await email(mp.email, `${esc(fn)} sent you a roster request`, emailHtml(`
      <p>Hi <strong style="color:#f0ece4">${esc(mp.name ?? 'there')}</strong>,</p>
      <p><strong style="color:#f0ece4">${esc(fn)}</strong> has sent you a request to join your roster.</p>
      ${message ? `<p style="padding:12px;background:#141416;border-left:2px solid #8b0000;margin:16px 0;font-size:13px;color:#b8b4ae">&ldquo;${esc(message)}&rdquo;</p>` : ''}
      ${ctaButton(`${CLIENT}/dashboard/manager`, 'Review Request')}
    `))
  }
}

async function handleSponsorApproved(payload) {
  const { user_id, company_name } = payload
  if (!user_id) return

  await adminSupabase.from('notifications').insert({
    recipient_id: user_id,
    type:         'sponsor.approved',
    title:        'Your sponsor account is verified',
    body:         'You can now publish opportunities and connect with fighters.',
    action_url:   `${CLIENT}/dashboard/sponsor`,
    related_type: 'sponsor_profiles',
    related_id:   user_id,
  })

  const sp = await getProfile(user_id)
  if (sp?.email) {
    await email(sp.email, 'Your sponsor account is now verified', emailHtml(`
      <p>Hi <strong style="color:#f0ece4">${esc(sp.name ?? company_name ?? 'there')}</strong>,</p>
      <p>Your sponsor account${company_name ? ` for <strong style="color:#f0ece4">${esc(company_name)}</strong>` : ''} has been
         <strong style="color:#00c060">verified</strong> by the Eleventh Round team.</p>
      <p>You can now publish sponsorship opportunities and start connecting with fighters.</p>
      ${ctaButton(`${CLIENT}/dashboard/sponsor`, 'Go to Dashboard')}
    `))
  }
}

async function handleBillingPackagePurchased(payload) {
  const { user_id, package_name, billing_interval, amount_cents } = payload
  if (!user_id) return

  const intervalLabel = billing_interval === 'annual' ? '/yr'
                      : billing_interval === 'monthly' ? '/mo'
                      : ' (one-time)'
  const amountLabel = amount_cents ? `$${(amount_cents / 100).toFixed(0)}${intervalLabel}` : ''

  await adminSupabase.from('notifications').insert({
    recipient_id: user_id,
    type:         'billing.package_purchased',
    title:        `${package_name ?? 'Package'} is now active`,
    body:         amountLabel || null,
    action_url:   `${CLIENT}/dashboard`,
    related_type: 'memberships',
    related_id:   user_id,
  })

  const up = await getProfile(user_id)
  if (up?.email) {
    await email(up.email, `${esc(package_name ?? 'Your plan')} is now active`, emailHtml(`
      <p>Hi <strong style="color:#f0ece4">${esc(up.name ?? 'there')}</strong>,</p>
      <p>Your <strong style="color:#f0ece4">${esc(package_name ?? 'plan')}</strong> is now
         <strong style="color:#00c060">active</strong>${amountLabel ? ` at ${esc(amountLabel)}` : ''}.</p>
      <p>All features included in your plan are unlocked. Head to your dashboard to get started.</p>
      ${ctaButton(`${CLIENT}/dashboard`, 'Access Dashboard')}
    `))
  }
}

// ── Handler registry ──────────────────────────────────────────────────────────

const HANDLERS = {
  'application.received':        handleApplicationReceived,
  'application.shortlisted':     handleApplicationShortlisted,
  'application.accepted':        handleApplicationAccepted,
  'application.rejected':        handleApplicationRejected,
  'contract.created':            handleContractCreated,
  'contract.signed':             handleContractSigned,
  'contract.pending_signature':  handleContractPendingSignature,
  'obligation.proof_submitted':  handleObligationProofSubmitted,
  'obligation.proof_approved':   handleObligationProofApproved,
  'obligation.proof_rejected':   handleObligationProofRejected,
  'payment.succeeded':           handlePaymentSucceeded,
  'message.received':            handleMessageReceived,
  'manager.roster_invite':       handleManagerRosterInvite,
  'roster.invite_accepted':      handleRosterInviteAccepted,
  'roster.invite_declined':      handleRosterInviteDeclined,
  'roster.request_accepted':     handleRosterRequestAccepted,
  'fighter.manager_request':     handleFighterManagerRequest,
  'sponsor.approved':            handleSponsorApproved,
  'billing.package_purchased':   handleBillingPackagePurchased,
}

// ── Dispatch loop ─────────────────────────────────────────────────────────────

async function tick() {
  if (!adminSupabase) return

  const { data: events, error } = await adminSupabase.rpc('claim_outbox_batch', {
    batch_size:  BATCH_SIZE,
    cutoff_time: new Date().toISOString(),
  })

  if (error) {
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
      log.warn({ event_type: event.event_type }, 'No handler — marking sent')
      await adminSupabase.from('outbox_events').update({ status: 'sent', processed_at: new Date().toISOString() }).eq('id', event.id)
      return
    }

    try {
      await handler(event.payload, event)
      await adminSupabase.from('outbox_events').update({
        status:       'sent',
        processed_at: new Date().toISOString(),
      }).eq('id', event.id)
    } catch (err) {
      const attempts = (event.attempts ?? 0) + 1
      const isDead   = attempts >= MAX_ATTEMPTS
      const backoffMs = Math.min(1_000 * 2 ** attempts, 300_000)
      log.error({ err, event_id: event.id, attempts }, 'outbox event dispatch failed')
      await adminSupabase.from('outbox_events').update({
        status:          isDead ? 'dead' : 'failed',
        attempts,
        last_error:      err.message?.slice(0, 500),
        next_attempt_at: isDead ? null : new Date(Date.now() + backoffMs).toISOString(),
      }).eq('id', event.id)
    }
  }))
}

export function startOutboxDispatcher() {
  log.info({ poll_ms: POLL_MS, batch_size: BATCH_SIZE }, 'Outbox dispatcher starting')
  const run = async () => {
    try { await tick() } catch (err) { log.error({ err }, 'outbox tick threw') }
    setTimeout(run, POLL_MS)
  }
  setTimeout(run, POLL_MS)
}
