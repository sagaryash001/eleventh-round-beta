import { apiGet, apiPost, apiPatch } from './client'

export interface Application {
  id: string
  opportunity_id: string
  fighter_id: string
  sponsor_id: string
  direction: 'fighter_applied' | 'sponsor_invited'
  status: 'applied' | 'under_review' | 'shortlisted' | 'accepted' | 'rejected' | 'withdrawn' | 'expired'
  cover_message?: string | null
  match_score?: number | null
  price_proposed_usd?: number | null
  rejection_reason?: string | null
  created_at: string
  opportunity?: any
  fighter?: any
  fighter_detail?: any
  sponsor_detail?: any
}

export const applyToOpportunity = (opportunity_id: string, cover_message?: string) =>
  apiPost<{ ok: boolean; application: Application }>('/api/applications', { opportunity_id, cover_message })

export const getMyApplications = () =>
  apiGet<{ ok: boolean; applications: Application[] }>('/api/applications/mine')

export const updateApplicationStatus = (
  id: string,
  status: Application['status'],
  rejection_reason?: string,
) => apiPatch<{ ok: boolean; application: Application }>(`/api/applications/${id}`, { status, rejection_reason })

export const inviteFighter = (opportunity_id: string, fighter_id: string, cover_message?: string) =>
  apiPost<{ ok: boolean; application: Application }>('/api/applications/invite', {
    opportunity_id, fighter_id, cover_message,
  })
