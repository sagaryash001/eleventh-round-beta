import { apiGet, apiPost, apiPatch } from './client'

export interface Opportunity {
  id: string
  sponsor_id: string
  title: string
  description?: string | null
  campaign_type?: string | null
  budget_min_usd?: number | null
  budget_max_usd?: number | null
  budget_per_fighter_usd?: number | null
  max_fighters?: number
  deliverables?: any[]
  requirements?: Record<string, any>
  application_deadline?: string | null
  campaign_start?: string | null
  campaign_end?: string | null
  status: 'draft' | 'published' | 'closed' | 'archived' | 'cancelled'
  visibility?: string
  location_country?: string | null
  location_region?: string | null
  view_count?: number
  application_count?: number
  published_at?: string | null
  sponsor?: { id: string; name: string }
  sponsor_detail?: {
    company_name: string
    logo_path?: string | null
    is_verified?: boolean
    industry?: string | null
    website_url?: string | null
  }
}

export type OppInput = Partial<Omit<Opportunity, 'id' | 'sponsor_id' | 'status'>>

export const getOpportunities = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return apiGet<{ ok: boolean; data: Opportunity[] }>(`/api/opportunities${qs}`)
}

export const getMyOpportunities = () =>
  apiGet<{ ok: boolean; data: Opportunity[] }>('/api/opportunities/mine')

export const getOpportunity = (id: string) =>
  apiGet<{ ok: boolean; opportunity: Opportunity }>(`/api/opportunities/${id}`)

export const createOpportunity = (input: OppInput & { title: string }) =>
  apiPost<{ ok: boolean; opportunity: Opportunity }>('/api/opportunities', input)

export const updateOpportunity = (id: string, updates: OppInput) =>
  apiPatch<{ ok: boolean; opportunity: Opportunity }>(`/api/opportunities/${id}`, updates)

export const publishOpportunity = (id: string) =>
  apiPost<{ ok: boolean; opportunity: Opportunity }>(`/api/opportunities/${id}/publish`)

export const getOppApplications = (oppId: string) =>
  apiGet<{ ok: boolean; applications: any[] }>(`/api/opportunities/${oppId}/applications`)

export const changeOpportunityStatus = (id: string, status: 'closed' | 'draft') =>
  apiPatch<{ ok: boolean; opportunity: Opportunity }>(`/api/opportunities/${id}/status`, { status })
