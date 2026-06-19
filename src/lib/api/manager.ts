// Typed wrappers for manager + fighter-side manager API endpoints.

import { apiGet, apiPost, apiPatch } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FighterSummary {
  id: string; name: string; email: string
  division: string | null; weight_class: string | null
  record_wins: number; record_losses: number; record_draws: number
  base_city: string | null; gym_name: string | null; coach_name: string | null
  readiness: number
}

export interface RosterEntry {
  id: string
  status: 'pending' | 'active' | 'declined' | 'removed'
  source: string
  fighter_id: string | null
  invited_email: string | null
  invited_name: string | null
  pending_fighter_data: Record<string, any>
  requested_by: string | null
  request_message: string | null
  team_name: string | null
  invite_email_status: 'queued' | 'sent' | 'failed' | null
  created_at: string
  accepted_at: string | null
  declined_at: string | null
  fighter: FighterSummary | null
}

export interface ManagerInfo {
  id: string; name: string; email: string; team_name: string | null
}

export interface ManagerConnection {
  id: string
  manager_id: string
  status: string
  source: string
  request_message: string | null
  requested_by: string | null
  team_name: string | null
  created_at: string
  accepted_at: string | null
  declined_at: string | null
  manager: ManagerInfo | null
}

// ── Manager-side ──────────────────────────────────────────────────────────────

export const getManagerRoster = () =>
  apiGet<{ roster: RosterEntry[] }>('/api/manager/roster')

export const inviteFighter = (data: { email: string; name?: string | null; message?: string | null }) =>
  apiPost<{ ok: boolean; connection_id: string; matched: boolean }>('/api/manager/roster/invite', data)

export interface PendingProfileInput {
  name: string; sport?: string; weight_class?: string | null
  record_wins?: number; record_losses?: number; record_draws?: number
  base_city?: string | null; notes?: string | null
}

export const createPendingFighter = (data: PendingProfileInput) =>
  apiPost<{ ok: boolean; connection_id: string }>('/api/manager/roster/create-pending', data)

// Edit a manager-only draft profile.
export const updatePendingProfile = (id: string, data: PendingProfileInput) =>
  apiPatch<{ ok: boolean }>(`/api/manager/roster/${id}/pending-profile`, data)

// Convert a draft profile into a real invite by adding an email.
export const convertPendingToInvite = (id: string, email: string) =>
  apiPost<{ ok: boolean; connection_id: string; matched: boolean }>(`/api/manager/roster/${id}/invite-email`, { email })

export const updateConnectionStatus = (id: string, status: 'active' | 'declined' | 'removed') =>
  apiPatch<{ ok: boolean }>(`/api/manager/roster/${id}/status`, { status })

// Re-send a declined or pending invite (manager side).
export const resendInvite = (id: string) =>
  apiPost<{ ok: boolean }>(`/api/manager/roster/${id}/resend`, {})

export const getFighterDetail = (fighterId: string) =>
  apiGet<any>(`/api/manager/fighters/${fighterId}`)

export const updateFighterProfile = (
  fighterId: string,
  data: Partial<{
    weight_class: string; division: string
    record_wins: number; record_losses: number; record_draws: number
    base_city: string; gym_name: string; coach_name: string
    current_promotion: string; pro_status: string
    sponsorship_interests: string[]
  }>
) => apiPatch<{ ok: boolean }>(`/api/manager/fighters/${fighterId}/profile`, data)

// ── Fighter-side ──────────────────────────────────────────────────────────────

export const getFighterManager = () =>
  apiGet<{ connections: ManagerConnection[] }>('/api/fighter/manager')

export const requestManager = (data: {
  manager_email?: string | null; team_name?: string | null; message?: string | null
}) => apiPost<{ ok: boolean; connection_id: string }>('/api/fighter/manager/request', data)

export const cancelManagerRequest = (connectionId: string) =>
  apiPatch<{ ok: boolean }>(`/api/fighter/manager/request/${connectionId}`, { status: 'removed' })

// Fighter accepts a manager-initiated invite (→ active).
export const acceptManagerInvite = (connectionId: string) =>
  apiPatch<{ ok: boolean }>(`/api/fighter/manager/request/${connectionId}`, { status: 'active' })

// Fighter declines a manager-initiated invite (→ declined; manager can resend).
export const declineManagerInvite = (connectionId: string) =>
  apiPatch<{ ok: boolean }>(`/api/fighter/manager/request/${connectionId}`, { status: 'declined' })

export const getManagerContracts = () =>
  apiGet<{ contracts: Array<{
    id: string; fighter_id: string; sponsor_id: string
    value_usd: number; status: string; payment_schedule: string
    start_date: string | null; end_date: string | null
    created_at: string; updated_at: string
    fighter: { id: string; name: string } | null
    obligations_total: number; obligations_completed: number
  }> }>('/api/manager/contracts')
