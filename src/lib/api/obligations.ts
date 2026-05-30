import { apiGet, apiPatch, apiPost } from './client'

export interface Obligation {
  id: string
  owner_id: string
  contract_id: string | null
  title: string
  description: string | null
  due_date: string
  status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'canceled'
  priority: 'low' | 'medium' | 'high' | 'critical'
  category: string | null
  deliverable_type: string | null
  recurrence: 'once' | 'daily' | 'weekly' | 'monthly' | 'per_event'
  proof_required: boolean
  created_at: string
  updated_at: string
}

export interface ObligationProof {
  id: string
  obligation_id: string
  submitted_by: string
  proof_type: 'url' | 'file' | 'text'
  proof_value: string
  caption: string | null
  reviewed_by: string | null
  review_status: 'pending' | 'approved' | 'rejected'
  review_notes: string | null
  reviewed_at: string | null
  created_at: string
}

export const getObligation = (id: string) =>
  apiGet<{ ok: boolean; obligation: Obligation; proofs: ObligationProof[] }>(`/api/obligations/${id}`)

export const updateObligationStatus = (id: string, status: Obligation['status']) =>
  apiPatch<{ ok: boolean; obligation: Obligation }>(`/api/obligations/${id}`, { status })

export const submitProof = (id: string, body: { proof_type: 'url' | 'file' | 'text'; proof_value: string; caption?: string }) =>
  apiPost<{ ok: boolean; proof: ObligationProof }>(`/api/obligations/${id}/proof`, body)

export const reviewProof = (obligationId: string, proofId: string, review_status: 'approved' | 'rejected', review_notes?: string) =>
  apiPost<{ ok: boolean; proof: ObligationProof }>(
    `/api/obligations/${obligationId}/proof/${proofId}/review`,
    { review_status, review_notes },
  )
