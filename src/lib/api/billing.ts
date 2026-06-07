import { apiGet, apiPost } from './client'

export interface BillingPackage {
  id:               string
  name:             string
  audience:         string
  description:      string | null
  price_cents:      number
  billing_interval: 'monthly' | 'annual' | 'one_time'
  features:         string[] | string
  sort_order:       number
  stripe_price_id:  string | null
}

export interface BillingMembership {
  id:                   string
  status:               'active' | 'past_due' | 'canceled' | 'pending' | 'incomplete'
  billing_interval:     string | null
  current_period_start: string | null
  current_period_end:   string | null
  cancel_at_period_end: boolean
  created_at:           string
  packages: {
    id:               string
    name:             string
    audience:         string
    price_cents:      number
    billing_interval: string
    features:         string[] | string
  } | null
}

export interface BillingPaymentRow {
  id:         string
  amount:     number
  currency:   string
  status:     string
  created_at: string
  packages:   { id: string; name: string } | null
}

export const getBillingPackages = () =>
  apiGet<{ ok: boolean; packages: BillingPackage[] }>('/api/billing/packages')

export const getBillingStatus = () =>
  apiGet<{ ok: boolean; membership: BillingMembership | null; payments: BillingPaymentRow[] }>('/api/billing/me')

export const startCheckout = (packageId: string) =>
  apiPost<{ ok: boolean; url: string }>('/api/billing/checkout', { package_id: packageId })

// Admin billing
export const getAdminPaymentsList = (params?: { status?: string; limit?: number; offset?: number }) => {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.limit)  q.set('limit',  String(params.limit))
  if (params?.offset) q.set('offset', String(params.offset))
  const qs = q.toString()
  return apiGet<{
    ok: boolean
    payments: any[]
    total: number
    summary: { total_revenue_cents: number; successful: number; failed: number; pending: number }
  }>(`/api/admin/payments${qs ? `?${qs}` : ''}`)
}

export const getAdminMembershipsList = (params?: { status?: string; limit?: number; offset?: number }) => {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.limit)  q.set('limit',  String(params.limit))
  if (params?.offset) q.set('offset', String(params.offset))
  const qs = q.toString()
  return apiGet<{ ok: boolean; memberships: any[]; total: number }>(
    `/api/admin/memberships${qs ? `?${qs}` : ''}`
  )
}
