import { apiGet, apiPost, apiPatch } from './client'

export interface Contract {
  id: string
  opportunity_id: string | null
  application_id: string | null
  sponsor_id: string
  fighter_id: string
  value_usd: number
  platform_fee_bps: number
  payment_schedule: 'upfront' | 'milestones' | 'monthly' | 'on_completion'
  start_date: string | null
  end_date: string | null
  deliverables_snapshot: Deliverable[]
  terms_markdown: string | null
  status: 'draft' | 'pending_fighter' | 'pending_sponsor' | 'active' | 'in_dispute' | 'completed' | 'terminated' | 'expired'
  sponsor_accepted_at: string | null
  fighter_accepted_at: string | null
  terminated_by: string | null
  termination_reason: string | null
  completed_at: string | null
  terminated_at: string | null
  created_at: string
  updated_at: string
}

export interface Deliverable {
  type: string
  count?: number
  notes?: string
}

export const createContract = (body: {
  application_id: string
  value_usd: number
  payment_schedule?: string
  start_date?: string
  end_date?: string
  terms_markdown?: string
}) => apiPost<{ ok: boolean; contract: Contract }>('/api/contracts', body)

export const getContracts = () =>
  apiGet<{ ok: boolean; contracts: Contract[] }>('/api/contracts')

export const getContract = (id: string) =>
  apiGet<{ ok: boolean; contract: Contract; obligations: import('./obligations').Obligation[] }>(`/api/contracts/${id}`)

export const updateContract = (id: string, updates: Partial<Pick<Contract, 'value_usd' | 'payment_schedule' | 'start_date' | 'end_date' | 'terms_markdown' | 'deliverables_snapshot'>>) =>
  apiPatch<{ ok: boolean; contract: Contract }>(`/api/contracts/${id}`, updates)

export const acceptContract = (id: string) =>
  apiPost<{ ok: boolean; contract: Contract }>(`/api/contracts/${id}/accept`)

export const terminateContract = (id: string, termination_reason?: string) =>
  apiPost<{ ok: boolean; contract: Contract }>(`/api/contracts/${id}/terminate`, { termination_reason })

export const getContractObligations = (id: string) =>
  apiGet<{ ok: boolean; obligations: import('./obligations').Obligation[] }>(`/api/contracts/${id}/obligations`)

export const addContractObligation = (id: string, body: { title: string; due_date: string; description?: string; deliverable_type?: string; proof_required?: boolean }) =>
  apiPost<{ ok: boolean; obligation: import('./obligations').Obligation }>(`/api/contracts/${id}/obligations`, body)
