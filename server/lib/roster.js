// ─────────────────────────────────────────────────────────────────────────────
// Manager roster — shared activation logic
//
// A manager↔fighter relationship becomes active only with fighter consent, and a
// fighter may have exactly ONE active manager at a time. Both the fighter-accept
// path (PATCH /api/fighter/manager/request/:id) and the manager-accept path
// (PATCH /api/manager/roster/:id/status, for fighter_request rows) funnel through
// here so the one-manager rule and side-effects stay consistent.
// ─────────────────────────────────────────────────────────────────────────────

import { childLogger } from './logger.js'

const log = childLogger('roster')

export const ALREADY_MANAGED_MSG = 'This fighter is already connected to a manager.'

// Pure decision for the one-manager rule — kept separate so it is unit-testable
// without a database. Returns an HTTP-shaped error or null when activation is OK.
export function blockIfActiveManager(existingActiveConnection) {
  return existingActiveConnection
    ? { error: ALREADY_MANAGED_MSG, status: 409 }
    : null
}

// Find the fighter's current active manager connection, excluding one row id.
async function fighterActiveManager(sb, fighterId, excludeConnId) {
  let q = sb
    .from('manager_fighters')
    .select('id, manager_id')
    .eq('fighter_id', fighterId)
    .eq('status', 'active')
  if (excludeConnId) q = q.neq('id', excludeConnId)
  const { data } = await q.maybeSingle()
  return data ?? null
}

// Activate a connection with all consent side-effects:
//   • enforce the one-manager rule (no other active manager)
//   • mark the row active
//   • link fighter_profiles.manager_id (source of truth for the profile box)
//   • supersede the fighter's other still-pending invites (decline them)
//   • emit an outbox event
// Returns { ok: true } or { error, status } for the caller to translate to HTTP.
export async function activateConnection(sb, { conn, managerId, fighterId }) {
  const now = new Date().toISOString()

  const blocked = blockIfActiveManager(await fighterActiveManager(sb, fighterId, conn.id))
  if (blocked) {
    log.info({ connectionId: conn.id, managerId, fighterId }, 'activation blocked — fighter already managed')
    return blocked
  }

  const { error: uErr } = await sb
    .from('manager_fighters')
    .update({ status: 'active', accepted_at: now, declined_at: null, removed_at: null, updated_at: now })
    .eq('id', conn.id)
  if (uErr) return { error: uErr.message, status: 500 }

  // Link the fighter profile to this manager. Fighters always have a profile row
  // after onboarding; an UPDATE on a missing row is a harmless no-op.
  const { error: fpErr } = await sb
    .from('fighter_profiles')
    .update({ manager_id: managerId, updated_at: now })
    .eq('user_id', fighterId)
  if (fpErr) log.warn({ err: fpErr, fighterId, managerId }, 'activateConnection: fighter_profiles link failed')

  // Only one manager at a time — decline the fighter's other open invites.
  const { error: sibErr } = await sb
    .from('manager_fighters')
    .update({ status: 'declined', declined_at: now, updated_at: now })
    .eq('fighter_id', fighterId)
    .eq('status', 'pending')
    .neq('id', conn.id)
  if (sibErr) log.warn({ err: sibErr, fighterId }, 'activateConnection: sibling decline failed')

  // Recipient-specific notifications are emitted by the call site (a fighter
  // accepting notifies the manager; a manager accepting notifies the fighter).
  log.info({ connectionId: conn.id, managerId, fighterId, status: 'active' }, 'connection activated')
  return { ok: true }
}

// When an active relationship ends (manager removes, or fighter leaves), unlink
// the profile only if it still points at this manager.
export async function clearManagerLink(sb, fighterId, managerId) {
  if (!fighterId) return
  const now = new Date().toISOString()
  const { data: fp } = await sb
    .from('fighter_profiles')
    .select('manager_id')
    .eq('user_id', fighterId)
    .maybeSingle()
  if (fp?.manager_id === managerId) {
    await sb.from('fighter_profiles').update({ manager_id: null, updated_at: now }).eq('user_id', fighterId)
    log.info({ fighterId, managerId }, 'fighter_profiles manager link cleared')
  }
}
