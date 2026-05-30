// Typed wrappers for the sponsor API (server/routes/sponsor.js)
import { apiGet, apiPost, apiPatch } from './client'

export interface SponsorProfile {
  user_id: string
  company_name: string
  logo_path?: string | null
  website_url?: string | null
  industry?: string | null
  company_size?: 'solo' | 'small' | 'mid' | 'enterprise' | null
  hq_country?: string | null
  hq_region?: string | null
  description?: string | null
  budget_min_usd?: number | null
  budget_max_usd?: number | null
  preferred_demographics?: Record<string, unknown>
  preferred_weight_classes?: string[]
  preferred_promotions?: string[]
  campaign_goals?: string[]
  public_slug?: string | null
  is_verified?: boolean
  visibility?: 'private' | 'verified_only' | 'public'
  total_active_contracts?: number
}

export type SponsorOnboardInput = Partial<SponsorProfile> & { company_name: string }

export const getSponsorStatus = () =>
  apiGet<{ onboarded: boolean }>('/api/sponsor/status')

export const getSponsorDashboard = () =>
  apiGet<{ profile: any; sponsorProfile: SponsorProfile | null }>('/api/sponsor/dashboard')

export const onboardSponsor = (input: SponsorOnboardInput) =>
  apiPost<{ ok: boolean; sponsorProfile: SponsorProfile }>('/api/sponsor/onboard', input)

export const updateSponsorProfile = (updates: Partial<SponsorProfile> & { name?: string }) =>
  apiPatch<{ ok: boolean; sponsorProfile: SponsorProfile }>('/api/sponsor/profile', updates)
