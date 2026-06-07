// Typed wrappers for admin-only API endpoints.
// All functions use apiGet/apiPost/apiPatch from client.ts, which attach
// the current Supabase session token as a Bearer header automatically.

import { apiGet, apiPost, apiPatch } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id:                  string
  name:                string
  email:               string
  role:                string
  account_type:        string | null
  status:              string | null
  onboarding_complete: boolean
  created_at:          string
}

export interface PendingSponsor {
  user_id:                  string
  company_name:             string
  industry:                 string | null
  website_url:              string | null
  description:              string | null
  budget_min_usd:           number | null
  budget_max_usd:           number | null
  campaign_goals:           string[]
  preferred_weight_classes: string[]
  is_verified:              boolean
  created_at:               string
  profiles: { id: string; email: string; name: string; status: string | null }
}

export interface AdminModule {
  id:             string
  name:           string
  description:    string | null
  category:       string | null
  order_num:      number
  is_published:   boolean
  estimated_mins: number | null
  content_url:    string | null
  avg_completion: number
  enrolled_count: number
  created_at:     string
  updated_at:     string
}

export interface AdminPackage {
  id:               string
  name:             string
  audience:         string
  description:      string | null
  price_cents:      number
  billing_interval: string
  features:         string[] | string
  active:           boolean
  sort_order:       number
  stripe_price_id:  string | null
  created_at:       string
  updated_at:       string
}

// ── Users ─────────────────────────────────────────────────────────────────────

export const getAdminUsers = (params?: {
  role?: string; status?: string; search?: string; limit?: number; offset?: number
}) => {
  const q = new URLSearchParams()
  if (params?.role)   q.set('role',   params.role)
  if (params?.status) q.set('status', params.status)
  if (params?.search) q.set('search', params.search)
  if (params?.limit)  q.set('limit',  String(params.limit))
  if (params?.offset) q.set('offset', String(params.offset))
  const qs = q.toString()
  return apiGet<{ users: AdminUser[]; total: number }>(`/api/admin/users${qs ? `?${qs}` : ''}`)
}

export const updateAdminUser = (
  id: string,
  updates: { role?: string; account_type?: string; status?: string; onboarding_complete?: boolean }
) => apiPatch<{ ok: boolean }>(`/api/admin/users/${id}`, updates)

// ── Sponsor vetting ───────────────────────────────────────────────────────────

export const getPendingSponsors = () =>
  apiGet<{ pending: PendingSponsor[]; verified: any[] }>('/api/admin/sponsors/pending')

export const verifySponsor = (userId: string, approved: boolean, reason?: string) =>
  apiPatch<{ ok: boolean; action: string }>(`/api/admin/sponsors/${userId}/verify`, { approved, reason })

// ── Education modules ─────────────────────────────────────────────────────────

export const getAdminModules = () =>
  apiGet<{ modules: AdminModule[]; total: number }>('/api/admin/modules')

export interface ModuleCreateInput {
  name: string; description?: string | null; category?: string | null
  order_num?: number; is_published?: boolean; estimated_mins?: number | null
  content_url?: string | null
}
export const createModule = (data: ModuleCreateInput) =>
  apiPost<{ ok: boolean; module: AdminModule }>('/api/admin/modules', data)

export const updateModule = (id: string, data: Partial<AdminModule>) =>
  apiPatch<{ ok: boolean; module: AdminModule }>(`/api/admin/modules/${id}`, data)

// ── Packages ──────────────────────────────────────────────────────────────────

export const getAdminPackages = () =>
  apiGet<{ packages: AdminPackage[]; stats: { total_active_subscriptions: number; mrr_usd: number } }>('/api/admin/packages')

export interface PackageCreateInput {
  name: string; audience: string; description?: string | null
  price_cents: number; billing_interval: string
  features?: string[]; active?: boolean; sort_order?: number
}
export const createPackage = (data: PackageCreateInput) =>
  apiPost<{ ok: boolean; package: AdminPackage }>('/api/admin/packages', data)

export const updatePackage = (id: string, data: Partial<PackageCreateInput> & { active?: boolean }) =>
  apiPatch<{ ok: boolean; package: AdminPackage }>(`/api/admin/packages/${id}`, data)

// ── Dashboard metrics ─────────────────────────────────────────────────────────

export const getAdminDashboard = () =>
  apiGet<{
    total_users: number; fighters: number; managers: number; sponsors: number; admins: number
    active_opportunities: number; total_applications: number
    active_contracts: number; total_contracts: number
    disputed_contracts: number; proofs_pending_review: number
    total_obligations: number; overdue_obligations: number; completed_obligations: number
    total_revenue_usd: number
  }>('/api/admin/dashboard')

export const getAdminContracts = (params?: { status?: string; limit?: number; offset?: number }) => {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.limit)  q.set('limit',  String(params.limit))
  if (params?.offset) q.set('offset', String(params.offset))
  const qs = q.toString()
  return apiGet<{ ok: boolean; contracts: any[]; total: number }>(`/api/admin/contracts${qs ? `?${qs}` : ''}`)
}
