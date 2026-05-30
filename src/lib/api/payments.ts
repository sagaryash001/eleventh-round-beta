import { apiGet, apiPost } from './client'

export interface SponsorshipPayment {
  id: string
  contract_id: string
  sponsor_id: string
  fighter_id: string
  milestone_id: string | null
  amount_usd: number
  platform_fee_usd: number
  net_to_fighter_usd: number
  currency: string
  stripe_payment_intent_id: string | null
  stripe_charge_id: string | null
  status: 'requires_payment' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'held'
  failure_code: string | null
  failure_message: string | null
  paid_at: string | null
  created_at: string
}

export interface PaymentMilestone {
  id: string
  contract_id: string
  name: string
  amount_usd: number
  due_date: string | null
  status: 'pending' | 'invoiced' | 'paid' | 'skipped'
  sequence: number
  created_at: string
}

export const createPaymentIntent = (contract_id: string, milestone_id?: string) =>
  apiPost<{ ok: boolean; client_secret: string; payment_id: string; reused?: boolean }>(
    '/api/payments/intent', { contract_id, milestone_id },
  )

export const getPayment = (id: string) =>
  apiGet<{ ok: boolean; payment: SponsorshipPayment }>(`/api/payments/${id}`)

export const getContractPayments = (contractId: string) =>
  apiGet<{ ok: boolean; payments: SponsorshipPayment[] }>(`/api/payments/contract/${contractId}`)

export const getMilestones = (contractId: string) =>
  apiGet<{ ok: boolean; milestones: PaymentMilestone[] }>(`/api/contracts/${contractId}/milestones`)

export const addMilestone = (contractId: string, body: { name: string; amount_usd: number; due_date?: string }) =>
  apiPost<{ ok: boolean; milestone: PaymentMilestone }>(`/api/contracts/${contractId}/milestones`, body)
