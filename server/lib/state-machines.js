// Contract and obligation state-machine guards.
// Each function throws { status, message } if the transition is illegal.

// ── Contract ─────────────────────────────────────────────────────────────────
// Sponsor accepts → pending_fighter
// Fighter accepts when pending_fighter → active
// Either party can terminate pending_fighter or active
const CONTRACT_SPONSOR_TRANSITIONS = {
  draft:           ['pending_fighter', 'terminated'],
  pending_fighter: ['terminated'],
  active:          ['in_dispute', 'terminated'],
}
const CONTRACT_FIGHTER_TRANSITIONS = {
  pending_fighter: ['active', 'terminated'],
  active:          ['in_dispute', 'terminated'],
}

export function assertContractTransition(contract, newStatus, actorId, actorRole) {
  const isSponsor = actorId === contract.sponsor_id || actorRole === 'admin'
  const isFighter = actorId === contract.fighter_id || actorRole === 'admin'

  const allowed = new Set([
    ...(isSponsor ? CONTRACT_SPONSOR_TRANSITIONS[contract.status] ?? [] : []),
    ...(isFighter ? CONTRACT_FIGHTER_TRANSITIONS[contract.status] ?? [] : []),
  ])

  if (!allowed.has(newStatus)) {
    const err = new Error(`Cannot move contract from '${contract.status}' to '${newStatus}' as ${actorRole}.`)
    err.status = 400
    throw err
  }
}

// ── Obligation ────────────────────────────────────────────────────────────────
// Fighter (owner) drives: pending → in_progress → completed
// Admin or cron can flip → overdue or canceled
const OBLIGATION_OWNER_TRANSITIONS = {
  pending:     ['in_progress', 'canceled'],
  in_progress: ['completed', 'canceled'],
  overdue:     ['completed', 'canceled'],
}
const OBLIGATION_ADMIN_TRANSITIONS = {
  pending:     ['in_progress', 'overdue', 'canceled'],
  in_progress: ['completed', 'overdue', 'canceled'],
  overdue:     ['completed', 'canceled'],
}

export function assertObligationTransition(obligation, newStatus, actorId, actorRole) {
  const isOwner = actorId === obligation.owner_id
  const isAdmin = actorRole === 'admin'

  let allowed = []
  if (isAdmin)       allowed = OBLIGATION_ADMIN_TRANSITIONS[obligation.status] ?? []
  else if (isOwner)  allowed = OBLIGATION_OWNER_TRANSITIONS[obligation.status] ?? []

  if (!allowed.includes(newStatus)) {
    const err = new Error(`Cannot move obligation from '${obligation.status}' to '${newStatus}'.`)
    err.status = 400
    throw err
  }
}
